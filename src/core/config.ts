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
 * Default BYOK config — operations that select handler='byok' inherit from
 * here unless they override the fields locally.
 */
export const ByokConfig = z.object({
  provider: ByokProvider.default("anthropic"),
  api_key_env: z.string().default("ANTHROPIC_API_KEY"),
  model: z.string().default("claude-sonnet-4-6"),
  max_steps: z.number().default(5),
});
export type ByokConfig = z.infer<typeof ByokConfig>;

/**
 * Per-operation handler. Each operation (code scanning, truth verification,
 * etc.) picks one of these. When more areas land (drift detection, ticket
 * sync, etc.) they reuse the same shape.
 */
export const CodeScanningHandler = z.enum(["claude", "codex", "manual"]);
export type CodeScanningHandler = z.infer<typeof CodeScanningHandler>;
export const TruthVerificationHandler = z.enum(["queue", "byok"]);
export type TruthVerificationHandler = z.infer<typeof TruthVerificationHandler>;

export const OperationByokOverride = z.object({
  provider: ByokProvider.optional(),
  api_key_env: z.string().optional(),
  model: z.string().optional(),
});

export const CodeScanningConfig = z.object({
  handler: CodeScanningHandler.default("claude"),
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
 * Resolve the effective BYOK config for a truth-verification operation that
 * has handler='byok'. Operation-level overrides take precedence; defaults
 * come from the top-level byok block.
 */
export function resolveTruthVerificationByok(config: ProductosConfig): ByokConfig {
  const op = config.operations.truth_verification;
  const ov = op.byok ?? {};
  return ByokConfig.parse({
    provider: ov.provider ?? config.byok.provider,
    api_key_env: ov.api_key_env ?? config.byok.api_key_env,
    model: ov.model ?? config.byok.model,
    max_steps: config.byok.max_steps,
  });
}
