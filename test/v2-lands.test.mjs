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

/**
 * ⛔ ARRIVING SOMEWHERE IS NOT FINISHING, AND THE DIFFERENCE IS WHY LEAVING FELT LIKE BEING DROPPED.
 *
 * Peter: *"we are going straight to the deals list on completion. but we should be showing a
 * completion screen here.. or maybe we should have a placeholder indicating that the flow is
 * complete? awkwards to go back to the deals list feature from here"*.
 *
 * ⛔ NOT A PLACEHOLDER. `happy_path.ends_with` is required by the schema, so every feature already
 * says what finishing means — authored, agreed to, and never once rendered at the end of a walk. A
 * placeholder reading "flow complete" would be a second thing to maintain that says less.
 */
const { finishesFor } = await import(path.resolve("dist/v2/connects.js"));

/**
 * ⛔ THE EXCHANGE SAYS IT FINISHES. IT IS NO LONGER READ OUT OF THE PROSE, AND THIS TEST USED TO
 * ASSERT THAT IT WAS.
 *
 * Finishing was scored by matching a control's sentence against `happy_path.ends_with` and taking
 * anything sharing three words. Peter found what that produces by pressing the button: *"the screen
 * linking is wrong"*, and before that *"it dead ends. no way to complete setup"*. On create-deal it
 * declared **Continue** to be where the feature ends — from a sentence whose own words are
 * *"Nothing has been created yet"* — because it shared "deal" and "folder" with the outcome.
 *
 * ⛔ Every sentence in a feature is about the same nouns, so overlap can never separate "the deal is
 * now on the list" from "no deal has been created". A claim this strong has to be made, not
 * inferred, and where nobody makes it `nothing-finishes-this-feature` asks — incomplete beats
 * confidently wrong about your own flow.
 */
const withPath = (through, ends, after, finishes) => ({
  ...screen({ after: { says: after ?? ends } }),
  exchanges: [{ id: "form", at: { view: "the-form" }, slots: { after: { says: after ?? ends } }, ...(finishes ? { finishes: true } : {}) }],
  happy_path: { accomplishes: "An analyst starts a deal", brings: "a name", ends_with: ends, through },
});

test("the control whose exchange says it finishes is the one that finishes", () => {
  const done = finishesFor(withPath(["the-form"], "the deal exists on the list", undefined, true), view);
  assert.deepEqual(done, ["continue"], `expected the commit to finish it, got ${JSON.stringify(done)}`);
});

test("a sentence that merely shares words with the outcome finishes nothing", () => {
  /**
   * ⛔ The exact shape that shipped: a sentence about the same nouns as `ends_with`, saying the
   * opposite. It scored three shared words and was declared the end of the feature.
   */
  const done = finishesFor(
    withPath(["the-form"], "the deal exists on the CRE deals list, bound to its folder", "no deal exists yet, and they are asked where its folder should be"),
    view
  );
  assert.deepEqual(done, [], "a control saying nothing has happened yet was read as completing the feature");
});

/** ⛔ Only the LAST screen of the path. A commit in the middle lands on the next step. */
test("a commit part-way through the path does not finish it", () => {
  const done = finishesFor(withPath(["the-form", "a-later-screen"], "the deal exists", undefined, true), view);
  assert.deepEqual(done, [], "a control in the middle of a flow was treated as the end of it");
});

/** ⛔ And a control that RETURNS never finishes anything — it puts somebody back where they were. */
test("a returning control does not finish the feature", () => {
  const done = finishesFor(withPath(["the-form"], "the deal exists", undefined, true), {
    ...view,
    parts: [{ id: "back", role: "navigates", label: "Back", returns: true }],
  });
  assert.deepEqual(done, []);
});

/** ⛔ Nothing to show means nothing is claimed — a path with no stated end finishes nowhere. */
test("a feature that never says what finishing is finishes nowhere", () => {
  assert.deepEqual(finishesFor({ ...screen({}), happy_path: { through: ["the-form"] } }, view), []);
});

/**
 * ⛔ A COMMIT THAT LEAVES THE FEATURE IS NOT THE END OF IT.
 *
 * "New Deal" sits on the last screen of the deals list and commits — and it starts a different
 * feature. Counted as finishing, its destination was suppressed, which broke the only cross-feature
 * link anybody would have drawn by hand.
 */
test("a commit whose outcome is nothing like finishing does not finish", () => {
  const done = finishesFor(
    withPath(["the-form"], "they have seen every deal and can get back to the list they came from",
      "a new deal is begun, and nothing on this list changes"),
    view
  );
  assert.deepEqual(done, [], "a control that starts something else was treated as the end of this");
});
