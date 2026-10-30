/**
 * Signing in through the organization's own identity provider.
 *
 * Peter: *"ok, assume this is a service an organization would choose to deploy on their own - is
 * there a better path?"* — then *"so this would work with google sso?"*. So the instance speaks plain
 * OIDC to whatever the organization already runs: Google Workspace, Okta, Entra ID, Keycloak, or
 * Clerk. Four variables, no vendor account, and nothing provider-specific beyond Google's `hd`.
 *
 * ⛔ THE PROVIDER PROVES AN ADDRESS AND NOTHING MORE. It never decides which projects somebody
 * reaches — ownership and membership still do — and it never makes anybody a `browser` principal.
 * The instance does that by writing a session row (`startSession`), which is the one thing
 * `mayRecord` trusts. That seam was left open on purpose: `requestLogin` said "exchanging an OAuth
 * callback for an email is the host's business". This is the host's business.
 *
 * ⛔ AND ITS ANSWER IS CHECKED, NOT BELIEVED. An address the provider has not verified is refused —
 * accounts here are keyed by address, so an unverified one is somebody else's account. Entra ID
 * sends no `email_verified` at all; `PRODUCTOS_OIDC_TRUST_EMAIL=1` is the operator saying their
 * provider only ever issues addresses it owns, and it is a sentence somebody has to write.
 */
import crypto from "node:crypto";
import type http from "node:http";
import * as oidc from "openid-client";
import { and, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import type { Db } from "./access.js";
import { accountFor, endSession, startSession } from "./identity.js";
import { oauthGrants, providerLinks, sessions, signInRequests, tokens } from "./schema.js";

export interface SignInConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scopes: string;
  /** Empty means any address the provider verifies. */
  allowedDomains: string[];
  trustEmail: boolean;
}

/** ⛔ Google sets `hd` only on accounts a Workspace manages. A consumer Gmail address never has it. */
const GOOGLE = "https://accounts.google.com";

/** Long enough for a working day, short enough that leaving the organization reaches the page by tomorrow. */
export const SESSION_HOURS = 12;

/**
 * ⛔ HALF-CONFIGURED IS A REFUSAL TO START, NOT SIGN-IN QUIETLY OFF. An issuer with no client id
 * would otherwise boot an instance nobody can sign in to, which reads as an outage; a client id with
 * no issuer would boot one that never asks.
 */
export function signInConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SignInConfig | undefined {
  const issuer = env.PRODUCTOS_OIDC_ISSUER?.trim().replace(/\/+$/, "");
  const clientId = env.PRODUCTOS_OIDC_CLIENT_ID?.trim();
  if (!issuer && !clientId) return undefined;
  if (!issuer || !clientId) {
    throw new Error(
      "PRODUCTOS_OIDC_ISSUER and PRODUCTOS_OIDC_CLIENT_ID are set together or not at all — " +
        "half of them would boot an instance nobody can sign in to.",
    );
  }
  return {
    issuer,
    clientId,
    clientSecret: env.PRODUCTOS_OIDC_CLIENT_SECRET?.trim() || undefined,
    scopes: env.PRODUCTOS_OIDC_SCOPES?.trim() || "openid email profile",
    allowedDomains: (env.PRODUCTOS_ALLOWED_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    trustEmail: env.PRODUCTOS_OIDC_TRUST_EMAIL?.trim() === "1",
  };
}

/**
 * Where this instance is, as the outside world addresses it.
 *
 * ⛔ SET IT WHEREVER ANYBODY ELSE CAN REACH THE INSTANCE. Redirects and the OAuth issuer are built
 * from it, and the fallback reads the request's own `Host` — right on a laptop, and a value any
 * caller chooses everywhere else.
 */
export function publicOrigin(req: http.IncomingMessage, env: NodeJS.ProcessEnv = process.env): string {
  const set = env.PRODUCTOS_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (set) return new URL(set).origin;
  const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0].trim();
  return `${proto}://${req.headers.host ?? "localhost"}`;
}

// ---------------------------------------------------------------------------
// The session cookie
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "productos_session";

export const cookieOf = (req: http.IncomingMessage): string | undefined => {
  const raw = String(req.headers.cookie ?? "");
  const hit = raw
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === SESSION_COOKIE)?.[1];
  return hit ? decodeURIComponent(hit) : undefined;
};

/** ⛔ HttpOnly and SameSite=Lax: no script reads it, and a cross-site form post arrives without it. */
const sessionCookie = (origin: string, value: string, maxAge: number): string =>
  [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(origin.startsWith("https:") ? ["Secure"] : []),
  ].join("; ");

/**
 * ⛔ ONLY A PATH ON THIS INSTANCE. `next` comes back from a round trip through somebody else's
 * server, and `//evil.example` is a path to a browser and a host to everyone else.
 */
export const safeNext = (next: unknown): string => {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
};

/**
 * A person with no session asking for a page: send them to sign in rather than hand them JSON.
 *
 * ⛔ PAGES ONLY. An API call or an MCP request still gets its 401 — a redirect to a sign-in form is
 * no answer to a script, and it would hide the refusal the script needs to see.
 */
export function sendToSignIn(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if ((req.method ?? "GET") !== "GET") return false;
  if (!String(req.headers.accept ?? "").includes("text/html")) return false;
  if (!signInConfigFromEnv(env)) return false;
  res.writeHead(302, { location: `/auth/sign-in?next=${encodeURIComponent(safeNext(req.url))}` });
  res.end();
  return true;
}

// ---------------------------------------------------------------------------
// The provider's refresh token, at rest
// ---------------------------------------------------------------------------

/**
 * ⛔ ENCRYPTED, OR NOT KEPT. A provider refresh token can act as that person at the provider, which
 * is a larger thing than anything else in this database. With no `PRODUCTOS_SECRET` it is dropped,
 * and Claude's access is capped at a week instead of renewed against the provider — see
 * `familyLifetime` in `oauth.ts`.
 */
const keyOf = (env: NodeJS.ProcessEnv): Buffer | undefined => {
  const secret = env.PRODUCTOS_SECRET?.trim();
  return secret ? crypto.createHash("sha256").update(secret).digest() : undefined;
};

export function seal(plain: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = keyOf(env);
  if (!key) return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function unseal(sealed: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = keyOf(env);
  const [v, iv, tag, body] = sealed.split(".");
  if (!key || v !== "v1" || !iv || !tag || !body) return undefined;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf-8");
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// The provider
// ---------------------------------------------------------------------------

const discovered = new Map<string, Promise<oidc.Configuration>>();

/**
 * ⛔ PLAIN HTTP ONLY FOR A PROVIDER ON THIS MACHINE. The suite runs a provider on 127.0.0.1; an
 * issuer anywhere else over http would carry ID tokens in the clear.
 */
const isLoopback = (url: URL): boolean => ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);

function providerFor(cfg: SignInConfig): Promise<oidc.Configuration> {
  const key = `${cfg.issuer} ${cfg.clientId}`;
  let hit = discovered.get(key);
  if (!hit) {
    const url = new URL(cfg.issuer);
    hit = oidc.discovery(
      url,
      cfg.clientId,
      cfg.clientSecret,
      undefined,
      url.protocol === "http:" && isLoopback(url) ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    /** ⛔ A failed discovery is not cached, or one bad minute at the provider is an outage until restart. */
    hit.catch(() => discovered.delete(key));
    discovered.set(key, hit);
  }
  return hit;
}

/**
 * Who the provider says this is, and whether they are let in.
 *
 * ⛔ GOOGLE IS CHECKED BY `hd`, EVERYONE ELSE BY THE ADDRESS. A suffix is something an address says
 * about itself; `hd` is Google saying the organization's Workspace manages it.
 */
export function admit(
  cfg: SignInConfig,
  claims: Record<string, unknown>,
): { ok: true; email: string } | { ok: false; why: string } {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, why: "the provider did not say which address this is — ask it for the `email` scope" };
  if (claims.email_verified !== true && !cfg.trustEmail) {
    return { ok: false, why: `the provider has not verified ${email}` };
  }
  if (cfg.allowedDomains.length) {
    const domain = cfg.issuer === GOOGLE ? String(claims.hd ?? "").toLowerCase() : email.split("@").pop() ?? "";
    if (!cfg.allowedDomains.includes(domain)) {
      return {
        ok: false,
        why:
          cfg.issuer === GOOGLE && !claims.hd
            ? `${email} is not an account your organization's Google Workspace manages`
            : `${email} is not in an organization this instance admits`,
      };
    }
  }
  return { ok: true, email };
}

/**
 * The account a provider identity is, linking it on first sight.
 *
 * ⛔ ONE PROVIDER IDENTITY PER ACCOUNT PER ISSUER. If the address already belongs to an account the
 * same issuer linked to somebody else, that is two people claiming one address — refused, never
 * resolved by handing over the account.
 */
async function accountOf(
  db: Db,
  cfg: SignInConfig,
  subject: string,
  email: string,
): Promise<{ ok: true; account: string } | { ok: false; why: string }> {
  const [linked] = await db
    .select({ account: providerLinks.accountId })
    .from(providerLinks)
    .where(and(eq(providerLinks.issuer, cfg.issuer), eq(providerLinks.subject, subject)));
  if (linked) return { ok: true, account: linked.account };

  const account = await accountFor(db, email);
  const [other] = await db
    .select({ subject: providerLinks.subject })
    .from(providerLinks)
    .where(and(eq(providerLinks.issuer, cfg.issuer), eq(providerLinks.accountId, account)));
  if (other) {
    return { ok: false, why: `${email} already belongs to a different person at this provider` };
  }
  await db.insert(providerLinks).values({ issuer: cfg.issuer, subject, accountId: account });
  return { ok: true, account };
}

/**
 * Does the provider still know this person? Asked when Claude renews its access.
 *
 * ⛔ THREE ANSWERS, AND "UNREACHABLE" IS NOT "NO". A provider outage must not sign everybody out of
 * Claude; a provider saying the grant is gone must. Between checks the answer is reused for an hour,
 * because Claude renews hourly and asking twice in a minute tells nobody anything new.
 */
export async function stillAtProvider(
  db: Db,
  account: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<"yes" | "gone" | "unreachable" | "cannot-ask"> {
  const cfg = signInConfigFromEnv(env);
  if (!cfg) return "yes";
  const [link] = await db
    .select()
    .from(providerLinks)
    .where(and(eq(providerLinks.issuer, cfg.issuer), eq(providerLinks.accountId, account)));
  if (!link) return "cannot-ask";
  if (Date.now() - link.checkedAt.getTime() < 3_600_000) return "yes";
  const refresh = link.refresh ? unseal(link.refresh, env) : undefined;
  if (!refresh) return "cannot-ask";
  try {
    const t = await oidc.refreshTokenGrant(await providerFor(cfg), refresh);
    await db
      .update(providerLinks)
      .set({ checkedAt: new Date(), ...(t.refresh_token ? { refresh: seal(t.refresh_token, env) } : {}) })
      .where(and(eq(providerLinks.issuer, link.issuer), eq(providerLinks.subject, link.subject)));
    return "yes";
  } catch (e) {
    if (e instanceof oidc.ResponseBodyError && e.error === "invalid_grant") return "gone";
    return "unreachable";
  }
}

/**
 * Somebody the provider no longer knows: everything they held here ends now.
 *
 * ⛔ EVERY TOKEN, NOT ONLY CLAUDE'S. A token pasted into a CI secret by somebody who has left is the
 * same person still holding a key.
 */
export async function endEverythingFor(db: Db, account: string): Promise<void> {
  const now = new Date();
  await db
    .update(oauthGrants)
    .set({ revokedAt: now })
    .where(and(eq(oauthGrants.accountId, account), isNull(oauthGrants.revokedAt)));
  await db
    .update(tokens)
    .set({ revokedAt: now })
    .where(and(eq(tokens.accountId, account), isNull(tokens.revokedAt)));
  await db.delete(sessions).where(eq(sessions.accountId, account));
}

/** Whether a renewal can ask the provider about this account at all — it decides how long consent lasts. */
export async function canAskProvider(db: Db, account: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const cfg = signInConfigFromEnv(env);
  if (!cfg) return true;
  const [link] = await db
    .select({ refresh: providerLinks.refresh })
    .from(providerLinks)
    .where(and(eq(providerLinks.issuer, cfg.issuer), eq(providerLinks.accountId, account), isNotNull(providerLinks.refresh)));
  return Boolean(link?.refresh && unseal(link.refresh, env));
}

// ---------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------

const page = (res: http.ServerResponse, status: number, title: string, body: string): true => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1d1d1f}` +
      `h1{font-size:1.4rem}a{color:inherit}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`,
  );
  return true;
};

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * `/auth/sign-in`, `/auth/callback` and `/auth/sign-out`.
 *
 * ⛔ THE PROVIDER'S ROUND TRIP IS BOUND TO THIS INSTANCE'S REQUEST — state, nonce and a PKCE
 * verifier, kept server-side and used once. A callback nobody here started is refused, which is what
 * stops somebody signing a victim into the attacker's own account.
 */
export async function signInRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: { db: Db; env?: NodeJS.ProcessEnv },
): Promise<boolean> {
  if (!pathname.startsWith("/auth/")) return false;
  const env = opts.env ?? process.env;
  const origin = publicOrigin(req, env);
  const url = new URL(req.url ?? "/", origin);

  if (pathname === "/auth/sign-out") {
    const session = cookieOf(req);
    if (session) await endSession(opts.db, session);
    res.writeHead(302, { location: "/", "set-cookie": sessionCookie(origin, "", 0) });
    res.end();
    return true;
  }

  const cfg = signInConfigFromEnv(env);
  if (!cfg) {
    return page(
      res,
      404,
      "Sign-in is not set up here",
      "<p>This instance has no identity provider. Its operator sets <code>PRODUCTOS_OIDC_ISSUER</code> and " +
        "<code>PRODUCTOS_OIDC_CLIENT_ID</code> to turn sign-in on.</p>",
    );
  }

  if (pathname === "/auth/sign-in") {
    const provider = await providerFor(cfg);
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const again = url.searchParams.get("consent") === "1";
    await opts.db.delete(signInRequests).where(lt(signInRequests.expiresAt, new Date()));
    await opts.db.insert(signInRequests).values({
      state,
      verifier,
      nonce,
      next: (again ? "!" : "") + safeNext(url.searchParams.get("next")),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const params: Record<string, string> = {
      redirect_uri: `${origin}/auth/callback`,
      scope: cfg.scopes,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    };
    /**
     * ⛔ GOOGLE HANDS OUT A REFRESH TOKEN ONLY WHEN ASKED FOR OFFLINE ACCESS, and only on the first
     * consent unless consent is asked for again — which the callback does, once, when it has none.
     */
    if (cfg.issuer === GOOGLE) {
      params.access_type = "offline";
      if (again) params.prompt = "consent";
      if (cfg.allowedDomains.length === 1) params.hd = cfg.allowedDomains[0];
    }
    res.writeHead(302, { location: oidc.buildAuthorizationUrl(provider, params).href });
    res.end();
    return true;
  }

  if (pathname === "/auth/callback") {
    const state = url.searchParams.get("state") ?? "";
    const [pending] = await opts.db
      .delete(signInRequests)
      .where(and(eq(signInRequests.state, state), gt(signInRequests.expiresAt, new Date())))
      .returning();
    if (!pending) {
      return page(res, 400, "That sign-in had expired", `<p><a href="/auth/sign-in">Sign in again</a>.</p>`);
    }
    const askedAgain = pending.next.startsWith("!");
    const next = safeNext(pending.next.replace(/^!/, ""));

    let claims: Record<string, unknown>;
    let refresh: string | undefined;
    try {
      const t = await oidc.authorizationCodeGrant(await providerFor(cfg), url, {
        pkceCodeVerifier: pending.verifier,
        expectedState: state,
        expectedNonce: pending.nonce,
        idTokenExpected: true,
      });
      claims = (t.claims() ?? {}) as Record<string, unknown>;
      refresh = t.refresh_token;
    } catch (e) {
      return page(res, 400, "The provider did not sign you in", `<p>${esc((e as Error).message)}</p>`);
    }

    const admitted = admit(cfg, claims);
    if (!admitted.ok) return page(res, 403, "You can't sign in here", `<p>${esc(admitted.why)}.</p>`);
    const linked = await accountOf(opts.db, cfg, String(claims.sub), admitted.email);
    if (!linked.ok) return page(res, 403, "You can't sign in here", `<p>${esc(linked.why)}.</p>`);

    const sealed = refresh ? seal(refresh, env) : undefined;
    await opts.db
      .update(providerLinks)
      .set({ checkedAt: new Date(), ...(sealed ? { refresh: sealed } : {}) })
      .where(and(eq(providerLinks.issuer, cfg.issuer), eq(providerLinks.subject, String(claims.sub))));

    /** Google withheld a refresh token it gave out once before: ask for consent again, once. */
    if (cfg.issuer === GOOGLE && !askedAgain && keyOf(env) && !(await canAskProvider(opts.db, linked.account, env))) {
      res.writeHead(302, { location: `/auth/sign-in?consent=1&next=${encodeURIComponent(next)}` });
      res.end();
      return true;
    }

    const session = await startSession(opts.db, linked.account, SESSION_HOURS);
    res.writeHead(302, { location: next, "set-cookie": sessionCookie(origin, session, SESSION_HOURS * 3600) });
    res.end();
    return true;
  }

  return false;
}
