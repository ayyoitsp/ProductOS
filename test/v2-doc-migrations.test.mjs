/**
 * ⛔ A SCHEMA REMOVAL WITH NO MIGRATION TAKES A CORPUS OFFLINE, NOT DOWN A NOTCH.
 *
 * `walked` was removed from `View` deliberately and nothing migrated the corpora already using it.
 * The result is not a warning on two files — `check` answers `cannot-judge-this-corpus`, because
 * two documents would not load and every other finding would be computed against a corpus missing
 * part of itself. Peter's own working corpus was in that state when it was imported.
 *
 * Peter: *"migration should be server maintained - as we move the schema forward, the server ensures
 * the database is up to date. so we should have tracked migrations"*.
 *
 * So: tracked per project, run once, announced in the log a reader already reads, and — the part
 * that is easy to get wrong — it must not touch documents it has nothing to say about.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";
import { createProject } from "../dist/v2/store/instance.js";
import { loadFromStore } from "../dist/v2/store/corpus.js";
import {
  DOC_MIGRATIONS,
  migrateDocuments,
  migrateAllDocuments,
} from "../dist/v2/store/doc-migrations.js";
import { documents } from "../dist/v2/store/schema.js";
import fsSync from "node:fs";
import path from "node:path";

/** A truth file with `walked` on two views, as the corpora written before the removal have it. */
const WITH_WALKED = `---
id: money
title: Money
views:
  - id: balance
    title: A balance
    walked: true
    sketch: |
      a number
  - id: spend
    title: Spending
    walked: false
---

Framing prose that must survive untouched.
`;

async function project(slug = "p1") {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const owner = await accountFor(db, "ada@example.com");
  const id = `prj-${slug}`;
  await createProject(db, { id, owner, slug, name: slug });
  const store = await storeFor(db, { kind: "browser", account: owner, reach: [] }).project(id);
  assert.ok(!isRefusal(store));
  return { db, client, store, id, owner };
}

test("the registry is ordered, and every rule says why it exists", () => {
  assert.ok(DOC_MIGRATIONS.length > 0, "no document migrations at all");
  const ids = DOC_MIGRATIONS.map((m) => m.id);
  assert.deepEqual(ids, [...ids].sort(), "the rules are not in id order — order is how they apply");
  assert.equal(new Set(ids).size, ids.length, "two rules share an id, so the ledger cannot tell them apart");
  for (const m of DOC_MIGRATIONS) {
    /** ⛔ A rewrite of somebody's truth with no recorded reason is one nobody can argue with. */
    assert.ok(m.why.length > 40, `${m.id} does not say why a corpus cannot be left alone`);
    assert.equal(typeof m.apply, "function");
  }
});

test("`walked` is dropped, and the rest of the document is untouched byte for byte", async () => {
  const { db, store } = await project();
  await store.put("truth/money.md", WITH_WALKED);

  const before = await loadFromStore(store);
  assert.equal(before.broken.length, 1, "the fixture does not actually break — this proves nothing");
  assert.match(before.broken[0].why, /walked/);

  const applied = await migrateDocuments(db, store);
  assert.deepEqual(applied.map((a) => a.migration), ["0001-drop-walked"]);
  assert.deepEqual(applied[0].documents, ["truth/money.md"]);

  const after = await loadFromStore(store);
  assert.deepEqual(after.broken, [], `still broken: ${JSON.stringify(after.broken)}`);
  assert.equal(after.scopes.length, 1);
  assert.equal(after.scopes[0].scope.views.length, 2, "a view was lost along with the key");

  const source = (await store.documents())["truth/money.md"];
  /** ⛔ Only the two lines. A YAML reserialise would pass a parse check and lose the prose. */
  assert.ok(!source.includes("walked"), "the key is still there");
  assert.match(source, /Framing prose that must survive untouched\./);
  assert.match(source, /sketch: \|\n      a number/, "the sketch block was reformatted");
  assert.equal(
    source,
    WITH_WALKED.split("\n").filter((l) => !/^\s*walked:/.test(l)).join("\n"),
    "something other than the walked lines changed",
  );
});

test("it runs once per project, and is recorded even when it changed nothing", async () => {
  const { db, store, client } = await project();
  await store.put("truth/clean.md", "---\nid: clean\ntitle: Clean\nviews: []\n---\n");

  const first = await migrateDocuments(db, store);
  assert.deepEqual(first[0].documents, [], "it claimed to change a document with no `walked`");

  /** ⛔ Recorded anyway, or every boot re-reads every document in every project forever. */
  const ledger = await client.query("select migration_id, documents from document_migrations");
  assert.equal(ledger.rows.length, DOC_MIGRATIONS.length);

  const second = await migrateDocuments(db, store);
  assert.deepEqual(second, [], "a rule ran twice");
});

test("an unaffected document is not rewritten at all", async () => {
  const { db, store, client } = await project();
  await store.put("truth/clean.md", "---\nid: clean\ntitle: Clean\nviews: []\n---\n");

  const [{ updated_at: before }] = (
    await client.query("select updated_at from documents where path = 'truth/clean.md'")
  ).rows;

  await migrateDocuments(db, store);

  const [{ updated_at: after }] = (
    await client.query("select updated_at from documents where path = 'truth/clean.md'")
  ).rows;

  /**
   * ⛔ THE REASON `apply` RETURNS `null` RATHER THAN THE INPUT. A no-op write bumps `updated_at` on
   * every document in every project on the first boot after a rule lands, which destroys the only
   * signal anybody has for what moved recently.
   */
  assert.deepEqual(after, before, "an untouched document was written anyway");
});

test("a rewrite is announced in the log a reader already reads", async () => {
  const { db, store } = await project();
  await store.put("truth/money.md", WITH_WALKED);
  assert.deepEqual(await store.since(0), []);

  await migrateDocuments(db, store);

  const events = await store.since(0);
  assert.equal(events.length, 1, `expected one announcement, got ${JSON.stringify(events)}`);
  assert.equal(events[0].kind, "corpus-migrated");
  assert.match(events[0].payload.says, /up to date/);
  assert.equal(events[0].payload.ref, "0001-drop-walked");
  assert.deepEqual(events[0].payload.detail, ["truth/money.md"]);
  /** ⛔ `CLAUDE.md`: nothing silently rewrites a corpus. This is what stops it being silent. */
  assert.ok(events[0].payload.by, "nothing records who changed it");
});

test("a project imported after a rule ran still gets it", async () => {
  const { db, store, owner } = await project("first");
  await migrateDocuments(db, store);

  /** ⛔ The case a per-instance ledger would miss, and the reason this is keyed by project. */
  await createProject(db, { id: "prj-later", owner, slug: "later", name: "later" });
  const later = await storeFor(db, { kind: "browser", account: owner, reach: [] }).project("prj-later");
  await later.put("truth/money.md", WITH_WALKED);

  const all = await migrateAllDocuments(db, async (id) => {
    const s = await storeFor(db, { kind: "browser", account: owner, reach: [] }).project(id);
    return isRefusal(s) ? null : s;
  });
  assert.equal(all.projects, 2);
  assert.deepEqual(all.failed, []);
  assert.deepEqual((await loadFromStore(later)).broken, [], "the newly imported corpus was left broken");
});

test("one unmigratable project does not stop the others", async () => {
  const { db, store, owner } = await project("ok");
  await store.put("truth/money.md", WITH_WALKED);
  await createProject(db, { id: "prj-bad", owner, slug: "bad", name: "bad" });

  const all = await migrateAllDocuments(db, async (id) => {
    if (id === "prj-bad") throw new Error("this project cannot be reached");
    const s = await storeFor(db, { kind: "browser", account: owner, reach: [] }).project(id);
    return isRefusal(s) ? null : s;
  });

  /** ⛔ Named rather than swallowed — a project nobody could migrate is one somebody must look at. */
  assert.deepEqual(all.failed, ["prj-bad"]);
  assert.deepEqual((await loadFromStore(store)).broken, [], "a failure elsewhere blocked a good corpus");
});

test("the rule only touches truth documents", async () => {
  const rule = DOC_MIGRATIONS.find((m) => m.id === "0001-drop-walked");
  /** `walked:` in a verdict's prose is somebody's sentence, not a schema key. */
  const note = 'notes:\n  - id: n1\n    says: "walked: true was removed"\n';
  assert.equal(rule.apply("notes/notes.yaml", note), null, "it reached outside truth/");
  assert.equal(rule.apply("truth/x.md", "---\nid: x\n---\n"), null, "it rewrote a document with no walked");
});

test("⛔ importing brings a corpus forward, so it is judgeable without a restart", async () => {
  /**
   * `migrateDocuments` says in its own header that "projects arrive by import at any time", which
   * is exactly why the ledger is keyed per project — and nothing called it from the import path.
   * So a corpus carrying a key the schema has dropped went into the store unparseable and STAYED
   * unparseable until somebody restarted the instance.
   *
   * ⛔ And that is not a corpus that is merely imperfect. `check` answers `cannot-judge-this-corpus`
   * and refuses the whole thing, so every other finding is withheld too.
   *
   * Driven on a dev stack before this was wired: `hosted import` reported `1 scopes` and warned
   * about two documents; `make restart` silently fixed both. Afterwards the same import reports
   * `3 scopes` and says which documents it brought forward.
   */
  const { db, store } = await project("imported");
  await store.put("truth/money.md", WITH_WALKED);

  assert.notDeepEqual((await loadFromStore(store)).broken, [], "the fixture is supposed to be broken");

  const applied = await migrateDocuments(db, store);
  assert.deepEqual(
    applied.flatMap((a) => a.documents),
    ["truth/money.md"],
    "the import path has to say which documents it moved — a silent rewrite of truth is what CLAUDE.md forbids"
  );
  assert.deepEqual((await loadFromStore(store)).broken, [], "still unjudgeable after import");
});

test("the import path calls it, and before it reports on what it imported", () => {
  /**
   * ⛔ READ OFF THE SOURCE, because the CLI runs as a subprocess and cannot reach a PGlite store
   * held in this process. What is asserted is the ordering that makes the warning truthful: a
   * corpus is brought forward BEFORE it is loaded and reported on, or `import` warns about
   * documents it was about to fix.
   */
  const src = fsSync.readFileSync(path.join(process.cwd(), "src/cli/commands/hosted.ts"), "utf-8");
  const block = src.slice(src.indexOf('.command("import <dir>")'));
  const end = block.indexOf('.command("style');
  const action = block.slice(0, end > 0 ? end : block.length);

  const migrate = action.indexOf("migrateDocuments(");
  const load = action.indexOf("loadFromStore(");
  assert.ok(migrate > 0, "import never brings the corpus forward — it will warn about what a migration would fix");
  assert.ok(load > 0 && migrate < load, "it loads before it migrates, so what it reports is the state it was about to leave behind");
});
