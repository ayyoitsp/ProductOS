import { Behavior, TestCase } from "./product.js";
import { BehaviorTracking } from "./tracking.js";

/**
 * Per-Contract derived Verification state.
 *
 * Pure function over Truth (the behavior + its test cases) + Evidence
 * (the behavior's tracking sidecar: human acceptance log, drift events,
 * per-test-case last-run state). No side effects, no I/O.
 *
 * Five values, each pointing at a clear next action:
 *
 *   Unverified — no human has accepted; the analyzer's draft is awaiting vetting.
 *   Verified   — human accepted; passing test result received for at least one
 *                active case; no open drift events.
 *   Contested  — open negative signal (failing test, code-inconsistent drift,
 *                feedback, etc.). Stays until signal resolves.
 *   Orphan     — human accepted; no test result has ever been received AND no
 *                coverage_ref set on any active case. PM authored intent but
 *                no evidence backs it.
 *   Uncertain  — human accepted; some evidence signal is hedged (a code-
 *                consistency analysis returned "uncertain", a partial test-
 *                coverage signal, etc.). Not broken; needs clarification.
 *
 * In v0.1, "human accepted" is signaled by tracking.status being one of
 * {"verified", "contested", "stale"} — i.e. a transition was recorded by a
 * human. Status "proposed" means analyzer-generated but never accepted; status
 * "planned" means intent without code; status "deprecated" means retired.
 */

export type DerivedVerification =
  | "unverified"
  | "verified"
  | "contested"
  | "orphan"
  | "uncertain";

export interface DerivedVerificationDetail {
  state: DerivedVerification;
  /** Brief reason for the state — useful for badges/tooltips. */
  reason: string;
  /** Count of active drift events on this behavior. */
  open_drift: number;
  /** Count of active test cases that have ever received a test result. */
  cases_with_runs: number;
  /** Count of active test cases that have a `coverage_ref`. */
  cases_with_coverage_ref: number;
  /** Count of active test cases overall. */
  active_cases: number;
}

export function derivedVerification(
  behavior: Behavior,
  tracking: BehaviorTracking | null | undefined
): DerivedVerificationDetail {
  const activeCases = behavior.test_cases.filter((tc) => !tc.deprecated);
  const active_cases = activeCases.length;
  const cases_with_runs = activeCases.filter(
    (tc) => tracking?.test_case_runs?.[String(tc.id)] !== undefined
  ).length;
  const cases_with_coverage_ref = activeCases.filter(
    (tc) => coverageRefOf(tc) !== undefined
  ).length;

  const openDrifts = (tracking?.drift_events ?? []).filter((d) => !d.resolved_at);
  const open_drift = openDrifts.length;

  // Not human-accepted yet → Unverified.
  // "proposed" = analyzer draft never accepted; "planned" = intent only.
  const status = tracking?.status ?? "proposed";
  const humanAccepted = status === "verified" || status === "contested" || status === "stale";

  if (behavior.deprecated || status === "deprecated") {
    // Deprecated behaviors have no Verification state in the conceptual model;
    // we mirror that by reporting "unverified" with a clear reason. Callers
    // should treat deprecated behaviors as outside the rollup.
    return {
      state: "unverified",
      reason: "behavior is deprecated — not part of current Truth",
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  if (status === "planned") {
    return {
      state: "unverified",
      reason: "planned — no code yet",
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  if (!humanAccepted) {
    return {
      state: "unverified",
      reason: "no human has accepted this Contract yet",
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  // Human accepted. Now look at signals.

  if (openDrifts.length > 0) {
    const kinds = Array.from(new Set(openDrifts.map((d) => d.kind))).join(", ");
    return {
      state: "contested",
      reason: `open drift: ${kinds}`,
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  // No open drift. Was there ever a test result, or a coverage_ref?
  if (active_cases > 0 && cases_with_runs === 0 && cases_with_coverage_ref === 0) {
    return {
      state: "orphan",
      reason: "human accepted but no test result has ever been received and no coverage_ref set",
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  // Some active cases have neither runs nor coverage_ref — partial coverage = Uncertain.
  if (
    active_cases > 0 &&
    cases_with_runs + cases_with_coverage_ref < active_cases &&
    cases_with_runs > 0
  ) {
    return {
      state: "uncertain",
      reason: `partial coverage: ${cases_with_runs}/${active_cases} cases have runs, ${cases_with_coverage_ref}/${active_cases} have coverage_ref`,
      open_drift,
      cases_with_runs,
      cases_with_coverage_ref,
      active_cases,
    };
  }

  return {
    state: "verified",
    reason: "human accepted, evidence present, no open drift",
    open_drift,
    cases_with_runs,
    cases_with_coverage_ref,
    active_cases,
  };
}

// Test cases can carry an optional `coverage_ref` (a file path or file:line)
// indicating an existing test that covers them. v0.1 hasn't landed the schema
// field yet; this helper reads it via index access so it lights up the moment
// align ships.
function coverageRefOf(tc: TestCase): string | undefined {
  const ref = (tc as unknown as { coverage_ref?: string }).coverage_ref;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
}
