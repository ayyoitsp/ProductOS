/**
 * ⛔ TYPING A PAGE'S OWN ADDRESS MUST LAND ON THAT PAGE, NOT ON ITS QUEUE.
 *
 * Peter: *"when i load up a page, like
 * http://localhost:4100/p/prj-bks5f4m325/v2/product/cre/deal-overview, the menu doesn't expand, and
 * I load a page different than if I went to the menu and cliked through to this via product. what's
 * going on?"*
 *
 * Both halves are one defect. `viewAt` walks the path's segments deepest-first and asks two
 * questions in this order:
 *
 *     if (ROOT && segs[i] === ROOT) return "overview";
 *     if (segs[i] === "overview" || views().some(v => v.dataset.view === segs[i])) return segs[i];
 *
 * The first rule exists for a real reason, written beside it: a page's root does not render as a
 * section of its own — it IS the Overview — so a cold arrival at the very address just served used
 * to find nothing.
 *
 * ⛔ BUT THE PREMISE IS FALSE WHENEVER THE ROOT *DOES* HAVE A SECTION. Served at
 * `/v2/product/cre/deal-overview`, the document carries BOTH `data-root="deal-overview"` and
 * `data-view="deal-overview"` — measured on the live instance. The first rule fires on the deepest
 * segment, returns `"overview"`, and the second rule, which would have found the real section, is
 * never reached. So the reader gets the question queue, the menu expands to Overview rather than to
 * the path they typed, and clicking through from Product — which switches sections without touching
 * the URL — shows them something else entirely from the same address.
 *
 * ⛔ THE TWO ROUTES ARE THE TEST. "It lands somewhere" passes on the broken build. What has to hold
 * is that the address and the click agree, which is the whole claim a menu-path URL makes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/** Serve one rendered page at every path, so the address under test is the one the page sees. */
async function serving(html) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

/**
 * A scope whose own page carries a section named after itself.
 *
 * ⛔ That is the shape the defect needs, and it is not every scope: a leaf with no children renders
 * as its page's Overview and nothing else, which is the case the ROOT rule was written for and
 * which must keep working. The test asserts both, so neither fix can be made by breaking the other.
 */
function aPageWhoseRootIsAlsoASection() {
  const dir = temp("deep-address-");
  const corpus = loadCorpus("v2-seed");
  for (const { scope } of corpus.scopes) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "" });
    if (/data-root="([a-z0-9-]+)"/.test(html)) {
      const root = /data-root="([a-z0-9-]+)"/.exec(html)[1];
      if (root && new RegExp(`data-view="${root}"`).test(html)) return { id: scope.id, root, html, dir };
    }
  }
  return null;
}

test("⛔ a deep address lands on the section it names, not on the page's queue", async (t) => {
  if (skip) return t.skip(skip);
  const found = aPageWhoseRootIsAlsoASection();
  if (!found)
    return t.skip(
      "no scope in the seed renders a page whose root is also one of its own sections — the shape this guards needs a deeper corpus",
    );

  const { port, close } = await serving(found.html);
  try {
    /** The address a reader types: the menu path, ending in the page's own name. */
    const page = await openPage(null, { exe, url: `http://127.0.0.1:${port}/v2/product/${found.root}`, width: 1400 });
    try {
      const shown = await page.evaluate(`
        (function () {
          var on = document.querySelector('[data-view]:not([hidden])');
          return on ? on.getAttribute('data-view') : null;
        })()
      `);
      assert.equal(
        shown,
        found.root,
        `typing the page's own address showed "${shown}" instead of the section it names — the ROOT rule fired before the section was looked for`,
      );
    } finally {
      await page.close();
    }
  } finally {
    await close();
  }
});

test("a root with no section of its own still lands on the Overview", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * ⛔ THE CASE THE ROOT RULE WAS WRITTEN FOR, kept green so the fix above cannot be made by
   * deleting it. A page whose root renders no section of its own has nowhere else to land, and a
   * cold arrival at its own address must not find nothing.
   */
  const corpus = loadCorpus("v2-seed");
  const entry = corpus.scopes.find(({ scope }) => {
    const html = renderScopePage(corpus, scope.id, { linkBase: "" });
    const m = /data-root="([a-z0-9-]+)"/.exec(html);
    return m && !new RegExp(`data-view="${m[1]}"`).test(html);
  });
  if (!entry) return t.skip("every page in the seed renders a section for its own root");

  const html = renderScopePage(corpus, entry.scope.id, { linkBase: "" });
  const root = /data-root="([a-z0-9-]+)"/.exec(html)[1];
  const { port, close } = await serving(html);
  try {
    const page = await openPage(null, { exe, url: `http://127.0.0.1:${port}/v2/${root}`, width: 1400 });
    try {
      const shown = await page.evaluate(`
        (function () {
          var on = document.querySelector('[data-view]:not([hidden])');
          return on ? on.getAttribute('data-view') : null;
        })()
      `);
      assert.equal(shown, "overview", "a root with no section of its own stopped landing on the Overview");
    } finally {
      await page.close();
    }
  } finally {
    await close();
  }
});
