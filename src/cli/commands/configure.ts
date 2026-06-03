import { Command } from "commander";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { resolvePathsOrThrow } from "../../core/paths.js";
import {
  ByokProvider,
  ByokProviderConfig,
  CodeScanningHandler,
  ProductosConfig,
  TruthVerificationHandler,
  defaultKeyEnvFor,
  defaultModelFor,
  readConfig,
  writeConfig,
} from "../../core/config.js";

type SectionId = "code-scanning" | "truth-verification" | "byok";

const SECTION_NAMES: Record<SectionId, string> = {
  "code-scanning": "Code scanning",
  "truth-verification": "Truth verification",
  byok: "BYOK providers",
};

export function configureCommand(): Command {
  return new Command("configure")
    .description("Interactive configuration for ProductOS (run with no args for the full flow, or pass a section)")
    .argument("[section]", "Optional section: byok | code-scanning | truth-verification")
    .action(async (section?: string) => {
      const paths = resolvePathsOrThrow();
      const config = readConfig(paths);

      p.intro(pc.bold(pc.cyan("productos configure")));

      if (section) {
        if (section !== "code-scanning" && section !== "truth-verification" && section !== "byok") {
          p.cancel(`Unknown section: ${section}. Use one of: byok, code-scanning, truth-verification`);
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
      { value: "byok", label: SECTION_NAMES.byok, hint: "Provider API keys & default models (Anthropic, OpenAI, Gemini)" },
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
    await runSection("byok", config);
    await runSection("code-scanning", config);
    await runSection("truth-verification", config);
  } else {
    await runSection(choice, config);
  }
}

async function runSection(section: SectionId, config: ProductosConfig): Promise<void> {
  p.log.step(pc.bold(SECTION_NAMES[section]));
  switch (section) {
    case "byok":
      await configureByokProviders(config);
      break;
    case "code-scanning":
      await configureCodeScanning(config);
      break;
    case "truth-verification":
      await configureTruthVerification(config);
      break;
  }
}

// ---------------------------------------------------------------------------
// BYOK providers registry

const PROVIDER_LABELS: Record<ByokProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google (Gemini)",
  openrouter: "OpenRouter",
};

// Common models per provider, listed first; "Other (custom)" lets the user
// type a fresh id. Keep these short — full lists rot quickly.
const MODEL_SUGGESTIONS: Record<ByokProvider, string[]> = {
  anthropic: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro"],
  openrouter: ["anthropic/claude-sonnet-4-6", "openai/gpt-4o", "google/gemini-2.0-flash"],
};

async function configureByokProviders(config: ProductosConfig): Promise<void> {
  p.log.info(
    "Register the providers you have keys for. You can register multiple — operations pick one to use. Keys live in environment variables (productos never stores them)."
  );

  const allProviders: ByokProvider[] = ["anthropic", "openai", "google", "openrouter"];

  const picked = await p.multiselect<ByokProvider>({
    message: "Which providers do you want to register?",
    initialValues: allProviders.filter((id) => !!config.byok.providers[id]),
    options: allProviders.map((id) => ({
      value: id,
      label: PROVIDER_LABELS[id],
      hint: config.byok.providers[id] ? "registered" : undefined,
    })),
    required: false,
  });
  if (p.isCancel(picked)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  // Drop providers the user unchecked.
  for (const id of allProviders) {
    if (!picked.includes(id) && config.byok.providers[id]) {
      delete config.byok.providers[id];
    }
  }

  // Walk each picked provider: key env var + default model.
  for (const id of picked) {
    p.log.step(PROVIDER_LABELS[id]);
    const current = config.byok.providers[id];

    const apiKeyEnv = await p.text({
      message: `Env var that holds the ${PROVIDER_LABELS[id]} key`,
      initialValue: current?.api_key_env ?? defaultKeyEnvFor(id),
      placeholder: defaultKeyEnvFor(id),
      validate: (v) => (!v || !/^[A-Z_][A-Z0-9_]*$/.test(v) ? "Must be an env var name (UPPER_SNAKE_CASE)" : undefined),
    });
    if (p.isCancel(apiKeyEnv)) {
      p.cancel("Canceled.");
      process.exit(0);
    }

    const model = await pickModelFor(id, current?.default_model);

    const entry: ByokProviderConfig = { api_key_env: apiKeyEnv, default_model: model };
    config.byok.providers[id] = entry;

    if (!process.env[apiKeyEnv]) {
      p.log.warn(
        pc.yellow(`${apiKeyEnv} is not set in this shell. Set it before running \`productos serve\`.`)
      );
    }
  }

  // If nothing is registered, leave active alone and bail.
  if (picked.length === 0) {
    p.log.info("No providers registered.");
    return;
  }

  // Active provider — must be one we just registered.
  const active = await p.select<ByokProvider>({
    message: "Which provider should be the default for BYOK operations?",
    initialValue: picked.includes(config.byok.active) ? config.byok.active : picked[0],
    options: picked.map((id) => ({
      value: id,
      label: PROVIDER_LABELS[id],
      hint: `model: ${config.byok.providers[id]!.default_model}`,
    })),
  });
  if (p.isCancel(active)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  config.byok.active = active;
}

async function pickModelFor(provider: ByokProvider, currentModel: string | undefined): Promise<string> {
  const suggestions = MODEL_SUGGESTIONS[provider];
  const initial =
    currentModel && suggestions.includes(currentModel) ? currentModel :
    currentModel ? "__custom__" :
    defaultModelFor(provider);

  const choice = await p.select<string>({
    message: `Default model for ${PROVIDER_LABELS[provider]}`,
    initialValue: initial,
    options: [
      ...suggestions.map((m) => ({ value: m, label: m })),
      { value: "__custom__", label: "Other (enter a model id)" },
    ],
  });
  if (p.isCancel(choice)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  if (choice !== "__custom__") return choice;

  const typed = await p.text({
    message: `Model id for ${PROVIDER_LABELS[provider]}`,
    initialValue: currentModel ?? defaultModelFor(provider),
    placeholder: defaultModelFor(provider),
    validate: (v) => (!v ? "Required" : undefined),
  });
  if (p.isCancel(typed)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  return typed;
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
    "Truth verification is how feedback you submit via the website gets handled. Queue: feedback lands in productos/feedback/ and Claude processes it later via MCP. BYOK: an LLM auto-processes feedback at submit time using a registered provider."
  );

  const handler = await p.select<TruthVerificationHandler>({
    message: "How should feedback be processed?",
    initialValue: config.operations.truth_verification.handler,
    options: [
      { value: "queue", label: "Queue", hint: "write to productos/feedback/, process later via Claude (default, no key needed)" },
      { value: "byok", label: "BYOK auto-process", hint: "auto-interpret feedback at submit time" },
    ],
  });
  if (p.isCancel(handler)) {
    p.cancel("Canceled.");
    process.exit(0);
  }
  config.operations.truth_verification.handler = handler;

  if (handler === "byok") {
    await configureTruthVerificationOverride(config);
  } else {
    delete config.operations.truth_verification.byok;
  }
}

async function configureTruthVerificationOverride(config: ProductosConfig): Promise<void> {
  const registered = (Object.keys(config.byok.providers) as ByokProvider[]);
  if (registered.length === 0) {
    p.log.warn(
      pc.yellow("No BYOK providers registered yet. Set up at least one via the BYOK section first.")
    );
    await configureByokProviders(config);
    return configureTruthVerificationOverride(config);
  }

  const ov = config.operations.truth_verification.byok ?? {};
  const currentProvider = ov.provider ?? config.byok.active;

  const useActive = await p.confirm({
    message: `Use the active provider (${PROVIDER_LABELS[config.byok.active]})?`,
    initialValue: !ov.provider,
  });
  if (p.isCancel(useActive)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  if (useActive) {
    delete config.operations.truth_verification.byok;
    return;
  }

  const provider = await p.select<ByokProvider>({
    message: "Which registered provider should truth verification use?",
    initialValue: registered.includes(currentProvider) ? currentProvider : registered[0],
    options: registered.map((id) => ({
      value: id,
      label: PROVIDER_LABELS[id],
      hint: `default model: ${config.byok.providers[id]!.default_model}`,
    })),
  });
  if (p.isCancel(provider)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  const overrideModel = await p.confirm({
    message: `Override the model? (leave off to use ${config.byok.providers[provider]!.default_model})`,
    initialValue: !!ov.model,
  });
  if (p.isCancel(overrideModel)) {
    p.cancel("Canceled.");
    process.exit(0);
  }

  const override: { provider: ByokProvider; model?: string } = { provider };
  if (overrideModel) {
    override.model = await pickModelFor(provider, ov.model ?? config.byok.providers[provider]!.default_model);
  }
  config.operations.truth_verification.byok = override;
}

// ---------------------------------------------------------------------------

function describeConfig(config: ProductosConfig): string {
  const lines: string[] = [];

  // Providers registry
  const registered = (Object.keys(config.byok.providers) as ByokProvider[]);
  if (registered.length === 0) {
    lines.push(`${pc.bold("BYOK providers:")}     none registered`);
  } else {
    lines.push(`${pc.bold("BYOK providers:")}`);
    for (const id of registered) {
      const reg = config.byok.providers[id]!;
      const set = !!process.env[reg.api_key_env];
      const activeBadge = id === config.byok.active ? pc.cyan(" (active)") : "";
      lines.push(
        `  - ${PROVIDER_LABELS[id]}${activeBadge}: ${reg.default_model} via ${reg.api_key_env}${set ? pc.green(" — set") : pc.red(" — not set")}`
      );
    }
  }

  const cs = config.operations.code_scanning;
  lines.push(`${pc.bold("Code scanning:")}      ${labelForCodeScanning(cs.handler)}`);

  const tv = config.operations.truth_verification;
  if (tv.handler === "byok") {
    const ov = tv.byok ?? {};
    const provider = ov.provider ?? config.byok.active;
    const reg = config.byok.providers[provider];
    if (!reg) {
      lines.push(`${pc.bold("Truth verification:")} BYOK (${provider} — ${pc.red("provider not registered")})`);
    } else {
      const model = ov.model ?? reg.default_model;
      lines.push(
        `${pc.bold("Truth verification:")} BYOK (${PROVIDER_LABELS[provider]} / ${model})`
      );
    }
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
