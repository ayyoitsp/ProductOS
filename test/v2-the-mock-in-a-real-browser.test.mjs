/**
 * ⛔ THE STRUCTURAL GAP: NOTHING IN THIS SUITE RAN A DOM, SO THE DRAWINGS WERE UNTESTED WHERE THEY
 * ACTUALLY LIVE.
 *
 * Three defects in one session existed only inside a browser, and all three were found by hand:
 *
 *   · the app's stylesheet was read out of its <template> with `innerHTML`, which HTML-escapes, so
 *     every rule holding a child combinator came back unparseable and was dropped in silence —
 *     828 rules reached the mock and NOT ONE of them had a `>` in it;
 *   · `@property` initial values are held by the document, not by a shadow root, so Tailwind's
 *     `border-style: var(--tw-border-style)` resolved to nothing and every bordered box on every
 *     screen drew as a bare underline;
 *   · a page written to own a viewport kept `min-height: 100vh` and 72px of page padding inside a
 *     450px preview pane.
 *
 * Every one is invisible from Node and obvious to a browser. Peter, after I named it as the thing
 * still missing: *"Let's fix the structural Gap"*.
 *
 * ⛔ THESE ASSERT COMPUTED STYLE, NOT MARKUP. Markup was correct in all three cases — that is
 * exactly why they survived. The only question worth asking of a drawing is what it renders as.
 */
import test from "node:test";
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage, standalone } from "../dist/v2/page.js";
import { asOptions, styleAt } from "../dist/v2/appcss.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

/**
 * A stylesheet carrying one example of each thing that has broken.
 *
 * ⛔ DELIBERATELY NOT REAL TAILWIND. Each rule is the SHAPE of a defect, with values no stylesheet
 * would produce by accident — 17px, 3px, rgb(9,8,7) — so a passing assertion cannot be some other
 * rule happening to agree.
 */
const CSS = [
  "@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}",
  ".border{border-style:var(--tw-border-style);border-width:3px}",
  ".stack>.cell+.cell{margin-top:17px}",
  ".min-h-screen{min-height:100vh}",
  ".p-6{padding:24px}",
  ".pt-12{padding-top:48px}",
  "html[data-theme='seedy'] .bg-page{background-color:rgb(9,8,7)}",
].join("\n");

const SKETCH = `<div class="min-h-screen bg-page p-6">
  <div class="max-w-2xl mx-auto pt-12">
    <h2 class="text-lg font-semibold">Offer a task</h2>
    <div class="stack"><div class="cell">one</div><div class="cell">two</div></div>
    <input class="w-full rounded-md border px-3 py-2" data-part="what" placeholder="What needs doing" />
    <input class="w-full rounded-md border px-3 py-2" data-part="amount" placeholder="Worth" />
    <button type="button" class="rounded-md px-3 py-2" data-part="offer">Offer it</button>
  </div>
</div>`;

/** The seed corpus, wearing the stylesheet above, rendered by the same code that serves it. */
function pageHtml() {
  const dir = temp("productos-browser-");
  fs.cpSync("v2-seed", dir, { recursive: true });

  const tasks = path.join(dir, "truth", "tasks.md");
  const before = fs.readFileSync(tasks, "utf-8");
  const start = before.indexOf("    sketch_html: |\n");
  assert.ok(start >= 0, "the seed's sketch moved — re-aim this fixture");
  const end = before.indexOf("    parts:", start);
  assert.ok(end > start, "the seed's sketch moved — re-aim this fixture");
  const indented = SKETCH.split("\n").map((l) => `      ${l}`).join("\n");
  fs.writeFileSync(tasks, `${before.slice(0, start)}    sketch_html: |\n${indented}\n${before.slice(end)}`);

  fs.writeFileSync(
    path.join(dir, "style.yaml"),
    YAML.stringify({ style: { theme: "seedy", css: CSS, offers: ["seedy"], sources: [] } })
  );

  const corpus = loadCorpus(dir);
  /**
   * ⛔ THROUGH `asOptions(styleAt(…))`, WHICH IS WHAT THE SERVER DOES. Rendered with `{}` instead,
   * the page carries no stylesheet at all and every assertion below fails for the one reason that
   * has nothing to do with what is being tested. A harness that does not take the production path
   * is testing a page nobody is ever served.
   */
  const opts = asOptions(styleAt(dir));
  assert.ok(opts.appCss, "the fixture's stylesheet was not picked up — nothing below would mean anything");
  const page = renderScopePage(corpus, "tasks", opts);
  assert.ok(page, "the seed's tasks scope did not render");
  fs.rmSync(dir, { recursive: true, force: true });
  return standalone("tasks", page);
}

/** Everything is asked of one page; booting a browser per assertion is minutes of nothing. */
async function inTheMock(ask) {
  const page = await openPage(pageHtml(), { exe });
  try {
    await page.waitFor(
      "!![...document.querySelectorAll('*')].find(e => e.shadowRoot && (e.shadowRoot.textContent||'').includes('Offer a task'))",
      "a mock to be hydrated into a shadow root"
    );
    return await page.evaluate(`(() => {
      const host = [...document.querySelectorAll('*')].find(e => e.shadowRoot && (e.shadowRoot.textContent||'').includes('Offer a task'));
      const q = (sel) => host.shadowRoot.querySelector(sel);
      const css = (sel, prop) => { const el = q(sel); return el ? getComputedStyle(el)[prop] : null; };
      ${ask}
    })()`);
  } finally {
    await page.close();
  }
}

test("a rule with a child combinator survives into the mock", { skip }, async () => {
  /**
   * ⛔ THE ONE THAT COST THE MOST. Read with `innerHTML`, `.stack>.cell+.cell` comes back as
   * `.stack&gt;.cell+.cell` — not a selector, dropped without a word. All of space-y, divide and
   * every nested layout rule the application has, gone, on every screen of every corpus, for as
   * long as mocks have been shadow-isolated. It reads as the drawing being wrong.
   */
  const got = await inTheMock("return { gap: css('.cell + .cell', 'marginTop'), withChild: [...host.shadowRoot.adoptedStyleSheets].flatMap(s => [...s.cssRules]).filter(r => (r.selectorText||'').includes('>')).length };");
  assert.equal(got.gap, "17px", "a rule with a child combinator never reached the mock");
  assert.ok(got.withChild > 0, "no rule in the mock's stylesheet has a child combinator in it at all");
});

test("a registered property reaches the mock, so a border is drawn", { skip }, async () => {
  /**
   * ⛔ `@property` IS DOCUMENT-SCOPED. Unhoisted, `var(--tw-border-style)` resolves to nothing
   * inside a shadow root, `border-style` computes as `none`, and a 3px border of no style draws
   * NOTHING. Asserting the width alone would pass against the bug — the style is the whole point.
   */
  const got = await inTheMock("return { style: css('input', 'borderTopStyle'), width: css('input', 'borderTopWidth') };");
  assert.equal(got.style, "solid", "the registered property never reached the mock, so every border is invisible");
  assert.equal(got.width, "3px", "the border rule did not reach the mock at all");
});

test("the page's own viewport framing is collapsed in a pane", { skip }, async () => {
  /**
   * ⛔ A DRAWING IS SHOWN IN A PANE, NOT A VIEWPORT. `min-height: 100vh` makes a mock taller than
   * its own frame with everything in the top third, and the page padding eats what is left. Peter:
   * *"there's so much empty space above 'new multifamily deal' ... WE DON'T HAVE THAT MUCH SCREEN
   * REAL ESTATE"*.
   */
  const got = await inTheMock("return { minH: css('.min-h-screen', 'minHeight'), padTop: css('.min-h-screen', 'paddingTop'), colTop: css('.max-w-2xl', 'paddingTop') };");
  assert.notEqual(got.minH, "100vh", "the drawing still demands a whole viewport");
  assert.ok(parseFloat(got.minH) < 50, `the drawing is still sized to a window: min-height ${got.minH}`);
  assert.equal(got.padTop, "0px", "the page's own outer padding is still eating the pane");
  assert.equal(got.colTop, "0px", "the centred column's top padding is still eating the pane");
});

test("the product's own theme reaches inside the shadow root", { skip }, async () => {
  /**
   * ⛔ THE RULE IS WRITTEN `html[data-theme='seedy']`, AND THERE IS NO `html` IN A SHADOW ROOT. It
   * is rewritten to the host, and the host is given the attribute — both halves, or a mock renders
   * in the stylesheet's fallbacks and looks like a styled screen of some other product.
   */
  const got = await inTheMock("return { bg: css('.bg-page', 'backgroundColor'), theme: host.getAttribute('data-theme') };");
  assert.equal(got.theme, "seedy", "the host never opted into the product's scheme");
  assert.equal(got.bg, "rgb(9, 8, 7)", "the theme's own colours did not reach inside the mock");
});

test("the application's CSS does not escape the mock", { skip }, async () => {
  /**
   * ⛔ THE REASON FOR THE SHADOW ROOT IN THE FIRST PLACE. A product stylesheet carried into the page
   * would restyle ProductOS itself — the reviewer's own furniture, in the product's colours, which
   * is the one failure that makes a page unusable rather than merely wrong.
   */
  const page = await openPage(pageHtml(), { exe });
  try {
    const leaked = await page.evaluate(
      "[...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } }).some(r => (r.selectorText||'').includes('.min-h-screen'))"
    );
    assert.equal(leaked, false, "the product's stylesheet is loose in the reviewer's own page");
  } finally {
    await page.close();
  }
});
