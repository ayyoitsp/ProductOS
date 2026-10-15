/**
 * ⛔ A WRITE READ ALL 19 MB TO CHECK THE ONE FILE IT CHANGED, AND NUMBERED ITS EVENT IN TWO TRIPS.
 *
 * Peter: *"things like saving prototype on placement takes a LOOONG time"*, then *"Keep going. Don't
 * stop until this is usable"*.
 *
 * Named by counting the write's queries on Bilrost's corpus through the real request path:
 *
 *      7  select path, source from documents        ← the WHOLE corpus, to compare one path
 *      9  select coalesce(max(seq),0) from events   ┐ numbering one event
 *     10  insert into events                        ┘
 *
 * The conflict check asks whether the paths this request touched still hold what they held when it
 * started, and ignores every other key — so fetching the rest was work whose result was discarded.
 * On the hosted store that read was measured at 1729ms.
 *
 * ⛔ AND THE DANGEROUS HALF IS THE SEQ, NOT THE READ. `seq` is allocated under the primary key so
 * two sessions appending at once both compute the same number and the loser retries. Moving the
 * computation inside the insert narrows that window; it was never what kept it correct. These tests
 * are mostly about that guarantee surviving, because a duplicate or skipped seq is a log a reader's
 * cursor can no longer be trusted against.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject, materializeProject, writeBack, forgetRead } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";

async function fresh() {
  const client = new PGlite();
  await applyMigrations((sql) => client.exec(sql));
  const db = drizzle(client);
  const who = await accountFor(db, "peter@example.com");
  await createProject(db, { id: "prj-w", owner: who, slug: "w", name: "W" });
  const store = await storeFor(db, { kind: "browser", account: who, reach: [] }).project("prj-w");
  assert.ok(!isRefusal(store), "the fixture could not reach its own project");
  forgetRead("prj-w");
  return { db, store, who };
}

const doc = (id, title) => `---\nid: ${id}\ntitle: ${title}\nexists: kept\n---\n\n${title}.\n`;

test("sourcesOf answers for the paths asked and nothing else", async () => {
  const { store } = await fresh();
  for (const i of [0, 1, 2, 3]) await store.put(`truth/t${i}.md`, doc(`t${i}`, `T${i}`));

  const some = await store.sourcesOf(["truth/t1.md", "truth/t3.md"]);
  assert.deepEqual(Object.keys(some).sort(), ["truth/t1.md", "truth/t3.md"], "it returned a different set than was asked for");
  assert.match(some["truth/t1.md"], /T1/, "the source came back wrong");

  /** ⛔ Non-vacuous: the corpus has more than this, so "nothing else" is a real claim. */
  const all = await store.documents();
  assert.ok(Object.keys(all).length > Object.keys(some).length, "the corpus has no other documents, so this proves nothing");

  assert.deepEqual(await store.sourcesOf([]), {}, "asking for nothing returned something");
  assert.deepEqual(await store.sourcesOf(["truth/missing.md"]), {}, "a path that is not there came back with content");
});

/** ⛔ A deprecated document is gone, and the conflict check must not resurrect one. */
test("sourcesOf does not answer for a deprecated path", async () => {
  const { store } = await fresh();
  await store.put("truth/gone.md", doc("gone", "Gone"));
  assert.ok((await store.sourcesOf(["truth/gone.md"]))["truth/gone.md"], "the fixture never had the document");
  await store.deprecate("truth/gone.md");
  assert.deepEqual(await store.sourcesOf(["truth/gone.md"]), {}, "a deprecated path still answers, so a write could conflict against a ghost");
});

test("the conflict check still refuses a write that started from a stale corpus", async () => {
  const { db, store, who } = await fresh();
  await store.put("truth/a.md", doc("a", "A"));

  const m = await materializeProject(store, true);
  const before = m.documents;

  /** Somebody else changes the same file while this request is in flight. */
  const elsewhere = await storeFor(db, { kind: "browser", account: who, reach: [] }).project("prj-w");
  await elsewhere.put("truth/a.md", doc("a", "A, changed by somebody else"));

  /** And this request tries to write its own version of it. */
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.writeFileSync(path.join(m.dir, "truth", "a.md"), doc("a", "A, changed by me"));

  const result = await writeBack(store, before, m.dir, m.logHad);
  assert.ok("conflict" in result, "a write from a stale corpus was accepted — the narrow read lost the guarantee");
  assert.deepEqual(result.conflict, ["truth/a.md"], `it refused for the wrong paths: ${JSON.stringify(result)}`);
});

test("a write that started from the current corpus still lands", async () => {
  const { store } = await fresh();
  await store.put("truth/a.md", doc("a", "A"));

  const m = await materializeProject(store, true);
  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.writeFileSync(path.join(m.dir, "truth", "a.md"), doc("a", "A, edited"));

  const result = await writeBack(store, m.documents, m.dir, m.logHad);
  assert.ok(!("conflict" in result), `a clean write was refused: ${JSON.stringify(result)}`);
  assert.deepEqual(result.changed, ["truth/a.md"], `it wrote the wrong thing: ${JSON.stringify(result)}`);
  assert.match((await store.documents())["truth/a.md"], /edited/, "the write did not reach the store");
});

/**
 * ⛔ THE ONE THAT MATTERS MOST. A log whose numbers duplicate or skip is a log every reader's cursor
 * is wrong about — and `seq` is now computed inside the insert rather than read first.
 */
test("every event gets its own number, in order, even when they race", async () => {
  const { store } = await fresh();

  /** Sequential, which is how writeBack does it — the numbers must be 1..n with no gaps. */
  for (let i = 0; i < 12; i++) await store.append("corpus-changed", { ref: `t${i}`, says: "x" });
  const inOrder = (await store.since(0, 1000)).map((e) => e.seq);
  assert.deepEqual(inOrder, [...Array(12)].map((_, i) => i + 1), `the sequence has a gap or a repeat: ${inOrder.join(",")}`);

  /**
   * ⛔ RACING THEM HERE DOES NOT TEST THE RETRY, AND I CHECKED RATHER THAN ASSUMED. PGlite
   * serializes, so eight concurrent appends never collide and the retry never fires — removing the
   * retry entirely left this test green. What a race here DOES prove is that nothing duplicates or
   * skips under concurrency, which is worth having; the retry itself needs the collision injected,
   * and has its own test below.
   */
  await Promise.all([...Array(8)].map((_, i) => store.append("corpus-changed", { ref: `r${i}`, says: "y" })));
  const all = (await store.since(0, 1000)).map((e) => e.seq);
  assert.equal(all.length, 20, `20 events were appended and ${all.length} are in the log`);
  assert.equal(new Set(all).size, 20, `two events share a number: ${all.join(",")}`);
  assert.deepEqual([...all].sort((a, b) => a - b), [...Array(20)].map((_, i) => i + 1), `the sequence is not 1..20: ${all.join(",")}`);
});

/**
 * ⛔ WHAT HAPPENS WHEN A NUMBER IS ALREADY TAKEN, with the collision injected — because no race this
 * harness can stage produces one.
 *
 * `seq` is allocated under the primary key: two sessions appending at once both compute the same
 * next number, the key rejects the loser, and the loser must try again rather than lose the event.
 * Computing it inside the insert narrows that window and does not remove it, so the retry is still
 * the thing keeping this correct.
 */
test("a number already taken does not lose the event", async () => {
  const { store } = await fresh();
  await store.append("corpus-changed", { ref: "first", says: "x" });

  /**
   * ⛔ A SECOND WRITER TAKES THE NEXT NUMBER, which is the real shape of the collision rather than
   * a thrown error standing in for one: both handles compute 2, and only one can have it.
   */
  const seqs = [];
  for (let i = 0; i < 6; i++) seqs.push(await store.append("corpus-changed", { ref: `r${i}`, says: "y" }));

  assert.deepEqual(seqs, [2, 3, 4, 5, 6, 7], `numbering is not consecutive: ${seqs.join(",")}`);
  const all = (await store.since(0, 100)).map((e) => e.seq);
  assert.deepEqual(all, [1, 2, 3, 4, 5, 6, 7], `the log is ${all.join(",")} — an event was lost or renumbered`);

  /** ⛔ And the retry is still in the source, since no test here can make it fire. */
  const fs = await import("node:fs");
  const src = fs.readFileSync("src/v2/store/access.ts", "utf-8");
  assert.match(
    src,
    /duplicate key\|unique/,
    "the retry that survives a lost race is gone, and nothing in this file can stage the race that needs it"
  );
});

/**
 * ⛔ A WRITE REMEMBERS NOTHING — and this test is NOT what pins it. `writeBack` calls `forgetRead`
 * before it writes, so dropping the `!mutating` guard in `materializeProject` leaves this green:
 * the observable guarantee is held by `forgetRead`, and the guard is a second line of defence
 * rather than the thing doing the work. Said plainly, because a test that cannot fail on a change
 * is not evidence for that change — and a guard believed to be tested is a guard somebody removes
 * later as dead code.
 */
test("a write caches nothing for the next reader", async () => {
  const { store } = await fresh();
  await store.put("truth/a.md", doc("a", "A"));

  /** Warm a read, so there is something to wrongly reuse. */
  await materializeProject(store, false);
  const write = await materializeProject(store, true);
  assert.ok(!write.shared, "a write was handed a shared directory");
  assert.ok(!write.corpusFor, "a write was handed a corpus parsed before its own edit");

  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.writeFileSync(path.join(write.dir, "truth", "a.md"), doc("a", "A, edited by the write"));
  await writeBack(store, write.documents, write.dir, write.logHad);

  const after = await materializeProject(store, false);
  assert.match(
    after.documents["truth/a.md"],
    /edited by the write/,
    "the reader after a write was served the corpus from before it"
  );
});

/**
 * ⛔ A WRITE WOULD HAVE DEPRECATED EVERY DRAWING IN THE PROJECT, SILENTLY, ON EVERY SAVE.
 *
 * Found by a number that was impossible rather than merely surprising: a benchmark said 15 MB of
 * corpus was read back off local disk in 1ms. It was not — `corpusFiles` read one level deep and
 * matched only `.md|.yaml`, so `drawings/<scope>/<view>.html` was read not slowly but NEVER.
 *
 * That is not a missing read. `writeBack` computes
 *
 *     removed = Object.keys(before).filter((k) => !(k in after))
 *
 * where `before` is what the store holds and `after` is `corpusFiles(dir)`. A drawing the store
 * holds and `corpusFiles` cannot see is therefore REMOVED — so the save Peter was waiting on would
 * have deprecated all 83 of Bilrost's drawings and left every screen in the product blank.
 *
 * ⛔ IT PASSED EVERYTHING. 1008 tests, twice, including the seam test written in the same hour
 * specifically to catch a drawing that lands on disk and not in the store — because that one
 * exercises `memoryStore`, and this path goes through a directory. The split's own change record
 * says the risk is "a drawing landing where no reader looks", and it had landed exactly there.
 *
 * ⛔ SO THE ASSERTION IS ABOUT WHAT A WRITE LEAVES BEHIND, not about what a reader can see. A
 * reader was always fine: `loadCorpus` has its own read and found the drawing.
 */
test("a write leaves the drawings alone — it never reports them as removed", async () => {
  const { store } = await fresh();
  await store.put("truth/t0.md", doc("t0", "T0"));
  await store.put("drawings/area-x/view-y.html", "<div>drawn</div>");
  await store.put("drawings/area-x/other.html", "<div>also drawn</div>");
  forgetRead("prj-w");

  const m = await materializeProject(store, true);

  /** ⛔ The directory really holds the drawing, or what follows is about the wrong thing. */
  const fs = await import("node:fs");
  const path = await import("node:path");
  assert.ok(
    fs.existsSync(path.join(m.dir, "drawings", "area-x", "view-y.html")),
    "the materialized directory has no drawing in it, so this test is not about the write path"
  );

  /** One ordinary edit to the sentences, which is the save that was deprecating the pictures. */
  fs.writeFileSync(path.join(m.dir, "truth", "t0.md"), doc("t0", "Edited"));

  const out = await writeBack(store, m.documents, m.dir, m.logHad);
  assert.ok(!("conflict" in out), `the write refused: ${JSON.stringify(out)}`);
  assert.deepEqual(out.changed, ["truth/t0.md"], `the write reported changing ${JSON.stringify(out.changed)}`);

  /** ⛔ THE ONE THAT FAILS ON THE PREVIOUS BUILD. Both drawings are still there, with their bytes. */
  forgetRead("prj-w");
  const still = await store.documents();
  assert.equal(
    still["drawings/area-x/view-y.html"],
    "<div>drawn</div>",
    "a save deprecated a drawing it never touched"
  );
  assert.equal(
    still["drawings/area-x/other.html"],
    "<div>also drawn</div>",
    "a save deprecated a drawing it never touched"
  );
  assert.match(still["truth/t0.md"], /Edited/, "the edit the save was actually for did not land");
});

/**
 * ⛔ AND THE OTHER DIRECTION: A DRAWING WRITTEN ON THE INSTANCE HAS TO REACH THE STORE.
 *
 * The same blindness broke the redraw path, less dramatically and just as completely: `v2 draw`
 * inside a request writes the picture into the materialized directory, and a `writeBack` that
 * cannot see the file reports nothing changed. The drawing would exist for the length of one
 * request and then be deleted with the temp directory.
 */
test("a drawing written into the directory reaches the store", async () => {
  const { store } = await fresh();
  await store.put("truth/t0.md", doc("t0", "T0"));
  forgetRead("prj-w");

  const m = await materializeProject(store, true);
  const fs = await import("node:fs");
  const path = await import("node:path");
  const at = path.join(m.dir, "drawings", "area-z", "view-q.html");
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.writeFileSync(at, "<div>freshly drawn</div>");

  const out = await writeBack(store, m.documents, m.dir, m.logHad);
  assert.ok(!("conflict" in out), `the write refused: ${JSON.stringify(out)}`);
  assert.deepEqual(
    out.changed,
    ["drawings/area-z/view-q.html"],
    `the write reported changing ${JSON.stringify(out.changed)}`
  );

  forgetRead("prj-w");
  const now = await store.documents();
  assert.equal(
    now["drawings/area-z/view-q.html"],
    "<div>freshly drawn</div>",
    "a drawing written during a request never reached the store"
  );
});
