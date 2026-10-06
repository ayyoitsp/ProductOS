/**
 * ⛔ THE APP'S STYLESHEET HAS TO ARRIVE WHOLE, AND FOR MONTHS A THIRD OF IT DID NOT.
 *
 * The CSS travels in a <template> and is read back out in the browser. Read with `innerHTML`, it
 * comes back HTML-ESCAPED: every rule with a child combinator returns with "&gt;" where the
 * combinator was, which is not a parseable selector, and the CSS parser drops it without a word.
 *
 * Measured in the page, before and after: 828 rules reached the mock and NOT ONE held a child
 * combinator; afterwards 936 rules, 209 of them with one. All of space-y, divide, and every nested
 * layout rule the application has. Vertical rhythm was missing on every screen in every corpus —
 * which reads as the drawing being wrong rather than the stylesheet arriving in pieces.
 *
 * Peter: *"there's so much empty space above 'new multifamily deal' - why????? can we please just
 * get rid of all this wasted space?"* The rule written to collapse that space had a child
 * combinator in it too, so it never arrived either, and the fix looked like it had done nothing.
 *
 * ⛔ A SOURCE PIN, AND IT IS A PROXY FOR THE REAL CHECK. The defect lives in browser JS that this
 * suite cannot execute — nothing here runs a DOM. What would have caught it is loading the page and
 * counting the rules, which is how it WAS caught, by hand. Until that harness exists this asserts
 * the decision rather than the behaviour, and says so.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Every file that builds a stylesheet for a shadow root from a <template>. */
const CARRIERS = ["v2/page.ts", "ui/renderer.ts"];

for (const rel of CARRIERS) {
  test(`${rel} reads the carried stylesheet as text, not as HTML`, () => {
    const src = fs.readFileSync(path.join(SRC, rel), "utf-8");
    /**
     * Lines that hand something to the CSS parser, or that pull the template's content out to be
     * handed over. `innerHTML` anywhere in that path re-escapes the bytes.
     */
    const lines = src.split("\n");
    const offenders = [];
    lines.forEach((line, i) => {
      if (/^\s*\*/.test(line)) return; // a comment explaining the bug is not the bug
      if (!/innerHTML/.test(line)) return;
      if (!/replaceSync|\bcss\b|textContent\s*=|app-css/i.test(line)) return;
      /**
       * ⛔ ESCAPING ON PURPOSE IS NOT THE BUG. `esc()` sets textContent and reads innerHTML back
       * precisely to get an escaped string — the inverse direction, and the only safe way to put
       * somebody's text into markup. Matching it would force the one correct use to be written
       * unsafely to keep the test quiet.
       */
      if (/d\.textContent\s*=.*return d\.innerHTML|function esc\b/.test(line)) return;
      offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
    assert.deepEqual(
      offenders,
      [],
      "the stylesheet is read with innerHTML, which escapes every child combinator out of existence:\n  " +
        offenders.join("\n  ")
    );
  });

  test(`${rel} is still reading the template at all`, () => {
    /** ⛔ So that deleting the read entirely cannot make the test above pass. */
    const src = fs.readFileSync(path.join(SRC, rel), "utf-8");
    assert.match(
      src,
      /tpl\.content\s*\?\s*tpl\.content\.textContent\s*:\s*tpl\.textContent/,
      "nothing reads the carried stylesheet out of its template any more"
    );
  });
}
