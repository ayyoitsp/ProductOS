import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { Command } from "commander";
import { installClaudeSkills, uninstallClaudeSkills } from "../../adapters/claude.js";
import { readSteers, inEffect } from "../../v2/steers.js";
import {
  ensureDirs,
  pathsFor,
  resolvePathsOrThrow,
} from "../../core/paths.js";
import {
  defaultConfigFor,
  readConfig,
  writeConfig,
} from "../../core/config.js";

const SUPPORTED_RUNTIMES = ["claude"] as const;

export function initCommand(): Command {
  return new Command("init")
    .description("Install ProductOS into an AI runtime and connect it to a hosted project")
    .argument("<runtime>", `Runtime: ${SUPPORTED_RUNTIMES.join(" | ")}`)
    .option("--update", "Refresh skill files (overwrite existing)")
    .option("--uninstall", "Remove ProductOS from the runtime")
    .option("--at <project>", "The hosted project this repo's truth lives in, as https://<instance>/p/<project>")
    .action(async (runtime: string, opts: { update?: boolean; uninstall?: boolean; at?: string }) => {
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

      // 1. Install skills + register MCP
      /**
       * ⛔ THE PROJECT'S CONFIG GOES IN, because model choice per agent lives there. Installing
       * without it silently gives every agent the host's default, which is the one thing the
       * portability requirement was about.
       */
      let projectConfig;
      let projectRoot: string | undefined;
      try {
        const p = resolvePathsOrThrow();
        projectConfig = readConfig(p);
        // The repo the corpus belongs to — agents install beside it, not on the machine.
        projectRoot = path.dirname(path.dirname(p.configFile));
      } catch {
        projectConfig = undefined;
        projectRoot = undefined;
      }
      /**
       * ⛔ AND WHAT THIS PROJECT HAS LEARNED, so every author installs with it. Peter asked for an
       * addendum that "will run per org/project"; this is the install-time half of it. Resolved
       * here rather than in the adapter, because this is the layer that knows where a corpus is.
       */
      const steers = projectRoot ? readSteers(path.join(projectRoot, "v2")) : [];
      const install = installClaudeSkills({
        update: opts.update,
        config: projectConfig,
        configRoot: projectRoot,
        steers,
        instance: opts.at,
      });
      const verb = install.symlinked ? "Linked" : "Installed";
      for (const s of install.installed) {
        /**
         * ⛔ A REMOVAL IS NOT A LINK. Skills that no longer exist are taken away now, and reporting
         * that as "Linked skill: ~/.claude/skills/− productos-scope/" is the install claiming to
         * have added the thing it just deleted.
         */
        if (s.startsWith("− ")) {
          console.log(pc.yellow("−"), `Removed skill, no longer in this version: ${s.slice(2)}`);
          continue;
        }
        console.log(pc.green("✓"), `${verb} skill: ~/.claude/skills/${s}/`);
      }
      if (install.installed.length === 0) {
        console.log(pc.yellow("→"), "Skills already installed (use --update to refresh)");
      }
      if (install.symlinked && install.installed.length > 0) {
        console.log(pc.dim("   (dev install detected — skills are symlinked, so edits in skills/ are live immediately)"));
      }
      for (const a of install.agents) {
        /**
         * ⛔ "Written", never "Linked", whatever the skills did. An agent file is this host's
         * frontmatter generated from the registry and the project's config, plus the portable
         * prompt body — so there is nothing to symlink, and saying otherwise sends somebody to
         * edit a file they think is the source.
         */
        /**
         * ⛔ A REMOVAL READS AS A REMOVAL. The prune marks a gone role with a leading `−`, and this
         * printed every entry as "Wrote agent", so a deletion came out as
         * `✓ Wrote agent: …/− productos-framework.md` — a file path that does not exist, reported
         * as a success, for the one operation anybody would want to see clearly.
         */
        if (a.startsWith("− ")) {
          const name = a.slice(2);
          console.log(pc.yellow("−"), `Removed agent, no longer in the registry: ${path.join(install.agentsDir, `${name}.md`)}`);
        } else {
          console.log(pc.green("✓"), `Wrote agent: ${path.join(install.agentsDir, `${a}.md`)}`);
        }
      }
      /**
       * ⛔ AN ADDENDUM NOBODY WAS TOLD ABOUT IS A CONSTRAINT NOBODY CHOSE — the same defect
       * `decidedFor` exists to prevent. Every author just had this project's habits appended to its
       * instructions; saying so here is the only moment somebody finds out without going to look.
       */
      const live = inEffect(steers);
      if (live.length) {
        console.log(
          pc.green("✓"),
          `${live.length} ${live.length === 1 ? "steer" : "steers"} this project has learned, into every author ${pc.dim("(no judge gets one)")}`
        );
        for (const st of live) console.log(pc.dim(`   ${st.id} — ${st.says}`));
        console.log(pc.dim("   productos v2 steer list — what they are and where each was learned"));
      }
      /**
       * ⛔ THE NAME AND THE COMMAND, NOT JUST THE FILE IT WENT IN.
       *
       * This said "MCP server registered in <files>" while registering `command: "productos"` — the
       * bare name, which resolves through one global `npm link` slot. So every session on the
       * machine ran whichever checkout linked last, and the line that would have shown it said
       * nothing about what it had written. From a worktree the name is now per-checkout, and
       * somebody reading `claude mcp list` has to be able to recognise their own.
       */
      if (install.mcpRuns) {
        console.log(pc.green("✓"), `MCP server registered as ${pc.bold(install.mcpName)} in ${install.mcpRegisteredAt}`);
        console.log(pc.dim(`   it reaches: ${install.mcpRuns} — with the token in $PRODUCTOS_TOKEN`));
      } else {
        console.log(pc.yellow("!"), "No hosted project named, so Claude was not connected to one.");
        console.log(pc.dim("   productos init claude --at https://<instance>/p/<project>"));
      }

      /**
       * ⛔ NO CORPUS IS SCAFFOLDED. The truth lives on the hosted project, so the only thing written
       * here is the project's own config: which hosted project it is, and which model each agent runs.
       */
      const paths = pathsFor(process.cwd());
      ensureDirs(paths);
      const config = fs.existsSync(paths.configFile) ? readConfig(paths) : defaultConfigFor({ stack: detectStack(process.cwd()) });
      if (opts.at && config.instance !== opts.at) {
        config.instance = opts.at;
        writeConfig(paths, config);
        console.log(pc.green("✓"), `Wrote ${rel(paths.configFile)} — this repo's truth is at ${opts.at}`);
      } else if (!fs.existsSync(paths.configFile)) {
        writeConfig(paths, config);
        console.log(pc.green("✓"), `Wrote ${rel(paths.configFile)}`);
      }

      console.log();
      console.log(pc.bold("Next:"));
      /**
       * ⛔ WHERE THE TOKEN COMES FROM, NOT ONLY THAT ONE IS NEEDED. "Export a token" with no source
       * sent people to `productos hosted token`, which needs the database — so a project's owner had
       * no way in. The page mints one for its own project; see `src/v2/store/connect.ts`.
       */
      console.log(`  1. Export ${pc.bold("PRODUCTOS_TOKEN")} — press ${pc.bold("Connect Claude Code")} on the project's page to get one.`);
      console.log(`  2. Open Claude Code in this repo and say ${pc.cyan('"Scope the <feature> flow"')} or ${pc.cyan('"groom this ticket"')}.`);
      console.log(`  3. Review on the hosted page, and press what you agree with. ⛔ Nothing is accepted by having been written.`);
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

function rel(fp: string): string {
  return path.relative(process.cwd(), fp);
}
