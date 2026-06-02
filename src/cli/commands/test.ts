import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { findRepoRoot, pathsFor } from "../../core/paths.js";
import { readFeatureById } from "../../core/product.js";
import { readConfig } from "../../core/config.js";
import {
  scaffoldTests,
  SupportedFramework,
} from "../../core/test-scaffold.js";
import {
  recordTestResults,
  RecordTestResultsInput,
  TestResultInput,
} from "../../core/test-results.js";

const SUPPORTED: SupportedFramework[] = ["jest", "vitest", "playwright", "pytest"];

export function testCommand(): Command {
  const cmd = new Command("test").description("Test scaffolding + result ingestion");

  cmd
    .command("scaffold")
    .description("Render test stubs in the user's framework from a feature's behaviors + test_cases")
    .argument("<feature_id>", "Feature id (e.g. wishlist/add-item)")
    .option("--framework <name>", "Override stack.test_framework from config (jest, vitest, playwright, pytest)")
    .option("--out <path>", "Output path (default: derived from feature id + framework)")
    .option("--stdout", "Print to stdout instead of writing a file")
    .option("--force", "Overwrite if the output file already exists")
    .action(async (featureId: string, opts: { framework?: string; out?: string; stdout?: boolean; force?: boolean }) => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error(pc.red("Not in a productos project (no productos/ directory found upward)."));
        process.exit(1);
      }
      const paths = pathsFor(repoRoot);
      const feature = readFeatureById(paths, featureId);
      if (!feature) {
        console.error(pc.red(`Feature not found: ${featureId}`));
        process.exit(1);
      }
      const config = readConfig(paths);
      const framework = (opts.framework ?? config.stack.test_framework) as SupportedFramework;
      if (!SUPPORTED.includes(framework)) {
        console.error(pc.red(`Unsupported framework: ${framework}. Pick one of: ${SUPPORTED.join(", ")}`));
        process.exit(1);
      }

      const activeCount = feature.frontmatter.behaviors
        .filter((b) => !b.deprecated)
        .reduce((n, b) => n + b.test_cases.filter((tc) => !tc.deprecated).length, 0);
      if (activeCount === 0) {
        console.error(pc.yellow(`Feature ${featureId} has no active test_cases — nothing to scaffold.`));
        console.error(pc.dim(`Add test_cases under each behavior in ${path.relative(repoRoot, feature.filepath)} and re-run.`));
        process.exit(1);
      }

      const result = scaffoldTests(feature, framework);

      if (opts.stdout) {
        process.stdout.write(result.content);
        return;
      }

      const outPath = path.resolve(repoRoot, opts.out ?? result.filename);
      if (fs.existsSync(outPath) && !opts.force) {
        console.error(pc.yellow(`Refusing to overwrite ${path.relative(repoRoot, outPath)} — pass --force to replace.`));
        process.exit(1);
      }
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, result.content, "utf-8");
      console.log(
        pc.green("✓"),
        `Scaffolded ${activeCount} test case${activeCount === 1 ? "" : "s"} for ${pc.bold(featureId)} (${framework}) →`,
        pc.cyan(path.relative(repoRoot, outPath))
      );
      console.log(
        pc.dim(`   Each test name carries its stable id (${featureId}#<behavior>/<case>). Fill in setup + assertions.`)
      );
    });

  cmd
    .command("record")
    .description("Receive a batch of test results from the user's CI (one tiny receive interface — see USE_CASES.md Flow 3)")
    .option("--from <path>", "Read payload from a file (use '-' for stdin). Default: stdin", "-")
    .option("--source <name>", "Default source label for results that don't carry one (e.g. 'ci-github-actions')")
    .option("--format <name>", "Input format: 'json' (single object with {results: [...]}) or 'ndjson' (one result per line)", "json")
    .action(async (opts: { from: string; source?: string; format: "json" | "ndjson" }) => {
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        console.error(pc.red("Not in a productos project (no productos/ directory found upward)."));
        process.exit(1);
      }
      const paths = pathsFor(repoRoot);

      const raw = opts.from === "-"
        ? fs.readFileSync(0, "utf-8")
        : fs.readFileSync(path.resolve(repoRoot, opts.from), "utf-8");

      let payload: { results: unknown[]; default_source?: string };
      if (opts.format === "ndjson") {
        const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
        const results = lines.map((line) => JSON.parse(line));
        payload = { results, default_source: opts.source };
      } else {
        const parsed = JSON.parse(raw);
        // Accept either { results: [...] } or a bare array
        if (Array.isArray(parsed)) {
          payload = { results: parsed, default_source: opts.source };
        } else {
          payload = { ...parsed, default_source: opts.source ?? parsed.default_source };
        }
      }

      const input = RecordTestResultsInput.parse({
        results: payload.results.map((r) => TestResultInput.parse(r)),
        default_source: payload.default_source,
      });

      const summary = recordTestResults(paths, input);

      const lines: string[] = [];
      lines.push(
        `${pc.green("✓")} Received ${summary.total} test result${summary.total === 1 ? "" : "s"} — ${pc.bold(summary.recorded.toString())} recorded, ${summary.ignored.unmapped} ignored`
      );
      if (summary.drift_opened > 0) {
        lines.push(`  ${pc.yellow("⚠")} Opened ${summary.drift_opened} test_failed drift event${summary.drift_opened === 1 ? "" : "s"}`);
      }
      if (summary.drift_resolved > 0) {
        lines.push(`  ${pc.green("✓")} Resolved ${summary.drift_resolved} test_failed drift event${summary.drift_resolved === 1 ? "" : "s"}`);
      }
      if (summary.deprecated > 0) {
        lines.push(`  ${pc.dim(`  ${summary.deprecated} result${summary.deprecated === 1 ? "" : "s"} for deprecated cases (recorded, no drift)`)}`);
      }
      if (summary.ignored.unmapped > 0) {
        const d = summary.ignored;
        lines.push(
          pc.dim(`  Ignored breakdown: ${d.invalid_stable_id} invalid id, ${d.feature_missing} feature missing, ${d.behavior_missing} behavior missing, ${d.test_case_missing} test_case missing`)
        );
      }
      console.log(lines.join("\n"));
    });

  return cmd;
}
