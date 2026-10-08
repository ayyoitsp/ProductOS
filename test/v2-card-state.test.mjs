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
import { temp } from "./support/temp.mjs";
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

/**
 * ⛔ A DRAWING OLDER THAN THE PARTS IS ONE FINDING, NOT ONE PER BEHAVIOUR.
 *
 * `v2 draw` marks a control only if the view already DECLARES it, so a screen drawn while
 * `parts: []` comes out with no markers at all — and then everything pointing into the picture
 * fails at once: every anchored behaviour reports that the picture lacks its control, and the
 * dead-end check fires with landings that are nonsense because nothing can be located.
 *
 * A scoper hit this on a real feature and reported it as a defect in `draw`, which from inside is
 * exactly what it looks like. It is an ORDERING problem: redrawing after the parts landed wrote
 * seventeen markers and cleared every false finding. ⛔ Checked by running it — the agent's report
 * said regenerating reproduces them, and that was wrong.
 *
 * N confident false findings cost more than one missing one, because they get acted on.
 */
import { checkCorpus } from "../dist/v2/check.js";
import fs from "node:fs";
import path from "node:path";
import os2 from "node:os";

function drawnBeforeParts(withMarkers) {
  const dir = temp("v2stale-");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  /**
   * ⛔ A BLOCK SCALAR BELOW, so the marker's own double quotes need no escaping. Escaping them
   * inside a quoted YAML scalar is what made the first version of this fixture unparseable — and
   * the assertion that the fixture parsed is the only reason that was caught rather than passing
   * as "no findings".
   */
  const send = withMarkers ? '<button data-part="send">Send it</button>' : "<button>Send it</button>";
  fs.writeFileSync(path.join(dir, "truth", "pay.md"), `---
id: pay
title: Pay somebody
exists: kept
happy_path:
  accomplishes: somebody sends money to a person they have paid before
  brings: who they are paying and how much
  ends_with: the money has moved and both of them can see it
  through: [pay-form]
views:
  - id: pay-form
    title: Pay somebody
    sketch_html: |
      <form>${send}</form>
    parts:
      - { id: send, label: Send it, role: commits }
exchanges:
  - id: send-it
    title: Somebody sends the money
    asked_by: person
    at: { view: pay-form, part: send }
    slots:
      answer:
        says: the money has moved, and it shows on the list of payments with today's date
`);
  const { corpus, findings } = checkCorpus(dir);
  assert.deepEqual(corpus.broken, [], "the fixture did not parse");
  return findings;
}

test("a drawing that marks none of its declared controls is reported once, as output being stale", () => {
  const found = drawnBeforeParts(false);
  const stale = found.filter((f) => f.kind === "the-drawing-is-older-than-the-controls");
  assert.equal(stale.length, 1, "a drawing with no markers at all was not reported as out of date");
  assert.equal(stale[0].severity, "note", "it is not an authoring mistake — the drawing is output");
  assert.match(stale[0].fix, /generate|draw/, "the fix does not say to redraw it");

  /** ⛔ And the cascade is suppressed while it holds. */
  assert.deepEqual(found.filter((f) => f.kind === "the-picture-does-not-contain-the-control"), [],
    "it reported the stale drawing AND one finding per behaviour — the second set is false and gets acted on");
});

test("once the drawing marks its controls, the staleness finding goes and the real check applies", () => {
  const found = drawnBeforeParts(true);
  assert.deepEqual(found.filter((f) => f.kind === "the-drawing-is-older-than-the-controls"), [],
    "a correctly marked drawing is still being called out of date, so redrawing can never clear it");
});
