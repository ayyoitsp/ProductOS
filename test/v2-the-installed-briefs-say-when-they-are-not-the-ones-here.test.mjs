/**
 * ⛔ A SESSION CAN RUN A CURRENT BINARY AGAINST 139-COMMIT-OLD INSTRUCTIONS, AND NOTHING SAID SO.
 *
 * Peter: *"why don't we just run the correct path and not rely on 'which' anyways?"* — and of the
 * dance it took to fix: *"seems ridiculous"*.
 *
 * He is right, and the half a path argument cannot reach is this one: an author's brief is READ
 * FROM THE INSTALL. Passing `dist/cli/index.js` explicitly fixes which code runs and changes
 * nothing about which instructions the author follows.
 *
 * Measured cost: an install behind `origin/main` reported two of a corpus's files unparseable on
 * schema fields `main` accepts. `cannot-judge-this-corpus` is corpus-wide — correctly — so four
 * authors each copied a 270-file corpus aside, patched those two files in the copy, and checked
 * that instead. Two then filed framework gaps asserting the schema refuses what it accepts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { installedBriefsThatDiffer, sayIfInstalledBriefsDiffer } = await import(
  path.resolve("dist/adapters/claude.js")
);

/** A project with its own `.claude/agents`, which is where the host actually reads from. */
function project(agents) {
  const root = temp("pos-install-");
  const dir = path.join(root, ".claude", "agents");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(agents))
    fs.writeFileSync(path.join(dir, name), `---\nname: ${name.replace(/\.md$/, "")}\n---\n${body}`);
  return root;
}

const mine = () => {
  const root = path.resolve("agents");
  const f = fs.readdirSync(root).filter((x) => x.endsWith(".md"))[0];
  return { name: f, body: fs.readFileSync(path.join(root, f), "utf-8") };
};

test("an installed brief whose body is not this build's is reported stale", () => {
  const { name, body } = mine();
  const root = project({ [name]: body + "\n\nAn instruction added by a build nobody is running.\n" });

  const found = installedBriefsThatDiffer(root, root);
  const it = found.find((x) => x.what === name.replace(/\.md$/, ""));

  /** ⛔ The non-zero first. Silence is the whole defect. */
  assert.ok(it, "a brief that is not this build's was not reported");
  assert.equal(it.why, "stale");
  assert.match(it.where, /\.claude\/agents/);
});

test("an identical body is not reported, so the check can distinguish", () => {
  /**
   * ⛔ WITHOUT THIS THE FIRST TEST PASSES ON A CHECK THAT REPORTS EVERYTHING. The installed file
   * carries generated frontmatter the repo body does not, so comparing whole files would call every
   * correct install stale — which is the shape of warning people learn to scroll past.
   */
  const { name, body } = mine();
  const root = project({ [name]: body });
  const found = installedBriefsThatDiffer(root, root);
  assert.deepEqual(
    found.filter((x) => x.what === name.replace(/\.md$/, "")),
    [],
    "a correct install was reported as diverged — frontmatter is being compared"
  );
});

test("a brief that no longer exists in this build is reported as an orphan, not as stale", () => {
  /**
   * ⛔ THE WORSE OF THE TWO, and found live: a real consumer repo had `productos-framework` and
   * `productos-generated` installed, neither of which exists here, both still invokable. The
   * installer's own note says turning an agent off has to REMOVE it — a file left behind is an
   * agent the config says is gone and the host will still run.
   */
  const root = project({ "productos-a-role-that-was-deleted.md": "whatever it used to say" });
  const found = installedBriefsThatDiffer(root, root);
  const it = found.find((x) => x.what === "productos-a-role-that-was-deleted");
  assert.ok(it, "an installed brief with no counterpart in this build was not reported");
  assert.equal(it.why, "orphan");
});

test("never-installed is not reported, because a project chooses which roles it runs", () => {
  /**
   * ⛔ 17 of 21 were absent in the repo where this was measured, by configuration. A warning that
   * fires on everybody is one nobody reads — and it would bury the orphan beside it.
   */
  const root = project({});
  assert.deepEqual(installedBriefsThatDiffer(root, root), []);
});

test("a machine with no install at all says nothing", () => {
  const root = temp("pos-noinstall-");
  assert.deepEqual(installedBriefsThatDiffer(root, root), []);
  assert.deepEqual(sayIfInstalledBriefsDiffer(root, root), []);
});

test("what it says names the file and how to fix it", () => {
  const { name, body } = mine();
  const root = project({ [name]: body + "\n\ndrifted\n" });
  const said = sayIfInstalledBriefsDiffer(root, root).join("\n");
  assert.match(said, /reads its instructions from there/, "it does not say why this matters");
  assert.match(said, /productos init claude --update/, "it does not say how to fix it");
  assert.match(said, new RegExp(name.replace(/\.md$/, "")), "it does not name which brief");
});
