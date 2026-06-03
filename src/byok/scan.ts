import fs from "node:fs";
import path from "node:path";
import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import YAML from "yaml";
import { ProductosPaths } from "../core/paths.js";
import { ResolvedByok } from "../core/config.js";
import {
  Behavior,
  FeatureFrontmatter,
  UxView,
  readDraftById,
  readFeatureById,
  writeDraft,
} from "../core/product.js";
import { getStrategy } from "../core/context.js";

/**
 * BYOK code-scanning runner: takes a feature id + freeform hint, gives an
 * LLM read-only access to the codebase (list_files / read_file / grep) plus
 * a single write tool (propose_feature), and asks it to draft a feature.md.
 *
 * The runner is intentionally small — it mirrors what the productos-scope
 * skill does inside Claude Code, but driven by ProductOS itself so users
 * who don't run Claude Code can still get LLM-proposed Product Truth.
 *
 * Safety:
 * - Tools are scoped to the repo root; path traversal is blocked.
 * - The LLM cannot mark anything verified.
 * - Only one feature is written per scan.
 */

export type ScanResult =
  | { kind: "proposed"; feature_id: string; summary: string; ops: string[] }
  | { kind: "needs_review"; reason: string; ops: string[] }
  | { kind: "error"; message: string };

const SYSTEM_PROMPT = `You are scanning a codebase to propose Product Truth for ONE feature.

You will be given the project's STRATEGY (overarching goals, design principles, personas, voice) and a HINT describing the feature to scope. Strategy constrains every claim you propose.

Product Truth is markdown-fronted YAML that describes what the product DOES in product language (what the user does, what the user sees) — NOT in API/file/endpoint terms. Each feature has:
- ux: an array of UX views (screens / modals / drawers). Each has an ASCII sketch + named elements.
- behaviors: atomic claims about what the product does. Each can anchor to a UX view + element + interaction.

Your job:
1. Use list_files / read_file / grep to understand the relevant code.
2. When confident, call propose_feature ONCE with a structured spec. Do NOT call it twice.
3. If the hint is too vague, the code doesn't exist yet, or you'd need to invent behavior, call request_human_review with a one-sentence reason.

Rules:
- Claims must be in product language. Don't write "POST /api/x" — write "tapping Save sends the change".
- Behaviors anchor to a UX view via \`surface\` (the view's id) and optionally an element id + interaction word (tap/submit/view/etc).
- Element ids referenced by leads_to must exist within the same feature OR be a full feature_id like "wallet/transactions" for cross-feature navigation.
- You are proposing ONE feature. If the hint covers multiple features, pick the most central one and request_human_review for the rest.
- Max 12 tool calls. If you'd need more, request human review.

Be concise. Trust the hint's framing.`;

export async function runScan(
  featureId: string,
  hint: string,
  paths: ProductosPaths,
  byok: ResolvedByok
): Promise<ScanResult> {
  const apiKey = process.env[byok.api_key_env];
  if (!apiKey) {
    return { kind: "error", message: `API key env var ${byok.api_key_env} is empty or unset` };
  }

  let model: LanguageModel;
  try {
    model = pickModel(byok, apiKey);
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }

  const ops: string[] = [];
  let reviewReason: string | undefined;
  let proposedId: string | undefined;

  const tools = {
    list_files: tool({
      description:
        "List files under the repo matching a glob (relative to repo root). Use to discover candidate code for the feature. Excludes node_modules and dist by default.",
      inputSchema: z.object({
        glob: z.string().describe("Glob like 'src/**/*.tsx' or 'app/**/page.ts'"),
        max: z.number().int().positive().max(200).default(50),
      }),
      execute: async (args: { glob: string; max?: number }) => {
        ops.push(`list_files(${args.glob})`);
        const out = await safeGlob(paths.repoRoot, args.glob, args.max ?? 50);
        return { files: out };
      },
    }),
    read_file: tool({
      description:
        "Read a file from the repo. Use repo-relative paths. Returns up to 400 lines from `start_line`.",
      inputSchema: z.object({
        path: z.string(),
        start_line: z.number().int().nonnegative().default(1),
      }),
      execute: async (args: { path: string; start_line?: number }) => {
        ops.push(`read_file(${args.path})`);
        const abs = safePath(paths.repoRoot, args.path);
        if (!abs) return { ok: false, error: "path outside repo" };
        if (!fs.existsSync(abs)) return { ok: false, error: "not found" };
        const lines = fs.readFileSync(abs, "utf-8").split("\n");
        const start = Math.max(0, (args.start_line ?? 1) - 1);
        const slice = lines.slice(start, start + 400);
        return { ok: true, total_lines: lines.length, start_line: start + 1, content: slice.join("\n") };
      },
    }),
    grep: tool({
      description:
        "Search for a literal string across the repo (case-sensitive). Returns up to 30 hits with file:line:match. Use for finding component names, route handlers, prop usages, etc.",
      inputSchema: z.object({
        needle: z.string().min(2),
        glob: z.string().optional(),
      }),
      execute: async (args: { needle: string; glob?: string }) => {
        ops.push(`grep(${args.needle})`);
        const hits = await safeGrep(paths.repoRoot, args.needle, args.glob);
        return { hits };
      },
    }),
    propose_feature: tool({
      description:
        "Write the proposed feature as a DRAFT (productos/drafts/<id>.md). Call ONCE at the end of your scan. The human reviews + promotes the draft via `productos review`. Fails if the feature already exists in products/ or a draft already exists.",
      inputSchema: z.object({
        id: z.string().describe("area/slug, e.g. wallet/add-kid"),
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(["planned", "shipped", "deprecated"]).default("planned"),
        ux: z.array(z.any()).default([]),
        behaviors: z.array(z.any()).default([]),
        affected_by: z.array(z.string()).default([]),
      }),
      execute: async (args: {
        id: string;
        title: string;
        description?: string;
        status?: "planned" | "shipped" | "deprecated";
        ux?: unknown[];
        behaviors?: unknown[];
        affected_by?: string[];
      }) => {
        if (args.id !== featureId) {
          return { ok: false, error: `id must match the scan target ${featureId}` };
        }
        if (readFeatureById(paths, args.id)) {
          return { ok: false, error: `feature ${args.id} already exists in products/ — refusing to overwrite. Edit it directly or delete the canonical first.` };
        }
        if (readDraftById(paths, args.id)) {
          return { ok: false, error: `a draft for ${args.id} already exists — run \`productos review ${args.id}\` first, or delete the draft.` };
        }
        try {
          const fm = FeatureFrontmatter.parse({
            id: args.id,
            title: args.title,
            description: args.description,
            status: args.status ?? "planned",
            ux: (args.ux ?? []).map((u) => UxView.parse(u)),
            behaviors: (args.behaviors ?? []).map((b) => Behavior.parse(b)),
            affected_by: args.affected_by ?? [],
          });
          writeDraft(paths, {
            frontmatter: fm,
            body: "",
            filepath: "",
            url_path: "/" + fm.id,
          });
          proposedId = args.id;
          ops.push(`propose_feature(${args.id})`);
          return { ok: true, note: "Draft written. Run `productos review` to promote." };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
    request_human_review: tool({
      description:
        "Call this when the hint is ambiguous, the feature doesn't seem to exist yet, or you'd need to invent behavior. Give a one-sentence reason a human can act on.",
      inputSchema: z.object({ reason: z.string().min(5) }),
      execute: async (args: { reason: string }) => {
        reviewReason = args.reason;
        return { acknowledged: true };
      },
    }),
  };

  const strategy = getStrategy(paths);
  const userPrompt = buildUserPrompt(featureId, hint, strategy);

  try {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools,
      stopWhen: stepCountIs(byok.max_steps * 3),
    });

    if (reviewReason) {
      return { kind: "needs_review", reason: reviewReason, ops };
    }
    if (!proposedId) {
      return {
        kind: "needs_review",
        reason:
          result.text?.trim().slice(0, 240) ||
          "Scan finished without proposing a feature; falling back to human review",
        ops,
      };
    }
    return {
      kind: "proposed",
      feature_id: proposedId,
      summary: result.text?.trim().slice(0, 240) || ops.join(", "),
      ops,
    };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

function pickModel(byok: ResolvedByok, apiKey: string): LanguageModel {
  switch (byok.provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(byok.model);
    case "openai":
      return createOpenAI({ apiKey })(byok.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(byok.model);
    case "openrouter":
      return createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })(byok.model);
  }
}

function buildUserPrompt(featureId: string, hint: string, strategy: string): string {
  const parts: string[] = [];
  if (strategy.trim()) {
    parts.push("# Project strategy (read first — constrains every claim)");
    parts.push("");
    parts.push(strategy);
    parts.push("");
    parts.push("---");
    parts.push("");
  }
  parts.push(`# Scan request`);
  parts.push("");
  parts.push(`Propose Product Truth for feature \`${featureId}\`.`);
  parts.push("");
  parts.push(`## Hint`);
  parts.push(hint);
  parts.push("");
  parts.push(
    "Walk the relevant code with list_files / read_file / grep, then call propose_feature ONCE with the spec. If the feature doesn't exist in code yet, call request_human_review."
  );
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Safe filesystem helpers

function safePath(repoRoot: string, rel: string): string | null {
  const abs = path.resolve(repoRoot, rel);
  const real = abs;
  const root = path.resolve(repoRoot);
  if (!real.startsWith(root + path.sep) && real !== root) return null;
  return real;
}

async function safeGlob(repoRoot: string, pattern: string, max: number): Promise<string[]> {
  const { globby } = await import("globby");
  const matches = await globby(pattern, {
    cwd: repoRoot,
    gitignore: true,
    ignore: ["node_modules/**", "dist/**", ".git/**", "**/*.lock"],
  });
  return matches.slice(0, max);
}

async function safeGrep(repoRoot: string, needle: string, glob?: string): Promise<Array<{ file: string; line: number; text: string }>> {
  const { globby } = await import("globby");
  const files = await globby(glob ?? "**/*.{ts,tsx,js,jsx,py,go,rs,vue,svelte,md}", {
    cwd: repoRoot,
    gitignore: true,
    ignore: ["node_modules/**", "dist/**", ".git/**"],
  });
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const rel of files) {
    if (hits.length >= 30) break;
    const abs = path.join(repoRoot, rel);
    try {
      const lines = fs.readFileSync(abs, "utf-8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(needle)) {
          hits.push({ file: rel, line: i + 1, text: lines[i].slice(0, 240) });
          if (hits.length >= 30) break;
        }
      }
    } catch {
      // skip unreadable
    }
  }
  return hits;
}

// Suppress unused-import warning for YAML — it's used by Behavior/UxView schemas
// transitively in propose_feature parsing, kept for future YAML-encoded specs.
void YAML;
