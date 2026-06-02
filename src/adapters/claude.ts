import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");

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

export function installClaudeSkills(opts: { update?: boolean } = {}): ClaudeInstallResult {
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

  return { installed, mcpRegisteredAt: target, symlinked: dev };
}

export function uninstallClaudeSkills(): { removed: string[] } {
  const removed: string[] = [];
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
