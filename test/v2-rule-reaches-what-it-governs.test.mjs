/**
 * ⛔ A CONFIRMED RULE REACHES EVERY SLOT WHOSE SENTENCE IT SUPPLIES.
 *
 * Peter, told this was an open question: *"Isn't this exactly what it should do?"* — and he was
 * right. It was not a judgement call, it was a gap, and the framing of it as a decision was wrong.
 *
 * `only-a-parent-moves-money` accepted, and `money#record-earning#may` read `never` — while the
 * entire content of that slot IS the rule's sentence, put there by the rule's own selector. A
 * reviewer was being asked to confirm one sentence again, once per exchange the rule reaches. That
 * is review surface with nothing behind it: the sentence a person agreed to and the sentence they
 * are asked about are the same string.
 *
 * ⛔ AND IT IS NOT THE SCALE REACHING THE LINE. No amount of inference produces a confirmation; this
 * is ONE confirmation recognised at every ref where its sentence actually stands. `through` names
 * the rule so no surface can show it as a direct acceptance.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { coveredBy, stampFor } = await import("../dist/v2/stamp.js");
const { confidenceOf, whyConfident } = await import("../dist/v2/confidence.js");

const RULE = "only-a-parent-moves-money";

/** The seed, with one rule accepted and nothing else. */
function withRuleAccepted(ruleId = RULE, tamper) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2rule-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const cov = coveredBy(loadCorpus(dir), ruleId);
  assert.ok(cov, `${ruleId} is not a rule in the seed any more`);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "v.yaml"),
    `verdicts:\n  - kind: accept\n    by: peter\n    at: 2026-10-06\n    target: ${ruleId}\n    via: page\n` +
      `    covers_slots: ${tamper === "slots" ? "sha256:reworded" : cov.slots}\n` +
      `    covers_criteria: ${cov.criteria}\n` +
      `    because: only a parent may move money, agreed across the whole product\n    resolves: []\n`,
  );
  return { dir, corpus: loadCorpus(dir) };
}

test("one confirmation of a rule settles every slot it supplies entirely", () => {
  const { dir, corpus } = withRuleAccepted();
  const { inherited } = resolveRules(corpus);
  const supplied = [...inherited].filter(([, r]) => r.id === RULE).map(([ref]) => ref);
  assert.ok(supplied.length >= 2, `the rule supplies only ${supplied.length} slots — this proves little`);

  for (const ref of supplied) {
    const st = stampFor(corpus, ref);
    assert.equal(st.state, "accepted", `${ref} is supplied entirely by a confirmed rule and reads ${st.state}`);
    assert.equal(st.through, RULE, `${ref} does not say which rule covers it`);
    assert.equal(confidenceOf(corpus, ref).confirmed?.through, RULE);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ a slot with a sentence of its own keeps asking, however many rules add to it", () => {
  /**
   * `resolveRules` separates `inherited` — the slot says nothing and the rule supplies it — from
   * `constrained`, where the slot states its own sentence and a rule adds a requirement on top. A
   * constrained slot carries words nobody has agreed to. Reading the two as one would hand a rule's
   * authority to a local sentence it never covered.
   */
  const { dir, corpus } = withRuleAccepted();
  const own = "money#record-earning#answer";
  const { inherited, constrained } = resolveRules(corpus);
  assert.ok(!inherited.has(own), "the fixture slot is inherited, not constrained — pick another");
  assert.ok((constrained.get(own) ?? []).length >= 1, "the fixture slot is not constrained by any rule");
  assert.equal(stampFor(corpus, own).state, "never", "a slot stating its own sentence was confirmed by a rule");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ a reworded rule stops reaching, exactly as a reworded claim stops counting", () => {
  const { dir, corpus } = withRuleAccepted(RULE, "slots");
  assert.notEqual(stampFor(corpus, RULE).state, "accepted", "the fixture rule is not actually stale");
  const { inherited } = resolveRules(corpus);
  for (const [ref, r] of inherited)
    if (r.id === RULE)
      assert.equal(stampFor(corpus, ref).state, "never", `${ref} inherited from a stale rule acceptance`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an unconfirmed rule reaches nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2norule-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const corpus = loadCorpus(dir);
  const { inherited } = resolveRules(corpus);
  const [ref] = [...inherited].find(([, r]) => r.id === RULE) ?? [];
  assert.ok(ref, "the rule supplies nothing in the seed");
  assert.equal(stampFor(corpus, ref).state, "never");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ what it changes, measured — and the queue is NOT one of the things", async () => {
  /**
   * ⛔ TWO WRONG GUESSES ABOUT THIS, BOTH CORRECTED BY MEASURING.
   *
   * First: that the page would show `confirmed · by rule` on the slot. Rule-supplied slots are not
   * rendered as rows at all, and correctly — a slot the rule supplies states nothing locally, so its
   * sentence appears once under the rule rather than repeated on every exchange it reaches.
   *
   * Second: that the review queue would shrink. It does not, and the reason is worth writing down.
   * `questionsFor` holds UNSETTLED things — a standing of `open`, where nobody has decided. A slot
   * supplied by a `stated` rule was already settled and was never in the queue; what was missing was
   * whether it had been CONFIRMED. Settled and confirmed are different axes, and conflating them is
   * what made the effect look bigger than it is.
   *
   * So the honest claim: every ref that asks "has a person agreed to this sentence" now gets the
   * right answer where it previously got a false negative. In the seed that is two refs from one
   * confirmation; in a corpus where a rule like "every button has a loading state" reaches forty
   * exchanges, it is forty.
   */
  const { questionsFor } = await import("../dist/v2/settle.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2rq-"));
  fs.cpSync("v2-seed", dir, { recursive: true });

  const slotRefs = (c) =>
    c.scopes.flatMap(({ scope }) =>
      scope.exchanges.flatMap((ex) =>
        ["may", "with", "answer", "after", "refuses", "fails", "again", "at_once"].map(
          (s) => `${scope.id}#${ex.id}#${s}`,
        ),
      ),
    );

  const before = loadCorpus(dir);
  const acceptedBefore = slotRefs(before).filter((r) => stampFor(before, r).state === "accepted");
  const queueBefore = questionsFor(before, "money").map((q) => q.ref);

  const cov = coveredBy(before, RULE);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "v.yaml"),
    `verdicts:\n  - kind: accept\n    by: peter\n    at: 2026-10-06\n    target: ${RULE}\n    via: page\n` +
      `    covers_slots: ${cov.slots}\n    covers_criteria: ${cov.criteria}\n` +
      `    because: only a parent may move money, agreed across the whole product\n    resolves: []\n`,
  );
  const after = loadCorpus(dir);
  const acceptedAfter = slotRefs(after).filter((r) => stampFor(after, r).state === "accepted");

  assert.deepEqual(acceptedBefore, [], "something was already accepted at slot level in the pristine seed");
  assert.ok(acceptedAfter.length >= 2, `one confirmation reached only ${acceptedAfter.length} slots`);

  /** ⛔ And every one of them is a slot that rule actually supplies — nothing else came with it. */
  const { inherited } = resolveRules(after);
  for (const ref of acceptedAfter)
    assert.equal(inherited.get(ref)?.id, RULE, `${ref} reads accepted and ${RULE} does not supply it`);

  /** ⛔ The queue is unchanged, and that is the correct behaviour rather than a shortfall. */
  assert.deepEqual(
    questionsFor(after, "money").map((q) => q.ref),
    queueBefore,
    "confirming a settled rule changed the queue — the queue is about unsettled questions, not unconfirmed ones",
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ excepting the rule at a slot is already the way out, and it inherits nothing", () => {
  /**
   * The model has `excepts`, which costs a reason and renders struck through. An exchange that opts
   * out is not in `inherited` at all — so "this rule does not apply here" needed no new mechanism,
   * which is why this change could be made without inventing one.
   */
  const { dir, corpus } = withRuleAccepted();
  const { inherited } = resolveRules(corpus);
  const excepted = corpus.scopes
    .flatMap(({ scope }) => scope.exchanges.map((ex) => ({ scope: scope.id, ex })))
    .flatMap(({ scope, ex }) =>
      Object.entries(ex.slots ?? {})
        .filter(([, fill]) => (fill?.excepts ?? []).length)
        .map(([slot, fill]) => ({ ref: `${scope}#${ex.id}#${slot}`, excepts: fill.excepts.map((e) => e.rule ?? e) })),
    );
  for (const e of excepted)
    assert.ok(!inherited.has(e.ref), `${e.ref} excepts a rule and still shows as inheriting from one`);
  fs.rmSync(dir, { recursive: true, force: true });
});
