/**
 * ⛔ THE MENU MOVES; NOTHING ELSE DOES.
 *
 * Peter: "I'd like to update product OS rendering to have a toggle button for a left menu or a top
 * menu.  right now it's always top"
 *
 * The cheap way to answer that is a second frame — one markup for the top, another for the side —
 * and it is wrong the day after it is written, because every row, count and link added to the menu
 * afterwards lands in whichever one the author had open. A reader who moves the menu would then
 * lose a way in that only one placement ever knew about, and nothing would report it.
 *
 * So there is ONE frame, and the placement is an attribute on the root that only the stylesheet
 * reads. That is the property pinned here, along with the three ways it has to not flicker, not
 * forget, and not strand the reader:
 *
 *   - the placement is decided BEFORE the frame paints, or every load draws it in the wrong place
 *     first and throws it across a frame later
 *   - the side placement takes the chevron away, so the script must refuse to collapse the tree
 *     there — a collapsed side menu is a column holding one breadcrumb with no way back
 *   - the choice is remembered, because it is a reading posture and being asked again on every
 *     feature is the same as not being asked
 *
 * ⛔ WHAT THIS CANNOT SEE: it reads the emitted page as text. No browser runs here, so it can tell
 * you the rule and the guard were shipped and not that they took effect — the layout itself was
 * verified by driving the page. Anything this file asserts about behaviour is asserting that the
 * mechanism is present, which is the most a string can be asked.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

const corpus = loadCorpus("v2-seed");
const ROOT = corpus.scopes.find((s) => !s.scope.in).scope.id;
const html = renderScopePage(corpus, ROOT, { interactive: true });
const count = (re) => (html.match(re) ?? []).length;

test("one control moves the menu, and it names where the menu is going", () => {
  assert.equal(count(/class="navplace"/g), 1, "there should be exactly one placement control");
  // ⛔ Both labels rendered, one picked by the stylesheet — so the button reads correctly on the
  // first paint rather than after a script has caught up with it.
  assert.match(html, /class="to-left"[^<]*>[^<]*Side menu/);
  assert.match(html, /class="to-top"[^<]*>[^<]*Top menu/);
});

test("the placement is decided before the frame it governs is emitted", () => {
  const decided = html.indexOf('documentElement.dataset.nav');
  const frame = html.indexOf('<div class="topframe"');
  assert.ok(decided > -1, "nothing sets the placement");
  assert.ok(frame > -1, "no frame on the page");
  assert.ok(
    decided < frame,
    "the placement is applied after the frame is emitted — every load paints the menu in the " +
      "wrong place and moves it a frame later"
  );
});

test("one frame serves both placements — there is no second menu to drift", () => {
  assert.equal(count(/<div class="tabs">/g), 1, "more than one tab row");
  /**
   * ⛔ ONE LIST PER GROUP NOW, NOT ONE FOR THE PAGE — and the property this was protecting still
   * holds, stated as what it actually means.
   *
   * The worry was a second MENU that could drift from the first. Each tab group carrying its own
   * items is not that: the lists hold different scopes and are built by one function. So what gets
   * asserted is that no scope appears in two of them, which is the drift, rather than counting
   * elements, which never was.
   */
  const lists = html.match(/<nav class="scopes">[\s\S]*?<\/nav>/g) ?? [];
  assert.ok(lists.length >= 1, "no menu list at all");
  const rows = lists.flatMap((l) => [...l.matchAll(/data-scope="([^"]+)"/g)].map((m) => m[1]));
  const twice = rows.filter((r, i) => rows.indexOf(r) !== i);
  assert.deepEqual(twice, [], `these scopes are in more than one list: ${twice.join(", ")}`);
  assert.equal(count(/<div class="crumbs">/g), 1, "more than one breadcrumb row");
  // The placement is never a rendering branch: it exists in the stylesheet and the script only.
  const frameMarkup = html.slice(html.indexOf('<div class="topframe"'), html.indexOf("<main>"));
  assert.ok(
    !/data-nav/.test(frameMarkup),
    "the frame's markup branches on the placement — that is a second menu in disguise"
  );
});

test("the stylesheet answers for the side placement, and the top one is the default", () => {
  assert.match(html, /:root\[data-nav="left"\] body \{[^}]*padding-left/);
  assert.match(html, /:root\[data-nav="left"\] \.topframe \{[^}]*position: fixed/);
  // ⛔ The chevron is a top-menu economy. A column has the height, so the tree stays open and the
  // control that would close it goes away.
  //
  // ⛔ NOT SCOPED TO THE FRAME ANY MORE. The chevron sits on the breadcrumb line, and that line left
  // the frame when Peter said *"breadcrumb on page in both top/side menu modes"* — so a selector
  // naming `.topframe .chev` describes a nesting that no longer exists.
  /** ⛔ The chevron is gone entirely — a group holds its own items, so there is nothing to expand. */
  assert.doesNotMatch(html, /class="chev"/, "the chevron is back, and it now expands nothing");
  // Below the breakpoint the menu is at the top whatever was remembered, so the offer goes away.
  assert.match(html, /@media \(max-width: [\d.]+rem\) \{ \.navplace \{ display: none/);
});

test("a tree whose chevron the stylesheet removed is never collapsed", () => {
  // The breakpoint lives once, in the stylesheet; the script reads the consequence rather than
  // carrying a second copy of the number that would drift away from it.
  //
  // ⛔ THE CONSEQUENCE IT READS IS THE FRAME'S POSITION NOW, not the chevron's display. Asking the
  // chevron meant excluding the case where its hidden ATTRIBUTE is set, and that exclusion closed
  // the column on Overview and on How it works — 19rem of breadcrumb with no way back to the tree,
  // which is the exact failure named below. Down the side the tree IS the menu, so it never closes.
  //
  // ⛔ AND THIS IS A SOURCE GREP, WHICH IS A WEAK CHECK BY CONSTRUCTION — it would pass on a script
  // that carries this line and never runs it. The real one is in
  // `v2-one-address-one-page`, which drives all four fixed tabs in a browser and reads whether the
  // tree has a box. This stays as the cheap guard that the rule has not been deleted outright.
  assert.match(
    html,
    /getComputedStyle\(frame\)\.position === "fixed"/,
    "nothing keeps the side menu open, so a view switch can leave a column with no way back to the tree"
  );
  assert.match(html, /if \(sideways \|\|/, "the side placement is no longer what forces the tree open");
});

test("the placement is remembered, not re-asked on every feature", () => {
  assert.match(html, /localStorage\.getItem\("productos:nav"\)/, "nothing reads the choice back");
  assert.match(html, /localStorage\.setItem\("productos:nav", now\)/, "nothing records the choice");
});
