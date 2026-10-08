/**
 * The states a screen has, read out of what its behaviours already say.
 *
 * ⛔ THEY WERE ALREADY IN THE SENTENCES AND NOTHING WAS READING THEM.
 *
 * Peter: *"THE WHOLE SYSTEM IS TO MAKE IT EASIER TO INFER SHIT NEEDS TO BE DONE, WHY WOULD WE ASK
 * PEOPLE TO WRITE ANYTHING DOWN?"* — said about a question I had asked badly, and right about the
 * thing underneath it. Three of the eight slots describe nothing but view states, and have since
 * the slots existed:
 *
 *   `refuses`  "the named outcomes it can refuse with, each with WHEN and WHAT THE ASKER IS TOLD"
 *   `fails`    "what the asker is left with when it cannot do the thing"
 *   `again`    "what happens when it is asked twice"
 *
 * A `RefusalOutcome` is `{ name, when, told }` — a condition, its trigger, and the words a person
 * reads. That is a part condition with exactly one thing missing: which part shows it.
 *
 * ⛔ SO IT REPORTS WHAT IT CANNOT PLACE RATHER THAN GUESSING. An error put on the wrong field is
 * worse than an error with no field: the picture looks right, somebody agrees to it, and the
 * sentence they agreed to was about a different control. `unplaced` is the one question worth
 * asking a person — *which field says this?* — and it is a far smaller ask than writing a state.
 *
 * ⛔ AND `again` IS THE ONE NOTHING COULD EVER HAVE HARVESTED FROM CODE. Pressing twice only means
 * anything if there is a during, so a filled `again` asserts the control has a `busy` condition —
 * and that is not a render branch, which is why loading was missing from every drawn screen.
 */
import type { View } from "./schema.js";
import type { ViewState } from "./states.js";

export interface DerivedState extends ViewState {
  /** Which slot or named refusal this came from, so a reader can see it was derived, not typed. */
  from: string;
}

export interface Unplaced {
  /** The refusal, by name — or `fails` for the slot itself. */
  outcome: string;
  told: string;
  why: string;
}

/** A condition a part turns out to have, because a sentence says so. */
export interface DerivedCondition {
  part: string;
  condition: string;
  says?: string;
  from: string;
}

interface SlotLike {
  says?: unknown;
  outcomes?: Array<{ name: string; when: string; told: string }>;
  cannot_fail?: string;
  none?: unknown;
}

interface ExchangeLike {
  id: string;
  at?: { view?: string; part?: string; state?: string };
  slots?: Record<string, SlotLike | undefined>;
}

/** A slot's sentence, whether it holds one or several. */
const firstSentence = (says: unknown): string | undefined => {
  if (typeof says === "string") return says;
  if (Array.isArray(says)) {
    const one = says.find((s) => typeof (s as { says?: unknown })?.says === "string");
    return (one as { says?: string } | undefined)?.says;
  }
  return undefined;
};

/** `not-yours` → `Not yours`. ⛔ The label is the product's own word for the case, not ours. */
const humanise = (slug: string): string =>
  slug.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Which part a refusal is about.
 *
 * ⛔ IN ORDER OF HOW MUCH OF A GUESS IT IS, AND IT STOPS BEFORE GUESSING. A refusal naming a field
 * in its own words is not a guess at all; the control the ask was made from is the next most
 * likely; past that nothing here knows, and saying so is the honest answer.
 */
export function partsForRefusal(
  view: Pick<View, "parts">,
  exchange: ExchangeLike,
  outcome: { name: string; when: string; told: string },
): { parts: string[]; why: string } {
  const text = `${outcome.when} ${outcome.told} ${outcome.name}`.toLowerCase();

  const named = view.parts
    .filter((p) => p.role === "entry")
    .filter((p) => {
      const words = [p.id, p.label ?? ""].filter(Boolean).map((w) => w.toLowerCase().replace(/[-_]+/g, " "));
      return words.some((w) => w.length > 2 && text.includes(w));
    });

  if (named.length === 1) return { parts: [named[0]!.id], why: "the refusal names this field" };

  /**
   * ⛔ SEVERAL FIELDS AT ONCE IS A STATE, NOT AN AMBIGUITY — WHERE THE SENTENCE SAYS SO.
   *
   * This used to refuse to place anything and ask which field, and the first real sentence it
   * asked about was bilrost's: *"beside EACH ONE that is missing, that it is required"* — which
   * answers the question in its own words. Four fields invalid at once is the exact case a state
   * made of part conditions exists to express, and asking about it was the old one-picture-per-
   * state assumption still talking.
   *
   * ⛔ ON AN EXPLICIT WORD, NOT ON PLURALITY. "either the name or the borrower is blank" also
   * names two fields and means the message appears once — so this reads for a distributive word
   * and keeps asking otherwise. A heuristic that guessed from the count would put errors on fields
   * a product never marks.
   */
  const distributive = /\b(each|every|all of|both|any that|those that)\b/.test(text);
  if (named.length > 1 && distributive)
    return { parts: named.map((p) => p.id), why: "the refusal says it appears beside each of these" };
  if (named.length > 1)
    return {
      parts: [],
      why: `it names ${named.length} fields (${named.map((p) => p.id).join(", ")}) without saying it appears on each, so which one shows it is a product decision`,
    };

  if (exchange.at?.part) return { parts: [exchange.at.part], why: "shown on the control the ask was made from" };

  return { parts: [], why: "nothing in the refusal names a part, and the ask does not arrive at one" };
}

/**
 * Everything a screen's sentences say about its states.
 *
 * Returns the states, the conditions its parts turn out to have, and the refusals nothing could
 * place — which is the only part left for a person to answer.
 */
export function deriveStates(
  scope: { exchanges?: ExchangeLike[] },
  view: Pick<View, "id" | "parts" | "sketch_html">,
): { states: DerivedState[]; conditions: DerivedCondition[]; unplaced: Unplaced[] } {
  const states: DerivedState[] = [];
  const conditions: DerivedCondition[] = [];
  const unplaced: Unplaced[] = [];

  const here = (scope.exchanges ?? []).filter((e) => e.at?.view === view.id);

  /** The control an ask is made from: the one it names, or the screen's only one. */
  const commitOf = (e: ExchangeLike): string | undefined => {
    const named = e.at?.part ? view.parts.find((p) => p.id === e.at!.part && p.role === "commits") : undefined;
    if (named) return named.id;
    const commits = view.parts.filter((p) => p.role === "commits");
    return commits.length === 1 ? commits[0]!.id : undefined;
  };

  const roleOf = (id: string): string | undefined => view.parts.find((p) => p.id === id)?.role;

  for (const e of here) {
    const slots = e.slots ?? {};

    const again = slots.again;
    const commit = commitOf(e);
    if (again && (firstSentence(again.says) || again.none) && commit) {
      /** ⛔ `disabled` too: stopping the second press is how a product usually answers `again`. */
      conditions.push({ part: commit, condition: "busy", from: `${e.id}#again` });
      conditions.push({ part: commit, condition: "disabled", from: `${e.id}#again` });
      states.push({
        label: "While it works",
        holds: { [commit]: { in: "busy", ...(firstSentence(again.says) ? { says: firstSentence(again.says)! } : {}) } },
        from: `${e.id}#again`,
      });
    }

    /** ⛔ `cannot_fail` is a real, stated answer and asserts no state at all. */
    const fails = slots.fails;
    const failSentence = firstSentence(fails?.says);
    if (fails && failSentence && !fails.cannot_fail) {
      const target =
        (e.at?.part && view.parts.find((p) => p.id === e.at!.part)?.id) ??
        view.parts.find((p) => p.role === "region" || p.role === "display")?.id;
      if (target) {
        const role = roleOf(target);
        /** ⛔ A control cannot be `failed`; on one, a failure is reported where it was pressed. */
        const condition = role === "region" || role === "display" ? "failed" : "invalid";
        conditions.push({ part: target, condition, says: failSentence, from: `${e.id}#fails` });
        states.push({
          label: "It could not",
          holds: { [target]: { in: condition, says: failSentence } },
          from: `${e.id}#fails`,
        });
      } else {
        unplaced.push({
          outcome: "fails",
          told: failSentence,
          why: "this screen declares nothing that could show a failure",
        });
      }
    }

    for (const o of slots.refuses?.outcomes ?? []) {
      const { parts, why } = partsForRefusal(view, e, o);
      if (!parts.length) {
        unplaced.push({ outcome: o.name, told: o.told, why });
        continue;
      }

      /**
       * ⛔ ONE STATE HOLDING ALL OF THEM, not one state each. "every required field is missing" is a
       * single moment a person is looking at, and splitting it into four tabs would ask them to
       * agree four times to one decision — while never showing them the screen as it actually is.
       */
      const holds: Record<string, { in: string; says: string }> = {};
      for (const part of parts) {
        const role = roleOf(part);
        const condition =
          role === "entry" ? "invalid" : role === "commits" || role === "navigates" ? "disabled" : "failed";
        conditions.push({ part, condition, says: o.told, from: `${e.id}#refuses/${o.name}` });
        holds[part] = { in: condition, says: o.told };
      }
      states.push({ label: humanise(o.name), when: o.when, holds, from: `${e.id}#refuses/${o.name}` });
    }
  }

  return { states, conditions, unplaced };
}
