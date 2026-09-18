import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { MoveRefused, planMove, applyMove } from "../../core/move.js";

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
      console.log(pc.dim("Run `productos check` to confirm the corpus still conforms."));
    });
}
