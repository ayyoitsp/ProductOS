/**
 * ⛔ A PERSON STATES A SENTENCE, AND IT SETTLES EVERY CLAIM IT CAN VERIFY — AND NOT ONE MORE.
 *
 * Peter: *"second way is for them to say 'folders are restricited to be linked to a single deal'.
 * that shoudl be analyzed and the ones it enforces shoudl be marked true as well, with their
 * sentence logged as proof."* … *"and the truth gets applied to those it can verify"*.
 *
 * The second clause is the one these tests are about. Reach is a `Selector` — eight ANDed
 * dimensions, mechanical, cheap and wide — and a sentence reaches claims it does not establish.
 * One press marking all of them accepted records a person as having agreed to things they never
 * said, and an over-reach is indistinguishable from consent after the fact. So the interesting
 * case in this file is not the claim that settles; it is **the claim the selector reaches and the
 * sentence does not settle**, which must come back as a question.
 *
 * ⛔ EACH OF THESE WAS CONFIRMED BY PUTTING THE DEFECT BACK AND WATCHING IT GO RED. A test that
 * has never failed has not been shown to test anything, and the ones below guard the only failure
 * in this model that nothing downstream can detect.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { coveredBy, stampFor } = await import("../dist/v2/stamp.js");
const { applySentence, previewOf, claimWords, recordOf, isRefused, wordsIn, landsNowhere } =
  await import("../dist/v2/applies.js");

const seed = () => {
  const dir = temp("v2applies-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

/**
 * Peter's own example, in this corpus's words: a cardinality restriction on one of the product's
 * own things. *"folders are restricted to be linked to a single deal"* → a record of money belongs
 * to one kid.
 */
const CARDINALITY = {
  sentence:
    "A record of money belongs to exactly one kid — an act that names no kid, or more than one, is refused and nothing is recorded.",
  by: "peter",
  fills: ["refuses", "with"],
  mode: "supplies",
  in: "family-wallet",
  scope: { asked_by: "person", term: "money", acts_on: "changes" },
  outcomes: [
    { name: "no-kid-named", when: "the act names no kid", told: "which kid it is for is needed, and nothing was recorded" },
    {
      name: "more-than-one-kid-named",
      when: "the act names more than one kid",
      told: "a record is for one kid, and nothing was recorded",
    },
  ],
  read_by: "claude-opus-5",
};

/** A sentence that genuinely subsumes a claim already written — the one inferential ground. */
const SUBSUMES = {
  sentence:
    "Recording money a kid earned leaves them with exactly that much more than they had before, and changes nothing else about them.",
  by: "peter",
  fills: ["after"],
  mode: "supplies",
  in: "family-wallet",
  scope: { asked_by: "person", term: "money", acts_on: "changes" },
  read_by: "claude-opus-5",
};

const AFTER_EARNING = "money#record-earning#after";

const reading = (corpus, ref, over = {}) => ({
  ref,
  of: claimWords(corpus, ref),
  by: "claude-opus-5",
  settles: true,
  because:
    "the stated sentence commits to exactly that much more and to nothing else changing, which is everything this slot commits to",
  ...over,
});

// ---------------------------------------------------------------------------

test("the real seed: his example settles the two silent claims and asks about the two that speak", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  assert.ok(!isRefused(app), `refused: ${app.refused}`);

  assert.deepEqual(
    app.settles.map((s) => `${s.ref} (${s.ground})`),
    ["money#record-earning#refuses (silence)", "money#record-spending#refuses (silence)"],
    "the sentence settled something other than the two slots whose whole content it becomes",
  );
  assert.deepEqual(
    app.asks.map((a) => `${a.ref} (${a.why})`),
    ["money#record-earning#with (no-reading)", "money#record-spending#with (no-reading)"],
    "the two slots that state words of their own were not handed back as questions",
  );

  /**
   * ⛔ AND THE UNDER-REACH IS CORRECT RATHER THAN A SHORTFALL. `money#see-a-balance#with` says
   * *"Which kid."* — which this sentence arguably does settle — and the selector does not reach it,
   * because looking at money is not changing it. A read is a different question, which is the
   * whole reason `acts_on` exists. The cost of missing it is one more question; the cost of
   * settling it would be a promise about a read made out of a sentence about writes.
   */
  const touched = new Set([...app.settles, ...app.asks].map((x) => x.ref));
  assert.ok(!touched.has("money#see-a-balance#with"), "a sentence about changing money reached a pure read");
  /** ⛔ And nothing a clock asks, which is the `asked_by` lesson the schema records. */
  for (const ref of [...touched]) assert.ok(!ref.startsWith("money#apply-a-standing-allowance"));
  assert.equal(app.untouched, 36);
});

test("⛔ a claim the selector reaches and the sentence does not settle is ASKED, never settled", () => {
  /**
   * THE CRITICAL CASE, and the only one worth writing this file for.
   *
   * `money#record-earning#with` says *"Which kid, an amount, and what it was for. What it was for
   * may be left blank."* The stated sentence settles the kid part and says nothing about the amount
   * or about what-it-was-for being optional. It is inside the reach and it is not verified.
   *
   * Red-first: `relation === "on-top-of-words"` falling through to `settle(...)` instead of
   * `ask("no-reading", …)` turns both of these into acceptances, and this goes red on the first
   * assertion.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  const ref = "money#record-earning#with";

  const { displaced } = resolveRules({
    ...corpus,
    rules: [...corpus.rules, { rule: app.rule, body: "", file: "(stated)" }],
  });
  assert.ok(
    (displaced.get(ref) ?? []).some((r) => r.id === app.rule.id),
    "the fixture ref is not even reached — this test would pass for the wrong reason",
  );

  assert.ok(!app.settles.some((s) => s.ref === ref), `${ref} was marked settled by a sentence that does not say it`);
  const asked = app.asks.find((a) => a.ref === ref);
  assert.equal(asked?.why, "no-reading");
  assert.equal(asked?.says, "Which kid, an amount, and what it was for. What it was for may be left blank.");
});

test("a claim the sentence does not touch at all is neither settled nor asked", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  const untouched = "tasks#complete-a-task#may";
  assert.ok(!app.settles.some((s) => s.ref === untouched));
  assert.ok(!app.asks.some((a) => a.ref === untouched));
  assert.ok(!app.rules.some((r) => r.ref === untouched));
});

// ---------------------------------------------------------------------------
// The inferential ground, and the four ways it is refused.

test("a judgement about one claim settles it, and says who read it that way", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, SUBSUMES, [reading(corpus, AFTER_EARNING)]);
  assert.ok(!isRefused(app), `refused: ${app.refused}`);

  const s = app.settles.find((x) => x.ref === AFTER_EARNING);
  assert.ok(s, `${AFTER_EARNING} was not settled`);
  assert.equal(s.ground, "read-as-settling");
  /** ⛔ The model, never the person — the two authors stay apart in the record. */
  assert.equal(s.read_by, "claude-opus-5");
  assert.notEqual(s.read_by, app.by);
  assert.match(s.because, /commits to/);

  /** ⛔ And the argument is ON THE LIST the person reads, beside the words it is about. */
  const lines = previewOf(app).join("\n");
  assert.match(lines, /The kid has that much more than they had before\./);
  assert.match(lines, /a reading of the sentence, not the sentence itself/);
});

test("⛔ a judgement about words that have since changed does not settle — it asks", () => {
  /**
   * THE OVER-REACH GUARD, and the sharpest form of it: a judgement that outlives the sentence it
   * read is consent attached to words nobody saw, which is exactly what `stamp.ts`'s three stale
   * states exist to prevent, one layer earlier.
   *
   * Red-first: comparing `reading.of` loosely — or not at all — makes this go red here.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const stale = reading(corpus, AFTER_EARNING, { of: "The kid has that much more than they had before, rounded down." });
  const app = applySentence(corpus, SUBSUMES, [stale]);

  assert.ok(!app.settles.some((s) => s.ref === AFTER_EARNING), "a stale judgement settled a claim");
  assert.equal(app.asks.find((a) => a.ref === AFTER_EARNING)?.why, "reading-is-stale");
});

test("a judgement with no argument in it does not settle", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, SUBSUMES, [reading(corpus, AFTER_EARNING, { because: "yes" })]);
  assert.equal(app.asks.find((a) => a.ref === AFTER_EARNING)?.why, "reading-is-bare");
  assert.ok(!app.settles.length);
});

test("a judgement that says no is reported with its reason", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, SUBSUMES, [
    reading(corpus, AFTER_EARNING, {
      settles: false,
      because: "the slot says nothing about anything else staying the same, so the sentence says more than it does",
    }),
  ]);
  const asked = app.asks.find((a) => a.ref === AFTER_EARNING);
  assert.equal(asked?.why, "read-as-not-settling");
  assert.match(asked.question, /says more than it does/);
});

test("⛔ a judgement cannot add a claim the selector never reached", () => {
  /**
   * Reach is the selector's and nothing else's, because `check` has to be able to invert it. A
   * judgement handed in for a ref outside the reach is not an error and is not an extension — it
   * is simply not consulted.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const outside = "tasks#complete-a-task#may";
  const app = applySentence(corpus, SUBSUMES, [
    { ref: outside, of: claimWords(corpus, outside), by: "claude-opus-5", settles: true, because: "x".repeat(60) },
  ]);
  assert.ok(!app.settles.some((s) => s.ref === outside), "a judgement widened the reach of a sentence");
  assert.ok(!app.asks.some((a) => a.ref === outside));
});

// ---------------------------------------------------------------------------
// The things a sentence must never quietly do.

test("⛔ an open slot is RULED, never accepted — it has no sentence to agree to", () => {
  /**
   * `money#record-spending#after` stands open, with two drafted candidates and a cost. Accepting it
   * would be agreeing to a blank; writing the stated sentence into it is a `rule` act with its own
   * floors and its own record of which candidate was chosen. Folding the two together would have
   * one press both agree to a sentence and author one.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, SUBSUMES, [reading(corpus, AFTER_EARNING)]);
  const open = "money#record-spending#after";
  assert.ok(!app.settles.some((s) => s.ref === open), "an unanswered question was marked accepted");
  assert.deepEqual(app.rules.map((r) => r.ref), [open]);
  assert.match(previewOf(app).join("\n"), /would ANSWER 1 open question/);
});

test("⛔ a slot somebody deliberately declined to answer is not overwritten by a new sentence", () => {
  /**
   * `out_of_scope` is a declaration that cost a reason, an owner and a date — the schema calls it
   * *"a stronger claim than admitting you do not know"*. Reading it as silence is how a waiver gets
   * laundered into agreement by a sentence that merely happened to reach it.
   *
   * Red-first: treating `out_of_scope` as silence settles this ref and this goes red.
   */
  const dir = seed();
  const file = path.join(dir, "truth", "money.md");
  const before = fs.readFileSync(file, "utf-8");
  fs.writeFileSync(
    file,
    before.replace(
      "      with:\n        says: Which kid, an amount, and what it was for.",
      "      refuses:\n        standing:\n          kind: out_of_scope\n" +
        "          because: nothing here refuses beyond the form's own checks, and that is deliberate\n" +
        "          answered_by: peter\n          answered_at: 2026-10-01\n" +
        "      with:\n        says: Which kid, an amount, and what it was for.",
    ),
  );
  const corpus = loadCorpus(dir);
  assert.deepEqual(corpus.broken, [], "the fixture edit did not parse");
  assert.equal(
    corpus.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === "record-earning").slots
      .refuses.standing.kind,
    "out_of_scope",
  );

  const app = applySentence(corpus, CARDINALITY);
  const ref = "money#record-earning#refuses";
  assert.ok(!app.settles.some((s) => s.ref === ref), "a declared waiver was quietly accepted");
  assert.equal(app.asks.find((a) => a.ref === ref)?.why, "declared");
});

test("⛔ a stated sentence cannot reach every product in the corpus at once", () => {
  /**
   * `everywhere: true` is sayable in the schema because an author may genuinely mean it — and an
   * author has typed it into a file and can be asked why. Landing it off the back of one English
   * sentence chooses the widest blast radius in the model invisibly: the person pressing sees a
   * list either way. The schema records what that costs — a school tuck shop volunteer handed
   * *"Only a parent may change what a kid has"*.
   */
  const dir = seed();
  const app = applySentence(loadCorpus(dir), { ...CARDINALITY, in: undefined, scope: { everywhere: true } });
  assert.ok(isRefused(app));
  assert.match(app.refused, /every product in this corpus/);
});

test("⛔ a selector may not select on a word the sentence does not say", () => {
  /**
   * `term:` is the dimension that widens reach fastest, and a reading that picks a word the person
   * never said has invented reach out of nothing rather than aiming it wrongly.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, { ...CARDINALITY, scope: { asked_by: "person", term: "task", acts_on: "changes" } });
  assert.ok(isRefused(app));
  assert.match(app.refused, /does not say that word/);
  /** And the refusal says which words it DOES use, so the reading can be corrected rather than retried. */
  assert.match(app.instead, /"money"|"kid"/);

  assert.deepEqual(wordsIn(corpus, CARDINALITY.sentence, "family-wallet").sort(), ["kid", "money"]);
});

// ---------------------------------------------------------------------------
// What a person sees, and what gets written.

test("⛔ the preview enumerates every settled claim in full and never counts instead of showing", () => {
  /**
   * `stamp.ts` learned this: the accept preview said *"and its 5 criteria as they stand now"* and
   * showed none, while the stamp covered every word of them. One press over N claims is the most
   * powerful act in the product, so the list is the guarantee — no policing of a judgement makes a
   * judgement right.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  const lines = previewOf(app);

  assert.match(lines.join("\n"), new RegExp(CARDINALITY.sentence.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const s of app.settles) {
    assert.ok(lines.some((l) => l.includes(s.ref)), `${s.ref} is settled and not on the list`);
    /** Every line the stamp will cover is on the list, so what is shown and what is covered agree. */
    for (const covered of s.reads)
      assert.ok(lines.some((l) => l.includes(covered)), `a line the stamp covers is not shown: ${covered}`);
  }
  /**
   * ⛔ AND WHAT EACH SLOT WILL SAY ONCE THE SENTENCE LANDS. On the `silence` ground the slot's own
   * words are "(nothing)", so a preview that shows only those shows a person nothing at all — which
   * is what `coveredBy` does today at slot grain, and the reason this is asserted here.
   */
  const willSay = lines.filter((l) => l.includes("it will say:"));
  assert.equal(willSay.length, app.settles.length, "a settled claim does not say what it will promise");
  for (const l of willSay) assert.ok(l.includes(CARDINALITY.sentence), "the sentence that will stand there is not shown");
  /** The named cases too — a refusal is named, never described, and the names are the implementable part. */
  for (const o of CARDINALITY.outcomes)
    assert.ok(lines.some((l) => l.includes(`refuses ${o.name} when`)), `${o.name} is covered and not shown`);
  for (const a of app.asks) assert.ok(lines.some((l) => l.includes(a.ref)), `${a.ref} is asked and not on the list`);
  assert.ok(lines.some((l) => /untouched by it/.test(l)));
  assert.ok(!lines.some((l) => /and \d+ more/.test(l)), "the list was truncated");
});

test("the record: one sentence, one acceptance per claim, each naming the sentence it came through", () => {
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  const spliced = { ...corpus, rules: [...corpus.rules, { rule: app.rule, body: "", file: "(stated)" }] };
  const rec = recordOf(app, { by: "peter", at: "2026-10-16", via: "page" });
  assert.ok(!isRefused(rec));

  assert.equal(rec.rule.target, app.rule.id);
  assert.equal(rec.claims.length, app.settles.length);
  for (const [i, c] of rec.claims.entries()) {
    assert.equal(c.kind, "accept");
    assert.equal(c.by, "peter");
    assert.equal(c.target, app.settles[i].ref);
    /** ⛔ Named as reached THROUGH the sentence, so no surface can show it as a direct press. */
    assert.equal(c.through, app.rule.id);
    /** ⛔ Software's reading, in its own field, attributed to whoever read it. */
    assert.equal(c.reading, app.settles[i].because);
    assert.equal(c.read_by, app.settles[i].read_by);
    /**
     * ⛔ Its own hashes and its own text, so each claim goes stale at its own pace — and hashed
     * against the corpus WITH the sentence in it, because that is the corpus the verdict is
     * written against. Hashing today's corpus would produce a stamp stale the instant the sentence
     * it is made of arrives.
     */
    assert.equal(c.covers_slots, coveredBy(spliced, c.target).slots);
    assert.ok(c.covered_text.length, "a claim was recorded with no record of what it said");
  }
  /** ⛔ Every claim individually staleable means every pair of hashes is its own. */
  assert.equal(new Set(rec.claims.map((c) => c.covers_slots)).size, rec.claims.length);

  /**
   * ⛔ AND A MEASURED HOLE, WHICH IS WHY `through` CANNOT BE DECORATION.
   *
   * At SLOT grain `coveredBy` looks a resolved rule up as `` `${target}#${slot}` `` while `target`
   * already carries the slot, so every inherited and constraining rule drops out of the hash. The
   * assertion below is the measurement: the hash of a slot the sentence entirely supplies is the
   * same with the sentence and without it. So a per-claim verdict carrying only these two hashes
   * would survive the sentence being reworded underneath it — the exact failure `stamp.ts`'s header
   * records ("reword an accepted org-wide RULE, and both exchanges that inherited it stay stamped").
   *
   * Which fixes the semantics of `through` rather than merely explaining a bug: a claim settled
   * through a sentence stands only while that sentence's OWN stamp is current, exactly as
   * `acceptedThroughRule` already requires. The next test proves that, and the `coveredBy` fix
   * belongs in `stamp.ts`.
   */
  /**
   * ⛔ AND THE HOLE IS CLOSED, SO THIS ASSERTION IS NOW ITS INVERSE.
   *
   * When this test was written, `coveredBy` looked a resolved rule up as `` `${target}#${slot}` ``
   * while `target` already carried the slot — so at slot grain every inherited rule dropped out of
   * the hash, and the hash of a slot the sentence entirely supplies was IDENTICAL with the sentence
   * and without it. The note left here said so, and said it could go once `stamp.ts` was fixed.
   *
   * It has been (`6426db5`): the lookup is built from the exchange, not from `target`. So a claim's
   * own hash now MOVES when the sentence that settles it is reworded, and `through` can lean on it
   * rather than needing a mechanism of its own.
   *
   * Asserted as a difference rather than deleted, because the property is what makes this safe: a
   * per-claim verdict that did not move with its sentence would survive the sentence being reversed
   * underneath it.
   */
  for (const c of rec.claims)
    assert.notEqual(
      c.covers_slots,
      coveredBy(corpus, c.target).slots,
      "the claim's hash is the same with the sentence and without it, so a settled claim would outlive the sentence being reworded",
    );
});

// ---------------------------------------------------------------------------

test("⛔ end to end: filing the sentence and agreeing to it reads accepted at exactly the settled claims", () => {
  /**
   * THE BACK HALF ALREADY SHIPPED, AND THIS PROVES THE FRONT HALF MEETS IT. `acceptedThroughRule`
   * recognises one confirmation at every ref where the sentence is the whole content of the slot —
   * so for the `silence` ground this needs no new field and no new mechanism at all: file the rule,
   * accept the rule, and `stampFor` says `accepted / through`.
   *
   * ⛔ And it says `never` at the two claims the same selector reached and the sentence did not
   * settle, which is the whole distinction this file is about, asserted against the shipped stamp
   * rather than against my own derivation.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, CARDINALITY);
  const r = app.rule;

  fs.writeFileSync(
    path.join(dir, "rules", `${r.id}.md`),
    [
      "---",
      `id: ${r.id}`,
      "statement: >",
      `  ${r.statement}`,
      `in: ${r.in}`,
      `fills: [${r.fills.join(", ")}]`,
      `mode: ${r.mode}`,
      "scope:",
      `  asked_by: ${r.scope.asked_by}`,
      `  term: ${r.scope.term}`,
      `  acts_on: ${r.scope.acts_on}`,
      "outcomes:",
      ...r.outcomes.flatMap((o) => [`  - name: ${o.name}`, `    when: ${o.when}`, `    told: ${o.told}`]),
      "---",
      "",
      "Stated by peter, and applied to what it can verify.",
      "",
    ].join("\n"),
  );

  const filed = loadCorpus(dir);
  assert.deepEqual(filed.broken, [], `the filed sentence did not parse: ${JSON.stringify(filed.broken)}`);
  const cov = coveredBy(filed, r.id);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "stated.yaml"),
    `verdicts:\n  - kind: accept\n    by: peter\n    at: 2026-10-16\n    target: ${r.id}\n    via: page\n` +
      `    covers_slots: ${cov.slots}\n    covers_criteria: ${cov.criteria}\n` +
      `    because: a record of money belongs to exactly one kid, across the whole product\n    resolves: []\n`,
  );

  const after = loadCorpus(dir);
  for (const s of app.settles) {
    const st = stampFor(after, s.ref);
    assert.equal(st.state, "accepted", `${s.ref} was settled by the sentence and reads ${st.state}`);
    assert.equal(st.through, r.id, `${s.ref} does not say which sentence settled it`);
  }
  for (const a of app.asks)
    assert.equal(stampFor(after, a.ref).state, "never", `${a.ref} was asked about and reads accepted anyway`);

  /**
   * ⛔ AND IT IS REVERSIBLE BY REWORDING THE SENTENCE, WHICH IS THE WHOLE ANSWER TO ONE PRESS
   * COVERING MANY CLAIMS.
   *
   * A year later somebody edits the sentence. Every claim settled through it stops reading accepted
   * — because they were never a set of independent stamps, they were one confirmation recognised
   * wherever that sentence stands. Nobody has to remember which seven claims a press reached.
   */
  fs.writeFileSync(
    path.join(dir, "rules", `${r.id}.md`),
    fs
      .readFileSync(path.join(dir, "rules", `${r.id}.md`), "utf-8")
      .replace("belongs to exactly one kid", "may be split across any number of kids"),
  );
  const reworded = loadCorpus(dir);
  assert.deepEqual(reworded.broken, []);
  for (const s of app.settles)
    assert.equal(
      stampFor(reworded, s.ref).state,
      "never",
      `${s.ref} still reads accepted after the sentence it was settled through was reversed`,
    );

  /** ⛔ And one claim at a time: excepting the sentence at one exchange leaves the other alone. */
  const file = path.join(dir, "truth", "money.md");
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf-8")
      .replace(
        "  - id: record-spending\n    title: A parent records something a kid spent\n",
        "  - id: record-spending\n    title: A parent records something a kid spent\n" +
          `    excepts:\n      - rule: ${r.id}\n        because: a refund can be split between two kids, so this one really does name more than one\n`,
      ),
  );
  const excepted = loadCorpus(dir);
  assert.deepEqual(excepted.broken, []);
  const { inherited } = resolveRules(excepted);
  assert.ok(!inherited.has("money#record-spending#refuses"), "an excepted claim still inherits the sentence");
  assert.ok(inherited.has("money#record-earning#refuses"), "excepting one claim removed the sentence from another");
});

test("a sentence that lands nowhere says so rather than failing", () => {
  /**
   * `check` already refuses `rule-governs-nothing` on an authored rule. The same fact about a
   * stated one is an answer, not an error: the sentence is worth keeping, because it will govern
   * exchanges nobody has written yet — which is the difference between a rule and a convention.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const app = applySentence(corpus, {
    ...CARDINALITY,
    in: "tasks",
    scope: { asked_by: "system", term: "money", acts_on: "changes" },
  });
  assert.ok(!isRefused(app), `refused: ${app.refused}`);
  assert.ok(landsNowhere(corpus, app));
  assert.deepEqual(app.settles, []);
  assert.deepEqual(app.asks, []);
  assert.match(previewOf(app).join("\n"), /settles nothing/);
});
