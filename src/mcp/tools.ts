import { z } from "zod";
import { ProductosPaths } from "../core/paths.js";
import {
  Behavior,
  FeatureFrontmatter,
  FeatureStatus,
  listAreas,
  listFeatures,
  nowIso,
  readFeatureById,
  writeFeature,
} from "../core/product.js";
import {
  BehaviorStatus,
  emptyTrackingFor,
  readTracking,
  recordTransition,
  writeTracking,
} from "../core/tracking.js";
import {
  FeedbackEntry,
  FeedbackFrontmatter,
  listFeedback,
  newFeedbackId,
  readFeedbackById,
  writeFeedback,
} from "../core/feedback.js";
import { readEnvConfig, resolveEnv } from "../core/env.js";
import { readConfig } from "../core/config.js";
import {
  getStrategy,
  listContext,
  readContext,
  writeContext,
} from "../core/context.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, paths: ProductosPaths) => Promise<unknown>;
}

// ===========================================================================
// CONTEXT (the overarching layer above features — goals, principles, personas)
// ===========================================================================
//
// READ THIS BEFORE TOUCHING PRODUCT TRUTH. Context constrains every feature
// decision below it. When proposing features, surface relevant principles in
// the notes. When feedback would violate a principle, flag for human review
// instead of silently applying.

const listContextTool: McpTool = {
  name: "productos_list_context",
  description:
    "List all overarching context documents (goals, principles, personas, non-goals, voice, etc.) under productos/context/. ALWAYS call this before proposing or updating features — context constrains every feature decision below it. Returns name, title, and order for each document.",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const docs = listContext(paths);
    return {
      count: docs.length,
      docs: docs.map((d) => ({ name: d.name, title: d.title, order: d.order })),
    };
  },
};

const GetContextInput = z.object({
  name: z.string().describe("Document name (filename without .md), e.g. 'principles' or 'goals'"),
});

const getContextTool: McpTool = {
  name: "productos_get_context",
  description:
    "Read one overarching context document by name (e.g. 'principles', 'goals'). Returns the full markdown body plus title/order. Use this when you need to deeply consult a specific category before proposing a feature in that area.",
  inputSchema: zodToInputSchema(GetContextInput),
  handler: async (raw, paths) => {
    const args = GetContextInput.parse(raw);
    const doc = readContext(paths, args.name);
    if (!doc) throw new Error(`Context document "${args.name}" not found`);
    return { name: doc.name, title: doc.title, order: doc.order, body: doc.body };
  },
};

const getStrategyTool: McpTool = {
  name: "productos_get_strategy",
  description:
    "Convenience: returns all context documents (goals + principles + personas + non-goals + voice + whatever else exists) concatenated as one markdown blob. Use when you want the full overarching context loaded for a single LLM turn — typically before a multi-feature proposal pass, or when checking whether a piece of feedback respects existing principles.",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const body = getStrategy(paths);
    return { body, has_content: body.length > 0 };
  },
};

const ProposeContextInput = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Use kebab-case, e.g. 'principles' or 'non-goals'"),
  title: z.string().optional(),
  order: z.number().optional(),
  body: z.string().min(20, "Body should be more than a sentence — context is the durable upstream layer, take a moment"),
});

const proposeContext: McpTool = {
  name: "productos_propose_context",
  description:
    "Create or replace a context document. Use sparingly — context evolves slowly and edits should be human-reviewed. Use kebab-case for `name` (e.g. 'principles', 'non-goals'). Body is markdown; structure with `## headings` so individual items become anchorable.",
  inputSchema: zodToInputSchema(ProposeContextInput),
  handler: async (raw, paths) => {
    const args = ProposeContextInput.parse(raw);
    writeContext(paths, args);
    return { ok: true, name: args.name };
  },
};

// ===========================================================================
// PRODUCT TRUTH (the markdown — what the product does, implementation-neutral)
// ===========================================================================

const ListFeaturesInput = z.object({
  area: z.string().optional(),
  status: FeatureStatus.optional(),
});

const listFeaturesTool: McpTool = {
  name: "productos_list_features",
  description:
    "List features in product truth. Returns id, title, status, behavior count. Optionally filter by area or status.",
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
        behavior_count: f.frontmatter.behaviors.length,
      })),
    };
  },
};

const listAreasTool: McpTool = {
  name: "productos_list_areas",
  description: "List product areas (top-level groupings under productos/products/).",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const areas = listAreas(paths);
    return { count: areas.length, areas: areas.map((a) => ({ slug: a.slug, title: a.title, feature_count: a.features.length })) };
  },
};

const GetFeatureInput = z.object({
  id: z.string().describe("Feature id like 'auth/signup'"),
  include_tracking: z.boolean().default(true).describe("Include the tracking sidecar (code refs, verification status, history)"),
});

const getFeatureTool: McpTool = {
  name: "productos_get_feature",
  description:
    "Fetch a single feature's product truth (claims, description, prose body) and optionally its tracking sidecar (code refs, behavior verification status, history). Read this before proposing edits.",
  inputSchema: zodToInputSchema(GetFeatureInput),
  handler: async (raw, paths) => {
    const args = GetFeatureInput.parse(raw);
    const f = readFeatureById(paths, args.id);
    if (!f) throw new Error(`Feature "${args.id}" not found`);
    return {
      id: f.frontmatter.id,
      title: f.frontmatter.title,
      status: f.frontmatter.status,
      description: f.frontmatter.description,
      behaviors: f.frontmatter.behaviors,
      body: f.body,
      tracking: args.include_tracking ? readTracking(paths, args.id) : undefined,
    };
  },
};

const ProposeFeatureInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9/_-]*\/[a-z0-9][a-z0-9_-]*$/, "Must be area/slug, e.g. 'auth/signup'"),
  title: z.string().min(1),
  status: FeatureStatus.default("shipped"),
  description: z.string().optional(),
  behaviors: z.array(Behavior).default([]),
  body: z.string().default(""),
});

const proposeFeature: McpTool = {
  name: "productos_propose_feature",
  description:
    "Create or replace a feature's PRODUCT TRUTH file (claims, description, prose). To add code refs / implementation paths / verification status, use productos_update_tracking — those don't belong in product truth. Claims should be written in product language (what the user does, what the user sees), not in API/file/endpoint terms.",
  inputSchema: zodToInputSchema(ProposeFeatureInput),
  handler: async (raw, paths) => {
    const args = ProposeFeatureInput.parse(raw);
    const fm = FeatureFrontmatter.parse({
      id: args.id,
      title: args.title,
      status: args.status,
      description: args.description,
      behaviors: args.behaviors,
    });
    writeFeature(paths, { frontmatter: fm, body: args.body, filepath: "", url_path: "/" + args.id });
    return { ok: true, id: args.id };
  },
};

const UpdateFeatureInput = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: FeatureStatus.optional(),
  description: z.string().optional(),
  body: z.string().optional(),
});

const updateFeature: McpTool = {
  name: "productos_update_feature",
  description:
    "Update metadata or body of an existing feature without touching behaviors. To modify behaviors use add_behavior / update_behavior / remove_behavior.",
  inputSchema: zodToInputSchema(UpdateFeatureInput),
  handler: async (raw, paths) => {
    const args = UpdateFeatureInput.parse(raw);
    const doc = readFeatureById(paths, args.id);
    if (!doc) throw new Error(`Feature "${args.id}" not found`);
    if (args.title !== undefined) doc.frontmatter.title = args.title;
    if (args.status !== undefined) doc.frontmatter.status = args.status;
    if (args.description !== undefined) doc.frontmatter.description = args.description;
    if (args.body !== undefined) doc.body = args.body;
    writeFeature(paths, doc);
    return { ok: true, id: args.id };
  },
};

const AddBehaviorInput = z.object({
  feature_id: z.string(),
  behavior: Behavior,
});

const addBehavior: McpTool = {
  name: "productos_add_behavior",
  description:
    "Add a behavior (an atomic claim) to a feature. Behaviors live in product truth and are written in product language. Verification status and code refs are tracked separately — use productos_update_tracking to set them after adding the behavior.",
  inputSchema: zodToInputSchema(AddBehaviorInput),
  handler: async (raw, paths) => {
    const args = AddBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    if (doc.frontmatter.behaviors.some((b) => b.id === args.behavior.id))
      throw new Error(`Behavior "${args.behavior.id}" already exists on ${args.feature_id}`);
    doc.frontmatter.behaviors.push(args.behavior);
    writeFeature(paths, doc);
    return { ok: true, feature_id: args.feature_id, behavior_id: args.behavior.id };
  },
};

const UpdateBehaviorInput = z.object({
  feature_id: z.string(),
  behavior_id: z.string(),
  claim: z.string().optional(),
  notes: z.string().optional(),
});

const updateBehavior: McpTool = {
  name: "productos_update_behavior",
  description:
    "Update a behavior's claim or notes. To update verification status or code refs, use productos_update_tracking — that data lives in the sidecar, not product truth.",
  inputSchema: zodToInputSchema(UpdateBehaviorInput),
  handler: async (raw, paths) => {
    const args = UpdateBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    const b = doc.frontmatter.behaviors.find((bb) => bb.id === args.behavior_id);
    if (!b) throw new Error(`Behavior "${args.behavior_id}" not found on ${args.feature_id}`);
    if (args.claim !== undefined) b.claim = args.claim;
    if (args.notes !== undefined) b.notes = args.notes;
    writeFeature(paths, doc);
    return { ok: true };
  },
};

const RemoveBehaviorInput = z.object({
  feature_id: z.string(),
  behavior_id: z.string(),
});

const removeBehavior: McpTool = {
  name: "productos_remove_behavior",
  description: "Remove a behavior from a feature's product truth. Tracking sidecar entry (if any) is also removed.",
  inputSchema: zodToInputSchema(RemoveBehaviorInput),
  handler: async (raw, paths) => {
    const args = RemoveBehaviorInput.parse(raw);
    const doc = readFeatureById(paths, args.feature_id);
    if (!doc) throw new Error(`Feature "${args.feature_id}" not found`);
    const before = doc.frontmatter.behaviors.length;
    doc.frontmatter.behaviors = doc.frontmatter.behaviors.filter((b) => b.id !== args.behavior_id);
    if (doc.frontmatter.behaviors.length === before) throw new Error(`Behavior "${args.behavior_id}" not found`);
    writeFeature(paths, doc);
    const tracking = readTracking(paths, args.feature_id);
    if (tracking?.behaviors[args.behavior_id]) {
      delete tracking.behaviors[args.behavior_id];
      writeTracking(paths, tracking);
    }
    return { ok: true };
  },
};

// ===========================================================================
// TRACKING (the sidecar — implementation refs, verification status, history)
// ===========================================================================

const GetTrackingInput = z.object({ feature_id: z.string() });

const getTracking: McpTool = {
  name: "productos_get_tracking",
  description: "Get the tracking sidecar for a feature: implementation paths, per-behavior code refs, verification status, and history. Returns null if no tracking file exists yet.",
  inputSchema: zodToInputSchema(GetTrackingInput),
  handler: async (raw, paths) => {
    const args = GetTrackingInput.parse(raw);
    return readTracking(paths, args.feature_id);
  },
};

const UpdateTrackingInput = z.object({
  feature_id: z.string(),
  implements: z.array(z.string()).optional().describe("Replace the feature's implementation paths"),
  behavior_id: z.string().optional(),
  code_refs: z.array(z.string()).optional().describe("Replace the behavior's code_refs"),
  status: BehaviorStatus.optional(),
  note: z.string().optional().describe("Optional note recorded in history alongside the transition"),
  by: z.string().default("ai-runtime"),
});

const updateTracking: McpTool = {
  name: "productos_update_tracking",
  description:
    "Update the tracking sidecar. Use this for implementation refs and verification state — these are NOT in product truth. Set `implements` to update the feature's code paths. Set `behavior_id` plus code_refs/status to update one behavior's tracking. Status transitions are recorded in the behavior's history. Use 'verified' only when a human explicitly confirms; agents proposing claims should use 'proposed' or leave status alone.",
  inputSchema: zodToInputSchema(UpdateTrackingInput),
  handler: async (raw, paths) => {
    const args = UpdateTrackingInput.parse(raw);
    const t = readTracking(paths, args.feature_id) ?? emptyTrackingFor(args.feature_id);
    if (args.implements !== undefined) t.implements = args.implements;
    if (args.behavior_id) {
      const cur = t.behaviors[args.behavior_id] ?? { code_refs: [], status: "proposed" as const, history: [] };
      if (args.code_refs !== undefined) cur.code_refs = args.code_refs;
      t.behaviors[args.behavior_id] = cur;
      if (args.status) {
        recordTransition(t, args.behavior_id, args.status as never, args.by, {
          status: args.status,
          note: args.note,
          setVerified: args.status === "verified",
        });
      }
    }
    writeTracking(paths, t);
    return { ok: true };
  },
};

// ===========================================================================
// FEEDBACK QUEUE (where human / external feedback lands; Claude processes it)
// ===========================================================================

const ListFeedbackInput = z.object({
  state: z.enum(["open", "claimed", "processed"]).optional(),
  feature: z.string().optional(),
});

const listFeedbackTool: McpTool = {
  name: "productos_list_feedback",
  description:
    "List feedback queue entries. Each entry is a markdown file in productos/feedback/ — a human or external source flagged something about a feature or behavior in natural language. Filter to state='open' to find what needs processing.",
  inputSchema: zodToInputSchema(ListFeedbackInput),
  handler: async (raw, paths) => {
    const args = ListFeedbackInput.parse(raw);
    const entries = listFeedback(paths, args);
    return { count: entries.length, entries: entries.map((e) => ({ ...e.frontmatter, body: e.body })) };
  },
};

const ClaimFeedbackInput = z.object({
  id: z.string(),
  by: z.string().default("ai-runtime"),
});

const claimFeedback: McpTool = {
  name: "productos_claim_feedback",
  description: "Mark a feedback entry as 'claimed' — you are taking responsibility for processing it. Then interpret the body, propose appropriate edits (update_behavior, add_behavior, update_tracking, etc.), and call mark_processed when done.",
  inputSchema: zodToInputSchema(ClaimFeedbackInput),
  handler: async (raw, paths) => {
    const args = ClaimFeedbackInput.parse(raw);
    const e = readFeedbackById(paths, args.id);
    if (!e) throw new Error(`Feedback "${args.id}" not found`);
    e.frontmatter.state = "claimed";
    e.frontmatter.resolved_by = args.by;
    writeFeedback(paths, e);
    return { ok: true };
  },
};

const MarkProcessedInput = z.object({
  id: z.string(),
  by: z.string().default("ai-runtime"),
  resolution_note: z.string().optional(),
});

const markProcessed: McpTool = {
  name: "productos_mark_feedback_processed",
  description: "Mark a feedback entry as 'processed' — you've made the edits the feedback warranted (or decided no edit is needed and noted why). The entry stays as audit; use resolution_note to describe what was done.",
  inputSchema: zodToInputSchema(MarkProcessedInput),
  handler: async (raw, paths) => {
    const args = MarkProcessedInput.parse(raw);
    const e = readFeedbackById(paths, args.id);
    if (!e) throw new Error(`Feedback "${args.id}" not found`);
    e.frontmatter.state = "processed";
    e.frontmatter.resolved_at = nowIso();
    e.frontmatter.resolved_by = args.by;
    if (args.resolution_note) {
      e.body = (e.body + "\n\n---\n**Resolution:** " + args.resolution_note).trim();
    }
    writeFeedback(paths, e);
    return { ok: true };
  },
};

const SubmitFeedbackInput = z.object({
  target_feature: z.string().optional(),
  target_behavior: z.string().optional(),
  body: z.string().min(1),
  by: z.string().default("ai-runtime"),
  source: z.string().default("mcp"),
});

const submitFeedback: McpTool = {
  name: "productos_submit_feedback",
  description: "Add a feedback entry to the queue. Useful for relaying external feedback (customer support, observability alert, code-review comment) into ProductOS so it can be processed alongside human-submitted feedback.",
  inputSchema: zodToInputSchema(SubmitFeedbackInput),
  handler: async (raw, paths) => {
    const args = SubmitFeedbackInput.parse(raw);
    const target = { feature: args.target_feature, behavior: args.target_behavior };
    const id = newFeedbackId(target);
    const fm = FeedbackFrontmatter.parse({
      id,
      created_at: nowIso(),
      created_by: args.by,
      source: args.source,
      target,
      state: "open",
    });
    const entry: FeedbackEntry = { frontmatter: fm, body: args.body, filepath: "" };
    writeFeedback(paths, entry);
    return { ok: true, id };
  },
};

// ===========================================================================
// ENV + GAPS (unchanged + adapted)
// ===========================================================================

const GetEnvInput = z.object({ name: z.string().optional() });

const getEnv: McpTool = {
  name: "productos_get_env",
  description: "Get a dev-environment configuration from productos/env.yaml. Pass `name` for a specific env; omit it for the default.",
  inputSchema: zodToInputSchema(GetEnvInput),
  handler: async (raw, paths) => {
    const args = GetEnvInput.parse(raw);
    const config = readEnvConfig(paths);
    const projectConfig = readConfig(paths);
    if (!config) return { configured: false, stack: projectConfig.stack };
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

const getGaps: McpTool = {
  name: "productos_get_gaps",
  description: "Find gaps in product truth + tracking: behaviors awaiting verification, stale, contested; features marked planned with no implementation; open feedback entries.",
  inputSchema: zodToInputSchema(z.object({})),
  handler: async (_raw, paths) => {
    const features = listFeatures(paths);
    const gaps: Array<{ kind: string; feature_id: string; behavior_id?: string; detail?: string }> = [];
    for (const f of features) {
      const fm = f.frontmatter;
      const tracking = readTracking(paths, fm.id);
      if (fm.status === "planned" && !tracking?.implements?.length) {
        gaps.push({ kind: "planned-no-impl", feature_id: fm.id });
      }
      if (fm.behaviors.length === 0) {
        gaps.push({ kind: "no-behaviors", feature_id: fm.id });
      }
      for (const b of fm.behaviors) {
        const t = tracking?.behaviors[b.id];
        if (!t || t.status === "proposed") {
          gaps.push({ kind: "awaiting-verification", feature_id: fm.id, behavior_id: b.id });
        }
        if (t?.status === "stale") gaps.push({ kind: "stale", feature_id: fm.id, behavior_id: b.id });
        if (t?.status === "contested") gaps.push({ kind: "contested", feature_id: fm.id, behavior_id: b.id });
      }
    }
    const openFeedback = listFeedback(paths, { state: "open" });
    for (const e of openFeedback) {
      gaps.push({ kind: "open-feedback", feature_id: e.frontmatter.target.feature ?? "—", behavior_id: e.frontmatter.target.behavior, detail: e.body.slice(0, 100) });
    }
    return { count: gaps.length, gaps };
  },
};

// ===========================================================================
// Registry

export const tools: McpTool[] = [
  // context (overarching — read first)
  listContextTool,
  getContextTool,
  getStrategyTool,
  proposeContext,
  // product truth
  listAreasTool,
  listFeaturesTool,
  getFeatureTool,
  proposeFeature,
  updateFeature,
  addBehavior,
  updateBehavior,
  removeBehavior,
  // tracking
  getTracking,
  updateTracking,
  // feedback queue
  listFeedbackTool,
  submitFeedback,
  claimFeedback,
  markProcessed,
  // env + gaps
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
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodEffects) {
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
  if (inner instanceof z.ZodRecord) return { type: "object", additionalProperties: zodFieldToJsonSchema(inner.valueSchema) };
  if (inner instanceof z.ZodUnion) return { oneOf: inner.options.map((o: z.ZodTypeAny) => zodFieldToJsonSchema(o)) };
  if (inner instanceof z.ZodUnknown) return {};
  return {};
}
