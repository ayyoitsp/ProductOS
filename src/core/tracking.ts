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

/**
 * How much to trust a claim an agent proposed — and, required alongside it, why.
 *
 * ⛔ THE POINT IS REVIEW ORDER. Review burden is the category's central unsolved
 * problem: a reviewer facing forty undifferentiated claims rubber-stamps, and a
 * rubber-stamped corpus is worse than none. Confidence is what lets a reviewer
 * spend their attention where it changes an outcome — on the claims the agent
 * effectively guessed at.
 *
 * ⛔ CONFIDENCE WITHOUT A BASIS IS WORTHLESS, and an agent will always claim
 * `high` if allowed to. So anything above `low` must cite what it rests on, and
 * the audit refuses it otherwise. The basis is also the answer to "where did
 * this come from", which nothing else in the markdown path records.
 */
export const ClaimConfidence = z.enum([
  /**
   * A human said this, explicitly. A sentence in a document, a spoken
   * requirement, an answer to a direct question. The only tier a reviewer can
   * mostly skim, because a person already asserted it.
   */
  "stated",
  /**
   * Read directly off code the agent examined, and cited. Trustworthy about
   * what the product *does*; says nothing about whether it is what anyone
   * intended, which is exactly what the human is being asked.
   */
  "observed",
  /**
   * Inferred. Generalised from a pattern, assumed from convention, or filled in
   * because a feature "should" have it. No direct evidence.
   *
   * ⛔ This is the tier that exists to be honest about slop. A `guessed` claim
   * is not a defect — guessing is often the right move when scoping — but it
   * must be labelled so review starts here rather than ending here.
   */
  "guessed",
]);
export type ClaimConfidence = z.infer<typeof ClaimConfidence>;

/** What a claim rests on. Required for `stated` and `observed`. */
export const ClaimBasis = z.object({
  kind: z.enum(["human", "document", "code", "test", "conversation"]),
  /**
   * Where exactly. A file:line for code, a quoted sentence for a human, a
   * document plus section. Specific enough that a reviewer can check it without
   * asking the agent what it meant.
   */
  ref: z.string().min(3),
  /** Optional verbatim excerpt — the sentence or line that carried the claim. */
  quote: z.string().optional(),
});
export type ClaimBasis = z.infer<typeof ClaimBasis>;

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
  /**
   * How much to trust the claim, and why — set by whoever proposed it.
   *
   * Lives here rather than in the product truth file because it is a fact about
   * the *proposal*, not about the product. The claim reads the same whoever
   * wrote it; how much a reviewer should scrutinise it does not.
   *
   * Absent on a human-authored claim: a person writing their own product truth
   * is not estimating their own confidence.
   */
  confidence: ClaimConfidence.optional(),
  basis: z.array(ClaimBasis).default([]),
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

/**
 * ⛔ A malformed sidecar WARNS and returns null; it never throws.
 *
 * This threw, and the consequence was disproportionate: one stray unquoted colon
 * in one tracking file took down every caller that touched the corpus — the
 * renderer, the audit, gaps — with a raw YAML stack trace and no filename in the
 * message. Meanwhile `doctor` reported the corpus healthy, because it validated
 * product truth and never opened a sidecar.
 *
 * Product truth files already behave this way (`listFeatures` catches per file).
 * Tracking is operational metadata: losing one file's stamps should degrade that
 * feature, not the whole tool.
 */
export function readTracking(paths: ProductosPaths, featureId: string): FeatureTracking | null {
  const fp = trackingFilePath(paths, featureId);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = YAML.parse(fs.readFileSync(fp, "utf-8")) ?? {};
    return FeatureTracking.parse(raw);
  } catch (e) {
    process.stderr.write(
      `productos: ${path.relative(paths.repoRoot, fp)} failed to parse: ${(e as Error).message}\n`
    );
    return null;
  }
}

/** Every tracking sidecar on disk, with the unreadable ones named. */
export function listTrackingFiles(paths: ProductosPaths): string[] {
  const root = paths.trackingDir;
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fp);
      else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) out.push(fp);
    }
  };
  walk(root);
  return out.sort();
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
