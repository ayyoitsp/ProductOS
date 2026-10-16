/**
 * ⛔ ONE HUMAN ACT, N RECORDS — AND THE N LAST EXACTLY AS LONG AS THE ACT.
 *
 * The second way truth gets accepted: a person states one sentence — *"folders are restricted to be
 * linked to a single deal"* — and every claim that sentence verifies is settled, with their sentence
 * logged as the proof. The record keeps three things: `through` (the sentence, theirs), `reading`
 * (why it settles THIS claim, software's) and `read_by` (who read it that way).
 *
 * ⛔ WHAT MAKES THIS DANGEROUS AND WHY THE RULE CHECK IS LOAD-BEARING. A claim the statement reaches
 * need not inherit the rule — that is the entire point, the sentence verifies a claim written in
 * other words. So the verdict's own hashes do not move when the rule is reworded, and the fourth
 * test here measures exactly that: `money#record-earning#answer` hashes byte-identically before and
 * after `a-kid-sees-only-their-own` is reversed. Without `stampFor` asking whether the rule still
 * stands, one sentence settles several claims and they go on standing after the sentence is
 * reversed or its own acceptance withdrawn — verbatim the failure `stamp.ts`'s header exists to
 * prevent, arriving by a route no existing check can see.
 *
 * Three distinguishable outcomes, so a pass is not the shape of doing nothing:
 *
 *   accepted through a current rule        accepted, through: <rule>
 *   the rule reworded                      claim-changed, with the person's name
 *   the rule's own acceptance gone          never
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { loadCorpus } from "../dist/v2/load.js";
import { coveredBy, stampFor, staleReason } from "../dist/v2/stamp.js";
import { Verdict } from "../dist/v2/schema.js";

const base = loadCorpus("v2-seed");

/** The sentence a person states. ⛔ It fills `may`, so it does NOT supply the claim below. */
const RULE = "a-kid-sees-only-their-own";
/**
 * A claim the sentence reaches without supplying — it states its own words, in its own slot.
 *
 * ⛔ THIS CHOICE IS THE TEST. A slot the rule supplies entirely is already covered by
 * `acceptedThroughRule`, and its hash moves when the rule is reworded, so the existing mechanism
 * would catch a reversal and the new one would never be exercised.
 */
const CLAIM = "money#record-earning#answer";

const REWORDED = "A kid sees everything any sibling has — the amounts, and that the sibling exists.";

/** ⛔ Parsed, not hand-built: every refinement on `Verdict` runs over each fixture below. */
const verdict = (v) => Verdict.parse(v);

const accepting = (corpus, target, extra = {}) => {
  const now = coveredBy(corpus, target);
  assert.ok(now, `${target} resolves to nothing in the seed — pick a ref that exists`);
  return verdict({
    kind: "accept",
    by: "peter",
    at: "2026-10-14",
    target,
    via: "page",
    covers_slots: now.slots,
    covers_criteria: now.criteria,
    ...extra,
  });
};

/** The reading: software's account of why that sentence settles this claim. */
const READING = {
  through: RULE,
  reading:
    "the sentence says a kid sees nothing belonging to another kid, which is what this claim states about whose history the act appears in",
  read_by: "claude-opus-5",
};

const withVerdicts = (corpus, verdicts) => ({ ...corpus, verdicts: [...corpus.verdicts, ...verdicts] });

const reword = (corpus, ruleId, statement) => ({
  ...corpus,
  rules: corpus.rules.map((r) => (r.rule.id === ruleId ? { ...r, rule: { ...r.rule, statement } } : r)),
});

/** The person's one act, and the claim it was read as reaching. */
const settled = (corpus = base) =>
  withVerdicts(corpus, [accepting(corpus, RULE), accepting(corpus, CLAIM, READING)]);

test("a claim settled through a sentence somebody stated is accepted, and says whose sentence", () => {
  const got = stampFor(settled(), CLAIM);
  assert.equal(got.state, "accepted", `a claim reached through a confirmed rule reads ${got.state}`);
  assert.equal(got.by, "peter");
  /** ⛔ Named, so no surface can show a reading as a direct acceptance. */
  assert.equal(got.through, RULE, "nothing says this was reached through a statement rather than pressed on");
});

test("⛔ the reading is carried beside the name of whoever read it, never beside the person's", () => {
  const got = stampFor(settled(), CLAIM);
  assert.match(got.read?.says ?? "", /which is what this claim states/, "software's account of the reach is gone");
  assert.equal(got.read?.by, "claude-opus-5", "the reading is unattributed, so an inference reads as a fact");
  /**
   * ⛔ THE TWO HALVES MUST NOT SHARE A FIELD. The person's name is on the acceptance; the inference
   * carries its own. If these were ever the same string a surface could print software's reasoning
   * under a human's name, which is the `chose` / `option_said` failure one level up.
   */
  assert.notEqual(got.read?.by, got.by, "the reader and the person who agreed are the same name");
});

test("⛔ rewording that sentence stops the claim being accepted — the load-bearing one", () => {
  const c = reword(settled(), RULE, REWORDED);
  const got = stampFor(c, CLAIM);
  assert.notEqual(
    got.state,
    "accepted",
    "one person's sentence is still settling this claim after the sentence was reversed — the exact failure this file's header exists to prevent",
  );
  assert.equal(got.state, "claim-changed");
  /** They did agree to something; what they agreed to moved. Their name stays on it. */
  assert.equal(got.by, "peter");
  assert.match(staleReason(got) ?? "", /org-wide rule reaching it arrived, left or was reworded/);
});

test("⛔ and the claim's own hashes do NOT move when the rule is reworded — so nothing else could catch it", () => {
  /**
   * THE MEASUREMENT THAT MAKES THE TEST ABOVE MEAN SOMETHING. If rewording the rule moved this
   * claim's hash, the ordinary stale path would report it and the new check could be deleted with
   * every test still green. The control: the same acceptance WITHOUT `through` survives the reword.
   */
  const before = coveredBy(base, CLAIM);
  const after = coveredBy(reword(base, RULE, REWORDED), CLAIM);
  assert.equal(before.slots, after.slots, "this claim now hashes the rule, so it is the wrong subject for this test");

  const pressed = withVerdicts(base, [accepting(base, RULE), accepting(base, CLAIM)]);
  assert.equal(
    stampFor(reword(pressed, RULE, REWORDED), CLAIM).state,
    "accepted",
    "a claim pressed on directly stopped being accepted when an unrelated rule moved",
  );
});

test("⛔ withdrawing the sentence's own acceptance withdraws every claim read through it", () => {
  /** The person's act on the rule is gone; only the reading remains. */
  const c = withVerdicts(base, [accepting(base, CLAIM, READING)]);
  const got = stampFor(c, CLAIM);
  assert.equal(
    got.state,
    "never",
    "a reading is standing with no human sentence under it — software's inference wearing an acceptance's clothes",
  );
});

test("a `through` naming a rule that does not exist confers nothing", () => {
  /**
   * ⛔ WHERE THE EXISTENCE CHECK BITES. The schema can see the shape of a rule id and not the corpus,
   * so a `through` pointing at nothing parses — and is then accepted by nobody, because nothing was
   * accepted on its behalf.
   */
  const c = withVerdicts(base, [accepting(base, CLAIM, { ...READING, through: "no-such-rule-here" })]);
  assert.equal(stampFor(c, CLAIM).state, "never");
});

test("a rule software landed is not a sentence anybody stated", () => {
  /**
   * ⛔ `via: agent` CANNOT CARRY THIS EITHER. The whole mechanism rests on a person having said one
   * thing; an agent's record of the rule would otherwise settle N claims with nobody's agreement
   * anywhere in the chain.
   */
  const c = withVerdicts(base, [
    verdict({ ...accepting(base, RULE), via: "agent", by: "productos-scoper" }),
    accepting(base, CLAIM, READING),
  ]);
  assert.equal(stampFor(c, CLAIM).state, "never");
});

test("the rule that supplies a slot entirely still reaches it, as it always did", () => {
  /** ⛔ A control on the OTHER route: both go through one `ruleStanding`, so neither may break. */
  const supplied = "money#record-earning#may";
  const c = withVerdicts(base, [accepting(base, "only-a-parent-moves-money")]);
  const got = stampFor(c, supplied);
  assert.equal(got.state, "accepted");
  assert.equal(got.through, "only-a-parent-moves-money");
  assert.equal(got.read, undefined, "an inherited sentence has no reading — nobody inferred anything");
});

test("⛔ a reading with no sentence under it is refused, and so is one at the wrong grain", () => {
  const ok = (v) => Verdict.safeParse(v).success;
  const good = { kind: "accept", by: "peter", at: "2026-10-14", via: "page", target: CLAIM, ...READING };
  assert.equal(ok(good), true, `the documented shape does not parse: ${JSON.stringify(Verdict.safeParse(good).error?.issues)}`);

  assert.equal(ok({ ...good, through: undefined }), false, "a reading was recorded with no statement under it");
  assert.equal(ok({ ...good, through: undefined, reading: undefined }), false, "read_by alone was accepted");
  assert.equal(
    ok({ ...good, target: "money#record-earning" }),
    false,
    "a whole exchange was settled through one statement — that is consent to seven sentences nobody mentioned",
  );
  assert.equal(ok({ ...good, through: "money#record-earning#answer" }), false, "a claim was named as the thing that verifies a claim");
  /** ⛔ The non-zero on the other side: an ordinary acceptance is untouched by any of this. */
  assert.equal(ok({ kind: "accept", by: "peter", at: "2026-10-14", via: "page", target: "money#record-earning" }), true);
});

test("⛔ the instruction layer names all three, or nobody will ever record one", () => {
  /**
   * ⛔ `Verdict` IS NOT IN `framework-not-just-output`'s LIST OF AUTHORED SHAPES — a verdict is
   * written by a command on somebody's behalf, never hand-typed — so the test that exists to catch
   * exactly this miss cannot see these three fields. That is precisely the condition under which
   * CLAUDE.md says the instruction layer gets forgotten: the schema supports a concept perfectly
   * while every future session keeps writing the old shape.
   *
   * So the check lives here, per field, against the skill that tells a session how an act is
   * recorded. ⛔ And `read_by` must be named BESIDE `reading` — a session told it may record an
   * inference and not told to attribute it is a session that writes an unattributed one.
   */
  const skill = fs.readFileSync("skills/productos/SKILL.md", "utf-8");
  const missing = ["through", "reading", "read_by"].filter(
    (f) => !new RegExp(`(^|\\s|\`)${f}:`, "m").test(skill) && !new RegExp("`" + f + "`").test(skill),
  );
  assert.deepEqual(missing, [], `the schema holds these and no instruction names them: ${missing.join(", ")}`);
  assert.match(skill, /Never their words/, "nothing tells a session the reading is not the person's sentence");
});
