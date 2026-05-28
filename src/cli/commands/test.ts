import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listTruth, writeTruth } from "../../core/truth.js";
import { readConfig } from "../../core/config.js";
import { materializeJest } from "../../test_gen/jest.js";
import { runUserTests } from "../../test_gen/runner.js";

export function testCommand(): Command {
  const cmd = new Command("test").description("Generate and run tests from validated Truth");

  cmd
    .command("generate")
    .description("Materialize validated Truth into test files in productos/tests/")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      const docs = listTruth(paths, { status: "validated" });
      if (docs.length === 0) {
        console.log(pc.dim("(no validated truth to materialize — vet some first in the UI)"));
        return;
      }
      let wrote = 0;
      for (const d of docs) {
        if (!d.frontmatter.proposed_test) {
          console.log(pc.yellow("→"), `skip ${d.frontmatter.id}: no proposed_test`);
          continue;
        }
        if (d.frontmatter.proposed_test.framework !== config.stack.test_framework) {
          console.log(
            pc.yellow("→"),
            `skip ${d.frontmatter.id}: proposed_test framework=${d.frontmatter.proposed_test.framework}, repo stack=${config.stack.test_framework}`
          );
          continue;
        }
        if (config.stack.test_framework === "jest" || config.stack.test_framework === "vitest") {
          const fp = materializeJest(paths, d);
          d.frontmatter.test_file = path.relative(paths.repoRoot, fp);
          writeTruth(paths, d);
          console.log(pc.green("✓"), `wrote ${path.relative(process.cwd(), fp)}`);
          wrote++;
        } else {
          console.log(pc.yellow("→"), `skip ${d.frontmatter.id}: framework ${config.stack.test_framework} not yet supported by generator`);
        }
      }
      console.log();
      console.log(pc.bold(`Materialized ${wrote} test(s) to productos/tests/`));
      console.log(pc.dim(`Run them with: ${config.stack.test_command}`));
    });

  cmd
    .command("run")
    .description("Run the user's test command")
    .action(async () => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      console.log(pc.dim(`$ ${config.stack.test_command}`));
      const r = await runUserTests(config);
      process.exit(r.exitCode);
    });

  return cmd;
}
