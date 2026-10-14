/**
 * ⛔ EVERY PAGE VIEW READ 19 MB OUT OF THE DATABASE TO RENDER ONE SECTION.
 *
 * Peter: *"this is yours to fix, why are you abdicating?"* — after I had located the cost and handed
 * it to somebody else.
 *
 * Measured on the instance by the deploy session: `documents()` is **1729ms for 169 rows, 19.15 MB
 * deserialized**, on every request including a GET. Two page views a second apart read the same
 * 19 MB twice and the second learned nothing the first had not.
 *
 * ⛔ AND IT IS THE ONLY REAL COST IN THAT PATH, which took refuting two of my own theories to
 * establish. I suspected `since(0, LOG_CEILING)` — the log is 233 events, so it costs 231ms and
 * would have to grow 150x to matter. Then I suspected a second `documents()` read inside
 * `writeBack` — it already returns before that read when nothing changed. Both wrong, and found so
 * by looking. What is left is one 19 MB read, and ~38s of the 40.8s TTFB was CPU starvation on a
 * machine running 24 test processes on 12 cores.
 *
 * ⛔ SO THE TEST THAT MATTERS IS NOT "IT IS FASTER". It is that a cached read is never a STALE read:
 * the fingerprint has to catch a write, a deprecation and an appended event, and presence must
 * never be cached at all. A cache that serves old truth on a review surface is worse than the 19 MB.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject, materializeProject, forgetRead } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";
import { corpusFiles } from "../dist/v2/load.js";

/**
 * A real Postgres, because the fingerprint is SQL — an in-memory stand-in would not run the query
 * this whole change turns on.
 *
 * ⛔ `applyMigrations` TAKES A RUNNER, NOT THE DRIZZLE HANDLE. The first version of this fixture
 * passed `db` and every test failed with "run is not a function" — my fixture, not the code, and
 * the existing store test already had it right.
 */
async function freshStore() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));

  const who = await accountFor(db, "peter@example.com");
  await createProject(db, { id: "prj-measured", owner: who, slug: "measured", name: "Measured" });
  const reach = { kind: "browser", account: who, reach: [] };
  const store = await storeFor(db, reach).project("prj-measured");
  assert.ok(!isRefusal(store), "the fixture could not reach its own project");
  forgetRead("prj-measured");
  return { db, store, reach, project: { id: "prj-measured" } };
}

/** A second handle on the same project, for writes that must be seen by fingerprint alone. */
async function elsewhereIn(db, reach) {
  const other = await storeFor(db, reach).project("prj-measured");
  assert.ok(!isRefusal(other), "could not open a second handle on the project");
  return other;
}

/** Enough documents that a read is a read, written through the store's own path. */
async function seed(store, n = 6) {
  for (let i = 0; i < n; i++) {
    await store.put(
      `truth/thing-${i}.md`,
      `---\nid: thing-${i}\ntitle: Thing ${i}\nexists: kept\n---\n\nThing ${i}.\n`
    );
  }
  forgetRead(store.projectId);
}

/**
 * How many times the store was actually read, by wrapping the one method that costs 1729ms.
 *
 * ⛔ COUNTED, NOT TIMED. A timing assertion on this machine is worthless — the measurement that
 * started all of this varied 2.7x between consecutive identical requests at load 200. Whether the
 * read HAPPENED is a fact about the code; how long it took is a fact about the afternoon.
 */
function counting(store) {
  const calls = { documents: 0, since: 0, listening: 0, fingerprint: 0 };
  return {
    calls,
    store: {
      ...store,
      documents: (...a) => (calls.documents++, store.documents(...a)),
      since: (...a) => (calls.since++, store.since(...a)),
      listening: (...a) => (calls.listening++, store.listening(...a)),
      fingerprint: (...a) => (calls.fingerprint++, store.fingerprint(...a)),
    },
  };
}

test("the first read reads, and reading again does not", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);

  const first = await materializeProject(counted);
  assert.equal(calls.documents, 1, "the first request did not read the documents");
  /** ⛔ Non-vacuous: it has to have actually produced a corpus, or "no second read" means nothing. */
  assert.equal(Object.keys(first.documents).length, 6, `the first read produced ${Object.keys(first.documents).length} documents`);

  const second = await materializeProject(counted);
  assert.equal(calls.documents, 1, "the second request read all the documents again");
  assert.equal(calls.since, 1, "the second request read the whole event log again");
  assert.deepEqual(second.documents, first.documents, "the second request was handed a different corpus");
});

/**
 * ⛔ THE ONE THAT DECIDES WHETHER THIS IS SAFE. A cache that misses a write serves a reviewer truth
 * that is no longer there, which is the single thing this surface may not do.
 */
test("a write is seen immediately, by fingerprint alone", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);

  await materializeProject(counted);
  const readsAfterWarm = calls.documents;

  /** ⛔ Through a DIFFERENT store handle, so nothing in-process could have invalidated anything —
   *  this is the fingerprint doing the work and not `forgetRead`. */
  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.put("truth/thing-0.md", `---\nid: thing-0\ntitle: Renamed\nexists: kept\n---\n\nChanged.\n`);

  const after = await materializeProject(counted);
  assert.equal(calls.documents, readsAfterWarm + 1, "a write did not invalidate the cached read");
  assert.match(after.documents["truth/thing-0.md"], /Renamed/, "the request was served the corpus from before the write");
});

test("a new document is seen immediately", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  const { store: counted } = counting(store);
  await materializeProject(counted);

  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.put("truth/added.md", `---\nid: added\ntitle: Added\nexists: kept\n---\n\nNew.\n`);

  const after = await materializeProject(counted);
  assert.ok("truth/added.md" in after.documents, "a document added elsewhere is not in the corpus the next request got");
});

/**
 * ⛔ DEPRECATION CHANGES WHAT A CORPUS CONTAINS WITHOUT CHANGING `max(updated_at)` ON ITS OWN, which
 * is why the fingerprint carries `max(deprecated_at)` too. Without that this test serves a document
 * that is gone.
 */
test("a deprecated document disappears immediately", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  const { store: counted } = counting(store);
  const before = await materializeProject(counted);
  assert.ok("truth/thing-3.md" in before.documents, "the fixture never had the document it is about to deprecate");

  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.deprecate("truth/thing-3.md");

  const after = await materializeProject(counted);
  assert.ok(
    !("truth/thing-3.md" in after.documents),
    "a deprecated document was still served, so the fingerprint does not notice a deprecation"
  );
});

/** ⛔ And an appended event, because the log is materialized beside the corpus and read by routes. */
test("an appended event is seen immediately", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);
  const first = await materializeProject(counted);
  const had = first.logHad;

  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.append("corpus-changed", { ref: "thing-1", says: "something happened" });

  const after = await materializeProject(counted);
  assert.ok(after.logHad > had, `the log was ${had} lines and is still ${after.logHad} — an appended event did not invalidate the read`);
  assert.ok(calls.since >= 2, "the log was never re-read after an event was appended");
});

/**
 * ⛔ PRESENCE IS NEVER CACHED, and this is the test for it. It changes without the corpus changing,
 * so caching it would answer "nobody is listening" to a page with somebody on it — the same lie
 * `saw`/`listening` exist on the store to prevent.
 */
test("who is listening is asked every time", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);

  await materializeProject(counted);
  await materializeProject(counted);
  await materializeProject(counted);

  assert.equal(calls.listening, 3, `presence was read ${calls.listening} times across three requests`);
  assert.equal(calls.documents, 1, "the documents were read more than once, so this test is not about the cache");
});

/** ⛔ And the fingerprint is paid once per request — it is the thing that replaced the 19 MB. */
test("the cheap read happens every request and the expensive one does not", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);

  for (let i = 0; i < 4; i++) await materializeProject(counted);

  assert.equal(calls.fingerprint, 4, `the fingerprint was read ${calls.fingerprint} times for four requests`);
  assert.equal(calls.documents, 1, `the documents were read ${calls.documents} times for four requests`);
});

/** The materialized directory is still per request, so two requests cannot share mutable state. */
test("each request still gets its own directory", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted } = counting(store);

  const a = await materializeProject(counted);
  const b = await materializeProject(counted);
  assert.notEqual(a.dir, b.dir, "two requests were handed the same directory — writeBack diffs files in it");

  /** ⛔ And both directories really hold the corpus, not just a path. */
  for (const m of [a, b]) {
    const files = corpusFiles(m.dir);
    assert.ok(Object.keys(files).length >= 6, `a materialized directory holds ${Object.keys(files).length} files`);
  }
});
