import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";
import pc from "picocolors";
import { findRepoRoot, pathsFor } from "../../core/paths.js";
import { readConfig } from "../../core/config.js";

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
          ok(`Config readable; stack=${c.stack.language}/${c.stack.test_framework}, target=${c.default_target}`);
          // 6. Target reachable
          const t = c.targets[c.default_target];
          if (t?.url) {
            try {
              const r = await fetch(t.url, { method: "GET" });
              ok(`Target ${t.url} reachable (status ${r.status})`);
            } catch (e) {
              warn(`Target ${t.url} unreachable (${(e as Error).message}) — start your dev server before live-validating`);
            }
          }
        } catch (e) {
          fail(`Config malformed: ${(e as Error).message}`);
        }
      } else {
        warn(`No config at ${path.relative(process.cwd(), paths.configFile)} — run: productos init claude`);
      }
    });
}
