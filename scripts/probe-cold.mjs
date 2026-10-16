/**
 * What a reader gets when the ADDRESS is the only input: open a URL cold and look.
 *
 * ⛔ THE PATH NOBODY'S PROBE OPENED. `probe-durable.mjs` presses, and pressing exercises the
 * in-page switch where the answer is already in memory. Cold arrival is the only path where the
 * address has to carry the whole question — and it is every durable link anybody bookmarks, pastes
 * or is sent. The deploy session found this against the hosted mount after my own probe passed.
 *
 * ⛔ AND IT WAITS FOR A DOCUMENT, NOT FOR AN ADDRESS. `probe-goto.mjs` waits until
 * `location.href` starts with the URL it asked for, which is correct there and would make this
 * probe hang on exactly the defect it is looking for: a page that rewrites its own address bar on
 * arrival. What is being measured must not be what is waited on.
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

    const seen = await page.evaluate(`({
      path: location.pathname,
      hash: location.hash,
      title: document.title,
      showing: [...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view || s.id),
      has: [...document.querySelectorAll("section.view")].length,
    })`);

    const leaf = want.split("/").filter(Boolean).pop();
    const kept = seen.path === want;
    const onIt = seen.showing.length === 1 && (seen.showing[0] === leaf || (leaf === "overview" && seen.showing[0] === "overview"));
    if (!kept || !onIt) bad++;
    console.log(`  asked   ${want}`);
    console.log(`  landed  ${seen.path}${seen.hash}${kept ? "" : "   ⛔ the address bar was rewritten"}`);
    console.log(`  showing ${JSON.stringify(seen.showing)}${onIt ? "" : "   ⛔ not the thing that was asked for"}`);
    console.log(`  title   ${seen.title}   (${seen.has} sections)\n`);
  } catch (e) {
    bad++;
    console.log(`  asked   ${want}\n  ⛔ ${e.message}\n`);
  } finally {
    await page.close();
  }
}

if (bad) console.log(`⛔ ${bad} of ${urls.length} cold arrivals did not land where they were asked`);
else console.log(`✓ all ${urls.length} cold arrivals landed where they were asked, and kept their address`);
