/**
 * ⛔ A QUESTION ASKED AT A NAMED REFUSAL LANDS ON THE REFUSAL — fg-0002.
 *
 * `REF_MESSAGE` has always said the fourth segment of a ref is "a named refusal or one statement",
 * and `ref.ts` resolved it as either. `suggest.ts` assumed statement and wrote the question onto the
 * SLOT, tagged `of: <the-case-name>`. So two halves of one system disagreed about one address:
 *
 * | | read `#already-paid` as | so it |
 * | --- | --- | --- |
 * | the writer | one statement of the slot | wrote the slot's standing |
 * | the reader | a named refusal | read the REFUSAL's standing — which was empty |
 *
 * ⛔ WHICH MADE THE QUESTION A LIE AT ITS OWN ADDRESS. Asked at
 * `payouts#pay-for-a-task#refuses#already-paid` and read back at the same ref, the answer was
 * *"already settled — it says what it is"*, with a live question carrying two candidates, a cost and
 * `asked_of: peter` sitting one level above it. `RefusalOutcome.standing` had existed the whole
 * time with its own validated contract: the home was built and nothing could reach it.
 *
 * ⛔ AND IT IS `refuses`, WHICH IS THE EXPENSIVE SLOT FOR THIS TO BE TRUE OF — the one a corpus most
 * often leaves open was the one slot nothing could draft options for.
 *
 * ⛔ THE ZERO THAT WOULD HAVE PROVED NOTHING: "no refusal" on the write. That is also what shipping
 * nothing produces. So this file measures three outcomes that DIFFER — a typo'd case, a real case
 * with no `asks`, and a real case with one — and then rules on it and reads the verdict back.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { resolveRef } = await import(path.resolve("dist/v2/ref.js"));
const { questionsFor } = await import(path.resolve("dist/v2/settle.js"));
const { perform } = await import(path.resolve("dist/v2/acts.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));

/** One behaviour whose `refuses` names one case — the smallest thing that has this shape. */
const PAYOUTS = `---
id: payouts
title: Payouts
in: family-wallet
exists: kept
happy_path:
  accomplishes: A parent pays a kid what a finished task was worth
  brings: the approved task and the kid it belongs to
  ends_with: the kid's money is larger by the task's amount and the task reads as paid
  through: [payout-form]
exchanges:
  - id: pay-for-a-task
    title: A parent pays a kid for a task
    asked_by: person
    at:
      view: payout-form
      part: pay-button
    reads: [money, task, kid]
    changes: [money]
    slots:
      may:
        says: A parent may pay a kid for any task they have approved.
      refuses:
        outcomes:
          - name: already-paid
            when: the task has been paid once already
            told: You already paid for this one.
---

# Payouts

A parent pays out what an approved task was worth.
`;

const REF = "payouts#pay-for-a-task#refuses#already-paid";

const corpus = () => {
  const dir = temp("pos-refusal-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "payouts.md"), PAYOUTS);
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  return dir;
};

const asking = (extra) => ({
  question: "If a payout was reversed, does the task still count as paid?",
  candidates: [
    {
      says: "It can be paid again, because the reversal undid the payment.",
      consequence: "the check looks for an unreversed payment, not any payment",
    },
    {
      says: "It still refuses, and the reversal must be undone first.",
      consequence: "a parent has one route and it is the reversal screen",
    },
  ],
  cost: "a parent who reversed a mistaken payout cannot pay the kid at all, and the kid is owed money the product refuses to move",
  blocks: [],
  asked_of: "peter",
  by: "demo",
  ...extra,
});

test("⛔ the question goes INSIDE the refusal, with `asks` and no `of`", () => {
  const dir = corpus();
  const wrote = raiseQuestion(dir, asking({ ref: REF, asks: "whether" }));
  assert.ok(wrote.ok, `the question was refused: ${wrote.why} ${(wrote.detail ?? []).join(" | ")}`);

  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the written corpus does not load: ${c.broken.map((b) => b.why).join("; ")}`);

  const slot = c.scopes.find((x) => x.scope.id === "payouts").scope.exchanges[0].slots.refuses;
  const kase = slot.outcomes.find((o) => o.name === "already-paid");

  /** ⛔ ON the case. The defect put it HERE instead, which is a different object entirely. */
  assert.ok(!slot.standing?.question, "the question is beside the refusal rather than on it — this is the fg-0002 defect");

  assert.equal(kase.standing.kind, "open");
  assert.equal(kase.standing.asks, "whether", "`asks` is the grain for a case — it names the field in question");
  assert.ok(!kase.standing.of, "`of` is a statement id, and a named refusal is not a statement of its slot");
  assert.equal(kase.standing.candidates.length, 2);
  /**
   * ⛔ AND NO `replaces` ON EITHER OPTION. `about` keys that demand — "the whole replacement
   * sentence, or only the part in question" — and a case is three fields, not one sentence, so
   * there was no honest answer. Demanding it is what made the write impossible without lying.
   */
  for (const o of kase.standing.candidates) assert.ok(!o.replaces, "a case has no sentence for an option to replace");
});

test("⛔ and the reader finds it unsettled at the ref it was asked at", () => {
  /**
   * ⛔ THIS IS THE ONE THAT WAS SILENT. The write "succeeded", so nothing looked further — and the
   * address it was asked at reported the opposite of the truth.
   */
  const dir = corpus();

  const before = resolveRef(loadCorpus(dir), REF);
  assert.equal(before.unsettled, false, "the fixture starts with a question on it, so this proves nothing");

  assert.ok(raiseQuestion(dir, asking({ ref: REF, asks: "whether" })).ok);

  const c = loadCorpus(dir);
  const after = resolveRef(c, REF);
  assert.equal(after.unsettled, true, "asked, then read at the same ref, and the reader says it is settled");
  assert.equal(after.standing.asks, "whether");

  /** ⛔ And the queue lists the CASE ref. It used to list the slot — a different address. */
  assert.ok(
    questionsFor(c, "payouts").some((q) => q.ref === REF),
    "the question is not in the queue at the ref it was asked at"
  );
});

test("⛔ a name that matches no case is refused, and the refusal names the cases there are", () => {
  /**
   * Previously this became `of: alredy-paid` with no complaint — a question filed against a
   * statement that does not exist, indistinguishable on the page from one correctly filed.
   */
  const dir = corpus();
  const out = raiseQuestion(dir, asking({ ref: "payouts#pay-for-a-task#refuses#alredy-paid", asks: "whether" }));
  assert.equal(out.ok, false, "a misspelled case name was accepted");
  assert.match(out.why, /not one of the refusals here/);
  assert.match(out.why, /already-paid/, "the refusal does not say which cases exist, so a typo is a guessing game");
});

test("⛔ a case with no `asks` is refused, because three different questions share one field", () => {
  const dir = corpus();
  const out = raiseQuestion(dir, asking({ ref: REF }));
  assert.equal(out.ok, false, "a question on a case was written without saying which part is in question");
  assert.match(out.why, /which part of it is in question/);
  /** The three it could be — a drafter is told them, not handed a schema path. */
  const said = (out.detail ?? []).join(" ");
  for (const which of ["whether", "when", "told"]) assert.match(said, new RegExp(which));
});

test("⛔ `asks` is refused where it means nothing — on a slot that holds no cases", () => {
  const dir = corpus();
  const out = raiseQuestion(dir, asking({ ref: "payouts#pay-for-a-task#may", asks: "whether" }));
  assert.equal(out.ok, false, "`asks` was accepted on a slot standing, where it names nothing");
  assert.match(out.why, /NAMED REFUSAL/);
});

test("⛔ and it can be answered: the ruling settles the case and the verdict names it", () => {
  /**
   * ⛔ THE HALF THAT WAS ALREADY BUILT. `settle` reads `asks` and keys on it — `whether: false`
   * retires the case outright. So the asking half was the whole gap, and this asserts the two
   * halves meet rather than that each works alone.
   */
  const dir = corpus();
  assert.ok(raiseQuestion(dir, asking({ ref: REF, asks: "whether" })).ok);

  const ruled = perform(
    dir,
    "rule",
    { slot: REF, pick: 2, refuses: true, because: "a reversal is an accounting correction, not permission to pay twice" },
    { by: "peter", via: "chat" }
  );
  assert.ok(ruled.ok, `the ruling was refused: ${ruled.why ?? ""}`);

  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the ruled corpus does not load: ${c.broken.map((b) => b.why).join("; ")}`);

  const kase = c.scopes
    .find((x) => x.scope.id === "payouts")
    .scope.exchanges[0].slots.refuses.outcomes.find((o) => o.name === "already-paid");
  assert.ok(!kase.standing?.question, "the question is still open after being ruled on");
  /** ⛔ `whether: true` means it DOES refuse — so the case keeps the words a person reads. */
  assert.equal(kase.told, "You already paid for this one.");

  const log = fs.readFileSync(path.join(dir, "verdicts", "rulings.yaml"), "utf8");
  assert.match(log, new RegExp(`settles: ${REF}`), "the verdict does not name the case it settled");
  assert.match(log, /chose: "option 2"/);
  assert.match(log, /also_considered/, "the option nobody picked is not recorded, so this gets relitigated");
});

test("⛔ the question a person READS says which part of the case is in question", () => {
  /**
   * ⛔ THE DEFECT THE fg-0002 FIX WOULD OTHERWISE HAVE INTRODUCED. `about` is prose and was being
   * rendered; `asks` is an enum and was not. So making `asks` the grain for a case made the
   * question a person reads strictly THINNER than before — "the case X is not ruled", and nothing
   * saying that picking an option here retires the case outright.
   *
   * Peter, on a question with no context: *"what the fuck does this even mean? ... makes ZERO
   * FUCKING SENSE"*. A correct address with an illegible question is not the feature.
   */
  const dir = corpus();
  assert.ok(raiseQuestion(dir, asking({ ref: REF, asks: "whether" })).ok);

  const owed = interviewFor(loadCorpus(dir), "payouts").owed;
  const q = owed.find((o) => JSON.stringify(o).includes("already-paid"));
  assert.ok(q, "the case question is not in the worklist at all");

  assert.match(q.asks, /whether it refuses here at all/, "the question never says which part is unruled");
  assert.match(q.asks, /retires this case/, "nothing tells the person that answering one way deletes the case");
});

test("⛔ and so does the check finding, from the same wording", () => {
  /** ⛔ TWO SURFACES, ONE SOURCE. `WHAT_IS_IN_QUESTION` is exported and read, never restated. */
  const dir = corpus();
  assert.ok(raiseQuestion(dir, asking({ ref: REF, asks: "told" })).ok);

  const found = checkCorpus(dir).findings.filter((f) => (f.where ?? "").includes("already-paid"));
  assert.ok(found.length, "the check says nothing about an unruled case");
  const what = found.flatMap((f) => (Array.isArray(f.what) ? f.what : [f.what])).join(" ");
  assert.match(what, /the words the asker reads/, "the finding does not say which part of the case is unruled");
  /** ⛔ On `told`, the words it says NOW are the thing being replaced, so they are shown. */
  assert.match(what, /You already paid for this one/, "a question about the wording does not show the current wording");
});
