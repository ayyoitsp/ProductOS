/**
 * ⛔ IT ALWAYS GENERATES — and the reason this test exists is that for months it never did.
 *
 * Peter: *"why isn't this done? we've re-idnexed multiple times. fix product OS so that it ALWAYS
 * generates. why hasn't it been generating properly?"*
 *
 * Six of sixteen screens in a corpus re-indexed several times had ever been drawn from the code.
 * Every layer defaulted to not drawing: the generator had to be aimed one screen at a time with its
 * component named by hand, `migrate` carried drawings forward without making any, and `check` filed
 * the omission as a NOTE — so a corpus of hand-typed screens passed the gate meant to stop it being
 * handed over. Prose could not fix that. Three assertions can.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { resolveRoute, isResolved, fingerprintOf } = await import(path.resolve("dist/v2/routes.js"));

/** A tiny repo: two components, one of which really renders the screen. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-draws-"));
  fs.mkdirSync(path.join(root, "src/components"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src/components/DealsList.tsx"),
    `export const DealsList = () => (<div><button>New Deal</button><input placeholder="Search deals"/><span>No deals yet</span><a>Clear filters</a></div>);`
  );
  fs.writeFileSync(
    path.join(root, "src/components/Unrelated.tsx"),
    `export const Unrelated = () => (<div><button>New Deal</button></div>);`
  );
  return root;
}

const view = {
  id: "deals-list",
  title: "The deals list",
  parts: [
    { id: "new", role: "commits", label: "New Deal" },
    { id: "search", role: "entry", label: "Search deals" },
    { id: "empty", role: "display", label: "No deals yet" },
    { id: "clear", role: "commits", label: "Clear filters" },
  ],
};

test("a screen finds its own component, from what it says it shows", () => {
  const root = fixture();
  const r = resolveRoute(view, { repoRoot: root, searchRoots: ["."] });
  assert.ok(isResolved(r), `should have resolved; got ${JSON.stringify(r)}`);
  assert.match(r.file, /DealsList\.tsx$/);
  assert.equal(r.matched.length, 4, "every label it declares is in that component");
});

test("⛔ it refuses rather than guessing, and says what it tried", () => {
  const root = fixture();
  /**
   * The failure this guards is the expensive one. Resolving by name alone pointed `overview-tab` at
   * a DIFFERENT PRODUCT'S tab — and a wrong drawing is worse than none, because it is read as what
   * the product looks like and nothing downstream can tell it is false.
   */
  const noEvidence = { id: "overview-tab", title: "Overview", parts: [] };
  const r = resolveRoute(noEvidence, { repoRoot: root, searchRoots: ["."] });
  assert.ok(!isResolved(r), "a screen with nothing to match on must not resolve");
  assert.equal(r.why, "no-labels");
  assert.match(r.detail, /name the route by hand|nothing of its own/);

  /** Two components holding the same evidence, neither named like the view: a guess either way. */
  const ambiguous = { id: "zzz-unnameable", title: "?", parts: [{ id: "a", role: "commits", label: "New Deal" }] };
  const amb = resolveRoute(ambiguous, { repoRoot: root, searchRoots: ["."] });
  assert.ok(!isResolved(amb), "a tie nothing breaks must not resolve");
  assert.ok(amb.candidates?.length, "and it must name what it was torn between");
});

test("⛔ a worktree copy is not a second candidate", () => {
  const root = fixture();
  /**
   * The first sweep reported four screens unresolvable because "two components hold 4 of 7 labels
   * each" — and the two were one file, once in the repo and once under `.claude/worktrees/`. The
   * margin rule was right and a duplicate was defeating it.
   */
  const wt = path.join(root, ".claude/worktrees/agent-1/src/components");
  fs.mkdirSync(wt, { recursive: true });
  fs.copyFileSync(path.join(root, "src/components/DealsList.tsx"), path.join(wt, "DealsList.tsx"));
  const r = resolveRoute(view, { repoRoot: root, searchRoots: ["."] });
  assert.ok(isResolved(r), "a copy of the winner must not create a tie");
  assert.ok(!r.file.includes(".claude"), "and the real file wins, not the copy");
});

test("a screen with no source is a REFUSAL where there is code to draw from", async () => {
  const src = fs.readFileSync("src/v2/check.ts", "utf-8");
  /**
   * ⛔ The whole defect in one line. `severity: "note"` here is why sixty screens stayed hand-typed
   * through several re-indexings: advice nobody is forced to take is advice nobody takes.
   */
  const at = src.indexOf('kind: "never-drawn-from-the-code"');
  assert.ok(at > 0, "the check must still exist");
  const around = src.slice(at - 600, at);
  assert.match(around, /severity: notBuilt \? "note" : "refuse"/, "it must refuse when the screen is supposed to exist");
  assert.match(around, /v\.exists === "intended" \|\| !hasCode/, "and stay advice where there is nothing to draw from");
  assert.match(src.slice(at, at + 900), /draw --all/, "and the fix must point at the sweep, not at one screen");
});

test("the sweep exists and is reachable without naming a component", () => {
  const cli = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  assert.match(cli, /\.option\("--all"/, "draw must take --all");
  assert.match(cli, /if \(o\.all\) return drawEverything/, "and --all must sweep");
  /** ⛔ `--route` stopped being required, or --all could never run. */
  assert.ok(!/requiredOption\("--route/.test(cli), "--route must not be required any more");
});
