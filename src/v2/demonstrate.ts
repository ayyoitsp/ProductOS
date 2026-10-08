/**
 * What must be demonstrated, worked out from the truth rather than typed beside it.
 *
 * ⛔ THE HALF OF THE MODEL THAT HAD A JUDGE AND NO AUTHOR.
 *
 * Peter: *"a product person doesn't write a criterion - what even is this? this is old shit. the
 * agents decide what kind of tests need to exist."*
 *
 * Until this existed, a `criteria:` block was hand-authored YAML and `productos-scoper.md` was the
 * only role that wrote one — 15 mentions there, zero in the machinist, instrumenter, surveyor or
 * designer. Every other role either judged it or hung evidence off it, and `test-design`, whose
 * entire question is *"would this criterion show its claim holding, or would it just pass"*, is
 * explicitly forbidden from writing: *"⛔ Naming the defect is the output."*
 *
 * So the one artefact a builder implements was produced by a product person as a side-effect of
 * scoping a feature, and reviewed by a role that could not fix it. That is the second time this
 * registry has shipped a reviewer for a layer with no author — the other was `architecture`,
 * judging subsystems that had been deleted from the model.
 *
 * ⛔ WHAT THIS MODULE IS NOT. It does not decide what to demonstrate; a role does, reading the
 * claim. This is the arithmetic around that: which claims have a worked-out set, whether each set
 * is still current with the words it was worked out from, and which sentences have nothing. All of
 * it is countable, none of it needs a model, and without it "re-derive the tests" means throwing
 * the previous answer away every time truth moves by a comma.
 */
import { DEMONSTRABLE_SLOTS, owesDemonstration, statements, type Criterion, type SlotName } from "./schema.js";
import { resolveRules, type Corpus } from "./load.js";
import { claimHash } from "./stamp.js";

/**
 * ⛔ THREE STATES, AND `authored` IS ONE OF THEM RATHER THAN AN ERROR.
 *
 * Every corpus in existence is full of criteria somebody typed. They still work, they are still
 * what a builder implements, and they still stale a human's stamp — see `coveredBy`. What they
 * cannot do is tell anybody whether they are current with the claim, because nothing recorded what
 * they were written against. Reporting them as a third state rather than refusing them is the
 * difference between a migration path and a check people switch off.
 */
export type RequirementState =
  /** Worked out from the claim as it now reads. */
  | "current"
  /** Worked out from words that have since changed. ⛔ The test demonstrates the old sentence. */
  | "stale"
  /** Somebody typed it. Nothing says what it was written against. */
  | "authored";

export interface Requirement {
  /** `<scope>#<exchange>#shows#<id>` — the address a builder was handed. */
  ref: string;
  criterion: Criterion;
  state: RequirementState;
  /** The claim this demonstrates, and its hash now. */
  claim: string;
  now: string | null;
}

export interface Demonstration {
  /** `<scope>#<exchange>` */
  ref: string;
  requirements: Requirement[];
  /**
   * Slots that owe a demonstration and have none at all.
   *
   * ⛔ Statement-grained where a slot says several things, because a slot saying eleven things with
   * one requirement on it is a tenth demonstrated and reads as covered.
   */
  undemonstrated: string[];
}

/**
 * The claim ref a criterion was worked out from.
 *
 * ⛔ STATEMENT-GRAINED WHERE `of` SAYS SO, because that is the whole reason `of` exists. A
 * requirement that names its statement goes stale when THAT sentence moves and not when its
 * neighbour does — otherwise rewording the eleventh statement stales the tests for the first, and
 * a staleness that fires on everything tells nobody which test to revisit.
 */
export function claimRefOf(ref: string, c: Criterion): string {
  return c.of ? `${ref}#${c.slot}#${c.of}` : `${ref}#${c.slot}`;
}

export function demonstrationOf(corpus: Corpus, scopeId: string, exchangeId: string): Demonstration | null {
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exchangeId);
  if (!scope || !ex) return null;
  const ref = `${scopeId}#${exchangeId}`;
  const { inherited } = resolveRules(corpus);

  const requirements: Requirement[] = ex.criteria.map((c) => {
    const claim = claimRefOf(ref, c);
    const now = claimHash(corpus, claim);
    return {
      ref: `${ref}#shows#${c.id}`,
      criterion: c,
      claim,
      now,
      state: !c.derived ? "authored" : c.derived.from === now ? "current" : "stale",
    };
  });

  /**
   * ⛔ What owes a demonstration and has none — the same predicate `check` and the packet use, from
   * `schema.ts`, so three readers cannot disagree about whether a slot is owed one.
   */
  const undemonstrated: string[] = [];
  for (const slot of DEMONSTRABLE_SLOTS) {
    const fill = ex.slots[slot as SlotName];
    if (!owesDemonstration(slot as SlotName, fill)) continue;
    const mine = ex.criteria.filter((c) => c.slot === slot);
    const said = statements(fill!.says);
    if (said.length > 1) {
      /** Which sentences nothing reaches, rather than whether the slot has anything at all. */
      const reached = new Set(mine.map((c) => c.of).filter(Boolean));
      for (const s of said) if (!reached.has(s.id)) undemonstrated.push(`${ref}#${slot}#${s.id}`);
      continue;
    }
    if (!mine.length && !inherited.get(`${ref}#${slot}`)) undemonstrated.push(`${ref}#${slot}`);
  }

  return { ref, requirements, undemonstrated };
}

/** Every exchange in the corpus, in reading order. */
export function demonstrations(corpus: Corpus): Demonstration[] {
  return corpus.scopes.flatMap(({ scope }) =>
    scope.exchanges
      .map((e) => demonstrationOf(corpus, scope.id, e.id))
      .filter((d): d is Demonstration => d !== null)
  );
}

export interface DemonstrationTally {
  total: number;
  current: number;
  stale: number;
  authored: number;
  undemonstrated: number;
}

/**
 * ⛔ COUNTABLE, because "implement all the tests described" is not an instruction over a set
 * nobody can size. This is also the honest reading of how far a corpus has got: a corpus whose
 * requirements are all `authored` has not started deriving anything, and one with 30 `stale` has
 * truth that moved under its tests.
 */
export function tally(corpus: Corpus): DemonstrationTally {
  const all = demonstrations(corpus);
  const rs = all.flatMap((d) => d.requirements);
  return {
    total: rs.length,
    current: rs.filter((r) => r.state === "current").length,
    stale: rs.filter((r) => r.state === "stale").length,
    authored: rs.filter((r) => r.state === "authored").length,
    undemonstrated: all.reduce((n, d) => n + d.undemonstrated.length, 0),
  };
}
