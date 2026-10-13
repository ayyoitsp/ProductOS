/**
 * ⛔ ONE PRODUCTOS CHECKOUT'S INSTALLER OVERWROTE ANOTHER ONE'S ROLES, SILENTLY, AND REPORTED
 * SUCCESS.
 *
 * Peter, on being told the global install was reverting things: *"Yes"* — fix it.
 *
 * The global `productos` is an `npm link`: the entry in `lib/node_modules` is a symlink to one
 * checkout, so the binary runs **whatever branch that checkout happens to be on**, invoked from
 * anywhere. `checkoutRoot()` resolves from the module's own location and names that tree;
 * `configRoot` names the project being written to. Everything in the installer was written assuming
 * those are the same tree.
 *
 * Observed: `init claude --update` run from a worktree, served by a main checkout sitting on an
 * unrelated feature branch,
 *
 *   · **deleted** `productos-decomposer.md` and `productos-demonstrator.md` — the stale registry has
 *     no such roles, so `pruneRenamedRoles` read them as renamed and tidied them away
 *   · **reverted** `productos-scoper.md` to a `criteria` section that had been deliberately removed
 *     after *"a product person doesn't write a criterion - what even is this? this is old shit"*
 *
 * Both inside the normal path, both reported as a successful install. It looked exactly like
 * somebody having deleted two files by hand.
 *
 * ⛔ AND THE FIX IS NOT "REFUSE WHEN THE TREES DIFFER", WHICH WOULD BREAK WHAT THIS IS FOR.
 * Installing into a consumer repo means the target is a different tree every time — it just has no
 * `agents/` of its own to lose. So the rule is narrower: refuse when the target **is itself a
 * ProductOS checkout and a different one**, because then it holds its own authoritative copies of
 * everything about to be written and this code cannot know which is newer. The three tests below are
 * exactly those three cases, and the middle one is the only refusal.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { installClaudeSkills } from "../dist/adapters/claude.js";
import { temp } from "./support/temp.mjs";

/**
 * ⛔ A FAKE `~/.claude`, BECAUSE RUNNING AN INSTALL TO FIND OUT WHAT AN INSTALL WRITES *IS* THE
 * DAMAGE. The real one is read by every live session on this machine. `home` exists for this and
 * nothing in production passes it.
 */
function fakeHome() {
  const home = temp("inst-home-");
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "agents"), { recursive: true });
  return home;
}

/** A tree that looks like ProductOS by the two things that make it one. */
function fakeProductosCheckout() {
  const root = temp("inst-pos-");
  fs.mkdirSync(path.join(root, "src/core"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/core/jobs.ts"), "export const AGENTS = [];\n");
  fs.mkdirSync(path.join(root, "agents"), { recursive: true });
  fs.mkdirSync(path.join(root, ".claude/agents"), { recursive: true });
  return root;
}

test("installing into another ProductOS checkout is refused, and names both trees", () => {
  const home = fakeHome();
  const theirs = fakeProductosCheckout();

  /** A role that project has and this code's registry does not — the exact thing that got deleted. */
  const theirRole = path.join(theirs, ".claude/agents/productos-decomposer.md");
  fs.writeFileSync(theirRole, "# a role this checkout defines and the installer has never heard of\n");

  assert.throws(
    () => installClaudeSkills({ update: true, configRoot: theirs, home }),
    (e) => {
      assert.match(e.message, /would write one ProductOS checkout's roles into another/i, e.message);
      /** ⛔ Both paths, because "something is wrong with your install" sends nobody anywhere. */
      assert.ok(e.message.includes(theirs), `the message does not say which project: ${e.message}`);
      assert.match(e.message, /npm link/, "the message does not say why this happens");
      return true;
    }
  );

  /**
   * ⛔ THE ASSERTION THAT ACTUALLY MATTERS. A refusal that happens after the pruning has run is not
   * a fix — it is the same damage with a better error message.
   */
  assert.ok(fs.existsSync(theirRole), "the other checkout's role was deleted before the refusal");
  assert.match(
    fs.readFileSync(theirRole, "utf-8"),
    /never heard of/,
    "the other checkout's role was overwritten before the refusal"
  );
});

test("installing into a consumer repo still works — it is what this is for", () => {
  const home = fakeHome();
  /** No `src/core/jobs.ts`, no `agents/` — somebody's product, which is the normal target. */
  const consumer = temp("inst-consumer-");
  fs.mkdirSync(path.join(consumer, "src"), { recursive: true });
  fs.writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "their-app" }));

  const r = installClaudeSkills({ update: true, configRoot: consumer, home });

  assert.ok(r.installed.length > 0, "no skills were installed into a consumer repo");
  assert.ok(r.agents.length > 0, "no roles were installed into a consumer repo");
});

test("installing into the checkout the code came from still works", () => {
  const home = fakeHome();
  /**
   * ⛔ `checkoutRoot()` resolves from the module's own location, which under `node --test` is this
   * repo — so passing `process.cwd()` is passing the same tree, which is the case that must not
   * regress. This is how Peter's own `npm run build && productos init claude --update` runs.
   */
  const r = installClaudeSkills({ update: true, configRoot: process.cwd(), home });

  assert.ok(r.installed.length > 0, "installing into its own checkout stopped installing skills");
  assert.ok(
    r.agents.some((a) => a.includes("decomposer")),
    `the engineering authors were not installed: ${JSON.stringify(r.agents)}`
  );
});

/** ⛔ And the refusal is before any write, asserted on the source as well as the behaviour above. */
test("the check runs before anything is written or removed", () => {
  const src = fs.readFileSync("src/adapters/claude.ts", "utf-8");
  const refusal = src.indexOf("anotherProductosCheckout(opts.configRoot)");
  const firstWrite = src.indexOf("pruneRenamedRoles(agents");
  assert.ok(refusal > 0, "nothing checks whether the install crosses checkouts");
  assert.ok(
    refusal < firstWrite,
    "the cross-checkout refusal happens after roles are pruned, so the damage is already done"
  );
});
