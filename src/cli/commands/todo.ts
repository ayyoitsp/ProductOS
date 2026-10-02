import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listAllContainers } from "../../core/product.js";
import {
  detectFrameworkGaps,
  readFrameworkGaps,
  gapsWhoseFieldShipped,
  recordFrameworkGap,
} from "../../core/framework-gaps.js";

/**
 * `productos todo` — framework gaps, addressed to ProductOS's developers.
 *
 * Separate from `productos gaps` on purpose. `gaps` is the user's queue: things
 * THEY should act on. This is ours: places the model could not express what the
 * corpus needed, and where the content had to go meanwhile.
 *
 * ⛔ `--scan` records rather than prints. A gap that is only ever printed is a
 * gap that is rediscovered from scratch every session, which is exactly how the
 * same five framework holes got hand-patched five separate times.
 */
export function todoCommand(): Command {
  const cmd = new Command("todo").description(
    "Framework gaps — where the model couldn't express what the corpus needed (for ProductOS devs)"
  );

  cmd
    .command("list", { isDefault: true })
    .description("Show recorded framework gaps")
    .option("--all", "Include closed and won't-fix entries")
    .action((opts: { all?: boolean }) => {
      const paths = resolvePathsOrThrow();
      const gaps = readFrameworkGaps(paths).filter(
        (g) => opts.all || (g.status !== "closed" && g.status !== "wont-fix")
      );
      if (gaps.length === 0) {
        console.log(pc.dim("No open framework gaps. Run `productos todo scan` to look for new ones."));
        return;
      }
      console.log(pc.bold(`${gaps.length} framework gap${gaps.length === 1 ? "" : "s"}`));
      for (const g of gaps) {
        const tone = g.status === "open" ? pc.yellow : pc.cyan;
        console.log(`\n${tone("●")} ${pc.bold(g.id)} ${pc.dim(`[${g.detector}] ${g.status}`)}`);
        console.log(`  ${g.what}`);
        if (g.question) console.log(`  ${pc.dim("decide:")} ${g.question}`);
        if (g.forced_into) console.log(`  ${pc.dim("forced into:")} ${g.forced_into}`);
        for (const e of g.evidence) console.log(`  ${pc.dim("·")} ${pc.cyan(e)}`);
      }
      console.log(
        pc.dim(
          `\nRecorded in ${paths.root.replace(process.cwd() + "/", "")}/framework-gaps.yaml — ` +
            `fix ProductOS, then correct every \`forced_into\` in one pass.`
        )
      );
    });

  cmd
    .command("scan")
    .description("Look for forced fits in this corpus and record any new ones")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const found = detectFrameworkGaps(listAllContainers(paths));
      let added = 0;
      for (const g of found) {
        if (recordFrameworkGap(paths, g)) added++;
      }

      // ⛔ And the other direction: gaps that have since been closed by shipped code. The
      // backlog of what the model cannot express is worthless if a third of it is stale,
      // and stale in the direction that keeps a compromise alive after the hole closed.
      const here = path.dirname(fileURLToPath(import.meta.url));
      const schemaPath = [
        path.resolve(here, "../../core/product.ts"),
        path.resolve(here, "../../../src/core/product.ts"),
      ].find((x) => fs.existsSync(x));
      if (schemaPath) {
        const stale = gapsWhoseFieldShipped(
          readFrameworkGaps(paths),
          fs.readFileSync(schemaPath, "utf-8")
        );
        if (stale.length) {
          console.log(
            pc.bold(pc.yellow(`\n${stale.length} open gap${stale.length === 1 ? "" : "s"} may already be closed`))
          );
          for (const { gap, fields } of stale) {
            console.log(`  ${pc.yellow("→")} ${gap.id} names ${fields.map((f: string) => pc.cyan(f)).join(", ")}, which now exist${fields.length === 1 ? "s" : ""}`);
            console.log(`    ${pc.dim(gap.what.split("\n")[0]?.slice(0, 100) ?? "")}`);
          }
          console.log(
            pc.dim(
              "\nCheck each: if the field answers the question, close it with a resolution. A shipped capability reported as missing keeps a compromise alive that nobody needs."
            )
          );
        }
      }
      console.log(
        added === 0
          ? pc.dim(`Scanned: ${found.length} forced fit(s) found, all already recorded.`)
          : pc.green(`✓ Recorded ${added} new framework gap${added === 1 ? "" : "s"}.`)
      );
      if (found.length) console.log(pc.dim("  productos todo   — to read them"));
    });

  cmd
    .command("add")
    .description("Record a gap you hit by hand — something the model can't express")
    .argument("<what>", "What the framework cannot express")
    .option("--question <q>", "The decision we owe")
    .option("--evidence <ids...>", "Container or behavior ids that show it")
    .option("--forced-into <id>", "Where the content had to go meanwhile")
    .action((what: string, opts: { question?: string; evidence?: string[]; forcedInto?: string }) => {
      const paths = resolvePathsOrThrow();
      const g = recordFrameworkGap(paths, {
        detected_at: new Date().toISOString().slice(0, 10),
        detector: "authored",
        what,
        question: opts.question,
        evidence: opts.evidence ?? [],
        forced_into: opts.forcedInto,
      });
      console.log(g ? pc.green("✓") + ` Recorded ${g.id}` : pc.dim("Already recorded."));
    });

  return cmd;
}
