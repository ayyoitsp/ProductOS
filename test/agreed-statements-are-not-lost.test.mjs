/**
 * ⛔ A RULING CANNOT SILENTLY DELETE AGREED STATEMENTS — AND ON A LIST-SHAPED SLOT IT COULD.
 *
 * `settle`'s clause-loss guard reads `wasSaying`, which is set only when `slot.says` is a STRING.
 * A LIST skipped it entirely — and a list is exactly the shape that holds several agreed
 * statements. The protection existed where there was one sentence to lose and was absent where
 * there were three.
 *
 * ⛔ MEASURED ON PETER'S REAL CORPUS, NOT IMAGINED.
 * `pl-start-a-deal#resume-a-deal-already-started#answer` carries three agreed statements. A `pick`
 * is correctly refused; writing the sentence directly was **accepted, leaving one. Two statements
 * a person had agreed to, gone, with nothing said.**
 *
 * ⛔ AND I TOUCHED THAT LINE THE SAME DAY AND MISSED IT. Fixing `adds a statement` I added
 * `!about.adds` to this very condition and wrote in the comment that the add path "worked only
 * because `wasSaying` is undefined for a list and this guard was skipped by accident". I noticed
 * the skip and did not see that the skip IS the hole. An interviewer run against staging found it.
 *
 * ⛔ A LIST NEEDS NO HEURISTIC. Splitting prose on punctuation stands in for "the things this slot
 * promises"; a list has already been split, each unit with its own id — so the same overlap test
 * runs over better units.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));
const { statements } = await import(path.resolve("dist/v2/schema.js"));

const REF = "spending#record-a-spend#answer";

/** Three agreed statements, and one thing about them in question — the shape that had no guard. */
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
      answer:
        says:
          - id: new-balance
            says: The parent sees the kid's new balance straight away.
          - id: the-line
            says: The spend appears on the kid's list with the reason that was typed.
          - id: the-date
            says: The date recorded is the day the parent entered it, not the day it was spent.
        standing:
          kind: open
          question: Does the kid see the spend as soon as the parent records it, or only next time they look?
          about: whether the kid is shown the spend without looking again
          cost: a kid who is not told cannot tell a mistake from a delay, and asks a parent instead
          asked_of: peter
          blocks: []
          candidates:
            - says: The kid is shown the spend as soon as it is recorded, wherever they are.
              consequence: a kid always knows, and something must interrupt whatever is on the shared screen
              replaces: the whole sentence
            - says: The kid sees it next time they look at their money.
              consequence: nothing interrupts, and a kid can be surprised by a balance they did not expect
              replaces: the whole sentence
---

# Spending
`;

const corpus = () => {
  const dir = temp("pos-loss-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "spending.md"), SPEND);
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const saysAt = (dir) => {
  const f = loadCorpus(dir).scopes.find((x) => x.scope.id === "spending").scope.exchanges[0].slots.answer;
  return statements(f.says).map((x) => x.says.replace(/\s+/g, " ").trim());
};

const rule = (dir, says) =>
  perform(dir, "rule", { slot: REF, says, because: "Peter picked between two answers offered with their consequences stated." }, { by: "peter", via: "chat" });

test("⛔ a ruling that drops the agreed statements is refused, and names what it drops", () => {
  const dir = corpus();
  assert.equal(saysAt(dir).length, 3, "the fixture does not carry three statements, so this measures nothing");

  const out = rule(dir, "The kid is shown the spend as soon as it is recorded, wherever they are.");
  assert.equal(out.ok, false, "a ruling deleted two statements a person had agreed to");
  assert.match(String(out.why), /drops parts of what was already agreed/);
  /** It must name them, or an author cannot fix it without diffing by hand. */
  assert.match(String(out.why), /new balance|list with the reason|date recorded/i);

  assert.deepEqual(saysAt(dir).length, 3, "statements were removed by a refused ruling");
});

test("⛔ and a ruling that keeps them is accepted — the guard does not refuse correct work", () => {
  /**
   * ⛔ THE NON-REFUSAL. "It refused" on its own is also what a guard that refuses everything
   * produces, and a guard that blocks the right answer is the same defect one layer up.
   */
  const dir = corpus();
  const before = saysAt(dir);

  const whole =
    "The parent sees the kid's new balance straight away. The spend appears on the kid's list with the reason that was typed. " +
    "The date recorded is the day the parent entered it, not the day it was spent. The kid is shown the spend as soon as it is recorded.";
  const out = rule(dir, whole);
  assert.ok(out.ok, `a ruling that kept everything was refused: ${String(out.why).split("\n")[0]}`);

  /** ⛔ CONTENT, not statement count — a whole-sentence ruling legitimately collapses the list. */
  const after = saysAt(dir).join(" ").toLowerCase();
  for (const b of before) {
    const words = b.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const kept = words.filter((w) => after.includes(w)).length / words.length;
    assert.ok(kept >= 0.5, `an agreed statement did not survive a ruling that meant to keep it: "${b}"`);
  }
});

test("⛔ and a pick on this shape is still refused, because no option names which part it replaces", () => {
  /**
   * The other half of the same corpus defect: both options declare `the whole sentence` while the
   * slot holds three, so neither can be pressed. Refusing late is what this whole file is about;
   * refusing at all is what keeps the statements.
   */
  const dir = corpus();
  const out = perform(
    dir,
    "rule",
    { slot: REF, pick: 1, because: "Peter picked between two answers offered with their consequences stated." },
    { by: "peter", via: "chat" }
  );
  assert.equal(out.ok, false, "an option that would delete two agreed statements was pressable");
  assert.equal(saysAt(dir).length, 3);
});
