/**
 * ⛔ TAKING A BEHAVIOUR OUT — DELETED WHERE IT IS A DRAFT, AND NEVER DELETED WHERE SOMEBODY'S NAME
 * IS ON IT.
 *
 * Peter, twice: *"we should probalby have a 'delete' button to just remove behaviors"*, then
 * *"have a 'checkmark' to approve, 'trash' icon to delete, 'edit' button to make changes."*
 *
 * Nothing could be taken out. A sentence a scoper proposed and nobody wanted could only be removed
 * by editing YAML — the one thing the page exists to stop — so a corpus accumulated every guess
 * anybody's software had made about the product, and a reviewer's queue grew whether or not they
 * agreed with any of it.
 *
 * ⛔ TWO OF THE FOUR TESTS BELOW ARE BUGS I SHIPPED INTO A WORKING BUILD AND FOUND BY RUNNING IT
 * AGAINST THE SEED, NOT BY READING THE CODE. Both would have destroyed truth somebody had agreed
 * to, silently, and both read as correct.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { perform } from "../dist/v2/acts.js";
import { loadCorpus } from "../dist/v2/load.js";

const REASON =
  "The field was removed from the form in September, nothing reads it any more, and the screen no longer shows it.";

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2wd-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const by = { by: "a-person", via: "page" };
const exchangeIn = (dir) =>
  loadCorpus(dir).scopes.find((s) => s.scope.id === "tasks").scope.exchanges.find((e) => e.id === "complete-a-task");

test("a draft nobody agreed to is deleted, and what it said is kept in the log", () => {
  const dir = seed();
  assert.ok(Object.keys(exchangeIn(dir).slots).includes("may"));
  const r = perform(dir, "withdraw", { target: "tasks#complete-a-task#may" }, by);
  assert.ok(r.ok, `refused: ${r.why}`);
  assert.ok(!Object.keys(exchangeIn(dir).slots).includes("may"), "the slot is still there");
  /** ⛔ "Was there ever a claim about this" has to stay answerable after a delete. */
  const v = loadCorpus(dir).verdicts.find((x) => x.target === "tasks#complete-a-task#may");
  assert.ok(v, "nothing recorded the removal, so the corpus silently shrank");
  assert.match(v.note ?? "", /deleted:/);
  assert.ok((v.note ?? "").length > 20, "the sentence that was taken out is not in the record");
});

/**
 * ⛔ BUG ONE. `exists` lives on an exchange, a view and a scope. `Statement` is strict with two
 * fields and `SlotFill` has none — so withdrawing one AGREED slot had nowhere to record itself, and
 * what it actually did was mark the whole exchange withdrawn, taking its other five slots with it.
 *
 * The refusal is the right answer rather than a gap: agreed truth is reworded, not deleted — the id
 * stays, the stamp breaks, and whoever agreed is asked again.
 */
test("an agreed slot is refused, and its exchange is left alone", () => {
  const dir = seed();
  perform(dir, "accept", { target: "tasks#complete-a-task#with" }, by);
  const before = Object.keys(exchangeIn(dir).slots);

  const r = perform(dir, "withdraw", { target: "tasks#complete-a-task#with", because: REASON }, by);
  assert.ok(!r.ok, "a slot somebody agreed to was taken out, leaving their verdict pointing at nothing");
  assert.ok(r.detail?.some((d) => /reword/.test(d)), "the refusal does not say what WOULD be honest here");
  assert.ok(r.detail?.some((d) => /withdraw tasks#complete-a-task\b/.test(d)), "it does not offer the grain that works");

  assert.deepEqual(Object.keys(exchangeIn(dir).slots), before, "it took other slots with it");
  assert.equal(exchangeIn(dir).exists, undefined, "it marked the whole exchange withdrawn over one slot");
});

/**
 * ⛔ BUG TWO, AND THE WORSE ONE. `stampFor(exchange)` is false while a SLOT inside it is accepted —
 * so taking out a whole behaviour reported "a draft nobody had agreed to" and DELETED it, leaving
 * the verdict recorded against one of its slots pointing at nothing.
 *
 * Found by accepting a slot and then withdrawing its exchange: the obvious order, and not the one
 * the first test exercised.
 */
test("an exchange is kept where anything beneath it was agreed to", () => {
  const dir = seed();
  perform(dir, "accept", { target: "tasks#complete-a-task#with" }, by);
  const r = perform(dir, "withdraw", { target: "tasks#complete-a-task", because: REASON }, by);
  assert.ok(r.ok, `refused: ${r.why}`);
  assert.match(r.said, /withdrew/, "it deleted an exchange whose slot somebody had agreed to");
  const ex = exchangeIn(dir);
  assert.ok(ex, "the exchange is gone, so the verdict against its slot points at nothing");
  assert.equal(ex.exists, "withdrawn", "its id was freed for reuse, so a later sentence could inherit that stamp");
});

/** ⛔ A reason is owed only where somebody's name is on it. A draft nobody wanted owes no essay. */
test("a reason is required to withdraw what was agreed, and not to delete a draft", () => {
  const dir = seed();
  assert.ok(perform(dir, "withdraw", { target: "tasks#complete-a-task#may" }, by).ok, "a draft needed a reason");

  /**
   * ⛔ A SLOT, NOT THE EXCHANGE. Accepting a whole exchange is gated while its slots are unsettled,
   * so the first version of this fixture agreed to nothing and then asserted that withdrawing it
   * was refused — a test whose setup silently did not happen, which is the same class of mistake as
   * the unparseable fixtures earlier today.
   */
  const d2 = seed();
  const got = perform(d2, "accept", { target: "tasks#complete-a-task#with" }, by);
  assert.ok(got.ok, `the fixture agreed to nothing: ${got.why}`);
  const bare = perform(d2, "withdraw", { target: "tasks#complete-a-task" }, by);
  assert.ok(!bare.ok, "agreed truth was dropped with no reason recorded");
  assert.match(bare.why, /needs a reason/);
});
