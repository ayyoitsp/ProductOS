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
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject, materializeProject, forgetRead, forgetDir, readsInFlight } from "../dist/v2/store/instance.js";
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
  /**
   * ⛔ THE TWO HALVES ARE COUNTED SEPARATELY, BECAUSE THAT IS NOW THE WHOLE QUESTION.
   *
   * Peter: *"why can't we just not re-read the images?"*. A drawing is its own document, so a
   * corpus read is two reads — the sentences and the pictures — and each is reused on its own
   * fingerprint. Counting them together would have left every assertion below still passing while
   * a save re-read 14.8 MB of pictures it could not have changed.
   *
   * `documents` stays counted because nothing on a request path may call it any more: it reads the
   * whole corpus in one go, which is the cost this file exists to have removed.
   */
  const calls = { truth: 0, drawings: 0, documents: 0, since: 0, listening: 0, fingerprint: 0 };
  return {
    calls,
    store: {
      ...store,
      documents: (...a) => (calls.documents++, store.documents(...a)),
      documentsOutside: (...a) => (calls.truth++, store.documentsOutside(...a)),
      documentsUnder: (...a) => (calls.drawings++, store.documentsUnder(...a)),
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
  assert.equal(calls.truth, 1, "the first request did not read the documents");
  assert.equal(calls.drawings, 1, "the first request did not read the drawings");
  assert.equal(calls.documents, 0, "something on the request path read the whole corpus in one go");
  /** ⛔ Non-vacuous: it has to have actually produced a corpus, or "no second read" means nothing. */
  assert.equal(Object.keys(first.documents).length, 6, `the first read produced ${Object.keys(first.documents).length} documents`);

  const second = await materializeProject(counted);
  assert.equal(calls.truth, 1, "the second request read all the documents again");
  assert.equal(calls.drawings, 1, "the second request read all the drawings again");
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
  const readsAfterWarm = calls.truth;

  /** ⛔ Through a DIFFERENT store handle, so nothing in-process could have invalidated anything —
   *  this is the fingerprint doing the work and not `forgetRead`. */
  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.put("truth/thing-0.md", `---\nid: thing-0\ntitle: Renamed\nexists: kept\n---\n\nChanged.\n`);

  const after = await materializeProject(counted);
  assert.equal(calls.truth, readsAfterWarm + 1, "a write did not invalidate the cached read");
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
  assert.equal(calls.truth, 1, "the documents were read more than once, so this test is not about the cache");
});

/** ⛔ And the fingerprint is paid once per request — it is the thing that replaced the 19 MB. */
test("the cheap read happens every request and the expensive one does not", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted, calls } = counting(store);

  for (let i = 0; i < 4; i++) await materializeProject(counted);

  assert.equal(calls.fingerprint, 4, `the fingerprint was read ${calls.fingerprint} times for four requests`);
  assert.equal(calls.truth, 1, `the documents were read ${calls.truth} times for four requests`);
  assert.equal(calls.drawings, 1, `the drawings were read ${calls.drawings} times for four requests`);
});

/**
 * ⛔ THIS TEST USED TO SAY "EACH REQUEST STILL GETS ITS OWN DIRECTORY", AND IT CAUGHT ME.
 *
 * It went red when the materialized directory started being reused, which is exactly what it was
 * written for. But it was asserting the IMPLEMENTATION rather than the reason: the reason a request
 * needs its own directory is that `writeBack` diffs the files on disk against what the request was
 * given, so a request that WRITES must not share one. A read has nothing to diff.
 *
 * So the guarantee is narrower than the old assertion and not weaker:
 *
 *   · a mutating request gets its own directory — unchanged, and still the thing that matters
 *   · a non-mutating request may be handed a pristine shared one
 *   · a shared directory that turns out NOT to be pristine is thrown away rather than trusted
 *
 * ⛔ REWRITTEN RATHER THAN DELETED, AND THAT DISTINCTION IS THE WHOLE POINT. Loosening a test
 * because the code changed is how a guarantee disappears quietly. What follows asserts more than
 * the old one did, not less — the old test could not tell a writer from a reader at all.
 *
 * Why it is worth the risk: every request wrote 169 documents to disk, read them back, parsed them
 * and deleted them. Profiled across 18 requests on Bilrost's corpus that floor was ~1.0s of writes,
 * ~1.6s of reads and ~2.9s of YAML, and a 35-byte presence answer — which the page POLLS — paid all
 * of it. 1062ms to 49ms.
 */
test("a writer gets its own directory; a reader may share a pristine one", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted } = counting(store);

  const readA = await materializeProject(counted, false);
  const readB = await materializeProject(counted, false);
  assert.equal(readA.dir, readB.dir, "two reads laid out the corpus twice — the directory is not being reused");
  assert.equal(readA.shared, true, "a read's directory is not marked shared, so the teardown will delete it");

  /** ⛔ THE ONE THAT MATTERS. A writer sharing a directory has its writes read as somebody else's. */
  const write = await materializeProject(counted, true);
  assert.notEqual(write.dir, readA.dir, "a MUTATING request was handed the shared directory");
  assert.ok(!write.shared, "a mutating request's directory is marked shared, so it would outlive the write");
});

test("a shared directory really holds the corpus, and the log position is right either way", async () => {
  const { store } = await freshStore();
  await seed(store);
  /**
   * ⛔ EVENTS FIRST, OR THE LOG ASSERTION BELOW IS VACUOUS — and it was. With an empty log both
   * paths report position 0, so `second.logHad === first.logHad` passed even when the reused path
   * returned a hardcoded 0. Verified by breaking it and watching this test stay green, which is the
   * same shape of mistake as a count that agrees with the hypothesis.
   */
  for (let i = 0; i < 3; i++) await store.append("corpus-changed", { ref: `thing-${i}`, says: "something" });
  forgetRead(store.projectId);
  const { store: counted } = counting(store);

  const first = await materializeProject(counted, false);
  const second = await materializeProject(counted, false);

  for (const m of [first, second]) {
    const files = corpusFiles(m.dir);
    assert.ok(Object.keys(files).length >= 6, `a materialized directory holds ${Object.keys(files).length} files`);
  }
  /**
   * ⛔ `logHad` IS A POSITION, NOT A COUNT OF WORK DONE. `appendedLines` slices the log from it to
   * find what the request appended, and the reused path counts the lines instead of writing them —
   * so if those two disagreed, a request's own appends would be missed or duplicated.
   */
  assert.ok(first.logHad >= 3, `the fixture's log is ${first.logHad} lines, so this comparison proves nothing`);
  assert.equal(second.logHad, first.logHad, "the reused directory reports a different log position than the one that wrote it");
});

test("a reader that dirties the shared directory stops it being shared", async () => {
  const { store } = await freshStore();
  await seed(store);
  const { store: counted } = counting(store);

  const m = await materializeProject(counted, false);
  /** Something writes into it, which a read is not supposed to do — the case that must not be trusted. */
  fs.writeFileSync(path.join(m.dir, "truth", "thing-0.md"), "---\nid: thing-0\ntitle: Tampered\nexists: kept\n---\n");
  forgetDir(store.projectId);

  const after = await materializeProject(counted, false);
  assert.notEqual(after.dir, m.dir, "a dirtied directory was handed to the next reader");
  assert.match(
    corpusFiles(after.dir)["truth/thing-0.md"] ?? "",
    /Thing 0/,
    "the fresh directory carries the tampered file, so it was not laid out again from the store"
  );
});

/**
 * ⛔ A SAVE RE-READS THE SENTENCES AND KEEPS THE PICTURES, WHICH IS THE THING PETER ASKED FOR.
 *
 * Peter: *"uh, you mean move it to a blob? or why can't we just not re-read the images?"* — and
 * then *"let's do both - ne wrow for images, and don't re-read images"*. On Bilrost the drawings
 * are 14.8 MB of a 17.5 MB corpus, so a one-line edit to a screen's words was pulling all of it
 * back across the wire for nothing.
 *
 * ⛔ THE ASSERTION THAT CANNOT PASS BY ACCIDENT IS THE DRAWINGS ONE. "The truth was re-read" is
 * what the old whole-corpus cache already did; "the drawings were NOT re-read" is the new fact,
 * and it fails on the previous build. Verified by pointing both halves at the same fingerprint
 * and watching this go red.
 *
 * ⛔ AND IT CHECKS THE OTHER DIRECTION TOO. A cache that keeps the pictures must still notice a
 * picture changing, or a redraw is invisible on the one surface anybody reviews on — which is a
 * strictly worse bug than the cost it was removing.
 */
test("writing a sentence re-reads the sentences and keeps the pictures", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  await store.put("drawings/area-x/view-y.html", "<div>drawn</div>");
  forgetRead(store.projectId);
  const { store: counted, calls } = counting(store);

  const warm = await materializeProject(counted);
  assert.equal(calls.truth, 1, "the warm-up did not read the sentences");
  assert.equal(calls.drawings, 1, "the warm-up did not read the drawings");
  assert.equal(
    warm.documents["drawings/area-x/view-y.html"],
    "<div>drawn</div>",
    "the two halves were not merged back into one corpus"
  );

  /** ⛔ A different handle, so this is the fingerprint and not an in-process invalidation. */
  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.put("truth/thing-0.md", `---\nid: thing-0\ntitle: Edited\nexists: kept\n---\n\nEdited.\n`);

  const after = await materializeProject(counted);
  assert.equal(calls.truth, 2, "a write to the sentences did not re-read the sentences");
  assert.equal(calls.drawings, 1, `the drawings were read ${calls.drawings} times — a sentence edit re-read the pictures`);
  assert.match(after.documents["truth/thing-0.md"], /Edited/, "the request was served the corpus from before the write");
  assert.equal(
    after.documents["drawings/area-x/view-y.html"],
    "<div>drawn</div>",
    "the kept drawing did not survive into the corpus the next request got"
  );

  /** ⛔ The other direction: a redraw must still be seen, or keeping them is worse than re-reading. */
  await elsewhere.put("drawings/area-x/view-y.html", "<div>redrawn</div>");
  const redrawn = await materializeProject(counted);
  assert.equal(calls.drawings, 2, "a redraw did not invalidate the kept drawings");
  assert.equal(
    redrawn.documents["drawings/area-x/view-y.html"],
    "<div>redrawn</div>",
    "a redrawn screen was served from the cache as its old picture"
  );
  /** ⛔ And a redraw does not drag the sentences back with it. */
  assert.equal(calls.truth, 2, `the sentences were read ${calls.truth} times — a redraw re-read them`);
});

/**
 * ⛔ A SAVE SETS OFF A HERD, AND EACH OF THEM WAS READING THE WHOLE CORPUS.
 *
 * `writeBack` calls `forgetRead`, and then the page, the presence poll, the live connection, the
 * thread and the mocks all arrive within a few hundred milliseconds. Read off the live instance:
 *
 *     GET …/api/v2/presence 200 35b  4734ms db=6q corpus=read dir=laid-out
 *     GET …/v2             200 2977164b  9124ms db=6q corpus=read dir=laid-out
 *     GET …/api/v2/presence 200 35b 12131ms db=6q corpus=read dir=laid-out
 *     GET …/api/v2/presence 200 35b 20932ms db=6q corpus=read dir=laid-out
 *
 * ⛔ THE CLIMBING NUMBERS ARE THE TELL, and they are why "it is slow" was the wrong diagnosis. One
 * cost repeated looks like one number repeated. 4s, 6s, 12s, 21s for a 35-byte answer is requests
 * queuing behind each other's reads — measured as six-for-six by `scripts/probe-stampede.mjs`.
 */
test("several requests arriving after a save share one read", async () => {
  const { store } = await freshStore();
  await seed(store);
  await store.put("drawings/area-x/view-y.html", "<div>drawn</div>");
  forgetRead(store.projectId);
  const { store: counted, calls } = counting(store);

  await materializeProject(counted);
  assert.equal(calls.truth, 1, "the warm-up did not read");

  /** ⛔ The real case: the cache has just been dropped, so every one of them HAS to read. */
  forgetRead(store.projectId);
  const together = await Promise.all(Array.from({ length: 6 }, () => materializeProject(counted)));

  assert.equal(calls.truth, 2, `six requests after a save read the sentences ${calls.truth - 1} times over`);
  assert.equal(calls.drawings, 2, `six requests after a save read the drawings ${calls.drawings - 1} times over`);
  assert.equal(calls.since, 2, `six requests after a save read the log ${calls.since - 1} times over`);

  /** ⛔ Non-vacuous: all six have to have actually been given the corpus, not an empty one. */
  for (const m of together) {
    assert.equal(Object.keys(m.documents).length, 7, `one of the six got ${Object.keys(m.documents).length} documents`);
    assert.equal(m.documents["drawings/area-x/view-y.html"], "<div>drawn</div>", "one of the six got no drawing");
  }

  /** ⛔ And nothing is left behind — a map that only grows is a leak with a nice name. */
  assert.equal(readsInFlight(), 0, `${readsInFlight()} reads are still recorded as in flight after all of them finished`);
});

/**
 * ⛔ A FAILED READ IS NOT SHARED WITH WHOEVER COMES NEXT, which is the hazard of holding a promise
 * rather than a value. A rejected read left in the map would be handed to every later request for
 * that corpus — one network blip turning into a project that is permanently down.
 */
test("a read that fails is not handed to the next request", async () => {
  const { store } = await freshStore();
  await seed(store);
  forgetRead(store.projectId);

  let fail = true;
  let tries = 0;
  const brittle = {
    ...store,
    documentsOutside: (...a) => {
      tries++;
      return fail ? Promise.reject(new Error("the network went away")) : store.documentsOutside(...a);
    },
  };

  await assert.rejects(() => materializeProject(brittle), /the network went away/, "a failing read did not reach the caller");

  /**
   * ⛔ SETTLED-TO-ZERO, NOT ZERO-RIGHT-NOW — and asserting the latter caught my own wrong model.
   *
   * `Promise.all` rejects the instant the first read fails, while the other two are still on the
   * wire. So two reads are legitimately in flight at the moment the caller hears about the failure,
   * and reading the count there measures the race rather than the drop. What the map must not do is
   * KEEP them, so this waits for it with a bound and fails if it never empties.
   */
  const emptied = await (async () => {
    for (let i = 0; i < 100; i++) {
      if (readsInFlight() === 0) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return false;
  })();
  assert.ok(emptied, `${readsInFlight()} reads are still recorded as in flight two seconds after they settled`);

  /** ⛔ THE ONE THAT MATTERS: the next request reads for itself rather than being given the failure. */
  fail = false;
  const after = await materializeProject(brittle);
  assert.equal(tries, 2, `the second request did not read again — it was handed the first one's failure (${tries} attempts)`);
  assert.equal(Object.keys(after.documents).length, 6, "the request that recovered was given no corpus");
});

/**
 * ⛔ AND TWO REQUESTS ABOUT DIFFERENT CORPORA NEVER SHARE, which is the whole reason the key carries
 * the fingerprint. Sharing by project alone would hand a request that arrived after a second write
 * the read taken before it — a cache that serves stale truth, built out of something that is not
 * supposed to be a cache at all.
 */
test("a request that arrives after a further write reads for itself", async () => {
  const { db, store, reach } = await freshStore();
  await seed(store);
  forgetRead(store.projectId);
  const { store: counted, calls } = counting(store);

  await materializeProject(counted);
  const elsewhere = await elsewhereIn(db, reach);
  await elsewhere.put("truth/thing-0.md", `---\nid: thing-0\ntitle: One\nexists: kept\n---\n\nOne.\n`);
  const first = await materializeProject(counted);
  const readsAfterFirst = calls.truth;

  await elsewhere.put("truth/thing-0.md", `---\nid: thing-0\ntitle: Two\nexists: kept\n---\n\nTwo.\n`);
  const second = await materializeProject(counted);

  assert.equal(calls.truth, readsAfterFirst + 1, "the second write did not cause a read of its own");
  assert.match(first.documents["truth/thing-0.md"], /One/, "the first request saw the wrong corpus");
  assert.match(second.documents["truth/thing-0.md"], /Two/, "a request after a second write was served the corpus from before it");
});
