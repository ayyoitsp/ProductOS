/**
 * ⛔ THE STORE IS A PLACE TO KEEP A CORPUS, NOT A SECOND MODEL OF ONE.
 *
 * PT-0001: product truth gets its own store so it stops inheriting a repo's properties — no history
 * of its own, no retract, and `git checkout` reaching it because it happens to sit in a code repo.
 * That ticket was opened the day a `git checkout` destroyed ~470 lines of scoping work with nothing
 * to recover from.
 *
 * Four properties are checked here because each of them is cheap to break and silent when broken:
 *
 *   1. Round-trip is byte-identical. A store that reformats on the way out has made every future
 *      diff against a codebase useless, and nobody notices until one matters.
 *   2. The store parses into the SAME corpus the directory does — one parser, one set of refusals.
 *   3. A principal cannot reach a project that is not theirs, and ⛔ cannot tell "not yours" from
 *      "does not exist", because a credential that can do that can enumerate every customer.
 *   4. A token's reach narrows what its account can see and can never widen it.
 *
 * ⛔ Runs against a real Postgres in-process (PGlite), not a mock. The isolation boundary is a
 * property of actual SQL; a fake that returns what it was told would pass while leaking.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accounts, projects, projectMembers } from "../dist/v2/store/schema.js";
import { importFromDisk, exportToDisk, loadFromStore } from "../dist/v2/store/corpus.js";
import { loadCorpus, corpusFiles } from "../dist/v2/load.js";

const CLI = path.resolve("dist/cli/index.js");

/**
 * A seeded corpus on disk, plus the kinds the seed does not carry.
 *
 * ⛔ THE SEED HAS NO STEERS AND NO ACCESS, SO A ROUND TRIP BUILT ONLY FROM IT COMPARES EMPTY LISTS.
 * `steers/` was read by `loadCorpus` and absent from `CORPUS_DIRS`, and `access.yaml` sits at the
 * corpus root where a list of subdirectories could never reach it — both would have round-tripped
 * perfectly here while being dropped, because there was nothing of either kind to lose.
 */
function corpusOnDisk() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-store-")), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

  fs.mkdirSync(path.join(dir, "steers"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "steers", "steers.yaml"),
    [
      "steers:",
      "  - id: prefers-plain-sentences",
      '    says: "Write a behaviour as one plain sentence somebody could disagree with."',
      "    steers: generation",
      '    learned_from: "four change records saying the same thing"',
      "    at: 2026-10-02",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "access.yaml"),
    [
      "access:",
      "  - id: parent",
      "    kind: role",
      '    means: "Can see every child in the family and move money between them."',
      "    holds: [move-money]",
      "  - id: move-money",
      "    kind: permission",
      '    means: "Can move money from one balance to another."',
      "",
    ].join("\n"),
  );
  return dir;
}

async function freshDb() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));

  await db.insert(accounts).values([
    { id: "acct-ada", email: "ada@example.com", name: "Ada" },
    { id: "acct-bo", email: "bo@example.com", name: "Bo" },
  ]);
  await db.insert(projects).values([
    { id: "prj-ada", ownerId: "acct-ada", slug: "wallet", name: "Family Wallet" },
    { id: "prj-bo", ownerId: "acct-bo", slug: "wallet", name: "Bo's Wallet" },
  ]);
  return { client, db };
}

const ada = { kind: "browser", account: "acct-ada", reach: [] };
const bo = { kind: "browser", account: "acct-bo", reach: [] };

/** Unwraps, failing loudly rather than letting a Refusal flow on as an object. */
async function project(db, who, id) {
  const got = await storeFor(db, who).project(id);
  assert.ok(!isRefusal(got), `expected to reach ${id}: ${isRefusal(got) ? got.why : ""}`);
  return got;
}

test("a corpus round-trips through the store byte-for-byte", async () => {
  const { db } = await freshDb();
  const dir = corpusOnDisk();
  const store = await project(db, ada, "prj-ada");

  const { imported } = await importFromDisk(store, dir);
  assert.ok(imported.length > 0, "an empty import would pass every assertion below vacuously");

  const out = fs.mkdtempSync(path.join(os.tmpdir(), "productos-export-"));
  await exportToDisk(store, out);

  /**
   * ⛔ EVERY FILE, COMPARED AS BYTES — PT-0001 "done when" 3. Comparing parsed models instead would
   * pass while whitespace, key order and frontmatter formatting all drifted, and a corpus is diffed
   * against a codebase as text.
   */
  assert.deepEqual(corpusFiles(out), corpusFiles(dir));
});

test("the store parses into the same corpus the directory does", async () => {
  const { db } = await freshDb();
  const dir = corpusOnDisk();
  const store = await project(db, ada, "prj-ada");
  await importFromDisk(store, dir);

  const local = loadCorpus(dir);
  const stored = await loadFromStore(store);

  assert.deepEqual(
    stored.scopes.map((s) => s.scope.id).sort(),
    local.scopes.map((s) => s.scope.id).sort(),
  );
  assert.equal(stored.rules.length, local.rules.length);
  assert.equal(stored.verdicts.length, local.verdicts.length);
  assert.equal(stored.charter.length, local.charter.length);
  assert.equal(stored.notes.length, local.notes.length);

  /**
   * ⛔ NAMED EXPLICITLY, because these are the two that were being dropped. Comparing `stored` to
   * `local` would also pass if BOTH were empty, which is exactly how this went unnoticed.
   */
  assert.equal(stored.steers.length, 1, "steers did not survive the store");
  assert.deepEqual(
    stored.steers.map((x) => x.id),
    local.steers.map((x) => x.id),
  );
  if ("access" in local) {
    assert.equal(stored.access.length, local.access.length, "access did not survive the store");
    assert.ok(local.access.length > 0, "the fixture stopped carrying access");
  }
  assert.deepEqual(
    stored.broken.map((b) => b.why),
    local.broken.map((b) => b.why),
    "the store lost or invented a parse failure",
  );
  assert.ok(local.scopes.length > 0, "an empty corpus would pass this vacuously");
});

test("a project you do not own is unreachable, and indistinguishable from one that does not exist", async () => {
  const { db } = await freshDb();
  const dir = corpusOnDisk();
  await importFromDisk(await project(db, ada, "prj-ada"), dir);

  const notYours = await storeFor(db, bo).project("prj-ada");
  assert.ok(isRefusal(notYours), "⛔ Bo reached Ada's corpus");

  const notReal = await storeFor(db, bo).project("prj-does-not-exist");
  assert.ok(isRefusal(notReal));

  /**
   * ⛔ THE SAME REFUSAL, OR THE DIFFERENCE IS AN ENUMERATION ORACLE. Anybody with one token could
   * otherwise walk the id space and read off the customer list — no writes, nothing in a log that
   * looks like an attack.
   */
  assert.equal(
    notYours.why.replace("prj-ada", "X"),
    notReal.why.replace("prj-does-not-exist", "X"),
    "the refusal says whether the project exists",
  );
  assert.deepEqual(notYours.detail, notReal.detail);
});

test("each account reaches only its own projects", async () => {
  const { db } = await freshDb();
  assert.deepEqual(await storeFor(db, ada).reachable(), ["prj-ada"]);
  assert.deepEqual(await storeFor(db, bo).reachable(), ["prj-bo"]);
});

test("a membership grants reach; a token's reach narrows but never widens it", async () => {
  const { db } = await freshDb();

  // Bo is invited to Ada's project, so reach follows the membership.
  await db.insert(projectMembers).values({
    projectId: "prj-ada",
    accountId: "acct-bo",
    role: "member",
  });
  assert.deepEqual((await storeFor(db, bo).reachable()).sort(), ["prj-ada", "prj-bo"]);

  // A token scoped to one of them sees only that one.
  const narrowed = { kind: "token", account: "acct-bo", reach: ["prj-ada"] };
  assert.deepEqual(await storeFor(db, narrowed).reachable(), ["prj-ada"]);

  /**
   * ⛔ INTERSECTION, NOT UNION. A token naming a project its account cannot reach gets nothing —
   * otherwise `reach` becomes a grant, and revoking a membership would leave every token issued
   * before it still working.
   */
  const overreaching = { kind: "token", account: "acct-bo", reach: ["prj-ada", "prj-nobody"] };
  assert.deepEqual(await storeFor(db, overreaching).reachable(), ["prj-ada"]);

  const stranger = { kind: "token", account: "acct-ada", reach: ["prj-bo"] };
  assert.deepEqual(await storeFor(db, stranger).reachable(), [], "a token widened its account");
});

test("the event cursor is per project, so one project's changes do not move another's", async () => {
  const { db } = await freshDb();
  const a = await project(db, ada, "prj-ada");
  const b = await project(db, bo, "prj-bo");

  assert.equal(await a.append("note", { id: "n1" }), 1);
  assert.equal(await a.append("press", { id: "p1" }), 2);
  assert.equal(await b.append("note", { id: "n2" }), 1, "⛔ a shared sequence");

  const fromStart = await a.since(0);
  assert.deepEqual(
    fromStart.map((e) => [e.seq, e.kind]),
    [
      [1, "note"],
      [2, "press"],
    ],
  );

  /** ⛔ Cursor semantics: a reader that already saw 1 is handed 2, not everything again. */
  assert.deepEqual((await a.since(1)).map((e) => e.seq), [2]);
  assert.deepEqual((await b.since(0)).map((e) => e.seq), [1]);
});

test("a document is deprecated, never deleted", async () => {
  const { db, client } = await freshDb();
  const store = await project(db, ada, "prj-ada");
  await store.put("truth/pricing.md", "---\nid: pricing\n---\n");

  assert.ok("truth/pricing.md" in (await store.documents()));
  await store.deprecate("truth/pricing.md");
  assert.ok(!("truth/pricing.md" in (await store.documents())), "a deprecated document still loads");

  /** ⛔ Gone from the corpus, still on the record. There is no delete path at all. */
  const rows = await client.query("select path, deprecated_at from documents where project_id = $1", [
    "prj-ada",
  ]);
  assert.equal(rows.rows.length, 1);
  assert.ok(rows.rows[0].deprecated_at, "the row was removed rather than retired");
});
