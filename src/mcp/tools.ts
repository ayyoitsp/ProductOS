import { z } from "zod";
import { ProductosPaths } from "../core/paths.js";
import {
  Behavior,
  BehaviorStatus,
  Evidence,
  EvidenceKind,
  FeatureFrontmatter,
  FeatureStatus,
  listAreas,
  listFeatures,
  nowIso,
  readFeatureById,
  writeFeature,
} from "../core/product.js";
import { readEnvConfig, resolveEnv } from "../core/env.js";
import { readConfig } from "../core/config.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, paths: ProductosPaths) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Reading product truth

const ListFeaturesInput = z.object({
  area: z.string().optional(),
  status: FeatureStatus.optional(),
});

const listFeaturesTool: McpTool = {
  name: "productos_list_features",
  description:
    "List all features in product truth, optionally filtered by area (e.g. 'auth') or status. Use this when you need to know what features exist before proposing or updating. Returns id, title, status, area, behavior count.",
  inputSchema: zodToInputSchema(ListFeaturesInput),
  handler: async (raw, paths) => {
    const args = ListFeaturesInput.parse(raw);
    let features = listFeatures(paths);
    if (args.area) features = features.filter((f) => f.frontmatter.id.startsWith(args.area + "/"));
    if (args.status) features = features.filter((f) => f.frontmatter.status === args.status);
    return {
      count: features.length,
      features: features.map((f) => ({
        id: f.frontmatter.id,
        title: f.frontmatter.title,
        status: f.frontmatter.status,
        owners: f.frontmatter.owners,
        behavior_count: f.frontmatter.behaviors.length,
      })),
    };
  },
};

const listAreasTool: McpTool = {
  name: "productos_list_areas",
  description:
    "List all product areas (top-level groupings of features in productos/products/). Each area corresponds to a directory and a README.md describing the area's overall purpose.",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const areas = listAreas(paths);
    return {
      count: areas.length,
      areas: areas.map((a) => ({ slug: a.slug, title: a.title, feature_count: a.features.length })),
    };
  },
};

const GetFeatureInput = z.object({
  id: z.string().describe("Feature id like 'auth/signup' — the slash-delimited path under productos/products/"),
});

const getFeatureTool: McpTool = {
  name: "productos_get_feature",
  description:
    "Fetch a single feature including all its behaviors, owners, code refs, related features, and narrative body. Use this to consult product truth before proposing changes, or to read the current state of a feature before updating it.",
  inputSchema: zodToInputSchema(GetFeatureInput),
  handler: async (raw, paths) => {
    const args = GetFeatureInput.parse(raw);
    const f = readFeatureById(paths, args.id);
    if (!f) throw new Error(`Feature "${args.id}" not found in productos/products/`);
    return {
      id: f.frontmatter.id,
      title: f.frontmatter.title,
      status: f.frontmatter.status,
      owners: f.frontmatter.owners,
      implements: f.frontmatter.implements,
      related: f.frontmatter.related,
      behaviors: f.frontmatter.behaviors,
      body: f.body,
    };
  },
};

// ---------------------------------------------------------------------------
// Writing product truth

const ProposeFeatureInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9/_-]*\/[a-z0-9][a-z0-9_-]*$/, "Must be area/slug, e.g. 'auth/signup'"),
  title: z.string().min(1),
  status: FeatureStatus.default("shipped"),
  owners: z.array(z.string()).default([]),
  implements: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  behaviors: z.array(Behavior).default([]),
  body: z.string().default(""),
  proposed_by: z.string().default("ai-runtime"),
});

const proposeFeature: McpTool = {
  name: "productos_propose_feature",
  description:
    "Create or replace a feature in product truth. For NEW features (no existing file), use this. For UPDATES to an existing feature, prefer `productos_update_feature` (preserves existing body content) or `productos_add_behavior` (just adds one behavior). For planned features (no code yet), set status='planned' and leave `implements: []`.",
  inputSchema: zodToInputSchema(ProposeFeatureInput),
  handler: async (raw, paths) => {
    const args = ProposeFeatureInput.parse(raw);
    const fm = FeatureFrontmatter.parse({
      id: args.id,
      title: args.title,
      status: args.status,
      owners: args.owners,
      implements: args.implements,
      related: args.related,
      behaviors: args.behaviors,
      proposed_by: args.proposed_by,
      proposed_at: nowIso(),
    });
    writeFeature(paths, { frontmatter: fm, body: args.body, filepath: "", url_path: "/" + args.id });
    return { ok: true, id: args.id, url: `/` + args.id, path: `productos/products/${args.id}.md` };
  },
};

const UpdateFeatureInput = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: FeatureStatus.optional(),
  owners: z.array(z.string()).optional(),
  implements: z.array(z.string()).optional(),
  related: z.array(z.string()).optional(),
  body: z.string().optional(),
});

const updateFeature: McpTool = {
  name: "productos_update_feature",
  description:
    "Update metadata or body of an existing feature without touching behaviors. To modify behaviors, use `productos_add_behavior`, `productos_update_behavior`, or `productos_remove_behavior`. Any field you omit is left unchanged.",
  inputSchema: zodToInputSchema(UpdateFeatureInput),
  handler: async (raw, paths) => {
    const args = UpdateFeatureInput.parse(raw);
    const doc = readFeatureById(paths, args.id);
    if (!doc) throw new Error(`Feature "${args.id}" not found`);
    if (args.title !== undefined) doc.frontmatter.title = args.title;
    if (args.status !== undefined) doc.frontmatter.status = args.status;
    if (args.owners !== undefined) doc.frontmatter.owners = args.owners;
    if (args.implements !== undefined) doc.frontmatter.implements = args.implements;
    if (args.related !== undefined) doc.frontmatter.related = args.related;
    if (args.body !== undefined) doc.body = args.body;
    writeFeature(paths, doc);
    return { ok: true, id: args.id };
  },
};

// ---------------------------------------------------------------------------
// Behaviors

const AddBehaviorInput = z.object({
  feature_id: z.string(),
  behavior: Behavior,
});

const addBehavior: McpTool = {
  name: "productos_add_behavior",
  description:
    "Add a new behavior to an existing feature. Behaviors are atomic claims about what the feature DOES — each has a kebab-case id (unique within the feature), a claim sentence, a status (planned/proposed/verified/etc.), and a list of evidence. Use status='proposed' when you've identified the claim from code but haven't verified it; 'verified' only after the human approves (or after a configured policy auto-verifies).",
  inputSchema: zodToInputSchema(AddBehaviorInput),
  handler: async (raw, paths) => {
    const args = AddBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    if (doc.frontmatter.behaviors.some((b) => b.id === args.behavior.id)) {
      throw new Error(`Behavior "${args.behavior.id}" already exists on ${args.feature_id}. Use update_behavior to modify.`);
    }
    doc.frontmatter.behaviors.push(args.behavior);
    writeFeature(paths, doc);
    return { ok: true, feature_id: args.feature_id, behavior_id: args.behavior.id };
  },
};

const UpdateBehaviorInput = z.object({
  feature_id: z.string(),
  behavior_id: z.string(),
  claim: z.string().optional(),
  status: BehaviorStatus.optional(),
  last_verified: z.string().optional(),
  verified_by: z.string().optional(),
  notes: z.string().optional(),
});

const updateBehavior: McpTool = {
  name: "productos_update_behavior",
  description:
    "Update an existing behavior's claim, status, notes, or verification timestamp. Use this to mark behaviors as verified after the human approves, or to flag them stale when code referenced changes. To add evidence, use `productos_attach_evidence`. To replace evidence wholesale, set the behavior anew with `productos_remove_behavior` + `productos_add_behavior`.",
  inputSchema: zodToInputSchema(UpdateBehaviorInput),
  handler: async (raw, paths) => {
    const args = UpdateBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    const b = doc.frontmatter.behaviors.find((bb) => bb.id === args.behavior_id);
    if (!b) throw new Error(`Behavior "${args.behavior_id}" not found on ${args.feature_id}`);
    if (args.claim !== undefined) b.claim = args.claim;
    if (args.status !== undefined) b.status = args.status;
    if (args.last_verified !== undefined) b.last_verified = args.last_verified;
    if (args.verified_by !== undefined) b.verified_by = args.verified_by;
    if (args.notes !== undefined) b.notes = args.notes;
    writeFeature(paths, doc);
    return { ok: true, feature_id: args.feature_id, behavior_id: args.behavior_id, status: b.status };
  },
};

const RemoveBehaviorInput = z.object({
  feature_id: z.string(),
  behavior_id: z.string(),
});

const removeBehavior: McpTool = {
  name: "productos_remove_behavior",
  description: "Remove a behavior from a feature. Prefer setting status='deprecated' when retiring a behavior whose history matters; remove only when the claim was wrong or never shipped.",
  inputSchema: zodToInputSchema(RemoveBehaviorInput),
  handler: async (raw, paths) => {
    const args = RemoveBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    const before = doc.frontmatter.behaviors.length;
    doc.frontmatter.behaviors = doc.frontmatter.behaviors.filter((b) => b.id !== args.behavior_id);
    if (doc.frontmatter.behaviors.length === before)
      throw new Error(`Behavior "${args.behavior_id}" not found on ${args.feature_id}`);
    writeFeature(paths, doc);
    return { ok: true };
  },
};

const AttachEvidenceInput = z.object({
  feature_id: z.string(),
  behavior_id: z.string(),
  evidence: Evidence,
});

const attachEvidence: McpTool = {
  name: "productos_attach_evidence",
  description:
    "Attach one piece of evidence (code reference, screenshot path, narrative observation, response capture, etc.) to a specific behavior. Evidence is what lets the human review the behavior and decide ✓ verified vs ✗ contested. Different claim shapes want different evidence: API behaviors → response captures; UI behaviors → screenshots or trace paths; data invariants → query + result; side effects → log/event captures; everything benefits from a code ref so reviewers can navigate to source.",
  inputSchema: zodToInputSchema(AttachEvidenceInput),
  handler: async (raw, paths) => {
    const args = AttachEvidenceInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    const b = doc.frontmatter.behaviors.find((bb) => bb.id === args.behavior_id);
    if (!b) throw new Error(`Behavior "${args.behavior_id}" not found on ${args.feature_id}`);
    b.evidence.push({ ...args.evidence, captured_at: args.evidence.captured_at ?? nowIso() });
    writeFeature(paths, doc);
    return { ok: true, evidence_count: b.evidence.length };
  },
};

// ---------------------------------------------------------------------------
// Env (unchanged)

const GetEnvInput = z.object({
  name: z.string().optional(),
});

const getEnv: McpTool = {
  name: "productos_get_env",
  description:
    "Get a dev-environment configuration from productos/env.yaml. Pass `name` for a specific env (e.g. 'staging'); omit it to get the default env. Returns setup commands, healthcheck details, reset commands, test_env vars, external/read_only flags, and CLI helper strings. To actually drive the env, shell out to `productos env <name> <action>` (up | check | reset | down). Respect read_only — never run reset or teardown against a read_only env.",
  inputSchema: zodToInputSchema(GetEnvInput),
  handler: async (raw, paths) => {
    const args = GetEnvInput.parse(raw);
    const config = readEnvConfig(paths);
    const projectConfig = readConfig(paths);
    if (!config) {
      return {
        configured: false,
        message: "No productos/env.yaml — ask the user to run `productos init claude` first.",
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

// ---------------------------------------------------------------------------
// Gaps (derived; read-only)

const getGaps: McpTool = {
  name: "productos_get_gaps",
  description:
    "Return gaps in product truth: features marked 'planned' but with no implements path; behaviors with status 'proposed' (awaiting human verification); behaviors with status 'stale' or 'contested'; features with no behaviors at all. Use this to find what needs attention.",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const features = listFeatures(paths);
    const gaps: Array<{ kind: string; feature_id: string; behavior_id?: string; detail?: string }> = [];
    for (const f of features) {
      const fm = f.frontmatter;
      if (fm.status === "planned" && fm.implements.length === 0) {
        gaps.push({ kind: "planned_no_implementation", feature_id: fm.id, detail: "Planned feature with no code path linked yet" });
      }
      if (fm.behaviors.length === 0) {
        gaps.push({ kind: "no_behaviors", feature_id: fm.id, detail: "Feature has no behaviors documented" });
      }
      for (const b of fm.behaviors) {
        if (b.status === "proposed") {
          gaps.push({ kind: "awaiting_verification", feature_id: fm.id, behavior_id: b.id, detail: "Proposed; awaiting human verification" });
        }
        if (b.status === "stale") {
          gaps.push({ kind: "stale", feature_id: fm.id, behavior_id: b.id, detail: "Code referenced changed since last verification" });
        }
        if (b.status === "contested") {
          gaps.push({ kind: "contested", feature_id: fm.id, behavior_id: b.id, detail: b.notes });
        }
        if (b.status === "verified" && b.evidence.length === 0) {
          gaps.push({ kind: "verified_no_evidence", feature_id: fm.id, behavior_id: b.id, detail: "Verified but no evidence attached" });
        }
      }
    }
    return { count: gaps.length, gaps };
  },
};

// ---------------------------------------------------------------------------
// Registry

export const tools: McpTool[] = [
  listAreasTool,
  listFeaturesTool,
  getFeatureTool,
  proposeFeature,
  updateFeature,
  addBehavior,
  updateBehavior,
  removeBehavior,
  attachEvidence,
  getEnv,
  getGaps,
];

// ---------------------------------------------------------------------------
// Helpers

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
  let inner: z.ZodTypeAny = def;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodDefault ||
    inner instanceof z.ZodEffects
  ) {
    if (inner instanceof z.ZodEffects) inner = inner.innerType();
    else inner = inner._def.innerType;
  }
  if (inner instanceof z.ZodString) {
    const s: Record<string, unknown> = { type: "string" };
    if (def.description) s.description = def.description;
    return s;
  }
  if (inner instanceof z.ZodNumber) return { type: "number" };
  if (inner instanceof z.ZodBoolean) return { type: "boolean" };
  if (inner instanceof z.ZodEnum) return { type: "string", enum: inner.options };
  if (inner instanceof z.ZodArray) return { type: "array", items: zodFieldToJsonSchema(inner.element) };
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
  if (inner instanceof z.ZodUnion) {
    return { oneOf: inner.options.map((o: z.ZodTypeAny) => zodFieldToJsonSchema(o)) };
  }
  if (inner instanceof z.ZodUnknown) return {};
  return {};
}
