import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { AGENTS, type Capability } from "../core/jobs.js";
import type { ProductosConfig } from "../core/config.js";

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

/**
 * Where the bundled agent definitions live.
 *
 * ⛔ Agents are installed separately from skills and are NOT skills. A skill loads
 * into whatever context invokes it, which is exactly wrong for the fresh-eyes
 * reviewer: its whole value is not knowing what ProductOS is, and a skill read by the
 * main agent has already lost that. It has to be a subagent with its own context.
 */
function bundledAgentsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../agents");
}

/** Install the agent definitions. Same copy-or-symlink rule as skills. */
/**
 * ⛔ THE HOST'S FRONTMATTER IS GENERATED, NOT CARRIED BY THE PROMPT.
 *
 * Peter: "ideally in the future these job agents will be portable - model agnostic. we should let
 * people assign whatever model they want to each task."
 *
 * So a prompt file holds the prompt and nothing else. The name, the one-line description, the tool
 * list and the model are this host's dialect, and they are produced here from two portable inputs:
 * the agent's own spec in `core/jobs.ts`, and the project's config. Copying a hand-written
 * Claude-shaped file — which is what this did — makes every agent a Claude agent and makes the
 * model a thing somebody edits in a prompt.
 */
const TOOL_FOR: Record<Capability, string[]> = {
  "read-files": ["Read"],
  "run-commands": ["Bash"],
  "search-files": ["Grep", "Glob"],
  "fetch-url": ["WebFetch"],
  "ask-the-human": ["AskUserQuestion"],
  "show-a-page": ["Read"],
  /**
   * ⛔ NO MAPPING, DELIBERATELY. Every agent in the registry judges, and the test enforces that
   * none asks for this — so if it is ever reached, the registry has grown an author wearing a
   * reviewer's clothes and the install should stop rather than hand it Write.
   */
  "write-corpus": [],
};

/**
 * ⛔ AGENTS BELONG TO THE PROJECT, NOT THE MACHINE.
 *
 * They installed into `~/.claude/agents/` while the model assignment they carry comes from a
 * project's own config — so two projects wanting different models for the same reviewer wrote over
 * each other, last install wins, silently. And an agent a project had switched off stayed on disk
 * from whichever project installed it last.
 *
 * So: the project's own agent directory when run inside a project, and the machine's only when
 * there is no project to belong to.
 */
function agentsDirFor(cfgRoot?: string): string {
  return cfgRoot ? path.join(cfgRoot, ".claude", "agents") : AGENTS_DIR;
}

function installClaudeAgents(dev: boolean, update?: boolean, cfg?: ProductosConfig, cfgRoot?: string): string[] {
  const root = bundledAgentsRoot();
  if (!fs.existsSync(root)) return [];
  const AGENT_TARGET = agentsDirFor(cfgRoot);
  fs.mkdirSync(AGENT_TARGET, { recursive: true });
  /** The real paths, so the report cannot claim a directory the files are not in. */
  const written: string[] = [];
  const out: string[] = [];
  const off = cfg?.agents.off ?? {};
  const models = cfg?.agents.model ?? {};
  const dflt = cfg?.agents.default_model;

  for (const agent of AGENTS) {
    if (!agent.prompt) continue; // named in the registry, prompt not written — said out loud elsewhere
    if (off[agent.name]) continue; // turned off for this project, with a recorded reason
    const src = path.join(root, path.basename(agent.prompt));
    if (!fs.existsSync(src)) continue;

    const tools = [...new Set(agent.needs.flatMap((c) => TOOL_FOR[c] ?? []))];
    if (!tools.length) continue;
    /**
     * ⛔ A JUDGE NEVER GETS Write OR Edit, and this is where that is enforced rather than hoped:
     * the tool list is derived from declared capabilities, and no capability a judge may declare
     * maps to a writing tool.
     */
    const model = models[agent.name] ?? dflt;
    const name = path.basename(agent.prompt).replace(/\.md$/, "");
    const front = [
      "---",
      `name: ${name}`,
      // The registry's own question, so the host's chooser shows what the agent is for.
      `description: ${agent.asks} ${agent.judges ? "Reviews only — never writes, edits or fixes anything." : ""}`.trim(),
      `tools: ${tools.join(", ")}`,
      ...(model ? [`model: ${model}`] : []),
      "---",
      "",
    ].join("\n");

    const dst = path.join(AGENT_TARGET, `${name}.md`);
    const exists = !!fs.lstatSync(dst, { throwIfNoEntry: false });
    if (exists) {
      if (!update) continue;
      fs.rmSync(dst, { force: true });
    }
    /**
     * ⛔ ALWAYS WRITTEN, NEVER SYMLINKED — even in a dev install. The file the host reads is
     * frontmatter this generated plus a body from the repo; a symlink would serve the raw prompt
     * with no frontmatter at all, and the host would refuse it or run it with every tool.
     */
    fs.writeFileSync(dst, front + fs.readFileSync(src, "utf-8"));
    out.push(name);
    written.push(dst);
  }
  /**
   * ⛔ TURNING AN AGENT OFF HAS TO REMOVE IT. Skipping the write left a file from a previous
   * install sitting in the host's agent directory, so an agent a project had deliberately switched
   * off was still there to be run — and the config said otherwise, which is worse than either
   * state on its own.
   */
  if (update)
    for (const agent of AGENTS) {
      if (!agent.prompt) continue;
      const name = path.basename(agent.prompt).replace(/\.md$/, "");
      if (out.includes(name)) continue;
      const dst = path.join(AGENT_TARGET, `${name}.md`);
      if (fs.lstatSync(dst, { throwIfNoEntry: false })) fs.rmSync(dst, { force: true });
    }
  void dev;
  void written;
  return out;
}

/** Where this binary's bundled skill content lives, regardless of install mode. */
function bundledSkillsRoot(): string {
  // dist/adapters/claude.js → ../../skills (relative to project root)
  const here = path.dirname(fileURLToPath(import.meta.url));
  // try compiled path first
  const distGuess = path.resolve(here, "../../skills");
  if (fs.existsSync(distGuess)) return distGuess;
  // dev (tsx) path: src/adapters → ../../skills
  return path.resolve(here, "../../skills");
}

export interface ClaudeInstallResult {
  installed: string[];
  /** Agent definitions installed into ~/.claude/agents/. */
  agents: string[];
  /** ⛔ Where they actually went. The report claimed ~/.claude/agents while writing to a project. */
  agentsDir: string;
  mcpRegisteredAt: string;
  /** True if installed via symlink (dev install) instead of copy. */
  symlinked: boolean;
}

export function isClaudeInstalled(): boolean {
  return fs.existsSync(CLAUDE_DIR);
}

/**
 * Detect "I'm running from a development install" by checking that the
 * bundled-skills root is also a sibling of a real `src/` directory.
 * In a published npm install there's no `src/`, so we copy as before.
 */
function isDevInstall(skillsRoot: string): boolean {
  const repoRoot = path.dirname(skillsRoot);
  return fs.existsSync(path.join(repoRoot, "src"));
}

export function installClaudeSkills(opts: { update?: boolean; config?: ProductosConfig; configRoot?: string } = {}): ClaudeInstallResult {
  if (!fs.existsSync(CLAUDE_DIR)) {
    throw new Error(
      `Claude Code not detected at ${CLAUDE_DIR}. Install Claude Code first, then re-run.`
    );
  }
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  const root = bundledSkillsRoot();
  const skills = fs.readdirSync(root).filter((d) => d.startsWith("productos"));
  const dev = isDevInstall(root);
  const installed: string[] = [];
  for (const skill of skills) {
    const src = path.join(root, skill);
    const dst = path.join(SKILLS_DIR, skill);

    if (dev) {
      // Dev install: symlink the source dir directly into ~/.claude/skills/.
      // Edits to skills/<name>/SKILL.md in this repo are instantly live in
      // Claude Code — no re-init needed.
      const existing = fs.existsSync(dst) || fs.lstatSync(dst, { throwIfNoEntry: false });
      if (existing) {
        if (!opts.update) continue;
        fs.rmSync(dst, { recursive: true, force: true });
      }
      fs.symlinkSync(src, dst, "dir");
      installed.push(skill);
      continue;
    }

    if (fs.existsSync(dst) && !opts.update) {
      // Already installed — skip silently. Use --update to overwrite.
      continue;
    }
    // If a stale symlink (e.g. from a previous dev install) exists, remove it
    // before copying so we don't write through the link.
    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
    fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dst, file));
    }
    installed.push(skill);
  }

  // Register MCP server in project-scoped .claude/settings.json (cwd) if we're
  // in a project, otherwise in user-scoped ~/.claude/settings.json.
  const settingsPath = path.join(process.cwd(), ".claude", "settings.json");
  const target = fs.existsSync(path.join(process.cwd(), ".git"))
    ? settingsPath
    : path.join(CLAUDE_DIR, "settings.json");

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const existing = fs.existsSync(target)
    ? JSON.parse(fs.readFileSync(target, "utf-8"))
    : {};
  existing.mcpServers = existing.mcpServers ?? {};
  existing.mcpServers.productos = {
    command: "productos",
    args: ["serve", "--mcp"],
  };
  fs.writeFileSync(target, JSON.stringify(existing, null, 2) + "\n", "utf-8");

  const agents = installClaudeAgents(dev, opts.update, opts.config, opts.configRoot);
  return { installed, agents, agentsDir: agentsDirFor(opts.configRoot), mcpRegisteredAt: target, symlinked: dev };
}

export function uninstallClaudeSkills(): { removed: string[] } {
  const removed: string[] = [];
  if (fs.existsSync(AGENTS_DIR)) {
    for (const f of fs.readdirSync(AGENTS_DIR)) {
      if (f.startsWith("productos") && f.endsWith(".md")) {
        fs.rmSync(path.join(AGENTS_DIR, f), { force: true });
        removed.push(`agents/${f.replace(/\.md$/, "")}`);
      }
    }
  }
  if (!fs.existsSync(SKILLS_DIR)) return { removed };
  for (const d of fs.readdirSync(SKILLS_DIR)) {
    if (d.startsWith("productos")) {
      fs.rmSync(path.join(SKILLS_DIR, d), { recursive: true, force: true });
      removed.push(d);
    }
  }
  // Remove MCP registration from project-scoped settings if present.
  const settingsPath = path.join(process.cwd(), ".claude", "settings.json");
  if (fs.existsSync(settingsPath)) {
    const s = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    if (s.mcpServers?.productos) {
      delete s.mcpServers.productos;
      fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n", "utf-8");
    }
  }
  return { removed };
}
