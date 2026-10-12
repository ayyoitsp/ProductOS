/**
 * ⛔ THE PAGE UPDATES ITSELF, AND NEVER OVER WORDS SOMEBODY HAS TYPED.
 *
 * Peter: *"POS: 6 changes to the truth under this page {show it} - unnecessary, just live update as
 * we go..."*
 *
 * It used to count the changes and offer a button. That replaced one seam with a smaller one: the
 * page knew it was stale, said so, and still showed the old truth until somebody pressed something.
 * A bar whose only possible answer is "yes, show me the correct page" is a question not worth asking.
 *
 * ⛔ THE ONE THING THAT MUST SURVIVE IT is unsent text. Reloading under a half-written reason would
 * destroy it, and losing what a person wrote is the single worst thing this surface could do. So a
 * change waits while anything holds words and applies the moment it does not.
 *
 * ⛔ WHAT THIS FILE CANNOT PROVE, SAID OUT LOUD. These are assertions about the script the browser
 * is given, not about what a browser does with it — Playwright is not a dependency here. The
 * behaviour was driven in Chromium against the live server and produced: no bar; one reload when an
 * act was recorded; zero reloads while a form held unsent words, with the words intact; and one
 * reload the moment they were cleared. If this file passes while that stops being true, the thing
 * to re-run is a browser.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

function page() {
  const dir = temp("v2live-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const corpus = loadCorpus(dir);
  assert.deepEqual(corpus.broken, [], "the fixture did not parse, so nothing below is evidence");
  /** ⛔ `http` mode — the live script is only emitted where there is a server to stream from. */
  return renderScopePage(corpus, "tasks", { interactive: true, by: "a-person", mode: "http" });
}

test("nothing asks to be pressed before the page will show current truth", () => {
  const html = page();
  assert.ok(!/class="live-bar"/.test(html), "the bar is back — the page announces staleness instead of ending it");
  assert.ok(!/live-go|live-later/.test(html), "the Show it / Later buttons are back");
  /** ⛔ And the room that was made for it, or a layout variable survives whose only honest value is zero. */
  assert.ok(!/--live-h|live-showing/.test(html.replace(/\/\*[\s\S]*?\*\//g, "")),
    "the CSS that made room for the bar is still there");
});

test("a change applies on its own, and comes back to the same place", () => {
  const html = page();
  assert.match(html, /location\.reload\(\)/, "nothing reloads, so the page cannot follow the truth at all");
  /**
   * ⛔ The place is saved BEFORE reloading. A page that silently jumps to the top mid-review is
   * worse than the bar it replaced, and this mattered less when a human pressed the button.
   */
  assert.match(html, /productos-at/, "it reloads without saving where the reader was");
  assert.match(html, /scrollY/, "it saves the view but not the scroll position");
});

test("it will not reload over unsent words, and does not forget the change", () => {
  const html = page();
  /**
   * ⛔ ANYTHING UNSENT, NOT WHAT IS FOCUSED. A reason typed and then clicked away from is still a
   * reason somebody wrote, sitting in a form with nothing focused — the first version of this guard
   * read `activeElement` alone and would have thrown those away.
   */
  assert.match(html, /form\.act-form input, form\.act-form textarea/,
    "the guard does not look at open forms, so a reload can destroy a half-written reason");
  assert.match(html, /if \(!unsent\(\)\) apply\(\)/, "a change is applied without checking for unsent words");
  /**
   * ⛔ AND THE HELD CHANGE IS NOT DROPPED. Without this, a change arriving while somebody types
   * waits forever — which is the original failure exactly: a page showing truth that moved, with
   * nothing saying so, the one state a reader cannot detect for themselves.
   */
  assert.match(html, /if \(pending && !unsent\(\)\) apply\(\)/,
    "a change held back while typing is never applied — the page can sit stale and silent");
});

/**
 * ⛔ WHAT THE STREAM ACTUALLY FOLLOWS, because I tested the wrong trigger first and it looked broken.
 *
 * `watchLog` follows the EVENT LOG, so an act emits and a raw edit to a truth file does not. My
 * first browser run wrote to a truth file, saw no reload, and I nearly reported the live update as
 * not working — it was fg-0001, which is already recorded: anything that writes a corpus without
 * going through the API never enters the log.
 */
test("the stream follows the event log, which is what an act writes to", async () => {
  const { watchLog } = await import("../dist/v2/log.js");
  assert.equal(typeof watchLog, "function");
  const src = fs.readFileSync("src/v2/serve.ts", "utf-8");
  assert.match(src, /event: changed/, "the live endpoint no longer emits the event the page listens for");
});
