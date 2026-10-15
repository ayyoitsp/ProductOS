/**
 * ⛔ EVERY `v2 propose` RUN SILENTLY DELETED THE STATES AN AUTHOR HAD WRITTEN.
 *
 * `writeSketchHtml` spliced out any existing `states:` block unconditionally and re-added it only
 * `if (states?.length)`. `draw` derives states from a component and always passes an array, so for
 * it they are output and regenerating them is right. `propose` derives nothing from a component —
 * there is none, which is the whole point — so its states are AUTHORED, and it passed nothing.
 *
 * Reported independently by two authors within an hour:
 *   "my two states on `the-name` vanished on each propose run and nothing reported it"
 *   "the round-trip dropped the `states:` block from one of two sibling `commits` parts"
 *
 * One had re-authored them by hand and observed that command order had become load-bearing, which
 * is the shape of a corpus quietly depending on what somebody remembered to run last.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { writeSketchHtml, diskPages } = await import(path.resolve("dist/v2/draw-write.js"));

/** A corpus with one screen whose part carries two authored states. */
function withAuthoredStates() {
  const dir = temp("keep-states-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "named-thing.md"),
    `---
id: named-thing
title: Named Thing
in: family-wallet
exists: kept
views:
  - id: the-name
    title: The name
    view_kind: detail
    sketch: |
      [ the name ]
    parts:
      - id: the-worked-out-name
        role: display
        label: The name it works out to
        states:
          - kind: loading
            says: Working it out…
          - kind: empty
            says: Nothing could supply one detail yet
      - id: ask-again
        role: commits
        label: Work it out again
---

# Named Thing

A screen whose part has states nobody generated.
`
  );
  return dir;
}

const statesIn = (dir) => {
  const raw = fs.readFileSync(path.join(dir, "truth", "named-thing.md"), "utf-8");
  return (raw.match(/^\s*- kind: /gm) ?? []).length;
};

test("a propose run keeps the states an author wrote", () => {
  const dir = withAuthoredStates();
  assert.equal(statesIn(dir), 2, "the fixture did not start with two states");

  execFileSync("node", [CLI, "v2", "propose", "named-thing#the-name", "--into", dir], { stdio: "pipe" });

  /** ⛔ The non-zero first. Silence is the whole defect — nothing reported the loss. */
  assert.equal(statesIn(dir), 2, "⛔ propose deleted the states the author wrote");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("and it still writes the drawing, so keeping them is not just doing nothing", () => {
  /**
   * ⛔ WITHOUT THIS, THE TEST ABOVE PASSES ON A PROPOSE THAT FAILED OUTRIGHT. "The states survived"
   * is true of a command that wrote nothing at all, which is the cheapest possible way to satisfy
   * it and would hide a worse bug than the one being fixed.
   */
  const dir = withAuthoredStates();
  execFileSync("node", [CLI, "v2", "propose", "named-thing#the-name", "--into", dir], { stdio: "pipe" });
  const raw = fs.readFileSync(path.join(dir, "truth", "named-thing.md"), "utf-8");
  assert.match(raw, /sketch_html: \|/, "propose wrote no drawing");
  assert.match(raw, /data-part="the-worked-out-name"/, "the drawing does not place the part");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("proposing twice is the same as proposing once", () => {
  /**
   * ⛔ THE SHAPE BOTH AUTHORS ACTUALLY HIT: it was the SECOND run that cost them, because the first
   * had nothing to delete yet. A fix tested with one run would have looked correct.
   */
  const dir = withAuthoredStates();
  execFileSync("node", [CLI, "v2", "propose", "named-thing#the-name", "--into", dir], { stdio: "pipe" });
  const once = fs.readFileSync(path.join(dir, "truth", "named-thing.md"), "utf-8");
  execFileSync("node", [CLI, "v2", "propose", "named-thing#the-name", "--into", dir], { stdio: "pipe" });
  const twice = fs.readFileSync(path.join(dir, "truth", "named-thing.md"), "utf-8");
  assert.equal(statesIn(dir), 2, "the second run deleted them");
  assert.equal(once, twice, "two propose runs do not agree — the file is not settled");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the corpus still loads after a propose run", () => {
  /** ⛔ A splicer that keeps a block can also leave it in the wrong place. Parsing is the proof. */
  const dir = withAuthoredStates();
  execFileSync("node", [CLI, "v2", "propose", "named-thing#the-name", "--into", dir], { stdio: "pipe" });
  /** ⛔ `check` exits non-zero when it refuses anything, which is most corpora — read its output. */
  let out;
  try {
    out = execFileSync("node", [CLI, "v2", "check", "--at", dir], { encoding: "utf-8" });
  } catch (e) {
    out = String(e.stdout ?? "");
  }
  assert.ok(out.length, "check printed nothing at all");
  assert.doesNotMatch(out, /will-not-parse/, "the file no longer parses after a propose run");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("regenerating a screen's own states does not take a part's with them", () => {
  /**
   * ⛔ THE CASE THE `states !== undefined` GUARD CANNOT REACH, and the reason the indent fix is not
   * redundant with it. `draw` DOES pass states — they are derived from the component and
   * regenerating them is correct — so the guard is open, and the search then found the PART's
   * authored block first and spliced that out instead.
   *
   * `View.states` is keyed on `when`, the condition in the code. `Part.states` is keyed on `kind`,
   * a word a person chose. One is output and one is somebody's work, and they sat at different
   * indents inside the same window.
   */
  const dir = withAuthoredStates();
  const file = path.join(dir, "truth", "named-thing.md");

  writeSketchHtml(
    diskPages(dir),
    "named-thing",
    "the-name",
    "<div>a drawing</div>",
    undefined,
    undefined,
    [{ when: "isLoading", label: "Loading", html: "<div>loading</div>" }]
  );

  const raw = fs.readFileSync(file, "utf-8");
  /** ⛔ The author's two survive... */
  assert.equal((raw.match(/^\s*- kind: /gm) ?? []).length, 2, "⛔ regenerating the view's states deleted the part's");
  /** ...and the generated one was still written, or this passes on a writer that did nothing. */
  assert.match(raw, /- when: "isLoading"/, "the view's own state was not written");
  fs.rmSync(dir, { recursive: true, force: true });
});
