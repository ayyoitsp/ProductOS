/**
 * ⛔ THE QUEUE IS ORDERED BY HOW MUCH A PERSON'S ANSWER IS WORTH, AND IT WAS NOT ORDERED AT ALL.
 *
 * Peter: *"still too much review surface."* Part of that is how many questions there are, and part
 * is that `questionsFor` returned them in corpus order — so a statement four independent sources
 * already agree about competed for attention equally with one that nothing supports. Both are open;
 * they are not equally worth somebody's time.
 *
 * ⛔ AN ORDER, NEVER A FILTER. Nothing is hidden on the strength of inference. A scale that decided
 * what a person is allowed to be asked would be the scale answering questions, which is the one
 * thing it may never do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { loadCorpus } = await import("../dist/v2/load.js");
const { questionsFor, orderByAttention } = await import("../dist/v2/settle.js");
const { confidenceOf } = await import("../dist/v2/confidence.js");

const seeded = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2queue-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return { dir, corpus: loadCorpus(dir) };
};
const withReadings = (corpus, readings) => ({ ...corpus, readings: [...corpus.readings, ...readings] });
const reading = (id, bears_on, ref) => ({
  id,
  bears_on,
  observes: `something observed for ${id}, long enough to clear the floor`,
  basis: { kind: "code", ref },
});

test("the seed has questions to order at all", () => {
  const { corpus } = seeded();
  const qs = questionsFor(corpus, "money");
  assert.ok(qs.length >= 2, `only ${qs.length} questions in the seed's money scope — this test proves nothing`);
});

test("least-supported is asked first, best-supported last", () => {
  const { corpus: base } = seeded();
  const qs = questionsFor(base, "money");
  const target = qs[0].ref;

  /** Give the FIRST question three independent sources — it should fall to the back. */
  const loaded = withReadings(base, [
    reading("a", target, "src/one.ts:1"),
    reading("b", target, "src/two.ts:2"),
    reading("c", target, "src/three.ts:3"),
  ]);
  assert.equal(confidenceOf(loaded, target).strength, "strongly-supported");

  const reordered = questionsFor(loaded, "money");
  assert.equal(reordered.length, qs.length, "ordering changed how many questions there are — it is filtering");
  assert.equal(reordered[reordered.length - 1].ref, target, "a strongly-supported question is still being asked first");
  assert.equal(reordered[0].ref !== target, true);

  /** ⛔ AND NOTHING WAS DROPPED. Every ref present before is present after. */
  assert.deepEqual([...reordered.map((q) => q.ref)].sort(), [...qs.map((q) => q.ref)].sort());
});

test("⛔ the order is stable, so two runs agree", () => {
  /**
   * An unstable queue makes "have I seen this one" unanswerable, and a reviewer who cannot trust the
   * order stops reading the list — which is the failure `defer` exists to prevent, arriving through
   * the sort instead.
   */
  const { corpus } = seeded();
  const once = questionsFor(corpus, "money").map((q) => q.ref);
  const twice = questionsFor(corpus, "money").map((q) => q.ref);
  assert.deepEqual(once, twice);

  /** Ties keep their original order rather than being shuffled by the comparator. */
  const qs = questionsFor(corpus, "money");
  const allNone = qs.every((q) => confidenceOf(corpus, q.ref).strength === "none");
  if (allNone) assert.deepEqual(orderByAttention(corpus, qs).map((q) => q.ref), qs.map((q) => q.ref));
});

test("ordering is by support, not by whether anybody confirmed it", () => {
  /**
   * ⛔ A CONFIRMED THING IS NOT A QUESTION, so confirmation has no business in this comparator — and
   * if it crept in, the queue would start sorting by consent and quietly become a progress bar.
   * What it sorts by is how much evidence an answer would be added to.
   */
  const { corpus: base } = seeded();
  const qs = questionsFor(base, "money");
  const ranked = orderByAttention(base, qs);
  const strengths = ranked.map((q) => confidenceOf(base, q.ref).strength);
  const rank = { none: 0, "one-source": 1, corroborated: 2, "strongly-supported": 3 };
  for (let i = 1; i < strengths.length; i++)
    assert.ok(rank[strengths[i]] >= rank[strengths[i - 1]], `out of order at ${i}: ${strengths.join(" → ")}`);
});
