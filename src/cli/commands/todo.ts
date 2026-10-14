import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePathsOrThrow, pathsAtCorpus } from "../../core/paths.js";
import { listAllContainers } from "../../core/product.js";
import {
  detectFrameworkGaps,
  readFrameworkGaps,
  gapsFilePath,
  gapsWhoseFieldShipped,
  recordFrameworkGap,
  settleFrameworkGap,
} from "../../core/framework-gaps.js";

/**
 * The schema sources a shipped field could be declared in.
 *
 * ⛔ IT READ `core/product.ts` ALONE, AND EVERY FIELD ADDED THIS YEAR LANDS IN
 * `v2/schema.ts`. So the check that exists to notice a closed gap was looking in a file
 * where the answer could not appear. Both, now, and the union is what counts as shipped.
 */
function schemaSources(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = ["core/product.ts", "v2/schema.ts"].flatMap((rel) => [
    path.resolve(here, "../../", rel),
    path.resolve(here, "../../../src", rel),
  ]);
  return candidates
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p, "utf-8"))
    .join("\n");
}

/**
 * ⛔ THIS RAN ONLY UNDER `scan`, AND `todo` IS THE VERB EVERYBODY TYPES. Reading the
 * backlog never mentioned that an entry might already be closed — so a gap whose field
 * shipped stayed on the list until somebody happened to run the recording verb.
 */
function warnAboutGapsThatMayBeClosed(gaps: Parameters<typeof gapsWhoseFieldShipped>[0]): void {
  const stale = gapsWhoseFieldShipped(gaps, schemaSources());
  if (!stale.length) return;
  console.log(
    pc.bold(pc.yellow(`\n${stale.length} open gap${stale.length === 1 ? "" : "s"} may already be closed`))
  );
  for (const { gap, fields } of stale) {
    console.log(
      `  ${pc.yellow("→")} ${gap.id} names ${fields.map((f: string) => pc.cyan(f)).join(", ")}, which now exist${fields.length === 1 ? "s" : ""}`
    );
    console.log(`    ${pc.dim(gap.what.split("\n")[0]?.slice(0, 100) ?? "")}`);
  }
  console.log(
    pc.dim(
      "\nCheck each: if the field answers the question, `productos todo close <id> --resolution \"…\"`.\nA shipped capability reported as missing keeps a compromise alive that nobody needs."
    )
  );
}


/**
 * Which record this gap belongs to.
 *
 * ⛔ `todo` WAS THE ONE VERB WITH NO `--at`, and it is the verb an author reaches for while
 * authoring a corpus that is not in the repo they are standing in. So it walked up from `cwd`
 * and filed the finding against whichever product lived there. Every other v2 command takes
 * `--at`; the asymmetry WAS the defect, not a missing convenience.
 */
function recordFor(opts: { at?: string }) {
  return opts.at ? pathsAtCorpus(opts.at) : resolvePathsOrThrow();
}

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
    .option("--at <corpus>", "The corpus this gap was found in (defaults to the repo you are standing in)")
    .action((opts: { all?: boolean; at?: string }) => {
      const paths = recordFor(opts);
      const gaps = readFrameworkGaps(paths).filter(
        (g) => opts.all || (g.status !== "closed" && g.status !== "wont-fix")
      );
      if (gaps.length === 0) {
        console.log(pc.dim("No open framework gaps. Run `productos todo scan` to look for new ones."));
        /**
         * ⛔ AND STILL WARN. "No open framework gaps" after a hand-edit broke this file
         * twice in one session — the record of what the model cannot express reading as a
         * finished backlog is the worst way for it to fail.
         */
        warnAboutGapsThatMayBeClosed(readFrameworkGaps(paths));
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
      warnAboutGapsThatMayBeClosed(gaps);
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
    .option("--at <corpus>", "The corpus this gap was found in (defaults to the repo you are standing in)")
    .action((opts: { at?: string }) => {
      const paths = recordFor(opts);
      const found = detectFrameworkGaps(listAllContainers(paths));
      let added = 0;
      for (const g of found) {
        if (recordFrameworkGap(paths, g)) added++;
      }

      // ⛔ And the other direction: gaps that have since been closed by shipped code. The
      // backlog of what the model cannot express is worthless if a third of it is stale,
      // and stale in the direction that keeps a compromise alive after the hole closed.
      warnAboutGapsThatMayBeClosed(readFrameworkGaps(paths));
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
    .option("--at <corpus>", "The corpus this gap was found in (defaults to the repo you are standing in)")
    .action((what: string, opts: { question?: string; evidence?: string[]; forcedInto?: string; at?: string }) => {
      const paths = recordFor(opts);
      const g = recordFrameworkGap(paths, {
        detected_at: new Date().toISOString().slice(0, 10),
        detector: "authored",
        what,
        question: opts.question,
        evidence: opts.evidence ?? [],
        forced_into: opts.forcedInto,
      });
      /**
       * ⛔ IT SAID "Recorded fg-0042" AND NOT WHERE. Thirty-three gaps went into the wrong
       * product's record and every one of them printed a confident tick. Naming the file is
       * what makes a misfiling visible in the moment somebody can still fix it.
       */
      console.log(
        g
          ? pc.green("✓") + ` Recorded ${g.id} in ${pc.dim(gapsFilePath(paths))}`
          : pc.dim(`Already recorded in ${gapsFilePath(paths)}`)
      );
    });

  /**
   * ⛔ CLOSING A GAP HAD NO COMMAND, SO IT WAS A HAND-EDIT — and the predictable thing
   * happened on the first session that closed several. Nine were marked closed by hand and
   * the tenth, whose fix had shipped and been verified in `main`, was left open and then
   * reported as closed.
   */
  cmd
    .command("close")
    .description("Settle a gap — the model can express it now, or it was never a gap")
    .argument("<id>", "The gap id, e.g. fg-0013")
    .requiredOption("--resolution <why>", "What changed, or why this is not a gap")
    .option("--accepted", "A known limitation we are living with, rather than fixed")
    .option("--wont-fix", "Not going to be addressed")
    .option("--at <corpus>", "The corpus this gap was found in (defaults to the repo you are standing in)")
    .action((id: string, opts: { resolution: string; accepted?: boolean; wontFix?: boolean; at?: string }) => {
      const paths = recordFor(opts);
      const status = opts.wontFix ? "wont-fix" : opts.accepted ? "accepted" : "closed";
      try {
        const g = settleFrameworkGap(paths, id, status, opts.resolution);
        console.log(`${pc.green("✓")} ${g.id} is ${pc.bold(status)}`);
        /**
         * ⛔ AND IT SAYS WHAT IS STILL OWED. The code shipping is half of it: `forced_into`
         * names a compromise sitting in a corpus, and nothing else will ever go back for it.
         */
        if (g.forced_into) {
          console.log(pc.yellow(`\n  Still forced, and now fixable in one pass:`));
          console.log(`  ${g.forced_into}`);
        }
      } catch (e) {
        console.error(pc.red((e as Error).message));
        process.exitCode = 1;
      }
    });


  return cmd;
}
