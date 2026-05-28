import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";
import pc from "picocolors";
import { findRepoRoot, pathsFor } from "../../core/paths.js";
import { readConfig } from "../../core/config.js";
import { envConfigFile, readEnvConfig } from "../../core/env.js";

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Check ProductOS install, runtime detection, and reachability")
    .action(async () => {
      const ok = (msg: string) => console.log(pc.green("✓"), msg);
      const warn = (msg: string) => console.log(pc.yellow("!"), msg);
      const fail = (msg: string) => console.log(pc.red("✗"), msg);

      // 1. Claude Code install
      const claudeDir = path.join(os.homedir(), ".claude");
      if (fs.existsSync(claudeDir)) ok(`Claude Code present at ${claudeDir}`);
      else fail(`Claude Code not detected at ${claudeDir}`);

      // 2. Skills installed
      const skills = ["productos-analyze", "productos-feature"];
      for (const s of skills) {
        const p = path.join(claudeDir, "skills", s, "SKILL.md");
        if (fs.existsSync(p)) ok(`Skill installed: ${s}`);
        else warn(`Skill missing: ${s}  (run: productos init claude)`);
      }

      // 3. MCP registered (in either project or user settings)
      const projSettings = path.join(process.cwd(), ".claude", "settings.json");
      const userSettings = path.join(claudeDir, "settings.json");
      const settingsCheck = (p: string) => {
        if (!fs.existsSync(p)) return null;
        const s = JSON.parse(fs.readFileSync(p, "utf-8"));
        return s.mcpServers?.productos ? p : null;
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
      else warn(`productos/ not scaffolded (run: productos init claude)`);

      // 5. Config readable
      if (fs.existsSync(paths.configFile)) {
        try {
          const c = readConfig(paths);
          ok(`Config readable; stack=${c.stack.language}/${c.stack.test_framework}`);
        } catch (e) {
          fail(`Config malformed: ${(e as Error).message}`);
        }
      } else {
        warn(`No config at ${path.relative(process.cwd(), paths.configFile)} — run: productos init claude`);
      }

      // 6. env.yaml readable
      const envFile = envConfigFile(paths);
      if (fs.existsSync(envFile)) {
        try {
          const env = readEnvConfig(paths);
          if (env) {
            ok(`env.yaml readable; ${env.setup.length} setup command(s), healthcheck ${env.healthcheck ? "configured" : "missing"}`);
            // 7. Healthcheck
            if (env.healthcheck?.url) {
              try {
                const r = await fetch(env.healthcheck.url, { method: "GET" });
                if (r.status === env.healthcheck.expect_status) {
                  ok(`Env healthy: ${env.healthcheck.url} returned ${r.status}`);
                } else {
                  warn(`Env healthcheck mismatch: ${env.healthcheck.url} returned ${r.status}, expected ${env.healthcheck.expect_status} — run \`productos env up\``);
                }
              } catch (e) {
                warn(`Env not healthy: ${env.healthcheck.url} unreachable (${(e as Error).message}) — run \`productos env up\``);
              }
            } else {
              warn("env.yaml has no healthcheck — Claude won't know if the env is up");
            }
          }
        } catch (e) {
          fail(`env.yaml malformed: ${(e as Error).message}`);
        }
      } else {
        warn(`No env.yaml at ${path.relative(process.cwd(), envFile)} — run: productos init claude`);
      }
    });
}
