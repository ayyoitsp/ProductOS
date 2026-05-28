import { z } from "zod";

/**
 * YAML parsers sometimes deserialize ISO-8601 strings as JS Date objects.
 * We want strings throughout, so any date-shaped field accepts either and
 * normalizes to an ISO string.
 */
function dateLike() {
  return z.union([z.string(), z.date()]).transform((v) =>
    v instanceof Date ? v.toISOString() : v
  );
}

export const ClaimType = z.enum([
  "api-behavior",
  "ui-flow",
  "data-invariant",
  "side-effect",
  "error-handling",
]);
export type ClaimType = z.infer<typeof ClaimType>;

export const TruthStatus = z.enum([
  "planned",
  "proposed",
  "validated",
  "stale",
  "rejected",
  "contested",
]);
export type TruthStatus = z.infer<typeof TruthStatus>;

export const TestFramework = z.enum([
  "jest",
  "vitest",
  "pytest",
  "playwright",
  "playwright-python",
]);
export type TestFramework = z.infer<typeof TestFramework>;

export const ProposedTest = z.object({
  framework: TestFramework,
  source: z.string(),
});
export type ProposedTest = z.infer<typeof ProposedTest>;

export const Fixture = z.object({
  type: z.string(),
  ref: z.string().optional(),
  fields: z.record(z.unknown()).optional(),
});
export type Fixture = z.infer<typeof Fixture>;

export const Scope = z.object({
  feature: z.string().optional(),
  area: z.string().optional(),
});
export type Scope = z.infer<typeof Scope>;

export const ContestedEvidence = z.object({
  source: z.string(),            // e.g. "zendesk:ticket-12345" or "sentry:issue-abc"
  url: z.string().optional(),
  summary: z.string(),
  observed_at: dateLike().optional(),
});
export type ContestedEvidence = z.infer<typeof ContestedEvidence>;

export const SyncRecord = z.record(
  z.object({
    external_id: z.string(),
    url: z.string().optional(),
    state: z.string().optional(),    // open | closed | etc.
    synced_at: dateLike(),
  })
);
export type SyncRecord = z.infer<typeof SyncRecord>;

export const TruthFrontmatter = z.object({
  id: z.string(),
  claim: z.string(),
  type: ClaimType,
  status: TruthStatus,
  scope: Scope.optional(),
  code_ref: z.array(z.string()).default([]),
  proposed_test: ProposedTest.optional(),
  fixtures: z.array(Fixture).default([]),
  proposed_by: z.string().optional(),
  proposed_at: dateLike().optional(),
  validated_by: z.string().optional(),
  validated_at: dateLike().optional(),
  owner: z.string().optional(),
  sync: SyncRecord.default({}),
  contested_by: z.array(ContestedEvidence).default([]),
  test_file: z.string().optional(),
  last_test_run: z
    .object({
      at: dateLike(),
      result: z.enum(["pass", "fail", "skip"]),
      detail: z.string().optional(),
    })
    .optional(),
});
export type TruthFrontmatter = z.infer<typeof TruthFrontmatter>;

export interface TruthDocument {
  frontmatter: TruthFrontmatter;
  body: string;
}

export const Trace = z.object({
  truth_id: z.string(),
  mode: z.enum(["api", "browser"]),
  target: z.string(),
  captured_at: dateLike(),
  result: z.enum(["pass", "fail"]),
  test: ProposedTest,
  request: z
    .object({
      method: z.string(),
      url: z.string(),
      headers: z.record(z.string()).optional(),
      body: z.unknown().optional(),
    })
    .optional(),
  response: z
    .object({
      status: z.number(),
      headers: z.record(z.string()).optional(),
      body: z.unknown().optional(),
      latency_ms: z.number().optional(),
    })
    .optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  failure_detail: z.string().optional(),
});
export type Trace = z.infer<typeof Trace>;
