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
