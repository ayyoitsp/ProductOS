/**
 * ⛔ THE BREADCRUMB IS THE PAGE'S, IN BOTH MENU PLACEMENTS.
 *
 * Peter: *"the breadcrumb for the page does not belong in the menu - always at the top of the
 * page"*, then *"breadcrumb on page in both top/side menu modes..... very simpel..."*.
 *
 * It was a child of the frame, which is a sticky header across the top and a fixed 19rem column down
 * the side. So one piece of markup read as "the top of the page" in one placement and "a row inside
 * the menu" in the other — and a breadcrumb says where the page you are reading is filed, which is
 * the page's business in both.
 *
 * ⛔ MEASURED AS GEOMETRY IN A REAL BROWSER, IN BOTH MODES, because that is the entire claim. Whether
 * the trail is inside the menu is not visible in the markup — the element is the same element either
 * way; what differs is where the cascade puts it. The side rules live behind `@media (min-width:
 * 62rem)` and a `data-nav` attribute, so a narrow window measures the top placement and reports the
 * side one as fine.
 *
 * ⛔ AND THE TWO READINGS ARE THE TEST. "It is at the top of the page" asserted in one mode passes on
 * a build where the other mode is wrong — which is the shape of the bug being fixed here, one
 * element behaving differently in two placements.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/**
 * A page for a scope two levels down, so the trail has something to say.
 *
 * ⛔ THE SEED IS ONE LEVEL DEEP AND THAT IS NOT ENOUGH. Its areas sit directly under the root, and
 * the root is deliberately not a crumb — it is the Overview tab — so the trail for an area is just
 * its own name, and the page HIDES the row when there is nothing above you. The first version of
 * this test rendered an area and measured a `hidden` element: width 0, every geometry assertion
 * failing with nothing wrong with the code.
 *
 * ⛔ And that is the right behaviour to leave alone. A breadcrumb with one crumb is furniture.
 */
function pageHtml() {
  const dir = path.join(temp("v2crumb-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const base = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");
  fs.writeFileSync(
    path.join(dir, "truth", "pocket-money.md"),
    base
      .replace(/^id: money$/m, "id: pocket-money")
      .replace(/^title: Money$/m, "title: Pocket money")
      .replace(/^in: family-wallet$/m, "in: money")
  );
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the fixture does not load");
  /**
   * ⛔ THE ROOT'S PAGE, not the nested scope's — and that is about what the rows can DO. A page only
   * links the scopes it actually contains; on a page rendered FOR one feature, every other row is an
   * unlinked span, so there is nothing to press and nothing switches view. The probe clicked rows
   * that were spans and reported the trail as broken.
   */
  const html = renderScopePage(c, c.scopes.find((e) => !e.scope.in).scope.id, { interactive: true, by: "peter" }) ?? "";
  assert.match(html, /data-scope="pocket-money"/, "the fixture's nested feature is not in the menu");
  return html;
}

test("⛔ the trail is not inside the menu frame", () => {
  /**
   * The structural half, and the cheap one: it is a sibling of the frame rather than a descendant.
   * On its own this proves nothing about where it LANDS, which is why the browser checks below exist
   * — but it is the thing that makes both placements come out right without either being asked about.
   */
  const html = pageHtml();
  const frame = /<div class="topframe"[\s\S]*?<\/div>\s*<div class="crumbs">/.test(html);
  assert.ok(frame, "the crumbs are not emitted after the frame closes");
  const inside = /<div class="topframe"(?:(?!<\/div>)[\s\S])*?class="crumbs"/.test(html);
  assert.equal(inside, false, "the crumbs are still inside the menu frame");
});

/** Reads where the trail sits relative to the menu and the page, in one placement. */
async function placedAs(nav) {
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('.crumbs') && !!document.querySelector('.topframe')", "the trail");
    return await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', ${JSON.stringify(nav)});
      /*
       * ⛔ GO TO A FEATURE FIRST. The trail is hidden on Overview, which has nothing above it — so a
       * probe that measured the page as it loads measured a hidden box: width 0, every geometry
       * assertion failing with nothing wrong with the code. Twice, before I read why.
       *
       * ⛔ AND IT IS THE ROW THAT IS PRESSED, NOT THE TAB. Choosing an area selects a SECTION; the
       * trail says where a VIEW is filed, and it is the view switch that paints it. A tab click left
       * it hidden, which read as the move not working.
       */
      const go = document.querySelector('nav.scopes li[data-scope="pocket-money"] a[data-goto]');
      if (!go) return { bailed: 'the fixture has no row to navigate to' };
      go.click();
      const crumbs = document.querySelector('.crumbs');
      if (crumbs.hidden) return { bailed: 'the trail is hidden even with a section chosen' };
      const frame = document.querySelector('.topframe');
      const c = crumbs.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      return {
        /** ⛔ Not a descendant, and not laid out inside the menu's box either. */
        insideFrame: frame.contains(crumbs),
        overlapsFrame: !(c.left >= f.right || c.right <= f.left || c.top >= f.bottom || c.bottom <= f.top),
        width: Math.round(c.width),
        frameRight: Math.round(f.right),
        left: Math.round(c.left),
        top: Math.round(c.top),
        viewport: window.innerWidth,
        trailShown: getComputedStyle(document.querySelector('.trail')).display,
      };
    })()`);
  } finally {
    await page.close();
  }
}

test("⛔ in a real browser: across the top, the trail is at the top of the page", { skip }, async () => {
  const seen = await placedAs("top");
  assert.equal(seen.bailed, undefined, seen.bailed);
  assert.equal(seen.insideFrame, false, "the trail is a descendant of the menu");
  assert.notEqual(seen.trailShown, "none", "the trail is not rendered");
  /** Full width of the page, starting at its left edge. */
  assert.ok(seen.left < 40, `the trail starts ${seen.left}px in, as though something were beside it`);
  assert.ok(seen.width > seen.viewport * 0.8, `the trail is only ${seen.width}px of a ${seen.viewport}px page`);
});

test("⛔ in a real browser: down the side, the trail is still the page's", { skip }, async () => {
  /**
   * The reading that was wrong before this change: the frame is a fixed 19rem column, so a trail
   * inside it was 19rem wide and started at the left edge of the screen — in the menu, not on the
   * page.
   */
  const seen = await placedAs("left");
  assert.equal(seen.bailed, undefined, seen.bailed);
  assert.equal(seen.insideFrame, false, "the trail is a descendant of the menu");
  assert.equal(seen.overlapsFrame, false, "the trail is laid out on top of the menu column");
  /** ⛔ It begins where the column ends, which is what "on the page" means in this placement. */
  assert.ok(
    seen.left >= seen.frameRight,
    `the trail starts at ${seen.left}px but the menu column ends at ${seen.frameRight}px`
  );
  assert.ok(seen.width > 400, `the trail is ${seen.width}px wide, which is a column and not a page`);
});
