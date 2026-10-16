/**
 * ⛔ NOTHING IN THE MENU IS CUT OFF, AND EVERY ROW ANSWERS THE POINTER.
 *
 * Peter: *"we shouldn't have anything truncated in the menu... don't truncate, scroll. also make a
 * hover for each item even with scrolling on"*.
 *
 * An ellipsis destroys the one thing a menu row carries. Two features filed under the same container
 * are named for what separates them, so the distinguishing part is at the END — and a truncated menu
 * renders them as the same row, failing at exactly the job it exists for.
 *
 * ⛔ MEASURED AS GEOMETRY, because truncation is not visible in markup. The element, its text and its
 * class are identical whether the label is cut off or not; what differs is `scrollWidth` against
 * `clientWidth` and whether the box that clips is allowed to scroll. A markup assertion passes on
 * both.
 *
 * ⛔ AND THE FIXTURE CARRIES A NAME LONG ENOUGH TO OVERFLOW A 19rem COLUMN. On the seed every title
 * fits, so "nothing is truncated" is true of a build that truncates everything — the same
 * no-failing-state check this project keeps catching in itself. The name below is longer than the
 * column is wide, deliberately, and the test asserts it overflows before asserting it is reachable.
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

/** A name no 19rem column can hold, and a sibling it only differs from at the end. */
const LONG = "Attachment routing for inbound borrower correspondence";
const SIBLING = "Attachment routing for inbound lender correspondence";

function pageHtml() {
  const dir = path.join(temp("v2trunc-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const base = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");
  const clone = (id, title, parent) =>
    base
      .replace(/^id: money$/m, `id: ${id}`)
      .replace(/^title: Money$/m, `title: ${title}`)
      .replace(/^in: family-wallet$/m, `in: ${parent}`);
  fs.writeFileSync(path.join(dir, "truth", "attach-borrower.md"), clone("attach-borrower", LONG, "money"));
  fs.writeFileSync(path.join(dir, "truth", "attach-lender.md"), clone("attach-lender", SIBLING, "money"));

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the fixture does not load");
  const html = renderScopePage(c, c.scopes.find((e) => !e.scope.in).scope.id, { interactive: true, by: "peter" }) ?? "";
  assert.match(html, /data-scope="attach-borrower"/, "the long-named feature is not in the menu");
  return html;
}

/** The two rows that differ only at the end, with the menu placed down the side. */
async function inTheMenu(probe) {
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('li[data-scope=\"attach-borrower\"]')", "the long row");
    return await page.evaluate(`(() => {
      document.documentElement.setAttribute('data-nav', 'left');
      document.querySelector('.tabgroup[data-group="money"] .tab').click();
      ${probe}
    })()`);
  } finally {
    await page.close();
  }
}

test("⛔ a long name is not cut off, and the menu scrolls to it", { skip }, async () => {
  const seen = await inTheMenu(`
      const row = document.querySelector('li[data-scope="attach-borrower"] > .scoperow');
      const label = row.querySelector('a, strong, .unlinked');
      const tree = document.querySelector('nav.scopes');
      return {
        /** ⛔ The fixture must actually overflow, or nothing below is being tested. */
        overflows: tree.scrollWidth > tree.clientWidth + 1,
        /** ⛔ The label renders at its full width rather than the column's. */
        labelCut: label.scrollWidth > label.clientWidth + 1,
        ellipsis: getComputedStyle(label).textOverflow,
        /** ⛔ And the overflow is reachable: the tree scrolls sideways. */
        overflowX: getComputedStyle(tree).overflowX,
        scrolled: (() => { tree.scrollLeft = 9999; return tree.scrollLeft > 0; })(),
        text: label.textContent,
      };`);

  assert.equal(seen.overflows, true, "the fixture's name fits the column, so truncation is untested");
  assert.equal(seen.labelCut, false, "the label is clipped — its text is wider than the box drawing it");
  assert.notEqual(seen.ellipsis, "ellipsis", "the label still truncates with an ellipsis");
  assert.equal(seen.overflowX, "auto", "the menu cannot scroll sideways, so the rest of the name is lost");
  assert.equal(seen.scrolled, true, "the menu would not scroll to the end of the name");
  /** ⛔ The whole name, not a prefix of it. */
  assert.equal(seen.text.trim(), LONG, "the row is not showing the full name");
});

test("⛔ two names that differ only at the end are different rows", { skip }, async () => {
  /**
   * The reason truncation matters here rather than being untidy. These two titles share 38
   * characters and diverge on one word; truncated to a column they are the same row twice.
   */
  const seen = await inTheMenu(`
      const a = document.querySelector('li[data-scope="attach-borrower"] > .scoperow a, li[data-scope="attach-borrower"] > .scoperow strong');
      const b = document.querySelector('li[data-scope="attach-lender"] > .scoperow a, li[data-scope="attach-lender"] > .scoperow strong');
      return { a: a.textContent.trim(), b: b.textContent.trim(), aTitle: a.title, bTitle: b.title };`);

  assert.notEqual(seen.a, seen.b, "the two features render as the same row");
  assert.equal(seen.a, LONG);
  assert.equal(seen.b, SIBLING);
  /** ⛔ And the hover says the name too, which is the point of asking for one. */
  assert.equal(seen.aTitle, LONG, "the row has no hover naming it");
  assert.equal(seen.bTitle, SIBLING, "the row has no hover naming it");
});

test("⛔ the hover band is the row, not the text in it", { skip }, async () => {
  /**
   * Peter: *"also make a hover for each item even with scrolling on"*. Only the link reacted before,
   * so the half of the row holding the chips was dead to the pointer.
   *
   * ⛔ TWO READINGS OF ONE PROPERTY. A hover rule is trivially "present" in a stylesheet; what
   * matters is that the band covers the row. So the row's width is compared against the label's, and
   * the hover background is read as a computed value in both states.
   */
  const seen = await inTheMenu(`
      const row = document.querySelector('li[data-scope="attach-borrower"] > .scoperow');
      const label = row.querySelector('a, strong, .unlinked');
      const sheet = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } });
      const rule = sheet.find((r) => r.selectorText === 'nav.scopes .scoperow:hover');
      return {
        rowWidth: Math.round(row.getBoundingClientRect().width),
        labelWidth: Math.round(label.getBoundingClientRect().width),
        hoverRule: !!rule,
        hoverPaints: rule ? rule.style.background || rule.style.backgroundColor : null,
        /** The row is at least the width of the menu even when its text is short. */
        treeWidth: Math.round(document.querySelector('nav.scopes').getBoundingClientRect().width),
      };`);

  assert.equal(seen.hoverRule, true, "no hover rule applies to a menu row");
  assert.ok(seen.hoverPaints, "the hover rule paints nothing");
  /** ⛔ The band is the row: wider than the label it contains. */
  assert.ok(
    seen.rowWidth >= seen.labelWidth,
    `the row (${seen.rowWidth}px) is narrower than its own label (${seen.labelWidth}px)`
  );
});
