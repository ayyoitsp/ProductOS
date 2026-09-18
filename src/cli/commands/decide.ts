import { Command } from "commander";
import pc from "picocolors";
import os from "node:os";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { isUndefinedBehavior, readFeatureById, writeFeature } from "../../core/product.js";

/**
 * `productos decide <container> <behavior>` — answer an open question in place.
 *
 * ⛔ THIS IS THE VERB A PRODUCT MANAGER DID NOT HAVE. Open questions were first-class
 * and answering them was not: every affordance beside a behavior routed to an agent, so
 * a PM's decision became free text in a queue. A fresh reviewer put it exactly:
 *
 *   "The site holds open questions well — each with the reason it is open and what it
 *    blocks. Answering them is my job. There is no way to do it. There is no place to
 *    record *I, the PM, decided this, on this date, and here is why* — at the feature
 *    level. Decisions of exactly that shape exist on the strategy page, with a date, a
 *    rationale and an also-considered list, and they are excellent. They are just not
 *    available where the question is asked."
 *
 * The question is kept, not deleted, so the next reader can tell this claim settled a
 * real disagreement rather than never having been in doubt.
 */
export function decideCommand(): Command {
  return new Command("decide")
    .description("Answer an open question — records the claim, who decided, and why")
    .argument("<container>", "Feature or capability id, e.g. cre/pricing/deal-pricing")
    .argument("<behavior>", "The undecided behavior's id")
    .requiredOption("--claim <claim>", "What the product does, now that it is decided")
    .requiredOption("--because <why>", "Why this way, and what else was considered")
    .option("--by <who>", "Who decided (defaults to your username)")
    .option("--on <date>", "When it was decided (defaults to today)")
    .action(
      (
        containerId: string,
        behaviorId: string,
        opts: { claim: string; because: string; by?: string; on?: string }
      ) => {
        const paths = resolvePathsOrThrow();
        const doc = readFeatureById(paths, containerId);
        if (!doc) {
          console.error(pc.red("✗"), `No feature or capability "${containerId}".`);
          process.exit(1);
        }

        const b = doc.frontmatter.behaviors.find((x) => x.id === behaviorId);
        if (!b) {
          const open = doc.frontmatter.behaviors.filter(isUndefinedBehavior).map((x) => x.id);
          console.error(pc.red("✗"), `No behavior "${behaviorId}" in ${containerId}.`);
          if (open.length) console.error(pc.dim(`  Undecided here: ${open.join(", ")}`));
          process.exit(1);
        }

        if (!isUndefinedBehavior(b)) {
          // ⛔ Not a way to reword a settled claim. Overwriting a decided claim through
          // the decide verb would fabricate a decision record for a question nobody
          // asked, which is worse than having no record.
          console.error(pc.red("✗"), `"${behaviorId}" is not an open question.`);
          console.error(
            pc.dim(
              b.answers
                ? `  It was already decided by ${b.decided_by ?? "someone"}. To change it, edit the claim — do not re-decide it.`
                : `  It already carries a claim. Editing a settled claim is an edit, not a decision.`
            )
          );
          process.exit(1);
        }

        const claim = opts.claim.trim();
        if (claim.length < 10) {
          console.error(pc.red("✗"), "A claim needs to be a real sentence.");
          process.exit(1);
        }

        b.answers = b.question;
        b.claim = claim;
        b.because = opts.because.trim();
        b.decided_by = opts.by ?? os.userInfo().username;
        b.decided_at = opts.on ?? new Date().toISOString().slice(0, 10);
        delete b.question;
        delete b.asked_of;
        delete b.asked_at;
        // ⛔ `blocks` belongs to a QUESTION. A decided behavior that still claims to
        // block three others is telling a planner the work is stalled on something that
        // was settled — and the whole point of `blocks` is being trustworthy about what
        // is stopping the build.
        delete b.blocks;

        // ⛔ Deliberately NOT accepted by this. Deciding what the product does and
        // confirming a written claim is what the team intends are two acts; collapsing
        // them would let one command both write a claim and bless it.
        writeFeature(paths, doc);

        console.log(pc.green("✓"), `Decided ${pc.cyan(containerId)} · ${behaviorId}`);
        console.log(`  ${claim}`);
        console.log(pc.dim(`  ${b.decided_by} on ${b.decided_at}`));
        const stillOpen = doc.frontmatter.behaviors.filter(isUndefinedBehavior).length;
        console.log(
          pc.dim(
            stillOpen
              ? `\n${stillOpen} question${stillOpen === 1 ? "" : "s"} still open here. The claim is awaiting review — accept it with \`productos verify\`.`
              : `\nNothing else is undecided here. The claim is awaiting review — accept it with \`productos verify\`.`
          )
        );
      }
    );
}
