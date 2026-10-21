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
import { actsFor, gridFor } from "./grid.js";
import { descendants, questionsFor, rulingAct, type Question } from "./settle.js";
import { POLICY_SLOTS, SLOT_ASKED, SLOTS, type SlotName } from "./schema.js";

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
  | "screen";

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
      act: `productos_in ${JSON.stringify({
        intent: "ask",
        ref: refs[0],
        question: "<the question, in the words the person reads>",
        asked_of: "<who owes it>",
        blocks: refs.slice(1),
        candidates: "<3-4 drafted answers, each with its consequence>",
      })}`,
    });
    }
  }
  return out;
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
 * ⛔ A CORPUS AND A SCOPE, AND NOTHING ELSE — so every surface can reach it. Peter: *"this should be
 * a first class representation in the UX - and claude should ideally be able to access this via
 * mcp"*, and *"no one will ever use the command line"*. A derivation that needs `checkCorpus`'s
 * findings needs a directory on disk, which the page does not have and a hosted caller does not
 * either. See `blanks` for why the grid is the honest source rather than the convenient one.
 */
export function interviewFor(corpus: Corpus, scopeId: string): Interview | null {
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
          asks: hp
            ? `Is this what ${plain(sc?.title || ungrounded.scope)} is for?`
            : `What is ${plain(sc?.title || ungrounded.scope)} for?`,
          why: ungrounded.why,
          shape:
            "what somebody gets done here, what they arrive with, what they leave with, and the screens they meet in order — ⛔ at the altitude that survives a new form field, never the fields themselves",
          fills: [`${ungrounded.scope}#happy-path`],
          candidates: [],
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
  const drafted: Owed[] = questionsFor(corpus, scopeId)
    .filter((q) => !q.parked)
    .map((q) => ({
      ref: q.ref,
      owes: "drafted" as const,
      asks: plain(q.asks),
      why: q.candidates.length
        ? `${q.candidates.length} answer${q.candidates.length === 1 ? " is" : "s are"} on the table and nobody has picked`
        : "it is asked and nothing is drafted against it",
      shape: q.slot ? SHAPE[q.slot] : "a sentence settling it",
      fills: [q.ref, ...q.blocks],
      candidates: q.candidates,
      cost: q.cost,
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
  const rest = [...blanks(corpus, ids, title, spokenFor), ...undrawn(corpus, ids)];

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
  const owed = [...purpose, ...[...drafted, ...rest].sort((a, b) => b.fills.length - a.fills.length)];
  return {
    scope: scopeId,
    title,
    ...(ungrounded ? { gate: "purpose" as const } : {}),
    owed,
    closes: new Set(owed.flatMap((o) => o.fills)).size,
  };
}
