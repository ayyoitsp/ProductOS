/**
 * Running one analysis across a whole corpus — what work there is, and what is already done.
 *
 * ⛔ THE THING THAT WAS MISSING WHEN A ROLE EXISTED AND NOBODY COULD RUN IT OVER EVERYTHING.
 *
 * Peter: *"let's do it - let's do the decomposer across a corpus. this should be extendable to view
 * state analysis, product analysis, etc."*
 *
 * `decomposer` landed with a grain — `each: "feature"` — and no way to ask "which features still
 * need one". So indexing a corpus meant a person listing its features by eye and spawning a role
 * per name, which on 36 scopes is both tedious and silently incomplete: nothing told them which
 * ones were already done, and nothing told them which were done against truth that has since
 * moved.
 *
 * ⛔ WHAT THIS IS NOT, AND THE BOUNDARY IS DELIBERATE. It does not spawn anything and it writes
 * nothing. ProductOS cannot spawn a role — the host does, through the skill — and a command that
 * wrote the analysis itself would be the hand-authoring trap with a bigger engine. This answers one
 * question: **for this analysis, what are the units of work and which of them need doing.** The
 * session fans the role over what comes back.
 *
 * ⛔ AND EXTENDABLE MEANS ONE ROW, NOT ONE REWRITE. An analysis declares its role, the grain it
 * runs at, and how to read the state of one unit. Everything else — the worklist, the tally, the
 * incremental behaviour, the CLI — walks the registry. `view state analysis` and `product
 * analysis` are rows nobody has written yet, not features nobody has built.
 */
import type { Corpus } from "./load.js";
import { demonstrationOf, derivedCapabilities } from "./demonstrate.js";
import { pictureOf } from "./states.js";

/**
 * ⛔ THREE STATES, AND `stale` IS THE ONE THAT MAKES A SWEEP WORTH RE-RUNNING.
 *
 * `missing` alone would make this a to-do list that only ever shrinks. What makes an analysis
 * something you run again is that truth moves underneath work already done — so a unit that was
 * finished and is now answering an older wording has to be nameable, or the second run cannot tell
 * the difference between done and out of date.
 */
export type UnitState = "done" | "stale" | "missing";

export interface Unit {
  /** What to hand the role. A scope id for a feature-grained analysis. */
  ref: string;
  title: string;
  state: UnitState;
  /** Why it needs doing, in one line a person can act on. */
  why: string;
}

export interface Analysis {
  name: string;
  /** The role that does this work. ⛔ Named, never spawned from here. */
  role: string;
  does: string;
  /** What one unit of work is — the grain the role declares. */
  grain: string;
  units: (corpus: Corpus) => Unit[];
}

/** Features in reading order, skipping containers — a container has no behaviours of its own. */
function featuresOf(corpus: Corpus): Array<{ id: string; title: string }> {
  return corpus.scopes
    .filter((s) => s.scope.exchanges.length > 0)
    .map((s) => ({ id: s.scope.id, title: s.scope.title }));
}

/**
 * ⛔ THE REGISTRY. Adding an analysis is adding a row here and nothing else.
 *
 * Each row owes the same three things: which role does the work, what one unit is, and how to tell
 * a finished unit from a stale one. The two below are the derived layers; both read their state
 * from `demonstrate.ts` rather than recomputing it, so a sweep cannot disagree with `check` about
 * whether something is current.
 */
export const ANALYSES: Analysis[] = [
  {
    name: "capabilities",
    role: "decomposer",
    does: "Which parts of the system each feature needs, and where they belong",
    grain: "feature",
    units: (corpus) => {
      /** Every part, grouped by the feature whose promises it serves. */
      const parts = derivedCapabilities(corpus);
      return featuresOf(corpus).map(({ id, title }) => {
        const mine = parts.filter((p) =>
          p.offering.serves.some((s) => s === id || s.startsWith(`${id}#`))
        );
        if (!mine.length)
          return {
            ref: id,
            title,
            state: "missing" as UnitState,
            why: "no part of the system says it serves anything this feature promises",
          };
        const stale = mine.filter((p) => p.state === "stale");
        if (stale.length)
          return {
            ref: id,
            title,
            state: "stale" as UnitState,
            why: `${stale.length} of ${mine.length} parts were worked out from truth that has changed since — ${stale
              .map((p) => p.ref)
              .slice(0, 3)
              .join(", ")}`,
          };
        /**
         * ⛔ A part nobody recorded a derivation for counts as done, not as work. It may be
         * perfectly good; what it cannot do is tell anybody whether it is current. Treating it as
         * work would mean a sweep re-derives every hand-written part on every run, which is how a
         * sweep becomes something people stop running.
         */
        return {
          ref: id,
          title,
          state: "done" as UnitState,
          why: `${mine.length} part${mine.length === 1 ? "" : "s"} serve this`,
        };
      });
    },
  },
  {
    name: "requirements",
    role: "demonstrator",
    does: "What would have to be demonstrated for each claim in a feature to be believed",
    grain: "feature",
    units: (corpus) =>
      featuresOf(corpus).map(({ id, title }) => {
        const scope = corpus.scopes.find((s) => s.scope.id === id)!.scope;
        const ds = scope.exchanges
          .map((e) => demonstrationOf(corpus, id, e.id))
          .filter((d): d is NonNullable<typeof d> => d !== null);
        const reqs = ds.flatMap((d) => d.requirements);
        const bare = ds.flatMap((d) => d.undemonstrated);
        const stale = reqs.filter((r) => r.state === "stale");
        if (stale.length)
          return {
            ref: id,
            title,
            state: "stale" as UnitState,
            why: `${stale.length} requirement${stale.length === 1 ? "" : "s"} worked out from truth that has changed since — ${stale
              .map((r) => r.ref)
              .slice(0, 3)
              .join(", ")}`,
          };
        if (bare.length)
          return {
            ref: id,
            title,
            state: "missing" as UnitState,
            why: `${bare.length} stated behaviour${bare.length === 1 ? " has" : "s have"} nothing saying what would show ${
              bare.length === 1 ? "it" : "them"
            } working`,
          };
        return {
          ref: id,
          title,
          state: "done" as UnitState,
          why: `${reqs.length} requirement${reqs.length === 1 ? "" : "s"}, none stale and nothing undemonstrated`,
        };
      }),
  },
  /**
   * ⛔ THE THIRD ROW IS THE PROOF THAT THIS GENERALISES, and it deliberately is not a derived
   * layer. Peter named *"view state analysis, product analysis, etc."* — so the mechanism has to
   * hold an analysis that is not about `derived.from` at all, or "extendable" is a claim rather
   * than a property.
   *
   * This one's grain is a SCREEN, not a feature, which is the other half of the generalisation:
   * `designer` already declares `each: "screen no component renders"`, and nothing could enumerate
   * them.
   */
  {
    name: "drawings",
    role: "designer",
    does: "A picture for every screen, and for each appearance a screen falls into",
    grain: "screen",
    units: (corpus) =>
      corpus.scopes.flatMap(({ scope }) =>
        scope.views
          .filter((v) => v.exists !== "withdrawn")
          .map((v) => {
            const ref = `${scope.id}#${v.id}`;
            const drawn = !!v.sketch_html || !!v.sketch;
            if (!drawn)
              return {
                ref,
                title: v.title,
                state: "missing" as UnitState,
                why: "nothing draws this screen, so nobody can review what it promises",
              };
            const states = v.states ?? [];
            /**
             * ⛔ A STATE THAT COMPOSES IS NOT A STATE MISSING A PICTURE, and conflating the two
             * would make this analysis report the better form as work.
             *
             * `states[].sketch_html` stopped being required: where a state gives `holds` — what is
             * different about each part while it holds — the picture is composed from the screen's
             * own drawing. That change exists because a whole second copy of a screen cannot
             * compose, measured at 96% byte-identical for one error state. So only the states that
             * carry their own markup can duplicate each other, and only those are checked here.
             */
            const drawnStates = states.filter((st) => !!st.sketch_html);
            /**
             * ⛔ THE COMPOSED PICTURE, THROUGH THE SAME FUNCTION `check` USES. A sweep and a check
             * that disagree about whether a screen has two states drawn alike is the drift this
             * repo keeps writing about — `gateFor` diverged from `check` by one clause and made two
             * of five seed exchanges permanently un-acceptable, invisibly, in both directions.
             */
            const seen = new Map<string, number>();
            for (const st of states) {
              const k = pictureOf(v, st).replace(/\s+/g, " ").trim();
              seen.set(k, (seen.get(k) ?? 0) + 1);
            }
            const duped = [...seen.values()].filter((n) => n > 1).length;
            if (duped)
              return {
                ref,
                title: v.title,
                state: "stale" as UnitState,
                why: `${drawnStates.length} appearances carry their own picture and ${
                  duped === 1 ? "two or more of them are the same picture" : `${duped} pictures are each used for several`
                }`,
              };
            /**
             * ⛔ A state that neither composes nor draws says nothing about what is different while
             * it holds — which is the one shape a reader cannot judge at all.
             */
            const empty = states.filter((st) => !st.sketch_html && !(st.holds ?? []).length);
            if (empty.length)
              return {
                ref,
                title: v.title,
                state: "missing" as UnitState,
                why: `${empty.length} appearance${empty.length === 1 ? "" : "s"} say nothing about what is different while ${
                  empty.length === 1 ? "it holds" : "they hold"
                } — ${empty.map((st) => st.label).slice(0, 3).join(", ")}`,
              };
            return {
              ref,
              title: v.title,
              state: "done" as UnitState,
              /**
               * ⛔ A `done` unit still owes a reason, and a test caught this saying only "drawn".
               * The line a person reads next to a finished unit is what tells them whether they
               * agree it is finished — "drawn, and no further appearance is stated" is a claim
               * somebody can contradict; "drawn" is a tick.
               */
              why: states.length
                ? `drawn, with ${states.length} further appearance${states.length === 1 ? "" : "s"} — ${
                    drawnStates.length
                      ? `${drawnStates.length} drawn in full, ${states.length - drawnStates.length} composed`
                      : "all composed from this screen's own drawing"
                  }`
                : "drawn, and no further appearance of this screen is stated",
            };
          })
      ),
  },
];

export interface Sweep {
  analysis: Analysis;
  units: Unit[];
  done: number;
  stale: number;
  missing: number;
}

export function sweep(corpus: Corpus, name: string): Sweep | null {
  const analysis = ANALYSES.find((a) => a.name === name);
  if (!analysis) return null;
  const units = analysis.units(corpus);
  return {
    analysis,
    units,
    done: units.filter((u) => u.state === "done").length,
    stale: units.filter((u) => u.state === "stale").length,
    missing: units.filter((u) => u.state === "missing").length,
  };
}

/** Every analysis, for the no-argument listing. */
export function sweeps(corpus: Corpus): Sweep[] {
  return ANALYSES.map((a) => sweep(corpus, a.name)!).filter(Boolean);
}

/**
 * The units a role still has to be run over.
 *
 * ⛔ STALE FIRST, because a unit that was done and is now answering an older wording is worse than
 * one that was never done: the first looks finished to everybody reading it.
 */
export function outstanding(s: Sweep): Unit[] {
  return [...s.units.filter((u) => u.state === "stale"), ...s.units.filter((u) => u.state === "missing")];
}
