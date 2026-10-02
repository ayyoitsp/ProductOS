/**
 * ⛔ THE HALF OF THE LEARNING LOOP THAT NEEDS NO MODEL.
 *
 * Sixty-eight corrections sat in `changes/` with nothing reading them, and the strongest signal in
 * the record was never prose at all — it was arithmetic. `derive` and `check` waived eleven times
 * each against eight for the next; forty-six of seventy changes never closed. Nobody had looked.
 *
 * These pin the shapes it reports and, more importantly, the ones it must NOT report — a noticer
 * that finds a pattern in four records is worse than one that finds nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { noticedIn } from "../dist/core/learn.js";

const change = (id, over = {}) => ({
  id,
  said: `something somebody said about ${id}`,
  at: "2026-10-01",
  kind: "surface",
  reaches: {},
  waived: {},
  ...over,
});

const kinds = (ls) => ls.map((l) => l.kind).sort();

test("nothing is noticed in an empty record", () => {
  assert.deepEqual(noticedIn([]), []);
});

test("⛔ a layer waived twice is not yet a pattern", () => {
  /**
   * The threshold is three. Two is a coincidence with a sample size, and a noticer that reports it
   * teaches people to ignore the output — which costs more than the finding was worth.
   */
  const recs = [
    change("0001", { waived: { check: "a" } }),
    change("0002", { waived: { check: "b" } }),
  ];
  assert.ok(!kinds(noticedIn(recs)).includes("layer-most-waived"));
});

test("a layer waived three times, clear of the next, is reported", () => {
  const recs = [
    change("0001", { waived: { check: "a" } }),
    change("0002", { waived: { check: "b" } }),
    change("0003", { waived: { check: "c" } }),
    change("0004", { waived: { derive: "d" } }),
  ];
  const hit = noticedIn(recs).find((l) => l.kind === "layer-most-waived");
  assert.ok(hit, "three against one is a lead");
  assert.match(hit.what, /`check`/);
  assert.deepEqual(hit.drawn_from, ["0001", "0002", "0003"]);
  assert.match(hit.not, /unfalsifiable/, "the check layer gets the reading that is actually about it");
});

test("⛔ a tie at the top is reported, not cancelled", () => {
  /**
   * This was written the other way first — `top > second` — so two layers level at the top
   * cancelled each other and the finding vanished. On the real record that is exactly what
   * happened: `derive` and `check` both on eleven against eight, the strongest signal there is,
   * printing nothing. A pattern dropped for being doubly true is a silent cap.
   */
  const recs = [
    ...["0001", "0002", "0003"].map((i) => change(i, { waived: { check: "x" + i } })),
    ...["0004", "0005", "0006"].map((i) => change(i, { waived: { derive: "y" + i } })),
    change("0007", { waived: { generate: "z" } }),
  ];
  const hit = noticedIn(recs).find((l) => l.kind === "layer-most-waived");
  assert.ok(hit, "a tie at the top is still a lead over everything else");
  assert.match(hit.what, /`check` and `derive`|`derive` and `check`/);
  assert.match(hit.what, /3 times each, against 1 for the next/);
  assert.equal(hit.drawn_from.length, 6, "every record behind the tie, deduplicated");
});

test("no lead at all where every layer is waived equally", () => {
  /** ⛔ "They are all the same" is not a finding, and dressing it as one is the number that looks like information. */
  const recs = [
    ...["0001", "0002", "0003"].map((i) => change(i, { waived: { check: "x" + i } })),
    ...["0004", "0005", "0006"].map((i) => change(i, { waived: { derive: "y" + i } })),
  ];
  assert.ok(!kinds(noticedIn(recs)).includes("layer-most-waived"));
});

test("⛔ the same argument waiving a layer twice is reported", () => {
  /**
   * A waiver is meant to be a decision somebody could disagree with. One written out verbatim on
   * several changes has stopped being a decision and become a form of words — which belongs in the
   * routing table, so nobody has to make it again.
   */
  const why = "Nothing new is computed, inherited or gated by this.";
  const recs = [
    change("0001", { waived: { derive: why } }),
    change("0002", { waived: { derive: "  nothing NEW is computed,   inherited or gated by this.  " } }),
    change("0003", { waived: { derive: "a different argument entirely" } }),
  ];
  const hit = noticedIn(recs).find((l) => l.kind === "waiver-argued-twice");
  assert.ok(hit, "⛔ matched after squashing case and spacing — the same argument in different wrapping is the same argument");
  assert.deepEqual(hit.drawn_from, ["0001", "0002"]);
});

test("the same reason waiving two DIFFERENT layers is not one argument", () => {
  const why = "this does not apply here";
  const recs = [change("0001", { waived: { derive: why } }), change("0002", { waived: { check: why } })];
  assert.ok(!kinds(noticedIn(recs)).includes("waiver-argued-twice"));
});

test("a majority left open is reported; a minority is not", () => {
  const open = (n) => Array.from({ length: n }, (_, i) => change(`o${i}`));
  const shut = (n) => Array.from({ length: n }, (_, i) => change(`c${i}`, { closed: "2026-10-01" }));
  assert.ok(kinds(noticedIn([...open(6), ...shut(4)])).includes("cascade-left-open"));
  assert.ok(!kinds(noticedIn([...open(4), ...shut(6)])).includes("cascade-left-open"));
});

test("⛔ every finding carries the records it was drawn from, and what it does not mean", () => {
  /**
   * A pattern you cannot go and look at is a number that looks like information; and every one of
   * these has a reading that is wrong and convenient — "46 open" as a backlog to burn down rather
   * than a question about whether `close` is reachable.
   */
  const recs = [
    ...["0001", "0002", "0003"].map((i) => change(i, { waived: { check: "x" + i }, reaches: { surface: "a", pin: "b" } })),
    ...["0004", "0005", "0006", "0007", "0008"].map((i) => change(i, { reaches: { surface: "s" + i, pin: "p" + i } })),
  ];
  const found = noticedIn(recs);
  assert.ok(found.length);
  for (const l of found) {
    assert.ok(l.drawn_from.length, `${l.kind} cites nothing`);
    assert.match(l.not, /^⛔/, `${l.kind} does not say what it is not`);
  }
});
