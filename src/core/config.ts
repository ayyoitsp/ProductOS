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
/**
 * ⛔ PUBLISHING A CORPUS IS AN EXTERNAL SEND, AND IT DEFAULTS TO REFUSED.
 *
 * A published page is the only way a button inside Claude can actually record anything — a strict
 * CSP blocks a rendered page from reaching localhost at all — so the affordance is genuinely
 * valuable. It also copies the product truth to claude.ai, and product truth routinely names a
 * real client. Whether that is acceptable is the corpus owner's call and nobody else's.
 *
 * So it is a per-corpus setting that starts at `never`, rather than a thing the tool remembers to
 * ask about. A protection that depends on somebody deciding correctly under time pressure, every
 * time, is not a protection.
 */
export const ExchangeConfig = z
  .object({
    publish: z
      .enum(["never", "allow"])
      .default("never")
      .describe("whether this corpus may be published to claude.ai as an interactive page"),
  })
  .strict();
export type ExchangeConfig = z.infer<typeof ExchangeConfig>;

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

/**
 * Web rendering options. Lets the user wire in their app's CSS so UX
 * sketches can render as real-looking mocks (when sketch_html is provided
 * on the UX view) instead of just ASCII art.
 */
/**
 * ⛔ WHICH MODEL RUNS EACH AGENT, AND IT IS THE CONSUMER'S CHOICE.
 *
 * Peter: "ideally in the future these job agents will be portable - model agnostic. we should let
 * people assign whatever model they want to each task."
 *
 * So no agent definition names a model. The spec says what the agent is for, what it must never do,
 * and which capabilities it needs; this says who runs it, per agent, per project. An adapter reads
 * both at install time and emits whatever the host wants.
 *
 * ⛔ AN UNKNOWN NAME IS REFUSED AT INSTALL, NOT AT RUN. A typo here otherwise surfaces as an agent
 * that fails halfway through a review somebody is waiting on.
 */
export const AgentsConfig = z.object({
  /** Used for any agent with nothing of its own. Absent means "whatever the host would use anyway". */
  default_model: z.string().optional(),
  /**
   * Per agent, by name — `consistency`, `coverage`, `generated`, `truthfulness`, `newcomer`,
   * `architecture`, `sufficiency`.
   */
  model: z.record(z.string(), z.string()).default({}),
  /** Per agent, how hard it should think, where the host understands such a thing. */
  effort: z.record(z.string(), z.enum(["low", "medium", "high", "max"])).default({}),
  /** ⛔ Agents a project has deliberately turned off, with the reason it is safe to. */
  off: z.record(z.string(), z.string()).default({}),
});
export type AgentsConfig = z.infer<typeof AgentsConfig>;

export const WebConfig = z.object({
  /** Path (relative to repo root) to a CSS file the user wants loaded into
   *  productos serve so UX mocks pick up their app's design system. The
   *  server exposes the file at /_user-style.css. */
  stylesheet: z.string().optional(),
  /**
   * Every stylesheet a mock needs, in cascade order.
   *
   * ⛔ A LIST, BECAUSE ONE FILE IS NOT HOW A REAL APP IS STYLED. The app this was built against
   * has four design-system files (tokens, themes, typography, styles) plus a Tailwind build, and
   * `stylesheet` could name one of them. Naming one produced a mock with the right class names and
   * none of the values they resolve to, which looks like a broken app rather than the app.
   *
   * ⛔ INLINED, NEVER LINKED. A published page is served from claude.ai under a strict CSP: an
   * external stylesheet is blocked, and there is no ProductOS server on the other side to ask. The
   * bytes travel with the page or the mock renders unstyled.
   */
  stylesheets: z.array(z.string()).default([]),
  /** Optional CSS class to wrap every UX mock in. Use to scope your styles
   *  if your app's CSS expects a root container class (e.g. "app-root"). */
  mock_container_class: z.string().optional(),
  /** Path (relative to repo root) to the directory containing the user's
   *  app components. Used by the AI editor as a HINT for where to look
   *  when reading component source to generate sketch_html. The AI uses
   *  the user's component structure (class names, layout, semantic
   *  elements) to produce static HTML mocks that look like the real app —
   *  WITHOUT running the user's code. Example: "src/components". */
  components_dir: z.string().optional(),
});
export type WebConfig = z.infer<typeof WebConfig>;

/**
 * What a readable tree looks like in THIS corpus.
 *
 * Exposed as config because the right number is a product judgement: a corpus of
 * twelve features and one of four hundred do not want the same ceiling. The defaults
 * are what `productos check` advises against when nobody has said otherwise.
 */
export const GroupingConfig = z.object({
  group_min: z.number().default(2),
  group_max: z.number().default(8),
  behaviors_max: z.number().default(24),
});
export type GroupingConfig = z.infer<typeof GroupingConfig>;

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
  web: WebConfig.default({}),
  agents: AgentsConfig.default({}),
  grouping: GroupingConfig.default({}),
  exchange: ExchangeConfig.default({}),
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
