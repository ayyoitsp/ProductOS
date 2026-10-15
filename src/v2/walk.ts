/**
 * The product as one thing somebody can walk, derived from the truth and nothing else.
 *
 * ⛔ A PRODUCT IS NOT A PILE OF SCREENS, AND FOR A LONG TIME THAT IS ALL THIS COULD SAY.
 *
 * Peter: *"we should be able to know the true navigation, leverage screens within screens, like
 * really a walkable single prototype that can link out to the different areas. so the goal here is
 * to just have a SINGLE screen that can go through the whole product, based on the established
 * truth"*.
 *
 * ⛔ TWO RELATIONS, NOT ONE, AND THE MISSING ONE WAS DOING MOST OF THE WORK.
 *
 * `connect` infers that a control LEADS somewhere from what its words say. On the corpus this was
 * built against it found four links across twenty-two screens — so eighteen screens had no way in
 * or out and a map drawn from links alone said the product was in pieces. It is not. Most controls
 * genuinely do not navigate: they act on the screen they are on, or they switch a tab, and
 * switching a tab is CONTAINMENT. A deal workspace is one screen holding four; `within` says so,
 * and saying so connects four screens that no amount of word-matching would ever have joined.
 *
 * So a walk is built from both: what a screen HOLDS, and what its controls LEAD TO.
 *
 * ⛔ AND IT NAMES WHAT CANNOT BE REACHED rather than quietly omitting it. A screen nobody can get
 * to is the single most useful thing this can tell an author, and a walk that silently skipped it
 * would be a prototype that looks complete while part of the product has no door.
 */
import type { Corpus } from "./load.js";
import type { Scope, View } from "./schema.js";
import { inferConnections } from "./connects.js";

/** `<scope>#<view>` — the only identifier a walk deals in. */
export type Ref = string;

export interface Step {
  ref: Ref;
  scope: string;
  view: string;
  title: string;
  /** The feature's own title, so a reader knows which part of the product they are standing in. */
  scopeTitle: string;
  /** The area above the feature, where there is one — "point to the different areas". */
  areaTitle?: string;
  /** Screens shown inside this one, in the order the corpus declares them. */
  holds: Ref[];
  /** Where this screen's controls lead, each with the control that goes there. */
  exits: Array<{ part: string; label: string; to: Ref }>;
  /** Controls that commit but that nothing says a destination for — the actionable gap. */
  danglingControls: Array<{ part: string; label: string }>;
  /** Whether a picture exists. A walk through screens with no drawings is a list again. */
  drawn: boolean;
}

export interface Walk {
  steps: Map<Ref, Step>;
  /**
   * Where a walk starts: a screen nothing holds and nothing leads to, preferring one that leads
   * somewhere itself.
   *
   * ⛔ ORDERED, NOT PICKED. A single "entry point" is a guess about a product with several front
   * doors; the surface shows the first and offers the rest.
   */
  entries: Ref[];
  /** Reachable from some entry by holding or leading. Everything else has no door. */
  reachable: Set<Ref>;
  /** Named, never dropped — see the header. */
  unreachable: Ref[];
  /**
   * Screens no DECLARED door opens onto — reachable from no prototype's `starts_at`.
   *
   * ⛔ `unreachable` ABOVE IS A DIFFERENT QUESTION, AND THE DIFFERENCE HID AN ENTIRE PRODUCT AREA.
   *
   * `entries` is inferred from topology: any screen with no inbound edge is treated as a front
   * door. So 133 screens of one area, wired to each other and opened on by NO prototype, flooded
   * `reachable` from doors nobody declared — and `no-way-in` reported two screens, both from the
   * other area. A door is a declared thing; inferring one from the shape of the graph is a guess
   * wearing a decision's clothes.
   *
   * Peter, on finding it: *"i'm confused why the prototypes don't even exist - when I already
   * asked you to index private lending. how could you have possibly indexed it with no
   * prototypes?????"*
   */
  unentered: Ref[];
}

const refOf = (scope: Scope, view: View): Ref => `${scope.id}#${view.id}`;

/**
 * Resolve a `within` to a ref.
 *
 * ⛔ A BARE VIEW ID MEANS "IN THIS SCOPE", because that is what an author writing one means, and
 * requiring the long form everywhere would make the common case the noisy one.
 */
function resolveWithin(raw: string, scope: Scope, byRef: Map<Ref, unknown>): Ref | undefined {
  const direct = raw.includes("#") ? raw : `${scope.id}#${raw}`;
  if (byRef.has(direct)) return direct;
  /** A long form that names a scope this corpus spells differently still resolves by its view. */
  if (raw.includes("#")) {
    const leaf = raw.split("#").pop()!;
    const here = `${scope.id}#${leaf}`;
    if (byRef.has(here)) return here;
  }
  return undefined;
}

/**
 * ⛔ A PROTOTYPE'S WALK STARTS WHERE THE PROTOTYPE SAYS, NOT WHERE THE SORT LANDS.
 *
 * Without one this ordered every door by "has exits, has holds, is drawn, then alphabetically" and
 * opened on whichever came first. Peter: *"and it just starts at 'sizing results' ?? hahahah"*.
 * Sorting is not a product decision and must never be dressed as one.
 */
export function walkOf(corpus: Corpus, startAt?: string): Walk {
  const steps = new Map<Ref, Step>();

  /** Every view first, so containment and links can both be resolved against a complete set. */
  for (const entry of corpus.scopes) {
    const scope = entry.scope;
    for (const view of scope.views ?? []) {
      steps.set(refOf(scope, view), {
        ref: refOf(scope, view),
        scope: scope.id,
        view: view.id,
        title: view.title ?? view.id,
        scopeTitle: scope.title ?? scope.id,
        areaTitle: undefined,
        holds: [],
        exits: [],
        danglingControls: [],
        drawn: Boolean(view.sketch_html),
      });
    }
  }

  /**
   * The area a screen sits in — the scope above its feature.
   *
   * ⛔ THE SCOPE TREE ANSWERS THIS AND THE WALK DOES NOT RE-DERIVE IT. Containment between SCREENS
   * is a different relation from nesting between SCOPES, and conflating them is how a tab ends up
   * presented as a sibling of the feature that owns it.
   */
  const parentOf = new Map<string, string>();
  for (const entry of corpus.scopes) if (entry.scope.in) parentOf.set(entry.scope.id, entry.scope.in);
  const titleOf = new Map<string, string>();
  for (const entry of corpus.scopes) titleOf.set(entry.scope.id, entry.scope.title ?? entry.scope.id);
  for (const step of steps.values()) {
    const above = parentOf.get(step.scope);
    if (above) step.areaTitle = titleOf.get(above);
  }

  /** Containment, from `within`. */
  const heldBy = new Map<Ref, Ref>();
  for (const entry of corpus.scopes) {
    const scope = entry.scope;
    for (const view of scope.views ?? []) {
      if (!view.within) continue;
      const parent = resolveWithin(view.within, scope, steps);
      if (!parent) continue;
      const child = refOf(scope, view);
      if (parent === child) continue;
      steps.get(parent)!.holds.push(child);
      heldBy.set(child, parent);
    }
  }

  /** Links, from what `connect` infers out of the corpus's own words. */
  const labelOf = new Map<string, string>();
  for (const entry of corpus.scopes)
    for (const view of entry.scope.views ?? [])
      for (const part of view.parts ?? [])
        labelOf.set(`${refOf(entry.scope, view)}#${part.id}`, part.label ?? part.id);

  const { made, missed } = inferConnections(corpus);
  for (const c of made) {
    const at = c.from.split("#");
    const from = `${at[0]}#${at[1]}`;
    const step = steps.get(from);
    if (!step || !steps.has(c.to)) continue;
    step.exits.push({ part: at.slice(2).join("#"), label: labelOf.get(c.from) ?? at.slice(2).join("#"), to: c.to });
  }
  for (const m of missed) {
    const at = m.from.split("#");
    const step = steps.get(`${at[0]}#${at[1]}`);
    if (step) step.danglingControls.push({ part: at.slice(2).join("#"), label: m.label });
  }

  /**
   * A door is a screen nothing holds and nothing leads to.
   *
   * ⛔ A HELD SCREEN IS NEVER A DOOR even when no link reaches it: you get to a tab through the
   * screen that holds it, which is the whole point of recording containment.
   */
  const ledTo = new Set<Ref>();
  for (const step of steps.values()) for (const e of step.exits) ledTo.add(e.to);
  const entries = [...steps.keys()]
    .filter((ref) => !heldBy.has(ref) && !ledTo.has(ref))
    .sort((a, b) => {
      const sa = steps.get(a)!;
      const sb = steps.get(b)!;
      /** A door that goes somewhere first, then a drawn one, then by name so it never shuffles. */
      const goes = (s: Step): number => (s.exits.length ? 0 : 1) + (s.holds.length ? 0 : 1);
      return goes(sa) - goes(sb) || Number(sb.drawn) - Number(sa.drawn) || a.localeCompare(b);
    });

  const reachable = new Set<Ref>();
  const seen: Ref[] = [...entries];
  while (seen.length) {
    const ref = seen.pop()!;
    if (reachable.has(ref)) continue;
    reachable.add(ref);
    const step = steps.get(ref);
    if (!step) continue;
    for (const held of step.holds) seen.push(held);
    for (const exit of step.exits) seen.push(exit.to);
  }

  const unreachable = [...steps.keys()].filter((r) => !reachable.has(r)).sort();

  /**
   * ⛔ FROM THE DOORS SOMEBODY DECLARED, AND ONLY THOSE. Same flood, different roots: a prototype's
   * `starts_at` is the only thing in this model that claims "a person comes in here".
   */
  /**
   * ⛔ DECLARED NAVIGATION, FOR THIS QUESTION ONLY — AND DELIBERATELY NOT IN `exits`.
   *
   * `leads_to` reaches the walk nowhere: exits come from `inferConnections`, and `connects.ts:183`
   * reads `if (p.leads_to) continue;` — correctly, since its job is inferring what nobody wrote. So
   * every control whose destination an author DID write counts for nothing in reachability.
   *
   * ⛔ MY FIRST FIX PUT IT IN `exits` AND BROKE FOUR TESTS. `exits` feeds `ledTo`, which decides
   * `entries` — the inferred doors — so adding authored navigation there silently redefined what
   * counts as a front door and what a held screen is. Those semantics are somebody else's and were
   * load-bearing. This question does not need them changed: it asks what a person can reach from a
   * door somebody DECLARED, so it floods on its own edges and leaves the topology exactly as it was.
   */
  const alsoLeadsTo = new Map<Ref, Ref[]>();
  for (const entry of corpus.scopes)
    for (const view of entry.scope.views ?? []) {
      const from = refOf(entry.scope, view);
      if (!steps.has(from)) continue;
      for (const part of view.parts ?? []) {
        if (!part.leads_to) continue;
        /** ⛔ Through the same resolver as `within`: a bare view id means "in this scope". */
        const to = resolveWithin(part.leads_to, entry.scope, steps);
        if (to) alsoLeadsTo.set(from, [...(alsoLeadsTo.get(from) ?? []), to]);
      }
    }

  const entered = new Set<Ref>();
  const fromDoors: Ref[] = (corpus.prototypes ?? [])
    .map((p) => p.starts_at)
    .filter((r): r is string => Boolean(r) && steps.has(r));
  const pending: Ref[] = [...fromDoors];
  while (pending.length) {
    const ref = pending.pop()!;
    if (entered.has(ref)) continue;
    entered.add(ref);
    const step = steps.get(ref);
    if (!step) continue;
    for (const held of step.holds) pending.push(held);
    for (const exit of step.exits) pending.push(exit.to);
    for (const to of alsoLeadsTo.get(ref) ?? []) pending.push(to);
  }
  const unentered = [...steps.keys()].filter((r) => !entered.has(r)).sort();
  /**
   * ⛔ THE NAMED START COMES FIRST AND STAYS A DOOR. It may well be a screen something leads to —
   * a deals list is reached from half the product — and dropping it from the doors because of that
   * would leave the prototype with no front door at all.
   */
  const ordered = startAt && steps.has(startAt) ? [startAt, ...entries.filter((e) => e !== startAt)] : entries;
  return { steps, entries: ordered, reachable, unreachable, unentered };
}
