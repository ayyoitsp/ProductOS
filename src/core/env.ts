import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

export const EnvCommand = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout_seconds: z.number().default(120),
  description: z.string().optional(),
});
export type EnvCommand = z.infer<typeof EnvCommand>;

export const HealthCheck = z.object({
  url: z.string().optional(),
  command: z.string().optional(),
  expect_status: z.number().default(200),
  headers: z.record(z.string()).optional(),    // values support "$VAR" / "${VAR}" indirection
  timeout_seconds: z.number().default(30),
  retries: z.number().default(10),
  retry_delay_ms: z.number().default(1000),
});
export type HealthCheck = z.infer<typeof HealthCheck>;

export const Service = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
});
export type Service = z.infer<typeof Service>;

export const Env = z.object({
  description: z.string().optional(),
  external: z
    .boolean()
    .default(false)
    .describe("True when ProductOS does not own the env (staging, prod-like). Skill should not propose starting services."),
  read_only: z
    .boolean()
    .default(false)
    .describe("Disallows reset_per_run + teardown. Safe default for external envs."),
  services: z.array(Service).default([]),
  setup: z.array(EnvCommand).default([]),
  healthcheck: HealthCheck.optional(),
  reset_per_run: z.array(EnvCommand).default([]),
  teardown: z.array(EnvCommand).default([]),
  test_env: z
    .record(z.string())
    .optional()
    .describe("Env vars to export when running tests against this env (e.g. BASE_URL, AUTH_TOKEN). Values support $VAR indirection."),
});
export type Env = z.infer<typeof Env>;

export const EnvConfig = z.object({
  version: z.union([z.literal(1), z.string()]).default(1),
  default_env: z.string().default("local"),
  envs: z.record(Env),
  staging_dir: z.string().default("productos/tests/proposed"),
});
export type EnvConfig = z.infer<typeof EnvConfig>;

export function readEnvConfig(paths: ProductosPaths): EnvConfig | null {
  const fp = envConfigFile(paths);
  if (!fs.existsSync(fp)) return null;
  const raw = YAML.parse(fs.readFileSync(fp, "utf-8")) ?? {};
  return EnvConfig.parse(raw);
}

export function writeEnvConfig(paths: ProductosPaths, env: EnvConfig): void {
  const fp = envConfigFile(paths);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, YAML.stringify(env, { lineWidth: 0 }), "utf-8");
}

export function envConfigFile(paths: ProductosPaths): string {
  return path.join(paths.root, "env.yaml");
}

/**
 * Resolve a single named env, or the default if name is omitted.
 * Returns { name, env } so callers know which env they got.
 */
export function resolveEnv(
  config: EnvConfig,
  name?: string
): { name: string; env: Env } {
  const target = name ?? config.default_env;
  const env = config.envs[target];
  if (!env) {
    const known = Object.keys(config.envs).join(", ") || "(none)";
    throw new Error(`No env named "${target}" in productos/env.yaml. Known envs: ${known}`);
  }
  return { name: target, env };
}

/** Resolve $VAR / ${VAR} indirections in a string against process.env. */
export function resolveEnvVars(s: string): string {
  return s.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g, (_m, a, b) => {
    const name = a ?? b;
    return process.env[name] ?? "";
  });
}

/** Resolve indirections in all string values of a record. */
export function resolveRecord(rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = resolveEnvVars(v);
  return out;
}

/** Starter env.yaml — stack-aware, demonstrates both local and (commented) external. */
export function starterEnvYaml(opts: {
  language: "typescript" | "javascript" | "python";
  hasDocker: boolean;
}): string {
  const installCmd = opts.language === "python" ? "pip install -r requirements.txt" : "npm install";

  const setupItems: string[] = [];
  if (opts.hasDocker) {
    setupItems.push(`      - command: "docker compose up -d"\n        description: Start backing services (db, cache)`);
  }
  setupItems.push(`      - command: "${installCmd}"`);
  // Commented suggestion the user can uncomment
  setupItems.push(`      # - command: "npm run dev"\n      #   description: Start the API server`);
  const setupBlock = `    setup:\n${setupItems.join("\n")}\n`;

  const teardownBlock = opts.hasDocker
    ? `    teardown:\n      - command: "docker compose down"\n`
    : `    teardown: []\n`;

  return `# productos/env.yaml
# Defines one or more environments Claude can drive when validating Truth.
# Each env has its own setup/healthcheck/reset commands. Use \`productos env <cmd> [name]\`
# to drive a specific env, e.g. \`productos env up local\` or \`productos env check staging\`.

version: 1

# Which env is used when no name is given to \`productos env\` commands.
default_env: local

# Where Claude stages tests during validation (shared across envs, gitignored).
staging_dir: productos/tests/proposed

envs:

  # ---------------------------------------------------------------------------
  # local — your dev environment on this machine. Claude owns it: it can start,
  # reset, and tear down services. Most validation happens here.
  # ---------------------------------------------------------------------------
  local:
    description: Local dev environment
    external: false       # ProductOS owns this env; safe to start/reset/teardown
    read_only: false
    services:
      - name: backend
        url: http://localhost:3000
        description: HTTP API server
${setupBlock}    healthcheck:
      url: http://localhost:3000/health
      expect_status: 200
      retries: 10
      retry_delay_ms: 1000
    reset_per_run: []
      # - command: "npm run db:reset && npm run db:seed"
${teardownBlock}    test_env:
      BASE_URL: http://localhost:3000

  # ---------------------------------------------------------------------------
  # staging — external environment ProductOS doesn't own. Uncomment + edit.
  # read_only=true blocks reset/teardown so Claude can't accidentally wipe it.
  # ---------------------------------------------------------------------------
  # staging:
  #   description: External staging environment
  #   external: true
  #   read_only: true
  #   services:
  #     - name: backend
  #       url: https://staging.example.com
  #   setup: []           # nothing to start — env is already running
  #   healthcheck:
  #     url: https://staging.example.com/health
  #     expect_status: 200
  #     headers:
  #       authorization: "Bearer \${STAGING_TOKEN}"   # \$VAR resolved from process env
  #   reset_per_run: []
  #   teardown: []
  #   test_env:
  #     BASE_URL: https://staging.example.com
  #     AUTH_TOKEN: \${STAGING_TOKEN}
`;
}
