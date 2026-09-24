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
export const REF_MESSAGE =
  "a reference is a rule id, or <scope>#<exchange>[#<slot>[#<case>]] — nothing else addresses anything";


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
export const Statement = z
  .object({
    id: z.string().regex(new RegExp(`^${SEGMENT}$`), "a statement id is one segment, kebab-case"),
    says: z.string().min(10, "a statement nobody can read is not worth agreeing to"),
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
            replaces: z.enum(["the whole sentence", "only the part in question"]).optional(),
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
  if (!settled && context.hasContent && !s.about)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...at, "about"],
      message: `this ${context.what} says something AND carries an unsettled standing — say which part of it is in question, or the whole sentence reads unruled and every surface discards it`,
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
    standing: Standing.default({ kind: "stated" }),
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
    /** `refuses: none` and `cannot_fail` are real, distinct, statable answers — which is how
     *  latitude reaches a builder by declaration rather than by absence. */
    none: z.boolean().optional(),
    cannot_fail: z.string().optional(),
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
        follows: z
          .string()
          .regex(REF_PATTERN, REF_MESSAGE)
          .optional()
          .describe("<scope>#<exchange> — the ask this one follows"),
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
    at: z.object({ view: z.string(), part: z.string().optional() }).strict().optional(),
    exists: z.enum(["intended", "kept", "withdrawn"]).optional(),
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
    if (e.asked_by === "person" && !e.at?.view) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["at"],
        message: "a person-asked exchange must say which view the ask arrives at",
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
      { field: "none", slots: ["refuses", "after"], means: "there is nothing to refuse, or nothing is different afterwards" },
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

export const Part = z
  .object({
    id: z.string(),
    role: PartRole,
    label: z.string().optional(),
    leads_to: z.string().optional(),
    decorative: z.boolean().optional(),
  }).strict()
  .superRefine((p, ctx) => {
    if (p.role === "navigates" && !p.leads_to && !p.decorative) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leads_to"],
        message: `"${p.label ?? p.id}" navigates and says nowhere — a reader cannot follow it and an engineer will guess`,
      });
    }
    if (p.role === "commits" && p.leads_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leads_to"],
        message: `"${p.label ?? p.id}" commits work — where it lands afterwards is part of the answer slot, not a link`,
      });
    }
  });

export type Part = z.infer<typeof Part>;

export const View = z.object({
  id: z.string(),
  title: z.string(),
  view_kind: z.string().optional().describe("form · list · detail · modal · strip — selectable by a Rule"),
  exists: z.enum(["intended", "kept", "withdrawn"]).optional(),
  /* ⛔ `runtime` REMOVED. Read by nothing, and what it meant was never written down. */
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
   * verify from the markup that the dash is really in it. That is what `walked` is for — a person
   * confirming the screen holds what it says. This closes the gap between "there is a picture" and
   * "the picture shows the thing", which is where thin drawings lived.
   */
  shows: z.array(z.string()).default([]),
  /** ⛔ Not "I didn't feel like sketching" — it means nobody walked the screen, and it
   *  blocks readiness. */
  walked: z.boolean().default(false),
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
    if (!undecided && !r.criteria.some((c) => c.kind === "conformance")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criteria"],
        message:
          "a rule needs at least one conformance criterion — without one it is an aspiration that fills a slot and demonstrates nothing",
      });
    }
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
  exchanges: z.array(Exchange).default([]),
  /** Migration alias — what this was called in v1. */
  was: z.string().optional(),
}).strict();
export type Scope = z.infer<typeof Scope>;

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
    kind: z.enum(["code", "test-run", "screen", "series", "trial", "interview", "support"]),
    ref: z.string().min(3),
    quote: z.string().optional(),
    at: dateish.optional(),
    by: z.string().optional(),
  }).strict(),
  /* ⛔ `series` REMOVED. It was declared, read by nothing, and the only thing it could have
   * held — a metric over time — belongs to the operational half of the roadmap that does not
   * exist yet. A field waiting for a feature is a field authors fill in wrong. */
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
     */
    via: z.enum(["page", "question", "chat", "cli"]),
    covers_slots: z.string().optional(),
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
export const Note = z
  .object({
    id: z.string().min(1),
    /** What they were looking at: a scope, an exchange, a slot, a statement, or a view. */
    about: z.string().min(1),
    says: z.string().min(1, "an empty note is a click nobody can act on"),
    by: z.string().min(1),
    at: z.string(),
    /** ⛔ Which surface it came from, for the same reason a verdict records it. */
    via: z.enum(["page", "question", "chat", "cli"]),
    /**
     * ⛔ CLOSING A NOTE SAYS WHAT WAS DONE, or the queue becomes a list nobody trusts.
     *
     * `done` with no `outcome` is indistinguishable from a note somebody deleted because they did
     * not fancy it, and the next reader cannot tell which.
     */
    state: z.enum(["open", "done"]).default("open"),
    outcome: z.string().optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    if (n.state === "done" && !n.outcome)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcome"],
        message: "say what was done about it — a closed note with no outcome cannot be told apart from one that was dropped",
      });
  });
export type Note = z.infer<typeof Note>;

export const ScopeFile = Scope;
export const RulesFile = z.object({ rules: z.array(Rule).default([]) }).strict();
export const CharterFile = Charter;
export const ReadingsFile = z.object({ readings: z.array(Reading).default([]) }).strict();
export const VerdictsFile = z.object({ verdicts: z.array(Verdict).default([]) }).strict();
export const NotesFile = z.object({ notes: z.array(Note).default([]) }).strict();
