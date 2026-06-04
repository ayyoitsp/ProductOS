import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { resolvePathsOrThrow, ProductosPaths } from "../../core/paths.js";
import { readConfig, resolveTruthVerificationByok, ResolvedByok } from "../../core/config.js";
import {
  FeatureDocument,
  featureFilePath,
  listFeatures,
  readFeatureById,
  writeFeature,
} from "../../core/product.js";
import { editFeatureTurn } from "../../byok/edit.js";
import { buildFlowGraph, renderAscii as renderFlowAscii } from "../../core/flowchart.js";
import type { ModelMessage } from "ai";

/**
 * Conversational, feature-scoped REPL.
 *
 * Each turn we re-render the feature (title, status, UX sketches, behaviors)
 * and prompt the user for natural-language input. BYOK applies the change
 * via tools that mutate an in-memory clone. The file isn't written until
 * the user runs `/save`. `/quit` warns on unsaved changes.
 *
 * Slash commands: /save /quit /help /reset
 *
 * Requires BYOK to be configured. Without it, we error with a hint to run
 * `productos configure byok` — the trim menu has been retired because the
 * AI editor covers it and a half-functional fallback would be confusing.
 */
export function reviewCommand(): Command {
  return new Command("review")
    .description("Open a conversational REPL to edit a feature in plain English (uses your registered BYOK provider)")
    .argument("[feature_id]", "Feature id like 'wallet/add-kid'. If omitted, pick from a list.")
    .action(async (featureIdArg: string | undefined) => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);

      let byok: ResolvedByok;
      try {
        byok = resolveTruthVerificationByok(config);
      } catch {
        // truth_verification might be 'queue' (not 'byok') — fall back to
        // the active provider directly so review still works without
        // flipping truth-verification semantics.
        const active = config.byok.active;
        const reg = config.byok.providers[active];
        if (!reg) {
          console.error(pc.red("✗"), "No BYOK provider registered.");
          console.error(pc.dim("Run `productos configure byok` to register a provider, then re-run review."));
          process.exit(1);
        }
        byok = {
          provider: active,
          api_key_env: reg.api_key_env,
          model: reg.default_model,
          max_steps: config.byok.max_steps,
        };
      }

      if (!process.env[byok.api_key_env]) {
        console.error(pc.red("✗"), `${byok.api_key_env} is not set in this shell.`);
        console.error(pc.dim("Export the key and re-run review."));
        process.exit(1);
      }

      let featureId = featureIdArg;
      if (!featureId) {
        const features = listFeatures(paths);
        if (features.length === 0) {
          console.log(pc.dim("No features yet. Run `productos scan <area/slug> \"<hint>\"` to create one, or ask Claude to scope a feature."));
          return;
        }
        const withMtime = features.map((f) => ({ f, mtime: fs.statSync(f.filepath).mtimeMs }));
        withMtime.sort((a, b) => b.mtime - a.mtime);

        const picked = await p.select<string>({
          message: "Which feature do you want to review?",
          options: withMtime.slice(0, 30).map(({ f }) => ({
            value: f.frontmatter.id,
            label: f.frontmatter.id,
            hint: f.frontmatter.title,
          })),
        });
        if (p.isCancel(picked)) {
          p.cancel("Canceled.");
          return;
        }
        featureId = picked;
      }

      const feature = readFeatureById(paths, featureId);
      if (!feature) {
        console.error(pc.red("✗"), `No feature at ${path.relative(paths.repoRoot, featureFilePath(paths, featureId))}`);
        console.error(pc.dim(`Create it: productos scan ${featureId} "<hint>"`));
        process.exit(1);
      }

      console.log("");
      console.log(pc.dim(`Reviewing via ${byok.provider}/${byok.model}.`));
      console.log(pc.dim(`/show <ux_id> for sketch + elements · /show <behavior_id> for claim + test cases · /back · /save · /quit · /help`));
      await repl(paths, byok, feature);
    });
}

type Focus =
  | { kind: "ux"; id: string }
  | { kind: "behavior"; id: string };

async function repl(paths: ProductosPaths, byok: ResolvedByok, featureIn: FeatureDocument): Promise<void> {
  let feature = featureIn;
  const initial = featureIn;
  let dirty = false;
  let focus: Focus | undefined;
  let history: ModelMessage[] = [];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => {});

  try {
    while (true) {
      renderFeature(feature);
      if (focus) {
        if (focus.kind === "behavior") {
          const b = feature.frontmatter.behaviors.find((x) => x.id === focus!.id);
          if (!b) focus = undefined;
          else renderBehaviorDetail(b);
        } else {
          const u = feature.frontmatter.ux.find((x) => x.id === focus!.id);
          if (!u) focus = undefined;
          else {
            const anchored = feature.frontmatter.behaviors.filter((b) => b.surface === u.id);
            renderUxDetail(u, anchored);
          }
        }
      }
      const prompt = dirty ? pc.yellow("You> ") : pc.cyan("You> ");
      const input = (await rl.question(prompt)).trim();
      if (!input) continue;

      if (input.startsWith("/")) {
        const result = await handleSlash(input, {
          paths, feature, dirty, initial, focus,
        });
        if (result.kind === "exit") return;
        if (result.kind === "replace") {
          feature = result.feature;
          dirty = result.dirty;
          history = [];
        }
        if (result.kind === "focus") {
          focus = result.focus;
        }
        continue;
      }

      // Natural-language turn → BYOK
      console.log(pc.dim(`(thinking via ${byok.provider}/${byok.model}…)`));
      const turn = await editFeatureTurn({
        feature, userMessage: input, history, paths, byok,
        focusedBehaviorId: focus?.kind === "behavior" ? focus.id : undefined,
      });

      if (turn.kind === "error") {
        console.log(pc.red("✗ "), turn.message);
        continue;
      }
      if (turn.kind === "question") {
        console.log("");
        console.log(pc.bold("AI> ") + turn.assistantText);
        history = turn.history;
        continue;
      }

      feature = turn.feature;
      history = turn.history;
      dirty = true;
      console.log("");
      console.log(pc.green("✓ ") + (turn.assistantText || turn.ops.join(", ")));
      console.log(pc.dim(`   ops: ${turn.ops.join(", ")}`));
    }
  } finally {
    rl.close();
  }
}

type SlashResult =
  | { kind: "continue" }
  | { kind: "exit" }
  | { kind: "replace"; feature: FeatureDocument; dirty: boolean }
  | { kind: "focus"; focus: Focus | undefined };

async function handleSlash(
  input: string,
  ctx: {
    paths: ProductosPaths;
    feature: FeatureDocument;
    dirty: boolean;
    initial: FeatureDocument;
    focus: Focus | undefined;
  }
): Promise<SlashResult> {
  const parts = input.slice(1).split(/\s+/);
  const c = (parts[0] ?? "").toLowerCase();
  const rest = parts.slice(1).join(" ").trim();

  if (c === "show" || c === "drill" || c === "focus") {
    if (!rest) {
      console.log(pc.red("✗ "), "Usage: /show <ux_id|behavior_id>");
      return { kind: "continue" };
    }
    // Resolve to either UX or behavior — UX takes precedence (they're rarer
    // and the user "shows" a screen more often than a behavior).
    const u = ctx.feature.frontmatter.ux.find((x) => x.id === rest);
    if (u) return { kind: "focus", focus: { kind: "ux", id: rest } };
    const b = ctx.feature.frontmatter.behaviors.find((x) => x.id === rest);
    if (b) return { kind: "focus", focus: { kind: "behavior", id: rest } };
    const ids = [
      ...ctx.feature.frontmatter.ux.map((x) => `ux:${x.id}`),
      ...ctx.feature.frontmatter.behaviors.map((x) => `behavior:${x.id}`),
    ];
    console.log(pc.red("✗ "), `No UX view or behavior "${rest}". Known: ${ids.join(", ") || "(none)"}`);
    return { kind: "continue" };
  }

  if (c === "back" || c === "unfocus" || c === "up") {
    if (!ctx.focus) {
      console.log(pc.dim("(already at the summary view)"));
      return { kind: "continue" };
    }
    return { kind: "focus", focus: undefined };
  }

  if (c === "save") {
    writeFeature(ctx.paths, ctx.feature);
    console.log(pc.green("✓ "), `Saved ${path.relative(ctx.paths.repoRoot, ctx.feature.filepath || featureFilePath(ctx.paths, ctx.feature.frontmatter.id))}`);
    return { kind: "replace", feature: ctx.feature, dirty: false };
  }

  if (c === "quit" || c === "q" || c === "exit") {
    if (ctx.dirty) {
      const confirmed = await p.confirm({ message: "You have unsaved changes. Quit anyway?", initialValue: false });
      if (p.isCancel(confirmed) || !confirmed) return { kind: "continue" };
    }
    return { kind: "exit" };
  }

  if (c === "reset") {
    if (ctx.dirty) {
      const confirmed = await p.confirm({ message: "Reset will discard unsaved changes — proceed?", initialValue: false });
      if (p.isCancel(confirmed) || !confirmed) return { kind: "continue" };
    }
    const reloaded = readFeatureById(ctx.paths, ctx.initial.frontmatter.id);
    if (!reloaded) {
      console.log(pc.red("✗ "), "Original feature is gone from disk — nothing to reset to.");
      return { kind: "continue" };
    }
    console.log(pc.green("✓ "), "Reset to on-disk version.");
    return { kind: "replace", feature: reloaded, dirty: false };
  }

  if (c === "help" || c === "h" || c === "?") {
    console.log("");
    console.log(pc.bold("Commands:"));
    console.log("  /show <ux|behavior>   Drill into a UX view (sketch + elements) or a behavior (notes + test cases)");
    console.log("  /back                 Return to the summary view");
    console.log("  /save                 Write changes to disk");
    console.log("  /reset                Discard changes and reload from disk");
    console.log("  /quit                 Exit (warns on unsaved changes)");
    console.log("  /help                 This message");
    console.log("");
    console.log(pc.dim("Anything else you type is sent to the AI editor. Examples:"));
    console.log(pc.dim("  what's off with the family-settings UX?"));
    console.log(pc.dim("  drop the second behavior"));
    console.log(pc.dim("  the leads_to on save-btn should point to confirmation-page"));
    console.log(pc.dim("  add a test case for the empty state"));
    console.log(pc.dim("  rename the feature to 'Add a child'"));
    return { kind: "continue" };
  }

  console.log(pc.red("✗ "), `Unknown command: /${c}. Try /help.`);
  return { kind: "continue" };
}

// ---------------------------------------------------------------------------
// Pretty printer

function renderFeature(feature: FeatureDocument): void {
  const fm = feature.frontmatter;
  console.log("");
  console.log(pc.bold(pc.cyan(fm.title)) + pc.dim(`  ${fm.id}`));
  console.log(pc.dim(`  status: ${fm.status}`));
  if (fm.description) {
    console.log("");
    console.log("  " + fm.description.split("\n").join("\n  "));
  }

  if (fm.ux.length > 0) {
    console.log("");
    console.log(pc.bold("  UX flow:"));
    console.log("");
    const graph = buildFlowGraph(feature);
    const summaries = new Map<string, string>();
    for (const u of fm.ux) {
      if (u.notes) summaries.set(u.id, u.notes);
    }
    console.log(renderFlowAscii(graph, summaries));
  }

  // Rule / invariant behaviors (no UX anchor) — list ids only as drill-in
  // references. Don't expand their claims here.
  const surfaceIds = new Set(fm.ux.map((u) => u.id));
  const rules = fm.behaviors.filter((b) => !b.surface || !surfaceIds.has(b.surface));
  if (rules.length > 0) {
    console.log("");
    console.log(pc.bold("  Rules & invariants:"), rules.map((r) => r.id).join(", "));
  }

  if (fm.affected_by.length > 0) {
    console.log("");
    console.log(pc.bold("  Affected by:"), fm.affected_by.join(", "));
  }

  console.log("");
  console.log(pc.dim("  Does this overall flow look right? Want to change or add details,"));
  console.log(pc.dim("  or view a particular UX screen and its behaviors?"));
  console.log(pc.dim(`  (/show <ux_id> · /show <behavior_id> · /help)`));
  console.log("");
}

function oneLine(s: string, max = 80): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "…";
}

// ---------------------------------------------------------------------------
// Drilled views — UX (sketch + elements) or Behavior (notes + test cases).

function renderUxDetail(
  u: { id: string; title: string; path?: string; sketch?: string; notes?: string; elements: Array<{ id: string; kind: string; label?: string; notes?: string; leads_to?: string }> },
  anchoredBehaviors: Array<{ id: string; claim: string; element?: string; interaction?: string; test_cases: Array<unknown> }> = []
): void {
  console.log(pc.dim("  ─── focused UX: ") + pc.bold(pc.cyan(u.id)) + pc.dim(" " + "─".repeat(Math.max(0, 36 - u.id.length))));
  console.log(pc.dim(`  title: ${u.title}${u.path ? "  path: " + u.path : ""}`));
  console.log("");
  if (u.sketch) {
    const indented = u.sketch.split("\n").map((l) => "  " + l).join("\n");
    console.log(indented);
  } else {
    console.log(pc.dim("  (no sketch)"));
  }
  console.log("");
  if (u.elements.length === 0) {
    console.log(pc.dim("  (no elements declared)"));
  } else {
    console.log(pc.bold(`  Elements (${u.elements.length}):`));
    for (const el of u.elements) {
      const label = el.label ? pc.dim(` "${el.label}"`) : "";
      const lead = el.leads_to ? pc.dim(` → ${el.leads_to}`) : "";
      console.log(`    ${pc.cyan(el.id)} ${el.kind}${label}${lead}`);
      if (el.notes) console.log(pc.dim(`      notes: ${el.notes}`));
    }
  }
  if (u.notes) {
    console.log("");
    console.log(pc.bold("  Notes:"), u.notes);
  }
  if (anchoredBehaviors.length > 0) {
    console.log("");
    console.log(pc.bold(`  Behaviors anchored here (${anchoredBehaviors.length}):`));
    for (const b of anchoredBehaviors) {
      const anchor = b.element ? pc.dim(` [${b.element}${b.interaction ? " " + b.interaction : ""}]`) : "";
      const cases = b.test_cases.length > 0 ? pc.dim(`  (${b.test_cases.length} test ${b.test_cases.length === 1 ? "case" : "cases"})`) : "";
      console.log(`    ${pc.cyan(b.id)}${anchor}${cases}`);
      console.log(`      ${oneLine(b.claim, 100)}`);
    }
    console.log(pc.dim(`    /show <behavior_id> for claim + notes + test cases.`));
  }
  console.log("");
  console.log(pc.dim(`  Tip: edit the sketch, elements, or title by talking. /back to return.`));
  console.log("");
}

function renderBehaviorDetail(b: { id: string; claim: string; notes?: string; surface?: string; element?: string; interaction?: string; test_cases: Array<{ id: number; description: string; level?: string; given?: string; when?: string; then?: string; steps?: string; deprecated?: boolean }> }): void {
  console.log(pc.dim("  ─── focused behavior: ") + pc.bold(pc.cyan(b.id)) + pc.dim(" " + "─".repeat(Math.max(0, 30 - b.id.length))));
  if (b.surface) {
    console.log(pc.dim(`  anchor: ${b.surface}${b.element ? "." + b.element : ""}${b.interaction ? " " + b.interaction : ""}`));
  }
  console.log("");
  console.log("  " + pc.bold("claim:") + " " + b.claim);
  if (b.notes) {
    console.log("  " + pc.bold("notes:") + " " + b.notes.split("\n").join("\n         "));
  }
  console.log("");
  if (b.test_cases.length === 0) {
    console.log(pc.dim("  (no test cases yet)"));
  } else {
    console.log(pc.bold(`  Test cases (${b.test_cases.length}):`));
    for (const tc of b.test_cases) {
      const dep = tc.deprecated ? pc.red(" [deprecated]") : "";
      const lvl = tc.level ? pc.dim(` (${tc.level})`) : "";
      console.log(`    ${pc.cyan("#" + tc.id)}${lvl}${dep}  ${tc.description}`);
      if (tc.given) console.log(pc.dim(`        given: ${tc.given}`));
      if (tc.when) console.log(pc.dim(`        when:  ${tc.when}`));
      if (tc.then) console.log(pc.dim(`        then:  ${tc.then}`));
      if (tc.steps) {
        const indented = tc.steps.split("\n").map((l) => "          " + l).join("\n");
        console.log(pc.dim(`        steps:\n${indented}`));
      }
    }
  }
  console.log("");
  console.log(pc.dim(`  Tip: edit the claim, notes, or test cases by talking. /back to return to the summary.`));
  console.log("");
}
