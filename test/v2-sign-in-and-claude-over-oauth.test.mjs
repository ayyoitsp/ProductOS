/**
 * ⛔ A PERSON SIGNS IN THROUGH THEIR ORGANIZATION'S PROVIDER, AND CLAUDE CONNECTS OVER OAUTH.
 *
 * Peter: *"ok, assume this is a service an organization would choose to deploy on their own - is
 * there a better path?"*, then *"so this would work with google sso?"* and *"so this will support mcp
 * also?"*. So the instance speaks OIDC to the organization's provider and is its own OAuth server for
 * Claude. Driven here end to end against a real provider on 127.0.0.1 — discovery, signed ID tokens,
 * PKCE — and a client that behaves the way Claude does: it starts from a 401, reads the header, and
 * finds everything else from there.
 *
 * ⛔ EVERY PROPERTY HAS A FAILING STATE. A sign-in test that only shows somebody getting in passes
 * on an instance that lets everybody in, so each admission is paired with the refusal next to it.
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { temp } from "./support/temp.mjs";

/** ⛔ Set before the modules read it: the instance reads its provider from the environment, as it ships. */
const provider = await fakeProvider();
Object.assign(process.env, {
  PRODUCTOS_OIDC_ISSUER: provider.issuer,
  PRODUCTOS_OIDC_CLIENT_ID: "productos-test",
  PRODUCTOS_OIDC_CLIENT_SECRET: "shh",
  PRODUCTOS_ALLOWED_DOMAINS: "acme.com",
  PRODUCTOS_SECRET: "a secret only this suite knows",
  PRODUCTOS_OAUTH_LOCAL_CLIENTS: "1",
});
delete process.env.PRODUCTOS_AUTH;
delete process.env.PRODUCTOS_PUBLIC_URL;

const { applyMigrations } = await import("../dist/v2/store/migrate.js");
const { projectMcpRoute } = await import("../dist/v2/store/mcp.js");
const { connectRoute } = await import("../dist/v2/store/connect.js");
const { createProject, instanceRoute } = await import("../dist/v2/store/instance.js");
const { chooseRoute } = await import("../dist/v2/store/choose.js");
const { signInRoute, admit, safeNext } = await import("../dist/v2/store/sign-in.js");
const { oauthRoute, redirectAllowed } = await import("../dist/v2/store/oauth.js");
const { storeFor, isRefusal } = await import("../dist/v2/store/access.js");
const { accountFor, principalFrom, issueToken } = await import("../dist/v2/store/identity.js");
const { importFromDisk } = await import("../dist/v2/store/corpus.js");
const { tokens, providerLinks, sessions, oauthGrants } = await import("../dist/v2/store/schema.js");
const { mayRecord } = await import("../dist/v2/identity.js");

const CLI = path.resolve("dist/cli/index.js");

// ---------------------------------------------------------------------------
// An OIDC provider, real enough that openid-client accepts it
// ---------------------------------------------------------------------------

async function fakeProvider() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const codes = new Map();
  const state = {
    /** Who the next person through /authorize is. */
    next: { sub: "ada-1", email: "ada@acme.com", email_verified: true },
    /** What the provider says when the instance asks again with a refresh token. */
    refresh: "ok",
    refreshes: 0,
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, issuer);
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/.well-known/openid-configuration") {
      return send(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (url.pathname === "/jwks") return send(200, { keys: [jwk] });
    if (url.pathname === "/authorize") {
      /** The person "signs in" at once, as whoever `state.next` says. */
      const code = crypto.randomBytes(8).toString("hex");
      codes.set(code, { who: { ...state.next }, nonce: url.searchParams.get("nonce"), challenge: url.searchParams.get("code_challenge") });
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", code);
      back.searchParams.set("state", url.searchParams.get("state"));
      res.writeHead(302, { location: back.href });
      return res.end();
    }
    if (url.pathname === "/token") {
      let body = "";
      for await (const c of req) body += c;
      const p = new URLSearchParams(body);
      if (p.get("grant_type") === "refresh_token") {
        state.refreshes++;
        if (state.refresh === "gone") return send(400, { error: "invalid_grant", error_description: "the account was removed" });
        if (state.refresh === "down") return send(503, { error: "temporarily_unavailable" });
        return send(200, { access_token: "at", token_type: "Bearer", expires_in: 3600 });
      }
      const c = codes.get(p.get("code"));
      codes.delete(p.get("code"));
      if (!c) return send(400, { error: "invalid_grant" });
      const verifier = p.get("code_verifier") ?? "";
      if (crypto.createHash("sha256").update(verifier).digest("base64url") !== c.challenge) return send(400, { error: "invalid_grant" });
      const id_token = await new SignJWT({ ...c.who, nonce: c.nonce })
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(issuer)
        .setAudience("productos-test")
        .setSubject(c.who.sub)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return send(200, { access_token: "at", token_type: "Bearer", expires_in: 3600, id_token, refresh_token: `rt-${c.who.sub}` });
    }
    send(404, {});
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const issuer = `http://127.0.0.1:${server.address().port}`;
  return { issuer, state, server };
}

// ---------------------------------------------------------------------------
// The instance, mounted in `server.ts`'s order
// ---------------------------------------------------------------------------

async function instance() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const ada = await accountFor(db, "ada@acme.com");
  await createProject(db, { id: "prj-ada", owner: ada, slug: "wallet", name: "Family Wallet" });
  await createProject(db, { id: "prj-ada-two", owner: ada, slug: "other", name: "Ada's other" });
  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-ada");
  assert.ok(!isRefusal(store));
  const dir = path.join(temp("productos-oauth-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  await importFromDisk(store, dir);

  const server = http.createServer(async (req, res) => {
    try {
      const p = new URL(req.url, "http://x").pathname;
      if (await signInRoute(req, res, p, { db })) return;
      if (await oauthRoute(req, res, p, { db })) return;
      if (await chooseRoute(req, res, p, { db })) return;
      if (await projectMcpRoute(req, res, p, { db })) return;
      if (await connectRoute(req, res, p, { db })) return;
      if (await instanceRoute(req, res, p, { db })) return;
      res.writeHead(404).end("{}");
    } catch (e) {
      res.writeHead(500).end(String(e.stack));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, ada, server, base, close: () => new Promise((r) => server.close(r)) };
}

after(() => provider.server.close());

/** Follow redirects by hand, carrying the session cookie, and stop when one leaves the instance's hosts. */
async function browse(url, { cookie, stopAt } = {}) {
  let jar = cookie;
  let res;
  for (let i = 0; i < 10; i++) {
    res = await fetch(url, { redirect: "manual", headers: { accept: "text/html", ...(jar ? { cookie: `productos_session=${jar}` } : {}) } });
    const set = res.headers.get("set-cookie");
    if (set) jar = /productos_session=([^;]*)/.exec(set)?.[1] || undefined;
    const loc = res.headers.get("location");
    if (!loc || res.status < 300 || res.status >= 400) break;
    url = new URL(loc, url).href;
    if (stopAt && url.startsWith(stopAt)) return { url, cookie: jar, res };
  }
  return { url, cookie: jar, res, body: await res.text() };
}

const signIn = async (base, who) => {
  if (who) provider.state.next = who;
  return browse(`${base}/auth/sign-in?next=/projects`);
};

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

test("⛔ a person opening a page is sent to the provider, and comes back signed in where they were going", async () => {
  const s = await instance();
  try {
    const before = await fetch(`${s.base}/projects`, { redirect: "manual", headers: { accept: "text/html" } });
    assert.equal(before.status, 302);
    assert.match(before.headers.get("location"), /^\/auth\/sign-in\?next=%2Fprojects$/);

    /** ⛔ A script still gets the refusal it can act on, not a sign-in form. */
    const api = await fetch(`${s.base}/projects`, { redirect: "manual", headers: { accept: "application/json" } });
    assert.equal(api.status, 401);

    const b = await browse(`${s.base}/projects`);
    assert.ok(b.cookie, "the callback set no session");
    assert.equal(new URL(b.url).pathname, "/projects");
    assert.equal(b.res.status, 200, "signed in and still refused the page");

    /** ⛔ The session is one the instance wrote — the only thing that makes a press a person's. */
    const who = await principalFrom(s.db, {}, b.cookie);
    assert.equal(who.kind, "browser");
    assert.equal(who.account, s.ada, "signing in made a different account from the one that owns the projects");
    assert.equal(mayRecord(who, "page"), null, "a person signed in through the provider cannot record a press");
  } finally {
    await s.close();
  }
});

test("⛔ the provider's word is checked: unverified, outside the organization, or somebody else's address is refused", async () => {
  const s = await instance();
  try {
    const unverified = await signIn(s.base, { sub: "x-1", email: "eve@acme.com", email_verified: false });
    assert.equal(unverified.res.status, 403);
    assert.match(unverified.body, /has not verified eve@acme\.com/);
    assert.equal(unverified.cookie, undefined);

    const outsider = await signIn(s.base, { sub: "x-2", email: "eve@elsewhere.com", email_verified: true });
    assert.equal(outsider.res.status, 403);
    assert.match(outsider.body, /not in an organization this instance admits/);

    /** Ada signs in once, which links her subject to her account… */
    assert.ok((await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true })).cookie);
    /** …so a different provider user arriving with her address does not get it. */
    const impostor = await signIn(s.base, { sub: "not-ada", email: "ada@acme.com", email_verified: true });
    assert.equal(impostor.res.status, 403);
    assert.match(impostor.body, /already belongs to a different person/);
    assert.equal(impostor.cookie, undefined);
  } finally {
    await s.close();
  }
});

test("⛔ a callback nobody here started is refused — the login-CSRF case", async () => {
  const s = await instance();
  try {
    const r = await fetch(`${s.base}/auth/callback?code=whatever&state=made-up`, { redirect: "manual" });
    assert.equal(r.status, 400);
    assert.equal(r.headers.get("set-cookie"), null);
  } finally {
    await s.close();
  }
});

test("⛔ Google is admitted by `hd`, never by the address's suffix", () => {
  const cfg = { issuer: "https://accounts.google.com", clientId: "x", scopes: "", allowedDomains: ["acme.com"], trustEmail: false };
  assert.deepEqual(admit(cfg, { email: "ada@acme.com", email_verified: true, hd: "acme.com" }), { ok: true, email: "ada@acme.com" });
  /** A consumer account has no `hd`, whatever its address says. */
  assert.equal(admit(cfg, { email: "ada@acme.com", email_verified: true }).ok, false);
  assert.equal(admit(cfg, { email: "ada@acme.com", email_verified: true, hd: "other.com" }).ok, false);
  /** Entra sends no `email_verified`; only the operator saying so lets it through. */
  const entra = { issuer: "https://login.microsoftonline.com/t/v2.0", clientId: "x", scopes: "", allowedDomains: [], trustEmail: false };
  assert.equal(admit(entra, { email: "ada@acme.com" }).ok, false);
  assert.equal(admit({ ...entra, trustEmail: true }, { email: "ada@acme.com" }).ok, true);
});

test("⛔ `next` is a path on this instance and nothing else", () => {
  assert.equal(safeNext("/p/prj-ada/v2"), "/p/prj-ada/v2");
  assert.equal(safeNext("//evil.example/x"), "/");
  assert.equal(safeNext("/\\evil.example"), "/");
  assert.equal(safeNext("https://evil.example"), "/");
});

// ---------------------------------------------------------------------------
// Claude, over OAuth
// ---------------------------------------------------------------------------

/** A client metadata document, served the way Claude serves its own. */
async function claudeLike() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ client_id: clientId, client_name: "Claude", redirect_uris: ["http://127.0.0.1/callback"] }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const clientId = `http://127.0.0.1:${server.address().port}/oauth/claude.json`;
  return { clientId, close: () => new Promise((r) => server.close(r)) };
}

const pkce = () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
};

const rpc = (base, project, token) =>
  fetch(`${base}/p/${project}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

const form = (url, fields, headers = {}) =>
  fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields).toString(),
  });

/**
 * The whole connection, the way Claude makes it: a 401, the header, two metadata documents, the
 * consent page, the code, the token.
 */
async function connect(s, { cookie, clientId, redirectUri = "http://127.0.0.1:54321/callback", project = "prj-ada" } = {}) {
  const denied = await rpc(s.base, project);
  assert.equal(denied.status, 401);
  const header = denied.headers.get("www-authenticate");
  const prmUrl = /resource_metadata="([^"]+)"/.exec(header ?? "")?.[1];
  assert.ok(prmUrl, `the 401 does not say where to go: ${header}`);
  const prm = await (await fetch(prmUrl)).json();
  assert.equal(prm.resource, `${s.base}/p/${project}/mcp`);
  const as = await (await fetch(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();

  const { verifier, challenge } = pkce();
  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "st-1",
    resource: prm.resource,
  };
  const consent = await fetch(`${as.authorization_endpoint}?${new URLSearchParams(params)}`, {
    redirect: "manual",
    headers: { accept: "text/html", cookie: `productos_session=${cookie}` },
  });
  const consentHtml = await consent.text();
  assert.equal(consent.status, 200, consentHtml);

  const approved = await form(as.authorization_endpoint, { ...params, decision: "approve" }, { cookie: `productos_session=${cookie}`, origin: s.base });
  assert.equal(approved.status, 302);
  const back = new URL(approved.headers.get("location"));
  assert.equal(back.searchParams.get("state"), "st-1");
  const code = back.searchParams.get("code");
  assert.ok(code, `no code came back: ${back.href}`);

  const exchange = (v = verifier) =>
    form(as.token_endpoint, { grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirectUri, code_verifier: v });
  return { as, consentHtml, code, exchange };
}

test("⛔ Claude starts from a 401 and ends holding a token that reaches this project and records nothing", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const c = await connect(s, { cookie, clientId: claude.clientId });
    assert.equal(c.as.client_id_metadata_document_supported, true);
    assert.match(c.consentHtml, /Connect Claude to Family Wallet\?/);
    assert.match(c.consentHtml, /can never agree to anything for you/);

    /** ⛔ The wrong verifier is a stolen code. */
    assert.equal((await (await c.exchange("not-the-verifier")).json()).error, "invalid_grant");
    /** And that attempt spent it: a code works once, even for its rightful holder. */
    assert.equal((await (await c.exchange()).json()).error, "invalid_grant");

    const again = await connect(s, { cookie, clientId: claude.clientId });
    const t = await (await again.exchange()).json();
    assert.ok(t.access_token && t.refresh_token, JSON.stringify(t));
    assert.equal(t.expires_in, 3600);

    assert.equal((await rpc(s.base, "prj-ada", t.access_token)).status, 200, "the token Claude was issued does not open the project");
    /** ⛔ Consent named one project. The same person's other project stays shut. */
    assert.equal((await rpc(s.base, "prj-ada-two", t.access_token)).status, 404);

    /** ⛔ A person agreeing Claude may connect is not that person agreeing to what Claude writes. */
    const who = await principalFrom(s.db, { authorization: `Bearer ${t.access_token}` });
    assert.equal(who.kind, "token");
    assert.equal(mayRecord(who, "page")?.ok, false, "a token Claude was issued over OAuth could record a person's press");
    assert.match(who.actor, /Claude \(connected over OAuth\)/);
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ only a signed-in person reaches consent — a token at the consent page is nobody", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const held = await issueToken(s.db, { account: s.ada, actor: "an agent", scopes: ["read", "author", "relay"], reach: ["prj-ada"] });
    const { challenge } = pkce();
    const q = new URLSearchParams({
      response_type: "code",
      client_id: claude.clientId,
      redirect_uri: "http://127.0.0.1:1/callback",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${s.base}/p/prj-ada/mcp`,
    });
    const r = await fetch(`${s.base}/oauth/authorize?${q}`, { redirect: "manual", headers: { authorization: `Bearer ${held.token}` } });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location"), /^\/auth\/sign-in\?next=/);
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ an approval posted from another site is refused, and a redirect nobody registered is never followed", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const { challenge } = pkce();
    const fields = {
      response_type: "code",
      client_id: claude.clientId,
      redirect_uri: "http://127.0.0.1:9/callback",
      code_challenge: challenge,
      code_challenge_method: "S256",
      decision: "approve",
    };
    const forged = await form(`${s.base}/oauth/authorize`, fields, { cookie: `productos_session=${cookie}`, origin: "https://evil.example" });
    assert.equal(forged.status, 403);

    const elsewhere = await fetch(
      `${s.base}/oauth/authorize?${new URLSearchParams({ ...fields, redirect_uri: "https://evil.example/cb" })}`,
      { redirect: "manual", headers: { cookie: `productos_session=${cookie}` } },
    );
    assert.equal(elsewhere.status, 400, "an unregistered redirect was answered with something other than an error page");
    assert.equal(elsewhere.headers.get("location"), null, "an error was sent to a redirect the client never registered");
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ loopback redirects admit any port and nothing else", () => {
  const reg = ["http://127.0.0.1/callback"];
  assert.equal(redirectAllowed(reg, "http://127.0.0.1:61234/callback"), true);
  assert.equal(redirectAllowed(reg, "http://127.0.0.1:61234/other"), false);
  assert.equal(redirectAllowed(reg, "http://localhost:61234/callback"), false);
  assert.equal(redirectAllowed(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai/api/mcp/auth_callback/x"), false);
});

test("⛔ a client can register itself, and gets a public client whatever it asked for", async () => {
  const s = await instance();
  try {
    const r = await fetch(`${s.base}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Claude Code", redirect_uris: ["http://localhost/callback"], token_endpoint_auth_method: "client_secret_post" }),
    });
    assert.equal(r.status, 201);
    const c = await r.json();
    assert.match(c.client_id, /^cli-/);
    assert.equal(c.token_endpoint_auth_method, "none");
    assert.equal(c.client_secret, undefined);

    const bad = await fetch(`${s.base}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "x", redirect_uris: ["http://evil.example/cb"] }),
    });
    assert.equal(bad.status, 400);

    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const t = await (await (await connect(s, { cookie, clientId: c.client_id, redirectUri: "http://localhost:4567/callback" })).exchange()).json();
    assert.equal((await rpc(s.base, "prj-ada", t.access_token)).status, 200);
  } finally {
    await s.close();
  }
});

const refresh = (s, clientId, token) =>
  form(`${s.base}/oauth/token`, { grant_type: "refresh_token", refresh_token: token, client_id: clientId }).then(async (r) => ({ status: r.status, body: await r.json() }));

test("⛔ renewal rotates, and a refresh token used twice ends the whole connection", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const first = await (await (await connect(s, { cookie, clientId: claude.clientId })).exchange()).json();
    const second = await refresh(s, claude.clientId, first.refresh_token);
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.notEqual(second.body.refresh_token, first.refresh_token);
    assert.equal((await rpc(s.base, "prj-ada", second.body.access_token)).status, 200);

    /** Somebody replays the first one: the copy and the original both stop working. */
    const replay = await refresh(s, claude.clientId, first.refresh_token);
    assert.equal(replay.body.error, "invalid_grant");
    assert.equal((await rpc(s.base, "prj-ada", second.body.access_token)).status, 401);
    assert.equal((await refresh(s, claude.clientId, second.body.refresh_token)).body.error, "invalid_grant");
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ an expired token is a 401 that says so, so Claude renews instead of giving up", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const t = await (await (await connect(s, { cookie, clientId: claude.clientId })).exchange()).json();
    await s.db.update(tokens).set({ expiresAt: new Date(Date.now() - 1000) });
    const r = await rpc(s.base, "prj-ada", t.access_token);
    assert.equal(r.status, 401);
    assert.match(r.headers.get("www-authenticate"), /error="invalid_token"/);
    assert.equal((await refresh(s, claude.clientId, t.refresh_token)).status, 200, "an expired access token stopped the refresh token working");
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ revoking Claude's token on the project page ends what it could renew it with", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const t = await (await (await connect(s, { cookie, clientId: claude.clientId })).exchange()).json();
    const listed = await (await fetch(`${s.base}/p/prj-ada/api/v2/tokens`, { headers: { cookie: `productos_session=${cookie}` } })).json();
    const mine = listed.tokens.find((x) => /connected over OAuth/.test(x.actor));
    assert.ok(mine, "Claude's connection is not listed on the page, so nobody can revoke it there");
    const del = await fetch(`${s.base}/p/prj-ada/api/v2/tokens/${mine.id}`, { method: "DELETE", headers: { cookie: `productos_session=${cookie}` } });
    assert.equal(del.status, 200);
    assert.equal((await refresh(s, claude.clientId, t.refresh_token)).body.error, "invalid_grant");
  } finally {
    await claude.close();
    await s.close();
  }
});

test("⛔ somebody removed at the provider loses everything at the next renewal — and a provider outage is not a removal", async () => {
  const s = await instance();
  const claude = await claudeLike();
  try {
    provider.state.refresh = "ok";
    const { cookie } = await signIn(s.base, { sub: "ada-1", email: "ada@acme.com", email_verified: true });
    const [link] = await s.db.select().from(providerLinks).where(eq(providerLinks.subject, "ada-1"));
    assert.ok(link.refresh, "the provider's refresh token was not kept, so nothing can ask about this person again");
    assert.doesNotMatch(link.refresh, /rt-ada-1/, "the provider's refresh token is stored in the clear");

    const pasted = await issueToken(s.db, { account: s.ada, actor: "CI", scopes: ["read"], reach: ["prj-ada"] });
    let t = await (await (await connect(s, { cookie, clientId: claude.clientId })).exchange()).json();
    const hourAgo = () => s.db.update(providerLinks).set({ checkedAt: new Date(Date.now() - 2 * 3_600_000) });

    /** Still there: renewed, and the provider was really asked. */
    await hourAgo();
    const asked = provider.state.refreshes;
    const ok = await refresh(s, claude.clientId, t.refresh_token);
    assert.equal(ok.status, 200);
    assert.equal(provider.state.refreshes, asked + 1, "renewal did not ask the provider");
    t = ok.body;

    /** Unreachable: refused for now, nothing revoked. */
    await hourAgo();
    provider.state.refresh = "down";
    assert.equal((await refresh(s, claude.clientId, t.refresh_token)).status, 503);
    assert.equal((await rpc(s.base, "prj-ada", t.access_token)).status, 200, "a provider outage revoked somebody's access");

    /** Gone: every token they hold ends, the pasted one too, and so does their browser session. */
    provider.state.refresh = "gone";
    assert.equal((await refresh(s, claude.clientId, t.refresh_token)).body.error, "invalid_grant");
    assert.equal((await rpc(s.base, "prj-ada", t.access_token)).status, 401);
    assert.equal((await rpc(s.base, "prj-ada", pasted.token)).status, 401, "a pasted token outlived its holder leaving");
    assert.equal((await s.db.select().from(sessions).where(eq(sessions.accountId, s.ada))).length, 0);
    assert.ok((await s.db.select().from(oauthGrants)).every((g) => g.revokedAt));
  } finally {
    provider.state.refresh = "ok";
    await claude.close();
    await s.close();
  }
});
