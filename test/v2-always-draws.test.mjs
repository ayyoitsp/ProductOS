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
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { resolveRoute, isResolved, fingerprintOf } = await import(path.resolve("dist/v2/routes.js"));
const { writeSketchHtml } = await import(path.resolve("dist/v2/draw-write.js"));

/** A tiny repo: two components, one of which really renders the screen. */
function fixture() {
  const root = temp("productos-draws-");
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

test("⛔ a screen needs a PICTURE, not a component — the earlier version of this test had it inverted", () => {
  const src = fs.readFileSync("src/v2/check.ts", "utf-8");
  /**
   * ⛔ THIS TEST USED TO ASSERT THE OPPOSITE, AND THAT IS THE POINT OF THIS COMMENT.
   *
   * It pinned `severity: notBuilt ? "note" : "refuse"` on a screen having no `drawn_from` — which
   * requires every screen in the TARGET STATE to point at code that exists, so a screen that should
   * exist and is not built could never satisfy it. Worse, the escape was `exists: intended`: the
   * author had to declare something about the BUILD to get their target state accepted.
   *
   * Peter: *"product truth is supposed to represent the 'target state' always, doesn't matter
   * what's been built. the drift resolution is downstream."*
   *
   * So the refusal is about the picture, and either source satisfies it.
   */
  assert.match(src, /kind: "no-picture-of-this-screen"/, "a screen nobody can look at must refuse");
  assert.match(src, /if \(!v\.sketch_html && !v\.sketch\)/, "and having no COMPONENT must not be what triggers it");
  /** ⛔ ONE command in the fix, not a sequence to assemble — see `productos v2 generate`. */
  assert.match(src, /v2 generate/, "the fix must name the single regeneration pass");

  /** Having no code source says something about the build, so it is a note about drift. */
  assert.match(src, /kind: "nothing-to-compare-this-against"/, "no component is a drift fact, not a truth gap");

  /** ⛔ And a deleted component is evidence, never authority over the target. */
  assert.match(src, /kind: "the-code-dropped-this-screen"/, "a deleted component must not refuse the corpus");
  assert.doesNotMatch(src, /drawn-from-something-that-is-gone/, "the old refusal must be gone, not merely downgraded");

  /**
   * ⛔ Nothing may OFFER `exists: intended` as a way out of a gap in the truth — checked on the
   * `fix:` lines only, because the comment above the corrected check quotes the old wording on
   * purpose, and a test that cannot tell a quotation from a live instruction would force that
   * history to be deleted to go green.
   */
  const fixes = [...src.matchAll(/fix:\s*(`[^`]*`|"[^"]*")/g)].map((m) => m[1]).join("\n");
  assert.doesNotMatch(fixes, /exists: intended/, "built-ness must never be offered as an escape from a truth-level finding");
});

test("the sweep exists and is reachable without naming a component", () => {
  const cli = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  assert.match(cli, /\.option\("--all"/, "draw must take --all");
  assert.match(cli, /if \(o\.all\) return drawEverything/, "and --all must sweep");
  /** ⛔ `--route` stopped being required, or --all could never run. */
  assert.ok(!/requiredOption\("--route/.test(cli), "--route must not be required any more");
});

/**
 * ⛔ THE FRAMEWORK GENERATES IT — NOBODY ASKS FOR IT PIECE BY PIECE.
 *
 * Peter: *"the framework will now generate these, not me asking you to do it, right?"* — and the
 * answer was no: drawing, proposing and connecting were three commands somebody had to know about,
 * order correctly, and choose to run. That is how six of sixteen screens stayed hand-typed through
 * several re-indexings. One pass, named in the skill, named in the fix text of the check that
 * refuses a corpus without it.
 */
test("one command regenerates everything generable, and every layer points at it", () => {
  const cli = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  assert.match(cli, /\.command\("generate"\)/, "there must be a single regeneration pass");
  /** It has to do all three, and in an order where each feeds the next. */
  const body = cli.slice(cli.indexOf('.command("generate")'), cli.indexOf('.command("generate")') + 2000);
  const draw = body.indexOf("drawEverything");
  const propose = body.indexOf("proposeScreens");
  const connect = body.indexOf("connectAll");
  assert.ok(draw > 0 && propose > draw, "it must draw before it proposes — a drawn screen needs no proposal");
  assert.ok(connect > propose, "and connect last: a screen must exist before anything can lead to it");

  /** ⛔ One body per pass, or the single command and the standalone one drift. */
  assert.match(cli, /function proposeScreens\(/, "propose must be a function both callers share");
  assert.match(cli, /function connectAll\(/, "connect must be a function both callers share");

  assert.match(fs.readFileSync("src/v2/check.ts", "utf-8"), /v2 generate/, "check must name it in its fix");
  /**
   * ⛔ THE INSTRUCTIONS MUST NAME IT, wherever they live. There were eight skills; there is one,
   * and the authoring rules moved into the role that writes a scope — so this reads both, which is
   * the whole of where a future session is told what to do.
   */
  const told = [
    ...fs.readdirSync("skills").flatMap((d) => {
      const f = path.join("skills", d, "SKILL.md");
      return fs.existsSync(f) ? [fs.readFileSync(f, "utf-8")] : [];
    }),
    ...fs.readdirSync("agents").filter((f) => f.endsWith(".md")).map((f) => fs.readFileSync(path.join("agents", f), "utf-8")),
  ].join("\n");
  assert.match(told, /productos v2 generate/, "nothing tells the next session, so it assembles the sequence by hand again");
});


/**
 * ⛔ REDRAWING A SCREEN THAT HAS PARTS WROTE A SECOND DRAWING AND BROKE THE CORPUS.
 *
 * Peter, looking at a create-deal prototype: *"i can't tell if clicking on next is actually
 * navigating"*. Wiring the controls meant giving the screen its parts; giving it parts and
 * redrawing produced "duplicated mapping key at line 107" and a corpus that would not load.
 *
 * `writeSketchHtml` found the end of a view by scanning for the next `- id:` line. A view's PARTS
 * each start `- id:`, so it stopped at the first part and declared the view over there — and any
 * generated block sitting after `parts:`, which is exactly where it puts one when `parts` is
 * inline `[]`, fell outside the deletion window, survived, and got a full second copy beside it.
 *
 * ⛔ It needs no unusual corpus. The drawing comes from the code and the parts come from a person,
 * and people write them second — so the ordinary order of work is the one that triggers it.
 */
test("redrawing a screen that has parts replaces the drawing rather than adding one", () => {
  const root = temp("productos-redraw-");
  fs.mkdirSync(path.join(root, "truth"), { recursive: true });
  const file = path.join(root, "truth", "thing.md");

  /** ⛔ `parts` BEFORE the drawing, which is where a person writing them second puts them. */
  fs.writeFileSync(
    file,
    [
      "---",
      "id: thing",
      "title: A thing",
      "views:",
      "  - id: the-screen",
      "    title: The screen",
      "    exists: kept",
      "    parts:",
      "      - id: save",
      "        role: commits",
      "        label: Save",
      "      - id: name",
      "        role: entry",
      "        label: Name",
      '    drawn_from: "src/Old.tsx"',
      '    drawn_at: "0000000"',
      "    sketch_html: |",
      '      <div class="old">the previous drawing</div>',
      "    states:",
      '      - when: "isLoading"',
      '        label: "Loading"',
      "        sketch_html: |",
      '          <div class="old-loading">old</div>',
      "exchanges: []",
      "---",
      "",
      "Prose that must survive.",
      "",
    ].join("\n")
  );

  const count = (body, re) => (body.match(re) ?? []).length;

  writeSketchHtml(
    root,
    "thing",
    "the-screen",
    '<div class="new">the new drawing</div>',
    { from: "src/New.tsx", at: "1111111" },
    "New\n  text",
    [{ when: "isEmpty", label: "Empty", html: '<div class="new-empty">new</div>' }]
  );

  const once = fs.readFileSync(file, "utf-8");
  assert.equal(count(once, /^ *drawn_from:/gm), 1, "a second drawing was written beside the first");
  assert.equal(count(once, /^ *sketch_html: \|/gm), 2, "expected exactly the view's drawing and its one state");
  assert.ok(!once.includes("the previous drawing"), "the old drawing survived the redraw");
  assert.ok(!once.includes("old-loading"), "the old states survived the redraw");
  assert.ok(once.includes("the new drawing"), "the new drawing was not written");
  /** ⛔ AND THE AUTHORED PARTS ARE UNTOUCHED — they are nobody's to regenerate. */
  assert.ok(once.includes("- id: save") && once.includes("- id: name"), "regenerating ate the parts");
  assert.ok(once.includes("Prose that must survive."), "regenerating ate the prose");

  /** ⛔ And again, because the failure only showed itself on the SECOND write. */
  writeSketchHtml(
    root,
    "thing",
    "the-screen",
    '<div class="new">the new drawing</div>',
    { from: "src/New.tsx", at: "1111111" },
    "New\n  text",
    [{ when: "isEmpty", label: "Empty", html: '<div class="new-empty">new</div>' }]
  );
  const twice = fs.readFileSync(file, "utf-8");
  assert.equal(twice, once, "drawing twice with the same input changed the file — it is not idempotent");

  fs.rmSync(root, { recursive: true, force: true });
});
