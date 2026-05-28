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

      // 4. Add productos/.local/ to .gitignore
      ensureGitignore(repoRoot);
      console.log(pc.green("✓"), "Added `productos/.local/` to .gitignore");

      // 5. Next steps
      console.log();
      console.log(pc.bold("Next:"));
      console.log("  • Open Claude Code in this repo");
      console.log("  • Say: \"scan this codebase and propose ProductOS truth\"");
      console.log(`  • Open ${pc.cyan("http://localhost:" + readConfig(paths).ui_port)} when proposals arrive`);
      console.log(`  • Run ${pc.bold("productos serve")} in another terminal to start the vet UI`);
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
  const line = "productos/.local/";
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, `${line}\n`);
    return;
  }
  const content = fs.readFileSync(gi, "utf-8");
  if (content.split("\n").some((l) => l.trim() === line)) return;
  const sep = content.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(gi, `${sep}\n# ProductOS local-only state\n${line}\n`);
}
