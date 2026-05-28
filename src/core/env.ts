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
  timeout_seconds: z.number().default(30),
  retries: z.number().default(10),
  retry_delay_ms: z.number().default(1000),
});
export type HealthCheck = z.infer<typeof HealthCheck>;

export const EnvConfig = z.object({
  version: z.union([z.literal(1), z.string()]).default(1),

  // Describe each service so a human (or Claude) reading this knows what's running.
  services: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        url: z.string().optional(),
      })
    )
    .default([]),

  // Bring the env up from cold. Commands run sequentially; failure aborts.
  setup: z.array(EnvCommand).default([]),

  // Verify the env is reachable.
  healthcheck: HealthCheck.optional(),

  // Reset state before each validation run (optional).
  reset_per_run: z.array(EnvCommand).default([]),

  // Bring the env down. Claude doesn't auto-teardown — only on explicit request.
  teardown: z.array(EnvCommand).default([]),

  // Where Claude stages proposed-but-not-yet-validated tests (gitignored).
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

/** A reasonable starter env.yaml — commented for the user, framework-aware. */
export function starterEnvYaml(opts: {
  language: "typescript" | "javascript" | "python";
  hasDocker: boolean;
}): string {
  const lines: string[] = [];
  lines.push("# productos/env.yaml");
  lines.push("# Tells the AI runtime how to bring up your dev environment so it can");
  lines.push("# drive live code to validate Truth claims. Customize for your stack.");
  lines.push("");
  lines.push("version: 1");
  lines.push("");
  lines.push("# Services running in this stack (informational — shown in vet UI).");
  lines.push("services:");
  lines.push("  - name: backend");
  lines.push("    url: http://localhost:3000");
  lines.push("    description: HTTP API server");
  lines.push("");
  lines.push("# Bring the env up from cold. Commands run sequentially.");
  lines.push("setup:");
  if (opts.hasDocker) {
    lines.push("  - command: \"docker compose up -d\"");
    lines.push("    description: Start backing services (db, cache)");
  }
  if (opts.language === "python") {
    lines.push("  - command: \"pip install -r requirements.txt\"");
  } else {
    lines.push("  - command: \"npm install\"");
  }
  lines.push("  # Add your dev server start command here, e.g.:");
  lines.push("  # - command: \"npm run dev\"");
  lines.push("  #   description: Start the API server (background if needed)");
  lines.push("");
  lines.push("# Verify the env is reachable before running tests.");
  lines.push("healthcheck:");
  lines.push("  url: http://localhost:3000/health");
  lines.push("  expect_status: 200");
  lines.push("  retries: 10");
  lines.push("  retry_delay_ms: 1000");
  lines.push("");
  lines.push("# Reset state before each validation run (optional).");
  lines.push("reset_per_run: []");
  lines.push("  # - command: \"npm run db:reset && npm run db:seed\"");
  lines.push("");
  lines.push("# Teardown (Claude won't run this automatically — only on explicit request).");
  lines.push("teardown:");
  if (opts.hasDocker) {
    lines.push("  - command: \"docker compose down\"");
  } else {
    lines.push("  []");
  }
  lines.push("");
  lines.push("# Where Claude stages tests before they're approved (gitignored).");
  lines.push("staging_dir: productos/tests/proposed");
  lines.push("");
  return lines.join("\n");
}
