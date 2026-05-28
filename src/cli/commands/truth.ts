import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listTruth, readTruth, writeTruth } from "../../core/truth.js";

export function truthCommand(): Command {
  const cmd = new Command("truth").description("Inspect and manage Truth claims");

  cmd
    .command("list")
    .description("List Truth claims")
    .option("--status <status>", "Filter by status (planned|proposed|validated|stale|rejected|contested)")
    .option("--feature <feature>", "Filter by feature scope")
    .action((opts: { status?: string; feature?: string }) => {
      const paths = resolvePathsOrThrow();
      const docs = listTruth(paths, {
        status: opts.status as never,
        feature: opts.feature,
      });
      if (docs.length === 0) {
        console.log(pc.dim("(no truth claims found)"));
        return;
      }
      for (const d of docs) {
        const status = formatStatus(d.frontmatter.status);
        console.log(
          `${pc.cyan(d.frontmatter.id)}  ${status}  ${pc.dim(d.frontmatter.type)}  ${truncate(d.frontmatter.claim, 80)}`
        );
      }
      console.log(pc.dim(`\n${docs.length} truth claim(s)`));
    });

  cmd
    .command("show <id>")
    .description("Show a single Truth claim's full content")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const doc = readTruth(paths, id);
      if (!doc) {
        console.error(pc.red(`truth ${id} not found`));
        process.exit(1);
      }
      console.log(pc.bold(`${doc.frontmatter.id}  ${formatStatus(doc.frontmatter.status)}`));
      console.log();
      console.log(pc.bold("Claim:"), doc.frontmatter.claim);
      console.log(pc.bold("Type:"), doc.frontmatter.type);
      if (doc.frontmatter.scope) console.log(pc.bold("Scope:"), JSON.stringify(doc.frontmatter.scope));
      if (doc.frontmatter.code_ref.length) {
        console.log(pc.bold("Code refs:"));
        for (const r of doc.frontmatter.code_ref) console.log("  -", r);
      }
      if (doc.frontmatter.proposed_test) {
        console.log(pc.bold(`Test (${doc.frontmatter.proposed_test.framework}):`));
        console.log(pc.dim(indent(doc.frontmatter.proposed_test.source, "  ")));
      }
      if (doc.body) {
        console.log(pc.bold("Notes:"));
        console.log(indent(doc.body, "  "));
      }
    });

  cmd
    .command("reject <id>")
    .description("Mark a Truth claim as rejected")
    .option("--reason <reason>", "Reason for rejection (appended to notes)")
    .action((id: string, opts: { reason?: string }) => {
      const paths = resolvePathsOrThrow();
      const doc = readTruth(paths, id);
      if (!doc) {
        console.error(pc.red(`truth ${id} not found`));
        process.exit(1);
      }
      doc.frontmatter.status = "rejected";
      if (opts.reason) {
        doc.body = (doc.body ? doc.body + "\n\n" : "") + `**Rejected:** ${opts.reason}`;
      }
      writeTruth(paths, doc);
      console.log(pc.green("✓"), `${id} marked rejected`);
    });

  cmd
    .command("validate <id>")
    .description("Manually mark a Truth claim as validated (use the vet UI for the normal flow)")
    .action((id: string) => {
      const paths = resolvePathsOrThrow();
      const doc = readTruth(paths, id);
      if (!doc) {
        console.error(pc.red(`truth ${id} not found`));
        process.exit(1);
      }
      doc.frontmatter.status = "validated";
      doc.frontmatter.validated_by = process.env.USER ?? "cli-user";
      doc.frontmatter.validated_at = new Date().toISOString();
      writeTruth(paths, doc);
      console.log(pc.green("✓"), `${id} validated`);
    });

  return cmd;
}

function formatStatus(s: string): string {
  switch (s) {
    case "validated": return pc.green("● validated");
    case "proposed": return pc.yellow("● proposed");
    case "planned": return pc.blue("● planned");
    case "stale": return pc.yellow("● stale");
    case "rejected": return pc.dim("● rejected");
    case "contested": return pc.red("● contested");
    default: return s;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function indent(s: string, prefix: string): string {
  return s.split("\n").map((l) => prefix + l).join("\n");
}
