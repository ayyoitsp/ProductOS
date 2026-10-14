/**
 * ⛔ AN IMPORT OVERWROTE EVERY DOCUMENT UNCONDITIONALLY, AND IT DESTROYED REAL WORK TWICE.
 *
 * `importFromDisk` was `for (key of files) await store.put(key, …)` with no comparison of any kind.
 * The hosted page is where somebody authors now — dimensions, placements, containment, a reply — and
 * every one of those lands in the STORE. So a routine disk import, run after any local redraw,
 * silently replaced them with whatever the checkout happened to have.
 *
 * It cost a 55KB feature earlier in the day — 52 parts and 68 behaviours that existed only in the
 * store — recovered from a backup. Then it ate the dimensions Peter had just named on the page, and
 * his reply was *"not that important, i can add it back later"*, which is the generous reading of a
 * tool deleting somebody's work without a word.
 *
 * ⛔ WHAT IS PINNED IS THE NARROWNESS, not "it refuses sometimes". A guard that refused whenever the
 * copies differ refuses every import — that is what an import IS — and gets turned off within a day.
 * All three conditions have to matter, so all three are asserted separately:
 *
 *   1. a page-authored document that differs IS kept
 *   2. a document nobody touched on the page is imported, however much it differs
 *   3. a page write that PREDATES the disk file is imported — it was already carried back
 *   4. identical content is imported whoever authored it, because there is nothing to lose
 *
 * ⛔ AND `--anyway` HAS TO WORK, or somebody whose disk copy is genuinely the right one is stuck.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";

const { importFromDisk } = await import("../dist/v2/store/corpus.js");
const { storeFor, isRefusal } = await import("../dist/v2/store/access.js");
const { createProject } = await import("../dist/v2/store/instance.js");
const { accountFor } = await import("../dist/v2/store/identity.js");

/** A store with a project in it, and a corpus on disk. */
async function set_up() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  /** ⛔ `accountFor` returns the id itself, not a row. */
  const account = await accountFor(db, "peter@example.com");
  const id = "prj-keeps-test";
  await createProject(db, { id, owner: account, slug: "bilrost", name: "Bilrost" });
  /** ⛔ `Who` is {kind, account, reach} — an empty reach means every project this account can see. */
  const store = storeFor(db, { kind: "token", account, reach: [] });
  /**
   * ⛔ `project()` RETURNS THE STORE OR A REFUSAL, and `isRefusal` is the predicate that tells them
   * apart — reading a `.refusal` property that does not exist would make an unreachable project
   * look reachable and fail later, somewhere less obvious.
   */
  const reached = await store.project(id);
  assert.ok(!isRefusal(reached), `could not reach the project this test is about: ${JSON.stringify(reached)}`);

  const dir = path.join(temp("v2keep-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return { store: reached, dir };
}

/** Record a page write, exactly as an intent does. */
const authored = (store, wrote, says, at) =>
  store.append("corpus-changed", { kind: "corpus-changed", via: "page", by: "peter", ref: "prototypes", wrote, says, at });

/** A document the page changed and disk does not have. */
const PAGE_VERSION = "splits_on:\n  - id: role\n    label: Role\n    values: [admin, loan processor]\nprototypes: []\n";

test("⛔ a document somebody authored on the page is kept, and named", async () => {
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);

  /** Somebody names the dimensions on the page. The store now holds what disk does not. */
  await store.put("prototypes.yaml", PAGE_VERSION);
  await authored(store, "prototypes.yaml", "prototypes split on Role", new Date().toISOString());
  /** And the disk copy is older — written before that, which is the ordinary case. */
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), "prototypes: []\n");
  fs.utimesSync(path.join(dir, "prototypes.yaml"), new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));

  const { imported, kept } = await importFromDisk(store, dir);
  assert.deepEqual(kept.map((k) => k.key), ["prototypes.yaml"], "the page's work was overwritten");
  assert.ok(!imported.includes("prototypes.yaml"), "it was reported kept and written anyway");
  /** ⛔ The refusal says what it is protecting, or nobody can tell whether to care. */
  assert.match(kept[0].says, /split on Role/);
  assert.equal(kept[0].by, "peter");

  const docs = await store.documents();
  assert.equal(docs["prototypes.yaml"], PAGE_VERSION, "the store no longer holds what the page wrote");
});

test("a document nobody touched on the page is imported, however much it differs", async () => {
  /**
   * ⛔ THE CONDITION THAT KEEPS THE GUARD USABLE. Every import after a redraw differs; refusing on
   * difference alone refuses everything and gets switched off.
   */
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);

  const truth = fs.readdirSync(path.join(dir, "truth")).find((f) => f.endsWith(".md"));
  const key = path.join("truth", truth);
  fs.appendFileSync(path.join(dir, key), "\nSomething the checkout changed.\n");

  const { imported, kept } = await importFromDisk(store, dir);
  assert.deepEqual(kept, [], "an untouched document was withheld");
  assert.ok(imported.includes(key), "a changed document was not imported");
  const docs = await store.documents();
  assert.match(docs[key], /Something the checkout changed/);
});

test("⛔ a page write older than the disk file is imported — it was already carried back", async () => {
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);

  await store.put("prototypes.yaml", PAGE_VERSION);
  /** Authored a while ago… */
  await authored(store, "prototypes.yaml", "prototypes split on Role", new Date(Date.now() - 600_000).toISOString());
  /** …and the disk copy was written since, which is what carrying it back looks like. */
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), PAGE_VERSION.replace("Role", "Seat"));

  const { imported, kept } = await importFromDisk(store, dir);
  assert.deepEqual(kept, [], "a page write the disk copy already supersedes was treated as at risk");
  assert.ok(imported.includes("prototypes.yaml"));
});

test("identical content is imported whoever authored it", async () => {
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);
  await store.put("prototypes.yaml", PAGE_VERSION);
  await authored(store, "prototypes.yaml", "prototypes split on Role", new Date().toISOString());
  /** Disk now says the same thing — there is nothing to lose, so there is nothing to refuse. */
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), PAGE_VERSION);

  const { kept } = await importFromDisk(store, dir);
  assert.deepEqual(kept, [], "a document that already matches was withheld");
});

test("⛔ --anyway overwrites it, for somebody who knows the disk copy is the one they want", async () => {
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);
  await store.put("prototypes.yaml", PAGE_VERSION);
  await authored(store, "prototypes.yaml", "prototypes split on Role", new Date().toISOString());
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), "prototypes: []\n");
  fs.utimesSync(path.join(dir, "prototypes.yaml"), new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));

  const { imported, kept } = await importFromDisk(store, dir, { anyway: true });
  assert.deepEqual(kept, [], "--anyway still withheld it");
  assert.ok(imported.includes("prototypes.yaml"));
  const docs = await store.documents();
  assert.equal(docs["prototypes.yaml"], "prototypes: []\n", "--anyway did not actually overwrite");
});

test("⛔ a write with no `wrote` cannot be mapped to a document, and does not silently protect one", async () => {
  /**
   * `ref` is a PRODUCT reference — a scope, a prototype id — so mapping it to a file would be a
   * guess in the one place a wrong answer deletes work. Events without `wrote` are therefore
   * ignored, which has to be asserted: if they were matched loosely, a note about "prototypes"
   * would freeze `prototypes.yaml` forever and the guard would read as broken.
   */
  const { store, dir } = await set_up();
  await importFromDisk(store, dir);
  await store.put("prototypes.yaml", PAGE_VERSION);
  await store.append("corpus-changed", { kind: "corpus-changed", via: "page", by: "peter", ref: "prototypes", says: "said something about prototypes", at: new Date().toISOString() });
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), "prototypes: []\n");

  const { kept } = await importFromDisk(store, dir);
  assert.deepEqual(kept, [], "an event that names no document froze one anyway");
});
