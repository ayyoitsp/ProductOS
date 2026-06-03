import fs from "node:fs";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

export const TargetConfig = z.object({
  url: z.string().optional(),
  command: z.string().optional(),
  auth_token_env: z.string().optional(),
});
export type TargetConfig = z.infer<typeof TargetConfig>;

export const ByokProvider = z.enum(["anthropic", "openai", "google", "openrouter"]);
export type ByokProvider = z.infer<typeof ByokProvider>;

/**
 * One registered provider — the env var that holds its key, plus the model
 * to use by default whenever this provider is picked. Operations can
 * override the model per-op without re-registering the provider.
 */
export const ByokProviderConfig = z.object({
  api_key_env: z.string(),
  default_model: z.string(),
});
export type ByokProviderConfig = z.infer<typeof ByokProviderConfig>;

const ByokProvidersMap = z.object({
  anthropic: ByokProviderConfig.optional(),
  openai: ByokProviderConfig.optional(),
  google: ByokProviderConfig.optional(),
  openrouter: ByokProviderConfig.optional(),
});
export type ByokProvidersMap = z.infer<typeof ByokProvidersMap>;

/**
 * BYOK registry: multiple providers can be configured simultaneously
 * (each with its own key env var + default model). One is marked `active`
 * and serves as the default for any operation set to handler='byok'.
 * Operations can override `provider` / `model` per-op.
 *
 * Backwards compat: the legacy flat shape (`provider`, `api_key_env`,
 * `model` at the top of `byok:`) is migrated into the registry by the
 * preprocess below, so existing configs keep working without manual edits.
 */
const ByokConfigInner = z.object({
  active: ByokProvider.default("anthropic"),
  providers: ByokProvidersMap.default({}),
  max_steps: z.number().default(5),
});

export const ByokConfig = z.preprocess((raw: unknown) => {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  // New shape already — leave it alone.
  if (r.providers !== undefined || r.active !== undefined) return raw;
  // Legacy flat shape — migrate.
  const provider = (typeof r.provider === "string" ? r.provider : "anthropic") as ByokProvider;
  const api_key_env = (typeof r.api_key_env === "string" ? r.api_key_env : defaultKeyEnvFor(provider));
  const default_model = (typeof r.model === "string" ? r.model : defaultModelFor(provider));
  return {
    active: provider,
    providers: { [provider]: { api_key_env, default_model } },
    max_steps: typeof r.max_steps === "number" ? r.max_steps : 5,
  };
}, ByokConfigInner);
export type ByokConfig = z.infer<typeof ByokConfigInner>;

/**
 * Resolved BYOK config — the shape the processor consumes. Always has
 * provider/api_key_env/model/max_steps filled in.
 */
export interface ResolvedByok {
  provider: ByokProvider;
  api_key_env: string;
  model: string;
  max_steps: number;
}

export function defaultKeyEnvFor(provider: ByokProvider): string {
  switch (provider) {
    case "anthropic": return "ANTHROPIC_API_KEY";
    case "openai": return "OPENAI_API_KEY";
    case "google": return "GOOGLE_GENERATIVE_AI_API_KEY";
    case "openrouter": return "OPENROUTER_API_KEY";
  }
}

export function defaultModelFor(provider: ByokProvider): string {
  switch (provider) {
    case "anthropic": return "claude-sonnet-4-6";
    case "openai": return "gpt-4o";
    case "google": return "gemini-2.0-flash";
    case "openrouter": return "anthropic/claude-sonnet-4-6";
  }
}

/**
 * Per-operation handler. Each operation (code scanning, truth verification,
 * etc.) picks one of these. When more areas land (drift detection, ticket
 * sync, etc.) they reuse the same shape.
 */
export const CodeScanningHandler = z.enum(["claude", "codex", "byok", "manual"]);
export type CodeScanningHandler = z.infer<typeof CodeScanningHandler>;
export const TruthVerificationHandler = z.enum(["queue", "byok"]);
export type TruthVerificationHandler = z.infer<typeof TruthVerificationHandler>;

/**
 * Per-op override. Keys come from the registry (`byok.providers[provider]`),
 * so we only carry provider + model here.
 */
export const OperationByokOverride = z.object({
  provider: ByokProvider.optional(),
  model: z.string().optional(),
});

export const CodeScanningConfig = z.object({
  handler: CodeScanningHandler.default("claude"),
  byok: OperationByokOverride.optional(),
});

export const TruthVerificationConfig = z.object({
  handler: TruthVerificationHandler.default("queue"),
  byok: OperationByokOverride.optional(),
});

export const OperationsConfig = z.object({
  code_scanning: CodeScanningConfig.default({}),
  truth_verification: TruthVerificationConfig.default({}),
});
export type OperationsConfig = z.infer<typeof OperationsConfig>;

export const StackConfig = z.object({
  language: z.enum(["typescript", "javascript", "python"]).default("typescript"),
  test_framework: z
    .enum(["jest", "vitest", "pytest", "playwright"])
    .default("jest"),
  test_command: z.string().default("npm test"),
});
export type StackConfig = z.infer<typeof StackConfig>;

export const ProductosConfig = z.object({
  version: z.string().default("0.0.1"),
  stack: StackConfig.default({
    language: "typescript",
    test_framework: "jest",
    test_command: "npm test",
  }),
  targets: z.record(TargetConfig).default({
    "local-dev": { url: "http://localhost:3000" },
  }),
  default_target: z.string().default("local-dev"),
  ui_port: z.number().default(7878),
  byok: ByokConfig.default({}),
  operations: OperationsConfig.default({}),
});
export type ProductosConfig = z.infer<typeof ProductosConfig>;

export function readConfig(paths: ProductosPaths): ProductosConfig {
  if (!fs.existsSync(paths.configFile)) {
    return ProductosConfig.parse({});
  }
  const raw = YAML.parse(fs.readFileSync(paths.configFile, "utf-8")) ?? {};
  return ProductosConfig.parse(raw);
}

export function writeConfig(paths: ProductosPaths, config: ProductosConfig): void {
  const yaml = YAML.stringify(config, { lineWidth: 0 });
  fs.writeFileSync(paths.configFile, yaml, "utf-8");
}

export function defaultConfigFor(opts: {
  stack?: Partial<StackConfig>;
  targetUrl?: string;
}): ProductosConfig {
  return ProductosConfig.parse({
    stack: opts.stack,
    targets: { "local-dev": { url: opts.targetUrl ?? "http://localhost:3000" } },
    default_target: "local-dev",
  });
}

/**
 * Resolve a BYOK config for a given operation. Operation-level override
 * takes precedence; otherwise the registry's active provider is used.
 * Model falls back to that provider's `default_model`. Throws if the
 * selected provider isn't registered.
 */
function resolveByokFor(
  config: ProductosConfig,
  opName: string,
  override: { provider?: ByokProvider; model?: string } | undefined
): ResolvedByok {
  const ov = override ?? {};
  const provider = ov.provider ?? config.byok.active;
  const reg = config.byok.providers[provider];
  if (!reg) {
    throw new Error(
      `BYOK provider "${provider}" is selected for ${opName} but not registered in byok.providers. Run \`productos configure byok\` to add it.`
    );
  }
  return {
    provider,
    api_key_env: reg.api_key_env,
    model: ov.model ?? reg.default_model,
    max_steps: config.byok.max_steps,
  };
}

export function resolveTruthVerificationByok(config: ProductosConfig): ResolvedByok {
  return resolveByokFor(config, "truth_verification", config.operations.truth_verification.byok);
}

export function resolveCodeScanningByok(config: ProductosConfig): ResolvedByok {
  return resolveByokFor(config, "code_scanning", config.operations.code_scanning.byok);
}
