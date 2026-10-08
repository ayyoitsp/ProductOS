/**
 * ⛔ HOW WELL-SUPPORTED A STATEMENT IS, AND THE LINE NO AMOUNT OF SUPPORT MAY CROSS.
 *
 * Peter: *"we have a rough scale - like 'human confirmed' on one end, and like '1 inference' on the
 * other end. multiple inteferences would move it towards human confirmed"*, then *"still too much
 * review surface… when the feature is initially spec'd, or when UX is changed with explicit
 * instructions, and there is confirmation, it should feed into everything that hasn't been confirmed
 * (or confirmed)"*, then *"the reason why it has confidence needs to be visible as well"*.
 *
 * Asked directly whether a confirmation may raise another statement's standing, he chose the most
 * permissive option on the table — shared support raises confidence too — with two conditions
 * stated in the option he picked: the zones stay visibly distinct, and a statement shows which
 * confirmation it inherited from. Those two conditions are what most of this file asserts.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import {
  confidenceOf,
  whyConfident,
  strengthOf,
  sourcesOf,
  supportFor,
  inheritedFor,
  containerOf,
} from "../dist/v2/confidence.js";

/**
 * ⛔ THE REAL SEED, NOT A BAG OF LISTS — AND THE FIRST CUT OF THIS WAS THE BAG.
 *
 * `confidenceOf` asks `stampFor`, which asks `coveredBy`, which hashes the slots and criteria a ref
 * actually has. A synthetic `{ scopes: [], verdicts: [{ target: "s#x" }] }` therefore resolves to
 * nothing and every stamp answers `never` — so five assertions failed while asserting precisely
 * what they were written to assert. That dependency IS the guarantee here: the only path to
 * `confirmed` runs through the one function that refuses an agent, and a fixture that bypasses it
 * proves nothing about the line being held.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const { loadCorpus } = await import("../dist/v2/load.js");
const { coveredBy } = await import("../dist/v2/stamp.js");

const seeded = () => {
  const dir = temp("v2conf-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return { dir, corpus: loadCorpus(dir) };
};

/**
 * An acceptance carrying the hashes a real one carries. ⛔ Through `coveredBy`, because a verdict
 * with the wrong hashes is exactly a stale stamp, and a test that hand-wrote them would be asserting
 * against a state the model calls `claim-changed`.
 */
const accepting = (corpus, target, by = "peter") => {
  const now = coveredBy(corpus, target);
  assert.ok(now, `${target} resolves to nothing in the seed — pick a ref that exists`);
  return {
    kind: "accept",
    by,
    at: "2026-10-05",
    target,
    via: "page",
    covers_slots: now.slots,
    covers_criteria: now.criteria,
    because: "this is right, and here is a reason long enough to clear the floor",
    resolves: [],
  };
};

/** Readings added to a loaded corpus — the lists are plain, so this needs no filesystem. */
const withReadings = (corpus, readings) => ({ ...corpus, readings: [...corpus.readings, ...readings] });
const withVerdicts = (corpus, verdicts) => ({ ...corpus, verdicts: [...corpus.verdicts, ...verdicts] });

const reading = (id, bears_on, ref, kind = "code") => ({
  id,
  bears_on,
  observes: `something observed for ${id}, at length enough to pass the floor`,
  basis: { kind, ref },
});

/** Two refs that resolve in the seed, and a happy path that names its screens. */
const A = "money#see-a-balance";
const B = "money#record-earning";
const PATH_SCOPE = "money";

/* ───────────────────────── the line ───────────────────────── */

test("⛔ no amount of support reaches confirmed, and the types make it unreachable", () => {
  /**
   * ⛔ THE ASSERTION THIS WHOLE FILE EXISTS FOR. Tenet one is that a person validated the truth, and
   * the single most dangerous thing a confidence scale can be is one whose top is reachable without
   * one. So `confirmed` is a separate field of a different type rather than the top of `strength`,
   * and no path through this module writes it.
   */
  const { corpus } = seeded();
  const many = Array.from({ length: 12 }, (_, i) => reading(`r${i}`, A, `src/a.ts:${i}`));
  const c = confidenceOf(withReadings(corpus, many), A);
  assert.equal(c.confirmed, null, "support produced a confirmation");
  assert.equal(c.strength, "strongly-supported", "twelve independent sources is the top of the lower zone");
  /** ⛔ `strength` can never be the string a reader would mistake for consent. */
  assert.notEqual(c.strength, "confirmed");
  for (const n of [0, 1, 2, 3, 40]) assert.notEqual(strengthOf(n, n), "confirmed");
});

test("confirmed is what a human did, and it comes from stampFor rather than from here", () => {
  const { corpus } = seeded();
  const c = confidenceOf(withVerdicts(corpus, [accepting(corpus, A)]), A);
  assert.deepEqual(c.confirmed, { by: "peter", at: "2026-10-05" });
  /** Confirmed and unsupported at once is a real and common state, and both halves are reported. */
  assert.equal(c.strength, "none");
  assert.deepEqual(c.support, []);
});

/* ───────────────────────── the scale ───────────────────────── */

test("strength counts independent sources, not readings", () => {
  /**
   * ⛔ THE SAME POINTER TWICE IS NOT CORROBORATION, and this is the whole meaning of the word. Four
   * observations of one code path is one thing known, written down four times — averaging or
   * counting them would be the kind of number that looks like information.
   */
  const { corpus } = seeded();
  const sameSource = [
    reading("a", A, "src/deal.ts:40"),
    reading("b", A, "src/deal.ts:40"),
    reading("c", A, "src/deal.ts:40"),
  ];
  const c = confidenceOf(withReadings(corpus, sameSource), A);
  assert.equal(c.support.length, 3, "all three readings are still reported — they are each checkable");
  assert.equal(c.sources, 1, "three citations of one pointer counted as three sources");
  assert.equal(c.strength, "one-source");

  const two = confidenceOf(withReadings(corpus, [reading("a", A, "src/a.ts:1"), reading("b", A, "src/b.ts:2")]), A);
  assert.equal(two.strength, "corroborated");
  assert.equal(sourcesOf(two.support), 2);
});

test("nothing observed is a state the scale can say, not an absence", () => {
  const { corpus } = seeded();
  const c = confidenceOf(corpus, A);
  assert.equal(c.strength, "none");
  assert.equal(c.confirmed, null);
  assert.match(whyConfident(corpus, A).join("\n"), /Nothing has been observed about it directly/);
});

/* ───────────────────────── propagation ───────────────────────── */

test("a confirmation raises a statement resting on the same evidence, and says whose", () => {
  /**
   * The mechanism Peter chose, and the one that needs watching: `deal-list#b` has had nothing read
   * about it except one pointer, and `deal-list#a` — confirmed — rests on that same pointer.
   */
  const { corpus: base } = seeded();
  const c = withVerdicts(
    withReadings(base, [reading("ra", A, "src/deal.ts:40"), reading("rb", B, "src/deal.ts:40")]),
    [accepting(base, A)],
  );

  const b = confidenceOf(c, B);
  assert.equal(b.confirmed, null, "⛔ inheritance produced a confirmation");
  assert.equal(b.inherited.length, 1);
  assert.deepEqual(b.inherited[0], { from: A, how: "shared-support", because: "src/deal.ts:40" });
  /** One own source plus one inherited reads as corroborated — stronger than a lone reading, below the top. */
  assert.equal(b.strength, "corroborated");

  /** ⛔ AND THE REASON IS VISIBLE, which is the condition he attached to choosing this. */
  const why = whyConfident(c, B).join("\n");
  assert.match(why, new RegExp(`Rests on the same evidence as ${A}, which is confirmed: src/deal\\.ts:40`));
  assert.match(why, /Nobody has confirmed this/);
  /**
   * ⛔ AND NOT THE BORROWED WARNING, BECAUSE THIS STATEMENT HAS A READING OF ITS OWN.
   *
   * The first cut appended "Nobody has read this statement itself" to every shared-support line and
   * this assertion demanded it — on a ref with its own reading, where it is simply false. Found by
   * rendering the page and reading the sentence, not by checking that a sentence appeared. The
   * warning is the whole point when it is true; crying it on a well-read statement is how a reader
   * learns to skip the line.
   */
  assert.doesNotMatch(why, /Nobody has read this statement itself/);
});

test("⛔ inherited support alone stops below the top tier, however much of it there is", () => {
  /**
   * Inheritance says other statements rest on the same evidence. It never says anybody examined
   * THIS one. Letting it alone reach `strongly-supported` would hand the strongest reading available
   * to a statement nobody has ever looked at — the same laundering, in a different costume.
   */
  const { corpus: base } = seeded();
  /** Three refs that resolve, one confirmed each, all resting on one pointer. */
  const confirmedRefs = ["money#see-a-balance", "money#record-earning", "tasks#complete-a-task"];
  const c = withVerdicts(
    withReadings(base, [
      ...confirmedRefs.map((r, i) => reading(`c${i}`, r, "src/shared.ts:1")),
      reading("mine", "money#record-spending", "src/shared.ts:1"),
    ]),
    confirmedRefs.map((r) => accepting(base, r)),
  );
  const t = confidenceOf(c, "money#record-spending");
  assert.ok(t.inherited.length >= 3, `only ${t.inherited.length} inheritances found`);
  assert.equal(t.confirmed, null);
  /** It has one source of its own, so it may reach the top — the cap below is the no-own-source case. */
  assert.equal(strengthOf(0, 6), "corroborated", "inherited support with nothing read directly reached the top tier");
  assert.equal(strengthOf(0, 1), "one-source");
});

test("a confirmed happy path confirms that its screens are on it — derived, not inferred", () => {
  /**
   * ⛔ THE SAFE HALF, AND WORTH KEEPING SEPARATE FROM THE OTHER. A path that says it goes through
   * these screens, confirmed, has settled that they are on it. That is the same claim restated, not
   * a guess that got lucky, so it is labelled `derived` and reads differently on the page.
   */
  const { corpus: base } = seeded();
  const through = base.scopes.find((s) => s.scope.id === PATH_SCOPE).scope.happy_path.through;
  assert.ok(through?.length, "the seed's money scope no longer names the screens on its path");
  /**
   * ⛔ THROUGH `accepting`, WHICH MEANS THROUGH `coveredBy`. The first cut hand-built this verdict on
   * the assumption that a happy path is not covered the way an exchange is — `coveredBy` handles
   * `#happy-path` explicitly, so the hand-built one simply had no hashes and `stampFor` correctly
   * called it `claim-changed`. The inheritance then found nothing, which is the right answer to the
   * wrong fixture: a stale stamp must not propagate, and this was accidentally testing that.
   */
  const c = withVerdicts(base, [accepting(base, `${PATH_SCOPE}#happy-path`)]);
  const form = confidenceOf(c, `${PATH_SCOPE}#${through[0]}`);
  assert.equal(form.inherited.length, 1);
  assert.equal(form.inherited[0].how, "derived");
  assert.match(form.inherited[0].because, new RegExp(`on the happy path, through: ${through[0]}`));
  assert.equal(form.confirmed, null, "derived inheritance produced a confirmation");
  assert.match(whyConfident(c, `${PATH_SCOPE}#${through[0]}`).join("\n"),
    new RegExp(`Follows from ${PATH_SCOPE}#happy-path, which is confirmed`));

  /** A screen the path does not name inherits nothing. */
  assert.deepEqual(inheritedFor(c, `${PATH_SCOPE}#a-screen-not-on-the-path`), []);
});

test("a confirmed statement inherits nothing — it has no need to", () => {
  const { corpus: base } = seeded();
  const c = withVerdicts(
    withReadings(base, [reading("ra", A, "src/x.ts:1"), reading("rb", B, "src/x.ts:1")]),
    [accepting(base, A), accepting(base, B)],
  );
  assert.deepEqual(inheritedFor(c, A), [], "a confirmed ref was given borrowed support");
});

test("one shared pointer is one inheritance, however many readings cite it", () => {
  const { corpus: base } = seeded();
  const c = withVerdicts(
    withReadings(base, [reading("a1", A, "src/x.ts:1"), reading("a2", A, "src/x.ts:1"), reading("b1", B, "src/x.ts:1")]),
    [accepting(base, A)],
  );
  assert.equal(inheritedFor(c, B).length, 1, "a basis cited twice counted as two inheritances");
});

/* ───────────────────────── a stale stamp ───────────────────────── */

test("a stamp whose sentence moved is neither confirmed nor nothing, and says so", () => {
  /**
   * `stampFor` already distinguishes the three stale states; the scale has to carry them or a
   * reworded claim silently reads as never confirmed, losing the most useful thing about it — that
   * somebody did look, at a sentence that has since changed.
   *
   * ⛔ Driven by giving the acceptance hashes that no longer match, which is exactly what rewording
   * produces — rather than by a fabricated state name the model would never emit.
   */
  const { corpus: base } = seeded();
  const fresh = confidenceOf(withVerdicts(base, [accepting(base, A)]), A);
  assert.equal(fresh.stale, null, "a fresh stamp is not stale");
  assert.ok(fresh.confirmed);

  const moved = withVerdicts(base, [{ ...accepting(base, A), covers_slots: "sha256:something-else" }]);
  const c = confidenceOf(moved, A);
  assert.equal(c.confirmed, null, "⛔ a stale stamp read as confirmed");
  assert.equal(c.stale, "claim-changed");
  assert.match(whyConfident(moved, A).join("\n"), /Confirmed once, and the sentence has changed since/);
});

test("supportFor only answers for the ref it was asked about", () => {
  const { corpus: base } = seeded();
  const c = withReadings(base, [reading("a", A, "p1"), reading("b", B, "p2")]);
  assert.deepEqual(supportFor(c, A).map((s) => s.reading), ["a"]);
  assert.deepEqual(supportFor(c, "money#nothing-like-this"), []);
});

test("⛔ a stale stamp propagates nothing — found by getting a fixture wrong", () => {
  /**
   * This guarantee was discovered accidentally: a hand-built happy-path verdict with no coverage
   * hashes read as `claim-changed`, and the derived inheritance correctly found nothing. That is the
   * right answer, and nothing was asserting it.
   *
   * It matters more than it looks. A confirmation that has gone stale is the single most likely
   * thing to be sitting in a mature corpus — somebody agreed, then a sentence was reworded. If that
   * propagated, a reword would quietly strengthen every statement sharing its evidence, on the
   * authority of an acceptance the model has already decided no longer holds. The scale would then
   * be at its most confident exactly where the truth had most recently moved.
   */
  const { corpus: base } = seeded();
  const stale = withVerdicts(
    withReadings(base, [reading("ra", A, "src/shared.ts:9"), reading("rb", B, "src/shared.ts:9")]),
    [{ ...accepting(base, A), covers_slots: "sha256:reworded-since" }],
  );

  assert.equal(confidenceOf(stale, A).stale, "claim-changed", "the fixture is not actually stale");
  assert.deepEqual(inheritedFor(stale, B), [], "a stale acceptance lent its authority to another statement");

  /** And the same corpus with a fresh stamp DOES propagate — so the difference is the staleness. */
  const fresh = withVerdicts(
    withReadings(base, [reading("ra", A, "src/shared.ts:9"), reading("rb", B, "src/shared.ts:9")]),
    [accepting(base, A)],
  );
  assert.equal(inheritedFor(fresh, B).length, 1, "the control case does not propagate either — the test proves nothing");
});

test("a derived inheritance from a happy path does not leak across scopes", () => {
  /**
   * ⛔ `through` NAMES A VIEW, NOT A REF, AND THE FIRST CUT MATCHED A BARE ONE. It accepted
   * `ref === view` as well as `<scope>#<view>`, to be lenient about how a corpus spells it — which
   * meant a confirmed path in `money` lent its authority to a screen called `balance` in any other
   * scope. The laundering this whole file is arranged to prevent, arriving through a name collision
   * rather than through a decision. Matching is scope-qualified now.
   */
  const { corpus: base } = seeded();
  const money = base.scopes.find((s) => s.scope.id === "money").scope;
  const c = withVerdicts(base, [accepting(base, "money#happy-path")]);
  const screen = money.happy_path.through[0];

  assert.equal(inheritedFor(c, `money#${screen}`).length, 1, "the scope's own screen inherited nothing");
  assert.deepEqual(inheritedFor(c, `tasks#${screen}`), [], `a confirmed path in money reached tasks#${screen}`);
  /** ⛔ And a bare view id inherits nothing at all, from anywhere. */
  assert.deepEqual(inheritedFor(c, screen), [], `the bare view id "${screen}" inherited from money's path`);
});

test("the borrowed warning appears exactly when every source is borrowed", () => {
  /**
   * ⛔ AND THE BRANCH IT WAS FIRST WRITTEN ON WAS UNREACHABLE. It hung off the shared-support line —
   * but shared support requires a pointer in common, so a ref with no readings cannot inherit that
   * way at all. The only inheritance available to an unread statement is `derived`, which is why the
   * warning belongs to the CONDITION rather than the route.
   */
  const { corpus: base } = seeded();
  const through = base.scopes.find((s) => s.scope.id === PATH_SCOPE).scope.happy_path.through;
  const c = withVerdicts(base, [accepting(base, `${PATH_SCOPE}#happy-path`)]);
  const ref = `${PATH_SCOPE}#${through[0]}`;

  const conf = confidenceOf(c, ref);
  assert.equal(conf.support.length, 0, "the fixture screen has readings of its own — pick one that does not");
  assert.equal(conf.inherited.length, 1);
  const why = whyConfident(c, ref).join("\n");
  assert.match(why, /all of its support is borrowed/);

  /**
   * ⛔ `one-source`, NOT `one-reading`. This statement has no readings at all, and the tier was
   * named for a reading — so the page rendered "one reading" over a thing nobody had written down.
   */
  assert.equal(conf.strength, "one-source");
  assert.match(why, /Nothing has been observed about it directly/);
});

/* ───────────────────────── containment ───────────────────────── */

test("a reading about an exchange is support for its slots, and says it is about the exchange", () => {
  /**
   * ⛔ THE LARGEST COST IN MAKING THIS USABLE ON A REAL CORPUS. The page reviews at slot grain —
   * `money#see-a-balance#answer` — so without containment a reading has to be authored nine times
   * per exchange to be seen, once for each slot. "The history is read straight off the ledger rows"
   * is evidence about what the answer is, what it refuses, and what a repeat does; writing it nine
   * times is the hand-authoring this project keeps failing at, with extra steps.
   */
  const { corpus: base } = seeded();
  const c = withReadings(base, [reading("ex", "money#see-a-balance", "src/money/balance.ts:40")]);

  const slot = confidenceOf(c, "money#see-a-balance#answer");
  assert.deepEqual(slot.support, [], "the reading was counted as being about the slot itself");
  assert.equal(slot.contained.length, 1, "the exchange's reading did not reach its slot");
  assert.equal(slot.sources, 1, "a contained reading is real evidence and must move the tier");
  assert.equal(slot.strength, "one-source");

  /** ⛔ And the page is told which it is, or it reads as having been written about this sentence. */
  const why = whyConfident(c, "money#see-a-balance#answer").join("\n");
  assert.match(why, /Nothing has been observed about it directly/);
  assert.match(why, /About the whole exchange, from code at src\/money\/balance\.ts:40/);
});

test("⛔ containment is one level, and a scope-wide reading supports no statement", () => {
  /**
   * A reading about a SCOPE is not evidence about every statement in it. Letting it count would
   * make one observation support thirty claims, and the scale would read strongest in exactly the
   * corpora where least had been looked at — which is the failure mode this whole file is arranged
   * against, arriving through generosity rather than through a decision.
   */
  const { corpus: base } = seeded();
  const c = withReadings(base, [reading("sc", "money", "src/money/all.ts:1")]);
  const slot = confidenceOf(c, "money#see-a-balance#answer");
  assert.deepEqual(slot.contained, [], "a scope-wide reading reached a slot");
  assert.equal(slot.strength, "none");
  /** The exchange one level down from the scope gets nothing either. */
  assert.deepEqual(confidenceOf(c, "money#see-a-balance").contained, []);
  assert.equal(containerOf("money#see-a-balance"), null, "an exchange has no container for this purpose");
  assert.equal(containerOf("money#see-a-balance#answer"), "money#see-a-balance");
  assert.equal(containerOf("money"), null);
});

test("the same pointer at two grains is one source, not two", () => {
  const { corpus: base } = seeded();
  const c = withReadings(base, [
    reading("ex", "money#see-a-balance", "src/money/balance.ts:40"),
    reading("sl", "money#see-a-balance#answer", "src/money/balance.ts:40"),
  ]);
  const slot = confidenceOf(c, "money#see-a-balance#answer");
  assert.equal(slot.support.length, 1);
  assert.equal(slot.contained.length, 1);
  assert.equal(slot.sources, 1, "one code path counted twice because it was cited at two grains");
  assert.equal(slot.strength, "one-source");
});

/* ───────────────────────── coverage, reported every time ───────────────────────── */

test("check reports how much of a corpus rests on anything", async () => {
  /**
   * ⛔ THE FORCING FUNCTION, BECAUSE PROSE DID NOT WORK. The scoper is now told to record what it
   * read, and `CLAUDE.md` opens on the observation that an instruction with a ⛔ on it was violated
   * four times and only a failing build stopped it. The number is in front of whoever runs `check`,
   * so a corpus where nothing has been written down cannot look like one where everything has.
   *
   * ⛔ A NOTE, NOT A REFUSAL. Zero support is the honest state of a corpus nobody has analysed, and
   * refusing it would make the first scope of a new product unreviewable — precisely when a reviewer
   * most needs the page.
   */
  const { checkCorpus } = await import("../dist/v2/check.js");
  const { dir } = seeded();
  const findings = checkCorpus(dir).findings ?? checkCorpus(dir);
  const list = Array.isArray(findings) ? findings : [];
  const cov = list.find((f) => /behaviours-with-nothing-behind-them|nothing-in-this-corpus-rests-on-anything/.test(f.kind));
  assert.ok(cov, `no coverage finding. kinds: ${list.map((f) => f.kind).slice(0, 12).join(", ")}`);
  assert.equal(cov.severity, "note", "the coverage finding refuses a corpus nobody has analysed yet");
  /** The seed has two readings, so it is the partial form with a count, not the all-or-nothing one. */
  assert.match(cov.where, /^\d+ of \d+$/, `expected "N of M", got "${cov.where}"`);
  const [unsupported, total] = cov.where.split(" of ").map(Number);
  assert.ok(unsupported > 0 && unsupported < total, `${unsupported} of ${total} is not a partial state`);
  fs.rmSync(dir, { recursive: true, force: true });
});
