import { Command } from "commander";
import os from "node:os";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  TaskKind,
  TaskPriority,
  claimTask,
  completeTask,
  enqueueTask,
  listTasks,
  readTaskById,
  releaseStaleClaim,
} from "../../core/queue.js";

/**
 * `productos queue list [--state X] [--feature Y]`
 * `productos queue show <id>`
 * `productos queue enqueue --kind X --body "..." [--feature ...]`
 * `productos queue claim <id> [--by name]`
 * `productos queue complete <id> done|failed|abandoned [--summary "..."]`
 * `productos queue release <id>`                                — undo a stale claim
 *
 * The queue is durable on-disk state at productos/queue/*.md. Normal flow
 * is via MCP from a Claude drainer; CLI is for inspection + recovery.
 */

export function queueCommand(): Command {
  const cmd = new Command("queue").description("Inspect and manage the work queue (productos/queue/)");

  cmd
    .command("list")
    .description("List queue tasks (default: pending only)")
    .option("--state <state>", "Filter by state: pending|claimed|done|failed|abandoned")
    .option("--feature <id>", "Filter by target feature id")
    .option("--all", "Show all states (overrides --state)")
    .action((opts: { state?: string; feature?: string; all?: boolean }) => {
      const paths = resolvePathsOrThrow();
      const state = opts.all ? undefined : (opts.state ?? "pending");
      const tasks = listTasks(paths, {
        state: state as any,
        feature: opts.feature,
      });
      if (tasks.length === 0) {
        console.log(pc.dim(`(no ${state ?? "matching"} tasks)`));
        return;
      }
      for (const t of tasks) {
        const fm = t.frontmatter;
        const tag =
          fm.state === "pending" ? pc.yellow("pending") :
          fm.state === "claimed" ? pc.cyan("claimed") :
          fm.state === "done" ? pc.green("done") :
          fm.state === "failed" ? pc.red("failed") :
          pc.dim("abandoned");
        const target = fm.target.feature
          ? `${fm.target.feature}${fm.target.behavior ? `#${fm.target.behavior}` : ""}`
          : "(no target)";
        console.log(`  ${tag.padEnd(20)} ${pc.bold(fm.id)}  ${pc.dim(fm.kind)}  ${target}`);
        if (fm.result_summary) console.log(`    ${pc.dim("→ " + fm.result_summary)}`);
      }
    });

  cmd
    .command("show <id>")
    .description("Show full task body")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const t = readTaskById(paths, id);
      if (!t) {
        console.error(pc.red("✗"), `Task ${id} not found`);
        process.exit(1);
      }
      console.log(pc.bold(t.frontmatter.id), pc.dim(`(${t.frontmatter.state})`));
      console.log(pc.dim(`  kind:     ${t.frontmatter.kind}`));
      console.log(pc.dim(`  target:   ${t.frontmatter.target.feature ?? "-"}${t.frontmatter.target.behavior ? "#" + t.frontmatter.target.behavior : ""}`));
      console.log(pc.dim(`  created:  ${t.frontmatter.created_at} by ${t.frontmatter.created_by}`));
      if (t.frontmatter.claimed_at) {
        console.log(pc.dim(`  claimed:  ${t.frontmatter.claimed_at} by ${t.frontmatter.claimed_by}`));
      }
      if (t.frontmatter.completed_at) {
        console.log(pc.dim(`  done:     ${t.frontmatter.completed_at} by ${t.frontmatter.completed_by}`));
      }
      console.log();
      console.log(t.body);
    });

  cmd
    .command("enqueue")
    .description("Add a task to the queue (normally enqueued from the web UI)")
    .requiredOption("--kind <kind>", "freeform | address-feedback")
    .requiredOption("--body <text>", "Instructions for the worker")
    .option("--feature <id>", "Target feature id")
    .option("--behavior <id>", "Target behavior id")
    .option("--priority <p>", "low | normal | high", "normal")
    .action((opts: { kind: string; body: string; feature?: string; behavior?: string; priority: string }) => {
      const paths = resolvePathsOrThrow();
      const t = enqueueTask(paths, {
        kind: TaskKind.parse(opts.kind),
        body: opts.body,
        priority: TaskPriority.parse(opts.priority),
        created_by: os.userInfo().username || "cli",
        target: { feature: opts.feature, behavior: opts.behavior },
      });
      console.log(pc.green("✓"), `Enqueued ${t.frontmatter.id}`);
    });

  cmd
    .command("claim <id>")
    .description("Atomically claim a pending task (normally done via MCP)")
    .option("--by <name>", "Who is claiming", os.userInfo().username || "cli")
    .action((id: string, opts: { by: string }) => {
      const paths = resolvePathsOrThrow();
      const t = claimTask(paths, id, opts.by);
      if (!t) {
        console.error(pc.red("✗"), `Could not claim ${id} (already claimed or missing)`);
        process.exit(1);
      }
      console.log(pc.green("✓"), `Claimed ${t.frontmatter.id} by ${opts.by}`);
    });

  cmd
    .command("complete <id> <outcome>")
    .description("Mark a claimed task as done|failed|abandoned")
    .option("--summary <text>", "One-line description of what was done")
    .option("--by <name>", "Who is completing", os.userInfo().username || "cli")
    .action((id: string, outcome: string, opts: { summary?: string; by: string }) => {
      const paths = resolvePathsOrThrow();
      if (outcome !== "done" && outcome !== "failed" && outcome !== "abandoned") {
        console.error(pc.red("✗"), `outcome must be done|failed|abandoned (got "${outcome}")`);
        process.exit(1);
      }
      const t = completeTask(paths, id, outcome as "done" | "failed" | "abandoned", {
        by: opts.by,
        summary: opts.summary,
      });
      console.log(pc.green("✓"), `${t.frontmatter.id} → ${t.frontmatter.state}`);
    });

  cmd
    .command("release <id>")
    .description("Return a stuck claimed task to pending (use after a crashed worker)")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const t = releaseStaleClaim(paths, id);
      if (!t) {
        console.error(pc.red("✗"), `Task ${id} not claimed (or missing)`);
        process.exit(1);
      }
      console.log(pc.green("✓"), `${t.frontmatter.id} released → pending`);
    });

  return cmd;
}
