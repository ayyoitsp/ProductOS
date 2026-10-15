/**
 * ⛔ IT TOLD A REVIEWER TEN WRITTEN SENTENCES WERE BLANK.
 *
 * `openRuleQuestions` ended every open rule's question with *"Until then it governs nothing, and
 * those slots read as the blanks they are."* That is true of a `supplies` rule — it IS the answer
 * where the slot is silent — and false of a `constrains` one, which adds a requirement to whatever
 * the slot already says.
 *
 * Reported by an author whose two `answer` slots say ten things and three things: *"the reach
 * itself is right for a `constrains` rule; the sentence about blanks is false and is the first
 * thing a reviewer reads about the feature."* A reviewer who believes it goes looking for ten
 * missing sentences that are sitting in front of them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { openRuleQuestions } = await import(path.resolve("dist/v2/settle.js"));

/**
 * A scope whose `answer` says three things, and an open rule of the given mode reaching it.
 *
 * ⛔ THE RULE CARRIES NO `statement`. A rule may not both state what holds and say nobody has
 * decided it — "a rule has no slot to hold a residual in". An earlier author hit the same refusal
 * from the other direction and respected it rather than reporting it as an omission.
 */
function corpusWithOpenRule(mode) {
  const dir = temp(`rulemode-${mode}-`);
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "spending.md"),
    `---
id: spending
title: Spending
in: family-wallet
exists: kept
terms:
  spend:
    means: money leaving a kid's pot, however it leaves
exchanges:
  - id: spend-some
    title: Spending some
    asked_by: person
    at: { view: a-screen }
    reads: [spend]
    changes: [spend]
    slots:
      answer:
        says:
          - id: the-first
            says: The amount is taken off what the kid has.
          - id: the-second
            says: The act appears at the top of their history, dated today.
          - id: the-third
            says: The parent sees it on their own list within the hour.
views:
  - id: a-screen
    title: A screen
    view_kind: list
    sketch: |
      [ a screen ]
---

# Spending

A feature whose answer says three separate things.
`
  );
  fs.mkdirSync(path.join(dir, "rules"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "rules", "who-may-spend.md"),
    `---
id: who-may-spend
in: family-wallet
fills: [answer]
mode: ${mode}
scope:
  asked_by: person
  term: spend
why: Two people share a pot and a disputed spend is unarguable without a name on it.
standing:
  kind: open
  question: Is a spend recorded against the person who pressed, or the pot's owner?
  asked_of: peter
  cost: a disputed spend has nobody's name on it and cannot be settled
  blocks: []
---

# Who may spend
`
  );
  return { dir, corpus: loadCorpus(dir) };
}

test("a `constrains` rule does not call written statements blank", () => {
  const { dir, corpus } = corpusWithOpenRule("constrains");
  const qs = openRuleQuestions(corpus, ["spending"]);

  /** ⛔ The non-zero first: the rule's question is actually reaching the queue. */
  assert.equal(qs.length, 1, `the open rule did not reach the queue (got ${qs.length})`);
  assert.doesNotMatch(
    qs[0].asks,
    /read as the blanks they are/,
    "⛔ it still tells a reviewer three written statements are blank"
  );
  assert.match(qs[0].asks, /those slots say what they say, and nothing is holding them to it/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a `supplies` rule still says the slots are blank, because they are", () => {
  /**
   * ⛔ WITHOUT THIS THE FIX IS JUST THE OPPOSITE BIAS. A supplies rule is the answer where the slot
   * is silent, so "those slots read as the blanks they are" is the true and useful thing to say —
   * and a version that never says it has lost the point of the sentence.
   */
  const { dir, corpus } = corpusWithOpenRule("supplies");
  const qs = openRuleQuestions(corpus, ["spending"]);
  assert.equal(qs.length, 1);
  assert.match(qs[0].asks, /read as the blanks they are/, "the supplies wording was lost");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("both modes still say answering it once settles the reach", () => {
  for (const mode of ["supplies", "constrains"]) {
    const { dir, corpus } = corpusWithOpenRule(mode);
    const q = openRuleQuestions(corpus, ["spending"])[0];
    assert.match(q.asks, /Answering it once settles answer on 1 exchange here/, `lost for ${mode}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
