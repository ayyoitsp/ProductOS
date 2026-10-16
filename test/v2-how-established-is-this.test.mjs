/**
 * ⛔ ONE COMPUTED ANSWER TO "MAY I BUILD FROM THIS", AND THE LINE NOTHING COMPUTED MAY CROSS.
 *
 * The MVP's main actor is a consumer: a Claude Code instance holding a ticket, asking ProductOS what
 * is decided. The ingredients of the answer all existed — `stampFor`, `Standing`, the `derived`
 * provenance on criteria and capability offerings, and the readings `confidence.ts` counts — spread
 * over five mechanisms, presented as one answer nowhere, and reachable only by parsing markdown.
 *
 * What this file asserts, in order of how much it would cost to get wrong:
 *
 *  1. `accepted` is unreachable from anything an agent can do. It is `stampFor`'s answer, and
 *     `stampFor` filters `via: agent` out at the source.
 *  2. ⛔ A STALE AGREEMENT REPORTS AS `suggested`, WITH THE REASON — never as `accepted`, never as
 *     `derived`. A consumer that builds from an agreement to older words is the whole failure mode
 *     the three stale kinds were invented to catch, arriving through the new field.
 *  3. A stale derivation does the same, because a requirement worked out from words that have since
 *     changed demonstrates a claim nobody makes.
 *  4. Observation of the running product is `derived` and an inference is not — and the generator's
 *     own drawing is neither.
 *
 * ⛔ THE REAL SEED, NOT ONLY FIXTURES, for the reason `v2-confidence` learnt: `levelOf` asks
 * `stampFor`, which asks `coveredBy`, which hashes the slots and criteria a ref actually has. A
 * synthetic corpus resolves to nothing, every stamp answers `never`, and the assertions pass while
 * asserting nothing. That dependency IS the guarantee — the only route to `accepted` runs through
 * the one function that refuses an agent.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { coveredBy, claimHash } = await import("../dist/v2/stamp.js");
const { levelOf, levelsIn, countLevels, SEEN_RUNNING, seenRunning } = await import("../dist/v2/level.js");
const { THE_GENERATOR } = await import("../dist/v2/held.js");

const seeded = () => {
  const dir = temp("v2level-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return { dir, corpus: loadCorpus(dir) };
};

/**
 * An acceptance carrying the hashes a real one carries. ⛔ Through `coveredBy`, because a verdict
 * with hand-written hashes is exactly what the model calls a stale stamp — a test that wrote its
 * own would be asserting against `claim-changed` while believing it asserted against `accepted`.
 */
const accepting = (corpus, target, { by = "peter", via = "page", at = "2026-10-05" } = {}) => {
  const now = coveredBy(corpus, target);
  assert.ok(now, `${target} resolves to nothing in the seed — pick a ref that exists`);
  return { kind: "accept", by, at, target, via, covers_slots: now.slots, covers_criteria: now.criteria };
};

const withVerdicts = (corpus, verdicts) => ({ ...corpus, verdicts: [...corpus.verdicts, ...verdicts] });
const withReadings = (corpus, readings) => ({ ...corpus, readings: [...corpus.readings, ...readings] });

const reading = (id, bears_on, ref, kind = "code", extra = {}) => ({
  id,
  bears_on,
  observes: `something observed for ${id}, at length enough to pass the floor`,
  basis: { kind, ref, ...extra },
});

/** The parsed corpus is a plain object, so the sentences can be moved the way an author moves them. */
const exchangeIn = (corpus, scopeId, exId) =>
  corpus.scopes.find((s) => s.scope.id === scopeId).scope.exchanges.find((e) => e.id === exId);

const ok = (l) => {
  assert.ok(!("error" in l), `levelOf refused: ${l.error}`);
  return l;
};

/** Refs that resolve in the seed. */
const ANSWER = "money#see-a-balance#answer";
const AGAIN = "money#see-a-balance#again";
const EXCHANGE = "money#see-a-balance";
const MAY = "money#record-earning#may";
const RULE = "only-a-parent-moves-money";

/* ─────────────────────────── the line ─────────────────────────── */

test("⛔ an agent cannot reach accepted, however correctly it records the verdict", () => {
  /**
   * ⛔ THE ASSERTION THIS WHOLE FILE EXISTS FOR, and the threat the MVP changes: many Claude Code
   * instances, each told to make tickets unambiguous, each able to write a verdict. If one of them
   * can produce `level: accepted`, the strongest word in the model stops meaning anything and
   * nothing afterwards can tell which stamps were real.
   *
   * The agent's record here is perfect — the right target, the right hashes, a real date. It is
   * refused on `via` alone, by `stampFor`, which is the one place that decision lives.
   */
  const { corpus } = seeded();
  const landed = accepting(corpus, ANSWER, { by: "productos-scoper", via: "agent", at: "2026-10-02" });
  const c = withVerdicts(corpus, [landed]);

  const l = ok(levelOf(c, ANSWER));
  assert.notEqual(l.level, "accepted", "⛔ software produced an acceptance");
  assert.equal(l.level, "suggested");
  assert.equal(l.route, "landed-by-software");
  /** ⛔ And it says so on the thing itself: a default nobody can see is a default nobody overrides. */
  assert.match(l.because, /productos-scoper landed this for you on 2026-10-02 and nobody has looked at it/);

  /** ⛔ And not one fact in the whole corpus reads accepted, however many of those are recorded. */
  const everything = withVerdicts(
    corpus,
    levelsIn(corpus).map((x) => {
      const n = coveredBy(corpus, x.ref);
      return n
        ? { kind: "accept", by: "productos-scoper", at: "2026-10-02", target: x.ref, via: "agent", covers_slots: n.slots, covers_criteria: n.criteria }
        : null;
    }).filter(Boolean),
  );
  assert.equal(countLevels(levelsIn(everything)).accepted, 0, "⛔ an agent accepted something");
});

test("a person's agreement to these exact words is what accepted means", () => {
  const { corpus } = seeded();
  const c = withVerdicts(corpus, [accepting(corpus, ANSWER)]);
  const l = ok(levelOf(c, ANSWER));
  assert.equal(l.level, "accepted");
  assert.equal(l.route, "accepted-here");
  assert.equal(l.because, "peter accepted these words on 2026-10-05");
  assert.equal(l.stale, undefined);
});

test("a confirmed rule carries its own words into every slot it fills, and says which rule", () => {
  /**
   * ⛔ NOT INFERENCE, AND IT MUST NOT READ AS A DIRECT ACCEPTANCE. `only-a-parent-moves-money`
   * supplies the whole of `money#record-earning#may` — the sentence a person agreed to and the
   * sentence in the slot are the same string — so asking them again is review surface with nothing
   * behind it. `route` is what stops a surface from claiming somebody judged this exchange.
   */
  const { corpus } = seeded();
  const c = withVerdicts(corpus, [accepting(corpus, RULE)]);
  const l = ok(levelOf(c, MAY));
  assert.equal(l.level, "accepted");
  assert.equal(l.route, "accepted-through-a-rule");
  assert.match(l.because, new RegExp(`peter accepted the rule ${RULE} on 2026-10-05, and it supplies every word of this`));
});

/* ───────────────────── stale: the rule that matters most ───────────────────── */

test("⛔ a reworded claim turns an acceptance back into a suggestion", () => {
  const { corpus } = seeded();
  const v = accepting(corpus, ANSWER);
  /** The author rewrites the sentence after somebody agreed to it — the commonest way this happens. */
  exchangeIn(corpus, "money", "see-a-balance").slots.answer.says =
    "Whatever the storage layer makes cheapest, shown however it comes out.";
  const l = ok(levelOf(withVerdicts(corpus, [v]), ANSWER));

  assert.equal(l.level, "suggested", "⛔ a consumer was told it could build from older words");
  assert.notEqual(l.level, "accepted");
  assert.equal(l.route, "stale-acceptance");
  assert.equal(l.stale, "claim-changed");
  /** ⛔ `staleReason`'s sentence, not a second phrasing of it. */
  assert.match(l.because, /peter accepted this on 2026-10-05, and what it states is not what they read/);
});

test("⛔ a criterion added after an acceptance turns it back into a suggestion", () => {
  const { corpus } = seeded();
  const v = accepting(corpus, EXCHANGE);
  exchangeIn(corpus, "money", "see-a-balance").criteria.push({
    id: "99",
    slot: "answer",
    kind: "instance",
    given: "a kid with a balance",
    when: "anybody at all looks, including a stranger",
    then: "they are shown it",
  });
  const l = ok(levelOf(withVerdicts(corpus, [v]), EXCHANGE));
  assert.equal(l.level, "suggested");
  assert.equal(l.route, "stale-acceptance");
  assert.equal(l.stale, "criteria-changed");
  assert.match(l.because, /its criteria have changed since/);
});

test("⛔ both halves moving says both moved, rather than picking one", () => {
  const { corpus } = seeded();
  const v = accepting(corpus, EXCHANGE);
  const ex = exchangeIn(corpus, "money", "see-a-balance");
  ex.slots.answer.says = "Something else entirely.";
  ex.criteria.push({ id: "98", slot: "answer", kind: "instance", then: "something else is shown" });
  const l = ok(levelOf(withVerdicts(corpus, [v]), EXCHANGE));
  assert.equal(l.level, "suggested");
  assert.equal(l.stale, "both-changed");
  assert.match(l.because, /both what it states and what demonstrates it have changed since/);
});

test("⛔ a stale agreement to a rule does not reach the slots that rule supplies", () => {
  /**
   * The worst version of the same failure: one file nobody accepted against changes the behaviour of
   * every exchange that inherits it. `stampFor` already refuses to inherit a reworded rule; what it
   * cannot say at the slot is WHY, because there is no verdict there at all — so the level names the
   * rule, and a reviewer re-reads one sentence instead of eighty-eight slots.
   */
  const { corpus } = seeded();
  const v = accepting(corpus, RULE);
  corpus.rules.find((r) => r.rule.id === RULE).rule.statement =
    "Anybody signed in on the shared device may move money, including a kid.";
  const l = ok(levelOf(withVerdicts(corpus, [v]), MAY));
  assert.equal(l.level, "suggested", "⛔ a reworded rule went on supplying an accepted sentence");
  assert.equal(l.route, "stale-acceptance");
  assert.match(l.because, new RegExp(`Every word of this comes from the rule ${RULE}, and the agreement to that rule no longer holds`));
});

/* ───────────────────────── derived ───────────────────────── */

test("a requirement worked out from the claim as it now reads is derived, and says from what", () => {
  const { corpus } = seeded();
  const c1 = exchangeIn(corpus, "money", "see-a-balance").criteria.find((x) => x.id === "1");
  c1.derived = { by: "productos-demonstrator", at: "2026-10-01", from: claimHash(corpus, ANSWER) };
  const l = ok(levelOf(corpus, "money#see-a-balance#shows#1"));
  assert.equal(l.level, "derived");
  assert.equal(l.route, "worked-out");
  assert.match(l.because, new RegExp(`productos-demonstrator worked this out from ${ANSWER} on 2026-10-01`));
  /** ⛔ And it says that nobody has agreed to the claim, which is what decides how much to lean on it. */
  assert.match(l.because, /nobody has agreed to that sentence yet/);
});

test("⛔ a requirement worked out from words that have since changed is a suggestion again", () => {
  const { corpus } = seeded();
  const c1 = exchangeIn(corpus, "money", "see-a-balance").criteria.find((x) => x.id === "1");
  c1.derived = { by: "productos-demonstrator", at: "2026-10-01", from: claimHash(corpus, ANSWER) };
  /** The claim moves after the test was worked out from it. */
  exchangeIn(corpus, "money", "see-a-balance").slots.answer.says = "Only the amount, and nothing about where it came from.";
  const l = ok(levelOf(corpus, "money#see-a-balance#shows#1"));
  assert.equal(l.level, "suggested", "⛔ a builder was handed a test for a claim nobody makes");
  assert.equal(l.route, "stale-derivation");
  assert.match(l.because, /those words have changed since — it demonstrates the sentence as it read then/);
});

test("an authored requirement inside an acceptance was read and agreed to", () => {
  /**
   * ⛔ NOT PROPAGATION — NOTHING CAN STAMP A REQUIREMENT. `coveredBy` hashes nothing for a `#shows#`
   * ref, so a verdict against one could never go stale and `stampFor` correctly answers `never`. But
   * it hashes the criteria NOBODY derived into the slot's stamp and prints every one of them under
   * "what must be demonstrated" at the moment of consent. The person read this sentence. Reporting it
   * as `suggested` would send them a question they have already answered.
   */
  const { corpus } = seeded();
  const c = withVerdicts(corpus, [accepting(corpus, ANSWER)]);
  const l = ok(levelOf(c, "money#see-a-balance#shows#1"));
  assert.equal(l.level, "accepted");
  assert.equal(l.route, "inside-an-acceptance");
  assert.match(l.because, new RegExp(`covered by the acceptance of ${ANSWER}`));

  /** ⛔ And a DERIVED requirement is not covered by it, because the hash deliberately excludes it. */
  const { corpus: other } = seeded();
  other.scopes
    .find((s) => s.scope.id === "money")
    .scope.exchanges.find((e) => e.id === "see-a-balance")
    .criteria.find((x) => x.id === "1").derived = {
    by: "productos-demonstrator",
    at: "2026-10-01",
    from: claimHash(other, ANSWER),
  };
  const withBoth = withVerdicts(other, [accepting(other, ANSWER)]);
  assert.equal(ok(levelOf(withBoth, "money#see-a-balance#shows#1")).level, "derived");
});

test("a screen on an accepted happy path follows from it", () => {
  /**
   * The one inheritance `confidence.ts` calls a derivation rather than an inference: a confirmed
   * happy path names the screens it passes through, so confirming the path confirmed that they are
   * on it. Calling that an inference would be false modesty.
   */
  const { corpus } = seeded();
  const c = withVerdicts(corpus, [accepting(corpus, "money#happy-path")]);
  const l = ok(levelOf(c, "money#balance"));
  assert.equal(l.level, "derived");
  assert.equal(l.route, "follows-an-acceptance");
  assert.match(l.because, /follows from money#happy-path, which is accepted — on the happy path, through: balance/);
});

/* ───────────────────── observed: the third zone, mapped ───────────────────── */

test("the product being seen doing it is derived, and reading the code about it is not", () => {
  /**
   * ⛔ THE ONE JUDGEMENT IN `level.ts`, ASSERTED IN BOTH DIRECTIONS. An observation of the running
   * product is above an inference — a consumer may build from behaviour somebody watched — and below
   * an agreement, which is structural: nothing in the module can write `accepted`.
   *
   * `code`, `trial`, `interview` and `support` stay `suggested`. Reading the source says what was
   * implemented rather than what happened, and a trial is an observation of PEOPLE: both are
   * evidence about what the product should do, and letting either reach `derived` would make a ticket
   * groomable because an agent read the repository.
   */
  const { corpus } = seeded();
  const watched = withReadings(corpus, [reading("saw-it", AGAIN, "a second look, on a parent's phone", "inspection", { at: "2026-10-04" })]);
  const l = ok(levelOf(watched, AGAIN));
  assert.equal(l.level, "derived");
  assert.equal(l.route, "observed");
  assert.match(l.because, /The product was seen doing this — inspection at a second look, on a parent's phone on 2026-10-04/);
  /** ⛔ And it says the other half, every time. */
  assert.match(l.because, /Nobody has agreed that it should/);

  for (const kind of ["code", "trial", "interview", "support"]) {
    const inferred = ok(levelOf(withReadings(corpus, [reading(`r-${kind}`, AGAIN, "src/money.ts:40", kind)]), AGAIN));
    assert.equal(inferred.level, "suggested", `a ${kind} reading reached ${inferred.level}`);
    assert.equal(inferred.route, "inferred");
  }
  assert.ok(!SEEN_RUNNING.includes("code"), "⛔ reading the source counted as watching the product");
  /** ⛔ However many of them there are. The cap is the point, in both zones. */
  const many = Array.from({ length: 12 }, (_, i) => reading(`c${i}`, AGAIN, `src/a.ts:${i}`));
  assert.equal(ok(levelOf(withReadings(corpus, many), AGAIN)).level, "suggested");
});

test("⛔ the generator's own drawing is not the product being seen", () => {
  /**
   * `draw` writes a `kind: screen` reading per run — *"this screen is rendered by <component>"* — so
   * without the filter every drawing in a corpus would raise its own screen to `derived`: software
   * generating an artefact and then citing the artefact as evidence that somebody looked. `held.ts`
   * drew this line first, for the same reason.
   */
  const { corpus } = seeded();
  const drawn = withReadings(corpus, [
    {
      id: "drawn-money-balance",
      bears_on: "money#balance",
      observes: "this screen is rendered by components/Balance.tsx at 33e38d3, and the drawing beside it was generated from that component",
      basis: { kind: "screen", ref: "components/Balance.tsx", by: THE_GENERATOR },
    },
  ]);
  assert.equal(seenRunning(drawn, "money#balance").length, 0, "⛔ the generator's reading counted as an observation");
  const l = ok(levelOf(drawn, "money#balance"));
  assert.notEqual(l.route, "observed");
  assert.equal(l.level, "suggested");
  assert.equal(l.route, "inferred");

  /** A person who looked at the same screen is a different matter, and reads as one. */
  const bySomebody = withReadings(corpus, [reading("alice-looked", "money#balance", "the balance screen on a parent's phone", "screen", { by: "alice" })]);
  assert.equal(ok(levelOf(bySomebody, "money#balance")).route, "observed");
});

test("⛔ support borrowed from a neighbour never reaches derived, and says it is borrowed", () => {
  /**
   * The mechanism Peter chose knowingly: a statement resting on the same code path as a confirmed one
   * is better founded than a guess, and nobody has read it. It may move within the lower zone; it may
   * not cross into the zone that means somebody looked at THIS.
   */
  const { corpus } = seeded();
  const shared = "src/ledger.ts:40";
  const c = withVerdicts(
    withReadings(corpus, [reading("on-answer", ANSWER, shared), reading("about-the-exchange", EXCHANGE, shared)]),
    [accepting(corpus, ANSWER)],
  );
  const l = ok(levelOf(c, AGAIN));
  assert.equal(l.level, "suggested", "⛔ borrowed support reached derived");
  assert.equal(l.route, "inferred");
  assert.match(l.because, /Nobody has read this statement itself — its support is borrowed from/);
});

/* ───────────────────── open: a question somebody owes ───────────────────── */

test("drafted answers on an open question are a suggestion, never the answer", () => {
  const { corpus } = seeded();
  const l = ok(levelOf(corpus, "money#record-spending#after"));
  assert.equal(l.level, "suggested");
  assert.equal(l.route, "drafted");
  assert.match(l.because, /2 answers have been drafted and nobody has chosen, asked of peter/);
  /** ⛔ The question itself, because that is what a consumer puts to a person. */
  assert.match(l.because, /Is an amount larger than what the kid has taken off like any other, or refused\?/);
  /** ⛔ And which part of an agreed sentence is in question. */
  assert.match(l.because, /One thing about it is unruled: whether an amount larger than what the kid has is taken off at all/);
});

test("an open question nobody has drafted an answer to is open", () => {
  const { corpus } = seeded();
  const l = ok(levelOf(corpus, "tasks#complete-a-task#at_once"));
  assert.equal(l.level, "open");
  assert.equal(l.route, "unruled");
  assert.match(l.because, /Nobody has answered this, asked of product/);
});

test("⛔ an acceptance under a live question does not settle it, and is not thrown away either", () => {
  /**
   * A slot can state what it does and still have one thing about it nobody has ruled. Every gate in
   * this repo treats that as outstanding — `resolveRef` reports it `unsettled`, `gateFor` refuses to
   * accept over it, `acts` moves an accepted exchange that has since been opened into its stale list
   * — so a level that read the stamp first would be a second answer to a settled question. The words
   * somebody agreed to are still agreed, and `because` carries both halves.
   */
  const { corpus } = seeded();
  const ref = "money#record-spending#after";
  const c = withVerdicts(corpus, [accepting(corpus, ref)]);
  const l = ok(levelOf(c, ref));
  assert.notEqual(l.level, "accepted", "⛔ a live question was stamped away");
  assert.equal(l.level, "suggested");
  assert.match(l.because, /peter accepted these words on 2026-10-05, and that does not answer it/);
});

test("deliberately unanswered is nobody's question, and it is not an acceptance", () => {
  /**
   * ⛔ `open` WITH `route: "latitude"`, AND NOT `accepted`. `out_of_scope` names who decided and when
   * and costs a reason — but an author writes a standing and a person records a verdict, and reading
   * `answered_by` as an acceptance would be a second route to the strongest word in the model. The
   * route is what tells a consumer the other half: nothing to build from AND nobody owes an answer.
   */
  const { corpus } = seeded();
  const ref = AGAIN;
  exchangeIn(corpus, "money", "see-a-balance").slots.again.standing = {
    kind: "out_of_scope",
    because: "looking twice is the platform's business and this product takes whatever it gives us",
    answered_by: "peter",
    answered_at: "2026-09-20",
  };
  const l = ok(levelOf(corpus, ref));
  assert.equal(l.level, "open");
  assert.equal(l.route, "latitude");
  assert.match(l.because, /Deliberately not answered here — peter decided on 2026-09-20/);

  /** ⛔ And a real acceptance over it still wins, because latitude is settled and can be agreed to. */
  const agreed = withVerdicts(corpus, [accepting(corpus, ref)]);
  assert.equal(ok(levelOf(agreed, ref)).level, "accepted");
});

test("a slot the product does something about and nobody has decided is open", () => {
  /**
   * `money#record-spending#refuses` is in the shipped seed: reached by a constraining rule, stated
   * nowhere, and carrying the corpus's own trial reading. `resolveRef` has no grain for it and
   * answers "says nothing at all about refuses" — which is the wrong answer to give a consumer
   * holding that ref, and the right one is the completeness signal a grid cannot produce.
   */
  const { corpus } = seeded();
  const l = ok(levelOf(corpus, "money#record-spending#refuses"));
  assert.equal(l.level, "open");
  assert.equal(l.route, "unruled");
  assert.match(l.because, /Nothing here says what happens, and no rule supplies it/);
  assert.match(l.because, /amounts-refuse-the-same-way constrains it without answering it/);
  assert.match(l.because, /the product does something nobody has decided/);
});

test("a ref that is not in the corpus gets a reason rather than a level", () => {
  /** ⛔ A consumer assembles refs from ticket prose. A level invented for one of those is the worst answer available. */
  const { corpus } = seeded();
  const bad = levelOf(corpus, "money#no-such-exchange#answer");
  assert.ok("error" in bad, "a made-up ref was given a level");
  assert.match(bad.error, /no exchange "no-such-exchange" in money/);
  assert.match(levelOf(corpus, "money").error, /holds facts rather than being one/);
});

/* ───────────────────── the whole of a real corpus ───────────────────── */

test("every fact in the shipped seed gets a level, and the pristine one is a corpus nobody has agreed to", () => {
  /**
   * ⛔ THE DISTRIBUTION IS THE POINT, not the total. A corpus nobody has touched must not be able to
   * look like one somebody has read: 73 of its 74 facts are drafted or written and the other is a
   * question. `accepted` and `derived` are both ZERO, on a corpus with nine rules, five exchanges,
   * twenty-two requirements and two recorded observations — because a level is a report on consent
   * and no amount of content substitutes for it.
   */
  const { corpus } = seeded();
  const all = levelsIn(corpus);
  assert.equal(all.length, 74, "the seed's shape changed — read the new distribution before editing this number");
  assert.deepEqual(countLevels(all), { accepted: 0, derived: 0, suggested: 73, open: 1 });
  /** Every one of them carries its reason: a level with no argument behind it is a badge. */
  for (const l of all) assert.ok(l.because.length > 20, `${l.ref} has no reason: ${JSON.stringify(l.because)}`);

  /** ⛔ And the same corpus after a morning's reviewing moves, which is what makes the zeros above a fact rather than a floor. */
  const after = withVerdicts(corpus, [
    accepting(corpus, "money#happy-path"),
    accepting(corpus, EXCHANGE),
    accepting(corpus, RULE),
  ]);
  const moved = levelsIn(after);
  assert.deepEqual(countLevels(moved), { accepted: 9, derived: 0, suggested: 64, open: 1 });
  const routes = {};
  for (const l of moved) routes[l.route] = (routes[l.route] ?? 0) + 1;
  /**
   * ⛔ WHAT THREE ACTS REACH, AND WHAT THEY DELIBERATELY DO NOT. The happy path and the rule are
   * accepted here; the rule's sentence reaches the two `may` slots it supplies; the exchange's stamp
   * reaches its five authored requirements, which nothing else can stamp. It does NOT reach that
   * exchange's own slots — `acts` still asks about each of those per ref, and a level that answered
   * otherwise would be the one surface in the model disagreeing with the queue.
   */
  assert.deepEqual(routes, {
    "accepted-here": 2,
    "accepted-through-a-rule": 2,
    "inside-an-acceptance": 5,
    drafted: 3,
    unruled: 1,
    written: 61,
  });
  assert.equal(countLevels(moved).open, 1, "an acceptance answered a question it was not about");
  /** ⛔ And the slots of the accepted exchange say so without claiming it. */
  const slot = ok(levelOf(after, ANSWER));
  assert.equal(slot.level, "suggested");
  assert.match(slot.because, /peter accepted the whole of money#see-a-balance on 2026-10-05, which covered these words/);
  assert.match(slot.because, /an acceptance of the exchange, and not of this sentence/);
});

/* ───────────────────── who wrote it, and what cannot be told ───────────────────── */

test("⛔ nothing records who wrote a sentence, and the level says so rather than guessing", () => {
  /**
   * Both reviews landed on this independently: *"A claim an agent inferred from a call transcript
   * and a claim a PM typed but has not yet confirmed both read 'not confirmed'. A grooming agent
   * needs to tell them apart, because the first should be raised as a question in the ticket and the
   * second only needs a stamp."*
   *
   * ⛔ IT CANNOT BE COMPUTED TODAY, AND THE ANSWER TO THAT IS TO SAY SO. No field on `SlotFill`,
   * `Statement`, `Exchange` or `Scope` records an author, and absence of `Criterion.derived` is not
   * a record of a person — every migrated corpus is full of criteria nobody recorded an author for,
   * and an LLM's YAML is byte-identical to a PM's. A heuristic here would let a grooming agent treat
   * an inference as a draft, which is the one error this field exists to prevent.
   */
  const { corpus } = seeded();
  const l = ok(levelOf(corpus, ANSWER));
  assert.deepEqual(l.wrote, { is: "unrecorded" });
  assert.match(l.because, /Nothing records who wrote it, so a person's unconfirmed draft and an agent's inference read the same here/);

  /** ⛔ Every fact in the shipped seed: 74 of 74. That ratio is the finding, not a detail. */
  const all = levelsIn(corpus);
  assert.equal(all.filter((x) => x.wrote.is === "unrecorded").length, all.length);

  /** A role that recorded what it worked out IS recoverable, and it is the only place authorship is. */
  const { corpus: withRole } = seeded();
  const c1 = exchangeIn(withRole, "money", "see-a-balance").criteria.find((x) => x.id === "1");
  c1.derived = { by: "productos-demonstrator", at: "2026-10-01", from: claimHash(withRole, ANSWER) };
  assert.deepEqual(ok(levelOf(withRole, "money#see-a-balance#shows#1")).wrote, {
    is: "a role",
    by: "productos-demonstrator",
    at: "2026-10-01",
  });

  /** ⛔ And its neighbour, which nobody derived, is NOT thereby a person's — absence records nothing. */
  assert.deepEqual(ok(levelOf(withRole, "money#see-a-balance#shows#2")).wrote, { is: "unrecorded" });

  /** The other recoverable case: software landed content, recorded as a verdict it cannot be consent in. */
  const landed = withVerdicts(corpus, [
    accepting(corpus, AGAIN, { by: "productos-scoper", via: "agent", at: "2026-10-02" }),
  ]);
  assert.deepEqual(ok(levelOf(landed, AGAIN)).wrote, { is: "software", by: "productos-scoper", at: "2026-10-02" });
  /** ⛔ And it does not say "nothing records who wrote it", because something does. */
  assert.doesNotMatch(ok(levelOf(landed, AGAIN)).because, /Nothing records who wrote it/);
});
