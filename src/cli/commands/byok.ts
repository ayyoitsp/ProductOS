import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { readConfig, writeConfig } from "../../core/config.js";

export function byokCommand(): Command {
  const cmd = new Command("byok").description("Manage the BYOK (bring-your-own-key) feedback auto-processor");

  cmd
    .command("status")
    .description("Show current BYOK config and whether the key env var is set")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      const byok = config.byok;
      const keyPresent = !!process.env[byok.api_key_env];
      console.log(pc.bold("BYOK config:"));
      console.log(`  enabled:        ${byok.enabled ? pc.green("true") : pc.dim("false")}`);
      console.log(`  provider:       ${byok.provider}`);
      console.log(`  model:          ${byok.model}`);
      console.log(`  api_key_env:    ${byok.api_key_env}  ${keyPresent ? pc.green("(set)") : pc.red("(not set)")}`);
      console.log(`  max_steps:      ${byok.max_steps}`);
      console.log();
      if (byok.enabled && keyPresent) {
        console.log(pc.green("✓"), "BYOK is enabled and ready — POST /api/feedback will try to auto-process incoming entries.");
      } else if (byok.enabled && !keyPresent) {
        console.log(pc.yellow("!"), `BYOK is enabled but the key env var is empty. Set ${byok.api_key_env}=… in the shell that runs \`productos serve\`.`);
      } else {
        console.log(pc.dim("BYOK is disabled. Feedback queues in productos/feedback/ for Claude to process via MCP."));
      }
    });

  cmd
    .command("enable")
    .description("Enable BYOK auto-processing")
    .option("--provider <provider>", "anthropic | openai | google | openrouter")
    .option("--model <model>", "Model id (e.g. claude-sonnet-4-6, gpt-4o)")
    .option("--api-key-env <env>", "Env var name that holds the API key (e.g. ANTHROPIC_API_KEY)")
    .action((opts: { provider?: string; model?: string; apiKeyEnv?: string }) => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      config.byok.enabled = true;
      if (opts.provider) config.byok.provider = opts.provider as never;
      if (opts.model) config.byok.model = opts.model;
      if (opts.apiKeyEnv) config.byok.api_key_env = opts.apiKeyEnv;
      writeConfig(paths, config);
      console.log(pc.green("✓"), `BYOK enabled (provider=${config.byok.provider}, model=${config.byok.model}, key from ${config.byok.api_key_env})`);
      if (!process.env[config.byok.api_key_env]) {
        console.log(pc.yellow("!"), `Note: ${config.byok.api_key_env} is not set in this shell. Set it before running \`productos serve\`.`);
      }
    });

  cmd
    .command("disable")
    .description("Disable BYOK auto-processing (feedback queues only)")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);
      config.byok.enabled = false;
      writeConfig(paths, config);
      console.log(pc.green("✓"), "BYOK disabled");
    });

  return cmd;
}
