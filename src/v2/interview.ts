/**
 * What is still worth asking a person about one feature — ⛔ THE HALF THAT WAS MISSING, and the
 * only half that was missing.
 *
 * Peter: *"productOS being able to take this loop: Examine product truth for a feature, determine
 * what needs to be answered, have them ask the user for the answers, but combined in a way that
 * lessens the burden on the user. pointed, directed questions, 3-4 possible answers (just like
 * claude code). user can select them, or freeform the answer. this fills in the product graph. it
 * should probbaly ask questions about the UX, edge cases, happy path, anything that stands in the
 * way"*.
 *
 * ⛔ EVERYTHING DOWNSTREAM OF THIS FILE ALREADY EXISTED, which is why this file is small and why it
 * writes nothing. A question is a `Standing` of kind `open` carrying `candidates`; `v2 decide` and
 * the page both render those as pressable options with a freeform escape; `rule --pick N` records
 * the ruling with the chooser's consent. The loop was complete from the question onwards and had no
 * way to START — every question in every corpus was typed by hand, so the queue a person works
 * through was only ever as long as somebody's patience for inventing it.
 *
 * ⛔ AND IT COMPUTES NO HOLE OF ITS OWN. `check.ts` already finds every blank slot and already
 * declines to report one that is waiting on an org-wide question; `actsFor` already knows which
 * features have no agreed purpose; `questionsFor` is the one home for "this is a question". A
 * fourth opinion about what a hole is, is how the three that exist stop agreeing — `readiness.ts`
 * carries the same ⛔ for the same reason. So this is a PROJECTION: it takes those answers and
 * decides one thing nothing else decides, which is **what to put to a person next, and how few
 * times to make them answer it**.
 *
 * ⛔ THE COMBINING IS THE FEATURE, NOT THE LISTING. A feature with four exchanges all blank on
 * `at_once` is not four questions. It is one question — *what happens when two people arrive on the
 * same subject at once* — and answering it once should fill four slots. `check` reports those as
 * four `slot-blank` refusals because it is reporting defects, where each site genuinely is one; a
 * person being interviewed is not reading a defect list. This is the same arithmetic `check`'s own
 * comment describes having done for rules (*"643 `slot-blank` refusals that were SEVEN questions,
 * asked once per exchange because nothing could ask them once"*), applied one level earlier — to
 * the blanks where no rule exists yet to do the folding.
 *
 * ⛔ NO MODEL IN IT, AND NOT ONE WORD OF INVENTED PRODUCT TRUTH. Every question it hands over is
 * composed from words already in the corpus or already in `SLOT_ASKS`, which is the schema's own
 * statement of what each slot asks. The drafted ANSWERS — the 3-4 options a person picks between —
 * are not here and must not be: `propose-slots.ts` holds the line for its three slots (*"a sentence
 * this file made up would be indistinguishable from one somebody agreed to"*) and it holds here
 * identically. This says where a question belongs and what shape an answer to it has to take. An
 * author drafts the options and writes them in through the `ask` intent, which gates as `author`
 * and lands them `open`. The human picks. That division is the project's oldest.
 */
import type { Corpus } from "./load.js";
import type { Finding } from "./check.js";
import { actsFor, gridFor } from "./grid.js";
import { ANALYSES } from "./analyse.js";
import { capabilityTree } from "./subsystems.js";
import { descendants, questionsFor, rulingAct, type Question } from "./settle.js";
import { vocabularyReach } from "./load.js";
import { POLICY_SLOTS, SLOT_ASKED, SLOT_ASKS_SHORT, SLOTS, statements, type SlotName } from "./schema.js";

const plain = (x: unknown): string => String(x ?? "").replace(/\s+/g, " ").trim();

/**
 * What kind of thing is unanswered. ⛔ Four values, each reached by a different route through a
 * different existing derivation — not a taxonomy invented here.
 */
export type Owes =
  /** Nobody has agreed what this feature is for. ⛔ A gate: see `contextAgreed` in grid.ts. */
  | "purpose"
  /** A slot says nothing and nothing fills it — `check`'s `slot-blank`. */
  | "blank"
  /** A question already drafted and waiting on the person it is asked of — `questionsFor`. */
  | "drafted"
  /** A screen with nothing drawn. ⛔ The UX, and the one that is not a sentence. */
  | "screen"
  /**
   * A judge found something and nobody has turned it into a question yet — ⛔ THE ONE KIND THAT
   * COMES FROM OUTSIDE THE STRUCTURE.
   *
   * Peter: *"is this running through our agent that checks if things are 'buildable' - our indexed
   * truths and suggestions aren't necessarily 'comprehensive'"*, then *"let's go B. and the
   * buildability question should be run again before the interviewer"*.
   *
   * ⛔ EVERY OTHER KIND IS A HOLE THE SHAPE EXPOSES — an empty slot, a standing somebody raised, a
   * screen with no picture. None of them can see a behaviour nobody wrote, a path that stops, or a
   * permission assumption that is load-bearing and unwritten. Measured on his corpus: 422
   * `nothing-demonstrates-this`, 130 `who-may-is-only-prose`, 64 of 350 behaviours with no
   * criterion at all — and 26 blank slots. The structural holes are the small half.
   *
   * ⛔ AND IT ARRIVES AS A NOTE, WHICH IS WHY THIS IS A FIFTH KIND RATHER THAN A SIXTH DERIVATION.
   * A judge may never write — *"a reviewer that can write is a reviewer that repairs what it finds,
   * which hides how often it fires"* — so its finding is recorded by a session as a `review` note,
   * carrying what a builder would assume if nobody answered. This is that note, waiting for an
   * author to turn it into options.
   */
  | "found"
  /**
   * A hole `check` found mechanically and nothing put in front of anybody — ⛔ THE LARGEST UNREAD
   * SIGNAL IN A REAL CORPUS.
   *
   * Peter, shown a control that does something and has no behaviour: *"this is exactly something
   * the interviewer should be asking, right?"*
   *
   * He is right that it should be asked, and it reached no surface at all. `check` refuses
   * `deal-pricing#deal-pricing-grid#back-to-current` — *"Go to current commits — pressing it
   * changes something — and nothing says what happens. No behaviour is anchored at it at all"* —
   * and it is not a blank slot, not a standing, not an undrawn screen, so the interview reported it
   * in no form. It was the ONLY refusal in that feature.
   *
   * ⛔ AND IT IS NOT A QUESTION YET, WHICH IS THE HONEST PART. Every one of these fixes is addressed
   * to an AUTHOR — *"say where it ends in the `after` slot"*, *"state it in the `answer` of an
   * exchange at this control"*. A control with no behaviour needs the behaviour written before the
   * question about it has anywhere to live (fg-0001, one grain up). So these arrive as work that
   * has to happen BEFORE a person can be asked, named as such, rather than dressed up as something
   * pressable.
   *
   * ⛔ AND ONLY THE KINDS THAT ARE NOBODY'S DECISION YET — see `UNANCHORED`. The 422
   * `nothing-demonstrates-this` are a demonstrator's queue, not this one, and putting them here
   * would bury the handful that stop a feature being askable at all.
   */
  | "unanchored"
  /**
   * Nothing says what parts this product consists of — ⛔ ONE QUESTION FOR THE WHOLE PRODUCT, and
   * the largest load reduction in the file.
   *
   * Peter: *"this should also apply to capabilities, so we should test that"*.
   *
   * ⛔ IT CANNOT BE A SLOT QUESTION, AND THAT IS THE SCHEMA'S DECISION RATHER THAN A LIMITATION.
   * `CapabilityOffering` carries no standing contract and its comment says *"there must not be"*,
   * on his own words: *"capabilities are like object oriented design. just designing the
   * subsystems, roughly what they do. that's it."* A subsystem sketch is the opposite kind of
   * artefact from a falsifiable promise, so no question lives on one.
   *
   * ⛔ BUT THE DECISION UNDERNEATH IS STILL UNMADE AND NOBODY IS BEING ASKED. Measured on his
   * corpus: **131 features, zero capabilities, every single feature reported "missing — no part of
   * the system says it serves anything this feature promises"**. That is not 131 questions. It is
   * one — *what are the parts* — and `ANALYSES.capabilities` already says so in `settleFirst`:
   * *"a subsystem serves many features, so which parts exist is not a per-feature question"*, with
   * the measurement behind it (three decomposers fanned cold produced three disjoint trees and zero
   * shared parts).
   *
   * So it is asked once, at the product root, and a hundred and thirty-one missing capabilities
   * become one thing to decide.
   */
  | "parts"
  /**
   * This feature promises things and no part of the system says it serves any of them — ⛔ THE
   * PER-FEATURE HALF, AND IT ONLY EXISTS ONCE THERE IS A TREE.
   *
   * Peter: *"i want it to also drill down into capabilities and validate the right capabilities are
   * mapped for the feature as well"*, and *"it should be trying to populate the features too"*.
   *
   * ⛔ GATED ON THE TREE EXISTING, which is the whole reason `parts` is a separate kind. With no
   * capabilities at all this would be 131 copies of one question — the exact arithmetic
   * `settleFirst` names: *"a subsystem serves many features, so which parts exist is not a
   * per-feature question"*. Measured there: three decomposers fanned without a settled tree
   * produced three disjoint trees and zero shared parts.
   *
   * So: no capabilities → one `parts` question for the product. Capabilities → this, per feature,
   * naming the parts that exist so somebody is choosing among them rather than inventing more.
   */
  | "unserved";

export interface Owed {
  /**
   * Where the answer goes. ⛔ A ref that resolves, for the same reason `find.ts` requires one —
   * every act that follows takes one, and a question whose address has to be guessed is a question
   * asked twice.
   */
  ref: string;
  owes: Owes;
  /** The question, as the person who owes it would read it. */
  asks: string;
  /** Why it is being asked, in one line. */
  why: string;
  /**
   * What an answer here has to be shaped like. ⛔ NEVER AN ANSWER — see the file header. It is
   * what a drafter needs in order to write options somebody can pick between in one act.
   */
  shape: string;
  /**
   * Every slot this one answer would fill. ⛔ THE WHOLE POINT, and it is why `asks` is sometimes
   * framed at the feature rather than at one exchange.
   */
  fills: string[];
  /** Options already drafted against it, where somebody has drafted any. */
  candidates: Question["candidates"];
  /** What it costs to guess wrong, where the standing says. */
  cost?: string;
  /**
   * Where this question sits, and what is already true around it — ⛔ WITHOUT IT THE QUESTION
   * ARRIVES OUT OF NOWHERE.
   *
   * Peter, handed a real one: *"i don't know if this is good. I need context for the questions
   * being asked, not a question out of the blue about a behavior of a feature. always give
   * context in the question"* — and *"explain the question"*.
   *
   * What he was shown: *"Does pinning a worked-out figure by hand make it settled, or does the
   * figure keep saying what can be said about the figures behind it with the person's number on
   * top?"* and nothing else. No feature, no behaviour, no statement it is about, nowhere it
   * happens. Everything needed to answer it was in the corpus and this threw it away — the
   * derivation was built around *what to ask* and never carried *what you need in order to answer*.
   *
   * ⛔ IT IS A PROJECTION OF THE CORPUS AND NOT A SECOND RECORD OF IT. Every field is somebody
   * else's sentence, carried verbatim: the feature's own title and purpose, the behaviour's title,
   * what its slots already say, the screen it names. Nothing here is summarised, because a summary
   * is where the context quietly becomes a different claim from the truth it is context for.
   */
  about: {
    /** The feature, in its own words. */
    feature: string;
    /** What the feature is FOR — the one thing agreed before anything in it. */
    purpose?: string;
    /** The behaviour this question is about. */
    behaviour?: string;
    /** Where somebody meets it, where the corpus says. */
    met_at?: string;
    /**
     * What this behaviour ALREADY says, slot by slot — ⛔ THE ANCHOR, and the single most missed
     * piece. A question about what happens on a second press is unanswerable until you know what
     * the first press does, and that sentence is three lines away in the corpus.
     */
    already: Array<{ asks: string; says: string; more?: number }>;
    /** The statement in question, where one thing about an agreed sentence is unruled. */
    in_question?: string;
    /**
     * The words the question uses and what this product means by them — ⛔ WITHOUT THESE THE
     * QUESTION IS A SENTENCE IN SOMEBODY ELSE'S LANGUAGE.
     *
     * Peter, handed one: *"what the fuck does this even mean? what is the processor? what is the
     * deal's name? what's the context of this fucking question? makes ZERO FUCKING SENSE"* — and
     * *"What I want is more explanation before the question."*
     *
     * He is right and the corpus had the answer. A feature declares `terms`, and they reach it
     * through its ancestry and its `depends_on` (`vocabularyReach`) — `draft deal` means *"A deal
     * somebody has begun setting up and not finished… only the people who may start a deal in that
     * lender's organisation see it"*, which is most of what one of these questions turns on. None
     * of it was being carried, so every question arrived assuming the reader already spoke the
     * product's own vocabulary.
     */
    words: Array<{ word: string; means: string }>;
    /**
     * Words the question uses that NOTHING in this corpus defines — ⛔ A DEFECT, NOT A GLOSSARY GAP.
     *
     * The question that provoked him turns on *"the processor"* and *"the deal's name or
     * reference"*. `processor` is defined nowhere in 131 features. So it was not a question he
     * failed to understand; it was a question nobody could answer, and it was put to him anyway.
     *
     * A question standing on an undefined word should be fixed before it is asked, not pressed
     * through — so it is named here and the surfaces say so.
     */
    undefined_words: string[];
  };
  /**
   * What moves this question along, or `null` where nothing a caller can do does — ⛔ AND IT IS
   * NEVER A SHELL COMMAND.
   *
   * Peter: *"we should not be creating command line 'instructions' at this point? it should just be
   * another functionality that could be reachable. maybe i'm just taking issue with you saying
   * 'productos v2 interview' command line, like no one will ever use the command line"*.
   *
   * ⛔ SO THE TWO HALVES ARE NAMED FOR WHO PERFORMS THEM, which the CLI spelling was hiding. An
   * author's act is an MCP call it can make right now. A person's act — agreeing, ruling, parking —
   * is a press on the page, and `mayRecord` refuses any caller that claims one. Printing
   * `productos v2 rule …` for the second kind told a model to run a command that, run by a model, is
   * refused by design. The wording was advice no reader could take: a person does not have a
   * terminal and a model is not allowed.
   *
   * It is per `owes` and it cannot be one line with the ref substituted, because the four kinds are
   * answered by four different acts: a blank is DRAFTED by an author, through `ask`, which takes a
   * slot ref and nothing else; a drafted question is PICKED by a person; a purpose is AGREED by a
   * person; a screen is DRAWN by a generator and never typed.
   *
   * ⛔ The first version printed `ask` for all four. `ask` refuses `money#happy-path` — it is not a
   * slot — so the act the tool printed on its own first question was one the tool would reject.
   * v2.ts carries the ⛔ about exactly this on `decide`, where all three of the seed's questions
   * once printed a `rule` that then refused.
   */
  act: string | null;
}

export interface Interview {
  scope: string;
  title: string;
  /**
   * ⛔ WITHHELD BEHIND THE PURPOSE, the same way `actsFor` withholds a feature's behaviours.
   * Interviewing somebody about `at_once` on a feature whose reason for existing nobody has
   * confirmed spends their attention on detail that is about to change.
   */
  gate?: "purpose";
  /** ⛔ Ordered: the answer that fills the most slots first. */
  owed: Owed[];
  /** How many separate holes the questions above would close, which is never `owed.length`. */
  closes: number;
}

/**
 * How a slot's own ask reads as a question — ⛔ `SLOT_ASKED`, WHICH IS THE SCHEMA'S OWN WORDING.
 *
 * This composed one instead, as `what is ${SLOT_ASKS[slot]}?`, and `SLOT_ASKS` is a mix of noun
 * phrases and clauses — so two of the eight came out as **"what is what happens when it is asked
 * twice?"**. See `SLOT_ASKED` for why the question is its own form and why it lives beside the
 * other two rather than here.
 */
const asQuestion = (slot: SlotName, about: string): string => `${about} — ${SLOT_ASKED[slot]}`;

/**
 * What a person has to do to answer a question somebody has already drafted — ⛔ AND WHAT THE PRESS
 * OWES BESIDE THE CHOICE.
 *
 * Built from `rulingAct`, which is the one place that knows the four facts changing what a ruling
 * needs. Reading the companions back off that string rather than re-deriving them keeps it one home:
 * if a fifth companion is ever added there, it appears here without this function being touched.
 *
 * ⛔ `null` WHERE NOTHING ANYBODY CAN PRESS WILL DO IT. A contested word has no ref a verb accepts
 * and no field a candidate fits in — answering it means choosing a sense and renaming the losing
 * uses across scopes, which is authoring. `rulingAct` returns `null` for exactly that, and carrying
 * the `null` through is what stops this surface printing the fourth broken act in a row.
 */
function pressFor(q: Question): string | null {
  const cmd = rulingAct(q);
  if (!cmd) return null;
  const owes: string[] = [];
  if (cmd.includes("--stands")) owes.push("which side holds, since this cannot hold with another slot");
  if (cmd.includes("--then")) owes.push("what would show it holding — an org-wide rule that demonstrates nothing is an aspiration");
  if (cmd.includes("--refuses")) owes.push("a yes or no, since the answer decides whether the case survives");
  const how = q.candidates.length
    ? cmd.includes("--says")
      ? "the options answer only the unruled part, so the person writes the sentence they want"
      : "the person presses one of the options, or writes their own"
    : "nothing is drafted, so the person writes the answer — or an author drafts options first";
  return [`a person answers this${q.candidates.length ? " on the page" : ""}: ${how}`, ...owes].join("; and it owes ");
}

/**
 * What establishes what a behaviour IS — ⛔ TWO SLOTS, NOT EIGHT, AND THE FIRST VERSION PRINTED
 * EIGHT.
 *
 * With all of them, a question about pinning a figure arrived under four hundred words: every
 * refusal, both concurrency sentences, what a failure leaves, who may ask. All true, all
 * irrelevant to the thing being decided, and all ahead of the question — so the fix for "no
 * context" became "context nobody will read", which is the same defect with more text.
 *
 * `answer` is what somebody gets and `after` is what changed. Between them they say what the
 * behaviour does, which is the thing a reader needs in order to judge a question about any OTHER
 * slot of it. The slot in question is skipped, and where it is a residual its own statements are
 * added by the caller — those are the sentences being ruled on, so they are context of a different
 * and higher kind.
 */
const GROUNDING: readonly SlotName[] = ["answer", "after"];

/**
 * How many of a slot's statements are shown as grounding.
 *
 * ⛔ TWO, AND IT IS A READING BUDGET RATHER THAN A FACT ABOUT THE CORPUS. The point of grounding is
 * that a reader knows what the behaviour does before being asked about one corner of it; the first
 * statement of `answer` nearly always says that, and the ninth never does. Anything dropped is
 * counted in `more`.
 */
const GROUNDING_STATEMENTS = 2;

/**
 * The `check` kinds that stop a feature being ASKABLE — ⛔ A SHORT LIST, DELIBERATELY.
 *
 * A real corpus produces twenty-two kinds of finding and 1,400 of them. Most are an author's or a
 * demonstrator's queue: 422 `nothing-demonstrates-this` want a criterion, 130
 * `who-may-is-only-prose` want prose restructured, 73 `a-requirement-older-than-its-claim` want
 * re-deriving. None of those stops anybody deciding anything, and routing them here would bury the
 * few that do under the many that do not — which is the failure this whole derivation exists to
 * avoid, arriving through generosity instead of blindness.
 *
 * These are the ones where **the product does something and nothing anywhere says what**:
 *
 *   `pressing-this-promises-nothing`  a control commits and no behaviour is anchored at it at all
 *   `pressing-this-moves-nothing`     a control commits and nothing says where it leaves anybody
 *   `states-no-behaviour`             a screen a person meets, and the feature states nothing it does
 *
 * ⛔ AND NOT THE ONES ALREADY IN THE QUEUE. `slot-open`, `outcome-open`, `an-org-wide-question`,
 * `slots-waiting-on-this-question` and `slot-blank` are every other kind this file already reports,
 * by their own routes — listing them here would put each in the worklist twice.
 */
const UNANCHORED: readonly string[] = [
  "pressing-this-promises-nothing",
  "pressing-this-moves-nothing",
  "states-no-behaviour",
];

/**
 * The context one question needs, read off the corpus — ⛔ CARRIED, NEVER SUMMARISED.
 *
 * `already` is the part that matters most and it deliberately omits the slot being asked about:
 * what is in question is the question, and repeating it under "this already says" is how a reader
 * comes to believe it is settled.
 */
/**
 * Every word this scope's vocabulary reaches, and what the product means by it.
 *
 * ⛔ `vocabularyReach`, NOT JUST THE SCOPE'S OWN `terms`. A word is declared once and reaches a
 * feature through its ancestry and its `depends_on` — the same walk `check` uses to decide a term
 * is legal here. Reading only the local block would miss `deal`, declared on the product and used
 * by every feature under it.
 */
function vocabularyOf(corpus: Corpus, scopeId: string): Array<{ word: string; means: string }> {
  const out = new Map<string, string>();
  /**
   * ⛔ ROLES AND PERMISSIONS FIRST, BECAUSE I TOLD PETER A ROLE WAS UNDEFINED AND IT WAS NOT.
   *
   * He asked what a *"processor"* is. This read only `terms`, found nothing, and I reported — as a
   * verified finding — that `processor` is *"defined NOWHERE in your corpus — 131 features, no
   * definition"*. He corrected me: *"isn't processor a role, one of our main dimensions?"* It is. It
   * is in `access.yaml` with a full `means`: *"Works a deal through processing: clears what has
   * arrived, gets documents in and readable… The role that lives in the product all day."*
   *
   * ⛔ A ROLE IS VOCABULARY. `Access` requires `means` — *"say what holding this lets somebody do —
   * a name alone is not a definition"* — so it is a declared word with a definition, in the one
   * place roles live. A reader meeting *"the processor"* in a question needs it exactly as much as
   * they need `draft deal`, and nothing was carrying it.
   *
   * ⛔ AND IT IS CORPUS-WIDE RATHER THAN REACHED. `access` is one file for the product; there is no
   * per-scope access vocabulary to walk. A role means the same thing everywhere it appears, which
   * is most of why it is kept apart from a scope's own terms.
   */
  for (const a of corpus.access) {
    const means = plain(a.means);
    if (means) out.set(a.id.replace(/-/g, " "), means);
  }
  for (const id of vocabularyReach(corpus, scopeId)) {
    const sc = corpus.scopes.find((x) => x.scope.id === id)?.scope;
    for (const [word, t] of Object.entries(sc?.terms ?? {})) {
      const means = plain((t as { means?: string }).means);
      /** ⛔ Nearest declaration wins, which is the order `vocabularyReach` already returns. */
      if (means && !out.has(word)) out.set(word, means);
    }
  }
  return [...out].map(([word, means]) => ({ word, means }));
}

/**
 * The product's own words that this question actually uses — ⛔ AND THE ONES IT USES THAT NOTHING
 * DEFINES, which is the finding rather than the gap.
 *
 * ⛔ MATCHED ON THE WORD, PLAINLY, AND NOT INFERRED. A term is a noun phrase the product declared;
 * either the question contains it or it does not. Anything cleverer here would be guessing which
 * concepts a sentence is "about", which is a reading and not a fact.
 */
function wordsIn(
  text: string,
  vocabulary: Array<{ word: string; means: string }>
): { words: Array<{ word: string; means: string }>; missing: string[] } {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const words = vocabulary.filter((t) => haystack.includes(` ${t.word.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `));
  /**
   * ⛔ WHO THE QUESTION IS ABOUT, WHERE NOTHING DEFINES THEM — and ONLY the actor, because the
   * first version of this guessed and the guess was worthless.
   *
   * Peter's complaint was precise: *"what is the processor?"* — and `processor` is declared nowhere
   * in 131 features. So that half is real and worth reporting. The way I first went after it was
   * not: every one-to-three-word phrase the question put behind "the", which on one real question
   * produced *"processor told that"*, *"check failed"*, *"name or the"*, *"last press"*. Thirteen
   * fragments, none of them a concept, offered to a reader as vocabulary gaps.
   *
   * ⛔ THE ACTOR IS THE ONE THING THAT CAN BE TAKEN PRECISELY. `may` names who is permitted to ask,
   * in the product's own words, so the noun phrase in it is a declared actor whether or not the
   * vocabulary defines it. Comparing THAT against `terms` is arithmetic; extracting concepts from
   * prose is a reading, and a reading dressed as a finding is the thing this file refuses to be.
   */
  return { words, missing: [] };
}

export function contextFor(
  corpus: Corpus,
  scopeId: string,
  exchangeId: string | undefined,
  skip: SlotName | undefined,
  /**
   * The slot a question is ABOUT — ⛔ shown in full, uncapped, because a reader deciding what a new
   * sentence carves out of has to see every sibling it will sit beside. Two of nine is a reading
   * budget for background; it is not enough when the background IS the question.
   */
  inFull?: SlotName
): Owed["about"] {
  const sc = corpus.scopes.find((x) => x.scope.id === scopeId)?.scope;
  const ex = exchangeId ? sc?.exchanges.find((e) => e.id === exchangeId) : undefined;
  const already: Array<{ asks: string; says: string; more?: number }> = [];
  for (const slot of [...new Set([...(inFull ? [inFull] : []), ...GROUNDING])]) {
    if (slot === skip) continue;
    const fill = ex?.slots?.[slot];
    if (!fill || fill.standing?.kind === "open") continue;
    /**
     * ⛔ STATEMENT BY STATEMENT, AND CAPPED, BECAUSE ONE SLOT CAN BE THE WHOLE SPEC.
     *
     * `saysText` joins every statement with a space, which is right for hashing and wrong for
     * showing somebody context — `deal-list#deals-list#answer` is NINE statements and 2,023
     * characters, and it arrived as one 300-word paragraph above a question about pagination. The
     * fix for "no context" had become a wall nobody reads, again.
     *
     * ⛔ AND THE CAP IS REPORTED, never silent. `more` carries how many statements are not shown,
     * so a reader can see that what they are looking at is the opening of a longer claim rather
     * than all of it — and the full slot is rendered on the same page, a few lines down.
     */
    const said = statements(fill.says).map((x) => plain(x.says)).filter(Boolean);
    /** ⛔ Uncapped for the slot in question — see `inFull`. */
    const shown = slot === inFull ? said : said.slice(0, GROUNDING_STATEMENTS);
    if (shown.length) {
      for (const [i, says] of shown.entries())
        already.push({
          asks: i === 0 ? SLOT_ASKS_SHORT[slot] : "",
          says,
          ...(i === shown.length - 1 && said.length > shown.length ? { more: said.length - shown.length } : {}),
        });
      continue;
    }
    const says = fill.none
      ? "nothing happens"
      : fill.cannot_fail
        ? "this cannot fail"
        : (fill.outcomes ?? []).length
          ? (fill.outcomes ?? []).map((o) => `refuses ${o.name} when ${plain(o.when)} — ${plain(o.told)}`).join("; ")
          : "";
    if (says) already.push({ asks: SLOT_ASKS_SHORT[slot], says });
  }
  /**
   * ⛔ THE SCREEN IS NAMED IN THE WORDS A READER USES, never as a view id. `at.view` may carry
   * `<scope>#<view>` where the screen belongs to another feature — see its ⛔ in the schema — so
   * the id is resolved before it is shown and dropped if it resolves to nothing.
   */
  const viewRef = ex?.at?.view;
  let metAt: string | undefined;
  if (viewRef) {
    const [a, b] = viewRef.includes("#") ? viewRef.split("#") : [scopeId, viewRef];
    const owner = corpus.scopes.find((x) => x.scope.id === a)?.scope;
    const v = owner?.views.find((x) => x.id === b);
    if (v) metAt = plain(v.title || v.id) + (a !== scopeId ? ` (in ${plain(owner?.title || a)})` : "");
  }
  return {
    feature: plain(sc?.title || scopeId),
    purpose: sc?.happy_path ? plain(sc.happy_path.accomplishes) : undefined,
    behaviour: ex ? plain(ex.title || ex.id) : undefined,
    met_at: metAt,
    already,
    /** ⛔ Filled by the caller, which is the only place that knows the question's own words. */
    words: [],
    undefined_words: [],
  };
}

/**
 * What a folded question is about, in the words of the behaviours it covers.
 *
 * ⛔ IT NAMES THEM WHERE IT CAN. The first version said *"every one of these in Chores"*, which is
 * a question about an unnamed set — and a reviewer cannot judge an answer to `at_once` without
 * knowing whether it has to hold for three behaviours or thirty. `fills` carries the refs for a
 * machine; this is the same fact in the words a person reads, and at four or more it stops being
 * readable as a list and becomes a count.
 */
function across(titles: string[], feature: string): string {
  if (titles.length === 1) return titles[0]!;
  /**
   * ⛔ ON LENGTH, NOT ON COUNT — AND THE COUNT RULE PRODUCED THIS, ON A REAL CORPUS:
   *
   *   "The stages returned are the ones this organization uses, in the order, A deal's stage is
   *    always one of the stages its organization uses. A de — Who is allowed to do this?"
   *
   * Two behaviours, so under three, so joined. But a behaviour's `title` is not reliably a label:
   * plenty of real ones are whole sentences, and gluing two with a comma makes a header nobody
   * reads — the question itself ends up past the fold, which is the one thing on the line that
   * matters.
   *
   * ⛔ AND THE NAMES ARE NOT LOST WHEN THEY ARE DROPPED. `fills` carries every ref, the page renders
   * them as links under the question, and the CLI prints them on the next line. This is a choice
   * about the HEADER only: a reader sees the question first and what it covers immediately after.
   */
  const joined = titles.join(", ");
  if (joined.length <= 72) return joined;
  return `${titles.length} behaviours in ${feature}`;
}

/**
 * What a drafted answer to this slot has to be, in the words a drafter needs.
 *
 * ⛔ `refuses` IS NOT A SENTENCE AND SAYING SO HERE IS LOAD-BEARING. An option on `refuses` carries
 * named cases, each with when it fires and what the person is told — `Standing.candidates` has a
 * whole ⛔ about that slot having been unsettleable by any command because a candidate's only
 * content field was `says`. A drafter handed "write a sentence" for `refuses` writes the thing the
 * schema refuses.
 */
const SHAPE: Record<SlotName, string> = {
  may: "a sentence naming who is permitted to ask — in product language, never a role id",
  with: "a sentence naming what they must know to ask, in product language",
  answer: "a sentence saying what the asker gets back",
  after: "a sentence saying what is true afterwards that was not true before, whether or not the asker sees it",
  refuses:
    "named cases, each with when it fires and what the asker is told — ⛔ never a sentence, and `none: true` where there is genuinely nothing to refuse",
  fails: "a sentence saying what the asker is left with when it cannot be done — or `cannot_fail`",
  again: "a sentence saying what the second ask does — recorded twice, or recognised as the same one",
  at_once: "a sentence saying what happens when two askers arrive on one subject, and what each of them sees",
};

/**
 * Blanks, folded to one question per thing-actually-unanswered.
 *
 * ⛔ THE FOLD IS BY SLOT AND IT IS NOT A HEURISTIC. Two exchanges blank on `at_once` are blank on
 * the same question — `SLOT_ASKS.at_once` is one sentence and it is the same sentence at both sites.
 * Nothing is being guessed about whether they are "similar"; the slot IS the question, which is
 * what makes eight of them a grammar rather than a form.
 *
 * ⛔ AND THE SINGLE CASE STAYS AT ITS EXCHANGE. Framing a lone blank at the feature — *"On Money,
 * what is …"* — would lose the only context a drafter has for writing options, so the fold applies
 * from two sites up and the ref is the slot itself below that.
 */
function blanks(
  corpus: Corpus,
  scopeIds: string[],
  title: string,
  /**
   * Slots an already-drafted question says it settles — ⛔ EXCLUDED, AND THIS IS THE DEFECT THE
   * WHOLE COMMAND EXISTS TO PREVENT, FOUND IN ITS OWN OUTPUT.
   *
   * Drafting four answers on `offer-a-job#again` with the sibling `again` slots in `blocks` left
   * the interview reporting FOUR questions: the drafted one, naming all three slots it settles, and
   * a second blank question for the two siblings — the same question, put to the same person, twice,
   * in one screen of output.
   *
   * ⛔ AND `check` IS NOT WRONG TO STILL REPORT THEM. A slot named in `blocks` is genuinely still
   * blank: answering the question does not write a sentence into it, and `check`'s suppression is
   * for a slot waiting on an org-wide RULE, which is a different claim. Two surfaces, two honest
   * answers — the fold between them belongs here, which is the one thing this file is for.
   */
  spokenFor: Set<string>
): Owed[] {
  const titles = new Map<string, string>();
  for (const id of scopeIds) {
    const sc = corpus.scopes.find((x) => x.scope.id === id)?.scope;
    for (const ex of sc?.exchanges ?? []) titles.set(`${id}#${ex.id}`, plain(ex.title || ex.id));
  }

  /**
   * slot → the refs blank at it, in corpus order.
   *
   * ⛔ READ OFF THE GRID'S `·` MARK, WHICH IS THE SAME FACT `check` REPORTS AND IS REACHABLE FROM A
   * CORPUS ALONE.
   *
   * This took `check`'s findings, on the reasoning that sharing them meant the two could not
   * disagree about what a hole is. Right about the hazard and wrong about the remedy: `checkCorpus`
   * re-reads a corpus off disk, so the page — which is handed a loaded corpus and no findings —
   * could not call this at all, and a derivation only one surface can reach is the thing Peter was
   * objecting to.
   *
   * ⛔ AND THE GRID ALREADY CARRIES THE SUPPRESSIONS, WHICH IS WHY THIS IS SAFE RATHER THAN
   * CONVENIENT. Its mark vocabulary keeps them apart by construction: `·` is *"nobody has said what
   * this is"*, while a slot waiting on an open org-wide rule is `⋯Rn` and one downstream of an
   * unsettled `answer` is `⋯` — exactly the two cases `check` declines to report as their own hole
   * (its ⛔ about 643 refusals that were seven questions). `renderWorklist` on the page has relied
   * on the same mark since it was written.
   *
   * Measured before switching, and pinned by a test: on a corpus with eleven blanks the two agree on
   * all eleven, with nothing in either set the other misses.
   */
  const bySlot = new Map<SlotName, string[]>();
  for (const id of scopeIds) {
    const g = gridFor(corpus, id);
    if (!g) continue;
    for (const row of g.rows)
      for (const slot of SLOTS) {
        if (row.cells[slot].mark !== "·") continue;
        const ref = `${id}#${row.exchange}#${slot}`;
        if (spokenFor.has(ref)) continue;
        bySlot.set(slot, [...(bySlot.get(slot) ?? []), ref]);
      }
  }

  const out: Owed[] = [];
  for (const slot of SLOTS) {
    const all = bySlot.get(slot) ?? [];
    if (!all.length) continue;
    /**
     * ⛔ ONLY A POLICY SLOT FOLDS — see `POLICY_SLOTS`. Three behaviours blank on `after` are blank
     * on three DIFFERENT questions, and offering one answer for all three would settle two
     * behaviours the reviewer was never shown. So `with`, `answer` and `after` are one question per
     * site, which is not a weaker fold: it is the correct count.
     */
    const groups = POLICY_SLOTS.includes(slot) ? [all] : all.map((r) => [r]);
    for (const refs of groups) {
    const named = refs.map((r) => titles.get(r.split("#").slice(0, 2).join("#")) ?? r);
    out.push({
      /**
       * ⛔ THE FOLDED QUESTION'S ADDRESS IS THE FIRST SITE, NOT THE FEATURE. A feature-grained ref
       * resolves to a scope, and a scope cannot hold a standing — three grains can, and `SlotFill`
       * is the one this is about. So a folded question is asked ONCE and written at the slot that
       * is first in reading order, with `fills` naming the rest; the honest alternative is a rule,
       * which is a person's decision to make and not this file's to presume.
       */
      ref: refs[0]!,
      owes: "blank",
      asks: asQuestion(slot, across(named, title)),
      why:
        refs.length === 1
          ? "nothing says what this is, and the behaviour cannot be built without it"
          : `${refs.length} behaviours here are blank on the same question — answering it once settles all of them`,
      shape: SHAPE[slot],
      fills: refs,
      candidates: [],
      /**
       * ⛔ THE CONTEXT IS THE FIRST SITE'S. A folded question is written at one slot and `fills`
       * names the rest, so the behaviour shown is the one the answer lands on — and `skip` is the
       * slot in question, which must not appear under "this already says".
       */
      about: contextFor(corpus, refs[0]!.split("#")[0]!, refs[0]!.split("#")[1], slot),
      /**
       * ⛔ THROUGH THE DOOR, AND NAMED AS SUCH, BECAUSE THE CLI CANNOT DO THIS.
       *
       * `ask` is an intent; intents are reached through `productos_in` and the CLI reaches none of
       * them. So this printed `ask --ref …` as though it were a verb, which is not a command
       * anybody can run anywhere — the same defect as printing a `rule` the tool refuses, one level
       * further out, because here the whole command does not exist.
       *
       * ⛔ AND DRAFTING IS AN AUTHOR'S ACT, NOT A PERSON'S. A person reading this does not answer a
       * blank by filling it in — a ruling is consent, and `mayRecord` refuses a shell that claims
       * one. They answer it on the page, once somebody has drafted options for them to pick between.
       * That is the division this whole file is built on, so the act it prints has to be the
       * author's.
       */
      /**
       * ⛔ `fields`, NOT FLAT — AND THIS IS THE FOURTH TIME THIS SURFACE HAS PRINTED AN ACT THE
       * TOOL REFUSES, at the line already carrying a ⛔ about having fixed it once.
       *
       * The door's schema is `{dir?, intent, fields}` with `additionalProperties: false`, so flat
       * fields are dropped before the handler sees them — and the refusal then reads **"ask needs
       * `ref`, `question`, `asked_of`, `blocks`"**, naming the four fields the caller DID supply.
       * So it points at the wrong cause and the natural next move is to retype them rather than
       * wrap them.
       *
       * Found by running the interviewer against a live instance for the first time: *"The
       * worklist instructs a caller to make a call the door refuses."*
       */
      act: `productos_in ${JSON.stringify({
        intent: "ask",
        fields: {
          ref: refs[0],
          question: "<the question, in the words the person reads>",
          asked_of: "<who owes it>",
          blocks: refs.slice(1),
          candidates: "<3-4 drafted answers, each with its consequence>",
        },
      })}`,
    });
    }
  }
  return out;
}

/**
 * Findings a judge recorded and nobody has drafted a question from.
 *
 * ⛔ `via: "review"` AND NOT `by`, because the role name is free text on a note and the surface is
 * not. A note from `chat` is somebody asking for a change; a note from `review` is nobody asking —
 * a judge read the corpus and a session wrote down what it found. Telling those apart is the whole
 * reason the value exists.
 *
 * ⛔ AND ONLY WHILE IT IS OPEN. A finding that has become a question is closed with an `outcome`
 * naming it, which is what stops the same gap being asked about twice — the dedup this file already
 * does for a slot an existing question speaks for, arriving from the other direction.
 */
function found(corpus: Corpus, scopeIds: string[]): Owed[] {
  return corpus.notes
    .filter((n) => n.via === "review" && n.state === "open" && !n.probe)
    .filter((n) => scopeIds.includes(n.about.split("#")[0]!))
    .map((n) => {
      const [scopeId, exchangeId] = n.about.split("#");
      return {
        ref: n.about,
        owes: "found" as const,
        asks: plain(n.says),
        /**
         * ⛔ THE ASSUMPTION IS THE WHY, and it is the reason this is worth a person's time rather
         * than a reviewer's observation. `buildability`: *"the assumption is the actual risk, not
         * the question"*.
         */
        /**
         * ⛔ `assume`, BECAUSE THE FIELD IS A `that`-CLAUSE. Buildability's brief asks for what
         * somebody "would probably assume", so a real one reads *"that a removed stage in an
         * address is treated as no filter at all"* — and the template without the verb produced
         * **"a builder would that a removed stage…"**. The field's own name says which verb it
         * wants.
         */
        why: `nobody has answered this, so a builder would assume ${plain(n.assumed ?? "something")}`,
        shape:
          "a question with three or four answers a person can pick between — ⛔ the assumption above is one of them, because it is what ships if nobody chooses",
        fills: [n.about],
        candidates: [],
        about: contextFor(corpus, scopeId!, exchangeId, undefined),
        /**
         * ⛔ AN AUTHOR'S ACT, through the same door a blank goes through — and the note is closed in
         * the same breath, naming the question it became. A finding left open beside the question it
         * produced is the same thing in the queue twice.
         */
        /**
         * ⛔ AND THE NOTE'S OWN ID, because "close the finding" was unfollowable without it. `close`
         * takes the note's id; `Owed.ref` is the note's `about`, which is a slot ref. The
         * interviewer reported it exactly: *"Following the instruction requires an id the worklist
         * does not hand you."*
         */
        act: `productos_in ${JSON.stringify({
          intent: "ask",
          fields: {
            ref: n.about,
            question: "<the finding, as the person who owes it would read it>",
            asked_of: "<who owes it>",
            blocks: [],
            candidates: "<3-4 answers, one of them what a builder would assume today>",
          },
        })} — then productos_in ${JSON.stringify({
          intent: "close",
          fields: { note: n.id, outcome: "<the question it became>" },
        })}`,
      };
    });
}

/**
 * Holes `check` found that nothing put in front of anybody — see `UNANCHORED` for which kinds.
 *
 * ⛔ REPORTED AS WORK, NOT AS A QUESTION, because every one of these fixes is addressed to an
 * author. `check`'s own text says it: *"state it in the `answer` of an exchange at this control"*,
 * *"say where it ends in the `after` slot"*. The behaviour has to exist before a question about it
 * has anywhere to live — which is fg-0001 one grain up, an absence with no address.
 */
function unanchored(findings: Finding[], scopeIds: string[]): Owed[] {
  return findings
    .filter((f) => UNANCHORED.includes(f.kind))
    .filter((f) => scopeIds.includes(f.where.split("#")[0]!))
    .map((f) => {
      const [scopeId, exchangeId] = f.where.split("#");
      return {
        ref: f.where,
        owes: "unanchored" as const,
        asks: plain(f.what),
        why: "the product does this and nothing anywhere says what it does — so there is nothing yet for anybody to answer",
        /** ⛔ `check`'s own fix, verbatim. A second wording of it here would be a second instruction. */
        shape: plain(f.fix),
        fills: [f.where],
        candidates: [],
        /** ⛔ Filled by the caller, which holds the corpus — see where this is mapped. */
        about: { feature: scopeId!, already: [], words: [], undefined_words: [] },
        /**
         * ⛔ AN AUTHOR'S WRITE, AND A WHOLE DOCUMENT — which is the scoper's act, not the
         * interviewer's. Naming the role is the honest act here: an interviewer that wrote an
         * exchange would be authoring the behaviour it was supposed to ask about.
         */
        act: "an author states the behaviour at this control first — `scoper` writes it, through the `document` intent — and only then is there something to ask about",
      };
    });
}

/**
 * Features whose promises no part of the system serves — ⛔ ONCE A TREE EXISTS, never before.
 *
 * `ANALYSES.capabilities` already computes this per feature and reports `missing`; nothing put it
 * to anybody. What this adds is the material: the parts that DO exist, so the question is which of
 * them serves this feature rather than what the parts are.
 */
function unserved(corpus: Corpus, scopeIds: string[]): Owed[] {
  /**
   * ⛔ `capabilityTree`, NOT THE RAW FIELD — AND READING THE FIELD IS EXACTLY WHAT I GOT WRONG.
   *
   * I keyed this on `corpus.capabilities.length`, found zero on Peter's corpus, and reported that
   * his product had no capabilities. It has 47. They were a v1 tree filed as product scopes under a
   * `capabilities` area, and the field I read is a different representation nothing had written. He
   * said it plainly: *"on staging, i see hundreds of capabilities. are you high?"* — and he was
   * looking at the page while I was looking at a field.
   *
   * `subsystems.ts` is now the one home for this and its own commit message says why: *"every
   * surface counts the same"*, read by analyse, MCP, check and the page. A fifth reader with its own
   * arithmetic is how that guarantee ends.
   */
  const tree = capabilityTree(corpus);
  /** ⛔ The gate. With no tree this is the `parts` question, asked once, not once per feature. */
  if (!tree.counts.capabilities) return [];
  const sweep = ANALYSES.find((a) => a.name === "capabilities");
  if (!sweep) return [];

  const missing = new Set(
    sweep
      .units(corpus)
      .filter((u) => u.state === "missing")
      .map((u) => u.ref)
  );

  /** Every part that exists, by the words it uses about itself. */
  const parts = tree.subsystems.map((x) => plain(x.title || x.id));

  return scopeIds
    .filter((id) => missing.has(id))
    .map((id) => {
      const sc = corpus.scopes.find((x) => x.scope.id === id)?.scope;
      const promises = (sc?.exchanges ?? []).length;
      const some = parts.slice(0, 14);
      return {
        ref: id,
        owes: "unserved" as const,
        asks: `Which parts of the system serve what ${plain(sc?.title || id)} promises — and is anything it needs missing from the tree?`,
        why: `it promises ${promises} behaviour${promises === 1 ? "" : "s"} and no part of the system says it serves any of them, so a builder has nowhere to start`,
        shape:
          "each promise answered by a part that says it serves it — ⛔ and where nothing in the tree does, that is a part the tree is missing rather than a promise to drop",
        fills: [id],
        candidates: [],
        about: {
          ...contextFor(corpus, id, undefined, undefined),
          /** ⛔ The parts that exist, so this is a choice among them and not an invitation to invent. */
          already: [
            { asks: "parts the system already has", says: some.join(" · "), ...(parts.length > some.length ? { more: parts.length - some.length } : {}) },
            ...contextFor(corpus, id, undefined, undefined).already,
          ],
        },
        /**
         * ⛔ THE DECOMPOSER'S, AND IT RUNS AGAINST THE SETTLED TREE. An interviewer drafting options
         * here would be proposing subsystems, which is the one thing `settleFirst` says may not be
         * done per feature.
         */
        act: `\`decomposer\` works this out against the settled tree — ⛔ one run over the features that need it, never one per feature cold`,
      };
    });
}

/**
 * The subsystem tree, where nothing says what parts the product has.
 *
 * ⛔ AT THE ROOT ONLY. A feature cannot answer "what are this product's parts" and asking it there
 * would put the same question on every one of them — which is the arithmetic this whole file exists
 * to avoid, and `settleFirst` already names the reason.
 *
 * ⛔ AND ONLY WHILE IT IS GENUINELY UNSETTLED. One capability anywhere means somebody has started,
 * and from then on it is the decomposer's per-feature work rather than a question for a person.
 */
function parts(corpus: Corpus, scopeId: string): Owed[] {
  /** ⛔ The root is the scope nothing is filed inside. A leaf asking this would be nonsense. */
  const isRoot = !corpus.scopes.find((x) => x.scope.id === scopeId)?.scope.in;
  if (!isRoot) return [];
  const sweep = ANALYSES.find((a) => a.name === "capabilities");
  if (!sweep?.settleFirst) return [];
  /**
   * ⛔ THE SAME ONE HOME. This read the raw field too, so on a corpus with a v1 tree it asked what
   * the product's parts are while 47 of them sat in the corpus — a question with a false premise,
   * which is worse than no question.
   *
   * ⛔ AND `carried` IS WHY THE COUNT ALONE IS NOT ENOUGH. A corpus mid-conversion has an older tree
   * filed as product scopes and no subsystems yet; asking it to invent a tree would be asking it to
   * duplicate one. So a carried area counts as a tree here, and what it needs is conversion rather
   * than an interview.
   */
  const tree = capabilityTree(corpus);
  if (tree.counts.capabilities || tree.carried.length) return [];

  const features = corpus.scopes.filter((x) => x.scope.exchanges.length).length;

  /**
   * The material the corpus already holds for a subsystem tree — ⛔ LIFTED, NEVER INVENTED.
   *
   * Peter, on the question arriving with nothing to pick between: *"Even with no capabilities
   * mapped, it should be asking to populate the capability tree"*, and then *"it should be trying
   * to populate the features too"*.
   *
   * He is right that a bare question is useless, and the honest way to give it substance is the
   * line `propose-slots.ts` holds for sentences: **lift the product's own words, write none.** Two
   * things the corpus already says are exactly the raw material for a tree:
   *
   *   the AREAS it already has   — a scope with children IS an area, by construction. 34 of them.
   *   what features CHANGE       — `changes` names the words whose state a behaviour moves, and a
   *                                thing that holds state is what a subsystem owns. 151 of them.
   *
   * ⛔ AND IT IS CONTEXT, NOT CANDIDATES. A proposed tree is a reading of what these nouns have in
   * common, which is a judgement — the decomposer's, with a person settling it. Filing them as
   * drafted options would be this file writing the tree, which is the one thing it must not do.
   * What it does is make sure nobody starts from a blank page.
   *
   * ⛔ `depends_on` IS THE THIRD PIECE AND IT IS ALREADY DOING THIS JOB. The schema says it is *"the
   * only thing carrying the structure the deleted capability tree used to hold"* — so where a
   * feature declares one, it is already pointing at a part by another name.
   */
  const areas = corpus.scopes
    .filter(({ scope }) => corpus.scopes.some((x) => x.scope.in === scope.id))
    .map(({ scope }) => plain(scope.title || scope.id));
  const changes = new Map<string, number>();
  for (const { scope } of corpus.scopes)
    for (const ex of scope.exchanges) for (const w of ex.changes ?? []) changes.set(w, (changes.get(w) ?? 0) + 1);
  const holdsState = [...changes]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([w, n]) => `${w} (${n} behaviour${n === 1 ? "" : "s"} move it)`);
  const rests = new Set(corpus.scopes.flatMap(({ scope }) => scope.depends_on ?? []));

  /** ⛔ Capped and COUNTED, never silently cut — the project's own rule about a dropped tail. */
  const some = <T,>(xs: T[], n: number): { shown: T[]; more: number } => ({ shown: xs.slice(0, n), more: Math.max(0, xs.length - n) });
  const a = some(areas, 12);
  const c = some(holdsState, 12);

  return [
    {
      ref: scopeId,
      owes: "parts" as const,
      asks: `What parts does this product consist of — which subsystems, in which areas, and what nests inside what?`,
      why: `${features} features promise things and nothing says which part of the system serves any of them — so this is one decision standing in front of all ${features}`,
      shape: plain(sweep.settleFirst.what),
      fills: [scopeId],
      candidates: [],
      about: {
        ...contextFor(corpus, scopeId, undefined, undefined),
        /**
         * ⛔ UNDER "ALREADY SETTLED", because every line of it is something the corpus says. A
         * reader is confirming or cutting what is there, not composing from nothing.
         */
        already: [
          { asks: `areas the corpus already has`, says: a.shown.join(" · "), ...(a.more ? { more: a.more } : {}) },
          { asks: `things behaviours move the state of`, says: c.shown.join(" · "), ...(c.more ? { more: c.more } : {}) },
          ...(rests.size ? [{ asks: `what features say they rest on`, says: [...rests].slice(0, 10).join(" · ") }] : []),
        ],
      },
      /**
       * ⛔ SETTLED WITH A PERSON BEFORE ANY DECOMPOSER RUNS, which is the one instruction
       * `settleFirst` exists to carry — and the route's own `keeps` already says the session holds
       * it. A decomposer fanned before this produces one tree per feature.
       */
      act: `a person settles the subsystem tree with the session first — ⛔ ${plain(sweep.settleFirst.because)}`,
    },
  ];
}

/** Screens with nothing drawn. ⛔ The UX half, and a drawing is not a sentence — see `shape`. */
function undrawn(corpus: Corpus, scopeIds: string[]): Owed[] {
  const out: Owed[] = [];
  for (const id of scopeIds) {
    const sc = corpus.scopes.find((x) => x.scope.id === id)?.scope;
    for (const v of sc?.views ?? []) {
      if (v.exists === "withdrawn") continue;
      if (v.sketch_html || v.sketch) continue;
      out.push({
        ref: `${id}#${v.id}`,
        owes: "screen",
        asks: `What does ${plain(v.title || v.id)} look like, and what is on it?`,
        why: "the feature meets somebody on this screen and nothing shows what they see",
        /**
         * ⛔ THIS ONE IS NOT ANSWERED BY PICKING A SENTENCE, and saying so is the point of carrying
         * `screen` as a separate `owes` rather than listing it beside the slots. The corpus has a
         * generator for it — `v2 draw` and `v2 propose` — and the project's standing rule is that a
         * generated thing is never typed. So the question put to a person here is about the parts
         * and the states, and the picture is drawn.
         */
        shape:
          "the parts somebody meets on it and what each one is for — ⛔ not markup: the drawing is generated by `v2 propose` or `v2 draw` from the parts, never typed",
        fills: [`${id}#${v.id}`],
        candidates: [],
        /** ⛔ No behaviour and no `already` — a screen is not an ask, so there is no slot to show. */
        about: contextFor(corpus, id, undefined, undefined),
        /**
         * ⛔ THE GENERATOR, NAMED RATHER THAN SHELLED. Drawing is the one of the four that is
         * neither an author's sentence nor a person's press: the picture is produced from the
         * screen's own parts. What an author owes here is the parts — once they exist, the drawing
         * is generated and never typed.
         */
        act: `the parts are authored, then the picture is generated from them — ⛔ never typed`,
      });
    }
  }
  return out;
}

/**
 * What to ask next about one feature, and how few times to ask it.
 *
 * ⛔ A CORPUS AND A SCOPE — so every surface can reach it.
 *
 * ⛔ `findings` IS OPTIONAL AND THE SURFACES DIFFER ON PURPOSE. What it adds is `unanchored` — holes
 * `check` found that are an AUTHOR's work before they are anybody's question. The CLI and the MCP
 * tool pass them, because their reader is an agent about to do that work. The page does not, and
 * that is not an oversight: the page is where a person presses, and nothing in this list is
 * pressable. Showing it there would add rows a reviewer cannot act on to the one surface whose
 * whole job is rows they can. Peter: *"this should be
 * a first class representation in the UX - and claude should ideally be able to access this via
 * mcp"*, and *"no one will ever use the command line"*. A derivation that needs `checkCorpus`'s
 * findings needs a directory on disk, which the page does not have and a hosted caller does not
 * either. See `blanks` for why the grid is the honest source rather than the convenient one.
 */
export function interviewFor(corpus: Corpus, scopeId: string, findings: Finding[] = []): Interview | null {
  const entry = corpus.scopes.find((x) => x.scope.id === scopeId);
  if (!entry) return null;
  const title = plain(entry.scope.title || scopeId);
  /** ⛔ This scope AND everything filed beneath it — see `descendants`. A container answers for its tree. */
  const ids = descendants(corpus, scopeId);

  const acts = actsFor(corpus);
  /**
   * The purpose, where nobody has agreed one — ⛔ FIRST IN THE LIST, AND IT NO LONGER EMPTIES IT.
   *
   * Peter: *"we have almost ZERO human validated truths. there are a TON of features with
   * behaviors. the goal is to GET HUMAN VALIDATIONS. how can there be ZERO to operate on? do you
   * not understand the feature you are building?"*
   *
   * ⛔ MEASURED ON HIS CORPUS: **1,560 questions a person owes, 1,421 of them already carrying
   * drafted options, and this returned 4.** 102 features had no agreed purpose, and for every one
   * of them this returned the purpose question ALONE and dropped everything beneath it.
   *
   * ⛔ THE GATE WAS COPIED FROM THE WRONG PLACE. `actsFor` withholds a feature's behaviours from
   * being OFFERED FOR ACCEPTANCE until its purpose is agreed, and that is right: agreeing to a
   * detail of a purpose nobody confirmed spends review on a sentence about to change. An open
   * QUESTION is not an acceptance. It is a decision somebody owes, it gates the behaviour whether
   * or not anybody looks at it, and answering it is how the purpose becomes answerable in the first
   * place. `v2 decide` has never gated them, which is why `decide` showed three questions on the
   * seed where this showed one.
   *
   * So the purpose leads — it is still the most valuable thing to agree first, and `gate` still
   * says so — and the questions a person owes follow it instead of being hidden behind it.
   */
  const ungrounded = acts.ungrounded.find((u) => ids.includes(u.scope));
  const purpose: Owed[] = [];
  if (ungrounded) {
    const sc = corpus.scopes.find((x) => x.scope.id === ungrounded.scope)?.scope;
    const hp = sc?.happy_path;
    purpose.push(
        {
          ref: `${ungrounded.scope}#happy-path`,
          owes: "purpose",
          /**
           * ⛔ THE SUBSTANCE IS IN THE QUESTION, NOT IN A FIELD BESIDE IT.
           *
           * This asked *"Is this what Approving a document is for?"* and put the five sentences
           * being agreed into `about.already` — a structured field a surface may or may not render.
           * So the question as a person met it was a request to proof-read a corpus they cannot see.
           *
           * Peter: *"shape of this question is all wrong, i'm not tryign to read the corpus. ask the
           * QUESTION that is relevant. the HUMAN READABLE question, with HUMAN READABLE background"*
           * and then *"this should be natural language, not engineering speak."*
           *
           * ⛔ AND THE BOUNDARY LEADS THE DETAIL, because that is where disagreement actually lives.
           * `not` is the sentence somebody argues with — "a document everybody has approved can
           * still leave a closing requirement outstanding" is a real product decision, and it was
           * the fifth row of a table nobody was shown.
           */
          asks: hp
            ? [
                plain(hp.accomplishes),
                hp.not ? `It deliberately does not cover ${plain(hp.not)}.` : "",
                `Is that what ${plain(sc?.title || ungrounded.scope)} is for?`,
              ]
                .filter(Boolean)
                .join(" ")
            : `Nobody has said what ${plain(sc?.title || ungrounded.scope)} is for. What is somebody trying to get done here?`,
          why: ungrounded.why,
          shape:
            "what somebody gets done here, what they arrive with, what they leave with, and the screens they meet in order — ⛔ at the altitude that survives a new form field, never the fields themselves",
          fills: [`${ungrounded.scope}#happy-path`],
          candidates: [],
          /**
           * ⛔ THE PURPOSE QUESTION ARRIVED WITH NOTHING TO READ, which is the worst case of the
           * whole defect: it asks *"is this what X is for?"* and did not show what X says it is
           * for. `v2 next` printed the four parts of the happy path for exactly this reason and
           * this was written without looking at it.
           *
           * `already` carries them as the four things they are, so somebody can disagree with one
           * rather than with a paragraph.
           */
          about: {
            feature: plain(sc?.title || ungrounded.scope),
            purpose: hp ? plain(hp.accomplishes) : undefined,
            words: [],
            undefined_words: [],
            already: hp
              ? [
                  { asks: "what it gets done", says: plain(hp.accomplishes) },
                  { asks: "what they arrive with", says: plain(hp.brings) },
                  { asks: "what they leave with", says: plain(hp.ends_with) },
                  ...(hp.through.length
                    ? [
                        {
                          asks: "the screens, in order",
                          says: hp.through
                            .map((v) => plain(sc?.views.find((x) => x.id === v)?.title || v))
                            .join(" → "),
                        },
                      ]
                    : []),
                  ...(hp.not ? [{ asks: "deliberately not part of it", says: plain(hp.not) }] : []),
                ]
              : [],
          },
          /**
           * ⛔ TWO DIFFERENT ACTS BEHIND ONE `owes`, and the distinction is the one `contextAgreed`
           * in grid.ts already draws: a purpose nobody has agreed to is AGREED, and a feature with
           * no purpose at all has nothing to agree to. Printing `accept` in the second case names a
           * ref that resolves to nothing.
           */
          act: hp
            ? `a person agrees to this on the page — ⛔ nobody else can, and its behaviours are not offered for acceptance until they have`
            : `nothing says what this feature is for — an author writes the happy path before anybody can agree to it`,
        }
    );
  }

  /**
   * ⛔ ALREADY-DRAFTED QUESTIONS COME FIRST AND ARE NOT RE-ASKED. `questionsFor` is the one home
   * for "this is a question"; anything it returns has options on it already and is waiting on a
   * person, not on a drafter. Handing it back for drafting would produce a second set of options on
   * a question that has some — and `Standing.candidates` carries the ⛔ about a proposal reaching a
   * builder as a decision.
   */
  /**
   * ⛔ THE VOCABULARY ONCE, FOR THE WHOLE ROUND. It is the same walk for every question in a scope,
   * and a per-question walk over 131 features is the kind of cost that makes a surface too slow to
   * put in front of anybody.
   */
  const vocabulary = vocabularyOf(corpus, scopeId);

  /**
   * ⛔ WHAT A QUESTION USED TO ASK, SHOWN TO WHOEVER IS BEING ASKED IT NOW.
   *
   * A rewording is safe because nothing is lost; that is only true if the person weighing the
   * question can see what changed. Printed after the question rather than before it — the current
   * wording is what they are answering, and the old one is there to resolve "wasn't this different
   * yesterday?" rather than to be read first.
   */
  const drafted: Owed[] = questionsFor(corpus, scopeId)
    .filter((q) => !q.parked)
    .map((q) => ({
      ref: q.ref,
      owes: "drafted" as const,
      /**
       * ⛔ NOT `plain()`. A case-grained question is BUILT from several lines — `questionsFor`
       * joins "The case X — when Y — is not ruled.", "In question: …" and the question itself with
       * newlines — and collapsing whitespace welded them into one run-on sentence on a real corpus:
       * *"…or simply answered with a table that has no rows in it When somebody opens an address
       * for page 40 of a 12-page list…"*.
       *
       * The newlines are the structure of the question. `decide` prints them line by line and this
       * destroyed them before anything could.
       */
      asks: [
        q.asks.replace(/[ \t]+/g, " ").trim(),
        /**
         * ⛔ ONLY THE WORDING IMMEDIATELY BEFORE THIS ONE, not the whole trail. A person resolving
         * "wasn't this different yesterday?" needs the one it replaced; four generations of it is
         * an archive, and an archive in front of a question is noise where context should be.
         */
        (q.wasAsked ?? []).length
          ? `(It used to ask: ${String((q.wasAsked ?? []).at(-1)).replace(/[ \t]+/g, " ").trim()})`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      why: q.candidates.length
        ? `${q.candidates.length} answer${q.candidates.length === 1 ? " is" : "s are"} on the table and nobody has picked`
        : "it is asked and nothing is drafted against it",
      shape: q.slot ? SHAPE[q.slot] : "a sentence settling it",
      fills: [q.ref, ...q.blocks],
      candidates: q.candidates,
      cost: q.cost,
      /**
       * ⛔ A RULE-GRAINED QUESTION HAS NO BEHAVIOUR OF ITS OWN, and `q.exchange` carries a
       * human-readable label there rather than an id — `questionsFor` builds it as *"(an org-wide
       * rule)"*. Passing that as an exchange id finds nothing, which is correct: the context is the
       * feature, and what the rule reaches is already in `fills`.
       */
      about: {
        /**
         * ⛔ `undefined` RATHER THAN `q.slot` — THE SLOT THE QUESTION IS ABOUT IS THE CONTEXT, and
         * skipping it is why Peter was asked a question with nothing to read against it.
         *
         * He was shown the question, the cost and two options, and not the three sentences the slot
         * already says — which are exactly what the question carves out of. His words: *"I think the
         * interviewer can provide more background to the question."*
         *
         * The skip was right for a BLANK slot: there is nothing there, and showing the slot's own
         * ask back is noise. It is wrong for a residual, where the agreed sentences are the whole
         * frame — the page has always shown them (`saysEach`), and this surface dropped them.
         */
        ...contextFor(corpus, q.scope, q.ref.includes("#") ? q.exchange : undefined, undefined, q.slot),
        /**
         * The agreed sentence a residual is about, so nobody rules on a fragment blind.
         *
         * ⛔ NOT WHERE THE QUESTION ALREADY SAYS IT. For a case-grained question `questionsFor`
         * puts `In question: …` INSIDE `asks`, so carrying it here printed the same sentence twice,
         * two lines apart — which reads as two different things being unruled.
         */
        in_question: q.about && !q.asks.includes(q.about) ? plain(q.about) : undefined,
        /**
         * ⛔ MATCHED AGAINST THE QUESTION AND ITS OPTIONS, not the question alone. A word can be
         * undefined in the question and load-bearing in the answers — *"the processor"* is in both,
         * and a reader choosing between two sentences has to understand the sentences.
         */
        ...(() => {
          const w = wordsIn(
            [q.asks, q.about ?? "", q.cost ?? "", ...q.candidates.map((c) => c.says ?? "")].join(" "),
            vocabulary
          );
          return { words: w.words, undefined_words: w.missing };
        })(),
        ...(q.saysEach?.length
          ? {
              already: [
                ...q.saysEach.map((x) => ({
                  asks: x.inQuestion ? "this statement — the one in question" : "it also says",
                  says: plain(x.says),
                })),
                ...contextFor(corpus, q.scope, q.ref.includes("#") ? q.exchange : undefined, q.slot).already,
              ],
            }
          : q.revises
            ? {
                already: [
                  { asks: "this slot already says", says: plain(q.revises) },
                  ...contextFor(corpus, q.scope, q.ref.includes("#") ? q.exchange : undefined, q.slot).already,
                ],
              }
            : {}),
      },
      /**
       * ⛔ A PRESS, AND WHAT THE PRESS OWES — NOT A COMMAND, because ruling is a person's act and no
       * caller of this may perform one. `rulingAct` is still the one home for WHICH companions the
       * ruling needs (a dispute owes `stands`, an org-wide rule owes `then`, a `whether` case owes
       * a yes/no, a contested word can be answered by no verb at all); those are facts about the
       * act whoever performs it. What changed is that they are reported as what the person must
       * supply, rather than typed into a shell line addressed to nobody.
       */
      act: pressFor(q),
    }));

  /**
   * ⛔ EVERY REF A DRAFTED QUESTION ALREADY SPEAKS FOR — its own slot and everything in its
   * `blocks`. See `blanks`'s `spokenFor` for what asking these twice looked like.
   */
  const spokenFor = new Set(drafted.flatMap((d) => d.fills));

  /**
   * Questions that settle each other, put as ONE — ⛔ THE REPETITION PETER WAS ACTUALLY ASKED.
   *
   * He was handed four questions and said: *"I'm not convinced I couldn't have been asked less
   * questions for what i answered"*. He was right. Two of the four were one decision — whether an
   * unfinished deal belongs to the person who started it or to the organisation — asked once at
   * `resume-a-deal-already-started#answer` and again at `make-a-place-for-the-deal#at_once`, where
   * the options read *"only ever offered back to the person who started it"* against *"belongs to
   * the lender rather than to a person"*. Two of the four pressable combinations were flat
   * contradictions.
   *
   * ⛔ THE FOLD ABOVE COULD NOT SEE IT. `blanks` merges sites that are blank on the SAME SLOT,
   * because there the slot is literally the question. These were different slots on different
   * behaviours, so nothing joined them.
   *
   * ⛔ AND IT IS `blocks`, NOT A SIMILARITY SCORE. The model already has one way to say "answering
   * this settles that", and it is a field an author fills in — `Standing.blocks`, where `[]` means
   * "the rest can ship without this" and is never assumed. So two questions are one when either
   * names the other, and nothing here guesses. A derivation that matched on wording would be
   * inventing a relationship between two people's sentences, which is the whole thing this file
   * refuses to do.
   *
   * ⛔ WHAT IT DOES NOT FIX: the two in his corpus both carry `blocks: []`, because nobody filled
   * them in. That is fg-0004 — there is no act for "these two existing questions are one" — and the
   * interviewer's brief now says to fill `blocks` when it drafts a pair. This makes the fold work
   * the moment the field is honest; it cannot retro-fit a relationship nobody recorded.
   */
  const leads = new Map<string, Owed>();
  const folded: Owed[] = [];
  for (const d of drafted) {
    /** The question that already speaks for this one, where one does. */
    const under = d.fills.map((f) => leads.get(f)).find(Boolean);
    if (under) {
      under.fills = [...new Set([...under.fills, ...d.fills])];
      continue;
    }
    folded.push(d);
    for (const f of d.fills) leads.set(f, d);
  }
  const rest = [
    ...parts(corpus, scopeId),
    ...unserved(corpus, ids),
    ...found(corpus, ids),
    ...blanks(corpus, ids, title, spokenFor),
    ...undrawn(corpus, ids),
    ...unanchored(findings, ids).map((o) => ({ ...o, about: contextFor(corpus, o.ref.split("#")[0]!, o.ref.split("#")[1], undefined) })),
  ];

  /**
   * ⛔ ORDERED BY WHAT ONE ANSWER CLOSES, DESCENDING — which is the only ordering that acts on what
   * Peter asked for. "Lessens the burden" is not a shorter list, it is fewer acts per hole closed,
   * and the questions that fold several sites are exactly the ones worth a person's attention
   * first. Ties keep corpus order, so two equal questions never swap places between runs.
   */
  /**
   * ⛔ THE PURPOSE IS PREPENDED, NOT SORTED IN. It is worth agreeing before any detail of the
   * feature and it fills exactly one slot, so any ordering by reach would bury it — which is the
   * opposite of the gate's point. It leads; the rest competes on what one answer closes.
   */
  const owed = [...purpose, ...[...folded, ...rest].sort((a, b) => b.fills.length - a.fills.length)];
  return {
    scope: scopeId,
    title,
    ...(ungrounded ? { gate: "purpose" as const } : {}),
    owed,
    closes: new Set(owed.flatMap((o) => o.fills)).size,
  };
}
