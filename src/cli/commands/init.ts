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
import { ensureProductsDirs, topReadmePath, areaReadmePath, featureFilePath } from "../../core/product.js";

const SUPPORTED_RUNTIMES = ["claude"] as const;

export function initCommand(): Command {
  return new Command("init")
    .description("Install ProductOS into an AI runtime and scaffold productos/ in this repo")
    .argument("<runtime>", `Runtime: ${SUPPORTED_RUNTIMES.join(" | ")}`)
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

      // 1. Install skills + register MCP
      const install = installClaudeSkills({ update: opts.update });
      for (const s of install.installed) {
        console.log(pc.green("✓"), `Installed skill: ~/.claude/skills/${s}/`);
      }
      if (install.installed.length === 0) {
        console.log(pc.yellow("→"), "Skills already installed (use --update to refresh)");
      }
      console.log(pc.green("✓"), `MCP server registered in ${install.mcpRegisteredAt}`);

      // 2. Scaffold productos/ + productos/products/
      const repoRoot = findRepoRoot(process.cwd()) ?? process.cwd();
      const paths = pathsFor(repoRoot);
      ensureDirs(paths);
      ensureProductsDirs(paths);

      // 3. Write config if missing
      if (!fs.existsSync(paths.configFile)) {
        const stack = detectStack(repoRoot);
        const config = defaultConfigFor({ stack });
        writeConfig(paths, config);
        console.log(pc.green("✓"), `Wrote ${rel(paths.configFile)} (stack: ${stack.language})`);
      }

      // 4. Scaffold env.yaml
      const envFile = envConfigFile(paths);
      if (!fs.existsSync(envFile)) {
        const hasDocker =
          fs.existsSync(path.join(repoRoot, "docker-compose.yml")) ||
          fs.existsSync(path.join(repoRoot, "docker-compose.yaml")) ||
          fs.existsSync(path.join(repoRoot, "compose.yaml"));
        const stack = readConfig(paths).stack;
        fs.writeFileSync(envFile, starterEnvYaml({ language: stack.language, hasDocker }), "utf-8");
        console.log(pc.green("✓"), `Wrote ${rel(envFile)} — ${pc.bold("edit this!")} It tells Claude how to bring up your dev stack.`);
      }

      // 5. Scaffold top-level README + an example area + an example feature
      const topReadme = topReadmePath(paths);
      if (!fs.existsSync(topReadme)) {
        fs.writeFileSync(topReadme, EXAMPLE_TOP_README, "utf-8");
        console.log(pc.green("✓"), `Wrote ${rel(topReadme)}`);
      }
      const exampleAreaReadme = areaReadmePath(paths, "example");
      if (!fs.existsSync(exampleAreaReadme)) {
        fs.mkdirSync(path.dirname(exampleAreaReadme), { recursive: true });
        fs.writeFileSync(exampleAreaReadme, EXAMPLE_AREA_README, "utf-8");
        const exampleFeature = featureFilePath(paths, "example/hello");
        fs.writeFileSync(exampleFeature, EXAMPLE_FEATURE, "utf-8");
        console.log(pc.green("✓"), `Wrote ${rel(exampleAreaReadme)} and ${rel(exampleFeature)} — ${pc.dim("delete these once you have real product truth")}`);
      }

      // 6. gitignore
      ensureGitignore(repoRoot);
      console.log(pc.green("✓"), "Added gitignore entries for productos/.local/");

      // 7. Next steps
      console.log();
      console.log(pc.bold("Next:"));
      console.log(`  1. ${pc.bold("Edit productos/env.yaml")} — set the right setup commands and healthcheck URL for your stack.`);
      console.log("  2. In another terminal: `productos serve` — opens your product-truth site at http://localhost:" + readConfig(paths).ui_port);
      console.log("  3. Open Claude Code in this repo. Say: `do a ProductOS pass on this codebase`");
      console.log("     — Claude reads your code, proposes features + behaviors,");
      console.log("       drives the live env to gather evidence, and writes the markup directly into productos/products/.");
      console.log("     You review the rendered site, approve behaviors with `productos product verify`, and commit the diff.");
      console.log();
      console.log(pc.dim("Optional: `productos configure` — pick how code scanning works (Claude / Codex / Manual) and how feedback is processed (queue / BYOK auto-process)."));
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
  const wanted = ["productos/.local/"];
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

function rel(fp: string): string {
  return path.relative(process.cwd(), fp);
}

const EXAMPLE_TOP_README = `---
title: Product Truth
---

# Product Truth

This directory contains the **product truth** for this codebase. Each subdirectory under
\`productos/products/\` is a **product area** (e.g. \`auth/\`, \`checkout/\`); each \`.md\` file
inside an area is a **feature**, with structured *behaviors* (atomic claims about what the
feature does) declared in its frontmatter and supporting prose in the body.

Run \`productos serve\` and open http://localhost:7878 to browse this as a website.

When designing a new feature, **consult these files first**. When shipping a feature,
**update them in the same PR** so the diff captures both the code change and the
behavior change in one place.
`;

const EXAMPLE_AREA_README = `---
title: Example area
---

# Example area

This is a placeholder area generated by \`productos init\`. Delete it once you have a
real first area (e.g. \`auth/\`, \`onboarding/\`, \`checkout/\`).

An *area* groups related features. You decide the granularity — start coarse, split when
an area gets unwieldy.
`;

const EXAMPLE_FEATURE = `---
id: example/hello
title: Hello world example
status: shipped
description: A placeholder feature so the rendered site has something to show.
behaviors:
  - id: greeting-renders
    claim: 'When a user opens the home page, they see the text "Hello, world".'
    notes: |
      This is the smallest possible feature: one behavior with one claim,
      written in product language (no API/file references — those live in
      the tracking sidecar at productos/tracking/example/hello.yaml).
---

# Hello world example

This is a placeholder feature. Delete it (and the parent \`example/\` area) once you've
written your first real feature.

## How to structure a real feature

A feature file is a Markdown document with YAML frontmatter:

- **\`id\`**: \`area/slug\` — must match the file location.
- **\`title\`**: human-readable name.
- **\`status\`**: \`planned\` | \`shipped\` | \`deprecated\`.
- **\`description\`**: short product-language summary.
- **\`behaviors\`**: a list of atomic claims (see below).

Each **behavior** has:

- **\`id\`**: kebab-case, unique within the feature.
- **\`claim\`**: a single sentence describing what the product does, in *product* language (what the user does, what the user sees). Not in API/file terms.
- **\`notes\`**: free-form context, gotchas, design rationale.

That's it. Notice what's *not* here: code references, implementation paths,
verification status. Those are operational metadata and live in the *tracking
sidecar* at \`productos/tracking/<area>/<feature>.yaml\`:

\`\`\`yaml
feature_id: example/hello
implements: [README.md]
behaviors:
  greeting-renders:
    code_refs: ["README.md:1"]
    status: verified
    last_verified: 2026-05-28
    verified_by: example
    history: [...]
\`\`\`

This split keeps product truth standalone — diffs to *what the product does*
are separate from diffs to *which file implements it*.
`;
