/**
 * How well-supported a statement is, and whether a human confirmed it. ⛔ TWO ZONES, NOT ONE AXIS.
 *
 * Peter: *"I think we might want self-learning/weighting for each piece of confirmable evidence —
 * like enough inference that a behavior is true should bump up the confidence if not expiclity
 * decided. so we have a rough scale - like 'human confirmed' on one end, and like '1 inference' on
 * the other end. multiple inteferences would move it towards human confirmed."* And later: *"still
 * too much review surface… when the feature is initially spec'd, or when UX is changed with
 * explicit instructions, and there is confirmation, it should feed into everything that hasn't been
 * confirmed (or confirmed) to make sure there are no discrepancies, and confidence is updated"* —
 * and *"the reason why it has confidence needs to be visible as well"*.
 *
 * ⛔ "MOVES TOWARD HUMAN CONFIRMED" IS A READING OF STRENGTH, NEVER AN IMPLEMENTATION.
 *
 * `confirmed` is a separate field of a different type, not the top value of `strength`. No amount of
 * support can produce it, because nothing here writes it — it comes from `stampFor`, which filters
 * `via: agent` out at the source so one field cannot make the first tenet void. A scale whose top is
 * reachable without a person is worse than no scale, because the whole value of the two states was
 * that nobody could mistake one for the other.
 *
 * ⛔ DERIVED, NEVER STORED, like `stageOf` and `reachOf`. A stored confidence is a number that was
 * true when it was written and is unfalsifiable afterwards.
 */
import type { Corpus } from "./load.js";
import type { Reading } from "./schema.js";
import { stampFor } from "./stamp.js";

/**
 * How strong the support is — ⛔ NAMED TIERS, NOT A NUMBER.
 *
 * A number invites arithmetic nobody can defend: averaging a code path against an interview produces
 * a figure that looks like information and is not. Peter asked for "a rough scale", and rough is the
 * accurate word — these distinguish the four cases somebody would actually act on differently.
 *
 * Every one of these is BELOW the line. `confirmed` is not here on purpose.
 */
export type Strength = "none" | "one-reading" | "corroborated" | "strongly-supported";

/** One thing somebody can go and look at. */
export interface SupportUnit {
  reading: string;
  observes: string;
  kind: Reading["basis"]["kind"];
  /** ⛔ The pointer, and the load-bearing half — a support unit nobody can check is an assertion. */
  ref: string;
  at?: string;
}

/**
 * Support this statement did not earn directly, and where it came from.
 *
 * ⛔ `from` AND `because` ARE BOTH REQUIRED, BECAUSE PETER ASKED FOR THE REASON TO BE VISIBLE. An
 * inherited strength with no provenance is the laundering this whole file is arranged to prevent,
 * one render away: a reader sees a statement look stronger with nothing saying why, and the only
 * honest conclusion available to them is that somebody looked at it.
 */
export interface Inherited {
  /** The confirmed ref this came from. */
  from: string;
  how: "shared-support" | "derived";
  /** What links them — the shared basis pointer, or the path that derives it. */
  because: string;
}

export interface Confidence {
  ref: string;
  /**
   * ⛔ A SEPARATE FIELD OF A DIFFERENT TYPE. Not `strength: "confirmed"`. Nothing in this module can
   * set it; it is `stampFor`'s answer, and `stampFor` is the one place that refuses an agent.
   */
  confirmed: { by: string; at: string } | null;
  /** Confirmed once, and the sentence has moved since. ⛔ Not confirmed, and not nothing either. */
  stale: null | "claim-changed" | "criteria-changed" | "both-changed";
  /** Readings bearing directly on this ref. */
  support: SupportUnit[];
  /**
   * ⛔ INDEPENDENT BASES, NOT READINGS. Two readings citing the same `basis.ref` are one source, and
   * the difference is the whole meaning of the word corroborated: four observations of one code path
   * is one thing known four ways of saying it.
   */
  sources: number;
  strength: Strength;
  inherited: Inherited[];
}

/** Readings bearing directly on a ref. */
export const supportFor = (corpus: Corpus, ref: string): SupportUnit[] =>
  corpus.readings
    .filter((r) => r.bears_on === ref)
    .map((r) => ({ reading: r.id, observes: r.observes, kind: r.basis.kind, ref: r.basis.ref, at: r.basis.at }));

/** ⛔ Counted by pointer, so the same source cited twice is not corroboration. */
export const sourcesOf = (support: SupportUnit[]): number => new Set(support.map((s) => s.ref)).size;

/**
 * ⛔ THE CAP IS THE POINT, AND IT IS STRUCTURAL.
 *
 * `strongly-supported` is the ceiling and it is below the line. Peter chose that shared support may
 * raise confidence; the condition he set is that the zones stay visibly distinct, and the way to
 * hold that is for the top of this function to be unreachable from `confirmed` in both directions.
 *
 * ⛔ AND A REF WITH NOTHING READ ABOUT IT DIRECTLY STOPS AT `corroborated`. Inheritance says other
 * statements rest on the same evidence; it never says anybody examined THIS one. Letting inherited
 * support alone reach the top tier would make the strongest reading in the corpus available to a
 * statement nobody has ever looked at, which is the failure in a different costume.
 */
export function strengthOf(ownSources: number, inherited: number): Strength {
  const total = ownSources + inherited;
  if (total === 0) return "none";
  if (ownSources === 0) return total >= 2 ? "corroborated" : "one-reading";
  if (total === 1) return "one-reading";
  if (total === 2) return "corroborated";
  return "strongly-supported";
}

/** Every ref a verdict has confirmed, with what confirmed it. */
function confirmedRefs(corpus: Corpus): Map<string, { by: string; at: string }> {
  const out = new Map<string, { by: string; at: string }>();
  for (const v of corpus.verdicts) {
    /**
     * ⛔ `target` IS OPTIONAL ON A VERDICT, and that is not an oversight to code around: a `read` of
     * a whole scope and a `waive` carry no single ref. Skipping them here is correct — a confirmation
     * of nothing in particular cannot be inherited FROM, because there is no shared basis to point at.
     */
    if (!v.target) continue;
    const stamp = stampFor(corpus, v.target);
    if (stamp.state === "accepted") out.set(v.target, { by: stamp.by, at: stamp.at });
  }
  return out;
}

/**
 * What this ref inherits from somebody else's confirmation.
 *
 * ⛔ TWO ROUTES, AND THEY ARE NOT EQUALLY SAFE.
 *
 * `derived` is the same claim restated: the views a confirmed happy path names ARE on that path,
 * because the path says so. Confirming it confirmed that, and calling it inference would be false
 * modesty.
 *
 * `shared-support` is the one Peter chose knowingly and the one that needs the reason visible. If a
 * confirmed statement and an unconfirmed one rest on the same code path, the unconfirmed one is
 * better supported than a guess — and nobody has read it. It may move within the lower zone and it
 * carries `from` so the page can say whose confirmation it borrowed.
 */
export function inheritedFor(corpus: Corpus, ref: string): Inherited[] {
  const confirmed = confirmedRefs(corpus);
  if (confirmed.has(ref)) return [];
  const out: Inherited[] = [];

  /** derived: a confirmed happy path names the views it passes through. */
  for (const { scope } of corpus.scopes) {
    const pathRef = `${scope.id}#happy-path`;
    if (!confirmed.has(pathRef)) continue;
    for (const view of scope.happy_path?.through ?? []) {
      /**
       * ⛔ SCOPE-QUALIFIED ONLY. `through` names a view id, and two scopes may each have a screen
       * called `balance` — so matching a bare `ref === view` let a confirmed path in one scope lend
       * its authority to a same-named screen in another. That is the laundering this file is
       * arranged to prevent, arriving through a name collision rather than through a decision.
       */
      if (ref === `${scope.id}#${view}`) {
        out.push({ from: pathRef, how: "derived", because: `on the happy path, through: ${view}` });
      }
    }
  }

  /** shared-support: this ref and a confirmed one rest on the same pointer. */
  const mine = new Set(supportFor(corpus, ref).map((s) => s.ref));
  if (mine.size) {
    for (const [cref] of confirmed) {
      for (const s of supportFor(corpus, cref)) {
        if (mine.has(s.ref)) {
          out.push({ from: cref, how: "shared-support", because: s.ref });
        }
      }
    }
  }

  /** ⛔ One entry per (from, because). A basis cited twice is not two inheritances. */
  const seen = new Set<string>();
  return out.filter((i) => {
    const key = `${i.from}|${i.how}|${i.because}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Everything known about how well-founded one statement is. */
export function confidenceOf(corpus: Corpus, ref: string): Confidence {
  const stamp = stampFor(corpus, ref);
  const support = supportFor(corpus, ref);
  const inherited = inheritedFor(corpus, ref);
  const sources = sourcesOf(support);
  return {
    ref,
    confirmed: stamp.state === "accepted" ? { by: stamp.by, at: stamp.at } : null,
    stale: stamp.state === "never" || stamp.state === "accepted" ? null : stamp.state,
    support,
    sources,
    strength: strengthOf(sources, inherited.length),
    inherited,
  };
}

/**
 * Why it has the confidence it has, in sentences a person can read. ⛔ THIS IS A REQUIREMENT, NOT A
 * CONVENIENCE: Peter, on being told a confirmation may raise another statement's strength — *"yes,
 * the reason why it has confidence needs to be visible as well"*.
 *
 * Returned as lines rather than rendered, so the page and the CLI say the same thing. A second
 * phrasing of this on a surface would be a second answer to the question the model is supposed to
 * settle.
 */
export function whyConfident(corpus: Corpus, ref: string): string[] {
  const c = confidenceOf(corpus, ref);
  const lines: string[] = [];

  if (c.confirmed) lines.push(`${c.confirmed.by} confirmed this on ${c.confirmed.at}.`);
  else if (c.stale)
    lines.push(
      `Confirmed once, and the ${c.stale === "both-changed" ? "sentence and its criteria have" : c.stale === "claim-changed" ? "sentence has" : "criteria have"} changed since — so it is not confirmed now.`,
    );
  else lines.push("Nobody has confirmed this.");

  for (const s of c.support) lines.push(`Read from ${s.kind} at ${s.ref}: ${s.observes}`);
  if (!c.support.length) lines.push("Nothing has been observed about it directly.");

  /** ⛔ Named, every time, or the strength is a number with no argument behind it. */
  for (const i of c.inherited) {
    lines.push(
      i.how === "derived"
        ? `Follows from ${i.from}, which is confirmed — ${i.because}.`
        : `Rests on the same evidence as ${i.from}, which is confirmed: ${i.because}. ⛔ Nobody has read this statement itself.`,
    );
  }

  if (c.strength === "strongly-supported" || c.strength === "corroborated")
    lines.push(`${c.sources} independent source${c.sources === 1 ? "" : "s"}, so: ${c.strength}. ⛔ Still not confirmed.`);

  return lines;
}
