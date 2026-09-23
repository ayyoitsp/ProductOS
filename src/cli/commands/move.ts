import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { MoveRefused, planMove, applyMove } from "../../core/move.js";
import fs from "node:fs";
import path from "node:path";

/** The title a moved container still carries, read from wherever the move left it. */
function titleOf(p: string): string | undefined {
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, "README.md") : p;
  if (!fs.existsSync(file)) return undefined;
  return /^title:\s*(.+?)\s*$/m.exec(fs.readFileSync(file, "utf-8"))?.[1]?.replace(/^["']|["']$/g, "");
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * `productos move <id> <destination>` — re-file a feature or an area.
 *
 * The whole-corpus move lives in `core/move.ts`; this is the surface for it. See
 * that file for why a partial move is never offered.
 */
export function moveCommand(): Command {
  return new Command("move")
    .description("Re-file a feature or area, repointing every reference to it")
    .argument("<id>", "what to move — a feature id, or an area id to move the whole area")
    .argument("<destination>", "the area or product to move it into")
    .option("--as <slug>", "rename the last segment while moving")
    .option("-n, --dry-run", "show what would change and write nothing")
    .action((id: string, destination: string, opts: { as?: string; dryRun?: boolean }) => {
      const paths = resolvePathsOrThrow();

      let plan;
      try {
        plan = planMove(paths, id, destination, opts.as);
      } catch (e) {
        if (e instanceof MoveRefused) {
          console.error(pc.red("✗"), e.message);
          console.error(pc.dim(`  ${e.why}`));
          process.exit(1);
        }
        throw e;
      }

      console.log(pc.bold(plan.moves.length === 1 ? "Move" : "Moves"));
      for (const m of plan.moves) {
        console.log(`  ${pc.dim(m.from_id)} ${pc.cyan("→")} ${m.to_id}`);
      }
      if (plan.edges.length) {
        console.log(pc.bold("\nReferences repointed"));
        for (const e of plan.edges) {
          console.log(`  ${pc.cyan(e.where)} ${pc.dim(e.field)}: ${e.from} → ${e.to}`);
        }
      } else {
        console.log(pc.dim("\nNothing points at this."));
      }

      if (opts.dryRun) {
        console.log(pc.dim("\nDry run — nothing written."));
        return;
      }

      applyMove(paths, plan);
      console.log(
        pc.green("\n✓"),
        `Moved. ${plan.edges.length} reference${plan.edges.length === 1 ? "" : "s"} repointed.`
      );

      /**
       * ⛔ A RENAMED SLUG WITH ITS OLD TITLE IS A CORPUS SAYING TWO THINGS.
       *
       * `--as versioned-inputs` on the CRE documents area left the id reading versioned-inputs and
       * the page still headed "Document review". A move cannot know the new title — that is a
       * product decision and guessing it from a slug would be worse — but it knows for certain the
       * two no longer relate, and saying nothing is what lets the mismatch ship.
       */
      if (opts.as) {
        const title = titleOf(plan.root.to_path);
        if (title && slugify(title) !== opts.as) {
          console.log("");
          console.log(pc.yellow("!"), `the title still reads "${title}"`);
          console.log(pc.dim(`  the slug is now "${opts.as}". a title is a product decision, so this did not guess one —`));
          console.log(pc.dim(`  set it in the page's frontmatter and heading:`));
          console.log(pc.dim(`      ${path.relative(process.cwd(), plan.root.to_path)}`));
        }
      }
      console.log(pc.dim("Run `productos check` to confirm the corpus still conforms."));
    });
}
