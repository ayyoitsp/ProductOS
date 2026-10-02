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
  /** ⛔ The floor moved from 80 to 140: 80 left a sliver, and the height is remembered. */
  assert.match(html, /Math\.max\(140, Math\.min\(window\.innerHeight - 160/,
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

/**
 * ⛔ TWO THINGS THAT WORKED IN NO TEST AND WERE FOUND BY DRIVING THE PAGE.
 *
 * Peter: *"drive the UX and make sure this works. stop being lazy."* Twenty-nine steps through the
 * page the way a person uses it — land, read, resize, hide, scroll, switch tabs, press, edit, type,
 * narrow the window, reload — surfaced two dead features that every existing test called present:
 *
 *   — double-click to edit did nothing. The handler looked for `article.beh`, and a behaviour had
 *     been an article two restructurings ago. It found the text, failed to find its row, returned.
 *   — Escape did not close the edit box, because focus was still on `body` after appending it, so
 *     the box's own keydown never fired. The only way out was reloading the page.
 *
 * ⛔ Both were asserted by earlier tests as "the handler is in the script", which is true of a
 * handler that returns on its first line. What is pinned here is the SELECTOR each one depends on,
 * which is the part a string match can genuinely check.
 */
test("editing in place targets the element it is actually in", () => {
  const html = page();
  /** ⛔ Its own element, not the cell — the cell also holds the chips, which editing wiped. */
  assert.match(html, /<span class="says-text">/, "the sentence has no element of its own inside the cell");
  assert.match(html, /ev\.target\.closest\("\.says-text"\)/, "the edit handler does not target the sentence");
  assert.match(html, /closest\("tr\.beh, article\.beh"\)/,
    "the edit handler looks for an element the page no longer renders, so double-click silently does nothing");
});

test("the edit box can always be escaped, wherever focus went", () => {
  const html = page();
  /** ⛔ On the document as well as the box: relying on the box having focus relied on something false. */
  assert.match(html, /document\.addEventListener\("keydown", onEsc, true\)/,
    "Escape only works when the box has focus, and after appending it the focus was on body");
  assert.match(html, /requestAnimationFrame\(\(\) => box\.focus\(\)\)/,
    "the box is focused before it is laid out, which does nothing");
  /** ⛔ And the listener is removed, or every edit leaves one behind for the rest of the session. */
  assert.match(html, /removeEventListener\("keydown", onEsc, true\)/, "the escape listener is never removed");
});

/**
 * ⛔ A GROUP GETS THE FRAME TOO, AND NOT GIVING IT ONE IS WHY HE STILL COULD NOT SEE IT.
 *
 * Peter, after a 29-step drive of a FEATURE page reported everything working: *"still don't see
 * anything on the bottom half, still not moveable pane for the preview."*
 *
 * He was not on a feature. `/v2` with no hash lands on the product overview, and a group — an area,
 * the product itself — renders its own screens too. Neither had a frame, so on either there is a
 * prototype you cannot move and no second pane at all: exactly what he described, twice, while my
 * drive passed on the one view that worked.
 *
 * ⛔ The lesson is about the drive, not the layout. I navigated by clicking a leaf in the nav, which
 * is one of several ways in and the only one I tried. A surface verified on the path its author
 * happens to take is verified nowhere. 32 views and the landing are now driven, every one by URL.
 */
test("a group with screens of its own is framed like a feature", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2grp-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const group = c.scopes.find((x) => c.scopes.some((k) => k.scope.in === x.scope.id) && x.scope.views.length);
  const html = renderScopePage(c, c.scopes.find((x) => !x.scope.in).scope.id, { interactive: true, by: "a-person" });
  /** Every view that renders a drawing also renders the frame around it. */
  const views = [...html.matchAll(/<section class="view( framed)?" id="[^"]*" data-view="([^"]+)"[\s\S]*?(?=<section class="view|$)/g)];
  for (const [whole, framed, id] of views) {
    const draws = /class="proto |class="state-frame|class="proto"/.test(whole);
    if (draws) {
      assert.ok(framed, `${id} renders a drawing and is not framed, so it cannot be moved`);
      assert.match(whole, /class="proto-frame"/, `${id} draws a screen outside a frame`);
      assert.match(whole, /class="below"/, `${id} has a drawing and no second pane`);
    }
  }
  void group;
});

/**
 * ⛔ THE REMEMBERED HEIGHT IS A DECISION THAT OUTLIVES THE CODE THAT ALLOWED IT.
 *
 * The floor was 80px, which left a sliver with the drawing cropped to nothing — indistinguishable
 * from broken, and REMEMBERED, so it is what a reader comes back to days later. Worse: a collapsed
 * frame offered a 20×18px caret whose tooltip said "Hide the screen" about a screen already hidden,
 * because the label was set on click and never on load.
 *
 * ⛔ Measured: "off", "80" and "20" are all recoverable now — the sliver is forgiven up to the new
 * floor, and the control says which way it goes in CSS, so there is no load-order to get wrong.
 */
test("a frame remembered from a broken build can be recovered", () => {
  const html = page();
  assert.match(html, /Math\.max\(140, parseFloat\(was\)\)/,
    "a sliver remembered from the old 80px floor is restored as a sliver, for good");
  assert.match(html, /Math\.max\(140, Math\.min\(window\.innerHeight - 160/, "the floor still allows an unusable frame");
  /** ⛔ The label is CSS, not JavaScript: it was wrong on every page that LOADED collapsed. */
  assert.match(html, /<span class="when-open">▴ hide the screen<\/span><span class="when-off">▾ show the screen<\/span>/,
    "the control does not say which way it goes");
  assert.match(html, /:root\[data-proto="off"\] \.proto-hide \.when-open \{ display: none; \}/,
    "a collapsed frame still shows the hide label, about a screen that is already hidden");
  assert.ok(!/hide\.title = off \?/.test(html), "the label is set in JavaScript again, so it is wrong on load");
});
