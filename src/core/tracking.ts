import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Tracking sidecar for a feature: productos/tracking/<area>/<feature>.yaml.
 * Holds the operational metadata that doesn't belong in product truth:
 *   - which code files implement the feature
 *   - which code lines back each behavior
 *   - verification status / who / when
 *   - history of state transitions
 *
 * A feature's product truth (productos/products/<area>/<feature>.md) and
 * its tracking sidecar are linked by feature_id and behavior id. The
 * product truth file can exist without a tracking file (it just means
 * no operational metadata has been recorded yet).
 */

export const BehaviorStatus = z.enum([
  "planned",       // intended, code not there yet
  "proposed",      // code exists, claim recorded, awaiting human verification
  "verified",      // human confirmed claim holds against the implementation
  "stale",         // code referenced changed since last verification
  "contested",     // a piece of feedback or evidence disagrees with the claim
  "deprecated",    // explicitly retired
]);
export type BehaviorStatus = z.infer<typeof BehaviorStatus>;

function dateLike() {
  return z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v
  );
}

export const HistoryEntry = z.object({
  at: dateLike(),
  by: z.string(),
  action: z.enum(["proposed", "verified", "contested", "stale", "edited", "deprecated"]),
  note: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const TestRunStatus = z.enum(["pass", "fail", "skip", "error"]);
export type TestRunStatus = z.infer<typeof TestRunStatus>;

export const TestCaseRun = z.object({
  status: TestRunStatus,
  last_run_at: dateLike(),
  last_run_message: z.string().optional(),
  last_run_id: z.string().optional(),
  last_run_source: z.string().optional(),
});
export type TestCaseRun = z.infer<typeof TestCaseRun>;

export const DriftKind = z.enum([
  "test_failed",
  "code_change",
  "code_inconsistent",
  "test_uncovered",
  "conflict",
  "expired",
  "feedback",
]);
export type DriftKind = z.infer<typeof DriftKind>;

export const DriftEvent = z.object({
  kind: DriftKind,
  opened_at: dateLike(),
  resolved_at: dateLike().optional(),
  resolved_reason: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});
export type DriftEvent = z.infer<typeof DriftEvent>;

export const BehaviorTracking = z.object({
  code_refs: z.array(z.string()).default([]),
  status: BehaviorStatus.default("proposed"),
  last_verified: dateLike().optional(),
  verified_by: z.string().optional(),
  history: z.array(HistoryEntry).default([]),
  /** Per-test-case last-run state, keyed by string-form test_case_id ("1", "2", ...). */
  test_case_runs: z.record(z.string(), TestCaseRun).default({}),
  /** Append-only drift events for this behavior. Open events have no `resolved_at`. */
  drift_events: z.array(DriftEvent).default([]),
});
export type BehaviorTracking = z.infer<typeof BehaviorTracking>;

export const FeatureTracking = z.object({
  feature_id: z.string(),
  implements: z.array(z.string()).default([]),
  behaviors: z.record(BehaviorTracking).default({}),
});
export type FeatureTracking = z.infer<typeof FeatureTracking>;

// ---------------------------------------------------------------------------
// Paths

export function trackingRoot(paths: ProductosPaths): string {
  return path.join(paths.root, "tracking");
}

export function trackingFilePath(paths: ProductosPaths, featureId: string): string {
  return path.join(trackingRoot(paths), `${featureId}.yaml`);
}

// ---------------------------------------------------------------------------
// Read / Write

export function readTracking(paths: ProductosPaths, featureId: string): FeatureTracking | null {
  const fp = trackingFilePath(paths, featureId);
  if (!fs.existsSync(fp)) return null;
  const raw = YAML.parse(fs.readFileSync(fp, "utf-8")) ?? {};
  return FeatureTracking.parse(raw);
}

export function writeTracking(paths: ProductosPaths, tracking: FeatureTracking): string {
  const fp = trackingFilePath(paths, tracking.feature_id);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, YAML.stringify(tracking, { lineWidth: 0 }), "utf-8");
  return fp;
}

export function emptyTrackingFor(featureId: string): FeatureTracking {
  return FeatureTracking.parse({ feature_id: featureId });
}

export function trackingForBehavior(
  tracking: FeatureTracking | null,
  behaviorId: string
): BehaviorTracking | null {
  return tracking?.behaviors[behaviorId] ?? null;
}

/** Append a history entry and update status atomically. */
export function recordTransition(
  tracking: FeatureTracking,
  behaviorId: string,
  action: HistoryEntry["action"],
  by: string,
  opts: { status?: BehaviorStatus; note?: string; setVerified?: boolean } = {}
): void {
  const now = new Date().toISOString();
  const cur = tracking.behaviors[behaviorId] ?? BehaviorTracking.parse({});
  if (opts.status) cur.status = opts.status;
  if (opts.setVerified) {
    cur.last_verified = now;
    cur.verified_by = by;
  }
  cur.history.push({ at: now, by, action, note: opts.note });
  tracking.behaviors[behaviorId] = cur;
}

/** List all tracking files. */
export function listTracking(paths: ProductosPaths): FeatureTracking[] {
  const root = trackingRoot(paths);
  if (!fs.existsSync(root)) return [];
  const out: FeatureTracking[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const fp = path.join(dir, entry);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) walk(fp);
      else if (fp.endsWith(".yaml")) {
        try {
          const raw = YAML.parse(fs.readFileSync(fp, "utf-8")) ?? {};
          out.push(FeatureTracking.parse(raw));
        } catch (e) {
          process.stderr.write(`productos: ${path.relative(paths.repoRoot, fp)} failed to parse: ${(e as Error).message}\n`);
        }
      }
    }
  };
  walk(root);
  return out;
}
