/**
 * ⛔ THE HOSTED INSTANCE IS THE SAME INSTANCE, ADDRESSED BY PROJECT.
 *
 * `productos serve` is not a preview of a hosted thing — it IS the thing, with a directory behind
 * it instead of a database. So the test that matters is not "the new routes work"; it is that the
 * SAME routes, driven by the SAME client, behave the same way with a store behind them, and that
 * the two guarantees hosting is supposed to buy actually hold:
 *
 *   - a press is attributable to an account the instance authenticated, not to the OS user of the
 *     process (`fg-0002`), and not to a name the request asked for
 *   - a token still cannot mint consent, over HTTP, against a real store
 *
 * ⛔ AND A WRITE THAT STARTED FROM A STALE CORPUS IS REFUSED, NOT MERGED. That is the one way this
 * adapter could reintroduce "two surfaces each believing they held the truth", so it is asserted
 * rather than argued.
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
import { instanceRoute, createProject, projectOf, projectBySlug, writeBack } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, issueToken, singleAccount } from "../dist/v2/store/identity.js";
import { importFromDisk } from "../dist/v2/store/corpus.js";
import { loadFromStore } from "../dist/v2/store/corpus.js";

const CLI = path.resolve("dist/cli/index.js");

function corpusOnDisk() {
  const dir = path.join(temp("productos-hosted-"), "v2");
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
  await createProject(db, { id: "prj-bo", owner: bo, slug: "wallet", name: "Bo's" });

  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-ada");
  assert.ok(!isRefusal(store));
  await importFromDisk(store, corpusOnDisk());

  const { session } = await singleAccount(db, "ada@example.com");

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, store, server, base, session, ada, bo };
}

const call = async (base, route, { method = "GET", body, token, session } = {}) => {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(session ? { cookie: `productos_session=${session}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
};

const firstScope = async (store) => {
  const corpus = await loadFromStore(store);
  const scope = corpus.scopes.find((s) => !s.scope.in);
  assert.ok(scope, "the seeded corpus has no top-level scope to act on");
  return scope.scope.id;
};

test("a project is addressed in the path, and the pattern is anchored", () => {
  assert.deepEqual(projectOf("/p/prj-abc/api/v2/corpus"), { id: "prj-abc", rest: "/api/v2/corpus" });
  assert.deepEqual(projectOf("/p/prj-abc"), { id: "prj-abc", rest: "/" });
  assert.equal(projectOf("/api/v2/corpus"), null, "an unaddressed path was claimed");
  /** ⛔ Or a project id could carry a path and reach another project's routes. */
  assert.equal(projectOf("/p/../p/prj-other/api/v2/corpus"), null);
  assert.equal(projectOf("/x/p/prj-abc/"), null, "the pattern is not anchored at the start");
});

test("the obvious URL reaches the page, and authorization still comes first", async () => {
  const { base, server, session, db } = await hosted();
  try {
    /**
     * ⛔ `v2Route`'s allowlist claims `/v2` and `/api/v2/*` and nothing else, so `/p/<id>/` used to
     * 404 — and that is the URL a person is handed, types, and guesses. `make seed` printed it and
     * it did not work, which is how this was found.
     */
    const root = await fetch(`${base}/p/prj-ada/`, {
      redirect: "manual",
      headers: { cookie: `productos_session=${session}` },
    });
    assert.equal(root.status, 302, "the obvious URL is still a 404");
    assert.equal(root.headers.get("location"), "/p/prj-ada/v2");

    /**
     * ⛔ AND THE REDIRECT MUST NOT OUTRANK THE REFUSAL. Answering 302 before checking reach would
     * confirm a project exists to anybody who asks — the enumeration oracle, reintroduced by a
     * convenience.
     */
    const bo = await accountFor(db, "bo@example.com");
    const theirs = await issueToken(db, { account: bo, actor: "bo", scopes: ["read"] });
    const crossed = await fetch(`${base}/p/prj-ada/`, {
      redirect: "manual",
      headers: { authorization: `Bearer ${theirs.token}` },
    });
    assert.equal(crossed.status, 404, "the redirect leaked that the project exists");

    const anon = await fetch(`${base}/p/prj-ada/`, { redirect: "manual" });
    assert.equal(anon.status, 401, "an anonymous request was redirected instead of refused");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("the corpus comes back over the wire, addressed by project", async () => {
  const { base, session, server, store } = await hosted();
  try {
    const r = await call(base, "/p/prj-ada/api/v2/corpus", { session });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    const files = r.body.files ?? {};
    assert.deepEqual(Object.keys(files).sort(), Object.keys(await store.documents()).sort());
    assert.ok(Object.keys(files).length > 0, "an empty corpus would pass this vacuously");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a request nobody can account for is refused before any route runs", async () => {
  const { base, server } = await hosted();
  try {
    const r = await call(base, "/p/prj-ada/api/v2/corpus");
    assert.equal(r.status, 401, "an anonymous request reached a corpus");
    assert.match(r.body.why, /not signed in/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("another account's project is a 404 that does not say whether it exists", async () => {
  const { base, server, db } = await hosted();
  try {
    const bo = await accountFor(db, "bo@example.com");
    const { token } = await issueToken(db, { account: bo, actor: "bo's ci", scopes: ["read"] });

    const notYours = await call(base, "/p/prj-ada/api/v2/corpus", { token });
    const notReal = await call(base, "/p/prj-nope/api/v2/corpus", { token });

    assert.equal(notYours.status, 404);
    assert.equal(notReal.status, 404);
    /** ⛔ Identical, or one token enumerates every customer on the instance. */
    assert.equal(
      notYours.body.why.replace("prj-ada", "X"),
      notReal.body.why.replace("prj-nope", "X"),
    );
    assert.deepEqual(notYours.body.detail, notReal.body.detail);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a browser press is recorded as the authenticated account, and lands in the store", async () => {
  const { base, server, session, store } = await hosted();
  try {
    const ref = await firstScope(store);
    const before = (await loadFromStore(store)).verdicts.length;

    const r = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "read", ref, via: "page", buildable: false, by: "somebody-else" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));

    /** ⛔ THE WRITE REACHED THE STORE, not just the scratch directory the request ran against. */
    const after = await loadFromStore(store);
    assert.equal(after.verdicts.length, before + 1, "the press never landed in the store");

    const v = after.verdicts.at(-1);
    assert.equal(v.by, "ada@example.com", "the account the instance authenticated is not on the press");
    assert.notEqual(v.by, "somebody-else", "a name from the request body was taken");
    assert.notEqual(v.by, os.userInfo().username, "⛔ fg-0002: the press is still the OS user");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("over HTTP against a real store, a token claiming `via: page` is refused and writes nothing", async () => {
  const { base, server, db, store } = await hosted();
  try {
    const ada = await accountFor(db, "ada@example.com");
    const { token } = await issueToken(db, {
      account: ada,
      actor: "a session",
      scopes: ["read", "author", "relay"],
    });
    const ref = await firstScope(store);
    const before = (await loadFromStore(store)).verdicts.length;

    const r = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      token,
      body: { intent: "read", ref, via: "page", buildable: false, by: "ada@example.com" },
    });
    assert.equal(r.status, 403, `expected a refusal, got ${r.status}`);
    assert.equal(
      (await loadFromStore(store)).verdicts.length,
      before,
      "the refusal still wrote a verdict into the store",
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a carried press keeps the presser's name and records the courier", async () => {
  const { base, server, db, store } = await hosted();
  try {
    const ada = await accountFor(db, "ada@example.com");
    const { token } = await issueToken(db, {
      account: ada,
      actor: "a session",
      scopes: ["read", "author", "relay"],
    });
    const ref = await firstScope(store);

    const r = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      token,
      body: { intent: "carry", act: "read", ref, by: "peter", via: "page", buildable: false },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));

    const v = (await loadFromStore(store)).verdicts.at(-1);
    assert.equal(v.by, "peter", "the courier's identity became the presser's");
    assert.equal(v.via, "page");
    assert.equal(v.relayed_by, "a session", "nothing records that this instance did not watch it happen");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("two presses arriving at once both land, and neither erases the other", async () => {
  const { base, server, session, store } = await hosted();
  try {
    const corpus = await loadFromStore(store);
    const refs = corpus.scopes.filter((s) => !s.scope.in).map((s) => s.scope.id).slice(0, 2);
    assert.ok(refs.length >= 1, "the seeded corpus has nothing to press");
    const before = corpus.verdicts.length;

    /**
     * ⛔ THE PROPERTY A READ-MODIFY-WRITE ADAPTER MOST EASILY LOSES. Both requests materialize the
     * corpus, append a verdict, and write back; without serialization the second one's view is
     * stale and whichever finishes last silently contains only its own press.
     */
    const presses = refs.concat(refs).map((ref) =>
      call(base, "/p/prj-ada/api/v2/in", {
        method: "POST",
        session,
        body: { intent: "read", ref, via: "page", buildable: false },
      }),
    );
    const results = await Promise.all(presses);

    const landed = results.filter((r) => r.status === 200).length;
    const refused = results.filter((r) => r.status === 409).length;
    assert.equal(landed + refused, results.length, `unexpected statuses: ${results.map((r) => r.status)}`);
    assert.ok(landed > 0, "every concurrent press was refused");

    const after = (await loadFromStore(store)).verdicts.length;
    assert.ok(
      after >= before + 1,
      `⛔ ${landed} presses reported success and the store gained ${after - before}`,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a write built on a stale corpus is refused, not merged", async () => {
  const { server, store } = await hosted();
  try {
    const docs = await store.documents();
    const victim = Object.keys(docs).find((k) => k.endsWith(".md"));
    assert.ok(victim, "no document to contend over");

    /**
     * ⛔ THE MULTI-REPLICA RACE, AT ITS ACTUAL SEAM. In one process `serialize` keeps two writers
     * apart, so this cannot be provoked over HTTP — and that is exactly why it is asserted here
     * instead of argued in a comment. Two instances against one database are two of those maps,
     * and the precondition is the only thing standing between them.
     *
     * `stale` is what a request that started earlier would have read; the store has since moved.
     */
    const stale = { ...docs };
    const somebodyElse = `${docs[victim]}\n<!-- landed while the other request was working -->\n`;
    await store.put(victim, somebodyElse);

    const dir = path.join(temp("productos-stale-"), "corpus");
    for (const [rel, content] of Object.entries(stale)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, rel === victim ? `${content}\n<!-- my edit -->\n` : content);
    }

    const result = await writeBack(store, stale, dir);
    assert.ok("conflict" in result, "a stale write was applied");
    assert.deepEqual(result.conflict, [victim]);

    /** ⛔ And nothing was written — a partial apply would be the worst of both. */
    assert.equal((await store.documents())[victim], somebodyElse);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a change to the corpus appends an event, and the cursor is per project", async () => {
  const { base, server, session, store, db, bo } = await hosted();
  try {
    const ref = await firstScope(store);
    assert.deepEqual(await store.since(0), [], "the project started with events already in it");

    await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "read", ref, via: "page", buildable: false },
    });

    const events = await store.since(0);
    assert.ok(events.length > 0, "a press changed the corpus and announced nothing");
    assert.deepEqual(
      events.map((e) => e.seq),
      events.map((_, i) => i + 1),
      "the per-project sequence has holes",
    );

    /**
     * ⛔ THE ACT'S OWN ANNOUNCEMENT, NOT A SYNTHETIC ONE. `acts.ts` appends to `events/log.jsonl`
     * inside the request, in the words a reader sees. Those appends used to be written into a
     * scratch directory that was then deleted, and this layer replaced them with a bare
     * `corpus-changed` carrying a file path — so a session was told "something moved" instead of
     * what happened, and the log the inbox reads disagreed with the one the store kept.
     */
    assert.ok(
      events.every((e) => typeof e.payload?.says === "string" && e.payload.says.length > 0),
      `an event carries no words a reader could act on: ${JSON.stringify(events).slice(0, 300)}`,
    );
    assert.ok(
      !events.some((e) => e.kind === "corpus-changed" && e.payload?.path),
      "the delegate's announcement was replaced by a path",
    );

    /** ⛔ And exactly one event per press — a synthetic echo on top would wake a session twice. */
    assert.equal(events.length, 1, `one press announced ${events.length} times`);

    const other = await storeFor(db, { kind: "browser", account: bo, reach: [] }).project("prj-bo");
    assert.deepEqual(await other.since(0), [], "⛔ one project's writes moved another's cursor");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("the slug resolves to the id, and is scoped to its owner", async () => {
  const { db, server, ada, bo } = await hosted();
  try {
    /** ⛔ Both accounts have a project slugged `wallet` — the alias is unique per owner, not globally. */
    assert.equal(await projectBySlug(db, ada, "wallet"), "prj-ada");
    assert.equal(await projectBySlug(db, bo, "wallet"), "prj-bo");
    assert.equal(await projectBySlug(db, ada, "nope"), null);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
