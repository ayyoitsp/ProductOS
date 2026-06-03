import { generateText, stepCountIs, tool, type ModelMessage, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import YAML from "yaml";
import { ProductosPaths } from "../core/paths.js";
import { ResolvedByok } from "../core/config.js";
import {
  Behavior,
  Element,
  FeatureDocument,
  FeatureFrontmatter,
  UxView,
  listFeatures,
} from "../core/product.js";
import { getStrategy } from "../core/context.js";

/**
 * Conversational editor for ONE feature, driven by BYOK.
 *
 * Each turn:
 *   - The user types a natural-language change ("drop the leads_to on save",
 *     "the second behavior is wrong — it should be …").
 *   - The LLM gets the current feature spec + the conversation history.
 *   - It uses tools that mutate an IN-MEMORY clone of the feature.
 *   - We return the updated feature + the assistant's summary + updated history.
 *
 * The CLI loops on this; the file isn't written until the user runs `/save`.
 */

export type EditTurnResult =
  | {
      kind: "applied";
      feature: FeatureDocument;
      assistantText: string;
      ops: string[];
      history: ModelMessage[];
    }
  | {
      kind: "question";
      assistantText: string;
      history: ModelMessage[];
    }
  | { kind: "error"; message: string };

const SYSTEM_PROMPT = `You are editing ONE Product Truth feature for a Product Manager. The file is markdown frontmatter with this shape:

  id, title, description, status, affected_by, ux (UX views with sketches + elements), behaviors

Each turn you receive the current feature spec and a user request. Use tools to apply the requested changes, or ask a clarifying question if the request is ambiguous.

Rules:
- Claims are in PRODUCT LANGUAGE — what the user does, what the user sees. NOT API/file/endpoint terms.
- Don't invent behavior, claims, or elements the user didn't ask for.
- When unsure between two interpretations, ask a one-sentence clarifying question.
- For element \`leads_to\`: same-feature anchor like \`checkout-page\`, cross-feature like \`wallet/transactions\`, or \`wallet/balance#kid-view\`. Never a leading slash or external URL.
- Sketches use these element conventions: [ Label ] for buttons, <Label> for links, [_________] for inputs, → Name for card rows.
- You CANNOT mark anything verified — that's a human-only action.

After applying edits, end your response with a ONE-LINE summary of what changed. No long narrative.`;

export async function editFeatureTurn(args: {
  feature: FeatureDocument;
  userMessage: string;
  history: ModelMessage[];
  paths: ProductosPaths;
  byok: ResolvedByok;
}): Promise<EditTurnResult> {
  const { feature, userMessage, history, paths, byok } = args;
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

  // In-memory working copy — tools mutate this.
  const fm: typeof feature.frontmatter = JSON.parse(JSON.stringify(feature.frontmatter));
  let body = feature.body;
  const ops: string[] = [];

  const tools = {
    set_metadata: tool({
      description:
        "Update feature-level fields. Pass only the fields you want to change. Use for title, description, status, affected_by, or body (the markdown after the frontmatter).",
      inputSchema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["planned", "shipped", "deprecated"]).optional(),
        affected_by: z.array(z.string()).optional(),
        body: z.string().optional(),
      }),
      execute: async (a: {
        title?: string;
        description?: string;
        status?: "planned" | "shipped" | "deprecated";
        affected_by?: string[];
        body?: string;
      }) => {
        if (a.title !== undefined) fm.title = a.title;
        if (a.description !== undefined) fm.description = a.description;
        if (a.status !== undefined) fm.status = a.status;
        if (a.affected_by !== undefined) fm.affected_by = a.affected_by;
        if (a.body !== undefined) body = a.body;
        ops.push("set_metadata");
        return { ok: true };
      },
    }),

    add_or_replace_ux: tool({
      description:
        "Add a UX view, or replace one with the same id. Pass the FULL UxView (id, title, optional path, optional sketch, optional notes, elements array). Use this when adding a new screen or rewriting an existing one.",
      inputSchema: z.object({ ux: UxView }),
      execute: async (a) => {
        try {
          const parsed = UxView.parse(a.ux);
          const i = fm.ux.findIndex((u) => u.id === parsed.id);
          if (i >= 0) fm.ux[i] = parsed;
          else fm.ux.push(parsed);
          ops.push(`ux:${parsed.id}`);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),

    update_ux: tool({
      description:
        "Update fields on an existing UX view by id. Pass only the fields to change (title, sketch, path, notes). Cannot change id or replace elements — for those use add_or_replace_ux.",
      inputSchema: z.object({
        ux_id: z.string(),
        title: z.string().optional(),
        sketch: z.string().optional(),
        path: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (a: { ux_id: string; title?: string; sketch?: string; path?: string; notes?: string }) => {
        const u = fm.ux.find((x) => x.id === a.ux_id);
        if (!u) return { ok: false, error: `no UX view ${a.ux_id}` };
        if (a.title !== undefined) u.title = a.title;
        if (a.sketch !== undefined) u.sketch = a.sketch;
        if (a.path !== undefined) u.path = a.path;
        if (a.notes !== undefined) u.notes = a.notes;
        ops.push(`ux:${a.ux_id}:update`);
        return { ok: true };
      },
    }),

    remove_ux: tool({
      description: "Remove a UX view by id. Any behavior anchored to it will have its surface/element fields cleared.",
      inputSchema: z.object({ ux_id: z.string() }),
      execute: async (a: { ux_id: string }) => {
        const before = fm.ux.length;
        fm.ux = fm.ux.filter((u) => u.id !== a.ux_id);
        if (fm.ux.length === before) return { ok: false, error: `no UX view ${a.ux_id}` };
        fm.behaviors = fm.behaviors.map((b) =>
          b.surface === a.ux_id ? { ...b, surface: undefined, element: undefined } : b
        );
        ops.push(`ux:${a.ux_id}:remove`);
        return { ok: true };
      },
    }),

    add_or_replace_element: tool({
      description:
        "Add an element to a UX view, or replace one with the same id. Pass ux_id and the FULL Element (id, kind, optional label, optional notes, optional leads_to).",
      inputSchema: z.object({ ux_id: z.string(), element: Element }),
      execute: async (a) => {
        const u = fm.ux.find((x) => x.id === a.ux_id);
        if (!u) return { ok: false, error: `no UX view ${a.ux_id}` };
        try {
          const parsed = Element.parse(a.element);
          const i = u.elements.findIndex((e) => e.id === parsed.id);
          if (i >= 0) u.elements[i] = parsed;
          else u.elements.push(parsed);
          ops.push(`element:${a.ux_id}.${parsed.id}`);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),

    remove_element: tool({
      description: "Remove an element from a UX view.",
      inputSchema: z.object({ ux_id: z.string(), element_id: z.string() }),
      execute: async (a: { ux_id: string; element_id: string }) => {
        const u = fm.ux.find((x) => x.id === a.ux_id);
        if (!u) return { ok: false, error: `no UX view ${a.ux_id}` };
        const before = u.elements.length;
        u.elements = u.elements.filter((e) => e.id !== a.element_id);
        if (u.elements.length === before) return { ok: false, error: `no element ${a.element_id}` };
        ops.push(`element:${a.ux_id}.${a.element_id}:remove`);
        return { ok: true };
      },
    }),

    add_or_replace_behavior: tool({
      description:
        "Add a behavior, or replace one with the same id. Pass the FULL Behavior (id, claim, optional surface/element/interaction anchors, optional notes, test_cases array — empty array is fine if no cases yet).",
      inputSchema: z.object({ behavior: Behavior }),
      execute: async (a) => {
        try {
          const parsed = Behavior.parse(a.behavior);
          const i = fm.behaviors.findIndex((b) => b.id === parsed.id);
          if (i >= 0) fm.behaviors[i] = parsed;
          else fm.behaviors.push(parsed);
          ops.push(`behavior:${parsed.id}`);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),

    update_behavior: tool({
      description:
        "Update fields on an existing behavior by id. Pass only the fields to change. Use for rewording the claim, retargeting the anchor, etc. To change the behavior id or test_cases, use add_or_replace_behavior.",
      inputSchema: z.object({
        behavior_id: z.string(),
        claim: z.string().optional(),
        notes: z.string().optional(),
        surface: z.string().optional(),
        element: z.string().optional(),
        interaction: z.string().optional(),
      }),
      execute: async (a: { behavior_id: string; claim?: string; notes?: string; surface?: string; element?: string; interaction?: string }) => {
        const b = fm.behaviors.find((x) => x.id === a.behavior_id);
        if (!b) return { ok: false, error: `no behavior ${a.behavior_id}` };
        if (a.claim !== undefined) b.claim = a.claim;
        if (a.notes !== undefined) b.notes = a.notes;
        if (a.surface !== undefined) b.surface = a.surface;
        if (a.element !== undefined) b.element = a.element;
        if (a.interaction !== undefined) b.interaction = a.interaction;
        ops.push(`behavior:${a.behavior_id}:update`);
        return { ok: true };
      },
    }),

    remove_behavior: tool({
      description: "Remove a behavior by id.",
      inputSchema: z.object({ behavior_id: z.string() }),
      execute: async (a: { behavior_id: string }) => {
        const before = fm.behaviors.length;
        fm.behaviors = fm.behaviors.filter((b) => b.id !== a.behavior_id);
        if (fm.behaviors.length === before) return { ok: false, error: `no behavior ${a.behavior_id}` };
        ops.push(`behavior:${a.behavior_id}:remove`);
        return { ok: true };
      },
    }),
  };

  // First turn: bootstrap history with system context + initial feature snapshot.
  const messages: ModelMessage[] = history.length === 0
    ? [
        ...buildBootstrapMessages(feature, paths),
        { role: "user", content: userMessage },
      ]
    : [...history, { role: "user", content: userMessage }];

  try {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(byok.max_steps),
    });

    const newHistory: ModelMessage[] = [...messages];
    // Add the model's assistant turn (text only — tool results are in-process).
    if (result.text) {
      newHistory.push({ role: "assistant", content: result.text });
    }

    const updatedFeature: FeatureDocument = {
      frontmatter: FeatureFrontmatter.parse(fm),
      body,
      filepath: feature.filepath,
      url_path: feature.url_path,
    };

    if (ops.length === 0) {
      // No mutations — treat as a question/conversation turn.
      return {
        kind: "question",
        assistantText: result.text?.trim() || "(no response)",
        history: newHistory,
      };
    }

    return {
      kind: "applied",
      feature: updatedFeature,
      assistantText: result.text?.trim() || ops.join(", "),
      ops,
      history: newHistory,
    };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

function buildBootstrapMessages(feature: FeatureDocument, paths: ProductosPaths): ModelMessage[] {
  const strategy = getStrategy(paths);
  const corpus = listFeatures(paths).map((f) => f.frontmatter.id);
  const parts: string[] = [];
  if (strategy.trim()) {
    parts.push("# Project strategy (constrains every claim)");
    parts.push(strategy);
    parts.push("---");
  }
  parts.push(`# Other features in the corpus (for leads_to / affected_by references):`);
  parts.push(corpus.join(", ") || "(none yet)");
  parts.push("---");
  parts.push("# Current feature spec");
  parts.push("```yaml");
  parts.push(YAML.stringify(feature.frontmatter, { lineWidth: 0 }));
  parts.push("```");
  if (feature.body) {
    parts.push("# Markdown body");
    parts.push("```markdown");
    parts.push(feature.body);
    parts.push("```");
  }
  return [{ role: "user", content: parts.join("\n\n") }];
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
