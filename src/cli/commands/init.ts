import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { Command } from "commander";
import { installClaudeSkills, uninstallClaudeSkills } from "../../adapters/claude.js";
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
import { envConfigFile, starterEnvYaml } from "../../core/env.js";
import {
  ensureProductsDirs,
  topReadmePath,
  areaReadmePath,
  productReadmePath,
  featureFilePath,
} from "../../core/product.js";
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
      const install = installClaudeSkills({ update: opts.update, config: projectConfig, configRoot: projectRoot });
      const verb = install.symlinked ? "Linked" : "Installed";
      for (const s of install.installed) {
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
        console.log(pc.green("✓"), `Wrote agent: ${path.join(install.agentsDir, `${a}.md`)}`);
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
      // ⛔ The scaffold must PASS `productos check`. It shipped one level short — a
      // product holding a feature with no area — so every fresh corpus failed its own
      // conformance check on the files the tool had just written, which teaches the
      // author that the check is noise before they have written a line of their own.
      const exampleProductReadme = productReadmePath(paths, "example-product");
      if (!fs.existsSync(exampleProductReadme)) {
        fs.mkdirSync(path.dirname(exampleProductReadme), { recursive: true });
        fs.writeFileSync(exampleProductReadme, EXAMPLE_PRODUCT_README, "utf-8");
        const exampleAreaReadme = areaReadmePath(paths, "example-product/example-area");
        fs.mkdirSync(path.dirname(exampleAreaReadme), { recursive: true });
        fs.writeFileSync(exampleAreaReadme, EXAMPLE_AREA_README, "utf-8");
        const exampleFeature = featureFilePath(paths, "example-product/example-area/hello");
        fs.writeFileSync(exampleFeature, EXAMPLE_FEATURE, "utf-8");
        console.log(pc.green("✓"), `Wrote ${rel(exampleProductReadme)}, its area and ${rel(exampleFeature)} — ${pc.dim("delete all three once you have real product truth")}`);
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
      console.log("     The productos-scope skill walks that feature's code paths and proposes comprehensive");
      console.log("     coverage: surfaces, elements, and behaviors with claims + test cases in product language.");
      console.log(`  5. Review either inline in Claude Code (${pc.cyan('"Use productos-review on <feature>"')}) or in the site.`);
      console.log(`     For surgical edits later (add a leads_to, rename, etc.): ${pc.cyan('"Use productos-edit ..."')}.`);
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

/**
 * The scaffolded overview page.
 *
 * ⛔ THIS IS THE FIRST PAGE A READER SEES, and it used to be about ProductOS. Three
 * fresh readers landed on it and concluded the product *was* the documentation tool:
 * *"I had to scroll past all of that to reach one line about a product."* It also told
 * one of them to open port 7878 while they were being served on 7899, and illustrated
 * the structure with `auth/` and `checkout/`, which existed in neither corpus — so a
 * newcomer's first mental model of the product came from a placeholder.
 *
 * So the scaffold now says one thing: replace me. It is addressed to the author, it
 * says so, and `productos check` refuses to hand over a corpus that still has it.
 */
const EXAMPLE_TOP_README = `---
title: Product Truth
---

> **Replace this page.** It is the first thing anyone reading your product truth sees,
> and right now it says nothing about your product. \`productos check\` will refuse to
> hand this corpus over for review until you do.

Write two or three paragraphs answering, for someone who has never heard of this
product:

- **Who is it for, and what do they get?** Name the person and what changes for them.
- **What does it deliberately not do?** The boundary is usually the most useful
  sentence on the page.
- **What is unusual about it?** If there is a sharp idea at the centre, say it here —
  this is the only page where a reader will read a paragraph before clicking.

Nothing about files, directories, commands or how the truth is stored. A reader of this
page is asking what the product is; the shape of the corpus is visible in the navigation
without being described.
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
- **glossary.md** — term → what it means here, so nobody invents a synonym
- **decisions.md** — forks settled deliberately, and what else was considered

Each file is markdown. Each \`## heading\` becomes an anchorable id, so features can cite e.g. \`principles#numbers-feel-rewarding\` in their notes.

Edit these freely. The \`productos-scope\` and \`productos-fullscan\` skills read every file in this directory before proposing or updating any feature.
`;

/**
 * The scaffolded strategy layer.
 *
 * ⛔ EVERY ONE OF THESE SHIPPED AS FAMILY-WALLET CONTENT, so every new corpus began with
 * a spending-app strategy layer. Two fresh readers of a commercial-lending product hit
 * it on the page they had been told to read first:
 *
 *   "Voice & tone is still the shipped template, and it is about the wrong product.
 *    Verbatim, on the strategy page of a commercial lending platform: '(Example)
 *    Celebrate wins; never shame losses — Spend transactions are neutral, not negative.'
 *    A lender's underwriting tool has no spend transactions. This is the page I was told
 *    to read first, and its last section is an instruction to its own author."
 *
 * A placeholder that reads as content is worse than an empty file: it is read as policy,
 * and it tells a reader nobody has been through the section — which colours how much they
 * trust everything else. So these show the SHAPE with no domain at all, say plainly that
 * they are unwritten, and `productos check` refuses a corpus that still has them.
 */
const SCAFFOLD_MARK = "Nothing here is written yet.";

const CONTEXT_TEMPLATES: Record<string, string> = {
  goals: `---
title: Product goals
order: 1
---

> **${SCAFFOLD_MARK}** Replace this file. Aim for three to seven goals.

A goal is an outcome, stated concretely enough that a stranger could read it and tell
whether a feature serves it. Not a feature list, and not a metric on its own — the
outcome, and how you would know.

## <One outcome, as a short sentence>

What is true today that the product should change, and what "better" looks like
specifically enough to argue about.
`,
  principles: `---
title: Design principles
order: 2
---

> **${SCAFFOLD_MARK}** Replace this file.

A principle is a rule you follow *every* time, across features. If you can name a
feature that breaks it, it is not a principle — it is a preference.

Behaviors cite these by anchor (\`principles#<the-heading-slugified>\`), so a principle
with nothing resting on it is either decoration or a missing promise.

## <The rule, as an imperative>

Why it holds, and the failure it prevents. The reason is the part that survives — a rule
with no reason gets argued away the first time it is inconvenient.
`,
  personas: `---
title: Personas
order: 3
---

> **${SCAFFOLD_MARK}** Replace this file.

Who the product is for. One heading per person, described by **what they are trying to
do and what they are afraid of** — not by demographics.

⛔ A persona is not a permission model. "Who may do what" is a claim about the product
and belongs in behaviors; this says who is on the other side of the promise.

## <Their role, as they would say it>

What they are doing when they open this. What they cannot afford to get wrong.
`,
  voice: `---
title: Voice & tone
order: 4
---

> **${SCAFFOLD_MARK}** Replace this file.

How the product speaks — especially when it refuses, fails, or delivers bad news, which
is where tone actually matters and where it is usually decided by accident.

## <A rule about how this product talks>

The situation it governs, and an example of the wording it licenses.
`,
  glossary: `---
title: Glossary
order: 6
---

> **${SCAFFOLD_MARK}** Replace this file.

Term → one line of what it means **in this product**. This is what keeps the corpus from
growing two words for one thing.

⛔ **Never an entity model.** What a term means to a user belongs here; what fields it
has does not.

⛔ **Your words, not the tool's.** A reader comes here to resolve a domain term. Words
like *behavior*, *surface*, *capability* or *stub* belong to ProductOS and are explained
on the site's own status page.

## <a term your product uses>

One line. If you cannot write it in one line, the term is doing two jobs.
`,
  "non-goals": `---
title: Non-goals
order: 5
---

> **${SCAFFOLD_MARK}** Replace this file.

Things the product deliberately does **not** do. This is the highest-value file here and
the one most often left empty.

⛔ Its job is to stop an agent finding no handling for a case, calling it a gap, and
reintroducing what was removed on purpose. An omission is silent; a non-goal argues back.

## <What it does not do>

Why not. If the reason is "not yet", say that — "not yet" and "never" send an agent in
opposite directions.
`,
  decisions: `---
title: Decisions
order: 7
---

> **${SCAFFOLD_MARK}** Replace this file.

A fork settled deliberately, **with what else was considered**. A decision carries no
validation state — it is not falsifiable — but it does carry currency.

## <The question that was settled>

- **Ruling:** what was decided.
- **Also considered:** the option you did not take, and why not. Without this the
  decision gets relitigated from scratch, which is the whole thing this file prevents.
- **Decided:** <date>, by <who>.
`,
};

const EXAMPLE_PRODUCT_README = `---
title: Example product
---

A placeholder product written by \`productos init\`, so the rendered site has the right
shape to look at. **Delete this whole directory** once you have real product truth.

A *product* is the top of the tree: one thing you sell or ship. Inside it are feature
areas, which nest as deep as this product needs.
`;

const EXAMPLE_AREA_README = `---
title: Example area
---

# Example area

This is a placeholder area generated by \`productos init\`. Delete it once you have a
real first area (e.g. \`auth/\`, \`onboarding/\`, \`checkout/\`).

An *area* groups related features and can hold further areas. You decide the granularity
— start coarse and split when it gets unwieldy; \`productos check\` will tell you when it
has, and name the features it would split out.
`;

const EXAMPLE_FEATURE = `---
id: example-product/example-area/hello
title: Hello world example
status: built
description: A placeholder feature so the rendered site has something to show.
behaviors:
  - id: greeting-renders
    claim: 'When a user opens the home page, they see the text "Hello, world".'
    test_cases:
      - id: 1
        level: e2e
        description: The greeting is there on first load
        given: a visitor who has never opened the product
        when: they load the home page
        then: the page shows "Hello, world"
    notes: |
      This is the smallest possible feature: one behavior with one claim,
      written in product language. Implementation references are kept
      separately, so nothing here names a path, an endpoint or a table.
---

# Hello world example

A placeholder feature. Delete it, its area and its product once you have written your
first real one.

## How to structure a real feature

A feature file is a Markdown document with YAML frontmatter:

- **\`id\`**: the file's own path below \`products/\` — \`<product>/<area…>/<slug>\`. It
  IS the path, which is why re-filing is \`productos move\` and never \`mv\`.
- **\`title\`**: human-readable name.
- **\`status\`**: \`planned\` | \`built\` | \`retired\`.
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
