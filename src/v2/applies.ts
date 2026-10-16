/**
 * A person states a sentence, and it settles every claim it can verify.
 *
 * ⛔ THIS IS THE FRONT HALF OF A MECHANISM WHOSE BACK HALF ALREADY SHIPPED.
 *
 * `stamp.ts` already does the hard part: confirm a rule, and `acceptedThroughRule` recognises that
 * confirmation at every ref where the rule's sentence IS the whole content of the slot — with
 * `through` naming the rule, so no surface can show it as a direct press. What was missing is the
 * front: today a person has to hand-author the rule AND its selector before any of that happens,
 * which is YAML, which is a model's native path and not a person's.
 *
 * Peter: *"second way is for them to say 'folders are restricited to be linked to a single deal'.
 * that shoudl be analyzed and the ones it enforces shoudl be marked true as well, with their
 * sentence logged as proof."* And then the clause that decides the whole design: *"and the truth
 * gets applied to those it can verify"*.
 *
 * ⛔ "THOSE IT CAN VERIFY" IS NOT "EVERYTHING THE SELECTOR REACHES", AND THE DIFFERENCE IS THE
 * ONLY THING THIS FILE IS ABOUT.
 *
 * `Selector` is eight ANDed dimensions, deliberately closed so `check` can invert it. Reach is
 * therefore mechanical, cheap and wide — and a sentence reaches claims it does not establish. Mark
 * those accepted and the corpus records a person as having agreed to things they never said, which
 * is the one failure in this model that nothing downstream can detect: an over-reach is
 * indistinguishable from consent after the fact.
 *
 * So the pipeline is two halves with completely different trust properties, and they are kept
 * apart on purpose:
 *
 *   1. **REACH — mechanical, no judgement.** Which claims could this sentence be about? The
 *      `Selector`, through `resolveRules`, exactly as every other rule in the corpus. Nothing here
 *      may widen reach, because `check` has to be able to invert it.
 *   2. **VERIFICATION — one judgement per claim, never one per sentence.** For each claim the
 *      reach produced, does this sentence settle THESE words? Anything short of yes is not marked:
 *      it is handed back as a question.
 *
 * ⛔ PREFER UNDER-REACHING, STATED AS A RULE RATHER THAN A PREFERENCE. A missed claim costs one
 * more question. An over-reached one costs a false acceptance nothing can detect later. So every
 * doubt in this file resolves to `asks`: a claim with no judgement attached is asked, a judgement
 * about words that have since changed is asked, a judgement with no argument is asked.
 *
 * ⛔ AND IT SETTLES NOTHING ITSELF. This file computes an `Application` — the list a person reads
 * BEFORE they press. One press over N claims is the most powerful act in the product, so the list
 * is enumerated in full, in each claim's own words, with the argument for each line beside it.
 * `previewOf` is that list; `recordOf` is what gets written when somebody presses. Neither writes.
 */
import {
  Rule,
  SLOTS,
  type Selector,
  type SlotName,
} from "./schema.js";
import { resolveRules, selectsFor, lineageOf, type Corpus } from "./load.js";
import { coveredBy, canon } from "./stamp.js";
import { optionText } from "./acts.js";
import { createHash } from "node:crypto";

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
const h = (s: string): string => "sha256:" + createHash("sha256").update(s).digest("hex").slice(0, 16);

/**
 * What a person said, and how software read it.
 *
 * ⛔ TWO AUTHORS IN ONE OBJECT, NAMED SEPARATELY, BECAUSE CONFUSING THEM IS THE WHOLE DANGER.
 *
 * `sentence` and `by` are the person's. `fills`, `mode`, `scope` and `in` are a READING of that
 * sentence — software's answer to "which question does this answer, and where does it reach" — and
 * `read_by` says whose reading. The schema already has this exact split and the same reason for it:
 * `Verdict.chose`/`option_said` exist so "the chosen option's reasoning … is kept, in its own
 * field, attributed to whoever drafted it rather than to whoever ruled."
 *
 * Nothing in here is derived from `sentence` by this file. Working out which slot an English
 * sentence answers is reading English, and dressing a verb list up as a derivation would be a
 * guess wearing a decision's clothes. It arrives as a declared reading, and this file's job is to
 * POLICE it — see `applySentence`'s refusals.
 */
export interface Stated {
  /** ⛔ VERBATIM. Never a paraphrase, never reflowed, never normalised — this is the proof. */
  sentence: string;
  /** The person whose sentence it is. */
  by: string;
  /** Which slot or slots the sentence answers. A reading. */
  fills: SlotName[];
  /** Whether it is the answer where a slot is silent, or a requirement on top of whatever is said. */
  mode: "supplies" | "constrains";
  /** The sentence's home scope — the vocabulary its selector is written in. */
  in?: string;
  /** Where it reaches. A reading, policed below. */
  scope: Selector;
  /** For `fills: refuses` — the named cases, as `Rule` requires. */
  outcomes?: Rule["outcomes"];
  /** Who read the sentence this way. ⛔ Never the same as `by` unless the person wrote the selector. */
  read_by: string;
  /** The id it will be filed under. Defaults to a slug of the sentence. */
  id?: string;
}

/**
 * Why a claim is settled. ⛔ Three grounds, and only one of them involves reading English.
 *
 *  - `silence`  — the slot says nothing and this sentence supplies the whole of it. The sentence a
 *                 person agreed to and the sentence the slot promises are the same string. This is
 *                 what `acceptedThroughRule` already recognises and it needs no judgement at all.
 *  - `same-words` — the slot states this sentence, give or take a reflow. Certain, mechanically.
 *  - `read-as-settling` — the slot states words of its own, and a judgement says this sentence
 *                 commits to everything they commit to. ⛔ THE ONLY INFERENTIAL GROUND, and the
 *                 only one that can be wrong.
 */
export type Ground = "silence" | "same-words" | "read-as-settling";

/**
 * Why a claim is asked instead.
 *
 * ⛔ EVERY ONE OF THESE IS A DEFAULT, NOT A DETECTION. The question is "is there positive, current,
 * argued evidence that this sentence settles these words" — and each value below is a way of there
 * not being any. Absence resolves to asking, which is what makes under-reach the cheap direction.
 */
export type Asked =
  /** The slot says something of its own and nothing judged whether this sentence covers it. */
  | "no-reading"
  /** A judgement exists and says no. */
  | "read-as-not-settling"
  /** A judgement exists, about words that are not the words there now. */
  | "reading-is-stale"
  /** A judgement exists with no argument for it. */
  | "reading-is-bare"
  /** The slot stands open. ⛔ A sentence RULES one of those; it never accepts it. See `rules` below. */
  | "undecided"
  /** The slot stands disputed or deliberately unanswered — a declaration a person made. */
  | "declared";

/**
 * One judgement about one claim: does this sentence settle THESE words?
 *
 * ⛔ IT ARRIVES AS DATA AND IS POLICED, RATHER THAN BEING CALLED FROM INSIDE. Reading English needs
 * a model, and a model called from inside a derivation would be: non-deterministic, so a stamp
 * would flicker between two renders of one page; unreviewable, because nothing would record what
 * was judged; and re-run on every read, because `stampFor` is asked this question once per ref.
 *
 * Four properties make it containable, and each closes a specific way one sentence could launder
 * consent over many claims:
 *
 *   - ⛔ **It cannot widen reach.** There is one of these per claim the SELECTOR produced. A
 *     judgement about a ref outside the reach is ignored, so no judgement can add a claim.
 *   - ⛔ **`of` is the claim's own words, and it is hashed.** A judgement cannot be produced
 *     without having been handed the exact sentence it is about — which means the reach was
 *     computed first and one claim was read at a time. This is the structural half: a model cannot
 *     spray `settles: true` across a feature it only saw the name of.
 *   - ⛔ **It cannot outlive the words it read.** The claim is reworded, the judgement goes stale,
 *     the claim goes back to being asked. Same rule as every stamp in `stamp.ts`, for the same
 *     reason.
 *   - ⛔ **Absent means asked.** Not "settled by default", not "assumed", not an error. Nothing is
 *     the safe answer in the only direction where safe is cheap.
 *
 * ⛔ WHAT IT IS NOT: an acceptance. A judgement only decides whether a claim appears on the list a
 * person reads. The acceptance is the person's single press over that list — see `recordOf`. The
 * floor on `because` is not the protection either, and pretending otherwise would be dishonest: a
 * model pays characters for free, as `Verdict`'s own comment says. The protection is that the
 * argument is ON THE LIST, in front of the person, beside the words it is an argument about.
 */
export interface Reading {
  /** `<scope>#<exchange>#<slot>`. */
  ref: string;
  /** The claim's words, as judged. Compared against the words there now. */
  of: string;
  /** Who made this judgement — a model name, or a person who read it by hand. */
  by: string;
  settles: boolean;
  /** Why. ⛔ Goes onto the preview verbatim; a claim whose argument is blank is asked. */
  because: string;
}

/** ⛔ The same floor the strongest act in the schema pays: `Verdict.because` on a ruling. */
const ARGUMENT_FLOOR = 40;

export interface Settled {
  ref: string;
  ground: Ground;
  /** The argument for covering this claim with somebody else's sentence. */
  because: string;
  /** Who made that argument. ⛔ `software` on the two mechanical grounds, which needed nobody. */
  read_by: string;
  /** The claim's own words at the moment of the reading — what the person is shown. */
  says: string;
  /** Everything the stamp would cover here, from `coveredBy`, so the preview and the hashes agree. */
  reads: string[];
  covers_slots: string;
  covers_criteria: string;
}

export interface Asking {
  ref: string;
  why: Asked;
  /** The claim's own words, so the question can be asked about something. */
  says: string;
  /** What to put to the person about this one. */
  question: string;
}

export interface Application {
  /** The sentence as a `Rule` — ⛔ reusing everything, see the file header on why not something new. */
  rule: Rule;
  /** ⛔ Verbatim, again, beside the rule, because this is the string a reader a year later needs. */
  sentence: string;
  by: string;
  /** What this sentence settles. ⛔ Enumerated in full; `previewOf` refuses to truncate it. */
  settles: Settled[];
  /** What it reached and did not settle. ⛔ Offered as questions, which is the whole point. */
  asks: Asking[];
  /**
   * Open standings this sentence would ANSWER rather than accept.
   *
   * ⛔ A SEPARATE LIST BECAUSE IT IS A DIFFERENT ACT. A slot standing `open` has no sentence, so
   * there is nothing to accept — ruling it WRITES one into the truth, which is `settle.ts` and the
   * `rule` act, and costs a `because` and a named chosen option. Folding these into `settles`
   * would have one press both agree to a sentence and author one.
   */
  rules: Array<{ ref: string; question: string }>;
  /** How many slot refs in this corpus the sentence does not touch at all. */
  untouched: number;
}

export interface Refused {
  refused: string;
  /** What would make the sentence applicable. */
  instead: string;
}

const isRefused = (x: unknown): x is Refused =>
  !!x && typeof x === "object" && "refused" in (x as object);
export { isRefused };

/**
 * The claim's own words — what a judgement is about, and what a person is shown.
 *
 * ⛔ THE SLOT'S OWN SENTENCE, NOT THE RESOLVED BEHAVIOUR. `coveredBy().reads` is the resolved
 * reading, which includes every rule already landing here — so hashing a judgement against it
 * would stale the judgement when an unrelated rule arrived elsewhere. What a judgement is about is
 * the words this slot states, and nothing else.
 *
 * ⛔ Through `optionText`, which already knows that `refuses` carries named cases rather than a
 * sentence and that `none: true` is a real answer. A second formatter here would be the second
 * hand-maintained copy of one fact.
 */
export function claimWords(corpus: Corpus, ref: string): string | null {
  const [scopeId, exId, slotName] = ref.split("#");
  if (!scopeId || !exId || !slotName) return null;
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exId);
  if (!ex) return null;
  if (!(SLOTS as readonly string[]).includes(slotName)) return null;
  const fill = ex.slots[slotName as SlotName];
  if (fill === undefined) return "";
  return norm(optionText(fill as Parameters<typeof optionText>[0]));
}

/**
 * Which declared words this sentence actually uses.
 *
 * ⛔ THE ONE PART OF THE SELECTOR THAT IS MECHANICAL, AND IT CLOSES THE WORST DRAFTING ERROR.
 *
 * `term:` is the dimension that widens reach fastest — `term: money` is every exchange in the
 * product that touches money — and a reading that picks a term the person never said has invented
 * reach out of nothing. So a drafted selector may only select on a word the sentence contains.
 *
 * Stemmed the same crude way `permittedVocabulary` stems, and for the same reason: without it
 * "folders" does not match the declared word `folder`, and a detector that also rejects honest
 * drafts is one nobody uses.
 */
export function wordsIn(corpus: Corpus, sentence: string, where: string): string[] {
  const said = new Set(
    norm(sentence)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(stem)
  );
  const out: string[] = [];
  for (const id of lineageOf(corpus, where)) {
    const terms = corpus.scopes.find((s) => s.scope.id === id)?.scope.terms ?? {};
    for (const word of Object.keys(terms)) {
      const parts = word.toLowerCase().split(/\s+/).map(stem);
      if (parts.every((p) => said.has(p))) out.push(word);
    }
  }
  return [...new Set(out)];
}

function stem(w: string): string {
  return w
    .replace(/(ies)$/, "y")
    .replace(/(sses|shes|ches|xes)$/, "")
    .replace(/(ing|ed|es|s)$/, "");
}

/** A sentence's default id. ⛔ An id is an address, so it is derived once and then it is fixed. */
export function slugOf(sentence: string): string {
  const s = norm(sentence)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .join("-");
  return s.length >= 3 ? s : `stated-${h(norm(sentence)).slice(7, 15)}`;
}

/**
 * The sentence as a `Rule`.
 *
 * ⛔ A STATED SENTENCE IS A RULE, AND REUSING IT IS NOT A CONVENIENCE — IT IS THE ONLY WAY THE
 * GUARANTEES COME WITH IT. Five of them, none of which a parallel object would inherit:
 *
 *   1. `Rule` is already defined as *"a sentence whose subject is a class of exchanges rather than
 *      one"*. Peter's sentence is exactly that and nothing else.
 *   2. `coveredBy` already hashes a rule's statement into the stamp of EVERY ref it reaches, so
 *      rewording the sentence breaks the rule's own stamp and every claim settled through it.
 *      That is the reversibility requirement, already built.
 *   3. `check` already inverts the selector — `rule-governs-nothing`,
 *      `selects-nothing-that-exists`, `two-rules-answer-this` — and already refuses
 *      `a-rule-that-demonstrates-nothing` at handover. A new object would get none of those and
 *      would be the v1 "principle that carried no criteria and reached nothing", which is the
 *      failure `Selector`'s own comment names.
 *   4. `excepts`, `instead_of` and `defers_to` already give a per-claim way out, each costing a
 *      written reason. That is "individually reversible", already built, and only for rules.
 *   5. `Rule.standing: open` already lets a class-wide sentence be undecided — so a sentence
 *      nobody can pin down is asked rather than assumed.
 */
export function ruleFor(stated: Stated): Rule | Refused {
  const parsed = Rule.safeParse({
    id: stated.id ?? slugOf(stated.sentence),
    statement: norm(stated.sentence),
    fills: stated.fills,
    mode: stated.mode,
    in: stated.in,
    scope: stated.scope,
    ...(stated.outcomes ? { outcomes: stated.outcomes } : {}),
    criteria: [],
  });
  if (!parsed.success)
    return {
      refused: `this sentence cannot stand as a rule: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      instead: "say it again with the part that is missing, or file it as an open question about the class",
    };
  return parsed.data;
}

/**
 * Every slot ref in this corpus, so "untouched" is a number rather than an impression.
 *
 * ⛔ A count, deliberately, and the only count in the preview. A person pressing once needs to know
 * the sentence did not run away — "4 settled, 2 asked, 50 untouched" is that, and showing fifty
 * refs nobody is being asked about would bury the two that matter.
 */
function allSlotRefs(corpus: Corpus): string[] {
  return corpus.scopes.flatMap(({ scope }) =>
    scope.exchanges.flatMap((ex) => SLOTS.map((s) => `${scope.id}#${ex.id}#${s}`))
  );
}

/**
 * What this sentence settles, and what it asks.
 *
 * ⛔ THE REFUSALS COME FIRST AND THEY ARE THE POINT OF THE FUNCTION. A reading that cannot be
 * policed is a reading that gets believed, and this is the one mechanism in the product where
 * being believed wrongly is invisible afterwards.
 */
export function applySentence(
  corpus: Corpus,
  stated: Stated,
  readings: readonly Reading[] = []
): Application | Refused {
  if (norm(stated.sentence).length < 20)
    return {
      refused: "a sentence about a whole class of exchanges has to say something a builder could act on",
      instead: "say what the restriction actually is, in one sentence",
    };

  /**
   * ⛔ `everywhere: true` IS NOT AVAILABLE TO A STATED SENTENCE, AND THIS IS THE HARDEST GUARD HERE.
   *
   * It reaches every product in the corpus from one sentence — including, in the failure the
   * schema records, a school tuck shop volunteer being handed *"Only a parent may change what a kid
   * has"*. The schema makes it sayable because an author may genuinely mean it; but an author
   * saying it has typed it into a file and can be asked why. A reading that lands it off the back
   * of one English sentence has quietly chosen the widest possible blast radius, and the person
   * pressing cannot see the difference between that and a well-scoped rule — both just produce a
   * list.
   *
   * So the widest reach in the model stays an authored decision. Say which part of the product.
   */
  if (stated.scope.everywhere)
    return {
      refused: "a stated sentence does not reach every product in this corpus at once",
      instead: "name the part of the product it is about — `in:` its home, or `under:` a branch",
    };

  const home = stated.in ?? stated.scope.under;
  if (!home)
    return {
      refused: "nothing says which part of the product this sentence is about",
      instead: "give it a home scope, or scope it under the branch it governs",
    };

  /**
   * ⛔ A SELECTOR MAY NOT SELECT ON A WORD THE PERSON DID NOT SAY. See `wordsIn` — this is the one
   * drafting error that invents reach rather than mis-aiming it, and it is the cheapest to catch.
   */
  if (stated.scope.term) {
    const said = wordsIn(corpus, stated.sentence, home);
    if (!said.includes(stated.scope.term))
      return {
        refused: `this was read as a sentence about "${stated.scope.term}", and the sentence does not say that word`,
        instead: said.length
          ? `it says ${said.map((w) => `"${w}"`).join(" and ")} — read it as being about one of those, or about no word in particular`
          : "it uses none of this part of the product's declared words, so say which one it is about",
      };
  }

  const drafted = ruleFor(stated);
  if (isRefused(drafted)) return drafted;
  const rule = drafted;

  /**
   * ⛔ REACH THROUGH THE SAME RESOLVER EVERY OTHER RULE GOES THROUGH, with this rule spliced into
   * the corpus — not a second traversal of the scopes. `resolveRules` is where `excepts`,
   * `instead_of`, `defers_to`, displacement and contest are decided, and a parallel walk here
   * would be a second implementation of inheritance, which this codebase has watched diverge
   * within the hour.
   */
  const spliced: Corpus = { ...corpus, rules: [...corpus.rules, { rule, body: "", file: "(stated)" }] };
  const { inherited, constrained, displaced } = resolveRules(spliced);

  /** Which refs this rule actually landed on, by relation. Nothing else is a candidate. */
  const candidates = new Map<string, "silence" | "on-top-of-words">();
  for (const [ref, r] of inherited) if (r.id === rule.id) candidates.set(ref, "silence");
  for (const [ref, rs] of constrained)
    if (rs.some((r) => r.id === rule.id)) candidates.set(ref, "on-top-of-words");
  for (const [ref, rs] of displaced)
    if (rs.some((r) => r.id === rule.id)) candidates.set(ref, "on-top-of-words");

  const byRef = new Map<string, Reading>();
  for (const r of readings) byRef.set(r.ref, r);

  const settles: Settled[] = [];
  const asks: Asking[] = [];
  const rules: Array<{ ref: string; question: string }> = [];

  for (const [ref, relation] of [...candidates].sort(([a], [b]) => a.localeCompare(b))) {
    const words = claimWords(corpus, ref) ?? "";
    const standing = standingOf(corpus, ref);
    /**
     * ⛔ AGAINST THE SPLICED CORPUS, NOT THE CURRENT ONE, AND BOTH HALVES OF THAT MATTER.
     *
     * What is SHOWN: on a slot settled by `silence` the sentence IS the content, so reading the
     * current corpus shows a person "(nothing)" and never the named cases or the statement that
     * will stand there. That is the `coveredBy` failure one layer up — a human stamped "the shared
     * refusal vocabulary" without being shown a word of the vocabulary.
     *
     * What is HASHED: the verdict is written after the rule is filed, so the words it covers
     * include this rule's. Hashing the corpus as it stands today would produce a stamp that is
     * stale the instant the sentence it was made of arrives.
     */
    const cov = coveredBy(spliced, ref);
    if (!cov) continue;

    const settle = (ground: Ground, because: string, read_by: string): void => {
      settles.push({
        ref,
        ground,
        because,
        read_by,
        says: words,
        reads: cov.reads,
        covers_slots: cov.slots,
        covers_criteria: cov.criteria,
      });
    };
    const ask = (why: Asked, question: string): void => {
      asks.push({ ref, why, says: words, question });
    };

    /**
     * ⛔ AN OPEN SLOT IS RULED, NEVER ACCEPTED, and this branch is before everything else because
     * the alternative silently authored truth. A slot standing `open` has no sentence; agreeing to
     * it would be agreeing to a blank, and writing the stated sentence into it is a `rule` act with
     * its own floors and its own record of which candidate was chosen.
     */
    if (standing === "open") {
      rules.push({
        ref,
        question: `this sentence would answer an open question here — rule it, with the reasoning, rather than accepting a blank`,
      });
      continue;
    }
    /**
     * ⛔ A DECLARATION IS NOT A BLANK. `disputed` says two sentences cannot both hold and nobody
     * has ruled; `out_of_scope` says somebody deliberately declined to answer here and paid a
     * reason for it. A new sentence arriving does not get to overwrite either, and reading them as
     * silence is how a waiver gets laundered into agreement.
     */
    if (standing === "disputed" || standing === "out_of_scope") {
      ask("declared", `somebody declared this ${standing.replace(/_/g, " ")} — reconcile that before this sentence covers it`);
      continue;
    }

    if (relation === "silence") {
      /**
       * ⛔ NO JUDGEMENT NEEDED, AND NONE ACCEPTED. The slot says nothing, this rule supplies it, so
       * the sentence a person agreed to and the sentence this slot promises are the same string.
       * `acceptedThroughRule` already recognises exactly this, for exactly this reason.
       */
      settle(
        "silence",
        "the slot says nothing of its own, so this sentence is the whole of what it promises",
        "software"
      );
      continue;
    }

    if (words && norm(words).toLowerCase() === norm(stated.sentence).toLowerCase()) {
      settle("same-words", "the slot already states this sentence, give or take a reflow", "software");
      continue;
    }

    const reading = byRef.get(ref);
    if (!reading) {
      ask(
        "no-reading",
        "this slot says something of its own and nothing judged whether the sentence settles it — so it is still a question"
      );
      continue;
    }
    /**
     * ⛔ THE HASH, NOT THE STRING, AND NOT A SIMILARITY. A judgement about words that are not the
     * words there now is a judgement about a sentence nobody is being shown. It is the same failure
     * as a stamp surviving a reword — consent attached to words nobody read — one layer earlier.
     */
    if (h(norm(reading.of)) !== h(norm(words))) {
      ask(
        "reading-is-stale",
        "the judgement about this slot was made about different words — read the sentence that is here now"
      );
      continue;
    }
    if (!reading.settles) {
      ask("read-as-not-settling", reading.because || "the sentence does not settle what this slot says");
      continue;
    }
    if (norm(reading.because).length < ARGUMENT_FLOOR) {
      ask(
        "reading-is-bare",
        "nothing argues why this sentence covers the words already here, and a person cannot check an assertion with no argument in it"
      );
      continue;
    }
    settle("read-as-settling", norm(reading.because), reading.by);
  }

  return {
    rule,
    sentence: stated.sentence,
    by: stated.by,
    settles,
    asks,
    rules,
    untouched: allSlotRefs(corpus).length - candidates.size,
  };
}

function standingOf(corpus: Corpus, ref: string): string {
  const [scopeId, exId, slotName] = ref.split("#");
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exId);
  const fill = ex?.slots[slotName as SlotName];
  return fill?.standing?.kind ?? "stated";
}

/**
 * The full list, in the person's own terms, BEFORE anything settles.
 *
 * ⛔ THIS IS THE GUARANTEE, AND NOTHING ELSE IN THE FILE IS. No policing of a reading makes a
 * reading right — a model can produce a plausible argument for a claim the sentence does not cover,
 * and no amount of structure detects that. What catches it is a person reading the claim's own
 * words with the argument beside them and saying no.
 *
 * ⛔ SO IT NEVER COUNTS WHERE IT COULD SHOW. `stamp.ts` learned this the hard way: the accept
 * preview said *"and its 5 criteria as they stand now"* and showed none, while the stamp covered
 * every word of them. Counting is not showing. Every settled claim appears in full, with every line
 * `coveredBy` hashes for it — so what is on screen and what the stamp covers are the same set.
 *
 * ⛔ AND THE ASKS ARE ON IT TOO. A person who sees only what their sentence settled cannot tell
 * under-reach from completeness, and will assume the two claims it missed were covered. The
 * questions are the other half of the answer.
 */
export function previewOf(app: Application): string[] {
  const out: string[] = [];
  out.push(`${app.by} says:`);
  out.push(`  “${norm(app.sentence)}”`);
  out.push("");
  out.push(
    `read as ${app.rule.mode === "supplies" ? "the answer where nothing is said" : "a requirement on top of whatever is said"}` +
      ` about ${app.rule.fills.join(" and ")}, ${reachWords(app.rule)}`
  );
  out.push("");

  if (!app.settles.length) out.push("this settles nothing — every claim it reaches is below, as a question");
  else out.push(`agreeing to this sentence settles ${app.settles.length} claim${app.settles.length === 1 ? "" : "s"}:`);
  for (const s of app.settles) {
    out.push("");
    out.push(`  ${s.ref}`);
    out.push(`    it says now: ${s.says || "(nothing — this sentence becomes the whole of it)"}`);
    out.push(`    settled because: ${s.because}`);
    out.push(`    read by: ${s.read_by}${s.ground === "read-as-settling" ? " — ⛔ a reading of the sentence, not the sentence itself" : ""}`);
    /**
     * ⛔ WHAT IT WILL SAY, FROM THE RULE, BECAUSE `coveredBy` DOES NOT CARRY IT AT THIS GRAIN.
     *
     * `coveredBy` looks a resolved rule up as `` `${target}#${slot}` `` while `target` is already
     * the slot ref — so on a slot-grained ref, which is the grain a reviewer actually works at,
     * every inherited and constraining rule drops out of both `reads` and the hash. Accepting
     * `money#record-earning#may` today shows a person the exchange title and nothing else, on a
     * slot whose entire content is an org-wide sentence. See this file's report; the fix is in
     * `stamp.ts`, which another hand owns.
     *
     * ⛔ And this is not a second implementation of that lookup. It prints what THIS rule says,
     * read off this rule — one fact from its one home — rather than re-deriving the resolution.
     */
    if (s.ground === "silence") {
      out.push(`    it will say: ${norm(app.rule.statement ?? "")}  (from ${app.rule.id})`);
      for (const o of app.rule.outcomes ?? [])
        out.push(`      refuses ${o.name} when ${norm(o.when)} → ${norm(o.told)}`);
    }
    for (const line of s.reads) out.push(`    ${line}`);
  }

  if (app.rules.length) {
    out.push("");
    out.push(`and would ANSWER ${app.rules.length} open question${app.rules.length === 1 ? "" : "s"} — a separate act, with its own reasoning:`);
    for (const r of app.rules) out.push(`  ${r.ref} — ${r.question}`);
  }

  if (app.asks.length) {
    out.push("");
    out.push(`it reaches ${app.asks.length} more claim${app.asks.length === 1 ? "" : "s"} and does NOT settle ${app.asks.length === 1 ? "it" : "them"}:`);
    for (const a of app.asks) {
      out.push(`  ${a.ref}`);
      out.push(`    it says: ${a.says || "(nothing)"}`);
      out.push(`    ${a.question}`);
    }
  }

  out.push("");
  out.push(`${app.untouched} claims in this corpus are untouched by it.`);
  return out;
}

function reachWords(rule: Rule): string {
  const bits: string[] = [];
  if (rule.in) bits.push(`in ${rule.in}`);
  if (rule.scope.under) bits.push(`under ${rule.scope.under}`);
  if (rule.scope.term) bits.push(`wherever "${rule.scope.term}" is ${rule.scope.acts_on ?? "read or changed"}`);
  else if (rule.scope.acts_on) bits.push(`wherever anything is ${rule.scope.acts_on}`);
  if (rule.scope.asked_by) bits.push(`asked by a ${rule.scope.asked_by}`);
  if (rule.scope.tag) bits.push(`tagged ${rule.scope.tag}`);
  if (rule.scope.view_kind) bits.push(`on a ${rule.scope.view_kind}`);
  if (rule.scope.part_role) bits.push(`at a ${rule.scope.part_role} control`);
  if (rule.scope.only) bits.push(`on ${rule.scope.only.join(", ")}`);
  return bits.join(", ") || "⛔ nowhere in particular";
}

/**
 * What gets written when a person presses once over that list.
 *
 * ⛔ ONE HUMAN ACT, N RECORDS, AND THE N ARE SEPARATE ON PURPOSE. A single verdict on the rule
 * cannot hold what each claim said at the moment of consent, and `Verdict.covered_text` exists
 * precisely because six acceptances died of not having it: *"the sentence he actually agreed to was
 * gone: there was no way to show him what moved."* One sentence covering seven claims means seven
 * sets of words that will each move at their own pace, so each needs its own hashes and its own
 * recorded text — otherwise rewording one claim stales the other six, and a reviewer re-reads
 * sentences nobody touched.
 *
 * ⛔ SO EACH IS INDIVIDUALLY REVERSIBLE AND INDIVIDUALLY STALEABLE, which is the whole answer to
 * the danger. `stampFor` already does both with no change: it finds the accept on the ref, compares
 * the two hashes, and reports `claim-changed` the moment that claim's words move.
 *
 * ⛔ `through` AND `reading` KEEP THE TWO AUTHORS APART, AND THE FIELDS DO NOT EXIST YET — see this
 * file's report. `through` names the rule, exactly as `StampState.through` already does, so no
 * surface can show one of these as a direct press. `reading` is SOFTWARE's account of why the
 * sentence settles this claim, in its own field, attributed to whoever read it — the same shape and
 * the same reason as `Verdict.chose`/`option_said`, whose comment says the winning option's
 * argument *"is kept, in its own field, attributed to whoever drafted it rather than to whoever
 * ruled."* Putting a model's argument in `because` would read, a year later, as the person's
 * reasoning — which is the one confusion this mechanism cannot afford.
 *
 * Returns the records, and writes nothing: a person has not pressed yet when this is called.
 */
export interface SettledRecord {
  kind: "accept";
  by: string;
  at: string;
  target: string;
  via: "page" | "question" | "chat" | "cli";
  covers_slots: string;
  covers_criteria: string;
  covered_text: string[];
  /** ⛔ PENDING FIELD — the rule whose statement this acceptance was reached through. */
  through: string;
  /** ⛔ PENDING FIELD — software's reading, never the person's words. */
  reading: string;
  /** ⛔ PENDING FIELD — who read it that way. `software` where no judgement was involved. */
  read_by: string;
}

export function recordOf(
  app: Application,
  consent: { by: string; at: string; via: "page" | "question" | "chat" | "cli" }
): { rule: SettledRecord; claims: SettledRecord[] } | Refused {
  /**
   * ⛔ THE SENTENCE IS ACCEPTED FIRST, AND THE CLAIMS HANG OFF IT. Without the verdict on the rule
   * there is no sentence anybody agreed to, and N claims would read as accepted `through` something
   * nobody confirmed — which is `acceptedThroughRule`'s own precondition, inverted.
   */
  const cov = ruleCovered(app);
  if (!cov) return { refused: "the sentence is not in this corpus yet, so nothing can be agreed to through it", instead: "file the rule, then agree to it" };
  const base = { kind: "accept" as const, by: consent.by, at: consent.at, via: consent.via };
  return {
    rule: {
      ...base,
      target: app.rule.id,
      covers_slots: cov.slots,
      covers_criteria: cov.criteria,
      covered_text: cov.reads,
      through: app.rule.id,
      reading: "the sentence itself, as stated",
      read_by: "software",
    },
    claims: app.settles.map((s) => ({
      ...base,
      target: s.ref,
      covers_slots: s.covers_slots,
      covers_criteria: s.covers_criteria,
      covered_text: s.reads,
      through: app.rule.id,
      reading: s.because,
      read_by: s.read_by,
    })),
  };
}

/** The rule's own `coveredBy`, computed from the spliced corpus the rule lives in. */
function ruleCovered(app: Application): { slots: string; criteria: string; reads: string[] } | null {
  const r = app.rule;
  return {
    slots: h(canon({ ...r, criteria: undefined })),
    criteria: h(canon([])),
    reads: [
      norm(r.statement ?? ""),
      `  ${r.mode === "supplies" ? "supplies" : "constrains"} ${r.fills.join(" and ")} wherever its selector reaches`,
      ...(r.outcomes ?? []).map((o) => `  refuses ${o.name} when ${norm(o.when)} → ${norm(o.told)}`),
    ],
  };
}

/**
 * Whether this sentence, as read, lands anywhere at all.
 *
 * ⛔ A SENTENCE THAT REACHES NOTHING IS NOT AN ERROR AND MUST NOT BE SILENT. `check` already
 * refuses `rule-governs-nothing` on an authored rule; the same fact about a stated one is the
 * answer to a person who said something true that this product does not yet have claims about. The
 * sentence is worth keeping — it will govern exchanges nobody has written yet, which is the
 * difference between a rule and a convention.
 */
export function landsNowhere(corpus: Corpus, app: Application): boolean {
  const spliced: Corpus = { ...corpus, rules: [...corpus.rules, { rule: app.rule, body: "", file: "(stated)" }] };
  return (resolveRules(spliced).reach.get(app.rule.id) ?? []).length === 0;
}

/** Re-exported so a caller can ask the reach question without a second traversal. */
export { selectsFor };
