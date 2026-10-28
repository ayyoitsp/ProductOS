/**
 * Whether a piece of work can be built, as a FIELD — ⛔ AND IT COMPUTES NOTHING OF ITS OWN.
 *
 * The MVP's actor is a consumer: a Claude Code instance holding a ticket, asking whether it may
 * start. The usability review found the answer existed and was unreachable: *"The packet is one
 * markdown string. The readiness verdict ("This packet has 2 holes… Settle them first") is prose in
 * a preamble rather than a field. An agent deciding 'ready or not' has to parse warnings out of
 * markdown."* 22 KB of markdown, for one small scope, with the one bit it needed inside a sentence.
 *
 * ⛔ SO THIS FILE IS A PROJECTION AND NOT A SECOND OPINION. Every answer in it is somebody else's:
 *
 *   `levelOf`          how established one fact is — the four names and the `because`
 *   `questionsFor`     what a person owes, which is the one home for "this is a question"
 *   `gridFor`          what state each slot is in, including which blanks are holes
 *   `demonstrationOf`  the requirements, their provenance and the claim each one shows
 *   `requirementHash`  the hash of the words a requirement was written from
 *
 * Nothing here re-derives any of those. A readiness that computed its own holes would be a second
 * answer to the question `check`, the packet and the grid each already answer — and all three carry
 * a ⛔ saying they must agree with each other about what a hole is. A fourth copy is how they stop.
 *
 * ⛔ AND THE GATE IS ONE LINE, STATED ONCE: nothing it touches may be below `derived`. Peter's
 * architecture review put it that way — *"A ticket is groomed when nothing it touches is below
 * `derived`"* — and `levelOf` already draws that line in the only place it can be drawn honestly.
 *
 * ⛔ NO TRACKER. Peter: *"we can hash out linear connections later, so ignore those."* The input is a
 * scope or an exchange, never a ticket id. The agent holds its tracker through its own connector and
 * writes the answer there; ProductOS answers about truth and nothing else.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRules, type Corpus } from "./load.js";
import { SLOTS, type SlotName } from "./schema.js";
import { countLevels, levelOf, levelsIn, type Level, type LevelName, type Route, type Wrote, OWED } from "./level.js";
import { gridFor } from "./grid.js";
import {
  descendants,
  questionsFor,
  unbuildableReads,
  buildableReads,
  readThroughsFor,
  whereQuestionStands,
  blankSlots,
  type Question,
  type ReadThrough,
} from "./settle.js";
import { demonstrationOf, unservedIn, answeringParts, type AnsweringPart, type RequirementState } from "./demonstrate.js";
import { requirementHash } from "./stamp.js";
import { resolveRef } from "./ref.js";

/**
 * ⛔ THE GATE, AS A LIST OF THE LEVELS THAT PASS IT.
 *
 * Peter, on the consumer's question: *"A ticket is groomed when nothing it touches is below
 * `derived`."* Written as the set rather than as a comparison, because `LevelName` is four names
 * and not a number — an ordering invented here would be a second scale, and the next name added to
 * `level.ts` would silently land on whichever side the arithmetic happened to put it.
 */
/**
 * ⛔ THE LINE FALLS WHERE `derived` / `suggested` FELL, AND THAT IS WHY THE SCALE HAS FOUR RUNGS
 * RATHER THAN TWO.
 *
 * Peter's rule is unchanged: *"A ticket is groomed when nothing it touches is below `derived`."*
 * What `derived` meant — worked out from agreed words, following an acceptance, or the product
 * seen doing it — is `corroborated` in `level.ts`'s `WORTH` table. What `suggested` meant is
 * `one-source` and below: a derivation from a draft, a stale agreement, an inference.
 *
 * ⛔ SO `one-source` IS DELIBERATELY OUTSIDE. It is not "a bit buildable": a requirement worked out
 * from words nobody agreed to is the exact case `v2-how-established-is-this` pins as *"a test for a
 * draft passed the gate a builder applies"*. The rung says it is worth more than nothing, which is
 * true, and the gate says it is not enough, which is also true.
 *
 * ⛔ STILL WRITTEN AS A SET AND NOT A COMPARISON, which is this file's own ⛔ and survives the
 * change: the scale is ordered, so `>= "one-source"` would compile and would silently re-admit
 * whatever rung somebody adds next. A set has to be edited on purpose.
 */
export const BUILDABLE: ReadonlyArray<LevelName> = ["accepted", "strongly-supported", "corroborated"];

/**
 * The routes that mean somebody owes an answer — ⛔ `level.ts`'s LIST, NOT A SECOND COPY OF IT.
 *
 * This file held `["unruled", "drafted"]` and explained itself by what the OLD scale could not do:
 * an open slot with answers drafted against it read `suggested`, so *"a hole list built from the
 * `open` level would have dropped the seed's two best questions — the ones that arrive with options
 * and the cost of guessing wrong"*. That workaround was right and it is now the model: collapsing
 * the four level names put the question onto `Level.owed`, whose routes are exactly this list.
 *
 * ⛔ SO IT IS RE-EXPORTED RATHER THAN RESTATED. Two copies of "which routes are a question" would
 * agree today and drift the first time a route is added — and `level.ts` is where the flag is set,
 * so it is where the list belongs. Kept under this name because `groomingPrompt` and the holes list
 * read it, and a rename would be churn with no reader.
 *
 * ⛔ `latitude` IS STILL ABSENT, for the reason it always was: `out_of_scope` is nothing to build
 * from AND nobody owing an answer — a declaration a builder relies on rather than a question to put
 * to a person. The packet says the same thing in words: **"This is your latitude."**
 */
export const A_QUESTION: ReadonlyArray<Route> = OWED;

/**
 * Lists a scope holds that nobody implements — ⛔ REPORTED AND NEVER GATED.
 *
 * `levelsIn` enumerates a feature's framing cards beside its behaviours, correctly: each is a claim
 * somebody can agree to or reword. They are not what a builder builds, and gating on them would
 * make every real corpus unbuildable because nobody has stamped the reasons it exists — which is
 * the usability review's complaint about the page arriving from the other direction (*"Four yellow
 * warnings follow… On a new feature they outnumber the content"*).
 *
 * ⛔ `happy-path` IS NOT IN THIS LIST. It is what the feature does, start to finish, and `ref.ts`
 * calls it *"the one thing agreed before anything in it"*. A reason is rationale; a path is
 * behaviour.
 */
const FRAMING: ReadonlyArray<string> = ["why", "risk", "measure", "instrument"];

/** One testing requirement, as a builder receives it. */
export interface TestRequirement {
  /** `<scope>#<exchange>#shows#<id>` — the address, which a person can also park or question. */
  ref: string;
  /**
   * The hash of the words it was written from.
   *
   * ⛔ CARRIED, BECAUSE THE REF ALONE CANNOT SAY WHICH VERSION. The packet's own instruction:
   * *"the ref says which requirement, the hash says which version, and a requirement whose hash no
   * longer matches is one to revisit rather than to trust."*
   */
  hash: string;
  /** given / when / then, or the steps where it has no triple. */
  says: string;
  /** The claim it demonstrates — `<scope>#<exchange>#<slot>`, statement-grained where `of` says so. */
  demonstrates: string;
  /** Which slot it demonstrates. */
  slot: SlotName;
  /** `current` worked out from the claim as it reads, `stale` from words that moved, `authored` typed. */
  state: RequirementState;
  level: LevelName;
  route: Route;
  because: string;
  wrote: Wrote;
}

/** A question that reaches this work and lands on none of its facts. */
export interface Nearby {
  ref: string;
  kind: string;
  asks: string;
}

export interface Readiness {
  /** What was asked about. */
  ref: string;
  grain: "scope" | "exchange";
  title: string;
  /** ⛔ The one field this whole file exists to produce. */
  ready: boolean;
  /** Why, in one sentence, naming which of the two reasons it is. */
  because: string;
  /** How many facts stand at each level. ⛔ Arithmetic over the lists below, so it cannot disagree. */
  counts: Record<LevelName, number>;
  /** Questions somebody owes that land on a fact here. ⛔ Nothing here is buildable. */
  holes: Level[];
  /** Claims nobody has agreed to and nobody has questioned. ⛔ These need a READ, not an answer. */
  unagreed: Level[];
  /** Declared latitude — nothing to build, and nobody owes an answer. */
  latitude: Level[];
  /** Accepted or derived. The part that is ready. */
  settled: Level[];
  /** Why this exists, what could go wrong, how we would know. Reported, never gated. */
  framing: Level[];
  /** The test list, in the packet's order. */
  requirements: TestRequirement[];
  /**
   * Whether a person read this end to end and could build from it — ⛔ GATING, AND THE ONLY PART
   * OF THIS VERDICT NOTHING CAN COMPUTE.
   *
   * Peter: *"buildability should be a part of readiness, should not introduce a new 'groomed'
   * concept. don't know what we would use 'ready' for outside of buildability."*
   *
   * Before this, `ready` was four emptiness checks over the SHAPE of the record: every slot
   * filled, every claim agreed, every requirement established, every claim demonstrated. All four
   * can hold over a corpus where two screens claim the same piece of state, nothing says where the
   * data comes from, and nothing describes what happens to half-finished work — each of those is a
   * filled slot, and the arithmetic counts it as settled. That is the second tenet, and no
   * traversal tests it.
   *
   * `buildability` the reviewer asks exactly that question and returns prose to a session; the
   * `read` act is where a person records the answer. Both existed. Nothing joined them to the
   * field a consumer asks before it starts work.
   */
  read: {
    /** The newest read-through standing over this work, from a person. */
    latest: ReadThrough | null;
    /**
     * Readings that say a builder could not start — ⛔ INCLUDING ONES RECORDED ON AN ANCESTOR.
     * A person reads a subtree end to end; a child that ignored its parent's reading would report
     * itself buildable on the strength of nobody having read it specifically.
     */
    stopped: ReadThrough[];
    /**
     * Yeses that no longer count: the words moved, or nothing recorded which words they were.
     *
     * ⛔ THE LAST THING IN THIS GATE THAT COULD BE TRUE FOREVER. Both derived layers carry
     * `derived.from`; the human act carried nothing, so a person could read a feature, say they
     * could build it, and have that stand after every sentence in it was rewritten — and a stale
     * stamp looks exactly like a current one, which is why nobody found it by reading.
     */
    spent: ReadThrough[];
    /**
     * ⛔ NOBODY HAS READ THIS, WHICH IS NOT THE SAME AS IT PASSING — and the distinction is the
     * whole reason this is a field rather than a filter.
     *
     * "No reading says this is unbuildable" is also what a corpus nobody ever opened produces.
     * Same shape as the zero that this project has now mis-read six times: for a signal whose
     * absence is indistinguishable from its success, absence is not weak evidence, it is none. So
     * an unread scope is `ready: false` with a reason naming the act that would settle it, rather
     * than a pass nobody earned.
     */
    unread: boolean;
  };
  /**
   * Claims that owe a demonstration and have no testing requirement at all.
   *
   * ⛔ GATING, BECAUSE A BUILDER WITH NO TEST LIST IS NOT READY — THEY ARE UNCHECKED. Peter: *"make
   * sure appropriate test cases are being generated based on verified product truth"*. Before this,
   * `ready` read only the claims and the requirements that existed, so an exchange whose every claim
   * was agreed and nothing demonstrated came back `ready: true` with "0 testing requirements to
   * implement" — the one state this list exists to stop reaching a builder. The predicate is
   * `demonstrationOf`'s `undemonstrated`, the same one `check` and the packet use, so three readers
   * cannot disagree about whether a claim owes one.
   *
   * Routed to the demonstrator, not to a person: nobody authors a criterion.
   */
  untested: string[];
  /**
   * Statements no machinery answers and nobody has concluded need none — ⛔ GATING, SINCE fg-0020.
   *
   * Peter: *"does buildability also ensure capabilities are mapped from a feature?"*, then
   * *"that doesnt change the fact that the feature isn't bcked by a capability"*, then
   * *"let's implement fg0020"*.
   *
   * This is `untested`'s twin and it shipped as a report, with the reason written down as a gap: a
   * behaviour can legitimately need NO new machinery, and the model had nowhere to say so — so a
   * refusal could only be cleared by inventing a part, which is verbatim the failure `none: true`
   * exists to prevent.
   *
   * `needs_nothing` is that somewhere. An empty list is now reachable without inventing anything, so
   * the asymmetry is gone and this blocks exactly as `untested` does:
   *
   *   a part serves it            answered
   *   a decomposer concluded      nothing has to be built, with a reason, against this wording
   *   neither                     ⛔ a builder has no idea what makes this happen
   *
   * ⛔ AND A CONCLUSION ONLY COUNTS WHILE ITS HASH MATCHES. Conclude nothing is needed, then reword
   * the promise, and it is unserved again — otherwise this gate has a permanent bypass with a
   * one-line cost.
   */
  unserved: string[];
  /**
   * Parts this work leans on that no person has validated — ⛔ GATING, AND NOTHING MORE THAN THIS.
   *
   * Peter: *"the dependency is a capability dependency, and those should be validated"*, and
   * *"we don't need to check the balance moved, we need to ensure the capability of 'ledger' and
   * 'increment balance' has been validated by a human, but not more than that"*.
   *
   * ⛔ THE SECOND SENTENCE IS A BOUNDARY AND IT IS THE DESIGN. The obvious reading of a dependency
   * between features is a cross-feature test — complete a task, then check the balance moved. That
   * is a thing to BUILD, and it belongs to whoever builds it. What a corpus owes is narrower and is
   * the thing nothing else can supply: the part this promise leans on is one a person has read and
   * put their name to. So this reports exactly that, derives no criterion from an edge, and asserts
   * nothing about runtime.
   *
   * ⛔ AND IT IS A GATE RATHER THAN A REPORT, for the reason `unserved` is: tenet one is that truth
   * is human-validated, and a promise answered by machinery nobody has read is a promise validated
   * at the top and unexamined one level down. Reaching an empty list needs nothing invented — a
   * person reads the part and agrees — which is exactly what `needs_nothing` had to exist for before
   * `unserved` could gate.
   */
  unvalidated: AnsweringPart[];
  /**
   * Questions that reach this work without landing on any of its facts.
   *
   * ⛔ REPORTED AND NOT GATING, which is `awaiting`'s distinction and not one invented here. An
   * org-wide rule nobody has ruled supplies no sentence — so where the exchange already states the
   * slot, the local sentence is the answer and the rule is holding nothing open. It is still worth a
   * grooming agent's attention, because ruling it may change what this says.
   */
  openElsewhere: Nearby[];
}

/** `<scope>` or `<scope>#<exchange>` — ⛔ resolved by the one place that owns the grammar. */
function targetOf(
  corpus: Corpus,
  ref: string
): { grain: "scope" | "exchange"; scope: string; exchange?: string; title: string } | { error: string } {
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { error: r.error };
  if (r.ref.kind === "scope") {
    const title = corpus.scopes.find((s) => s.scope.id === r.ref.id)?.scope.title ?? r.ref.id;
    return { grain: "scope", scope: r.ref.id, title };
  }
  if (r.ref.kind === "exchange") {
    const got = r.ref;
    const title =
      corpus.scopes
        .find((s) => s.scope.id === got.scope)
        ?.scope.exchanges.find((e) => e.id === got.exchange)?.title ?? got.id;
    return { grain: "exchange", scope: got.scope, exchange: got.exchange, title };
  }
  return {
    error: `${ref} is a ${r.ref.kind}. Readiness is asked of a feature or of one behaviour — name a scope, or <scope>#<exchange>`,
  };
}

/** Whether a ref is one of a feature's framing cards. */
const isFraming = (ref: string): boolean => {
  const seg = ref.split("#");
  return seg.length === 3 && FRAMING.includes(seg[1]!);
};

const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Whether this work can be built, and what stands in the way.
 *
 * ⛔ RETURNS A REASON RATHER THAN THROWING OR GUESSING — the convention `resolveRef` and `levelOf`
 * both set, and it matters more here than anywhere: a consumer asking this question is about to act
 * on the answer, and a verdict invented for a ref that is not in the corpus is the worst possible
 * thing to hand one.
 */
export function readinessOf(corpus: Corpus, ref: string): Readiness | { error: string } {
  const target = targetOf(corpus, ref);
  if ("error" in target) return target;
  const { grain, scope, exchange, title } = target;

  /**
   * ⛔ A SCOPE ANSWERS FOR EVERYTHING FILED UNDER IT. `compilePacket` learned this the hard way —
   * it stopped at one scope under a heading reading *"Everything below is what the product must
   * do"*, so a child three levels down with an open question appeared nowhere. A container has no
   * exchanges of its own, so a container answering for itself alone answers for nothing.
   */
  const scopes = grain === "scope" ? descendants(corpus, scope) : [scope];

  /** ⛔ `questionsFor` is the one home for "somebody owes an answer here", in the queue's own order. */
  const asked = questionsFor(corpus, scope)
    .filter((q) => q.ref !== ref)
    .map((q) => ({ q, where: whereQuestionStands(corpus, q, scopes, exchange) }));
  const owed = asked.filter((x) => x.where === "on it").map((x) => x.q);
  const openElsewhere: Nearby[] = asked
    .filter((x) => x.where === "around it")
    .map(({ q }) => ({ ref: q.ref, kind: q.kind, asks: norm(q.asks) }));

  /** ⛔ And the blanks `levelsIn` deliberately leaves out, from the grid that already classified them. */
  const blanks = scopes.flatMap((s) => blankSlots(corpus, s, exchange));

  /**
   * ⛔ WHAT A PERSON SAID STOPPED THEM IS A HOLE, THROUGH THE SAME PATH AN OPEN QUESTION TAKES.
   *
   * Peter: *"buildability should be a part of readiness."* A reader who got to the end and named
   * two slots that stopped them has said something no traversal can reach — and routing it into
   * `holeRefs` rather than into a list of its own means every count, every verdict sentence and
   * every consumer already handles it. A blocker that is ALSO an open question is one hole, not
   * two, because this is a set.
   */
  /** ⛔ The ref at the grain asked about, so a behaviour's own read-through is found. */
  const at = exchange ? `${scope}#${exchange}` : scope;
  const reads = buildableReads(corpus, at);
  const stopped = unbuildableReads(corpus, at);
  /**
   * ⛔ A YES THAT NO LONGER COUNTS IS NOT THE SAME AS NO YES, and collapsing them would hand
   * somebody the wrong next step. "Nobody has read this" sends you to get it read; "peter read it
   * and three sentences have moved since" sends you to tell peter what changed — which is the
   * difference between a first review and a re-confirmation, and the reason `covered_text` exists.
   */
  const spent = readThroughsFor(corpus, at)
    .filter((r) => r.buildable === true && (!r.of || r.stale))
    /**
     * ⛔ UNLESS SOMEBODY HAS SINCE READ IT AGAINST THE WORDS AS THEY NOW READ. The log is
     * append-only, so every expired yes stays in it forever — reporting them all would mean a scope
     * read four times carries three complaints about readings that have been superseded, and the
     * verdict would get noisier every time somebody did the right thing.
     *
     * ⛔ NOT THE SAME AS A RECORDED NO, WHICH IS NEVER SUPERSEDED BY A LATER YES. A no named
     * something that stopped a person; only another reading retracts it. A spent yes is not a
     * finding at all — it is an absence of evidence, and fresh evidence fills it.
     */
    .filter((r) => !reads.some((current) => current.scope === r.scope));
  const blockers = stopped.flatMap((r) => r.blockedBy);

  const holeRefs = new Set<string>([...owed.map((q) => q.ref), ...blanks, ...blockers]);

  const holes: Level[] = [];
  const unagreed: Level[] = [];
  const latitude: Level[] = [];
  const settled: Level[] = [];
  const framing: Level[] = [];

  /**
   * ⛔ ONE ENUMERATION, AND IT IS `levelsIn`'s. *"The units a builder works from, which is not the
   * same as every ref"* — statement-grained where a slot says several things, so a slot saying nine
   * things is nine facts rather than one. Re-walking the corpus here would be a second answer to
   * what a feature consists of.
   *
   * ⛔ Requirements come out, because they are the test list and carry a hash the rest do not. They
   * still reach the gate; see `requirements` below.
   */
  const mine = levelsIn(corpus).filter((l) => {
    const seg = l.ref.split("#");
    if (!scopes.includes(seg[0]!)) return false;
    if (exchange && seg[1] !== exchange) return false;
    return seg[2] !== "shows";
  });

  const place = (l: Level) => {
    if (isFraming(l.ref)) return framing.push(l);
    /**
     * ⛔ THE REF `questionsFor` NAMED, OR THE FACT'S OWN ROUTE — WHICHEVER SAYS SOMEBODY OWES AN
     * ANSWER. The queue is the home for the question and the only place that carries the drafted
     * options and the cost of guessing wrong, so it is asked first. The route is the second guard:
     * a standing the queue does not yet raise would otherwise be filed as a claim awaiting a READ,
     * and sent to a reviewer who has nothing to review.
     */
    if (holeRefs.has(l.ref) || A_QUESTION.includes(l.route)) return holes.push(l);
    if (l.route === "latitude") return latitude.push(l);
    if (BUILDABLE.includes(l.level)) return settled.push(l);
    return unagreed.push(l);
  };
  for (const l of mine) place(l);

  /**
   * ⛔ A HOLE `levelsIn` NEVER NAMED STILL GOES IN THE LIST. A blank slot is left out of that
   * enumeration on purpose — eight slots times every exchange would drown a distribution in blanks
   * — and an unruled refusal case, an open rule and a contested word are not slots at all. Every one
   * of them is answerable the moment anybody points at it, which is what this does.
   */
  const named = new Set(mine.map((l) => l.ref));
  for (const r of holeRefs) {
    if (named.has(r)) continue;
    const l = levelOf(corpus, r);
    if ("error" in l) continue;
    holes.push(l);
  }
  /** ⛔ The queue's order, which is `orderByAttention`'s: worst use of somebody's attention last. */
  const rank = new Map([...holeRefs].map((r, i) => [r, i]));
  /** ⛔ One the queue has not raised sorts last, since nothing has ranked a person's attention on it. */
  holes.sort((a, b) => (rank.get(a.ref) ?? holeRefs.size) - (rank.get(b.ref) ?? holeRefs.size));

  /** ⛔ The requirements are `demonstrationOf`'s, so this cannot disagree with the packet or `check`. */
  const requirements: TestRequirement[] = [];
  const untested: string[] = [];
  for (const s of scopes) {
    const entry = corpus.scopes.find((x) => x.scope.id === s);
    for (const ex of entry?.scope.exchanges ?? []) {
      if (exchange && ex.id !== exchange) continue;
      const shown = demonstrationOf(corpus, s, ex.id);
      untested.push(...(shown?.undemonstrated ?? []));
      for (const req of shown?.requirements ?? []) {
        const l = levelOf(corpus, req.ref);
        if ("error" in l) continue;
        const c = req.criterion;
        const bits = [c.given && `given ${c.given}`, c.when && `when ${c.when}`, c.then && `then ${c.then}`]
          .filter(Boolean)
          .join(", ");
        requirements.push({
          ref: req.ref,
          hash: requirementHash(c),
          says: norm(bits || c.steps),
          demonstrates: req.claim,
          slot: c.slot,
          state: req.state,
          level: l.level,
          route: l.route,
          because: l.because,
          wrote: l.wrote,
        });
      }
    }
  }

  /** ⛔ `unservedIn`'s answer, at the grain asked about — never recomputed from the tree here. */
  const unserved = unservedIn(corpus, scopes, exchange);
  /**
   * ⛔ `answeringParts`' answer, filtered to the grain, never re-walked. A second traversal of the
   * `serves` chain here would be a third opinion about what a promise leans on — `check` already
   * walks it for `a-capability-serves-only-other-machinery`.
   */
  const unvalidated = answeringParts(corpus, scopes)
    .filter((p) => !exchange || p.answers === `${scope}#${exchange}`)
    .filter((p) => !p.validated);

  const unbuildable = requirements.filter((r) => !BUILDABLE.includes(r.level));
  const counts = countLevels([...holes, ...unagreed, ...latitude, ...settled, ...requirements]);
  /**
   * ⛔ `stopped` AND `unread` ARE TWO REASONS AND NEITHER IS THE OTHER. One is a person saying no;
   * the other is nobody having been asked. They route to different acts — find out what they hit,
   * versus get somebody to read it — so `verdict` names whichever it is.
   */
  const read = {
    latest: reads[0] ?? null,
    stopped,
    /**
     * Readings that said yes against words that have since moved, or against nothing recorded.
     *
     * ⛔ REPORTED SEPARATELY FROM `unread` BECAUSE IT ROUTES SOMEWHERE ELSE — see `spent`.
     */
    spent,
    /**
     * ⛔ NEITHER ANSWER WAS GIVEN — not "there is no yes". A reading that said no makes `stopped`
     * non-empty and leaves `reads` empty, so a field meaning "no recorded yes" would be true
     * alongside it and `verdict` would print both *"X could not build from it"* and *"nobody has
     * read this"* about the same scope. Two sentences, contradicting, from one verdict.
     *
     * ⛔ A SPENT YES COUNTS AS HAVING BEEN READ, for the same reason: somebody did read it, and
     * telling them nobody had would be false and would send them to the wrong act.
     */
    unread: reads.length === 0 && stopped.length === 0 && spent.length === 0,
  };
  const ready =
    holes.length === 0 &&
    unagreed.length === 0 &&
    unbuildable.length === 0 &&
    untested.length === 0 &&
    /**
     * ⛔ fg-0020 CLOSED THIS. It reported rather than blocked only because an empty list was
     * unreachable without inventing a part; `needs_nothing` makes it reachable, so the twin of
     * `untested` now behaves like `untested`.
     */
    unserved.length === 0 &&
    /**
     * ⛔ A PERSON HAS READ EVERY PART THIS LEANS ON. Tenet one at one level down: a promise agreed
     * at the top and answered by machinery nobody looked at is validated in name only.
     */
    unvalidated.length === 0 &&
    /** ⛔ A RECORDED YES IS REQUIRED, not merely the absence of a no — see `buildableReads`. */
    reads.length > 0 &&
    stopped.length === 0;

  return {
    ref,
    grain,
    title,
    ready,
    because: verdict({ title, ready, holes, unagreed, latitude, settled, requirements, unbuildable, untested, openElsewhere, read, unserved, unvalidated }),
    counts,
    holes,
    unagreed,
    latitude,
    settled,
    framing,
    requirements,
    read,
    untested,
    unserved,
    unvalidated,
    openElsewhere,
  };
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * The verdict in one sentence — ⛔ AND IT NAMES WHICH OF THE TWO REASONS IT IS.
 *
 * "Not ready" is two different jobs and routes to two different people. A question nobody has
 * answered goes back to whoever was asked; a sentence nobody has agreed to goes to a reviewer to
 * agree with or correct. A verdict that said only "not ready" would send both to the same place, and
 * the second one is thirty sentences nobody has questioned.
 *
 * ⛔ AND IT SAYS WHEN AUTHORSHIP CANNOT BE TOLD. The usability review: *"A claim an agent inferred
 * from a call transcript and a claim a PM typed but has not yet confirmed both read 'not confirmed'.
 * A grooming agent needs to tell them apart, because the first should be raised as a question in the
 * ticket and the second only needs a stamp."* Where nothing records it, the instruction is to do
 * neither blindly — so the count of `unrecorded` claims is said out loud rather than left for a
 * consumer to notice in a field.
 */
function verdict(x: {
  title: string;
  ready: boolean;
  holes: Level[];
  unagreed: Level[];
  latitude: Level[];
  settled: Level[];
  requirements: TestRequirement[];
  unbuildable: TestRequirement[];
  untested: string[];
  openElsewhere: Nearby[];
  read: { latest: ReadThrough | null; stopped: ReadThrough[]; spent: ReadThrough[]; unread: boolean };
  unserved: string[];
  unvalidated: AnsweringPart[];
}): string {
  const tests = `${n(x.requirements.length, "testing requirement")} to implement`;
  const extra = x.openElsewhere.length
    ? ` ${n(x.openElsewhere.length, "open question")} ${was(x.openElsewhere.length, "reaches", "reach")} this work without landing on any of its facts (${x.openElsewhere
        .map((q) => q.ref)
        .join(", ")}) — worth raising, not blocking.`
    : "";
  if (x.ready)
    return (
      `Ready to build: ${x.read.latest!.by} read this end to end on ${x.read.latest!.at} and could build from it; ` +
      `every one of ${n(x.settled.length + x.requirements.length, "fact")} this touches is accepted or derived, and ${tests}.` +
      (x.latitude.length
        ? ` ${n(x.latitude.length, "slot")} ${was(x.latitude.length, "is", "are")} declared the builder's latitude.`
        : "") +
      extra
    );

  const why: string[] = [];
  /**
   * ⛔ FIRST, BECAUSE NOTHING BELOW OUTRANKS IT — the order `compilePacket` already prints these in,
   * for the same reason: a person who got to the end and could not build from it has said something
   * no count can contradict, and burying it under four tallies invites a reader to weigh it against
   * them.
   */
  for (const r of x.read.stopped)
    why.push(
      `${r.by} read ${r.scope} end to end on ${r.at} and could NOT build from it` +
        (r.note ? ` ("${r.note}")` : "") +
        (r.blockedBy.length
          ? ` — stopped by ${r.blockedBy.join(", ")}, counted among the questions below`
          : " — ⛔ and did not say what stopped them, so ask before anybody starts") +
        ". Nothing computed outranks that"
    );
  /**
   * ⛔ AND THE OTHER DIRECTION, WHICH IS THE ONE THAT USED TO READ AS A PASS. An unread scope has
   * no failing state in the four counts — they are all empty on a corpus nobody has opened.
   */
  /**
   * ⛔ ITS OWN SENTENCE, NAMING WHO AND WHAT TO TELL THEM. "Get it read" is the wrong instruction
   * for a scope somebody has already read — what is owed is showing them what moved.
   */
  for (const r of x.read.spent)
    why.push(
      r.of
        ? `${r.by} read ${r.scope} end to end on ${r.at} and could build from it, and the words have moved since — ⛔ not a finding against it: show them what changed rather than asking again from scratch`
        : `${r.by} read ${r.scope} end to end on ${r.at} and could build from it, and nothing recorded which words they read — so it cannot be said to be about these ones`
    );
  if (x.read.unread)
    why.push(
      "nobody has read this end to end from a builder's seat — ⛔ not a finding against it, and not " +
        "a pass either: the second tenet is that this is sufficient to build from WITHOUT " +
        "interpretation, and no traversal tests that. Run `buildability`, then record what they " +
        "found with a read-through"
    );
  if (x.holes.length)
    why.push(
      `${n(x.holes.length, "question")} nobody has answered (${x.holes.map((h) => h.ref).join(", ")}) — ⛔ a builder who fills one has invented product truth`
    );
  /**
   * ⛔ THE CLAIMS AND THE REQUIREMENTS ARE COUNTED SEPARATELY, BECAUSE THEY ARE TWO LISTS AND TWO
   * JOBS. Added together they read as one number that matches neither list a consumer can open, and
   * a requirement nobody has agreed to is settled by agreeing to the claim it demonstrates rather
   * than by anybody reading the requirement.
   */
  const short = [...x.unagreed, ...x.unbuildable];
  if (short.length) {
    const parts = [
      x.unagreed.length ? n(x.unagreed.length, "claim") : "",
      x.unbuildable.length ? n(x.unbuildable.length, "testing requirement") : "",
    ].filter(Boolean);
    const blind = short.filter((u) => u.wrote.is === "unrecorded").length;
    why.push(
      `${parts.join(" and ")} nobody has agreed to` +
        (blind
          ? ` — ⛔ ${blind === short.length ? "every one of them" : `${blind} of them`} with no recorded author, so a person's unconfirmed draft and an agent's inference read the same. Ask who wrote it before deciding which needs a question and which needs a stamp`
          : "")
    );
  }
  /**
   * ⛔ BESIDE `untested`, BECAUSE IT IS THE SAME SENTENCE ON THE OTHER AXIS — one says nothing would
   * show this holding, the other says nothing makes it happen. Both are owed by a role rather than
   * by a person, and a verdict that routed either to the human it is shown to would send them to
   * rewrite truth that is not wrong.
   */
  if (x.unserved.length)
    why.push(
      `${n(x.unserved.length, "promise")} with no part of the system behind ${
        x.unserved.length === 1 ? "it" : "them"
      } (${x.unserved.join(", ")}) — a decomposer owes the parts, or has to conclude that nothing needs building and say why`
    );
  /**
   * ⛔ STALE AND NEVER ARE SAID APART, because they route to different conversations: one is a
   * person who has not seen this part, the other is a person whose agreement the part has outgrown.
   */
  if (x.unvalidated.length) {
    const stale = x.unvalidated.filter((p) => p.stale);
    const never = x.unvalidated.filter((p) => !p.stale);
    if (never.length)
      why.push(
        `${n(never.length, "part")} of the system this leans on ${was(never.length, "has", "have")} nobody's name on ${
          never.length === 1 ? "it" : "them"
        } (${never.map((p) => p.ref).join(", ")}) — ⛔ a promise agreed at the top and answered by machinery nobody has read is validated in name only`
      );
    if (stale.length)
      why.push(
        `${n(stale.length, "part")} this leans on ${was(stale.length, "was", "were")} agreed and ${was(
          stale.length,
          "has",
          "have"
        )} changed since (${stale.map((p) => `${p.ref} — ${p.by}`).join(", ")}) — show them what moved`
      );
  }
  if (x.untested.length)
    why.push(
      `${n(x.untested.length, "claim")} with nothing that would show ${was(x.untested.length, "it", "them")} holding (${x.untested.join(", ")}) — a demonstrator owes the tests, not a person`
    );
  return (
    `Not ready to build: ${why.join("; and ")}. ` +
    `${n(x.settled.length, "fact")} ${was(x.settled.length, "is", "are")} agreed, and ${tests}.${extra}`
  );
}

/** ⛔ The verb agrees with the count, because `0 facts is agreed` reads as a bug in the verdict. */
const was = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The grooming loop, shipped rather than invented by each connecting agent.
 *
 * ⛔ WORK ITEM 10, AND IT IS A FILE BECAUSE IT IS A PROMPT. The usability review: *"Ship a grooming
 * prompt with the MCP server: find, check readiness, raise questions, write the test list into the
 * ticket"*, fixing *"Each agent has to invent the loop"*. Prose belongs in a document a person can
 * read and edit; a string literal in TypeScript is a document nobody reviews.
 */
export function groomingPromptFile(from: string = fileURLToPath(import.meta.url)): string {
  const here = path.dirname(from);
  /** `dist/v2/readiness.js` and `src/v2/readiness.ts` are both two levels under the root. */
  return path.resolve(here, "../../prompts/groom-a-ticket.md");
}

export function groomingPrompt(): string {
  const file = groomingPromptFile();
  if (!fs.existsSync(file))
    throw new Error(`the grooming prompt is missing from this install: expected it at ${file}`);
  return fs.readFileSync(file, "utf-8");
}
