/**
 * The instance as its own OAuth authorization server, so Claude can connect to a project's MCP.
 *
 * Peter: *"so this will support mcp also?"*. claude.ai and Claude Desktop connect to a remote MCP
 * server only over OAuth; a pasted token is a Claude Code convenience. So the instance does what
 * GitHub's and Sentry's MCP servers do — it issues the tokens itself, and the organization's
 * provider (`sign-in.ts`) is only how the person on the consent page proves who they are.
 *
 * ⛔ WHY NOT POINT CLAUDE AT THE PROVIDER DIRECTLY. Enterprise providers rarely let an unknown client
 * register itself, and mark audiences differently from one to the next. Here Claude registers with
 * us — by a metadata URL, or dynamically — and no organization has to configure Claude anywhere.
 *
 * ⛔ AND WHAT CLAUDE GETS IS A TOKEN LIKE ANY OTHER. A row in `tokens`, hashed, scoped, limited to the
 * project the consent named, revocable from the project page. `principalFrom` makes it
 * `kind: "token"`, so `mayRecord` refuses it every verdict exactly as it refuses a pasted one. A
 * person agreeing that Claude may connect is not that person agreeing to anything Claude writes.
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import type http from "node:http";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { TOKEN_SCOPES, type TokenScope } from "../identity.js";
import { type Db, isRefusal, storeFor } from "./access.js";
import { hashToken, issueToken, principalFrom } from "./identity.js";
import { mcpProjectOf } from "./mcp.js";
import { oauthClients, oauthCodes, oauthGrants, projects, tokens } from "./schema.js";
import {
  canAskProvider,
  cookieOf,
  endEverythingFor,
  esc,
  publicOrigin,
  safeNext,
  signInConfigFromEnv,
  stillAtProvider,
} from "./sign-in.js";

/** ⛔ An hour: the longest a person removed at the provider keeps Claude's access. */
export const ACCESS_SECONDS = 3600;
/** Consent lasts this long when every renewal can ask the provider… */
const RENEWED_DAYS = 30;
/** …and this long when none can, so nobody keeps access for a month on a check that never ran. */
const UNCHECKED_DAYS = 7;

const SCOPE_WORDS: Record<TokenScope, string> = {
  read: "read the product truth",
  author: "draft changes and leave notes",
  relay: "pick up and answer what people ask for",
};

const rand = (): string => crypto.randomBytes(32).toString("base64url");
const s256 = (verifier: string): string => crypto.createHash("sha256").update(verifier).digest("base64url");

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** RFC 8414. Every endpoint is this instance; `issuer` is its public origin. */
export const authorizationServerMetadata = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/oauth/authorize`,
  token_endpoint: `${origin}/oauth/token`,
  registration_endpoint: `${origin}/oauth/register`,
  revocation_endpoint: `${origin}/oauth/revoke`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  revocation_endpoint_auth_methods_supported: ["none"],
  scopes_supported: [...TOKEN_SCOPES],
  client_id_metadata_document_supported: true,
  authorization_response_iss_parameter_supported: true,
});

/** RFC 9728, per project: the MCP endpoint is the resource, this instance its authorization server. */
const protectedResourceMetadata = (origin: string, resource: string) => ({
  resource,
  authorization_servers: [origin],
  scopes_supported: [...TOKEN_SCOPES],
  bearer_methods_supported: ["header"],
  resource_name: "ProductOS",
});

const RESOURCE_METADATA = /^\/\.well-known\/oauth-protected-resource(\/.*)?$/;

/** Where a 401 from `/p/<id>/mcp` points Claude, so it can find out how to get a token. */
export const resourceMetadataUrl = (origin: string, projectId: string): string =>
  `${origin}/.well-known/oauth-protected-resource/p/${projectId}/mcp`;

/**
 * The header on every 401 the MCP endpoint gives.
 *
 * ⛔ WITHOUT IT A 401 IS A DEAD END. The body said "press Connect Claude Code on the project's page",
 * which a person can follow and an OAuth client cannot — it reads this header, and nothing else.
 */
export const wwwAuthenticate = (origin: string, projectId: string, invalid = false): string =>
  `Bearer ${invalid ? 'error="invalid_token", ' : ""}resource_metadata="${resourceMetadataUrl(origin, projectId)}", scope="${TOKEN_SCOPES.join(" ")}"`;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

interface Client {
  id: string;
  name: string;
  redirectUris: string[];
}

const metadataCache = new Map<string, { at: number; client: Client }>();

/** ⛔ Loopback, private, link-local and unique-local — places a metadata URL must never make us fetch. */
const isPrivate = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:");
};

/**
 * A client identified by the URL of its own metadata document — how Claude introduces itself.
 *
 * ⛔ THE URL IS FETCHED BY THIS SERVER, ON THE WORD OF WHOEVER SENT IT, so it is held to what a
 * metadata document can be: https, a real path, a public address, no redirects, five seconds, 64 KB.
 * `PRODUCTOS_OAUTH_LOCAL_CLIENTS=1` lifts the first and third for the suite, which serves one on
 * 127.0.0.1, and for nothing else.
 */
async function clientFromMetadata(clientId: string, env: NodeJS.ProcessEnv): Promise<Client | string> {
  const cached = metadataCache.get(clientId);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.client;

  const local = env.PRODUCTOS_OAUTH_LOCAL_CLIENTS === "1";
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return "client_id is not a URL";
  }
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return "a client metadata URL must be https";
  if (url.pathname === "/" || url.hash || url.username || url.password) return "a client metadata URL needs a path, and no fragment or credentials";
  if (!local) {
    const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length || addresses.some((a) => isPrivate(a.address))) return "that client's metadata is not on a public address";
  }

  let doc: Record<string, unknown>;
  try {
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
    if (!r.ok) return `that client's metadata answered ${r.status}`;
    const text = await r.text();
    if (text.length > 65_536) return "that client's metadata is too large";
    doc = JSON.parse(text);
  } catch (e) {
    return `that client's metadata could not be read: ${(e as Error).message}`;
  }
  if (doc.client_id !== clientId) return "that client's metadata names a different client_id";
  const redirectUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!redirectUris.length) return "that client's metadata lists no redirect_uris";
  const client = { id: clientId, name: typeof doc.client_name === "string" ? doc.client_name.slice(0, 100) : url.hostname, redirectUris };
  metadataCache.set(clientId, { at: Date.now(), client });
  return client;
}

async function clientFor(db: Db, clientId: string, env: NodeJS.ProcessEnv): Promise<Client | string> {
  if (!clientId) return "client_id is missing";
  if (/^https?:\/\//.test(clientId)) return clientFromMetadata(clientId, env);
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  return row ? { id: row.id, name: row.name, redirectUris: row.redirectUris } : "no client is registered with that client_id";
}

/**
 * ⛔ EXACT, EXCEPT ON LOOPBACK. Claude Code listens on whatever port is free, so a registered
 * `http://localhost/callback` admits any port on the same host and path (RFC 8252 §7.3) — and only
 * that: a different host or path is a different place for the code to go.
 */
export function redirectAllowed(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let want: URL;
  try {
    want = new URL(requested);
  } catch {
    return false;
  }
  const loopback = (u: URL) => u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (!loopback(want)) return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return loopback(u) && u.hostname === want.hostname && u.pathname === want.pathname;
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Grants and tokens
// ---------------------------------------------------------------------------

async function issue(
  db: Db,
  g: { family: string; clientId: string; clientName: string; account: string; scopes: TokenScope[]; reach: string[]; expiresAt: Date },
) {
  const refresh = rand();
  const grantId = `grt-${crypto.randomBytes(12).toString("hex")}`;
  await db.insert(oauthGrants).values({
    id: grantId,
    family: g.family,
    hash: hashToken(refresh),
    clientId: g.clientId,
    clientName: g.clientName,
    accountId: g.account,
    scopes: g.scopes,
    reach: g.reach,
    expiresAt: g.expiresAt,
  });
  const access = await issueToken(db, {
    account: g.account,
    actor: `${g.clientName} (connected over OAuth)`,
    scopes: g.scopes,
    reach: g.reach,
    expiresAt: new Date(Date.now() + ACCESS_SECONDS * 1000),
    grantId,
  });
  return {
    access_token: access.token,
    token_type: "Bearer",
    expires_in: ACCESS_SECONDS,
    refresh_token: refresh,
    scope: g.scopes.join(" "),
  };
}

/** A grant family ends: every renewal in it, and every token any of them issued. */
export async function endFamily(db: Db, family: string): Promise<void> {
  const now = new Date();
  const members = await db.select({ id: oauthGrants.id }).from(oauthGrants).where(eq(oauthGrants.family, family));
  await db.update(oauthGrants).set({ revokedAt: now }).where(and(eq(oauthGrants.family, family), isNull(oauthGrants.revokedAt)));
  if (members.length) {
    await db
      .update(tokens)
      .set({ revokedAt: now })
      .where(and(inArray(tokens.grantId, members.map((m) => m.id)), isNull(tokens.revokedAt)));
  }
}

/** Revoking Claude's token on the project page ends what Claude could renew it with, too. */
export async function endGrantOf(db: Db, grantId: string | null): Promise<void> {
  if (!grantId) return;
  const [g] = await db.select({ family: oauthGrants.family }).from(oauthGrants).where(eq(oauthGrants.id, grantId));
  if (g) await endFamily(db, g.family);
}

const scopesFrom = (raw: string | null): TokenScope[] => {
  const asked = (raw ?? "").split(/\s+/).filter(Boolean);
  const known = asked.filter((s): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s));
  /** ⛔ Claude sometimes asks for no scope at all; that is a request for what a project token holds. */
  return known.length ? known : [...TOKEN_SCOPES];
};

// ---------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------

async function readForm(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 65_536) break;
    chunks.push(c as Buffer);
  }
  const body = Buffer.concat(chunks).toString("utf-8");
  if (String(req.headers["content-type"] ?? "").includes("application/json")) {
    try {
      const o = JSON.parse(body) as Record<string, unknown>;
      return new URLSearchParams(Object.entries(o).map(([k, v]): [string, string] => [k, typeof v === "string" ? v : JSON.stringify(v)]));
    } catch {
      return new URLSearchParams();
    }
  }
  return new URLSearchParams(body);
}

const sendJson = (res: http.ServerResponse, status: number, body: unknown): true => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
  return true;
};

const oauthError = (res: http.ServerResponse, error: string, description: string, status = 400): true =>
  sendJson(res, status, { error, error_description: description });

const html = (res: http.ServerResponse, status: number, title: string, body: string): true => {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    /** ⛔ The consent page must not be framed: a framed Approve button is a click somebody else aims. */
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
  });
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1d1d1f}` +
      `h1{font-size:1.4rem}ul{padding-left:1.2rem}.who{color:#555}button{font:inherit;padding:.5rem 1rem;margin-right:.5rem;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer}` +
      `button[value=approve]{background:#1d1d1f;color:#fff;border-color:#1d1d1f}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`,
  );
  return true;
};

const AUTHORIZE_FIELDS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;

/**
 * One authorization request, validated the same way on the GET that shows consent and the POST that
 * grants it — ⛔ the POST does not trust the page it came from to have kept the fields honest.
 */
async function validateAuthorize(
  db: Db,
  p: URLSearchParams,
  origin: string,
  env: NodeJS.ProcessEnv,
): Promise<
  | { ok: true; client: Client; redirectUri: string; scopes: TokenScope[]; reach: string[]; project?: string }
  | { ok: false; fatal: string }
  | { ok: false; redirect: string; error: string; description: string }
> {
  const client = await clientFor(db, p.get("client_id") ?? "", env);
  if (typeof client === "string") return { ok: false, fatal: client };
  const redirectUri = p.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
  /** ⛔ Until the redirect is known to be the client's, an error is shown here and never sent there. */
  if (!redirectAllowed(client.redirectUris, redirectUri)) return { ok: false, fatal: "that redirect_uri is not one this client registered" };

  const back = (error: string, description: string) => ({ ok: false as const, redirect: redirectUri, error, description });
  if (p.get("response_type") !== "code") return back("unsupported_response_type", "only response_type=code");
  if (!p.get("code_challenge") || p.get("code_challenge_method") !== "S256") return back("invalid_request", "PKCE with S256 is required");

  let reach: string[] = [];
  let project: string | undefined;
  const resource = p.get("resource");
  if (resource) {
    let u: URL;
    try {
      u = new URL(resource);
    } catch {
      return back("invalid_target", "resource is not a URL");
    }
    project = u.origin === origin ? (mcpProjectOf(u.pathname) ?? undefined) : undefined;
    if (!project) return back("invalid_target", "resource is not a project's MCP endpoint on this instance");
    reach = [project];
  }
  return { ok: true, client, redirectUri, scopes: scopesFrom(p.get("scope")), reach, project };
}

const withParams = (base: string, params: Record<string, string | undefined>): string => {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.href;
};

export async function oauthRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  opts: { db: Db; localSession?: string; env?: NodeJS.ProcessEnv },
): Promise<boolean> {
  const env = opts.env ?? process.env;
  const method = req.method ?? "GET";

  if (pathname === "/.well-known/oauth-authorization-server") {
    return sendJson(res, 200, authorizationServerMetadata(publicOrigin(req, env)));
  }
  const prm = RESOURCE_METADATA.exec(pathname);
  if (prm) {
    const origin = publicOrigin(req, env);
    const rest = prm[1] ?? "";
    if (rest && !mcpProjectOf(rest)) return sendJson(res, 404, { error: "not_found" });
    return sendJson(res, 200, protectedResourceMetadata(origin, `${origin}${rest}`));
  }
  if (!pathname.startsWith("/oauth/")) return false;
  const origin = publicOrigin(req, env);

  /**
   * RFC 7591. ⛔ PUBLIC CLIENTS ONLY, WHATEVER WAS ASKED: a client that asked for a secret is told,
   * in the response, that it is getting `none` — the RFC's own way for a server to decline.
   */
  if (pathname === "/oauth/register") {
    if (method !== "POST") return oauthError(res, "invalid_request", "POST a client's metadata here", 405);
    const p = await readForm(req);
    let uris: unknown;
    try {
      uris = JSON.parse(p.get("redirect_uris") ?? "null");
    } catch {
      uris = null;
    }
    const redirectUris = Array.isArray(uris) ? uris.filter((u): u is string => typeof u === "string") : [];
    if (!redirectUris.length || redirectUris.some((u) => !/^https:\/\/[^/]/.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(u))) {
      return oauthError(res, "invalid_redirect_uri", "redirect_uris must be https, or http on loopback");
    }
    const id = `cli-${crypto.randomBytes(12).toString("hex")}`;
    const name = (p.get("client_name") ?? "an OAuth client").slice(0, 100);
    await opts.db.insert(oauthClients).values({ id, name, redirectUris });
    return sendJson(res, 201, {
      client_id: id,
      client_name: name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    });
  }

  if (pathname === "/oauth/authorize") {
    const p = method === "POST" ? await readForm(req) : new URL(req.url ?? "/", origin).searchParams;

    if (method === "POST") {
      /** ⛔ A consent POST from another site is refused before anything is read off it. */
      const from = req.headers.origin;
      if (from && from !== origin) return html(res, 403, "Refused", "<p>That approval did not come from this instance's page.</p>");
    }

    const v = await validateAuthorize(opts.db, p, origin, env);
    if (!v.ok && "fatal" in v) return html(res, 400, "Claude can't connect this way", `<p>${esc(v.fatal)}.</p>`);
    if (!v.ok) {
      res.writeHead(302, { location: withParams(v.redirect, { error: v.error, error_description: v.description, state: p.get("state") ?? undefined, iss: origin }) });
      res.end();
      return true;
    }

    /** ⛔ Only a person in a browser session gives consent. A token arriving here is nobody. */
    const who = await principalFrom(opts.db, {}, cookieOf(req) ?? opts.localSession, env);
    if (!who || who.kind !== "browser") {
      if (method === "GET" && signInConfigFromEnv(env)) {
        res.writeHead(302, { location: `/auth/sign-in?next=${encodeURIComponent(safeNext(req.url))}` });
        res.end();
        return true;
      }
      return html(res, 401, "Sign in first", "<p>Approving a connection needs you signed in to this instance, and this one has no sign-in set up.</p>");
    }

    let projectName = "every project you can open";
    if (v.project) {
      const reached = await storeFor(opts.db, who).project(v.project);
      if (isRefusal(reached)) {
        return html(res, 404, "No such project", `<p>${esc(who.actor)} can't open the project Claude asked for.</p>`);
      }
      const [row] = await opts.db.select({ name: projects.name }).from(projects).where(eq(projects.id, v.project));
      projectName = row?.name ?? v.project;
    }

    if (method === "GET") {
      const hidden = AUTHORIZE_FIELDS.map((k) => (p.get(k) !== null ? `<input type="hidden" name="${k}" value="${esc(p.get(k)!)}">` : "")).join("");
      return html(
        res,
        200,
        `Connect ${v.client.name} to ${projectName}?`,
        `<p class="who">Signed in as ${esc(who.actor)}.</p>` +
          `<p>${esc(v.client.name)} will be able to:</p><ul>${v.scopes.map((s) => `<li>${esc(SCOPE_WORDS[s])}</li>`).join("")}</ul>` +
          `<p>It can never agree to anything for you. What it drafts waits for a person to accept it.</p>` +
          `<form method="post" action="/oauth/authorize">${hidden}` +
          `<button name="decision" value="approve" type="submit">Connect</button><button name="decision" value="deny" type="submit">Cancel</button></form>`,
      );
    }

    if (p.get("decision") !== "approve") {
      res.writeHead(302, { location: withParams(v.redirectUri, { error: "access_denied", state: p.get("state") ?? undefined, iss: origin }) });
      res.end();
      return true;
    }
    const code = rand();
    await opts.db.insert(oauthCodes).values({
      hash: hashToken(code),
      clientId: v.client.id,
      clientName: v.client.name,
      redirectUri: v.redirectUri,
      challenge: p.get("code_challenge")!,
      accountId: who.account,
      scopes: v.scopes,
      reach: v.reach,
      expiresAt: new Date(Date.now() + 2 * 60_000),
    });
    res.writeHead(302, { location: withParams(v.redirectUri, { code, state: p.get("state") ?? undefined, iss: origin }) });
    res.end();
    return true;
  }

  if (pathname === "/oauth/token") {
    if (method !== "POST") return oauthError(res, "invalid_request", "POST to the token endpoint", 405);
    const p = await readForm(req);
    const clientId = p.get("client_id") ?? "";

    if (p.get("grant_type") === "authorization_code") {
      /** ⛔ Spent in the same statement that finds it, so two exchanges of one code cannot both win. */
      const [c] = await opts.db
        .update(oauthCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(oauthCodes.hash, hashToken(p.get("code") ?? "")), isNull(oauthCodes.usedAt), gt(oauthCodes.expiresAt, new Date())))
        .returning();
      if (!c) return oauthError(res, "invalid_grant", "that code is unknown, spent or expired");
      if (c.clientId !== clientId) return oauthError(res, "invalid_grant", "that code was issued to a different client");
      if (p.get("redirect_uri") && p.get("redirect_uri") !== c.redirectUri) return oauthError(res, "invalid_grant", "redirect_uri does not match");
      if (s256(p.get("code_verifier") ?? "") !== c.challenge) return oauthError(res, "invalid_grant", "code_verifier does not match the challenge");

      const days = (await canAskProvider(opts.db, c.accountId, env)) ? RENEWED_DAYS : UNCHECKED_DAYS;
      return sendJson(
        res,
        200,
        await issue(opts.db, {
          family: `fam-${crypto.randomBytes(12).toString("hex")}`,
          clientId: c.clientId,
          clientName: c.clientName,
          account: c.accountId,
          scopes: c.scopes as TokenScope[],
          reach: c.reach,
          expiresAt: new Date(Date.now() + days * 86_400_000),
        }),
      );
    }

    if (p.get("grant_type") === "refresh_token") {
      const [g] = await opts.db.select().from(oauthGrants).where(eq(oauthGrants.hash, hashToken(p.get("refresh_token") ?? "")));
      if (!g || g.revokedAt) return oauthError(res, "invalid_grant", "that refresh token is unknown or revoked");
      /** ⛔ A refresh token used twice was copied. The whole family ends, not just this one. */
      if (g.usedAt) {
        await endFamily(opts.db, g.family);
        return oauthError(res, "invalid_grant", "that refresh token was already used, so every token from this connection has been revoked");
      }
      if (g.clientId !== clientId) return oauthError(res, "invalid_grant", "that refresh token was issued to a different client");
      if (g.expiresAt <= new Date()) return oauthError(res, "invalid_grant", "this connection has expired — connect again");

      const there = await stillAtProvider(opts.db, g.accountId, env);
      if (there === "gone") {
        await endEverythingFor(opts.db, g.accountId);
        return oauthError(res, "invalid_grant", "your identity provider no longer knows this account");
      }
      if (there === "unreachable") {
        return oauthError(res, "temporarily_unavailable", "the identity provider could not be reached — try again shortly", 503);
      }

      const [spent] = await opts.db
        .update(oauthGrants)
        .set({ usedAt: new Date() })
        .where(and(eq(oauthGrants.id, g.id), isNull(oauthGrants.usedAt)))
        .returning({ id: oauthGrants.id });
      if (!spent) {
        await endFamily(opts.db, g.family);
        return oauthError(res, "invalid_grant", "that refresh token was already used, so every token from this connection has been revoked");
      }
      return sendJson(
        res,
        200,
        await issue(opts.db, {
          family: g.family,
          clientId: g.clientId,
          clientName: g.clientName,
          account: g.accountId,
          scopes: g.scopes as TokenScope[],
          reach: g.reach,
          expiresAt: g.expiresAt,
        }),
      );
    }

    return oauthError(res, "unsupported_grant_type", "authorization_code or refresh_token");
  }

  /** RFC 7009. ⛔ Always 200: whether a token existed is not something to tell whoever is asking. */
  if (pathname === "/oauth/revoke") {
    if (method !== "POST") return oauthError(res, "invalid_request", "POST the token to revoke", 405);
    const hash = hashToken((await readForm(req)).get("token") ?? "");
    const [g] = await opts.db.select({ family: oauthGrants.family }).from(oauthGrants).where(eq(oauthGrants.hash, hash));
    if (g) await endFamily(opts.db, g.family);
    const [t] = await opts.db.select({ id: tokens.id, grantId: tokens.grantId }).from(tokens).where(eq(tokens.hash, hash));
    /** Holding a token is the proof needed to give it up, whichever way it was issued. */
    if (t) await opts.db.update(tokens).set({ revokedAt: new Date() }).where(eq(tokens.id, t.id));
    return sendJson(res, 200, {});
  }

  return oauthError(res, "not_found", `${pathname} is not an OAuth endpoint here`, 404);
}
