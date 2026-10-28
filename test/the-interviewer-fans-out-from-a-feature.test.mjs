/**
 * ⛔ STARTED ON A FEATURE, THE INTERVIEW REACHES WHAT THAT FEATURE LEANS ON.
 *
 * Peter: *"we should be able to start the interviewer on a feature, and have it fan out to the
 * gloassary/capabilities that are needed to support the feature."*
 *
 * ⛔ I HAD FOLDED THIS TO THE PRODUCT AND IT WAS THE WRONG CALL. Asked per feature the word
 * questions summed to **950 across the corpus**, so I moved them all to the root. But nobody
 * interviews 64 features at once — they interview ONE, and what that one needs is the words IT
 * uses: seventeen on the feature we measured, which is the work of making that feature buildable
 * rather than a corpus-wide audit nobody asked for. The 950 was a total no person ever sees.
 *
 * ⛔ BOTH GRAINS SURVIVE, because the sweep is a real thing somebody does deliberately. Same
 * derivation, two questions, two voices: *"this feature uses a word it cannot see the meaning of"*
 * and *"this word has drifted across the product"*.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));

/**
 * A product whose root defines nothing, one feature defining a word, and another USING it without
 * being able to see the definition — siblings do not reach each other.
 */
const corpus = () => {
  const dir = temp("pos-fanout-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "truth", "ledger.md"),
    `---
id: ledger
title: The ledger
in: family-wallet
exists: kept
terms:
  settlement:
    means: The moment a parent's recorded spending is reconciled against what the kid actually has.
---

# The ledger
`
  );
  fs.writeFileSync(
    path.join(dir, "truth", "payouts.md"),
    `---
id: payouts
title: Payouts
in: family-wallet
exists: kept
happy_path:
  accomplishes: A parent pays a kid what a finished task was worth, and the settlement is recorded
  brings: the approved task and the kid it belongs to
  ends_with: the kid's money is larger and the settlement stands against that task
  through: [payout-form]
exchanges:
  - id: pay-for-a-task
    title: A parent pays a kid for a task
    asked_by: person
    at:
      view: payout-form
      part: pay-button
    reads: [money, kid]
    changes: [money]
    slots:
      may:
        says: A parent may pay a kid once the settlement for that task is clear.
---

# Payouts
`
  );
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const wordsAskedAt = (c, id) =>
  (interviewFor(c, id)?.owed ?? []).filter((o) => o.owes === "undefined-word");

test("⛔ a feature is asked about a word it uses and cannot see the meaning of", () => {
  const dir = corpus();
  const c = loadCorpus(dir);

  const asked = wordsAskedAt(c, "payouts");
  const settlement = asked.find((o) => /settlement/.test(o.asks));
  assert.ok(settlement, `"settlement" was not asked about: ${asked.map((o) => o.asks.slice(0, 40)).join(" | ")}`);

  /** ⛔ In the FEATURE's voice. It read in the corpus voice first — "used in 62 places" — which is
   *  true, and is not what somebody interviewing one feature is asking. */
  assert.match(settlement.asks, /This feature uses "settlement" and cannot see where it is defined/);
  assert.match(settlement.asks, /defined in ledger/);
  assert.match(settlement.asks, /Is that the same thing meant here\?/);
  assert.equal(settlement.candidates.length, 0, "it drafted an answer only a person can give");

  /** ⛔ And the act it names is the one that now exists. */
  assert.match(settlement.act, /#term#settlement/);
});

test("⛔ the feature that DEFINES the word is not asked about its own vocabulary", () => {
  /**
   * ⛔ THE NON-ASK. "A question appeared" proves nothing if every feature gets one for every word.
   */
  const dir = corpus();
  const c = loadCorpus(dir);
  const asked = wordsAskedAt(c, "ledger");
  assert.ok(!asked.some((o) => /settlement/.test(o.asks)), "a feature was asked about a word it defines itself");
});

test("⛔ and the product is asked in the corpus's voice, about drift rather than about one feature", () => {
  const dir = corpus();
  const c = loadCorpus(dir);
  const root = c.scopes.find((x) => !x.scope.in).scope.id;
  for (const o of wordsAskedAt(c, root)) {
    assert.ok(
      !/This feature uses/.test(o.asks),
      "the product is asked a feature's question — the two grains have collapsed into one voice"
    );
    assert.match(o.asks, /used in \d+ places across the product/);
  }
});
