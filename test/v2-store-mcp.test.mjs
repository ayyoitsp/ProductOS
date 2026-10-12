/**
 * ⛔ MCP IS WHERE THE RELAY BOUNDARY STOPS BEING HONOUR, SO IT IS WHERE IT GETS ASSERTED.
 *
 * The act tools take `by` and `via` as arguments and hand them to `perform` with nothing asking
 * `mayRecord`. Over stdio that is defensible — one person is at the machine, and the CLI has the
 * same property. Over a token on a network it is the thing `hosted-plan.md` §2 says must never
 * exist: *"anything arriving on an agent token → refused as a verdict, whatever it claims."*
 *
 * Three things are taken away from a remote caller, and each is checked here:
 *
 *   1. a human `via` on a token is refused
 *   2. `by` is the identity the instance knows, not one from the wire
 *   3. `dir` is stripped — ⛔ otherwise `AtDir` is an arbitrary-path read against the server
 *
 * ⛔ Checked at `guardArgs` AND over real JSON-RPC. The pure function is where the rules are legible;
 * the transport test is what proves the pure function is actually on the path.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { projectMcpRoute, mcpProjectOf, guardArgs } from "../dist/v2/store/mcp.js";
import { createProject } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, issueToken, singleAccount } from "../dist/v2/store/identity.js";
import { importFromDisk, loadFromStore } from "../dist/v2/store/corpus.js";
import { EXCHANGE_ACT_TOOLS, EXCHANGE_READ_TOOLS, exchangeTools } from "../dist/mcp/v2-tools.js";
import { HUMAN_VIA, TOKEN_SCOPES } from "../dist/v2/identity.js";

const CLI = path.resolve("dist/cli/index.js");

function corpusOnDisk() {
  const dir = path.join(temp("productos-mcp-"), "v2");
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
  await createProject(db, { id: "prj-bo", owner: bo, slug: "theirs", name: "Bo's" });

  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-ada");
  assert.ok(!isRefusal(store));
  await importFromDisk(store, corpusOnDisk());

  const agent = await issueToken(db, {
    account: ada,
    actor: "a session",
    scopes: [...TOKEN_SCOPES],
  });
  const { session } = await singleAccount(db, "ada@example.com");

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await projectMcpRoute(req, res, p, { db })) return;
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, r));
  return { db, store, server, base: `http://127.0.0.1:${server.address().port}`, agent, session, ada, bo };
}

let nextId = 1;
const rpc = async (base, project, method, params, token) => {
  const res = await fetch(`${base}/p/${project}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const text = await res.text();
  if (!res.ok && !text.includes("jsonrpc")) return { status: res.status, body: safeJson(text) };
  /** The transport may answer as SSE; pull the one data frame out either way. */
  const payload = text.startsWith("event:") || text.includes("\ndata: ")
    ? safeJson(text.split("data: ").at(-1) ?? "")
    : safeJson(text);
  return { status: res.status, body: payload };
};

function safeJson(t) {
  try {
    return JSON.parse(t.trim());
  } catch {
    return { raw: t.slice(0, 300) };
  }
}

const textOf = (body) => body?.result?.content?.[0]?.text ?? "";
const parsedOf = (body) => safeJson(textOf(body));

const anAct = EXCHANGE_ACT_TOOLS.find((t) => t.name === "productos_exchange_agree_to");

/**
 * A ref an acceptance can actually cover.
 *
 * ⛔ A SCOPE IS NOT ONE. An acceptance covers a behaviour, a whole exchange, or a rule — and the
 * top-level scope in the seed has no exchanges of its own, so `<scope>` alone is refused. That is
 * what made the first version of the write test pass while proving nothing.
 */
async function anAgreeableRef(corpus) {
  const { gridFor } = await import("../dist/v2/grid.js");
  for (const s of corpus.scopes) {
    const grid = gridFor(corpus, s.scope.id);
    if (grid.rows.length) return `${s.scope.id}#${grid.rows[0].exchange}`;
  }
  throw new Error("the seeded corpus has no exchange to agree to");
}
const aRead = EXCHANGE_READ_TOOLS.find((t) => t.name === "productos_exchange_scopes");

const aToken = { kind: "token", actor: "a session", scopes: [...TOKEN_SCOPES] };
const aBrowser = { kind: "browser", actor: "ada@example.com", session: "s-1", scopes: ["read", "author"] };

// ---------------------------------------------------------------------------
// guardArgs — where the rules are legible
// ---------------------------------------------------------------------------

test("the MCP path names a project, and is anchored", () => {
  assert.equal(mcpProjectOf("/p/prj-abc/mcp"), "prj-abc");
  assert.equal(mcpProjectOf("/p/prj-abc/mcp/"), "prj-abc");
  assert.equal(mcpProjectOf("/mcp"), null, "an unaddressed MCP endpoint was claimed");
  assert.equal(mcpProjectOf("/p/../mcp"), null);
  assert.equal(mcpProjectOf("/p/prj-abc/api/v2/corpus"), null);
});

test("a token is refused every human `via`, on every act tool", () => {
  assert.ok(EXCHANGE_ACT_TOOLS.length >= 5, "the act family shrank — this test now proves less");
  for (const tool of EXCHANGE_ACT_TOOLS)
    for (const via of HUMAN_VIA) {
      const got = guardArgs(tool, { ref: "x", by: "peter", via }, aToken, "/scratch");
      assert.ok("ok" in got, `⛔ ${tool.name} let a token record "${via}"`);
      assert.match(got.why, /token/);
    }
});

test("a token may land `via: agent`, which is a default and not agreement", () => {
  const got = guardArgs(anAct, { ref: "x", by: "whoever", via: "agent" }, aToken, "/scratch");
  assert.ok(!("ok" in got), JSON.stringify(got));
  assert.equal(got.args.via, "agent");
});

test("`by` from the wire is discarded in favour of the identity the instance knows", () => {
  const asToken = guardArgs(anAct, { ref: "x", by: "peter", via: "agent" }, aToken, "/scratch");
  assert.equal(asToken.args.by, "a session", "a name from the wire became the author");

  const asBrowser = guardArgs(anAct, { ref: "x", by: "somebody-else", via: "page" }, aBrowser, "/scratch");
  assert.equal(asBrowser.args.by, "ada@example.com", "⛔ the last forgeable field is still forgeable");
});

test("`dir` from the caller is stripped on every tool, act or read", () => {
  assert.ok(exchangeTools.length >= 10, "the tool surface shrank — this test now proves less");
  for (const tool of exchangeTools) {
    const got = guardArgs(tool, { dir: "/etc", ref: "x", by: "p", via: "agent" }, aToken, "/scratch");
    /** A refusal is fine; what must never happen is the caller's directory surviving. */
    if ("ok" in got) continue;
    assert.equal(got.args.dir, "/scratch", `⛔ ${tool.name} would read ${got.args.dir}`);
  }
});

// ---------------------------------------------------------------------------
// Over the wire — proving the guard is actually on the path
// ---------------------------------------------------------------------------

test("MCP needs a credential, and another account's project is a 404", async () => {
  const { base, server, db } = await hosted();
  try {
    const anon = await rpc(base, "prj-ada", "tools/list", {});
    assert.equal(anon.status, 401, "an anonymous caller reached the tool surface");

    const bo = await accountFor(db, "bo@example.com");
    const theirs = await issueToken(db, { account: bo, actor: "bo's ci", scopes: ["read"] });
    const crossed = await rpc(base, "prj-ada", "tools/list", {}, theirs.token);
    assert.equal(crossed.status, 404, "a token reached a project outside its account");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("the tool surface is listed over Streamable HTTP", async () => {
  const { base, server, agent } = await hosted();
  try {
    const r = await rpc(base, "prj-ada", "tools/list", {}, agent.token);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    const names = (r.body.result?.tools ?? []).map((t) => t.name);
    assert.ok(names.includes("productos_exchange_scopes"), JSON.stringify(names).slice(0, 300));
    assert.equal(names.length, exchangeTools.length);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a read tool answers, and never hands back a path on the server", async () => {
  const { base, server, agent } = await hosted();
  try {
    const r = await rpc(base, "prj-ada", "tools/call", { name: aRead.name, arguments: {} }, agent.token);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    const out = parsedOf(r.body);
    assert.ok(Array.isArray(out.scopes) || out.scopes, `no scopes came back: ${textOf(r.body).slice(0, 200)}`);
    /** ⛔ A scratch directory on the server is not a thing a caller is told about. */
    assert.ok(!out.dir, `a server path travelled back: ${out.dir}`);
    assert.ok(!textOf(r.body).includes(os.tmpdir()), "a temp path leaked into the response");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("over the wire, a token claiming `via: page` is refused and the store is untouched", async () => {
  const { base, server, agent, store } = await hosted();
  try {
    const corpus = await loadFromStore(store);
    const scope = corpus.scopes.find((s) => !s.scope.in);
    assert.ok(scope, "nothing in the seeded corpus to agree to");
    const before = corpus.verdicts.length;

    const r = await rpc(
      base,
      "prj-ada",
      "tools/call",
      { name: anAct.name, arguments: { ref: scope.scope.id, by: "peter", via: "page" } },
      agent.token,
    );
    assert.equal(r.status, 200, "the transport itself failed");
    assert.ok(r.body.result?.isError, "a token's claim of human consent was accepted");
    assert.match(textOf(r.body), /token/);

    assert.equal(
      (await loadFromStore(store)).verdicts.length,
      before,
      "⛔ the refusal still wrote a verdict into the store",
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a tool that writes lands in the store, under the instance's name, and announces it", async () => {
  const { base, server, agent, store } = await hosted();
  try {
    const corpus = await loadFromStore(store);
    const ref = await anAgreeableRef(corpus);
    const before = corpus.verdicts.length;
    assert.deepEqual(await store.since(0), []);

    const r = await rpc(
      base,
      "prj-ada",
      "tools/call",
      { name: anAct.name, arguments: { ref, by: "somebody-else", via: "agent" } },
      agent.token,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.ok(!r.body.result?.isError, textOf(r.body).slice(0, 300));
    assert.equal(parsedOf(r.body).ok, true, textOf(r.body).slice(0, 300));

    /**
     * ⛔ THE WRITE REACHED THE STORE, not the scratch directory the call ran against. An earlier
     * version of this test accepted "or it refused, and said why" — and it took the refusal branch
     * every time, because the ref was a scope and an acceptance covers an exchange. It asserted
     * nothing about writing for as long as it was green.
     */
    const after = await loadFromStore(store);
    assert.equal(after.verdicts.length, before + 1, "the act reported ok and the store did not move");

    const v = after.verdicts.at(-1);
    assert.equal(v.by, "a session", "⛔ a name from the wire became the author");
    assert.equal(v.via, "agent", "a token's write was recorded as something a person did");
    assert.ok((await store.since(0)).length > 0, "a write announced nothing, so no session hears about it");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a caller naming its own `dir` cannot reach it through the wire either", async () => {
  const { base, server, agent } = await hosted();
  const elsewhere = corpusOnDisk();
  try {
    const r = await rpc(
      base,
      "prj-ada",
      "tools/call",
      { name: aRead.name, arguments: { dir: elsewhere } },
      agent.token,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.ok(!textOf(r.body).includes(elsewhere), `⛔ the server read ${elsewhere} because it was asked to`);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
