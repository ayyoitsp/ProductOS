/**
 * ⛔ A PRESS HAS TO MOVE THE PICTURE.
 *
 * Peter: *"i hit continue, and nothing changes. some text below changes, but the prototype doesn't
 * drive."* Showing what a control promises was the previous fix and it was half of one — a reviewer
 * validating a flow needs to SEE the next screen, not read that there is one.
 *
 * ⛔ AND THE DESTINATION IS NOT A LINK. `leads_to` is REFUSED on a `commits` part because where a
 * commit lands IS its answer, and writing it twice is two records of one fact. So it is derived
 * from the sentence that already says it — and from the TRUTH, never the component, which knows
 * perfectly well that Continue calls setPhase('folder') and must not be what steers a target-state
 * corpus.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

const { landingsFor } = await import(path.resolve("dist/v2/connects.js"));

const screen = (slots) => ({
  id: "create-deal",
  title: "Creating a deal",
  views: [],
  exchanges: [{ id: "form", at: { view: "the-form" }, slots }],
  happy_path: { accomplishes: "An analyst starts a multifamily deal" },
});

const view = {
  id: "the-form",
  title: "Create a deal",
  parts: [
    { id: "continue", role: "commits", label: "Continue" },
    { id: "a-field", role: "entry", label: "Deal Name" },
  ],
  states: [
    { when: "folderFailure", label: "Folder failure", sketch_html: "<i>x</i>" },
    { when: "phase === 'folder'", label: "Folder", sketch_html: "<i>x</i>" },
    { when: "isCreating", label: "Creating", sketch_html: "<i>x</i>" },
  ],
};

test("where a commit lands is read from what it leaves behind", () => {
  const lands = landingsFor(
    screen({ after: { says: "The deal exists on the list, and the analyst is then asked where its folder is." } }),
    view
  );
  assert.equal(lands.length, 1, `expected one landing, got ${JSON.stringify(lands)}`);
  assert.equal(lands[0].part, "continue");
  assert.equal(lands[0].label, "Folder", "it landed on a state that merely shares a word with the sentence");
  /** ⛔ It says what it read, so an arrow a reviewer disagrees with is one they can argue with. */
  assert.match(lands[0].because, /folder/i);
});

/** ⛔ Only a control that COMMITS. A text field going somewhere on its own is not a flow. */
test("only a commit lands anywhere", () => {
  const lands = landingsFor(
    screen({ after: { says: "The analyst is then asked where its folder is." } }),
    view
  );
  assert.ok(lands.every((l) => l.part === "continue"), "something other than a commits part was given a landing");
});

/**
 * ⛔ A MARGIN, NOT A MAXIMUM. A prototype that drives on a two-to-one reading teaches a reviewer a
 * flow the corpus does not claim, and they cannot tell it was a guess.
 */
test("an ambiguous sentence drives nowhere", () => {
  const lands = landingsFor(
    screen({ after: { says: "Something happens that nothing on this screen is named after." } }),
    view
  );
  assert.deepEqual(lands, [], `a vague sentence produced a landing: ${JSON.stringify(lands)}`);
});

/** ⛔ And a screen with no states has nowhere to drive to, which is not a failure. */
test("a screen with no states offers no landings", () => {
  const lands = landingsFor(
    screen({ after: { says: "The analyst is then asked where its folder is." } }),
    { ...view, states: [] }
  );
  assert.deepEqual(lands, []);
});


/**
 * ⛔ THE DEAD END, AND THE FIELD THAT EXISTS BECAUSE OF IT.
 *
 * Peter, one press into the create-a-deal folder step: *"it dead ends. no way to complete setup,
 * can't go back?"*. Back is a real control with a real destination and the model could not hold it:
 * `navigates` demands a `leads_to` naming another SCREEN, `commits` says the destination is the
 * answer slot, and an answer cannot name a state either. It was filed as `commits`, which is false
 * — it commits nothing — and drove nowhere.
 */
test("a control that returns puts somebody back on the screen as it was", () => {
  const back = { id: "back", role: "navigates", label: "Back", returns: true };
  const lands = landingsFor(screen({ after: { says: "Nothing here names any state at all." } }), {
    ...view,
    parts: [...view.parts, back],
  });
  const got = lands.find((l) => l.part === "back");
  assert.ok(got, `a returning control was given no landing: ${JSON.stringify(lands)}`);
  /** ⛔ State 0 is the screen as it first appeared — the one destination that survives a redraw. */
  assert.equal(got.index, 0, "it landed somewhere other than the screen as it was");
  assert.match(got.because, /as it was/i, "it must say what it read, like every other landing");
});

/**
 * ⛔ AND IT NEEDS NO SENTENCE, which is the point of it being a field rather than a derivation.
 * A word-match against a state label is a heuristic over a hole; this is the author saying so.
 */
test("a returning control needs nothing said about it", () => {
  const lands = landingsFor(
    { ...screen({}), exchanges: [] },
    { ...view, parts: [{ id: "cancel", role: "navigates", label: "Cancel", returns: true }] }
  );
  assert.equal(lands.length, 1, "a returning control needed an exchange it should not need");
  assert.equal(lands[0].index, 0);
});
