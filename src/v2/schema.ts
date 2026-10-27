/**
 * The Exchange schema — product truth, take two.
 *
 * Nine concepts, from `planning/SCHEMA_RECOMMENDATION.md`: Scope · View · Exchange · Slot ·
 * Criterion · Rule · Standing · Reading · Verdict. Built as a parallel track: v1 keeps
 * working, because the point of building this is to compare them.
 *
 * ⛔ WHAT EACH CONCEPT REFUSES IS THE DESIGN. A concept that refuses nothing is not a
 * concept, and the refusals are why this is not a smaller v1. Read them as specification,
 * not as commentary — several are enforced here in the schema and the rest in `check.ts`,
 * and where a refusal lives only in a comment that is a known hole rather than a decision.
 *
 * The two tenets it exists to serve:
 *   1. a human has validated the truth — cheaply, and never in bulk
 *   2. the truth is sufficient to build from, and its incompleteness is countable
 */
import { z } from "zod";

/**
 * ⛔ EVERY OBJECT IN THIS FILE IS ``. A field the schema does not know must be a
 * REFUSAL, never a silent deletion.
 *
 * Zod objects are non-strict by default, and `load.ts` calls bare `.parse`. So four
 * true sentences about a real product — a retention period on a scope, a trigger on a
 * system exchange, a budget on a rule, a shared refusal vocabulary on a rule — were each
 * written by a reviewer, parsed clean, reported nothing, and disappeared. That is the
 * purest form of quiet wrongness available here: the author is told everything is fine and
 * the sentence is gone.
 *
 * It also means every misspelt field name surfaces. And it converts "the framework has no
 * way to say this" from a disappearance into a refusal you can read — which is the only
 * form in which that finding ever reaches us.
 */


// ---------------------------------------------------------------------------
// Slots — the typed parts of an exchange, and the only place a sentence lives.

/**
 * ⛔ EIGHT, ALL REQUIRED, AND THE COUNT IS THE POINT. A real v1 corpus came out 111 claims
 * about screens against 58 about the machinery underneath, and the iteration log names the
 * cause as the framework's: a feature had a route, a component and a screen to walk, and a
 * capability had none of those. A required skeleton identical on both sides is the only fix
 * that works at the type level rather than by nagging — you cannot be thin here without a
 * blank cell showing it.
 */
/**
 * ⛔ `after` WAS THE EIGHTH, AND ITS ABSENCE LET A PRODUCT'S WHOLE REASON FOR EXISTING BE
 * DELETED WITH ZERO FINDINGS.
 *
 * `answer` asks *what the asker gets*. Nothing asked what the ask LEFT BEHIND, so the state
 * change lived as a clause inside `answer` prose. Proof, on the pristine seed: editing
 * `money#record-earning#answer` from *"The amount is added to what the kid has, the act appears
 * at the top of their history dated today, and the parent is returned to the kid's money"* to
 * drop the first clause produced a `check` output **byte-identical** to the original. The money
 * moving — the entire point of a pocket-money product — vanished from the product truth and
 * every surface said the corpus was fine. `changes: [money, balance]` went on claiming the
 * exchange changed money while no sentence anywhere said it did.
 *
 * It had to be a slot rather than a richer `changes:` because the fact has every property a slot
 * has and a list entry cannot carry: it can be **undecided** (*does completing a task move the
 * money now, or when the parent approves?*), so it needs a `standing`; it needs **criteria** to
 * demonstrate it; it needs to be **waivable**; it can be **supplied by an org-wide rule**; and it
 * needs to be countable as a blank, which is the mechanism the whole model rests on.
 *
 * Eight, not seven, and the identical-skeleton argument below is unchanged by the number — what
 * matters is that you cannot be thin without a blank cell showing it.
 */
export const SLOTS = ["may", "with", "answer", "after", "refuses", "fails", "again", "at_once"] as const;
export type SlotName = (typeof SLOTS)[number];

/**
 * The one grammar every reference is checked against.
 *
 * ⛔ BUILT FROM `SLOTS`, BECAUSE A HAND-WRITTEN CHARACTER CLASS MADE A REQUIRED SLOT
 * UNANSWERABLE IN EVERY CORPUS THAT WILL EVER EXIST.
 *
 * The pattern was `[a-z0-9][a-z0-9-]*` repeated per segment. `at_once` contains an underscore.
 * So `v2 rule tasks#complete-a-task#at_once` — the exact ref `v2 decide` had just printed —
 * was refused, and `v2 defer` on the same ref printed `✓ parked`, wrote the verdict, and left
 * the corpus unjudgeable: `deferrals.yaml will-not-parse` → `cannot-judge-this-corpus`.
 *
 * A first-party command reporting success while bricking the corpus is the worst shape a
 * defect can take here, and it came from typing out a vocabulary that already existed as a
 * constant. `test/v2-refs.test.mjs` asserts every slot is addressable so this cannot recur.
 */
const SEGMENT = "[a-z0-9][a-z0-9_-]*";
/** ⛔ One vocabulary of non-answers, shared by every field that can hold a sentence. */
export const PLACEHOLDER_TEXT = /^(tbd|to ?be ?decided|not ?yet ?decided|unclear|unknown|n\/?a|todo|\?+|-+)$/i;

export const REF_PATTERN = new RegExp(`^${SEGMENT}(#${SEGMENT}){0,3}$`);
/**
 * ⛔ `<case>` IS A REFUSAL OR A STATEMENT, NEVER A TEST CASE, AND THE WORD HAS MISLED ONCE.
 *
 * It reads like a test case, so the first attempt at addressing a testing requirement spelled it
 * `<scope>#<exchange>#<slot>#<case>` — which `resolveRef` answers by finding a named refusal, then
 * a statement, and never a criterion. One address, three meanings, resolved by whichever branch
 * matched first. A requirement has its own grain for that reason.
 */
export const REF_MESSAGE =
  "a reference is a rule id, <scope>#<exchange>[#<slot>[#<case>]] where <case> is a named refusal or one statement, or <scope>#<exchange>#shows#<id> for one testing requirement — nothing else addresses anything";


// ---------------------------------------------------------------------------
// Who typed a sentence — which is never who agreed to it.

/**
 * ⛔ WHICH HAND TYPED THIS — AND IT IS NOT, AND CANNOT BECOME, A SECOND WAY TO LOOK ACCEPTED.
 *
 * *"A claim an agent inferred from a call transcript and a claim a PM typed but has not yet
 * confirmed both read 'not confirmed'. A grooming agent needs to tell them apart, because the first
 * should be raised as a question in the ticket and the second only needs a stamp."* And "not
 * confirmed" is also what a sentence nobody has ever looked at says — three situations wearing one
 * label, and nothing in the model could separate them, because nothing recorded who wrote the
 * words.
 *
 * ⛔ AUTHORSHIP IS NOT CONSENT, AND THE TWO MUST NOT SHARE A FIELD. `Verdict.via` records how a
 * person's AGREEMENT was obtained and `mayRecord` refuses a token that claims a human one. That is
 * a different question from this one in both directions: a person can TYPE a sentence without
 * agreeing to it (every draft), and software can type one nobody has ever read. Overloading `via`
 * would answer the second question with the first question's guarantee, and the guarantee is the
 * only thing tenet 1 has.
 *
 * ⛔ SO IT IS BUILT TO BE WORTHLESS TO FORGE. Three properties, each load-bearing:
 *
 *  1. **It is below the line at every value.** `person` means a human put these words here and
 *     NOBODY HAS CONFIRMED THEM; the strongest sentence it can produce is "this only needs a
 *     stamp". No gate reads it — not `stampFor`, not `confidenceOf`, not `check` — so there is no
 *     act it can unlock and nothing it can make current. `test/v2-authorship.test.mjs` asserts that
 *     as a property rather than trusting it as a habit.
 *  2. **Where a command writes it, the hand is derived from the `via` `mayRecord` already
 *     guards** — never from a string a caller supplies. So the hosted boundary that stops a token
 *     claiming a person agreed is the same boundary that stops it claiming a person typed. One
 *     gate, not a second one to keep in step.
 *  3. **The stronger claim costs more.** `person` suppresses the question a grooming agent would
 *     otherwise raise, so it has to name `as` whom — a named lie about a particular human, which
 *     is the same honour system `Verdict.by` runs on and the same price. `agent` has to say what it
 *     was worked out `from`, because a question raised in a ticket with no source is unanswerable.
 *
 * ⛔ AND ABSENCE IS THE ONLY WAY TO SAY UNKNOWN. Not a third enum value: every corpus that exists
 * today is in that state, a migrated one most of all, so absence has to mean unknown whatever else
 * is written — and a second spelling of one fact is the thing this repo most reliably pays for.
 * It also makes landing this free: nothing backfills, so no byte of any corpus moves and no stamp
 * goes stale on the day it arrives. See the note on `SlotFill.wrote` about the hash.
 */
/** ⛔ Two, and there is deliberately no third — see `Written`: unknown is an absence, not a value. */
export const HANDS = ["person", "agent"] as const;
export type Hand = (typeof HANDS)[number];

export const Authorship = z
  .object({
    /** ⛔ A KIND, never a name. "A person wrote this" is not "a person agreed to this". */
    hand: z.enum(HANDS),
    /**
     * Whose hand: a person's handle, or the role that worked it out.
     *
     * ⛔ REQUIRED, AND THAT IS THE PRICE ON `person`. Unnamed authorship is the cheapest sentence
     * in the schema and would be the obvious way around the question an `agent` claim raises.
     */
    as: z.string().min(1),
    /**
     * What it was worked out from — the transcript, the component, the ticket.
     *
     * ⛔ REQUIRED ON `agent`, because the whole value of knowing software wrote it is being able to
     * raise it as an answerable question. "An agent inferred this" with no source is a worry, not
     * a question. Optional on `person`, where the words are their own — though a person who picked
     * a drafted option says so here.
     */
    from: z.string().min(10).optional(),
  })
  .strict()
  .superRefine((w, ctx) => {
    if (w.hand === "agent" && !w.from)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message:
          "say what this was worked out from — a claim software wrote is one somebody has to be asked about, and a question with no source is one nobody can answer",
      });
  });
export type Authorship = z.infer<typeof Authorship>;

/**
 * ⛔ THREE ANSWERS, NOT TWO, AND THE THIRD IS FIRST-CLASS.
 *
 * `unrecorded` is not a failure to read the field; it is what the corpus actually says. It will be
 * the commonest answer on every corpus that exists, a migrated one most of all, and a reader that
 * collapses it into `person` has re-created the conflation this whole field was added to end — an
 * agent's inference reading as a PM's draft, which is the exact case the MVP needs prevented.
 */
export type Written = Hand | "unrecorded";

/**
 * Who wrote the narrowest grain that records it.
 *
 * ⛔ ONE PRECEDENCE RULE, IN ONE PLACE, FOR THE SAME REASON `refineStanding` EXISTS. A standing
 * lives on a slot and on a named case, and every protection written for the first was simply
 * absent on the second until one function owned the contract. Authorship lives at four grains —
 * a statement, a named refusal, a slot and a rule — and the question "who wrote THIS sentence" has
 * exactly one answer at each, so the resolution belongs here rather than in whatever reads it.
 *
 * Narrowest first: a slot of thirteen statements written by one hand that gains a fourteenth from
 * another must not report one hand for all fourteen. That is precisely the claim a grooming agent
 * is hunting for, and burying it under the slot's answer is how it would be lost.
 */
export function authorshipOf(...grains: Array<{ wrote?: Authorship } | undefined | null>): Authorship | null {
  for (const g of grains) if (g?.wrote) return g.wrote;
  return null;
}

/** The same question, answered in the three values a reader acts on differently. */
export function handOf(...grains: Array<{ wrote?: Authorship } | undefined | null>): Written {
  return authorshipOf(...grains)?.hand ?? "unrecorded";
}

/**
 * The same question about a criterion — ⛔ ANSWERED FROM `derived`, WITHOUT A SECOND FIELD.
 *
 * A criterion already records who worked it out and against which words. Adding `wrote:` beside
 * `derived:` would be two records of one fact, which is the first rule of this repo, and they would
 * disagree the first time one was written and the other was not.
 *
 * ⛔ AND ABSENCE IS `unrecorded`, NOT `person`. `Criterion.derived`'s own note says absent means
 * somebody typed it — that is an inference drawn to explain the old shape, and it is the inference
 * this field exists to stop anybody making. An LLM's YAML is byte-identical to a product person's,
 * and every migrated corpus is full of criteria nobody attributed. What the corpus knows is that
 * nothing derived this; who typed it is not in there.
 */
export function criterionHand(c: { derived?: { by: string } | undefined }): Written {
  return c.derived ? "agent" : "unrecorded";
}

/**
 * One statement of what a slot says, with an identity.
 *
 * ⛔ THE ID IS THE POINT, AND THROWING IT AWAY MADE REVIEW IMPOSSIBLE.
 *
 * Statements started as bare strings. On a real corpus one slot ended up holding THIRTEEN of them —
 * every rule about a lender's Fannie Mae program settings — and nothing smaller than the whole list
 * could be pointed at. So a reviewer got thirteen claims and thirty-one criteria under one
 * "That is right", with no way to say twelve are and one is not.
 *
 * v1 had this right: every claim carried an id and its own tests. The migration merged them into one
 * string and lost it. An id makes a statement addressable — `<scope>#<exchange>#<slot>#<id>` — so it
 * can be agreed to on its own, reworded on its own, and carry its own criteria.
 *
 * ⛔ Ids are what a stamp and a criterion point at, so they are stable: renaming one is a new
 * statement and the old stamp stops covering anything.
 */
/**
 * What `none: true` MEANS on the slot it is written on.
 *
 * ⛔ THREE DIFFERENT FACTS, ONE FIELD, AND EVERY SURFACE PRINTED THE FIRST. `refuses` says there is
 * nothing to refuse; `after` says nothing is different afterwards; `again` says nothing further
 * happens on a second press. The `ANSWERS` table below has carried all three in its `means` text —
 * and four call sites across `packet.ts` and `page.ts` each hardcoded "nothing to refuse", so the
 * slot whose entire job is to say *whether the world changed* printed a sentence about refusals,
 * to a builder.
 *
 * Reported as fg-0015 by an author reading its own packet back. ⛔ Here rather than in each
 * surface, because four copies of one string is how they drifted from the schema together.
 */
export function nothingHere(slot: string): string {
  if (slot === "after") return "nothing is different afterwards";
  if (slot === "again") return "nothing further happens on a second press";
  return "nothing to refuse";
}

export const Statement = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a statement id is one segment, kebab-case"),
    says: z.string().min(10, "a statement nobody can read is not worth agreeing to"),
    /**
     * Which combination of the product's dimensions this holds for. Absent means every one.
     *
     * ⛔ Peter: *"the dimensions should affect the truths as well"*. A product that genuinely differs
     * by role differs in what it PROMISES, not only in which walkthrough you are shown — so the
     * field belongs on the sentence, which is the thing somebody agrees to.
     *
     * ⛔ UNSAID MEANS EVERYWHERE, NEVER NOWHERE. A statement with no `holds_for` holds under every
     * combination, so every corpus written before dimensions existed says exactly what it said
     * before. See `holdsUnder` in `dimensions.ts` — one predicate, read by the renderer, the checker
     * and the selector alike, because the last time two callers each owned a copy of a selection
     * rule they disagreed within the hour.
     */
    holds_for: z.record(z.string().min(1)).optional(),
    /**
     * ⛔ THE NARROWEST GRAIN, AND THE ONE THAT MAKES THE FIELD WORTH HAVING.
     *
     * A slot has held thirteen statements. If authorship were recorded only on the slot, adding a
     * fourteenth that software inferred from a transcript would either be filed under the hand
     * that wrote the other thirteen or force a lie about all of them — and the fourteenth is the
     * only one a grooming agent needs to find. A statement is already addressable
     * (`<scope>#<exchange>#<slot>#<id>`), stampable and criterion-able at this grain; who wrote it
     * has to be answerable at the same one.
     *
     * Absent falls through to the slot — see `authorshipOf`.
     */
    wrote: Authorship.optional(),
  })
  .strict();
export type Statement = z.infer<typeof Statement>;

/**
 * A slot's statements, always as a list.
 *
 * ⛔ ONE NORMALISER. `says` may be a sentence or several, and sixty-three places read it — every one
 * of them inventing its own handling is how a field ends up meaning two things. Anything doing text
 * work on it uses `saysText`; anything showing it to a person uses this.
 */
export type Says = string | Statement[] | undefined;

export function statements(says: Says): Statement[] {
  // ⛔ A bare sentence is one statement whose id is the slot itself — callers never special-case it.
  return Array.isArray(says) ? says : says ? [{ id: "it", says }] : [];
}

/** The same statements as one string, for hashing, matching and prose. */
export function saysText(says: Says): string {
  return statements(says)
    .map((x) => x.says)
    .join(" ");
}

export const SLOT_ASKS: Record<SlotName, string> = {
  may: "who is permitted to ask",
  with: "what must be known to ask, in product language",
  answer: "what the asker gets",
  after: "what is true afterwards that was not true before, whether or not the asker sees it",
  refuses: "the named outcomes it can refuse with, each with when and what the asker is told",
  fails: "what the asker is left with when it cannot do the thing",
  again: "what happens when it is asked twice",
  at_once: "what happens when two askers arrive on one subject",
};

/**
 * The same asks, short enough for a label.
 *
 * ⛔ HERE, BESIDE `SLOT_ASKS`, BECAUSE TWO HAND-MAINTAINED TABLES OF WHAT THE SLOTS ASK DISAGREED.
 *
 * A reviewer flagged it: the schema said `answer` asks "what the asker gets" and the CLI's own copy
 * said "what it does". Two answers to the same question, in one tool, and no way for a reader to
 * tell which was meant. A third copy was about to be added to the page for the same reason — a
 * label needs something short — so both now come from one place, and the long and short forms sit
 * where a change to either is visible against the other.
 */
export const SLOT_ASKS_SHORT: Record<SlotName, string> = {
  may: "who may ask",
  with: "what they bring",
  answer: "what they get",
  after: "what is different afterwards",
  refuses: "what it refuses",
  fails: "what a failure leaves them with",
  again: "asked twice",
  at_once: "two at once",
};

/**
 * The same asks, as a question somebody is actually put in front of.
 *
 * ⛔ A THIRD FORM, AND IT BELONGS HERE FOR THE REASON THE COMMENT ABOVE GIVES. `SLOT_ASKS` and
 * `SLOT_ASKS_SHORT` sit together so *"a change to either is visible against the other"*; this is
 * the same fact in the third shape a surface needs, so it sits in the same place. A table of
 * question wordings anywhere else is the drift that comment is about.
 *
 * ⛔ AND IT IS NOT DERIVABLE FROM EITHER OF THE OTHER TWO, which is why composing one was wrong.
 * `SLOT_ASKS` completes *"this slot says ___"*, and its entries are a mix of noun phrases (*"who is
 * permitted to ask"*) and clauses (*"what happens when it is asked twice"*). The first attempt at
 * the interview built questions as `what is ${SLOT_ASKS[slot]}?` and produced **"what is what
 * happens when it is asked twice?"** on two of the eight — a template that reads fine on the slot
 * you tested and is broken on the others, which is this project's most-repeated defect wearing a
 * grammar.
 *
 * ⛔ POINTED AND IN THE SECOND PERSON. Peter: *"pointed, directed questions"*. These are what a
 * person reads on a page or in a terminal, so they ask about the product and never about the model
 * — no slot name, no `asker`, no ref.
 */
export const SLOT_ASKED: Record<SlotName, string> = {
  may: "Who is allowed to do this?",
  with: "What does somebody have to know before they can do it?",
  answer: "What do they get back?",
  after: "What is different afterwards, whether or not they see it?",
  refuses: "What can this refuse, when does it refuse, and what is the person told?",
  fails: "What is somebody left with when this cannot be done?",
  again: "What happens when this is done twice?",
  at_once: "What happens when two people do this at the same time?",
};

// ---------------------------------------------------------------------------
// Standing — the disposition of a slot. One enum; each value demands its companions.

/**
 * ⛔ FIVE, NOT SIX. `underdetermined` WAS `open` WITH STRICTLY WEAKER COMPANIONS.
 *
 * It required `readings: string[]` — bare sentences with one `cost` lumped across all of
 * them — where `open` takes `candidates`, each with its own `consequence`. The proof that
 * the shape was wrong came from a refusal that was itself correct: `--pick N` settles an
 * `open` slot, and on an `underdetermined` one it had to be refused and `--says` demanded,
 * because a "reading" is an argument about which interpretation is right and not a
 * behaviour anybody can implement.
 *
 * Folding it in removes that whole class of mistake **by construction**: a candidate's
 * `says` is the behaviour and its `consequence` is the argument, so an author cannot write
 * the argument where the behaviour goes. `about` carries the only distinction the two
 * standings were ever separated for — that a sentence already exists and one thing about it
 * is in question — and `cost` reads on any kind.
 */
/**
 * ⛔ FOUR, NOT FIVE. `proposed` WAS `open` WITH EXACTLY ONE CANDIDATE.
 *
 * It required `proposal` + `because` + `ruling_owed_by`; `open` takes `candidates` (each a
 * `says` and a `consequence`) + `asked_of`. A proposal IS a candidate — `settle` already
 * converted it to one to make `--pick` work, and `decide` already printed "One answer has been
 * proposed. Take it, or replace it" for a single-candidate `open`.
 *
 * Two standings for one state meant two code paths on every surface, and the earlier fold of
 * `underdetermined` had already shown what that costs: each duplicate path was a place for the
 * two to drift, and one of them did — a `proposed` slot's candidate reached `--pick` and an
 * `underdetermined` slot's readings did not.
 */
export const StandingKind = z.enum(["stated", "open", "disputed", "out_of_scope"]);
export type StandingKind = z.infer<typeof StandingKind>;

/**
 * ⛔ THE STAGES A FEATURE PASSES THROUGH — AND THEY ARE DERIVED, NEVER STORED.
 *
 * Peter: *"what are our main stages? we should have 'specification', 'ready for review', 'ready for
 * build' - ready for review is when the builders get involved.. design and product have signed off,
 * more or less"*.
 *
 * ⛔ NO FIELD HOLDS THIS, DELIBERATELY. Every one of these stages is already a fact about the
 * stamps: whether anything is still unanswered, whether anybody agreed, whether a builder read it
 * through and said it was buildable. A `stage:` field beside those would be a second record of one
 * fact — and the stored one wins, because it is the one a page prints, until it is wrong and
 * nothing detects it. `GLOSSARY.md` has the general form of this; it is sharpest here, because a
 * stage is exactly the kind of thing somebody sets by hand to make a board look right.
 *
 * ⛔ AND IT CANNOT BE SET AHEAD OF THE WORK. A stored stage lets a feature be marked ready for
 * build while questions are open — which is the failure the two tenets exist to prevent, wearing a
 * status field. Derived, "ready for build" is unreachable until a human actually agreed and a
 * builder actually read it. The stage is a REPORT on consent, not a substitute for it.
 *
 *   specification      product and design are still writing it — something is unanswered, or
 *                      nothing has been agreed to yet
 *   ready for review   they have signed off, and ⛔ THIS is where builders get involved
 *   ready for build    a builder read it through and said it is buildable
 *
 * A read-through that says it is NOT buildable sends the feature back to `specification` with the
 * blockers named. That is not a fourth stage: it is the first one, re-entered for a reason somebody
 * can read — which is what the stage is for.
 */
export const STAGES = ["specification", "ready for review", "ready for build"] as const;
export type Stage = (typeof STAGES)[number];

const dateish = z.union([z.string(), z.date()]).transform((v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v
);

/**
 * ⛔ ONE ENUM REPLACING EIGHT FIELDS: `question`, `asked_of`, `asked_at`, `blocks`,
 * `same_as`, `ambiguous`, `contradicts`, `answers`, `suspected_depends_on`, `contested`.
 * In v1 those accumulated one per complaint, and an architect reviewing it warned that a
 * framework growing a field per complaint becomes a form nobody fills in honestly. The
 * companions are required per value, so a standing cannot be asserted without the thing
 * that makes it actionable.
 */
export const Standing = z
  .object({
    kind: StandingKind.default("stated"),

    // open
    question: z.string().min(10).optional(),
    /**
     * ⛔ DRAFTED ANSWERS, SO DECIDING IS CHOOSING RATHER THAN COMPOSING.
     *
     * The states were scaffolded backwards. `underdetermined` — the LATE state, where
     * somebody has already worked out that there are two readings — required `readings`
     * and a `cost`. `open`, the EARLY state where nobody has thought about it yet, carried
     * a bare question and nothing else. So the moment a decider most needed options put in
     * front of them was the moment the model gave them least.
     *
     * What that felt like in practice: a page asking *"Can both kids complete the same
     * task, or is it claimed by whoever presses first?"* and no way to tell what either
     * answer would cost, what else hangs on it, or how to record having chosen. A question
     * a person cannot act on is not a queue item, it is a decoration.
     *
     * The AI drafts these from the code and the corpus; the human picks. That division is
     * the same one the analyzer has always had — propose, never decide — and it is what
     * makes a question answerable in one act instead of an essay.
     */
    candidates: z
      .array(
        z
          .object({
            says: z.string().min(10).optional().describe("the answer, written as the slot would state it"),
            /** ⛔ Required. Two options with no stated difference is not a choice. */
            consequence: z.string().min(10).describe("what follows if this is the answer — what it forces, what it rules out"),
            /**
             * ⛔ REQUIRED BESIDE AN `about` STANDING, BECAUSE THE ONLY EXIT DESTROYED THE
             * AGREED SENTENCE.
             *
             * When one thing ABOUT an agreed sentence is unruled, a candidate that answers
             * only that thing cannot be picked — picking it would delete the rest — so
             * `--pick` was refused and the sole exit `decide` printed was `--says` with the
             * whole merged sentence retyped at a prompt.
             *
             * A reviewer took that exit using the candidate's own text. The agreed sentence —
             * *"the amount is taken off what the kid has, the act appears at the top of their
             * history dated today, and the parent is returned to the kid's money"* — was gone.
             * `check` surfaced it only obliquely, and the clause with no criterion vanished
             * with no finding at all: the packet then told a builder that spending money on a
             * child is *"recorded like any other"* and nowhere said the money comes off.
             *
             * **That is verbatim the clause-loss `write.ts` documents as the reason `--pick`
             * was fixed, re-achieved through the exit the framework itself prints.**
             *
             * So a drafter says which they wrote. `the whole sentence` is pickable in one
             * action; `only the part in question` is honest about being a fragment, and
             * `decide` then asks for the merged sentence and shows what is being replaced.
             */
            /**
             * ⛔ A THIRD VALUE, BECAUSE THE MODEL COULD SAY "THIS SENTENCE IS WRONG" AND NOT "A
             * SENTENCE IS MISSING" — AND THE SECOND IS THE SHAPE OF EVERY JUDGE FINDING.
             *
             * Recorded as fg-0001 after it bit on Peter's own first answer. The question sat on
             * `pl-start-a-deal#resume-a-deal-already-started#answer`, a slot saying three separately
             * identified things. Its `about` was *"whether a processor is offered deals that somebody
             * else started"* — which is not any of the three. So `of` could not be set (there is no
             * statement to name), and the only write `settle` offered was the no-`of` branch, which
             * replaces the whole slot with one string.
             *
             * He chose an option. It was refused: *"a ruling here becomes the whole sentence, so
             * picking an option that answers only the unruled part would delete the rest"*. His
             * decision stood and the slot did not say it.
             *
             * ⛔ `adds a statement` IS THE HONEST THIRD CASE. The option is neither a replacement for
             * the slot nor a rewrite of one sentence in it — it is a new sentence to sit beside the
             * others. `settle` appends it with its own id and leaves every sibling byte-identical,
             * which is exactly what the `of` branch already proves is possible.
             */
            replaces: z
              .enum(["the whole sentence", "only the part in question", "adds a statement"])
              .optional(),
            /**
             * ⛔ FOR A `refuses` QUESTION, because `refuses` was unsettleable by any command.
             *
             * A candidate's only content field was `says`, and a sentence on `refuses` is a
             * parse refusal — *"a refusal is named, never described"*, which is right. So
             * `decide` rendered an open `refuses` fully and printed `--pick N` and `--says`,
             * **and both errored**. The only exit that worked was `waive` — which this file
             * calls THE LAUNDERING CHANNEL — and it succeeded on a question somebody had
             * already drafted two answers and a cost for.
             *
             * One of the required slots could be answered only by declaring it nobody's
             * to answer.
             */
            outcomes: z
              .array(
                z
                  .object({
                    name: z.string().min(2),
                    when: z.string().min(5),
                    told: z.string().min(5),
                  })
                  .strict()
              )
              .optional()
              .describe("⛔ No standings here — a proposed case is part of one answer, not a question of its own"),
            none: z.boolean().optional(),
          })
          .strict()
          .superRefine((c, ctx) => {
            const answers = [c.says?.trim() ? "says" : "", (c.outcomes ?? []).length ? "outcomes" : "", c.none ? "none" : ""].filter(Boolean);
            if (answers.length !== 1)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["says"],
                message:
                  answers.length === 0
                    ? "an option has to be an answer — a sentence, named refusal cases, or `none: true`"
                    : `an option answers once — ${answers.join(" and ")} cannot both be it`,
              });
          })
      )
      .optional(),
    asked_of: z.string().optional(),
    asked_at: dateish.optional(),
    /** ⛔ `[]` means "the rest can ship without this" and absent means nobody worked it
     *  out. Documented opposites, so this is `optional()` and must never gain a default. */
    blocks: z.array(z.string()).optional(),

    /* ⛔ `proposal` and `ruling_owed_by` REMOVED with the `proposed` standing. A proposal is a
     * candidate with a consequence; who owes the ruling is `asked_of`. */
    because: z.string().optional(),

    /** What it costs to guess wrong. ⛔ Reads on any kind — it is what makes a question
     *  worth a person's time, and it is printed on the queue line. */
    cost: z.string().optional(),

    // disputed — n-ary by construction
    targets: z.array(z.string()).optional(),

    // out_of_scope
    answered_at: dateish.optional(),
    answered_by: z.string().optional(),

    raised_by: z.string().optional(),
    /**
     * Every wording this question has had before its current one, oldest first.
     *
     * ⛔ THIS EXISTS SO A BADLY ASKED QUESTION IS NOT PERMANENT. `ask` refused to reword an open
     * question — *"a question somebody has been weighing is not rewritten under them"* — which is
     * right about the harm and wrong about the cure. The harm is being rewritten SILENTLY; the cure
     * is keeping what it used to say, not freezing it.
     *
     * ⛔ AND IT WAS NOT A SMALL FREEZE. Measured on Peter's corpus: 1,315 of 1,600 questions owed
     * were already drafted, so improving how this role words a question reached NONE of them —
     * including every one he had objected to by name. *"this should be natural language, not
     * engineering speak"* fixed the next question and not one question he was actually looking at.
     *
     * ⛔ THE OPTIONS ARE NOT TOUCHED BY A REWORDING, which is what makes it safe: the decision on
     * the table is the same decision, and anybody weighing it can read what it used to say.
     */
    was_asked: z.array(z.string()).optional(),
    /**
     * ⛔ REQUIRED WHEN THIS STANDING SITS BESIDE CONTENT, because otherwise the whole slot
     * reads unsettled and every surface throws the settled part away.
     *
     * A standing ANNOTATES what a slot says; it does not replace it. A slot can state what
     * it does and still have one thing about it nobody has ruled — and a reader needs to
     * know which thing, or they cannot tell whether the sentence in front of them is safe
     * to build.
     *
     * Enforced on the SlotFill, which is the only place that can see both at once.
     */
    about: z.string().min(10).optional(),
    /**
     * ⛔ WHICH STATEMENT, WHEN THE SLOT SAYS SEVERAL AND ONE OF THEM IS UNRULED (fg-0008).
     *
     * `about` is prose — it tells a reader which part is in question. It does not tell `--pick`
     * anything, so ruling one sentence of four meant every candidate had to be either the WHOLE
     * merged paragraph (destroying the per-statement review grain) or "only the part in question"
     * (un-pickable, sending the reviewer to retype the three agreed statements at a prompt).
     *
     * That is exactly the clause-loss `--pick` exists to prevent, re-achieved through the list
     * spelling — reported by the author who hit it rather than theorised.
     *
     * ⛔ `of`, THE SAME WORD A CRITERION USES for the same job, because a reader who has learnt
     * `criteria.of` has learnt this. A ruling on a standing with `of` replaces that statement and
     * leaves its siblings exactly as they were agreed.
     */
    of: z
      .string()
      .regex(new RegExp(`^${SEGMENT}$`), "a statement id is one segment, kebab-case")
      .optional(),
    /**
     * For a standing on a named refusal: which part of it is in question.
     *
     * ⛔ Every ruling on a case used to be written into `told`, so ruling *"is this refused at
     * all?"* replaced the user-facing message with "It is not refused." — destroying it, and
     * recording it nowhere. Three different questions were being answered into one field.
     */
    asks: z.enum(["whether", "when", "told"]).optional(),
  }).strict()
  .superRefine((s, ctx) => {
    const need = (field: string, cond: boolean, why: string) => {
      if (!cond)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `standing "${s.kind}" requires ${field}: ${why}`,
        });
    };
    /**
     * ⛔ `candidates` BELONGS TO `open`, and not keying it was the failure the last fold
     * claimed it had made impossible "by construction".
     *
     * Every other companion is keyed per value. `candidates` was valid on all four, so a
     * DISPUTED standing could carry one — *"whichever reading the storage layer makes cheapest
     * is the one we ship, since both are defensible and neither has a champion"* — and `decide`
     * offered it as "One answer has been proposed. Take it, or replace it." An argument about
     * how to choose, shipped to a builder as the `at_once` behaviour.
     */
    if (s.kind !== "open" && (s.candidates ?? []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["candidates"],
        message: `a drafted answer belongs to an \`open\` question — on \`${s.kind}\` it is offered for picking and becomes the sentence a builder implements, with nothing having asked whether it answers anything`,
      });
    }
    if (s.kind === "open") {
      need("question", !!s.question, "an open slot with no question is a blank cell");
      /**
       * ⛔ Two or more drafted answers need a stated cost of getting it wrong.
       *
       * This was `underdetermined`'s one genuine requirement — "what it costs to guess wrong
       * is what makes this worth ruling on" — and folding that standing in would have lost
       * it. A person deciding between two real options is owed the stakes; a question with
       * one proposal or none is a different, cheaper act.
       */
      // ⛔ Beside an `about`, every candidate has to say whether it is a whole sentence.
      for (const [i, c] of (s.candidates ?? []).entries())
        if (s.about && !c.replaces)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["candidates", i, "replaces"],
            message:
              "one thing about an agreed sentence is unruled here, so say whether this option is the whole replacement sentence or only the part in question — picking a fragment deletes the rest of what was agreed",
          });
      need(
        "cost",
        (s.candidates ?? []).length < 2 || !!s.cost,
        "two answers are on the table, so say what it costs to pick the wrong one — that is what makes this worth somebody's time rather than a coin toss"
      );
      need("asked_of", !!s.asked_of, "a question nobody owes stays open by default");
      need(
        "blocks",
        s.blocks !== undefined,
        "[] is a real answer meaning the rest can ship; absent means nobody looked"
      );
    }
    if (s.kind === "disputed") {
      // ⛔ DISTINCT targets, and the declaring slot does not count towards the two. The
      // guard counted, so a dispute listing its own ref twice satisfied "≥2" and named
      // nobody. `disputeIndex` in load.ts is the construction the message behaviours.
      /**
       * ⛔ ONE COUNTERPARTY IS A DISPUTE. Requiring two made the ordinary bilateral case
       * inexpressible.
       *
       * The guard counted `targets.length >= 2`, so "A cannot hold with B" — the normal
       * shape — was refused, and the only way to satisfy it was to add the declaring slot's
       * own ref, which is the exact construction the error message says does not count. An
       * author who believes the message writes the contradiction as prose instead.
       */
      const targets = [...new Set(s.targets ?? [])];
      need(
        "targets",
        targets.length >= 1,
        "a dispute names the slot or slots it cannot hold with, so it renders on all of them by construction"
      );
      need("because", !!s.because, "two slots pointed at each other with no explanation moves the puzzle");
    }
    if (s.kind === "out_of_scope") {
      /**
       * ⛔ THE LAUNDERING CHANNEL, AND IT WAS FREE.
       *
       * `out_of_scope` counts as settled: it leaves the queue, ungates the exchange, and
       * prints "This is your latitude." in the packet. It used to need nothing but a
       * non-empty string. Rewriting four standings as `because: n/a` took a children's
       * money corpus to 0 rulings owed, 0 gated, 0 packet holes — every hard question in
       * it (repeat semantics on a money write, overdraft, two kids pressing at once)
       * formally the builder's choice, through every gate, in four words.
       *
       * So it now costs more than an honest `open` does. An `open` question needs a
       * question, an owner and a blocks list; declaring something deliberately unanswered
       * is a stronger claim than admitting you do not know, and it should not be cheaper.
       */
      need("because", (s.because ?? "").length >= 40, "why this is deliberately unanswered, in a sentence a reader can weigh — a deliberate absence is a stronger claim than an open question, and must not be cheaper to write than one");
      need("answered_by", !!s.answered_by, "who decided this is not ours to answer — an unowned refusal is indistinguishable from nobody having looked");
      need("answered_at", !!s.answered_at, "when it was decided, so a latitude granted for last quarter's reasons can be found");
    }
    /* ⛔ The guard that a proposal must not read as a decision is now structural: a candidate
     * only exists inside an `open` standing, and an `open` standing gates. There is nowhere
     * else to put one. */
  });

/**
 * Everything that is true of a standing WHEREVER IT HANGS — one function, applied at every
 * grain a standing can appear at.
 *
 * ⛔ THIS EXISTS BECAUSE EVERY GUARD WAS WRITTEN PER-SITE, AND THE CONTRACT THEN HUNG IN
 * THREE PLACES WITH ONE IMPLEMENTATION.
 *
 * A standing on a slot got eight refinements. `RefusalOutcome.standing` — added so a slot
 * settled in general could have one case open — got `Standing.optional()` and nothing else. So
 * every protection built for a slot was simply absent one grain down:
 *
 *  - `about` beside `kind: stated` — the state the schema's own comment calls "THE EXACT STATE
 *    THIS FRAMEWORK EXISTS TO PREVENT, PASSING CLEAN" — passed clean on a case. Zero mentions
 *    anywhere; the sentence existed on no surface.
 *  - `out_of_scope` on a case was free latitude: no `latitude-nobody-granted`, gone from
 *    `decide`, and the packet printed "NOT RULED (out_of_scope)" above a `told` that states a
 *    real user-facing refusal.
 *  - `asks` was optional, so `settle` fell back to writing the ruling into `told` — and ruling
 *    *"is this refused at all?"* produced `refuses not-yours when a kid presses Done on
 *    another kid's task → A kid may complete any task offered to anybody in their family, so
 *    this is not refused.`
 *
 * Adding a third grain — a standing on a `Rule` — would have repeated it a third time. So the
 * rule is: a standing's contract lives here, and every site calls this.
 */
export function refineStanding(
  s: z.infer<typeof Standing>,
  ctx: z.RefinementCtx,
  at: string[],
  context: {
    /** Does the thing this standing sits on already say something? */
    hasContent: boolean;
    /** Is this a named case inside a `refuses` slot? Those need `asks`. */
    isCase?: boolean;
    /** What the thing is, for the message. */
    what: string;
  }
): void {
  const settled = s.kind === "stated" || s.kind === "out_of_scope";
  if (settled && s.about)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...at, "about"],
      message:
        "`about` names something nobody has ruled, so it cannot sit on a settled standing — if one thing about this sentence is genuinely in question, keep the sentence and make the standing `open` with this `about`, which is the only form that reaches a person",
    });
  /**
   * ⛔ ON A CASE, `asks` IS THIS REQUIREMENT ANSWERED BETTER — AND DEMANDING BOTH MADE THE ONE SLOT
   * A CORPUS MOST OFTEN LEAVES OPEN THE ONE SLOT NOTHING COULD DRAFT FOR. Recorded as fg-0002.
   *
   * Both fields answer "which part of this is in question". `about` answers it in prose about a
   * sentence; `asks` answers it with the FIELD — `whether` it refuses at all, `when`, or what the
   * asker is `told`. For a named refusal the enum is strictly the better answer, because a case is
   * not a sentence: it is three fields, and which one is in question is the whole question.
   *
   * ⛔ THE COST OF ASKING FOR BOTH WAS NOT PEDANTRY, IT WAS A DEAD END. `about` keys the demand
   * that every candidate declare `replaces` — "the whole replacement sentence, or only the part in
   * question". A case has no single sentence to replace, so there is no honest answer, and the only
   * way to write a question onto a refusal was to claim an option replaced part of a sentence that
   * does not exist. Measured by running it: a drafter was walked through `about`, then `replaces`,
   * and what it finally wrote was a question tagged `of: already-paid` sitting beside the refusal
   * rather than on it, which the reader then reported as settled.
   */
  if (!settled && context.hasContent && !s.about && !(context.isCase && s.asks))
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...at, "about"],
      message: context.isCase
        ? `this ${context.what} says something AND carries an unsettled standing — say which part of it is in question with \`asks\`: \`whether\` it refuses at all, \`when\` it refuses, or what the asker is \`told\``
        : `this ${context.what} says something AND carries an unsettled standing — say which part of it is in question, or the whole sentence reads unruled and every surface discards it`,
    });
  if (s.kind !== "open" && (s.candidates ?? []).length)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...at, "candidates"],
      message: `a drafted answer belongs to an \`open\` question — on \`${s.kind}\` it is offered for picking and becomes the sentence a builder implements, with nothing having asked whether it answers anything`,
    });
  if (context.isCase) {
    if (!settled && !s.asks)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...at, "asks"],
        message:
          "say which part of this case is in question — `whether` it refuses at all, `when` it refuses, or what the asker is `told`. Without it a ruling is written into `told`, so answering \"is this refused at all?\" produces a refusal message saying it is not refused",
      });
    // ⛔ `told` is mandatory and min(5) on an outcome, so an `out_of_scope` case always
    // contradicts itself: it states a user-facing refusal and says nobody answers this.
    if (s.kind === "out_of_scope")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...at, "kind"],
        message:
          "a named refusal cannot be deliberately unanswered — it already states what the asker is told. Remove the case if it is not ours to answer, or waive the whole slot",
      });
  }
}

export type Standing = z.infer<typeof Standing>;

// ---------------------------------------------------------------------------
// The filling of one slot.

/**
 * One named way an ask is refused.
 *
 * ⛔ IT CARRIES ITS OWN STANDING, BECAUSE A SLOT SETTLED IN GENERAL CAN HAVE ONE CASE OPEN —
 * AND WITHOUT THIS THE FRAMEWORK DELETED THE SETTLED PART.
 *
 * The spend form refuses an amount that is not money and an amount of zero; whether it also
 * refuses an amount larger than the kid's balance was never ruled. With only a slot-level
 * standing, recording that honestly meant marking the whole `refuses` slot `proposed` — and
 * the packet then printed `⛔ UNSETTLED (proposed)` and **silently dropped both settled
 * outcomes**, while the criteria section below it went on demonstrating a refusal the packet
 * no longer stated. The earn form one section up shipped both. A builder implements the
 * spend form with no amount validation at all, and nothing anywhere disagrees.
 *
 * So the unruled thing is named at the grain it is actually unruled at: this outcome is
 * proposed, those two are settled, and all three reach the builder.
 */
export const RefusalOutcome = z
  .object({
    standing: Standing.optional(),
    name: z.string().min(2).regex(new RegExp(`^${SEGMENT}$`), "a case name is the address a ruling is delivered to, so it is a slug: lower case, digits, - and _"),
    when: z.string().min(5),
    told: z.string().min(5).describe("what the asker is told — in their words, not a code"),
    /**
     * ⛔ HERE TOO, FOR THE REASON THE STANDING IS HERE TOO. `told` is copy a user reads, and it is
     * the single most consequential string software could invent — `propose-slots.ts` is built
     * around lifting it out of a component and refuses to compose one, precisely because an
     * invented refusal message is indistinguishable from an agreed one. Recording the hand that
     * put it here is what makes that distinction survive the write.
     *
     * Absent falls through to the slot or rule holding the case — see `authorshipOf`.
     */
    wrote: Authorship.optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    // ⛔ The same contract a slot's standing runs. It had none of it.
    if (o.standing)
      refineStanding(o.standing, ctx, ["standing"], { hasContent: true, isCase: true, what: "named refusal" });
    /**
     * ⛔ THE FLOOR LIVES WHERE THE FIELD LIVES.
     *
     * It was written into `SlotFill.superRefine`, so a rule's `outcomes` — which are the
     * shared refusal vocabulary, reaching every exchange the selector touches — went through
     * none of it. `told: unclear` on a rule ships that word as the user-facing message on
     * every one of them.
     */
    for (const [field, value] of [
      ["told", o.told],
      ["when", o.when],
    ] as const)
      if (PLACEHOLDER_TEXT.test(value.trim()))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `"${saysText(value).trim()}" is not an answer — if nobody has decided, that is a standing on this case, and it belongs in one where a person will be asked about it`,
        });
  });

export const SlotFill = z
  .object({
    /**
     * The sentence. Absent when inherited, out of scope, or not yet stated.
     *
     * ⛔ FLOORED, because this was the one answer-bearing string priced at zero — and it is
     * the field an LLM writing YAML touches on every slot.
     *
     * `says: tbd` produced: `check` 0 refusals; an accept preview reading `· again: stated
     * here` without showing the word; a successful accept; and a packet shipping
     * `- **again** — tbd` under a human's stamp. It was cheaper than honesty on every
     * surface at once — one fewer check note, one fewer `decide` item, one fewer gated
     * exchange, and promotion into the accept queue.
     *
     * `candidates[].says` and `Verdict.says` both already floor at 10, the latter with the
     * comment "a builder cannot build \"tbd\"". This is the same sentence at the same
     * altitude.
     */
    /**
     * What this slot says.
     *
     * ⛔ SEVERAL STATEMENTS, NOT ONE, BECAUSE A REAL SCREEN SAYS SEVERAL THINGS.
     *
     * This was a single string, and a real corpus broke it immediately: v1 recorded NINE separate
     * claims about one deals list — the columns it shows, that an unsized deal shows a dash rather
     * than a zero, that the filters live in the address, what an empty list says, what a failed load
     * leaves on screen — each with its own id and its own tests. One field, nine claims, so the
     * migration concatenated them into one paragraph.
     *
     * What that cost the reviewer is the whole point: nine things they could each have said yes or
     * no to became one thing they could only accept or reject entire. Eight right and one wrong had
     * no way to be expressed.
     *
     * The slot still answers ONE question — what the asker gets. The answer simply has parts, and
     * they stay parts, so a surface can list them and a stamp can cover the set.
     */
    says: z.union([z.string().min(10), z.array(Statement).min(2)]).optional(),
    /**
     * ⛔ WHO TYPED THIS SLOT'S CONTENT — and the slot has to be able to hold it, because the slot
     * is what a write path writes. `settle()` replaces `slot.says`; a role authoring a feature
     * fills a slot with its sentence and its named cases in one go. And the commonest spelling of
     * `says` is a BARE SENTENCE, which is not a `Statement` object at all — `statements()`
     * synthesises one at read time and it is never stored, so a statement-only field would leave
     * the majority of claims in every corpus with nowhere to record their author.
     *
     * ⛔ NOT ON THE DOCUMENT. A scope file is months of edits by a dozen hands; a document-level
     * author answers "who last touched this file", which is a different question whose answer is
     * wrong for almost every sentence in it.
     *
     * ⛔ AND NOT A SIDE LOG. Most claims are written by a role editing YAML, not by a CLI verb, so
     * a log only the commands appended to would be blank for exactly the claims a grooming agent
     * most needs to classify — and its blankness would be indistinguishable from an honest unknown.
     *
     * ⛔ IT IS IN THE STAMP, like every other key of this object, and that is safe BECAUSE absence
     * is the only way to say unknown: nothing backfills, so no existing corpus moves and no
     * acceptance goes stale when this lands. What it buys is that replacing an agreed sentence with
     * software's wording cannot be done underneath a stamp — which is the same argument `held_by`
     * and `rests_on` are in the hash for.
     */
    wrote: Authorship.optional(),
    standing: Standing.default({ kind: "stated" }),
    /**
     * Which combination of the product's dimensions this whole slot holds for. Absent means every one.
     *
     * ⛔ ON THE SLOT AS WELL AS ON THE STATEMENT, because the two say different things. A statement's
     * `holds_for` is "this sentence is promised there"; a slot's is "this part of the exchange only
     * exists there" — a refusal an auditor never meets, a reading only an admin is shown. Writing the
     * second as a `holds_for` on every statement in the slot would be the same fact in N places.
     */
    holds_for: z.record(z.string().min(1)).optional(),
    /** ⛔ Observable by the asker, or it is engineering's. */
    within: z.string().min(10).optional(),
    outcomes: z.array(RefusalOutcome).optional().describe("for `refuses` — named, never a code"),
    /**
     * ⛔ SET THIS WHEN YOUR SENTENCE DISPLACES AN ORG-WIDE `supplies` RULE.
     *
     * Two ways out of a rule existed, and only one of them was visible. `excepts` demands a
     * reason and renders `⊗R4` in the grid and struck through in the packet. Simply stating
     * the slot achieved the same escape, demanded nothing, and rendered as an ordinary `✓`.
     *
     * So the quiet path was the one available to a confident author, and a reviewer used it
     * to replace "Only a parent may change what a kid has" with "Anybody on the shared
     * device may record what a kid spent" — on the exchange that takes money off a kid.
     * `check`'s only complaint was that the new sentence had no test case, and `acts` went
     * on reporting the authorization rule as reaching that exchange.
     *
     * `check` now refuses a local sentence that displaces a rule without this. It is the
     * same cost as an `excepts`, because it is the same act.
     */
    instead_of: z
      .array(z.object({ rule: z.string(), because: z.string().min(10) }).strict())
      .default([]),
    /**
     * ⛔ THE COUNTERPART TO `instead_of`, WITHOUT WHICH AGREEING WITH A RULE WAS UNSAYABLE.
     *
     * A slot that states its own sentence displaces any `supplies` rule reaching it, and the
     * only declaration available said the rule does NOT govern. So an author whose sentence
     * *agreed* with the rule — even restated it verbatim — had to file a formal exemption from
     * it, and `check` demanded exactly that. After three such rulings every money write
     * carried `⊗` and the idempotency rule governed no money write at all.
     *
     * The other exit was worse: `check` also reported `rule-governs-nothing / widen the
     * selector, or delete it` on a rule whose selector was already `acts_on: changes` and
     * therefore could not be widened — so the cheapest way to a green gate was deleting an
     * org-wide guarantee.
     *
     * `defers_to` says: this sentence is mine, and that rule still holds here.
     */
    defers_to: z
      .array(
        z
          .object({
            rule: z.string(),
            /** ⛔ Why say it locally at all, if the rule already holds? Usually: narrower. */
            because: z.string().min(10),
          })
          .strict()
      )
      .default([]),
    /**
     * ⛔ THE CHARTER SECTION THIS SENTENCE RESTS ON — `<charter>#<section>`.
     *
     * An author resting two slots on one product-wide principle had nowhere to point, so it
     * restated the substance of the charter's "an unreadable value is said, not shown as absent"
     * in BOTH of them. That is the duplication the first rule of this repo forbids — every fact
     * has exactly one home — and there was no alternative available. Reported as fg-0013.
     *
     * ⛔ `rests_on`, NOT `defers_to`, AND THE DIFFERENCE IS LOAD-BEARING. A rule SUPPLIES or
     * CONSTRAINS a slot: it reaches in and changes what the slot promises, which is why
     * `defers_to` names something the machinery resolves and weighs. A charter section settles a
     * design argument and governs nothing mechanically — so this is a CITATION. `check` resolves
     * it, so a wrong one is caught; nothing derives a promise from it, and nothing should.
     */
    rests_on: z
      .array(z.string())
      .min(1)
      .optional()
      .describe("<charter>#<section> — the principle this sentence follows from, cited not restated"),
    /** `refuses: none` and `cannot_fail` are real, distinct, statable answers — which is how
     *  latitude reaches a builder by declaration rather than by absence. */
    none: z.boolean().optional(),
    cannot_fail: z.string().optional(),
    /**
     * ⛔ WHO MAY, BY NAME — only on `may`, and refused on every other slot.
     *
     * Peter: *"enumerate which permissions can access it."* The slot already asks who may; what it
     * could not do was answer in terms the product shares with its other features, so the answer
     * was prose and the question "what can an underwriter reach" was unanswerable.
     *
     * ⛔ `says` STAYS AND IS STILL REQUIRED. A list of ids is not a sentence a reviewer can judge —
     * "nobody outside the deal's own team, even an admin" is the part a person agrees to, and the
     * ids are what makes it checkable and listable. Replacing the sentence with the list would
     * trade the thing a human validates for the thing a machine reads.
     */
    held_by: z.array(z.string()).default([]),
    /* ⛔ `notes` REMOVED. It answered no slot question, so it had no honest content — and it
     * carried unsettled product truth straight through every guard: *"How far back the history
     * goes is not decided… Whether a kid sees the same history as a parent is also unsettled"*
     * passed `check` byte-identically, appeared in the accept preview under "Read what you are
     * agreeing to", survived `✓ accepted`, and printed in the packet as a bullet indented
     * exactly like an inherited obligation.
     *
     * Everything it was used for has a home that is checked: a cross-reference belongs in
     * `defers_to.because`, a residual in `standing.about`, a rationale in the verdict log. */
  }).strict()
  .superRefine((f, ctx) => {
    const stated = f.standing.kind === "stated";
    /**
     * ⛔ `out_of_scope` COUNTS AS CONTENT, because the exclusivity check twelve lines below
     * already treats it as an answer and this did not.
     *
     * The consequence was a trap with no exit, on the only priced way to grant latitude:
     * `v2 waive` succeeded; `check` then refused with `displaces-a-rule-without-saying-so` and
     * told the author to add `instead_of`; adding exactly that made the file refuse to parse
     * with *"this slot has no sentence yet"*; and the corpus was then unloadable, so `v2 rule`
     * answered `no scope "money"`.
     */
    const hasContent =
      !!f.says || !!f.none || !!f.cannot_fail || (f.outcomes ?? []).length > 0 || f.standing.kind === "out_of_scope";
    // ⛔ ONE CONTRACT, EVERY GRAIN. See `refineStanding` — writing these per-site is what
    // left `RefusalOutcome.standing` with none of them.
    refineStanding(f.standing, ctx, ["standing"], { hasContent, what: "slot" });
    /**
     * ⛔ A DECLARATION ABOUT A RULE NEEDS A SENTENCE TO BE ABOUT.
     *
     * `instead_of` authored beside an OPEN slot — *"whatever we decide here, the org rule's
     * once-only default is not what the spend form means by a repeat"* — survived the ruling
     * that followed, so a waiver written before there was a sentence, citing an argument made
     * before anybody decided, ended up signed by the ruler. `settle`'s own comment 30 lines
     * above the code claims these are cleared and re-derived. They were not.
     */
    for (const field of ["instead_of", "defers_to"] as const)
      if ((f[field] ?? []).length && !hasContent)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `\`${field}\` says how this slot's own sentence relates to an org-wide rule, and this slot has no sentence yet — it would outlive whatever gets decided here, citing an argument made before anybody decided`,
        });
    /**
     * ⛔ THE WHOLE INVENTORY, because this ran over two of five and the other three shipped.
     *
     * `within: tbd` reached the packet as `*(within: tbd)*`. `told: unclear` reached it as the
     * user-facing refusal message. Both with zero refusals. The guards were written per field
     * while the hash was written per class, so each round found the next adjacent one free.
     *
     * Every string a person could read is in here. Adding a content string to `SlotFill` or
     * `RefusalOutcome` and not adding it here is now the only way to reintroduce this, and
     * `test/v2-no-dead-fields.test.mjs` already refuses a field no surface reads.
     */
    const PLACEHOLDER = PLACEHOLDER_TEXT;
    for (const [field, value] of [
      ["says", f.says],
      ["cannot_fail", f.cannot_fail],
      ["within", f.within],
      ...(f.outcomes ?? []).flatMap((o, i) => [
        [`outcomes.${i}.told`, o.told],
        [`outcomes.${i}.when`, o.when],
      ]),
    ] as const) {
      // ⛔ Every statement, not the first: "tbd" hiding as the ninth of nine is still a non-answer.
    if (value && statements(value).some((x) => PLACEHOLDER.test(x.says.trim())))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `"${saysText(value).trim()}" is not an answer — if nobody has decided, that is a standing, and it belongs in one where a person will be asked about it`,
        });
    }
    /**
     * ⛔ ONE SLOT, ONE ANSWER. `hasContent` was an OR and nothing checked exclusivity.
     *
     * A ruling written onto a slot that already held `cannot_fail:` left both on the file,
     * and the packet printed *"cannot fail: Saying a task is done cannot fail…"* — the
     * human's ruling appeared nowhere. Then `settle()` helpfully added
     * `instead_of: nothing-half-happens` using the ruler's own reasoning, so the org rule
     * guaranteeing the person IS told became explicitly waived, citing the argument for
     * telling them. The ruling was not ignored; it was inverted.
     */
    const answers = [
      f.says ? "says" : "",
      f.none ? "none" : "",
      f.cannot_fail ? "cannot_fail" : "",
    ].filter(Boolean);
    // ⛔ `out_of_scope` IS an answer — it says "nobody here answers this, decide for
    // yourself" — so it belongs in the exclusivity check. `says` beside it parsed, and the
    // packet printed "deliberately not answered here… This is your latitude." twelve lines
    // above a criterion still demanding "then it shows as waiting for a parent".
    if (f.standing.kind === "out_of_scope" && answers.length)
      answers.push("a deliberate refusal to answer");
    if (answers.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [answers[1]!],
        message: `this slot answers twice — ${answers.join(" and ")} cannot both be what it is, and a reader cannot tell which one a builder should implement`,
      });
    }
    if (f.none && (f.outcomes ?? []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["none"],
        message: "`none` says there is nothing to refuse, and the outcomes beside it name things it refuses",
      });
    }
    if (stated && !hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["says"],
        message:
          "a slot standing as `stated` has to say something — use `none`, `cannot_fail`, or a standing other than stated",
      });
    }
  });
export type SlotFill = z.infer<typeof SlotFill>;

/**
 * The five slots that owe a demonstration, and the three reasons one of them does not.
 *
 * ⛔ ONE HOME, BECAUSE TWO READERS ASK THE SAME QUESTION AND MUST NOT DISAGREE. `check` asks it
 * to report a slot nothing demonstrates; the packet asks it to tell a builder how much of the
 * list is missing. Written twice, the two answers drift and the packet says the set is closed
 * while `check` says it is not — on the same corpus, in the same run.
 *
 * ⛔ NOT `may` OR `with`. The long note in `check.ts` records what happened when they were
 * included: it fired on 350 of 600 slots, its own fix text offered a field that did not exist,
 * and the only way to silence it was filler which then landed in the packet as something a
 * builder implements. `with: "Which kid."` is exercised by every criterion on the exchange.
 */
export const DEMONSTRABLE_SLOTS: readonly SlotName[] = [
  "answer",
  "refuses",
  "fails",
  "again",
  "at_once",
];

/**
 * The five slots whose answer is a POLICY, and the three whose answer is a fact about one ask.
 *
 * ⛔ THIS IS WHAT MAKES FOLDING HONEST, AND WITHOUT IT THE FOLD WAS A LIE ON THREE SLOTS.
 *
 * `interview.ts` offers several behaviours blank on one slot as ONE question, on the grounds that
 * the slot IS the question — `SLOT_ASKS.at_once` is one sentence and it is the same sentence at
 * every site. That holds for what a product does about permission, refusal, failure, repetition and
 * concurrency: each is a decision taken once and applied, which is exactly why `Rule` exists and
 * why it can SUPPLY these outright.
 *
 * It does not hold for the other three. *"What must be known to ask"*, *"what the asker gets"* and
 * *"what is true afterwards"* are facts about one ask — three behaviours blank on `after` are blank
 * on three different questions, and folding them offers one answer for all three. A reviewer who
 * picked it would have settled two behaviours they were never shown.
 *
 * ⛔ READ OFF THE RULES A REAL CORPUS HAS, not reasoned from the names. Every rule in `v2-seed`
 * SUPPLIES one of these five (`only-a-parent-moves-money` → `may`, `a-repeat-does-nothing-twice` →
 * `again`, `nothing-half-happens` → `fails`, `amounts-refuse-the-same-way` → `refuses`,
 * `one-hand-at-a-time` → `at_once`). **No rule anywhere fills `with` or `after`.** `answer` is the
 * one to look at twice: three rules declare `fills: [answer]` and the grid shows it `✓+R4+R9` at
 * every site — stated locally and CONSTRAINED by a rule, never supplied by one. A cross-cutting
 * claim about how a figure reads is not an answer to what the asker gets.
 *
 * ⛔ NOT `DEMONSTRABLE_SLOTS` WITH A TWEAK, THOUGH IT IS ONE SLOT AWAY. That set answers "does this
 * owe a given/when/then"; this one answers "is one answer here an answer everywhere". `answer` owes
 * a demonstration and does not fold, which is the whole difference — collapsing them would make the
 * next change to either silently change the other.
 */
export const POLICY_SLOTS: readonly SlotName[] = ["may", "refuses", "fails", "again", "at_once"];

/**
 * Whether this slot, as filled, owes a given/when/then of its own.
 *
 * ⛔ The caller still has to ask whether an org-wide rule demonstrates it — that needs the
 * resolved corpus, which this deliberately does not take.
 */
export function owesDemonstration(slot: SlotName, fill: SlotFill | undefined): boolean {
  if (!fill || fill.standing.kind !== "stated") return false;
  if (fill.none || fill.cannot_fail) return false;
  if (!DEMONSTRABLE_SLOTS.includes(slot)) return false;
  // Nothing to demonstrate where the refusal IS "nothing happens and nothing is told".
  if (slot === "refuses" && (fill.outcomes ?? []).every((o) => /^nothing\b/i.test(o.told))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Criterion — first-class and separately hashed, which is the whole point.

export const CriterionKind = z.enum(["instance", "conformance"]);

/**
 * ⛔ FIRST-CLASS SO IT CAN BE HASHED SEPARATELY. In v1 the cases lived inside the stamped
 * unit, so accepting a claim silently blessed every case attached to it — including ones
 * nobody read, and including ones added afterwards. Two hashes (§5.2 of the recommendation)
 * is the one mechanical change that makes "a case added after acceptance is not reviewed"
 * true rather than aspirational.
 */
export const Criterion = z
  .object({
    id: z.union([z.number(), z.string()]).transform(String),
    slot: z.enum(SLOTS),
    /**
     * The statement this demonstrates, where the slot says several things.
     *
     * ⛔ v1 HAD THIS AND THE MIGRATION LOST IT. A v1 test case belonged to a BEHAVIOUR, not to a
     * screen — and flattening every case onto `slot: answer` put thirty-one of them under one
     * statement, where most demonstrated a different one. A reviewer reading the first claim was
     * shown the evidence for all thirteen.
     *
     * Optional because a slot saying one thing needs no pointer: there is only one thing to show.
     */
    of: z.string().optional(),
    kind: CriterionKind.default("instance"),
    /**
     * Who worked out that this had to be demonstrated, and against which words.
     *
     * ⛔ A CRITERION IS NOT AUTHORED. Peter: *"a product person doesn't write a criterion - what
     * even is this? this is old shit. the agents decide what kind of tests need to exist."*
     *
     * Everything about this field follows from that sentence:
     *
     *  - **`from` is the hash of the claim it was worked out against**, which is the whole of
     *    "keep them idempotent as truth changes". Re-deriving over unchanged truth produces the
     *    same set; a reworded sentence leaves exactly the requirements that came from it pointing
     *    at a hash nothing matches, and `check` says which. Without it, re-derivation is a fresh
     *    unrelated set of tests every run and nothing can be kept.
     *  - **It is what keeps a human's acceptance honest.** `coveredBy` hashes only the criteria
     *    NOBODY derived, so a machine rewriting the test specs can no longer stale a stamp — a
     *    person cannot have agreed to words they never saw, and before this a re-derivation would
     *    have invalidated every acceptance in a corpus at once.
     *  - **Absent means nothing derived it**, which is the old shape and still loads. ⛔ It is NOT
     *    a record that a person typed it — see `criterionHand`. An LLM's YAML is byte-identical to
     *    a product person's, so reading absence as a human would turn software's guess into a
     *    draft somebody has read. `check` says
     *    so as a note and names the role that should have produced it. ⛔ Not a refusal: every
     *    corpus in existence is full of authored criteria, and a refusal firing on all of them is
     *    one people switch off — which this project has now learned twice in one day.
     */
    derived: z
      .object({
        /** The role that worked it out. ⛔ Never a person: that is what `authored` means. */
        by: z.string().min(1),
        at: dateish,
        /** The claim hash this was worked out against — see `claimHash`. */
        from: z.string().min(8),
      })
      .strict()
      .optional(),
    given: z.string().optional(),
    when: z.string().optional(),
    then: z.string().optional(),
    steps: z.string().optional(),
    level: z.enum(["unit", "integration", "api", "e2e"]).optional(),
    /**
     * An escape hatch for a criterion legitimately naming an example value.
     *
     * ⛔ PRICED, BECAUSE IT WAS THE ONLY FREE ESCAPE LEFT AND THE REFUSAL ADVERTISED IT.
     *
     * `then: rounded up to the nearest dollar, held for twenty-four hours, charged through
     * Stripe, an email receipt to both parents, the record locked` — with `example: true`,
     * zero findings, a successful accept, and all five invented behaviours printed under
     * "What must be demonstrated" beneath a human's stamp. Without it, the detector refuses —
     * and its own fix text ended *"or mark example: true"*.
     *
     * Everything else here is priced: `out_of_scope` costs 40 characters, an owner and a date;
     * `excepts`, `instead_of` and `defers_to` each cost a reason. A bare boolean that switches
     * off the best detector in the codebase, unowned and undated, was the cheapest sentence in
     * the schema.
     */
    example: z
      .object({
        /** ⛔ Why a literal here is the example and not the rule. */
        because: z.string().min(30),
        by: z.string(),
        at: dateish,
      })
      .strict()
      .optional(),
  }).strict()
  .superRefine((c, ctx) => {
    if (!c.then && !c.steps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["then"],
        message: "a criterion needs a `then` (or `steps`) — otherwise nothing is demonstrated",
      });
    }
  });
export type Criterion = z.infer<typeof Criterion>;

// ---------------------------------------------------------------------------
// Exchange — one ask with exactly one answer, and the unit a human accepts.

export const AskedBy = z.enum(["person", "system", "integrator"]);

export const Exchange = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "exchange ids are kebab-case slugs"),
    title: z.string().min(3),
    asked_by: AskedBy,
    /**
     * What hands machinery its input. System- and integrator-asked only.
     *
     * ⛔ THE MIRROR OF `at`, AND ITS ABSENCE WAS THE LAST REAL ASYMMETRY IN A SKELETON WHOSE
     * WHOLE ARGUMENT IS SYMMETRY.
     *
     * `at` is required for a person's ask on the stated grounds that without it v1
     * accumulated screen-shaped behaviours nobody could find. The machinery side had exactly
     * that problem and no field for it, so the fact got smuggled: this corpus wrote
     * `with: A kid with a standing allowance, **and the day it falls due**`, and a reviewer
     * writing a system exchange from scratch put the trigger in both `may` and `with` and
     * got zero findings.
     *
     * A builder cannot tell a nightly job from a one-off backfill from something another
     * part of the product calls — and those are three different programs.
     */
    when: z
      .object({
        /** ⛔ Product language. "A nightly scheduler", not a cron expression or a queue. */
        triggered_by: z.string().min(5),
        /**
         * The ask this one follows, when something in the product sets it off.
         *
         * ⛔ THE ONLY THING IN FOUR CORPORA A REVIEWER COULD NOT WRITE DOWN AT ALL.
         *
         * `triggered_by` is prose, and `Part.leads_to` — which joins views — was the only real
         * relation in the model. So `membership#remove-a-member#answer` could say *"every task
         * they had claimed stays claimed in their name"* while
         * `claims#release-a-removed-members-claims#answer` said *"every task that member had
         * claimed is released, and shows on the list as free for anybody to take."* One event,
         * two flatly opposite sentences, **zero findings**, two packets, two different
         * products.
         *
         * Resolved through `ref.ts` and hashed into both stamps, so the triggering exchange
         * shows what it sets off and the two sentences are read together.
         */
        /**
         * ⛔ RENAMED FROM `after`, BECAUSE THE SCHEMA THEN HAD TWO OF THEM MEANING DIFFERENT THINGS.
         *
         * The eighth slot is `after` — *what is true afterwards*. This field is a causal ordering —
         * *the ask this one follows*. One word for both, inside one exchange, is the shape that
         * produces an author filing a state change under a trigger and nobody noticing.
         *
         * `follows` is also what its own detector has always been called (`follows-nothing`), so
         * the field and the check that guards it now agree.
         */
        /**
         * ⛔ SEVERAL, BECAUSE MACHINERY WITH FIVE CALLERS COULD NAME ONE (fg-0007).
         *
         * This was a single ref, so an exchange set off by five different features had nowhere to
         * put the other four — and `follows-nothing` then read as though nobody triggered it.
         * `read-a-supplied-file` is asked by mapping a statement, publishing a statement, reading
         * the exception log, publishing a rent roll and reviewing the rows; all five lived in the
         * prose of `triggered_by`, where nothing resolved them and no surface read them as edges.
         *
         * ⛔ ONE REF STILL PARSES, deliberately. A corpus written `follows: a#b` is correct and
         * stays correct — the transform lifts it into a list, so every reader sees one shape and no
         * author has to write a list of one. Changing this to an array-only field would have
         * invalidated every corpus on disk to express "sometimes there are five".
         */
        follows: z
          .union([
            z.string().regex(REF_PATTERN, REF_MESSAGE),
            z.array(z.string().regex(REF_PATTERN, REF_MESSAGE)).min(1),
          ])
          .transform((v) => (Array.isArray(v) ? v : [v]))
          .optional()
          .describe("<scope>#<exchange>, or several — the asks this one follows"),
        /** `repeating` vs `once` is the difference between a cron and a script. */
        cadence: z.enum(["repeating", "on-an-event", "once"]),
        /** For `once` — what made it necessary, so it can be retired when it is done. */
        because: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Where a person's ask arrives. Person-asked only. */
    /* ⛔ `interaction` REMOVED from `at`. It was read in exactly one place — the key for
     * `one-press-two-answers` — where it WEAKENED the refusal: two exchanges on the same
     * button escaped the collision by spelling it `press` and `tap`. The refusal means "one
     * control, one answer", so its key is the control. */
    /**
     * Where a person meets this exchange: the screen, the control on it, and ⛔ WHICH STATE OF IT.
     *
     * Peter, reviewing create-deal: *"most of the prototypes per behavior card are wrong. on
     * at-create-deal, they all show the entry form, even if talking about folder matching..."*
     *
     * He was looking at four behaviours anchored to four different controls of one view — and every
     * card showed the same picture, because `at` could name a view and a part and had no way to
     * name a state. That view has four states; `folder-question`, `use-existing-folder` and
     * `create-new-folder` exist in exactly ONE of them and are absent from the default picture
     * entirely. So every sentence about folders was shown beside a screen with no folders on it.
     *
     * ⛔ A SCREEN IS NOT ONE PICTURE — the model already said that, for views. This is the half that
     * was missing: a sentence pointing INTO one. `View.states` landed, and every reference to a
     * view went on resolving to its default frame, which made the states visible to somebody
     * clicking tabs and invisible to everything that cites a screen.
     *
     * Optional, and derived when absent: `stateShowing` finds the one state whose picture contains
     * the part. Writing it only matters when the derivation cannot tell — a part drawn in several
     * states, where which one the sentence means is a fact only the author has.
     */
    at: z
      .object({
        view: z.string().optional(),
        part: z.string().optional(),
        state: z.string().optional(),
        /**
         * ⛔ THE SCREEN THIS ASK ARRIVES AT BELONGS TO ANOTHER SCOPE — `<scope>#<view>`.
         *
         * A person-asked exchange owes a view. But a scoper may not read another feature's scope,
         * and a migrated corpus is full of reader actions whose screen was written somewhere else.
         * With only `view:` available, the author's three moves were: name a view this scope does
         * not have, invent one, or leave the behaviour filed as machinery. All three are wrong, and
         * the third is what happened — `pin-a-version` kept "pinning a source" and "releasing a
         * pin" as `asked_by: system` with a prose `triggered_by`, and `happy_path.through` stayed
         * empty, because `asked_by: person` demanded a view it could not honestly name.
         *
         * Recorded as framework gap fg-0005 by the scoper that hit it: *"There is no way to say
         * 'this is a person's ask and the screen it arrives at belongs to another scope'."* Now
         * there is. `check` resolves it like any other ref, so a wrong one is caught rather than
         * believed.
         */
        view_in: z.string().optional(),
      })
      .strict()
      .refine((a) => !(a.view && a.view_in), {
        message: "say `view` or `view_in`, not both — one ask arrives at one screen",
      })
      .optional(),
    exists: z.enum(["intended", "kept", "withdrawn"]).optional(),
    /**
     * ⛔ THIS IS THE ACT THAT ENDS THE FEATURE — SAID, NOT GUESSED.
     *
     * Peter, driving the prototype: *"the screen linking is wrong - clicking continue from the first
     * page shoudl take you to folder selection"* — and before that, *"it dead ends. no way to
     * complete setup"*.
     *
     * Finishing used to be derived by scoring a control's sentence against `happy_path.ends_with`
     * and taking anything sharing three words. ⛔ So **Continue** was declared to complete
     * create-deal, on a sentence whose own words are *"Nothing has been created yet"* — it shared
     * "deal" and "folder" with the outcome, and that was enough. A claim as strong as "this is
     * where the feature ends" cannot rest on shared nouns: every sentence in a feature is about the
     * same nouns.
     *
     * So an author says it. One boolean, on the exchange whose press ends the thing. Nothing infers
     * it, and where nothing says it, `nothing-finishes-this-feature` asks for it rather than
     * inventing an answer — which is the difference between a corpus that is incomplete and one
     * that is confidently wrong about its own flow.
     */
    finishes: z.boolean().optional(),
    /**
     * ⛔ WHICH APPEARANCE OF THE SCREEN THIS PRESS PUTS SOMEBODY IN — said, where prose cannot tell.
     *
     * Peter: *"the screen linking is wrong - clicking continue from the first page shoudl take you
     * to folder selection."*
     *
     * The destination was scored out of the `after` sentence against each state's name. That works
     * when the sentence happens to name the state and fails in a way nobody can see when it does
     * not: Continue's sentence says *"They are being asked where this deal's folder is… Nothing has
     * been created yet"* — which names **Folder** and **Creating** equally well, so the tie rule
     * refused both and the prototype moved nowhere. Before that, with no `after` at all, it read
     * the `answer` and landed on Creating.
     *
     * ⛔ Every one of those outcomes is a sentence being asked a question it was not written to
     * answer. `after` says what is different afterwards; it is not a pointer. So where the picture
     * has to move somewhere specific, name it — the value is a state's `when`, the same vocabulary
     * `at.state` uses, because two spellings of "which appearance" is how the two come to disagree.
     *
     * Still derived when absent: a sentence that unambiguously names one appearance is a lookup, and
     * making an author restate it would be the hand-authoring this project keeps failing at.
     */
    lands_on: z.string().optional(),
    reads: z.array(z.string()).default([]),
    changes: z.array(z.string()).default([]),
    /** Rules this exchange is exempt from, each with a required reason. */
    excepts: z
      .array(z.object({ rule: z.string(), because: z.string().min(10) }).strict())
      .default([]),
    slots: z.record(z.enum(SLOTS), SlotFill).default({}),
    criteria: z.array(Criterion).default([]),
  }).strict()
  .superRefine((e, ctx) => {
    /**
     * ⛔ `held_by` ANSWERS "WHO MAY", SO IT BELONGS TO THAT SLOT AND NOWHERE ELSE.
     *
     * The same reasoning as `outcomes` on `refuses` and `cannot_fail` on `fails`: a field that is
     * meaningful on one slot and accepted on all eight is a field that will be written on the
     * wrong one, read by nothing, and look correct in the file.
     */
    for (const [slot, fill] of Object.entries(e.slots ?? {}))
      if (slot !== "may" && (fill as { held_by?: string[] })?.held_by?.length)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", slot, "held_by"],
          message: `held_by says who may perform this, so it belongs on the \`may\` slot — not on \`${slot}\``,
        });
    // ⛔ A person's ask arrives somewhere. Without this an exchange can claim a human
    // trigger and name no screen, which is how v1 accumulated screen-shaped behaviours
    // nobody could find.
    /**
     * ⛔ `at.part` IS THE KEY OF A REFUSAL, SO OMITTING IT CANNOT BE FREE.
     *
     * Two exchanges pointing at one button gave `one-press-two-answers`. Deleting two
     * characters — `at: { view: earn-form }` — gave no finding of any kind, with both
     * exchanges still claiming that button in prose, and also silently un-governed every
     * `part_role` rule. The quiet path cost less than the honest one, which is the gradient
     * this file exists to invert.
     *
     * A view with no interactive parts is a legitimate arrival point; a view that has them and
     * an ask that names none is an ask nobody can find.
     */
    /**
     * ⛔ `view_in` SATISFIES THIS, AND THAT IS THE WHOLE OF fg-0005. The guarantee is "an ask a
     * person makes arrives somewhere nameable", not "arrives in this file" — and insisting on the
     * latter is what pushed reader actions back into machinery.
     */
    if (e.asked_by === "person" && !e.at?.view && !e.at?.view_in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["at"],
        message:
          "a person-asked exchange must say which view the ask arrives at — `view` for a screen in this scope, or `view_in: <scope>#<view>` when the screen belongs to another",
      });
    }
    if (e.asked_by !== "person" && !e.when?.triggered_by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["when"],
        message:
          "machinery is handed an input from somewhere — say what hands it over and whether it repeats, or a builder cannot tell a nightly job from a one-off backfill",
      });
    }
    if (e.asked_by === "person" && e.when) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["when"],
        message: "a person's ask arrives at a view, which `at` already says — `when` is for machinery",
      });
    }
    // ⛔ A one-time concern can finally say it is one-time, which had no home at all.
    if (e.when?.cadence === "once" && !e.when.because) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["when", "because"],
        message:
          "a one-time job has to say what made it necessary, or nobody can tell when it is safe to retire and it becomes permanent truth",
      });
    }
    if (e.asked_by !== "person" && e.at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["at"],
        message: "only a person's ask arrives at a view — machinery is handed an input from elsewhere",
      });
    }
    // ⛔ An e2e criterion on a system-asked exchange means the behaviour can only be
    // demonstrated through a screen, which means it is somebody's screen's behaviour.
    if (e.asked_by !== "person") {
      for (const c of e.criteria) {
        if (c.level === "e2e") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["criteria"],
            message: `criterion ${c.id} is e2e on a ${e.asked_by}-asked exchange — if it needs a screen it belongs to whoever owns that screen`,
          });
        }
      }
    }
    /**
     * ⛔ EVERY CONTENT FIELD IS KEYED TO THE SLOTS IT CAN ANSWER, DECLARED ONCE, IN A TABLE.
     *
     * This began as two ad-hoc guards, and that was the mistake. `none: true` on every
     * slots erased the blank-cell mechanism the whole design is staked on — `grid` read
     * `0 blank`, `acts` offered the exchange, the accept succeeded, and the packet handed a
     * builder a line per slot of "nothing to refuse. Stated, not omitted." under a human's stamp.
     * So `none` and `cannot_fail` got per-slot guards.
     *
     * Then `outcomes` did the identical thing, because nobody had keyed IT to a slot. One
     * refusal clause filed on every slot produced zero refusals, a `✓` in every cell, a
     * successful accept, and a packet whose only statement about who may press the control was
     * that an unknown kid is refused — meaning anyone else may.
     *
     * Two instances of one class means the next field does it again. So this is the class, not
     * a third instance: a field that answers a specific question belongs to the slot that asks
     * it, and anywhere else it reads as settled while saying nothing.
     *
     * `SlotFill` cannot see its own slot name — `slots` is a record keyed by slot — which is
     * why this lives here and not there.
     */
    /**
     * ⛔ `says` IS NOT AN ANSWER TO `refuses`, and two lists in this file disagreed about it.
     *
     * `SlotFill`'s exclusivity check counts `says`/`none`/`cannot_fail`; the `ANSWERS` table
     * below declares `outcomes` an answer field. Neither noticed `says` + `outcomes` on one
     * slot. So ruling an open `refuses` with *"Recording what a kid spent is never refused;
     * every amount a parent types is recorded"* printed `✓ ruled … and wrote it into the slot`,
     * `check` reported nothing, and the packet shipped that sentence directly above the two
     * refusals it denies.
     *
     * A refusal is "named, never a code" — which is why a RULE filling `refuses` with prose is
     * a parse refusal. The same floor belongs one grain down: name the cases, or say `none`.
     */
    for (const [slot, fill] of Object.entries(e.slots)) {
      if (slot !== "refuses" || !fill?.says) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots", slot, "says"],
        message:
          "a refusal is named, never described — list the cases in `outcomes`, each with `when` and what the asker is `told`, or say `none: true` if there is genuinely nothing to refuse",
      });
    }
    const ANSWERS: Array<{ field: "none" | "cannot_fail" | "outcomes"; slots: SlotName[]; means: string }> = [
      /**
       * ⛔ `none` MEANS SOMETHING DIFFERENT ON EACH SLOT, AND BOTH MEANINGS ARE REAL ANSWERS.
       *
       * On `refuses`: there is nothing to refuse. On `after`: nothing is different afterwards —
       * which is the honest answer for every exchange that only reads, and the model must accept
       * it or an author will invent a state change to fill the cell.
       */
      /**
       * ⛔ `again` TOO, BECAUSE THE INSTRUCTIONS ALREADY SAID SO AND THE SCHEMA REFUSED IT.
       *
       * The scoper role shows `again: none: true` as the way to write "asked twice, nothing
       * further happens" — and `none` was keyed to `refuses` and `after` only, so following the
       * instructions produced truth that would not load. Reported as fg-0011.
       *
       * It is also plainly the same fact: "nothing is different afterwards" and "nothing further
       * happens on a second press" are the same shape of answer, and a slot that can only say it
       * by writing a sentence says it in prose where every other slot says it in a field.
       */
      {
        field: "none",
        slots: ["refuses", "after", "again"],
        means: "there is nothing to refuse, nothing is different afterwards, or nothing further happens on a second press",
      },
      { field: "cannot_fail", slots: ["fails"], means: "it cannot fail" },
      { field: "outcomes", slots: ["refuses"], means: "the named ways it refuses" },
    ];
    for (const [slot, fill] of Object.entries(e.slots)) {
      if (!fill) continue;
      /**
       * ⛔ A NAMED REFUSAL IS THE ADDRESS A RULING IS DELIVERED TO.
       *
       * Two outcomes called `not-positive` in one slot gave: `check` reporting
       * `…#refuses#not-positive outcome-open`, `decide` printing the `rule` and `defer`
       * commands for it, both returning *"nothing to rule on — this is already settled"*
       * (because resolution finds the first match), and `accept` refusing the exchange for
       * the unruled case. Four commands, a closed circle, exit 0 throughout — the exact bug
       * `ref.ts` exists to have fixed.
       */
      const names = new Set<string>();
      for (const o of fill.outcomes ?? []) {
        if (names.has(o.name))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slots", slot, "outcomes"],
            message: `two cases are called "${o.name}" — that name is how a ruling reaches one of them, so only the first is addressable and the other can never be settled`,
          });
        names.add(o.name);
      }
      for (const { field, slots, means } of ANSWERS) {
        const v = fill[field];
        if (v === undefined || v === false || (Array.isArray(v) && v.length === 0)) continue;
        if (slots.includes(slot as SlotName)) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", slot, field],
          message: `"${field}" says ${means}, which only answers \`${slots.join("` or `")}\` — on \`${slot}\` it reads as settled while saying nothing about ${SLOT_ASKS[slot as SlotName]}`,
        });
      }
    }
    /* ⛔ The "criterion demonstrates a slot this exchange does not fill" guard MOVED TO
     * `check.ts`, because from here it cannot see resolved rules and so refused the honest
     * thing.
     *
     * `record-earning` inherits `fails` from an org-wide rule. Adding a criterion showing how
     * that lands here was refused — and being a parse error it took the whole file down,
     * dropping the corpus from five exchanges to one. The only legal route was to restate the
     * slot locally, which then demands `instead_of`, a formal declaration that the rule does
     * NOT govern. So agreeing with a rule and overriding it produced the identical record.
     *
     * In `check` the inherited map is in scope, so the guard can ask the real question: does
     * anything answer this slot, locally or by rule? */
  });
export type Exchange = z.infer<typeof Exchange>;

// ---------------------------------------------------------------------------
// View — where an ask arrives. Never what states it.

/**
 * ⛔ FIVE ROLES, BECAUSE "control" WAS THREE DIFFERENT THINGS AND THE COST LANDED ON THE
 * REVIEWER.
 *
 * With one `control` role, a text input, a Cancel link and a Record button were the same
 * kind of thing. Two consequences, both bad, and both showed up the first time a real
 * screen was written:
 *
 *  - `check` demanded an exchange for every input field and every Cancel link — twelve
 *    notes on one small scope, none of which a person should ever be asked about. A queue
 *    that long is not worked, and the two real findings in it were buried.
 *  - a rule selecting `part_role: control` to mean "things you press and wait for" also
 *    selected the amount field, so "show that it is working" governed a text box.
 *
 * `commits` is the load-bearing one: it means pressing this starts work the person waits
 * for. That is the class org-wide rules about in-flight work, double-presses and failure
 * actually talk about, and nothing else on a screen belongs in it.
 */
export const PartRole = z.enum([
  /**
   * Pressing it starts work the person waits on.
   *
   * ⛔ THIS SAID "the only role that owes an exchange", AND THAT WAS FALSE — with nothing checking
   * it either way, so it misled without ever failing.
   *
   * The seed's own "somebody looks at what a kid has" arrives at a `display` part and meaningfully
   * fills all eight slots: it refuses (a kid looking at another kid's money), it fails (the history
   * cannot be loaded), and it is idempotent on a repeat. Looking IS an ask; it is simply triggered
   * by arriving rather than by pressing.
   *
   * What is true is narrower, and it is `exchange-arrives-at-a-part-that-owns-nothing` in `check`:
   * an ask may arrive at a `commits` control or at something shown, and never at `entry` or
   * `navigates` — those two are fully described elsewhere, and an exchange on them asks a person
   * what a text box refuses.
   */
  "commits",
  /** Takes what the person types or picks. What it accepts belongs to the `with` slot of
   *  whatever `commits` reads it — not to an exchange of its own. */
  "entry",
  /** Goes somewhere else and changes nothing. `leads_to` is its whole behaviour. */
  "navigates",
  /** Shows something. */
  "display",
  /** Groups other parts. */
  "region",
]);

/**
 * What a part can be doing, as opposed to what the screen is doing.
 *
 * ⛔ A STATE BELONGS TO A PART. Peter: *"we need to have STATES on a screen, rich enough to describe
 * VARIOUS TYPES OF ERRORS, LOADING STATES, etc. multiple buttons could have LOADING States.
 * MULTIPLE FIELDS COULD HAVE ERROR STATES."*
 *
 * ⛔ AND THE MEASUREMENT IS WHY, not the preference. `create-deal-form` holds its error state as a
 * complete second copy of the screen: 3,244 bytes, **96% byte-identical to the default frame**,
 * differing in 129 bytes — one red line under one field. One form costs 19,723 bytes across five
 * pictures.
 *
 * Storing a state as a whole picture makes exactly what he asked for impossible. Two fields in
 * error is a third picture; two fields plus a working button is a fourth; and loading never arrives
 * at all, because it is not a branch in a render tree that anything can harvest. A condition on a
 * part composes — four conditions on one picture is still one picture.
 *
 * ⛔ THE ROLE DECIDES WHICH OF THESE ARE EVEN POSSIBLE, which is why this is not one flat list a
 * reader has to interpret. A button is never `empty`; a text box is never `loading`. The constraint
 * is in `Part` below, so a corpus cannot say a thing no screen can do.
 */
export const PartStateKind = z.enum([
  /** It is doing the work that was asked of it, and the person is waiting. `commits` only. */
  "busy",
  /** It cannot be used right now. Any role that can be used at all. */
  "disabled",
  /** What it holds is not acceptable, and it says so. `entry` only — see `says`. */
  "invalid",
  /** What goes in it has not arrived yet. Shown things, never controls. */
  "loading",
  /** It arrived and there is nothing in it. ⛔ Not the same as `loading`, and not the same as a failure. */
  "empty",
  /** It could not get what it shows, which is a different sentence from having nothing. */
  "failed",
]);
export type PartStateKind = z.infer<typeof PartStateKind>;

/**
 * ⛔ WHICH KINDS EACH ROLE MAY BE IN. Exported so `check`, `draw` and the page all ask one table —
 * three copies of this would disagree within a month, which is the defect `SLOT_ASKS` already has
 * a comment about.
 */
export const STATES_FOR_ROLE: Record<z.infer<typeof PartRole>, PartStateKind[]> = {
  commits: ["busy", "disabled"],
  entry: ["invalid", "disabled"],
  navigates: ["disabled"],
  display: ["loading", "empty", "failed"],
  region: ["loading", "empty", "failed"],
};

/**
 * ⛔ THE SIX ABOVE ARE NOT THE LIST. THEY ARE THE PART OF IT EVERY PRODUCT HAS.
 *
 * Peter: *"Loading/busy shouldn't be hard coded. We should support lots of different states, right?
 * And it can change anything on screen"*. Both halves are right, and a closed enum of six would be
 * wrong for somebody inside a week — `locked`, `syncing`, `stale`, `over quota`, `pending approval`
 * are real conditions no vocabulary we write here could have anticipated.
 *
 * ⛔ BUT OPEN IS NOT THE SAME AS FREE TEXT, and free text would quietly cost three things the closed
 * set was buying:
 *
 *   1. The role constraint. "A button is never `empty`" is only checkable against a known word.
 *   2. The cross-screen question — *does every field that can be invalid appear invalid in some
 *      state?* — which needs comparable names. As free text, `invalid`, `error` and `bad` are three
 *      unrelated conditions and the question cannot be asked at all.
 *   3. One appearance. `invalid` looking the same on every screen is the whole gain over a
 *      per-state screenshot, where it looked like whatever that component happened to render.
 *
 * So a condition is a word, and a word a product uses it must DECLARE — which is what `terms`
 * already does on a scope, with `means` and the option of `members`. The six built-in ones are
 * declared here instead, because every product has them and asking each corpus to define `loading`
 * would be a chore with one right answer.
 *
 * ⛔ THE HONEST COST, SAID RATHER THAN HIDDEN: a declared condition cannot be role-checked, because
 * nothing here knows whether `syncing` belongs on a button or a region. `check` reports an undeclared
 * one; it cannot report a misplaced one. That is the price of the openness and it is worth paying.
 */
export const PartCondition = z.string().min(2).regex(/^[a-z][a-z0-9-]*$/, "a condition is one lower-case word, kebab-case — it is a word a product declares, not a sentence");
export type PartCondition = z.infer<typeof PartCondition>;

/** ⛔ The built-in conditions, as the same shape a declared one has. One table, so `check`, `draw`
 *  and the page agree about what `loading` means without three copies of the sentence. */
export const BUILT_IN_CONDITIONS: Record<PartStateKind, string> = {
  busy: "it is doing the work that was asked of it, and the person is waiting",
  disabled: "it cannot be used right now",
  invalid: "what it holds is not acceptable, and it says so",
  loading: "what goes in it has not arrived yet",
  empty: "it arrived and there is nothing in it",
  failed: "it could not get what it shows, which is a different sentence from having nothing",
};

export const isBuiltInCondition = (c: string): c is PartStateKind =>
  Object.prototype.hasOwnProperty.call(BUILT_IN_CONDITIONS, c);

export const PartState = z
  .object({
    /**
     * ⛔ A WORD, NOT AN ENUM. One of the six built-ins, or a condition this product declared in its
     * scope's `terms`. `check` refuses one that is neither, so a typo is still caught — openness
     * costs the role check, not the spell check.
     */
    kind: PartCondition,
    /**
     * What the person is told while it is in this condition.
     *
     * ⛔ REQUIRED ON ANYTHING THAT REPORTS A PROBLEM, because an error nobody can read is not a
     * state anybody can review — "the borrower field is invalid" is not reviewable, "Borrower is
     * required" is. Enforced below rather than hoped for.
     */
    says: z.string().min(3).optional(),
    /**
     * The condition in the code that produces it, where there is code.
     *
     * ⛔ OPTIONAL, AND THAT IS THE WHOLE POINT. The old shape required a code condition, so a screen
     * the product SHOULD have could not say it has a loading state until somebody wrote the
     * component — which contradicts the rule this project is most insistent about: *"product truth
     * is supposed to represent the target state always, doesn't matter what's been built."* Where
     * code exists this is kept verbatim so the two can be compared; where it does not, its absence
     * is not a gap in the target.
     */
    when: z.string().optional(),
  })
  .strict();
export type PartState = z.infer<typeof PartState>;

export const Part = z
  .object({
    id: z.string(),
    role: PartRole,
    label: z.string().optional(),
    /**
     * ⛔ ONE CONTROL THAT APPEARS ONCE PER SOMETHING — what it repeats over (fg-0009).
     *
     * A part is one control and an exchange arrives at one part, so five sortable column headings
     * on one table — all doing the same thing, each its own element with its own words — could only
     * be declared as a single part. Its `label` then had to be **one column's** words for the
     * drawing's wiring to bind it, so the part read as being about that column and the behaviour
     * read as being about one heading. The pager's two chevrons are the same shape: one ask, two
     * controls.
     *
     * Reported by a scoper that hit it on a real table, not theorised.
     *
     * ⛔ WHAT IT VARIES OVER, NOT A COUNT. "once per sortable column" is checkable against the
     * screen and tells a builder what to render; `repeats: true` or `count: 5` says neither, and a
     * number goes stale the moment a column is added. With this set, `label` is free to be the
     * generic words — "a column heading" — because the specific words are no longer load-bearing
     * for identifying the control.
     */
    repeats: z.string().min(5).optional(),
    leads_to: z.string().optional(),
    /**
     * The conditions this part can be in. ⛔ Empty means nobody has said — never means it has none.
     */
    states: z.array(PartState).default([]),
    /**
     * ⛔ GOES BACK TO THIS SCREEN AS IT WAS — the destination that had nowhere to live.
     *
     * Peter, one press into the create-a-deal folder step: *"it dead ends. no way to complete
     * setup, can't go back?"*. Back is a real control with a real destination, and the model could
     * not hold it: `navigates` demands a `leads_to` naming another SCREEN, and `commits` says the
     * destination is the answer slot — which cannot name a state either. So Back was filed as
     * `commits`, which is false (it commits nothing) and drove nowhere.
     *
     * ⛔ A BOOLEAN, NOT A STATE REFERENCE, AND THAT IS THE POINT. A screen's states are GENERATED
     * from a component; their labels change when the code changes, so truth pointing at one would
     * be truth that rots on somebody else's edit. "The screen as it was" is the one destination
     * that is stable whatever the drawing does, and it is the overwhelmingly common case — Back,
     * Cancel, Close, Choose a different one.
     *
     * ⛔ THE REST OF THE GAP STAYS OPEN, and is recorded as one: this still cannot say "returns you
     * to the second of four steps". Closing the common case is not closing the hole, and the next
     * person to need the other half should find the gap rather than this field and a shrug.
     */
    returns: z.boolean().optional(),
    decorative: z.boolean().optional(),
  }).strict()
  .superRefine((p, ctx) => {
    if (p.role === "navigates" && !p.leads_to && !p.returns && !p.decorative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leads_to"],
        message: `"${p.label ?? p.id}" navigates and says nowhere — a reader cannot follow it and an engineer will guess. Where it goes back to this screen as it was, say \`returns: true\``,
      });
    }
    /** ⛔ Both is two answers to one question, and a reader cannot tell which the product does. */
    if (p.returns && p.leads_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returns"],
        message: `"${p.label ?? p.id}" both returns to this screen and leads somewhere else — it does one or the other`,
      });
    }
    if (p.returns && p.role !== "navigates") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returns"],
        message: `"${p.label ?? p.id}" returns somebody to this screen without changing anything, which is what \`navigates\` is`,
      });
    }
    if (p.role === "commits" && p.leads_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leads_to"],
        message: `"${p.label ?? p.id}" commits work — where it lands afterwards is part of the answer slot, not a link`,
      });
    }

    /**
     * ⛔ THE ROLE ALREADY SAYS WHICH CONDITIONS ARE POSSIBLE, so this is a constraint rather than a
     * convention. A button that claims to be `loading` is somebody describing a spinner where the
     * product has a working button, and the two are drawn differently and reviewed differently.
     */
    const allowed = STATES_FOR_ROLE[p.role];
    for (const st of p.states ?? []) {
      /**
       * ⛔ ONLY THE BUILT-INS CAN BE ROLE-CHECKED, AND THAT IS THE PRICE OF AN OPEN VOCABULARY.
       *
       * Nothing here knows whether `syncing` belongs on a button or a region, so refusing an
       * unrecognised word would mean refusing every condition a product declares for itself — the
       * exact thing Peter asked for when he said loading and busy should not be hard coded. What
       * survives is the check on the six words whose meaning this file does own.
       */
      if (!isBuiltInCondition(st.kind)) continue;
      if (!allowed.includes(st.kind)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states"],
          message: `"${p.label ?? p.id}" ${p.role === "commits" || p.role === "entry" || p.role === "navigates" ? "is a control" : "is shown"}, so it cannot be "${st.kind}" — it can be: ${allowed.join(", ") || "nothing"}`,
        });
      }

      /**
       * ⛔ AN ERROR THAT DOES NOT SAY ANYTHING IS NOT REVIEWABLE. "the borrower field is invalid"
       * tells a reader nothing they can disagree with; "Borrower is required" is a product
       * decision somebody can accept or reword. The same is true of a failure.
       */
      if ((st.kind === "invalid" || st.kind === "failed") && !st.says) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states"],
          message: `"${p.label ?? p.id}" can be ${st.kind} and does not say what the person is told — write it in \`says\`, because a reader cannot agree with a condition whose words are missing`,
        });
      }
    }

    /** ⛔ One condition per kind, or two sentences claim the same moment and nothing says which. */
    const kinds = (p.states ?? []).map((s) => s.kind);
    for (const k of new Set(kinds)) {
      if (kinds.filter((x) => x === k).length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states"],
          message: `"${p.label ?? p.id}" declares "${k}" twice — one condition, one description, or a reader cannot tell which applies`,
        });
      }
    }
  });

export type Part = z.infer<typeof Part>;


/**
 * ⛔ THE HAPPY PATH — WHAT THE FEATURE IS FOR, AGREED BEFORE ANY DETAIL OF IT.
 *
 * Peter: "we should highlight 'Happy path' for each feature. this describes the 'meat' of the
 * feature — what should be accomplished in the happy path, input, desired output, and with screens
 * that describes this flow. the behaviors get into the 'details'. but we need to make sure the
 * context is correct before the behaviors get validated — because that could change."
 *
 * The model had nothing at this altitude. A feature was a title, a paragraph of prose nobody had to
 * read, and then eight slots per ask — so the first thing a reviewer was handed was
 * *"the stage filter offers the stages of the CRE funnel that this organization uses"*, with no
 * agreed statement anywhere of what the screen is for. Every one of those judgements rests on a
 * context that was never stated, let alone agreed.
 *
 * ⛔ AND IT GATES. Agreeing to a detail of a purpose nobody has confirmed is the expensive kind of
 * wasted review: if the purpose turns out wrong, every stamp underneath it was spent on a sentence
 * that is about to change. So the behaviours of a feature are not offered for acceptance until its
 * happy path has been — which is the same gate the eight slots already have, one level up.
 *
 * ⛔ IT IS NOT A NINTH SLOT. A slot answers one question about one ask. This answers "what is this
 * feature FOR", which is a question about the feature, and folding it into a slot would make it
 * agreeable at the same grain as the details it is supposed to frame.
 */
/**
 * ⛔ THE FRAMING A PRD HAS AND PRODUCT TRUTH DID NOT.
 *
 * Peter, after reviewing create-deal against what a PRD carries: *"let's add tabs here - 'why',
 * 'success measures', 'risks' can all be cards that are added in the 'overview' tab.
 * instrumentation should be added as well. success measures and instrumentation should be in a
 * 'Metrics' tab."*
 *
 * The functional half was already stronger than most PRDs — forty-eight specified behaviours for
 * create-deal, including what happens when it is pressed twice and when two people do it at once,
 * which teams usually discover in production. What the model had nowhere for was everything around
 * it: why the feature is worth building, how anybody would know it worked, what could go wrong, and
 * what gets recorded. `Scope` had eleven fields and not one of them could hold any of it.
 *
 * ⛔ EACH IS A LIST OF CARDS, NOT A PARAGRAPH, for the same reason a charter has sections rather
 * than prose: one risk is agreed to, reworded or dropped on its own. A paragraph holding four risks
 * takes one stamp for four claims, which is the grain error this model has corrected twice.
 */
export const Reason = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a reason id is one segment, kebab-case"),
    /** ⛔ What is wrong TODAY. "Users want X" is a restatement of the feature, not a reason for it. */
    says: z.string().min(20, "say what is wrong today — a sentence that only restates the feature is not a reason for it"),
  })
  .strict();
export type Reason = z.infer<typeof Reason>;

export const Risk = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a risk id is one segment, kebab-case"),
    says: z.string().min(20, "say what could go wrong, in terms somebody could later agree had happened"),
    /**
     * ⛔ WHAT WOULD BE DONE, where anything would. Absent is meaningful and left absent on purpose:
     * a risk nobody has a plan for is a real state, and forcing a mitigation would produce a
     * sentence invented to fill a field.
     */
    mitigated_by: z.string().min(10).optional(),
  })
  .strict();
export type Risk = z.infer<typeof Risk>;

export const Measure = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a measure id is one segment, kebab-case"),
    says: z.string().min(15, "say what would be true if this worked, in something somebody could observe"),
    /**
     * ⛔ A NUMBER WHERE THERE IS ONE, and optional because an early feature often has no defensible
     * target and inventing one is worse than admitting it. `check` reports a measure with no target
     * rather than the schema refusing it.
     */
    target: z.string().optional(),
  })
  .strict();
export type Measure = z.infer<typeof Measure>;

export const Instrument = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "an instrument id is one segment, kebab-case"),
    /** What gets recorded, in product terms — not a column name or an event schema. */
    says: z.string().min(15, "say what gets recorded, in terms a reader of this product would use"),
    /**
     * ⛔ WHICH MEASURES THIS FEEDS, AND THIS IS THE LOAD-BEARING FIELD.
     *
     * A measure nothing feeds cannot be known, and an instrument feeding nothing is telemetry
     * somebody will maintain for nobody. Both are invisible when the two live in separate lists,
     * and both are exactly the shape of `nothing-reads-what-this-sets` — which already exists in
     * this model because the same mistake happened with terms.
     */
    feeds: z.array(z.string()).default([]),
  })
  .strict();
export type Instrument = z.infer<typeof Instrument>;

export const HappyPath = z
  .object({
    /** What the person gets done. The reason the feature exists, in one sentence. */
    accomplishes: z.string().min(20, "say what gets done here — a few words is a label, not a purpose"),
    /**
     * What they arrive with — ⛔ IN GENERAL, NEVER THE FIELDS OF THE FORM.
     *
     * Peter, reading a purpose card: *"this includes details that may change - 'arrives with'. I
     * think this 'what this feature is for' card should be more generic. generally what comes with
     * it."*
     *
     * It said *"a name for the deal, the borrower, and the property's address"* — which is the
     * entry form, listed. Three problems, all the same problem: the fields are already the view's
     * parts, so this is a second copy; adding a field to the form silently makes it wrong; and the
     * purpose is the thing a reviewer agrees to FIRST, so it was gated behind agreeing to a
     * sentence that enumerates details not yet settled.
     *
     * *"the deal they want to create and where its model should live"* survives a new field. That
     * is the altitude: what a person turns up holding, not the shape of the control they type it
     * into. `productos v2 check` reports a `brings` that names the parts.
     */
    brings: z.string().min(3, "say what the person arrives with, or `nothing` if they arrive empty-handed"),
    /** What they leave with. ⛔ The desired OUTPUT, which is what makes the path checkable. */
    ends_with: z.string().min(10, "say what they leave with — a path with no stated outcome cannot be judged right or wrong"),
    /**
     * The screens, in the order they are met.
     *
     * ⛔ ORDERED, AND THAT IS THE POINT. A set of screens is a list; a sequence is a flow, and a
     * flow is the thing a reviewer can say is wrong before a single detail is argued.
     */
    through: z.array(z.string()).default([]),
    /** What is deliberately NOT part of the happy path, where somebody would otherwise assume it is. */
    not: z.string().optional(),
  })
  .strict();
export type HappyPath = z.infer<typeof HappyPath>;

/**
 * One appearance of a screen: a label, the condition that produces it, and what is different
 * about each part while it holds.
 *
 * ⛔ NAMED, AND THAT IS THE POINT. It was an anonymous object inside `View.states`, which made
 * every field on it invisible to `framework-not-just-output` — that test walks a list of named
 * shapes one level deep, so for `View` it checked that `states:` was documented and never
 * descended. `holds` was therefore defined, consumed by `states.ts`, rendered on the page, and
 * named in no authoring instruction anywhere: 43 states across the bilrost corpus carry a whole
 * picture and not one of them declares it.
 *
 * That is the exact escape the test's own header describes for `Steer`, `Note` and `Access` —
 * 'absent from this list, so the mechanism meant to notice could not see it' — reached a second
 * way, through a shape that had no name to put in the list.
 */
export const ViewState = z
  .object({
    when: z.string().optional().describe("the condition in the code that produces this state, where there is code"),
    label: z.string().min(2),
    /**
     * ⛔ NO LONGER REQUIRED, AND THE MEASUREMENT IS WHY. `create-deal-form`'s error state is
     * 3,244 bytes and **96% byte-identical to the default frame** — 129 bytes of difference,
     * one red line under one field — stored as a complete second copy of the screen. One form
     * costs 19,723 bytes across five pictures.
     *
     * A state whose picture is the whole screen cannot compose: two fields in error is a
     * third picture, two fields plus a working button a fourth, and loading never arrives at
     * all because it is not a render branch anything can harvest.
     *
     * ⛔ KEPT, NOT DELETED, because a state that genuinely IS a different arrangement still
     * needs one — and every corpus in existence has these. Where `holds` is given, the
     * picture is composed from the screen's own drawing instead.
     */
    sketch_html: z.string().min(1).optional(),
    /**
     * What is different about each part while this state holds.
     *
     * ⛔ THIS IS THE STATE. One picture, a set of changes applied to it — so "the borrower
     * field is invalid AND the Continue button is working" is one state rather than a
     * screenshot nobody generated.
     *
     * ⛔ AND A STATE CHANGES ANYTHING, NOT ONLY A CONDITION. Peter: *"it can change anything
     * on screen"*. The first cut could only say "this part is in that condition", so a
     * loading state that also hides the toolbar, or an error state that swaps the heading,
     * had nowhere to go — and the only way to express it was the whole second screenshot this
     * work exists to remove.
     *
     * A bare word is the common case and stays short:
     *
     *     holds: { borrower: invalid, continue: busy }
     *
     * and the long form says the rest:
     *
     *     holds:
     *       borrower: { in: invalid, says: "Borrower is required." }
     *       toolbar:  { hidden: true }
     *       heading:  { says: "Checking the folder…" }
     */
    holds: z
      .record(
        z.string(),
        z.union([
          PartCondition,
          z
            .object({
              /** The condition it is in, if any. */
              in: PartCondition.optional(),
              /** ⛔ Not on the screen at all in this state — which is not the same as disabled. */
              hidden: z.boolean().optional(),
              /**
               * Different words here, in this state only.
               *
               * ⛔ OVERRIDES THE PART'S OWN `says` RATHER THAN COMPETING WITH IT. A field's
               * `invalid` message is usually one sentence wherever it appears, which is why it
               * lives on the part; a state that needs different words is the exception and has
               * to be able to say so in one place rather than by declaring a second condition.
               */
              says: z.string().min(1).optional(),
            })
            .strict()
            .refine((h) => h.in || h.hidden !== undefined || h.says, {
              message: "this says nothing is different about the part — give it `in`, `hidden` or `says`",
            }),
        ]),
      )
      .default({}),
  })
  .strict()
  .superRefine((st, ctx) => {
    /**
     * ⛔ A STATE WITH NEITHER A PICTURE NOR ANY CONDITIONS IS A LABEL. Nobody can look at it
     * and nobody can tell what it claims, which is the same defect as a screen with no
     * drawing one level down.
     */
    if (!st.sketch_html && !Object.keys(st.holds ?? {}).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["holds"],
        message: `"${st.label}" is a state with no picture and no conditions — say which parts are in which condition, or there is nothing here to review`,
      });
    }
  })

export const View = z.object({
  id: z.string(),
  title: z.string(),
  /**
   * Which combination of the product's dimensions this screen is for. Absent means every one.
   *
   * ⛔ Peter: *"we need dimensions to carry through to all features, so we can have different
   * variations PER feature"*. Two screens in one feature may do the same job and differ only by who
   * is looking at it; this is how they say so, without one of them having to be renamed after the
   * audience it serves.
   */
  holds_for: z.record(z.string().min(1)).optional(),
  view_kind: z.string().optional().describe("form · list · detail · modal · strip — selectable by a Rule"),
  exists: z.enum(["intended", "kept", "withdrawn"]).optional(),
  /* ⛔ `runtime` REMOVED. Read by nothing, and what it meant was never written down. */
  drawn_screen: z
    .string()
    .optional()
    .describe(
      "Which of a set of mutually exclusive screens one component renders this view IS — the arm the draw matched"
    ),
  sketch: z.string().optional(),
  sketch_html: z.string().optional(),
  /**
   * Which of this scope's sentences this drawing actually shows, as `<exchange>#<slot>` or
   * `<exchange>#<slot>#<statement>`.
   *
   * ⛔ WITHOUT THIS, A THIN DRAWING IS INDISTINGUISHABLE FROM A COMPLETE ONE.
   *
   * Peter: "screens overall are very thin." He was right, and nothing in the model could have told
   * him so — or told me. The deals list asserts that an unsized deal shows a dash rather than a
   * zero, that a load failure is reported above the table with the previous page kept, and that a
   * filtered list matching nothing says so. The drawing had three fully-sized rows and none of it,
   * and every check passed: a screen either has a drawing or it does not, and this one did.
   *
   * So a drawing says what it demonstrates, and `check` reports the sentences anchored at a screen
   * that the screen does not claim to show. A mock drawn from the happy path alone now fails to
   * claim eight of eleven things and says so out loud.
   *
   * ⛔ IT IS A CLAIM, NOT A PROOF. Listing a ref here says the author drew that state; nobody can
   * verify from the markup that the dash is really in it. What closes that gap is the `rendered`
   * reviewer, which looks at the product beside the drawing — not a boolean somebody ticks.
   */
  shows: z.array(z.string()).default([]),
  /**
   * The screen this one appears INSIDE, as `<view>` in the same scope or `<scope>#<view>`.
   *
   * ⛔ WITHOUT THIS A PRODUCT IS A PILE OF SCREENS, NOT A PRODUCT.
   *
   * Peter: *"we should be able to know the true navigation, leverage screens within screens, like
   * really a walkable single prototype that can link out to the different areas"*.
   *
   * The corpus already knows two kinds of relation and neither one is containment: scopes nest, so
   * it knows a screen belongs to a FEATURE; and `connect` infers that a control LEADS somewhere
   * from what the words say. A deal workspace declares five views — a shell and four tabs — and the
   * model could say only that the five are siblings in one feature. Nothing recorded that four of
   * them are shown inside the first, which is the plainest fact about that screen and the one a
   * person uses to find their way.
   *
   * It matters most where inference is weakest. On the corpus this was built against, `connect`
   * found four links across twenty-two screens: eighteen screens with no way in or out, because
   * most controls genuinely do not navigate — they act on the screen they are on, or they switch a
   * tab, and switching a tab is containment rather than a link. A map drawn from links alone said
   * the product was in pieces. It is not; the truth simply had nowhere to say so.
   *
   * ⛔ IT IS WHERE A SCREEN APPEARS, NOT WHAT IT IS ABOUT. `within` is a sibling of `drawn_from`,
   * not of the scope tree: a screen can be filed under one feature and appear inside a screen owned
   * by another, and that is a normal product, not a mistake. Resolution and the refusal to point at
   * nothing live in `check`.
   */
  within: z.string().optional(),
  /**
   * The component this drawing was generated from, and the commit it was generated at.
   *
   * ⛔ THE GENERATOR KNEW BOTH AND THREW THEM AWAY, which is why nothing could tell that a screen
   * had moved on. A corpus recorded no ref at all: it could not say which commit its truth was
   * written against, so it could not say the code had changed since — and a whole feature
   * describing a screen somebody had deleted that morning was invisible until two people read the
   * source by hand.
   *
   * With these, `productos v2 moved` walks the history between then and now for exactly the files
   * this screen is about, and reports what the commits SAY. That is the part a diff cannot give:
   * the commit that deleted the pricing grid quoted the operator — "Computed work and editable
   * cells all need to be ripped out" — and said "this deletes rather than builds". A product
   * decision, in its author's words, that the corpus had not heard about.
   */
  drawn_from: z.string().optional(),
  drawn_at: z.string().optional(),
  /**
   * ⛔ A SCREEN IS NOT ONE PICTURE. Peter: *"a clickable screenshot at the top of this deals list
   * screen that walks through the various states"* and *"the framework should be able to generate
   * these on a per feature basis"*.
   *
   * Loading, empty, error and full are the same screen in different conditions, and a corpus that
   * held only one of them made every statement about the others unjudgeable — "a deal that has not
   * been sized shows a dash" cannot be checked against a picture that has no such deal.
   *
   * ⛔ GENERATED, NEVER TYPED: `when` is the condition in the code, kept verbatim so a reader can
   * check the label against it, and the drawing is redrawn by `draw` whenever the component moves.
   */
  states: z.array(ViewState).default([]),
  /**
   * ⛔ `walked` WAS HERE AND IS GONE. Peter: *"how do we 'walk a screen' so that this never shows?
   * i'm confused — should users be confirming every screen?"* — and, asked which way to take it,
   * chose to drop it.
   *
   * It meant "a person confirmed this picture shows what the screen claims", and it was a human
   * validation with nothing of the machinery every other one here has: no actor, no time, no `via`,
   * nothing stopping a script setting it. A stamp that asserts somebody agreed, which anybody can
   * write, is worse than no stamp — it reads as a guarantee and is not one.
   *
   * What it was reaching for is already covered: a drawing is generated from the component or from
   * the truth, `a-drawing-does-not-show-what-the-screen-states` reports where the picture does not
   * claim what the screen says, and `rendered` now LOOKS at the product beside it. A chore on top
   * of those added no guarantee.
   */
  parts: z.array(Part).default([]),
}).strict();
export type View = z.infer<typeof View>;

// ---------------------------------------------------------------------------
// Rule — a sentence whose subject is a class of exchanges rather than one.

/**
 * ⛔ A CLOSED SELECTOR LANGUAGE, AND CLOSED IS THE FEATURE. Eight ANDed dimensions, no
 * union, no negation, no expressions. The moment a selector can express anything it becomes
 * a query language nobody can invert — and `check` has to invert it to report a rule that
 * governs nothing, which is the precise failure of a v1 "principle" that carried no
 * criteria and reached nothing.
 */
export const Selector = z.object({
  everywhere: z.boolean().optional(),
  under: z.string().optional(),
  asked_by: AskedBy.optional(),
  tag: z.string().optional(),
  view_kind: z.string().optional(),
  part_role: PartRole.optional(),
  term: z.string().optional(),
  /**
   * ⛔ READS VERSUS WRITES, AND ITS ABSENCE WAS MANUFACTURING FALSE PROMISES.
   *
   * `term:` matched `reads` and `changes` alike, so a rule about changing money also
   * governed looking at it. Three consequences, all found in the shipped corpus:
   *
   *  - "Doing the same thing a second time … records it once and tells the person it is
   *    already done" was supplied as the `again` of *looking at a balance*.
   *  - "the person is told it was not recorded, nothing has changed" was supplied as the
   *    `fails` of a pure read, where nothing was being recorded.
   *  - the authorization rule had to be widened into a second clause about reading, purely
   *    so it would be true where it was forced to apply. The author could not write the
   *    sentence they meant — only one that survived being applied where they did not mean it.
   *
   * The data to tell them apart was already on the exchange. Nothing looked at it.
   */
  acts_on: z.enum(["reads", "changes"]).optional(),
  /** ⛔ Flagged past a small threshold: a hand-typed list of twenty ids is
   *  copy-onto-every-feature wearing a selector's clothes. */
  /**
   * Named exchanges, qualified.
   *
   * ⛔ ONE GRAMMAR, AND IT NO LONGER SATISFIES THE REACH REFINEMENTS.
   *
   * A bare entry was read as an exchange id by `load.ts` and as a scope id by `check.ts`, so
   * one run contradicted itself: `selects-nothing-that-exists / names "record-earning", which
   * is not a scope or an exchange here` beside `two-rules-answer-this / handpicked and
   * only-a-parent-moves-money all supply this slot`.
   *
   * Worse, `only:` satisfied both reach refinements, so a rule with no `in:`, no `under:`, no
   * `everywhere:` and no `asked_by:` reached into a disconnected root product and supplied
   * `may` on a school tuck shop volunteer's ask. That is exactly the leak `Rule.in` exists to
   * close, and `only:` was the hole in the fix.
   */
  only: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9][a-z0-9_-]*#[a-z0-9][a-z0-9_-]*$/, "name it as <scope>#<exchange> — a bare id is read two different ways")
    )
    .optional(),
}).strict();
export type Selector = z.infer<typeof Selector>;

export const Rule = z
  .object({
    id: z.string().min(3),
    /** Absent only while the rule itself is an open question — see `standing` below. */
    statement: z.string().min(20).optional(),
    /**
     * ⛔ WHO TYPED THE ORG-WIDE SENTENCE — the highest-leverage claim in a corpus, so the one where
     * "software wrote this and nobody has looked" costs the most. One statement here reaches every
     * exchange its selector touches, including ones nobody has written yet, and `stampFor` lets a
     * confirmed rule stand at every slot it supplies. A rule inferred from a code path and never
     * read would borrow that reach for free.
     *
     * Absent falls through to nothing: a rule has no container. Unknown is then the honest answer.
     */
    wrote: Authorship.optional(),
    /**
     * ⛔ AN ORG-WIDE SENTENCE CAN BE UNDECIDED, AND IT WAS THE ONE QUESTION THE MODEL COULD
     * NOT HOLD.
     *
     * `Rule` was `.strict()` with a required statement, so writing an undecided one was a
     * parse refusal that took the whole corpus down. An author with a genuine class-wide
     * question had three options and all of them are bad: ask it on N exchanges (N reviewer
     * acts, guaranteed divergence, nothing notices), file it on one slot and let the rest
     * state their own answers, or invent a decided rule nobody decided.
     *
     * This is the highest-leverage question a corpus can contain — one ruling settles every
     * exchange the selector reaches, which is the exact thing `acts` sorts rules by. `open`
     * only: a rule cannot be *disputed* with something (a dispute is between two sentences,
     * and this one has none yet), and `out_of_scope` on a class is just not writing the rule.
     *
     * ⛔ While it stands open the rule governs NOTHING. It is a question about a class, not an
     * answer for one, so `resolveRules` skips it and every slot it would have filled reads as
     * the blank it actually is.
     */
    standing: Standing.optional(),
    /**
     * Which slot or slots this rule answers.
     *
     * ⛔ A SINGLE SLOT IS COHERENT FOR `supplies` AND A CATEGORY ERROR FOR `constrains` — and
     * the combehaviour is already written into this corpus.
     *
     * `supplies` answers one slot: one answer, one place. `constrains` "adds a requirement to
     * whatever the exchange says", and a real one lands on several — *"a control that starts
     * work shows that it is working, and says what failed"* is a requirement on `answer` AND
     * on `fails`. With one `fills`, the second half had to be filed on `slot: answer`, because
     * filing it honestly was refused outright. The rule's own criterion 2 reads
     * `given: work started at a control fails` under a slot that is not `fails`.
     *
     * So the schema forced an author to write something false, and then the criterion-slot
     * guard enforced the falsehood.
     */
    /**
     * ⛔ A LIST, ALWAYS. The scalar spelling was a permanent dead end.
     *
     * `settle.ts` reads `data.fills[0]` to know which slot a ruling's demonstration belongs
     * to. On the string `"answer"` that is `"a"`, so ruling an org-wide question written with
     * the scalar spelling failed with `criteria.0.slot — Invalid enum value … received 'a'` —
     * on the exact command `decide` had just printed. Two spellings for one field, and the
     * highest-leverage question a corpus can hold was unanswerable depending on which the
     * author happened to use.
     */
    fills: z.array(z.enum(SLOTS)).min(1),
    /**
     * Where this rule lives, and therefore which vocabulary its selector is written in.
     *
     * ⛔ REQUIRED WHENEVER THE SELECTOR NAMES A TERM, BECAUSE `term` WAS A GLOBAL STRING.
     *
     * A rule had no place in the container graph, so `scope: {term: money}` meant *any* scope
     * anywhere that declares a word spelled "money". A second product whose `money` means
     * "the face value left on a voucher" had its `may` supplied by *"Only a parent may change
     * what a kid has"* — zero findings, rendered `↑R6`, indistinguishable from legitimate
     * inheritance, and `may` was not blank so nothing else fired either.
     *
     * Meanwhile term LEGALITY was already resolved through `vocabularyReach`. Two identity
     * models for one word in one codebase, and the load-bearing one was the untyped one.
     */
    in: z.string().optional(),
    /** For `fills: refuses` — the named cases, shared by every exchange this reaches. */
    outcomes: z.array(RefusalOutcome).optional(),
    /**
     * ⛔ REQUIRED, NO DEFAULT, AND THE REASON IS THE WHOLE POINT OF RULES.
     *
     * `supplies` — the rule IS the answer where the exchange is silent. A locally stated
     * slot wins, because the narrower sentence is the more considered one.
     *
     * `constrains` — the rule adds a requirement to whatever the exchange says, and a
     * stated slot does NOT escape it.
     *
     * Collapsing these into one relationship makes the most valuable rules inert: "every
     * control shows work in flight" only `supplies` an answer to exchanges that forgot to
     * write one, which is close to none of them. The rule that survives the collapse is the
     * trivial kind; the rule you wanted org-wide is the kind that gets silently opted out of
     * by any author who filled the slot in — which is every competent author.
     *
     * No default, because guessing wrong is invisible in both directions: a `supplies` rule
     * read as `constrains` bolts an unrelated requirement onto stated answers, and a
     * `constrains` rule read as `supplies` governs nothing while still appearing in the
     * rule list as though it did.
     */
    /**
     * The roles or permissions this rule's `may` requires — ⛔ SIX AUTHORS FILED ITS ABSENCE.
     *
     * fg-0052, fg-0067, fg-0090, fg-0096, fg-0107 and fg-0114, independently, in one corpus. Every
     * one of them had done the RIGHT thing and been punished for it: the same authorization
     * sentence was about to go on four to eight exchanges, so they wrote it once as a rule — and
     * `held_by` lived only on a `SlotFill`, so the ids went into the rule's prose and those
     * exchanges became invisible to "what can this role reach".
     *
     * ⛔ AND THE FINDING WENT QUIET AT THE SAME TIME, which is why it kept happening.
     * `who-may-is-only-prose` fires on a slot whose `may` names nobody; a rule-supplied `may` is
     * not blank, so nothing complained. The recommended shape silently lost the enumerable answer
     * and nothing said so — one author's words: *"the recommended shape is the one that silently
     * loses the permission enumeration."*
     *
     * ⛔ THE SENTENCE IS STILL WHAT A PERSON AGREES TO. Same as on a slot: "nobody outside the
     * deal's own team, even an admin" is the part a human validates, and the ids are what make it
     * checkable and listable. This does not replace `statement`; it stands beside it.
     */
    held_by: z.array(z.string()).default([]),
    mode: z.enum(["supplies", "constrains"]),
    scope: Selector,
    criteria: z.array(Criterion).default([]),
    /* ⛔ `carryover` REMOVED. It was declared, defaulted to `keeps-acceptance`, read by
     * nothing — and the default was actively contradicted: accept an exchange, add any new
     * rule that reaches it, and `check` refuses with `acceptance-is-stale`. It requeues,
     * unconditionally, for everyone. A field that says the opposite of what happens is worse
     * than no field, because a reader plans around it.
     *
     * The behaviour it claimed to configure is the right one and is not configurable: a rule
     * arriving changes what an exchange states, so the person who accepted the old behaviour
     * has to see the new one. */
    why: z.string().optional(),
  }).strict()
  .superRefine((r, ctx) => {
    const undecided = r.standing && r.standing.kind !== "stated";
    /**
     * ⛔ THE THIRD GRAIN, which `refineStanding`'s own comment names by hand: *"Adding a third
     * grain — a standing on a `Rule` — would have repeated it a third time."* It did.
     *
     * `standing: {kind: stated, about: "whether a KID signed in on the shared device counts as
     * a parent when no adult is present"}` on the corpus's authorization rule — reaching two
     * exchanges that take money off children — was invisible to `check`, `decide`, `acts`,
     * `grid` and the packet, and the rule accepted cleanly.
     *
     * Worse than invisible: `coveredBy` hashes the whole rule, so the residual WAS in the
     * stamp. Editing it made `check` refuse `acceptance-is-stale` and the packet print
     * "⚠ accepted by alice, and CHANGED SINCE" — while the preview showed statement, outcomes
     * and criteria and never the standing. Alice is told a sentence changed and shown nothing
     * that changed, which is the blind re-stamp this file calls "how a stamp stops meaning
     * anything".
     */
    if (r.standing)
      refineStanding(r.standing, ctx, ["standing"], { hasContent: !!r.statement, what: "rule" });
    if (r.standing && r.standing.kind !== "stated" && r.standing.kind !== "open") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["standing"],
        message: `a rule is either open or it says something — "${r.standing.kind}" needs a sentence to be about, and this one has none`,
      });
    }
    if (!undecided && !r.statement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statement"],
        message: "a rule says something about a class of exchanges — if nobody has decided what, give it an `open` standing so it is asked rather than assumed",
      });
    }
    if (undecided && r.statement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statement"],
        message: "this rule both states something and says nobody has decided it — a rule has no slot to hold a residual, so one of the two is wrong",
      });
    }
    /**
     * ⛔ A RULE DECLARES ITS REACH — WHOSE PRODUCT, AND WHOSE ASK.
     *
     * Two halves of one omission, both found in the shipped seed:
     *
     * **Container.** A disconnected second product with its own root scope had its `fails` and
     * `again` supplied by *"the person is told it was not recorded"* and *"tells the person it
     * is already done"*. There is no person; a till asked.
     *
     * **Asker.** `packet money` printed, on an exchange handed over by *the turn of the day*,
     * `may — Only a parent may change what a kid has`. The author knew: that same exchange
     * carries `instead_of` on `fails` and `again` reading *"Nobody is watching, so there is no
     * person to tell."* The framework charged them only where they had happened to write a
     * local sentence, and supplied a person-shaped answer everywhere else for free.
     *
     * `everywhere: true` is still sayable and still means it — but it has to be said.
     */
    if (!r.scope.everywhere && !r.scope.under && !r.in)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["in"],
        message:
          "say which part of the product this reaches: `in:` its home scope, `under:` a branch, or `everywhere: true` if you really mean every product in this corpus",
      });
    if (!r.scope.everywhere && !r.scope.asked_by)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope", "asked_by"],
        message:
          "say who asks: a sentence about what a person is told is not an answer for machinery, and a rule with no asker supplies one to both",
      });
    if (r.scope.term && !r.scope.under && !r.in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["in"],
        message: `this selects on the word "${r.scope.term}", and nothing says whose word that is — give the rule an \`in:\`, or scope it \`under:\` the part of the product it governs. Two products can spell one word the same way and mean different things`,
      });
    }
    if (Object.keys(r.scope).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope"],
        message: "a rule with an empty selector governs everything by accident — say `everywhere: true` if you mean it",
      });
    }
    // ⛔ A rule with no conformance criterion is an aspiration. This is the whole
    // difference between this and a v1 "principle".
    /**
     * ⛔ A RULE FILLING `refuses` MUST NAME THE CASES, or `RefusalOutcome`'s whole floor
     * evaporates the moment a rule answers the slot.
     *
     * A prose-only `supplies` rule on `refuses` produced a grid reading `↑R3` with `0
     * blank`, silence from `check`, and a packet telling a builder *"it refuses in the same
     * two named ways and in the same words"* with the two named ways nowhere in the corpus.
     * `RefusalOutcome` exists because a refusal is "named, never a code"; a rule was the one
     * way to fill the slot without naming anything.
     *
     * This is also the home for a shared refusal vocabulary, which had none: one rule,
     * named outcomes, every exchange it reaches.
     */
    // ⛔ Keyed on the SLOT SET, not on the mode. A `constrains` rule on `refuses` names
    // cases for exactly the same reason a `supplies` one does — prose there tells a builder
    // nothing implementable — and keying on `supplies` let the whole hole back in.
    {
      // ⛔ Same reason as a slot's: a rule's outcome name is an address too, and it reaches
      // every exchange the rule governs.
      const seen = new Set<string>();
      for (const o of r.outcomes ?? []) {
        if (seen.has(o.name))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["outcomes"],
            message: `two cases are called "${o.name}" — only the first is addressable, on every exchange this rule reaches`,
          });
        seen.add(o.name);
      }
    }
    if (!undecided && r.fills.includes("refuses") && !(r.outcomes ?? []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcomes"],
        message:
          "a rule that supplies `refuses` has to name the cases it refuses — prose here fills the slot and tells a builder nothing they can implement",
      });
    }
    /**
     * ⛔ THIS REFUSAL MOVED TO `check`, AND THE SEQUENCE IS WHY.
     *
     * It was a load refusal: a rule with no conformance criterion would not parse, on the entirely
     * sound reasoning that such a rule "is an aspiration that fills a slot and demonstrates
     * nothing". The guarantee is right and is unchanged — it is now
     * `a-rule-that-demonstrates-nothing`, which refuses a handover rather than a read.
     *
     * What forced the move: nobody authors a criterion any more. Peter: *"a product person doesn't
     * write a criterion … the agents decide what kind of tests need to exist."* The scoper writes a
     * rule while scoping, BEFORE sign-off; `demonstrator` works out what must be demonstrated AFTER
     * sign-off, because a set worked out over a draft has to be done twice. Between those two
     * moments every rule in the corpus has no conformance criterion — so as a load refusal this
     * made the corpus unreadable for the whole interval, including to the role whose job is to fix
     * it, and including to `check` itself.
     *
     * ⛔ A refusal that fires between two steps of the documented sequence is not a strict schema,
     * it is a deadlock. Refusing at handover keeps every bit of the protection that matters: no
     * packet compiles over it, and `check` must pass before anybody is asked to review.
     */
    for (const c of r.criteria) {
      if (c.kind === "instance" && !r.scope.only) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message: `criterion ${c.id} is an instance on a rule that governs a class — instances cannot be written without an instance`,
        });
      }
      if (!r.fills.includes(c.slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message: `criterion ${c.id} demonstrates "${c.slot}" on a rule that answers ${r.fills.join(" and ")} — add that slot to \`fills\` if the rule really governs it`,
        });
      }
    }
  });
export type Rule = z.infer<typeof Rule>;

// ---------------------------------------------------------------------------
// Scope — the only container, at every altitude.

export const Scope = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "scope ids are kebab-case slugs, not paths"),
  title: z.string().min(2),
  /**
   * The ways this product varies — declared once, on the product, reaching every feature in it.
   *
   * ⛔ Peter: *"we need dimensions to carry through to all features, so we can have different
   * variations PER feature. and the dimensions should affect the truths as well"*.
   *
   * ⛔ THE HOME MOVED HERE RATHER THAN A SECOND ONE BEING ADDED. They arrived as `splits_on` inside
   * `prototypes.yaml`, because what was being asked for that day was a prototype selector — so a
   * dimension could only pick one of a handful of whole walkthroughs. A product that genuinely
   * differs by role differs per FEATURE, in what each one promises. `splits_on` stays readable as the
   * older spelling and `dimensionsOf` prefers this; what it must never do is merge them, which would
   * invent a third list neither file says and leave nowhere to go and read the answer.
   *
   * ⛔ ON THE PRODUCT, NOT ON EVERY SCOPE. The field is here because this is the Scope shape and the
   * product is one — `dimensionsOf` reads the root and nothing else. A feature declaring dimensions
   * of its own would be a second product inside the first, and `check` refuses it.
   */
  dimensions: z
    .array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1).describe("the dimension's name as a reader sees it — Role, Product line"),
          /**
           * ⛔ EMPTY IS HONEST — a dimension somebody named and has not filled in — and `check` says
           * so rather than this refusing a half-authored product.
           */
          values: z.array(z.string().min(1)).default([]),
        })
        .strict()
    )
    .optional(),
  /**
   * What this feature is FOR, agreed before any detail of it. See `HappyPath`.
   *
   * ⛔ OPTIONAL IN THE SCHEMA AND REQUIRED BY THE GATE, deliberately. Making it required would
   * refuse every corpus that exists on the day it is added, including the pristine seed, and a
   * schema change that cannot be adopted gets reverted. Making it absent-but-gating says the true
   * thing instead: the feature can be written without one, and nobody can agree to its details
   * until somebody says what it is for.
   */
  happy_path: HappyPath.optional(),
  /**
   * Where this scope is filed.
   *
   * ⛔ THIS COMMENT USED TO SAY "FOR DISPLAY AND VOCABULARY ONLY. PLACEMENT IS NOT
   * CLASSIFICATION" AND THAT WAS THE OPPOSITE OF THE TRUTH.
   *
   * What `in:` actually governs, all of it load-bearing:
   *
   *   - **`Selector.under`** resolves through it. `lineage()` walking `in:` is the sole input.
   *   - **`Selector.tag`** resolves through it — `tagsFor()` unions every ancestor's tags.
   *   - **vocabulary**, together with `depends_on`.
   *   - **`decide`, `read` and the packet** treat a scope as itself-and-everything-below.
   *
   * So deleting one `in:` line silently changed what governs three money writes — and the
   * corpus got QUIETER, because the duplicate-term notes went away too. Nine notes became
   * five, zero refusals either way, and a currency constraint had gone. `check`'s own
   * remediation text advised *"or drop `in:` — it is display and vocabulary only"*, which on
   * that scope was the destructive option.
   *
   * What it still does NOT do, which is what the original comment was reaching for:
   * placement does not decide what something IS. That judgement — the v1
   * feature-vs-capability call — lives on `Exchange.asked_by`, where it is a fact rather
   * than a filing decision. Re-filing changes what a scope INHERITS, never what it is.
   */
  in: z.string().optional(),
  exists: z.enum(["intended", "kept", "withdrawn"]).default("kept"),
  tags: z.array(z.string()).default([]),
  /** word → one line of what it means here. `closed` makes it a taxonomy with members.
   *  ⛔ One line per word, never a field list — a data model is refused. */
  terms: z
    .record(
      z.string(),
      z
        .object({
          means: z.string().min(5),
          closed: z.boolean().optional(),
          members: z.array(z.string()).optional(),
          /**
           * ⛔ THIS WORD IS CONTESTED, AND NOBODY HAS RULED WHICH SENSE WINS.
           *
           * A slot can hold an open question. A word could not — `Term` carried
           * `means`/`closed`/`members` and nothing else, so "three names in this corpus point at
           * related-but-different objects" had nowhere to live at the grain of the word.
           *
           * What that cost, recorded as fg-0004 by the scoper that hit it: Bilrost uses *version
           * selection*, *model revision*, *master model version* and *input version* across four
           * places for three distinct objects. The scoper declared the one word it owned, and
           * **deliberately left the collision out of truth entirely** — reporting it in prose to its
           * caller instead — because defining the contested word would have settled a collision
           * nobody had ruled on, and a guessed definition reads exactly like a decided one.
           *
           * ⛔ `with` NAMES THE OTHER WORDS, because "this is contested" without saying against
           * what is a feeling. The question goes to a person; nothing here resolves it.
           */
          contested: z
            .object({
              question: z.string().min(10),
              /** The other words it collides with — bare words, or `<scope>` where one is defined. */
              with: z.array(z.string()).min(1),
            })
            .strict()
            .optional(),
          /**
           * ⛔ THE ANSWER `check` ASKED FOR AND THE SCHEMA COULD NOT HOLD.
           *
           * `nothing-in-this-product-sets-this` offers three exits: a behaviour is missing, the
           * word comes from outside and nothing here will ever set it, or the word is dead.
           * Writing the middle one was refused — `Unrecognized key(s) in object` — so the two
           * working exits were inventing an exchange that writes it, or deleting a true
           * `reads` entry. The second silently changes which org-wide rules reach the
           * exchange while reporting a clean corpus.
           *
           * `kid`, `task` and `completion` all sit on this in the shipped seed.
           */
          set_outside: z
            .object({
              because: z.string().min(20),
              by: z.string(),
              at: dateish,
            })
            .strict()
            .optional(),
          /**
           * ⛔ The other direction, which had no field at all.
           *
           * `nothing-reads-what-this-sets` offered three answers and the schema could hold
           * two. The third — *something outside this product reads it* — had nowhere to go,
           * so the finding could never be cleared honestly, and it could not be parked
           * either: a term is not a slot, so `defer` answered `no exchange "completion"`.
           */
          read_outside: z
            .object({
              because: z.string().min(20),
              by: z.string(),
              at: dateish,
            })
            .strict()
            .optional(),
          /**
           * ⛔ A SIBLING FEATURE IN THIS CORPUS SETS OR READS THIS WORD — the fourth answer, and
           * the one `nothing-in-this-product-sets-this` and `nothing-reads-what-this-sets` both
           * offered no way to give.
           *
           * Each finding offered two exits: a behaviour is missing, or the word crosses the
           * product's edge (`set_outside` / `read_outside`). Neither is true when the other half
           * is **another feature in the same corpus** — and a scoper is forbidden from reading a
           * sibling's scope, so it cannot clear the finding truthfully even when it knows the
           * answer. Both directions were filed as framework gaps by authors who hit them:
           *
           *   fg-0001  `limit-resolution` reads a resolved limit, an answering layer, a tier grid
           *            cell and a held policy version, and could declare NONE of them — so every
           *            exchange carries `reads: []` and no org-wide rule can select on `term:`.
           *   fg-0006  `read-a-supplied-file` SETS `confidence` and `the file's own declaration`;
           *            the features that read them are siblings it may not open.
           *
           * ⛔ A DECLARATION, NOT A CHANGE TO VOCABULARY REACH, and that distinction is the whole
           * reason this is safe. fg-0001 was left open for a session precisely because widening
           * `vocabularyReach` to follow the reverse `depends_on` edge would change which org-wide
           * rules select which exchanges in every corpus — its own text warns it would "silently
           * change which org-wide rules reach the exchange while reporting a clean corpus". This
           * changes nothing about reach: it records who the other half is, and `check` resolves the
           * ref like any other, so a wrong one is caught rather than believed.
           */
          set_by: z
            .array(z.string())
            .min(1)
            .optional()
            .describe("<scope> or <scope>#<exchange> — the sibling that sets this word"),
          read_by: z
            .array(z.string())
            .min(1)
            .optional()
            .describe("<scope> or <scope>#<exchange> — the sibling that reads this word"),
        })
        .strict()
    )
    .default({}),
  /**
   * What this scope rests on and does not itself behaviour.
   *
   * ⛔ Rendered in the packet, not merely validated. It was reference-checked and shown on
   * no surface — and a field that only ever gets validated is a field nobody fills in
   * honestly. It is also the only thing carrying the structure the deleted capability tree
   * used to hold, so a builder needs it: what is assumed here, and whose behaviour it is.
   */
  depends_on: z.array(z.string()).default([]),
  views: z.array(View).default([]),
  /**
   * ⛔ THIS FEATURE HAS NO SCREEN OF ITS OWN, SAID RATHER THAN INFERRED — the reason, in one line.
   *
   * `views: []` cannot be told from "nobody has drawn them yet", and the difference matters to every
   * reader: one is a capability reached only from other features, the other is unfinished work.
   * With no way to say it, the fact was written as a clause inside the `may` sentence of **all eight
   * exchanges** of `limit-resolution` — "It has no screen of its own." eight times — which is the
   * duplication this model exists to prevent. Recorded as fg-0003 by the scoper that hit it.
   *
   * ⛔ A REASON, NOT A BOOLEAN. "Reached only from other features, never opened directly" is
   * checkable against the exchanges; `true` is an assertion with nothing behind it.
   */
  no_screen: z.string().min(10).optional(),
  exchanges: z.array(Exchange).default([]),
  /** ⛔ Why this is worth building — what is wrong today. See `Reason`. */
  why: z.array(Reason).default([]),
  /** What could go wrong, each on its own so each can be agreed to or dropped. See `Risk`. */
  risks: z.array(Risk).default([]),
  /** How anybody would know it worked. See `Measure`. */
  measures: z.array(Measure).default([]),
  /** What gets recorded, and which measures it feeds. See `Instrument`. */
  instruments: z.array(Instrument).default([]),
  /** Migration alias — what this was called in v1. */
  was: z.string().optional(),
}).strict();
export type Scope = z.infer<typeof Scope>;

// ---------------------------------------------------------------------------
// Subsystem and Capability — the parts beneath the product, and roughly what each does.

/**
 * ⛔ RESTORED. A CLAUDE SESSION DELETED THIS AND NOBODY ASKED IT TO.
 *
 * v1 had a capability tree: subsystems, nesting to any depth, each offering named
 * capabilities. Commit `3db154c` (2026-09-21) built v2 as a parallel track and did not carry
 * it across — the model it lists is *"Scope · View · Exchange · Slot · Criterion · Rule ·
 * Standing · Reading · Verdict"*, with no capability in it. There is no change record and no
 * request from Peter. The comment on `depends_on` calling this *"the deleted capability
 * tree"* is that same session describing its own deletion.
 *
 * ⛔ AND THE DELETION WAS INVISIBLE BECAUSE TWO THINGS COVERED FOR IT.
 *
 *  - `Exchange.asked_by: system` looks close enough to pass for a capability. It is not: a
 *    system-asked exchange is machinery-shaped PRODUCT TRUTH, written by a product author and
 *    agreed by a product person. A capability is engineering's answer to it.
 *  - Change `0090` — *"let's add some engineering authors! they should be authoring the
 *    capabilities anyways"* — added `machinist` and `instrumenter`, who write system-asked
 *    exchanges. So the authors came back and the thing they were meant to author did not, one
 *    day before this was noticed.
 *
 * ⛔ AND A JUDGE WAS ALREADY REVIEWING IT. `productos-architect` asks *"are these the right
 * subsystems, do their boundaries hold"* and its instructions say *"The site has two halves:
 * the product's user-facing features, and the subsystems beneath them."* It has been
 * dispatched against half a site that does not exist. Same shape as `test-design` judging
 * criteria nobody derives — a reviewer for a layer with no author is how a layer goes missing
 * without a single check going red.
 *
 * Peter: *"capabilities are like object oriented design. just designing the subsystems,
 * roughly what they do. that's it. they shoudl be logically grouped into areas. they
 * obviously nest, or cross reference other areas."*
 *
 * ⛔ "ROUGHLY WHAT THEY DO. THAT'S IT" IS A SCHEMA CONSTRAINT, not a tone. There are no slots
 * here, no criteria, no standing contract, and there must not be: the eight-slot skeleton
 * exists because a product promise has to be falsifiable before anybody builds against it,
 * and a subsystem sketch is the opposite kind of artefact. Precision about behaviour lives in
 * product truth; this layer says what parts there are and what each is for. Anything that
 * makes an engineer write a given/when/then here has misunderstood the layer.
 */
/**
 * ⛔ NAMED SO THE WORD MEANS ONE THING. This was `CapabilityOffering`, beside a `Capability` that was
 * really a subsystem — so the thing a person calls a capability had the longer, odder name, and
 * Peter asked *"did you create CapabilityOffering? is that supposed to be the new capability tree?
 * i'm confused"*. A `Subsystem` offers `Capability`s; there is one tree and these are its leaves.
 */
export const Capability = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a capability id is one segment, kebab-case"),
    /** Roughly what it does. One or two sentences — see the constraint above. */
    does: z.string().min(10, "a capability nobody can read is not worth agreeing to"),
    /**
     * What this exists to serve — a product statement, or another capability.
     *
     * ⛔ REQUIRED, AND THIS IS THE WHOLE OF "FLOW FROM THE PRODUCT DESIGN". Peter: *"those
     * should flow from the product design"*. A capability serving nothing is an engineer
     * inventing scope, and it is the single finding the architect exists to make — so it is
     * mechanical rather than left to a reviewer's patience.
     *
     * ⛔ REQUIRED IN THE SCHEMA RATHER THAN AT A GATE, which is the opposite of the call made
     * for `happy_path`, and the difference is adoptability. `happy_path` could not be required
     * because making it so would have refused every corpus that already existed, including the
     * pristine seed. ⛔ NO CORPUS HAS A CAPABILITY AT ALL, so there is nothing to refuse and
     * the usual argument for optional-and-gated does not apply. A layer born optional is a
     * layer whose load-bearing field is empty everywhere by the time anybody notices.
     *
     * ⛔ ANOTHER CAPABILITY IS A LEGITIMATE TARGET, because a general subsystem is often two
     * levels away from a feature — the clock serves the ledger, and the ledger serves the
     * money. What `check` enforces is that following `serves` eventually reaches product
     * truth: machinery that only ever serves machinery is machinery nobody asked for.
     */
    /*
     * ⛔ AND NOW REQUIRED AT `check`, NOT HERE — because the premise above stopped being true. The
     * older tree carried into product truth is converted into this one (`convert-capabilities.ts`),
     * and a carried capability nothing declared a dependency on has no honest `serves` to write.
     * Refused at the schema, it would not load and would vanish from every page; refused at `check`
     * as `a-capability-that-serves-nothing`, it is shown, named, and blocks handover until a person
     * says what it is for.
     */
    serves: z.array(z.string().regex(REF_PATTERN, REF_MESSAGE)).default([]),
    /**
     * What this was worked out from, and when — the same shape `Criterion.derived` carries, and
     * for the same reason.
     *
     * ⛔ A CAPABILITY IS GENERATED FROM CURRENT TRUTH AND CARRIES AN INVALIDATED STATE. Peter:
     * *"capabilities should be generated based on current truth, have the accepted state feed in.
     * test cases should be generated too. they should just carry an invalidated state"*.
     *
     * This replaces a gate. `decomposer` was briefly routed behind sign-off, on the reasoning that
     * a part flows from agreed truth so decomposing a draft means designing the system twice — and
     * that was wrong in both directions. It put an engineering AUTHOR on the judges' side of a line
     * this repo had already drawn, and it meant nobody could see what a promise costs until after
     * they had agreed to it, which is exactly backwards for the stage where `buildability` and
     * `architecture` ask their questions.
     *
     * ⛔ `from` HASHES WHAT IT SERVES, NOT THE PART ITSELF. `capabilityHash` already answers "has
     * this part been reworked" for a future engineering agreement. This answers the other question:
     * has the truth this part exists to answer moved since anybody worked the part out. One hash
     * over the whole `serves` set, because a part is coarse by design — "roughly what they do" —
     * and the useful grain is the part, not the individual promise.
     *
     * Absent means nobody recorded what it was worked out from, which is the same third state
     * `Criterion` has: not wrong, just unfalsifiable.
     */
    derived: z
      .object({
        by: z.string().min(1),
        at: dateish,
        /** The hash of everything this serves, as it read when the part was worked out. */
        from: z.string().min(8),
      })
      .strict()
      .optional(),
  })
  .strict();
export type Capability = z.infer<typeof Capability>;

export const Subsystem = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "subsystem ids are kebab-case slugs, not paths"),
    title: z.string().min(2),
    /**
     * Roughly what this part of the system does.
     *
     * ⛔ THE FIELD v1 DID NOT HAVE, AND ITS ABSENCE IS THE RECORDED COMPLAINT. From
     * `product.ts`: *"capabilities rendered as a flat list of operations — 'limit resolution',
     * 'deliver a version' — with nothing anywhere saying what subsystem offered them or what it
     * was for. A directory name is not a description."*
     */
    does: z.string().min(10),
    /**
     * Where this subsystem is filed — the same containment `Scope.in` uses, to any depth.
     *
     * Peter: *"same nested structure as product … they shoudl be logically grouped into
     * areas. they obviously nest"*. A container subsystem offers nothing itself and groups
     * those beneath it, exactly as a product container holds no exchanges.
     */
    in: z.string().optional(),
    /**
     * Other subsystems this one leans on. ⛔ Peter: *"or cross reference other areas"*.
     *
     * Distinct from a capability's `serves`, and the direction is the point: `serves` points UP
     * at what required this, `uses` points ACROSS at what this needs. A single field would make
     * a cycle between two subsystems indistinguishable from a layering.
     */
    uses: z.array(z.string()).default([]),
    offers: z.array(Capability).default([]),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.in === c.id)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["in"],
        message: "a subsystem cannot be filed inside itself",
      });
    const seen = new Set<string>();
    for (const o of c.offers) {
      if (seen.has(o.id))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["offers"],
          message: `two capabilities here are called "${o.id}" — an id is what a reference and a future agreement point at`,
        });
      seen.add(o.id);
    }
  });
export type Subsystem = z.infer<typeof Subsystem>;

// ---------------------------------------------------------------------------
// Reading — an observation. ⛔ Never truth.

export const Reading = z.object({
  id: z.string(),
  /** Absent is meaningful: the product does something nobody has decided. That is the
   *  completeness signal a grid structurally cannot produce. */
  bears_on: z.string().optional(),
  observes: z.string().min(10),
  basis: z.object({
    /**
     * ⛔ `trial` AND `interview` WERE MISSING, AND THAT IS WHY THIS CONCEPT LOOKED DEAD.
     *
     * The enum was code · test-run · screen · series — four ways of observing a machine and
     * none of observing a person. So the single strongest piece of evidence in the example
     * corpus, *"Parents in the trial recorded spending after the fact, so refusing it would
     * mean the record does not match what happened"*, had to live as prose inside a
     * standing's `because`. The concept that exists to hold observations could not hold the
     * observation the corpus actually rests on, and `readings/` stayed empty — which read
     * as the concept being unnecessary rather than as it being unusable.
     */
    /**
     * ⛔ `series` REMOVED FOR REAL THIS TIME. The comment eight lines below has said it was removed
     * since it was written, and the enum went on offering it — so the one field a reader was warned
     * about was the one still available. Nothing reads it; it held a metric over time, which belongs
     * to the operational half of the roadmap that does not exist.
     *
     * ⛔ `telemetry` · `log` · `inspection` ADDED, because the scoper's instructions already offered
     * them. An author following the documented list wrote a kind the loader rejects, which is worse
     * than an author with too few options: they have no reason to doubt the instruction. They are
     * also genuinely distinct from what was here — `log` is what the product recorded, `telemetry`
     * is what it recorded in aggregate, and `inspection` is somebody looking at the running product
     * rather than at its code.
     */
    /**
     * ⛔ `walk` ADDED, AND IT IS DELIBERATELY NOT `inspection`.
     *
     * Peter: *"let's add walk-to-index. it doesn't give us CONFIRMED state. but it gives us a
     * starting place for how an existing product already behaves. it should also have a level of
     * confirmation that is higher than 'LLM generated'."*
     *
     * `inspection` is a PERSON looking at the running product. A walk is an AGENT driving it and
     * recording what it did. Folding the two together would have been the laundering this codebase
     * keeps finding: an agent's observation rendering identically to somebody's, so a reader asking
     * "did a human see this?" gets yes from a field that means no.
     *
     * ⛔ AND IT IS WHY A WALK EARNS A RUNG AT ALL. An agent's inference cannot be re-checked — there
     * is nothing to point at. A walk names a URL and what happened there, so anybody can go and run
     * it again and disagree. That is the whole difference between this and `via: agent`, and it is
     * the property that makes it evidence rather than a louder guess.
     */
    kind: z.enum([
      "code", "test-run", "screen", "inspection", "walk",
      "trial", "interview", "support",
      "telemetry", "log",
    ]),
    /**
     * Where this was observed, specifically. A `file:line` for code, a session set for a trial, a
     * ticket for support, a dashboard for telemetry.
     *
     * ⛔ REQUIRED, AND THE INSTRUCTIONS CALLED IT `what`. A reading whose basis names no source is
     * an assertion wearing evidence's clothes — the whole point is that whoever answers a question
     * can go and look. The scoper documented `what:` instead, which `.strict()` rejects, so every
     * reading written from the instructions failed to load and `readings/` stayed empty in every
     * corpus. Proven by parsing the documented example: three errors, this among them.
     */
    ref: z.string().min(3),
    quote: z.string().optional(),
    at: dateish.optional(),
    by: z.string().optional(),
  }).strict(),
}).strict();
export type Reading = z.infer<typeof Reading>;

// ---------------------------------------------------------------------------
// Verdict — a human's act. ⛔ No model-callable path to any of the three.

/**
 * A human's acts. ⛔ Four, and `defer` is the one a queue cannot survive without.
 *
 * `accept` · `rule` · `read` are the three that move truth forward. `defer` is the act of
 * looking at a question and consciously not answering it yet, and it is a first-class
 * verdict rather than a queue setting for three reasons:
 *
 *  - **Without it the queue is unworkable.** An unanswerable question re-offers itself
 *    every session. A person who cannot clear an item learns to stop reading the list, and
 *    then the items that DO need them are buried behind the ones that never will.
 *  - **It is not the same as open.** `open` means nobody has looked. A deferral means
 *    somebody looked, understood it, and judged that now is not when it gets answered.
 *    Collapsing them loses the most useful signal in the corpus — that a real reviewer
 *    read this and was not blocked by it.
 *  - **It must not launder.** Deferring is not deciding: a deferred slot stays unsettled,
 *    its exchange stays gated, and no packet compiles over it. The ONLY thing a deferral
 *    changes is whether a person is asked again.
 */

export const Verdict = z
  .object({
    kind: z.enum(["accept", "rule", "read", "defer", "waive"]),
    by: z.string().min(1),
    at: z.string(),
    /**
     * What this act is about: `<scope>#<exchange>[#<slot>[#<case>]]`, or a rule id.
     *
     * ⛔ TYPED, BECAUSE AN UNTYPED ONE BROKE THE DEFERRAL BOOK SILENTLY.
     *
     * `check` indexed deferrals with `v.target!.split("#")` and assumed three parts. So
     * parking the org-wide question produced `✓ parked`, a written verdict, and then BOTH
     * `parked-nothing / a deferral points at an exchange that is not here` AND the question
     * being asked again. Parking a named case produced `✓ parked` and then both `outcome-open`
     * (still asking) and `parked-then-settled` (claiming it had been answered).
     *
     * Two of the four grains `ref.ts` defines could not be parked, silently, including the
     * highest-leverage one. The shape is checked here; `resolveRef` is what resolves it.
     */
    target: z
      .string()
      .regex(REF_PATTERN, REF_MESSAGE)
      .optional(),
    /**
     * How this person's consent was obtained.
     *
     * ⛔ REQUIRED, AND NEVER DEFAULTED — it is the guarantee that replaced a stronger one.
     *
     * A boundary test used to fail the build if any MCP tool could perform one of the five
     * acts, on the reasoning that MCP is what a model reaches for unprompted. That boundary
     * was deliberately opened so a person can answer in conversation or press a button on a
     * rendered page. "A model cannot produce a verdict" therefore no longer holds, and what
     * takes its place is that every stamp records WHICH SURFACE it came through — so a corpus
     * can be read for the quality of its validation and not only for its presence.
     *
     * A default would defeat the whole thing: the weakest provenance would silently wear the
     * strongest name, which is the failure the field exists to make visible.
     *
     * ⛔ AND `agent` IS NOT CONSENT. A verdict may be recorded by software — a default landed so a
     * reviewer has something to disagree with rather than a blank — and it is then structurally
     * incapable of satisfying a gate. Without this value the choice was between software that
     * cannot help and software whose help is indistinguishable from a person's agreement.
     */
    via: z.enum(["page", "question", "chat", "cli", "agent"]),
    /**
     * ⛔ WHO CARRIED IT, WHEN THIS INSTANCE DID NOT WATCH IT HAPPEN.
     *
     * A person can press somewhere this instance cannot see — a published page's database, another
     * instance — and losing that press because the courier was automated would be worse than
     * carrying it. But `by` and `via` then describe somebody the recorder is taking on trust, and a
     * corpus that cannot tell those apart claims every stamp was observed.
     *
     * So a relayed verdict keeps the PRESSER's name and `via`, and names the courier here. Present
     * means: a person really did agree to this, and this instance has somebody's word for it rather
     * than its own record. Absent means the instance issued the session that pressed the button.
     */
    relayed_by: z.string().optional(),
    /**
     * The rule whose statement this acceptance was reached through, rather than pressed on.
     *
     * ⛔ ONE HUMAN ACT, N RECORDS — AND THE SENTENCE IS THE ONLY THING THE PERSON DID.
     *
     * A person states *"folders are restricted to be linked to a single deal"* once. That sentence
     * is a rule, and it answers several claims already in the corpus — so each of them is settled,
     * with their sentence named here as what settled it. The alternative is asking them the same
     * question once per claim, which is review surface with nothing behind it: the sentence they
     * agreed to and the sentence they are being asked about are the same string.
     *
     * ⛔ IT IS A REFERENCE, NOT A COPY, AND THAT IS WHAT MAKES IT SAFE. `stampFor` grants a verdict
     * carrying this ONLY while the named rule is itself accepted and unreworded — the same
     * precondition `acceptedThroughRule` already runs on. Without that, one sentence settles seven
     * claims and the seven outlive the sentence being reversed, which is verbatim the failure
     * `stamp.ts`'s header exists to prevent, reached by a new route. It needs no extra data: the
     * rule's own verdict already carries its hashes.
     *
     * ⛔ A RULE ID, AND THE TARGET IS ONE CLAIM. Refined below: three segments, because a settled
     * sentence is the grain a person reviews at, and a rule id has no `#` in it.
     */
    through: z.string().optional(),
    /**
     * Software's account of why that sentence settles THIS claim. ⛔ Never the person's words.
     *
     * ⛔ THE PERSON'S SENTENCE AND THE REACH OF IT ARE TWO DIFFERENT CLAIMS BY TWO DIFFERENT
     * AUTHORS, AND A RECORD THAT MERGES THEM IS A RECORD OF CONSENT NOBODY GAVE.
     *
     * `through` names what a human stated. Which claims that statement verifies is an inference —
     * made by software reading both sentences — and it can be wrong in a way the human never said
     * anything about. Written into `because` or into `says` it would read, in the verdict log and on
     * every page built from it, as the reasoning of whoever accepted.
     *
     * Same precedent, same reason as `chose` / `option_said`: `--pick` used to prepend a model's
     * `consequence` to a human's `because`, and the log then printed a model's argument under a
     * person's name. The fix was not to delete the argument but to keep it in its own field,
     * attributed to whoever made it. This is that field for a reading, and `read_by` is the name.
     *
     * So no surface may show this as something a person said. `stampFor` carries it beside the name
     * of whoever read it that way, never beside `by`.
     */
    reading: z.string().optional(),
    /**
     * Who read it that way — a model name, or `software` where no judgement was involved.
     *
     * ⛔ UNATTRIBUTED, AN INFERENCE READS AS A FACT. `via: agent` exists because software's record
     * had to be distinguishable from a person's agreement at every gate; this is the same
     * distinction one level down, inside a verdict a person really did make. The acceptance is
     * theirs, the reach of it is somebody else's, and a reader who cannot see which model drew it
     * cannot weigh it.
     */
    read_by: z.string().optional(),
    covers_slots: z.string().optional(),
    /**
     * The exact lines that were hashed, as they read when somebody agreed.
     *
     * ⛔ RECORDED BECAUSE THE WORDS WERE UNRECOVERABLE, AND SIX ACCEPTANCES DIED OF IT.
     *
     * Peter accepted six things on `create-deal#create-deal-form` on 2026-10-01. The next day a
     * regeneration rewrote that view and every one went stale — correctly, because he had agreed to
     * particular words and the words had changed. But the verdict kept only two hashes, so the
     * sentence he actually agreed to was gone: there was no way to show him what moved, and
     * re-confirming meant re-deriving the whole thing from scratch.
     *
     * ⛔ THIS DOES NOT KEEP THE ACCEPTANCE ALIVE, AND MUST NOT. A stamp that survived a reword would
     * be a person's consent attached to words they never read — the exact laundering `canon` and the
     * three stale states exist to prevent. What it buys is that re-confirming becomes one glance at
     * a diff instead of an argument reconstructed from memory, and that a generator can be stopped
     * BEFORE it rewords something agreed.
     *
     * Optional, because every verdict written before this exists without it, and a corpus must keep
     * loading. Absent means "we cannot show you what changed", which is the state this fixes.
     */
    covered_text: z.array(z.string()).optional(),
    covers_criteria: z.string().optional(),
    // rule
    settles: z
      .string()
      .regex(REF_PATTERN, REF_MESSAGE)
      .optional(),
    says: z.string().optional(),
    because: z.string().optional(),
    also_considered: z.string().optional(),
    /**
     * For a `rule` made by choosing a drafted option: which one, and the argument the
     * DRAFTER made for it.
     *
     * ⛔ THESE EXIST SO THE `because` FLOOR CHARGES THE PERSON, AND SO THE WINNING OPTION'S
     * ARGUMENT SURVIVES THE RULING.
     *
     * `--pick` used to prepend the candidate's own `consequence` to `because` — so a ruler
     * typing `--because "yes"` cleared the forty-character floor on the strength of a
     * sentence a model wrote, and the verdict log then read that argument under a person's
     * name. The floor was the entire price of the strongest act in the schema.
     *
     * Stripping the prefix alone would have been worse: a ruling DELETES
     * `standing.candidates` from the truth file, and `also_considered` records only the
     * losers. The chosen option's reasoning existed nowhere else. So it is kept, in its own
     * field, attributed to whoever drafted it rather than to whoever ruled.
     */
    chose: z.string().optional(),
    option_said: z.string().optional(),
    /** ⛔ For a `rule` that revised an existing sentence — what it used to say. */
    replaced: z.string().optional(),
    /**
     * For a `rule` settling one side of a dispute: what happens to the other side.
     *
     * ⛔ REQUIRED WHEN THE SLOT BEING RULED IS DISPUTED, because a dispute did not survive the
     * act that resolved it.
     *
     * A human put a `disputed` standing on one slot naming another; `check` correctly refused
     * both sides. Then that same human ruled the declaring side, `settle` deleted the standing,
     * and the dispute vanished from the corpus entirely — `grep -ci disput` returned zero, and
     * `acts` offered the other side as ready to accept. The formal declaration that two
     * sentences cannot both hold was erased by its own resolution, and `Verdict` had no field
     * able to say which one stood.
     *
     * It was the only relation in the model stored on one side and derived for the other.
     */
    resolves: z
      .array(
        z
          .object({
            /** The counterparty slot or rule. */
            target: z.string(),
            /** Which of the two stands. */
            stands: z.enum(["this", "the other", "neither"]),
            because: z.string().min(20),
          })
          .strict()
      )
      .default([]),
    // read
    scope: z.string().optional(),
    buildable: z.boolean().optional(),
    blocked_by: z.array(z.string()).default([]),
    note: z.string().optional(),
    // defer
    /** ⛔ What would make this worth answering — an event, not a date, because a date is a
     *  plan and plans rot. "When a second parent can be invited" survives a slipped
     *  quarter; "2026-11-01" is wrong by November and nobody notices. A date is accepted,
     *  and reported as weaker. */
    until: z.string().optional(),
  }).strict()
  .superRefine((v, ctx) => {
    if (v.kind === "accept" && !v.target)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "an accept names one exchange or one rule" });
    /**
     * ⛔ A READING WITHOUT THE SENTENCE IT READ IS AN INFERENCE WITH NOTHING UNDER IT.
     *
     * `reading` says why some sentence settles this claim; `read_by` says who thought so. Neither
     * means anything without the sentence — and both, standing alone on an acceptance, would read
     * as the reasoning of whoever accepted, which is the one thing these fields exist to prevent.
     */
    for (const f of ["reading", "read_by"] as const)
      if (v[f] && !v.through)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [f],
          message:
            "name the rule this was reached through — a reading with no statement under it is software's inference presented as somebody's agreement",
        });
    if (v.through) {
      /**
       * ⛔ ONE CLAIM, AT THE GRAIN A PERSON REVIEWS AT. `stampFor` recognises a rule's reach at
       * `<scope>#<exchange>#<slot>` and nowhere else — a whole exchange is eight sentences, and one
       * org-wide statement does not answer all eight. A verdict naming a coarser target would be
       * written, read by nothing, and look like consent to seven sentences nobody mentioned.
       */
      if ((v.target ?? "").split("#").length !== 3)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target"],
          message:
            "a statement reaches one settled sentence at a time — name it as <scope>#<exchange>#<slot>, not a whole exchange",
        });
      /**
       * ⛔ A RULE ID, NEVER A REF. A rule has no container and no `#`; pointing this at
       * `<scope>#<exchange>#<slot>` would name a claim as the thing that verifies a claim, and
       * `stampFor` would find no rule, so the acceptance would silently confer nothing. Whether a
       * rule with this id EXISTS is enforced where it bites: a `through` naming nothing is never
       * accepted, because nothing is accepted on its behalf.
       */
      if (v.through.includes("#"))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["through"],
          message: "name the rule by its id — a statement that settles other claims is a rule, and a rule id has no #",
        });
    }
    if (v.kind === "rule") {
      if (!v.settles) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["settles"], message: "a ruling names the slot it settles" });
      /**
       * ⛔ FLOORS, BECAUSE THE STRONGEST ACT IN THE SCHEMA WAS THE CHEAPEST TO PERFORM.
       *
       * `out_of_scope` charges 40 characters and an owner and a date, on the stated
       * grounds that declaring something deliberately unanswered "is a stronger claim than
       * admitting you do not know, and it should not be cheaper". A ruling is stronger than
       * either and cost nothing:
       *
       *   v2 rule tasks#complete-a-task#at_once --says "tbd" --because "n/a" --by whoever
       *   → ruled, written into the slot, the question gone from `decide`, the packet's
       *     hole count 1 → 0, and the exchange now offered for acceptance.
       *
       * That cleared the hardest open question in the corpus for three characters. A
       * settled slot is what a builder implements and what a stamp covers, so the sentence
       * has at least as much to carry as a drafted candidate, which already floors at 10.
       */
      if ((v.says ?? "").trim().length < 10)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["says"],
          message:
            "a ruling has to say what the answer IS, in a sentence a builder can implement — this becomes the slot, and a builder cannot build \"tbd\"",
        });
      if ((v.because ?? "").trim().length < 40)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["because"],
          message:
            "the reasoning is what stops this being relitigated from scratch, so it has to carry the argument — at least as much as a deliberate refusal is charged",
        });
    }
    /**
     * ⛔ `waive` — DECLARING LATITUDE IS AN ACT, AND IT WAS THE ONLY ONE STORED AS A FIELD.
     *
     * Four acts were Verdicts with a `by`, an `at` and an append-only log. The fifth — saying
     * "we deliberately do not answer this here", which the schema itself calls *a stronger
     * claim than admitting you do not know* — was a slot standing. So it had no command, and
     * the only way to perform it was to edit YAML, which is a model's native path and not a
     * person's.
     *
     * What that cost, run on the pristine corpus: rewriting `tasks#complete-a-task#at_once`
     * from `open` to `out_of_scope` took `check` to zero refusals, `decide tasks` to "nothing
     * undecided", and moved the exchange from gated to ready-to-accept. The hardest question
     * in the corpus — the one a trial reading in the same corpus records as **observed twice
     * in a fortnight** — was gone, in a human's name, with nothing logged.
     *
     * The schema priced this in characters. A model pays characters for free. It is priced in
     * a recorded act instead.
     */
    if (v.kind === "waive") {
      if (!v.target)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "a waiver names the one slot it leaves unanswered" });
      if ((v.because ?? "").trim().length < 40)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["because"],
          message:
            "say why this is not ours to answer, in a sentence a reader can weigh — a builder is about to be told this is their latitude",
        });
    }
    if (v.kind === "defer") {
      if (!v.target)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "a deferral names the one slot it postpones" });
      // ⛔ Required. A deferral with no reason is indistinguishable from the question
      // having been dropped, and six months later nobody can tell which it was.
      if (!v.because)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["because"],
          message: "a deferral with no reason cannot be told apart from the question being abandoned",
        });
      if (!v.until)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["until"],
          message:
            "say what brings it back — a deferral with no trigger is a question quietly deleted, which is the thing this is meant to prevent",
        });
    }
    if (v.kind === "read" && v.buildable === undefined)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buildable"], message: "a read-through with no verdict is the state it replaces" });
  });
export type Verdict = z.infer<typeof Verdict>;

/**
 * ⛔ THE PRODUCT-WIDE DOCUMENTS — goals, non-goals, principles, personas, voice, decisions.
 *
 * The model had no home for any of them, which was not an omission in a migration but a hole in the
 * schema: a real corpus carried six such documents, one of them with human verification stamps on
 * individual sections, and migrating it dropped all of it on the floor. A builder handed every
 * behaviour and none of the principles is handed the sentences and not the rules the sentences were
 * written against — and features in the previous model were explicitly told to CITE these rather
 * than restate them, so the citations pointed at nothing.
 *
 * ⛔ NOT A RULE, and the distinction is load-bearing. A `Rule` supplies or constrains a named slot
 * and owes a criterion; it is checkable. A goal is what the product is for, and a principle settles
 * a design argument without being demonstrable on any one exchange. Filing them as rules would
 * demand demonstrations nobody can write and then read as governing slots they do not govern —
 * which is the precise failure of a v1 "principle" that carried no weight.
 *
 * ⛔ SECTIONS ARE NAMED so they can be agreed to one at a time. A reviewer accepts "report, never
 * block", not "the principles document" — and a document-sized stamp goes stale on every edit to any
 * part of it, which is how a stamp stops meaning anything.
 */
export const CharterSection = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a section id is one segment, kebab-case"),
    title: z.string().min(1),
    says: z.string().min(20, "a section nobody can read is not worth agreeing to"),
  })
  .strict();

export const Charter = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a charter id is one segment, kebab-case"),
    title: z.string().min(1),
    /** Reading order. ⛔ Goals before the principles that serve them, and it is not derivable. */
    order: z.number().optional(),
    /* ⛔ `kind` LIVED HERE AND NOTHING READ IT.
       It was added to distinguish goals from principles from personas, and every surface renders
       them identically from the title — so it was a required field with no reader, which this file
       calls worse than an absent one.
       It also slipped past the dead-field test, because that matches a field NAME against the
       surfaces' text and `.kind` appears everywhere for standings and verdicts. A common name
       passes that check for free; see the note added to the test.
       If a reader appears — a rule citing a principle, say — it comes back with the reader. */
    sections: z.array(CharterSection).min(1, "a document with no sections says nothing"),
    /** ⛔ What this was called in v1, for the migrator. See `Scope.was`. */
    was: z.string().optional(),
  })
  .strict();
export type Charter = z.infer<typeof Charter>;

/**
 * ⛔ WHAT A PRODUCT-WIDE DOCUMENT MAY BE, AND THE TWO THAT STOPPED BEING ONE.
 *
 * Peter, reading them on a real corpus: *"'Decisions' - these are all way too feature specific,
 * doesn't belong at top level, should be behaviors. 'Non-goals' - also feature specific, should be
 * behaviors"* — and then the question that settled it: *"why can't we delete the non-goals section
 * and decisions section?"*
 *
 * Nothing stopped us. They existed because the migrator carried v1's context model across
 * unchanged, and nobody asked whether the Exchange model still needed them. It does not — it has a
 * better home for every sentence in both, and those homes are attached to the feature they
 * constrain, agreed to one at a time, and go stale when the thing they are about changes. A
 * document gives a sentence none of those three.
 *
 * ⛔ THE SURVIVING FOUR ARE THE ONES WITH NO OTHER HOME. A goal, a design principle, a persona and
 * a product's voice are genuinely about the whole product and cannot be attached to one feature
 * without becoming something else.
 *
 * ⛔ AND THIS LIST IS A REFERENCE, NEVER A WHITELIST. Peter: *"the top level outside of these
 * should probably be user/project configurable - a place where they can add there own top level
 * rules."* He is right, and the thing to avoid is obvious from how we got here: v1 had a fixed list
 * of six, the migrator carried it across, and two documents existed for years because a list said
 * they should. Replacing six hardcoded names with four would be the same mistake with a shorter
 * list.
 *
 * So the loader reads whatever is in `charter/` — a project adding `charter/compliance.md` works
 * today and nothing here gates it. These four are the ones ProductOS can say something useful
 * about; `NOT_A_DOCUMENT` below is the only list with teeth, and it names what has a better home
 * rather than what is allowed. See PT-0003 for making the per-project half first-class.
 *
 * ⛔ AND THIS IS NOT A `kind` FIELD. Charter once had one; it was deleted because nothing read it,
 * with a note saying it would come back with its reader. A reader nearly appeared here — to tell a
 * design principle from a product rule — and it was the wrong answer: *"a self-check the lender
 * runs for its own benefit does not prevent the save"* is not a mislabelled principle, it is a
 * **Rule**, which the model already has. Labelling a misfiling is not fixing it.
 */
export const DOCUMENTS = ["goals", "principles", "personas", "voice"] as const;

export const NOT_A_DOCUMENT: Record<string, string> = {
  "non-goals":
    "a slot's `standing: out_of_scope` with this as the reason, a named `refuses` outcome, or the feature's `happy_path.not` — attached to what it constrains, where a reader actually meets it",
  decisions:
    "a `Verdict` — recorded by whoever decided, with their reason and what it replaced. In a document it carries no hash, so it reads as current forever after the thing it decided has moved",
};

/**
 * Something a person wants changed, addressed to whoever authors.
 *
 * ⛔ A NOTE IS NOT PRODUCT TRUTH, AND KEEPING THAT LINE IS THE WHOLE DESIGN.
 *
 * The five acts record a JUDGEMENT about truth: this is right, this is not ours, this is undecided.
 * A note records a REQUEST — "the tab strip should show the pinned version", "this sketch is out of
 * date", "this behaviour belongs on the other screen". It is a message, and until somebody acts on
 * it nothing about the product has changed.
 *
 * So it is deliberately not a `Verdict` and deliberately not a slot. Filed as either, a request
 * would read as a decision: a packet would ship "the tab strip should show the pinned version" as
 * something the product does, under whatever stamp happened to cover the slot it landed in.
 *
 * ⛔ `about` IS THE POINT. A reviewer looking at a screen and typing "this is wrong" has told you
 * almost nothing an hour later. The ref they were looking at is captured with the words, because
 * reconstructing it is the part nobody can do afterwards.
 */
/**
 * How a REQUEST arrived — ⛔ A DIFFERENT QUESTION FROM HOW CONSENT WAS OBTAINED, which is why this
 * is not `VIA`.
 *
 * `Verdict.via` asks *how was this person's agreement obtained*, and every value has to be a way a
 * human could have agreed. A note is not consent: it asks *how did this request reach us*, and two
 * of its answers have no meaning on a verdict at all —
 *
 *   `agent`   software asked for this change on its own behalf. A probe, or a session relaying.
 *   `review`  ⛔ NOBODY ASKED. A judge found it while reading and a session wrote it down. It owes
 *             `assumed`, and it is the one value the interviewer drafts questions from.
 *
 * ⛔ AND IT WAS THREE HAND-WRITTEN LISTS BEFORE THIS. `VIA` in acts.ts, one inline enum on the
 * reading, one on the note — and adding `review` to only the note's left the door validating
 * against `VIA`, so the value the schema accepted was refused one layer out: *"review is not a way
 * a request could have arrived"*, listing the five that are not it. Found by driving the door.
 */
export const NOTE_VIA = ["page", "question", "chat", "cli", "agent", "review"] as const;
export type NoteVia = (typeof NOTE_VIA)[number];

export const Note = z
  .object({
    id: z.string().min(1),
    /** What they were looking at: a scope, an exchange, a slot, a statement, or a view. */
    about: z.string().min(1),
    says: z.string().min(1, "an empty note is a click nobody can act on"),
    by: z.string().min(1),
    at: z.string(),
    /**
     * ⛔ Which surface it came from, for the same reason a verdict records it.
     *
     * ⛔ `review` IS NOT A SURFACE AND THAT IS THE POINT. The other four are places a PERSON was
     * standing. `review` says no person asked for this at all: a judge found it while reading, and
     * a session wrote it down. Peter's own worry about the queue was *"and what are those 6
     * requests, i did not send any requests"* — five probes rendered as five people asking him for
     * changes. A judge's finding filed as `chat` would be the same confusion with a hundred times
     * the volume, and the one thing a reader must be able to tell is whether somebody asked.
     */
    via: z.enum(NOTE_VIA),
    /**
     * What somebody would do if nobody answered this — ⛔ THE RISK, AND IT IS NOT THE FINDING.
     *
     * `productos-buildability` has said this from the day it was written: its output is *"the
     * questions somebody would hit in their first day, each with what they would probably assume if
     * nobody answered — because the assumption is the actual risk, not the question."* That second
     * half had nowhere to live, so every finding it ever produced arrived as prose and the part
     * carrying the risk was the part most easily dropped in the retelling.
     *
     * ⛔ AND IT IS WHAT MAKES A FINDING ANSWERABLE. An assumption is a candidate answer that nobody
     * chose — which is exactly the shape `Standing.candidates` wants, and the reason a stored
     * finding can become a question somebody picks between rather than an essay somebody rewrites.
     *
     * ⛔ REQUIRED ON A `review` NOTE. A reviewer that names a gap without saying what would happen
     * if it stayed open has filed a worry, not a finding — and a queue of worries is the thing
     * `decide` calls a decoration.
     */
    assumed: z.string().min(10).optional(),
    /**
     * ⛔ CLOSING A NOTE SAYS WHAT WAS DONE, or the queue becomes a list nobody trusts.
     *
     * `done` with no `outcome` is indistinguishable from a note somebody deleted because they did
     * not fancy it, and the next reader cannot tell which.
     */
    state: z.enum(["open", "done"]).default("open"),
    outcome: z.string().optional(),
    /**
     * ⛔ NOBODY IS WAITING ON THIS ONE — IT IS A SESSION CHECKING THAT WRITING WORKS.
     *
     * Peter, at a banner saying six requests were waiting: *"and what are those 6 requests, i did
     * not send any requests"*. He had not. Five of the six were another session's probes —
     * `staleness-probe-231153`, `concurrent-probe-005057`, `fingerprint-probe-011554`,
     * `fingerprint-probe2-011604`, `split-probe-172049` — written while it investigated a hung
     * write path, and rendered on his review surface as five people asking him for changes.
     *
     * ⛔ AND THE QUEUE WAS THE ONLY WRITABLE THING TO PROBE. A session testing whether an instance
     * can take a write has to write SOMETHING, and filing a request was the cheapest honest
     * option — so the pollution is the model's fault rather than that session's. This is the field
     * that lets a probe say what it is: counted nowhere, shown nowhere a person reviews, and still
     * a real write that exercises the whole path.
     *
     * ⛔ IT IS NOT A `kind`. `kind` says what is being asked about — the corpus or the framework —
     * and a probe asks about neither. Folding it in would make every reader of `kind` carry a
     * value that means "disregard", which is how a vocabulary starts lying.
     */
    probe: z.boolean().optional(),
    /**
     * ⛔ WHAT KIND OF THING IS BEING ASKED FOR — the corpus, or the framework that produced it.
     *
     * Peter: *"if i tag pos: {blah blah} in the message, that indicates a framework issue and to
     * fix the framework issue (agent setup), and you respond concisely that it has been updated or
     * fixed"*.
     *
     * The distinction already governs everything here — `CLAUDE.md` opens on it, the newcomer skill
     * routes on it, and getting it backwards is called out as costly in both directions. It had no
     * field: every note arrived looking like a corpus request, and which one it was got decided by
     * whoever read it, from the prose, differently each time.
     *
     * ⛔ SET FROM WHAT HE TYPED, NEVER INFERRED. A tag is a decision somebody made; a classifier
     * reading the sentence is a guess that looks like one.
     */
    kind: z.enum(["corpus", "framework"]).default("corpus"),
    /**
     * ⛔ A NOTE IS A CONVERSATION, NOT A REQUEST WITH A RECEIPT.
     *
     * Peter: *"let's add a 2-way window so you can send messages back as well"*. Before this the
     * only thing that could be said in reply was `outcome`, which closes the note — so every answer
     * was also a decision that the matter was finished, and anything short of that (a question, a
     * progress line, "this is a framework gap and here is why") had nowhere to go but a chat
     * window he is deliberately moving away from.
     */
    replies: z
      .array(
        z
          .object({
            by: z.string().min(1),
            at: z.string(),
            says: z.string().min(1, "an empty reply is worse than none — it reads as an answer"),
          })
          .strict()
      )
      .default([]),
    /**
     * ⛔ WHO IS WORKING ON IT, AND UNTIL WHEN — because a note is the only thing in this model that
     * two sessions can both pick up.
     *
     * A session on a laptop and one in the cloud both read the same inbox. Without a claim both
     * author the same note and the second overwrites the first, and neither of them ever finds out.
     * So reading the inbox takes a lease.
     *
     * ⛔ THE LEASE EXPIRES, and that is the whole reason it is a time and not a flag. A session that
     * dies mid-authoring would otherwise strand the request forever — the one failure the queue must
     * survive, because it is the one nobody is watching for. When it lapses the note comes back.
     *
     * ⛔ AND THE LEASE IS ON THE NOTE, NOT ON THE INBOX. Locking the feed would make a second
     * session useless when its entire value is being a second pair of hands.
     */
    claimed_by: z.string().optional(),
    claimed_until: z.string().optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    /**
     * ⛔ A REVIEW FINDING OWES ITS ASSUMPTION, and a note that owes nothing is a worry.
     *
     * The one thing that makes a judge's finding worth a person's attention is what happens if it
     * stays open — `buildability`'s own brief: *"the assumption is the actual risk, not the
     * question"*. Without it a reader has a gap named at them and no way to weigh it, and the
     * interviewer has nothing to draft an option from.
     *
     * ⛔ REFUSED RATHER THAN NOTED, because the alternative is a queue that fills with reviewer
     * observations nobody can act on — which is how 1,560 real questions came to be invisible
     * behind noise once already.
     */
    if (n.via === "review" && !n.assumed)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assumed"],
        message:
          "a review finding has to say what somebody would assume if nobody answered it — that is the risk, and without it this is a worry rather than a finding",
      });
    /** ⛔ And the converse: nobody but a reviewer is in a position to say what a builder would assume. */
    if (n.assumed && n.via !== "review")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assumed"],
        message: `"assumed" is what a reviewer found somebody would do unasked — on a note from ${n.via} it would be putting words in the mouth of whoever filed it`,
      });
    if (n.state === "done" && !n.outcome)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcome"],
        message: "say what was done about it — a closed note with no outcome cannot be told apart from one that was dropped",
      });
    /**
     * ⛔ A HALF-WRITTEN LEASE IS WORSE THAN NONE. A claim with no expiry strands the note the first
     * time the session holding it dies, and an expiry with no claimant cannot say who to ask.
     */
    if (Boolean(n.claimed_by) !== Boolean(n.claimed_until))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claimed_until"],
        message: "a claim is a name and an expiry — one without the other is a note nobody can get back",
      });
  });
export type Note = z.infer<typeof Note>;

/**
 * ⛔ WHAT A PROJECT KNOWS THAT IS NOT A CLAIM ABOUT THE PRODUCT.
 *
 * Peter: *"we need a 'framework way' to track more context about a project, like design system
 * concepts, feedback given, etc. some stuff should be opaque and auto-training, while others are
 * made obvious in product OS"*.
 *
 * Every piece of context this project accumulated had one of two fates before this: it became a
 * sentence in a corpus, where it had to be agreed to and could be wrong — or it lived in a session
 * and died with it. Neither fits a design system, a naming habit, or "he rejects screens with more
 * than three required fields". Those steer the work without being claims anybody validates.
 *
 * ⛔ THE SPLIT IS BY WHAT IT STEERS, which is Peter's own cut:
 *
 *   generation  — how a thing gets MADE. Idiom, layout habits, what gets rejected and why. Opaque:
 *                 it shapes what the authors propose and no reviewer agrees to it, because there is
 *                 nothing here a person could be wrong about. It is a record of taste, not truth.
 *   truth       — a CLAIM about the product. Principles, constraints, decisions. Surfaced on the
 *                 page, because somebody can disagree with it, and a constraint nobody can see is a
 *                 constraint that gets broken by the next person.
 *
 * ⛔ AND IT IS NOT A VERDICT, EVER. A steer that steers generation has no standing, no acceptance
 * and no `via` — it never counts as somebody having agreed to anything. The moment one of these
 * starts carrying weight in a gate, it has become product truth and belongs in a scope.
 */
export const Steer = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a steer id is one segment, kebab-case"),
    says: z.string().min(10, "a steer nobody can read steers nothing"),
    steers: z.enum(["generation", "truth"]),
    /**
     * ⛔ WHERE IT CAME FROM, REQUIRED ON ANYTHING LEARNED. A pattern inferred from what somebody
     * accepted is only trustworthy if the next person can go and look at what it was inferred from.
     * An opaque steer with no provenance is a rule nobody can argue with and nobody chose.
     */
    learned_from: z.string().min(3).optional(),
    /**
     * ⛔ WHO THIS REACHES — A ROLE, A DISCIPLINE, OR BOTH. Empty means every author.
     *
     * Peter: *"shouldn't steer be based on the author, not discipline? or both, rather?"* — both,
     * and the two are for different things:
     *
     *   a role       — the habit is about that role's craft. "Triggers are named in product
     *                  language" is the machinist's, and is noise to anybody else.
     *   a discipline — the habit is about the seat. "Never name the substrate" is engineering's,
     *                  and ⛔ it reaches authors that do not exist yet. Scoping that one to the
     *                  roles present on the day it was written would have silently stopped applying
     *                  the moment a new engineering author landed, and nothing would have said so.
     *
     * ⛔ AND THE NAMES ARE NOT VALIDATED HERE, DELIBERATELY. A role can be renamed or retired, and
     * a schema that refuses an unknown one would take every corpus steering it OFFLINE rather than
     * merely wrong — which is exactly what `walked` did to two files in this repo, and why a
     * document migration had to exist at all. `check` reports a target that reaches nobody; the
     * verb that writes one refuses it up front. A corpus already holding one degrades to a finding.
     */
    for: z.array(z.string()).default([]),
    /**
     * ⛔ WHETHER ANYBODY HAS LOOKED AT THIS YET — AND IT IS NOT A GATE.
     *
     * Peter, asked how a learned habit should land: *"In force immediately"*. So a habit noticed
     * from what people did is steering authors before anybody has read it, which is the one real
     * cost of that choice: *a constraint nobody chose* is the phrase this whole concept is
     * organised against, and in-force-on-arrival is exactly how you get one.
     *
     * ⛔ So the answer is visibility, never permission. This records that somebody has SEEN it. It
     * does not decide whether it steers — removing it would change what a page shows and nothing
     * about what any author is told. Making it a gate would quietly turn the choice above back into
     * the other option, which is the kind of reversal nobody would notice in a diff.
     *
     * Absent means new. Refusing it on a hand-written steer would be noise: somebody who typed one
     * has by definition seen it, so this is only ever interesting on something learned.
     */
    acknowledged: dateish.optional(),
    at: dateish,
    /**
     * ⛔ TURNED OFF, AND WHY — BECAUSE OTHERWISE IT COMES STRAIGHT BACK.
     *
     * A learned steer is noticed from a pattern in what somebody corrected. So deleting one that
     * turned out to be wrong does not end it: the pattern it was drawn from is still sitting in the
     * record, and the next scan learns it again. Declining is how a person says "I saw this and it
     * is not a rule here", in a form the noticer can read.
     *
     * ⛔ And it carries the reason, for the same argument `waived` on a change record carries one: a
     * decline with no argument is indistinguishable from a steer nobody got round to, and the next
     * person cannot tell which.
     */
    declined: z.string().min(3).optional(),
  })
  .strict()
  .superRefine((x, ctx) => {
    /**
     * ⛔ A CLAIM ABOUT THE PRODUCT IS SOMEBODY'S, NOT SOMETHING THAT ACCUMULATED. Where it steers
     * TRUTH, a person said it — so it may not also claim to have been learned, which would make a
     * constraint on the product into a pattern nobody put their name to.
     */
    if (x.steers === "truth" && x.learned_from)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["learned_from"],
        message:
          "a steer that constrains the product is somebody's decision, not a pattern noticed — say who decided it, or file it as steering generation",
      });
    /**
     * ⛔ DECLINING IS FOR A PATTERN, NOT FOR A CLAIM. Turning off something that steers TRUTH is
     * withdrawing a constraint on the product, which is a verdict — it belongs in a scope, where it
     * can be argued with and where something records who withdrew it. Letting it happen here would
     * make a line in a settings file into a quiet retraction of product truth.
     */
    if (x.steers === "truth" && x.declined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["declined"],
        message:
          "a constraint on the product is withdrawn where it was agreed to, not turned off in settings — take it out of the charter, or file it as steering generation",
      });
  });
export type Steer = z.infer<typeof Steer>;

export const SteersFile = z.object({ steers: z.array(Steer).default([]) }).strict();

/**
 * ⛔ WHO MAY — AS A THING THE PRODUCT HAS, NOT A SENTENCE EACH FEATURE WRITES AGAIN.
 *
 * Peter, reading a `may` slot that said *"Anybody in the organization whose role lets them create
 * deals here"*: *"we should probably solidify 'roles/permissions' as a cross-product concept, and
 * enumerate which permissions can access it. and at the top level we can configure whether we use
 * roles, permissions, or nothing like that."*
 *
 * That sentence is the tell. It is prose standing where a concept should be: it names a role
 * without naming it, cannot be checked, cannot be listed, and is retyped slightly differently on
 * every exchange in the product — so "which features can an underwriter reach" was a question
 * nobody could answer except by reading everything and trusting four spellings of the same idea.
 * `CLAUDE.md` names this exact shape: when something true has nowhere to live, add the field.
 *
 * ⛔ AND NOT EVERY PRODUCT HAS THEM. A single-user tool has no roles and a `may` naming one would be
 * an invention; forcing the concept everywhere is how a framework starts making products describe
 * themselves in its vocabulary rather than their own. So the product says which model it uses —
 * `access:` in the corpus's config — and the checks follow that answer rather than assuming one.
 */
export const AccessKind = z.enum(["role", "permission"]);
export type AccessKind = z.infer<typeof AccessKind>;

export const Access = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "an access id is one segment, kebab-case"),
    kind: AccessKind,
    /** What somebody holding it is thereby able to do, in product language. */
    means: z.string().min(10, "say what holding this lets somebody do — a name alone is not a definition"),
    /**
     * ⛔ A ROLE IS A BAG OF PERMISSIONS, AND SAYS SO. Without this, a product using both has roles
     * whose contents live in whichever exchanges happen to name them — so removing a permission
     * from a role is a search-and-replace, and nobody can tell what a role grants without reading
     * the whole corpus. Empty on a permission, and refused there.
     */
    holds: z.array(z.string()).default([]),
    /**
     * ⛔ WHO DECIDES WHO HOLDS IT, where that is not this product. An access name the product
     * cannot grant is one somebody will look for a screen to manage and not find.
     */
    granted_by: z.string().optional(),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (x.kind === "permission" && x.holds.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["holds"],
        message: "a permission holds nothing — only a role is a bag of permissions. Make this a role, or drop `holds`",
      });
  });
export type Access = z.infer<typeof Access>;

export const AccessFile = z.object({ access: z.array(Access).default([]) }).strict();

/**
 * ⛔ WHAT THIS PRODUCT LOOKS LIKE, CARRIED BY THE CORPUS ITSELF.
 *
 * Peter: *"we've now moved to a docker hosted/neon database backed copy. let's update the design
 * there."*
 *
 * A drawing is written in the application's own class names, so it needs the application's own
 * stylesheet or it is a drawing of some other product. That stylesheet used to be read off disk at
 * render time, from paths in `productos/config.yaml` — which worked exactly as long as a repo was
 * sitting beside the corpus. An instance materializes a project into a temp directory with no repo
 * above it, so every hosted drawing rendered unstyled: forty-four mocks in bilrost's class names
 * and not one byte of bilrost's CSS. Measured, not inferred.
 *
 * ⛔ IT IS A SNAPSHOT, AND THAT IS THE POINT. `web.stylesheets` says where the bytes are TAKEN
 * FROM; this is where they LIVE. Same relationship a drawing has to the component it was drawn
 * from — generated, re-taken when the design system moves, and never hand-written. A corpus that
 * needed a checkout beside it to be looked at could only be reviewed by somebody holding the
 * repository, which is the thing hosting it exists to end.
 *
 * ⛔ AND IT IS WHY LOCAL AND HOSTED CANNOT DIVERGE. One source at render time, for both. A renderer
 * that read disk where it could and the corpus where it could not would be two products that look
 * the same until somebody publishes one.
 */
/**
 * One way through the product, with its own front door and its own chrome.
 *
 * ⛔ A PRODUCT HAS SEVERAL, AND ASSUMING ONE WAS THE MISTAKE. The walk was built as "the product,
 * walked" — one start, one shell. Peter: *"we can have different prototypes for differnet
 * prototypes.. like 'unauthenticated' could be a flow, and CRE vs private lending"*.
 *
 * He is right, and the clearest case proves it: an unauthenticated flow has no application menu at
 * all. A single shell for the whole product would put the signed-in navigation around a sign-in
 * screen, which is not a drawing of anything. Two lending businesses that share a codebase are the
 * same argument one level up — they are different products to the person using them, and a
 * prototype that mixes their screens is a walk nobody takes.
 *
 * ⛔ IT NAMES A START, BECAUSE A PROTOTYPE OPENS SOMEWHERE. Without one the walk sorted its screens
 * and opened on whichever came first — Peter: *"and it just starts at 'sizing results' ?? hahahah"*.
 * Sorting is not a product decision and should never look like one.
 */
export const Prototype = z
  .object({
    id: z.string(),
    title: z.string(),
    /** `<scope>#<view>` — the screen a person comes in on. */
    starts_at: z.string(),
    /**
     * A route whose LAYOUTS are this prototype's chrome.
     *
     * ⛔ THE LAYOUTS, NOT THE PAGE. Composing a page and cutting its content out afterwards bakes
     * one screen's markup into the frame every other screen then wears.
     */
    shell_from: z.string().optional(),
    /** The drawn chrome, with `<!--screen-->` where the screen goes. Output — never hand-written. */
    shell_html: z.string().optional(),
    /**
     * The chrome's own menu, each item pointed at the screen it names where one is unambiguous.
     *
     * ⛔ THIS IS THE PRODUCT'S OWN STATEMENT OF HOW TO GET AROUND ITSELF, and it is a far better
     * source than inference: `connect` reads a control's sentence and guesses, and on the corpus
     * this was built against it found four links across seventeen screens. A menu names its areas
     * outright, in one place, in the product's own words.
     */
    nav: z
      .array(z.object({ label: z.string(), to: z.string().optional() }).strict())
      .default([]),
    /**
     * This prototype's answer on each axis the set splits on — `{ <axis id>: <answer> }`.
     *
     * ⛔ SEVERAL AXES, BECAUSE ONE WAS WRONG THE DAY IT SHIPPED.
     *
     * Peter: *"It's going to split on different products - CRE vs private lending, then also on
     * roles"*. A single `is:` could say "CRE" or "admin" and never both, so the first real use of
     * this model would have had to fold two independent facts into one string — "CRE admin" — and
     * from there nothing can answer *which prototypes cover private lending* or *is there an admin
     * view of every product line*, which are the only questions a split like that is for.
     *
     * ⛔ THE ANSWER, NOT THE NAME. "CRE — loan processor" is a title somebody wrote for a reader;
     * `is: { line: CRE, role: loan processor }` is where this one sits. A chooser built from titles
     * alone cannot tell you that two of five prototypes are the same combination, or that nothing
     * covers signed-out.
     *
     * ⛔ A PLAIN STRING IS STILL ACCEPTED, and means the first axis. Corpora were written against
     * the single-axis form within the hour, and a schema that refuses them turns an improvement
     * into a migration somebody has to be told about.
     */
    is: z.union([z.string(), z.record(z.string())]).optional(),
    /** Which layout files it was drawn from, so a reader can go and look. */
    from: z.array(z.string()).default([]),
    drawn_at: z.string().optional(),
  })
  .strict();
export type Prototype = z.infer<typeof Prototype>;

/**
 * The file a corpus keeps its prototypes in — one home, beside `style.yaml`.
 *
 * ⛔ THE SET HAS A QUESTION AT ITS ROOT, AND THE PROJECT CHOOSES WHAT IT IS.
 *
 * Peter: *"we should have a first class "prototype selection' at the root of prototypes. the
 * multiple prototypes should be supported by the framework - what it splits on should be up to the
 * project/user driving it"*.
 *
 * Several prototypes were already expressible, and the surface rendered them as a row of unlabelled
 * buttons that appeared only when there was more than one — so the one thing a reader needed was the
 * one thing nothing recorded: what these are alternatives ABOUT. A product split by role, a product
 * split by whether you have signed in, and a product split by line of business are three different
 * claims, and all three looked identical.
 *
 * ⛔ AND IT IS NEVER INFERRED. A classifier reading two titles and guessing "role" would be a guess
 * wearing a decision's clothes — the same objection as `Note.kind`. The axis is a product decision,
 * so it is stated in the project's own words or it is absent, and `check` says which.
 */
export const PrototypeFile = z
  .object({
    /**
     * The dimensions this product's prototypes split on, named by the project — in order.
     *
     * ⛔ A LIST, NOT A SENTENCE. Peter: *"It's going to split on different products - CRE vs private
     * lending, then also on roles"*. Two independent facts about a prototype, and one string could
     * hold only one of them.
     *
     * ⛔ AND EACH ONE CARRIES ITS VALUES, WHICH IS WHAT MAKES THE SURFACE A SELECTOR.
     *
     * Peter: *"let's allow users to specify their own dimensions for the prototype - 'role', as an
     * example, and 'product line' as another, and let them specify the values"*, then *"they should
     * be able to select the appropriate dimensions and that will bring up the right prototype"*.
     *
     * Without values there is nothing to choose BETWEEN: a reader got one button per declared
     * prototype, which is a list of what exists rather than a way of asking for what they want. He
     * looked at it and said *"wtf is this? this doesn't seem like a selector of any kind, seems like
     * a barf of information"* — correctly. With values, the surface is one control per dimension,
     * and the combination picks the prototype.
     *
     * ⛔ AND A COMBINATION NOTHING COVERS IS THE MOST USEFUL THING IT CAN SHOW. Four values across
     * two dimensions is four possible products; three prototypes means one of them does not exist,
     * and that was invisible when the surface could only list what had been declared.
     *
     * `label` is the dimension's NAME, shown to a reader — "Role", "Product line". ⛔ Never derived
     * from `id`: a surface that title-cased `line` into a label would be putting words in the
     * project's mouth, and the id is a handle rather than a name.
     */
    splits_on: z
      .union([
        /** ⛔ One sentence still parses, and means a single dimension. See `Prototype.is`. */
        z.string(),
        z.array(
          z
            .object({
              id: z.string().min(1),
              label: z.string().min(1),
              /**
               * What this dimension can be. ⛔ Empty is honest — a dimension somebody has named and
               * not filled in — and `check` says so rather than this refusing a half-authored file.
               */
              values: z.array(z.string().min(1)).default([]),
            })
            .strict()
        ),
      ])
      .optional(),
    prototypes: z.array(Prototype).default([]),
  })
  .strict();

/** A dimension, however the file spelled it. One shape for every reader. */
export interface Axis {
  id: string;
  label: string;
  values: string[];
}

/**
 * The dimensions, however the file spelled them.
 *
 * ⛔ VALUES FALL BACK TO WHAT THE PROTOTYPES ACTUALLY SAY, so a corpus written before dimensions had
 * values still gets a working selector instead of empty dropdowns. Declared values win where they
 * exist: the point of declaring them is to be able to name a combination NOTHING covers, which is
 * invisible if the list is only ever read back off what has been declared.
 */
export function axesOf(
  splitsOn: string | Array<{ id: string; label: string; values?: string[] }> | undefined,
  prototypes: Array<{ is?: string | Record<string, string> }> = []
): Axis[] {
  if (!splitsOn) return [];
  const listed = typeof splitsOn === "string" ? [{ id: "split", label: splitsOn }] : splitsOn;
  return listed.map((ax, i) => {
    const declared = (ax as { values?: string[] }).values ?? [];
    if (declared.length) return { id: ax.id, label: ax.label, values: declared };
    const seen: string[] = [];
    for (const p of prototypes) {
      const said = typeof p.is === "string" ? (i === 0 ? p.is : undefined) : p.is?.[ax.id];
      if (said && !seen.includes(said)) seen.push(said);
    }
    return { id: ax.id, label: ax.label, values: seen };
  });
}

/** A prototype's answers, however its `is` was spelled, keyed by axis id. */
export function answersOf(
  is: string | Record<string, string> | undefined,
  axes: Array<{ id: string; label: string }>
): Record<string, string> {
  if (!is) return {};
  if (typeof is === "string") return axes[0] ? { [axes[0].id]: is } : { split: is };
  return is;
}

export const Style = z
  .object({
    /**
     * The scheme this project wears — chosen with `v2 style --wear`, carried across every re-take.
     * or point at the file where the application declares it.
     */
    theme: z.string().optional(),
    /** Class the app's CSS expects around its own markup, from `web.mock_container_class`. */
    mock_class: z.string().optional(),
    /**
     * ⛔ WHAT WAS READ, AND WHAT IT SAID WHEN IT WAS READ — so a snapshot can be caught being old.
     *
     * Peter: *"we should have something that keeps the design libraries in sync."* A copy with no
     * fingerprint of its source cannot be: it looks identical the day it is taken and the year
     * after, and the only symptom of a stale one is that every drawing is of a product that has
     * moved on. The digest is what lets `check` say the design system has changed, wherever the
     * repository is still reachable — and say nothing at all where it is not, which is the hosted
     * case and is not a defect.
     */
    sources: z
      .array(
        z
          .object({
            path: z.string(),
            sha: z.string(),
            bytes: z.number(),
            /**
             * ⛔ WHEN THE FILE WAS WRITTEN, WHICH FOR A BUILD OUTPUT IS WHEN THE APP WAS LAST BUILT.
             *
             * A digest says the bytes changed. It cannot say the bytes are OLDER THAN THE CODE they
             * were compiled from, and a utility-first stylesheet only contains the classes that
             * existed at build time. The bilrost build was from 24 July and the components had moved
             * on for two months: `-left-5` was written after it, so there was no `.-left-5` rule,
             * so a positioned ribbon fell back to `left: auto` and painted down the middle of the
             * deal workspace. Nothing anywhere said the stylesheet was two months behind — the class
             * was simply absent, and the drawing looked wrong for no stated reason.
             */
            built_at: z.string().optional(),
          })
          .strict()
      )
      .default([]),
    /** When it was taken. A drawing carries the commit it came from; this carries the day. */
    taken_at: z.string().optional(),
    /** Faces carried into the bytes, so "the type is the product's type" is checkable. */
    faces: z.array(z.string()).default([]),
    /**
     * ⛔ NAMED IN THE STYLESHEETS AND NOT CARRIED. A face that could not travel falls back silently
     * and every drawing is then set in some other product's type; a snapshot that did not record
     * the gap would look complete.
     */
    unreachable: z.array(z.string()).default([]),
    /** The schemes the stylesheets define, so "none was chosen" is distinguishable from "none exists". */
    offers: z.array(z.string()).default([]),
    /**
     * The bytes — every named stylesheet concatenated in cascade order, with its faces inlined.
     *
     * ⛔ NOT YET SCOPED FOR A SHADOW ROOT. Scoping depends on the surface doing the rendering and
     * on the container class it wraps a mock in; baking it in here would make the snapshot right
     * for one renderer and quietly wrong for the next. The faces ARE inlined, because those are
     * files that will not exist wherever this is read.
     */
    css: z.string().default(""),
  })
  .strict();
export type Style = z.infer<typeof Style>;

export const StyleFile = z.object({ style: Style }).strict();

export const ScopeFile = Scope;
export const RulesFile = z.object({ rules: z.array(Rule).default([]) }).strict();
export const CharterFile = Charter;
export const ReadingsFile = z.object({ readings: z.array(Reading).default([]) }).strict();
export const VerdictsFile = z.object({ verdicts: z.array(Verdict).default([]) }).strict();
export const NotesFile = z.object({ notes: z.array(Note).default([]) }).strict();
