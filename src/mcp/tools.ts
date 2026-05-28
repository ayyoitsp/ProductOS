import { z } from "zod";
import { ProductosPaths } from "../core/paths.js";
import {
  ClaimType,
  Fixture,
  ProposedTest,
  Scope,
  TruthFrontmatter,
  TruthStatus,
} from "../core/types.js";
import {
  listTruth,
  nowIso,
  readTruth,
  writeTruth,
} from "../core/truth.js";
import { nextTruthId } from "../core/ids.js";
import { readEnvConfig, resolveEnv } from "../core/env.js";
import { readConfig } from "../core/config.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, paths: ProductosPaths) => Promise<unknown>;
}

// -- propose_truth ----------------------------------------------------------

const ProposeTruthInput = z.object({
  claim: z.string().min(20, "Claim must be at least 20 characters — make it specific"),
  type: ClaimType,
  code_ref: z
    .array(z.string())
    .min(1, "code_ref must cite at least one file (the falsifiability gate)"),
  proposed_test: ProposedTest,
  fixtures: z.array(Fixture).default([]),
  scope: Scope.optional(),
  proposed_by: z.string().default("ai-runtime"),
});

const proposeTruth: McpTool = {
  name: "productos_propose_truth",
  description:
    "Propose a Product Truth claim about existing code, paired with the executable test that verifies it. Each proposal MUST cite the code refs (file:lines) it was derived from. Sets status='proposed' — never set status=validated; only humans validate via the vet UI.",
  inputSchema: zodToInputSchema(ProposeTruthInput),
  handler: async (raw, paths) => {
    const args = ProposeTruthInput.parse(raw);
    const id = nextTruthId(paths);
    const fm = TruthFrontmatter.parse({
      id,
      claim: args.claim,
      type: args.type,
      status: "proposed",
      scope: args.scope,
      code_ref: args.code_ref,
      proposed_test: args.proposed_test,
      fixtures: args.fixtures,
      proposed_by: args.proposed_by,
      proposed_at: nowIso(),
      sync: {},
      contested_by: [],
    });
    writeTruth(paths, { frontmatter: fm, body: "" });
    return {
      ok: true,
      id,
      next_step:
        "Truth queued. Tell the user to open the vet UI to live-validate.",
    };
  },
};

// -- propose_planned_truth --------------------------------------------------

const ProposePlannedTruthInput = z.object({
  claim: z.string().min(20),
  type: ClaimType,
  proposed_test: ProposedTest,
  fixtures: z.array(Fixture).default([]),
  scope: Scope,
  proposed_by: z.string().default("ai-runtime"),
  notes: z.string().optional(),
});

const proposePlannedTruth: McpTool = {
  name: "productos_propose_planned_truth",
  description:
    "Propose a planned Product Truth claim for a feature being designed but not yet implemented. Sets status='planned' with no code_ref (will be populated when code lands and productos truth refresh runs). Use when the user is decomposing a feature description into intended behavior.",
  inputSchema: zodToInputSchema(ProposePlannedTruthInput),
  handler: async (raw, paths) => {
    const args = ProposePlannedTruthInput.parse(raw);
    const id = nextTruthId(paths);
    const fm = TruthFrontmatter.parse({
      id,
      claim: args.claim,
      type: args.type,
      status: "planned",
      scope: args.scope,
      code_ref: [],
      proposed_test: args.proposed_test,
      fixtures: args.fixtures,
      proposed_by: args.proposed_by,
      proposed_at: nowIso(),
      sync: {},
      contested_by: [],
    });
    writeTruth(paths, {
      frontmatter: fm,
      body: args.notes ? args.notes.trim() : "",
    });
    return { ok: true, id, status: "planned" };
  },
};

// -- propose_contested_truth ------------------------------------------------

const ContestedEvidence = z.object({
  source: z.string(),
  url: z.string().optional(),
  summary: z.string(),
  observed_at: z.string().optional(),
});

const ProposeContestedTruthInput = z.object({
  truth_id: z.string().regex(/^T-\d+$/),
  evidence: ContestedEvidence,
});

const proposeContestedTruth: McpTool = {
  name: "productos_propose_contested_truth",
  description:
    "Flag an existing validated Truth as contested by external evidence (customer report, support ticket, observability alert). Sets status='contested' and appends the evidence to contested_by. Use after reading from the user's support/observability MCP and finding feedback that contradicts a validated claim.",
  inputSchema: zodToInputSchema(ProposeContestedTruthInput),
  handler: async (raw, paths) => {
    const args = ProposeContestedTruthInput.parse(raw);
    const doc = readTruth(paths, args.truth_id);
    if (!doc) throw new Error(`truth ${args.truth_id} not found`);
    doc.frontmatter.status = "contested";
    doc.frontmatter.contested_by = [
      ...doc.frontmatter.contested_by,
      args.evidence,
    ];
    writeTruth(paths, doc);
    return { ok: true, id: args.truth_id, status: "contested" };
  },
};

// -- list_truth -------------------------------------------------------------

const ListTruthInput = z.object({
  status: TruthStatus.optional(),
  feature: z.string().optional(),
});

const listTruthTool: McpTool = {
  name: "productos_list_truth",
  description:
    "List Product Truth claims, optionally filtered by status (planned, proposed, validated, stale, rejected, contested) or by feature.",
  inputSchema: zodToInputSchema(ListTruthInput),
  handler: async (raw, paths) => {
    const args = ListTruthInput.parse(raw);
    const docs = listTruth(paths, args);
    return {
      count: docs.length,
      truth: docs.map((d) => ({
        id: d.frontmatter.id,
        claim: d.frontmatter.claim,
        type: d.frontmatter.type,
        status: d.frontmatter.status,
        scope: d.frontmatter.scope,
        code_ref: d.frontmatter.code_ref,
      })),
    };
  },
};

// -- get_truth --------------------------------------------------------------

const GetTruthInput = z.object({ id: z.string().regex(/^T-\d+$/) });

const getTruth: McpTool = {
  name: "productos_get_truth",
  description: "Fetch a single Truth claim by ID including its proposed_test and full frontmatter.",
  inputSchema: zodToInputSchema(GetTruthInput),
  handler: async (raw, paths) => {
    const args = GetTruthInput.parse(raw);
    const doc = readTruth(paths, args.id);
    if (!doc) throw new Error(`truth ${args.id} not found`);
    return doc;
  },
};

// -- record_outcome ---------------------------------------------------------

const RecordOutcomeInput = z.object({
  truth_id: z.string().regex(/^T-\d+$/),
  result: z.enum(["pass", "fail", "skip"]),
  detail: z.string().optional(),
  captured_output: z
    .string()
    .optional()
    .describe("Truncated stdout/stderr from the test run; helps debug failures"),
  test_file: z
    .string()
    .optional()
    .describe("Path to the test file Claude actually ran (e.g. productos/tests/proposed/T-XXXX.test.ts)"),
});

const recordOutcome: McpTool = {
  name: "productos_record_outcome",
  description:
    "Record the outcome of validating a Truth claim. Call this AFTER you (Claude) ran the proposed test against the live env. Updates last_test_run on the Truth frontmatter; a fail on a validated Truth bumps status to 'contested'. Include captured_output so failures are debuggable from the vet UI.",
  inputSchema: zodToInputSchema(RecordOutcomeInput),
  handler: async (raw, paths) => {
    const args = RecordOutcomeInput.parse(raw);
    const doc = readTruth(paths, args.truth_id);
    if (!doc) throw new Error(`truth ${args.truth_id} not found`);
    doc.frontmatter.last_test_run = {
      at: nowIso(),
      result: args.result,
      detail:
        [args.detail, args.captured_output ? `--- output ---\n${args.captured_output}` : null]
          .filter(Boolean)
          .join("\n\n") || undefined,
    };
    if (args.test_file) {
      doc.frontmatter.test_file = args.test_file;
    }
    if (args.result === "fail" && doc.frontmatter.status === "validated") {
      doc.frontmatter.status = "contested";
    }
    writeTruth(paths, doc);
    return { ok: true, id: args.truth_id, status: doc.frontmatter.status };
  },
};

// -- get_env ----------------------------------------------------------------

const GetEnvInput = z.object({
  name: z
    .string()
    .optional()
    .describe("Optional env name (e.g. 'local', 'staging'). Omit to get the default env."),
});

const getEnv: McpTool = {
  name: "productos_get_env",
  description:
    "Get a dev-environment configuration from productos/env.yaml. Pass `name` for a specific env (e.g. 'staging'); omit it to get the default env. Returns the env's setup commands, healthcheck details, reset commands, test_env vars, and external/read_only flags. ALSO returns the list of all configured envs and which is default. To actually drive the env, shell out to `productos env <name> <action>` (up | check | reset | down). Respect read_only — never run reset or teardown against a read_only env.",
  inputSchema: zodToInputSchema(GetEnvInput),
  handler: async (raw, paths) => {
    const args = GetEnvInput.parse(raw);
    const config = readEnvConfig(paths);
    const projectConfig = readConfig(paths);
    if (!config) {
      return {
        configured: false,
        message:
          "No productos/env.yaml — ask the user to run `productos init claude` first, then edit env.yaml for their stack.",
        stack: projectConfig.stack,
      };
    }
    const { name, env } = resolveEnv(config, args.name);
    return {
      configured: true,
      env_name: name,
      env,
      default_env: config.default_env,
      all_envs: Object.keys(config.envs),
      staging_dir: config.staging_dir,
      stack: projectConfig.stack,
      cli_helpers: {
        list: "productos env list",
        up: `productos env ${name} up`,
        check: `productos env ${name} check`,
        reset: env.read_only ? null : `productos env ${name} reset`,
        down: env.read_only ? null : `productos env ${name} down`,
      },
    };
  },
};

// -- record_sync ------------------------------------------------------------

const RecordSyncInput = z.object({
  truth_id: z.string().regex(/^T-\d+$/),
  provider: z.string(),
  external_id: z.string(),
  url: z.string().optional(),
  state: z.string().optional(),
});

const recordSync: McpTool = {
  name: "productos_record_sync",
  description:
    "Record that a Truth has been synced to an external ticketing system (Linear, Jira, GitHub Issues, etc.). The runtime is responsible for the actual sync via its own ecosystem MCPs; this tool just records the resulting mapping into the Truth's frontmatter so it travels with the claim across branches.",
  inputSchema: zodToInputSchema(RecordSyncInput),
  handler: async (raw, paths) => {
    const args = RecordSyncInput.parse(raw);
    const doc = readTruth(paths, args.truth_id);
    if (!doc) throw new Error(`truth ${args.truth_id} not found`);
    doc.frontmatter.sync = {
      ...doc.frontmatter.sync,
      [args.provider]: {
        external_id: args.external_id,
        url: args.url,
        state: args.state,
        synced_at: nowIso(),
      },
    };
    writeTruth(paths, doc);
    return { ok: true, id: args.truth_id, provider: args.provider };
  },
};

// -- get_coverage_gaps ------------------------------------------------------

const GetCoverageGapsInput = z.object({
  scope: z.string().optional(),
});

const getCoverageGaps: McpTool = {
  name: "productos_get_coverage_gaps",
  description:
    "Return internal coverage gaps: Truth without tests, Truth with failing tests, stale Truth (code changed since last validation). These are engineering-task gaps — outbound candidates for ticketing.",
  inputSchema: zodToInputSchema(GetCoverageGapsInput),
  handler: async (_raw, paths) => {
    const docs = listTruth(paths);
    const gaps: Array<{
      kind: string;
      truth_id: string;
      claim: string;
      detail?: string;
    }> = [];
    for (const d of docs) {
      const f = d.frontmatter;
      if (f.status === "stale") {
        gaps.push({
          kind: "staleness",
          truth_id: f.id,
          claim: f.claim,
          detail: "Code referenced by this Truth has changed since validation",
        });
      }
      if (f.status === "contested") {
        gaps.push({
          kind: "contested",
          truth_id: f.id,
          claim: f.claim,
          detail:
            f.contested_by.length > 0
              ? `Contested by: ${f.contested_by.map((c) => c.summary).join("; ")}`
              : "Marked contested",
        });
      }
      if (f.status === "validated" && !f.test_file) {
        gaps.push({
          kind: "no_test",
          truth_id: f.id,
          claim: f.claim,
          detail: "Validated but no materialized test (run `productos test generate`)",
        });
      }
      if (f.last_test_run?.result === "fail") {
        gaps.push({
          kind: "failing_test",
          truth_id: f.id,
          claim: f.claim,
          detail: f.last_test_run.detail,
        });
      }
    }
    return { count: gaps.length, gaps };
  },
};

// -- get_product_gaps -------------------------------------------------------

const GetProductGapsInput = z.object({});

const getProductGaps: McpTool = {
  name: "productos_get_product_gaps",
  description:
    "Return product-level gaps: contested Truth (validated claims that external feedback contradicts). Inbound from the user's support/observability MCPs. Typically translates to product decisions, not engineering tickets.",
  inputSchema: zodToInputSchema(GetProductGapsInput),
  handler: async (_raw, paths) => {
    const docs = listTruth(paths, { status: "contested" });
    return {
      count: docs.length,
      gaps: docs.map((d) => ({
        truth_id: d.frontmatter.id,
        claim: d.frontmatter.claim,
        evidence: d.frontmatter.contested_by,
      })),
    };
  },
};

// -- registry ---------------------------------------------------------------

export const tools: McpTool[] = [
  proposeTruth,
  proposePlannedTruth,
  proposeContestedTruth,
  listTruthTool,
  getTruth,
  recordOutcome,
  recordSync,
  getEnv,
  getCoverageGaps,
  getProductGaps,
];

// -- helpers ----------------------------------------------------------------

/**
 * Render a zod schema as a JSON-Schema-ish object for the MCP tool definition.
 * We do this by hand rather than pulling in `zod-to-json-schema` so we keep
 * deps light. Covers the shapes we actually use.
 */
function zodToInputSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, def] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(def);
    if (!def.isOptional()) required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

function zodFieldToJsonSchema(def: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap optional/default/effects to get the inner type.
  let inner: z.ZodTypeAny = def;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodDefault ||
    inner instanceof z.ZodEffects
  ) {
    if (inner instanceof z.ZodEffects) inner = inner.innerType();
    else inner = inner._def.innerType;
  }
  if (inner instanceof z.ZodString) return { type: "string", description: (def as { description?: string }).description };
  if (inner instanceof z.ZodNumber) return { type: "number" };
  if (inner instanceof z.ZodBoolean) return { type: "boolean" };
  if (inner instanceof z.ZodEnum)
    return { type: "string", enum: inner.options };
  if (inner instanceof z.ZodArray)
    return { type: "array", items: zodFieldToJsonSchema(inner.element) };
  if (inner instanceof z.ZodObject) {
    const props: Record<string, unknown> = {};
    const req: string[] = [];
    for (const [k, v] of Object.entries(inner.shape)) {
      const field = v as z.ZodTypeAny;
      props[k] = zodFieldToJsonSchema(field);
      if (!field.isOptional()) req.push(k);
    }
    return { type: "object", properties: props, required: req };
  }
  if (inner instanceof z.ZodRecord) {
    return { type: "object", additionalProperties: zodFieldToJsonSchema(inner.valueSchema) };
  }
  if (inner instanceof z.ZodUnknown) return {};
  return {};
}
