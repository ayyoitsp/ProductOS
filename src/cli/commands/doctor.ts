import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";
import pc from "picocolors";
import { findRepoRoot, pathsFor } from "../../core/paths.js";
import { readConfig, resolveTruthVerificationByok } from "../../core/config.js";
import { envConfigFile, readEnvConfig } from "../../core/env.js";
import { listAreas, listFeatures, productsRoot } from "../../core/product.js";

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Check ProductOS install, runtime detection, env reachability, and product-truth state")
    .action(async () => {
      const ok = (msg: string) => console.log(pc.green("✓"), msg);
      const warn = (msg: string) => console.log(pc.yellow("!"), msg);
      const fail = (msg: string) => console.log(pc.red("✗"), msg);

      // 1. Claude Code install
      const claudeDir = path.join(os.homedir(), ".claude");
      if (fs.existsSync(claudeDir)) ok(`Claude Code present at ${claudeDir}`);
      else fail(`Claude Code not detected at ${claudeDir}`);

      // 2. Skills installed
      for (const s of ["productos-fullscan", "productos-scope", "productos-review", "productos-edit", "productos-align"]) {
        const p = path.join(claudeDir, "skills", s, "SKILL.md");
        if (fs.existsSync(p)) ok(`Skill installed: ${s}`);
        else warn(`Skill missing: ${s}  (run: productos init claude --update)`);
      }
      // Old skill names (pre-rename) — warn if still present so the user
      // can clean them up; they'll never be invoked again by Claude Code.
      for (const old of ["productos-analyze", "productos-feature", "productos-vet"]) {
        const p = path.join(claudeDir, "skills", old);
        if (fs.existsSync(p)) {
          warn(`Stale skill present: ${old}  (renamed — safe to remove: rm -rf ${p})`);
        }
      }

      // 3. MCP registered
      const projSettings = path.join(process.cwd(), ".claude", "settings.json");
      const userSettings = path.join(claudeDir, "settings.json");
      const settingsCheck = (p: string) => {
        if (!fs.existsSync(p)) return null;
        try {
          const s = JSON.parse(fs.readFileSync(p, "utf-8"));
          return s.mcpServers?.productos ? p : null;
        } catch {
          return null;
        }
      };
      const where = settingsCheck(projSettings) ?? settingsCheck(userSettings);
      if (where) ok(`MCP server registered in ${where}`);
      else warn(`MCP server not registered in either ${projSettings} or ${userSettings}`);

      // 4. productos/ scaffolded
      const repoRoot = findRepoRoot(process.cwd());
      if (!repoRoot) {
        warn("Not inside a git repo or a ProductOS project");
        return;
      }
      const paths = pathsFor(repoRoot);
      if (fs.existsSync(paths.root)) ok(`productos/ scaffolded at ${path.relative(process.cwd(), paths.root) || "."}`);
      else warn("productos/ not scaffolded (run: productos init claude)");

      // 5. Config
      if (fs.existsSync(paths.configFile)) {
        try {
          const c = readConfig(paths);
          ok(`Config readable; stack=${c.stack.language}`);
          // 5b. Operations
          ok(`Code scanning handler: ${c.operations.code_scanning.handler}`);
          const tvh = c.operations.truth_verification.handler;
          if (tvh === "byok") {
            const byok = resolveTruthVerificationByok(c);
            const keyPresent = !!process.env[byok.api_key_env];
            if (keyPresent) ok(`Truth verification: BYOK ${byok.provider}/${byok.model} (key from ${byok.api_key_env})`);
            else warn(`Truth verification: BYOK ${byok.provider}/${byok.model} but ${byok.api_key_env} is not set — auto-processing will fail`);
          } else {
            ok(`Truth verification: queue (Claude processes via MCP in a later session)`);
          }
        } catch (e) {
          fail(`Config malformed: ${(e as Error).message}`);
        }
      } else {
        warn(`No config at ${path.relative(process.cwd(), paths.configFile)}`);
      }

      // 6. Product truth state
      if (fs.existsSync(productsRoot(paths))) {
        const areas = listAreas(paths);
        const features = listFeatures(paths);
        const totalBehaviors = features.reduce((s, f) => s + f.frontmatter.behaviors.length, 0);
        ok(`Product truth: ${areas.length} area(s), ${features.length} feature(s), ${totalBehaviors} behavior(s)`);
      } else {
        warn("productos/products/ not scaffolded");
      }

      // 7. env.yaml + healthcheck per env
      const envFile = envConfigFile(paths);
      if (fs.existsSync(envFile)) {
        try {
          const config = readEnvConfig(paths);
          if (config) {
            const envCount = Object.keys(config.envs).length;
            ok(`env.yaml readable; ${envCount} env(s) configured, default=${config.default_env}`);
            for (const [name, env] of Object.entries(config.envs)) {
              const tag = env.external ? " [external]" : env.read_only ? " [read-only]" : "";
              if (env.healthcheck?.url) {
                try {
                  const ac = new AbortController();
                  const t = setTimeout(() => ac.abort(), 2000);
                  const r = await fetch(env.healthcheck.url, { signal: ac.signal });
                  clearTimeout(t);
                  if (r.status === env.healthcheck.expect_status) {
                    ok(`Env "${name}" healthy${tag}: ${env.healthcheck.url} returned ${r.status}`);
                  } else {
                    warn(`Env "${name}" healthcheck mismatch${tag}: returned ${r.status}, expected ${env.healthcheck.expect_status}`);
                  }
                } catch (e) {
                  warn(`Env "${name}" not healthy${tag}: ${env.healthcheck.url} unreachable (${(e as Error).message})`);
                }
              } else {
                warn(`Env "${name}" has no healthcheck${tag}`);
              }
            }
          }
        } catch (e) {
          fail(`env.yaml malformed: ${(e as Error).message}`);
        }
      } else {
        warn(`No env.yaml at ${path.relative(process.cwd(), envFile)}`);
      }
    });
}
