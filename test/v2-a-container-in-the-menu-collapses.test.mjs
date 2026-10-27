/**
 * ⛔ A CONTAINER IN THE SIDE MENU FOLDS; THE TOP MENU IS TABS AND A TREE.
 *
 * Peter, over one sitting: *"what happened to collapsable menu items? CRE/dealmanagement are not
 * collapsible???"*, *"get rid of 'XXX below'"*, *"shorten '5 unanswered' '5 {? icon}'"*, *"make them
 * chips next to the menu item name"*, *"Let's auto collapse the non-active menu item, so you can
 * only have one expanded leaf at a time, like a 'normal' menu"*, *"'Product' itself doesn't need to
 * be a menu item under the 'Product' main tab"*, *"menu is hidden below the bottom chat bar"*,
 * *"'states nothing of its own' should be removed"*, *"there's an extra chevron now... once you click
 * an item, its sub menu should automatically show if it has one"*, and then *"you completely broke
 * support for the top menu..... 🤦"* with *"tabs instead of collapsible rows"*.
 *
 * ⛔ THERE IS ONE TREE, AND THE SCRIPT MOVES IT UNDER THE SELECTED AREA. I did not read that before
 * rendering a second subtree inside every group, and the duplicate is what broke the top menu: two
 * sets of rows for one corpus, the new ones carrying a collapse rule that turned the chevron's tree
 * into four unexpandable names. The mechanism's own comment had already said why not.
 *
 * ⛔ SO THE ASSERTIONS HERE ARE ABOUT WHAT IS REACHABLE, IN BOTH PLACEMENTS. Whether a feature can be
 * got to is the only question a menu answers, and it is a cascade question: the side rules sit behind
 * `@media (min-width: 62rem)` and a `data-nav` attribute, and the markup is identical either way.
 *
 * ⛔ AND THE FIXTURE HAS DEPTH, BECAUSE THE SEED HAS NONE. Its two areas hold no scopes, so on the
 * seed every one of these renders nothing to fold — which is what a build with no nesting renders
 * too. The existing top-menu test measures the seed, and that is precisely why it stayed green
 * through the regression he reported.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { parseFrontmatter } = await import("../dist/core/frontmatter.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/**
 * The seed, plus a feature inside an area, a sub-feature inside that, and one scope that states
 * nothing at all.
 *
 * ⛔ BUILT BY TRIMMING REAL SCOPES rather than hand-writing frontmatter: a scope needs `in`, `exists`
 * and `happy_path` to parse, and typing a minimal one by hand is how a test ends up asserting against
 * something the loader quietly rejected.
 */
function deepCorpus() {
  const dir = path.join(temp("v2menu-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const base = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");

  const clone = (id, title, parent) =>
    base
      .replace(/^id: money$/m, `id: ${id}`)
      .replace(/^title: Money$/m, `title: ${title}`)
      .replace(/^in: family-wallet$/m, `in: ${parent}`);
  fs.writeFileSync(path.join(dir, "truth", "pocket-money.md"), clone("pocket-money", "Pocket money", "money"));
  fs.writeFileSync(path.join(dir, "truth", "weekly-top-up.md"), clone("weekly-top-up", "Weekly top-up", "pocket-money"));

  /**
   * ⛔ ONE SCOPE THAT STATES NOTHING, or the assertion about the chipless row is vacuous. Every scope
   * cloned from a real one carries its behaviours, so every row had chips — and "the chipless row's
   * sentence is absent" was therefore true of a build that still rendered it. Putting the sentence
   * back did not fail the test, which is how that was caught.
   */
  const front = parseFrontmatter(base).data;
  fs.writeFileSync(
    path.join(dir, "truth", "quiet-corner.md"),
    `---\n${YAML.stringify({
      id: "quiet-corner",
      title: "Quiet corner",
      in: "money",
      exists: front.exists,
      happy_path: front.happy_path,
    })}---\n`
  );

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the fixture does not load");
  const ids = c.scopes.map((e) => e.scope.id);
  for (const id of ["money", "pocket-money", "weekly-top-up", "quiet-corner"])
    assert.ok(ids.includes(id), `${id} missing from the fixture`);
  return { dir, corpus: c, rootId: c.scopes.find((e) => !e.scope.in).scope.id };
}

/** The menu's markup, with the scripts and styles taken out — see below for why that matters. */
const menuOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

/** A page with its live script, which is what moves the tree and filters the rows. */
const live = (corpus, at) => renderScopePage(corpus, at, { interactive: true, by: "peter" }) ?? "";

test("⛔ the rows nest, so a container has something that can be folded", () => {
  const { corpus, rootId } = deepCorpus();
  const menu = menuOf(renderScopePage(corpus, rootId, {}));

  /**
   * ⛔ THE STRUCTURE IS THE FEATURE. An indent is not a container: the previous menu was one flat
   * list positioned by a custom property, so no element held a group's items and therefore nothing
   * could be hidden. This asserts the containment, not the indent.
   */
  const row = /<li[^>]*data-scope="pocket-money"[^>]*>([\s\S]*?)<\/li>/.exec(menu);
  assert.ok(row, "the feature is not a row at all");
  assert.match(row[1], /<ul>/, "a container's row holds no list of its own");
  assert.match(row[1], /data-scope="weekly-top-up"/, "the sub-feature is not inside its parent's row");

  /**
   * ⛔ ONE LIST PER GROUP NOW — and what "one tree" was guarding is asserted as itself.
   *
   * The second tree that broke the top menu was a COPY: the same scopes rendered twice, two
   * derivations of one fact. Groups holding their own items are not that, so the check is that no
   * scope is in two lists, which is the defect, rather than the element count, which was a proxy.
   */
  const rows = [...menu.matchAll(/data-scope="([^"]+)"/g)].map((m) => m[1]);
  const twice = rows.filter((r, i) => rows.indexOf(r) !== i);
  assert.deepEqual(twice, [], `these scopes are listed more than once: ${twice.join(", ")}`);
});

test("⛔ no row carries a control of its own", () => {
  /**
   * Peter: *"there's an extra chevron now... we don't need the chevron next to 'attachment routing',
   * for example"*. A row is already a link to the thing it names; a second control beside it is two
   * for one intention.
   */
  const { corpus, rootId } = deepCorpus();
  const menu = menuOf(renderScopePage(corpus, rootId, {}));
  assert.doesNotMatch(menu, /data-twist-scope=/, "the rows still carry chevrons");
  assert.doesNotMatch(menu, /twisty none/, "the rows still reserve space for a control that is gone");
});

test("⛔ the counts are chips, and the wording he replaced is gone", () => {
  const { corpus, rootId } = deepCorpus();
  const menu = menuOf(renderScopePage(corpus, rootId, {}));

  /**
   * ⛔ THE SCRIPTS ARE STRIPPED FIRST, and that is not tidiness. These assertions first ran against
   * the whole document and failed on a COMMENT inside the live script — one quoting him using the
   * very phrase being removed, about a different surface, months earlier. A comment ships to the
   * browser inside a script tag, so searching a document for a sentence is not asking whether a
   * reader sees it.
   */
  const quiet = /<li[^>]*data-scope="quiet-corner"[^>]*>[\s\S]*?<\/li>/.exec(menu);
  assert.ok(quiet, "the fixture's silent scope is not in the menu");
  assert.doesNotMatch(quiet[0], /class="n /, "the row this is about has chips, so it is the wrong row");
  assert.doesNotMatch(quiet[0], /states nothing of its own/, "the empty-row sentence is still rendered");

  assert.doesNotMatch(menu, /\d+ unanswered<\/span>/, "the long form of the chip is still rendered");
  assert.doesNotMatch(menu, /\d+ to read<\/span>/, "the long form of the chip is still rendered");
  assert.doesNotMatch(menu, /\d+ below<\/span>/, "the subtree total is still rendered");

  /** The short form, carrying the full phrase for anything that cannot read a glyph. */
  assert.match(menu, /aria-label="\d+ unanswered"/, "the chip does not say what it counts");
  assert.match(menu, /<span class="mark" aria-hidden="true">\?<\/span>/, "no question-mark chip");
});

test("⛔ the branch you are standing in is open", () => {
  /**
   * Collapsed-by-default plus one-open-at-a-time is a menu that cannot answer "which feature is
   * this" — the question it exists for.
   */
  const { corpus } = deepCorpus();
  const menu = menuOf(renderScopePage(corpus, "weekly-top-up", {}));
  const row =
    /<li[^>]*data-scope="pocket-money"[^>]*class="([^"]*)"/.exec(menu) ||
    /<li[^>]*class="([^"]*)"[^>]*data-scope="pocket-money"/.exec(menu);
  assert.ok(row, "the ancestor is not a row at all");
  assert.match(row[1], /\bopen\b/, "the container holding the page you are on is collapsed");
});

test("⛔ in a real browser: the top menu can still reach every feature", { skip }, async () => {
  /**
   * ⛔ THIS IS THE TEST THAT DID NOT EXIST, AND ITS ABSENCE SHIPPED A BROKEN TOP MENU.
   *
   * Across the top the groups collapse to a row and hold nothing, so the tree behind the chevron is
   * the ONLY way to reach a feature. Rows collapsed by default folded every feature away, and with
   * the row chevrons gone nothing could open them.
   *
   * ⛔ WHAT IT MEASURES IS REACHABILITY. Two earlier attempts asserted the wrong observable: that the
   * tabs sat on one row — true on the broken build, because the row does not wrap — and that the area
   * subtrees were hidden, which a probe showed they already were. Both passed on the break.
   */
  const { corpus, rootId } = deepCorpus();
  const page = await openPage(live(corpus, rootId), { exe, width: 1200, height: 900 });
  try {
    /**
     * ⛔ NO CHEVRON ANY MORE. It expanded one shared tree; each group carries its own items and
     * pressing the tab shows them, so a chevron would expand nothing. Peter: *"JUST A PLAIN FUCKING
     * MENU WITH ITEMS INSIDE IT"*. What is driven here is what a person does: press the tab.
     */
    await page.waitFor("!!document.querySelector('.topframe .tab')", "the tab row");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'top');
      /* The chevron is hidden on Overview, which has no features of its own — choose an area first. */
      document.querySelector('.tabgroup[data-group="money"] .tab').click();
      const tree = document.querySelector('.tabgroup[data-group="money"] nav.scopes');
      const reachable = [...tree.querySelectorAll('li')]
        .filter((r) => r.getBoundingClientRect().height > 0)
        .map((r) => r.dataset.scope);
      const tabs = [...document.querySelectorAll('.tabhead .tab')];
      return {
        treeShown: getComputedStyle(tree).display,
        reachable,
        deepest: reachable.includes('weekly-top-up'),
        tabs: tabs.length,
        tabRows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size,
      };
    })()`);

    assert.notEqual(seen.treeShown, "none", "pressing the tab does not show that group's items");
    /** ⛔ The scope three levels down — the one a folded tree hides. */
    assert.equal(
      seen.deepest,
      true,
      `the top menu cannot reach a nested feature; it offers ${seen.reachable.join(", ") || "nothing"}`
    );
    /** And the tabs are still tabs, on one row. */
    assert.ok(seen.tabs >= 3, `expected a tab per area, got ${seen.tabs}`);
    assert.equal(seen.tabRows, 1, `the areas are spread over ${seen.tabRows} rows in the top menu`);
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: down the side a container folds, and choosing it opens it", { skip }, async () => {
  /**
   * ⛔ BOTH HALVES. "It folds" alone is satisfied by a menu that never opens, which is strictly worse
   * than the extra chevron he was complaining about; "it opens" alone is satisfied by one that never
   * folds, which is what he reported in the first place.
   */
  const { corpus, rootId } = deepCorpus();
  const page = await openPage(live(corpus, rootId), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('li[data-scope=\"pocket-money\"]')", "the feature's row");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      document.querySelector('.tabgroup[data-group="money"] .tab').click();
      const row = document.querySelector('li[data-scope="pocket-money"]');
      const sub = row.querySelector(':scope > ul');
      row.classList.remove('open');
      const folded = getComputedStyle(sub).display;
      row.querySelector(':scope > .scoperow > a').click();
      return {
        folded,
        opened: getComputedStyle(sub).display,
        chevrons: document.querySelectorAll('nav.scopes .twisty').length,
        went: location.hash,
      };
    })()`);

    assert.equal(seen.folded, "none", "a container is open before anything was chosen");
    assert.equal(seen.opened, "block", "choosing an item did not open what is in it");
    assert.equal(seen.chevrons, 0, `the menu still draws ${seen.chevrons} row chevrons`);
    /** ⛔ The link still navigates — the handler must not have swallowed it. */
    assert.match(seen.went, /pocket-money/, "the row stopped navigating when it gained a handler");
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: an area does not list itself, and keeps its items", { skip }, async () => {
  /**
   * Peter: *"'Product' itself doesn't need to be a menu item under the 'Product' main tab"*.
   *
   * ⛔ STILL TRUE, BY A DIFFERENT MECHANISM, and the test had to follow it. It used to assert the
   * area's own row measured zero height — the row existed and was hidden. A root child is now a TAB
   * and its group lists its CHILDREN, so there is no row for it to hide: the thing it names is the
   * tab you pressed to get here.
   *
   * ⛔ BOTH HALVES, because the first alone is satisfied by an empty menu — which is exactly what
   * shipped when a childless area's group rendered nothing at all.
   */
  const { corpus, rootId } = deepCorpus();
  /**
   * ⛔ NO BASE HERE, AND THAT IS DELIBERATE. With a base an area's tab is an ANCHOR, so clicking it
   * in a file-rendered page navigates away — the page claims `/v2` as its base while living at a
   * `file://` path, so the in-page handler declines it and the browser obeys the href. Driving a
   * navigation is not what this test is about.
   *
   * With no base the tab is a button, which is also the correct shape: `address()` returns a
   * fragment and a standalone file renders one scope, so an anchor would point at something the
   * page does not contain. That the tab carries an address where there IS one is asserted in
   * `v2-one-address-one-page`, on a page that is actually served.
   */
  const page = await openPage(live(corpus, rootId), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('.tabgroup[data-group=\"money\"] .tab')", "the area's tab");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      document.querySelector('.tabgroup[data-group="money"] .tab').click();
      const vis = (e) => !!e && e.getBoundingClientRect().height > 0;
      const group = document.querySelector('.tabgroup[data-group="money"]');
      return {
        listsItself: !!group.querySelector('li[data-scope="money"]'),
        child: vis(document.querySelector('li[data-scope="pocket-money"] > .scoperow')),
        /** ⛔ And the tab is still the thing that names it — see the note above on the address. */
        hasTab: !!group.querySelector('.tab[data-tab="money"]'),
      };
    })()`);

    assert.equal(seen.listsItself, false, "the area still names itself inside its own menu");
    assert.equal(seen.child, true, "the area's group lists none of its features");
    assert.equal(seen.hasTab, true, "the area has neither a row nor a tab, so nothing names it");
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: the menu column reserves the composer's height and scrolls", { skip }, async () => {
  /**
   * Peter: *"menu is hidden below the bottom chat bar, make sure the offset is correct"*. The frame is
   * a fixed full-height column and the composer is fixed over the bottom of the window, so the last
   * area sat underneath it with nowhere to scroll to.
   *
   * ⛔ THE RESERVATION IS READ AT TWO DOCK HEIGHTS, because one reading cannot tell a variable from a
   * hardcoded number that happens to match it.
   */
  const { corpus, rootId } = deepCorpus();
  const page = await openPage(renderScopePage(corpus, rootId, {}), { exe, width: 1200, height: 320 });
  try {
    await page.waitFor("!!document.querySelector('.topframe')", "the frame");

    const seen = await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      const frame = document.querySelector('.topframe');
      const read = () => parseFloat(getComputedStyle(frame).paddingBottom);
      const quiet = read();
      document.documentElement.style.setProperty('--bottom-h', '120px');
      const loud = read();
      document.documentElement.style.setProperty('--bottom-h', '0px');
      frame.scrollTop = 10000;
      return { quiet, loud, scrolls: frame.scrollHeight > frame.clientHeight, scrolled: frame.scrollTop > 0,
               overflow: getComputedStyle(frame).overflowY };
    })()`);

    assert.ok(seen.quiet >= 72, `the column reserves only ${seen.quiet}px for the composer`);
    assert.equal(seen.loud, seen.quiet + 120, "the clearance ignores how tall the composer actually is");
    assert.equal(seen.overflow, "auto", "the column does not scroll, so anything under the bar is lost");
    assert.equal(seen.scrolls, true, "the column has nothing to scroll, so the reserve proves nothing");
    assert.equal(seen.scrolled, true, "the column would not scroll to its own bottom");
  } finally {
    await page.close();
  }
});
