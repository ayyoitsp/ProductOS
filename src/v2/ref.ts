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
 *   <scope>#<exchange>#<slot>#<case>          one named refusal inside a slot
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
  | { kind: "statement"; id: string; scope: string; exchange: string; slot: SlotName; name: string };

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
