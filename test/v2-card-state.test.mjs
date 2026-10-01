/**
 * ⛔ A BEHAVIOUR CARD SHOWS THE PICTURE ITS SENTENCE IS ABOUT.
 *
 * Peter, reading create-deal: *"most of the prototypes per behavior card are wrong. on
 * at-create-deal, they all show the entry form, even if talking about folder matching..."*
 *
 * Four behaviours, four different controls of one view, every card showing the same frame — because
 * `at` could name a view and a part and had no way to name a STATE, so every citation of a screen
 * resolved to its default picture. Three of those controls are absent from the default picture
 * entirely, so each folder sentence sat beside a screen with no folders on it.
 *
 * ⛔ WHY IT STAYED INVISIBLE: each card individually looked fine. A screen was there, a control was
 * highlighted, nothing was blank or broken. It only reads as wrong when you know what the sentence
 * next to it says — which is the one thing no check was comparing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { stateShowing } from "../dist/v2/connects.js";

/** A view with a default picture and two states, the way a drawn wizard comes out. */
const view = {
  sketch_html: '<form><input data-part="deal-name"><button data-part="continue">Continue</button></form>',
  states: [
    { when: "phase === 'folder'", label: "Folder step",
      sketch_html: '<div data-part="folder-question"><button data-part="use-existing">Use it</button></div>' },
    { when: "state.isCreating", label: "Creating", sketch_html: '<div data-part="spinner"></div>' },
  ],
};

test("a control drawn in one state only resolves to that state's picture", () => {
  assert.equal(stateShowing(view, "folder-question"), 1, "a folder control did not resolve to the folder picture");
  assert.equal(stateShowing(view, "use-existing"), 1);
  assert.equal(stateShowing(view, "spinner"), 2, "the frame numbering is off — 0 is the default, n+1 is states[n]");
});

/**
 * ⛔ THREE WAYS IT MUST DECLINE TO ANSWER, because a frame chosen by guessing is the same defect
 * with a different picture on it.
 */
test("it answers nothing rather than guessing", () => {
  assert.equal(stateShowing(view, "deal-name"), null, "a control in the default picture should stay on the default");
  assert.equal(stateShowing(view, "nowhere-at-all"), null, "a control drawn nowhere must not be given a frame");
  const both = { ...view, states: [...view.states, { when: "x", sketch_html: '<div data-part="folder-question"></div>' }] };
  assert.equal(stateShowing(both, "folder-question"), null,
    "a control drawn in two states was resolved anyway — which one the sentence means is the author's to say");
  assert.equal(stateShowing(view, ""), null);
});

/**
 * ⛔ THE ATTRIBUTE, NOT A SUBSTRING. "folder" matching "folder-question" would make every card
 * about anything folder-shaped resolve to the same frame, and it would look like it was working.
 */
test("a part matches on its own attribute, not on being a prefix of another", () => {
  assert.equal(stateShowing(view, "folder"), null, "a prefix matched a longer part id");
  assert.equal(stateShowing(view, "use"), null);
});

test("an author naming a state is what the model can now carry", async () => {
  const { Exchange } = await import("../dist/v2/schema.js");
  const ok = Exchange.safeParse({
    id: "link-the-folder",
    title: "Link the folder",
    asked_by: "person",
    at: { view: "create-deal-form", part: "folder-question", state: "phase === 'folder'" },
  });
  assert.ok(ok.success, `the model cannot carry a state on an anchor: ${JSON.stringify(ok.error?.issues)}`);
  /** ⛔ And it is still strict — a typo'd key must not be silently kept. */
  const bad = Exchange.safeParse({
    id: "x", title: "X", asked_by: "person",
    at: { view: "v", part: "p", states: "phase === 'folder'" },
  });
  assert.ok(!bad.success, "an anchor accepted an unknown key, so a misspelled state would be silently ignored");
});
