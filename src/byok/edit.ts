import { generateText, stepCountIs, tool, type ModelMessage, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import YAML from "yaml";
import { ProductosPaths } from "../core/paths.js";
import { ResolvedByok, readConfig } from "../core/config.js";
import {
  Behavior,
  Element,
  FeatureDocument,
  FeatureFrontmatter,
  TestCase,
  UxView,
  listFeatures,
} from "../core/product.js";
import { getStrategy } from "../core/context.js";
import { auditFeature } from "../core/audit.js";

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
- **Every behavior you ADD must include at least one test_case** (id + description, minimum; given/when/then or steps when they fit). Behaviors without test cases are wishes — they have no falsification path. Build the test cases inline as you propose; don't propose first and add tests later. Aim for 1–3 cases: at minimum happy path + one error/edge case for shipped features.
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
  focusedBehaviorId?: string;
}): Promise<EditTurnResult> {
  const { feature, userMessage, history, paths, byok, focusedBehaviorId } = args;
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
        "Update fields on an existing UX view by id. Pass only the fields to change (title, sketch, sketch_html, path, notes). Cannot change id or replace elements — for those use add_or_replace_ux. sketch_html is an OPTIONAL raw-HTML version of the sketch that the web renderer uses INSTEAD of the ASCII sketch when present — generate it referencing the user's CSS classes (loaded via productos config web.stylesheet) so the mock looks like the real app.",
      inputSchema: z.object({
        ux_id: z.string(),
        title: z.string().optional(),
        sketch: z.string().optional(),
        sketch_html: z.string().optional(),
        path: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (a: { ux_id: string; title?: string; sketch?: string; sketch_html?: string; path?: string; notes?: string }) => {
        const u = fm.ux.find((x) => x.id === a.ux_id);
        if (!u) return { ok: false, error: `no UX view ${a.ux_id}` };
        if (a.title !== undefined) u.title = a.title;
        if (a.sketch !== undefined) u.sketch = a.sketch;
        if (a.sketch_html !== undefined) u.sketch_html = a.sketch_html;
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
        "Add a behavior, or replace one with the same id. Pass the FULL Behavior (id, claim, optional surface/element/interaction anchors, optional notes, test_cases array). REQUIRED: at least one test_case for the behavior to be accepted — behaviors without test cases are wishes, they have no falsification path. Aim for 1–3 cases (happy path + one error/edge).",
      inputSchema: z.object({ behavior: Behavior }),
      execute: async (a) => {
        try {
          const parsed = Behavior.parse(a.behavior);
          if (!parsed.deprecated && (!parsed.test_cases || parsed.test_cases.length === 0)) {
            return {
              ok: false,
              error: `Behavior "${parsed.id}" must include at least one test_case. Don't propose behaviors without falsification. Build the test cases inline (id + description, plus given/when/then or steps).`,
            };
          }
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
        "Update fields on an existing behavior by id. Pass only the fields to change. Use for rewording the claim, retargeting the anchor, or REPLACING the test_cases array (pass the full new array; partial test-case edits aren't supported). To change the behavior id, use add_or_replace_behavior.",
      inputSchema: z.object({
        behavior_id: z.string(),
        claim: z.string().optional(),
        notes: z.string().optional(),
        surface: z.string().optional(),
        element: z.string().optional(),
        interaction: z.string().optional(),
        test_cases: z.array(TestCase).optional(),
      }),
      execute: async (a) => {
        const b = fm.behaviors.find((x) => x.id === a.behavior_id);
        if (!b) return { ok: false, error: `no behavior ${a.behavior_id}` };
        if (a.claim !== undefined) b.claim = a.claim;
        if (a.notes !== undefined) b.notes = a.notes;
        if (a.surface !== undefined) b.surface = a.surface;
        if (a.element !== undefined) b.element = a.element;
        if (a.interaction !== undefined) b.interaction = a.interaction;
        if (a.test_cases !== undefined) b.test_cases = a.test_cases;
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

    list_app_components: tool({
      description:
        "List files under the user's web.components_dir so you can pick which components are relevant to the current screen. Only available if web.components_dir is configured. Use BEFORE generating sketch_html so the mock mirrors the user's actual app components.",
      inputSchema: z.object({
        glob: z.string().optional().describe("Glob pattern relative to components_dir, e.g. '**/*.tsx'. Defaults to all component-ish files."),
        max: z.number().int().positive().max(200).default(60),
      }),
      execute: async (a) => {
        const c = readConfig(paths);
        const dir = c.web?.components_dir;
        if (!dir) return { ok: false, error: "web.components_dir is not configured in productos/config.yaml" };
        const { globby } = await import("globby");
        const pattern = a.glob ?? "**/*.{tsx,jsx,ts,js,vue,svelte,astro}";
        const cwd = (await import("node:path")).resolve(paths.repoRoot, dir);
        const matches = await globby(pattern, { cwd, gitignore: true, ignore: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"] });
        ops.push(`list_app_components(${dir})`);
        return { dir, components: matches.slice(0, a.max ?? 60) };
      },
    }),
    read_app_file: tool({
      description:
        "Read a file from the user's app codebase (component source, CSS file, etc) so you can understand the structure + class names before generating sketch_html. Paths are relative to the repo root. Use this — DON'T invent component structure.",
      inputSchema: z.object({
        path: z.string().describe("Repo-relative path, e.g. 'src/components/Button.tsx'"),
        start_line: z.number().int().nonnegative().default(1),
      }),
      execute: async (a) => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const abs = path.resolve(paths.repoRoot, a.path);
        const root = path.resolve(paths.repoRoot);
        if (!abs.startsWith(root + path.sep) && abs !== root) {
          return { ok: false, error: "path escapes repo root" };
        }
        if (!fs.existsSync(abs)) return { ok: false, error: "not found" };
        const lines = fs.readFileSync(abs, "utf-8").split("\n");
        const start = Math.max(0, (a.start_line ?? 1) - 1);
        const slice = lines.slice(start, start + 400);
        ops.push(`read_app_file(${a.path})`);
        return { ok: true, total_lines: lines.length, start_line: start + 1, content: slice.join("\n") };
      },
    }),
    add_or_replace_principle: tool({
      description:
        "Add or update a section in productos/context/principles.md. Use this when a candidate rule is CROSS-CUTTING (applies to other features too) — DON'T duplicate the rule per-feature; lift it to principles and reference it from each feature behavior via `notes`. Section heading becomes the anchor (e.g. `## submits-are-idempotent` → reference as `principles#submits-are-idempotent`). For changes to other context docs (goals, personas, non-goals, voice), the user must edit them directly — this tool only manages principles.",
      inputSchema: z.object({
        section_id: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/, "kebab-case, e.g. submits-are-idempotent")
          .describe("Becomes the principle's ## heading and its anchor."),
        body: z
          .string()
          .min(30)
          .describe(
            "Markdown body of the principle. Two to four sentences: what the rule is, why it exists, what scope it covers. No code/file refs."
          ),
      }),
      execute: async (a) => {
        try {
          const { listContext, readContext, writeContext } = await import("../core/context.js");
          // Find an existing principles doc, or default to "principles".
          const existing = listContext(paths).find((d) => d.name === "principles");
          const doc = existing
            ? readContext(paths, existing.name)!
            : { name: "principles", title: "Design principles", order: 2, body: "" };
          // If a section with the same anchor already exists, replace it.
          // Otherwise append to the end.
          const heading = `## ${a.section_id}`;
          const lines = doc.body.split("\n");
          const startIdx = lines.findIndex((l) => l.trim() === heading);
          if (startIdx >= 0) {
            // Find end of this section (next ## heading or EOF).
            let endIdx = lines.length;
            for (let i = startIdx + 1; i < lines.length; i++) {
              if (lines[i].startsWith("## ")) { endIdx = i; break; }
            }
            const before = lines.slice(0, startIdx);
            const after = lines.slice(endIdx);
            const block = [heading, "", a.body.trim(), ""];
            doc.body = [...before, ...block, ...after].join("\n").trimEnd();
          } else {
            doc.body = (doc.body.trim() + "\n\n" + heading + "\n\n" + a.body.trim()).trim();
          }
          writeContext(paths, { name: doc.name, title: doc.title, order: doc.order, body: doc.body });
          ops.push(`principle:${a.section_id}`);
          return {
            ok: true,
            anchor: `principles#${a.section_id}`,
            hint: `Now reference this from feature behaviors via \`notes: "Per principles#${a.section_id}"\`.`,
          };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
  };

  // First turn: bootstrap history with system context + initial feature snapshot.
  // If a behavior is focused, prepend a per-turn nudge so the LLM weights edits
  // toward it (but doesn't refuse global edits if the user wants one).
  const focusNudge = focusedBehaviorId
    ? `(The user is currently focused on behavior \`${focusedBehaviorId}\` — they probably mean that one when they say "the claim" or "the test cases".)`
    : null;
  const userTurn = focusNudge ? `${focusNudge}\n\n${userMessage}` : userMessage;

  const messages: ModelMessage[] = history.length === 0
    ? [
        ...buildBootstrapMessages(feature, paths),
        { role: "user", content: userTurn },
      ]
    : [...history, { role: "user", content: userTurn }];

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
  const findings = auditFeature(feature);
  // Surface the web mock hints (stylesheet + components dir) so the model
  // knows whether sketch_html with the user's CSS is in play.
  const webConfig: { stylesheet?: string; components_dir?: string } = {};
  try {
    const c = readConfig(paths);
    if (c.web?.stylesheet) webConfig.stylesheet = c.web.stylesheet;
    if (c.web?.components_dir) webConfig.components_dir = c.web.components_dir;
  } catch { /* fall back to empty */ }
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
  if (findings.length > 0) {
    parts.push("---");
    parts.push("# Audit findings (the CLI showed these to the user)");
    parts.push("When the user says 'fix #N' or 'apply 1, 3', they mean these numbered items:");
    let n = 1;
    for (const sev of ["high", "medium", "low"] as const) {
      const grp = findings.filter((f) => f.severity === sev);
      for (const f of grp) {
        const tgt = f.behavior_id ? ` (behavior=${f.behavior_id})` : f.ux_id ? ` (ux=${f.ux_id}${f.element_id ? ", element=" + f.element_id : ""})` : "";
        parts.push(`  ${n}. [${sev.toUpperCase()}] ${f.message}${tgt}`);
        n++;
      }
    }
    parts.push("When the user references a number, apply the corresponding fix via the appropriate tool. For 'thin-ux-coverage' findings, PROPOSE rule-named behaviors (validation, disabled-state, defaults, focus, error-paths) with appropriate anchors and test_cases — don't just write one generic 'flow' behavior.");
  }
  // Principle classification nudge — keep cross-cutting rules in the
  // strategy layer instead of duplicating them per-feature.
  parts.push("---");
  // Web mock guidance — high-fidelity sketch_html generation.
  if (webConfig.stylesheet || webConfig.components_dir) {
    parts.push("---");
    parts.push("# How to produce high-fidelity UX mocks (sketch_html)");
    parts.push(
      [
        `This project has the web mock pipeline enabled:`,
        webConfig.stylesheet ? `  - web.stylesheet: \`${webConfig.stylesheet}\` (loaded into the rendered page as /_user-style.css)` : null,
        webConfig.components_dir ? `  - web.components_dir: \`${webConfig.components_dir}\` (read these to mirror the user's actual components)` : null,
        ``,
        `When generating or updating a UX view's \`sketch_html\` field:`,
        `  1. READ THE REAL CODE FIRST. Use list_app_components + read_app_file to see what the user's actual components look like. Don't invent class names or structure — pull them from the source.`,
        webConfig.stylesheet ? `  2. Read the user's CSS file (read_app_file on \`${webConfig.stylesheet}\`) to learn which class names are real and how they're styled.` : null,
        `  3. PRODUCE STATIC HTML that mirrors the component structure: same semantic elements, same class names, same nesting. The user's CSS will style it identically to the real app.`,
        `  4. NO JAVASCRIPT, NO INTERACTIVITY. Static HTML only — productos renders it without a JS runtime.`,
        `  5. WRAP THE MOCK in a single root element (a <div class="screen"> or similar). The web renderer wraps your sketch_html in a .ux-mock container.`,
        `  6. ALWAYS KEEP THE \`sketch\` (ASCII) FIELD ALONGSIDE. The ASCII version is the canonical reader-friendly view in CLI and Claude. sketch_html is purely the web-renderer fidelity bonus.`,
        ``,
        `If components_dir is not set, fall back to producing a generic-but-pleasant HTML mock — but flag to the user that configuring web.components_dir would unlock real-app fidelity.`,
      ].filter(Boolean).join("\n")
    );
  }
  parts.push("---");
  parts.push("# Classify each candidate before adding");
  parts.push(
    "Before calling add_or_replace_behavior, decide: is this rule SPECIFIC to this feature, or a CROSS-CUTTING principle? " +
    "If the same rule would apply to another existing feature in the corpus (e.g. spend-form, settings-form), it's a principle — belongs in productos/context/principles.md, not duplicated per-feature. " +
    "If the strategy above already names a covering principle, reference it in the behavior's notes (e.g. `notes: \"Per principles#submits-are-idempotent\"`) instead of restating the rule. " +
    "If a candidate looks cross-cutting but no principle covers it yet, tell the user — don't quietly bake it into the feature. The BYOK edit tools don't add to context.md; surface it as a question. " +
    "Specific-to-this-feature rules (validation thresholds, anchor-specific outcomes, this-form's-data-flow) are normal behaviors."
  );
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
