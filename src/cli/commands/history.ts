import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listFeatureSnapshots, restoreFeatureSnapshot } from "../../core/product.js";

/**
 * `productos history <feature_id>`         — list recent snapshots
 * `productos undo <feature_id> [index]`    — restore one (default: most recent)
 *
 * Snapshots are taken automatically before each edit and stored under
 * productos/.local/history/<id>/<timestamp>.md (gitignored).
 */

export function historyCommand(): Command {
  return new Command("history")
    .description("List recent snapshots of a feature taken before each edit")
    .argument("<feature_id>", "Feature id like 'wallet/kid-balance'")
    .option("-n, --limit <n>", "Limit how many snapshots to list", "10")
    .action((featureId: string, opts: { limit: string }) => {
      const paths = resolvePathsOrThrow();
      const limit = Math.max(1, parseInt(opts.limit, 10) || 10);
      const snaps = listFeatureSnapshots(paths, featureId).slice(0, limit);
      if (snaps.length === 0) {
        console.log(pc.dim(`No edit history for ${featureId}.`));
        return;
      }
      console.log(pc.bold(`History for ${featureId}:`));
      for (let i = 0; i < snaps.length; i++) {
        const s = snaps[i];
        console.log(`  ${pc.cyan(String(i + 1).padStart(2, " "))}  ${s.timestamp}  ${pc.dim("(" + formatAge(s.age_seconds) + " ago)")}`);
      }
      console.log("");
      console.log(pc.dim(`productos undo ${featureId}        # restore #1 (most recent)`));
      console.log(pc.dim(`productos undo ${featureId} <n>    # restore #n`));
    });
}

export function undoCommand(): Command {
  return new Command("undo")
    .description("Restore a previous on-disk version of a feature")
    .argument("<feature_id>", "Feature id like 'wallet/kid-balance'")
    .argument("[index]", "Snapshot index (1 = most recent, default)", "1")
    .action((featureId: string, indexStr: string) => {
      const paths = resolvePathsOrThrow();
      const index = Math.max(1, parseInt(indexStr, 10) || 1);
      try {
        const restored = restoreFeatureSnapshot(paths, featureId, index);
        console.log(pc.green("✓"), `Restored ${featureId} to ${restored.timestamp} (${formatAge(restored.age_seconds)} old).`);
        console.log(pc.dim("Run again to walk further back through history."));
      } catch (e) {
        console.error(pc.red("✗"), (e as Error).message);
        process.exit(1);
      }
    });
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
