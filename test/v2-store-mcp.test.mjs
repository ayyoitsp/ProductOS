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
/** ⛔ The slot list, so "bounded by content" is held against the number of slots there are. */
const { SLOTS } = await import("../dist/v2/schema.js");
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
import { RETIRED_ACT_TOOLS, EXCHANGE_READ_TOOLS, exchangeTools } from "../dist/mcp/v2-tools.js";
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

const anAct = RETIRED_ACT_TOOLS.find((t) => t.name === "productos_exchange_agree_to");

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
  assert.ok(RETIRED_ACT_TOOLS.length >= 5, "the act family shrank — this test now proves less");
  for (const tool of RETIRED_ACT_TOOLS)
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
      /**
       * ⛔ THROUGH THE DOOR, BECAUSE THAT IS THE ONLY WAY IN NOW. The five act tools came off the
       * surface when `productos_in` grew to take their intents — so calling one by name tests a
       * tool nobody can reach, and the guarantee this is about (a token cannot claim a human
       * pressed anything) has to be proven where a token would actually go.
       */
      {
        name: "productos_in",
        arguments: { intent: "accept", fields: { ref: scope.scope.id, by: "peter", via: "page" } },
      },
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
      /**
       * \u26d4 THROUGH THE DOOR, which is the only way in now — the five act tools came off the
       * surface when `productos_in` grew to take their intents. The guarantee is unchanged and is
       * the point of the test: the write lands in the STORE, under the identity the instance
       * authenticated, and announces itself.
       */
      {
        name: "productos_in",
        arguments: { intent: "accept", fields: { ref, by: "somebody-else", via: "agent" } },
      },
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
    /**
     * ⛔ MORE THAN BEFORE, NOT EXACTLY ONE MORE — because an acceptance of an exchange is a BULK
     * PRESS now, and this assertion encoded the old arithmetic.
     *
     * Peter: *"so acceptance is def at a per-ref level"*. One press on an exchange writes one
     * ordinary acceptance per sentence beneath it, each with its own hashes, so a seven-sentence
     * behaviour lands eight records. The old `before + 1` was not describing a guarantee, it was
     * describing how many sentences the fixture's exchange happened to have.
     *
     * What this test is actually for is unchanged and still asserted below: the write reached the
     * STORE rather than the scratch directory, under the identity the instance authenticated.
     */
    assert.ok(
      after.verdicts.length > before,
      "the act reported ok and the store did not move",
    );
    /** ⛔ And the press covered the sentences, not just the envelope — the point of the bulk press. */
    assert.ok(
      after.verdicts.some((x) => (x.target ?? "").split("#").length === 3),
      "an exchange was accepted and no sentence beneath it was",
    );

    /**
     * ⛔ AND IT IS BOUNDED BY WHAT THE EXCHANGE SAYS, WHICH IS THE QUESTION THE COUNT CANNOT ANSWER.
     *
     * The deploy session found this test red, could not attribute it, and asked the one thing worth
     * asking: is the fan-out bounded by what the press selected, or by everything the ref touches?
     * Eight records, eight slots — a suspiciously round "all of them". The number cannot tell those
     * apart. The targets can:
     *
     *     money#see-a-balance                                   <- the exchange, no note
     *     money#see-a-balance#with #answer #after #refuses
     *                        #fails #again #at_once             <- seven, each noted
     *
     * `#may` is ABSENT, because that slot has nothing to cover. So this is one exchange plus the
     * sentences that actually exist — bounded by content, which is what `sentencesIn` claims — and
     * not one per slot name. That absence is the entire difference between a working fan-out and a
     * runaway one, and it is what the three assertions below hold.
     */
    const mine = after.verdicts.filter((x) => x.target === ref || (x.target ?? "").startsWith(ref + "#"));
    const onExchange = mine.filter((x) => x.target === ref);
    const beneath = mine.filter((x) => x.target !== ref);

    assert.equal(onExchange.length, 1, `${onExchange.length} records landed on the exchange itself`);

    /**
     * ⛔ EXACTLY THE SLOTS THIS EXCHANGE DECLARES — not "more than before", and not "fewer than
     * eight". The deploy session made the case and it applies to both of the weaker versions:
     *
     *     `> before`                  passes on 1, on 8, and on 800
     *     `< SLOTS.length`            passes on 1 through 7
     *     `deepEqual(declared slots)` passes on exactly the right set
     *
     * A bulk press fans out, so the failure mode it HAS is covering more than the press selected —
     * "the claims this sentence settles" and "all the claims" are one missing filter apart. A bound
     * that admits any number below eight cannot see that; a set can.
     *
     * ⛔ DERIVED FROM `ex.slots`, DELIBERATELY NOT FROM `sentencesIn`. Asking the production
     * function what it expects to write and then checking it wrote that is a test that cannot catch
     * the function being wrong. The exchange's own declared slots are corpus DATA, so this holds the
     * fan-out against the truth rather than against itself.
     *
     * ⛔ AND THIS FIXTURE HAS NO `may` SLOT, which is why eight records is seven sentences plus the
     * envelope rather than one per slot name. That absence is the whole evidence that the fan-out is
     * bounded by content — asserted below so the expectation is justified rather than lucky.
     */
    const [sid, exid] = ref.split("#");
    const ex = corpus.scopes.find((x) => x.scope.id === sid)?.scope.exchanges.find((e) => e.id === exid);
    assert.ok(ex, `the fixture has no exchange ${ref}`);
    const declared = Object.keys(ex.slots);

    /** ⛔ Non-vacuous twice over: fewer slots than there are, and every one of them settled. */
    assert.ok(
      declared.length < SLOTS.length,
      `the fixture declares all ${SLOTS.length} slots, so "bounded by content" is untestable on it`
    );
    for (const k of declared) {
      assert.equal(ex.slots[k].standing?.kind, "stated", `${ref}#${k} is not settled, so it would be skipped`);
    }

    assert.deepEqual(
      beneath.map((x) => x.target).sort(),
      declared.map((k) => `${ref}#${k}`).sort(),
      "the press did not land on exactly the sentences this exchange declares"
    );

    /**
     * ⛔ ONE PRESS IS DISTINGUISHABLE FROM N PRESSES, which is the whole reason the note exists:
     * "read eight sentences and agreed to each" and "agreed to the whole thing at once" are
     * different amounts of attention, and `at` is only a date.
     */
    assert.equal(onExchange[0].note, undefined, "the exchange's own record was marked as a bulk press");
    for (const x of beneath) {
      assert.match(x.note ?? "", /one press/, `${x.target} does not say which press it came from`);
    }

    /**
     * ⛔ ON THE EXCHANGE'S OWN RECORD, NOT `at(-1)`. The last record is a SENTENCE now, so these
     * assertions were naming one row and checking another — true today because every row shares the
     * press's identity, and exactly the kind of thing that stops being true without a word.
     */
    const v = onExchange[0];
    assert.equal(v.by, "a session", "⛔ a name from the wire became the author");
    assert.equal(v.via, "agent", "a token's write was recorded as something a person did");
    for (const x of beneath) {
      assert.equal(x.by, "a session", `${x.target} was attributed to somebody else`);
      assert.equal(x.via, "agent", `${x.target} was recorded as something a person did`);
    }
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
