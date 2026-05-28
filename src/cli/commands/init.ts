import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { Command } from "commander";
import { installClaudeSkills, uninstallClaudeSkills } from "../../adapters/claude.js";
import {
  ensureDirs,
  findRepoRoot,
  pathsFor,
} from "../../core/paths.js";
import {
  defaultConfigFor,
  readConfig,
  writeConfig,
} from "../../core/config.js";
import { envConfigFile, starterEnvYaml } from "../../core/env.js";

const SUPPORTED_RUNTIMES = ["claude"] as const;

export function initCommand(): Command {
  return new Command("init")
    .description("Install ProductOS into an AI runtime and scaffold productos/ in this repo")
    .argument("<runtime>", `Runtime to install into: ${SUPPORTED_RUNTIMES.join(" | ")}`)
    .option("--update", "Refresh skill files (overwrite existing)")
    .option("--uninstall", "Remove ProductOS from the runtime")
    .action(async (runtime: string, opts: { update?: boolean; uninstall?: boolean }) => {
      if (!SUPPORTED_RUNTIMES.includes(runtime as typeof SUPPORTED_RUNTIMES[number])) {
        console.error(pc.red(`Unsupported runtime: ${runtime}`));
        console.error(`Supported: ${SUPPORTED_RUNTIMES.join(", ")}`);
        process.exit(1);
      }

      if (opts.uninstall) {
        const r = uninstallClaudeSkills();
        console.log(pc.green("✓"), `Removed ${r.removed.length} skills:`, r.removed.join(", ") || "(none)");
        return;
      }

      // 1. Install skills + register MCP in the runtime
      const install = installClaudeSkills({ update: opts.update });
      for (const s of install.installed) {
        console.log(pc.green("✓"), `Installed skill: ~/.claude/skills/${s}/`);
      }
      if (install.installed.length === 0) {
        console.log(pc.yellow("→"), "Skills already installed (use --update to refresh)");
      }
      console.log(pc.green("✓"), `MCP server registered in ${install.mcpRegisteredAt}`);

      // 2. Scaffold productos/ in the repo
      const repoRoot = findRepoRoot(process.cwd()) ?? process.cwd();
      const paths = pathsFor(repoRoot);
      ensureDirs(paths);
      console.log(pc.green("✓"), `Created ${path.relative(process.cwd(), paths.root)}/ (truth/, traces/, fixtures/, tests/)`);

      // 3. Write config if it doesn't exist
      if (!fs.existsSync(paths.configFile)) {
        const stack = detectStack(repoRoot);
        const config = defaultConfigFor({ stack });
        writeConfig(paths, config);
        console.log(
          pc.green("✓"),
          `Wrote ${path.relative(process.cwd(), paths.configFile)} (stack: ${stack.language}/${stack.test_framework})`
        );
      } else {
        const config = readConfig(paths);
        console.log(
          pc.yellow("→"),
          `${path.relative(process.cwd(), paths.configFile)} already exists (stack: ${config.stack.language}/${config.stack.test_framework})`
        );
      }

      // 4. Scaffold productos/env.yaml if missing
      const envFile = envConfigFile(paths);
      if (!fs.existsSync(envFile)) {
        const hasDocker =
          fs.existsSync(path.join(repoRoot, "docker-compose.yml")) ||
          fs.existsSync(path.join(repoRoot, "docker-compose.yaml")) ||
          fs.existsSync(path.join(repoRoot, "compose.yaml"));
        const stack = readConfig(paths).stack;
        fs.writeFileSync(envFile, starterEnvYaml({ language: stack.language, hasDocker }), "utf-8");
        console.log(
          pc.green("✓"),
          `Wrote ${path.relative(process.cwd(), envFile)} — ${pc.bold("edit this!")} It tells Claude how to bring up your dev stack.`
        );
      } else {
        console.log(pc.yellow("→"), `${path.relative(process.cwd(), envFile)} already exists`);
      }

      // 5. Add productos/.local/ and productos/tests/proposed/ to .gitignore
      ensureGitignore(repoRoot);
      console.log(pc.green("✓"), "Added gitignore entries for productos local-only state");

      // 6. Next steps
      console.log();
      console.log(pc.bold("Next:"));
      console.log(`  1. ${pc.bold("Edit productos/env.yaml")} — set the right setup commands and healthcheck URL for your stack.`);
      console.log("  2. Verify the env config works: `productos env up` (uses default env: `local`)");
      console.log("  3. In another terminal: `productos serve` (vet UI on localhost:" + readConfig(paths).ui_port + ")");
      console.log("  4. Open Claude Code in this repo. Say: \"do a ProductOS pass on this codebase\"");
      console.log("     — Claude reads the code, proposes Truth claims, drives the live env to validate each,");
      console.log("       and reports outcomes. You review and approve in the vet UI.");
    });
}

function detectStack(repoRoot: string): { language: "typescript" | "javascript" | "python"; test_framework: "jest" | "vitest" | "pytest" | "playwright"; test_command: string } {
  const pkgJson = path.join(repoRoot, "package.json");
  if (fs.existsSync(pkgJson)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasTs = !!deps.typescript;
    const lang = hasTs ? "typescript" : "javascript";
    if (deps.vitest) return { language: lang, test_framework: "vitest", test_command: "npx vitest run" };
    if (deps.jest || deps["@types/jest"]) return { language: lang, test_framework: "jest", test_command: "npx jest" };
    if (deps["@playwright/test"]) return { language: lang, test_framework: "playwright", test_command: "npx playwright test" };
    return { language: lang, test_framework: "jest", test_command: "npm test" };
  }
  if (fs.existsSync(path.join(repoRoot, "pyproject.toml")) || fs.existsSync(path.join(repoRoot, "requirements.txt"))) {
    return { language: "python", test_framework: "pytest", test_command: "pytest" };
  }
  return { language: "typescript", test_framework: "jest", test_command: "npm test" };
}

function ensureGitignore(repoRoot: string): void {
  const gi = path.join(repoRoot, ".gitignore");
  const wanted = ["productos/.local/", "productos/tests/proposed/"];
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, `# ProductOS local-only state\n${wanted.join("\n")}\n`);
    return;
  }
  const content = fs.readFileSync(gi, "utf-8");
  const existing = new Set(content.split("\n").map((l) => l.trim()));
  const missing = wanted.filter((w) => !existing.has(w));
  if (missing.length === 0) return;
  const sep = content.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(gi, `${sep}\n# ProductOS local-only state\n${missing.join("\n")}\n`);
}
