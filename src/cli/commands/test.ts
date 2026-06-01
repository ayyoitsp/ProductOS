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

  return cmd;
}
