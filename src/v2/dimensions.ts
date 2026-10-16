/**
 * ⛔ A DIMENSION IS A FACT ABOUT THE PRODUCT, AND IT REACHES EVERY TRUTH IN IT.
 *
 * Peter: *"we need dimensions to carry through to all features, so we can have different variations
 * PER feature. and the dimensions should affect the truths as well"*.
 *
 * Dimensions arrived as `splits_on` inside `prototypes.yaml`, because the thing being asked for that
 * day was a prototype selector: *"they should be able to select the appropriate dimensions and that
 * will bring up the right prototype"*. So a dimension could only ever pick one of a handful of
 * whole walkthroughs — and a product that genuinely differs by role differs **per feature**, in what
 * each one promises, not in which tour you are given.
 *
 * ⛔ SO THE HOME MOVES, RATHER THAN A SECOND HOME BEING ADDED. The product declares its dimensions;
 * `prototypes.yaml` keeps `splits_on` as the older spelling and nothing else. Two places declaring
 * what a product splits on is the duplication this project is most careful about: they would be
 * edited separately within a week and nothing would record which was right.
 *
 * ⛔ AND ONE FIELD CARRIES IT EVERYWHERE: `holds_for`, a dimension id to a value. On a screen it
 * means "this is the drawing for that combination"; on a statement it means "this is only promised
 * there". One spelling, one predicate, read by the renderer, the checker and the selector alike —
 * because the last time two callers each owned a copy of a selection rule they disagreed within the
 * hour, in the direction that teaches people to ignore the page.
 *
 * ⛔ UNSAID MEANS EVERYWHERE, NEVER NOWHERE. A truth with no `holds_for` holds under every
 * combination, which is what makes this additive: a corpus written before dimensions existed says
 * the same thing after them. The opposite default would silently empty every feature in any corpus
 * that declared a dimension.
 */
import type { Corpus } from "./load.js";
import { axesOf, type Axis } from "./schema.js";

/** What a truth says about where it applies: dimension id → value. Absent means everywhere. */
export type HoldsFor = Record<string, string> | undefined;

/** A combination a reader has asked for: dimension id → value. A missing key means "any". */
export type Asked = Record<string, string>;

/**
 * Does this truth apply under the combination asked for?
 *
 * ⛔ THE ONE PREDICATE. Every surface that filters by dimension calls this; none of them re-derives
 * it. ⛔ And it is asymmetric on purpose: a dimension the truth says nothing about does not exclude
 * it, and a dimension the READER has not chosen does not exclude anything either. Only a stated
 * disagreement excludes — which is the only reading under which "unsaid means everywhere" holds.
 */
export function holdsUnder(holds: HoldsFor, asked: Asked): boolean {
  if (!holds) return true;
  for (const [dim, value] of Object.entries(holds)) {
    const wanted = asked[dim];
    if (wanted && wanted !== value) return false;
  }
  return true;
}

/**
 * The dimensions this product declares, in order.
 *
 * ⛔ THE PRODUCT FIRST, THEN THE OLDER SPELLING. A corpus that declared `splits_on` keeps working
 * and keeps meaning the same thing; one that declares dimensions on the product has moved the fact
 * to where it now reaches from. ⛔ Never both merged: a merge would invent a third list that neither
 * file says, and there would be nowhere to go and read what the product actually splits on.
 */
export function dimensionsOf(corpus: Corpus): Axis[] {
  const root = corpus.scopes.find((e) => !e.scope.in)?.scope;
  const declared = root?.dimensions ?? [];
  if (declared.length) return declared.map((d) => ({ id: d.id, label: d.label, values: d.values ?? [] }));
  /** ⛔ The older spelling, read through the same normaliser every prototype surface already uses. */
  return axesOf(corpus.splitsOn, corpus.prototypes ?? []);
}

/**
 * Every truth in a scope that states a combination, so a feature can say what it varies by.
 *
 * ⛔ DERIVED, NEVER DECLARED. A feature does not announce "I vary by role" — it either has truths
 * that differ by role or it does not, and a flag saying otherwise is a second record of the same
 * fact with no forcing function. This reads what is actually there.
 */
export function variesBy(corpus: Corpus, scopeId: string): Axis[] {
  const dims = dimensionsOf(corpus);
  const entry = corpus.scopes.find((e) => e.scope.id === scopeId);
  if (!entry) return [];
  const touched = new Set<string>();
  const note = (holds: HoldsFor) => {
    for (const dim of Object.keys(holds ?? {})) touched.add(dim);
  };
  for (const v of entry.scope.views ?? []) note(v.holds_for);
  for (const x of entry.scope.exchanges ?? []) {
    for (const slot of Object.values(x.slots ?? {})) {
      if (!slot || typeof slot !== "object") continue;
      note((slot as { holds_for?: Record<string, string> }).holds_for);
      const says = (slot as { says?: unknown }).says;
      if (Array.isArray(says)) for (const st of says) note((st as { holds_for?: Record<string, string> }).holds_for);
    }
  }
  return dims.filter((d) => touched.has(d.id));
}

/**
 * The combinations a scope actually states something distinct for.
 *
 * ⛔ THE VALUES IT NAMES, NOT THE CROSS PRODUCT. Two dimensions of three values each is nine
 * combinations, and a feature that varies by role alone states three things — reporting nine would
 * be the surface inventing eight gaps nobody has. The cross product is the selector's business,
 * where a combination nothing covers is the useful finding; here the question is narrower.
 */
export function variantsIn(corpus: Corpus, scopeId: string): Array<Record<string, string>> {
  const entry = corpus.scopes.find((e) => e.scope.id === scopeId);
  if (!entry) return [];
  const seen: Array<Record<string, string>> = [];
  const key = (h: Record<string, string>) =>
    Object.keys(h)
      .sort()
      .map((k) => `${k}=${h[k]}`)
      .join("·");
  const keys = new Set<string>();
  const add = (holds: HoldsFor) => {
    if (!holds || !Object.keys(holds).length) return;
    const k = key(holds);
    if (keys.has(k)) return;
    keys.add(k);
    seen.push(holds);
  };
  for (const v of entry.scope.views ?? []) add(v.holds_for);
  for (const x of entry.scope.exchanges ?? []) {
    for (const slot of Object.values(x.slots ?? {})) {
      if (!slot || typeof slot !== "object") continue;
      add((slot as { holds_for?: Record<string, string> }).holds_for);
      const says = (slot as { says?: unknown }).says;
      if (Array.isArray(says)) for (const st of says) add((st as { holds_for?: Record<string, string> }).holds_for);
    }
  }
  return seen;
}

/** A combination, written the way a reader reads it: "Role admin · Product line CRE". */
export function sayCombination(holds: Record<string, string>, dims: Axis[]): string {
  return Object.entries(holds)
    .map(([dim, value]) => {
      const d = dims.find((x) => x.id === dim);
      return `${d ? d.label : dim} ${value}`;
    })
    .join(" · ");
}

/** A `holds_for` naming something the product never declared. */
export interface Unknown {
  where: string;
  dimension: string;
  value?: string;
}

/**
 * Every `holds_for` that names a dimension, or a value, the product does not declare.
 *
 * ⛔ THIS IS THE WHOLE RISK OF THE FEATURE. A dimension id is a free-text key, so `role: admin` and
 * `roles: admin` are two different dimensions as far as the predicate is concerned — and the second
 * one silently holds under every combination, because a dimension nobody asked about excludes
 * nothing. A typo does not fail, it quietly makes a variant universal. So it is found by looking,
 * and `check` refuses it.
 */
export function unknownHolds(corpus: Corpus): Unknown[] {
  const dims = dimensionsOf(corpus);
  const byId = new Map(dims.map((d) => [d.id, d]));
  const found: Unknown[] = [];
  const look = (where: string, holds: HoldsFor) => {
    for (const [dim, value] of Object.entries(holds ?? {})) {
      const known = byId.get(dim);
      if (!known) found.push({ where, dimension: dim });
      /** ⛔ A dimension with no values declared cannot judge its values — that is its own finding. */
      else if (known.values.length && !known.values.includes(value)) found.push({ where, dimension: dim, value });
    }
  };
  for (const { scope } of corpus.scopes) {
    for (const v of scope.views ?? []) look(`${scope.id}#${v.id}`, v.holds_for);
    for (const x of scope.exchanges ?? []) {
      for (const [name, slot] of Object.entries(x.slots ?? {})) {
        if (!slot || typeof slot !== "object") continue;
        look(`${scope.id} ${x.id}#${name}`, (slot as { holds_for?: Record<string, string> }).holds_for);
        const says = (slot as { says?: unknown }).says;
        if (Array.isArray(says))
          for (const st of says)
            look(
              `${scope.id} ${x.id}#${name}#${(st as { id?: string }).id ?? "?"}`,
              (st as { holds_for?: Record<string, string> }).holds_for
            );
      }
    }
  }
  for (const p of corpus.prototypes ?? []) {
    const is = typeof p.is === "string" ? undefined : p.is;
    look(`prototype ${p.id}`, is);
  }
  return found;
}
