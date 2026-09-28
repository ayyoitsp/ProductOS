/**
 * ⛔ ENTER SENDS. SHIFT+ENTER IS A NEW LINE.
 *
 * Peter: "'enter' on the keyboard in the product os page should send, not newline. shift+enter is
 * newline."
 *
 * ⛔ AND THE BEHAVIOUR THIS REPLACED WAS DEFENDED IN HIS NAME BY A COMMENT HE NEVER SAID.
 *
 * It read: "Enter makes a new line — people write more than one, and Peter's first note had a blank
 * line in it." One of his notes happened to contain a blank line; that observation became his
 * rationale, written where the next reader would take it for a requirement. It took "never in the
 * history of the world did i say enter should put a blank line in there" to shift it.
 *
 * So this file pins the keys, and it exists partly because a comment is not a pin: the argument for
 * a behaviour can be wrong, or invented, and nothing fails when it is.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

const corpus = loadCorpus("v2-seed");
const ROOT = corpus.scopes.find((s) => !s.scope.in).scope.id;
const live = renderScopePage(corpus, ROOT, { interactive: true, records: "http", by: "peter" });

/** The composer's keydown handler, so these assertions cannot pass on some other listener. */
const handler = (() => {
  const at = live.indexOf('text.addEventListener("keydown"');
  assert.ok(at > 0, "the composer has no key handling at all");
  return live.slice(at, at + 400);
})();

test("Enter submits", () => {
  assert.match(handler, /requestSubmit\(\)/, "Enter does not send");
  assert.match(handler, /preventDefault\(\)/, "Enter sends AND types a newline into the box it just cleared");
});

test("Shift+Enter is left alone, so it makes a new line", () => {
  assert.match(handler, /shiftKey\)\s*return/, "Shift+Enter is not exempted, so a multi-line note is impossible to write");
});

test("Enter is not stolen from an input method mid-word", () => {
  /**
   * ⛔ Accepting a candidate in a Japanese, Chinese or Korean IME fires Enter with the same key, and
   * sending there posts a half-finished word. `keyCode === 229` is the older browsers' form of the
   * same signal.
   */
  assert.match(handler, /isComposing/, "an IME candidate keystroke would send the note");
  assert.match(handler, /229/, "older browsers report composition only as keyCode 229");
});

test("the box says which key does what, for somebody who cannot see the convention", () => {
  assert.match(live, /aria-label="[^"]*Enter sends[^"]*Shift\+Enter[^"]*"/);
});

test("the composer is still the only thing bound this way", () => {
  /**
   * ⛔ An act's reasoning field must NOT send on Enter. `because` on a ruling is several sentences
   * somebody is composing, and a stray Enter there would record a half-written justification as a
   * decision — which is the one thing in this model that cannot be taken back.
   */
  const forms = live.slice(live.indexOf("form.act-form"), live.indexOf("form.act-form") + 4000);
  assert.doesNotMatch(forms, /keydown[\s\S]{0,200}requestSubmit/, "an act form now sends on Enter, which can record a half-written reason");
});
