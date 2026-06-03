import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import matter from "gray-matter";
import YAML from "yaml";
import { resolvePathsOrThrow, ProductosPaths } from "../../core/paths.js";
import {
  FeatureDocument,
  FeatureFrontmatter,
  featureFilePath,
  listFeatures,
  readFeatureById,
  writeFeature,
} from "../../core/product.js";

/**
 * Interactive review/edit for a feature.
 *
 * The file at productos/products/<id>.md IS the feature. There's no draft
 * layer. Review opens it, lets the human trim behaviors/UX views or open
 * the file in $EDITOR, and writes changes back to the same file. Git is
 * the commit boundary — re-run review as often as you want before
 * committing.
 *
 * If no feature_id is given, list features sorted by recent edits.
 */
export function reviewCommand(): Command {
  return new Command("review")
    .description("Interactively review and edit a feature in productos/products/")
    .argument("[feature_id]", "Feature id like 'wallet/add-kid'. If omitted, pick from a list.")
    .action(async (featureIdArg: string | undefined) => {
      const paths = resolvePathsOrThrow();

      let featureId = featureIdArg;
      if (!featureId) {
        const features = listFeatures(paths);
        if (features.length === 0) {
          console.log(pc.dim("No features yet. Run `productos scan <area/slug> \"<hint>\"` to create one, or ask Claude to scope a feature."));
          return;
        }
        // Sort by mtime, most recent first — "what did I just touch" UX.
        const withMtime = features.map((f) => ({
          f,
          mtime: fs.statSync(f.filepath).mtimeMs,
        }));
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

      await interactiveReview(paths, feature);
    });
}

async function interactiveReview(paths: ProductosPaths, featureIn: FeatureDocument): Promise<void> {
  // Working copy — kept in memory until the user saves it.
  let feature = featureIn;
  let dirty = false;

  while (true) {
    printFeature(feature);

    const choice = await p.select<string>({
      message: dirty ? pc.yellow("Unsaved changes. What next?") : "What next?",
      options: [
        { value: "behaviors", label: "Trim behaviors", hint: `${feature.frontmatter.behaviors.length} declared` },
        { value: "ux", label: "Trim UX views", hint: `${feature.frontmatter.ux.length} declared` },
        { value: "editor", label: "Open in $EDITOR (full file)" },
        ...(dirty
          ? [{ value: "save", label: pc.green("Save changes") }]
          : []),
        { value: "quit", label: dirty ? pc.dim("Quit without saving") : "Quit" },
      ],
    });
    if (p.isCancel(choice) || choice === "quit") {
      if (dirty) {
        const confirmed = await p.confirm({
          message: "Discard unsaved changes?",
          initialValue: false,
        });
        if (p.isCancel(confirmed) || !confirmed) continue;
      }
      return;
    }

    if (choice === "behaviors") {
      const next = await trimBehaviors(feature);
      if (next !== feature) { feature = next; dirty = true; }
    } else if (choice === "ux") {
      const next = await trimUx(feature);
      if (next !== feature) { feature = next; dirty = true; }
    } else if (choice === "editor") {
      const edited = await editInEditor(paths, feature);
      if (edited) { feature = edited; dirty = true; }
    } else if (choice === "save") {
      writeFeature(paths, feature);
      dirty = false;
      console.log(pc.green("✓"), `Saved ${path.relative(paths.repoRoot, feature.filepath || featureFilePath(paths, feature.frontmatter.id))}`);
    }
  }
}

async function trimBehaviors(feature: FeatureDocument): Promise<FeatureDocument> {
  if (feature.frontmatter.behaviors.length === 0) {
    p.log.info("No behaviors to trim.");
    return feature;
  }
  const kept = await p.multiselect<string>({
    message: "Keep which behaviors? (uncheck to drop)",
    initialValues: feature.frontmatter.behaviors.map((b) => b.id),
    options: feature.frontmatter.behaviors.map((b) => ({
      value: b.id,
      label: b.id,
      hint: oneLine(b.claim),
    })),
    required: false,
  });
  if (p.isCancel(kept)) return feature;
  if (kept.length === feature.frontmatter.behaviors.length) return feature;
  const next: FeatureDocument = { ...feature, frontmatter: { ...feature.frontmatter } };
  next.frontmatter.behaviors = feature.frontmatter.behaviors.filter((b) => kept.includes(b.id));
  return next;
}

async function trimUx(feature: FeatureDocument): Promise<FeatureDocument> {
  if (feature.frontmatter.ux.length === 0) {
    p.log.info("No UX views to trim.");
    return feature;
  }
  const kept = await p.multiselect<string>({
    message: "Keep which UX views? (uncheck to drop)",
    initialValues: feature.frontmatter.ux.map((u) => u.id),
    options: feature.frontmatter.ux.map((u) => ({
      value: u.id,
      label: u.id,
      hint: oneLine(u.title),
    })),
    required: false,
  });
  if (p.isCancel(kept)) return feature;
  if (kept.length === feature.frontmatter.ux.length) return feature;
  const next: FeatureDocument = { ...feature, frontmatter: { ...feature.frontmatter } };
  next.frontmatter.ux = feature.frontmatter.ux.filter((u) => kept.includes(u.id));
  // Any behaviors that anchored to a dropped UX view now dangle — clear
  // the anchor so the schema stays clean.
  const remainingIds = new Set(next.frontmatter.ux.map((u) => u.id));
  next.frontmatter.behaviors = next.frontmatter.behaviors.map((b) =>
    b.surface && !remainingIds.has(b.surface) ? { ...b, surface: undefined, element: undefined } : b
  );
  return next;
}

async function editInEditor(paths: ProductosPaths, feature: FeatureDocument): Promise<FeatureDocument | null> {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tmp = path.join(os.tmpdir(), `productos-review-${feature.frontmatter.id.replace(/[\/]/g, "-")}-${Date.now()}.md`);
  const fmStr = YAML.stringify(feature.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  fs.writeFileSync(tmp, `---\n${fmStr}---\n\n${feature.body.trim()}\n`, "utf-8");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [tmp], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`editor exited ${code}`))));
    child.on("error", reject);
  }).catch((e) => {
    p.log.error(`Editor failed: ${(e as Error).message}`);
  });

  try {
    const raw = fs.readFileSync(tmp, "utf-8");
    const parsed = matter(raw);
    const fm = FeatureFrontmatter.parse(parsed.data);
    fs.unlinkSync(tmp);
    return { ...feature, frontmatter: fm, body: parsed.content.trim() };
  } catch (e) {
    p.log.error(`Couldn't parse edited file: ${(e as Error).message}`);
    p.log.warn(`Your edits are preserved at ${path.relative(paths.repoRoot, tmp)} — fix the YAML and re-run review.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pretty printer

function printFeature(feature: FeatureDocument): void {
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
      if (u.elements.length > 0) {
        const summary = u.elements.map((e) => `${e.id}:${e.kind}` + (e.leads_to ? `→${e.leads_to}` : "")).join(", ");
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
