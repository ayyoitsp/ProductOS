/**
 * How well established one fact is — ⛔ ONE COMPUTED ANSWER, AND IT STORES NOTHING.
 *
 * The MVP is a better index for product truth, read by Claude Code instances over MCP that hold a
 * ticket and ask whether they may build from a sentence. The answer they need is one field with
 * four values — accepted, derived, suggested, open — and every ingredient of it already existed,
 * spread over five mechanisms and never presented as one answer: `stampFor` knows what a human
 * agreed to and how it breaks, `Standing` knows whether anybody owes a decision, `Criterion.derived`
 * and `CapabilityOffering.derived` know what was worked out from what, and `confidence.ts` knows
 * what has been observed. A consumer with a ticket had to parse markdown to learn any of it.
 *
 * ⛔ DERIVED, NEVER STORED, for the reason `confidence.ts`, `stageOf` and `reachOf` are: a stored
 * level is a word that was true when it was written and unfalsifiable afterwards — and a level is
 * exactly the kind of thing somebody sets by hand to get a ticket through a gate.
 *
 * ⛔ AND `accepted` IS NOT THE TOP OF A SCALE SOMETHING HERE CAN CLIMB. Nothing in this module can
 * produce it: it is `stampFor`'s answer, and `stampFor` filters `via: agent` out at the source. No
 * count of readings, no provenance and no amount of inheritance reaches it — the same line
 * `confidence.ts` holds between its two zones, said in the vocabulary a consumer reads.
 *
 * ⛔ THE RULE THIS FILE IS ARRANGED AROUND: A STALE AGREEMENT REPORTS AS `suggested`.
 *
 * Not as `accepted` with a warning, and not as `derived`. A consumer must never build from an
 * agreement to older words, and the three stale kinds `stampFor` already distinguishes —
 * `claim-changed`, `criteria-changed`, `both-changed` — are the only honest way to say which words
 * moved. So staleness is never re-derived here, it is asked for, and the sentence a reader gets is
 * `staleReason`'s, so there is one phrasing of it in the codebase. The same holds of a stale
 * derivation: a requirement worked out from words that have since changed demonstrates the old
 * sentence, and reporting it above `suggested` would hand a builder a test for a claim nobody makes.
 */
import { resolveRules, type Corpus } from "./load.js";
import { SLOTS, statements, authorshipOf, type Reading, type SlotName, type Standing } from "./schema.js";
import { decidedFor, staleReason, stampFor } from "./stamp.js";
import { resolveRef, type Ref } from "./ref.js";
import { confidenceOf, discrepancyFor, inheritedFor, supportFor } from "./confidence.js";
import { demonstrationOf, derivedCapabilities } from "./demonstrate.js";
import { THE_GENERATOR } from "./held.js";

/**
 * ⛔ FOUR NAMES, AND THE GATE A CONSUMER APPLIES IS BETWEEN `derived` AND `suggested`.
 *
 *   accepted    a person read these words and agreed to them
 *   derived     it follows from something — an acceptance, or the product being seen doing it
 *   suggested   something wrote it or inferred it, and nobody has agreed
 *   open        there is a question here, and a person owes the answer
 *
 * ⛔ `open` IS RESERVED FOR A QUESTION SOMEBODY OWES, which is why a stated sentence nobody has
 * agreed to reads `suggested` rather than `open`. They are routed to different people: `suggested`
 * goes to a reviewer as something to agree with or correct, `open` goes to whoever was asked. A
 * level that collapsed them would hand a decider thirty sentences nobody has questioned.
 */
export type LevelName = "accepted" | "derived" | "suggested" | "open";

/**
 * How it reached that level — ⛔ SO THE THREE ZONES SURVIVE FOUR NAMES.
 *
 * `confidence.ts` separates a human's agreement from an inference, and observation of the running
 * product sits between them: above an inference, below agreement. The MVP fixed four level names
 * and the consumer's gate sits at `derived`, so an observation maps to `derived` with
 * `route: "observed"` rather than earning a fifth name nobody asked for — see `SEEN_RUNNING`.
 *
 * ⛔ A ROUTE IS NEVER A SECOND LEVEL. It says which argument produced the level; `level` is the
 * only thing a gate reads.
 */
export type Route =
  /** A verdict against these exact words. */
  | "accepted-here"
  /** A verdict against the rule that supplies every word of this. */
  | "accepted-through-a-rule"
  /** An authored requirement inside what somebody read and agreed to. */
  | "inside-an-acceptance"
  /** Provenance, current with the words it was worked out from, and those words are agreed. */
  | "worked-out"
  /** Worked out from words that have not changed — and that nobody has agreed to yet. */
  | "worked-out-from-a-draft"
  /** It follows from an acceptance — a confirmed happy path names this screen. */
  | "follows-an-acceptance"
  /** The product was seen doing this. */
  | "observed"
  /** Somebody agreed, and the words moved. */
  | "stale-acceptance"
  /** Something worked it out, and the words it came from moved. */
  | "stale-derivation"
  /** Answers have been drafted for an open question and nobody has chosen. */
  | "drafted"
  /** Software landed a default so a reviewer has something to disagree with. */
  | "landed-by-software"
  /**
   * Readings bear on it, and a reading is never truth.
   *
   * ⛔ THERE IS NO `borrowed` ROUTE, AND WRITING ONE PRODUCED DEAD CODE. Shared support needs a
   * pointer in common, so — as `confidence.ts` found the hard way — a ref with nothing read about it
   * cannot inherit that way at all: the borrowed case always has a reading of its own or one about
   * its exchange, and would have been caught by this route first. The warning belongs to the
   * CONDITION rather than to a route, so it is a clause of `because` here.
   */
  | "inferred"
  /** It is written down, and nothing else is true of it. */
  | "written"
  /** A person owes a decision here. */
  | "unruled"
  /** Somebody recorded that this is deliberately not answered. */
  | "latitude";

/**
 * Who wrote this, as far as the corpus RECORDS it.
 *
 * ⛔ `unrecorded` IS THE HONEST ANSWER ALMOST EVERYWHERE TODAY, AND SAYING SO IS THE WHOLE POINT.
 *
 * The usability review landed on the same gap the architecture review did: *"A claim an agent
 * inferred from a call transcript and a claim a PM typed but has not yet confirmed both read 'not
 * confirmed'. A grooming agent needs to tell them apart, because the first should be raised as a
 * question in the ticket and the second only needs a stamp."*
 *
 * It is right, and the distinction cannot be computed today. What a corpus holds is:
 *
 *  - `Criterion.derived {by, at, from}` and `CapabilityOffering.derived` — a named ROLE worked it
 *    out. ⛔ Recorded, and the only place authorship is.
 *  - an `accept` verdict with `via: agent` — software landed content so a reviewer has something to
 *    disagree with. Recorded, and only where a caller chose to record one.
 *  - nothing at all on a slot, a statement, an exchange or a scope. `SlotFill` is `says`, `standing`,
 *    `holds_for`, `within`, `outcomes`, `instead_of`, `defers_to`, `rests_on`, `none`, `cannot_fail`
 *    and `held_by`; `Statement` is an id and a sentence. No field on any of them says who wrote it.
 *
 * ⛔ AND THE ABSENCE OF `derived` IS NOT A RECORD OF A PERSON. The schema says absent means somebody
 * typed it — which is true of the shape and not of the author: every corpus migrated from v1 is full
 * of criteria nobody recorded an author for, and a sentence an LLM typed into YAML is byte-identical
 * to one a PM typed. Reading absence as "a person" is exactly the guess that would let a grooming
 * agent treat an inference as a draft, which is worse than admitting the model cannot tell.
 *
 * ⛔ AND THE EVENT LOG IS NOT A ROUTE TO IT EITHER. `log.ts` records `by`, `via` and `wrote` per
 * event — but `wrote` is a DOCUMENT and `ref` is a product reference, and that file carries a ⛔
 * saying that mapping one onto the other is guessing in the place a wrong answer destroys somebody's
 * work. A corpus does not carry its log, and a log of acts is not a record of who authored the
 * sentence standing now.
 *
 * ⛔ SO THIS FUNCTION IS THE ONE PLACE TO CHANGE when a write-time authorship field lands. Nothing
 * else in this file reads authorship, and nothing anywhere should infer it.
 */
export type Wrote =
  /** A verdict says software landed this content, standing until somebody disagrees. */
  | { is: "software"; by: string; at: string }
  /** A named role worked it out, and recorded the words it worked from. */
  | { is: "a role"; by: string; at: string }
  /**
   * A person typed it, and nobody has confirmed it.
   *
   * ⛔ THE WHOLE POINT OF THE FEATURE, AND IT HAD NOWHERE TO GO. This union was written before
   * `wrote` existed on the schema, when authorship was unrecoverable — so there was no honest value
   * for "a human wrote this", and the only candidate was `unrecorded`.
   *
   * Folding the two together is exactly the failure the MVP needs prevented. The usability review:
   * *"A claim an agent inferred from a call transcript and a claim a PM typed but has not yet
   * confirmed both read 'not confirmed'. A grooming agent needs to tell them apart, because the
   * first should be raised as a question in the ticket and the second only needs a stamp."*
   */
  | { is: "a person"; by: string }
  /** ⛔ Nothing records it: a person's unconfirmed draft and an agent's inference are the same bytes. */
  | { is: "unrecorded" };

export interface Level {
  ref: string;
  level: LevelName;
  route: Route;
  /**
   * Why it has that level, in one sentence a person can read.
   *
   * ⛔ REQUIRED, FOR THE REASON `Inherited.because` IS. Peter, on a statement's strength being
   * raised by somebody else's confirmation: *"the reason why it has confidence needs to be visible
   * as well"*. A level with no argument behind it is a badge, and a consumer told `derived` with
   * nothing saying from what cannot tell a worked-out requirement from a borrowed one.
   */
  because: string;
  /**
   * ⛔ WHO WROTE IT — ON EVERY ANSWER, INCLUDING WHEN THE ANSWER IS THAT NOBODY RECORDED IT.
   *
   * A consumer routes on this: software's interpretation becomes a question in the ticket, a
   * person's unconfirmed draft only needs a stamp. `unrecorded` is the instruction to do neither
   * blindly — ask who wrote it before deciding which of the two this is.
   */
  wrote: Wrote;
  /** Which kind of staleness, where that is why this is not `accepted`. */
  stale?: "claim-changed" | "criteria-changed" | "both-changed";
}

/**
 * The reading kinds that mean somebody watched the product do it.
 *
 * ⛔ THE ONE DECISION IN THIS FILE THAT IS A JUDGEMENT RATHER THAN ARITHMETIC, SO IT IS WRITTEN
 * DOWN. An observation of the running product is above an inference and below an agreement:
 *
 *  - **Above an inference**, so it reaches `derived`. The operational meaning of the ladder is the
 *    consumer's gate — nothing below `derived` is buildable — and a sentence the product has been
 *    seen performing is at least as safe to implement as a mechanical consequence of somebody's
 *    agreement. Holding it at `suggested` would send a person a question that was already answered
 *    by the product in front of them.
 *  - **Below an agreement**, and structurally so: this module cannot write `confirmed`, and nothing
 *    here reaches `accepted`. The product doing something is not the same as anybody having decided
 *    it should — that is the whole of tenet one, and it is why no number of observations moves this.
 *
 * ⛔ AND `code` IS NOT IN THE SET, WHICH IS THE LOAD-BEARING HALF. Reading the source says what was
 * implemented, not what happened; a corpus is target state and is never gated on what exists, so a
 * code reading is somebody's inference about behaviour from an artefact. `trial`, `interview` and
 * `support` are observations of PEOPLE — the strongest evidence in the seed corpus is one of them —
 * and they are evidence about what the product should do rather than a record of it doing it.
 * Letting any of those reach `derived` would make a ticket groomable because an agent read the code,
 * which is the laundering `confidence.ts` caps its scale to prevent, arriving one level lower.
 *
 * ⛔ A READING KIND THAT MEANS "DRIVEN, RATHER THAN READ" BELONGS HERE THE DAY IT LANDS — a walk of
 * the running product is the strongest member of this set, not a new one.
 *
 * ⛔ AND THAT DAY IS THIS ONE: `walk` IS IN THE SET, NOT A FIFTH LEVEL. The rung Peter asked for —
 * *"a level of confirmation that is higher than 'LLM generated'… like 'product behavior'"* — is a
 * zone in `confidence.ts` (`Confidence.observed`) and the existing `observed` route here. Giving it
 * a sixth level name would have split the one field a consumer's gate reads into two, which is the
 * thing the header of this file refuses. `confidence.ts` keeps the zone; this keeps the gate.
 */
export const SEEN_RUNNING: ReadonlyArray<Reading["basis"]["kind"]> = [
  "test-run",
  "screen",
  "inspection",
  "telemetry",
  "log",
  /** An agent drove the running product and recorded what happened — re-runnable, so falsifiable. */
  "walk",
];

/**
 * Observations of the running product bearing directly on this ref.
 *
 * ⛔ NEVER THE GENERATOR'S OWN, AND THIS IS THE SAME LINE `stampFor` HOLDS AGAINST `via: agent`.
 *
 * `draw` writes a `kind: screen` reading per run — *"this screen is rendered by <component>"* — and
 * without this filter every drawing in a corpus would raise its own screen to `derived`: software
 * generating an artefact and then citing the artefact as evidence that somebody looked. `held.ts`
 * drew this line first, for the same reason and with the same belt-and-braces on `drawn-` ids for
 * readings written before `by` existed, and `THE_GENERATOR` is imported from there so there is one
 * answer to "which of these did a machine write".
 *
 * ⛔ DIRECTLY, NOT THROUGH THE EXCHANGE. `confidence.ts` counts readings about the containing
 * exchange towards strength, correctly — they are real evidence a reviewer can go and look at. They
 * are not a record of THIS sentence being performed, and raising a statement nobody watched to
 * `derived` on a neighbour's observation is the borrowed-strength failure wearing a level's clothes.
 * They still reach `because`, as evidence about the exchange.
 */
export const seenRunning = (corpus: Corpus, ref: string): Reading[] =>
  corpus.readings.filter(
    (r) =>
      r.bears_on === ref &&
      SEEN_RUNNING.includes(r.basis.kind) &&
      (r.basis.by ?? "") !== THE_GENERATOR &&
      !r.id.startsWith("drawn-"),
  );

/**
 * Who wrote this, as far as the corpus records it. ⛔ See `Wrote` — this is the one function a
 * write-time authorship field changes, and the only place in this file that asks the question.
 */
export function wroteOf(corpus: Corpus, ref: string): Wrote {
  /** ⛔ First, because it is the strongest thing a corpus can currently say about authorship. */
  const landed = decidedFor(corpus, ref);
  if (landed) return { is: "software", by: landed.by, at: landed.at };
  const r = resolveRef(corpus, ref);
  if (!("error" in r)) {
    const got = r.ref;
    if (got.kind === "requirement") {
      const d = corpus.scopes
        .find((s) => s.scope.id === got.scope)
        ?.scope.exchanges.find((e) => e.id === got.exchange)
        ?.criteria.find((c) => c.id === got.criterion)?.derived;
      if (d) return { is: "a role", by: d.by, at: d.at };
    }
    if (got.kind === "capability") {
      const d = corpus.capabilities
        .find((c) => c.capability.id === got.subsystem)
        ?.capability.offers.find((o) => o.id === got.capability)?.derived;
      if (d) return { is: "a role", by: d.by, at: d.at };
    }
    /**
     * ⛔ THE WRITE-TIME FIELD THIS FUNCTION WAS BUILT TO WAIT FOR. When this file was written,
     * authorship was unrecoverable and every claim answered `unrecorded` — 74 of 74 on the seed.
     * `wrote` now records it at the grain it is written at, so ask the narrowest grain first:
     * a slot has held thirteen statements, and a fourteenth an agent inferred must not inherit the
     * hand that wrote the other thirteen.
     *
     * ⛔ Absence stays `unrecorded` and is never read as a person. Every corpus that exists is in
     * that state, and an LLM's YAML is byte-identical to a PM's.
     */
    if (got.kind === "statement" || got.kind === "slot") {
      const ex = corpus.scopes
        .find((s) => s.scope.id === got.scope)
        ?.scope.exchanges.find((e) => e.id === got.exchange);
      const fill = ex?.slots?.[got.slot as keyof typeof ex.slots];
      const said = got.kind === "statement"
        ? /** ⛔ `name`, which is what `resolveRef` calls a statement's id. This read `.statement`,
           *  which no ref carries, so every statement's own `wrote` was skipped and an agent's
           *  sentence reported `unrecorded` beside a person's. Found by `v2-small-writes`. */
          statements(fill?.says).find((x) => x.id === got.name)
        : undefined;
      const who = authorshipOf(said, fill);
      if (who) return who.hand === "person" ? { is: "a person", by: who.as } : { is: "a role", by: who.as, at: "" };
    }
  }
  return { is: "unrecorded" };
}

/**
 * ⛔ SAID WHEREVER IT DECIDES WHAT A CONSUMER SHOULD DO, AND NOWHERE ELSE.
 *
 * On a `suggested` fact, who wrote it is the whole question: an agent's inference belongs in the
 * ticket as a question, a person's draft only needs a stamp. On `accepted` and `derived` it does not
 * arise — somebody agreed, or something was worked out and says from what. And on a stale stamp the
 * question is already answered differently: an act was performed and the words moved, so what a
 * reviewer owes is a re-reading of the diff, not an enquiry into authorship.
 */
const CANNOT_TELL = " ⛔ Nothing records who wrote it, so a person's unconfirmed draft and an agent's inference read the same here.";
const UNRECORDED_MATTERS: ReadonlyArray<Route> = ["written", "inferred", "drafted", "unruled"];

const level = (
  corpus: Corpus,
  ref: string,
  level: LevelName,
  route: Route,
  because: string,
  stale?: Level["stale"],
): Level => {
  const wrote = wroteOf(corpus, ref);
  const said =
    level === "suggested" && wrote.is === "unrecorded" && UNRECORDED_MATTERS.includes(route)
      ? because + CANNOT_TELL
      : because;
  return stale ? { ref, level, route, because: said, wrote, stale } : { ref, level, route, because: said, wrote };
};

/** `peter accepted this on 2026-10-05`, and the one place that phrasing is composed. */
const agreedLine = (by: string, at: string, through?: string): string =>
  through
    ? `${by} accepted the rule ${through} on ${at}, and it supplies every word of this`
    : `${by} accepted these words on ${at}`;

/**
 * What a standing says about whether anybody owes a decision here.
 *
 * ⛔ IT OUTRANKS THE STAMP, AND THE MODEL ALREADY DECIDED THAT. `resolveRef` reports an `open` or
 * `disputed` grain as `unsettled`, `gateFor` refuses to accept over it and `acts` moves an accepted
 * exchange that has since been opened into its stale list — so a level that read the stamp first
 * would be a second answer to a question every gate in this repo already answers one way.
 *
 * ⛔ AND THE AGREEMENT IS NOT LOST, IT IS SAID. A slot can state what it does and still have one
 * thing about it nobody has ruled; the words somebody agreed to are still agreed, and `because`
 * carries both halves so a reader can see which part of the sentence is in question.
 */
function fromStanding(corpus: Corpus, ref: string, standing: Standing): Level | null {
  if (standing.kind === "open") {
    const asked = standing.asked_of ? `, asked of ${standing.asked_of}` : "";
    const about = standing.about ? ` One thing about it is unruled: ${standing.about}.` : "";
    const stamp = stampFor(corpus, ref);
    /** ⛔ An acceptance under a live question is reported, not dropped — and it does not settle it. */
    const agreed =
      stamp.state === "accepted" ? ` ${agreedLine(stamp.by, stamp.at, stamp.through)}, and that does not answer it.` : "";
    const n = (standing.candidates ?? []).length;
    const question = standing.question ?? "nothing here says what the question is";
    if (n)
      return level(
        corpus,
        ref,
        "suggested",
        "drafted",
        `${n} answer${n === 1 ? " has" : "s have"} been drafted and nobody has chosen${asked}: ${question}${about}${agreed}`,
      );
    return level(corpus, ref, "open", "unruled", `Nobody has answered this${asked}: ${question}${about}${agreed}`);
  }
  if (standing.kind === "disputed")
    return level(
      corpus,
      ref,
      "open",
      "unruled",
      `This cannot hold with ${(standing.targets ?? []).join(", ") || "something unnamed"} — ${
        standing.because ?? "nothing says why"
      }. Only a person can rule it.`,
    );
  return null;
}

/**
 * The latitude case, asked after the stamp rather than before it.
 *
 * ⛔ IT IS `open` AND NOT `accepted`, BECAUSE ACCEPTANCE HAS EXACTLY ONE HOME. `out_of_scope` names
 * who decided and when and costs a reason — but an author writes a standing and a person records a
 * verdict, and reading `answered_by` as an acceptance would make a second route to the strongest
 * word in the model. `route: "latitude"` is what tells a consumer the other half: there is nothing
 * here to build from AND nobody owes an answer, so this is not a question to put to a person.
 */
function latitude(corpus: Corpus, ref: string, standing: Standing): Level {
  return level(
    corpus,
    ref,
    "open",
    "latitude",
    `Deliberately not answered here — ${standing.answered_by ?? "nobody named"} decided on ${
      standing.answered_at ?? "no date"
    } that it is the builder's latitude: ${standing.because ?? "nothing says why"}`,
  );
}

/** A requirement a builder implements as a test. ⛔ Its own grain, because it has its own provenance. */
function requirementLevel(corpus: Corpus, ref: string, r: Extract<Ref, { kind: "requirement" }>): Level {
  const d = demonstrationOf(corpus, r.scope, r.exchange);
  const req = d?.requirements.find((x) => x.ref === ref);
  if (!req) return level(corpus, ref, "suggested", "written", "This requirement is not in the corpus any more");
  const der = req.criterion.derived;
  if (req.state === "stale" && der)
    return level(
      corpus,
      ref,
      "suggested",
      "stale-derivation",
      `${der.by} worked this out from ${req.claim} on ${der.at}, and those words have changed since — it demonstrates the sentence as it read then`,
    );
  if (req.state === "current" && der) {
    const claim = stampFor(corpus, req.claim);
    /**
     * ⛔ `derived` MEANS DERIVED FROM ACCEPTED INPUT, SO A TEST WORKED OUT FROM A DRAFT IS A SUGGESTION.
     *
     * Peter's MVP names the three levels as *"human accepted, derived (from accepted input),
     * suggested"*, and asked for *"appropriate test cases … generated based on verified product
     * truth"*. This used to answer `derived` whatever the claim's state, with "nobody has agreed to
     * that sentence yet" in `because` — and the gate a consumer applies is the level, not the prose.
     * So a builder holding a ticket was handed a test for a sentence nobody had agreed to, at the
     * same level as one for a sentence somebody had.
     *
     * ⛔ GENERATION IS NOT GATED, ONLY THE LEVEL. *"test cases should be generated too. they should
     * just carry an invalidated state"* — the demonstrator still works from the truth as it reads,
     * and the requirement exists from the moment it does. It climbs to `derived` the moment a person
     * agrees to the claim, with nothing re-derived, because the hash it was worked out against is
     * the hash they agreed to.
     */
    if (claim.state !== "accepted")
      return level(
        corpus,
        ref,
        "suggested",
        "worked-out-from-a-draft",
        `${der.by} worked this out from ${req.claim} on ${der.at}, and that sentence has not changed since — ` +
          "but nobody has agreed to it yet, so this tests a draft. It becomes derived when somebody agrees to the claim",
      );
    return level(
      corpus,
      ref,
      "derived",
      "worked-out",
      `${der.by} worked this out from ${req.claim} on ${der.at}, and that sentence has not changed since — ` +
        agreedLine(claim.by, claim.at, claim.through),
    );
  }
  /**
   * ⛔ AN AUTHORED REQUIREMENT IS COVERED BY THE STAMP OVER IT, AND THAT IS NOT PROPAGATION.
   *
   * No verdict can name a requirement — `coveredBy` hashes nothing for a `#shows#` ref, so a stamp
   * on one could never go stale and `stampFor` correctly answers `never`. But `coveredBy` hashes the
   * criteria NOBODY derived into the exchange's stamp and prints every one of them under *"what must
   * be demonstrated"* at the moment of consent. So a person who accepted the exchange read this
   * sentence and agreed to it, and reporting it as `suggested` would send them a question they have
   * already answered.
   *
   * ⛔ The narrower stamp first. A slot-grained acceptance covers only that slot's authored
   * criteria, which is exactly the grain `coveredBy(..., only)` hashes.
   */
  const covering = [`${r.scope}#${r.exchange}#${r.slot}`, `${r.scope}#${r.exchange}`];
  for (const target of covering) {
    const st = stampFor(corpus, target);
    if (st.state === "accepted")
      return level(
        corpus,
        ref,
        "accepted",
        "inside-an-acceptance",
        `Nobody derived this, so it was covered by the acceptance of ${target} — ${agreedLine(st.by, st.at, st.through)}`,
      );
  }
  for (const target of covering) {
    const st = stampFor(corpus, target);
    if (st.state !== "never" && st.state !== "accepted")
      return level(
        corpus,
        ref,
        "suggested",
        "stale-acceptance",
        `Nobody derived this, and the acceptance of ${target} that covered it no longer holds — ${staleReason(st)}`,
        st.state,
      );
  }
  return level(
    corpus,
    ref,
    "suggested",
    "written",
    "Somebody typed this and nothing says which words it was written against, so nothing can tell whether it is current with the claim",
  );
}

/** A part of the system beneath the product. ⛔ Nothing agrees to one; it is derived or it is not. */
function capabilityLevel(corpus: Corpus, ref: string): Level {
  const d = derivedCapabilities(corpus).find((x) => x.ref === ref);
  if (!d) return level(corpus, ref, "suggested", "written", "This part is not in the corpus any more");
  const der = d.offering.derived;
  if (d.state === "stale" && der)
    return level(
      corpus,
      ref,
      "suggested",
      "stale-derivation",
      `${der.by} worked this part out on ${der.at} from what it serves, and that truth has changed since`,
    );
  if (d.state === "current" && der)
    return level(
      corpus,
      ref,
      "derived",
      "worked-out",
      `${der.by} worked this part out on ${der.at} from ${d.offering.serves.join(", ")}, which has not changed since`,
    );
  return level(
    corpus,
    ref,
    "suggested",
    "written",
    "Nothing says what this part was worked out from, so nothing can tell whether it is current with the truth it serves",
  );
}

/**
 * A slot of a real exchange that states nothing and no rule supplies.
 *
 * ⛔ IT HAS A LEVEL, AND REFUSING TO GIVE ONE WAS THE WRONG ANSWER. `check` already treats every
 * `<scope>#<exchange>#<slot>` as somewhere a reading may bear on, deliberately — a reading about a
 * blank slot is *the product does something nobody decided*, which is the one completeness signal a
 * grid structurally cannot produce. The seed's own corpus has one: `money#record-spending#refuses`
 * is reached by a constraining rule and stated nowhere, and `resolveRef` answers "says nothing at
 * all about refuses". A consumer handed that ref needs the level, not a parse error.
 *
 * ⛔ `open`, BECAUSE A BLANK IS A QUESTION EVEN THOUGH NOBODY WAS ASKED. There is nothing here to
 * build from and somebody has to say what happens, which is precisely the list `open` exists to
 * fill. It is not enumerated by `levelsIn` — eight slots times every exchange would drown a
 * distribution in blanks — but it is answerable the moment anybody points at one.
 */
function blankSlot(corpus: Corpus, ref: string): Level | null {
  const parts = ref.split("#");
  if (parts.length !== 3 || !(SLOTS as readonly string[]).includes(parts[2]!)) return null;
  const scope = corpus.scopes.find((s) => s.scope.id === parts[0])?.scope;
  const ex = scope?.exchanges.find((e) => e.id === parts[1]);
  if (!ex || ex.slots[parts[2] as SlotName]) return null;
  const { constrained } = resolveRules(corpus);
  const adds = constrained.get(ref) ?? [];
  const seen = supportFor(corpus, ref);
  return level(
    corpus,
    ref,
    "open",
    "unruled",
    `Nothing here says what happens, and no rule supplies it.` +
      (adds.length ? ` The rule ${adds.map((x) => x.id).join(", ")} constrains it without answering it.` : "") +
      (seen.length
        ? ` ⛔ ${seen.length} observation${seen.length === 1 ? "" : "s"} bear${
            seen.length === 1 ? "s" : ""
          } on it — ${seen.map((s) => `${s.kind} at ${s.ref}`).join(", ")} — so the product does something nobody has decided.`
        : ""),
  );
}

/**
 * How well established one fact is.
 *
 * ⛔ RETURNS A REASON RATHER THAN THROWING OR GUESSING, the convention `resolveRef` sets. A consumer
 * holding a ticket will ask about refs it assembled from prose, and a level invented for a ref that
 * is not in the corpus is the worst possible answer to give one.
 */
export function levelOf(corpus: Corpus, ref: string): Level | { error: string } {
  const resolved = resolveRef(corpus, ref);
  const { inherited, contested } = resolveRules(corpus);
  const rule = inherited.get(ref);
  /**
   * ⛔ A SLOT A RULE FILLS HAS NO LOCAL FILL, SO `resolveRef` CANNOT SEE IT — and that is where
   * `accepted-through-a-rule` lives. `only-a-parent-moves-money` supplies `money#record-earning#may`
   * entirely, which means the seed's most reused sentences would every one have come back as an
   * error about a slot that says nothing.
   */
  if ("error" in resolved && !rule) {
    const blank = blankSlot(corpus, ref);
    if (blank) return blank;
    /**
     * ⛔ A SCREEN HAS A LEVEL, AND WITHOUT IT `follows-an-acceptance` WOULD BE DEAD CODE. The only
     * inheritance `confidence.ts` calls a derivation runs from a confirmed happy path to the screens
     * it names in `through` — which are view refs, and `resolveRef` has no grain for one. `check`
     * and `draw-write` both already treat `<scope>#<view>` as something a reading bears on, so a
     * screen is addressable everywhere except here, and a consumer asking whether it may build a
     * screen is asking exactly this question.
     */
    if (!corpus.scopes.some(({ scope }) => scope.views.some((v) => `${scope.id}#${v.id}` === ref)))
      return { error: resolved.error };
  }
  const r = "error" in resolved ? undefined : resolved.ref;
  if (r?.kind === "requirement") return requirementLevel(corpus, ref, r);
  if (r?.kind === "capability") return capabilityLevel(corpus, ref);
  if (r?.kind === "scope")
    return { error: `${ref} is a feature, which holds facts rather than being one — name an exchange or a slot` };
  if (r?.kind === "subsystem")
    return { error: `${ref} is a part of the system, which holds offerings — name one, as ${ref}#<id>` };

  const standing = "error" in resolved ? undefined : resolved.standing;
  if (standing && standing.kind !== "stated" && standing.kind !== "out_of_scope") {
    const l = fromStanding(corpus, ref, standing);
    if (l) {
      /** ⛔ An org-wide answer against a local question is not a tie somebody can be left to break. */
      const rival = contested.get(ref);
      if (!rival?.length) return l;
      return {
        ...l,
        because: `${l.because} The rule ${rival.map((x) => x.id).join(", ")} answers this, and the author says nobody has — only a person can say which is stale.`,
      };
    }
  }

  const stamp = stampFor(corpus, ref);
  if (stamp.state === "accepted") {
    const d = discrepancyFor(corpus, ref);
    /**
     * ⛔ EVIDENCE THAT LANDED AFTERWARDS IS A WARNING, NOT A DOWNGRADE. A confirmation is a
     * judgement about a statement at a moment; a reading dated after it is the one thing that can
     * make that judgement wrong without anybody touching the sentence. It is still what a person
     * agreed to, so it stays `accepted` — and `because` says somebody has to look again, which is
     * the only thing that resolves it. Reporting it as `suggested` would be this module deciding
     * that an observation outranks a person.
     */
    return level(
      corpus,
      ref,
      "accepted",
      stamp.through ? "accepted-through-a-rule" : "accepted-here",
      agreedLine(stamp.by, stamp.at, stamp.through) +
        (d
          ? `. ⛔ ${d.since.length} observation${d.since.length === 1 ? "" : "s"} recorded since — ${d.since
              .map((s) => `${s.kind} at ${s.ref}`)
              .join(", ")} — and nobody has looked again`
          : ""),
    );
  }
  /** ⛔ THE RULE THIS FILE IS ARRANGED AROUND. One sentence, and it is `staleReason`'s. */
  if (stamp.state !== "never")
    return level(corpus, ref, "suggested", "stale-acceptance", staleReason(stamp) ?? "", stamp.state);

  /**
   * ⛔ A STALE AGREEMENT TO A RULE DOES NOT REACH THE SLOTS THE RULE SUPPLIES, and `stampFor` says
   * so by refusing to inherit it — `acceptedThroughRule` returns nothing once the rule's hashes
   * move. What it cannot say is WHY, because at this ref there is no verdict at all. Without this
   * branch a reworded org-wide rule would drop every slot it fills to "nobody has agreed", which is
   * true and useless: the thing a reviewer has to do is re-read one rule, not eighty-eight slots.
   */
  if (rule) {
    const st = stampFor(corpus, rule.id);
    if (st.state !== "never" && st.state !== "accepted")
      return level(
        corpus,
        ref,
        "suggested",
        "stale-acceptance",
        `Every word of this comes from the rule ${rule.id}, and the agreement to that rule no longer holds — ${staleReason(
          st,
        )}`,
        st.state,
      );
  }

  if (standing?.kind === "out_of_scope") return latitude(corpus, ref, standing);

  /**
   * ⛔ `derived`, AND IT IS THE ONE INHERITANCE ROUTE THAT MAY REACH IT. `inheritedFor` returns two:
   * `derived` is the same claim restated — a confirmed happy path names the screens it passes
   * through, and the path says so — while `shared-support` is strength borrowed from a neighbour
   * resting on the same evidence, which says nothing about anybody having examined THIS. The second
   * one stays `suggested` below, carrying the warning `confidence.ts` attaches to it.
   */
  const inheritedHere = inheritedFor(corpus, ref);
  const follows = inheritedHere.find((i) => i.how === "derived");
  if (follows)
    return level(
      corpus,
      ref,
      "derived",
      "follows-an-acceptance",
      `This follows from ${follows.from}, which is accepted — ${follows.because}`,
    );

  /** ⛔ The product was seen doing it. See `SEEN_RUNNING` for why this is `derived` and not above it. */
  const own = supportFor(corpus, ref);
  const seen = seenRunning(corpus, ref);
  if (seen.length)
    return level(
      corpus,
      ref,
      "derived",
      "observed",
      `The product was seen doing this — ${seen
        .map((s) => `${s.basis.kind} at ${s.basis.ref}${s.basis.at ? ` on ${s.basis.at}` : ""}`)
        .join(", ")}. ⛔ Nobody has agreed that it should.`,
    );

  /**
   * ⛔ WHAT SOFTWARE DECIDED, SAID ON THE THING ITSELF. Peter: "decide and override, but should be
   * obvious to be asked to change." A default nobody can see is a default nobody overrides — it
   * quietly becomes the answer — so this reads as an answer somebody can argue with rather than as
   * a blank, and it is still `suggested`, because `via: agent` is not consent.
   */
  const landed = decidedFor(corpus, ref);
  const c = confidenceOf(corpus, ref);
  const read = own.length
    ? ` Read from ${own.map((s) => `${s.kind} at ${s.ref}`).join(", ")}, so: ${c.strength}.`
    : c.contained.length
      ? ` ${c.contained.length} reading${c.contained.length === 1 ? "" : "s"} bear${
          c.contained.length === 1 ? "s" : ""
        } on the exchange around it rather than on this sentence, so: ${c.strength}.`
      : "";
  /**
   * ⛔ SAID ONLY WHEN IT IS TRUE, which `confidence.ts` got wrong once and fixed by rendering the
   * page and reading the sentence: borrowed strength on something nobody examined is the case Peter
   * accepted knowingly, and crying it on a well-read statement is how a reader learns to skip the
   * line.
   */
  const borrowed =
    !own.length && inheritedHere.length
      ? ` ⛔ Nobody has read this statement itself — its support is borrowed from ${inheritedHere
          .map((i) => i.from)
          .join(", ")}, which rest on the same evidence.`
      : "";
  /**
   * ⛔ AN ACCEPTANCE OF THE WHOLE EXCHANGE IS REPORTED AND DOES NOT CHANGE THE LEVEL, AND THE
   * ASYMMETRY WITH A REQUIREMENT IS DELIBERATE.
   *
   * `coveredBy(exchange)` hashes all eight slots and the accept preview prints every sentence, so a
   * person who accepted the exchange did read this one. But a slot CAN be accepted on its own, and
   * `acts` builds the list a person is handed with `!isAccepted(slotRef)` — strictly per ref. So
   * answering `accepted` here would make this the only surface in the model that disagrees with the
   * queue, which is the defect `stampFor`'s header is about. A requirement is the opposite case:
   * nothing can stamp one and nothing asks about one separately, so the covering stamp is the only
   * answer available.
   *
   * ⛔ IT IS STILL SAID, because the alternative is a consumer raising a question with somebody who
   * has already read the sentence — and that is the review surface this project keeps paying for.
   */
  const seg = ref.split("#");
  const exStamp = seg.length >= 3 ? stampFor(corpus, `${seg[0]}#${seg[1]}`) : { state: "never" as const };
  const inside =
    exStamp.state === "accepted"
      ? ` ${exStamp.by} accepted the whole of ${seg[0]}#${seg[1]} on ${exStamp.at}, which covered these words — ⛔ reported as what it is: an acceptance of the exchange, and not of this sentence.`
      : "";
  if (landed)
    return level(
      corpus,
      ref,
      "suggested",
      "landed-by-software",
      `${landed.by} landed this for you on ${landed.at} and nobody has looked at it.${read}${borrowed}${inside}`,
    );
  if (own.length || c.contained.length)
    return level(corpus, ref, "suggested", "inferred", `Nobody has agreed to this.${read}${borrowed}${inside}`);
  return level(
    corpus,
    ref,
    "suggested",
    "written",
    (rule
      ? `Every word of this comes from the rule ${rule.id}, and nobody has agreed to that rule either`
      : "Nobody has agreed to this, and nothing has been observed about it") + inside,
  );
}

/**
 * Every fact in a corpus, with its level.
 *
 * ⛔ THE UNITS A BUILDER WORKS FROM, WHICH IS NOT THE SAME AS EVERY REF. An exchange is eight
 * statements and a scope is many exchanges; counting those as well would report the same fact at
 * three grains and make a distribution meaningless. So: what a feature is for, each framing card,
 * each slot — statement-grained where a slot says several things, the same device `demonstrationOf`
 * uses — each requirement, each rule, each charter section, and each part of the system.
 */
export function levelsIn(corpus: Corpus): Level[] {
  const { inherited } = resolveRules(corpus);
  const refs: string[] = [];
  for (const { charter } of corpus.charter) for (const s of charter.sections) refs.push(`${charter.id}#${s.id}`);
  for (const { rule } of corpus.rules) refs.push(rule.id);
  for (const { scope } of corpus.scopes) {
    if (scope.happy_path) refs.push(`${scope.id}#happy-path`);
    for (const [list, held] of [
      ["why", scope.why],
      ["risk", scope.risks],
      ["measure", scope.measures],
      ["instrument", scope.instruments],
    ] as const)
      for (const one of held ?? []) refs.push(`${scope.id}#${list}#${one.id}`);
    for (const ex of scope.exchanges) {
      const exRef = `${scope.id}#${ex.id}`;
      for (const slot of SLOTS as readonly SlotName[]) {
        const fill = ex.slots[slot];
        if (!fill) {
          if (inherited.has(`${exRef}#${slot}`)) refs.push(`${exRef}#${slot}`);
          continue;
        }
        const said = statements(fill.says);
        if (said.length > 1) for (const s of said) refs.push(`${exRef}#${slot}#${s.id}`);
        else refs.push(`${exRef}#${slot}`);
      }
      for (const c of ex.criteria) refs.push(`${exRef}#shows#${c.id}`);
    }
  }
  for (const { capability } of corpus.capabilities)
    for (const o of capability.offers) refs.push(`${capability.id}#offers#${o.id}`);

  const out: Level[] = [];
  for (const ref of refs) {
    const l = levelOf(corpus, ref);
    /** ⛔ An unresolvable ref here would be a bug in this enumeration, not a fact with no level. */
    if (!("error" in l)) out.push(l);
  }
  return out;
}

/** How many facts stand at each level. ⛔ Arithmetic over `levelsIn`, so it cannot disagree with it. */
export function countLevels(levels: readonly Level[]): Record<LevelName, number> {
  const out: Record<LevelName, number> = { accepted: 0, derived: 0, suggested: 0, open: 0 };
  for (const l of levels) out[l.level] += 1;
  return out;
}

/**
 * ⛔ THE LEVEL IN THE WORDS A READER SEES, AND ONE PLACE THAT SAYS THEM.
 *
 * `accepted` reads as `agreed` because that is what a person did; the other three are already plain.
 * A route name is never shown in text — `accepted-through-a-rule` is an argument's label, and a
 * builder reading a packet needs the gate, not the label. Every text surface that prints a level
 * prints it through this, so a packet and a grid cannot call the same fact two different things.
 */
export const LEVEL_WORD: Readonly<Record<LevelName, string>> = {
  accepted: "agreed",
  derived: "derived",
  suggested: "suggested",
  open: "open",
};

/**
 * A level as fields beside a claim another read returns — `levelOf`'s answer and nothing else.
 *
 * ⛔ THE GAP THIS CLOSES. `find` and `readiness` carried the level; the record, the questions, the
 * grid and the packet did not, so a session reading a behaviour through any of those could not tell
 * an agreed sentence from a draft without a second call. A second call is a step an agent skips.
 *
 * ⛔ COMPUTED HERE, NEVER RE-DERIVED BESIDE IT. A read that worked out "agreed" from `stampFor` on
 * its own would be a second answer to the one question this module exists to answer once — and
 * would miss the stale and through-a-rule cases that are the whole reason `levelOf` is long.
 *
 * ⛔ AN UNADDRESSABLE REF GETS NO FIELDS, NOT A GUESSED LEVEL. A question about a word, or a
 * read-through of a whole feature, has no level — `levelOf` says why — and inventing one is worse
 * than the absence. `because` is left off for the reads whose items already explain themselves.
 */
export function levelFields(
  corpus: Corpus,
  ref: string,
  { because = true }: { because?: boolean } = {},
): { level?: LevelName; route?: Route; because?: string } {
  const l = levelOf(corpus, ref);
  if ("error" in l) return {};
  return because ? { level: l.level, route: l.route, because: l.because } : { level: l.level, route: l.route };
}
