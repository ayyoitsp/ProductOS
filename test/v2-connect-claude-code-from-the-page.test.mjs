/**
 * ⛔ A PROJECT'S OWNER CAN CONNECT CLAUDE CODE FROM THE PAGE — AND NOTHING ELSE CAN MINT.
 *
 * Peter, on what blocks the MVP: *"`productos connect` and token issuing from the page"*. The only
 * way to get a token was `productos hosted token new`, which needs DATABASE_URL. So the route
 * `/p/<id>/api/v2/tokens` is asserted here for the properties that make it safe to exist:
 *
 *   - nobody gets in without a credential
 *   - a TOKEN can never mint a token (one leak would otherwise be an unbounded supply)
 *   - a signed-in owner gets a secret once, stored only as a hash
 *   - that secret really authenticates `/p/<id>/mcp`
 *   - it reaches THIS project and no other, even another project the same account owns
 *
 * And the page half: the control is served under the project, and the urls its script builds are
 * resolved against the page's real location and sent to the real server — not a fake that would
 * pass on any url at all.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { projectMcpRoute } from "../dist/v2/store/mcp.js";
import { connectRoute, tokensPathOf } from "../dist/v2/store/connect.js";
import { createProject, instanceRoute } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, issueToken, singleAccount, hashToken } from "../dist/v2/store/identity.js";
import { importFromDisk, loadFromStore } from "../dist/v2/store/corpus.js";
import { tokens } from "../dist/v2/store/schema.js";
import { TOKEN_SCOPES } from "../dist/v2/identity.js";
import { mcpServerFor } from "../dist/adapters/claude.js";
import { renderScopePage } from "../dist/v2/page.js";

const CLI = path.resolve("dist/cli/index.js");

function corpusOnDisk() {
  const dir = path.join(temp("productos-connect-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

async function hosted() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));

  const ada = await accountFor(db, "ada@example.com");
  const bo = await accountFor(db, "bo@example.com");
  await createProject(db, { id: "prj-ada", owner: ada, slug: "wallet", name: "Family Wallet" });
  /** ⛔ The same owner's second project — the one a page-minted token must still not reach. */
  await createProject(db, { id: "prj-ada-two", owner: ada, slug: "other", name: "Ada's other" });
  await createProject(db, { id: "prj-bo", owner: bo, slug: "theirs", name: "Bo's" });

  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-ada");
  assert.ok(!isRefusal(store));
  await importFromDisk(store, corpusOnDisk());

  const { session } = await singleAccount(db, "ada@example.com");

  /** ⛔ The order `server.ts` uses, so the route is tested where it is mounted. */
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await projectMcpRoute(req, res, p, { db })) return;
    if (await connectRoute(req, res, p, { db })) return;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, r));
  return { db, store, server, base: `http://127.0.0.1:${server.address().port}`, session, ada, bo };
}

const mint = async (base, project, { session, token, contentType = "application/json" } = {}) => {
  const res = await fetch(`${base}/p/${project}/api/v2/tokens`, {
    method: "POST",
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      ...(session ? { cookie: `productos_session=${session}` } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: "{}",
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const toolsList = async (base, project, token) => {
  const res = await fetch(`${base}/p/${project}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const text = await res.text();
  return { status: res.status, text };
};

const closing = (server) => new Promise((r) => server.close(r));

test("the tokens path is anchored to a project", () => {
  assert.deepEqual(tokensPathOf("/p/prj-a/api/v2/tokens"), { project: "prj-a" });
  assert.deepEqual(tokensPathOf("/p/prj-a/api/v2/tokens/tok-1"), { project: "prj-a", token: "tok-1" });
  assert.equal(tokensPathOf("/api/v2/tokens"), null, "an unaddressed tokens route was claimed");
  assert.equal(tokensPathOf("/p/../api/v2/tokens"), null);
});

test("no credential is a 401, and nothing is minted", async () => {
  const { base, server, db } = await hosted();
  try {
    const r = await mint(base, "prj-ada");
    assert.equal(r.status, 401);
    assert.equal(r.body.token, undefined);
    assert.equal((await db.select().from(tokens)).length, 0);
  } finally {
    await closing(server);
  }
});

test("a token can never mint a token, whatever its scopes", async () => {
  const { base, server, db, ada } = await hosted();
  try {
    const held = await issueToken(db, { account: ada, actor: "a session", scopes: [...TOKEN_SCOPES], reach: ["prj-ada"] });
    const r = await mint(base, "prj-ada", { token: held.token });
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.token, undefined);
    /** ⛔ And a cookie beside the bearer changes nothing — a bearer is always a token. */
    const { session } = await singleAccount(db, "ada@example.com");
    const both = await mint(base, "prj-ada", { token: held.token, session });
    assert.equal(both.status, 403);
    assert.equal((await db.select().from(tokens)).length, 1, "a token minted a second token");
  } finally {
    await closing(server);
  }
});

test("a signed-in owner gets a secret once, kept only as a hash, that reaches /mcp for this project", async () => {
  const { base, server, db, session, ada } = await hosted();
  try {
    const r = await mint(base, "prj-ada", { session });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.token, /^[0-9a-f]{64}$/);

    const [row] = await db.select().from(tokens).where(eq(tokens.id, r.body.id));
    assert.equal(row.accountId, ada);
    assert.deepEqual(row.reach, ["prj-ada"], "a page-minted token must reach exactly the project it was minted on");
    assert.deepEqual([...row.scopes].sort(), [...TOKEN_SCOPES].sort());
    assert.equal(row.hash, hashToken(r.body.token));
    assert.ok(!JSON.stringify(row).includes(r.body.token), "the raw secret was stored");

    /** ⛔ The list never shows it again. */
    const listed = await (await fetch(`${base}/p/prj-ada/api/v2/tokens`, { headers: { cookie: `productos_session=${session}` } })).json();
    assert.deepEqual(listed.tokens.map((t) => t.id), [r.body.id]);
    assert.ok(!JSON.stringify(listed).includes(r.body.token), "the list handed the secret back");

    const ok = await toolsList(base, "prj-ada", r.body.token);
    assert.equal(ok.status, 200, ok.text.slice(0, 300));
    assert.ok(ok.text.includes("productos_exchange_scopes"));
  } finally {
    await closing(server);
  }
});

test("a token minted on project A reaches neither the owner's project B nor anyone else's", async () => {
  const { base, server, session } = await hosted();
  try {
    const { body } = await mint(base, "prj-ada", { session });
    assert.ok(body.token);
    const sibling = await toolsList(base, "prj-ada-two", body.token);
    assert.equal(sibling.status, 404, `reached the owner's other project: ${sibling.text.slice(0, 200)}`);
    const theirs = await toolsList(base, "prj-bo", body.token);
    assert.equal(theirs.status, 404);
    /** ⛔ And the page cannot mint on a project the person cannot reach. */
    const notYours = await mint(base, "prj-bo", { session });
    assert.equal(notYours.status, 404);
  } finally {
    await closing(server);
  }
});

test("a cross-site form cannot mint: the body has to be JSON", async () => {
  const { base, server, session } = await hosted();
  try {
    const r = await mint(base, "prj-ada", { session, contentType: "application/x-www-form-urlencoded" });
    assert.equal(r.status, 415);
    assert.equal(r.body.token, undefined);
  } finally {
    await closing(server);
  }
});

test("revoking stops the token, and only its owner on its project can revoke it", async () => {
  const { base, server, db, session } = await hosted();
  try {
    const { body } = await mint(base, "prj-ada", { session });
    const bo = await singleAccount(db, "bo@example.com");
    const stranger = await fetch(`${base}/p/prj-bo/api/v2/tokens/${body.id}`, {
      method: "DELETE",
      headers: { cookie: `productos_session=${bo.session}` },
    });
    assert.equal(stranger.status, 404, "somebody else revoked a token that was not theirs");
    assert.equal((await toolsList(base, "prj-ada", body.token)).status, 200);

    const gone = await fetch(`${base}/p/prj-ada/api/v2/tokens/${body.id}`, {
      method: "DELETE",
      headers: { cookie: `productos_session=${session}` },
    });
    assert.equal(gone.status, 200);
    assert.notEqual((await toolsList(base, "prj-ada", body.token)).status, 200, "a revoked token still worked");
  } finally {
    await closing(server);
  }
});

// ---------------------------------------------------------------------------
// The page half
// ---------------------------------------------------------------------------

/**
 * Run the page's own Connect script against the real server.
 *
 * ⛔ NOT A FAKE THAT RECORDS WHAT IT WAS SENT. `fetch` here resolves the url the script built
 * against the page's real location — as a browser does — and sends it to the instance. A
 * root-relative url therefore 404s here exactly as it did on the hosted page. No Chrome on this
 * machine is why it is a vm and not a browser; the layout is not asserted by this test.
 */
function runConnectScript(html, pageUrl, cookie) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const src = scripts.find((s) => s.includes('details.connect'));
  assert.ok(src, "the page shipped no Connect script");
  const el = () => {
    const handlers = {};
    return {
      hidden: false,
      disabled: false,
      textContent: "",
      handlers,
      addEventListener: (k, f) => (handlers[k] = f),
    };
  };
  const parts = {
    ".connect-make": el(),
    ".connect-out": el(),
    ".connect-lines": el(),
    ".connect-said": el(),
    ".connect-copy": el(),
    ".connect-stop": el(),
  };
  const box = { querySelector: (q) => parts[q] };
  const location = new URL(pageUrl);
  const ctx = {
    location,
    document: { querySelector: (q) => (q === "details.connect" ? box : null) },
    navigator: {},
    encodeURIComponent,
    fetch: (u, init = {}) =>
      fetch(new URL(u, location), { ...init, headers: { ...(init.headers ?? {}), cookie } }),
  };
  vm.runInNewContext(src, ctx);
  return parts;
}

test("the page offers Connect Claude Code under a project, and its two lines connect", async () => {
  const { base, server, session, store } = await hosted();
  try {
    const cookie = `productos_session=${session}`;
    const pageUrl = `${base}/p/prj-ada/v2`;
    const html = await (await fetch(pageUrl, { headers: { cookie } })).text();
    assert.ok(html.includes('class="connect"'), "no Connect Claude Code control on the hosted page");
    assert.ok(html.includes("Connect Claude Code"));

    const parts = runConnectScript(html, pageUrl, cookie);
    await parts[".connect-make"].handlers.click();
    assert.equal(parts[".connect-out"].hidden, false, parts[".connect-said"].textContent);
    const [init, exp] = parts[".connect-lines"].textContent.split("\n");
    assert.equal(init, `productos init claude --at ${base}/p/prj-ada`);
    /** ⛔ What `init claude --at` accepts, so the pasted line is not refused. */
    assert.equal(mcpServerFor({ instance: init.split("--at ")[1] }).url, `${base}/p/prj-ada/mcp`);
    const m = /^export PRODUCTOS_TOKEN=([0-9a-f]{64})$/.exec(exp);
    assert.ok(m, `the second line is not an export: ${exp}`);
    assert.equal((await toolsList(base, "prj-ada", m[1])).status, 200, "the pasted token does not connect");

    await parts[".connect-stop"].handlers.click();
    assert.match(parts[".connect-said"].textContent, /no longer works/);
    assert.notEqual((await toolsList(base, "prj-ada", m[1])).status, 200);
  } finally {
    await closing(server);
  }

  /** ⛔ And not on a page served at the root, where there is no project to connect to. */
  const corpus = await loadFromStore(store);
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const local = renderScopePage(corpus, root, { interactive: true, records: "http", linkBase: "/v2" });
  assert.ok(!local.includes('class="connect"'), "a local page offered to connect to a project it is not");
  const hostedPage = renderScopePage(corpus, root, { interactive: true, records: "http", linkBase: "/p/prj-ada/v2" });
  assert.ok(hostedPage.includes('class="connect"'));
  const inert = renderScopePage(corpus, root, { linkBase: "/p/prj-ada/v2" });
  assert.ok(!inert.includes('class="connect"'), "a read-only render shipped a control that fetches");
});
