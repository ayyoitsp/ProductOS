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
    .description("Run an LLM-driven scan of the codebase to propose a Product Truth feature (requires BYOK)")
    .argument("<feature_id>", "Feature id, e.g. wallet/add-kid")
    .argument("<hint...>", 'Freeform description, e.g. "user adds a kid via family settings"')
    .action(async (featureId: string, hintWords: string[]) => {
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
        console.log(pc.green("✓"), `Proposed ${result.feature_id}`);
        console.log(pc.dim(`Tool calls: ${result.ops.join(", ")}`));
        if (result.summary) {
          console.log("");
          console.log(pc.dim(result.summary));
        }
        console.log("");
        console.log(pc.dim("Open in the browser to review, edit, or verify behaviors:"));
        console.log(pc.dim(`  productos serve`));
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
