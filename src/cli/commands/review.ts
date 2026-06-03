import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import matter from "gray-matter";
import YAML from "yaml";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  Behavior,
  FeatureDocument,
  FeatureFrontmatter,
  UxView,
  discardDraft,
  draftFilePath,
  listDrafts,
  promoteDraft,
  readDraftById,
  readFeatureById,
  writeDraft,
} from "../../core/product.js";

/**
 * Interactive review for a proposed feature draft.
 *
 * Drafts come from either `productos scan` (BYOK) or the Claude scope skill
 * (via the MCP write_draft_feature tool). Both write to productos/drafts/.
 * This command shows the draft as formatted text, lets the human keep/drop
 * individual UX views + behaviors, optionally open the whole draft in
 * $EDITOR for free-form changes, then accept (promote to products/) or
 * discard.
 */
export function reviewCommand(): Command {
  return new Command("review")
    .description("Interactively review a draft feature (from `productos scan` or the Claude scope skill) and promote it to product truth")
    .argument("[feature_id]", "Feature id like 'wallet/add-kid'. If omitted, pick from a list.")
    .option("--accept", "Skip the interactive flow and accept the draft as-is")
    .option("--discard", "Skip the interactive flow and discard the draft")
    .action(async (featureIdArg: string | undefined, opts: { accept?: boolean; discard?: boolean }) => {
      const paths = resolvePathsOrThrow();

      const drafts = listDrafts(paths);
      if (drafts.length === 0) {
        console.log(pc.dim("No drafts in productos/drafts/. Run `productos scan ...` first, or ask Claude to scope a feature."));
        return;
      }

      let featureId = featureIdArg;
      if (!featureId) {
        if (drafts.length === 1) {
          featureId = drafts[0].frontmatter.id;
          console.log(pc.dim(`Only one draft: ${featureId}`));
        } else {
          const picked = await p.select<string>({
            message: "Which draft do you want to review?",
            options: drafts.map((d) => ({
              value: d.frontmatter.id,
              label: d.frontmatter.id,
              hint: d.frontmatter.title,
            })),
          });
          if (p.isCancel(picked)) {
            p.cancel("Canceled.");
            return;
          }
          featureId = picked;
        }
      }

      const draft = readDraftById(paths, featureId);
      if (!draft) {
        console.error(pc.red("✗"), `No draft at ${path.relative(paths.repoRoot, draftFilePath(paths, featureId))}`);
        process.exit(1);
      }

      if (opts.discard) {
        discardDraft(paths, featureId);
        console.log(pc.green("✓"), `Discarded draft for ${featureId}`);
        return;
      }
      if (opts.accept) {
        await acceptDraft(paths, draft);
        return;
      }

      await interactiveReview(paths, draft);
    });
}

async function interactiveReview(paths: ReturnType<typeof resolvePathsOrThrow>, draftIn: FeatureDocument): Promise<void> {
  // Working copy — kept in memory until we save it back to the draft file.
  let draft = draftIn;

  while (true) {
    printDraft(draft);

    const choice = await p.select<string>({
      message: "What next?",
      options: [
        { value: "behaviors", label: "Trim behaviors", hint: `${draft.frontmatter.behaviors.length} declared` },
        { value: "ux", label: "Trim UX views", hint: `${draft.frontmatter.ux.length} declared` },
        { value: "editor", label: "Open the whole draft in $EDITOR" },
        { value: "accept", label: "Accept — promote to products/" },
        { value: "save", label: "Save changes to the draft (don't promote yet)" },
        { value: "discard", label: pc.red("Discard the draft") },
        { value: "quit", label: "Quit without saving" },
      ],
    });
    if (p.isCancel(choice) || choice === "quit") {
      p.cancel("Left draft unchanged.");
      return;
    }

    if (choice === "behaviors") {
      draft = await trimBehaviors(draft);
    } else if (choice === "ux") {
      draft = await trimUx(draft);
    } else if (choice === "editor") {
      const edited = await editInEditor(paths, draft);
      if (edited) draft = edited;
    } else if (choice === "save") {
      writeDraft(paths, draft);
      console.log(pc.green("✓"), `Saved draft. Run \`productos review ${draft.frontmatter.id}\` again to keep reviewing.`);
      return;
    } else if (choice === "discard") {
      const confirmed = await p.confirm({ message: `Really discard the draft for ${draft.frontmatter.id}?`, initialValue: false });
      if (p.isCancel(confirmed) || !confirmed) continue;
      discardDraft(paths, draft.frontmatter.id);
      console.log(pc.green("✓"), `Discarded.`);
      return;
    } else if (choice === "accept") {
      // Save the working copy first, then promote.
      writeDraft(paths, draft);
      await acceptDraft(paths, draft);
      return;
    }
  }
}

async function trimBehaviors(draft: FeatureDocument): Promise<FeatureDocument> {
  if (draft.frontmatter.behaviors.length === 0) {
    p.log.info("No behaviors to trim.");
    return draft;
  }
  const kept = await p.multiselect<string>({
    message: "Keep which behaviors? (uncheck to drop)",
    initialValues: draft.frontmatter.behaviors.map((b) => b.id),
    options: draft.frontmatter.behaviors.map((b) => ({
      value: b.id,
      label: `${b.id}`,
      hint: oneLine(b.claim),
    })),
    required: false,
  });
  if (p.isCancel(kept)) return draft;
  const next = { ...draft, frontmatter: { ...draft.frontmatter } };
  next.frontmatter.behaviors = draft.frontmatter.behaviors.filter((b) => kept.includes(b.id));
  return next;
}

async function trimUx(draft: FeatureDocument): Promise<FeatureDocument> {
  if (draft.frontmatter.ux.length === 0) {
    p.log.info("No UX views to trim.");
    return draft;
  }
  const kept = await p.multiselect<string>({
    message: "Keep which UX views? (uncheck to drop)",
    initialValues: draft.frontmatter.ux.map((u) => u.id),
    options: draft.frontmatter.ux.map((u) => ({
      value: u.id,
      label: `${u.id}`,
      hint: oneLine(u.title),
    })),
    required: false,
  });
  if (p.isCancel(kept)) return draft;
  const next = { ...draft, frontmatter: { ...draft.frontmatter } };
  next.frontmatter.ux = draft.frontmatter.ux.filter((u) => kept.includes(u.id));
  // Any behaviors that anchored to a dropped UX view stay — but their
  // `surface` reference now dangles. Clear it so the schema stays clean.
  const remainingIds = new Set(next.frontmatter.ux.map((u) => u.id));
  next.frontmatter.behaviors = next.frontmatter.behaviors.map((b) =>
    b.surface && !remainingIds.has(b.surface) ? { ...b, surface: undefined, element: undefined } : b
  );
  return next;
}

async function editInEditor(paths: ReturnType<typeof resolvePathsOrThrow>, draft: FeatureDocument): Promise<FeatureDocument | null> {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tmp = path.join(os.tmpdir(), `productos-review-${draft.frontmatter.id.replace(/[\/]/g, "-")}-${Date.now()}.md`);
  const fmStr = YAML.stringify(draft.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  fs.writeFileSync(tmp, `---\n${fmStr}---\n\n${draft.body.trim()}\n`, "utf-8");

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
    return { ...draft, frontmatter: fm, body: parsed.content.trim() };
  } catch (e) {
    p.log.error(`Couldn't parse edited draft: ${(e as Error).message}`);
    p.log.warn(`Your edits are preserved at ${path.relative(paths.repoRoot, tmp)} — fix the YAML and re-run review.`);
    return null;
  }
}

async function acceptDraft(paths: ReturnType<typeof resolvePathsOrThrow>, draft: FeatureDocument): Promise<void> {
  // If the canonical already exists, force-overwrite requires a confirm.
  const existing = readFeatureById(paths, draft.frontmatter.id);
  if (existing) {
    const force = await p.confirm({
      message: `${draft.frontmatter.id} already exists in products/. Overwrite with the draft?`,
      initialValue: false,
    });
    if (p.isCancel(force) || !force) {
      p.cancel("Canceled — draft kept in drafts/.");
      return;
    }
    const { to } = promoteDraft(paths, draft.frontmatter.id, { force: true });
    console.log(pc.green("✓"), `Replaced ${path.relative(paths.repoRoot, to)} from draft.`);
  } else {
    const { to } = promoteDraft(paths, draft.frontmatter.id);
    console.log(pc.green("✓"), `Promoted draft → ${path.relative(paths.repoRoot, to)}`);
  }
  console.log(pc.dim("View it: productos serve"));
}

// ---------------------------------------------------------------------------
// Pretty printer for the draft

function printDraft(draft: FeatureDocument): void {
  const fm = draft.frontmatter;
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

// Suppress unused-warning for types that are only referenced via inference
void Behavior;
void UxView;
