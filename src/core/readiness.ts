import { Behavior, FeatureDocument, isUndefinedBehavior } from "./product.js";
import { FeatureTracking } from "./tracking.js";
import { derivedVerification } from "./derived-state.js";
import type { ContextSectionState } from "./context.js";

/**
 * Is there enough here to properly build this feature?
 *
 * ⛔ A GATE WITH REASONS, NEVER A SCORE. Coverage percentage is an anti-metric
 * — it rewards bulk-accept, and a rubber-stamped corpus is worse than none
 * because every claim in it is labelled reviewed. A readiness *number* does
 * something worse still: it invites building at 73%, which is precisely the
 * state where an agent fills the missing 27% by inventing it.
 *
 * So this returns the blockers. A caller that wants a headline says
 * "not ready — 3 reasons" and lists them; it never renders a ratio.
 *
 * ⛔ TWO AXES, NOT ONE. This answers ready-to-BUILD: is every claim decided,
 * accepted by a human, and backed by acceptance criteria. It deliberately does
 * NOT ask whether evidence exists, because a `planned` feature has no code and
 * therefore no test runs — and `planned` is where generation lives. Requiring
 * evidence here would make every pre-code feature look broken, inverting the
 * north star. `orphan` (accepted, no evidence yet) is therefore NOT a blocker.
 */
export type ReadinessBlockerKind =
  | "undefined-behavior"
  | "unvalidated-context"
  | "dangling-citation"
  | "unverified-behavior"
  | "contradiction"
  | "ambiguous"
  | "no-acceptance-criteria"
  | "no-behaviors"
  | "unscoped-surface"
  | "contested-behavior"
  // ⛔ THE SYSTEM UNDERNEATH. Everything above asks about this container's own claims,
  // so a feature could clear every blocker while resting on machinery that does not
  // exist, is undecided, or has no stated failure behaviour. Peter: "perhaps ProductOS
  // internally needs this — to determine if the system is there to correctly build this
  // thing?" It did not, and that is the most consequential thing readiness was missing:
  // a feature is not buildable because its own sentences are settled, it is buildable
  // when the things it calls are.
  | "dependency-missing"
  | "dependency-not-ready"
  | "dependency-awaiting-review"
  | "dependency-unconfirmed"
  | "dependency-has-no-failure-story"
  // ⛔ A PERSON SAID THEY COULD NOT BUILD FROM THIS, and readiness ignored them. The
  // glossary calls the read-through "the only signal on a page that nothing can compute"
  // and readiness — which is computed — outranked it. An architect found the hole:
  // "a `buildable: false` read-through does not appear in ReadinessBlockerKind, so a
  // container a reader could not build from can still read ready. Either it blocks, or
  // the docs stop calling it the only signal that matters."
  //
  // It blocks. Everything else here is derived from shape, and shape is not what goes
  // wrong; a human reporting that the document failed its job is the one input that
  // catches a disagreement between two sentences.
  | "read-through-blocked";

export interface ReadinessBlocker {
  kind: ReadinessBlockerKind;
  behavior_id?: string;
  detail: string;
}

export interface FeatureReadiness {
  feature_id: string;
  ready: boolean;
  /** Counts for a compact badge. Never divide these into a percentage. */
  undefined_count: number;
  unverified_count: number;
  contested_count: number;
  active_behaviors: number;
  blockers: ReadinessBlocker[];
}

/** A context section's state, keyed `<doc>#<anchor>`. Built once by the caller. */
export type ContextStates = Map<string, ContextSectionState>;

/**
 * Words that mean a claim says what happens when something goes wrong.
 *
 * Deliberately broad. A false positive here costs a contract being credited with a
 * failure story it half has; a false negative lets a subsystem boundary ship with no
 * stated behaviour at all, and every boundary is a place things break.
 */
const FAILURE_WORDS =
  /\b(not|never|cannot|can't|refus|reject|fail|error|unavailable|missing|absent|empty|invalid|unreadable|instead of|rather than|without|conflict|retri|timeout|already)\b/i;

/**
 * Can an engineer build against this capability, or only guess at it?
 *
 * A subsystem's page is a contract, and a contract with no failure behaviour is not one:
 * the caller has no idea what it gets when the thing cannot be done. This is the single
 * question that separates "we wrote down what it does" from "you can build on it".
 */
export function capabilityHasFailureStory(c: FeatureDocument): boolean {
  return c.frontmatter.behaviors.some(
    (b) => !b.deprecated && !isUndefinedBehavior(b) && FAILURE_WORDS.test(b.claim)
  );
}

export function featureReadiness(
  feature: FeatureDocument,
  tracking: FeatureTracking | null,
  contextStates: ContextStates = new Map(),
  /**
   * Every container in the corpus, so readiness can ask the question it never asked:
   * **is the system underneath this specified well enough to build against?**
   *
   * ⛔ Without this, readiness was a statement about one page's sentences. A feature
   * could clear every blocker — claims decided, accepted, criteria written — while
   * resting on a capability that does not exist, has not been decided, or has no stated
   * failure behaviour. That feature is not ready and the gate said it was.
   */
  allContainers: FeatureDocument[] = [],
  /**
   * Readiness of the things it depends on — the whole result, not a boolean.
   *
   * ⛔ A boolean could only produce "X is not ready", which is not actionable and was
   * emitted once per dependency: five identical-shaped lines on one page, 37 across a
   * corpus, more than half of that tenet's blockers. The useful question is *why* it is
   * not ready, because the two answers go to different people and clear at different
   * times — a dependency waiting on acceptance clears the moment somebody reviews it,
   * and a dependency with an undecided behavior needs a person to decide something.
   */
  dependencyReadiness?: Map<string, FeatureReadiness>
): FeatureReadiness {
  const f = feature.frontmatter;
  const active = f.behaviors.filter((b) => !b.deprecated);
  const blockers: ReadinessBlocker[] = [];
  let undefined_count = 0;
  let unverified_count = 0;
  let contested_count = 0;

  // A screen nobody has walked has unknown behavior, so a feature holding a
  // stub cannot be built from — whatever is missing is missing silently.
  for (const u of f.ux ?? []) {
    if (!u.stub) continue;
    blockers.push({
      kind: "unscoped-surface",
      detail: `"${u.id}" is declared but never walked — its behavior is unknown`,
    });
  }

  if (active.length === 0) {
    blockers.push({ kind: "no-behaviors", detail: "no behaviors documented" });
  }

  for (const b of active) {
    const state = derivedVerification(b, tracking?.behaviors[b.id]).state;

    if (state === "undefined") {
      undefined_count++;
      blockers.push({
        kind: "undefined-behavior",
        behavior_id: b.id,
        detail: b.question ?? "no claim decided",
      });
      // Nothing else is worth saying about it — it has no claim to review and
      // no criteria to demand. Reporting three blockers for one undecided
      // behavior buries the one that matters.
      continue;
    }

    // ⛔ A declared contradiction outranks every other blocker. The claim may be
    // perfectly clear, accepted, and fully test-covered, and still be one of two
    // statements that cannot both hold — which is the one state where an agent
    // confidently builds the wrong thing.
    // ⛔ Underdetermined outranks unaccepted. A claim can be clear, accepted and fully
    // test-covered while still having two builds — which is the state in which two
    // engineers ship different products and both pass every case.
    if ((b.ambiguous ?? []).length > 0) {
      contested_count++;
      blockers.push({
        kind: "ambiguous",
        behavior_id: b.id,
        detail: `two readings: ${(b.ambiguous ?? [])[0]!.readings.slice(0, 2).join(" / ")}`,
      });
      continue;
    }

    if ((b.contradicts ?? []).length > 0) {
      contested_count++;
      blockers.push({
        kind: "contradiction",
        behavior_id: b.id,
        detail: `cannot both hold with ${(b.contradicts ?? []).join(", ")}`,
      });
      continue;
    }

    if (state === "contested") {
      contested_count++;
      blockers.push({
        kind: "contested-behavior",
        behavior_id: b.id,
        detail: "something disagrees with this claim",
      });
    } else if (state === "unverified") {
      unverified_count++;
      blockers.push({
        kind: "unverified-behavior",
        behavior_id: b.id,
        detail: "proposed by an agent, no human has accepted it",
      });
    }

    // ⛔ The transitive case. A claim that defers to a principle is only as
    // trustworthy as the principle, and agents can write context — so a
    // behavior resting on an unaccepted rule is resting on something no human
    // has agreed to. Skipped entirely when no context states were supplied,
    // rather than reported as clean.
    if (contextStates.size > 0) {
      for (const ref of b.cites) {
        const state = contextStates.get(ref);
        if (state === undefined) {
          blockers.push({
            kind: "dangling-citation",
            behavior_id: b.id,
            detail: `cites ${ref}, which does not exist`,
          });
        } else if (state !== "validated") {
          blockers.push({
            kind: "unvalidated-context",
            behavior_id: b.id,
            detail:
              state === "stale"
                ? `rests on ${ref}, whose wording changed after it was accepted`
                : `rests on ${ref}, which no human has accepted`,
          });
        }
      }
    }

    if (activeCases(b).length === 0) {
      blockers.push({
        kind: "no-acceptance-criteria",
        behavior_id: b.id,
        detail: "no test cases — nothing defines what done means",
      });
    }
  }

  // ⛔ THE SYSTEM UNDERNEATH. Everything above asks about this container's own claims, so
  // a feature could clear every blocker while resting on machinery that does not exist,
  // has not been decided, or never says what happens when it fails. Peter: "perhaps
  // ProductOS internally needs this — to determine if the system is there to correctly
  // build this thing?" It did not ask, and that is the most consequential thing readiness
  // was missing: a feature is not buildable because its own sentences are settled, it is
  // buildable when the things it calls are.
  //
  // Last in the list on purpose — a reader who has fixed everything above and still
  // cannot build needs this in the same place, not on another page.
  // The most recent read-through, if somebody said they could not build from it.
  const reads = [...(f.read_throughs ?? [])].sort((a, b) =>
    String(b.at).localeCompare(String(a.at))
  );
  if (reads.length > 0 && !reads[0]!.buildable) {
    const r0 = reads[0]!;
    blockers.push({
      kind: "read-through-blocked",
      detail: `${r0.by} read this end to end on ${String(r0.at).slice(0, 10)} and could not build from it${
        r0.note ? `: ${r0.note}` : ""
      }`,
    });
  }

  if (allContainers.length > 0) {
    const byId = new Map(allContainers.map((c) => [c.frontmatter.id, c]));
    /** Dependencies unready ONLY because nobody has accepted their claims yet. */
    const unacceptedDeps: string[] = [];
    for (const dep of f.depends_on ?? []) {
      const target = byId.get(dep);
      if (!target) {
        blockers.push({
          kind: "dependency-missing",
          detail: `depends on "${dep}", which does not exist — the machinery for this has no owner yet`,
        });
        continue;
      }
      // A contract with no failure behaviour is not a contract: a caller has no idea what
      // it gets when the thing cannot be done, and every boundary is a place things break.
      if (target.frontmatter.kind === "capability" && !capabilityHasFailureStory(target)) {
        blockers.push({
          kind: "dependency-has-no-failure-story",
          detail: `"${dep}" never says what happens when it cannot do the thing — you cannot build against it, only guess`,
        });
      }
      const depR = dependencyReadiness?.get(dep);
      if (depR && !depR.ready) {
        // Undecided, contradicted or ambiguous underneath is a real gap — somebody has to
        // decide. Merely unaccepted is the acceptance backlog, which the page already
        // says at the top, so it is collected and reported once rather than per-dependency.
        const substantive = depR.blockers.filter(
          (x) =>
            x.kind === "undefined-behavior" ||
            x.kind === "contradiction" ||
            x.kind === "ambiguous" ||
            x.kind === "contested-behavior" ||
            x.kind === "dependency-missing" ||
            x.kind === "dependency-has-no-failure-story"
        );
        if (substantive.length > 0) {
          blockers.push({
            kind: "dependency-not-ready",
            detail: `"${dep}" has ${substantive.length} thing${
              substantive.length === 1 ? "" : "s"
            } nobody has settled, and this rests on it — ${substantive
              .slice(0, 2)
              .map((x) => x.detail)
              .join("; ")}`,
          });
        } else {
          unacceptedDeps.push(dep);
        }
      }
    }
    // One line for the whole acceptance backlog underneath. It is the same fact the page
    // already states at the top, and repeating it per dependency buried the gaps that
    // actually need a decision.
    if (unacceptedDeps.length > 0) {
      blockers.push({
        kind: "dependency-awaiting-review",
        detail: `${unacceptedDeps.length} ${
          unacceptedDeps.length === 1 ? "capability" : "capabilities"
        } this rests on ${
          unacceptedDeps.length === 1 ? "is" : "are"
        } written and unaccepted — nothing is undecided in ${
          unacceptedDeps.length === 1 ? "it" : "them"
        }, they just need reviewing: ${unacceptedDeps.join(", ")}`,
      });
    }

    // An unconfirmed edge might be real, and if it is, this rests on something nobody has
    // traced. Either way its owner owes an answer before anybody builds.
    for (const s of f.suspected_depends_on ?? []) {
      blockers.push({
        kind: "dependency-unconfirmed",
        detail: `somebody believes this depends on "${s.id}", and its owner has not confirmed it`,
      });
    }
  }

  return {
    feature_id: f.id,
    ready: blockers.length === 0,
    undefined_count,
    unverified_count,
    contested_count,
    active_behaviors: active.length,
    blockers,
  };
}

function activeCases(b: Behavior) {
  return b.test_cases.filter((tc) => !tc.deprecated);
}

/**
 * The single worst thing about this feature, for a compact badge.
 *
 * Ordered by how far it is from buildable, not by count: one undecided claim
 * is a harder problem than twenty claims awaiting a signature, because the
 * second has an answer waiting for a human and the first does not.
 */
export function readinessHeadline(r: FeatureReadiness): {
  label: string;
  tone: "ready" | "undefined" | "contested" | "unverified" | "empty";
} {
  if (r.active_behaviors === 0) return { label: "empty", tone: "empty" };
  if (r.undefined_count > 0)
    return { label: `${r.undefined_count} undecided`, tone: "undefined" };
  if (r.contested_count > 0)
    return {
      label: r.blockers.some((x) => x.kind === "contradiction")
        ? "contradiction"
        : r.blockers.some((x) => x.kind === "ambiguous")
          ? "ambiguous"
          : `${r.contested_count} contested`,
      tone: "contested",
    };
  if (r.unverified_count > 0)
    // ⛔ One word for one state. This said "to verify" while the page said
    // "unverified" for the same thing, and a reader went hunting for the difference.
    return { label: `${r.unverified_count} to review`, tone: "unverified" };
  if (!r.ready) return { label: "no criteria", tone: "unverified" };
  return { label: "ready", tone: "ready" };
}

/**
 * How much of a set of containers a human has actually accepted.
 *
 * Counts behaviors, not files: per-file acceptance would bless fifteen claims with one
 * click, which is the thing validation exists to prevent.
 */
export function acceptanceCount(
  containers: Array<{ frontmatter: { id: string; behaviors: Behavior[] } }>,
  trackingFor: (id: string) => FeatureTracking | null
): { accepted: number; total: number } {
  let accepted = 0;
  let total = 0;
  for (const c of containers) {
    const tracking = trackingFor(c.frontmatter.id);
    for (const b of c.frontmatter.behaviors) {
      if (b.deprecated) continue;
      if (isUndefinedBehavior(b)) continue;
      total += 1;
      if (derivedVerification(b, tracking?.behaviors[b.id] ?? null).state === "verified") accepted += 1;
    }
  }
  return { accepted, total };
}
