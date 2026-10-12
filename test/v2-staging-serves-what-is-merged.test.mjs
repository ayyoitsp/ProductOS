/**
 * ⛔ "STAGING SERVES WHAT IS MERGED" WAS A CLAIM ABOUT HEAD, AND THE IMAGE IS BUILT FROM THE TREE.
 *
 * `staging-guard` asked one question — is HEAD an ancestor of origin/main — and `Dockerfile` does
 * `COPY src ./src`. So a checkout sitting on a perfectly merged HEAD with uncommitted work in
 * `src/` passed the guard and shipped that work to the one store everybody reviews on, and anything
 * new in `drizzle/` ran against it on boot.
 *
 * That is how it actually went wrong: a session's half-finished edits reached staging and created a
 * table on the managed Neon store, while the guard reported a clean merged HEAD throughout. Both
 * sides are silent — the deploy succeeds, the instance comes up healthy, and the only evidence is
 * that the running code is not any commit.
 *
 * ⛔ DRIVEN IN A REAL REPOSITORY, NOT MATCHED AGAINST THE MAKEFILE'S TEXT. The condition is a shell
 * snippet about `git status`, and an assertion that the Makefile CONTAINS `git status --porcelain`
 * would pass on a snippet that named the wrong paths, inverted the test, or could never fire. So
 * the block is lifted out of the Makefile and run against scratch repositories in both states.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const makefile = () => fs.readFileSync(path.resolve("Makefile"), "utf-8");

/**
 * The dirty-tree half of `MERGED_CHECK`, as a runnable shell script.
 *
 * ⛔ Lifted, never retyped. A copy of the condition in this file would be a second implementation
 * that agrees with the Makefile on the day it is written and never again.
 */
function dirtyCheck() {
  const mk = makefile();
  const i = mk.indexOf("define MERGED_CHECK");
  assert.ok(i >= 0, "MERGED_CHECK is gone — the guards share one copy of this question");
  const body = mk.slice(i, mk.indexOf("\nendef", i));
  const start = body.indexOf('if [ -n "$$(git status --porcelain');
  assert.ok(
    start >= 0,
    "MERGED_CHECK no longer asks whether the WORKING TREE is clean — a merged HEAD is not a merged image"
  );
  const block = body.slice(start);
  return (
    block
      /** `$$` is make's escape for a literal shell `$`. */
      .replace(/\$\$/g, "$")
      /** The guard's two message arguments; nothing here depends on their values. */
      .replace(/\$\(1\)/g, "staging")
      .replace(/\$\(2\)/g, "up-remote")
      /** Line continuations, which make needs and sh does not. */
      .replace(/\\\n\t*/g, "\n")
      .replace(/;\s*$/, "")
  );
}

function scratchRepo() {
  const dir = temp("productos-guard-");
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "T");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "drizzle"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "thing.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(dir, "README.md"), "notes\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  return { dir, git };
}

const run = (dir, script) => {
  try {
    execFileSync("sh", ["-c", script], { cwd: dir, stdio: "pipe" });
    return { refused: false, out: "" };
  } catch (e) {
    return { refused: true, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("a clean tree is allowed through", () => {
  const { dir } = scratchRepo();
  const r = run(dir, dirtyCheck());
  assert.equal(r.refused, false, `a clean tree was refused:\n${r.out}`);
});

test("uncommitted source refuses the deploy, and says what it found", () => {
  const { dir } = scratchRepo();
  fs.writeFileSync(path.join(dir, "src", "thing.ts"), "export const a = 2; // not committed\n");
  const r = run(dir, dirtyCheck());
  assert.equal(r.refused, true, "uncommitted work in src/ shipped to the shared store");
  /**
   * ⛔ AND IT NAMES THE FILES. "Something is dirty" sends somebody to `git status` to find out what;
   * the whole value of catching this is being told which uncommitted file was about to be deployed.
   */
  assert.match(r.out, /src\/thing\.ts/, "the refusal did not say which file it found");
  /** ⛔ And why a merged HEAD was not enough, or the next person reads this as the guard misfiring. */
  assert.match(r.out, /COPY src|working tree|WORKING TREE/i, "the refusal does not explain why HEAD being merged is not the question");
});

test("an uncommitted migration refuses it too — that is the one that touches the managed store", () => {
  const { dir } = scratchRepo();
  /**
   * ⛔ THE CASE THAT ACTUALLY COST SOMETHING. A new file in `drizzle/` is applied to the shared
   * store on boot, and `drizzle/` is untracked-new rather than modified — so a check that only
   * looked at tracked modifications would have let exactly this through.
   *
   * ⛔ AND IT MUST NAME THE FILE. Without `-uall`, git collapses an untracked directory and reports
   * `?? drizzle/` — so the refusal fired, and the one file about to be applied to the managed store
   * was the one thing it did not say.
   */
  fs.writeFileSync(path.join(dir, "drizzle", "0003_listening.sql"), "CREATE TABLE listening ();\n");
  const r = run(dir, dirtyCheck());
  assert.equal(r.refused, true, "an uncommitted migration could reach the managed store");
  assert.match(r.out, /drizzle\/0003_listening\.sql/);
});

test("work outside what the image is built from does not block a deploy", () => {
  const { dir } = scratchRepo();
  /**
   * ⛔ OR THE GUARD BECOMES THE THING PEOPLE ROUTINELY OVERRIDE. Planning notes, a scratch file and
   * an editor's leftovers are not in the image; refusing on those teaches everybody to reach for
   * DEV_ANYWAY, and then it guards nothing at all.
   */
  fs.writeFileSync(path.join(dir, "README.md"), "notes, edited\n");
  fs.writeFileSync(path.join(dir, "scratch.txt"), "whatever\n");
  const r = run(dir, dirtyCheck());
  assert.equal(r.refused, false, `a deploy was refused over files the image does not contain:\n${r.out}`);
});

test("both guards still share one copy of the question", () => {
  const mk = makefile();
  /** ⛔ A second copy is a second place to forget. This is why `MERGED_CHECK` is a define. */
  for (const t of ["up-remote", "rebuild-remote", "restart-remote"]) {
    assert.match(mk, new RegExp(`^${t}:[^\\n]*\\bstaging-guard\\b`, "m"), `${t} can reach the shared store unguarded`);
  }
  assert.equal((mk.match(/git status --porcelain -uall -- src/g) ?? []).length, 1, "the working-tree question has been copied");
});
