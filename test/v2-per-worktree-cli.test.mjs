/**
 * ⛔ EVERY SESSION ON THIS MACHINE RESOLVED PRODUCTOS THROUGH ONE GLOBAL SLOT, WHICHEVER WORKTREE
 * IT WAS STANDING IN.
 *
 * Three pieces of one failure, and all three were silent:
 *
 *  1. `npm link` is a single symlink. `productos` on PATH is whichever checkout linked last, and
 *     nothing anywhere says which that is.
 *  2. The installer registered `{ command: "productos" }` — the bare name — into `.mcp.json`,
 *     `~/.claude.json` and the desktop config, all under the one key `productos`. So a session's
 *     MCP server ran the linked checkout's code rather than the worktree's, and installing from a
 *     worktree overwrote the main checkout's registration on the way past.
 *  3. The skill install SYMLINKS `skills/<name>` into the shared `~/.claude/skills/` and DELETED
 *     any `productos*` skill the current checkout does not bundle. Run `init claude --update` from
 *     a worktree on an older branch and every session's skills were re-aimed at that worktree and
 *     the skills only a newer branch has were gone. That has already happened here once.
 *
 * The consequence was observed before any of this was understood, and `src/mcp/server.ts:87-95`
 * records it: a session working one corpus had its server started against another, so "the push ran
 * flawlessly over a corpus nobody was looking at". Peter: *"but why wasn't our message listener
 * responding? I don't get it"*.
 *
 * ⛔ AND NOTHING HERE MAY WRITE INTO `~/.claude/`. That directory is shared by every live session on
 * this machine, so a test that installed for real to check the install would do the damage it is
 * checking for. Every behaviour is pinned against a temp directory instead — which is why those
 * functions are exported rather than closures, and why `installClaudeSkills` takes a `home` at all.
 * Nothing in production passes it; the alternative was leaving the two things that had already gone
 * wrong permanently unassertable.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  checkoutRoot,
  checkoutSlug,
  installClaudeSkills,
  isMainCheckout,
  mcpServerFor,
  mcpServerName,
  pruneUninstalledSkills,
  writeMcpRegistration,
} from "../dist/adapters/claude.js";

const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `pos-wt-${tag}-`));

/** A directory that looks like a dev checkout: a launcher to spawn and a `src/` beside `skills/`. */
const fakeCheckout = (tag) => {
  const dir = tmp(tag);
  fs.mkdirSync(path.join(dir, "bin"), { recursive: true });
  fs.writeFileSync(path.join(dir, "bin", "productos.js"), "// launcher\n");
  return dir;
};

const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });

test("the MCP registration names the checkout it was run from, absolutely", () => {
  const root = fakeCheckout("dev");
  const reg = mcpServerFor({ root, dev: true });

  /**
   * ⛔ THE BARE NAME IS THE BUG, not a stylistic choice. `command: "productos"` resolves through
   * the one `npm link` slot, so a worktree's MCP server ran a different worktree's code — and the
   * registration looked perfectly correct while doing it.
   */
  assert.notEqual(reg.command, "productos", "still the bare name — this is the whole defect");
  assert.ok(path.isAbsolute(reg.command), `the command is not an absolute path: ${reg.command}`);
  assert.equal(reg.args[0], path.join(root, "bin", "productos.js"));
  assert.ok(path.isAbsolute(reg.args[0]), "the launcher is not absolute, so it depends on a cwd");
  assert.deepEqual(reg.args.slice(1), ["serve", "--mcp"]);

  /**
   * ⛔ IT IS SPAWNED BY `process.execPath`, NOT BY THE LAUNCHER'S SHEBANG. `bin/productos.js`
   * begins `#!/usr/bin/env node`, which needs `node` on the PATH of whatever spawned it — and the
   * Claude desktop app, one of the three readers this registers for, is started by the window
   * server with almost no PATH. The node running the install is a path that is known to exist.
   */
  assert.equal(reg.command, process.execPath);
});

test("a published install keeps the bare name, because that file is shared in a repo", () => {
  /**
   * ⛔ THE FIX MUST NOT REACH CONSUMERS. `.mcp.json` is the one a team commits, and an absolute
   * path to one machine's `node_modules` is a directory none of their teammates has. The ambiguity
   * being fixed is a DEV ambiguity: several checkouts of ProductOS, one link slot.
   */
  const root = fakeCheckout("published");
  assert.deepEqual(mcpServerFor({ root, dev: false }), {
    command: "productos",
    args: ["serve", "--mcp"],
  });

  /** ⛔ And a checkout with no launcher to point at falls back rather than naming a missing file. */
  const bare = tmp("nolauncher");
  assert.equal(mcpServerFor({ root: bare, dev: true }).command, "productos");
});

test("the server is told which corpus, by the variable the server actually reads", () => {
  const root = fakeCheckout("corpus");
  const project = tmp("project");
  const reg = mcpServerFor({ root, dev: true, corpusRoot: project });

  /**
   * ⛔ RUNNING THE RIGHT CODE IS ONLY HALF OF IT, and the other half is the half that was observed.
   * `wakeOnWork` resolves the corpus from the server process's cwd — and the cwd of a server a host
   * spawned is the host's business, not ours. `PRODUCTOS_V2_DIR` is the escape hatch that comment
   * asks for, and until now nothing set it.
   */
  assert.equal(reg.env.PRODUCTOS_V2_DIR, path.join(project, "productos", "v2"));

  /**
   * ⛔ Pinned against the reader, so a rename on either side fails here rather than silently going
   * back to resolving a corpus from wherever the host happened to be.
   */
  const server = fs.readFileSync("src/mcp/server.ts", "utf-8");
  assert.match(server, /process\.env\.PRODUCTOS_V2_DIR/, "the server no longer reads the variable the install sets");
});

test("two checkouts coexist in one config file instead of overwriting each other", () => {
  const file = path.join(tmp("reg"), "nested", ".claude.json");
  const a = { command: "/a/bin/node", args: ["/a/bin/productos.js", "serve", "--mcp"] };
  const b = { command: "/b/bin/node", args: ["/b/bin/productos.js", "serve", "--mcp"] };

  assert.equal(writeMcpRegistration(file, "productos", a), true);
  assert.equal(writeMcpRegistration(file, "productos-a-branch", b), true);
  const doc = JSON.parse(fs.readFileSync(file, "utf-8"));

  /**
   * ⛔ BOTH, UNDER TWO KEYS. `~/.claude.json` is one map shared by every session, and both checkouts
   * wrote `mcpServers.productos` — so installing from a worktree silently re-aimed the main
   * checkout's sessions at the worktree's code, last install wins, with nothing on screen.
   */
  assert.deepEqual(Object.keys(doc.mcpServers).sort(), ["productos", "productos-a-branch"]);
  assert.deepEqual(doc.mcpServers.productos, a);
  assert.deepEqual(doc.mcpServers["productos-a-branch"], b);

  /** ⛔ Other people's keys in that file are untouched. It is not our file. */
  const withTheirs = path.join(tmp("reg2"), ".claude.json");
  fs.writeFileSync(withTheirs, JSON.stringify({ mcpServers: { somebodyElse: { command: "x" } }, numStartups: 9 }));
  writeMcpRegistration(withTheirs, "productos", a);
  const kept = JSON.parse(fs.readFileSync(withTheirs, "utf-8"));
  assert.deepEqual(kept.mcpServers.somebodyElse, { command: "x" });
  assert.equal(kept.numStartups, 9);

  /** ⛔ A file we cannot parse is left byte-identical — it is somebody's configuration. */
  const broken = path.join(tmp("reg3"), ".claude.json");
  fs.writeFileSync(broken, "{ this is not json");
  assert.equal(writeMcpRegistration(broken, "productos", a), false);
  assert.equal(fs.readFileSync(broken, "utf-8"), "{ this is not json");

  /** ⛔ And `make: false` never CREATES a config for a host that is not installed. */
  const absent = path.join(tmp("reg4"), "claude_desktop_config.json");
  assert.equal(writeMcpRegistration(absent, "productos", a, false), false);
  assert.equal(fs.existsSync(absent), false);
});

test("the main checkout keeps the plain name; a worktree gets its own, the same one make does", () => {
  /**
   * ⛔ DRIVEN THROUGH REAL GIT, because the mechanism IS a git fact: `git worktree list` puts the
   * main working tree first, and that ordering is the only thing distinguishing "the checkout the
   * product ships from" from "a checkout on an unmerged branch". A fixture asserting on a string
   * would pass while the derivation was reading the wrong line.
   */
  const repo = tmp("repo");
  git(repo, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "f"), "x");
  git(repo, "add", "f");
  git(repo, "commit", "-qm", "first");
  const wt = path.join(repo, "trees", "Review-Loop_2");
  git(repo, "worktree", "add", "-q", "-b", "side", wt);

  assert.equal(isMainCheckout(repo), true);
  assert.equal(checkoutSlug(repo), "", "the main checkout has no slug, so it keeps the plain name");
  assert.equal(mcpServerName(repo), "productos");

  assert.equal(isMainCheckout(wt), false);
  assert.equal(checkoutSlug(wt), "review-loop-2", "uppercase and `_` are not legal in a name");
  assert.equal(mcpServerName(wt), "productos-review-loop-2");

  /**
   * ⛔ THE SAME SLUG `scripts/stack.sh` DERIVES, PINNED AGAINST IT. That script already names this
   * checkout's Docker project and its ports from the worktree directory. A second convention for
   * the same question means `make stacks` and `claude mcp list` disagree about which checkout you
   * are looking at, and the person reading both has no way to tell which one lied.
   *
   * ⛔ THE SLUG, NOT THE WHOLE NAME — AND THIS ASSERTION EARNED ITS KEEP BY FAILING. It compared the
   * full strings, which held while a worktree's Docker project was `productos-<slug>`. `4100` then
   * became staging, so every checkout — the main one included — got `productos-dev-<slug>` and no
   * derived answer may be `productos` any more. This failed on `productos-review-loop-2` vs
   * `productos-dev-review-loop-2`, which is exactly the divergence it exists to catch.
   *
   * The prefixes are allowed to differ: `productos-dev-` says "a Docker stack with a Postgres and
   * two ports", and an MCP registration is neither. What may never differ is WHICH TREE each one
   * names, so that is what is pinned.
   */
  const stack = execFileSync(path.resolve("scripts/stack.sh"), [wt, "stack"], { encoding: "utf-8" }).trim();
  const stackSlug = stack.replace(/^productos-dev-/, "");
  assert.equal(
    checkoutSlug(wt),
    stackSlug,
    `the MCP name and the stack name point at different trees: ${mcpServerName(wt)} vs ${stack}`,
  );
  /** ⛔ And the main checkout agrees too — it has a dev stack now, so there is a slug to compare. */
  const mainStack = execFileSync(path.resolve("scripts/stack.sh"), [repo, "stack"], { encoding: "utf-8" }).trim();
  assert.equal(mainStack, "productos-dev-main", "the main checkout no longer has a dev stack of its own");
  assert.equal(mcpServerName(repo), "productos", "the main checkout's MCP registration should stay the plain name");

  /**
   * ⛔ NO GIT, OR GIT REFUSING, FALLS ON THE MAIN SIDE. An npm install of ProductOS is the product
   * as shipped; reading it as a worktree would permanently disable the one cleanup a consumer needs,
   * which is a worse failure than the one this is guarding against.
   */
  assert.equal(isMainCheckout(tmp("notarepo")), true);
});

test("a worktree installs its own skills and takes none away", () => {
  const dir = tmp("skills");
  for (const d of ["productos", "productos-only-on-a-newer-branch", "somebody-elses-skill"]) {
    fs.mkdirSync(path.join(dir, d));
    fs.writeFileSync(path.join(dir, d, "SKILL.md"), `# ${d}\n`);
  }

  /**
   * ⛔ THE PRUNE IS RIGHT FROM THE MAIN CHECKOUT AND DESTRUCTIVE FROM A WORKTREE, AND THIS IS THE
   * destructive half. `~/.claude/skills/` is one directory shared by every session on the machine.
   * An install from a worktree on an older branch deleted the skills only a newer branch has, so a
   * session that had been running fine lost a skill it never asked anyone to remove — because a
   * DIFFERENT session ran an install. A worktree is on an unmerged branch by definition, so it is
   * the one place where "not in `skills/` here" never means "gone from the product".
   */
  assert.deepEqual(pruneUninstalledSkills(dir, ["productos"], { mayRemove: false }), []);
  assert.ok(
    fs.existsSync(path.join(dir, "productos-only-on-a-newer-branch", "SKILL.md")),
    "a worktree install deleted a skill that is merely not on its branch"
  );

  /**
   * ⛔ AND THE RIGHT HALF STILL HAPPENS. From the main checkout, a skill absent from `skills/` is
   * absent from the PRODUCT — leaving it is how `productos-scope` survived the eight-became-one
   * rename on every machine that had ever run init, naming v1 commands and a model the work left.
   */
  assert.deepEqual(pruneUninstalledSkills(dir, ["productos"], { mayRemove: true }), [
    "− productos-only-on-a-newer-branch",
  ]);
  assert.equal(fs.existsSync(path.join(dir, "productos-only-on-a-newer-branch")), false);
  assert.ok(fs.existsSync(path.join(dir, "productos", "SKILL.md")), "it removed a skill this checkout bundles");

  /** ⛔ Only our own names. The directory is shared with skills we did not write. */
  assert.ok(fs.existsSync(path.join(dir, "somebody-elses-skill", "SKILL.md")), "it reached outside its own names");

  /** ⛔ A host with no skills directory at all is not an error — it is a first install. */
  assert.deepEqual(pruneUninstalledSkills(path.join(dir, "nope"), [], { mayRemove: true }), []);
});

test("⛔ the installer asks the module which checkout it is, and never a project's own skills", () => {
  const src = fs.readFileSync("src/adapters/claude.ts", "utf-8");

  /**
   * ⛔ FROM THE MODULE'S LOCATION, NOT FROM `process.cwd()`. The cwd answers "where was this run",
   * which is the question that was already being asked and is why a global binary looked correct
   * from inside a worktree. Only the module's own path answers "whose `dist/` is executing".
   */
  assert.match(src, /const checkout = checkoutRoot\(\);/, "the installer no longer resolves its own checkout");
  assert.match(src, /const main = isMainCheckout\(checkout\);/, "nothing decides whether this checkout may prune");
  assert.doesNotMatch(
    src,
    /(?:isMainCheckout|checkoutSlug|mcpServerName|mcpServerFor)\([^)]*process\.cwd\(\)/,
    "the cwd is being asked which checkout this is — it only knows where somebody was standing"
  );

  /**
   * ⛔ THE PRUNE IS HANDED THE HOST'S SKILLS DIRECTORY AND THE MAIN-CHECKOUT ANSWER, once.
   * Re-deriving either at the call site is how the guard gets argued past by the next person
   * adding a second call.
   */
  const calls = [...src.matchAll(/pruneUninstalledSkills\(/g)];
  assert.equal(calls.length, 2, "exactly one definition and one call site");
  assert.match(src, /pruneUninstalledSkills\(host\.skills, skills, \{ mayRemove: main \}\)/);

  /**
   * ⛔ AND IT NEVER TOUCHES `<project>/.claude/skills/`. There is a project-scoped skill there —
   * `productos-migrations`, deliberately not in `skills/` because `skills/` ships to consumers, see
   * `test/v2-migrations-skill.test.mjs` — and it is tracked in this repo. The installer knows one
   * project-scoped directory and it is `agents`; the only skills directory it writes is the host's.
   */
  assert.ok(fs.existsSync(".claude/skills/productos-migrations/SKILL.md"), "the project-scoped skill moved");
  const projectJoins = [...src.matchAll(/path\.join\((?:cfgRoot|[A-Za-z.]*[Rr]oot), "\.claude", "([a-z]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(projectJoins)], ["agents"], "the installer now builds a project-scoped path that is not agents/");
  const skillsJoins = [...src.matchAll(/path\.join\(([A-Za-z_]+), "skills"\)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(skillsJoins)].sort(),
    ["CLAUDE_DIR", "claude"],
    "a skills directory appeared that is not the host's — one of them is somebody's project"
  );
  /** ⛔ And `claude` is `hostDirs`' own local, so both of those resolve from the one root. */
  assert.match(src, /const claude = path\.join\(home, "\.claude"\);/);
});

test("⛔ uninstalling removes this checkout's registration, not the fixed name", () => {
  /**
   * ⛔ READ THE CODE, NOT THE PROSE. The first version of this matched `mcpServers.productos` inside
   * the comment explaining why nothing deletes it — a test failing on its own documentation, which
   * `test/agents-and-areas` has already been bitten by once.
   */
  const src = fs.readFileSync("src/adapters/claude.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  const un = src.slice(src.indexOf("export function uninstallClaudeSkills"));

  /**
   * ⛔ `delete s.mcpServers.productos` WOULD NOW BE EXACTLY INVERTED. Uninstalling from a worktree
   * would unregister the MAIN checkout's server and leave the worktree's behind — and it was
   * already doing it in `.claude/settings.json`, which nothing consults, so an uninstall has never
   * unregistered anything at all.
   */
  assert.match(un, /mcpServerName\(\)/, "uninstall does not know which registration is its own");
  assert.doesNotMatch(un, /mcpServers\?\.productos|mcpServers\.productos\b/, "it still deletes the fixed key");
  for (const f of [".mcp.json", ".claude.json", "claude_desktop_config.json"])
    assert.ok(un.includes(f), `uninstall does not reach ${f}, where the registration actually is`);
});

test("the real install writes the absolute command and prunes nothing from a worktree", () => {
  /**
   * ⛔ THE END-TO-END RUN, AGAINST A HOST DIRECTORY THAT IS NOT THE REAL ONE.
   *
   * `installClaudeSkills` writes into `~/.claude/` — read by every live session on this machine — so
   * a test that ran it to see what it writes would do the damage it is checking for. That is why
   * `home` is an option at all: the two behaviours that had already gone wrong were unassertable,
   * because the only way to observe either was to inflict it.
   */
  const home = tmp("home");
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  /** A skill only some other branch bundles — the thing a worktree install deleted. */
  const stale = "productos-only-on-a-newer-branch";
  fs.mkdirSync(path.join(home, ".claude", "skills", stale));
  fs.writeFileSync(path.join(home, ".claude", "skills", stale, "SKILL.md"), "#\n");

  const project = tmp("repo-e2e");
  fs.mkdirSync(path.join(project, ".git"));

  /**
   * ⛔ `.mcp.json` GOES WHERE THE SESSION IS, which is `process.cwd()` — so the cwd has to move, and
   * it has to move back in a `finally`. A test that left the process in a temp directory would fail
   * every later test in this file that reads `src/` off a relative path, as a missing file with no
   * connection to the thing that caused it.
   */
  const was = process.cwd();
  let r;
  try {
    process.chdir(project);
    r = installClaudeSkills({ update: true, configRoot: project, home });
  } finally {
    process.chdir(was);
  }

  const name = mcpServerName();
  const doc = JSON.parse(fs.readFileSync(path.join(project, ".mcp.json"), "utf-8"));
  assert.deepEqual(Object.keys(doc.mcpServers), [name], "registered under the wrong key");
  const reg = doc.mcpServers[name];

  /**
   * ⛔ WHAT A SESSION IN THIS DIRECTORY WILL ACTUALLY RUN. `productos` here is the defect: a bare
   * name resolves through one global `npm link` slot, so the server ran whichever checkout linked
   * last — and `src/mcp/server.ts:87-95` records what that cost.
   */
  assert.equal(reg.args[0], path.join(checkoutRoot(), "bin", "productos.js"));
  assert.ok(path.isAbsolute(reg.command));
  assert.equal(reg.env.PRODUCTOS_V2_DIR, path.join(project, "productos", "v2"));
  assert.equal(r.mcpName, name);
  assert.ok(r.mcpRuns.includes("bin/productos.js"), `the report does not say what it will run: ${r.mcpRuns}`);

  /** ⛔ And the agents went beside the project, not onto the machine — which is a separate rule. */
  assert.equal(r.agentsDir, path.join(project, ".claude", "agents"));
  assert.ok(fs.existsSync(path.join(project, ".claude", "agents", "productos-newcomer.md")));

  const hostSkills = fs.readdirSync(path.join(home, ".claude", "skills")).sort();
  /**
   * ⛔ AND THE ASSERTION IS THE SAME SENTENCE IN BOTH CHECKOUTS, because a worktree is where this
   * project tells people to work and the last round of this shipped two assertions that only passed
   * in the main checkout. The claim is about the RULE, so it is read off the rule.
   */
  if (isMainCheckout()) {
    assert.ok(!hostSkills.includes(stale), "the main checkout left a skill the product no longer has");
    assert.ok(r.installed.includes(`− ${stale}`), `it removed it without reporting the removal: ${r.installed}`);
  } else {
    assert.ok(hostSkills.includes(stale), "a worktree install deleted a skill that is merely not on its branch");
    assert.ok(!r.installed.some((x) => x.startsWith("− ")), `a worktree reported a removal: ${r.installed}`);
  }
  /** ⛔ Either way it installed its own, which is what makes a worktree worth working in. */
  assert.ok(hostSkills.includes("productos"), `the one skill was not installed: ${hostSkills}`);
});

test("⛔ this checkout's own answers are self-consistent", () => {
  /**
   * The one assertion about the tree the suite is running in rather than a fixture — and it has to
   * hold from BOTH a worktree and the main checkout, because a worktree is where this project tells
   * people to work and the previous round of this shipped two assertions that only passed here.
   */
  const root = checkoutRoot();
  assert.ok(fs.existsSync(path.join(root, "src", "adapters", "claude.ts")), `checkoutRoot() is not a checkout: ${root}`);
  assert.equal(mcpServerName(root), isMainCheckout(root) ? "productos" : `productos-${checkoutSlug(root)}`);
  assert.match(mcpServerName(root), /^productos(-[a-z0-9-]{1,40})?$/);
});
