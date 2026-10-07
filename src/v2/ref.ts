/**
 * What a reference addresses, and the one place that decides.
 *
 * ⛔ THE GRAIN WAS ADDED WITHOUT A RESOLVER, AND FOUR PLACES RE-DERIVED IT.
 *
 * `RefusalOutcome.standing` made a named case addressable — two of the spend form's refusals
 * agreed, one proposed — which was the right fix for a slot whose settled half was being
 * deleted. But `Verdict.settles` and `Verdict.target` are bare strings with no defined
 * grammar, and `settle.ts`, both verdict commands and `check.ts` each did their own
 * `split("#")` and read index 2.
 *
 * So on the pristine seed corpus, with no edits: `accept` refused the exchange and said
 * *"Settle them: productos v2 decide money"*; `decide` printed the exact `rule …#more-than-they-have`
 * and `defer …` commands; and both refused with **"is already settled (stated) — there is
 * nothing to rule on"**, which is false — `check` calls the same thing unruled in the same
 * breath. The corpus's most important question could be neither answered nor parked, and the
 * loop failed on the example it ships with.
 *
 * Adding a branch to each caller would have moved the convention around rather than fixing
 * it. This is the grammar, once, and everything addresses through it.
 *
 *   <scope>                                   a container, or a scope with exchanges
 *   <scope>#<exchange>                        one ask — the unit a human accepts
 *   <scope>#<exchange>#<slot>                 one of the seven
 *   <scope>#<exchange>#<slot>#<case>          one named refusal inside a slot, or one statement
 *   <scope>#<exchange>#shows#<id>             one testing requirement — a criterion
 *   <rule-id>                                 a rule, which has no `#`
 */
import { SLOTS, type SlotName, type Standing , statements} from "./schema.js";
import type { Corpus } from "./load.js";

export type Ref =
  | { kind: "rule"; id: string; rule: string }
  | { kind: "rule-case"; id: string; rule: string; name: string }
  | { kind: "scope"; id: string; scope: string }
  /** What a feature is for — the one thing agreed before anything in it. `<scope>#happy-path`. */
  | { kind: "happy-path"; id: string; scope: string }
  | { kind: "exchange"; id: string; scope: string; exchange: string }
  | { kind: "slot"; id: string; scope: string; exchange: string; slot: SlotName }
  | { kind: "case"; id: string; scope: string; exchange: string; slot: SlotName; name: string }
  /**
   * One statement of what a slot says.
   *
   * ⛔ THE FOURTH SEGMENT IS NOW TWO THINGS, AND THE ORDER OF THE CHECKS IS THE WHOLE ANSWER.
   *
   * `<scope>#<exchange>#<slot>#<name>` was always a named refusal case. A slot can now hold several
   * identified statements, which need addressing for the same reason cases did: so one of them can
   * be agreed to, reworded or ruled without touching its neighbours.
   *
   * Cases are resolved FIRST, because they existed first and a corpus may already carry stamps and
   * criteria pointing at one. A statement id that collides with a case name loses, and `check`
   * reports the collision rather than letting a ref silently mean the other thing.
   */
  | { kind: "statement"; id: string; scope: string; exchange: string; slot: SlotName; name: string }
  /**
   * One testing requirement — a criterion, addressed as `<scope>#<exchange>#shows#<id>`.
   *
   * ⛔ A FIXED WORD IN THE SLOT POSITION, BECAUSE THE FOURTH SEGMENT IS ALREADY TWO THINGS.
   *
   * Peter: *"product os at this point should only generate what the testing requirements are, with
   * an identifier. that's the current boundary"*. The obvious spelling was
   * `<scope>#<exchange>#<slot>#<case>` — and `REF_MESSAGE` even calls that last segment `<case>`,
   * which reads like a test case. It is not: it resolves a named refusal first and a statement
   * second, and a criterion id is neither. Handing a builder `money#record-earning#answer#1` would
   * have meant one address with three meanings, resolved by whichever branch matched first.
   *
   * So a requirement gets its own grain, with `shows` where a slot name would be — the same device
   * `<scope>#why|risk|measure|instrument#<id>` already uses, and no slot is named `shows`. The
   * criterion carries its own `slot`, so nothing is lost by leaving it out of the address.
   *
   * ⛔ Resolvable, not merely printable. An identifier nothing can look up is half an identifier:
   * this is what lets a person park, question or rule on one requirement handed to a builder.
   */
  | { kind: "requirement"; id: string; scope: string; exchange: string; criterion: string; slot: SlotName }
  /**
   * One section of a product-wide document — a goal, a principle, a persona, a non-goal, a decision.
   *
   * ⛔ NOTHING AT THE TOP OF A CORPUS COULD BE REFERRED TO, SO NOTHING THERE COULD BE AGREED TO.
   *
   * Peter: *"all the top level stuff should be able to be signed off on."* He is describing tenet
   * one, and it stopped at the feature boundary: on a real corpus, six documents and twenty-six
   * sections — the goals, the principles, every non-goal, every decision — and `resolveRef` answered
   * *"not a rule or a scope here"* for all of them. Zero accepts existed against any of them, and
   * none could have.
   *
   * ⛔ WHICH MAKES IT THE WORST PLACE FOR THE GAP TO BE. Every slot in every feature is judged
   * against this material — a behaviour is right or wrong relative to a goal somebody chose — and it
   * was the one part of the corpus nobody had ever put their name to. The whole gate at the slot
   * level rests on a context that was never validated.
   */
  | { kind: "section"; id: string; charter: string; section: string }
  /**
   * One card of a feature's framing — a reason, a risk, a measure, an instrument.
   *
   * ⛔ ADDRESSABLE FOR THE SAME REASON A CHARTER SECTION IS: so one risk can be agreed to, reworded
   * or dropped without touching its neighbours, and so a stamp on it breaks when it is reworded. A
   * list of four risks under one stamp is one signature for four claims, which is the grain error
   * this model has already corrected twice.
   */
  | { kind: "card"; id: string; scope: string; list: "why" | "risk" | "measure" | "instrument"; card: string };

export interface Resolved {
  ref: Ref;
  /** The standing at exactly this grain, where one applies. */
  standing?: Standing;
  /** Whether a person still owes a decision here. */
  unsettled: boolean;
}

/** ⛔ Returns a reason, never throws and never guesses. Callers print the reason. */
export function resolveRef(corpus: Corpus, raw: string): Resolved | { error: string } {
  const parts = raw.split("#");
  /**
   * ⛔ A FEATURE'S FRAMING — `<scope>#why|risk|measure|instrument#<id>`.
   *
   * Checked before the slot grammar because the middle segment is a fixed word rather than an
   * exchange id, so there is no ambiguity to resolve — and checked before the charter because a
   * three-segment ref is never a document section.
   */
  if (parts.length === 3 && ["why", "risk", "measure", "instrument"].includes(parts[1]!)) {
    const sc = corpus.scopes.find((x) => x.scope.id === parts[0]);
    if (sc) {
      const list = parts[1] as "why" | "risk" | "measure" | "instrument";
      const held =
        list === "why"
          ? sc.scope.why
          : list === "risk"
            ? sc.scope.risks
            : list === "measure"
              ? sc.scope.measures
              : sc.scope.instruments;
      const one = held.find((x) => x.id === parts[2]);
      if (!one)
        return {
          error: held.length
            ? `${sc.scope.id} has no ${list} "${parts[2]}" — it has ${held.map((x) => x.id).join(", ")}`
            : `${sc.scope.id} states no ${list === "why" ? "reasons" : list + "s"} at all`,
        };
      return { ref: { kind: "card", id: raw, scope: parts[0]!, list, card: parts[2]! }, unsettled: false };
    }
  }
  /**
   * ⛔ A SECTION OF A PRODUCT-WIDE DOCUMENT — `<document>#<section>`.
   *
   * ⛔ CHECKED FIRST, AND ONLY WHEN NOTHING ELSE OWNS THE NAME. A charter id is one bare segment
   * (`goals`, `decisions`), which is exactly the shape of a scope id — so a product with an area
   * called `decisions` would have two things answering to one ref. Rather than pick, this refuses
   * and says so: a ref that silently means the other thing is the failure the case-versus-statement
   * ordering above was written for, and it cost a shipped corpus its unruled cases.
   */
  if (parts.length === 2) {
    const doc = corpus.charter.find((x) => x.charter.id === parts[0]);
    if (doc) {
      const clash =
        corpus.scopes.some((x) => x.scope.id === parts[0]) || corpus.rules.some((x) => x.rule.id === parts[0]);
      if (clash)
        return {
          error: `"${parts[0]}" is both a product-wide document and a ${
            corpus.scopes.some((x) => x.scope.id === parts[0]) ? "feature" : "rule"
          }, so this ref means two things. Rename one of them`,
        };
      const sec = doc.charter.sections.find((x) => x.id === parts[1]);
      if (!sec)
        return {
          error: `"${doc.charter.title}" has no section "${parts[1]}" — it has ${doc.charter.sections
            .map((x) => x.id)
            .join(", ")}`,
        };
      /** ⛔ A section carries no standing: it is a statement somebody agrees to or does not. */
      return { ref: { kind: "section", id: raw, charter: parts[0]!, section: parts[1]! }, unsettled: false };
    }
  }
  /**
   * ⛔ `<rule-id>#<case>` — a shared refusal case can hold a question, and nothing could
   * address it.
   *
   * `RefusalOutcome` runs the full standing contract on a rule's `outcomes`, so an `open`
   * case there validated cleanly and then: `check` byte-identical to pristine with zero
   * mentions, `acts` counting the rule as ready to accept, `decide` silent, `rule
   * <rule>#<case>` answering `no scope "<rule>"`, and `accept <rule>` succeeding.
   *
   * It is the worst grain to lose — one unruled shared case ships as settled truth to every
   * exchange the selector reaches.
   */
  if (parts.length === 2) {
    const r = corpus.rules.find((x) => x.rule.id === parts[0]);
    if (r) {
      const o = (r.rule.outcomes ?? []).find((x) => x.name === parts[1]);
      if (!o) {
        const names = (r.rule.outcomes ?? []).map((x) => x.name);
        return {
          error: names.length
            ? `${parts[0]} names no case "${parts[1]}" — it names ${names.join(", ")}`
            : `${parts[0]} names no cases at all`,
        };
      }
      const k = o.standing?.kind ?? "stated";
      return {
        ref: { kind: "rule-case", id: raw, rule: parts[0]!, name: parts[1]! },
        standing: o.standing,
        unsettled: k !== "stated" && k !== "out_of_scope",
      };
    }
  }
  if (parts.length === 1) {
    const rule = corpus.rules.find((r) => r.rule.id === raw);
    if (rule) {
      // ⛔ A rule can be an open question about a class — the highest-leverage one a corpus
      // holds — so it is addressable as something to rule on, not only to accept.
      const k = rule.rule.standing?.kind ?? "stated";
      return {
        ref: { kind: "rule", id: raw, rule: raw },
        standing: rule.rule.standing,
        unsettled: k !== "stated",
      };
    }
    const scope = corpus.scopes.find((s) => s.scope.id === raw);
    if (scope) return { ref: { kind: "scope", id: raw, scope: raw }, unsettled: false };
    return { error: `"${raw}" is not a rule or a scope here` };
  }
  const [scopeId, exId, slotName, caseName] = parts;
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  if (!scope) return { error: `no scope "${scopeId}"` };
  /**
   * ⛔ THE GRAMMAR HAS TO KNOW THE HAPPY PATH, or the one act everything else waits on is
   * unreachable. `money#happy-path` read as an exchange and came back "no exchange happy-path in
   * money" — an error about a thing nobody was talking about, on the act that ungates the feature.
   */
  if (parts.length === 2 && exId === "happy-path") {
    if (!scope.happy_path) return { error: `nothing says what "${scopeId}" is for yet` };
    return { ref: { kind: "happy-path", id: raw, scope: scopeId! }, unsettled: false };
  }
  const ex = scope.exchanges.find((e) => e.id === exId);
  if (!ex) return { error: `no exchange "${exId}" in ${scopeId}` };
  if (parts.length === 2)
    return { ref: { kind: "exchange", id: raw, scope: scopeId!, exchange: exId! }, unsettled: false };
  /**
   * ⛔ Before the slot grammar, because `shows` is a fixed word and not a slot — so there is no
   * ambiguity to resolve, exactly as for a framing card.
   */
  if (parts.length === 4 && slotName === "shows") {
    const c = ex.criteria.find((x) => x.id === caseName);
    if (!c)
      return {
        error: ex.criteria.length
          ? `${exId} has no requirement "${caseName}" — it has ${ex.criteria.map((x) => x.id).join(", ")}`
          : `${exId} has no testing requirements at all`,
      };
    /** A requirement carries no standing of its own: it demonstrates a slot, which has one. */
    return {
      ref: { kind: "requirement", id: raw, scope: scopeId!, exchange: exId!, criterion: c.id, slot: c.slot },
      unsettled: false,
    };
  }
  if (!SLOTS.includes(slotName as SlotName))
    return { error: `"${slotName}" is not a slot — it is one of ${SLOTS.join(", ")}` };
  const fill = ex.slots[slotName as SlotName];
  if (!fill) return { error: `${exId} says nothing at all about ${slotName}` };
  if (parts.length === 3) {
    const k = fill.standing.kind;
    return {
      ref: { kind: "slot", id: raw, scope: scopeId!, exchange: exId!, slot: slotName as SlotName },
      standing: fill.standing,
      unsettled: k !== "stated" && k !== "out_of_scope",
    };
  }
  const outcome = (fill.outcomes ?? []).find((o) => o.name === caseName);
  if (!outcome) {
    // ⛔ A statement, then — same shape, and resolved second so an existing case always wins.
    const said = statements(fill.says).find((x) => x.id === caseName);
    if (said) {
      const k = fill.standing.kind;
      return {
        ref: { kind: "statement", id: raw, scope: scopeId!, exchange: exId!, slot: slotName as SlotName, name: caseName! },
        standing: fill.standing,
        // A statement inherits its slot's standing: there is nowhere else for one to be unsettled.
        unsettled: k !== "stated" && k !== "out_of_scope",
      };
    }
    const names = (fill.outcomes ?? []).map((o) => o.name);
    const saidNames = statements(fill.says).map((x) => x.id);
    return {
      error: names.length || saidNames.length
        ? `${exId}'s ${slotName} has no "${caseName}" — it names ${[...names, ...saidNames].join(", ")}`
        : `${exId}'s ${slotName} names no cases or statements, so there is no "${caseName}" to address`,
    };
  }
  const k = outcome.standing?.kind ?? "stated";
  return {
    ref: {
      kind: "case",
      id: raw,
      scope: scopeId!,
      exchange: exId!,
      slot: slotName as SlotName,
      name: caseName!,
    },
    standing: outcome.standing,
    unsettled: k !== "stated" && k !== "out_of_scope",
  };
}

/** What a person is told when they address something that has nothing to decide. */
export function nothingToDecide(r: Resolved): string {
  const k = r.standing?.kind ?? "stated";
  switch (r.ref.kind) {
    case "rule":
    case "rule-case":
      return "this rule says what it says — it is accepted, not ruled on";
    case "scope":
      return `a scope holds questions, it is not one — try \`productos v2 decide ${r.ref.id}\``;
    case "exchange":
      return `an exchange is accepted, not ruled on — name the slot, as ${r.ref.id}#<slot>`;
    default:
      return k === "out_of_scope"
        ? "this is deliberately not answered here, which is itself a decision somebody recorded"
        : "this is already settled — it says what it is";
  }
}
