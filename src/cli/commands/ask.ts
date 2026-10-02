import { Command } from "commander";
import pc from "picocolors";
import os from "node:os";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { isUndefinedBehavior, readFeatureById, writeFeature } from "../../core/product.js";

/**
 * `productos ask` and `productos read` — the two verbs a READER did not have.
 *
 * ⛔ Every affordance on a behavior belonged to the page's owner or routed to an agent,
 * and a reviewer laid out exactly what that cost:
 *
 *   "The corpus has a beautiful shape for this: an undecided behavior with a question,
 *    an owner, and a blocks-list. Reading the site, I can see exactly what my finding
 *    should look like as an artifact. I cannot make one. A reader's question and an
 *    author's question are the same kind of object and only the author can create it.
 *    So my highest-cost question went in as a prose comment on someone else's claim,
 *    with no owner, no blocks-list, and no way to show up in the undecided count a
 *    planner reads."
 *
 * The person who finds the hole is, by definition, not the person who wrote the page
 * without noticing it. So these commands take a reader's finding and make it the same
 * first-class object an author's would be.
 */
export function askCommand(): Command {
  const cmd = new Command("ask").description(
    "Raise something as a reader — an ambiguity, a question, or a proposal"
  );

  cmd
    .command("ambiguous")
    .description("This claim is decided and two people would build it differently")
    .argument("<container>", "Feature or capability id")
    .argument("<behavior>", "The behavior's id")
    .requiredOption(
      "-r, --reading <text...>",
      "One way it can be read. Pass at least twice."
    )
    .option("-c, --cost <text>", "What it costs to guess wrong")
    .option("--by <who>", "Who is raising it (defaults to your username)")
    .action(
      (
        containerId: string,
        behaviorId: string,
        opts: { reading: string[]; cost?: string; by?: string }
      ) => {
        const paths = resolvePathsOrThrow();
        const doc = readFeatureById(paths, containerId);
        if (!doc) fail(`No feature or capability "${containerId}".`);
        const b = doc!.frontmatter.behaviors.find((x) => x.id === behaviorId);
        if (!b) fail(`No behavior "${behaviorId}" in ${containerId}.`);

        if (isUndefinedBehavior(b!)) {
          // ⛔ Nothing is decided here, so there is no ambiguity to report — the page is
          // already saying it does not know. Flagging it would double-count the same
          // uncertainty in two states.
          fail(
            `"${behaviorId}" has no claim yet — it is already an open question.`,
            "Add to the question instead, or answer it with `productos decide`."
          );
        }
        if (opts.reading.length < 2) {
          fail(
            "An ambiguity needs at least two readings.",
            '"This is vague" is not a finding; "it could mean X or Y" is one somebody can rule on.'
          );
        }

        b!.ambiguous = [
          ...(b!.ambiguous ?? []),
          {
            readings: opts.reading,
            cost: opts.cost,
            raised_by: opts.by ?? os.userInfo().username,
            raised_at: new Date().toISOString().slice(0, 10),
          },
        ];
        writeFeature(paths, doc!);
        console.log(pc.green("✓"), `Flagged ${pc.cyan(containerId)} · ${behaviorId} as ambiguous`);
        opts.reading.forEach((r, i) => console.log(pc.dim(`  ${i + 1}. ${r}`)));
        console.log(
          pc.dim(
            "\nThe claim is untouched — this says it is underdetermined, not wrong. Resolve it by rewording the claim, or by splitting the readings into separate behaviors."
          )
        );
      }
    );

  cmd
    .command("question")
    .description("Raise a question on a container as a reader — becomes an undecided behavior")
    .argument("<container>", "Feature or capability id")
    .argument("<id>", "A kebab-case id for the question")
    .requiredOption("-q, --question <text>", "What is not decided")
    .requiredOption("--of <who>", "Who owes the answer")
    .option("-b, --blocks <ids...>", "Behavior ids that cannot be built until it is answered")
    .option("--propose <claim>", "What you think the answer is — a recommendation, not a ruling")
    .option("--because <why>", "Why you think so (required with --propose)")
    .option("--by <who>", "Who is asking (defaults to your username)")
    .action(
      (
        containerId: string,
        id: string,
        opts: {
          question: string;
          of: string;
          blocks?: string[];
          propose?: string;
          because?: string;
          by?: string;
        }
      ) => {
        const paths = resolvePathsOrThrow();
        const doc = readFeatureById(paths, containerId);
        if (!doc) fail(`No feature or capability "${containerId}".`);
        if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`"${id}" is not a kebab-case id.`);
        if (doc!.frontmatter.behaviors.some((x) => x.id === id)) {
          fail(`"${containerId}" already has a behavior "${id}".`);
        }
        if (opts.propose && !opts.because) {
          // ⛔ A recommendation without reasoning is just an opinion with extra steps,
          // and it is worse than a bare question: it anchors whoever rules on it without
          // giving them anything to weigh.
          fail(
            "--propose needs --because.",
            "A recommendation is only useful if the person ruling on it can see your reasoning."
          );
        }

        const by = opts.by ?? os.userInfo().username;
        // ⛔ A proposal goes in `notes`, NOT in `claim`. Filling in the claim would make
        // a reader's suggestion indistinguishable from a decision — exactly the thing an
        // undecided behavior exists to prevent. The recommendation is recorded, and the
        // behavior still reads as undecided until somebody rules.
        const notes = opts.propose
          ? `Proposed by ${by}: ${opts.propose}\n\nWhy: ${opts.because}\n\nThis is a recommendation, not a ruling. Settle it with \`productos decide\`.`
          : undefined;

        doc!.frontmatter.behaviors.push({
          id,
          claim: "",
          question: opts.question,
          asked_of: opts.of,
          asked_at: new Date().toISOString().slice(0, 10),
          blocks: opts.blocks ?? [],
          notes,
          cites: [],
          test_cases: [],
          ambiguous: [],
          contradicts: [],
        } as never);
        writeFeature(paths, doc!);

        console.log(pc.green("✓"), `Asked on ${pc.cyan(containerId)} · ${id}`);
        console.log(`  ${opts.question}`);
        console.log(pc.dim(`  ${opts.of} owes the answer`));
        if (opts.propose) console.log(pc.dim(`  you proposed: ${opts.propose}`));
        console.log(
          pc.dim(
            "\nIt renders as undecided and counts toward this area's open questions. Answer it with `productos decide`."
          )
        );
      }
    );

  return cmd;
}

/**
 * `productos read` — a person reporting whether the document did its job.
 *
 * ⛔ The one signal on a page that no check can compute. A reviewer, after finding
 * sixteen problems on a page carrying thirty-two automated notes, none of which was any
 * of them: "A corpus can pass every automated check it has, read beautifully, and still
 * contain a blocker that makes the feature unbuildable. There is no counter, chip or
 * stamp anywhere for 'a human read this end to end and could not build it.'"
 */
export function readCommand(): Command {
  return new Command("read")
    .description("Record that you read a container end to end, and whether you could build from it")
    .argument("<container>", "Feature or capability id")
    .option("--buildable", "You could hand this to an engineer")
    .option("--blocked", "You could not")
    .option("-b, --blocked-by <ids...>", "What stopped you")
    .option("-n, --note <text>", "What you would tell the room")
    .option("--by <who>", "Who read it (defaults to your username)")
    .action(
      (
        containerId: string,
        opts: {
          buildable?: boolean;
          blocked?: boolean;
          blockedBy?: string[];
          note?: string;
          by?: string;
        }
      ) => {
        const paths = resolvePathsOrThrow();
        const doc = readFeatureById(paths, containerId);
        if (!doc) fail(`No feature or capability "${containerId}".`);
        if (opts.buildable === opts.blocked) {
          fail(
            "Say which: --buildable or --blocked.",
            "A read-through with no verdict is the state this command exists to replace."
          );
        }
        if (opts.blocked && !(opts.blockedBy ?? []).length && !opts.note) {
          fail(
            "A blocked read-through needs --blocked-by or --note.",
            "\"I could not build from this\" with no reason cannot be acted on."
          );
        }

        doc!.frontmatter.read_throughs = [
          ...(doc!.frontmatter.read_throughs ?? []),
          {
            by: opts.by ?? os.userInfo().username,
            at: new Date().toISOString().slice(0, 10),
            buildable: !!opts.buildable,
            blocked_by: opts.blockedBy ?? [],
            note: opts.note,
          },
        ];
        writeFeature(paths, doc!);
        console.log(
          opts.buildable ? pc.green("✓") : pc.red("✗"),
          `Recorded: ${pc.cyan(containerId)} ${
            opts.buildable ? "is buildable as written" : "is NOT buildable as written"
          }`
        );
        if ((opts.blockedBy ?? []).length) console.log(pc.dim(`  blocked by ${opts.blockedBy!.join(", ")}`));
      }
    );
}

function fail(what: string, why?: string): never {
  console.error(pc.red("✗"), what);
  if (why) console.error(pc.dim(`  ${why}`));
  process.exit(1);
}
