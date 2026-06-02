import { z } from "zod";
import { ProductosPaths } from "./paths.js";
import { readFeatureById } from "./product.js";
import {
  BehaviorTracking,
  DriftEvent,
  FeatureTracking,
  TestRunStatus,
  emptyTrackingFor,
  readTracking,
  writeTracking,
} from "./tracking.js";

/**
 * Receive-only test result interface.
 *
 * ProductOS does not run tests, does not parse framework output. It accepts
 * a batch of {stable_id, status, timestamp} tuples (with optional message /
 * run_id / source) and updates per-test-case state + opens or resolves
 * test_failed drift events.
 *
 * Stable id format: `<area>/<feature>#<behavior>/<test_case_id>`
 *   e.g. `auth/signup#duplicate-email/1`
 *
 * Behavior:
 *   - Unmapped stable_ids (no matching feature/behavior/test_case in markdown):
 *     dropped silently. Counted as `ignored.unmapped`.
 *   - Deprecated test cases or behaviors: status recorded in test_case_runs
 *     for forensics, but NO drift event opens. Counted as `ignored.deprecated`.
 *   - Active cases: status recorded, drift events opened on fail/error,
 *     resolved on subsequent pass.
 *
 * Same payload shape is accepted via MCP tool, CLI shim, and HTTP endpoint.
 */

export const TestResultInput = z.object({
  stable_id: z.string(),
  status: TestRunStatus,
  timestamp: z.string().optional(),
  message: z.string().optional(),
  run_id: z.string().optional(),
  source: z.string().optional(),
});
export type TestResultInput = z.infer<typeof TestResultInput>;

export const RecordTestResultsInput = z.object({
  results: z.array(TestResultInput).min(1),
  default_source: z.string().optional(),
});
export type RecordTestResultsInput = z.infer<typeof RecordTestResultsInput>;

export interface RecordedDelta {
  feature_id: string;
  behavior_id: string;
  test_case_id: number;
  status: TestRunStatus;
  deprecated: boolean;
  drift_opened: boolean;
  drift_resolved: boolean;
}

export interface RecordTestResultsSummary {
  total: number;
  recorded: number;
  ignored: {
    unmapped: number;
    invalid_stable_id: number;
    feature_missing: number;
    behavior_missing: number;
    test_case_missing: number;
  };
  deprecated: number;
  drift_opened: number;
  drift_resolved: number;
  deltas: RecordedDelta[];
}

const STABLE_ID_RE = /^([a-z0-9][a-z0-9/_-]*)#([a-z0-9][a-z0-9-]*)\/(\d+)$/;

export function parseStableId(
  stableId: string
): { feature_id: string; behavior_id: string; test_case_id: number } | null {
  const m = stableId.match(STABLE_ID_RE);
  if (!m) return null;
  const feature_id = m[1]!;
  if (!feature_id.includes("/")) return null;
  return {
    feature_id,
    behavior_id: m[2]!,
    test_case_id: parseInt(m[3]!, 10),
  };
}

export function recordTestResults(
  paths: ProductosPaths,
  input: RecordTestResultsInput
): RecordTestResultsSummary {
  const summary: RecordTestResultsSummary = {
    total: input.results.length,
    recorded: 0,
    ignored: {
      unmapped: 0,
      invalid_stable_id: 0,
      feature_missing: 0,
      behavior_missing: 0,
      test_case_missing: 0,
    },
    deprecated: 0,
    drift_opened: 0,
    drift_resolved: 0,
    deltas: [],
  };

  // Group results by feature to minimize tracking-file reads/writes.
  const byFeature = new Map<string, TestResultInput[]>();
  const parsed = new Map<string, ReturnType<typeof parseStableId>>();
  for (const r of input.results) {
    const id = parseStableId(r.stable_id);
    parsed.set(r.stable_id, id);
    if (!id) {
      summary.ignored.invalid_stable_id += 1;
      summary.ignored.unmapped += 1;
      continue;
    }
    const arr = byFeature.get(id.feature_id) ?? [];
    arr.push(r);
    byFeature.set(id.feature_id, arr);
  }

  for (const [featureId, results] of byFeature) {
    const feature = readFeatureById(paths, featureId);
    if (!feature) {
      summary.ignored.feature_missing += results.length;
      summary.ignored.unmapped += results.length;
      continue;
    }
    const behaviorsById = new Map(
      feature.frontmatter.behaviors.map((b) => [b.id, b])
    );

    const tracking: FeatureTracking =
      readTracking(paths, featureId) ?? emptyTrackingFor(featureId);

    let trackingDirty = false;

    for (const r of results) {
      const id = parsed.get(r.stable_id)!;
      const behavior = behaviorsById.get(id.behavior_id);
      if (!behavior) {
        summary.ignored.behavior_missing += 1;
        summary.ignored.unmapped += 1;
        continue;
      }
      const testCase = behavior.test_cases.find(
        (tc) => tc.id === id.test_case_id
      );
      if (!testCase) {
        summary.ignored.test_case_missing += 1;
        summary.ignored.unmapped += 1;
        continue;
      }

      const isDeprecated =
        behavior.deprecated === true || testCase.deprecated === true;

      const bt: BehaviorTracking =
        tracking.behaviors[id.behavior_id] ??
        BehaviorTracking.parse({});

      const now = r.timestamp ?? new Date().toISOString();
      bt.test_case_runs[String(id.test_case_id)] = {
        status: r.status,
        last_run_at: now,
        last_run_message: r.message,
        last_run_id: r.run_id,
        last_run_source: r.source ?? input.default_source,
      };

      let driftOpened = false;
      let driftResolved = false;

      if (!isDeprecated) {
        // Active path: open/resolve test_failed drift for THIS test_case.
        const isFailure = r.status === "fail" || r.status === "error";
        const isPass = r.status === "pass";

        if (isFailure) {
          const existingOpen = bt.drift_events.find(
            (d) =>
              d.kind === "test_failed" &&
              !d.resolved_at &&
              d.context?.test_case_id === id.test_case_id
          );
          if (!existingOpen) {
            const ev: DriftEvent = {
              kind: "test_failed",
              opened_at: now,
              context: {
                test_case_id: id.test_case_id,
                stable_id: r.stable_id,
                message: r.message,
                run_id: r.run_id,
                source: r.source ?? input.default_source,
              },
            };
            bt.drift_events.push(ev);
            driftOpened = true;
            summary.drift_opened += 1;
          }
        } else if (isPass) {
          for (const ev of bt.drift_events) {
            if (
              ev.kind === "test_failed" &&
              !ev.resolved_at &&
              ev.context?.test_case_id === id.test_case_id
            ) {
              ev.resolved_at = now;
              ev.resolved_reason = "test_pass";
              driftResolved = true;
              summary.drift_resolved += 1;
            }
          }
        }
      } else {
        summary.deprecated += 1;
      }

      tracking.behaviors[id.behavior_id] = bt;
      trackingDirty = true;
      summary.recorded += 1;
      summary.deltas.push({
        feature_id: id.feature_id,
        behavior_id: id.behavior_id,
        test_case_id: id.test_case_id,
        status: r.status,
        deprecated: isDeprecated,
        drift_opened: driftOpened,
        drift_resolved: driftResolved,
      });
    }

    if (trackingDirty) {
      writeTracking(paths, tracking);
    }
  }

  return summary;
}
