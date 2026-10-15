/**
 * Press a nav row on the LIVE page and report what the reader is then looking at.
 *
 * Peter: *"I'm tapping on 'Versioned Inputs', which 'states nothing of its own'. it incorrectly
 * does not route anywhere."*
 *
 * ⛔ DRIVEN, NOT READ. The markup is correct — the anchor exists, its target exists, and the
 * endpoint that fills it answers 200 with 7874 bytes of container page. Everything that could be
 * wrong is therefore inside a browser, which is the one place this project has learned not to
 * reason about.
 *
 * ⛔ AND WIDE, because the side menu's rules live inside `@media (min-width: 62rem)` — a correct
 * page measured in a narrow headless window has read as broken here before.
 *
 *     node scripts/probe-goto.mjs http://localhost:4100/p/<project>/v2 versioned-inputs
 */
import { openPage, findBrowser } from "../test/support/chrome.mjs";

const url = process.argv[2];
const want = process.argv[3];
if (!url || !want) {
  console.error("usage: node scripts/probe-goto.mjs <url> <scope-id>");
  process.exit(2);
}
if (!findBrowser()) {
  console.error("no browser on this machine");
  process.exit(2);
}

const page = await openPage(null, { url, width: 1440, height: 900 });

/**
 * ⛔ WHERE ARE WE, ASKED FIRST AND OUT LOUD. A probe of this exact shape reported all zeros earlier
 * in this work because the page was still `about:blank` — the harness waits for `readyState`, which
 * `about:blank` satisfies instantly. A probe that cannot say what it is looking at proves nothing.
 */
/**
 * ⛔ AND WAITED FOR, BECAUSE `readyState` IS TRUE OF `about:blank` TOO. The harness attaches to a
 * target and asks whether the document is complete; a target that has not begun navigating answers
 * yes. A 3 MB page over a 1s TTFB needs the navigation itself waited on, by name.
 */
await page.waitFor(
  `location.href.indexOf(${JSON.stringify(url)}) === 0 && document.readyState === "complete"`,
  `the browser to actually be on ${url}`
);
const at = await page.evaluate("location.href + ' — ' + document.title + ' — ' + document.querySelectorAll('section.view').length + ' views'");
console.log(`\nlooking at: ${at}`);
if (!at.startsWith(url)) {
  console.error(`⛔ the browser is on ${at}, not ${url} — nothing below would mean anything`);
  await page.close();
  process.exit(2);
}

const look = async (when) => {
  const seen = await page.evaluate(`(() => {
    const showing = [...document.querySelectorAll("section.view")].filter((s) => !s.hidden);
    const row = document.querySelector('nav.scopes a[data-goto=${JSON.stringify(want)}]');
    const target = document.getElementById("at-" + ${JSON.stringify(want)});
    return {
      rowFound: Boolean(row),
      rowHref: row ? row.getAttribute("href") : null,
      rowRectW: row ? Math.round(row.getBoundingClientRect().width) : 0,
      rowVisible: row ? getComputedStyle(row).display !== "none" && getComputedStyle(row.closest("li") || row).display !== "none" : false,
      liHidden: row && row.closest("li") ? row.closest("li").hidden : null,
      targetFound: Boolean(target),
      targetHidden: target ? target.hidden : null,
      targetDeferred: target ? target.hasAttribute("data-defer") : null,
      targetText: target ? target.textContent.replace(/\\s+/g, " ").trim().slice(0, 90) : null,
      showing: showing.map((s) => s.dataset.view),
      hash: location.hash,
    };
  })()`);
  console.log(`\n── ${when}`);
  for (const [k, v] of Object.entries(seen)) console.log(`   ${k.padEnd(15)} ${JSON.stringify(v)}`);
  return seen;
};

const before = await look("on arrival");
if (!before.rowFound) {
  console.error("⛔ the nav row is not on the page at all");
  await page.close();
  process.exit(2);
}

/**
 * ⛔ A REAL PRESS, not `show(...)` called by hand. The whole question is which listeners run and in
 * what order — calling the function the handler calls would answer a question nobody asked.
 */
const press = async (id) => {
  await page.evaluate(`(() => {
    const a = document.querySelector('nav.scopes a[data-goto=' + JSON.stringify(${JSON.stringify(id)}) + ']');
    if (!a) throw new Error("no nav row for " + ${JSON.stringify(id)});
    a.click();
  })()`);
  /** The fill is a fetch; wait for it rather than guessing at a delay. */
  try {
    await page.waitFor(
      `(() => { const t = document.getElementById("at-" + ${JSON.stringify(id)}); return Boolean(t) && !t.hasAttribute("data-defer"); })()`,
      `the deferred section for ${id} to be filled`
    );
  } catch (e) {
    console.log(`   (${e.message})`);
  }
  return look(`after pressing ${id}`);
};

/**
 * ⛔ THE SEQUENCE IS THE TEST, BECAUSE ONE PRESS WORKS. Driven once, pressing this row routes
 * correctly — which is why reading the markup and pressing it once both said the page was fine
 * while Peter was looking at a page that would not move.
 *
 * `show()` captures every `section.view` ONCE at load. `fill()` REPLACES a deferred section with a
 * fresh element, so the captured list keeps the detached one. Going back to a section that has been
 * filled therefore matches nothing, and `show` has a documented fallback for matching nothing: it
 * un-hides every view on the page. On a 130-view corpus that reads exactly like "it did not route."
 */
const others = await page.evaluate(`[...document.querySelectorAll('nav.scopes a[data-goto]')]
  .map((a) => a.dataset.goto).filter((n) => n !== ${JSON.stringify(want)}).slice(0, 1)`);
const away = others[0];

await press(want);
if (away) {
  await press(away);
  const back = await press(want);
  console.log("");
  if (back.showing.length === 1 && back.showing[0] === want) {
    console.log(`✓ going back to ${want} still shows exactly it`);
  } else {
    console.log(`⛔ going back to ${want} left ${back.showing.length} views showing at once`);
    console.log(`   ${JSON.stringify(back.showing.slice(0, 8))}${back.showing.length > 8 ? " …" : ""}`);
  }
}

await page.close();
