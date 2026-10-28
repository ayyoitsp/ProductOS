/**
 * ⛔ A BADLY ASKED QUESTION IS NOT PERMANENT, AND REWORDING IT LOSES NOTHING.
 *
 * `ask` refused to reword an open question: *"a question somebody has been weighing is not
 * rewritten under them"*. That is right about the harm and wrong about the cure — the harm is being
 * rewritten SILENTLY, and the cure is keeping what it used to say.
 *
 * ⛔ AND THE FREEZE WAS THE WHOLE PROBLEM, NOT A CORNER OF IT. Measured on Peter's corpus: 1,315 of
 * 1,600 questions owed were already drafted. So improving how the interviewer words a question
 * reached NONE of them — including every one he had objected to by name. He said *"this should be
 * natural language, not engineering speak"*, and without this the next question gets better while
 * every question he is actually looking at stays exactly as it was.
 *
 * ⛔ WHAT MAKES IT SAFE IS THAT THE OPTIONS ARE UNTOUCHED. The decision on the table is the same
 * decision; only the sentence asking it changes, and the old sentence is still readable.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { resolveRef } = await import(path.resolve("dist/v2/ref.js"));

const SPEND = `---
id: spending
title: Spending
in: family-wallet
exists: kept
happy_path:
  accomplishes: A parent records that a kid spent some of their money
  brings: the kid, and what was spent
  ends_with: the kid's money is smaller by that amount and the spend is on the list
  through: [spend-form]
exchanges:
  - id: record-a-spend
    title: A parent records a spend
    asked_by: person
    at:
      view: spend-form
      part: save-button
    reads: [money, kid]
    changes: [money]
    slots:
      may:
        says: A parent may record a spend for any kid in their family.
---

# Spending

A parent records what a kid spent.
`;

const REF = "spending#record-a-spend#fails";
const CLAUSE =
  "When the store of record cannot be reached, is the asker told that the write failed, or held in silence pending retry?";
const HUMAN =
  "A parent taps save and the product cannot reach wherever the money is kept. Do you tell them it did not save, or keep trying quietly and hope it goes through?";

const OPTIONS = [
  { says: "They are told it did not save, and the amount stays on the screen so they can try again.", consequence: "a parent sees a failure they may not understand, but never loses what they typed" },
  { says: "It keeps trying in the background and tells them only if it finally gives up.", consequence: "fewer alarming messages, and a parent may walk away believing something was recorded when it was not" },
];

const corpus = () => {
  const dir = temp("pos-reword-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "spending.md"), SPEND);
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  /** The badly-worded question somebody is now stuck with. */
  const asked = raiseQuestion(dir, {
    ref: REF,
    question: CLAUSE,
    candidates: OPTIONS,
    cost: "a parent who thinks a spend was recorded and finds it missing stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "some-earlier-run",
  });
  assert.ok(asked.ok, `the fixture question was refused: ${asked.why} ${(asked.detail ?? []).join(" | ")}`);
  return dir;
};

test("⛔ it can be said better, and what it used to say is kept", () => {
  const dir = corpus();
  const out = raiseQuestion(dir, { ref: REF, question: HUMAN, rephrase: true, blocks: [], asked_of: "peter", by: "a-later-run" });
  assert.ok(out.ok, `the rewording was refused: ${out.why}`);

  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the reworded corpus does not load: ${c.broken.map((b) => b.why).join("; ")}`);

  const s = resolveRef(c, REF).standing;
  assert.equal(s.question, HUMAN, "the question was not reworded");
  assert.deepEqual(s.was_asked, [CLAUSE], "what it used to say is gone, which is the harm the old refusal named");
  /** ⛔ The decision is the same decision. A rewording that moves an option is not a rewording. */
  assert.equal(s.candidates.length, 2);
  assert.deepEqual(s.candidates.map((x) => x.says), OPTIONS.map((x) => x.says));
});

test("⛔ and it is never inferred — a different sentence arriving without `rephrase` is still refused", () => {
  /**
   * ⛔ THIS IS THE GUARD THAT KEEPS THE OLD RULE'S POINT. A caller re-sending what it believes is a
   * new question must not quietly rewrite one somebody is weighing; that is the exact harm. So
   * rewording is asked for, never detected.
   */
  const dir = corpus();
  const out = raiseQuestion(dir, { ref: REF, question: HUMAN, blocks: [], asked_of: "peter", by: "a-later-run" });
  assert.equal(out.ok, false, "a different question text silently overwrote the one that was there");
  assert.match(out.why, /already open/);
  const said = (out.detail ?? []).join(" ");
  assert.match(said, /rephrase/, "the refusal does not tell the caller how to say it better");

  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.equal(s.question, CLAUSE, "it was changed anyway");
  assert.ok(!s.was_asked, "a refused rewording still recorded history");
});

test("⛔ rewording twice keeps both of the older wordings, oldest first", () => {
  const dir = corpus();
  const MIDDLE = "A parent taps save and the product cannot reach the store. Is the parent told?";
  assert.ok(raiseQuestion(dir, { ref: REF, question: MIDDLE, rephrase: true, blocks: [], asked_of: "peter", by: "r1" }).ok);
  assert.ok(raiseQuestion(dir, { ref: REF, question: HUMAN, rephrase: true, blocks: [], asked_of: "peter", by: "r2" }).ok);

  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.equal(s.question, HUMAN);
  assert.deepEqual(s.was_asked, [CLAUSE, MIDDLE], "the trail is not oldest-first, or an older wording was dropped");
});

test("⛔ and the same wording sent again adds nothing rather than a duplicate trail entry", () => {
  const dir = corpus();
  const out = raiseQuestion(dir, { ref: REF, question: CLAUSE, rephrase: true, blocks: [], asked_of: "peter", by: "r1" });
  assert.equal(out.ok, false, "re-sending the identical wording counted as a rewording");
  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.ok(!s.was_asked, "an identical wording was pushed onto the trail");
});
