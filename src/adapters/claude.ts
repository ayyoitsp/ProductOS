import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AGENTS, AUTHORS, type Capability } from "../core/jobs.js";
import { addendum } from "../v2/steers.js";
import type { Steer } from "../v2/schema.js";
import type { ProductosConfig } from "../core/config.js";

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

/**
 * Every file this installer writes outside a project, resolved from one root.
 *
 * ⛔ A PARAMETER BECAUSE THE DEFAULT IS A SHARED DIRECTORY NOTHING MAY TEST AGAINST.
 *
 * `~/.claude/` is read by every live session on this machine, so the only way to see what an install
 * writes was to run one — which is the damage, not an observation of it. Every behaviour in here was
 * therefore unasserted, including the two that had already gone wrong: a bare `command` that
 * resolved through one global `npm link` slot, and a prune that deleted skills a worktree merely
 * does not have on its branch.
 *
 * ⛔ One root and not four paths. Four knobs is four ways for a test to redirect three of them.
 */
export interface HostDirs {
  claude: string;
  skills: string;
  /** User scope. ⛔ A SIBLING of `.claude/`, not a child — `~/.claude.json`, which trips everybody. */
  userConfig: string;
  desktopConfig: string;
}

export function hostDirs(home: string = HOME): HostDirs {
  const claude = path.join(home, ".claude");
  return {
    claude,
    skills: path.join(claude, "skills"),
    userConfig: path.join(home, ".claude.json"),
    desktopConfig: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  };
}

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
   * ⛔ DRIVING A BROWSER IS THIS HOST'S ANSWER TO "LOOK AT IT". The capability is portable — a host
   * with a different way of rendering a page maps it differently, or refuses to install the roles
   * that need it rather than installing ones that cannot do their job.
   */
  "see-a-page": [
    "mcp__claude-in-chrome__navigate",
    "mcp__claude-in-chrome__computer",
    "mcp__claude-in-chrome__read_page",
    "mcp__claude-in-chrome__tabs_context_mcp",
  ],
  /**
   * ⛔ THIS WAS DELIBERATELY EMPTY, AND THAT WAS THE RIGHT RULE FOR A REGISTRY OF JUDGES ONLY.
   *
   * The comment it replaces read: *"if it is ever reached, the registry has grown an author wearing
   * a reviewer's clothes"*. That was true while `AGENTS` was the only registry. There is now a
   * second one — `AUTHORS`, every member of which declares `authors: true` — and the guarantee is
   * preserved by where the map is consulted, not by leaving it empty: `installClaudeAgents` walks
   * `AGENTS`, whose members all declare `judges: true` and none of which may declare this
   * capability; `installClaudeAuthors` walks `AUTHORS`. Two interfaces, two required literals, so
   * neither list can quietly acquire a member of the other kind.
   */
  "write-corpus": ["Write", "Edit"],
};

/**
 * ⛔ WHAT NO AUTHOR MAY BE HANDED, AND WHY THIS IS A LIST RATHER THAN A HOPE.
 *
 * An author has `Bash`, so nothing stops it typing `productos v2 accept` — the prohibition in its
 * prompt is a prohibition, not a mechanism. The mechanism is downstream and already load-bearing:
 * every act records `Verdict.via`, and `agent` is one of its values precisely so that software
 * deciding something is distinguishable from a person agreeing to it. An act an author performs is
 * recorded as `via: agent` and never counts as agreement.
 *
 * What is enforced HERE is the one thing a prompt cannot cover: an author that could put a question
 * to a person would be obtaining consent out of band, with no record of how. So no author may
 * declare `ask-the-human`, and the install refuses one that does rather than installing it.
 */
const FORBIDDEN_TO_AUTHORS: Capability[] = ["ask-the-human"];

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
function agentsDirFor(cfgRoot?: string, home: string = HOME): string {
  return cfgRoot ? path.join(cfgRoot, ".claude", "agents") : path.join(hostDirs(home).claude, "agents");
}

/**
 * Install the authors. ⛔ Same derivation, opposite guarantee.
 *
 * Peter: *"we should model them as subagents, that the skills are shims into.."*. A skill that
 * spawns one of these keeps the orchestration and the conversation with the person; the agent does
 * the reading and the writing in a context of its own. What a skill may never delegate is settling,
 * which is why no author gets a question tool.
 */
function installClaudeAuthors(
  update?: boolean,
  cfg?: ProductosConfig,
  cfgRoot?: string,
  steers?: readonly Steer[],
  home: string = HOME
): string[] {
  const root = bundledAgentsRoot();
  if (!fs.existsSync(root)) return [];
  const TARGET = agentsDirFor(cfgRoot, home);
  fs.mkdirSync(TARGET, { recursive: true });
  const out: string[] = [];
  const off = cfg?.agents.off ?? {};
  const models = cfg?.agents.model ?? {};
  const dflt = cfg?.agents.default_model;

  for (const author of AUTHORS) {
    if (!author.prompt) continue;
    if (off[author.name]) continue;
    const src = path.join(root, path.basename(author.prompt));
    if (!fs.existsSync(src)) continue;
    /**
     * ⛔ REFUSE, RATHER THAN INSTALL A NARROWED VERSION. Dropping the offending capability and
     * carrying on would install an author whose prompt tells it to ask somebody something and whose
     * tools cannot — which fails halfway through a run, in a way that reads as the host being
     * broken rather than the spec being wrong.
     */
    const forbidden = author.needs.filter((c) => FORBIDDEN_TO_AUTHORS.includes(c));
    if (forbidden.length)
      throw new Error(
        `author "${author.name}" declares ${forbidden.join(", ")} — an author may never put a question to a person, ` +
          `because consent obtained inside a subagent has no record of how it was obtained. Record it as a question in the corpus instead.`
      );

    const tools = [...new Set(author.needs.flatMap((c) => TOOL_FOR[c] ?? []))];
    if (!tools.length) continue;
    const model = models[author.name] ?? dflt;
    const name = path.basename(author.prompt).replace(/\.md$/, "");
    const front = [
      "---",
      `name: ${name}`,
      `description: ${author.asks} ${author.each ? `Spawn one per ${author.each}` : "Runs once"} — writes, but never settles, stamps or validates anything.`,
      `tools: ${tools.join(", ")}`,
      ...(model ? [`model: ${model}`] : []),
      "---",
      "",
    ].join("\n");

    const dst = path.join(TARGET, `${name}.md`);
    const exists = !!fs.lstatSync(dst, { throwIfNoEntry: false });
    if (exists) {
      if (!update) continue;
      fs.rmSync(dst, { force: true });
    }
    /**
     * ⛔ WHAT THIS PROJECT HAS LEARNED, APPENDED — AUTHORS ONLY.
     *
     * Peter: *"either update the framework, or have 'org/project' addendum to the corpus that will
     * run per org/project"*, and, asked how far it should reach: *"Both"* — here at install, and
     * again at runtime when something is proposed.
     *
     * ⛔ AND NEVER ON A JUDGE, which is why this lives in `installClaudeAuthors` and has no
     * counterpart in `installClaudeAgents`. A judge told what this project likes is a judge that
     * can no longer notice the project is wrong — the same reason the newcomer is never told what
     * ProductOS is. The split is structural: `AUTHORS` and `AGENTS` are two registries walked by
     * two functions, and only one of them appends taste.
     *
     * It goes AFTER the prompt body, so the framework's own instructions are what an author reads
     * first; a habit that contradicts them is the habit being wrong, and the addendum says so.
     */
    const learned = addendum(steers ?? []);
    fs.writeFileSync(
      dst,
      front + fs.readFileSync(src, "utf-8") + (learned ? `\n\n---\n\n${learned}\n` : "")
    );
    out.push(name);
  }
  return out;
}

function installClaudeAgents(dev: boolean, update?: boolean, cfg?: ProductosConfig, cfgRoot?: string, home: string = HOME): string[] {
  const root = bundledAgentsRoot();
  if (!fs.existsSync(root)) return [];
  const AGENT_TARGET = agentsDirFor(cfgRoot, home);
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
  /**
   * ⛔ WHAT IT WAS REGISTERED AS, because from a worktree it is no longer `productos`.
   *
   * A session that types `claude mcp list`, sees `productos-my-branch` and does not know why would
   * reasonably conclude the install went wrong. This is the only moment anybody finds out without
   * going to read the adapter.
   */
  mcpName: string;
  /** ⛔ And what it will actually run — the whole point is that this is no longer ambiguous. */
  mcpRuns: string;
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

/**
 * ⛔ WHICH CHECKOUT THIS CODE CAME FROM — NOT WHERE IT WAS RUN FROM, AND NOT WHAT IS ON PATH.
 *
 * `npm link` is one global symlink, so `productos` on PATH is whichever checkout linked last. Every
 * session on this machine resolved ProductOS through that single slot regardless of which worktree
 * it was working in, and the MCP registration said `command: "productos"` — the bare name — so a
 * session's MCP server ran code from a checkout on some other branch. The consequence is already
 * recorded in `src/mcp/server.ts`: a session working one corpus had its server started against
 * another, and "the push ran flawlessly over a corpus nobody was looking at".
 *
 * The module's own location is the only answer that cannot be wrong about this: it is the checkout
 * whose `dist/` is executing.
 */
export function checkoutRoot(): string {
  return path.dirname(bundledSkillsRoot());
}

/**
 * The repo's primary working tree, or `null` when this is not a git checkout at all.
 *
 * ⛔ `git worktree list` PUTS THE MAIN WORKING TREE FIRST, which is the whole reason this can be
 * answered without a convention anybody has to maintain. `test/v2-migrations-across-worktrees`
 * already leans on the same ordering, and `scripts/stack.sh:34` derives the dev stack from it.
 */
function primaryWorktree(root: string): string | null {
  try {
    const out = execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const first = out.split("\n").find((l) => l.startsWith("worktree "));
    return first ? real(first.slice("worktree ".length).trim()) : null;
  } catch {
    return null;
  }
}

/**
 * ⛔ COMPARED AS REAL PATHS. `git` answers with the resolved path and a caller does not: on macOS
 * anything under the temp directory is reached through `/var` and reported as `/private/var`, and a
 * checkout reached through a symlink has the same shape. A string compare said "this is a worktree"
 * about the main checkout, which is the answer that disables the prune everybody needs.
 */
function real(p: string): string {
  try {
    return fs.realpathSync(path.resolve(p));
  } catch {
    return path.resolve(p);
  }
}

/**
 * ⛔ A PUBLISHED INSTALL AND A PLAIN CLONE BOTH COUNT AS THE MAIN CHECKOUT, BY DESIGN.
 *
 * The only thing this distinguishes is "a linked worktree, which is on an unmerged branch by
 * definition" from "the checkout that represents the product". `null` — no git, or git refused —
 * has to fall on the main side: an npm install of ProductOS is the product as shipped, and treating
 * it as a worktree would permanently disable the one cleanup consumers need.
 */
export function isMainCheckout(root: string = checkoutRoot()): boolean {
  const main = primaryWorktree(root);
  return main === null || main === real(root);
}

/**
 * A stable, readable name for a checkout. Empty for the main checkout.
 *
 * ⛔ THE SAME DERIVATION AS `scripts/stack.sh:42-43`, DELIBERATELY. That script already names this
 * checkout's Docker project and ports from the worktree directory; a second convention for the same
 * question means `make stacks` and `claude mcp list` disagree about which checkout you are looking
 * at, and the person reading them has no way to tell which one lied.
 */
export function checkoutSlug(root: string = checkoutRoot()): string {
  if (isMainCheckout(root)) return "";
  /** ⛔ The REAL path's basename, because `scripts/stack.sh` takes it off `rev-parse --show-toplevel`. */
  return path
    .basename(real(root))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 40);
}

/**
 * ⛔ THE KEY IS PER-CHECKOUT, BECAUSE `~/.claude.json` IS ONE MAP SHARED BY EVERY SESSION.
 *
 * Both checkouts wrote `mcpServers.productos`, so installing from a worktree silently re-aimed every
 * session on the machine — including the main checkout's — at the worktree's code. Last install won,
 * with nothing on screen saying it had happened. Two keys cannot overwrite each other.
 *
 * The main checkout keeps the plain `productos`, for the same reason it keeps the plain stack name:
 * it is the one everybody means when they say it, and renaming it would orphan every registration
 * already on disk.
 */
export function mcpServerName(root: string = checkoutRoot()): string {
  const slug = checkoutSlug(root);
  return slug ? `productos-${slug}` : "productos";
}

export interface McpRegistration {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * What goes into a host's MCP config so the server runs THIS checkout's code.
 *
 * ⛔ ABSOLUTE, AND ONLY FOR A DEV INSTALL. A published install's `.mcp.json` is the file a team
 * commits and shares, so `productos` — resolved from the consumer's own PATH or `node_modules` — is
 * the only portable thing to put in it. An absolute path there hands every teammate a directory
 * that does not exist on their machine. The ambiguity this fixes is a *dev* ambiguity: several
 * checkouts of ProductOS, one `npm link` slot.
 *
 * ⛔ `process.execPath` RATHER THAN THE LAUNCHER DIRECTLY. `bin/productos.js` starts with
 * `#!/usr/bin/env node`, which needs `node` on the PATH of whatever spawned it — and the Claude
 * desktop app, which is one of the three readers registered below, is launched by the window server
 * with almost no PATH at all. The node already running this install is a path that exists.
 */
export function mcpServerFor(opts: { root?: string; dev: boolean; corpusRoot?: string }): McpRegistration {
  const root = opts.root ?? checkoutRoot();
  const launcher = path.join(root, "bin", "productos.js");
  if (!opts.dev || !fs.existsSync(launcher)) return { command: "productos", args: ["serve", "--mcp"] };
  const reg: McpRegistration = {
    command: process.execPath,
    args: [launcher, "serve", "--mcp"],
  };
  /**
   * ⛔ AND IT IS TOLD WHICH CORPUS, because running the right code is only half of it. `wakeOnWork`
   * in `src/mcp/server.ts` resolves the corpus from the server process's cwd unless
   * `PRODUCTOS_V2_DIR` names one — and the cwd of a server a host spawned is the host's business,
   * not ours. That is the exact gap the comment there was written about.
   */
  if (opts.corpusRoot) reg.env = { PRODUCTOS_V2_DIR: path.join(path.resolve(opts.corpusRoot), "productos", "v2") };
  return reg;
}

/**
 * One MCP config file, with one server named in it. Returns whether anything was written.
 *
 * ⛔ A NAMED FUNCTION, for the same reason `pruneRenamedRoles` is one: `productos v2 change check`
 * verifies a layer by finding a named thing that holds it, and this lived as a closure inside the
 * installer where nothing could reach it — so the registration could only be tested by running an
 * install, which writes into `~/.claude` that every live session on this machine reads.
 */
export function writeMcpRegistration(
  file: string,
  name: string,
  server: McpRegistration,
  make = true
): boolean {
  if (!make && !fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let doc: Record<string, unknown> = {};
  if (fs.existsSync(file)) {
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      // ⛔ Never overwrite a file we cannot parse — it is somebody's configuration.
      return false;
    }
  }
  const servers = (doc.mcpServers ?? {}) as Record<string, unknown>;
  servers[name] = server;
  doc.mcpServers = servers;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf-8");
  return true;
}

/**
 * Skills installed here that this checkout does not bundle, removed — ⛔ and ONLY from the checkout
 * that represents the product.
 *
 * ⛔ THE PRUNE IS RIGHT FROM THE MAIN CHECKOUT AND DESTRUCTIVE FROM A WORKTREE, AND IT HAS ALREADY
 * DONE THE DAMAGE ONCE HERE.
 *
 * `~/.claude/skills/` is one directory shared by every session on the machine. A dev install
 * symlinks into it, so `init claude --update` run from a worktree on an older branch re-aimed every
 * session's skills at that worktree AND deleted the skills only a newer branch has — a session that
 * had been running fine lost a skill it never asked anyone to remove, because a different session
 * ran an install.
 *
 * The boundary is "is this the checkout the product ships from", not "is this a dev install" and not
 * "is `--update` set", because that is the only form of the question where both answers stay true:
 *
 *   - from the main checkout, a skill absent from `skills/` is absent from the PRODUCT, and leaving
 *     it installed is how `productos-scope` survived the eight-became-one rename on every machine
 *     that had ever run init.
 *   - from a worktree, a skill absent from `skills/` is absent from THIS BRANCH. A worktree is on an
 *     unmerged branch by definition, so it is the one place where "not here" never means "gone".
 *
 * So a worktree still installs and refreshes its own skills — that is what makes a worktree useful —
 * and takes nothing away.
 */
export function pruneUninstalledSkills(
  skillsDir: string,
  bundled: readonly string[],
  opts: { mayRemove: boolean }
): string[] {
  if (!opts.mayRemove || !fs.existsSync(skillsDir)) return [];
  const ours = new Set(bundled);
  const gone: string[] = [];
  for (const d of fs.readdirSync(skillsDir)) {
    /** ⛔ Only our own names. The directory is shared with skills we did not write. */
    if (!d.startsWith("productos") || ours.has(d)) continue;
    fs.rmSync(path.join(skillsDir, d), { recursive: true, force: true });
    gone.push(`− ${d}`);
  }
  return gone;
}

/**
 * Roles that are installed and no longer in the registry, removed.
 *
 * ⛔ A NAMED FUNCTION BECAUSE A LAYER HAS TO BE FINDABLE. `productos v2 change check` verifies a
 * layer by looking for a named thing in the file that would hold it, and this logic first went in
 * as four anonymous lines inside the installer — reached, and unverifiable, which is the same
 * position as not having been done.
 */
function pruneRenamedRoles(installed: string[], cfgRoot?: string, main = true, home: string = HOME): string[] {
  if (!installed.length) return [];
  /**
   * ⛔ THE SAME BOUNDARY AS `pruneUninstalledSkills`, AND IT REACHES HERE MORE OFTEN THAN IT LOOKS.
   *
   * An agent directory that belongs to a project is this checkout's own and may always be tidied.
   * But `agentsDirFor` falls back to the machine-wide `~/.claude/agents/` whenever no corpus
   * resolved — and in this repo `productos/` is gitignored, so a fresh worktree has no corpus and
   * takes exactly that fallback. A worktree on a branch that has not merged a renamed role would
   * delete it out from under every other session on the machine.
   */
  if (!cfgRoot && !main) return [];
  const theirs = new Set(installed.map((a) => `${a}.md`));
  const dir = agentsDirFor(cfgRoot, home);
  if (!fs.existsSync(dir)) return [];
  const gone: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    /** ⛔ Only our own files. The directory is shared with agents we did not write. */
    if (!f.startsWith("productos-") || !f.endsWith(".md") || theirs.has(f)) continue;
    fs.rmSync(path.join(dir, f), { force: true });
    gone.push(`− ${f.replace(/\.md$/, "")}`);
  }
  return gone;
}

export function installClaudeSkills(
  opts: {
    update?: boolean;
    config?: ProductosConfig;
    configRoot?: string;
    /**
     * ⛔ HANDED IN, NOT DISCOVERED HERE. The adapter knows how to write an agent; it does not know
     * where a project keeps its corpus, and inventing a path convention inside an installer is how
     * one store quietly becomes two. The caller already resolved the corpus — it passes the steers.
     */
    steers?: readonly Steer[];
    /**
     * ⛔ THE HOST'S OWN DIRECTORY, OVERRIDABLE — AND THE ONLY REASON IS THAT A TEST MAY NOT WRITE
     * INTO IT. `~/.claude/` is read by every live session on this machine, so running an install to
     * find out what an install writes IS the damage. Nothing in production passes this; `init`
     * does not expose a flag for it, deliberately, because a person redirecting their own install
     * would get skills installed where their host will never look for them.
     */
    home?: string;
  } = {}
): ClaudeInstallResult {
  const host = hostDirs(opts.home);
  if (!fs.existsSync(host.claude)) {
    throw new Error(
      `Claude Code not detected at ${host.claude}. Install Claude Code first, then re-run.`
    );
  }
  fs.mkdirSync(host.skills, { recursive: true });
  const root = bundledSkillsRoot();
  const skills = fs.readdirSync(root).filter((d) => d.startsWith("productos"));
  const dev = isDevInstall(root);
  /**
   * ⛔ RESOLVED ONCE, FROM THE MODULE'S OWN LOCATION. Asking `process.cwd()` which checkout this is
   * gets the right answer only when somebody happened to be standing in it.
   */
  const checkout = checkoutRoot();
  const main = isMainCheckout(checkout);
  const installed: string[] = [];
  /**
   * ⛔ A SKILL THAT NO LONGER EXISTS IS REMOVED, NOT LEFT BEHIND — see `pruneUninstalledSkills` for
   * why that is true from the main checkout and false from a worktree.
   *
   * Eight skills became one, and all eight were still sitting in the host's directory afterwards —
   * so a session could still be handed `productos-scope`, which names v1 commands and a model the
   * work has left. Installing has always ADDED; nothing has ever taken away, so every rename and
   * every deletion this project has made is still installed on every machine that ran it.
   */
  installed.push(...pruneUninstalledSkills(host.skills, skills, { mayRemove: main }));
  for (const skill of skills) {
    const src = path.join(root, skill);
    const dst = path.join(host.skills, skill);

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
    : path.join(host.claude, "settings.json");

  /**
   * ⛔ IT REGISTERED THE MCP SERVER WHERE NOTHING READS IT.
   *
   * `settings.json` has no `mcpServers` key in anything that consumes it — so `productos` has
   * never appeared in `claude mcp list`, the desktop app has never seen it, and the whole MCP
   * surface has been installed and unreachable since it shipped. It failed silently because the
   * file was written successfully; nobody checked that anything read it.
   *
   * Written to every place that is actually consulted, each for a different reader:
   *
   *   .mcp.json                 project scope, and it is the one a team shares in the repo
   *   ~/.claude.json            user scope, for sessions outside any project
   *   claude_desktop_config     the Claude app — ⛔ and the ONLY one a published artifact can
   *                             reach, via the `mcp` capability's `host:` form. Without this a
   *                             page can never call the machine it is describing.
   *
   * ⛔ AND IT NAMED A BARE COMMAND, SO ALL THREE POINTED AT WHICHEVER CHECKOUT LINKED LAST.
   * `mcpServerFor` is where that is now decided and why; `mcpServerName` is why two checkouts can
   * both be in `~/.claude.json` instead of overwriting each other.
   */
  const server = mcpServerFor({ root: checkout, dev, corpusRoot: opts.configRoot });
  const name = mcpServerName(checkout);
  const wrote: string[] = [];
  const register = (file: string, make = true): void => {
    if (writeMcpRegistration(file, name, server, make)) wrote.push(file);
  };

  const inRepo = fs.existsSync(path.join(process.cwd(), ".git"));
  if (inRepo) register(path.join(process.cwd(), ".mcp.json"));
  register(host.userConfig, false);
  register(host.desktopConfig, false);
  void target;

  const agents = [
    ...installClaudeAgents(dev, opts.update, opts.config, opts.configRoot, opts.home),
    ...installClaudeAuthors(opts.update, opts.config, opts.configRoot, opts.steers, opts.home),
  ];

  /**
   * ⛔ AND THE SAME FOR ROLES, WHICH WAS MISSING WHILE THE SKILL VERSION SAT TWENTY LINES ABOVE.
   *
   * Skills that no longer exist are removed; roles that no longer exist were not, so every rename
   * this registry has ever made is still installed on every machine that ran init. Two roles were
   * renamed the moment this was noticed — `generated` and `sufficiency`, both for saying nothing
   * about what they ask — and without this a session could still be handed the old pair.
   *
   * ⛔ Only our own files, and only after a successful install. Removing on a failed run would
   * uninstall somebody's working set because a build was broken, and the directory is shared with
   * agents we did not write.
   */
  agents.push(...pruneRenamedRoles(agents, opts.configRoot, main, opts.home));
  return {
    installed,
    agents,
    agentsDir: agentsDirFor(opts.configRoot, opts.home),
    mcpRegisteredAt: wrote.join(", ") || "nowhere — no config file was found to register in",
    mcpName: name,
    mcpRuns: [server.command, ...server.args].join(" "),
    symlinked: dev,
  };
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
  /**
   * Remove the MCP registration — ⛔ from the files that are actually read, and ⛔ only this
   * checkout's own key.
   *
   * It used to delete `mcpServers.productos` from `.claude/settings.json`, which nothing consults
   * (see the ⛔ above `installClaudeSkills`'s register block), so an uninstall has never actually
   * unregistered anything. And now that a worktree registers under its own name, deleting the
   * fixed key `productos` would uninstall the MAIN checkout's server while leaving this worktree's
   * behind — exactly inverted.
   */
  const name = mcpServerName();
  for (const file of [
    path.join(process.cwd(), ".mcp.json"),
    path.join(HOME, ".claude.json"),
    path.join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    path.join(process.cwd(), ".claude", "settings.json"),
  ]) {
    if (!fs.existsSync(file)) continue;
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      continue; // ⛔ Somebody's configuration. Never rewrite what we could not read.
    }
    const servers = doc.mcpServers as Record<string, unknown> | undefined;
    if (!servers || !(name in servers)) continue;
    delete servers[name];
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf-8");
    removed.push(`${name} from ${file}`);
  }
  return { removed };
}
