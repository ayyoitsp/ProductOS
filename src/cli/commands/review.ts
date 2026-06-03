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
      console.log(pc.dim(`Reviewing via ${byok.provider}/${byok.model}. Type plain English. Slash commands: /save /quit /reset /help`));
      await repl(paths, byok, feature);
    });
}

async function repl(paths: ProductosPaths, byok: ResolvedByok, featureIn: FeatureDocument): Promise<void> {
  let feature = featureIn;
  const initial = featureIn;
  let dirty = false;
  let history: ModelMessage[] = [];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => {}); // we control exit explicitly

  try {
    while (true) {
      renderFeature(feature);
      const prompt = dirty ? pc.yellow("You> ") : pc.cyan("You> ");
      const input = (await rl.question(prompt)).trim();
      if (!input) continue;

      if (input.startsWith("/")) {
        const result = await handleSlash(input, { paths, feature, dirty, initial });
        if (result.kind === "exit") return;
        if (result.kind === "replace") {
          feature = result.feature;
          dirty = result.dirty;
          history = [];
        }
        continue;
      }

      // Natural-language turn → BYOK
      console.log(pc.dim(`(thinking via ${byok.provider}/${byok.model}…)`));
      const turn = await editFeatureTurn({
        feature, userMessage: input, history, paths, byok,
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
  | { kind: "replace"; feature: FeatureDocument; dirty: boolean };

async function handleSlash(
  input: string,
  ctx: { paths: ProductosPaths; feature: FeatureDocument; dirty: boolean; initial: FeatureDocument }
): Promise<SlashResult> {
  const [cmd] = input.slice(1).split(/\s+/, 1);
  const c = cmd.toLowerCase();

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
    console.log("  /save              Write changes to disk");
    console.log("  /reset             Discard changes and reload from disk");
    console.log("  /quit              Exit (warns on unsaved changes)");
    console.log("  /help              This message");
    console.log("");
    console.log(pc.dim("Anything else you type is sent to the AI editor. Examples:"));
    console.log(pc.dim("  drop the second behavior"));
    console.log(pc.dim("  the leads_to on save-btn should point to confirmation-page"));
    console.log(pc.dim("  add a behavior for the empty state when no kids exist"));
    console.log(pc.dim("  set the status to shipped"));
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
  if (fm.affected_by.length > 0) {
    console.log("");
    console.log(pc.bold("  Affected by:"), fm.affected_by.join(", "));
  }
  if (fm.ux.length > 0) {
    console.log("");
    console.log(pc.bold("  UX views:"));
    for (const u of fm.ux) {
      console.log(`    ${pc.cyan(u.id)} — ${u.title}` + (u.path ? pc.dim(`  (${u.path})`) : ""));
      if (u.sketch) {
        const indented = u.sketch.split("\n").map((l) => "      " + l).join("\n");
        console.log(pc.dim(indented));
      }
      if (u.elements.length > 0) {
        const summary = u.elements.map((e) => {
          const lead = e.leads_to ? pc.dim(`→${e.leads_to}`) : "";
          return `${e.id}:${e.kind}${lead}`;
        }).join(", ");
        console.log(pc.dim(`      elements: ${summary}`));
      }
    }
  }
  if (fm.behaviors.length > 0) {
    console.log("");
    console.log(pc.bold("  Behaviors:"));
    for (const b of fm.behaviors) {
      const anchor = b.surface ? pc.dim(`  [${b.surface}${b.element ? "." + b.element : ""}${b.interaction ? " " + b.interaction : ""}]`) : "";
      console.log(`    ${pc.cyan(b.id)}${anchor}`);
      console.log(`      ${oneLine(b.claim, 100)}`);
      if (b.test_cases.length > 0) {
        console.log(pc.dim(`      test cases: ${b.test_cases.length}`));
      }
    }
  }
  console.log("");
}

function oneLine(s: string, max = 80): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "…";
}
