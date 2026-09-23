/**
 * What this corpus refuses — the enforcement half of the schema.
 *
 * ⛔ THE POINT OF THE SEVEN-SLOT GRID IS THAT INCOMPLETENESS IS COUNTABLE. A v1 corpus
 * could be thin and look finished, because nothing declared what a boundary owed. Here a
 * blank cell is a finding, and this file is where that is asserted.
 *
 * Three severities, and the line between them is deliberate:
 *   refuse   the corpus is wrong and must not be handed over
 *   note     worth a person's attention; never blocks
 *   shape    an observation about proportions, which no single page can show
 */
import { SLOTS, SLOT_ASKS, type SlotName , type Says} from "./schema.js";
import {
  DOWNSTREAM_OF_ANSWER,
  answerIsUnknown,
  loadCorpus,
  resolveRules,
  permittedVocabulary,
  disputeIndex,
  vocabularyReach,
  lineageOf,
  resolveView,
  existsOf,
  selectsFor,
  type Corpus,
} from "./load.js";
import { stampFor, staleReason, coveredBy } from "./stamp.js";
import { resolveRef } from "./ref.js";
import { descendants } from "./settle.js";
import { ruleHomes } from "./grid.js";

export type Severity = "refuse" | "note" | "shape";

export interface Finding {
  severity: Severity;
  kind: string;
  where: string;
  what: string;
  /** ⛔ Every finding says what to do. A finding you cannot act on is a complaint. */
  fix?: string;
}


/**
 * Over-assertion in a criterion's `then`. ⛔ ONE IMPLEMENTATION, TWO CALLERS.
 *
 * `then` is read strictly and `given`/`when` are not read at all, because setup is
 * legitimately concrete ("given a kid with three things recorded") and **the assertion is
 * what an engineer builds.** Two thresholds, because two different things go wrong: a
 * literal pins the build to one customer's configuration at ONE occurrence; novel content
 * words describe behaviour nothing promised, and one or two of those is paraphrase.
 *
 * Extracted because the detector was pointed only at exchanges. The identical
 * over-asserting sentence passed unmentioned on a RULE's criterion — which reaches every
 * exchange that rule governs, making it the higher-leverage place to smuggle something in.
 */
const NUMBER_WORDS = new Set([
  "zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven",
  "twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen",
  "twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety","hundred",
  "thousand","million","dozen","half","twice","once","first","second","third",
]);
const UNITS =
  /^(ms|millisecond|milliseconds|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|time|times|percent|pound|pounds|dollar|dollars|cent|cents)$/;

function tokens(s?: string): string[] {
  return (s ?? "").split(/[^A-Za-z0-9.,%$£€-]+/).filter(Boolean);
}

export function overAsserted(
  then: string,
  allowed: Set<string>,
  setup: Set<string>,
  /**
   * ⛔ OFF FOR A RULE, AND THE ASYMMETRY IS THE POINT.
   *
   * A slot's sentence is tight and its criterion demonstrates it, so a `then` naming three
   * things no slot says is a new feature. A RULE's statement is deliberately broad and its
   * conformance criteria are where the operational detail lives — "it stops showing work
   * and says what failed, in words the person can act on" is the rule explaining itself,
   * not smuggling. Applying the novel-word threshold to rules refused four of the seven
   * rules in the example corpus, all of them correctly written.
   *
   * The LITERAL threshold still applies, and at a rule it matters more than anywhere: a
   * vendor name or a duration in a rule criterion reaches every exchange the rule governs.
   */
  countNovelWords = true
): string[] {
  const literals = new Set<string>();
  const novel = new Set<string>();
  for (const w of tokens(then)) {
    const lower = w.toLowerCase().replace(/[.,;:]+$/, "");
    if (!lower || allowed.has(lower) || STOP.has(lower)) continue;
    const st = lower.replace(/(ies)$/, "y").replace(/(sses|shes|ches|xes)$/, "").replace(/(ing|ed|es|s)$/, "");
    if (allowed.has(st) || STOP.has(st)) continue;
    if (/[0-9]/.test(lower) || NUMBER_WORDS.has(lower) || UNITS.test(lower)) {
      if (setup.has(lower)) continue; // the fixture's own arity is not a pin
      literals.add(lower);
      continue;
    }
    if (/^[A-Z][a-zA-Z]*$/.test(w)) {
      literals.add(lower);
      continue;
    }
    novel.add(lower);
  }
  const why: string[] = [];
  if (literals.size >= 1)
    why.push(
      `pins ${[...literals].slice(0, 5).map((x) => `"${x}"`).join(", ")} — one customer's configuration, not the rule`
    );
  if (countNovelWords && novel.size >= 3)
    why.push(
      `asserts ${[...novel].slice(0, 6).map((x) => `"${x}"`).join(", ")} — behaviour the slot never promised`
    );
  return why;
}

const pc0 = (s: string) => s;

/** ⛔ Resolution without throwing, for findings that reference things that may not exist. */
function resolveRefSafely(c: Corpus, raw: string) {
  const r = resolveRef(c, raw);
  return "error" in r ? undefined : r;
}

const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

export function checkCorpus(root: string): { corpus: Corpus; findings: Finding[] } {
  const corpus = loadCorpus(root);
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  for (const b of corpus.broken) {
    add({ severity: "refuse", kind: "will-not-parse", where: b.file, what: b.why });
  }
  /**
   * ⛔ NOTHING DERIVED IS REPORTED WHILE A FILE WILL NOT PARSE, because the gate turns into a
   * vandal.
   *
   * One stray `retention: two years` on a slot produced four refusals — and three of them
   * were `rule-governs-nothing / this is a principle that carries no weight — widen the
   * selector, **or delete it**`, aimed at *"Only a parent may change what a kid has"*. The
   * rule governed nothing because the file declaring the exchanges it governs had not loaded.
   *
   * Fixing the one character took it to zero refusals. An author — or an LLM told to iterate
   * until the gate is green — deletes the authorization rule from a children's money product
   * and the gate thanks them.
   */
  if (corpus.broken.length) {
    findings.push({
      severity: "refuse",
      kind: "cannot-judge-this-corpus",
      where: corpus.broken.map((b) => b.file.split("/").pop()).join(", "),
      what: `${corpus.broken.length} file${corpus.broken.length === 1 ? "" : "s"} would not load, so nothing else here can be judged — every rule, reference and shape finding would be computed against a corpus that is missing part of itself`,
      fix: "fix the parse errors above first. Anything this would have reported may be an artefact of the missing file, and acting on it can delete truth that was never wrong",
    });
    return { corpus, findings };
  }

  const { inherited, constrained, contested, displaced, reach, awaiting } = resolveRules(corpus);

  /**
   * ---- identity: two things that cannot both be called this ----
   *
   * ⛔ Nothing checked that an id was unique. Copying one truth file produced two scopes
   * called `tasks`: the grid rendered it twice, `scopeById` silently kept whichever file
   * sorted last, and every `scope#…` reference in the corpus — deferrals, disputes,
   * readings, `blocks` — resolved against that one. No finding. A corpus where a reference
   * quietly means one of two things is not one a stamp can cover.
   */
  const seenScope = new Set<string>();
  for (const { scope, file } of corpus.scopes) {
    if (seenScope.has(scope.id))
      add({
        severity: "refuse",
        kind: "two-things-share-an-id",
        where: scope.id,
        what: `two scopes are called "${scope.id}" (${file.split("/").pop()})`,
        fix: "every reference to it resolves to only one of them, silently — rename one",
      });
    seenScope.add(scope.id);
    const seenEx = new Set<string>();
    for (const ex of scope.exchanges) {
      if (seenEx.has(ex.id))
        add({
          severity: "refuse",
          kind: "two-things-share-an-id",
          where: `${scope.id}#${ex.id}`,
          what: `two exchanges are called "${ex.id}"`,
          fix: "rename one — a stamp, a deferral or a dispute naming this reaches only one",
        });
      seenEx.add(ex.id);
      const seenCrit = new Set<string>();
      for (const c of ex.criteria) {
        if (seenCrit.has(c.id))
          add({
            severity: "refuse",
            kind: "two-things-share-an-id",
            where: `${scope.id}#${ex.id} criterion ${c.id}`,
            what: `two criteria are numbered ${c.id}`,
            fix: "renumber — the criteria hash covers a set, and a duplicate id makes it ambiguous which was read",
          });
        seenCrit.add(c.id);
      }
    }

    /**
     * ---- one press, two answers ----
     *
     * ⛔ Nothing stopped two exchanges claiming the same view AND the same part. The
     * shipped corpus did it: `record-spending` and `spend-past-nothing` are the same
     * button, so the spend press had two contradictory idempotency answers — one marked
     * "not ruled, stop and ask" and the other silently inheriting the org rule. A
     * builder implementing that button gets deduplication for overspends and an open
     * question for ordinary spends, and no page anywhere says the two are related.
     */
    /* ⛔ Keyed on the RESOLVED control and collected across the whole corpus — see the
     * `byControl` pass after this loop. Keying it per scope let two exchanges in different
     * scopes claim one button by each declaring their own copy of the view. */

    /**
     * ---- an ask that arrives at a screen or control nobody declared ----
     *
     * ⛔ THE ONLY UNVALIDATED REFERENCES LEFT IN THE MODEL, and they decide which rules reach
     * an exchange.
     *
     * `at: {view: earn-form-typo, part: recordx}` produced **zero findings** while
     * `record-earning` silently lost `work-in-flight-is-visible` from both `answer` and
     * `fails` — the grid went `✓+R3+R7 ↑R4+R7` to `✓+R3 ↑R4`, and "6 also carry a rule"
     * became 5. Every other reference in the corpus is checked; these two were not, and they
     * are the ones a `part_role` selector resolves through.
     */
    for (const ex of scope.exchanges) {
      if (!ex.at) continue;
      // ⛔ Resolved corpus-wide, so a behaviour can arrive on another area's screen. See
      // `resolveView` — restricting this to the declaring scope forced grouping by screen, and
      // the workaround reviewers found was duplicating the view, which escaped the
      // one-control-one-answer refusal entirely.
      const found = resolveView(corpus, scope, ex.at.view);
      const v = found?.view;
      if (!v) {
        add({
          severity: "refuse",
          kind: "arrives-nowhere",
          where: `${scope.id}#${ex.id}`,
          what: `arrives at view "${ex.at.view}", which nothing declares${
            corpus.scopes.filter((s) => s.scope.views.some((x) => x.id === ex.at!.view)).length > 1
              ? " unambiguously — more than one scope declares that id, so qualify it as <scope>#<view>"
              : ""
          }`,
          fix: "name the view it really arrives at, qualified as <scope>#<view> if it belongs to another area — a rule selecting on the screen or the control resolves through this, so a typo here silently un-governs the exchange",
        });
        continue;
      }
      // ⛔ See the ⛔ note on `at` in schema.ts: omitting the part escaped the one-control
      // refusal and un-governed every part_role rule, for free.
      if (!ex.at.part && v.parts.some((p) => p.role === "commits" || p.role === "navigates"))
        add({
          severity: "refuse",
          kind: "arrives-nowhere",
          where: `${scope.id}#${ex.id}`,
          what: `arrives at ${v.id} and names no part, while that screen has controls on it`,
          fix: `say which: ${v.parts.filter((p) => p.role !== "display" && p.role !== "region").map((p) => p.id).join(", ")} — the control is what makes one ask distinguishable from another on the same screen, and what a part_role rule resolves through`,
        });
      if (ex.at.part && !v.parts.some((p) => p.id === ex.at!.part))
        add({
          severity: "refuse",
          kind: "arrives-nowhere",
          where: `${scope.id}#${ex.id}`,
          what: `arrives at "${ex.at.part}" on ${v.id}, which has no such part`,
          fix: `${v.id} declares ${v.parts.map((p) => p.id).join(", ") || "no parts at all"} — a rule selecting \`part_role\` resolves through this`,
        });
    }

    /**
     * ---- machinery that follows an ask nobody can find ----
     *
     * ⛔ `when.after` is resolved like every other reference. Without it the relation was prose
     * and the two halves of one event could contradict each other in two products with nothing
     * to read them together.
     */
    for (const ex of scope.exchanges) {
      if (!ex.when?.follows) continue;
      const r = resolveRefSafely(corpus, ex.when.follows);
      if (!r || (r.ref.kind !== "exchange" && r.ref.kind !== "slot"))
        add({
          severity: "refuse",
          kind: "follows-nothing",
          where: `${scope.id}#${ex.id}`,
          what: `runs after "${ex.when.follows}", which is not an exchange here`,
          fix: "name the ask this really follows — a builder needs to know what sets this off, and whoever owns that ask needs to see that something follows it",
        });
    }

    /**
     * ---- a term nobody declared ----
     *
     * ⛔ `reads` and `changes` were unvalidated strings, and they decide which rules reach
     * an exchange. One typo — `changes: [monies]` — silently dropped BOTH the authorization
     * rule and the concurrency rule from a money write, with no finding, and the grid read
     * *more* complete because the inherited cells became locally stated ones.
     */
    // ⛔ Ancestry AND `depends_on`. See `vocabularyReach` — restricting this to `in:` made
    // an author mint a parent container just to share one word between two siblings.
    const declared = new Set<string>();
    for (const id of vocabularyReach(corpus, scope.id))
      for (const term of Object.keys(corpus.scopes.find((s) => s.scope.id === id)?.scope.terms ?? {}))
        declared.add(term);
    for (const ex of scope.exchanges)
      for (const [field, list] of [["reads", ex.reads], ["changes", ex.changes]] as const)
        for (const term of list)
          if (!declared.has(term))
            add({
              severity: "refuse",
              kind: "not-a-word-here",
              where: `${scope.id}#${ex.id}`,
              what: `${field} "${term}", which nothing declares as a term`,
              fix: "these decide which org-wide rules reach this exchange, so a typo here silently un-governs it — declare the term, or fix the spelling",
            });

    /**
     * ---- something that does not exist, handed over as though it did ----
     *
     * ⛔ `exists` was declared on Scope and Exchange and read only on View. So
     * `exists: withdrawn` on an exchange left it in the grid, in `acts`, and in the packet
     * under its own heading as truth to build — a behaviour somebody had removed, delivered
     * to a builder as observed fact.
     */
    /**
     * ⛔ `changes:` AND `after` CANNOT DRIFT APART, BECAUSE FOR A WHOLE MODEL VERSION THEY WERE
     * NEVER COMPARED AND ONE OF THEM WAS ALWAYS A LIE.
     *
     * Before `after` existed, the state change lived as a clause inside `answer` prose. Deleting
     * *"the amount is added to what the kid has"* from `money#record-earning#answer` on the
     * pristine seed produced a `check` output byte-identical to the original — the money moving,
     * in a pocket-money product, gone from the product truth with every surface reporting the
     * corpus fine. `changes: [money, balance]` went on claiming the exchange changed money while
     * no sentence said it did.
     *
     * The slot closes the hole; these two close the gap between the slot and the declaration.
     * Both are exact structural contradictions — no prose matching, because the over-assertion
     * gate has already shown what word-counting prose costs.
     */
    for (const ex of scope.exchanges) {
      if (existsOf(corpus, scope.id, ex.exists) !== "withdrawn") {
        const after = ex.slots.after;
        const ref = `${scope.id}#${ex.id}`;
        // A term is declared changed, and the slot that says what changed says nothing changed.
        if (ex.changes.length && after?.none)
          add({
            severity: "refuse",
            kind: "says-it-changes-nothing-and-declares-otherwise",
            where: `${ref}#after`,
            what: `nothing is different afterwards, and this exchange declares it changes ${ex.changes.join(", ")}`,
            fix: "say what is different afterwards, or drop the terms from `changes:` — one of the two is wrong, and a builder reading them together cannot tell which",
          });
        // Something is left behind, and the exchange declares it touches nothing.
        if (!ex.changes.length && after?.says)
          add({
            severity: "refuse",
            kind: "leaves-something-nothing-declares",
            where: `${ref}#after`,
            what: "says something is different afterwards, and declares `changes: []`",
            fix: "name in `changes:` the words whose state this moves — that list is how another behaviour finds out this one can move something it reads",
          });
        /**
         * ⛔ A STATED `after` OWES A DEMONSTRATION, and the generic detector could not ask for one
         * because `none: true` is a legitimate answer here. An exchange that only reads leaves
         * nothing behind and has nothing to show; one that moves money and demonstrates nothing
         * is the single most expensive thing in this model to get wrong.
         */
        if (after?.says && !ex.criteria.some((c) => c.slot === "after"))
          add({
            severity: "note",
            kind: "nothing-demonstrates-what-it-leaves-behind",
            where: `${ref}#after`,
            what: "says what is different afterwards, and no criterion shows it",
            fix: "write a given/when/then whose `then` is the new state — the clause with no criterion is the one that goes missing without a trace",
          });
      }
      const e = existsOf(corpus, scope.id, ex.exists);
      if (e === "withdrawn")
        add({
          severity: "note",
          kind: "withdrawn-and-still-here",
          where: `${scope.id}#${ex.id}`,
          what: "withdrawn, and still carried everywhere as though it were kept",
          fix: "delete it if nothing depends on it — it is excluded from packets, from the accept queue and from who reads or writes a term while it says this",
        });
    }
  }
  const disputes = disputeIndex(corpus);
  /**
   * ⛔ The LAST deferral on a slot wins, and earlier ones are kept rather than dropped.
   *
   * `new Map(...)` over an append-only log silently discarded every earlier parking of the
   * same slot — so a question parked, unparked and parked again read as though it had only
   * ever been parked once, by whoever happened to be last.
   */
  const deferrals = new Map<string, (typeof corpus.verdicts)[number]>();
  const deferralCount = new Map<string, number>();
  for (const v of corpus.verdicts) {
    if (v.kind !== "defer") continue;
    deferrals.set(v.target!, v);
    deferralCount.set(v.target!, (deferralCount.get(v.target!) ?? 0) + 1);
  }
  const scopeById = new Map(corpus.scopes.map((s) => [s.scope.id, s.scope]));
  const exchangeRefs = new Set<string>();
  const slotRefs = new Set<string>();
  for (const { scope } of corpus.scopes) {
    for (const ex of scope.exchanges) {
      exchangeRefs.add(`${scope.id}#${ex.id}`);
      for (const s of SLOTS) slotRefs.add(`${scope.id}#${ex.id}#${s}`);
    }
  }

  let blanks = 0;
  let statedSlots = 0;
  let inheritedSlots = 0;
  let unsettled = 0;

  for (const { scope } of corpus.scopes) {
    if (scope.in && !scopeById.has(scope.in)) {
      add({
        severity: "refuse",
        kind: "scope-in-nothing",
        where: scope.id,
        what: `sits in "${scope.in}", which does not exist`,
        // ⛔ Do NOT suggest dropping `in:`. It carries `Selector.under`, `Selector.tag`,
        // vocabulary, and what `decide`/`read`/`packet` consider — so on a scope that
        // inherits anything, dropping it silently removes governing rules and makes the
        // corpus read quieter. This advice used to be the destructive option.
        fix: "fix the id — or if this scope really belongs nowhere, delete `in:` knowing it also drops every rule, tag and word it inherits",
      });
    }
    for (const d of scope.depends_on) {
      if (!scopeById.has(d))
        add({
          severity: "refuse",
          kind: "depends-on-nothing",
          where: scope.id,
          what: `depends on "${d}", which does not exist`,
          fix: "the machinery this rests on has no owner yet — give it a scope, or drop the edge",
        });
    }
    // ⛔ An exchange nobody asks is a Rule. This is the guard that stops a scope
    // accumulating behaviours with no asker, which is how v1's capability pages went thin.
    for (const ex of scope.exchanges) {
      const ref = `${scope.id}#${ex.id}`;

      /**
       * ⛔ A slot cannot be a hole when the answer above it is unsettled.
       *
       * You cannot say what an act refuses, how it fails, or what a repeat does until you
       * know what the act DOES. Refusing those as blanks told an author to invent refusals
       * for an answer nobody had ruled on — which is the framework demanding exactly the
       * guess it exists to prevent, and it did it four times per unsettled answer.
       *
       * `may` and `with` are not downstream: who may ask and what they bring are knowable
       * whatever the answer turns out to be.
       */
      const answerUnsettled = answerIsUnknown(ex.slots.answer);
      
      // ---- the grid: every slot is filled, inherited, or out of scope ----
      for (const slot of SLOTS) {
        const fill = ex.slots[slot];
        const inh = inherited.get(`${ref}#${slot}`);
        /**
         * ⛔ A LOCAL CASE THAT DIVERGES FROM THE SHARED ONE OF THE SAME NAME.
         *
         * A rule filling `refuses` is the home for a shared vocabulary — *"in the same words,
         * so a family never learns two vocabularies for one mistake"*. A slot may narrow one
         * of its cases, and that is a choice somebody should have made rather than a drift
         * nobody noticed: the shipped seed hand-typed `not-positive` twice with two different
         * messages, under exactly such a rule, with nothing comparing them.
         */
        for (const r of constrained.get(`${ref}#${slot}`) ?? [])
          for (const so of r.outcomes ?? []) {
            const lo = (fill?.outcomes ?? []).find((x) => x.name === so.name);
            if (!lo) continue;
            if (norm(lo.when) === norm(so.when) && norm(lo.told) === norm(so.told)) continue;
            add({
              severity: "note",
              kind: "says-it-differently-here",
              where: `${ref}#${slot}#${so.name}`,
              what: `"${so.name}" is shared by ${r.id} and worded differently here`,
              fix: `${r.id} says: ${norm(so.told)} — if this really is a different behaviour, keep it; if not, drop the local case and let the shared one reach here unchanged`,
            });
          }

        /**
         * ⛔ A NAMED CASE NOBODY HAS RULED IS ITSELF A QUESTION FOR A PERSON.
         *
         * A refusal carries its own standing so that a slot settled in general can have one
         * case open without the settled part being discarded. That only works if the open
         * case is actually ASKED about — otherwise the precise version is quieter than the
         * imprecise one, and an author is again punished for accuracy.
         */
        for (const o of fill?.outcomes ?? []) {
          const ok = o.standing?.kind ?? "stated";
          if (ok === "stated" || ok === "out_of_scope") continue;
          add({
            severity: "note",
            kind: `outcome-${ok}`,
            where: `${ref}#${slot}#${o.name}`,
            what: [
              `the case "${o.name}" (${o.when}) is not ruled`,
              o.standing?.about ? `in question: ${norm(o.standing.about)}` : "",
              (o.standing?.candidates ?? []).length === 1 ? `proposed: ${norm(o.standing!.candidates![0]!.says)}` : "",
              o.standing?.because ? `because: ${norm(o.standing.because)}` : "",
              o.standing?.question ? norm(o.standing.question) : "",
            ]
              .filter(Boolean)
              .join("\n    "),
            fix: `productos v2 decide ${scope.id}   — ${slot}#${o.name} on ${ex.id}`,
          });
        }

        /**
         * ⛔ Folded into the standing's own note, not printed beside it.
         *
         * One slot, one decision, two rows in the queue — and the row order put them apart
         * often enough that a reviewer worked the same question twice. It is context for
         * the ruling, not a second thing to do.
         */
        const alsoAnswered = (contested.get(`${ref}#${slot}`) ?? []).map((r) => r.id);
        /**
         * ⛔ NAMED CASES FROM A CONSTRAINING RULE ARE AN ANSWER TO `refuses`.
         *
         * Without this, "the shared refusal vocabulary and nothing else" was unwritable: an
         * empty `outcomes: []` is not content, `none: true` says the opposite of what it
         * means, and stating the cases locally displaces the rule — which is exactly the
         * duplication the rule exists to remove, and how this corpus came to hand-type
         * `not-positive` twice with two different messages.
         */
        const sharedCases =
          slot === "refuses" && (constrained.get(`${ref}#${slot}`) ?? []).some((r) => (r.outcomes ?? []).length);
        if (!fill && !inh && sharedCases) continue;
        if (!fill && !inh) {
          if (answerUnsettled && DOWNSTREAM_OF_ANSWER.includes(slot)) {
            /**
             * ⛔ NOT A QUEUE ITEM. The machine computed "this is not a hole" and then
             * printed it to a person anyway — a note whose own text says nothing is wrong,
             * whose fix is "settle the answer", which is the item three lines above it.
             * One per unsettled answer here; fifty at fifty times the size.
             *
             * The state is real and still rendered: `⋯` in the grid, and a line in the
             * packet telling the builder it is not theirs to fill. It just does not go in
             * the list of things a person is asked to do.
             */
            continue;
          }
          /**
           * ⛔ A SLOT WAITING ON AN ORG-WIDE QUESTION IS NOT ITS OWN HOLE.
           *
           * Migrating a shipped product produced 643 `slot-blank` refusals that were SEVEN
           * questions, asked once per exchange because nothing could ask them once. Every fact has
           * one home; this hole's home is the rule, and it is reported there with its reach. The
           * slot still is not buildable — the grid marks it `⋯Rn` and the packet counts it as a
           * hole — it simply is not a separate thing for a person to answer.
           */
          const waiting = awaiting.get(`${ref}#${slot}`) ?? [];
          if (waiting.length) {
            unsettled++;
            continue;
          }
          blanks++;
          add({
            severity: "refuse",
            kind: "slot-blank",
            where: `${ref}#${slot}`,
            what: `nothing says ${SLOT_ASKS[slot]}`,
            fix: `state it, let a rule fill it, or mark it out_of_scope with a reason — "we have not thought about it" is not one of the three`,
          });
          continue;
        }
        if (inh && !fill) {
          inheritedSlots++;
          continue;
        }
        const k = fill!.standing.kind;
        if (k === "stated") statedSlots++;
        else if (k === "out_of_scope") statedSlots++;
        else {
          unsettled++;
          const put = deferrals.get(`${ref}#${slot}`);
          if (put) {
            /**
             * ⛔ Reported as its own kind, never silently dropped, and NEVER as a refusal.
             *
             * Two things have to stay true at once: the person is not asked again, and a
             * reader can still see that this is unsettled. A deferral that vanished from
             * `check` would make a corpus with ten parked questions look identical to one
             * with none — and the gate would still be refusing acceptance with no visible
             * reason why.
             */
            add({
              severity: "note",
              kind: "parked-by-a-person",
              where: `${ref}#${slot}`,
              what: `${put.by} parked this: ${put.because}`,
              fix: `comes back when: ${put.until} — until then this exchange cannot be accepted`,
            });
            const times = deferralCount.get(`${ref}#${slot}`) ?? 1;
            if (times > 1)
              add({
                severity: "note",
                kind: "parked-again-and-again",
                where: `${ref}#${slot}`,
                what: `parked ${times} times now`,
                fix: "a question that keeps coming back and keeps being put off is one somebody should rule on, or one that should be withdrawn",
              });
            // A parked question that BLOCKS named work is the one case worth raising again,
            // because the deferral and the dependency contradict each other.
            const blocks = fill!.standing.blocks ?? [];
            if (blocks.length)
              add({
                severity: "note",
                kind: "parked-but-something-waits-on-it",
                where: `${ref}#${slot}`,
                what: `parked, and ${blocks.join(", ")} was recorded as waiting on it`,
                fix: "either it does not really block those, or parking it parked them too — say which",
              });
            continue;
          }
          /**
           * ⛔ THE WHOLE QUESTION, ON THE LINE, EVERY TIME.
           *
           * Of four real items in a twelve-item queue, exactly one carried enough to act
           * on. The rest truncated at 140 characters mid-sentence, or printed "a ruling is
           * owed by peter" without the proposal being ruled on — so three of the four
           * needed a file opened before a person could even understand the ask.
           *
           * Worst of all, `cost` — which the schema REQUIRES once two answers are on the
           * stated grounds that "what it costs to guess wrong is what makes this worth
           * ruling on" — was extracted from the author and shown to nobody. The framework
           * demanded the deciding fact and then withheld it from the decider.
           */
          const s = fill!.standing;
          const body: string[] = [];
          if (k === "open") body.push(norm(s.question));

          // ⛔ Candidates read on any kind now — `open` carries drafted ANSWERS with a
          // consequence each, which is what `underdetermined`'s bare readings could not.
          (s.candidates ?? []).forEach((c, i) =>
            body.push(`option ${i + 1}: ${norm(c.says)}${c.consequence ? ` → ${norm(c.consequence)}` : ""}`)
          );
          if (k === "disputed") {
            body.push(`cannot hold with ${(s.targets ?? []).join(", ")}`);
            body.push(`because: ${norm(s.because)}`);
          }
          if (s.cost) body.push(`what guessing wrong costs: ${norm(s.cost)}`);
          if (alsoAnswered.length)
            body.push(
              `note: ${alsoAnswered.join(", ")} already answers this for everything like it — so either that rule is stale here, or this was settled before it was asked`
            );
          if (s.asked_at) body.push(`asked ${s.asked_at}`);
          add({
            /**
             * ⛔ A NOTE THAT GATES, not a corpus refusal — and the reasoning is the cost
             * gradient, which was inverted against honesty everywhere it was measured.
             *
             * Refusing the whole corpus for writing down a contradiction made "write the
             * contradiction down" the single most expensive act available, while deleting
             * the slot entirely cost nothing and produced an inherited answer every
             * command agreed with. An author who wants the gate to go green is therefore
             * paid to stay quiet about the one thing nobody else can find.
             *
             * It still gates: `actsFor` never offers a disputed exchange for acceptance,
             * and the packet still reports it as a hole on BOTH sides. Nothing becomes
             * buildable. What changes is that saying so is now as cheap as not saying so.
             */
            severity: "note",
            kind: `slot-${k}`,
            where: `${ref}#${slot}`,
            what: body.join("\n    "),
            fix:
              k === "disputed"
                ? "one of them is wrong — rule, and neither is buildable until you do"
                /**
                 * ⛔ Routes to `decide`, not to `--says`.
                 *
                 * Every unsettled slot used to print `--says "…"` as its fix, which is the
                 * compose-at-a-prompt path — including for a bare `open` question, where
                 * `decide` itself says in as many words that there is nothing to choose
                 * between and composing product truth in a terminal is how a decision gets
                 * made by whoever is tired.
                 */
                : `productos v2 decide ${scope.id}   ${pc0(`— ${slot} on ${ex.id}`)}`,
          });
        }
        // ⛔ `within:` must be observable by the ASKER, or it is engineering's.
        if (fill?.within && /\b(p9\d|ms\b|cpu|memory|queue depth|cache)\b/i.test(fill.within)) {
          add({
            severity: "note",
            kind: "budget-only-an-engineer-can-see",
            where: `${ref}#${slot}`,
            what: `"${fill.within}" reads as telemetry, not as something the asker can observe`,
            fix: "say what the asker notices, or drop it — a budget no counterparty can see is not a behaviour",
          });
        }
      }

      // ---- disputes resolve, and are symmetric by construction ----
      for (const slot of SLOTS) {
        for (const t of ex.slots[slot]?.standing.targets ?? []) {
          // ⛔ A rule is a legitimate counterparty, and the commonest one — a rule reaches many
          // exchanges, so "this cannot hold with that rule" is the contradiction most worth
          // writing down. Naming an existing rule was refused as "does not exist", which is
          // false, and the false message is what an author acts on.
          if (corpus.rules.some((r) => r.rule.id === t)) continue;
          if (!slotRefs.has(t))
            add({
              severity: "refuse",
              kind: "dispute-targets-nothing",
              where: `${ref}#${slot}`,
              what: `disputes "${t}", which does not exist`,
            });
        }
        for (const b of ex.slots[slot]?.standing.blocks ?? []) {
          if (!slotRefs.has(b) && !exchangeRefs.has(b) && !b.includes("#"))
            add({
              severity: "refuse",
              kind: "blocks-nothing-real",
              where: `${ref}#${slot}`,
              what: `blocks "${b}", which does not exist`,
              fix: "a blocker pointing at nothing reads as a hard blocker and means nothing",
            });
        }
      }

      /**
       * ---- §5.3 over-assertion: a criterion may only introduce vocabulary its slot has ----
       *
       * ⛔ THE FAILURE THAT LICENSES BUGS, BECAUSE THE CRITERION IS WHAT GETS IMPLEMENTED.
       *
       * The first version counted a token only if it matched `^[A-Z]` or `^[0-9]`, and only
       * fired at two or more. Three independent reviewers defeated it, and none of them had
       * to try hard:
       *
       *   "rounded up to the nearest pound, a receipt is emailed to both parents, and the
       *    record is locked once the week rolls over"           — all lowercase, passed
       *   "held for approval for twenty-four hours before it lands, and it can be undone"
       *                                                          — numbers as words, passed
       *   "may be taken past $50.00 of spending in a week"      — `$` kept in the token, so
       *                                                            it matched neither test
       *   "it is posted to Stripe"                              — one proper noun, under the
       *                                                            threshold of two
       *
       * Between them those specified a rounding rule, an email, a record lock, a purge
       * policy, a 24-hour approval hold that CONTRADICTS its own slot, a payment integration
       * and silent data loss — none of it in any slot, all of it printed to the builder
       * under "what must be demonstrated". Lowercase prose is the normal way a criterion
       * over-asserts, and it was free.
       *
       * What discriminates the real cases is not capitalisation — it is WHICH FIELD the
       * novel content lands in. `given` and `when` are fixture setup and legitimately
       * concrete ("given a kid with three things recorded"). **`then` is the assertion, and
       * the assertion is what an engineer builds.** So `then`/`steps` are read strictly and
       * the setup is not read at all.
       *
       * Two thresholds, because two different things go wrong:
       *   - a LITERAL — a numeral, an amount, a duration, a proper noun — pins the build to
       *     one customer's configuration. One is enough. (A bare small cardinal that also
       *     appears in this criterion's own setup is the fixture's arity, not a pin.)
       *   - NOVEL CONTENT WORDS describe behaviour the slot never promised. One or two is
       *     paraphrase, which is legitimate and common; three or more is a new feature.
       */
      for (const c of ex.criteria) {
        const inhSays = inherited.get(`${ref}#${c.slot}`)?.statement;
        const alsoSays = [
          ...(constrained.get(`${ref}#${c.slot}`) ?? []),
          ...(displaced.get(`${ref}#${c.slot}`) ?? []),
        ].flatMap((r) => [r.statement ?? "", ...r.criteria.map((rc) => [rc.given, rc.when, rc.then, rc.steps].join(" "))]);
        const allowed = permittedVocabulary(corpus, scope, ex, c.slot, inhSays, alsoSays);
        const setup = new Set(
          [c.given, c.when].filter(Boolean).join(" ").toLowerCase().split(/[^a-z0-9.%$-]+/).filter(Boolean)
        );
        const why = overAsserted([c.then, c.steps].filter(Boolean).join(" "), allowed, setup);
        /**
         * ⛔ REPORTED, which the field's own comment has always claimed and nothing did.
         *
         * A priced escape that nothing surfaces is still a silent one: the corpus gets an
         * unowned-looking literal in the list a builder implements, and the only way to find
         * it is to read every criterion. It is a note, not a refusal — naming an example value
         * is legitimate — but a person should see how many of them a corpus is leaning on.
         */
        if (c.example)
          add({
            severity: "note",
            kind: "leans-on-an-example",
            where: `${ref}#${c.slot} criterion ${c.id}`,
            what: `names values as an example, claimed by ${c.example.by} on ${c.example.at}: ${norm(c.example.because)}`,
            fix: "nothing to do if that is right — this is here so a corpus cannot quietly come to rest on examples nobody re-read",
          });
        if (why.length && !c.example) {
          add({
            severity: "refuse",
            kind: "criterion-asserts-more-than-the-slot",
            where: `${ref}#${c.slot} criterion ${c.id}`,
            what: `in its \`then\`, ${why.join("; and ")}`,
            fix: "an engineer implements the `then`, so anything here that the slot does not say becomes product truth nobody agreed to — put it in the slot, declare it as a term, or mark example: true",
          });
        }
      }
      const exampleOnly = SLOTS.filter((s) => {
        const cs = ex.criteria.filter((c) => c.slot === s);
        return cs.length > 0 && cs.every((c) => c.example);
      });
      for (const s of exampleOnly)
        add({
          severity: "refuse",
          kind: "only-an-example-demonstrates-this",
          where: `${ref}#${s}`,
          what: "every criterion here is marked as an example",
          fix: "the hatch cannot be the convention — write one criterion that demonstrates the rule",
        });

      /**
       * ---- the far side of a dispute ----
       *
       * ⛔ Reported ON the slot that was named, not only on the slot that spoke. Without
       * this a disputed pair renders `✗` on one side and a clean `✓` on the other, and the
       * clean side compiles into the packet as agreed truth.
       */
      for (const slot of SLOTS) {
        const against = (disputes.get(`${ref}#${slot}`) ?? []).filter((d) => d.from !== `${ref}#${slot}`);
        for (const d of against)
          add({
            severity: "refuse",
            kind: "named-in-a-dispute",
            where: `${ref}#${slot}`,
            what: `${d.from} says it cannot hold with this: ${d.because}`,
            fix: "rule on which of the two stands — neither is buildable until you do, and this side reads as settled without this",
          });
      }

      /**
       * ---- a criterion demonstrating a slot nothing answers ----
       *
       * ⛔ Asked here rather than in the schema, because only here is it the right question:
       * a slot can be answered by an org-wide rule, and a criterion showing how that rule
       * lands on THIS exchange is exactly the demonstration a reader wants.
       */
      for (const c of ex.criteria)
        if (
          !ex.slots[c.slot] &&
          !inherited.get(`${ref}#${c.slot}`) &&
          // ⛔ A rule's named cases answer `refuses`, so a criterion demonstrating one of them
          // demonstrates something real.
          !(c.slot === "refuses" && (constrained.get(`${ref}#refuses`) ?? []).some((r) => (r.outcomes ?? []).length))
        )
          add({
            severity: "refuse",
            kind: "demonstrates-nothing",
            where: `${ref} criterion ${c.id}`,
            what: `demonstrates "${c.slot}", and nothing here answers that slot — not this exchange and no rule reaching it`,
            fix: "say what the slot is, or move the criterion to the slot it really demonstrates",
          });

      /**
       * ---- a stated slot with nothing demonstrating it ----
       *
       * ⛔ NOT ON `may` OR `with`, AND THE REASON IS THE WHOLE CONSTRAINT ON TENET 1.
       *
       * This fired on every `may` and `with` in the corpus — 7 of 12 queue items, and at
       * fifty times the size, 350 of 600. `with: "Which kid."` does not want its own
       * given/when/then; it is exercised by every criterion on the exchange, all of which
       * already begin "a kid…".
       *
       * Worse, it was UNCLEARABLE. Its own fix text offered "or say why it cannot be
       * demonstrated" and there was no such field. A reviewer tried `notes:` (ignored),
       * tried `defer` (correctly refused — the slot is settled), and the only thing that
       * silenced it was writing `given: a kid / when: a parent looks / then: it is shown`
       * — content-free filler which then landed in the packet under "what must be
       * demonstrated", i.e. in the list a builder implements.
       *
       * So the framework generated noise, offered an escape that did not exist, and
       * rewarded corrupting product truth to make the noise stop. That is the rubber stamp
       * arriving by the back door, and it is the same mistake the `PartRole` comment
       * records being made one layer down, to screen parts.
       */
      const DEMONSTRABLE: SlotName[] = ["answer", "refuses", "fails", "again", "at_once"];
      for (const slot of DEMONSTRABLE) {
        const fill = ex.slots[slot];
        if (!fill || fill.standing.kind !== "stated") continue;
        if (fill.none || fill.cannot_fail) continue;
        // Nothing to demonstrate where the refusal IS "nothing happens and nothing is told".
        if (slot === "refuses" && (fill.outcomes ?? []).every((o) => /^nothing\b/i.test(o.told))) continue;
        if (!ex.criteria.some((c) => c.slot === slot) && !inherited.get(`${ref}#${slot}`))
          add({
            severity: "note",
            kind: "nothing-demonstrates-this",
            where: `${ref}#${slot}`,
            what: "stated, and no criterion says what would show it",
            fix: "write a given/when/then — or `cannot_fail:`/`none:` if there is genuinely nothing to show",
          });
      }

      /**
       * ---- a local sentence that pushed an org-wide rule aside ----
       *
       * ⛔ REFUSED WITHOUT A REASON, BECAUSE IT IS THE SAME ACT AS AN `excepts`.
       *
       * `excepts` cost a 10-character reason and rendered `⊗Rn` everywhere. Stating the
       * slot cost nothing and rendered as an ordinary `✓`, so the quiet escape was the one
       * a confident author reached for — and it was used to replace "Only a parent may
       * change what a kid has" with "Anybody on the shared device may record what a kid
       * spent", on the exchange that takes money off a kid, with no finding anywhere.
       */
      for (const slot of SLOTS) {
        const fill = ex.slots[slot];
        const pushed = displaced.get(`${ref}#${slot}`) ?? [];
        for (const r of pushed) {
          // ⛔ EITHER declaration satisfies this. `instead_of` says the rule does not govern;
          // `defers_to` says it still does and this sentence is merely narrower. Demanding
          // only the first made an author who AGREED with a rule file an exemption from it.
          if ((fill?.instead_of ?? []).some((x) => x.rule === r.id)) continue;
          if ((fill?.defers_to ?? []).some((x) => x.rule === r.id)) continue;
          // An unsettled standing is already reported as contested — it is not a claim
          // that displaces anything, it is an admission that nobody has.
          if (fill && fill.standing.kind !== "stated" && fill.standing.kind !== "out_of_scope") continue;
          add({
            severity: "refuse",
            kind: "displaces-a-rule-without-saying-so",
            where: `${ref}#${slot}`,
            what:
              fill?.standing.kind === "out_of_scope"
                ? `deliberately unanswered here, while "${r.id}" answers it for everything like this — which deletes the org guarantee rather than deferring to it`
                : `says something of its own where "${r.id}" answers for everything like this, and does not say it is overriding it`,
            fix: `say which: instead_of: [{rule: ${r.id}, because: …}] if that rule does NOT hold here, or defers_to: [{rule: ${r.id}, because: …}] if it does and this sentence is merely narrower`,
          });
        }
      }

      /**
       * ⛔ AN ASK MAY NOT ARRIVE AT A CONTROL THAT OWNS NOTHING.
       *
       * `entry` is described by the `with` slot of whatever commits it; `navigates` is described
       * entirely by `leads_to`. An exchange on either asks a person what a text box refuses, or what
       * two people clicking a link at once does — and a migration that anchored one exchange per
       * claimed element produced exactly that, at scale: `deal-list#deal-row#refuses`, on a row in a
       * table, which refuses nothing.
       *
       * The schema said `commits` was "the only role that owes an exchange" in a comment and nothing
       * checked it. The comment was also wrong — looking at something IS an ask — so this is the
       * narrower rule that is actually true.
       */
      if (ex.at?.part) {
        const v = scope.views.find((x) => x.id === ex.at!.view);
        const part = v?.parts.find((x) => x.id === ex.at!.part);
        if (part && (part.role === "entry" || part.role === "navigates"))
          add({
            severity: "refuse",
            kind: "arrives-at-a-part-that-owns-nothing",
            where: ref,
            what: `arrives at "${part.id}", which ${part.role === "entry" ? "takes what a person types" : "goes somewhere else"}`,
            fix:
              part.role === "entry"
                ? "what it accepts belongs to the `with` slot of whatever commits it — move this there, or point the ask at the control that commits"
                : "where it goes is `leads_to` and nothing else — whatever this ask says belongs to the thing that renders it, or to the control that commits",
          });
      }

      for (const x of ex.excepts) {
        const named = corpus.rules.find((r) => r.rule.id === x.rule);
        if (!named) {
          add({
            severity: "refuse",
            kind: "excepts-nothing",
            where: ref,
            what: `is excepted from "${x.rule}", which is not a rule`,
          });
          continue;
        }
        /**
         * ⛔ YOU CANNOT BE EXEMPT FROM SOMETHING NOBODY HAS SAID YET.
         *
         * `excepts` only checked that the rule EXISTED. So an exception could name a rule whose
         * standing is still open — no statement at all — and it rendered as `⊗Rn` on the grid and
         * printed to the builder as a considered, reasoned decision, with zero findings. Whatever
         * that rule turns out to say once somebody rules it, this exchange is already exempt, and
         * nothing will ever revisit the exemption: the exchange did not change, so its acceptance
         * stamp stays current too.
         *
         * A reason written against an unwritten rule cannot be a reason. It is a bet.
         */
        if (!named.rule.statement)
          add({
            severity: "refuse",
            kind: "excepts-a-rule-nobody-has-written",
            where: ref,
            what: `is excepted from "${x.rule}", which has no sentence yet — its standing is ${named.rule.standing?.kind ?? "unsettled"}`,
            fix: "settle the rule first, then decide whether this is exempt from what it actually says — an exemption written now is a bet on a sentence nobody has read",
          });
      }
    }

    for (const v of scope.views) {
      if (!v.walked && v.exists !== "intended")
        add({
          severity: "note",
          kind: "view-never-walked",
          where: `${scope.id}#${v.id}`,
          what: "nobody has walked this screen, and it is not marked as intended",
          fix: "walk it, or set exists: intended so a reader knows it does not exist yet",
        });
      for (const p of v.parts) {
        // ⛔ `commits` only. An `entry` part is described by the `with` slot of whatever
        // commits it, and a `navigates` part is fully described by `leads_to` — asking a
        // person about either is twelve notes of noise per screen, which is how a queue
        // stops being worked.
        /**
         * ⛔ THE SAME KEY `one-press-two-answers` USES, through `resolveView`.
         *
         * This keyed on the bare part id across the whole scope, so repointing an exchange
         * from the spend form's `[ Record ]` to its `what-on` text field left that button with
         * no exchange anywhere — and `check` was byte-identical to pristine, because `record`
         * also exists on the earn form. Two keys for one identity, in one file, and the weaker
         * one decided whether a screen was complete.
         */
        if (p.role === "commits" && !p.decorative) {
          const asked = scope.exchanges.some((e) => {
            if (e.at?.part !== p.id) return false;
            const at = resolveView(corpus, scope, e.at.view);
            return at?.view.id === v.id && at.scope === scope.id;
          });
          if (!asked)
            add({
              severity: "note",
              kind: "nothing-happens-when-pressed",
              where: `${scope.id}#${v.id}#${p.id}`,
              what: `"${p.label ?? p.id}" starts work and no exchange says what work`,
              fix: "an engineer builds from the picture — give it an exchange, or mark it decorative",
            });
        }
      }
    }
  }

  /**
   * ⛔ A deferral that outlived its question.
   *
   * Somebody parks a slot; a week later it gets answered. The deferral is now a record of
   * a decision to wait for something that already happened, and it sits in the file
   * looking current. Nothing else in the corpus would ever surface it.
   */
  /**
   * ⛔ THROUGH `resolveRef`, AT EVERY GRAIN. It split on `#` and assumed three parts.
   *
   * So parking the org-wide question — the highest-leverage one a corpus holds — produced
   * `✓ parked`, a written verdict, and then BOTH `parked-nothing / a deferral points at an
   * exchange that is not here` AND the question being asked again. Parking a named case
   * produced `✓ parked` and then both `outcome-open` (still asking) and `parked-then-settled`
   * (claiming it had been answered). Two of the four grains could not be parked, silently.
   */
  for (const v of deferrals.values()) {
    const r = resolveRefSafely(corpus, v.target!);
    if (!r) {
      add({
        severity: "note",
        kind: "parked-nothing",
        where: v.target!,
        what: "a deferral points at something that is not here",
        fix: "it was renamed or withdrawn — retarget the deferral or drop it",
      });
      continue;
    }
    if (!r.unsettled)
      add({
        severity: "note",
        kind: "parked-then-settled",
        where: v.target!,
        what: `parked by ${v.by}, and it has since been settled`,
        fix: "drop the deferral — it now reads as though this were still waiting",
      });
  }

  /**
   * ---- a stamp that outlived what it covered ----
   *
   * ⛔ REFUSED, not noted. A stale stamp is worse than no stamp, because it is labelled
   * reviewed: a reader cannot tell it from a current one, and the whole corpus's claim to
   * being human-validated rests on not being able to find one of these.
   */
  for (const v of corpus.verdicts) {
    if (v.kind !== "accept") continue;
    // A verdict pointing at nothing is a human's act silently dropped — three of these
    // were written with typo'd targets and no surface said a word.
    if (!coveredBy(corpus, v.target!)) {
      add({
        severity: "refuse",
        kind: "accepts-nothing",
        where: v.target!,
        what: `${v.by} accepted "${v.target}", which is not an exchange or a rule here`,
        fix: "a human's act was recorded against nothing — fix the target, or the acceptance is lost",
      });
      continue;
    }
    const s = stampFor(corpus, v.target!);
    const why = staleReason(s);
    if (why)
      add({
        severity: "refuse",
        kind: `acceptance-is-stale`,
        where: v.target!,
        what: why,
        fix: "re-read it and accept again, or withdraw the acceptance — it currently reads as reviewed and is not",
      });
  }

  /**
   * ---- a ruling recorded and never written into the truth ----
   *
   * ⛔ The gap between a person deciding and the corpus saying so.
   *
   * A reviewer wrote a `rule` verdict exactly as the schema prescribes. Nothing consumed
   * it: the slot stayed `proposed`, and `check` went on printing "a ruling is owed by
   * peter" — re-asking, by name, a question that person had already answered and recorded.
   * A reviewer who uses the mechanism as designed and sees no effect stops using it.
   *
   * `verdicts/` and `truth/` can disagree indefinitely and nothing else compares them.
   */
  for (const v of corpus.verdicts) {
    if (v.kind !== "rule") continue;
    // ⛔ A ruling can settle an ORG-WIDE question as well as a slot, and this only knew about
    // slots — so answering the highest-leverage question a corpus holds was reported as a
    // decision recorded against nothing.
    /**
     * ⛔ Through the one resolver, at every grain. Recognising only rules and slots meant that
     * ruling a rule's shared case — the highest-leverage case a corpus holds — was reported as
     * a decision recorded against nothing.
     */
    const settled = resolveRefSafely(corpus, v.settles ?? "");
    if (settled?.ref.kind === "rule-case") {
      if (settled.unsettled)
        add({
          severity: "refuse",
          kind: "ruled-but-not-written",
          where: v.settles!,
          what: `${v.by} ruled this on ${v.at} and the shared case is still unruled`,
          fix: "write the ruling into the case. Until you do, every exchange this rule reaches carries a question that has been answered",
        });
      continue;
    }
    const asRule = corpus.rules.find((r) => r.rule.id === v.settles);
    if (asRule) {
      const k = asRule.rule.standing?.kind ?? "stated";
      if (k !== "stated")
        add({
          severity: "refuse",
          kind: "ruled-but-not-written",
          where: v.settles!,
          what: `${v.by} ruled this on ${v.at} and the rule still stands as ${k}`,
          fix: "write the ruling into the rule. Until you do, every surface re-asks a question that has been answered",
        });
      continue;
    }
    const [scopeId, exId, slotName] = (v.settles ?? "").split("#");
    const ex = scopeById.get(scopeId!)?.exchanges.find((e) => e.id === exId);
    const st = ex && slotName ? ex.slots[slotName as SlotName]?.standing.kind : undefined;
    if (st === undefined) {
      add({
        severity: "refuse",
        kind: "ruling-settles-nothing",
        where: v.settles ?? "(no target)",
        what: `${v.by} ruled on "${v.settles}", which is not a slot here`,
        fix: "a human's decision was recorded against nothing — fix the target, or the ruling is lost",
      });
      continue;
    }
    if (st !== "stated" && st !== "out_of_scope")
      add({
        severity: "refuse",
        kind: "ruled-but-not-written",
        where: v.settles!,
        what: `${v.by} ruled this on ${v.at} — "${(v.says ?? "").replace(/\s+/g, " ").slice(0, 110)}" — and the slot still stands as ${st}`,
        fix: "write the ruling into the slot. Until you do, every surface re-asks a question that has been answered",
      });
  }

  /**
   * ---- a person read it end to end and could not build from it ----
   *
   * ⛔ The one signal nothing can compute, and it was invisible on every surface. A
   * reviewer recorded `buildable: false` with two named blockers; `check`, `acts`, `grid`
   * and `packet` all said nothing, and the packet compiled clean over a scope a human had
   * declared unbuildable.
   */
  for (const v of corpus.verdicts) {
    if (v.kind !== "read" || v.buildable !== false) continue;
    add({
      severity: "refuse",
      kind: "a-person-could-not-build-from-this",
      where: v.scope ?? "(no scope)",
      what: `${v.by} read this end to end on ${v.at} and could not build from it${v.note ? `: ${v.note}` : ""}`,
      fix: v.blocked_by.length
        ? `they were stopped by ${v.blocked_by.join(", ")} — no computed finding outranks this`
        : "ask them what stopped them, and record it as a standing on the slot it belongs to",
    });
  }

  /**
   * ---- every reference in the corpus, resolved ----
   *
   * ⛔ THE SCHEMA DEFINED ONE REFERENCE GRAMMAR AND APPLIED IT TO THREE OF ITS TWELVE
   * REFERENCE FIELDS. Every field that did not go through it produced a wrong-software
   * failure, which is not a coincidence — it is the class.
   *
   * One phantom rule id, one corpus, one run, three fields:
   *
   *   via `excepts`     → ✗ excepts-nothing, correctly
   *   via `instead_of`  → 0 refusals, and the packet printed
   *                       "~~a-parent-approves-every-amount~~ is overridden at `fails`"
   *   via `defers_to`   → 0 refusals, and the packet printed it under
   *                       "Org-wide rules that DO still govern here"
   *
   * `instead_of`'s own ⛔ comment says *"It is the same cost as an `excepts`, because it is the
   * same act."* It was not. And an unresolved `defers_to` switched off the one check that
   * inverts a selector: typo `term: money` → `term: moeny`, add one `defers_to` naming the
   * rule, and `rule-governs-nothing` went 1 → 0 while the packet told the builder the rule
   * *"still holds"*.
   *
   * ⛔ And a declaration must name a rule that actually REACHES the slot, or it is a formal
   * exemption from something that was never there. The shipped seed did exactly that:
   * `see-a-balance#at_once` carried an `instead_of` for `one-hand-at-a-time`, which
   * `acts_on: changes` had never selected.
   */
  {
    const ruleIds = new Set(corpus.rules.map((r) => r.rule.id));
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges) {
        const ref = `${scope.id}#${ex.id}`;
        for (const slot of SLOTS) {
          const fill = ex.slots[slot];
          if (!fill) continue;
          const reaching = new Set([
            ...(constrained.get(`${ref}#${slot}`) ?? []).map((r) => r.id),
            ...(displaced.get(`${ref}#${slot}`) ?? []).map((r) => r.id),
            ...(inherited.get(`${ref}#${slot}`) ? [inherited.get(`${ref}#${slot}`)!.id] : []),
          ]);
          for (const [field, list] of [
            ["instead_of", fill.instead_of ?? []],
            ["defers_to", fill.defers_to ?? []],
          ] as const)
            for (const d of list) {
              if (!ruleIds.has(d.rule)) {
                add({
                  severity: "refuse",
                  kind: "names-no-rule",
                  where: `${ref}#${slot}`,
                  what: `\`${field}\` names "${d.rule}", which is not a rule here`,
                  fix: "fix the name — an unresolved declaration reads as considered, prints to the builder, and switches off the check that reports a rule governing nothing",
                });
                continue;
              }
              // ⛔ Same act, same cost — the schema's own comment says `instead_of` "is the same
              // cost as an `excepts`, because it is the same act". So it carries the same refusal:
              // a slot cannot narrow or replace a sentence that does not exist.
              if (!corpus.rules.find((r) => r.rule.id === d.rule)?.rule.statement) {
                add({
                  severity: "refuse",
                  kind: "declares-against-a-rule-nobody-has-written",
                  where: `${ref}#${slot}`,
                  what: `\`${field}\` names "${d.rule}", which has no sentence yet`,
                  fix: "settle the rule first — narrowing or replacing a sentence nobody has written is a bet, and it reads to a builder as a decision somebody made",
                });
                continue;
              }
              if (!reaching.has(d.rule))
                add({
                  severity: "refuse",
                  kind: "declares-against-nothing",
                  where: `${ref}#${slot}`,
                  what: `\`${field}\` names "${d.rule}", which does not reach this slot`,
                  fix: "a formal exemption from a rule that was never here reads to a builder as a considered decision — drop it, or widen the rule if it should reach",
                });
            }
          for (const target of fill.standing.targets ?? []) {
            if (ruleIds.has(target)) continue;
            if (!resolveRefSafely(corpus, target))
              add({
                severity: "refuse",
                kind: "dispute-targets-nothing",
                where: `${ref}#${slot}`,
                what: `disputes "${target}", which is not a slot or a rule here`,
                fix: "name the slot or rule it really cannot hold with — a dispute nobody else can see is one nobody will resolve",
              });
          }
        }
      }
    for (const v of corpus.verdicts)
      for (const r of v.resolves)
        if (!ruleIds.has(r.target) && !resolveRefSafely(corpus, r.target))
          add({
            severity: "refuse",
            kind: "resolves-nothing",
            where: v.settles ?? v.target ?? "(a verdict)",
            what: `${v.by} recorded resolving a dispute with "${r.target}", which is not here`,
            fix: "a human's resolution recorded against nothing — fix the target, or the record is lost",
          });
  }

  /**
   * ---- a scope that owns no behaviour ----
   *
   * ⛔ REQUIREMENT 3'S OWN EXAMPLE, PASSING CLEAN.
   *
   * A reviewer filed `workbook-templates` — a noun with a term, no exchanges, no views, no
   * children — and `check` output was byte-identical to pristine. `packet workbook-templates`
   * compiled a title, the prose and the full glossary with nothing under it; `decide` said
   * "nothing undecided"; `read --buildable yes` was recorded. `packet tasks` then printed
   * *"— **Workbook Templates** — its behaviours are its own; do not re-decide them here"* about
   * a scope with no behaviours at all.
   *
   * That is the shape this model was built to make impossible: a container named after data,
   * standing in for a component that owns something. It was the defect that started this
   * whole line of work, in the corpus of a real product, and the new model had reproduced it.
   *
   * A container is legitimate — but a container holds things. One that holds nothing, anywhere
   * beneath it, is a noun somebody filed.
   */
  for (const { scope } of corpus.scopes) {
    const below = descendants(corpus, scope.id);
    const behaviours = below.reduce(
      (n, id) => n + (corpus.scopes.find((s) => s.scope.id === id)?.scope.exchanges.length ?? 0),
      0
    );
    if (behaviours) continue;
    const terms = Object.keys(scope.terms);
    add({
      severity: "refuse",
      kind: "states-no-behaviour",
      where: scope.id,
      what:
        `nothing here states any behaviour, and nothing filed under it does either` +
        (terms.length ? ` — it declares ${terms.join(", ")} and no exchange reads or changes ${terms.length === 1 ? "it" : "them"} here` : ""),
      fix:
        "a scope is a thing that states behaviours, or a container for things that do. If this is vocabulary, declare those words on the scope whose behaviours use them; if something ought to state this, that behaviour is what is missing",
    });
  }

  /**
   * ---- screens nothing can be judged against ----
   *
   * ⛔ A BEHAVIOUR ABOUT A CONTROL IS UNJUDGEABLE WITHOUT THE CONTROL.
   *
   * Peter, on a card reading "Deal row on CRE Deals — refuses": "wtf does that even mean?" It meant
   * nothing, because the row was nowhere on screen. The page renders a working prototype now, and
   * it can only point at what the corpus anchors: an exchange says `at: {view, part}`, and in a real
   * 47-exchange corpus 21 named a screen and 7 named a control.
   *
   * Two notes, rolled up, because the fix is authoring and the author needs the shape of the gap
   * rather than 26 identical lines. Neither refuses: plenty of behaviours are invariants with no
   * screen at all, which is what `kind: capability` is for.
   */
  {
    const nowhere: string[] = [];
    const screenOnly: string[] = [];
    const silentParts: string[] = [];
    for (const { scope } of corpus.scopes) {
      const hasScreens = scope.views.some((v) => v.exists !== "withdrawn");
      for (const ex of scope.exchanges) {
        if (!ex.at?.view) {
          // Only where there IS a screen to name. A scope with none is machinery, not an omission.
          if (hasScreens) nowhere.push(`${scope.id}#${ex.id}`);
          continue;
        }
        if (!ex.at.part) screenOnly.push(`${scope.id}#${ex.id}`);
      }
      for (const v of scope.views) {
        if (v.exists === "withdrawn") continue;
        for (const pt of v.parts) {
          if (pt.decorative || pt.role === "display" || pt.role === "region") continue;
          if (!scope.exchanges.some((e) => e.at?.view === v.id && e.at?.part === pt.id))
            silentParts.push(`${scope.id}#${v.id}#${pt.id}`);
        }
      }
    }
    if (nowhere.length)
      add({
        severity: "note",
        kind: "says-nothing-about-where-it-happens",
        where: nowhere[0]!,
        what: `${nowhere.length} behaviour${nowhere.length === 1 ? "" : "s"} name no screen, on scopes that have screens — so the prototype cannot show what ${nowhere.length === 1 ? "it is" : "they are"} about`,
        fix: "name the screen it arrives on, and the control if there is one. A reviewer judging a sentence about a control needs the control in front of them; an engineer without it picks a screen",
      });
    if (silentParts.length)
      add({
        severity: "note",
        kind: "a-control-nothing-states-anything-about",
        where: silentParts[0]!,
        what: `${silentParts.length} control${silentParts.length === 1 ? "" : "s"} the screens draw, that no behaviour says anything about`,
        fix: "each one is a thing a person can press that the product makes no promise about, so whoever builds it decides. State what it does, or say it is decorative",
      });
    if (screenOnly.length > nowhere.length + silentParts.length)
      void 0; // nothing to say: naming the screen without a control is normal for whole-screen rules
  }

  /**
   * ---- groups that state nothing in their own right ----
   *
   * ⛔ A GROUP HAD NO VOICE, AND THE NUMBER ON ITS ROW WAS ITS CHILDREN'S.
   *
   * Peter: "i don't think subsections should sum up questions below it — each section should have
   * their own behaviors and own unanswered count. belongs to the whole group. so each group has
   * rules that cascade down."
   *
   * The model could always express this — a selector takes `under: <scope>` — so this is not a
   * framework gap. What it was, in a real 34-scope corpus, was a thing no author had ever been
   * asked about: zero rules, so every group stated nothing, and the rolled-up count made each one
   * look like it had something.
   *
   * ⛔ ONE FINDING, NOT ONE PER GROUP, AND DELIBERATELY A NOTE. Plenty of groupings are just
   * filing and owe nothing — "you must write a rule here" would be manufacturing work, which is
   * exactly the complaint that got seven invented org-wide questions deleted. This reports the
   * blank and names where it is; whether any of them should hold something is the author's call.
   */
  {
    const homes = ruleHomes(corpus);
    const silent = corpus.scopes
      .filter(({ scope }) => corpus.scopes.some((x) => x.scope.in === scope.id))
      .filter(({ scope }) => scope.in) // the root is the product, not a grouping within it
      .filter(({ scope }) => ![...homes.values()].includes(scope.id))
      .map(({ scope }) => scope.id);
    if (silent.length)
      add({
        severity: "note",
        kind: "groups-state-nothing-of-their-own",
        where: silent[0]!,
        what: `${silent.length} grouping${silent.length === 1 ? "" : "s"} state${silent.length === 1 ? "s" : ""} nothing that holds across ${silent.length === 1 ? "it" : "them"}: ${silent.join(", ")}`,
        fix: "if something is true of everything filed under one of these, write it there as a rule scoped `under` it — one sentence, agreed to once, holding for anything added later. If they are only filing, this is nothing to fix",
      });
  }

  /**
   * ---- a container graph with no reference discipline ----
   *
   * ⛔ ONE LINE MADE A LEAF OWN THE PRODUCT, WITH ZERO FINDINGS.
   *
   * Adding `in: tasks` to the root scope produced a clean corpus, and then `packet tasks`
   * compiled five sections under "Everything below is what the product must do", and
   * `read tasks --buildable yes` was adjudicated against the entire corpus. The buildability
   * stamp's reach is defined entirely by this graph.
   *
   * And `under: family-wallett` — one character — produced four refusals naming neither the
   * typo nor the cause: three `slot-blank` telling the author to hand-write `may` onto three
   * money writes, and `rule-governs-nothing / widen the selector, or delete it` aimed at
   * "Only a parent may change what a kid has." `Scope.in` pointing at nothing is already
   * checked; this is the same reference read the other way.
   */
  {
    for (const { scope } of corpus.scopes) {
      const seen = new Set<string>();
      let cur: string | undefined = scope.id;
      while (cur) {
        if (seen.has(cur)) {
          add({
            severity: "refuse",
            kind: "filed-inside-itself",
            where: [...seen].join(" → "),
            what: `these scopes are filed inside each other in a loop`,
            fix: "one of them is the container — a cycle makes every scope contain the product, and the buildability stamp's reach is exactly this graph",
          });
          break;
        }
        seen.add(cur);
        cur = corpus.scopes.find((s) => s.scope.id === cur)?.scope.in;
      }
    }
    const scopeIds = new Set(corpus.scopes.map((s) => s.scope.id));
    const tags = new Set(corpus.scopes.flatMap((s) => s.scope.tags));
    for (const { rule } of corpus.rules) {
      if (rule.scope.under && !scopeIds.has(rule.scope.under))
        add({
          severity: "refuse",
          kind: "selects-nothing-that-exists",
          where: rule.id,
          what: `selects \`under: ${rule.scope.under}\`, which is not a scope here`,
          fix: "fix the name — otherwise this rule governs nothing, and what it should have governed is reported as blank slots and a rule you are advised to delete",
        });
      if (rule.scope.tag && !tags.has(rule.scope.tag))
        add({
          severity: "refuse",
          kind: "selects-nothing-that-exists",
          where: rule.id,
          what: `selects \`tag: ${rule.scope.tag}\`, which no scope carries`,
          fix: "fix the tag, or add it to the scopes this is meant to reach",
        });
      // ⛔ Through the one resolver, like everything else. It used to read a bare entry as a
      // scope id while `load.ts` read it as an exchange id, so one run contradicted itself.
      for (const only of rule.scope.only ?? [])
        if (!resolveRefSafely(corpus, only))
          add({
            severity: "refuse",
            kind: "selects-nothing-that-exists",
            where: rule.id,
            what: `names "${only}", which is not an exchange here`,
            fix: "fix the name — a typo here is byte-identical to a rule that correctly reaches nothing",
          });
    }
  }

  /**
   * ---- two scopes declaring one screen ----
   *
   * ⛔ A view has corpus-wide identity now, so two of them sharing an id is the same defect as
   * two scopes sharing one — and it was the escape hatch for `one-press-two-answers`. A
   * reviewer duplicated a screen into a second scope and put two different `may` and `answer`
   * answers on one button, with zero findings.
   */
  {
    const views = new Map<string, string[]>();
    for (const { scope } of corpus.scopes)
      for (const v of scope.views) views.set(v.id, [...(views.get(v.id) ?? []), scope.id]);
    for (const [id, scopes] of views)
      if (scopes.length > 1)
        add({
          severity: "refuse",
          kind: "two-things-share-an-id",
          where: scopes.map((s) => `${s}#${id}`).join(", "),
          what: `${scopes.length} scopes declare a view called "${id}"`,
          fix: "a screen has one identity — declare it once and let the other scope's behaviours arrive at it as <scope>#<view>, which is what lets a behaviour be filed where it belongs rather than where its screen is",
        });
  }

  /**
   * ---- one control, two answers, wherever the two asks are filed ----
   *
   * ⛔ Collected corpus-wide because the per-scope version was escapable: duplicate the view
   * in a second scope and two different `may`/`answer` answers land on one button with zero
   * findings. A control belongs to a screen, and a screen has one identity.
   */
  {
    const byControl = new Map<string, string[]>();
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges) {
        if (!ex.at?.part) continue;
        const found = resolveView(corpus, scope, ex.at.view);
        if (!found) continue;
        const key = `${found.scope}#${found.view.id}#${ex.at.part}`;
        byControl.set(key, [...(byControl.get(key) ?? []), `${scope.id}#${ex.id}`]);
      }
    for (const [key, ids] of byControl)
      if (ids.length > 1)
        add({
          severity: "refuse",
          kind: "one-press-two-answers",
          where: key,
          what: `${ids.join(" and ")} all arrive at the same control`,
          fix: "one ask has one answer — merge them, or say what distinguishes the cases inside a single exchange's slots",
        });
  }

  /**
   * ---- a thing several exchanges read and nothing writes ----
   *
   * ⛔ THE FINDING WHOSE ABSENCE PRODUCED A CORPUS OF NOUN-SHAPED SUBSYSTEMS.
   *
   * In the model this replaced, an unowned noun had nowhere to go, so it got filed as a
   * subsystem — the only container available. On a real corpus that produced six
   * "subsystems" of which four held exactly one behaviour: "deal pipeline" and "workbook
   * templates" were each a noun several screens read and nothing wrote, described
   * accurately and then filed as though they were components.
   *
   * It is not a subsystem, and it is not usually an author's mistake either. It is one of
   * three things, and which one a person has to say:
   *
   *   - a behaviour is missing — something ought to set this, and no exchange does
   *   - it comes from outside the product, and nothing here will ever set it
   *   - the term is dead and should be deleted
   *
   * The data to compute it was already required and already typo-checked: `reads` and
   * `changes` per exchange, `terms` per scope. Nothing looked at it. Twenty lines.
   *
   * `shape`, not `note`, because it is invisible from any single page by construction —
   * every page that reads the thing looks complete, and the absence is only in the whole.
   */
  {
    /**
     * ⛔ KEYED BY `<declaring scope>#<term>`, NOT BY THE BARE WORD.
     *
     * Readers and writers were indexed corpus-wide by string, and `set_outside` was looked up
     * with `corpus.scopes.some(...)`. So an unrelated pet-shop scope whose `kid` means *"a
     * young goat, before its first shearing"*, carrying `set_outside`, made
     * `family-wallet · kid nothing-in-this-product-sets-this` **disappear from the seed's
     * output**. One file in another product switched off requirement 3's only detector.
     *
     * `vocabularyReach` already exists and was used correctly by exactly one other check.
     */
    const readers = new Map<string, string[]>();
    const writers = new Map<string, string[]>();
    const homeOf = (scopeId: string, term: string) =>
      vocabularyReach(corpus, scopeId).find((id) =>
        Object.prototype.hasOwnProperty.call(corpus.scopes.find((s) => s.scope.id === id)?.scope.terms ?? {}, term)
      );
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges) {
        // ⛔ A WITHDRAWN PROMISE IS NOT A WRITER. Adding one with `changes: [task]` switched
        // off `nothing-in-this-product-sets-this` for that term and pushed another term's
        // reader count up — so the cheapest way to silence the unowned-entity finding was to
        // declare a behaviour and immediately withdraw it.
        if (existsOf(corpus, scope.id, ex.exists) === "withdrawn") continue;
        for (const term of ex.reads) {
          const key = `${homeOf(scope.id, term) ?? scope.id}#${term}`;
          readers.set(key, [...(readers.get(key) ?? []), `${scope.id}#${ex.id}`]);
        }
        for (const term of ex.changes) {
          const key = `${homeOf(scope.id, term) ?? scope.id}#${term}`;
          writers.set(key, [...(writers.get(key) ?? []), `${scope.id}#${ex.id}`]);
        }
      }
    /**
     * ⛔ ONE FINDING PER TERM, not one per place it happens to be declared.
     *
     * `completion` is declared with identical text in two scopes, so the unowned-term
     * finding fired twice for one fact — which is this repo's own every-fact-has-one-home
     * rule, broken by the check that exists to find that class of problem.
     */
    const declaredIn = new Map<string, string[]>();
    for (const { scope } of corpus.scopes)
      for (const term of Object.keys(scope.terms))
        declaredIn.set(term, [...(declaredIn.get(term) ?? []), scope.id]);
    for (const [term, where] of declaredIn) {
      // Two declarations only conflict if one scope can see both — otherwise they are two
      // unrelated products that happen to use the same English word.
      const collides = where.some((a) => where.some((b) => a !== b && vocabularyReach(corpus, a).includes(b)));
      if (where.length > 1 && collides)
        add({
          severity: "note",
          kind: "one-word-defined-twice",
          where: `${where.join(", ")} · ${term}`,
          what: `"${term}" is declared in ${where.length} scopes`,
          fix: "declare it once, in the nearest scope that contains every user of it — two definitions drift and a reader cannot tell which is current",
        });
    }
    /**
     * ⛔ EVERY DECLARATION, NOT JUST THE FIRST.
     *
     * `readers`/`writers` were keyed per home by `homeOf()` — the comment above says that was
     * done so one file in another product could not switch off requirement 3's only detector —
     * and then the reporting loop looked up `where[0]` and nothing else. So a disconnected goat
     * paddock declaring `kid` made the wallet's `family-wallet · kid` finding vanish; renaming
     * the file `zoo.md` brought it back and made the paddock's vanish.
     *
     * **Which product gets requirement 3 enforced was decided by filename sort order, inside
     * the check that enforces requirement 3, in a corpus that refuses `two-rules-answer-this`
     * on exactly that ground.**
     */
    for (const [term, where] of declaredIn) {
      for (const home of where) {
        const scope = { id: home };
        const key = `${home}#${term}`;
        const r = readers.get(key) ?? [];
        const w = writers.get(key) ?? [];
        // In neither list is correct silence — a word can be vocabulary without being state.
        if (!r.length && !w.length) continue;
        // ⛔ Only this scope's own declaration silences its own finding.
        const outside = corpus.scopes.find((s) => s.scope.id === home)?.scope.terms[term]?.set_outside;
        /**
         * ⛔ `set_outside` IS CHECKED AGAINST THE CORPUS, not taken on trust.
         *
         * It was an unverified twenty-character claim that silenced requirement 3's detector —
         * and was then PRINTED TO THE BUILDER as product truth. Declared on `money`, which
         * three exchanges in the same corpus write, the output was byte-identical to pristine
         * and the packet's glossary read *"nothing in this product sets this — the family's
         * bank is the system of record"* seventy lines above three behaviours saying the amount
         * is added to and taken off what a kid has.
         *
         * `writers` is already in hand here and was used only to silence the finding.
         */
        if (outside && w.length)
          add({
            severity: "refuse",
            kind: "says-nothing-sets-this-and-something-does",
            where: `${home} · ${term}`,
            what: `declared as set outside this product — "${norm(outside.because)}" — and ${w.length} exchange${w.length === 1 ? "" : "s"} here change${w.length === 1 ? "s" : ""} it: ${w.slice(0, 4).join(", ")}`,
            fix: "drop the claim, or drop the `changes` that contradict it — as written it silences a finding AND prints to a builder as product truth",
          });
        const declaredOutside = !!outside;
        if (r.length && !w.length && !declaredOutside)
          add({
            severity: "shape",
            kind: "nothing-in-this-product-sets-this",
            where: `${scope.id} · ${term}`,
            what: `${r.length} exchange${r.length === 1 ? "" : "s"} read "${term}" and none changes it — ${r.slice(0, 4).join(", ")}`,
            fix: "say which: a behaviour is missing that ought to set it, it comes from outside the product and nothing here ever will, or the word is dead. It is not a subsystem",
          });
        const readElsewhere = corpus.scopes.find((s) => s.scope.id === home)?.scope.terms[term]?.read_outside;
        if (readElsewhere && r.length)
          add({
            severity: "refuse",
            kind: "says-nothing-reads-this-and-something-does",
            where: `${home} · ${term}`,
            what: `declared as read outside this product, and ${r.length} exchange${r.length === 1 ? "" : "s"} here read${r.length === 1 ? "s" : ""} it`,
            fix: "drop the claim, or drop the `reads` that contradict it",
          });
        if (w.length && !r.length && !readElsewhere)
          add({
            severity: "shape",
            kind: "nothing-reads-what-this-sets",
            where: `${scope.id} · ${term}`,
            what: `${w.length} exchange${w.length === 1 ? "" : "s"} change "${term}" and none reads it — ${w.slice(0, 4).join(", ")}`,
            // ⛔ The third answer used to have no field, so this finding could never be
            // cleared and could not be parked either: `defer family-wallet#completion` → "no
            // exchange \"completion\"". A finding with no true answer is one people learn to
            // scroll past.
            fix: "either a behaviour is missing that ought to read it, or something outside this product does — say which with `read_outside` on the term, the way `set_outside` answers the other direction",
          });
      }
    }
  }

  /**
   * ---- a control that leads somewhere that is not there ----
   *
   * ⛔ An engineer builds from the picture, and the picture said `add-a-task`, which is not
   * a view or a scope anywhere in the corpus. Nothing checked it, so the sketch promised a
   * screen that does not exist and no surface disagreed.
   */
  for (const { scope } of corpus.scopes)
    for (const v of scope.views) {
      // ⛔ A part id is an address within its view, and nothing made it unique.
      const partIds = new Set<string>();
      for (const p of v.parts) {
        if (partIds.has(p.id))
          add({
            severity: "refuse",
            kind: "two-things-share-an-id",
            where: `${scope.id}#${v.id}#${p.id}`,
            what: `two parts of this screen are called "${p.id}"`,
            fix: "rename one — an ask naming this control reaches only the first, and a rule selecting on its role resolves through it",
          });
        partIds.add(p.id);
        if (!p.leads_to) continue;
        const [target, anchorId] = p.leads_to.split("#");
        const known =
          scope.views.some((x) => x.id === p.leads_to) ||
          scopeById.has(target!) ||
          (scopeById.get(target!)?.views ?? []).some((x) => x.id === anchorId);
        if (!known)
          add({
            severity: "refuse",
            kind: "leads-nowhere",
            where: `${scope.id}#${v.id}#${p.id}`,
            what: `"${p.label ?? p.id}" leads to "${p.leads_to}", which is not a view here or a scope anywhere`,
            fix: "name the view or scope it really reaches, or scope the destination — a picture promising a screen nobody has written is one an engineer will invent",
          });
      }
    }

  /**
   * ---- §5.3 again, on a RULE's own criteria ----
   *
   * ⛔ The detector is the best thing in this file and it was only ever pointed at
   * exchanges. The identical over-asserting `then` that gets refused on an exchange passed
   * with zero mentions on a rule criterion — and a rule criterion reaches every exchange
   * the rule governs, so it is the higher-leverage place to smuggle something in.
   *
   * A rule has no slots of its own, so the vocabulary it is allowed is its own statement,
   * plus every term declared anywhere (it governs a class, not one scope).
   */
  {
    const everyTerm = new Set<string>();
    for (const { scope } of corpus.scopes)
      for (const [term, def] of Object.entries(scope.terms)) {
        for (const w of `${term} ${def.means} ${(def.members ?? []).join(" ")}`.toLowerCase().split(/[^a-z0-9.%$-]+/))
          if (w) everyTerm.add(w);
      }
    for (const { rule } of corpus.rules) {
      const allowed = new Set<string>(everyTerm);
      for (const w of `${rule.statement} ${rule.why ?? ""}`.toLowerCase().split(/[^a-z0-9.%$-]+/)) if (w) allowed.add(w);
      for (const c of rule.criteria) {
        const setup = new Set(
          [c.given, c.when].filter(Boolean).join(" ").toLowerCase().split(/[^a-z0-9.%$-]+/).filter(Boolean)
        );
        const over = overAsserted([c.then, c.steps].filter(Boolean).join(" "), allowed, setup, false);
        if (!over.length || c.example) continue;
        add({
          severity: "refuse",
          kind: "criterion-asserts-more-than-the-rule",
          where: `${rule.id} criterion ${c.id}`,
          what: `in its \`then\`, ${over.join("; and ")}`,
          fix: `this criterion reaches every exchange ${rule.id} governs, so anything here the rule does not say becomes product truth across all of them`,
        });
      }
    }
  }

  /**
   * ---- how much is waiting on one unanswered org-wide question ----
   *
   * ⛔ ONE FINDING PER RULE, CARRYING ITS REACH. This is the leverage figure: a reviewer deciding
   * which question to answer first needs to know that one of them unblocks eighty-eight slots and
   * another unblocks two. Reported per slot, that information does not exist anywhere.
   */
  {
    const waitingOn = new Map<string, string[]>();
    for (const [slotRef, rules] of awaiting) for (const r of rules) waitingOn.set(r.id, [...(waitingOn.get(r.id) ?? []), slotRef]);
    for (const [ruleId, slotRefs] of waitingOn) {
      const rule = corpus.rules.find((r) => r.rule.id === ruleId)!.rule;
      add({
        severity: "note",
        kind: "slots-waiting-on-this-question",
        where: ruleId,
        what: `${slotRefs.length} slot${slotRefs.length === 1 ? "" : "s"} across this product say nothing, and answering this once fills ${slotRefs.length === 1 ? "it" : "them all"}: ${rule.standing?.question ? rule.standing.question.replace(/\s+/g, " ") : "nobody has decided what this rule says"}`,
        fix: `answer it — one ruling here reaches ${slotRefs.length} slot${slotRefs.length === 1 ? "" : "s"} and every exchange written after it`,
      });
    }
  }

  /**
   * ---- a rule a slot formally contradicts ----
   *
   * ⛔ THE DISPUTE WAS REPORTED ON THE ACCUSING SIDE ONLY, and from the rule's side nothing showed.
   *
   * A slot may declare `standing: disputed` with a rule id in `targets` — a statement that the two
   * cannot both hold as written. The accusing slot was reported and gated. The rule was neither:
   * `check` never named it, `acts` kept offering it, and `accept` stamped it clean. One accept on a
   * rule reaches every exchange its selector touches, which makes it the widest stamp in the model
   * and made this the one contradiction that could not reach it.
   *
   * `disputeIndex` already keys accusations by target, rule ids included — the relation was stored
   * once and read from one end.
   */
  for (const { rule } of corpus.rules) {
    for (const d of disputes.get(rule.id) ?? []) {
      if (d.from === rule.id) continue;
      add({
        severity: "refuse",
        kind: "a-slot-says-this-rule-cannot-hold",
        where: rule.id,
        what: `${d.from} declares it cannot hold with this rule${d.because ? ` — ${d.because.replace(/\s+/g, " ")}` : ""}`,
        fix: "rule one of the two. Until then this rule reaches every exchange its selector touches while a slot inside one of them says it is wrong",
      });
    }
  }

  /**
   * ---- a dispute resolved on one side only ----
   *
   * ⛔ A dispute is the one relation stored on one side and rendered on both, so resolving the
   * declaring side used to delete it outright — and the slot it accused went straight back into
   * the accept queue. The counterparty was never told.
   *
   * A ruling on a disputed slot now has to say what happens to the other side, and this finds
   * any dispute whose counterparty is still standing with nothing recorded about it.
   */
  {
    const ruledDispute = new Map<string, (typeof corpus.verdicts)[number]>();
    for (const v of corpus.verdicts) if (v.kind === "rule" && v.resolves.length) ruledDispute.set(v.settles!, v);
    for (const v of ruledDispute.values())
      for (const r of v.resolves) {
        const other = resolveRefSafely(corpus, r.target);
        if (!other)
          add({
            severity: "refuse",
            kind: "resolves-nothing",
            where: v.settles!,
            what: `${v.by} recorded resolving a dispute with "${r.target}", which is not a slot or a rule here`,
            fix: "a human's resolution was recorded against nothing — fix the target, or the record is lost",
          });
      }
    /**
     * ⛔ THERE IS DELIBERATELY NO CHECK HERE FOR "a slot still accused, whose accuser was
     * settled without a resolution", and the reason is worth recording rather than
     * rediscovering.
     *
     * Such a check cannot fire. `disputeIndex` reads the CURRENT corpus, and settling the
     * declaring slot removes its `disputed` standing — so by the time anything could look,
     * the dispute is unreconstructible. A check that cannot fire is worse than none, because
     * it reads as coverage.
     *
     * What actually guards this is the gate on the act: `v2 rule` refuses to settle a disputed
     * slot without `--stands`, so the resolution is written at the only moment the dispute is
     * still there to be resolved. The residual — someone editing `resolves` out of the verdict
     * log afterwards — is the same class as deleting any verdict, and is not separately
     * detectable for a relation whose only record was the standing.
     */
  }

  /**
   * ---- a settled slot claiming somebody ruled it, with no ruling on file ----
   *
   * ⛔ The mirror of `latitude-nobody-granted`, and it exists because the two acts were
   * asymmetric: a waiver leaves its standing on the file so `check` can ask which act it was,
   * while a ruling used to delete the standing entirely. `settle` now leaves
   * `answered_by`/`answered_at`, so a sentence that claims to have been ruled and has no
   * verdict behind it is visible.
   *
   * What this does NOT catch, stated honestly rather than left to be discovered: an author
   * hand-editing an `open` standing into a bare `says:` with no `answered_by`. That sentence
   * is indistinguishable from one they drafted in the first place, and it should be — what
   * protects a reader there is that nobody has accepted it, so the packet marks it NOT YET
   * ACCEPTED. Closing that fully needs raising a question to be a logged act too, which is a
   * larger change than anything here and is not worth making unreviewed.
   */
  {
    const ruled = new Set(corpus.verdicts.filter((v) => v.kind === "rule").map((v) => v.settles!));
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges)
        for (const slot of SLOTS) {
          const fill = ex.slots[slot];
          if (!fill?.standing.answered_by || fill.standing.kind !== "stated") continue;
          const slotRef = `${scope.id}#${ex.id}#${slot}`;
          if (ruled.has(slotRef)) continue;
          add({
            severity: "refuse",
            kind: "answer-nobody-gave",
            where: slotRef,
            what: `this says ${fill.standing.answered_by} settled it${
              fill.standing.answered_at ? ` on ${fill.standing.answered_at}` : ""
            }, and no ruling records them doing so`,
            fix: `productos v2 rule ${slotRef} --says "…" --because "…" --by …  — or drop answered_by, if this was drafted rather than ruled`,
          });
        }
  }

  /**
   * ---- latitude granted with nobody's name on it ----
   *
   * ⛔ `out_of_scope` is the strongest claim a slot can make — it tells a builder to decide
   * for themselves — and for a while the only way to make it was to edit YAML, which is a
   * model's native path and not a person's. `v2 waive` records it as an act; this catches the
   * ones written by hand, because a waiver nobody performed is latitude nobody granted.
   */
  {
    const waived = new Set(corpus.verdicts.filter((v) => v.kind === "waive").map((v) => v.target!));
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges)
        for (const slot of SLOTS) {
          const fill = ex.slots[slot];
          if (fill?.standing.kind !== "out_of_scope") continue;
          const slotRef = `${scope.id}#${ex.id}#${slot}`;
          if (waived.has(slotRef)) continue;
          add({
            severity: "refuse",
            kind: "latitude-nobody-granted",
            where: slotRef,
            what: `this tells a builder to decide for themselves, and no act records anybody deciding that${
              fill.standing.answered_by ? ` (the file says ${fill.standing.answered_by}, with nothing logged)` : ""
            }`,
            fix: `productos v2 waive ${slotRef} --because "…" --by you — so the strongest claim in the schema costs an act rather than an edit`,
          });
        }
  }

  /**
   * ---- two rules supplying one slot, where the FILENAME decides ----
   *
   * ⛔ THE SUBSTRATE DECIDING PRODUCT TRUTH, in a model whose doctrine is that the substrate
   * is never visible.
   *
   * `resolveRules` iterates `corpus.rules` in load order, which is `readdir().sort()`. Two
   * `supplies` rules reaching the same slot meant last-one-wins by filename: adding
   * `zzz-anybody-in-the-house` made `record-spending#may` read *"Anybody signed in on the
   * shared device may change what a kid has"*; renaming the file `aaa-…`, with its id and
   * contents unchanged, flipped it back to *"Only a parent may change what a kid has"*. Zero
   * findings either way, and `acts` reported the same reach in both runs.
   *
   * The authorization sentence for taking money off a kid, decided by sort order.
   */
  {
    const supplying = new Map<string, string[]>();
    for (const { scope } of corpus.scopes)
      for (const ex of scope.exchanges) {
        const ancestry = lineageOf(corpus, scope.id);
        for (const { rule } of corpus.rules) {
          if (rule.mode !== "supplies") continue;
          if (!selectsFor(rule, scope, ex, ancestry, corpus)) continue;
          if (ex.excepts.some((x) => x.rule === rule.id)) continue;
          for (const filled of rule.fills) {
            if (ex.slots[filled] !== undefined) continue;
            const slotRef = `${scope.id}#${ex.id}#${filled}`;
            supplying.set(slotRef, [...(supplying.get(slotRef) ?? []), rule.id]);
          }
        }
      }
    for (const [slotRef, ids] of supplying)
      if (ids.length > 1)
        add({
          severity: "refuse",
          kind: "two-rules-answer-this",
          where: slotRef,
          what: `${ids.join(" and ")} all supply this slot, and which one wins is decided by filename`,
          fix: "narrow one selector, or have this exchange state the slot itself with an `instead_of` naming the rest — nothing about a filename belongs in what the product states",
        });
  }

  /**
   * ---- an org-wide sentence nobody has decided ----
   *
   * ⛔ Reported first among questions, because one ruling here settles every exchange the
   * selector reaches — which is the number `acts` already sorts rules by. Asking it once is
   * the whole reason the rule layer exists; the alternative an author had was asking it on N
   * exchanges, with divergence guaranteed and nothing noticing.
   */
  for (const { rule } of corpus.rules) {
    if (!rule.standing || rule.standing.kind === "stated") continue;
    /**
     * ⛔ Parking silences the ask AT EVERY GRAIN, or `defer` is a behaviour the tool keeps only
     * for slots. It stays unsettled, the rule still governs nothing, and every exchange it
     * would have reached still reads as blank — only the asking stops.
     */
    const put = deferrals.get(rule.id);
    if (put) {
      add({
        severity: "note",
        kind: "parked-by-a-person",
        where: rule.id,
        what: `${put.by} parked this org-wide question: ${put.because}`,
        fix: `comes back when: ${put.until} — until then this rule governs nothing, and the slots it would fill stay blank`,
      });
      continue;
    }
    const would = corpus.scopes.reduce(
      (n, s) =>
        n +
        s.scope.exchanges.filter((ex) =>
          selectsFor({ ...rule, standing: undefined }, s.scope, ex, lineageOf(corpus, s.scope.id), corpus)
        ).length,
      0
    );
    add({
      severity: "note",
      kind: "an-org-wide-question",
      where: rule.id,
      what: [
        norm(rule.standing.question),
        rule.standing.about ? `in question: ${norm(rule.standing.about)}` : "",
        ...(rule.standing.candidates ?? []).map(
          (c, i) => `option ${i + 1}: ${norm(c.says)}${c.consequence ? ` → ${norm(c.consequence)}` : ""}`
        ),
        rule.standing.cost ? `what guessing wrong costs: ${norm(rule.standing.cost)}` : "",
        `answering it once settles ${rule.fills.join(" and ")} on ${would} exchange${would === 1 ? "" : "s"}, and on every one written after it`,
        `until then it governs nothing, and those slots read as the blanks they are`,
      ]
        .filter(Boolean)
        .join("\n    "),
      fix: `productos v2 rule ${rule.id} --says "…" --because "…" --by you`,
    });
  }

  /**
   * ---- an unruled case inside a shared refusal vocabulary ----
   *
   * ⛔ One unruled case here ships as settled truth to every exchange the selector reaches,
   * and every surface was silent about it: `check` byte-identical to pristine, `acts` offering
   * the rule for acceptance, `decide` never mentioning it, and `accept <rule>` succeeding.
   */
  for (const { rule } of corpus.rules)
    for (const o of rule.outcomes ?? []) {
      const k = o.standing?.kind ?? "stated";
      if (k === "stated" || k === "out_of_scope") continue;
      const reaches = (reach.get(rule.id) ?? []).length;
      add({
        severity: "note",
        kind: `outcome-${k}`,
        where: `${rule.id}#${o.name}`,
        what: [
          `the shared case "${o.name}" (${o.when}) is not ruled`,
          o.standing?.about ? `in question: ${norm(o.standing.about)}` : "",
          `it reaches ${reaches} exchange${reaches === 1 ? "" : "s"}, and every one written after it`,
        ]
          .filter(Boolean)
          .join("\n    "),
        fix: `productos v2 rule ${rule.id}#${o.name} --refuses yes|no --says "…" --because "…" --by you`,
      });
    }

  // ---- a rule that governs nothing: the selector inverted ----
  /**
   * ⛔ A rule every slot DEFERS TO still governs, so it must not be counted as reaching
   * nothing. `check` reported `rule-governs-nothing / widen the selector, or delete it` on a
   * rule whose selector already matched every write and therefore could not be widened —
   * making the cheapest route to a green gate the deletion of an org-wide guarantee.
   */
  /* ⛔ `deferredTo` REMOVED. A rule that is deferred to now lands in `reach` through
   * `resolveRules`, so it is governing rather than being excused — and the set was the hole:
   * one unresolved `defers_to` naming a typo'd rule took `rule-governs-nothing` from 1 to 0. */
  for (const { rule } of corpus.rules) {
    // ⛔ An OPEN rule governs nothing on purpose, and is already reported as the question it
    // is. Telling its author to widen the selector or delete it is the same false advice this
    // check gave when a parse failure hid the exchanges a rule reached.
    if (rule.standing && rule.standing.kind !== "stated") continue;
    const hits = reach.get(rule.id) ?? [];
    if (hits.length === 0)
      add({
        severity: "refuse",
        kind: "rule-governs-nothing",
        where: rule.id,
        what: "its selector reaches no exchange",
        fix: "this is a principle that carries no weight — widen the selector, or delete it",
      });
    if ((rule.scope.only ?? []).length > 6)
      add({
        severity: "note",
        kind: "selector-is-a-list",
        where: rule.id,
        what: `names ${rule.scope.only!.length} exchanges by hand`,
        fix: "a typed list this long is copy-onto-every-feature wearing a selector's clothes — find the property they share",
      });
    if (hits.length >= 15)
      add({
        severity: "shape",
        kind: "rule-carries-a-lot",
        where: rule.id,
        what: `fills "${rule.fills}" on ${hits.length} exchanges — one accept here reaches all of them`,
        fix: "read its conformance criteria closely; this is the stamp with the longest reach in the corpus",
      });
  }

  // ---- readings ----
  for (const r of corpus.readings) {
    if (!r.bears_on) {
      add({
        severity: "note",
        kind: "the-product-does-something-nobody-decided",
        where: r.id,
        what: r.observes.slice(0, 150),
        fix: "either a slot should say this, or it should stop — a grid cannot surface this, only a reading can",
      });
      continue;
    }
    if (!slotRefs.has(r.bears_on) && !exchangeRefs.has(r.bears_on))
      add({
        severity: "note",
        kind: "reading-bears-on-nothing",
        where: r.id,
        what: `bears on "${r.bears_on}", which does not exist`,
      });
  }

  // ---- shape: the thing no single page can show ----
  const exCount = corpus.scopes.reduce((n, s) => n + s.scope.exchanges.length, 0);
  const byAsker: Record<string, number> = {};
  for (const { scope } of corpus.scopes)
    for (const ex of scope.exchanges) byAsker[ex.asked_by] = (byAsker[ex.asked_by] ?? 0) + 1;
  const person = byAsker.person ?? 0;
  const machinery = exCount - person;
  if (exCount >= 8 && machinery / Math.max(exCount, 1) < 0.3)
    add({
      severity: "shape",
      kind: "thin-underneath",
      where: "corpus",
      what: `${machinery} of ${exCount} exchanges are asked by something other than a person`,
      fix: "the machinery is where the hard failures live; a corpus drifts this way unless somebody goes looking",
    });

  return { corpus, findings };
}

export function summarise(findings: Finding[]) {
  const n = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return { refuse: n("refuse"), note: n("note"), shape: n("shape") };
}

/** Words a criterion may always use without the slot naming them. */
const STOP = new Set(
  ("a an the and or of to for is are be been was were given when then it its this that with " +
    "no not never any some each every all both either neither one two three first second third " +
    "if while until after before from into onto at on in by as than there their they them these " +
    "those who whom which what where how why does do did done has have had will would can could " +
    "should may might must shall about above below under over between during through against " +
    "asker person system product page screen value values nothing something anything " +
    "i we you he she - . , % $")
    .split(/\s+/)
    .filter(Boolean)
);
