import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  FeedbackEntry,
  FeedbackFrontmatter,
  listFeedback,
  newFeedbackId,
  readFeedbackById,
  writeFeedback,
} from "../../core/feedback.js";

export function feedbackCommand(): Command {
  const cmd = new Command("feedback").description("Manage the feedback queue (productos/feedback/)");

  cmd
    .command("list")
    .description("List feedback entries")
    .option("--state <state>", "Filter by state: open | claimed | processed")
    .option("--feature <feature_id>", "Filter by target feature")
    .action((opts: { state?: string; feature?: string }) => {
      const paths = resolvePathsOrThrow();
      const entries = listFeedback(paths, { state: opts.state as never, feature: opts.feature });
      if (entries.length === 0) {
        console.log(pc.dim("(no feedback entries)"));
        return;
      }
      for (const e of entries) {
        const target = e.frontmatter.target.feature
          ? `${e.frontmatter.target.feature}${e.frontmatter.target.behavior ? "#" + e.frontmatter.target.behavior : ""}`
          : "(no target)";
        console.log(`  ${pc.cyan(e.frontmatter.id)}  ${stateLabel(e.frontmatter.state)}  ${pc.dim(target)}`);
        console.log(`    ${truncate(e.body, 100)}`);
      }
      console.log(pc.dim(`\n${entries.length} entr${entries.length === 1 ? "y" : "ies"}`));
    });

  cmd
    .command("show <id>")
    .description("Show one feedback entry")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const e = readFeedbackById(paths, id);
      if (!e) {
        console.error(pc.red(`Feedback "${id}" not found`));
        process.exit(1);
      }
      console.log(pc.bold(e.frontmatter.id));
      console.log(stateLabel(e.frontmatter.state));
      console.log(pc.dim(`created ${e.frontmatter.created_at} by ${e.frontmatter.created_by} via ${e.frontmatter.source}`));
      if (e.frontmatter.target.feature) {
        console.log(pc.dim(`target: ${e.frontmatter.target.feature}${e.frontmatter.target.behavior ? "#" + e.frontmatter.target.behavior : ""}`));
      }
      console.log();
      console.log(e.body);
      console.log();
      console.log(pc.dim(`source: ${path.relative(process.cwd(), e.filepath)}`));
    });

  cmd
    .command("add")
    .description("Add a feedback entry from the CLI")
    .requiredOption("--body <body>", "Feedback body")
    .option("--feature <feature_id>", "Target feature")
    .option("--behavior <behavior_id>", "Target behavior (requires --feature)")
    .action((opts: { body: string; feature?: string; behavior?: string }) => {
      const paths = resolvePathsOrThrow();
      const target = { feature: opts.feature, behavior: opts.behavior };
      const id = newFeedbackId(target);
      const fm = FeedbackFrontmatter.parse({
        id,
        created_at: new Date().toISOString(),
        created_by: os.userInfo().username || "cli",
        source: "cli",
        target,
        state: "open",
      });
      const entry: FeedbackEntry = { frontmatter: fm, body: opts.body, filepath: "" };
      const fp = writeFeedback(paths, entry);
      console.log(pc.green("✓"), `Queued ${id}`);
      console.log(pc.dim(`  ${path.relative(process.cwd(), fp)}`));
    });

  cmd
    .command("process <id>")
    .description("Mark a feedback entry as processed")
    .option("--note <note>", "Resolution note (appended to the entry body)")
    .action((id: string, opts: { note?: string }) => {
      const paths = resolvePathsOrThrow();
      const e = readFeedbackById(paths, id);
      if (!e) { console.error(pc.red(`Feedback "${id}" not found`)); process.exit(1); }
      e.frontmatter.state = "processed";
      e.frontmatter.resolved_at = new Date().toISOString();
      e.frontmatter.resolved_by = os.userInfo().username || "cli";
      if (opts.note) e.body = (e.body + "\n\n---\n**Resolution:** " + opts.note).trim();
      writeFeedback(paths, e);
      console.log(pc.green("✓"), `${id} processed`);
    });

  return cmd;
}

function stateLabel(s: string): string {
  if (s === "open") return pc.yellow("● open");
  if (s === "claimed") return pc.blue("● claimed");
  if (s === "processed") return pc.green("● processed");
  return s;
}

function truncate(s: string, n: number): string {
  s = s.replace(/\s+/g, " ");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
