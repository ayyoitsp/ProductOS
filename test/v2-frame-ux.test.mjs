/**
 * ⛔ THE FRAME GOT OUT OF THE WAY, AND THE PROTOTYPE GOT A HEIGHT THE READER SETS.
 *
 * Peter: *"let's condense the bottom bar. hide the 'about: {which page}' piece. not needed. reduce
 * the height of the text input and the send button, reduce the font size. '8 framework asks' - make
 * this just a chip inline with the send button, showing '8', and clicking it will expand it. for the
 * top bar - so much space above the deal title.. get rid of that, make the title pretty small. get
 * rid of 'Sepcification 4 unsettled' - pointless."* Then, correcting his own next sentence: *"let's
 * actually make the prototype frame draggable up or hideable."*
 *
 * ⛔ THE CORRECTION IS THE INTERESTING PART. A fixed half-screen is right for an eight-control form
 * and wrong for a long table: judging one sentence needs the control in view, judging thirty needs
 * the list in view, and a fixed ratio picks one and is wrong for the other. So the height is the
 * reader's, remembered like the nav placement — a reading posture, not a per-feature choice.
 *
 * What is asserted here is the MARKUP CONTRACT, because a string of HTML is all this test can see.
 * The behaviour was measured in Chromium: composer 40px tall with a 27px input at 13px, the frame
 * at 414px, dragged to 264px, hidden to 0px, and still hidden after a reload.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

function page() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2ux-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return renderScopePage(loadCorpus(dir), "tasks", { interactive: true, by: "a-person", mode: "http" });
}

test("the composer is one row, with no line naming the ref", () => {
  const html = page();
  assert.ok(!/class="note-at"/.test(html), "the about-line is back, costing a line of frame to say what the screen says");
  /** ⛔ The ref itself is still captured — it is the one thing a reader cannot reconstruct later. */
  assert.match(html, /note-text/, "the composer is gone entirely");
  assert.match(html, /\.note-row \{ display: flex/, "the row is not a single flex row");
});

test("the acknowledgements are a chip on that row, not a bar", () => {
  const html = page();
  assert.match(html, /<button type="button" id="ack-chip" class="ack-chip" hidden><\/button>/, "there is no chip");
  assert.ok(!/class="ack-bar"/.test(html.replace(/\/\*[\s\S]*?\*\//g, "")), "the bar is back under the composer");
  /** ⛔ And nothing listens for the control the bar used to have. */
  assert.ok(!/closest\("button\.ack-head"\)/.test(html), "a listener survives for an element nothing renders");
});

test("the feature title is small and carries no stage line", () => {
  const html = page();
  assert.match(html, /<h3 class="feature-title">/, "the title is still a page-level heading");
  assert.match(html, /\.feature-title \{ font-size: 1rem/, "the title is not small");
  assert.ok(!/<p class="stage /.test(html), "the derived stage is back above the title, summarising the thing below it");
});

/**
 * ⛔ `stageOf` MUST SURVIVE ITS PLACEMENT BEING WRONG. Deleting the derivation along with the line
 * that showed it would have thrown away the answer to "which features are ready for builders" —
 * a question asked from a LIST of features, not from inside one.
 */
test("the stage is still derived, even though nothing shows it here", async () => {
  const { stageOf } = await import("../dist/v2/grid.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2ux2-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const st = stageOf(loadCorpus(dir), "tasks");
  assert.ok(st, "the derivation went with the line that displayed it");
  assert.equal(st.stage, "specification");
});

test("the prototype has its own frame, with a grip and a hide", () => {
  const html = page();
  assert.match(html, /<div class="proto-frame">/, "the prototype is not in a frame of its own");
  assert.match(html, /<div class="proto-scroll">/, "it has no scrolling area, so a tall screen pushes the tabs away");
  assert.match(html, /class="proto-grip" role="separator"/, "there is nothing to drag");
  assert.match(html, /class="proto-hide"/, "there is no way to hide it");
  /** ⛔ A height, not a fixed half — see the header comment. */
  assert.match(html, /--proto-h: 46vh/, "the height is not a variable the reader can change");
  assert.match(html, /\.proto-scroll \{ height: var\(--proto-h\)/, "the frame does not use it");
});

test("the height is remembered, floored, capped, and reachable by keyboard", () => {
  const html = page();
  assert.match(html, /localStorage\.setItem\("productos:proto"/, "the reader is asked again on every feature");
  assert.match(html, /Math\.max\(80, Math\.min\(window\.innerHeight - 160/,
    "dragged to nothing it is an invisible frame with a grip in it, and dragged past the viewport the tabs leave the screen");
  assert.match(html, /ArrowUp|ArrowDown/, "a divider only a mouse can move is one half the readers cannot");
  /** ⛔ Hidden is zero height, never display:none — the grip has to stay reachable to bring it back. */
  assert.match(html, /\[data-proto="off"\] \.proto-scroll \{ height: 0/, "hiding removes the grip with the frame");
});

/**
 * ⛔ THREE WRITES TO AN ELEMENT THAT NO LONGER EXISTS, AND I GUARDED TWO. Removing the about-line
 * left `label.textContent` twice and `label.title` once; the third threw on every ref computation,
 * which is how that function ends — so the throw escaped into whatever called it. Found in the
 * browser as "Cannot set properties of null", not by reading the diff.
 */
test("nothing writes to the removed about-label unguarded", () => {
  const src = fs.readFileSync("src/v2/page.ts", "utf-8");
  for (const m of src.matchAll(/^\s*(?!if \(label\))(?:\/\/.*)?\blabel\.(textContent|title)\s*=/gm))
    assert.fail(`an unguarded write to the removed label: ${m[0].trim()}`);
});

/**
 * ⛔ THE PROTOTYPE DOES NOT MOVE. THAT IS THE WHOLE POINT, AND GIVING THE BOTTOM PANE ITS OWN
 * SCROLL WAS HALF THE JOB AND READ AS NONE OF IT.
 *
 * Peter: *"the BOTTOM scrolls INDEPENDENTLY. yet, every time i scroll the screen the prototype goes
 * off the screen. the idea is to have the PROTOTYPE NOT MOVE. that's the POINT. and if it's too
 * BIG, they can RESIZE IT. is that clear?"*
 *
 * It was. The bottom pane did scroll on its own — and the DOCUMENT still scrolled too, so a wheel
 * event anywhere outside that pane took the whole view, prototype included, off the top. ⛔ A frame
 * whose contents scroll and which itself scrolls is not a frame.
 *
 * Measured in Chromium after the fix: twelve wheel scrolls over the bottom pane and an End key move
 * the prototype 0px, `window.scrollY` stays 0, and the pane itself scrolls 186px. A non-framed view
 * still scrolls like the document it is.
 */
test("the document does not scroll while a framed view is showing", () => {
  const html = page();
  /** The flag is set by the switcher, because only it knows which view is on screen. */
  assert.match(html, /dataset\.framed = "1"/, "nothing marks that a framed view is showing");
  assert.match(html, /delete document\.documentElement\.dataset\.framed/,
    "the flag is never cleared, so a product view stops scrolling too");
  assert.match(html, /:root\[data-framed\] body \{ overflow: hidden; \}/,
    "the document still scrolls on a framed view, so the prototype rides off the top");
  /** ⛔ And the composer's clearance goes with it, or the frame's bottom sits under the composer. */
  assert.match(html, /:root\[data-framed\] body\.has-note-bar \{ padding-bottom: 0; \}/,
    "the frame is sized minus the composer AND padded for it, so its bottom is unreachable");
});

test("both panes scroll on their own", () => {
  const html = page();
  assert.match(html, /section\.view\.framed > \.below \{ flex: 1 1 auto; min-height: 0; overflow: auto; \}/,
    "the bottom pane does not scroll independently");
  assert.match(html, /\.proto-scroll \{ height: var\(--proto-h\); overflow: auto/, "the prototype pane does not scroll");
  /** ⛔ `min-height: 0`, or a flex child refuses to shrink and scrolls the page instead of itself. */
  assert.match(html, /min-height: 0/, "a flex child with no zero min-height pushes the page taller than the viewport");
});

/**
 * ⛔ 97px STOOD BETWEEN THE TOP OF THE FRAME AND THE PICTURE. Peter: *"there's white space above the
 * 'Create a deal' form part in the prototype - just wasted space."* A 1.5rem margin, a 1.2rem
 * margin, and a heading naming the screen directly under a title naming the feature — which on a
 * one-screen feature is the same thing twice. Down to 39px, which is the state tab row: a control,
 * not waste.
 */
test("the frame does not waste space above the drawing", () => {
  const html = page();
  assert.match(html, /\.proto-scroll \.screens \{ margin: 0; \}/, "the screens section keeps its page margin inside the frame");
  assert.match(html, /\.proto-scroll \.screen \{ margin: 0; \}/, "each screen keeps its page margin inside the frame");
  /**
   * ⛔ AND THE HEADING STAYS WHERE A FEATURE HAS SEVERAL SCREENS — there the name is the only thing
   * telling you which one you are looking at, which is the label doing its job rather than waste.
   *
   * Asserted on what RENDERS for each case, not on the source conditional: the branch is taken on
   * the server, so the markup either carries the heading or it does not. The first version of this
   * matched the source pattern against the output and failed, which is the right failure.
   */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2head-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const screensIn = (id) => c.scopes.find((x) => x.scope.id === id).scope.views.filter((v) => v.exists !== "withdrawn").length;
  const protoOf = (id) =>
    /<div class="proto-scroll">[\s\S]*?<div class="proto-grip"/.exec(
      renderScopePage(c, id, { interactive: true, by: "a-person" })
    )?.[0] ?? "";
  const many = c.scopes.map((x) => x.scope.id).find((id) => screensIn(id) > 1);
  const one = c.scopes.map((x) => x.scope.id).find((id) => screensIn(id) === 1);
  assert.ok(many, "the seed has no feature with several screens, so this test proves half of what it claims");
  assert.match(protoOf(many), /<h4>/, `${many} has ${screensIn(many)} screens and none is named`);
  if (one) assert.ok(!/<h4>/.test(protoOf(one)), `${one} has one screen and still repeats its name under the title`);
});
