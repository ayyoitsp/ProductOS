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

/**
 * ⛔ THE OTHER HALF OF THE GUARD: IDENTITY. "Is this merged" was implemented as "is this the tip",
 * and the two differ for exactly as long as a deploy takes.
 *
 * `rebuild-remote` depends on `staging-guard`, so identity is asked AFTER the suite — about twelve
 * minutes in. On an afternoon where main merged every five, the sha that was the tip when the gate
 * started never was when the gate reached the rebuild: green suite at dcf496e, backup taken, then
 * refused because 604f5db had landed meanwhile. Nothing could reach staging while anybody was
 * merging, and the refusal named the condition correctly, so it read as working.
 *
 * ⛔ AND THIS FILE'S OWN HEADER SAID ANCESTRY while the Makefile tested equality. The documentation
 * of the invariant and the invariant disagreed, with nothing failing — which is why the question now
 * gets driven here rather than described there.
 */
function identityCheck() {
  const mk = makefile();
  const i = mk.indexOf("staging-guard:");
  assert.ok(i >= 0, "staging-guard is gone");
  const body = mk.slice(i, mk.indexOf("\nup:", i));
  const start = body.indexOf("@git fetch -q origin main");
  assert.ok(start >= 0, "staging-guard no longer refreshes its idea of origin/main");
  const end = body.indexOf("$(call MERGED_CHECK", start);
  assert.ok(end >= 0, "staging-guard no longer reaches the working-tree question");
  const block = body.slice(start, end);
  assert.match(
    block,
    /merge-base --is-ancestor HEAD origin\/main/,
    "staging-guard is asking whether HEAD IS the tip again — that cannot ship while anybody is merging"
  );
  return block
    .replace(/^\t*@?/gm, "")
    .replace(/\$\$/g, "$")
    /** The guard is active exactly when this is empty. */
    .replace(/\$\(DEV_ANYWAY\)/g, "")
    .replace(/\\\n\s*/g, "\n")
    /** Everything after the identity half; the tree half has its own tests above. */
    .replace(/@?if \[ -z "" \]; then[\s\S]*$/, "");
}

/** A scratch repo with a real `refs/remotes/origin/main`, so the guard's own git commands work. */
function withOrigin() {
  const { dir, git } = scratchRepo();
  const at = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf-8" }).trim();
  git("update-ref", "refs/remotes/origin/main", at());
  const commit = (msg, file = "src/thing.ts", text = msg) => {
    fs.writeFileSync(path.join(dir, file), `// ${text}\n`);
    git("add", "-A");
    git("commit", "-qm", msg);
    return at();
  };
  const originMovesTo = (sha) => git("update-ref", "refs/remotes/origin/main", sha);
  return { dir, git, at, commit, originMovesTo };
}

test("the tip of origin/main deploys", () => {
  const { dir } = withOrigin();
  const r = run(dir, identityCheck());
  assert.equal(r.refused, false, `the tip of main was refused:\n${r.out}`);
});

test("⛔ a merged sha still deploys after main moves past it — the livelock this replaced", () => {
  const { dir, at, commit, originMovesTo, git } = withOrigin();
  const mine = at();
  /** Someone else merges while the suite runs. */
  const theirs = commit("landed during the suite");
  originMovesTo(theirs);
  git("checkout", "-q", mine);
  const r = run(dir, identityCheck());
  /**
   * ⛔ THE ASSERTION THAT WOULD HAVE CAUGHT IT. Under equality this refuses, and refuses every
   * deploy attempted during working hours.
   */
  assert.equal(r.refused, false, `a merged sha was refused because main had moved on:\n${r.out}`);
});

test("being behind is said out loud, with a count, rather than passing silently", () => {
  const { dir, at, commit, originMovesTo, git } = withOrigin();
  const mine = at();
  commit("one");
  const two = commit("two");
  originMovesTo(two);
  git("checkout", "-q", mine);
  const r = runSaying(dir, identityCheck());
  assert.equal(r.refused, false);
  /**
   * ⛔ A NUMBER, NOT A HEDGE. Deploying an older merged sha is legitimate — it is how a bad cut gets
   * rolled back — but doing it without noticing is how a session reports a fix live that it never
   * shipped. "2" is the thing that makes the two cases distinguishable.
   */
  assert.match(r.out, /\b2 commit\(s\) ahead/, `the deploy did not say how far behind it was:\n${r.out}`);
  assert.match(r.out, /NOT the tip/, "it did not say the newer commits are staying behind");
});

test("a commit that is on no branch of origin/main is still refused", () => {
  const { dir, commit } = withOrigin();
  /** origin/main stays where it was; this commit exists only here. */
  commit("unpushed work");
  const r = run(dir, identityCheck());
  assert.equal(r.refused, true, "an unmerged commit could reach the store everybody reviews on");
  assert.match(r.out, /not on origin\/main/, "the refusal does not say what is wrong");
});

/**
 * ⛔ `run` DISCARDS STDOUT WHEN THE SCRIPT SUCCEEDS, and the warning being asserted only ever
 * appears on success. Reusing it would have made that assertion unfalsifiable: `out` is `""`, so a
 * check for the count would fail whether the guard printed it or not, and a check that it is absent
 * would pass on a guard that never printed anything at all.
 */
function runSaying(dir, script) {
  try {
    const out = execFileSync("sh", ["-c", script], { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { refused: false, out };
  } catch (e) {
    return { refused: true, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
