/**
 * ⛔ A WORD MEANING TWO THINGS IS FOUND BY COUNTING, NOT BY READING.
 *
 * Peter found one by hand: *"kind of deal"* carried both the lender's product (bridge, rehab, DSCR)
 * and the kind of system a deal lives in. Measured afterwards — **used in 11 scopes, definition
 * reaching 2.** Nothing in the framework could see it, and his answer to how it should work was a
 * top-level glossary: *"we should probably have a glossary section that is 'top level'"*.
 *
 * The corpus it was found in had **0 terms at the top, 188 defined below, and "deal" — the central
 * noun — defined four separate times.**
 *
 * ⛔ TWO DECISIONS, BOTH HIS. Redefining a glossary word: *"Refuse it."* A word used where no
 * definition reaches: *"A question for the interviewer."* So one is a corpus refusal and the other
 * is never a refusal — a word nobody defined where it is used is not a defect on its own.
 *
 * ⛔ AND NEITHER JUDGES WHETHER THE SENSES DIFFER. "Is this word ambiguous" is a reading and would
 * be a guess wearing a decision's clothes. "It is defined twice" and "its definition reaches a
 * minority of its uses" are counts, and the counts are the only part that can carry a refusal.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));

/** The seed's root, given a glossary — and a feature that redefines one of its words. */
const corpus = ({ glossary = true, shadow = false } = {}) => {
  const dir = temp("pos-glossary-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });

  if (glossary) {
    const f = path.join(dir, "truth", "family-wallet.md");
    const t = fs.readFileSync(f, "utf8");
    assert.ok(t.includes("terms:"), "the seed root has no terms block to extend");
    fs.writeFileSync(
      f,
      t.replace(
        "terms:\n",
        "terms:\n  payout:\n    means: Money leaving a kid's pocket money, recorded by a parent.\n"
      )
    );
  }
  if (shadow) {
    fs.writeFileSync(
      path.join(dir, "truth", "payouts.md"),
      `---
id: payouts
title: Payouts
in: family-wallet
exists: kept
terms:
  payout:
    means: Something else entirely — a transfer between two families.
---

# Payouts
`
    );
  }
  return dir;
};

test("⛔ a feature redefining a glossary word is a question, NEVER a refusal", () => {
  /**
   * ⛔ THIS ASSERTED THE OPPOSITE FOR ABOUT AN HOUR, ON HIS FIRST ANSWER. Asked what should happen,
   * Peter said *"Refuse it"*; shown the result he reversed it with a principle larger than this
   * check: *"anyone should be able to redefine a gloassary word - why wouldn't thye? nothing should
   * be refused of a human requesting to make changes. product os should be reindexing based off the
   * feedback."*
   *
   * He is right about what `refuse` DOES — it stops a corpus being handed over — so a person who
   * changed a word of their own product truth was told their product had become unreviewable.
   * Punished for authoring. A refusal is right where the corpus cannot be READ; a word meaning two
   * things is a decision somebody made, and a decision gets a question.
   */
  const dir = corpus({ glossary: true, shadow: true });
  const found = checkCorpus(dir).findings.filter((f) => f.kind === "redefines-a-glossary-word");
  assert.equal(found.length, 1, `expected one finding, got ${found.length}`);
  assert.notEqual(found[0].severity, "refuse", "a person's own change makes their corpus unreviewable");
  assert.match(found[0].where, /payouts :: payout/);
  const fix = String(found[0].fix ?? "");
  assert.match(fix, /drop the local definition/);
  assert.match(fix, /give it its own name/);

  /** ⛔ AND IT REACHES THE PERSON AS A QUESTION, carrying BOTH senses — "defined twice" without
   *  showing the two readings is a feeling, and sends somebody off to look it up. */
  const c = loadCorpus(dir);
  const asked = interviewFor(c, "payouts")?.owed.filter((o) => o.owes === "undefined-word") ?? [];
  assert.equal(asked.length, 1, "the collision never reached anybody as a question");
  assert.match(asked[0].asks, /Money leaving a kid's pocket money/, "the glossary's sense is not shown");
  assert.match(asked[0].asks, /a transfer between two families/, "the local sense is not shown");
  assert.match(asked[0].asks, /needs its own name/);
  assert.equal(asked[0].candidates.length, 0, "it drafted an answer to a question only a person can settle");
});

test("⛔ and the same word defined only locally is fine — the glossary is what makes it a collision", () => {
  /**
   * ⛔ THE NON-REFUSAL. "A refusal fired" proves nothing on its own; it is also what a check that
   * refuses everything produces. Two scopes that cannot see each other may legitimately use one
   * word for different things, which is what a local vocabulary is FOR.
   */
  const dir = corpus({ glossary: false, shadow: true });
  const found = checkCorpus(dir).findings.filter((f) => f.kind === "redefines-a-glossary-word");
  assert.equal(found.length, 0, "a word defined once, locally, was refused");
});

test("⛔ a drifted word is asked about ONCE, at the product — not once per feature", () => {
  /**
   * ⛔ 950 IS THE NUMBER THAT SETTLED THIS. Asked per feature on a real corpus it produced 950
   * questions whose commonest subjects were `reading`, `deal`, `kind`, `role`, `document` — the
   * product's core nouns, each defined in one feature and used in fifty. Not 950 ambiguities: one
   * missing glossary, asked 950 times. Same precedent as the capability tree, whose own comment
   * says *"a subsystem serves many features, so which parts exist is not a per-feature question."*
   */
  const dir = corpus({ glossary: false });
  const c = loadCorpus(dir);
  const root = c.scopes.find((x) => !x.scope.in).scope.id;

  const atRoot = interviewFor(c, root)?.owed.filter((o) => o.owes === "undefined-word") ?? [];
  for (const { scope } of c.scopes) {
    if (scope.id === root) continue;
    const here = interviewFor(c, scope.id)?.owed.filter((o) => o.owes === "undefined-word") ?? [];
    assert.equal(here.length, 0, `${scope.id} was asked about a loose word that belongs to the product`);
  }
  /** It may legitimately find none in a small seed — what must not happen is finding them per feature. */
  for (const o of atRoot) {
    assert.match(o.asks, /used in \d+ places across the product/, "the question does not carry the count it rests on");
    assert.match(o.asks, /Is it one thing\?/);
    assert.equal(o.candidates.length, 0, "it drafted an answer to a question only a person can settle");
  }
});
