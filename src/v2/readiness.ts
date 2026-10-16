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
import { countLevels, levelOf, levelsIn, type Level, type LevelName, type Route, type Wrote } from "./level.js";
import { gridFor } from "./grid.js";
import { descendants, questionsFor, type Question } from "./settle.js";
import { demonstrationOf, type RequirementState } from "./demonstrate.js";
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
export const BUILDABLE: ReadonlyArray<LevelName> = ["accepted", "derived"];

/**
 * The routes that mean somebody owes an answer.
 *
 * ⛔ IT IS THE ROUTE AND NOT THE LEVEL, AND THAT IS NOT A SHORTCUT — IT IS THE MODEL. An open slot
 * with answers drafted against it reads `suggested` on purpose (`level.ts`: *"`open` IS RESERVED FOR
 * A QUESTION SOMEBODY OWES"*, and a draft is something written). So a hole list built from
 * `level === "open"` would have dropped the seed's two best questions — the ones that arrive with
 * options and the cost of guessing wrong — and reported them beside thirty sentences nobody has
 * questioned.
 *
 * ⛔ `latitude` IS NOT HERE. `out_of_scope` is `open` with `route: "latitude"` — nothing to build
 * from AND nobody owes an answer, which is a declaration a builder relies on rather than a question
 * to put to a person. The packet says the same thing in words: **"This is your latitude."**
 */
export const A_QUESTION: ReadonlyArray<Route> = ["unruled", "drafted"];

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

/**
 * Blank slots, taken from the grid rather than counted again.
 *
 * ⛔ THE GRID IS ASKED BECAUSE THE EXCLUSIONS ARE THE HARD PART, AND THERE ARE ALREADY THREE COPIES
 * OF THEM. A slot with no fill is not automatically a hole: a `refuses` answered by a rule's shared
 * named cases is answered, a slot downstream of an unruled `answer` is *"not a hole; not yours to
 * fill"*, and a slot waiting on an open org-wide rule is a hole whose home is the RULE — reporting
 * it per slot is what turned seven questions into 643 refusals. `check`, `compilePacket` and
 * `gridFor` each carry those three, each with a ⛔ saying they must agree; a fourth copy here is how
 * three agreeing implementations become four disagreeing ones.
 *
 * So the mark is read, and `·` is the one that means nobody has thought about it — *"a hole, not a
 * silence"*, in the grid's own words.
 */
const NOTHING_SAYS_THIS = "·";

function blankSlots(corpus: Corpus, scope: string, exchange?: string): string[] {
  const g = gridFor(corpus, scope);
  if (!g) return [];
  const out: string[] = [];
  for (const row of g.rows) {
    if (exchange && row.exchange !== exchange) continue;
    for (const slot of SLOTS as readonly SlotName[])
      if (row.cells[slot]?.mark === NOTHING_SAYS_THIS) out.push(`${scope}#${row.exchange}#${slot}`);
  }
  return out;
}

/**
 * Where one of the queue's questions stands relative to this work.
 *
 *   `on it`        it is about a fact of this work — a hole, and nothing here is buildable
 *   `around it`    it reaches this work and lands on none of its facts — raise it, do not gate on it
 *   `nowhere near` it is about some other behaviour, and this verdict is not the place for it
 *
 * ⛔ THE THIRD ONE MATTERS AS MUCH AS THE OTHER TWO. `questionsFor` is asked of a SCOPE, so asking
 * about one behaviour returns its siblings' questions too. Reporting those as reaching the work would
 * tell a grooming agent that `record-earning` is held up by a question about `record-spending` — a
 * sentence it does not use, a slot it does not have, and an invitation to go and ask a person about
 * neither.
 *
 * ⛔ AND FOR A RULE, `awaiting` DECIDES RATHER THAN THE SELECTOR. `openRuleQuestions` returns a rule
 * for every scope it selects — right for a queue, because ruling it is work somebody owes — but an
 * open rule supplies no sentence, so where the exchange already states the slot the local sentence is
 * the answer and the rule is holding nothing open. `resolveRules` records `awaiting` only where the
 * exchange says nothing itself, which is exactly the distinction, already drawn once.
 */
type Where = "on it" | "around it" | "nowhere near";

function whereQuestionStands(corpus: Corpus, q: Question, scopes: string[], exchange?: string): Where {
  const seg = q.ref.split("#");
  /** A slot, one of its statements, or a named refusal case — a fact somebody can point at. */
  if (seg.length >= 3) {
    if (!scopes.includes(seg[0]!)) return "nowhere near";
    return !exchange || seg[1] === exchange ? "on it" : "nowhere near";
  }
  /** A contested word, `<scope>#<word>` — scope-wide, and it blanks no slot. */
  if (seg.length === 2) return scopes.includes(seg[0]!) ? "around it" : "nowhere near";
  const { awaiting } = resolveRules(corpus);
  for (const [ref, rules] of awaiting) {
    if (!rules.some((r) => r.id === q.ref)) continue;
    const at = ref.split("#");
    if (!scopes.includes(at[0]!)) continue;
    if (!exchange || at[1] === exchange) return "on it";
  }
  return "around it";
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

  const holeRefs = new Set<string>([...owed.map((q) => q.ref), ...blanks]);

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
  for (const s of scopes) {
    const entry = corpus.scopes.find((x) => x.scope.id === s);
    for (const ex of entry?.scope.exchanges ?? []) {
      if (exchange && ex.id !== exchange) continue;
      for (const req of demonstrationOf(corpus, s, ex.id)?.requirements ?? []) {
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

  const unbuildable = requirements.filter((r) => !BUILDABLE.includes(r.level));
  const counts = countLevels([...holes, ...unagreed, ...latitude, ...settled, ...requirements]);
  const ready = holes.length === 0 && unagreed.length === 0 && unbuildable.length === 0;

  return {
    ref,
    grain,
    title,
    ready,
    because: verdict({ title, ready, holes, unagreed, latitude, settled, requirements, unbuildable, openElsewhere }),
    counts,
    holes,
    unagreed,
    latitude,
    settled,
    framing,
    requirements,
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
  openElsewhere: Nearby[];
}): string {
  const tests = `${n(x.requirements.length, "testing requirement")} to implement`;
  const extra = x.openElsewhere.length
    ? ` ${n(x.openElsewhere.length, "open question")} ${was(x.openElsewhere.length, "reaches", "reach")} this work without landing on any of its facts (${x.openElsewhere
        .map((q) => q.ref)
        .join(", ")}) — worth raising, not blocking.`
    : "";
  if (x.ready)
    return (
      `Ready to build: every one of ${n(x.settled.length + x.requirements.length, "fact")} this touches is accepted or derived, and ${tests}.` +
      (x.latitude.length
        ? ` ${n(x.latitude.length, "slot")} ${was(x.latitude.length, "is", "are")} declared the builder's latitude.`
        : "") +
      extra
    );

  const why: string[] = [];
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
