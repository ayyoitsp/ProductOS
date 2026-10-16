/**
 * What a reader gets when the ADDRESS is the only input: open a URL cold and look.
 *
 * ⛔ THE PATH NOBODY'S PROBE OPENED. `probe-durable.mjs` presses, and pressing exercises the
 * in-page switch where the answer is already in memory. Cold arrival is the only path where the
 * address has to carry the whole question — and it is every durable link anybody bookmarks, pastes
 * or is sent. The deploy session found the original defect here after my own probe passed.
 *
 * ⛔ AND IT WAITS FOR A DOCUMENT, NOT FOR AN ADDRESS. `probe-goto.mjs` waits until
 * `location.href` starts with the URL it asked for, which is correct there and would make this
 * probe hang on exactly the defect it is looking for: a page that rewrites its own address bar on
 * arrival. What is being measured must not be what is waited on.
 *
 * ⛔ THE FIRST VERSION OF THIS PROBE CONTRADICTED THE FIX IT WAS WRITTEN FOR, and the deploy session
 * caught it before it reached Peter as "still broken". It compared the visible section's id against
 * the leaf of the address — but the fix IS that the asked scope renders as the page's Overview, so
 * that id is `overview` for every scoped address, by design, forever. It reported 4 of 5 failing on
 * a page that works, and it had no failing state left at all.
 *
 * So it asks what the READER SEES, and the deploy session's numbers are the reason:
 *
 *     /capabilities/deal-pipeline    heading "Deal pipeline"    5 sections
 *     /capabilities                  container overview        51 sections
 *     /v2                            "Product Truth"          134 sections
 *
 * Three addresses, three answers, out of the deployed build. A section-id comparison cannot fail;
 * a page that ignores its address produces the SAME root and the same count every time, and that
 * is what these three can catch.
 *
 *     node scripts/probe-cold.mjs <url> [<url> …]
 */
import { openPage, findBrowser } from "../test/support/chrome.mjs";

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error("usage: node scripts/probe-cold.mjs <url> [<url> …]");
  process.exit(2);
}
const exe = findBrowser();
if (!exe) {
  console.error("no browser on this machine");
  process.exit(2);
}

console.log("");
let bad = 0;
const roots = new Set();
const counts = new Set();

for (const url of urls) {
  const want = new URL(url).pathname;
  const page = await openPage(null, { exe, url, width: 1440, height: 900 });
  try {
    /** ⛔ A document, and nothing about which one — see the note above. */
    await page.waitFor(
      `document.readyState === "complete" && document.querySelectorAll("section.view").length > 0`,
      `a document at ${url}`
    );
    /** The switcher runs on load; give it a tick to have run before reading what it did. */
    await new Promise((r) => setTimeout(r, 300));

    const seen = await page.evaluate(`(() => {
      const shown = [...document.querySelectorAll("section.view")].filter((s) => !s.hidden);
      const bank = document.getElementById("mock-bank");
      const head = shown[0] && shown[0].querySelector("h1, h2, h3");
      return {
        path: location.pathname,
        hash: location.hash,
        title: document.title,
        /**
         * ⛔ WHAT THE PAGE IS ROOTED AT, which is the server's answer to the address. It lives on
         * #mock-bank because the section endpoint needs it; a prober looking on <body> or <html>
         * finds nothing, which the deploy session hit. Printed here so the next one does not.
         */
        root: bank ? bank.getAttribute("data-root") : null,
        sections: document.querySelectorAll("section.view").length,
        showingCount: shown.length,
        heading: head ? head.textContent.replace(/\\s+/g, " ").trim().slice(0, 60) : null,
      };
    })()`);

    const leaf = want.split("/").filter(Boolean).pop();
    roots.add(seen.root);
    counts.add(seen.sections);

    /**
     * ⛔ THREE PROPERTIES, AND NOT ONE OF THEM IS THE SECTION'S NAME.
     *
     *   · the address survived — the half that was actually broken
     *   · the page is ROOTED where it was asked, which is the server's answer and the only
     *     statement about the address that cannot be satisfied by ignoring it
     *   · exactly one section is showing, because "it rendered something" is not the claim
     */
    const keptAddress = seen.path === want && !seen.hash;
    const rootedRight = leaf === "overview" || leaf === "v2" ? true : seen.root === leaf;
    const oneShowing = seen.showingCount === 1;
    if (!keptAddress || !rootedRight || !oneShowing) bad++;

    console.log(`  asked    ${want}`);
    console.log(`  landed   ${seen.path}${seen.hash}${keptAddress ? "" : "   ⛔ the address bar was rewritten"}`);
    console.log(`  rooted   ${seen.root}${rootedRight ? "" : `   ⛔ asked for ${leaf}`}`);
    console.log(`  heading  ${seen.heading}`);
    console.log(`  sections ${seen.sections}   showing ${seen.showingCount}${oneShowing ? "" : "   ⛔ not exactly one"}`);
    console.log(`  title    ${seen.title}\n`);
  } catch (e) {
    bad++;
    console.log(`  asked    ${want}\n  ⛔ ${e.message}\n`);
  } finally {
    await page.close();
  }
}

/**
 * ⛔ AND THE ANSWERS HAVE TO DIFFER, or every line above is what a page that ignores its address
 * also prints. This is the non-vacuity check, and it is why more than one URL should be passed.
 */
if (urls.length > 1) {
  if (roots.size === 1) {
    bad++;
    console.log(`⛔ all ${urls.length} addresses rooted at the same scope (${[...roots][0]}) — the address changed nothing`);
  }
  if (counts.size === 1) {
    bad++;
    console.log(`⛔ all ${urls.length} addresses served ${[...counts][0]} sections — the page is not being scoped`);
  }
  if (roots.size > 1 && counts.size > 1) {
    console.log(`(${roots.size} distinct roots, ${counts.size} distinct section counts across ${urls.length} addresses)`);
  }
}

if (bad) console.log(`\n⛔ ${bad} problem${bad === 1 ? "" : "s"} across ${urls.length} cold arrivals`);
else console.log(`\n✓ all ${urls.length} cold arrivals kept their address and were rooted where they were asked`);
