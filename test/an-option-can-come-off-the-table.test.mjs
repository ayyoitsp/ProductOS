/**
 * ⛔ AN OPTION NOBODY CAN PICK COMES OFF THE TABLE, AND WHAT IT SAID IS KEPT.
 *
 * Peter: *"definitely needs to remove options."*
 *
 * `ask` only ever appended, for a reason stated in its own comment — *"a drafter adding a third
 * reading must not be able to delete the two a person has been weighing."* Right about the harm,
 * wrong about the cure: the harm is deleting them SILENTLY.
 *
 * ⛔ WHAT APPEND-ONLY COST. Three questions on `pl-start-a-deal` carried options that could not be
 * applied at all, and nothing could take them off — so the only way to make his answers recordable
 * was to add working options BESIDE the broken ones, leaving questions with six options of which
 * four could never be picked. Permanent, until somebody answered the question.
 *
 * ⛔ AND THE SECOND HALF, WHICH IS WHY THE FIRST WAS NEEDED: `adds a statement` could not be used on
 * a slot whose sentence is a single string. `settle`'s clause-loss guard ran BEFORE the add branch,
 * so an addition was tested as though it replaced the sentence and refused for dropping clauses it
 * never claimed to touch. Of his three questions only the one whose `says` is a LIST could use the
 * clean route — and that worked by accident, because `wasSaying` is undefined for a list.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { resolveRef } = await import(path.resolve("dist/v2/ref.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));
const { statements } = await import(path.resolve("dist/v2/schema.js"));

const AGREED =
  "Nothing of the kid's money is changed, the amount the parent typed stays on the screen, and the parent can try again without starting over.";
const REF = "spending#record-a-spend#fails";

const corpus = (saysBlock = `        says: ${AGREED}`) => {
  const dir = temp("pos-withdraw-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "spending.md"),
    `---
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
${saysBlock}
---

# Spending
`
  );
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const THREE = [
  { says: "The parent is told the store could not be reached.", consequence: "a parent knows it was not their mistake", replaces: "adds a statement" },
  { says: "The parent is told only that it did not save.", consequence: "less to read, and no way to tell a bug from an outage", replaces: "adds a statement" },
  { says: "The parent is told nothing at all about why.", consequence: "the quietest screen, and the least recoverable mistake", replaces: "adds a statement" },
];

const ask = (dir, extra = {}) =>
  raiseQuestion(dir, {
    ref: REF,
    question: "A parent taps save and it cannot be reached. Are they told why?",
    about: "whether the parent is told why it could not be saved",
    candidates: THREE,
    cost: "a parent who cannot tell a bug from an outage stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "demo",
    ...extra,
  });

const BECAUSE = "nobody can pick it: it names no statement to replace, so an answer against it cannot be recorded";

test("⛔ an option comes off the table, and what it said and why is kept", () => {
  const dir = corpus();
  assert.ok(ask(dir).ok);

  const out = raiseQuestion(dir, { ref: REF, question: "x", blocks: [], asked_of: "peter", by: "session", withdraw_options: [{ option: 3, because: BECAUSE }] });
  assert.ok(out.ok, `the withdrawal was refused: ${out.why}`);
  /** ⛔ It is reported as a removal, not as an addition — "added 2 options off the table" was real. */
  assert.match(out.said, /took 1 option off the table/);

  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.equal(s.candidates.length, 2, "the option is still on the table");
  assert.deepEqual(s.candidates.map((c) => c.says), [THREE[0].says, THREE[1].says]);
  assert.equal(s.withdrawn.length, 1);
  assert.equal(s.withdrawn[0].says, THREE[2].says, "what it said was not kept");
  assert.equal(s.withdrawn[0].because, BECAUSE, "why it went was not kept");
});

test("⛔ several at once, highest first, so an earlier removal cannot shift a later one", () => {
  /**
   * ⛔ THE ORDERING IS THE WHOLE CORRECTNESS ARGUMENT. Removing 1 then 3 would take option 4 — and
   * the test that catches that has to withdraw two non-adjacent options and name the survivor.
   */
  const dir = corpus();
  assert.ok(ask(dir).ok);
  const out = raiseQuestion(dir, {
    ref: REF,
    question: "x",
    blocks: [],
    asked_of: "peter",
    by: "session",
    withdraw_options: [
      { option: 1, because: BECAUSE },
      { option: 3, because: "it is the same answer as option 2 in different words" },
    ],
  });
  assert.ok(out.ok, out.why);
  const s = resolveRef(loadCorpus(dir), REF).standing;
  assert.deepEqual(s.candidates.map((c) => c.says), [THREE[1].says], "the wrong options were removed");
  assert.deepEqual(s.withdrawn.map((w) => w.says).sort(), [THREE[0].says, THREE[2].says].sort());
});

test("⛔ the last option cannot be withdrawn — that is the question being wrong, not the option", () => {
  const dir = corpus();
  assert.ok(ask(dir).ok);
  const out = raiseQuestion(dir, {
    ref: REF,
    question: "x",
    blocks: [],
    asked_of: "peter",
    by: "session",
    withdraw_options: THREE.map((_, i) => ({ option: i + 1, because: BECAUSE })),
  });
  assert.equal(out.ok, false, "a question was left with nothing to pick between");
  assert.match(out.why, /nothing to pick between/);
  /** ⛔ And it names the act that IS right, or this is a dead end. */
  assert.match((out.detail ?? []).join(" "), /disputes/);
  assert.equal(resolveRef(loadCorpus(dir), REF).standing.candidates.length, 3, "options were removed anyway");
});

test("⛔ an option number that is not there is refused, and the refusal lists what is", () => {
  const dir = corpus();
  assert.ok(ask(dir).ok);
  const out = raiseQuestion(dir, { ref: REF, question: "x", blocks: [], asked_of: "peter", by: "session", withdraw_options: [{ option: 7, because: BECAUSE }] });
  assert.equal(out.ok, false);
  assert.match(out.why, /no option 7/);
  assert.match((out.detail ?? []).join(" "), /The parent is told the store could not be reached/, "it does not show which options exist");
});

test("⛔ `adds a statement` works on a slot whose sentence is one string, and keeps it verbatim", () => {
  /**
   * ⛔ THE CASE THAT COULD NOT WORK. The clause-loss guard ran first and tested an addition as a
   * replacement. Measured by putting the guard back: this same ruling is refused for "dropping
   * parts of what was already agreed" — parts it never claimed to touch.
   */
  const dir = corpus();
  assert.ok(ask(dir).ok);
  const ruled = perform(
    dir,
    "rule",
    { slot: REF, pick: 1, because: "Peter picked this between options offered with their consequences stated." },
    { by: "peter", via: "chat" }
  );
  assert.ok(ruled.ok, `an addition on a single-string slot was refused: ${String(ruled.why).split("\n")[0]}`);

  const slot = loadCorpus(dir).scopes.find((x) => x.scope.id === "spending").scope.exchanges[0].slots.fails;
  const now = statements(slot.says).map((x) => x.says.trim());
  assert.equal(now.length, 2, "the addition did not land beside the original");
  assert.ok(now.includes(AGREED), "the sentence that was already agreed is not there word for word");
  assert.ok(now.includes(THREE[0].says), "the chosen option is not there");
});

test("⛔ and a replacement that drops agreed parts is still refused — the guard was not weakened", () => {
  /** ⛔ THE NON-ZERO BESIDE THE FIX. "Additions work" proves nothing if the guard now passes everything. */
  const dir = corpus();
  const asked = raiseQuestion(dir, {
    ref: REF,
    question: "A parent taps save and it cannot be reached. Are they told why?",
    about: "whether the parent is told why it could not be saved",
    candidates: [
      { says: "The parent is told the store could not be reached.", consequence: "short, and silent about everything else", replaces: "the whole sentence" },
      { says: "Nothing is changed, the typing stays, they can try again, and they are told why.", consequence: "everything kept and the reason added", replaces: "the whole sentence" },
    ],
    cost: "a parent who cannot tell a bug from an outage stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "demo",
  });
  assert.ok(asked.ok, asked.why);
  const ruled = perform(
    dir,
    "rule",
    { slot: REF, pick: 1, because: "Peter picked this between options offered with their consequences stated." },
    { by: "peter", via: "chat" }
  );
  assert.equal(ruled.ok, false, "a ruling that deletes agreed statements was written in");
  assert.match(String(ruled.why), /drops parts of what was already agreed/);
});
