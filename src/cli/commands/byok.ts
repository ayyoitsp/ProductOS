import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { readConfig, resolveTruthVerificationByok, writeConfig } from "../../core/config.js";

/**
 * Backwards-compatible BYOK command, post-configure refactor.
 *
 * Since per-operation handler selection now lives in `operations.truth_verification`,
 * this command is mostly a status / quick-toggle shortcut. For full
 * provider/key/model setup, point users at `productos configure`.
 */
export function byokCommand(): Command {
  const cmd = new Command("byok").description("Quick toggle + status for BYOK truth-verification (full setup: productos configure)");

  cmd
    .command("status")
    .description("Show registered BYOK providers, truth-verification handler config, and whether each API key env var is set")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);

      const registered = Object.keys(config.byok.providers);
      console.log(pc.bold("Registered providers:"));
      if (registered.length === 0) {
        console.log(pc.dim("  (none — run `productos configure byok`)"));
      } else {
        for (const id of registered) {
          const reg = config.byok.providers[id as keyof typeof config.byok.providers]!;
          const set = !!process.env[reg.api_key_env];
          const activeBadge = id === config.byok.active ? pc.cyan(" (active)") : "";
          console.log(
            `  - ${id}${activeBadge}: ${reg.default_model} via ${reg.api_key_env}  ${set ? pc.green("(set)") : pc.red("(not set)")}`
          );
        }
      }
      console.log();

      const handler = config.operations.truth_verification.handler;
      console.log(pc.bold("Truth verification:"), handler);
      if (handler === "byok") {
        try {
          const byok = resolveTruthVerificationByok(config);
          const keyPresent = !!process.env[byok.api_key_env];
          console.log(`  provider:    ${byok.provider}`);
          console.log(`  model:       ${byok.model}`);
          console.log(`  api_key_env: ${byok.api_key_env}  ${keyPresent ? pc.green("(set)") : pc.red("(not set)")}`);
          console.log(`  max_steps:   ${byok.max_steps}`);
          console.log();
          if (keyPresent) console.log(pc.green("✓"), "BYOK ready — POST /api/feedback will try to auto-process.");
          else console.log(pc.yellow("!"), `Key not set. Set ${byok.api_key_env}=… in the shell that runs \`productos serve\`.`);
        } catch (e) {
          console.log(pc.red("✗"), (e as Error).message);
        }
      } else {
        console.log(pc.dim("\nFeedback queues in productos/feedback/ for Claude to process later via MCP."));
        console.log(pc.dim("To switch: `productos configure truth-verification` or `productos byok enable`."));
      }
    });

  cmd
    .command("enable")
    .description("Flip truth-verification handler to BYOK. For full provider/key/model setup, use `productos configure`.")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      config.operations.truth_verification.handler = "byok";
      writeConfig(paths, config);
      console.log(pc.green("✓"), "Truth verification set to BYOK.");
      console.log(pc.dim("Run `productos configure truth-verification` to set provider/model/key, or `productos byok status` to inspect."));
    });

  cmd
    .command("disable")
    .description("Revert truth-verification to queue-only")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      config.operations.truth_verification.handler = "queue";
      writeConfig(paths, config);
      console.log(pc.green("✓"), "Truth verification reverted to queue-only.");
    });

  return cmd;
}
