import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { resolvePathsOrThrow, pathsAtCorpus } from "../../core/paths.js";
import { looksLikeInstance, instanceOf, documents, putDocument } from "../../v2/client.js";
import {
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
 * The gap record of a HOSTED corpus, read, changed, and sent back through the one door.
 *
 * ⛔ THIS EXISTS BECAUSE THREE ROLES IN ONE AFTERNOON COULD NOT FILE WHAT THEY FOUND. Each was
 * working the hosted corpus, each hit something the model gave them no way to say, and each
 * reported the same two walls: `--at` resolved the url as a DIRECTORY —
 * `No corpus at /Users/peter/personal/productos/http:/127.0.0.1:4100/...` — and the door refused
 * the document. So each wrote the gap into a report and said, correctly, that filing it against
 * ProductOS's own record instead would put a consumer corpus's findings in the wrong repository,
 * which is the misfiling `--at` was added to prevent. Their gaps survived only because a person
 * read a report, and `forced_into` — the field that makes a compromise correctable in one pass
 * instead of becoming the convention — was never written down at all.
 *
 * ⛔ ONE DOCUMENT, NOT A CORPUS. What lands on disk is `framework-gaps.yaml` alone, in a temp
 * directory thrown away before this returns. A writable local copy of a hosted corpus is the thing
 * this project forbids by name; a single document held for the length of one call is not that, and
 * the alternative — reimplementing the numbering, the dedup and the file shape against the wire —
 * would be the same logic in a second home, which is what `recordFrameworkGap` exists to avoid.
 */
async function throughTheDoor<T>(
  url: string,
  token: string | undefined,
  change: (paths: ReturnType<typeof pathsAtCorpus>) => T
): Promise<T> {
  const i = instanceOf(url, token);
  let files: Record<string, string>;
  try {
    files = await documents(i);
  } catch (e) {
    console.error(pc.red("✗"), `could not read the corpus at ${url}: ${(e as Error).message}`);
    process.exit(1);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "productos-gap-"));
  try {
    const key = "framework-gaps.yaml";
    const was = files[key];
    if (was !== undefined) fs.writeFileSync(path.join(dir, key), was);
    const paths = pathsAtCorpus(dir);
    const out = change(paths);
    const now = fs.existsSync(path.join(dir, key)) ? fs.readFileSync(path.join(dir, key), "utf-8") : undefined;
    /** ⛔ Sent only if it moved, so a read never writes and an unchanged record is not rewritten. */
    if (now !== undefined && now !== was) {
      const r = await putDocument(i, key, now);
      if (!r.ok) {
        console.error(pc.red("✗"), `the gap was not recorded: ${r.why ?? "refused"}`);
        process.exit(1);
      }
      console.log(pc.dim(`  ${key} → ${url}`));
    }
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Where a gap is being recorded, said in one phrase — a url, or the file it lands in. */
const recordedIn = (opts: { at?: string }, paths: ReturnType<typeof pathsAtCorpus>): string =>
  looksLikeInstance(opts.at) ? opts.at! : gapsFilePath(paths);

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
/**
 * The open gaps, printed.
 *
 * ⛔ ONE IMPLEMENTATION, because the hosted record and a directory's record are the same record in
 * two places. A second copy of this printing is a second place for the warning below to go missing
 * from, and that warning — a finished-looking backlog is the worst way for this file to fail — is
 * the whole reason the command is not just `cat`.
 */
function showGaps(paths: ReturnType<typeof pathsAtCorpus>, all: boolean, where: string): void {
      const gaps = readFrameworkGaps(paths).filter(
        (g) => all || (g.status !== "closed" && g.status !== "wont-fix")
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
          `\nRecorded in ${where} — ` +
            `fix ProductOS, then correct every \`forced_into\` in one pass.`
        )
      );
}

export function todoCommand(): Command {
  const cmd = new Command("todo").description(
    "Framework gaps — where the model couldn't express what the corpus needed (for ProductOS devs)"
  );

  cmd
    .command("list", { isDefault: true })
    .description("Show recorded framework gaps")
    .option("--all", "Include closed and won't-fix entries")
    .option("--at <corpus>", "The corpus — a directory, or an instance url (defaults to the repo you are standing in)")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (opts: { all?: boolean; at?: string; token?: string }) => {
      /** ⛔ Reading a hosted record is the same route; nothing is sent because nothing moves. */
      if (looksLikeInstance(opts.at)) {
        return await throughTheDoor(opts.at!, opts.token, (paths) => showGaps(paths, Boolean(opts.all), opts.at!));
      }
      const paths = recordFor(opts);
      return showGaps(paths, Boolean(opts.all), gapsFilePath(paths).replace(process.cwd() + "/", ""));
    });

  cmd
    .command("add")
    .description("Record a gap you hit by hand — something the model can't express")
    .argument("<what>", "What the framework cannot express")
    .option("--question <q>", "The decision we owe")
    .option("--evidence <ids...>", "Container or behavior ids that show it")
    .option("--forced-into <id>", "Where the content had to go meanwhile")
    .option("--at <corpus>", "The corpus this gap was found in — a directory, or an instance url (defaults to the repo you are standing in)")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (what: string, opts: { question?: string; evidence?: string[]; forcedInto?: string; at?: string; token?: string }) => {
      /** ⛔ A hosted corpus is reached through the door; a directory is written in place. */
      if (looksLikeInstance(opts.at)) {
        const g = await throughTheDoor(opts.at!, opts.token, (paths) =>
          recordFrameworkGap(paths, {
            detected_at: new Date().toISOString().slice(0, 10),
            detector: "authored",
            what,
            question: opts.question,
            evidence: opts.evidence ?? [],
            forced_into: opts.forcedInto,
          })
        );
        console.log(
          g
            ? pc.green("✓") + ` Recorded ${g.id} in ${pc.dim(opts.at!)}`
            : pc.dim(`Already recorded in ${opts.at}`)
        );
        return;
      }
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
