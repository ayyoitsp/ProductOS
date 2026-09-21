/**
 * ⛔ WHAT AN ACT MAY TOUCH, PINNED — because every write path destroyed truth nobody had
 * questioned, and nothing printed what it removed.
 *
 * Five reviewers found five variations of one principle: the schema priced what a PERSON
 * writes by hand and nothing priced what the TOOL writes, so the tool was the shortest route
 * to a corpus that passes. These are the four paths, each with the exact damage it used to do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { settle, waive } from "../dist/v2/settle.js";
import { loadCorpus } from "../dist/v2/load.js";

const REASON = "A reason long enough to carry the argument, which the schema requires of a ruling.";

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2write-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const slotOf = (dir, scope, ex, slot) =>
  loadCorpus(dir).scopes.find((s) => s.scope.id === scope).scope.exchanges.find((e) => e.id === ex).slots[slot];

test("waiving a slot that already answers something is refused, and names what it would remove", () => {
  const dir = seed();
  // ⛔ A slot with a settled sentence. Waiving it would take that sentence, and that is what
  // the refusal has to name.
  const r = waive(dir, "money#record-earning#again", REASON, "peter", "2026-09-19");
  assert.equal(r.ok, false, "waiving over a settled sentence must refuse");
  assert.match(r.why, /would also remove|says/, `the refusal must name what it would take: ${r.why}`);
  const after = slotOf(dir, "money", "record-earning", "again");
  assert.ok(after.says, "nothing may be written when the act is refused");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a ruling never invents an override of a rule it might agree with", () => {
  const dir = seed();
  const r = settle(
    dir,
    "tasks#complete-a-task#at_once",
    "A task is claimed by whichever kid presses first; the other is told it is already claimed.",
    "peter",
    "2026-09-19",
    REASON
  );
  assert.equal(r.ok, true, `the ruling should apply: ${r.ok ? "" : r.why}`);
  const after = slotOf(dir, "tasks", "complete-a-task", "at_once");
  assert.equal(
    after.instead_of.length,
    0,
    "settle must not decide that a ruling overrides a rule — agreeing and overriding are different acts"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a ruling records the sentence it replaced", () => {
  const dir = seed();
  const before = slotOf(dir, "money", "record-spending", "answer").says;
  const r = settle(
    dir,
    "money#record-spending#answer",
    // ⛔ A WHOLE replacement. A sentence that drops agreed clauses is now refused outright —
    // see the clause-loss guard in settle.ts — so this asserts the other half: a legitimate
    // revision records what it replaced.
    "The amount is taken off what the kid has, even past nothing — their money then reads as owed — the act appears at the top of their history dated today, and the parent is returned to the kid's money.",
    "peter",
    "2026-09-19",
    REASON
  );
  assert.equal(r.ok, true, `the ruling should apply: ${r.ok ? "" : r.why}`);
  assert.equal(
    r.replaced,
    before.replace(/\s+/g, " ").trim(),
    "the revised sentence has to be recoverable, or the corpus quietly stops meaning what was agreed"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a ruling leaves a footprint a check can hold", () => {
  const dir = seed();
  settle(dir, "tasks#complete-a-task#at_once", "Whichever kid presses first claims it.", "peter", "2026-09-19", REASON);
  const after = slotOf(dir, "tasks", "complete-a-task", "at_once");
  assert.equal(after.standing.kind, "stated");
  assert.equal(
    after.standing.answered_by,
    "peter",
    "without this the sentence is indistinguishable from a draft and no finding can ask which act it was"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
