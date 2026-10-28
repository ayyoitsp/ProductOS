/**
 * Answering a question — the act that was missing.
 *
 * ⛔ THE MECHANISM EXISTED AND THE MOTION DID NOT, WHICH IS TENET 1'S OLDEST FAILURE HERE.
 *
 * Every piece was in place: a slot could stand `open`, `check` could find it, `acts` could
 * route it to an owner, and `Verdict kind: rule` could record a decision. What no surface
 * could do was let a person *answer one*. The ruling was recorded beside the truth and
 * never written into it, so the corpus went on asking a question its own verdict log said
 * had been settled — by the person being asked.
 *
 * Two things fix that, and only together:
 *
 *  1. **A ruling writes the slot.** The human supplies the choice; the tool applies it.
 *     Leaving the two apart created a limbo that made the honest act feel like it had no
 *     effect, and a mechanism with no visible effect stops being used.
 *  2. **It is per-scope, not a global queue.** A person reading one feature wants to
 *     settle that feature's questions while they hold its context. Sending them to a
 *     corpus-wide list means answering happens when somebody sets aside an afternoon for
 *     it, which is never.
 *
 * ⛔ On the obvious objection — is this a tool that writes product truth? The sentence
 * comes from a person, or from a drafted candidate a person picked. What is refused is a
 * model deciding, and that is held by the boundary on the verdict commands: the CLI is the
 * human's surface, and MCP exposes none of this.
 */
import fs from "node:fs";
import { parseFrontmatter } from "../core/frontmatter.js";
import YAML from "yaml";
import { Scope, Rule, SLOTS, type SlotName , saysText, statements, type Authorship, type NoteVia } from "./schema.js";
import { isHuman } from "./acts.js";
import { loadCorpus, resolveRules, selectsFor, lineageOf, type Corpus } from "./load.js";
import { resolveRef, HAPPY_PARTS } from "./ref.js";
/** ⛔ `grid.ts` imports nothing from here, so this is not a cycle — checked before moving `blankSlots`. */
import { gridFor } from "./grid.js";
import { removals, refuseBecause } from "./write.js";

import { confidenceOf, type Strength } from "./confidence.js";
/** ⛔ The hashing home — `readHash` is the primitive, the grain is resolved here, once. */
import { readHash } from "./stamp.js";

export interface Question {
  ref: string;
  scope: string;
  exchange: string;
  exchangeTitle: string;
  /**
   * ⛔ ABSENT ON A QUESTION ABOUT A WORD, because a word has no slot and inventing one would be a
   * guess wearing a decision's clothes. `Term.contested` exists precisely so a collision between
   * names has a home at the grain of the NAME — pinning it to some exchange's `answer` would put
   * the ruling in a place no other feature using that word would ever look.
   */
  slot?: SlotName;
  kind: string;
  /** The question, in whatever form the standing carries it. */
  asks: string;
  /**
   * Every wording this question has had before its current one, oldest first.
   *
   * ⛔ THE WHOLE SAFETY ARGUMENT FOR REWORDING RESTS ON THIS BEING SHOWN. `ask` may now say an
   * open question better, and the reason that is not "rewritten under somebody" is that what it
   * used to say survives — which is worth nothing if no surface renders it. The suite caught
   * exactly that: `was_asked` was written by an author and read by nothing.
   */
  wasAsked?: string[];
  /**
   * A person has said this question should not be asked as it stands — `Note.disputes`.
   *
   * ⛔ IT LIVES HERE BECAUSE `questionsFor` IS THE ONE HOME FOR "THIS IS A QUESTION", AND PUTTING IT
   * ANYWHERE ELSE MEANT ONE SURFACE KNEW AND THE REST DID NOT. I gated it in `interviewFor` first
   * and the PAGE went on offering both disputed questions under *"5 questions nobody has answered"*
   * — the page derives its own list from here, so the fix did not exist on the surface Peter
   * actually works on. He had rejected one of them three times.
   */
  disputed?: { note: string; said: string; by: string };
  /** What it costs to guess wrong, where the standing says. */
  cost?: string;
  owed?: string;
  /**
   * Drafted ANSWERS. ⛔ `says` is optional because `refuses` cannot take a sentence — an option
   * there carries named cases or `none`, which is why that slot was unsettleable by any command.
   */
  candidates: Array<{
    says?: string;
    consequence: string;
    replaces?: string;
    outcomes?: Array<{ name: string; when: string; told: string }>;
    none?: boolean;
  }>;
  /** Other slots recorded as waiting on this one. */
  blocks: string[];
  /** Parked by a person, and what brings it back. */
  parked?: { by: string; because: string; until: string };
  /**
   * ⛔ The sentence already agreed here, when only one thing ABOUT it is unruled.
   *
   * Without this, `decide` printed `--pick N` for such a slot and `rule` refused it — the tool
   * refusing the command it had just recommended, on the corpus's first question. A candidate
   * on a residual answers the residual, not the slot, so the act is a revision the person
   * authors and they need to see what they are revising.
   */
  revises?: string;
  /**
   * ⛔ THE STATEMENTS ONE BY ONE, because glued together they read as a single sentence a
   * ruling would replace entirely. A slot saying seven things rendered as one paragraph, under
   * "it already says", beside an option whose own `replaces` is `only the part in question` —
   * so choosing it looked like deleting the other six. `saysText` is right for hashing and
   * matching and wrong for showing somebody what they are about to change.
   */
  saysEach?: Array<{ says: string; inQuestion: boolean }>;
  /** What is unruled about the agreed sentence. */
  about?: string;
  /** Observations recorded against this exact question. */
  observed: Array<{ says: string; basis: string; at?: string }>;
  /** For a disputed standing — the slots or rules it cannot hold with. */
  conflictsWith: string[];
  /** ⛔ An org-wide ruling owes its demonstration in the same act, or it is an aspiration. */
  needsThen?: boolean;
  /** ⛔ A case asking `whether` needs a yes/no, because the answer decides whether it survives. */
  asksPolarity?: boolean;
  /** ⛔ Every option is a complete replacement sentence, so picking one is safe in one act. */
  candidatesAreWhole?: boolean;
}

/**
 * The command that answers one question — ⛔ `null` WHERE NO COMMAND CAN, AND THAT IS THE WHOLE
 * REASON THIS IS A FUNCTION RATHER THAN A TEMPLATE AT EACH CALL SITE.
 *
 * `v2 decide` worked this out inline and the reasoning is long, because four different facts about a
 * question change the verb it takes: a dispute wants `--stands`, an org-wide rule owes `--then` in
 * the same act, a case asking `whether` needs `--refuses yes|no`, and a residual on a multi-statement
 * slot decides whether `--pick` is safe or whether the whole sentence has to be written out.
 *
 * ⛔ AND A CONTESTED WORD HAS NO COMMAND AT ALL. `Term.contested` is `{question, with}`, strictly,
 * so there is nowhere for a candidate to go and no ref a verb accepts — the ref is `<scope>#<word>`
 * and a multi-word term is not one kebab-case segment. v2.ts records this biting twice: #148 minted
 * the ref shape, #153 printed `v2 rule` against it, and it fails with `no exchange "where a value
 * was read from"`. Answering it means choosing a sense and renaming the losing uses across files,
 * which is authoring and not an act.
 *
 * ⛔ SO IT IS EXTRACTED, BECAUSE A SECOND SURFACE REPRODUCED THE DEFECT IMMEDIATELY. `v2 interview`
 * printed `v2 rule <ref> --pick N` for every drafted question — which is wrong for a rule (no
 * `--then`), wrong for a dispute (no `--stands`), wrong for a `whether` case (no `--refuses`), and a
 * command that cannot work for a contested word. Four classes of broken advice, from one surface
 * re-deriving what another already knew, on the queue a reviewer meets first.
 */
export function rulingAct(q: Question, who = "<your name>"): string | null {
  /** ⛔ First, because everything below it assumes a ref a verb accepts. */
  if (q.kind === "contested word") return null;

  const stands = q.conflictsWith.length ? ` --stands this` : "";
  const then = q.needsThen ? ` --then "…what would show it holding…"` : "";
  const pol = q.asksPolarity ? ` --refuses yes|no` : "";
  const tail = `${stands}${then}${pol} --because "…" --by ${who}`;

  /**
   * ⛔ A RESIDUAL — one thing unruled ABOUT a sentence somebody agreed to. `--pick` is safe only
   * where an option is a whole replacement sentence, or where `of:` names the one statement it
   * replaces; otherwise picking deletes the siblings, which is the clause loss `--pick` exists to
   * prevent. See `write.ts` and `Standing.candidates`.
   */
  if (q.revises) {
    if (q.candidatesAreWhole) return `productos v2 rule ${q.ref} --pick N${tail}`;
    if ((q.saysEach ?? []).some((x) => x.inQuestion)) return `productos v2 rule ${q.ref} --pick N${tail}`;
    return `productos v2 rule ${q.ref} --says "…the whole sentence…"${tail}`;
  }
  if (q.candidates.length) return `productos v2 rule ${q.ref} --pick N${tail}`;
  /** Nothing drafted: it is answered by writing the sentence. Drafting is authoring, not an act. */
  return `productos v2 rule ${q.ref} --says "…"${tail}`;
}

/**
 * This scope and everything filed beneath it.
 *
 * ⛔ THE `in:` TREE WAS DECLARED AND UNIMPLEMENTED, AND IT REPORTED SUCCESS.
 *
 * `decide family-wallet` answered "✓ nothing undecided" over a corpus holding three unruled
 * slots, because the root scope has no exchanges of its own. `read family-wallet --buildable
 * yes` recorded a human saying they could build from it, on the same basis. A container that
 * answers for itself alone answers for nothing, since containers are exactly the scopes with
 * no exchanges.
 *
 * Containers nest without limit by design, so every per-scope surface has to mean
 * "this and everything under it".
 */
export function descendants(corpus: Corpus, scopeId: string): string[] {
  const out = [scopeId];
  for (let i = 0; i < out.length; i++)
    for (const { scope } of corpus.scopes)
      if (scope.in === out[i] && !out.includes(scope.id)) out.push(scope.id);
  return out;
}

const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

/** Every unsettled slot in one scope and everything beneath it, in reading order. */
/**
 * What `asks` means to the person reading the question — in product words, never the enum.
 *
 * ⛔ THE QUESTION USED TO DROP THIS ENTIRELY, and it is the part that makes the options legible.
 * A case question read *"The case \"already-paid\" — when the task has been paid once already — is
 * not ruled."* and then the drafter's sentence. Nothing said which of the case's three fields was
 * in question, so two options reading "it can be paid again" and "it still refuses" arrived with no
 * statement of what picking one DOES — and on `whether`, picking one retires the case outright.
 *
 * ⛔ IT MATTERS MOST HERE BECAUSE `about` NO LONGER CARRIES IT. A case states which part is unruled
 * with `asks`, not with prose about a sentence — see `refineStanding` and fg-0002. So the surface
 * that reads `about` and not `asks` shows a strictly thinner question than it did before.
 *
 * Peter, on a question with no context: *"what the fuck does this even mean? ... what's the context
 * of this fucking question? makes ZERO FUCKING SENSE"*. This is that complaint, one grain down.
 */
export const WHAT_IS_IN_QUESTION: Record<string, string> = {
  whether: "In question: whether it refuses here at all — so answering that it does not retires this case, and the words below stop being shown to anybody.",
  when: "In question: the condition. It does refuse; what is unruled is whether this is the right moment for it.",
  told: "In question: the words the asker reads. It refuses, and at the right moment — this is about how it is said.",
};

export function questionsFor(corpus: Corpus, scopeId: string): Question[] {
  const under = descendants(corpus, scopeId);
  const fromSlots = under.length > 1 ? under.flatMap((id) => questionsIn(corpus, id)) : questionsIn(corpus, scopeId);
  /**
   * ⛔ AN OPEN RULE IS A QUESTION ABOUT THIS SCOPE IF IT REACHES IT, and this walked exchanges
   * only.
   *
   * So the highest-leverage question a corpus can hold appeared in `check` and nowhere a person
   * would meet it: `decide money` reported nothing about a rule that was governing
   * `see-a-balance#answer`, and `read money --buildable yes` was accepted while it stood open.
   * The one question whose single ruling settles a whole class was the one the answering
   * surface did not know about.
   */
  const fromRules = openRuleQuestions(corpus, under);
  const fromTerms = openTermQuestions(corpus, under);
  /**
   * ⛔ ONLY `disputes: true`, AND ONLY FROM A PERSON. A judge's `review` note saying a question is
   * unclear is a finding to act on; a person saying it is nonsense withdraws the question. See
   * `Note.disputes` for why nothing reads the sentence to tell them apart.
   */
  const objected = new Map<string, { note: string; said: string; by: string }>();
  for (const n of corpus.notes) {
    if (n.state !== "open" || !n.about || n.disputes !== true) continue;
    if (!isHuman((n.via ?? "page") as NoteVia)) continue;
    if (!objected.has(n.about)) objected.set(n.about, { note: n.id, said: n.says, by: n.by });
  }

  /**
   * ⛔ STAMPED ON EVERY GRAIN AT ONCE — slot, case, rule and term alike. Doing it at each push site
   * is four chances to forget one, and the one forgotten is a disputed question that keeps being
   * offered on whichever surface reads that grain.
   */
  const all = orderByAttention(corpus, [...fromRules, ...fromTerms, ...fromSlots]);
  for (const q of all) {
    const no = objected.get(q.ref);
    if (no) q.disputed = no;
  }
  return all;
}

/**
 * The queue, worst use of somebody's attention last. ⛔ ORDERED, BECAUSE IT WAS NOT.
 *
 * Peter: *"still too much review surface."* Part of that is how many questions there are and part is
 * that they arrived in corpus order — so a statement four independent sources already agree about
 * competed for attention equally with one nothing supports. Both are "open"; they are not equally
 * worth a person's time.
 *
 * Least-supported first. A question with nothing behind it is the one where a human's answer is the
 * only thing that will ever settle it; a question with three sources agreeing can be shown with its
 * evidence and skimmed. ⛔ And it is an ORDER, never a filter: nothing is hidden on the strength of
 * inference, which would be the scale deciding what a person is allowed to be asked.
 *
 * ⛔ STABLE, so two runs over one corpus produce the same list. An unstable queue makes "have I seen
 * this" unanswerable, and a reviewer who cannot trust the order stops using it.
 */
const ATTENTION: Record<Strength, number> = {
  none: 0,
  "one-source": 1,
  corroborated: 2,
  "strongly-supported": 3,
};

export function orderByAttention(corpus: Corpus, questions: Question[]): Question[] {
  return questions
    .map((q, i) => ({ q, i, rank: ATTENTION[confidenceOf(corpus, q.ref).strength] }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.q);
}

/** Open rules whose selector reaches any exchange in these scopes. */
/**
 * A word somebody recorded as contested, asked of the person who can rule it.
 *
 * ⛔ `Term.contested` PARSED, WAS TESTED, AND NO SURFACE READ IT. Two authors found this
 * independently in one session: *"`v2 decide` listed six questions and not the seventh, which sat
 * on a term"*, and *"question 3 reaches nobody — somebody has to route it by hand"*.
 *
 * ⛔ AND THE FIELD WAS ADDED TO PREVENT EXACTLY WHAT CAME BACK. Its own comment records fg-0004: a
 * scoper found *version selection*, *model revision*, *master model version* and *input version*
 * used across four places for three distinct objects, and **left the collision out of truth
 * entirely** rather than settle it by writing a definition. `contested` gave that a home in the
 * schema — and `questionsIn` walks `scope.exchanges` only, so the home was write-only. A question
 * recorded where nobody is asked is the silence the field was built to end.
 */
export function openTermQuestions(corpus: Corpus, scopeIds: string[]): Question[] {
  const out: Question[] = [];
  const parked = new Map(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => [v.target!, v]));
  for (const { scope } of corpus.scopes.filter((x) => scopeIds.includes(x.scope.id))) {
    for (const [word, term] of Object.entries(scope.terms ?? {})) {
      if (!term?.contested) continue;
      const ref = `${scope.id}#${word}`;
      const put = parked.get(ref);
      out.push({
        ref,
        scope: scope.id,
        exchange: "(a word this corpus uses)",
        exchangeTitle: `The word "${word}"`,
        kind: "contested word",
        asks: [
          norm(term.contested.question),
          `It collides with: ${term.contested.with.join(", ")}.`,
          /**
           * ⛔ SAYING WHAT IT MEANS HERE, because the collision is only legible beside the sense
           * this scope committed to. "These three words disagree" without the definitions is the
           * feeling the schema comment warns about.
           */
          `Here it means: ${norm(term.means)}`,
          `Until it is ruled, every feature using any of those names is using one of them.`,
        ]
          .filter(Boolean)
          .join("\n"),
        candidates: [],
        blocks: [],
        parked: put ? { by: put.by, because: put.because!, until: put.until! } : undefined,
        revises: undefined,
        observed: [],
        conflictsWith: [],
      });
    }
  }
  return out;
}

export function openRuleQuestions(corpus: Corpus, scopeIds: string[]): Question[] {
  const out: Question[] = [];
  for (const { rule } of corpus.rules) {
    const s = rule.standing;
    if (!s || s.kind === "stated") continue;
    const reaches = corpus.scopes
      .filter((x) => scopeIds.includes(x.scope.id))
      .flatMap((x) =>
        x.scope.exchanges
          .filter((ex) => selectsFor({ ...rule, standing: undefined }, x.scope, ex, lineageOf(corpus, x.scope.id), corpus))
          .map((ex) => `${x.scope.id}#${ex.id}`)
      );
    if (!reaches.length) continue;
    out.push({
      ref: rule.id,
      scope: scopeIds[0]!,
      exchange: "(an org-wide rule)",
      exchangeTitle: `Every exchange like these: ${reaches.slice(0, 3).join(", ")}${reaches.length > 3 ? `, +${reaches.length - 3} more` : ""}`,
      slot: rule.fills[0]!,
      kind: `${s.kind} — org-wide`,
      asks: [
        norm(s.question),
        s.about ? `In question: ${norm(s.about)}` : "",
        `Answering it once settles ${rule.fills.join(" and ")} on ${reaches.length} exchange${reaches.length === 1 ? "" : "s"} here, and on every one written after it.`,
        /**
         * ⛔ TRUE OF A `supplies` RULE AND FALSE OF A `constrains` ONE, AND IT SAID IT OF BOTH.
         *
         * A `supplies` rule IS the answer where the slot is silent, so until it is ruled those
         * slots really are blank. A `constrains` rule adds a requirement to whatever the slot
         * already says — so the slots are not blank, they are answered and ungoverned.
         *
         * Reported by an author whose two `answer` slots say ten things and three things: *"the
         * reach itself is right for a `constrains` rule; the sentence about blanks is false and is
         * the first thing a reviewer reads about the feature."* A reviewer who believes it goes
         * looking for ten missing sentences that are sitting in front of them.
         */
        rule.mode === "supplies"
          ? `Until then it governs nothing, and those slots read as the blanks they are.`
          : `Until then it governs nothing — those slots say what they say, and nothing is holding them to it.`,
      ]
        .filter(Boolean)
        .join("\n"),
      cost: s.cost,
      owed: s.asked_of,
      candidates: s.candidates ?? [],
      revises: undefined,
      about: s.about,
      observed: corpus.readings
        .filter((rd) => rd.bears_on === rule.id)
        .map((rd) => ({ says: rd.observes, basis: `${rd.basis.kind}: ${rd.basis.ref}`, at: rd.basis.at })),
      conflictsWith: (s.targets ?? []).filter((x) => x !== rule.id),
      blocks: s.blocks ?? [],
      parked: (() => {
        const put = corpus.verdicts.find((v) => v.kind === "defer" && v.target === rule.id);
        return put ? { by: put.by, because: put.because!, until: put.until! } : undefined;
      })(),
      needsThen: true,
    });
  }
  return out;
}

function questionsIn(corpus: Corpus, scopeId: string): Question[] {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return [];
  const parked = new Map(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => [v.target!, v]));
  const out: Question[] = [];
  for (const ex of entry.scope.exchanges) {
    for (const [slot, fill] of Object.entries(ex.slots)) {
      if (!fill) continue;
      // ⛔ A named case nobody has ruled is offered for answering like anything else. The
      // whole point of recording it at outcome grain is that it stays a live question.
      for (const o of fill.outcomes ?? []) {
        const ok = o.standing?.kind ?? "stated";
        if (ok === "stated" || ok === "out_of_scope") continue;
        const s = o.standing!;
        out.push({
          ref: `${scopeId}#${ex.id}#${slot}#${o.name}`,
          scope: scopeId,
          exchange: ex.id,
          exchangeTitle: ex.title,
          slot: slot as SlotName,
          kind: `${ok} case`,
          asks: [
            `The case "${o.name}" — when ${o.when} — is not ruled.`,
            /** ⛔ The enum first: it says what picking an option DOES. See `WHAT_IS_IN_QUESTION`. */
            s.asks ? WHAT_IS_IN_QUESTION[s.asks] ?? "" : "",
            s.about ? `In question: ${s.about}` : "",
            s.asks === "told" ? `It says now: ${o.told}` : "",
            (s.candidates ?? []).length === 1 ? `Proposed: ${s.candidates![0]!.says}` : "",
            s.because ? `Because: ${s.because}` : "",
            s.question ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
          cost: s.cost,
          owed: s.asked_of,
          candidates: s.candidates ?? [],
          revises: undefined,
          wasAsked: s.was_asked,
          about: s.about,
          asksPolarity: s.asks === "whether",
          observed: [],
          conflictsWith: [],
          blocks: s.blocks ?? [],
          parked: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)
            ? {
                by: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.by,
                because: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.because!,
                until: parked.get(`${scopeId}#${ex.id}#${slot}#${o.name}`)!.until!,
              }
            : undefined,
        });
      }
      const k = fill.standing.kind;
      if (k === "stated" || k === "out_of_scope") continue;
      const s = fill.standing;
      const ref = `${scopeId}#${ex.id}#${slot}`;
      const put = parked.get(ref);
      out.push({
        ref,
        scope: scopeId,
        exchange: ex.id,
        exchangeTitle: ex.title,
        slot: slot as SlotName,
        kind: k,
        asks:
          k === "open"
            ? s.question!
            : `Cannot hold with ${(s.targets ?? []).join(", ")}. ${s.because ?? ""}`,
        cost: s.cost,
        owed: s.asked_of,
        /**
         * ⛔ A CANDIDATE'S `says` IS A BEHAVIOUR, WHICH IS NOW TRUE BY CONSTRUCTION.
         *
         * When competing interpretations lived in a separate `readings: string[]`, offering
         * them as pickable copied an ARGUMENT into the slot — *"a repeat is a mis-press,
         * because spending is usually entered once from a receipt…"* — which nobody can
         * implement. Folding that standing into `open` means each option's `says` is what
         * the product does and its `consequence` is the argument for it, so the two can no
         * longer be confused. A `proposal` is one such answer.
         */
        candidates: s.candidates ?? [],
        wasAsked: s.was_asked,
        revises: s.about ? saysText(fill.says) : undefined,
        /**
         * ⛔ AND IT MARKS WHICH ONE, because `standing.of` already names it and `settle` already
         * replaces only that statement, leaving its siblings byte-identical. The surface was the
         * one layer that did not know — so the information existed, was acted on correctly, and
         * was withheld from the person being asked to decide.
         */
        saysEach: s.about
          ? statements(fill.says).map((x) => ({ says: x.says, inQuestion: Boolean(s.of) && x.id === s.of }))
          : undefined,
        /**
         * ⛔ `of` WINS OVER WHAT A CANDIDATE CLAIMS, AND IT DID NOT — SO THE PAGE TOLD A READER THE
         * OPPOSITE OF WHAT THE BUTTON DOES.
         *
         * This read only the candidates' own `replaces`. But `settle` scopes the replacement by
         * `standing.of` when it is set: it rewrites that statement's `says` and leaves its siblings
         * byte-identical (fg-0008, forty lines down). So a standing with `of` AND candidates
         * declaring `the whole sentence` set this true, and the page then printed *"Each option is
         * the whole sentence, so picking one replaces it cleanly"* above two statements, one of them
         * marked `this one is unruled`.
         *
         * Read live off `deal-pricing#deal-pricing-grid#at_once` on a running instance. The
         * honest branch — *"Each option replaces the marked statement only. The others stand exactly
         * as they are."* — sits one `else if` below and was unreachable, because `candidatesAreWhole`
         * is tested first.
         *
         * ⛔ IT OVER-WARNS RATHER THAN DESTROYING ANYTHING, which is why nothing caught it: the
         * press is safe and the sentence describing it is wrong. A reviewer who cares about the
         * other statements declines to press — which is the failure the ⛔ above `saysEach` records
         * fixing, arriving through the flag instead of through the markup.
         *
         * Found by running the `interviewer` against a live instance for the first time.
         */
        candidatesAreWhole:
          !s.of &&
          (s.candidates ?? []).length > 0 &&
          (s.candidates ?? []).every((c) => c.replaces === "the whole sentence"),
        about: s.about,
        /**
         * ⛔ The corpus held the evidence for the question and withheld it at the moment of
         * deciding. A trial reading indexed on this exact ref — "both kids pressing the same
         * task was observed twice in a fortnight" — never reached the person being asked
         * whether two kids can complete one task.
         */
        observed: corpus.readings
          .filter((rd) => rd.bears_on === ref)
          .map((rd) => ({ says: rd.observes, basis: `${rd.basis.kind}: ${rd.basis.ref}`, at: rd.basis.at })),
        conflictsWith: (s.targets ?? []).filter((x) => x !== ref),
        blocks: s.blocks ?? [],
        parked: put ? { by: put.by, because: put.because!, until: put.until! } : undefined,
      });
    }
  }
  return out;
}

/**
 * Write a ruling into the slot it settles.
 *
 * ⛔ Round-trips the frontmatter through YAML, so the file is reformatted. Acceptable
 * only because v2 frontmatter carries no comments and no meaning in its layout — and it
 * is re-parsed and validated before anything is written, so a ruling can never leave a
 * file that will not load.
 */
/**
 * Which clauses of an agreed sentence a proposed replacement would drop.
 *
 * ⛔ EXTRACTED SO THE DRAFTER AND THE RULER ASK THE SAME QUESTION. It lived inside `settle` and
 * fired only when somebody tried to answer — so a question could be drafted whose every option was
 * unapplicable, worded beautifully, put in front of a person, answered, and refused.
 *
 * That happened. Peter answered three questions on `pl-start-a-deal` and **not one could be
 * recorded**: two had options declaring they replace "only the part in question" with nothing naming
 * the part, and the third offered a whole sentence that silently dropped two statements already
 * agreed — *"nothing they entered is lost"* and *"nothing is said about why"*. His reply on being
 * shown the result: *"so show me what truths changed based on my 3 answers"*. Nothing had.
 *
 * ⛔ IT IS A HEURISTIC AND THAT IS WHY IT ASKS ABOUT REMOVAL, NOT CORRECTNESS. It does not judge
 * whether a sentence is right — it asks whether the clauses that were agreed still appear. Anybody
 * may overrule it by writing the whole sentence they want.
 */
export function droppedClauses(wasSaying: string, says: string): string[] {
  return droppedFrom(
    wasSaying
      .split(/[,;—]| and (?=the |it |they )/)
      .map((c) => c.trim().replace(/^(and|then|so) /i, ""))
      .filter((c) => c.split(/\s+/).length >= 4),
    says
  );
}

/**
 * Which of several agreed units a replacement would drop — the same overlap test, any units.
 *
 * ⛔ SPLIT OUT BECAUSE THE UNITS ARE SOMETIMES ALREADY SPLIT, AND THAT CASE HAD NO GUARD AT ALL.
 * `droppedClauses` cuts a sentence on punctuation, which is a heuristic standing in for "the
 * things this slot promises". A slot whose `says` is a LIST does not need the heuristic: each
 * statement IS a unit, with its own id.
 */
export function droppedFrom(units: string[], says: string): string[] {
  const kept = says.replace(/\s+/g, " ").toLowerCase();
  return units.filter((c) => {
    const words = c.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = words.filter((w) => kept.includes(w)).length;
    return words.length >= 3 && hits / words.length < 0.5;
  });
}

export function settle(
  root: string,
  ref: string,
  says: string,
  by: string,
  at: string,
  because: string,
  /** ⛔ A person's declaration about a rule this sentence now answers where. Never inferred. */
  about: {
    defersTo?: string;
    insteadOf?: string;
    then?: string;
    refuses?: boolean;
    /** ⛔ For a `refuses` question: the named cases, which a sentence cannot express. */
    outcomes?: unknown[];
    none?: boolean;
    /**
     * ⛔ THE CHOSEN OPTION SAID IT ADDS A SENTENCE RATHER THAN REPLACING ONE — fg-0001.
     *
     * Passed in rather than read here, for the reason everything else in this bag is: the candidate
     * is resolved by `perform`, which is the only place that knows which option was picked. A second
     * resolution here would be a second answer to "what did they choose".
     */
    adds?: boolean;
  } = {},
  /**
   * Which hand supplied the words this is about to write.
   *
   * ⛔ PASSED IN, DERIVED FROM THE `via` `mayRecord` ALREADY GUARDS — never read from a flag and
   * never guessed here. `perform` computes it from the consent it was given, so the one boundary
   * that stops a token claiming a person AGREED is the same boundary that stops it claiming a
   * person TYPED. A second gate kept in step by hand is a gate that stops being in step.
   *
   * Optional, and absent writes nothing: the honest unknown, which is what every call made before
   * this existed meant.
   */
  wrote?: Authorship
): { ok: true; file: string; displaced: string[]; replaced?: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  // ⛔ Through the one resolver. Four call sites used to split on `#` and read index 2, and
  // three of them got the outcome grain wrong.
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  /**
   * ⛔ ONE PART OF A HAPPY PATH — THE ACT THAT DID NOT EXIST.
   *
   * `#happy-path` could be accepted and never revised. The interview asks *"is that what this is
   * for?"*; Peter answered *"The boundary is wrong"*, and there was nowhere for the correction to
   * go. Every other route records a decision about a SLOT, and a happy path is not one — so the
   * only way to change a word of it was `document`, a whole-file rewrite, which is exactly the
   * hand-authoring this project refuses.
   *
   * ⛔ IT TAKES A SENTENCE AND NOTHING ELSE. There is no standing on a happy path's parts, so none
   * of the slot machinery applies: no `about`, no `of`, no displacement, no clause-loss guard. What
   * makes it safe is the same thing that makes `accept` safe — agreement is recorded separately,
   * and changing the words puts the whole happy path back to unagreed, which `coveredBy` already
   * derives from the claim hash.
   */
  /**
   * ⛔ WRITING ONE WORD — THE ACT THAT COULD NOT EXIST, AND THE REASON IT COULD NOT.
   *
   * This file recorded the blocker itself: *"the ref is `<scope>#<word>` and a multi-word term is
   * not one kebab-case segment"*. So no intent could write a term, and when the interview asked
   * *"is it one thing?"* — the question the glossary work added — the answer had nowhere to go.
   * Peter: *"why can't an intent write a term?"* Nothing about it was impossible; `term:` prefixes
   * the slug, exactly as `#happy-path#<part>` had been given an address an hour before.
   *
   * ⛔ IT CREATES WHERE THE SCOPE DOES NOT DEFINE THE WORD, because that IS the act the glossary
   * needs: a word defined in one feature, moved UP to the product where every feature can see it.
   * The resolver only lets that through for a word somebody already defined somewhere — inventing
   * vocabulary from a typo is authoring, and authoring has its own door.
   */
  if (r.ref.kind === "term") {
    const { scope: scopeId, word } = r.ref as { scope: string; word: string };
    const entry = corpus.scopes.find((x) => x.scope.id === scopeId);
    if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
    const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
    const data = raw.data as { terms?: Record<string, { means?: string }> };
    const now = says.trim();
    if (!now) return { ok: false, why: `a word cannot be defined as nothing — say what "${word}" means` };
    data.terms ??= {};
    const was = String(data.terms[word]?.means ?? "").trim();
    if (was === now) return { ok: false, why: `"${word}" already says that in ${scopeId}` };
    data.terms[word] = { ...(data.terms[word] ?? {}), means: now };
    const check = Scope.safeParse(data);
    if (!check.success)
      return { ok: false, why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
    fs.writeFileSync(
      entry.file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: entry.file, displaced: [], replaced: was || undefined };
  }
  if (r.ref.kind === "happy-path") {
    const part = (r.ref as { part?: string }).part;
    if (!part)
      return {
        ok: false,
        why: `${ref} is the whole happy path — rule on one part of it: ${HAPPY_PARTS.join(", ")}`,
        detail: [
          "⛔ what a feature is for is agreed as one thing and corrected a sentence at a time, so a reader who disagrees with one part has something to press",
        ],
      } as { ok: false; why: string };
    const scopeId = (r.ref as { scope: string }).scope;
    const entry = corpus.scopes.find((x) => x.scope.id === scopeId);
    if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
    const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
    const data = raw.data as { happy_path?: Record<string, unknown> };
    if (!data.happy_path) return { ok: false, why: `nothing says what "${scopeId}" is for yet` };
    const was = String(data.happy_path[part] ?? "").trim();
    const now = says.trim();
    if (!now) return { ok: false, why: `a happy path's ${part} cannot be emptied by ruling on it` };
    if (was === now) return { ok: false, why: `${ref} already says that` };
    data.happy_path[part] = now;
    const check = Scope.safeParse(data);
    if (!check.success)
      return { ok: false, why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
    /** ⛔ The same idiom as every other write here — and the verdict is `perform`'s to record. */
    fs.writeFileSync(
      entry.file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: entry.file, displaced: [], replaced: was || undefined };
  }
  /**
   * ⛔ Answering an ORG-WIDE question. One ruling here settles every exchange the selector
   * reaches, including ones nobody has written yet, which is the whole argument for the rule
   * layer existing at all.
   */
  /**
   * ⛔ A shared refusal case, ruled at the grain it is unruled at.
   *
   * Same three questions as a slot's case — whether, when, or what the asker is told — and the
   * same rule for a negative `whether`: the case is retired rather than given a message saying
   * it does not refuse.
   */
  if (r.ref.kind === "rule-case") {
    const rule = corpus.rules.find((x) => x.rule.id === (r.ref as { rule: string }).rule)!;
    const caseName = (r.ref as { name: string }).name;
    const raw = parseFrontmatter(fs.readFileSync(rule.file, "utf-8"));
    const data = raw.data as Record<string, unknown>;
    const outcomes = (data.outcomes as Array<Record<string, unknown>> | undefined) ?? [];
    const o = outcomes.find((x) => x.name === caseName);
    if (!o) return { ok: false, why: `${rule.rule.id} names no case "${caseName}"` };
    const asks = ((o.standing as Record<string, unknown> | undefined)?.asks as string) ?? "told";
    const beforeCase = { ...o };
    let removed: string | undefined;
    if (asks === "whether" && about.refuses === undefined)
      return {
        ok: false,
        why: `"${caseName}" asks WHETHER it refuses — say which with --refuses yes|no, because the answer decides whether this case survives at all`,
      };
    if (asks === "whether" && about.refuses === false) {
      removed = `refuses ${o.name} when ${String(o.when).replace(/\s+/g, " ")} → ${String(o.told).replace(/\s+/g, " ")}`;
      outcomes.splice(outcomes.indexOf(o), 1);
    } else if (asks === "whether") {
      delete o.standing;
      const lost = removals(beforeCase, o, ["standing"]);
      if (lost.length) return { ok: false, why: refuseBecause("Ruling this shared case", ref, lost) };
    } else {
      delete o.standing;
      o[asks === "when" ? "when" : "told"] = says;
      // ⛔ New words, so the hand that supplied them is recorded with them. Only on this branch:
      //    ruling `whether` in the affirmative writes no sentence, so nothing about who wrote the
      //    existing one has changed, and re-stamping authorship for a non-change would stale a
      //    human's acceptance over a sentence nobody touched.
      if (wrote) o.wrote = wrote;
      const lost = removals(beforeCase, o, ["standing", "wrote", asks === "when" ? "when" : "told"]);
      if (lost.length) return { ok: false, why: refuseBecause("Ruling this shared case", ref, lost) };
    }
    const parsed = Rule.safeParse(data);
    if (!parsed.success)
      return { ok: false, why: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
    fs.writeFileSync(
      rule.file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: rule.file, displaced: [], replaced: removed };
  }
  if (r.ref.kind === "rule") {
    const file = corpus.rules.find((x) => x.rule.id === r.ref.id)!.file;
    const raw = parseFrontmatter(fs.readFileSync(file, "utf-8"));
    const data = raw.data as Record<string, unknown>;
    const beforeRule = { ...data };
    delete data.standing;
    data.statement = says;
    // ⛔ An org-wide sentence reaches every exchange its selector touches, so the hand that
    //    supplied it travels with it rather than being inferable from nothing.
    if (wrote) data.wrote = wrote;
    // The demonstration arrives with the ruling, because a decided rule owes one.
    if (about.then)
      data.criteria = [
        ...((data.criteria as unknown[]) ?? []),
        { id: 1, slot: (data.fills as string[] | string)[0] ?? data.fills, kind: "conformance", then: about.then },
      ];
    const lost = removals(beforeRule, data, ["standing", "statement", "wrote", "criteria"]);
    if (lost.length) return { ok: false, why: refuseBecause("This ruling", ref, lost) };
    const parsed = Rule.safeParse(data);
    if (!parsed.success)
      return {
        ok: false,
        why: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; "),
      };
    fs.writeFileSync(
      file,
      `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file, displaced: [], replaced: undefined };
  }
  if (r.ref.kind !== "slot" && r.ref.kind !== "case")
    return { ok: false, why: `${ref} is not a slot or a named case — nothing there holds a standing` };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  if (!ex) return { ok: false, why: `no exchange "${exId}" in ${scopeId}` };
  const slot = (ex.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };

  /**
   * ⛔ RULING A NAMED CASE TOUCHES THAT CASE AND NOTHING ELSE.
   *
   * Writing `says` onto the whole slot when the question was about one refusal deleted the
   * slot's own open question with no verdict recording it, and left the case's `proposed`
   * standing untouched — so a packet read "It is not refused. It is recorded…" directly above
   * three named refusals, one of them still marked NOT RULED, with the header claiming one
   * hole. Answering one question destroyed a different one.
   */
  if (r.ref.kind === "case") {
    const outcomes = (slot.outcomes as Array<Record<string, unknown>> | undefined) ?? [];
    const caseName = r.ref.name;
    const o = outcomes.find((x) => x.name === caseName);
    if (!o) return { ok: false, why: `no case "${caseName}" on ${exId}'s ${slotName}` };
    /**
     * ⛔ THE QUESTION ON A CASE CAN BE ANY OF THREE THINGS, and this assumed the third.
     *
     * *Whether* it refuses, *when* it refuses, or *what the asker is told*. Every ruling went
     * into `told`, so answering the schema's own documented example — "is spending past
     * nothing refused at all?" — produced `refuses more-than-they-have when the amount is
     * larger than what the kid has → It is not refused.` The user-facing message was
     * destroyed and appeared in no verdict.
     *
     * `asks` says which. Ruling `whether` in the negative RETIRES the case rather than
     * writing a message into it, because a refusal that does not refuse is not a refusal.
     */
    const asks = ((o.standing as Record<string, unknown> | undefined)?.asks as string) ?? "told";
    const beforeCase = { ...o };
    let removedCase: string | undefined;
    const answerField = asks === "when" ? "when" : "told";
    /**
     * ⛔ THE POLARITY IS ASKED FOR, NOT GUESSED FROM THE SENTENCE.
     *
     * A regex decided whether a `whether` ruling meant yes or no. Ruled affirmative it
     * overwrote a kid's refusal message with *"Yes — spending more than the kid has is
     * refused, and nothing is recorded."*; ruled negative it deleted an outcome whose ruling
     * said it was **still refused** — both with nothing recorded about what was replaced.
     * Guessing the meaning of a sentence is exactly what this framework exists to stop.
     */
    if (asks === "whether" && about.refuses === undefined)
      return {
        ok: false,
        why: `"${caseName}" asks WHETHER it refuses — say which with --refuses yes|no, because the answer decides whether this case survives at all`,
      };
    if (asks === "whether" && about.refuses === false) {
      /**
       * ⛔ RULED "it does not refuse", so the case goes — and what it used to say is returned
       * so the verdict can record it.
       *
       * This branch was the one write path with no `removals()` call: it deleted the outcome,
       * printed *"and wrote it into the slot"*, dropped the packet's hole count, and the
       * human's sentence landed nowhere in `truth/` at all.
       */
      removedCase = `refuses ${o.name} when ${String(o.when).replace(/\s+/g, " ")} → ${String(o.told).replace(/\s+/g, " ")}`;
      outcomes.splice(outcomes.indexOf(o), 1);
      if (!outcomes.length) delete slot.outcomes;
    } else if (asks === "whether") {
      /**
       * ⛔ RULED "it does refuse", so the ruling settles WHETHER — it is not the message.
       *
       * It used to be written into `told`, so ruling that spending past nothing IS refused
       * overwrote a nine-year-old's refusal message with *"Yes — spending more than the kid
       * has is refused, and nothing is recorded."* The question was whether, and the answer to
       * whether is not a sentence shown to a child.
       */
      delete o.standing;
      const lostHere = removals(beforeCase, o, ["standing"]);
      if (lostHere.length) return { ok: false, why: refuseBecause("Ruling this case", ref, lostHere) };
    } else {
      delete o.standing;
      o[answerField] = says;
      // ⛔ Same as the shared case above: recorded where words are written, and only there.
      if (wrote) o.wrote = wrote;
      const lostHere = removals(beforeCase, o, ["standing", "wrote", answerField]);
      if (lostHere.length) return { ok: false, why: refuseBecause("Ruling this case", ref, lostHere) };
    }
    const next = { ...data, exchanges: data.exchanges };
    const check = Scope.safeParse(next);
    if (!check.success)
      return {
        ok: false,
        why: `the ruling would not parse back: ${check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`,
      };
    fs.writeFileSync(
      entry.file,
      `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
      "utf-8"
    );
    return { ok: true, file: entry.file, displaced: [], replaced: removedCase };
  }

  /**
   * ⛔ The standing is REPLACED, not merged.
   *
   * Leaving `question`, `readings`, `cost` or `candidates` behind next to a settled slot
   * leaves two records of the same thing: the sentence says it is decided and the leftover
   * fields say nobody has decided. `.strict()` would refuse the file on the next read
   * anyway, which is the schema catching what a merge would have hidden.
   *
   * What the decision WAS is not lost — it is in the verdict log, with the reasoning and
   * what else was considered, which is where a record of a decision belongs.
   */
  /**
   * ⛔ A RULING REPLACES THE ANSWER. It does not add a second one, and it does not leave a
   * waiver standing that now contradicts it.
   *
   * Ruling a slot that held `cannot_fail:` used to leave both on the file — and the packet
   * printed the `cannot_fail`, so the human's ruling appeared nowhere. Worse, the
   * `instead_of` waiving the org rule *"the person is told it was not recorded"* survived,
   * citing the ruler's own argument for telling them. The ruling was not ignored; it was
   * inverted.
   *
   * `instead_of` is cleared and re-derived below from what the new sentence actually
   * displaces, so a waiver can never outlive the answer it was attached to.
   */
  /**
   * ⛔ A RULING SETTLES WHAT WAS ASKED AND NOTHING ELSE.
   *
   * Its declared reach is the standing plus the one field holding the answer. Anything else
   * the write would take with it is refused and named — see `write.ts` for the four ways this
   * used to destroy truth nobody had questioned.
   */
  const beforeSlot = { ...slot };
  /** ⛔ The standing as the author wrote it — `slot.standing` is replaced further down. */
  const asked = beforeSlot.standing as { of?: string } | undefined;
  // ⛔ Recorded, so the corpus keeps the sentence that used to be there. A ruling that
  // revises an agreed sentence is legitimate; losing the old one without trace is not.
  const wasSaying = typeof slot.says === "string" ? (slot.says as string).replace(/\s+/g, " ").trim() : undefined;
  /**
   * ⛔ THE CLAUSE-LOSS GUARD, ON `--says` TOO. It was closed on `--pick` and left open on the
   * command `decide` prints one line below it.
   *
   * A reviewer answering the residual on `record-spending#answer` reduced the agreed
   * three-clause sentence to *"It is refused, because a kid's money must never read as owed"* —
   * the money coming off, the history entry and the navigation all gone, and an argument
   * written where the behaviour goes. `check` fired only on the now-orphaned CRITERIA, and its
   * remediation told the author to fix the criterion; on a slot with no criteria it was silent.
   *
   * A ruling on a slot whose question was `about` one part must keep the rest. This does not
   * judge prose — it asks whether the sentences that were agreed still appear, which is a
   * question about what was removed, not about what is right.
   */
  /**
   * ⛔ NOT WHEN THE RULING IS AN ADDITION — AND THIS GUARD RAN FIRST, SO `adds a statement` WAS
   * UNREACHABLE ON ANY SLOT WHOSE SENTENCE IS A SINGLE STRING.
   *
   * This test asks whether the clauses that were agreed still appear in the new sentence. An
   * addition does not claim to contain them: it is a NEW sentence placed beside what is there,
   * and `about.adds` below appends it without touching a word of the original. So running this
   * first tested an addition as though it were a replacement and refused it for dropping clauses
   * it never claimed to touch.
   *
   * ⛔ IT MADE THE FIX FOR fg-0001 UNREACHABLE WHERE IT WAS MOST NEEDED. `adds a statement` exists
   * precisely so an answer about something a slot does not yet mention can be recorded without
   * rewriting the sentences beside it — and on a single-string slot, which is the common shape,
   * every such option was refused. Measured on Peter's corpus: of three questions he had answered,
   * only the one whose `says` is a LIST could use the clean route, and that worked only because
   * `wasSaying` is undefined for a list and this guard was skipped by accident.
   */
  /**
   * ⛔ A LIST-SHAPED SLOT HAD NO PROTECTION AT ALL, WHICH IS EXACTLY INVERTED.
   *
   * `wasSaying` is set only when `says` is a STRING, so this guard ran where there was one sentence
   * to lose and was skipped where there were several — and several is the shape that holds several
   * agreed statements. Measured on Peter's real corpus: `resume-a-deal-already-started#answer`
   * carries THREE agreed statements, a `pick` is correctly refused, and writing the sentence
   * directly was **accepted, leaving one. Two statements a person had agreed to, gone, silently.**
   *
   * ⛔ I TOUCHED THIS LINE TODAY AND MISSED IT. Fixing `adds a statement` I added `!about.adds`
   * here and wrote in the comment that the add path "worked only because `wasSaying` is undefined
   * for a list and this guard was skipped by accident". I noticed the skip and did not see that the
   * skip is also the hole — the interviewer running against staging is what found it.
   *
   * ⛔ AND A LIST NEEDS NO HEURISTIC. Splitting prose on punctuation is a stand-in for "the things
   * this slot promises"; a list has already been split, each unit with its own id. So the same
   * overlap test runs over better units.
   */
  const agreedUnits = Array.isArray(slot.says)
    ? statements(slot.says as Parameters<typeof statements>[0]).map((x) => x.says.replace(/\s+/g, " ").trim())
    : null;
  const guardable = wasSaying || (agreedUnits?.length ?? 0) > 1;
  if (guardable && !about.adds && (beforeSlot.standing as { about?: string } | undefined)?.about) {
    const dropped = agreedUnits ? droppedFrom(agreedUnits, says) : droppedClauses(wasSaying!, says);
    if (dropped.length)
      return {
        ok: false,
        why:
          `This ruling drops ${dropped.length === 1 ? "a part" : "parts"} of what was already agreed here, ` +
          `and only one thing about it was in question:\n` +
          dropped.map((c) => `      ${c}`).join("\n") +
          `\n\n  It said: ${wasSaying ?? agreedUnits!.join(" ")}\n  In question: ${(beforeSlot.standing as { about: string }).about.replace(/\s+/g, " ").trim()}\n` +
          `\n  Write the whole sentence you want, keeping the rest — or if those parts really are ` +
          `wrong too,\n  say so as its own act first.`,
      };
  }
  /**
   * ⛔ THE SETTLED STANDING KEEPS WHO SETTLED IT, so `check` has something to demand a verdict
   * against.
   *
   * The `waive` guard works precisely because a waiver leaves its standing on the file — so
   * `latitude-nobody-granted` can ask "which act was this?". A ruling used to DELETE the
   * standing, leaving a sentence indistinguishable from one an author drafted, and `check` had
   * nothing to hold. Hand-editing an open question into a `says:` therefore closed the
   * corpus's hardest question with zero findings, while the `out_of_scope` route was refused
   * by name.
   */
  slot.standing = { kind: "stated", answered_by: by, answered_at: at };
  /**
   * ⛔ A `refuses` ruling writes NAMED CASES, not a sentence — the one slot where a sentence is
   * a parse refusal, and therefore the one slot no command could settle.
   */
  /**
   * ⛔ A `refuses` RULING MAY ADD CASES. IT MAY NOT SILENTLY DELETE AGREED ONES.
   *
   * `slot.outcomes = about.outcomes` is a wholesale replacement, and `outcomes` is in this
   * act's declared reach — so the write guard waved it through. `--pick` on a slot with an
   * open standing and already-agreed named cases therefore deleted every one of them,
   * recorded nothing about the deletion, and left a corpus that was then acceptable: the
   * refusals a person had read and agreed to were gone, the exchange's stamp read current,
   * and `check` had nothing to say. Named refusals are the slot most likely to carry the
   * money-losing case, and they were the cheapest thing in the model to destroy.
   *
   * The comparison is by name, because a name is the case's identity — re-wording `when` or
   * `told` is a revision, and revisions are what a ruling is for.
   */
  if (about.outcomes || about.none) {
    const had = ((beforeSlot.outcomes as Array<{ name?: string }> | undefined) ?? [])
      .map((o) => String(o.name))
      .filter(Boolean);
    const now = about.outcomes
      ? (about.outcomes as Array<{ name?: string }>).map((o) => String(o.name))
      : [];
    const gone = had.filter((n) => !now.includes(n));
    if (gone.length)
      return {
        ok: false,
        why:
          `This ruling would drop ${gone.length === 1 ? "a refusal" : "refusals"} already agreed here:\n` +
          gone.map((n) => `      ${n}`).join("\n") +
          `\n\n  ${about.none ? "It says there is nothing to refuse, and these say otherwise." : "The option you picked does not mention " + (gone.length === 1 ? "it" : "them") + "."}\n` +
          `  A ruling on this slot may ADD cases or re-word them. Retiring one is its own act,\n` +
          `  because somebody agreed to it:\n` +
          gone.map((n) => `      productos v2 rule ${ref}#${n} --refuses no --says "…" --because "…" --by <you>`).join("\n"),
      };
  }
  /**
   * ⛔ THE HAND GOES ON THE GRAIN THE WORDS WENT ON, AND NOWHERE WIDER.
   *
   * Writing it on the slot whenever anything here changed would attribute a sentence nobody
   * touched to whoever ruled a named case — which is the same mis-filing `coveredBy` already paid
   * for twice, arriving through provenance instead of through a hash.
   */
  if (about.outcomes)
    slot.outcomes = wrote
      ? (about.outcomes as Array<Record<string, unknown>>).map((o) => ({ ...o, wrote }))
      : about.outcomes;
  else if (about.none) {
    slot.none = true;
    if (wrote) slot.wrote = wrote;
  }
  /**
   * ⛔ A NEW STATEMENT BESIDE THE OTHERS — fg-0001, and the branch that lets an answer about an
   * ABSENCE land at all.
   *
   * Where the chosen option declares `adds a statement`, the ruling is not a replacement of
   * anything: it is a sentence the slot did not say, appended with its own id, every sibling left
   * byte-identical. Same guarantee as the `of` branch below, for the opposite situation — that one
   * rewrites one of several, this one makes it one more.
   *
   * ⛔ ITS ID IS MADE FROM THE SENTENCE, never asked for. Nobody composing an answer at a prompt
   * should be asked to invent an identifier for words they have just chosen — `suggest` already
   * holds that line for the same reason.
   */
  else if (about.adds) {
    const list = Array.isArray(slot.says)
      ? (slot.says as Array<{ id: string; says: string }>)
      : typeof slot.says === "string" && slot.says.trim()
        ? [{ id: "it", says: slot.says as string }]
        : [];
    const id =
      says
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .split("-")
        .slice(0, 6)
        .join("-") || "also";
    if (list.some((x) => x.id === id))
      return {
        ok: false,
        why: `${ref} already says something filed as "${id}" — give this sentence different words, or rule the statement that is there`,
      };
    list.push({ id, says });
    slot.says = list;
  }
  else if (asked?.of && Array.isArray(slot.says)) {
    /**
     * ⛔ ONE STATEMENT, NOT THE WHOLE SLOT (fg-0008).
     *
     * A slot that says four things, one of them unruled, used to have no way to rule just that
     * one: the standing sat on the slot, so `--says` replaced all four and the reviewer had to
     * retype the three already agreed. That is precisely the clause loss `--pick` exists to
     * prevent, re-achieved through the list spelling — reported by the author who hit it, not
     * theorised.
     *
     * So when the standing names `of`, the ruling replaces that statement's `says` and leaves its
     * siblings byte-identical. Their ids do not move either, so no criterion's `of:` is orphaned.
     *
     * ⛔ AND IF THE NAMED STATEMENT IS GONE, THIS REFUSES rather than appending a new one. A
     * ruling that silently adds a fifth sentence while claiming to settle the fourth is worse than
     * one that stops.
     */
    const statements = slot.says as Array<{ id: string; says: string }>;
    const target = statements.find((x) => x.id === asked.of);
    if (!target)
      return {
        ok: false,
        why:
          `this standing is about the statement "${asked.of}", and ${ref} no longer says it — ` +
          `it says: ${statements.map((x) => x.id).join(", ")}. Re-point the standing, or rule the whole slot`,
      };
    target.says = says;
    // ⛔ On the statement, not on the slot — its siblings keep whoever wrote them, which is the
    //    whole reason the field exists at this grain.
    if (wrote) (target as { wrote?: Authorship }).wrote = wrote;
  } else {
    slot.says = says;
    if (wrote) slot.wrote = wrote;
  }
  // ⛔ Cleared, then re-derived only from what the person declared in THIS act — the comment
  // above has claimed this since the field existed and the code did not do it, so an
  // `instead_of` authored beside an open slot survived the ruling that replaced its sentence.
  delete slot.instead_of;
  delete slot.defers_to;
  const lostBySettling = removals(beforeSlot, slot, ["standing", "says", "wrote", "outcomes", "none", "instead_of", "defers_to"]);
  if (lostBySettling.length) return { ok: false, why: refuseBecause("This ruling", ref, lostBySettling) };

  /**
   * ⛔ A ruling that displaces an org-wide rule declares the override, using the reasoning
   * the person just gave.
   *
   * Without this, answering a question correctly produced a refusal the answerer could not
   * have anticipated: the slot went from an unsettled standing (which contests a rule, and is
   * reported as such) to `stated` (which displaces one, and must say so). So the reward for
   * settling a hard question was a new error about a rule they had never mentioned.
   *
   * The `because` is not invented — it is the reasoning attached to the ruling, and "why
   * this slot answers for itself here" is exactly what that reasoning says. If they gave
   * none, the override is still declared, pointing at the verdict log rather than guessing.
   */
  const displaced: string[] = [];
  if (because.trim().length < 40)
    return { ok: false, why: "a ruling needs its reasoning — this function will not write one for you" };
  /**
   * ⛔ THE TOOL NO LONGER DECIDES THAT A RULING OVERRIDES A RULE.
   *
   * It added `instead_of` whenever the new sentence displaced a `supplies` rule. So a ruling
   * that AGREED with `a-repeat-does-nothing-twice` — a verbatim restatement of it — wrote a
   * formal exemption from that rule in the ruler's name, and printed "your answer overrides
   * a-repeat-does-nothing-twice here". Three such rulings and all three money writes carried
   * `⊗`, with the idempotency rule governing no money write at all.
   *
   * Overriding a rule and agreeing with one are different acts and cannot share a record.
   * `check` asks for whichever declaration is missing rather than the tool guessing.
   */
  const { displaced: wouldSupply } = resolveRules(corpus);
  for (const r of wouldSupply.get(ref) ?? []) displaced.push(r.id);
  /**
   * ⛔ Written only because a person said so, and refused if they name a rule that is not in
   * play — a declaration about the wrong rule is worse than none, because it reads as
   * considered.
   */
  for (const [flag, field] of [
    [about.defersTo, "defers_to"],
    [about.insteadOf, "instead_of"],
  ] as const) {
    if (!flag) continue;
    if (!displaced.includes(flag))
      return {
        ok: false,
        why: `${flag} does not answer ${ref}${displaced.length ? ` — the rules that do are ${displaced.join(", ")}` : " — no rule does"}`,
      };
    const existing = (slot[field] as Array<{ rule: string }> | undefined) ?? [];
    slot[field] = [...existing.filter((x) => x.rule !== flag), { rule: flag, because }];
  }
  // Keep a settled slot's own shape intact — outcomes, within, notes and any declared
  // override all survive a ruling, because none of them was the thing in question.

  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return {
      ok: false,
      why: `the ruling would not parse back: ${check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`,
    };
  const fm = YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" });
  fs.writeFileSync(entry.file, `---\n${fm}---\n\n${raw.content.trim()}\n`, "utf-8");
  return { ok: true, file: entry.file, displaced, replaced: wasSaying };
}

/**
 * Write a waiver into the slot it leaves unanswered.
 *
 * ⛔ Same shape as `settle`: the truth is written here and the CLI logs the act only once
 * this has succeeded, so a verdict can never sit beside a slot that does not agree with it.
 */
export function waive(
  root: string,
  ref: string,
  because: string,
  by: string,
  at: string
): { ok: true; file: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (r.ref.kind !== "slot") return { ok: false, why: `${ref} is not a slot` };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  if (!ex) return { ok: false, why: `no exchange "${exId}" in ${scopeId}` };
  const slot = (ex.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };
  /**
   * ⛔ A WAIVER OVER AN EXISTING ANSWER IS REFUSED, NOT SILENTLY APPLIED.
   *
   * It used to delete `says`, `none`, `cannot_fail` and `outcomes` — so waiving one slot
   * removed two settled named refusals with no gate and no record. Declaring latitude over
   * something already answered is not granting latitude; it is deleting a behaviour, and it
   * has to be two acts so that the deletion is visible as one.
   */
  const waived = { standing: { kind: "out_of_scope", because, answered_by: by, answered_at: at } };
  const lostByWaiving = removals({ ...slot }, waived, ["standing"]);
  if (lostByWaiving.length) return { ok: false, why: refuseBecause("Waiving this slot", ref, lostByWaiving) };
  for (const k of Object.keys(slot)) delete (slot as Record<string, unknown>)[k];
  Object.assign(slot, waived);
  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return {
      ok: false,
      why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; "),
    };
  fs.writeFileSync(
    entry.file,
    `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
    "utf-8"
  );
  return { ok: true, file: entry.file };
}

/**
 * Record which org-wide rule governs a slot that already says something.
 *
 * ⛔ A SEPARATE ACT FROM A RULING, because the question is separate: a slot can be perfectly
 * settled and still owe an answer to "does the org rule you displaced still hold here?"
 *
 * Folding it into `rule` left the loop with a dead end — settling a slot produced a corpus
 * that `check` refused, and the remedy the tool printed was rejected because the slot was by
 * then settled.
 */
export function govern(
  root: string,
  ref: string,
  about: { defersTo?: string; insteadOf?: string },
  because: string
): { ok: true; file: string } | { ok: false; why: string } {
  const corpus = loadCorpus(root);
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (r.ref.kind !== "slot") return { ok: false, why: `${ref} is not a slot` };
  if (because.trim().length < 40)
    return { ok: false, why: "say why, in a sentence a reader can weigh — this is a claim about an org-wide rule" };
  const { scope: scopeId, exchange: exId, slot: slotName } = r.ref;
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return { ok: false, why: `no scope "${scopeId}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as { exchanges?: Array<{ id: string; slots?: Record<string, unknown> }> };
  const ex = (data.exchanges ?? []).find((e) => e.id === exId);
  const slot = (ex?.slots ?? {})[slotName] as Record<string, unknown> | undefined;
  if (!slot) return { ok: false, why: `no slot "${slotName}" on ${exId}` };
  const { displaced } = resolveRules(corpus);
  const inPlay = (displaced.get(ref) ?? []).map((x) => x.id);
  for (const [flag, field] of [
    [about.defersTo, "defers_to"],
    [about.insteadOf, "instead_of"],
  ] as const) {
    if (!flag) continue;
    if (!inPlay.includes(flag))
      return {
        ok: false,
        why: `${flag} does not answer ${ref}${inPlay.length ? ` — the rules that do are ${inPlay.join(", ")}` : " — no rule does"}`,
      };
    const existing = (slot[field] as Array<{ rule: string }> | undefined) ?? [];
    slot[field] = [...existing.filter((x) => x.rule !== flag), { rule: flag, because }];
  }
  const next = { ...data, exchanges: data.exchanges };
  const check = Scope.safeParse(next);
  if (!check.success)
    return { ok: false, why: check.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
  fs.writeFileSync(
    entry.file,
    `---\n${YAML.stringify(next, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
    "utf-8"
  );
  return { ok: true, file: entry.file };
}

/**
 * ⛔ TAKE A BEHAVIOUR OUT — DELETED WHERE IT IS A DRAFT, WITHDRAWN WHERE SOMEBODY AGREED TO IT.
 *
 * Peter, twice: *"we should probalby have a 'delete' button to just remove behaviors"*, and then
 * *"have a 'checkmark' to approve, 'trash' icon to delete, 'edit' button to make changes."*
 *
 * There was no way to take anything out. A sentence a scoper proposed and nobody wanted could only
 * be removed by editing YAML, which is the one thing the page exists to stop — so a corpus
 * accumulated every guess anybody's software ever made about it, and the queue a person worked
 * through got longer whether or not they agreed with any of it.
 *
 * ⛔ THE TWO CASES ARE NOT THE SAME ACT, AND COLLAPSING THEM IS THE WHOLE RISK.
 *
 * Nothing has agreed to it → it is a draft, and it goes. No tombstone, because nothing depends on
 * the id and a corpus full of markers for sentences nobody wanted is noise that outlives its
 * subject.
 *
 * Somebody has agreed to it → the id is kept and marked `withdrawn`. Deleting it would free the id
 * for reuse, so a later sentence could inherit a stamp somebody gave to a different claim; and it
 * would erase the fact that this was once true, which is what anything pointing at it needs to
 * still resolve. ⛔ That is append-only applying exactly where it was meant to: once shipped.
 */
export function withdraw(
  root: string,
  ref: string,
  by: string,
  at: string,
  /** ⛔ Required only where somebody had agreed. A draft nobody wanted owes no essay. */
  because: string | undefined,
  /** Whether a human stamp covers this, which the caller reads from `stampFor`. */
  agreed: boolean
):
  | { ok: true; file: string; mode: "deleted" | "withdrawn"; was: string }
  | { ok: false; why: string; instead?: string[] } {
  const corpus = loadCorpus(root);
  const r = resolveRef(corpus, ref);
  if ("error" in r) return { ok: false, why: r.error };
  if (agreed && (because ?? "").trim().length < 40)
    return {
      ok: false,
      why:
        `${ref} has been agreed to, so taking it out needs a reason — somebody put their name to this sentence and ` +
        `a corpus that drops it silently cannot tell them why`,
    };

  const aim = r.ref;
  /**
   * ⛔ A WHOLE FEATURE, AND THERE WAS NO WAY TO TAKE ONE OUT.
   *
   * Peter: *"just delete the fucking orphans"* — twelve scopes the carried-tree conversion left at
   * the product root. The only route was editing twelve files by hand, which is the one move this
   * project forbids outright: the next conversion regenerates them and nothing records which shape
   * was right. He then said what the answer had to be: *"create a 'delete' interface if you need
   * to, so you odn't touch the files directly"*.
   *
   * ⛔ ALWAYS `withdrawn`, NEVER DELETED — unlike a statement or a slot. `existsOf` already cascades
   * `withdrawn` down the lineage, so marking the feature takes its behaviours with it and the id
   * stays resolvable: a `depends_on` pointing at it still resolves, where a deleted file would make
   * every reference to it a dangling ref and `check` would refuse for the removal rather than
   * because anything was wrong. A feature is also the grain other documents point AT, which a slot
   * is not.
   */
  if (aim.kind === "scope") {
    const home = corpus.scopes.find((x) => x.scope.id === aim.scope);
    if (!home) return { ok: false, why: `no feature "${aim.scope}"` };
    if (home.scope.exists === "withdrawn")
      return { ok: false, why: `${aim.scope} is already withdrawn` };
    const raw0 = parseFrontmatter(fs.readFileSync(home.file, "utf-8"));
    const d0 = raw0.data as Record<string, unknown>;
    d0.exists = "withdrawn";
    const ok0 = Scope.safeParse(d0);
    if (!ok0.success)
      return { ok: false, why: ok0.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
    fs.writeFileSync(
      home.file,
      `---\n${YAML.stringify(d0, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw0.content.trim()}\n`,
      "utf-8"
    );
    void by;
    void at;
    return { ok: true, file: home.file, mode: "withdrawn", was: String(home.scope.title ?? aim.scope) };
  }
  if (aim.kind !== "statement" && aim.kind !== "slot" && aim.kind !== "exchange")
    return {
      ok: false,
      why: `${ref} is a ${aim.kind} — this takes out a feature, one statement, one slot, or one whole exchange`,
    };
  const kind = aim.kind;

  const entry = corpus.scopes.find((x) => x.scope.id === aim.scope);
  if (!entry) return { ok: false, why: `no feature "${aim.scope}"` };
  const raw = parseFrontmatter(fs.readFileSync(entry.file, "utf-8"));
  const data = raw.data as Record<string, unknown>;
  const exchanges = (data.exchanges ?? []) as Array<Record<string, unknown>>;
  const ex = exchanges.find((x) => x.id === aim.exchange);
  if (!ex) return { ok: false, why: `no exchange "${aim.exchange}" in ${aim.scope}` };

  let was = "";
  /**
   * ⛔ ONLY AN EXCHANGE CAN BE MARKED WITHDRAWN, AND THE FIRST VERSION OF THIS IGNORED THAT.
   *
   * `exists` lives on an exchange, a view and a scope. `Statement` is strict with two fields and
   * `SlotFill` has no such field — so withdrawing one agreed slot had nowhere to record itself, and
   * what it actually did was mark the whole EXCHANGE withdrawn, silently taking its other five
   * slots down with it. Caught by running it against the seed and reading the file back, not by
   * reading the code.
   *
   * ⛔ AND THE REFUSAL IS THE RIGHT ANSWER, NOT A GAP. Agreed truth is not deleted, it is reworded:
   * the id stays, the stamp breaks, and the person who agreed is asked again. Deleting a sentence
   * somebody put their name to would leave their verdict pointing at nothing, which is the one
   * thing `withdrawn` exists to prevent at the exchange grain.
   */
  if (agreed && aim.kind !== "exchange")
    return {
      ok: false,
      why:
        `${ref} has been agreed to, and only a whole exchange can be marked withdrawn — ` +
        `a slot and a statement have no such field, so there would be nowhere to record it`,
      instead: [
        `reword it: the id stays, the stamp breaks, and whoever agreed is asked again`,
        `or take out the whole behaviour: withdraw ${aim.scope}#${aim.exchange}`,
      ],
    };

  if (aim.kind === "exchange") {
    was = String(ex.title ?? ex.id);
    if (agreed) ex.exists = "withdrawn";
    else exchanges.splice(exchanges.indexOf(ex), 1);
  } else {
    const slots = (ex.slots ?? {}) as Record<string, Record<string, unknown>>;
    const fill = slots[aim.slot];
    if (!fill) return { ok: false, why: `nothing is said at ${ref}` };
    if (aim.kind === "slot") {
      was = typeof fill.says === "string" ? fill.says : JSON.stringify(fill.says ?? "");
      delete slots[aim.slot];
    } else {
      /**
       * ⛔ ONE STATEMENT OUT OF SEVERAL, which is the grain the table rows are at. Taking the whole
       * slot because one of its sentences was wrong is the shape of mistake `removals` exists to
       * catch, and here it would be invisible: the slot would simply have less in it.
       */
      if (!Array.isArray(fill.says))
        return { ok: false, why: `this slot says one thing, so there is no statement to take out of it — name the slot instead` };
      const list = fill.says as Array<Record<string, unknown>>;
      const one = list.find((x) => x.id === aim.name);
      if (!one) return { ok: false, why: `no statement "${aim.name}" at ${ref}` };
      was = String(one.says ?? "");
      list.splice(list.indexOf(one), 1);
      /** ⛔ A slot left with nothing is a blank slot, which `check` already refuses by name. */
      if (!list.length) delete slots[aim.slot];
    }
  }

  const parsed = Scope.safeParse(data);
  if (!parsed.success)
    return { ok: false, why: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ") };
  fs.writeFileSync(
    entry.file,
    `---\n${YAML.stringify(data, { lineWidth: 96, blockQuote: "literal" })}---\n\n${raw.content.trim()}\n`,
    "utf-8"
  );
  void by;
  void at;
  return { ok: true, file: entry.file, mode: agreed ? "withdrawn" : "deleted", was };
}

/**
 * What a person said when they read a scope end to end — ⛔ THE ONE SIGNAL NOTHING CAN COMPUTE,
 * AND NOW THERE IS ONE PLACE THAT ANSWERS FOR IT.
 *
 * Peter: *"buildability should be a part of readiness, should not introduce a new 'groomed'
 * concept. don't know what we would use 'ready' for outside of buildability."*
 *
 * `Verdict kind: read` has carried `buildable` and `blocked_by` since the act shipped, and three
 * surfaces read it by hand: `compilePacket` prints a banner (its own `readinessOf` did not),
 * `check` raises a refusal, and the page renders it. `readinessOf` — the field a consumer asks
 * before it starts work — consulted it nowhere, so a scope a human had read and declared
 * unbuildable answered `ready: true`.
 *
 * ⛔ A FOURTH HAND-WRITTEN COPY OF THE PREDICATE IS HOW THREE AGREEING READERS BECOME FOUR
 * DISAGREEING ONES — the warning `readiness.ts` opens with, about holes, reached by the same route
 * one field along. So the predicate lives here, beside `questionsFor`, because the two answer
 * halves of one question: what nobody has decided, and what somebody could not build from.
 */
export interface ReadThrough {
  /** The scope they read. ⛔ May be an ancestor of the one being asked about. */
  scope: string;
  by: string;
  at: string;
  /**
   * The hash of everything they read, when they read it.
   *
   * ⛔ ABSENT MEANS NOTHING SAYS WHAT THEY READ, which is the state every read-through written
   * before this was in — and it is treated the way an undated criterion is: it does not satisfy the
   * gate, and `check` notes it rather than refusing. A refusal would fire on every corpus carrying
   * an older reading at once, and this project has twice learned what happens to one of those.
   */
  of?: string;
  /** ⛔ Whether the words have moved since. A stale yes is not a yes — see `buildableReads`. */
  stale: boolean;
  /**
   * Could they build from it, as it stood — ⛔ THREE STATES, AND `undefined` IS NOT A NO.
   *
   * The field is optional on `Verdict`, so a reading relayed without it, or written before it
   * existed, states nothing about buildability. Collapsing that to `false` would make `check`
   * refuse every such corpus — *"a refusal firing on all of them is one people switch off"* —
   * and collapsing it to `true` would let the gate pass on exactly the records it cannot read.
   * It counts as neither: a reading that did not answer the question has not answered it.
   */
  buildable?: boolean;
  /** Slot refs that stopped them, where they said. */
  blockedBy: string[];
  note?: string;
}

/**
 * The hash of what a read-through covered, for a ref at either grain — ⛔ ONE HOME, TWO CALLERS.
 *
 * `doRead` stamps it and `buildableReads` compares it. If those two resolved the grain differently —
 * a feature read covering its descendants, say, against a hash taken over one scope — every read
 * would be stale the moment it was written, which is exactly the shape the decomposer hit on
 * `servesHash` and said so about: *"any offering with exactly one `serves` entry reads stale
 * immediately."* So neither caller resolves anything; both ask this.
 */
export function readHashFor(corpus: Corpus, ref: string): string {
  const [scopeId, exchange] = ref.split("#");
  const scopes = exchange ? [scopeId!] : descendants(corpus, scopeId!);
  const refs: string[] = [];
  for (const id of scopes) {
    const scope = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!scope) continue;
    for (const ex of scope.exchanges) if (!exchange || ex.id === exchange) refs.push(`${id}#${ex.id}`);
  }
  return readHash(corpus, refs);
}

/** The scope ids from one scope up to the root, itself included. */
function ancestryOf(corpus: Corpus, scopeId: string): Set<string> {
  const out = new Set<string>([scopeId]);
  for (let id: string | undefined = scopeId; id; ) {
    const parent: string | undefined = corpus.scopes.find((s) => s.scope.id === id)?.scope.in;
    if (!parent || out.has(parent)) break;
    out.add(parent);
    id = parent;
  }
  return out;
}

/**
 * Every read-through standing over one ref, newest first, at any buildability.
 *
 * ⛔ The only caller that wants ALL of them is `readinessOf`, which has to tell a spent yes from no
 * yes at all. `buildableReads` and `unbuildableReads` are the two filtered answers.
 */
export function readThroughsFor(corpus: Corpus, ref: string): ReadThrough[] {
  const [scopeId, exchange] = ref.split("#");
  const ancestry = ancestryOf(corpus, scopeId!);
  const under = new Set(descendants(corpus, scopeId!));
  return readsIn(corpus).filter((r) => {
    const [at, atExchange] = r.scope.split("#");
    if (exchange && atExchange && !(at === scopeId && atExchange === exchange)) return false;
    if (atExchange && !exchange) return under.has(at!);
    return ancestry.has(at!) || under.has(at!);
  });
}

const readsIn = (corpus: Corpus): ReadThrough[] =>
  corpus.verdicts
    .filter((v) => v.kind === "read" && v.scope)
    .map((v) => ({
      scope: v.scope!,
      by: v.by,
      at: v.at,
      of: v.covers_read,
      /**
       * ⛔ A READING WITH NO HASH IS NOT STALE — it is unprovenanced, which is a different thing and
       * routes differently. Calling it stale would tell somebody their words had moved when nothing
       * says they had; what is true is that nothing records what was read. `buildableReads` declines
       * it either way, and `check` says which it is.
       */
      stale: Boolean(v.covers_read) && v.covers_read !== readHashFor(corpus, v.scope!),
      buildable: v.buildable,
      blockedBy: v.blocked_by ?? [],
      note: v.note,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

/**
 * The read-throughs that say a builder could not start — ⛔ A RECORDED NO, AND ONLY THAT.
 *
 * What `check` refuses on and what the packet banners. Both are claims ABOUT a person's statement,
 * so both need the statement to exist: `=== false`, never `!== true`.
 *
 * ⛔ IT REACHES IN BOTH DIRECTIONS, WHICH `buildableReads` DELIBERATELY DOES NOT. A person who
 * could not build a parent could not build its children — they read the subtree. And a person who
 * could not build ONE behaviour has found something wrong with the feature containing it, so the
 * feature is not startable either. A no is contagious in both directions; see the other one.
 */
export function unbuildableReads(corpus: Corpus, ref: string): ReadThrough[] {
  const [scopeId, exchange] = ref.split("#");
  const ancestry = ancestryOf(corpus, scopeId!);
  const under = new Set(descendants(corpus, scopeId!));
  return readsIn(corpus).filter((r) => {
    if (r.buildable !== false) return false;
    const [at, atExchange] = r.scope.split("#");
    /** A no on a sibling behaviour is not a no on this one. */
    if (exchange && atExchange && !(at === scopeId && atExchange === exchange)) return false;
    return ancestry.has(at!) || under.has(at!);
  });
}

/**
 * The read-throughs that say a builder could start.
 *
 * ⛔ DOWNWARD ONLY, AND NEVER UP. A person who read a whole feature and could build it has said
 * something about every behaviour in it; a person who read ONE behaviour has said nothing about its
 * siblings, so their yes must not make the feature ready. Asked of a feature, a child's yes is not
 * an answer — asked of the child, the parent's yes is.
 *
 * ⛔ AND IT IS A RECORDED YES, NOT THE ABSENCE OF A NO, which is the other half of the asymmetry:
 * `readinessOf` withholds a pass until somebody says so, `check` stays quiet until somebody says
 * otherwise. A reading that stated neither satisfies neither.
 */
export function buildableReads(corpus: Corpus, ref: string): ReadThrough[] {
  const [scopeId, exchange] = ref.split("#");
  const ancestry = ancestryOf(corpus, scopeId!);
  return readsIn(corpus).filter((r) => {
    if (r.buildable !== true) return false;
    /**
     * ⛔ AND IT HAS TO BE CURRENT, which was the last laundering route left in the gate. A person
     * read a feature, said they could build it, and that stood after every sentence in it was
     * rewritten — the one thing in the model that could be true forever. `of` absent fails this
     * too: a yes nothing can tie to any particular words is not evidence about these ones.
     */
    if (!r.of || r.stale) return false;
    const [at, atExchange] = r.scope.split("#");
    if (atExchange) return Boolean(exchange) && at === scopeId && atExchange === exchange;
    return ancestry.has(at!);
  });
}

/**
 * ⛔ MOVED HERE FROM `readiness.ts`, BECAUSE TWO SURFACES WERE ANSWERING IT AND ONLY ONE HAD IT.
 *
 * `doRead` refuses *"I could build from this"* over `questionsFor(scope)` with no filter at all —
 * every question anywhere under the scope. `readinessOf` asks this function and reports a sibling
 * exchange's question as `around it`, deliberately: *"a sentence it does not use, a slot it does not
 * have, and an invitation to go and ask a person about neither."*
 *
 * Both are claims about what blocks one piece of work, and they disagreed. The cost was exact:
 * `money#see-a-balance` has every slot agreed and every claim demonstrated, its sibling
 * `record-spending` has two open questions — so readiness called it clear, and the act a person
 * would use to record that they could build it was refused. With buildability inside the gate,
 * that combination makes the exchange permanently unready. One function, both callers.
 */
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
export type Where = "on it" | "around it" | "nowhere near";

export function whereQuestionStands(corpus: Corpus, q: Question, scopes: string[], exchange?: string): Where {
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

/**
 * ⛔ MOVED HERE FOR THE REASON `whereQuestionStands` MOVED HERE, AND IT IS THE OTHER HALF OF THE
 * SAME DEFECT.
 *
 * `questionsIn` opens each slot with `if (!fill) continue` — so a slot nobody has filled is not a
 * question, and never was. That is right: nobody has been ASKED anything about it. But it meant the
 * act's refusal and the gate's hole list were disjoint on exactly the purest case:
 *
 *     grid                    `·` — nobody has thought about this
 *     readinessOf             a hole, so `ready: false`
 *     questionsFor            nothing, so the act saw nothing
 *     read --buildable true   ✓ recorded
 *
 * Driven on `money#see-a-balance` with `again` removed: one blank slot, zero questions, one hole,
 * and the act accepted *"I read this end to end and could build from it"* over it. The gate still
 * blocked, so no builder was handed it — but the corpus then held a person's stamp contradicting
 * its own grid, and the act's whole stated reason is that *"'I read it and could build it' and 'we
 * have not decided that' cannot both be true."* A slot nobody has thought about is that sentence's
 * strongest case.
 */
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
export const NOTHING_SAYS_THIS = "·";

export function blankSlots(corpus: Corpus, scope: string, exchange?: string): string[] {
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
