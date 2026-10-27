/**
 * ⛔ ONE 226-BYTE MAP, SHIPPED 1,126 TIMES — A THIRD OF THE BIGGEST BLOB ON THE PAGE.
 *
 * `partFacts` hung `slots: SLOT_ASKS_SHORT` on every entry it wrote. Every part carries the
 * identical map, because it is simply what the slots are CALLED — so the product page spent
 * 254 KB of its 764 KB on the same bytes over and over. Measured on the real corpus:
 *
 *     before   page 3.46 MB   part-facts 746 KB   1,126 entries   1,126 copies of the map
 *     after    page 3.21 MB   part-facts 488 KB   1,126 entries           0 copies
 *
 * Same entries, same answers, 258 KB less wire. This is PT-0007 territory: page size is the
 * thing a reader actually waits on, at roughly a second per megabyte.
 *
 * ⛔ AND THE PANEL'S TEXT IS WHAT IS ASSERTED, IN A REAL BROWSER, BECAUSE THE SHAPE IS NOT THE
 * POINT. The only existing coverage was `assert.match(html, /id="part-facts"/)` — a markup
 * assertion that passes on a blob whose every slot renders as a bare `after` instead of "what is
 * different afterwards". Reshaping data that nothing reads back is how a 254 KB saving becomes a
 * page that answers every click with raw slot ids, so the check is: click a control, read the
 * panel, and require the ENGLISH.
 *
 * ⛔ BOTH SHAPES, AND THE OLD ONE IS THE BRANCH THAT ROTS. A published artifact is static HTML on
 * claude.ai that no deploy reaches, and it carries the pre-hoist shape forever. The fallback that
 * keeps those pages working is invisible from the new shape alone — a test that only rendered
 * today's output would pass with the fallback deleted, which is why the second test below builds
 * the old shape on purpose and requires the same English out of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";
import { SLOT_ASKS_SHORT } from "../dist/v2/schema.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const corpus = loadCorpus("v2-seed");

/** The blob, parsed, plus the raw text so a test can measure it or rewrite it. */
function factsBlob(html) {
  const m = html.match(/id="part-facts"[^>]*>/);
  assert.ok(m, "the page carries no part-facts at all");
  const from = m.index + m[0].length;
  const raw = html.slice(from, html.indexOf("</script>", from));
  return { raw, data: JSON.parse(raw), from, to: from + raw.length };
}

/** A screen with a control that something is stated at — the only case the panel has words for. */
function aControlWithWords() {
  for (const { scope } of corpus.scopes) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "/v2" });
    const { data } = factsBlob(html);
    const parts = data.parts || data;
    for (const [key, f] of Object.entries(parts)) {
      const said = (f.at || []).flatMap((a) => a.said || []);
      if (!said.length) continue;
      const [view, part] = key.split("/");
      if (!new RegExp(`data-part="${part}"`).test(html)) continue;
      return { html, scopeId: scope.id, view, part, slot: said[0].slot, text: said[0].text };
    }
  }
  assert.fail("the seed has no control with anything stated at it, so the panel cannot be tested");
}

test("the slot map is written once for the page, not once per part", () => {
  const { html } = aControlWithWords();
  const { data, raw } = factsBlob(html);
  assert.ok(data.parts, "the blob has no `parts` key, so nothing separated the map from the entries");
  assert.deepEqual(data.slots, SLOT_ASKS_SHORT, "the page does not carry the slot names, so no entry can resolve one");
  const carrying = Object.entries(data.parts).filter(([, f]) => f.slots);
  assert.equal(carrying.length, 0, `${carrying.length} entries still carry their own copy of the slot map`);

  /**
   * ⛔ A NON-ZERO, OR THIS PROVES NOTHING. Zero copies is also what an empty blob produces, so the
   * count of entries has to be real and the saving has to be arithmetic somebody can check.
   */
  const n = Object.keys(data.parts).length;
  assert.ok(n > 1, `only ${n} entries, so one map per entry and one per page are the same page`);
  const perEntry = JSON.stringify(SLOT_ASKS_SHORT).length;
  assert.ok(
    raw.length + perEntry * (n - 1) > raw.length,
    "the map is too small for its duplication to have cost anything"
  );
});

test("clicking a control names the slot in English, from the page's map", async () => {
  const exe = browserOrSkip();
  if (!exe) return;
  const { html, view, part, slot, text } = aControlWithWords();
  const page = await openPage(html);
  try {
    const clicked = await page.evaluate(
      `(() => { const b = document.querySelector('[data-part=${JSON.stringify(part)}]');` +
        ` if (!b) return "no control"; b.click(); return "clicked"; })()`
    );
    assert.equal(clicked, "clicked", `${view}/${part} is not on the page to press`);
    await page.waitFor(
      `!!document.querySelector('.pt-detail:not([hidden])')`,
      "the control's panel to open"
    );
    const shown = await page.evaluate(`document.querySelector('.pt-detail:not([hidden])').textContent`);
    assert.match(
      shown,
      new RegExp(SLOT_ASKS_SHORT[slot].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `the panel says "${shown.slice(0, 200)}" — the slot did not resolve to its English name`
    );
    /** ⛔ And the statement itself, or a resolved label on an empty panel would pass. */
    assert.ok(shown.includes(text.slice(0, 40)), `the panel resolved the slot name and lost the words: ${shown.slice(0, 200)}`);
  } finally {
    await page.close();
  }
});

test("⛔ a page published before the hoist still answers, because its map is per entry", async () => {
  const exe = browserOrSkip();
  if (!exe) return;
  const { html, slot, part, text } = aControlWithWords();
  const { data, from, to } = factsBlob(html);

  /** Exactly what `partFacts` used to emit: entries at the top level, the map on each one. */
  const old = {};
  for (const [k, f] of Object.entries(data.parts)) old[k] = { ...f, slots: data.slots };
  const asPublished =
    html.slice(0, from) + JSON.stringify(old).replace(/</g, "\\u003c") + html.slice(to);
  assert.ok(!JSON.parse(factsBlob(asPublished).raw).parts, "the fixture is not actually the old shape");

  const page = await openPage(asPublished);
  try {
    await page.evaluate(`document.querySelector('[data-part=${JSON.stringify(part)}]').click()`);
    await page.waitFor(`!!document.querySelector('.pt-detail:not([hidden])')`, "the panel to open");
    const shown = await page.evaluate(`document.querySelector('.pt-detail:not([hidden])').textContent`);
    assert.match(
      shown,
      new RegExp(SLOT_ASKS_SHORT[slot].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `an already-published page now shows a raw slot id: ${shown.slice(0, 200)}`
    );
    assert.ok(shown.includes(text.slice(0, 40)), "an already-published page lost the statement");
  } finally {
    await page.close();
  }
});
