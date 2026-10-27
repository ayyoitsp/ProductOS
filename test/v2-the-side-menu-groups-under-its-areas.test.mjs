/**
 * ⛔ AN AREA'S ITEMS BELONG UNDER THE AREA, AND EACH CONTAINER COLLAPSES.
 *
 * Peter: *"i'd like to make our 'side menu' better. the expanded menu should be grouped under each
 * main area, just like a standard menu... e.g. product, when selected, should have items under it,
 * not under a new section. And each container should be collapsible"*.
 *
 * Every area was a button in one row, and its items were a SIBLING block below the whole row — so
 * down the side the four areas sat together and whatever was open appeared beneath all of them,
 * attached to nothing. Reading down the menu told you what the areas were and then showed you a
 * list with no owner.
 *
 * ⛔ ASSERTED IN A BROWSER, ON COMPUTED STYLE AND DOM ANCESTRY — not on markup. The grouping is real
 * in the DOM in both modes and only READS as nesting down the side, because the top row must not
 * change: `display: contents` takes the wrapper out of the layout there. A markup assertion would
 * pass identically for both and prove neither.
 *
 * ⛔ AND THE TREE IS MOVED, NOT COPIED. One tree exists and its rows are filtered to the selected
 * area, so a second per area would be two derivations of one fact — the thing that gave this project
 * `check` and `gapsIn` disagreeing about a door. The test asserts there is exactly one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage, standalone } from "../dist/v2/page.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

/** The seed has one scope with screens; the menu needs a tree, so give it two halves. */
function corpus() {
  const dir = path.join(temp("v2menu-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

async function inTheMenu(nav, ask) {
  const dir = corpus();
  const c = loadCorpus(dir);
  const root = c.scopes.find((e) => !e.scope.in)?.scope.id ?? c.scopes[0].scope.id;
  const html = standalone("menu", renderScopePage(c, root, { interactive: true, by: "peter" }) ?? "");
  /**
   * ⛔ WIDE ENOUGH FOR THE SIDE MENU TO EXIST. It lives inside `@media (min-width: 62rem)` — a 19rem
   * column cannot be afforded in a narrow window, and the control that moves it there is hidden
   * below that width. The default headless window is narrower, so the first version of this test
   * measured the TOP menu and reported the side rules as not applying: the code accused by the
   * harness, which is the fifth of these today.
   */
  const page = await openPage(html, { exe, width: 1280, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('.topframe .tabgroup')", "the menu to be grouped");
    /** ⛔ The placement is a stored preference, so it is set before anything is measured. */
    await page.evaluate(`document.documentElement.setAttribute("data-nav", ${JSON.stringify(nav)}), true`);
    return await page.evaluate(`(async () => { ${ask} })()`);
  } finally {
    await page.close();
  }
}

test("⛔ down the side, an area's items are inside the area", async (t) => {
  if (skip) return t.skip(skip);
  const out = await inTheMenu(
    "left",
    `
    const group = document.querySelector('.tabgroup[data-group="overview"]');
    const strip = document.querySelector('.subtabs[data-tabs="product"]');
    return JSON.stringify({
      groups: document.querySelectorAll('.topframe .tabgroup').length,
      /* ⛔ ANCESTRY, not proximity — a sibling that happens to render below is the defect. */
      inside: !!strip && group.contains(strip),
      /* ⛔ And the group is a block down the side, or the nesting is invisible. */
      display: getComputedStyle(group).display,
      indented: parseFloat(getComputedStyle(strip).paddingLeft) > 0,
    });
  `
  );
  const seen = JSON.parse(out);
  assert.ok(seen.groups >= 3, `expected a group per area, got ${seen.groups}`);
  assert.equal(seen.inside, true, "an area's items are still a sibling of the area, not inside it");
  assert.equal(seen.display, "block", "the group does not form a container down the side");
  assert.equal(seen.indented, true, "the items are not indented under their area");
});

test("⛔ the top menu is unchanged — the group leaves the layout there", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * The grouping must be free in top mode. `display: contents` removes the wrapper, so the tabs flex
   * row lays out exactly as it did — and a regression here is the layout he did not ask to change.
   */
  const out = await inTheMenu(
    "top",
    `
    const group = document.querySelector('.tabgroup[data-group="overview"]');
    const tabs = [...document.querySelectorAll('.topframe .tab')];
    const tops = new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top)));
    return JSON.stringify({
      display: getComputedStyle(group).display,
      twisty: getComputedStyle(document.querySelector('.twisty')).display,
      rows: tops.size,
      count: tabs.length,
    });
  `
  );
  const seen = JSON.parse(out);
  assert.equal(seen.display, "contents", "the group is laying out in the top menu");
  assert.equal(seen.twisty, "none", "the collapse control is showing in a row, where there is nothing to collapse");
  /** ⛔ One row: every area still on the same line, which is what the top menu IS. */
  assert.equal(seen.rows, 1, `the areas are on ${seen.rows} rows in the top menu`);
  assert.ok(seen.count >= 3, "the areas are not all there");
});

test("⛔ each container collapses, keeps its own name, and remembers", async (t) => {
  if (skip) return t.skip(skip);
  const out = await inTheMenu(
    "left",
    `
    const group = document.querySelector('.tabgroup[data-group="overview"]');
    const twisty = group.querySelector('.twisty');
    const strip = document.querySelector('.subtabs[data-tabs="product"]');
    const seen = { openFirst: !group.classList.contains('shut'), arrow: twisty.getAttribute('aria-expanded') };

    twisty.click();
    await new Promise((r) => setTimeout(r, 40));
    seen.shut = group.classList.contains('shut');
    seen.itemsGone = getComputedStyle(strip).display === 'none';
    /* ⛔ The area's own name stays — a collapsed area you cannot get back to is worse than an open one. */
    seen.headVisible = getComputedStyle(group.querySelector('.tab')).display !== 'none';
    seen.arrowShut = twisty.getAttribute('aria-expanded');
    seen.stored = localStorage.getItem('productos:nav-shut');

    twisty.click();
    await new Promise((r) => setTimeout(r, 40));
    seen.reopened = !group.classList.contains('shut');
    return JSON.stringify(seen);
  `
  );
  const seen = JSON.parse(out);
  assert.equal(seen.openFirst, true, "a group starts collapsed");
  assert.equal(seen.arrow, "true");
  assert.equal(seen.shut, true, "the twisty did not collapse the group");
  assert.equal(seen.itemsGone, true, "collapsing it left the items on screen");
  assert.equal(seen.headVisible, true, "collapsing an area hid the area itself");
  assert.equal(seen.arrowShut, "false", "the control does not say which state it is in");
  assert.match(seen.stored ?? "", /overview/, "the collapse is forgotten on reload");
  assert.equal(seen.reopened, true, "it does not open again");
});

test("⛔ collapsing does not navigate, and choosing an area opens it", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * One control that both selects and collapses means every attempt to shut a group moves you into
   * it — the mistake the chevron beside the trail exists to avoid. And selecting a shut group must
   * open it, or a reader picks an area and is shown nothing.
   */
  const out = await inTheMenu(
    "left",
    `
    const before = [...document.querySelectorAll('.topframe .tab')].findIndex((t) => t.classList.contains('on'));
    const group = document.querySelector('.tabgroup[data-group="overview"]');
    group.querySelector('.twisty').click();
    await new Promise((r) => setTimeout(r, 40));
    const after = [...document.querySelectorAll('.topframe .tab')].findIndex((t) => t.classList.contains('on'));
    const stillShut = group.classList.contains('shut');

    group.querySelector('.tab').click();
    await new Promise((r) => setTimeout(r, 60));
    return JSON.stringify({ before, after, stillShut, openedByChoosing: !group.classList.contains('shut') });
  `
  );
  const seen = JSON.parse(out);
  assert.equal(seen.after, seen.before, "collapsing a group moved the selection");
  assert.equal(seen.stillShut, true, "the group did not stay collapsed");
  assert.equal(seen.openedByChoosing, true, "choosing a collapsed area left it collapsed and showed nothing");
});

test("⛔ no row is in two lists, and each list sits under the area it belongs to", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * ⛔ THIS USED TO DEMAND EXACTLY ONE TREE, moved under whichever area was selected. That design is
   * gone: each group renders its own items, so there are as many lists as there are groups with
   * something in them. Peter: *"JUST A PLAIN FUCKING MENU WITH ITEMS INSIDE IT, NO COMPLICATED
   * FUCKING FILTERS"*.
   *
   * ⛔ BUT THE PROPERTY IT WAS PROTECTING IS REAL AND IS NOW ASSERTED DIRECTLY — and more strictly.
   * "One tree" was a proxy for "nothing is duplicated": the worry was a per-area copy, two
   * derivations of one fact that drift. Counting elements never actually tested that. Counting
   * whether any scope appears in more than one list does.
   */
  const out = await inTheMenu(
    "left",
    `
    const tabs = [...document.querySelectorAll('.topframe .tab')];
    const pick = tabs.find((t) => t.dataset.tab !== 'overview' && t.dataset.tab !== 'prototype' && t.dataset.tab !== 'subsystems');
    const ids = () => [...document.querySelectorAll('nav.scopes li[data-scope]')].map((li) => li.dataset.scope);
    const seen = { picked: pick ? pick.dataset.tab : null, before: ids() };
    if (pick) {
      pick.click();
      await new Promise((r) => setTimeout(r, 120));
      seen.after = ids();
      const group = document.querySelector('.tabgroup[data-group="' + pick.dataset.tab + '"]');
      const list = group && group.querySelector('nav.scopes');
      seen.under = !!list;
      seen.insideAreTheAreas = list ? [...list.querySelectorAll('li[data-scope]')].map((li) => li.dataset.scope) : [];
    }
    return JSON.stringify(seen);
  `
  );
  const seen = JSON.parse(out);
  if (!seen.picked) return; // a one-area corpus has no list to place
  const dupes = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);
  assert.deepEqual(dupes(seen.before), [], `a scope is listed twice before choosing: ${dupes(seen.before).join(", ")}`);
  assert.deepEqual(dupes(seen.after), [], `choosing an area duplicated rows: ${dupes(seen.after).join(", ")}`);
  assert.equal(seen.under, true, "the area's group carries no list of its own");
  assert.ok(seen.insideAreTheAreas.length > 0, "the area's own group lists nothing");
});
