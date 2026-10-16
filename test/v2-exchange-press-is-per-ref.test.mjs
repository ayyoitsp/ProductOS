/**
 * ⛔ THE EXCHANGE BUTTON IS A BULK PRESS, AND WHAT IT WRITES IS ONE ORDINARY ACCEPTANCE PER
 * SENTENCE.
 *
 * Peter: *"two ways to 'accept truths' by a human. by UX - there should be a button at the exchange
 * level and at the per-ref level. this flows straightforward into what is accepted."* Then, asked
 * whether the exchange-level press is its own kind of record: *"so acceptance is def at a per-ref
 * level."*
 *
 * What it cost to have only the exchange record: a coding agent asks "can I build this?" one
 * sentence at a time, because a sentence is what it implements. Pressing accept on the two
 * exchanges the seed offers left all fifteen sentences beneath them reading `never` — work a person
 * genuinely reviewed, reported as unreviewed by the only consumer that matters downstream.
 *
 * ⛔ THE REJECTED DESIGN IS WHAT THE LAST TEST HERE PINS: one exchange record that stampFor walks
 * UP to, so a slot reads accepted "through" its exchange. A verdict carries one pair of hashes, so
 * that answer can only ever be all-or-nothing — reword one sentence and either seven untouched ones
 * lose their agreement, or the reword silently inherits an agreement nobody gave it. The second is
 * the worst failure available in this model.
 *
 * ⛔ THREE OUTCOMES HAVE TO BE DISTINGUISHABLE, which is why every test below asserts the third:
 * accepted on its own, accepted by the press on its exchange, and not accepted at all. A zero
 * proves nothing unless a failing zero looks different.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { perform } from "../dist/v2/acts.js";
import { loadCorpus } from "../dist/v2/load.js";
import { stampFor, coveredBy } from "../dist/v2/stamp.js";
import { sentencesIn, actsFor } from "../dist/v2/grid.js";

const PRESSED = "money#see-a-balance";
/** ⛔ A second exchange nobody presses, so "accepted" is shown to be a fact about this press. */
const UNPRESSED = "money#apply-a-standing-allowance";
const by = { by: "alice", via: "page" };

function seed() {
  const dir = temp("v2xp-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const acceptsOf = (dir, ref) =>
  loadCorpus(dir).verdicts.filter((v) => v.kind === "accept" && v.target === ref);

test("one press on an exchange writes one acceptance per sentence beneath it", () => {
  const dir = seed();
  const before = sentencesIn(loadCorpus(dir), PRESSED);
  assert.ok(before.length > 3, `the fixture has nothing beneath it: ${before.join(", ")}`);
  /** ⛔ The failing zero: every one of them reads `never` before the press. */
  for (const ref of before)
    assert.equal(stampFor(loadCorpus(dir), ref).state, "never", `${ref} was already agreed before anybody pressed`);

  const r = perform(dir, "accept", { target: PRESSED }, by);
  assert.ok(r.ok, `refused: ${r.why}`);

  const corpus = loadCorpus(dir);
  for (const ref of before) {
    const st = stampFor(corpus, ref);
    assert.equal(st.state, "accepted", `${ref} still reads ${st.state} after its exchange was agreed`);
    assert.equal(st.by, "alice");
    /**
     * ⛔ A VERDICT NAMING THIS SENTENCE, not a stamp derived from the exchange's. `through` is how a
     * confirmed RULE reaches a slot it supplies; an exchange has no such reach, and if this ever
     * reports one it means `stampFor` started walking upward.
     */
    assert.equal(st.through, undefined, `${ref} is accepted by reach rather than by a record of its own`);
    assert.equal(acceptsOf(dir, ref).length, 1, `${ref} has no acceptance of its own`);
  }
  /** ⛔ The exchange's own record is still there — it covers the envelope, which no slot covers. */
  assert.equal(stampFor(corpus, PRESSED).state, "accepted");
  /** ⛔ And the press reached nothing in a neighbouring exchange. */
  for (const ref of sentencesIn(corpus, UNPRESSED))
    assert.equal(stampFor(corpus, ref).state, "never", `${ref} was agreed by a press on a different exchange`);
});

/**
 * ⛔ WHAT A PERSON ACTUALLY DID, ON EACH RECORD.
 *
 * One press now writes eight acceptances, and `at` is a date — so without this a reader a year
 * later cannot tell whether somebody read eight sentences or clicked one button. It is NOT a weaker
 * acceptance and no gate reads it; it is the difference in attention, recorded where the agreement
 * is.
 */
test("a sentence agreed on its own is distinguishable from one agreed by the press on its exchange", () => {
  const dir = seed();
  const [one, two] = sentencesIn(loadCorpus(dir), PRESSED);

  assert.ok(perform(dir, "accept", { target: one }, by).ok, "the per-ref button refused");
  const direct = acceptsOf(dir, one)[0];
  assert.equal(direct.note, undefined, "a sentence somebody read on its own claims to have come from a bulk press");

  assert.ok(perform(dir, "accept", { target: PRESSED }, by).ok, "the exchange button refused");
  const bulk = acceptsOf(dir, two)[0];
  assert.match(bulk.note ?? "", /one press on money#see-a-balance/, "nothing on the record says which press produced it");

  /** ⛔ Both read accepted. The provenance is on the record, not in the state — see stamp.ts. */
  assert.equal(stampFor(loadCorpus(dir), one).state, "accepted");
  assert.equal(stampFor(loadCorpus(dir), two).state, "accepted");
  /** ⛔ And the one already agreed to directly is not stamped a second time by the bulk press. */
  assert.equal(acceptsOf(dir, one).length, 1, "the bulk press duplicated an acceptance that was already current");
});

/**
 * ⛔ STALENESS STILL BITES, AND NOW IT BITES ONE SENTENCE.
 *
 * This is the whole argument for N records. Reword a slot after the press and that slot is not
 * agreed any more — `claim-changed`, exactly as if somebody had pressed its own button — while its
 * siblings, which nobody touched, keep the agreement they were given.
 */
test("a reworded sentence drops out, and its siblings do not", () => {
  const dir = seed();
  assert.ok(perform(dir, "accept", { target: PRESSED }, by).ok);
  const refs = sentencesIn(loadCorpus(dir), PRESSED);
  const moved = `${PRESSED}#with`;
  assert.ok(refs.includes(moved), `the fixture does not hold ${moved}`);

  const file = path.join(dir, "truth", "money.md");
  const was = fs.readFileSync(file, "utf-8");
  assert.ok(was.includes("says: Which kid."), "the fixture sentence is not what this test rewords");
  fs.writeFileSync(file, was.replace("says: Which kid.", "says: Which kid is being looked at."));

  const corpus = loadCorpus(dir);
  const st = stampFor(corpus, moved);
  assert.equal(st.state, "claim-changed", `a reworded sentence reads ${st.state}`);
  assert.equal(st.by, "alice", "the broken stamp does not say whose agreement moved");
  for (const ref of refs.filter((r) => r !== moved))
    assert.equal(
      stampFor(corpus, ref).state,
      "accepted",
      `${ref} lost its agreement because a different sentence was reworded`
    );
  /** ⛔ The exchange's own stamp breaks too: its hash covers every slot, and one of them moved. */
  assert.equal(stampFor(corpus, PRESSED).state, "claim-changed");
  /** ⛔ And the one sentence that moved is the only thing back in the queue. */
  const owed = actsFor(corpus).written.filter((r) => r.startsWith(`${PRESSED}#`));
  assert.deepEqual(owed, [moved], `the queue asks for ${owed.join(", ")}`);
});

/**
 * ⛔ AN EXCHANGE ACCEPTANCE COVERS NOTHING IT WAS NOT WRITTEN AGAINST.
 *
 * The fixture is the rejected design, hand-written: a current, correctly hashed, human acceptance of
 * the whole exchange and no per-sentence records at all. Every sentence beneath it must read
 * `never`. This goes red the moment `stampFor` is taught to walk up to the exchange — which is the
 * change that would let a reworded sentence inherit an agreement nobody gave it.
 */
test("a stamp answers for the ref it was written against, and does not reach down", () => {
  const dir = seed();
  const cover = coveredBy(loadCorpus(dir), PRESSED);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "accepts.yaml"),
    [
      "verdicts:",
      "  - kind: accept",
      `    target: ${PRESSED}`,
      "    by: alice",
      "    at: 2026-10-16",
      "    via: page",
      `    covers_slots: ${cover.slots}`,
      `    covers_criteria: ${cover.criteria}`,
      "",
    ].join("\n")
  );
  const corpus = loadCorpus(dir);
  assert.equal(stampFor(corpus, PRESSED).state, "accepted", "the fixture did not accept the exchange");
  for (const ref of sentencesIn(corpus, PRESSED)) {
    const st = stampFor(corpus, ref);
    assert.equal(st.state, "never", `${ref} reads ${st.state} on the strength of a verdict naming its exchange`);
  }
});
