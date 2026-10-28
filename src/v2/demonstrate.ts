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
import { DEMONSTRABLE_SLOTS, owesDemonstration, statements, type Criterion, type Capability, type SlotName } from "./schema.js";
import { resolveRules, type Corpus } from "./load.js";
import { claimHash, capabilityHash, stampFor } from "./stamp.js";
import { resolveRef } from "./ref.js";

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
  /**
   * Whether a person has agreed to the claim this was worked out from.
   *
   * ⛔ REPORTED, NEVER REQUIRED — and that distinction is the whole correction. Peter: *"why should
   * capabilities depend on acceptance?"*, then *"capabilities should be generated based on current
   * truth, have the accepted state feed in."*
   *
   * Both derived layers were briefly gated behind sign-off. A gate's only output is absence: the
   * thing is missing and nobody can tell whether that is because the truth is unagreed or because
   * nobody ran the role. Feeding the state in says strictly more — this requirement exists, here is
   * what it demonstrates, and nobody has agreed to that sentence yet — which is what a reader
   * actually needs in order to decide how much to lean on it.
   */
  agreed: boolean;
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
      /** ⛔ Information, not a precondition. See `Requirement.agreed`. */
      agreed: stampFor(corpus, claim).state === "accepted",
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
  return [
    ...corpus.scopes.flatMap(({ scope }) =>
      scope.exchanges
        .map((e) => demonstrationOf(corpus, scope.id, e.id))
        .filter((d): d is Demonstration => d !== null)
    ),
    ...corpus.rules.map(({ rule }) => demonstrationOfRule(corpus, rule.id)).filter((d): d is Demonstration => d !== null),
  ];
}

/**
 * What a RULE's requirements demonstrate, and whether each still matches the rule as it reads.
 *
 * ⛔ WITHOUT THIS, 55 REQUIREMENTS COULD NOT GO STALE. `demonstrations` walked `scope.exchanges`
 * only, so a rule's criteria were never examined — and this project asks an author to put a
 * sentence true of several features into a RULE rather than copy it, which means the requirements
 * most likely to be shared were the ones with no staleness at all. A demonstrator writing the two
 * publish checkpoints did exactly that, correctly, and reported the hole.
 *
 * ⛔ A STALE REQUIREMENT IS THE ONE FAILURE THAT PASSES. It gets implemented and goes green,
 * proving the sentence that used to be there — which is why `check` refuses rather than notes it
 * for an exchange. Rules were exempt by accident, not by argument.
 *
 * ⛔ THE CLAIM IS THE RULE ITSELF, with no slot segment. A rule says one thing — its `statement`,
 * its `mode`, the slots it `fills` — and `coveredBy` has always hashed exactly that. There is no
 * statement grain to narrow to, so `of` has nothing to name here and a requirement's claim is the
 * rule's id.
 */
export function demonstrationOfRule(corpus: Corpus, ruleId: string): Demonstration | null {
  const rule = corpus.rules.find((r) => r.rule.id === ruleId)?.rule;
  if (!rule) return null;
  const now = claimHash(corpus, ruleId);
  return {
    ref: ruleId,
    requirements: rule.criteria.map((c) => ({
      ref: `${ruleId}#shows#${c.id}`,
      criterion: c,
      claim: ruleId,
      now,
      state: !c.derived ? "authored" : c.derived.from === now ? "current" : "stale",
      /**
       * ⛔ A rule is not stamped, so nothing here can be agreed to yet — and saying `false` is
       * strictly more than omitting it: the requirement exists, here is what it demonstrates, and
       * nobody has agreed to that sentence.
       */
      agreed: false,
    })),
    /**
     * ⛔ NOT REPORTED AS OWING ONE. `a-rule-that-demonstrates-nothing` already says a rule with no
     * criteria demonstrates nothing, and a second finding for the same absence would be two voices
     * on one fact — which is what this file's own header warns against.
     */
    undemonstrated: [],
  };
}

// ---------------------------------------------------------------------------
// The other derived layer. ⛔ Same question, same three states, one home.

/**
 * The hash of everything a capability serves, as it now reads.
 *
 * ⛔ ONE HOME FOR BOTH DERIVED LAYERS, because the question is identical: has the truth this was
 * worked out from moved since anybody worked it out. A capability and a requirement go stale for
 * the same reason and must not answer it two different ways — `check` reports both, the page shows
 * both, and two implementations would drift the way `gateFor` drifted from `check` by one clause.
 *
 * ⛔ A `serves` TARGET MAY BE ANOTHER CAPABILITY, so this resolves either: a product ref hashes
 * through `claimHash`, a `#offers#` ref through that part's own `capabilityHash`. The clock serves
 * the ledger serves the money, and reworking the ledger has to invalidate the clock — otherwise the
 * layering this model deliberately allows is the one place staleness cannot reach.
 */
export function servesHash(corpus: Corpus, serves: readonly string[]): string {
  const parts = serves.map((s) => {
    const r = resolveRef(corpus, s);
    if ("error" in r) return `${s}=gone`;
    if (r.ref.kind === "capability") {
      const { subsystem, capability } = r.ref;
      const sub = corpus.subsystems.find((c) => c.subsystem.id === subsystem)?.subsystem;
      const o = sub?.offers.find((x) => x.id === capability);
      /** ⛔ Its `derived` is excluded: a neighbour being re-derived is not this part changing. */
      return `${s}=${o ? capabilityHash({ ...o, derived: undefined }) : "gone"}`;
    }
    return `${s}=${claimHash(corpus, s) ?? "gone"}`;
  });
  return capabilityHash(parts);
}

export interface DerivedCapability {
  /** `<subsystem>#offers#<id>` */
  ref: string;
  subsystem: string;
  offering: Capability;
  state: RequirementState;
  now: string;
  /** ⛔ Whether anybody has agreed to the truth this part answers. Reported, never required. */
  agreed: boolean;
}

export function derivedCapabilities(corpus: Corpus): DerivedCapability[] {
  return corpus.subsystems.flatMap(({ subsystem }) =>
    subsystem.offers.map((o) => {
      const now = servesHash(corpus, o.serves);
      return {
        ref: `${subsystem.id}#offers#${o.id}`,
        subsystem: subsystem.id,
        offering: o,
        now,
        state: (!o.derived ? "authored" : o.derived.from === now ? "current" : "stale") as RequirementState,
        /**
         * ⛔ Every product statement it serves has to be agreed for this to read as agreed — a part
         * answering one settled promise and one draft is answering a draft.
         */
        agreed: o.serves.every((s) => {
          const r = resolveRef(corpus, s);
          if ("error" in r) return false;
          if (r.ref.kind === "capability") return true; // judged at the part it points at
          return stampFor(corpus, s).state === "accepted";
        }),
      };
    })
  );
}

/**
 * The capabilities answering one feature's promises, and whether a person has validated each.
 *
 * ⛔ WHAT PETER ASKED FOR, AND NOT WHAT I WAS BUILDING. I proposed deriving a cross-feature
 * criterion — complete a task, then check the balance moved. He stopped it: *"the dependency is a
 * capability dependency, and those should be validated"*, then *"we don't need to check the balance
 * moved, we need to ensure the capability of 'ledger' and 'increment balance' has been validated by
 * a human, but not more than that"*.
 *
 * The difference is the whole design. An integration test asserts two features agree at runtime,
 * which is a thing to BUILD and belongs to whoever builds it. What the corpus owes is narrower and
 * is the thing nothing else can supply: the part this promise leans on is one a person has read and
 * put their name to. *"But not more than that"* is a boundary, so this reports exactly that and
 * derives no test from an edge.
 *
 * ⛔ FOLLOWED THROUGH `serves`, which is how this model already reasons about a part's dependencies.
 * The clock serves the ledger serves the money — so a promise leaning on the ledger leans on the
 * clock, and `a-capability-serves-only-other-machinery` already walks exactly this chain. Stopping
 * at the first hop would validate the part somebody looked at and nothing underneath it.
 */
export interface AnsweringPart {
  /** `<subsystem>#offers#<id>` */
  ref: string;
  subsystem: string;
  /** The promise it was reached from — ⛔ one of them: a part may answer several. */
  answers: string;
  /** Whether a person has agreed to this part as it now reads. */
  validated: boolean;
  /** Who, where somebody has. */
  by?: string;
  /** ⛔ Agreed once and changed since, which is not the same as never agreed. */
  stale: boolean;
}

export function answeringParts(corpus: Corpus, scopeIds: readonly string[]): AnsweringPart[] {
  /** Every part, by ref, so the chain can be walked without re-finding each hop. */
  const parts = new Map<string, { subsystem: string; serves: readonly string[] }>();
  for (const { subsystem } of corpus.subsystems)
    for (const o of subsystem.offers)
      parts.set(`${subsystem.id}#offers#${o.id}`, { subsystem: subsystem.id, serves: o.serves });

  /** Which parts answer a given product ref, at any grain that ref might be named at. */
  const answering = (at: string): string[] =>
    [...parts].filter(([, p]) => p.serves.some((t) => at === t || at.startsWith(`${t}#`) || t.startsWith(`${at}#`)))
      .map(([ref]) => ref);

  const out: AnsweringPart[] = [];
  for (const id of scopeIds) {
    const scope = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!scope) continue;
    for (const ex of scope.exchanges) {
      const ref = `${id}#${ex.id}`;
      /**
       * ⛔ PER BEHAVIOUR, NOT ACROSS THE WALK. One `seen` for the whole scope attributed a shared
       * part to whichever behaviour reached it first, and `readinessOf` filters on `answers` — so
       * asking about the second behaviour reported no parts at all. Driven: a ledger serving both
       * `see-a-balance` and `record-earning`, with an unvalidated clock beneath it, came back clean
       * for `record-earning` while blocking `see-a-balance`. A gate that answers differently
       * depending on which sibling was walked first is worse than one that does not exist.
       */
      const seen = new Set<string>();
      /** ⛔ Breadth-first down `serves`, so the clock under the ledger is reached. */
      const queue = answering(ref).map((p) => ({ ref: p, answers: ref }));
      for (let i = 0; i < queue.length; i++) {
        const { ref: at, answers } = queue[i]!;
        if (seen.has(at)) continue;
        seen.add(at);
        const part = parts.get(at);
        if (!part) continue;
        const stamp = stampFor(corpus, at);
        out.push({
          ref: at,
          subsystem: part.subsystem,
          answers,
          validated: stamp.state === "accepted",
          ...(stamp.state === "never" ? {} : { by: stamp.by }),
          stale: stamp.state !== "accepted" && stamp.state !== "never",
        });
        /** Parts this one leans on, named in its own `serves`. */
        for (const t of part.serves) if (parts.has(t)) queue.push({ ref: t, answers });
      }
    }
  }
  return out;
}

/**
 * Which statements no machinery says it serves — ⛔ THE TWIN OF `undemonstrated`, AND THE ONE THAT
 * WAS NEVER WRITTEN.
 *
 * Peter: *"does buildability also ensure capabilities are mapped from a feature?"* Driven on the
 * shipped seed before answering: zero subsystems, none of its five behaviours served by anything,
 * zero findings, and `readinessOf` answering `ready: true` with no idea capabilities exist.
 *
 * Every capability check in `check.ts` runs ONE direction — `a-capability-that-serves-nothing`,
 * `a-capability-serves-nothing-here`, `a-capability-serves-only-other-machinery`. All three catch an
 * engineer inventing scope. Nothing caught the reverse: a promise nobody has worked out the parts
 * for. The two derived layers were made generable from current truth in the same decision —
 * *"capabilities should be generated based on current truth, have the accepted state feed in. test
 * cases should be generated too"* — and one of them got a gate.
 *
 * ⛔ STATEMENT-GRAINED, for the reason `undemonstrated` is. A slot saying nine things with one
 * capability against it is an eighth mapped and reads as covered.
 */
export function unserved(corpus: Corpus, scopeId: string, exchangeId: string, all = false): string[] {
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exchangeId);
  if (!scope || !ex) return [];
  const ref = `${scopeId}#${exchangeId}`;

  /**
   * ⛔ EVERYTHING ANY PART CLAIMS TO SERVE, AT EVERY GRAIN IT MIGHT NAME IT. A capability serving
   * `money#see-a-balance#answer` answers for the statements inside that slot too — the part exists,
   * somebody worked it out, and demanding one per sentence would report a mapped slot as unmapped.
   * So a prefix match, not an equality: the same direction `whereQuestionStands` resolves.
   */
  const served = new Set<string>();
  for (const { subsystem } of corpus.subsystems)
    for (const o of subsystem.offers) for (const t of o.serves) served.add(t);
  const covered = (at: string) => [...served].some((t) => at === t || at.startsWith(`${t}#`) || t.startsWith(`${at}#`));

  /**
   * ⛔ A CONCLUSION THAT NOTHING HAS TO BE BUILT, AND ONLY WHILE IT IS CURRENT — fg-0020.
   *
   * `needs_nothing` is how a promise that genuinely requires no machinery leaves this list, which
   * is what the gap was: without it the list could never empty and so could never gate.
   *
   * ⛔ THE HASH IS THE WHOLE SAFETY. A conclusion that survived a reword would be the one way past
   * this gate forever — conclude nothing is needed, then change what the promise says, and nothing
   * ever asks again. So a conclusion counts only while `derived.from` still matches the claim it was
   * reached against; a stale one leaves the promise unserved and `check` says which. ⛔ And an entry
   * with no `derived` at all counts for nothing: somebody typed it, and a typed exemption from the
   * only gate on this axis is not a conclusion anybody reached.
   */
  const concluded = new Set<string>();
  for (const nn of ex.needs_nothing ?? []) {
    if (!nn.derived) continue;
    const at = nn.of ? `${ref}#${nn.slot}#${nn.of}` : `${ref}#${nn.slot}`;
    if (nn.derived.from === claimHash(corpus, at)) concluded.add(at);
  }

  const out: string[] = [];
  /**
   * ⛔ `all` BYPASSES BOTH, because it asks for the DENOMINATOR — every promise there is. Letting a
   * conclusion shrink the bottom half of "n of m" would make concluding one promise look like
   * backing it, which is the fraction-drift this already learned once from counting behaviours
   * against statements.
   */
  const owed = (at: string) => all || (!covered(at) && !concluded.has(at));
  for (const slot of DEMONSTRABLE_SLOTS) {
    const fill = ex.slots[slot as SlotName];
    if (!owesDemonstration(slot as SlotName, fill)) continue;
    const said = statements(fill!.says);
    if (said.length > 1) {
      for (const st of said) if (owed(`${ref}#${slot}#${st.id}`)) out.push(`${ref}#${slot}#${st.id}`);
      continue;
    }
    if (owed(`${ref}#${slot}`)) out.push(`${ref}#${slot}`);
  }
  return out;
}

/**
 * Conclusions that nothing has to be built, which were reached against words that have since moved.
 *
 * ⛔ THE ONE STATE THIS FEATURE CAN FAIL IN SILENTLY, and it is the same failure a stale criterion
 * is: the record looks settled and describes a sentence nobody is promising any more. Worse here,
 * because the consequence is a promise that quietly stopped being asked about at all.
 */
export function staleConclusions(
  corpus: Corpus,
  scopeId: string,
  exchangeId: string
): Array<{ ref: string; by: string; at: string }> {
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exchangeId);
  if (!scope || !ex) return [];
  const ref = `${scopeId}#${exchangeId}`;
  const out: Array<{ ref: string; by: string; at: string }> = [];
  for (const nn of ex.needs_nothing ?? []) {
    if (!nn.derived) continue;
    const at = nn.of ? `${ref}#${nn.slot}#${nn.of}` : `${ref}#${nn.slot}`;
    if (nn.derived.from !== claimHash(corpus, at)) out.push({ ref: at, by: nn.derived.by, at: nn.derived.at });
  }
  return out;
}

/** Conclusions nobody derived — typed by hand, and counting for nothing at the gate. */
export function typedConclusions(corpus: Corpus, scopeId: string, exchangeId: string): string[] {
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exchangeId);
  if (!scope || !ex) return [];
  const ref = `${scopeId}#${exchangeId}`;
  return (ex.needs_nothing ?? [])
    .filter((nn) => !nn.derived)
    .map((nn) => (nn.of ? `${ref}#${nn.slot}#${nn.of}` : `${ref}#${nn.slot}`));
}

/**
 * Every statement in one scope and everything under it that no machinery serves.
 *
 * ⛔ `all` ASKS FOR THE DENOMINATOR FROM THE SAME WALK. `check` reports "n of m", and computing m
 * by counting exchanges would compare a statement count against a behaviour count — two grains in
 * one fraction, which is how "11 of 5" happens. Same traversal, same predicate, `served` ignored.
 */
export function unservedIn(
  corpus: Corpus,
  scopeIds: readonly string[],
  exchangeId?: string,
  all = false
): string[] {
  return scopeIds.flatMap((id) => {
    const scope = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    if (!scope) return [];
    return scope.exchanges
      .filter((e) => !exchangeId || e.id === exchangeId)
      .flatMap((e) => unserved(corpus, id, e.id, all));
  });
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
