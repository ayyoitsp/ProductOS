/**
 * Where a part's marker lands, and what a state says when it cannot draw itself.
 *
 * ⛔ BOTH OF THESE WERE FOUND BY LOOKING AT THE DEPLOYED PAGE, not by reasoning about the code —
 * which is why the renderer tests exist at all. Neither was visible in any assertion that passed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { wireParts } from "../dist/v2/wire.js";
import { unpicturedParts } from "../dist/v2/states.js";

/* ─────────────── a label names a control; it is not the control ─────────────── */

test("⛔ an entry part marks the box, not the word above it", () => {
  /**
   * Seen on 4100: the derived state "Something required is missing" drew its red outline around the
   * word **Borrower** and injected the message between the label and the input, shoving the form
   * down. A reviewer reads that as "the label is wrong".
   *
   * The cause is that the input's placeholder is "Sponsor or borrowing entity", which does not
   * contain the word Borrower — so attribute matching missed and the text pass wrapped the label.
   */
  const html =
    '<div><label for="borrower">Borrower *</label><input id="borrower" placeholder="Sponsor or borrowing entity" /></div>';
  const { html: out, matched } = wireParts(html, [{ id: "borrower", label: "Borrower", role: "entry" }]);
  assert.ok(matched.has("borrower"));
  assert.match(out, /<input[^>]*data-part="borrower"/, "the marker is not on the input");
  assert.doesNotMatch(out, /<label[^>]*data-part="borrower"/, "the marker is on the label");
  assert.doesNotMatch(out, /<span[^>]*data-part="borrower"/, "the label text was wrapped instead");
});

test("a label with no `for` still names the control that follows it", () => {
  const html = '<div><label>Borrower *</label><input placeholder="Sponsor or borrowing entity" /></div>';
  const { html: out } = wireParts(html, [{ id: "borrower", label: "Borrower", role: "entry" }]);
  assert.match(out, /<input[^>]*data-part="borrower"/);
});

test("⛔ a marker already in the drawing is moved off the label too", () => {
  /**
   * THE SHAPE THE CORPUS ACTUALLY HOLDS — written by an earlier generator, with the input beside it
   * unmarked. Fixed here rather than in the corpus because `draw` and the page call this same
   * function: correcting it here fixes every drawing already written and every one generated from
   * now on, where editing the corpus would fix one and leave the generator free to do it again.
   */
  const html =
    '<div><label class="block"> <span class="pt pt-entry" data-part="borrower" role="button" tabindex="0">Borrower</span> <span class="text-red-500">*</span> </label> <input type="text" placeholder="Sponsor or borrowing entity" /></div>';
  const { html: out } = wireParts(html, [{ id: "borrower", label: "Borrower", role: "entry" }]);
  assert.match(out, /<input[^>]*data-part="borrower"/, "the marker did not move to the input");
  assert.doesNotMatch(out, /<span[^>]*data-part="borrower"/, "the old span marker survived");
  /** ⛔ The words stay on the screen — only the marker moves. */
  assert.match(out, /Borrower/, "unwrapping the span deleted the label text");
});

test("a control that is not an entry is left exactly as it was", () => {
  /** ⛔ Only `entry` resolves through a label. A button IS the control, and relocating its marker
   * would move it off the thing somebody presses. */
  const html = "<div><button>Continue</button></div>";
  const { html: out, matched } = wireParts(html, [{ id: "continue", label: "Continue", role: "commits" }]);
  assert.ok(matched.has("continue"));
  assert.match(out, /<span class="pt pt-commits" data-part="continue"[^>]*>Continue<\/span>/);
});

test("a display part still binds to its text", () => {
  const html = "<div><p>No deals yet</p></div>";
  const { matched } = wireParts(html, [{ id: "empty", label: "No deals yet", role: "display" }]);
  assert.ok(matched.has("empty"), "the text pass regressed");
});

/* ─────────────── a state that cannot draw itself says so ─────────────── */

test("⛔ a state whose control is in no picture is reported, not silently identical", () => {
  /**
   * `check` reports this — `no-picture-of-this-screen-contains-this-control` — but `check` is not
   * where a reviewer is standing. They are on the tab, looking at a picture identical to the one
   * behind it, unable to tell whether the state claims nothing or whether the thing it claims is
   * simply not drawn. Those are opposite conclusions and the page offered the same pixels for both.
   *
   * Confirmed on the deployed instance: the finding is 0 on every page on 4100 because `page.ts`
   * never rendered it, while `check` on the same commit returns 3.
   */
  const view = {
    id: "v",
    sketch_html: '<div><button data-part="save">Save</button></div>',
    parts: [{ id: "save", label: "Save", role: "commits" }],
    states: [],
  };
  const aboutSomethingDrawn = { label: "While it works", holds: { save: "busy" } };
  const aboutSomethingNot = { label: "It could not", holds: { figure: "failed" } };

  assert.deepEqual(unpicturedParts(view, aboutSomethingDrawn), [], "a drawn control was called missing");
  assert.deepEqual(unpicturedParts(view, aboutSomethingNot), ["figure"], "a control in no picture was not reported");
});
