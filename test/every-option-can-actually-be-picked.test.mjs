/**
 * ⛔ A QUESTION WHOSE OPTIONS CANNOT BE APPLIED IS NEVER OFFERED.
 *
 * Peter answered three questions on `pl-start-a-deal` — all three well worded, after three rounds of
 * work on exactly that — and **not one could be recorded.** He found out by asking: *"so show me
 * what truths changed based on my 3 answers"*. Nothing had.
 *
 * | his answer | why it would not go in |
 * | --- | --- |
 * | "Anyone at that lender" | the option replaces "only the part in question" and nothing named the part |
 * | "In the deal list" | the same |
 * | "Tell them, they choose" | the option claimed the whole sentence and silently dropped two statements already agreed |
 *
 * ⛔ ASKING AN UNANSWERABLE QUESTION IS WORSE THAN NOT ASKING. It spends the one thing this feature
 * exists to save, and spends it twice — once reading it, once being refused — while the worklist
 * reports a full set of questions either way. The checks existed; they ran when somebody tried to
 * answer, which is the last possible moment and the only one where the cost has already been paid.
 *
 * ⛔ AND THE DRAFT-TIME GUARD RUNS THE RULER'S OWN CHECKS. `droppedClauses` is imported from the
 * module that applies a ruling, and `of` is the same field `settle` swaps on. A guard with its own
 * idea of applicability would move the surprise rather than remove it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { resolveRef } = await import(path.resolve("dist/v2/ref.js"));
const { statements } = await import(path.resolve("dist/v2/schema.js"));

/** A slot saying three things, so "only the part in question" has something to be ambiguous about. */
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
      fails:
        says:
          - id: nothing-saved
            says: Nothing of the kid's money is changed.
          - id: keeps-the-typing
            says: The amount the parent typed stays on the screen.
          - id: can-try-again
            says: The parent can try again without starting over.
---

# Spending
`;

const REF = "spending#record-a-spend#fails";
const Q = "A parent taps save and the product cannot reach the store. What do they see?";

const corpus = () => {
  const dir = temp("pos-pickable-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "spending.md"), SPEND);
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const ask = (dir, candidates, extra = {}) =>
  raiseQuestion(dir, {
    ref: REF,
    question: Q,
    candidates,
    cost: "a parent who thinks a spend saved and finds it missing stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "demo",
    about: "whether the parent is told why it could not be saved",
    ...extra,
  });

test("⛔ an option replacing \"only the part in question\" with no part named is refused", () => {
  const dir = corpus();
  const out = ask(dir, [
    { says: "They are told the store could not be reached.", consequence: "a parent sees a word they may not know", replaces: "only the part in question" },
    { says: "They are told only that it did not save.", consequence: "less to read, and no way to tell a bug from an outage", replaces: "only the part in question" },
  ]);
  assert.equal(out.ok, false, "a question nobody could answer was offered");
  assert.match(out.why, /option 1/, "the refusal does not say which option is the problem");
  assert.match(out.why, /nothing says which part/);
  /** ⛔ And it names all three routes out, because a refusal with no remedy is where this stalled. */
  const said = (out.detail ?? []).join(" ");
  for (const way of ["statement id", "adds a statement", "the whole sentence"])
    assert.ok(said.includes(way), `the refusal does not offer "${way}" as a way through`);
});

test("⛔ naming the statement in the ref makes the same options answerable", () => {
  /**
   * ⛔ THE NON-ZERO. "Refused" on its own is also what a guard that refuses everything produces, so
   * the identical options have to be ACCEPTED once the part is named.
   */
  const dir = corpus();
  const out = ask(dir, [
    { says: "They are told the store could not be reached.", consequence: "a parent sees a word they may not know", replaces: "only the part in question" },
    { says: "They are told only that it did not save.", consequence: "less to read, and no way to tell a bug from an outage", replaces: "only the part in question" },
  ], { ref: `${REF}#nothing-saved` });
  assert.ok(out.ok, `the same options were refused with the part named: ${out.why}`);
  assert.equal(resolveRef(loadCorpus(dir), `${REF}#nothing-saved`).standing.of, "nothing-saved");
});

test("⛔ a whole-sentence option is NOT gated on word overlap, because good wording paraphrases", () => {
  /**
   * ⛔ I BUILT THAT GATE AND IT WAS WRONG, WHICH IS WHY THIS ASSERTS THE OPPOSITE NOW.
   *
   * An option that silently deletes an agreed statement is a real defect — one of the three reasons
   * Peter's answers could not be recorded. But the only available test, `droppedClauses`, compares
   * WORD OVERLAP, and as a draft-time gate it refused two existing tests that were right: an option
   * reading "Each parent sees the other's record appear as soon as it saves" restates "a change one
   * of them makes appears for the other" in different words.
   *
   * Overlap cannot tell a paraphrase from a deletion, so as a gate it refuses the well-worded
   * options and passes the lazy ones — exactly backwards. It still runs in `settle`, where one
   * person reads which clauses it believes are missing and may overrule it by writing the sentence
   * they want: a heuristic as a prompt to a human, which it can support, rather than as a gate on a
   * generator, which it cannot.
   */
  const dir = corpus();
  const out = ask(dir, [
    { says: "The parent learns nothing was kept, still sees what they typed, and may have another go.", consequence: "the same three promises in fewer words" , replaces: "the whole sentence" },
    { says: "Nothing of the kid's money is changed. The amount the parent typed stays on the screen. The parent can try again, and is told the store could not be reached.", consequence: "everything already agreed survives and the reason is added", replaces: "the whole sentence" },
  ]);
  assert.ok(out.ok, `a paraphrase of what was agreed was refused: ${out.why} ${(out.detail ?? []).join(" | ")}`);
});

test("⛔ and `adds a statement` is always applicable, so it is never refused for this", () => {
  const dir = corpus();
  const out = ask(dir, [
    { says: "The parent is also told the store could not be reached.", consequence: "the reason sits beside what was already agreed", replaces: "adds a statement" },
    { says: "The parent is also told roughly when to try again.", consequence: "fewer repeat taps, and a promise the product has to keep", replaces: "adds a statement" },
  ]);
  assert.ok(out.ok, `an addition was refused: ${out.why} ${(out.detail ?? []).join(" | ")}`);
  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.equal(s.candidates.length, 2);
  /** ⛔ Nothing agreed was touched by offering it — all three statements still stand, by id. */
  const slot = loadCorpus(dir).scopes.find((x) => x.scope.id === "spending").scope.exchanges[0].slots.fails;
  assert.deepEqual(statements(slot.says).map((x) => x.id), ["nothing-saved", "keeps-the-typing", "can-try-again"]);
});
