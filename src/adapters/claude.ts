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
}

export function isClaudeInstalled(): boolean {
  return fs.existsSync(CLAUDE_DIR);
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
  const installed: string[] = [];
  for (const skill of skills) {
    const src = path.join(root, skill);
    const dst = path.join(SKILLS_DIR, skill);
    if (fs.existsSync(dst) && !opts.update) {
      // Already installed — skip silently. Use --update to overwrite.
      continue;
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

  return { installed, mcpRegisteredAt: target };
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
