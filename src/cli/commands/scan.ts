import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { readConfig, resolveCodeScanningByok } from "../../core/config.js";
import { runScan } from "../../byok/scan.js";

/**
 * BYOK-driven code scan: takes a feature id + hint, walks the codebase via
 * the registered BYOK provider, and writes a proposed feature.md.
 *
 * Requires `operations.code_scanning.handler` = `byok` AND a registered
 * provider with the key env var set. Otherwise we explain what to do.
 */
export function scanCommand(): Command {
  return new Command("scan")
    .description("Run an LLM-driven scan of the codebase to propose a Product Truth feature draft (requires BYOK)")
    .argument("<feature_id>", "Feature id, e.g. wallet/add-kid")
    .argument("<hint...>", 'Freeform description, e.g. "user adds a kid via family settings"')
    .option("--no-review", "Don't drop into `productos review` after the scan; just leave the draft")
    .action(async (featureId: string, hintWords: string[], opts: { review: boolean }) => {
      const hint = hintWords.join(" ").trim();
      if (!hint) {
        console.error(pc.red("✗"), "hint is required");
        process.exit(1);
      }
      if (!/^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/.test(featureId)) {
        console.error(pc.red("✗"), `feature id must be area/slug (kebab-case), got "${featureId}"`);
        process.exit(1);
      }

      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);

      if (config.operations.code_scanning.handler !== "byok") {
        console.error(pc.yellow("!"), `Code scanning handler is "${config.operations.code_scanning.handler}", not "byok".`);
        console.error(pc.dim("Run `productos configure code-scanning` to switch."));
        process.exit(1);
      }

      let byok;
      try {
        byok = resolveCodeScanningByok(config);
      } catch (e) {
        console.error(pc.red("✗"), (e as Error).message);
        process.exit(1);
      }

      if (!process.env[byok.api_key_env]) {
        console.error(
          pc.red("✗"),
          `${byok.api_key_env} is not set. Export it in this shell before running scan.`
        );
        process.exit(1);
      }

      const spin = p.spinner();
      spin.start(`Scanning via ${byok.provider}/${byok.model}…`);
      const result = await runScan(featureId, hint, paths, byok);
      spin.stop("Scan complete.");

      if (result.kind === "proposed") {
        console.log(pc.green("✓"), `Drafted ${result.feature_id}`);
        console.log(pc.dim(`Tool calls: ${result.ops.join(", ")}`));
        if (result.summary) {
          console.log("");
          console.log(pc.dim(result.summary));
        }

        if (opts.review) {
          console.log("");
          await chainIntoReview(result.feature_id);
        } else {
          console.log("");
          console.log(pc.dim("Draft saved to productos/drafts/. Review with:"));
          console.log(pc.dim(`  productos review ${result.feature_id}`));
        }
      } else if (result.kind === "needs_review") {
        console.log(pc.yellow("!"), "Scan punted for human review");
        console.log(pc.dim(`Reason: ${result.reason}`));
        console.log(pc.dim(`Tool calls: ${result.ops.join(", ")}`));
        process.exit(2);
      } else {
        console.error(pc.red("✗"), `Scan failed: ${result.message}`);
        process.exit(1);
      }
    });
}

/**
 * Re-invoke the same CLI in a child process with `review <id>` so the
 * interactive prompts get a clean stdio handle. (clack prompts misbehave
 * when chained inline after async work in the same process.)
 */
async function chainIntoReview(featureId: string): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/cli/commands → ../index.js
  const cliEntry = path.join(here, "..", "index.js");
  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [cliEntry, "review", featureId], { stdio: "inherit" });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}
