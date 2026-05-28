import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import YAML from "yaml";
import { ProductosPaths } from "../core/paths.js";
import { ByokConfig } from "../core/config.js";
import { FeedbackEntry } from "../core/feedback.js";
import { readFeatureById, writeFeature, Behavior } from "../core/product.js";
import {
  BehaviorStatus,
  emptyTrackingFor,
  readTracking,
  recordTransition,
  writeTracking,
} from "../core/tracking.js";

/**
 * Result of trying to auto-process a feedback entry with BYOK.
 *
 * - applied: true if the LLM applied at least one edit and nothing else
 *   blocked. The caller marks the queue entry processed.
 * - needs_human_review: the LLM explicitly punted (ambiguous / risky /
 *   needs more context). The caller leaves the entry as claimed with the
 *   reason in the body for a human (or Claude in a later session) to
 *   pick up.
 * - error: the LLM call itself failed (missing key, rate limit, etc.).
 *   The caller leaves the entry open and logs the error.
 */
export type ProcessResult =
  | { kind: "applied"; summary: string; ops: string[] }
  | { kind: "needs_review"; reason: string; ops: string[] }
  | { kind: "error"; message: string };

const SYSTEM_PROMPT = `You are auto-processing a feedback note about a codebase's Product Truth.

Product Truth is a tree of markdown files describing what the product DOES, in product language (what the user does / what the user sees) — not in API/file terms. Each feature has structured "behaviors" (atomic claims). Implementation details (file paths, code refs, verification status) live in a separate tracking sidecar.

A human just submitted feedback targeting a feature or (optionally) a specific behavior. You have a small set of tools that can edit product truth or tracking.

Your job:
1. Read the feedback body and the current state of the target.
2. If the feedback maps cleanly to ONE specific edit (or two closely-related ones), call the appropriate tool(s).
3. If the feedback is ambiguous, conflicts with existing verified claims, asks for a major rewrite, or would require information you don't have, call request_human_review with a one-sentence reason. Do NOT guess.

Rules:
- Claims in product truth are written in product language. Don't introduce API/endpoint/file references into a claim — those go in tracking.
- You CANNOT mark anything verified. Verification is a human action only.
- You CANNOT add fictitious code refs. Only use file paths the feedback itself names.
- You CAN flip a behavior's tracking status to "contested" when the feedback contradicts a previously-verified claim.
- Apply at most 3 tool calls per feedback entry. If you'd need more, request human review.

Be concise. Trust the human's framing of the feedback.`;

export async function processFeedback(
  entry: FeedbackEntry,
  paths: ProductosPaths,
  byok: ByokConfig
): Promise<ProcessResult> {
  const apiKey = process.env[byok.api_key_env];
  if (!apiKey) {
    return {
      kind: "error",
      message: `API key env var ${byok.api_key_env} is empty or unset`,
    };
  }

  let model: LanguageModel;
  try {
    model = pickModel(byok, apiKey);
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }

  const targetCtx = buildTargetContext(entry, paths);
  const userPrompt = buildUserPrompt(entry, targetCtx);

  let reviewReason: string | undefined;
  const ops: string[] = [];

  const tools = {
    update_behavior: tool({
      description:
        "Reword a behavior's claim text or notes. Use when feedback is asking for a wording change to an existing behavior on an existing feature.",
      inputSchema: z.object({
        feature_id: z.string(),
        behavior_id: z.string(),
        claim: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (args: { feature_id: string; behavior_id: string; claim?: string; notes?: string }) => {
        const doc = readFeatureById(paths, args.feature_id);
        if (!doc) return { ok: false, error: "feature not found" };
        const b = doc.frontmatter.behaviors.find((bb) => bb.id === args.behavior_id);
        if (!b) return { ok: false, error: "behavior not found on feature" };
        if (args.claim !== undefined) b.claim = args.claim;
        if (args.notes !== undefined) b.notes = args.notes;
        writeFeature(paths, doc);
        ops.push(`update_behavior(${args.feature_id}#${args.behavior_id})`);
        return { ok: true };
      },
    }),
    add_behavior: tool({
      description:
        "Add a new behavior to an existing feature. The claim must be in product language (what the user does / sees), not in API/file terms.",
      inputSchema: z.object({
        feature_id: z.string(),
        behavior: z.object({
          id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
          claim: z.string().min(10),
          notes: z.string().optional(),
        }),
      }),
      execute: async (args: { feature_id: string; behavior: { id: string; claim: string; notes?: string } }) => {
        const doc = readFeatureById(paths, args.feature_id);
        if (!doc) return { ok: false, error: "feature not found" };
        if (doc.frontmatter.behaviors.some((b) => b.id === args.behavior.id))
          return { ok: false, error: "behavior id already exists" };
        const parsed = Behavior.parse(args.behavior);
        doc.frontmatter.behaviors.push(parsed);
        writeFeature(paths, doc);
        ops.push(`add_behavior(${args.feature_id}#${args.behavior.id})`);
        return { ok: true };
      },
    }),
    update_tracking: tool({
      description:
        "Update the tracking sidecar for a feature. Use to set or change code_refs for a behavior, or to flip a behavior's status to 'contested' when the feedback says an existing claim is wrong. NEVER set status to 'verified'.",
      inputSchema: z.object({
        feature_id: z.string(),
        implements_paths: z.array(z.string()).optional(),
        behavior_id: z.string().optional(),
        code_refs: z.array(z.string()).optional(),
        status: z.enum(["planned", "proposed", "stale", "contested", "deprecated"]).optional(),
        note: z.string().optional(),
      }),
      execute: async (args: {
        feature_id: string;
        implements_paths?: string[];
        behavior_id?: string;
        code_refs?: string[];
        status?: "planned" | "proposed" | "stale" | "contested" | "deprecated";
        note?: string;
      }) => {
        const t = readTracking(paths, args.feature_id) ?? emptyTrackingFor(args.feature_id);
        if (args.implements_paths !== undefined) t.implements = args.implements_paths;
        if (args.behavior_id) {
          const cur = t.behaviors[args.behavior_id] ?? { code_refs: [], status: "proposed" as const, history: [] };
          if (args.code_refs !== undefined) cur.code_refs = args.code_refs;
          t.behaviors[args.behavior_id] = cur;
          if (args.status) {
            recordTransition(t, args.behavior_id, args.status as never, "byok", {
              status: args.status as BehaviorStatus,
              note: args.note,
            });
          }
        }
        writeTracking(paths, t);
        ops.push(
          `update_tracking(${args.feature_id}${args.behavior_id ? "#" + args.behavior_id : ""})`
        );
        return { ok: true };
      },
    }),
    request_human_review: tool({
      description:
        "Call this instead of applying an edit when the feedback is ambiguous, would require information you don't have, or would change a previously-verified claim in a way you're not confident about. Give a one-sentence reason a human can act on.",
      inputSchema: z.object({ reason: z.string().min(5) }),
      execute: async (args: { reason: string }) => {
        reviewReason = args.reason;
        return { acknowledged: true };
      },
    }),
  };

  try {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools,
      stopWhen: stepCountIs(byok.max_steps),
    });

    if (reviewReason) {
      return { kind: "needs_review", reason: reviewReason, ops };
    }
    if (ops.length === 0) {
      return {
        kind: "needs_review",
        reason:
          result.text?.trim().slice(0, 240) ||
          "Model returned no tool calls and no narrative; falling back to human review",
        ops,
      };
    }
    return {
      kind: "applied",
      summary: result.text?.trim().slice(0, 240) || ops.join(", "),
      ops,
    };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

function pickModel(byok: ByokConfig, apiKey: string): LanguageModel {
  switch (byok.provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(byok.model);
    case "openai":
      return createOpenAI({ apiKey })(byok.model);
    case "google":
      throw new Error(
        "google provider not yet wired — install @ai-sdk/google and extend src/byok/processor.ts"
      );
    case "openrouter":
      // OpenRouter is OpenAI-compatible; point at its base URL.
      return createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(byok.model);
  }
}

interface TargetContext {
  feature?: ReturnType<typeof readFeatureById>;
  tracking?: ReturnType<typeof readTracking>;
}

function buildTargetContext(entry: FeedbackEntry, paths: ProductosPaths): TargetContext {
  const featureId = entry.frontmatter.target.feature;
  if (!featureId) return {};
  return {
    feature: readFeatureById(paths, featureId),
    tracking: readTracking(paths, featureId),
  };
}

function buildUserPrompt(entry: FeedbackEntry, ctx: TargetContext): string {
  const parts: string[] = [];
  parts.push(`# Feedback entry ${entry.frontmatter.id}`);
  parts.push(
    `Submitted by **${entry.frontmatter.created_by}** via **${entry.frontmatter.source}** at ${entry.frontmatter.created_at}.`
  );
  if (entry.frontmatter.target.feature) {
    parts.push(
      `Target: feature \`${entry.frontmatter.target.feature}\`${entry.frontmatter.target.behavior ? `, behavior \`${entry.frontmatter.target.behavior}\`` : ""}.`
    );
  } else {
    parts.push("Target: none specified.");
  }
  parts.push("");
  parts.push("## Feedback body");
  parts.push(entry.body);
  parts.push("");

  if (ctx.feature) {
    parts.push("## Current product truth for the target feature");
    parts.push("```yaml");
    parts.push(YAML.stringify(ctx.feature.frontmatter, { lineWidth: 0 }));
    parts.push("```");
    if (ctx.feature.body) {
      parts.push("Markdown body:");
      parts.push("```markdown");
      parts.push(ctx.feature.body);
      parts.push("```");
    }
  } else if (entry.frontmatter.target.feature) {
    parts.push(`(Target feature ${entry.frontmatter.target.feature} does not exist yet — calling add_behavior on it will fail.)`);
  }

  if (ctx.tracking) {
    parts.push("");
    parts.push("## Current tracking sidecar");
    parts.push("```yaml");
    parts.push(YAML.stringify(ctx.tracking, { lineWidth: 0 }));
    parts.push("```");
  }

  parts.push("");
  parts.push(
    "Apply the smallest, clearest set of edits that addresses this feedback, or call request_human_review with a one-sentence reason if you can't safely apply edits."
  );
  return parts.join("\n");
}
