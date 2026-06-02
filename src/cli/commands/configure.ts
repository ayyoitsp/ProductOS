import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  ByokProvider,
  CodeScanningHandler,
  ProductosConfig,
  TruthVerificationHandler,
  readConfig,
  writeConfig,
} from "../../core/config.js";

type SectionId = "code-scanning" | "truth-verification";

const SECTION_NAMES: Record<SectionId, string> = {
  "code-scanning": "Code scanning",
  "truth-verification": "Truth verification",
};

export function configureCommand(): Command {
  return new Command("configure")
    .description("Interactive configuration for ProductOS (run with no args for the full flow, or pass a section)")
    .argument("[section]", "Optional section: code-scanning | truth-verification")
    .action(async (section?: string) => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);

      p.intro(pc.bold(pc.cyan("productos configure")));

      if (section) {
        if (section !== "code-scanning" && section !== "truth-verification") {
          p.cancel(`Unknown section: ${section}. Use one of: code-scanning, truth-verification`);
          process.exit(1);
        }
        await runSection(section as SectionId, config);
      } else {
        await runFullFlow(config);
      }

      const summary = describeConfig(config);
      p.note(summary, "Summary");

      const confirmed = await p.confirm({
        message: "Save these settings to productos/config.yaml?",
        initialValue: true,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("No changes saved.");
        process.exit(0);
      }

      writeConfig(paths, config);
      p.outro(pc.green("✓ ") + "Saved. Run `productos doctor` to verify.");
    });
}

async function runFullFlow(config: ProductosConfig): Promise<void> {
  const choice = await p.select<SectionId | "all" | "cancel">({
    message: "What would you like to configure?",
    options: [
      { value: "all", label: "Everything", hint: "Walk through every section" },
      { value: "code-scanning", label: SECTION_NAMES["code-scanning"], hint: "How ProductOS analyzes your codebase" },
      { value: "truth-verification", label: SECTION_NAMES["truth-verification"], hint: "How feedback gets processed" },
      { value: "cancel", label: "Cancel" },
    ],
  });
  if (p.isCancel(choice) || choice === "cancel") {
    p.cancel("Canceled.");
    process.exit(0);
  }
  if (choice === "all") {
    await runSection("code-scanning", config);
    await runSection("truth-verification", config);
  } else {
    await runSection(choice, config);
  }
}

async function runSection(section: SectionId, config: ProductosConfig): Promise<void> {
  p.log.step(pc.bold(SECTION_NAMES[section]));
  switch (section) {
    case "code-scanning":
      await configureCodeScanning(config);
      break;
    case "truth-verification":
      await configureTruthVerification(config);
      break;
  }
}

// ---------------------------------------------------------------------------
// Code scanning

async function configureCodeScanning(config: ProductosConfig): Promise<void> {
  p.log.info(
    "Code scanning is how ProductOS analyzes your codebase to propose features, behaviors, and tracking. Today: Claude Code (via the productos-fullscan / productos-scope skills + MCP). Codex/Cursor/Devin adapters are coming."
  );

  const handler = await p.select<CodeScanningHandler>({
    message: "How should code scanning work?",
    initialValue: config.operations.code_scanning.handler,
    options: [
      { value: "claude", label: "Claude Code", hint: "uses your existing Claude Code session + skill" },
      { value: "codex", label: "Codex (coming soon)", hint: "adapter not yet shipped — selection is recorded for when it lands" },
      { value: "manual", label: "Manual", hint: "no AI assistance — you write product truth by hand" },
    ],
  });
  if (p.isCancel(handler)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  config.operations.code_scanning.handler = handler;
}

// ---------------------------------------------------------------------------
// Truth verification

async function configureTruthVerification(config: ProductosConfig): Promise<void> {
  p.log.info(
    "Truth verification is how feedback you submit via the website gets handled. Queue: feedback lands in productos/feedback/ and Claude (or whoever) processes it later via MCP. BYOK: an LLM auto-processes feedback at submit time using a key you provide."
  );

  const handler = await p.select<TruthVerificationHandler>({
    message: "How should feedback be processed?",
    initialValue: config.operations.truth_verification.handler,
    options: [
      { value: "queue", label: "Queue", hint: "write to productos/feedback/, process later via Claude (default, no key needed)" },
      { value: "byok", label: "BYOK auto-process", hint: "auto-interpret feedback at submit time using a key" },
    ],
  });
  if (p.isCancel(handler)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  config.operations.truth_verification.handler = handler;

  if (handler === "byok") {
    await configureByokOverride(config);
  } else {
    // Clear any per-op overrides if going back to queue.
    delete config.operations.truth_verification.byok;
  }
}

async function configureByokOverride(config: ProductosConfig): Promise<void> {
  const currentProvider =
    config.operations.truth_verification.byok?.provider ?? config.byok.provider;
  const currentKeyEnv =
    config.operations.truth_verification.byok?.api_key_env ?? config.byok.api_key_env;
  const currentModel =
    config.operations.truth_verification.byok?.model ?? config.byok.model;

  const provider = await p.select<ByokProvider>({
    message: "Which provider?",
    initialValue: currentProvider,
    options: [
      { value: "anthropic", label: "Anthropic (Claude)", hint: "claude-sonnet-4-6, claude-opus-4-7, etc." },
      { value: "openai", label: "OpenAI", hint: "gpt-4o, gpt-4-turbo, etc." },
      { value: "openrouter", label: "OpenRouter", hint: "many models via one key" },
      { value: "google", label: "Google (not yet wired)", hint: "selection recorded; install @ai-sdk/google + extend src/byok/processor.ts" },
    ],
  });
  if (p.isCancel(provider)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  const defaultKeyEnv =
    provider === "anthropic" ? "ANTHROPIC_API_KEY" :
    provider === "openai" ? "OPENAI_API_KEY" :
    provider === "openrouter" ? "OPENROUTER_API_KEY" :
    provider === "google" ? "GOOGLE_GENERATIVE_AI_API_KEY" :
    currentKeyEnv;

  const apiKeyEnv = await p.text({
    message: "Env var name that holds your API key",
    initialValue: currentKeyEnv === config.byok.api_key_env ? defaultKeyEnv : currentKeyEnv,
    placeholder: defaultKeyEnv,
    validate: (v) => (!v || !/^[A-Z_][A-Z0-9_]*$/.test(v) ? "Must be an env var name (UPPER_SNAKE_CASE)" : undefined),
  });
  if (p.isCancel(apiKeyEnv)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  const defaultModel =
    provider === "anthropic" ? "claude-sonnet-4-6" :
    provider === "openai" ? "gpt-4o" :
    provider === "openrouter" ? "anthropic/claude-sonnet-4-6" :
    "gemini-2.0-flash";

  const model = await p.text({
    message: "Which model?",
    initialValue: currentModel.startsWith("claude") && provider !== "anthropic" && provider !== "openrouter" ? defaultModel : currentModel,
    placeholder: defaultModel,
    validate: (v) => (!v ? "Required" : undefined),
  });
  if (p.isCancel(model)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  // Write to operations-level override; if it matches the top-level defaults exactly,
  // store as override anyway — explicit is friendlier for diff review.
  config.operations.truth_verification.byok = {
    provider,
    api_key_env: apiKeyEnv,
    model,
  };

  if (!process.env[apiKeyEnv]) {
    p.log.warn(
      pc.yellow(
        `${apiKeyEnv} is not set in this shell. Set it before running \`productos serve\` (otherwise feedback will queue but auto-processing will return an error).`
      )
    );
  }
}

// ---------------------------------------------------------------------------

function describeConfig(config: ProductosConfig): string {
  const lines: string[] = [];
  const cs = config.operations.code_scanning;
  lines.push(`${pc.bold("Code scanning:")}     ${labelForCodeScanning(cs.handler)}`);
  const tv = config.operations.truth_verification;
  if (tv.handler === "byok") {
    const ov = tv.byok ?? {};
    const provider = ov.provider ?? config.byok.provider;
    const key = ov.api_key_env ?? config.byok.api_key_env;
    const model = ov.model ?? config.byok.model;
    const keyPresent = !!process.env[key];
    lines.push(
      `${pc.bold("Truth verification:")} BYOK (${provider} / ${model}, key from ${key}${keyPresent ? pc.green(" — set") : pc.red(" — not set")})`
    );
  } else {
    lines.push(`${pc.bold("Truth verification:")} Queue (feedback queues for Claude to process)`);
  }
  return lines.join("\n");
}

function labelForCodeScanning(h: CodeScanningHandler): string {
  if (h === "claude") return "Claude Code";
  if (h === "codex") return "Codex (waiting on adapter)";
  return "Manual";
}
