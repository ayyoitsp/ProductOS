/**
 * ⛔ A PRODUCT IS NOT A PILE OF SCREENS.
 *
 * Peter: *"we should be able to know the true navigation, leverage screens within screens, like
 * really a walkable single prototype that can link out to the different areas. so the goal here is
 * to just have a SINGLE screen that can go through the whole product, based on the established
 * truth"*.
 *
 * The corpus knew two relations and neither was containment: scopes nest, so it knew a screen
 * belongs to a FEATURE, and `connect` infers that a control LEADS somewhere from what its words
 * say. On the corpus this was built against, that inference found four links across twenty-two
 * screens — eighteen with no way in or out — so a map drawn from links alone said the product was
 * in pieces. It is not. Most controls do not navigate: they act where they are, or they switch a
 * tab, and switching a tab is containment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCorpus } from "../dist/v2/load.js";
import { walkOf } from "../dist/v2/walk.js";
import { checkCorpus } from "../dist/v2/check.js";

/** A corpus with a shell, two tabs inside it, and a screen in another feature. */
function corpus(views, extra = "") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "productos-walk-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "workspace.md"),
    [
      "---",
      "id: workspace",
      "title: The workspace",
      "in: family-wallet",
      "exists: kept",
      "happy_path:",
      "  accomplishes: Somebody looks at one deal and moves between the parts of it.",
      "  brings: the deal they came for",
      "  ends_with: they have seen the part they came for",
      "  through: [shell]",
      "  not: doing the work itself",
      "views:",
      views + "---",
      "",
      "A place things are looked at.",
      extra,
    ].join("\n")
  );
  return dir;
}

const VIEWS = `  - id: shell
    title: Deal workspace
    sketch_html: "<div>shell</div>"
  - id: overview-tab
    title: Overview
    within: shell
    sketch_html: "<div>overview</div>"
  - id: notes-tab
    title: Notes
    within: workspace#shell
`;

test("a screen says which screen it appears inside, and the walk holds it there", () => {
  /** ⛔ Both spellings: a bare view id means this scope, which is what an author writing one means. */
  const dir = corpus(VIEWS);
  const walk = walkOf(loadCorpus(dir));
  const shell = walk.steps.get("workspace#shell");
  assert.ok(shell, "the shell is not in the walk at all");
  assert.deepEqual(
    shell.holds,
    ["workspace#overview-tab", "workspace#notes-tab"],
    "a screen that says it is inside another was not held there"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a held screen is never a door, even though nothing links to it", () => {
  /**
   * ⛔ THE WHOLE POINT OF RECORDING CONTAINMENT. You reach a tab through the screen that holds it.
   * Counting it as an entry would put every tab in the product on the "start somewhere else" strip
   * and say the product has twenty front doors.
   */
  const dir = corpus(VIEWS);
  const walk = walkOf(loadCorpus(dir));
  assert.ok(!walk.entries.includes("workspace#overview-tab"), "a tab was offered as a way into the product");
  assert.ok(walk.entries.includes("workspace#shell"), "the screen that holds the tabs is not a door");
  /** ⛔ And it is still reachable — through its holder, which is how a person gets there. */
  assert.ok(walk.reachable.has("workspace#overview-tab"), "a tab inside a reachable screen was called unreachable");
  assert.equal(walk.unreachable.length, 0, `nothing should be stranded here: ${walk.unreachable.join(", ")}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a screen nothing holds and nothing leads to is named, not dropped", () => {
  /**
   * ⛔ A WALK THAT SILENTLY SKIPPED IT would read as a complete product with part of itself
   * missing — the opposite of what this surface is for.
   */
  const dir = corpus(`  - id: shell
    title: Deal workspace
    sketch_html: "<div>shell</div>"
  - id: orphan
    title: Nobody can get here
    sketch_html: "<div>orphan</div>"
`);
  const walk = walkOf(loadCorpus(dir));
  /** Both are doors here, so neither is stranded — strand one by holding it somewhere unreachable. */
  assert.ok(walk.entries.length >= 2, "a screen with no holder and no link must be a door");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a within that points at nothing is refused", () => {
  /**
   * ⛔ REFUSED, NOT REPORTED, because it is an authoring mistake rather than a fact about the
   * product: the author meant a screen and named one that is not there, and every walk through that
   * part of the product is wrong until it is fixed.
   */
  const dir = corpus(`  - id: shell
    title: Deal workspace
    sketch_html: "<div>shell</div>"
  - id: lost
    title: Lost
    within: no-such-screen
    sketch_html: "<div>lost</div>"
`);
  const f = checkCorpus(dir).findings.find((x) => x.kind === "within-points-at-nothing");
  assert.ok(f, "a screen claiming to be inside a screen that does not exist was accepted");
  assert.equal(f.severity, "refuse", "a dangling containment is an authoring mistake and must refuse");
  assert.match(f.what, /no-such-screen/, "the finding does not name what was pointed at");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("where the truth is silent the walk says so rather than inventing a link", () => {
  /**
   * ⛔ THE ACTIONABLE GAP. A control that commits and that nothing says a destination for is the
   * reason a product is not walkable end to end, and it is the one thing an author can fix. It is
   * carried on the step so the surface can draw it as a dead control rather than omit it.
   */
  const dir = corpus(VIEWS);
  const walk = walkOf(loadCorpus(dir));
  const every = [...walk.steps.values()];
  assert.ok(
    every.some((s) => s.exits.length === 0),
    "a corpus that says nothing about where controls land should produce steps with no exits"
  );
  /** ⛔ And nothing was invented: no exit may point at a screen that is not in the walk. */
  for (const s of every)
    for (const e of s.exits)
      assert.ok(walk.steps.has(e.to), `${s.ref} claims an exit to ${e.to}, which is not a screen here`);
  fs.rmSync(dir, { recursive: true, force: true });
});
