import { Command } from "commander";
import pc from "picocolors";
import { noticedIn, recordsIn, type Lesson } from "../../core/learn.js";

/**
 * `productos learn` — what the record of corrections says about how this project works.
 *
 * ⛔ ONE VERB, NOT `learn` AND `learn scan`. `todo` has both because a framework gap is STORED:
 * scanning records something a later read picks up. Nothing here is stored — every finding is
 * arithmetic over `changes/`, recomputed each time, so a second verb that "scans into" nothing
 * would be two names for one act and a store somebody would eventually expect to be authoritative.
 *
 * ⛔ AND IT WRITES NOTHING. Not a lesson, not a steer, not a line of anybody's instructions. What
 * this prints is an argument addressed to a person; the one boundary this project has not crossed
 * is an agent editing its own instructions, and it stays uncrossed because the thing that notices
 * has no way to write.
 */
export function learnCommand(): Command {
  const cmd = new Command("learn").description(
    "What the record of feedback says about how this project works — computed, never written back"
  );

  cmd
    .option("--at <dir>", "the repo whose change records to read", ".")
    .option("--json", "the whole answer, for a relay rather than a person")
    .action((o: { at?: string; json?: boolean }) => {
      const root = o.at ?? ".";
      const recs = recordsIn(root);
      if (!recs.length) {
        console.log(pc.dim("no change records here — nothing to learn from yet"));
        console.log(pc.dim('  productos v2 change new "<what somebody said>" --kind <kind>'));
        return;
      }
      const found = noticedIn(recs);
      if (o.json) {
        console.log(JSON.stringify({ read: recs.length, lessons: found }, null, 2));
        return;
      }

      console.log("");
      console.log(`${pc.bold(String(recs.length))} changes read${pc.dim(`, ${recs.filter((r) => r.closed).length} closed`)}`);
      if (!found.length) {
        console.log("");
        console.log(pc.dim("nothing recurs often enough to be a pattern yet"));
        console.log(pc.dim("  ⛔ which is not the same as nothing being wrong — this reads structure, never prose"));
        console.log("");
        return;
      }

      for (const l of found) {
        console.log("");
        console.log(`${pc.yellow("▸")} ${l.what}`);
        /**
         * ⛔ THE RECORDS ARE PRINTED, AND NEVER SILENTLY CAPPED. A finding you cannot go and read is
         * a number that looks like information. Where the list is long it says how many it is not
         * showing, so "covered everything" is never implied by a list that stopped.
         */
        const show = l.drawn_from.slice(0, 12);
        console.log(
          pc.dim(`  ${show.join(" ")}${l.drawn_from.length > show.length ? ` … and ${l.drawn_from.length - show.length} more` : ""}`)
        );
        console.log(pc.dim(`  ${l.not}`));
      }
      console.log("");
      /**
       * ⛔ THE TWO OUTLETS, NAMED — because a finding with nowhere to go gets read and forgotten,
       * which is the state this whole command was built to end.
       */
      console.log(pc.dim("where one of these leads:"));
      console.log(pc.dim("  universal  → productos v2 change new \"<what was said>\" --kind instruction"));
      console.log(pc.dim("  this project only → productos v2 steer new \"<the habit>\" --steers generation --learned-from \"<these records>\""));
      console.log("");
    });

  return cmd;
}

export type { Lesson };
