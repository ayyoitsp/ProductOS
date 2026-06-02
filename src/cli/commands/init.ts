import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { Command } from "commander";
import { installClaudeSkills, uninstallClaudeSkills } from "../../adapters/claude.js";
import {
  ensureDirs,
  pathsFor,
} from "../../core/paths.js";
import {
  defaultConfigFor,
  readConfig,
  writeConfig,
} from "../../core/config.js";
import { envConfigFile, starterEnvYaml } from "../../core/env.js";
import { ensureProductsDirs, topReadmePath, areaReadmePath, featureFilePath } from "../../core/product.js";
import { contextFilePath } from "../../core/context.js";

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
      //
      // `init` always scaffolds at the CURRENT working directory — never walks
      // up to find an existing project. Walking up is what `serve` / `configure` /
      // every other command does (they expect a project to already exist).
      // `init` is different: it CREATES a project where you are.
      //
      // If a parent directory already contains a productos/ project, warn — the
      // user might have meant to run from there. Continue anyway; if they really
      // want CWD they get it, and if not they can `rm -rf productos/` and re-run.
      const repoRoot = process.cwd();
      const parentWithProject = findExistingProjectAbove(repoRoot);
      if (parentWithProject) {
        console.log(
          pc.yellow("⚠"),
          `Note: an existing ProductOS project lives at ${pc.bold(parentWithProject)}.`
        );
        console.log(
          pc.dim("   Scaffolding a new project here instead (cwd: " + repoRoot + ").")
        );
        console.log(
          pc.dim("   If you meant to operate on the parent project, cancel now and `cd` there first.")
        );
        console.log();
      }
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

      // 5a. Scaffold productos/context/ with empty templates the user fills in
      const contextReadme = path.join(paths.contextDir, "README.md");
      if (!fs.existsSync(contextReadme)) {
        fs.mkdirSync(paths.contextDir, { recursive: true });
        fs.writeFileSync(contextReadme, CONTEXT_README, "utf-8");
        for (const [name, content] of Object.entries(CONTEXT_TEMPLATES)) {
          const fp = contextFilePath(paths, name);
          if (!fs.existsSync(fp)) fs.writeFileSync(fp, content, "utf-8");
        }
        console.log(
          pc.green("✓"),
          `Scaffolded ${rel(paths.contextDir)}/ (${Object.keys(CONTEXT_TEMPLATES).length} starter files) — ${pc.bold("fill these in!")} They constrain every feature.`
        );
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
      console.log(`  1. ${pc.dim("(optional)")} ${pc.bold("productos configure")} — pick handlers; defaults work for most v0.1 users.`);
      console.log(`  2. ${pc.dim("(optional)")} Fill in productos/context/*.md (goals, principles, etc.) ${pc.dim("— skippable in v0.1")}.`);
      console.log("  3. In another terminal: `productos serve` — opens your product-truth site at http://localhost:" + readConfig(paths).ui_port);
      console.log(`  4. Open Claude Code in this repo. Pick ${pc.bold("one in-flight feature")} and say:`);
      console.log(`        ${pc.cyan("\"Scope ProductOS on the <feature> flow\"")}`);
      console.log("     The productos-feature skill walks just that feature's code paths and proposes 3-5");
      console.log("     behaviors with claims + test cases in product language.");
      console.log(`  5. Vet either inline in Claude Code (${pc.cyan('"Use productos-vet on <feature>"')}) or in the site.`);
      console.log(`  6. Map existing tests with ${pc.cyan('"Align my tests to <feature>"')} (productos-align skill).`);
      console.log("  7. Implement + push. CI posts results back via `productos test record`.");
      console.log();
      console.log(pc.dim("The v0.1 wedge is scoped to one feature, not the whole codebase — grow the corpus feature-by-feature."));
    });
}

function findExistingProjectAbove(start: string): string | null {
  let dir = path.resolve(start);
  const parent0 = path.dirname(dir);
  if (parent0 === dir) return null;
  dir = parent0;
  while (true) {
    if (fs.existsSync(path.join(dir, "productos", "config.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
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

Above features sits **strategy** (\`productos/context/\`) — overarching goals, design
principles, personas, non-goals, and voice. Read those first; features must respect them.

Run \`productos serve\` and open http://localhost:7878 to browse this as a website.

When designing a new feature, **consult \`context/\` first**. When shipping a feature,
**update product truth + tracking in the same PR** so the diff captures both the code
change and the behavior change in one place.
`;

const CONTEXT_README = `---
title: Strategy
order: 0
---

# Strategy

The overarching layer above features. Everything here constrains every feature decision below.

- **goals.md** — what we're trying to achieve
- **principles.md** — what we always (or never) do
- **personas.md** — who we're building for
- **non-goals.md** — what we explicitly don't do
- **voice.md** — how the product speaks

Each file is markdown. Each \`## heading\` becomes an anchorable id, so features can cite e.g. \`principles#numbers-feel-rewarding\` in their notes.

Edit these freely. The \`productos-analyze\` skill reads every file in this directory before proposing or updating any feature.
`;

const CONTEXT_TEMPLATES: Record<string, string> = {
  goals: `---
title: Product goals
order: 1
---

# Product goals

What outcomes is the product trying to drive? Aim for 3-7 goals. Make them concrete enough that a stranger could read them and tell whether a feature serves them.

## (Example) Reduce friction in weekly chore conversations

Today parents and kids negotiate chores every Sunday. The product should reduce that negotiation to <5 min/week, by making the rules and amounts pre-decided.

(Delete the example and add your real goals.)
`,
  principles: `---
title: Design principles
order: 2
---

# Design principles

What does the product always do? What does it never do? Aim for 5-15 principles, each one a concrete rule that can settle a design argument.

## (Example) Numbers feel rewarding, never punishing

Credits use green; debits use muted neutral. Balance never appears in red. Animations on increases; none on decreases.

## (Example) Parents stay in control

Kids can suggest; parents approve. No path where a kid credits themselves.

(Delete the examples and write your real principles.)
`,
  personas: `---
title: Personas
order: 3
---

# Personas

Who are we building for? 2-5 personas, each one a concrete person you can picture, with their context and what they care about.

## (Example) Sarah — mom of two ages 8 and 10

Works full-time, wants kids to internalize saving without lectures. Tracks chores on a whiteboard today.

(Delete the example and write your real personas.)
`,
  "non-goals": `---
title: Non-goals
order: 4
---

# Non-goals

What does the product explicitly NOT do? Naming non-goals prevents scope creep and makes tradeoffs visible.

## (Example) Real bank account integration

This is play money. We won't connect to ACH, Plaid, or anything similar. If a user wants real money mechanics, this isn't the product.

(Delete the example and write your real non-goals.)
`,
  voice: `---
title: Voice & tone
order: 5
---

# Voice & tone

How does the product speak? Word-level conventions, tone in success/error states, level of formality.

## (Example) Celebrate wins; never shame losses

Spend transactions are neutral, not negative. Empty states are encouraging, not nagging.

(Delete the example and write your real voice rules.)
`,
};

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
