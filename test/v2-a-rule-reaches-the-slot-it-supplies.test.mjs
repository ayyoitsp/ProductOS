/**
 * ⛔ A RULE MUST REACH THE SLOT IT SUPPLIES, AT THE GRAIN A PERSON ACTUALLY REVIEWS AT.
 *
 * `coveredBy` looked a resolved rule up as `` `${target}#${slot}` `` — correct only when `target` is
 * the two-segment exchange ref. A slot-grained target already carries its slot, so the lookup asked
 * for `money#record-earning#may#may` and missed every time.
 *
 * ⛔ WHY IT WENT UNSEEN: the exchange-grained call keys correctly, so every surface that reviews a
 * whole behaviour looked right. Only the slot grain was blind — and `GLOSSARY.md` calls one
 * falsifiable claim "the atom", slot grain is what `stampFor` is built around, and Peter has since
 * confirmed acceptance is per-ref. So the blind grain is the one the product runs on.
 *
 * Two costs, both measured on the pristine seed before the fix:
 *
 *   1. Accepting `money#record-earning#may` showed the reviewer the exchange title, two empty
 *      strings and "nothing here says what would show any of it" — on a slot whose entire content
 *      is "Only a parent may change what a kid has". They were asked to agree to a blank.
 *   2. The hash of a slot a rule entirely supplies was byte-identical with and without the rule,
 *      so a slot-grained acceptance SURVIVED the org-wide sentence beneath it being reversed.
 *      That is verbatim the failure `stamp.ts`'s own header exists to prevent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { coveredBy } from "../dist/v2/stamp.js";
import { loadCorpus } from "../dist/v2/load.js";

/** The seed, and the same seed with one org-wide rule taken out. */
function seeds() {
  const withRule = temp("rule-reaches-");
  fs.cpSync("v2-seed", withRule, { recursive: true });
  const without = temp("rule-gone-");
  fs.cpSync("v2-seed", without, { recursive: true });

  /**
   * ⛔ BY FILENAME, NOT BY CONTENT — and the content version is why this comment exists. Searching
   * the rules directory for a file *containing* "only-a-parent-moves-money" matched
   * `a-kid-sees-only-their-own.md`, which merely cites it. The test then deleted an unrelated rule,
   * broke a reference, and reported the fix as not working. The measurement was wrong, not the code.
   */
  const file = path.join(without, "rules", "only-a-parent-moves-money.md");
  assert.ok(fs.existsSync(file), "the seed no longer carries only-a-parent-moves-money — this test needs a new subject");
  fs.rmSync(file);
  return { with: loadCorpus(withRule), without: loadCorpus(without) };
}

/** A slot the rule supplies entirely — it states nothing of its own. */
const SUPPLIED = "money#record-earning#may";

test("⛔ a reviewer accepting a slot is shown the rule that supplies it", () => {
  const { with: c } = seeds();
  const got = coveredBy(c, SUPPLIED);
  assert.ok(got, `${SUPPLIED} resolves to nothing`);
  const text = got.reads.join(" | ");
  assert.match(
    text,
    /Only a parent may change what a kid has/,
    "the slot's only content is missing — the reviewer is being asked to agree to a blank",
  );
  /** ⛔ And it says where the sentence came from, or it reads as the slot's own words. */
  assert.match(text, /only-a-parent-moves-money/, "nothing says the sentence is inherited from a rule");
});

test("⛔ removing the rule changes the hash of the slot it supplied", () => {
  /**
   * THE LOAD-BEARING ONE. If these hashes match, an acceptance of this slot survives the sentence
   * underneath it being reversed — and no surface anywhere can tell.
   */
  const { with: a, without: b } = seeds();
  const withRule = coveredBy(a, SUPPLIED);
  const withoutRule = coveredBy(b, SUPPLIED);
  assert.ok(withRule && withoutRule);
  assert.notEqual(
    withRule.slots,
    withoutRule.slots,
    "the hash is byte-identical with and without the rule, so reversing the rule would not stale the acceptance",
  );
});

test("the exchange grain still carries the rule, as it always did", () => {
  /** ⛔ A non-zero control: this one keyed correctly all along, so if it ever goes quiet the fix
   * broke the case that was working rather than the case that was not. */
  const { with: c } = seeds();
  const got = coveredBy(c, "money#record-earning");
  assert.match(got.reads.join(" | "), /Only a parent may change what a kid has/);
});

test("a slot that states its own words is unaffected either way", () => {
  /**
   * ⛔ The third outcome, so the pair above cannot pass by making every slot carry every rule.
   * `answer` says its own sentence and no rule supplies it; its hash must not move when an
   * unrelated rule is removed.
   */
  const { with: a, without: b } = seeds();
  const own = "money#record-earning#answer";
  const x = coveredBy(a, own);
  const y = coveredBy(b, own);
  assert.ok(x && y);
  assert.match(x.reads.join(" | "), /The act appears at the top of the kid's history/);
  assert.equal(x.slots, y.slots, "a slot the rule never supplied moved when the rule was removed");
});
