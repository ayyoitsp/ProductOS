/**
 * ⛔ A QUESTION THAT IS A PARAGRAPH IS REFUSED, AND SO IS ONE THAT GLOSSES ITS OWN WORDS.
 *
 * Peter's entire response to a question this role had written:
 *
 *   "A processor opens the screen to start a deal, and the draft deal the product quietly sets up
 *    behind it — the thing everything they type gets saved into — cannot be made. What happens?"
 *
 *   **"is this even english?"**
 *
 * ⛔ WHY THIS IS CODE AND NOT MORE PROSE. The brief already said to use the words a person uses.
 * Then it said it harder, with a table of four real failures from his own corpus beside the wording
 * that works. The next run produced the sentence above. That is the same shape as every rule in this
 * repo that became a test: a ⛔ in a document did not stop the thing it forbade, and a failing write
 * does.
 *
 * ⛔ AND IT IS ONLY ARITHMETIC, DELIBERATELY. Judging whether a sentence sounds human is a guess
 * dressed as a refusal, and a judge told what good wording looks like can no longer notice the
 * project is wrong about it. Counting words is not a guess. Finding a dash is not a guess. The two
 * mechanical halves of what he objected to are the two things enforced, and the taste stays with
 * the person.
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
`;

const REF = "spending#record-a-spend#fails";

/** ⛔ HIS SENTENCE, VERBATIM. The guard's only job is to have caught this one. */
const HIS =
  "A processor opens the screen to start a deal, and the draft deal the product quietly sets up behind it — the thing everything they type gets saved into — cannot be made. What happens?";
/** Long, and with no dash, so length is measured on its own. */
const LONG =
  "When the product is unable to reach the place where the money is kept and therefore cannot record what the parent has just entered into the form on the screen in front of them, what should the parent see?";
const SHORT =
  "Someone clicks New Deal and the product can't set the deal up to save their work into. Do they start typing anyway, or do you tell them first?";

const OPTIONS = [
  { says: "They are told it did not save and the amount stays on screen.", consequence: "a parent sees a failure but never loses what they typed" },
  { says: "It keeps trying quietly and only speaks up if it gives up.", consequence: "fewer alarming messages, and a parent may walk away believing it saved" },
];

const corpus = () => {
  const dir = temp("pos-length-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "spending.md"), SPEND);
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const ask = (dir, question, extra = {}) =>
  raiseQuestion(dir, {
    ref: REF,
    question,
    candidates: OPTIONS,
    cost: "a parent who thinks a spend saved and finds it missing stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "demo",
    ...extra,
  });

test("⛔ the sentence he rejected is refused, and the short one is accepted", () => {
  /**
   * ⛔ BOTH HALVES MEASURED, BECAUSE A REFUSAL ALONE PROVES NOTHING — it is also what a guard that
   * refuses everything produces. The pair is the evidence.
   */
  const a = corpus();
  const no = ask(a, HIS);
  assert.equal(no.ok, false, "the sentence Peter answered with \"is this even english?\" was accepted");

  const b = corpus();
  const yes = ask(b, SHORT);
  assert.ok(yes.ok, `the readable replacement was refused: ${yes.why} ${(yes.detail ?? []).join(" | ")}`);
  assert.equal(resolveRef(loadCorpus(b), REF).standing.question, SHORT);
});

test("⛔ length is counted per sentence, and the number was set against his sentence", () => {
  /**
   * ⛔ THE FLOOR WAS WRONG FIRST AND THIS IS WHY THE TEST NAMES THE NUMBER. I set it to 32 on the
   * reasoning that a generous floor beats a strict one, then ran it against his sentence: **31
   * words, accepted.** A guard built for one known failure that does not catch it is the same shape
   * as every meaningless zero this project has a rule about.
   */
  const dir = corpus();
  const out = ask(dir, LONG);
  assert.equal(out.ok, false, "a 39-word question was accepted");
  assert.match(out.why, /39 words/, "the refusal does not say how long it actually was");
  /** His was 31 — so the floor has to sit below that, and a 17-word sentence has to clear it. */
  assert.match(out.why, /nobody asks a question that long/);
});

test("⛔ a dash glossing a term is refused on its own, with no help from the word count", () => {
  const dir = corpus();
  const out = ask(dir, "Someone clicks New Deal and the draft deal — the thing their typing is saved into — cannot be made. Now what?");
  assert.equal(out.ok, false, "a question that explains its own term was accepted");
  assert.match(out.why, /dash/, "the refusal does not name the gloss");
  assert.match(out.why, /wrong term/, "it does not say the fix is a plainer word");
});

test("⛔ and both apply to a rewording, which is the last place to waive readability", () => {
  /**
   * ⛔ I EXEMPTED REWORDINGS FROM THE GLOSS RULE FIRST, one line above a comment on the length rule
   * saying a rewording is exactly where it must not be waived. A rewording exists to make a question
   * readable; letting it install a paragraph is the whole defect wearing the fix's clothes.
   */
  const dir = corpus();
  assert.ok(ask(dir, SHORT).ok);

  const long = ask(dir, LONG, { rephrase: true });
  assert.equal(long.ok, false, "a rewording installed a 39-word sentence");

  const glossed = ask(dir, "Someone clicks New Deal and the draft deal — what their typing goes into — fails. Now what?", { rephrase: true });
  assert.equal(glossed.ok, false, "a rewording installed a dash gloss");

  /** ⛔ And nothing was written by either refusal. */
  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.equal(s.question, SHORT, "a refused rewording changed the question anyway");
  assert.ok(!s.was_asked, "a refused rewording recorded history");
});
