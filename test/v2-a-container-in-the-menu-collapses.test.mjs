/**
 * ⛔ A CONTAINER IN THE SIDE MENU COLLAPSES, AND ONLY ONE IS OPEN AT A TIME.
 *
 * Peter: *"what happened to collapsable menu items? CRE/dealmanagement are not collapsible???"*,
 * *"Let's auto collapse the non-active menu item, so you can only have one expanded leaf at a time,
 * like a 'normal' menu"*, *"'Product' itself doesn't need to be a menu item under the 'Product' main
 * tab"*, and *"menu is hidden below the bottom chat bar, make sure the offset is correct"*.
 *
 * ⛔ THE FIXTURE HAS DEPTH, BECAUSE THE SEED HAS NONE. Its two areas hold no scopes, so on the seed
 * this feature renders zero nested lists and zero twisties — and zero is exactly what shipping
 * nothing renders too. There is no failing state in that observation at all, which is the one kind
 * of check this project treats as no check. So the corpus here is three deep, and the counts
 * asserted below are non-zero.
 *
 * ⛔ AND THE COLLAPSE IS ASSERTED ON COMPUTED STYLE IN A REAL BROWSER. Whether a subtree is hidden
 * is a cascade question — the rule lives behind a width media query and a `data-nav` attribute, and
 * the markup is identical open or shut. A markup assertion passes on a build where nothing collapses.
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
 * The seed, plus a feature inside an area and a sub-feature inside that — so there is a container
 * that is not the root, not an area, and genuinely has something to fold away.
 */
function deepCorpus() {
  const dir = path.join(temp("v2menu-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const base = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");

  /** Built by editing a real scope, so it carries every field the loader requires. */
  const child = base
    .replace(/^id: money$/m, "id: pocket-money")
    .replace(/^title: Money$/m, "title: Pocket money")
    .replace(/^in: family-wallet$/m, "in: money");
  fs.writeFileSync(path.join(dir, "truth", "pocket-money.md"), child);

  const grand = base
    .replace(/^id: money$/m, "id: weekly-top-up")
    .replace(/^title: Money$/m, "title: Weekly top-up")
    .replace(/^in: family-wallet$/m, "in: pocket-money");
  fs.writeFileSync(path.join(dir, "truth", "weekly-top-up.md"), grand);

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the fixture does not load");
  const ids = c.scopes.map((s) => s.scope.id);
  for (const id of ["money", "pocket-money", "weekly-top-up"]) assert.ok(ids.includes(id), `${id} missing`);
  return { dir, corpus: c, rootId: c.scopes.find((s) => !s.scope.in).scope.id };
}

test("⛔ an area holds its own items, and does not name itself among them", () => {
  const { corpus, rootId } = deepCorpus();
  const html = renderScopePage(corpus, rootId, {});

  const group = /<div class="tabgroup" data-group="money">([\s\S]*?)<div class="tabgroup"/.exec(html);
  assert.ok(group, "the area has no group of its own");
  const inside = group[1];

  /** ⛔ Its contents are INSIDE it — the thing a flat sibling list could not express. */
  assert.match(inside, /nav class="scopes inside"/, "the area holds no list of its own");
  assert.match(inside, /data-scope="pocket-money"/, "the feature is not under its area");
  assert.match(inside, /data-scope="weekly-top-up"/, "the sub-feature is not under its feature");

  /**
   * ⛔ AND THE AREA IS NOT A ROW OF ITSELF. The group's head already names it; a row repeating the
   * name is what he was pointing at.
   */
  assert.doesNotMatch(inside, /data-scope="money"/, "the area names itself inside its own menu");

  /** ⛔ Non-zero, because zero here is what a build with no nesting at all also produces. */
  assert.ok((inside.match(/class="holds/g) || []).length >= 1, "no row in the area holds a subtree");
  assert.ok((inside.match(/data-twist-scope=/g) || []).length >= 1, "no row has a collapse control");
});

test("⛔ a leaf gets no collapse control, and the counts are chips", () => {
  const { corpus, rootId } = deepCorpus();
  const html = renderScopePage(corpus, rootId, {});

  /** The deepest scope holds nothing, so it must not offer to expand. */
  const leaf = /<li[^>]*data-scope="weekly-top-up"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  assert.ok(leaf, "the deepest scope is not a row");
  assert.match(leaf[1], /twisty none/, "a leaf is offering a control that would expand nothing");

  /** ⛔ And the words he asked to be replaced are gone, in both directions. */
  assert.doesNotMatch(html, /\d+ unanswered<\/span>/, "the long form of the chip is still rendered");
  assert.doesNotMatch(html, /\d+ to read<\/span>/, "the long form of the chip is still rendered");
  assert.doesNotMatch(html, /states nothing of its own/, "the empty-row sentence is still rendered");
  assert.doesNotMatch(html, /\d+ below<\/span>/, "the subtree total is still rendered");
  /** The short form is there, and carries the full phrase for anything that cannot read a glyph. */
  assert.match(html, /aria-label="\d+ unanswered"/, "the chip does not say what it counts");
  assert.match(html, /<span class="mark" aria-hidden="true">\?<\/span>/, "no question mark chip");
});

test("⛔ the branch you are standing in is open", () => {
  /**
   * Collapsed-by-default plus one-open-at-a-time is a menu that cannot answer "which feature is
   * this" — the question it exists for. Rendering the page FOR the deepest scope must leave its
   * ancestors open.
   */
  const { corpus } = deepCorpus();
  const html = renderScopePage(corpus, "weekly-top-up", {});
  const row = /<li[^>]*data-scope="pocket-money"[^>]*class="([^"]*)"/.exec(html) ||
    /<li[^>]*class="([^"]*)"[^>]*data-scope="pocket-money"/.exec(html);
  assert.ok(row, "the ancestor is not a row at all");
  assert.match(row[1], /\bopen\b/, "the container holding the page you are on is collapsed");
});

test("⛔ in a real browser: a subtree is hidden until its twisty is pressed", { skip }, async () => {
    const { corpus, rootId } = deepCorpus();
    const html = renderScopePage(corpus, rootId, {});
    const page = await openPage(html, { exe, width: 1200, height: 900 });
    try {
    await page.waitFor("!!document.querySelector('.scopes.inside .twisty.sub')", "the menu to nest");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      const row = document.querySelector('li[data-scope="pocket-money"]');
      const sub = row.querySelector(':scope > ul');
      const tw = row.querySelector(':scope > .scoperow > .twisty');
      const shutNow = getComputedStyle(sub).display;
      tw.click();
      const openNow = getComputedStyle(sub).display;
      tw.click();
      return { shutNow, openNow, after: getComputedStyle(sub).display };
    })()`);

    /** ⛔ Three distinguishable outcomes out of one element, so none of them is the default. */
    assert.equal(seen.shutNow, "none", "the subtree is visible before anything was pressed");
    assert.equal(seen.openNow, "block", "pressing the twisty did not open the subtree");
    assert.equal(seen.after, "none", "pressing it again did not shut the subtree");
    } finally {
      await page.close();
    }
  });

test("⛔ in a real browser: opening one container shuts its siblings", { skip }, async () => {
    /**
     * Peter: *"you can only have one expanded leaf at a time, like a 'normal' menu"*. Asserted on
     * two siblings, because a build that simply never opens anything would pass a check that only
     * looked at the one being closed.
     */
    const { corpus, rootId } = deepCorpus();
    /** A second feature beside the first, so there is a sibling to be shut. */
    const html = renderScopePage(corpus, rootId, {});
    const page = await openPage(html, { exe, width: 1200, height: 900 });
    try {
    await page.waitFor("!!document.querySelector('.tabgroup[data-group=\"money\"] .twisty')", "the groups");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      const money = document.querySelector('.tabgroup[data-group="money"]');
      const tasks = document.querySelector('.tabgroup[data-group="tasks"]');
      /*
       * Choosing an area is what opens it, and the tab is the control every group has — the twisty
       * exists only where there is a subtree, so driving this through twisties could not reach an
       * area holding nothing, and the first version of this test clicked one that was not there.
       */
      money.querySelector('.tabhead .tab').click();
      const moneyOpen = !money.classList.contains('shut');
      const tasksWas = !tasks.classList.contains('shut');
      tasks.querySelector('.tabhead .tab').click();
      return {
        moneyOpen, tasksWas,
        moneyAfter: !money.classList.contains('shut'),
        tasksAfter: !tasks.classList.contains('shut'),
      };
    })()`);

    /** ⛔ Three readings, so "one at a time" cannot be satisfied by nothing ever opening. */
    assert.equal(seen.moneyOpen, true, "choosing the first area did not open it");
    assert.equal(seen.tasksAfter, true, "choosing the second area did not open it");
    assert.equal(seen.moneyAfter, false, "both areas are open at once");
    } finally {
      await page.close();
    }
  });

test("⛔ in a real browser: the menu column reserves the composer's height and scrolls", { skip }, async () => {
  /**
   * Peter: *"menu is hidden below the bottom chat bar, make sure the offset is correct"*. The frame
   * is a fixed full-height column and the composer is fixed over the bottom of the window, so the
   * last area sat underneath it — and scrolling did not help, because the column ended where the
   * viewport did and the rows under the bar had nowhere to scroll to.
   *
   * ⛔ THE COMPOSER IS NOT IN A STATIC RENDER — the live script adds it — so this does not assert
   * against an element that is not there. What the fix owns is the column: it scrolls, and it
   * reserves the dock's own measured height rather than a constant. Both are read off the frame.
   *
   * ⛔ AND THE RESERVATION IS READ AT TWO DOCK HEIGHTS, because a single reading cannot tell a
   * variable from a hardcoded number that happens to match it.
   */
  const { corpus, rootId } = deepCorpus();
  const html = renderScopePage(corpus, rootId, {});
  const page = await openPage(html, { exe, width: 1200, height: 320 });
  try {
    await page.waitFor("!!document.querySelector('.topframe')", "the frame");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      const frame = document.querySelector('.topframe');
      const read = () => parseFloat(getComputedStyle(frame).paddingBottom);
      const quiet = read();
      /* The dock grows as replies arrive; the column has to grow with it. */
      document.documentElement.style.setProperty('--bottom-h', '120px');
      const loud = read();
      document.documentElement.style.setProperty('--bottom-h', '0px');
      frame.scrollTop = 10000;
      return {
        quiet, loud,
        scrolls: frame.scrollHeight > frame.clientHeight,
        scrolled: frame.scrollTop > 0,
        overflow: getComputedStyle(frame).overflowY,
      };
    })()`);

    /** A dock is ~4.5rem, so anything under that is the menu running under it again. */
    assert.ok(seen.quiet >= 72, `the column reserves only ${seen.quiet}px for the composer`);
    /** ⛔ The second reading: it tracks the dock rather than guessing once. */
    assert.equal(seen.loud, seen.quiet + 120, "the clearance ignores how tall the composer actually is");
    assert.equal(seen.overflow, "auto", "the column does not scroll, so anything under the bar is lost");
    assert.equal(seen.scrolls, true, "the column has nothing to scroll, so the reserve proves nothing");
    assert.equal(seen.scrolled, true, "the column would not scroll to its own bottom");
  } finally {
    await page.close();
  }
});
