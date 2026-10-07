/**
 * ⛔ A STATE BELONGS TO A PART, AND A STATE IS A SET OF CONDITIONS ON ONE PICTURE.
 *
 * Peter: *"we need to have STATES on a screen, rich enough to describe VARIOUS TYPES OF ERRORS,
 * LOADING STATES, etc. multiple buttons could have LOADING States. MULTIPLE FIELDS COULD HAVE ERROR
 * STATES."* And on what was there: *"a fucking form screenshot plus an error screenshot is not the
 * same as having a form screen, with an unfilled/error state."*
 *
 * ⛔ THE MEASUREMENT THAT SETTLED IT. `create-deal-form` held its error state as a complete second
 * copy of the screen — 3,244 bytes, 96% byte-identical to the default frame, differing in 129 bytes
 * for one red line under one field. One form cost 19,723 bytes across five pictures. A state held
 * as a whole picture cannot compose: two fields in error is a third screenshot, two fields plus a
 * working button a fourth, and loading never arrives because it is not a render branch anything can
 * harvest from code.
 *
 * ⛔ AND THE BROWSER HALF IS NOT OPTIONAL HERE. Composition marks a part with `data-in="invalid"`
 * and lets one stylesheet say what that means — so the markup being right proves nothing. The mock
 * lives in a SHADOW ROOT, and page-level CSS does not cross that boundary: the first version of
 * this would have composed perfectly and rendered a form with no error on it, which is a reviewer
 * agreeing to a sentence about a case the picture does not contain.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Part, View, STATES_FOR_ROLE, PartStateKind, BUILT_IN_CONDITIONS } from "../dist/v2/schema.js";
import {
  pictureOf,
  mark,
  saysFor,
  unknownParts,
  undrawnConditions,
  undeclaredConditions,
  differenceOf,
  STATE_CSS,
} from "../dist/v2/states.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { skip } = browserOrSkip();

/** A form with two fields and a commit, as a corpus holds one. */
const form = () => ({
  id: "create-deal-form",
  title: "Create a deal",
  sketch_html:
    "<form>" +
    '<input data-part="deal-name" placeholder="Enter deal name" />' +
    '<input data-part="borrower" placeholder="Sponsor" />' +
    '<button data-part="continue">Continue</button>' +
    '<div data-part="matches"><span>a match</span></div>' +
    "</form>",
  parts: [
    { id: "deal-name", role: "entry", label: "Deal Name", states: [{ kind: "invalid", says: "A deal name is required." }] },
    { id: "borrower", role: "entry", label: "Borrower", states: [{ kind: "invalid", says: "Borrower is required." }] },
    { id: "continue", role: "commits", label: "Continue", states: [{ kind: "busy" }, { kind: "disabled" }] },
    { id: "matches", role: "region", label: "Matching folders", states: [{ kind: "loading" }, { kind: "empty", says: "No folders matched." }] },
  ],
});

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

test("the role decides which conditions are possible, so a corpus cannot describe an impossible one", () => {
  /** ⛔ A button is never `loading` and a text box is never `loading` either — those are shown things. */
  const button = Part.safeParse({ id: "go", role: "commits", states: [{ kind: "loading" }] });
  assert.equal(button.success, false, "a button was allowed to be loading");
  assert.match(button.error.issues[0].message, /cannot be "loading"/);
  assert.match(button.error.issues[0].message, /busy, disabled/, "the refusal does not say what it CAN be");

  const field = Part.safeParse({ id: "name", role: "entry", states: [{ kind: "busy", says: "x" }] });
  assert.equal(field.success, false, "a text box was allowed to be busy");

  /**
   * ⛔ AN OPEN CONDITION IS NOT ROLE-CHECKED, and that is the price of not hard-coding the list.
   * Peter: *"Loading/busy shouldn't be hard coded. We should support lots of different states"*.
   * Nothing here knows whether `syncing` belongs on a button or a region, so refusing an
   * unrecognised word would mean refusing every condition a product declares for itself.
   */
  const declared = Part.safeParse({ id: "go", role: "commits", states: [{ kind: "syncing" }] });
  assert.equal(
    declared.success,
    true,
    `a product's own condition was refused: ${declared.success ? "" : declared.error.issues[0].message}`,
  );

  /** ⛔ Still a word, not a sentence — openness is not an invitation to write prose here. */
  assert.equal(Part.safeParse({ id: "go", role: "commits", states: [{ kind: "is Syncing now" }] }).success, false);
  assert.equal(Part.safeParse({ id: "go", role: "commits", states: [{ kind: "a" }] }).success, false);

  /** ⛔ The built-in table and the built-in enum must not drift apart. */
  assert.deepEqual(
    Object.keys(BUILT_IN_CONDITIONS).sort(),
    [...PartStateKind.options].sort(),
    "the built-in table and the built-in enum disagree about what is built in",
  );

  /** And every role's own vocabulary is accepted, or the table and the check disagree. */
  for (const [role, kinds] of Object.entries(STATES_FOR_ROLE)) {
    for (const kind of kinds) {
      const needsWords = kind === "invalid" || kind === "failed";
      const got = Part.safeParse({
        id: "p",
        role,
        ...(role === "navigates" ? { returns: true } : {}),
        states: [{ kind, ...(needsWords ? { says: "Something is wrong." } : {}) }],
      });
      assert.equal(got.success, true, `${role} cannot be ${kind}: ${got.success ? "" : got.error.issues[0].message}`);
    }
  }
});

test("a condition that reports a problem has to say what the person is told", () => {
  /**
   * ⛔ "the borrower field is invalid" is not something a reader can disagree with. "Borrower is
   * required" is a product decision somebody can accept or reword, which is the only kind of
   * statement this system exists to collect.
   */
  for (const kind of ["invalid", "failed"]) {
    const role = kind === "invalid" ? "entry" : "region";
    const silent = Part.safeParse({ id: "p", role, states: [{ kind }] });
    assert.equal(silent.success, false, `${kind} was accepted with no words`);
    assert.match(silent.error.issues[0].message, /does not say what the person is told/);

    const spoken = Part.safeParse({ id: "p", role, states: [{ kind, says: "Borrower is required." }] });
    assert.equal(spoken.success, true);
  }

  /** ⛔ But `busy`, `disabled` and `loading` say nothing by nature — requiring words there would be noise. */
  assert.equal(Part.safeParse({ id: "p", role: "commits", states: [{ kind: "busy" }] }).success, true);
});

test("a code condition is optional, so a screen nobody has built can still have states", () => {
  /**
   * ⛔ THE OLD SHAPE REQUIRED ONE. `when` was "the condition in the code that produces this state",
   * so a screen the product SHOULD have could not say it has a loading state until somebody wrote
   * the component — against the rule this project is most insistent about: *"product truth is
   * supposed to represent the target state always, doesn't matter what's been built."*
   */
  const target = Part.safeParse({ id: "p", role: "region", states: [{ kind: "loading" }] });
  assert.equal(target.success, true, "a state with no code condition was refused");

  const built = Part.safeParse({ id: "p", role: "region", states: [{ kind: "loading", when: "isPending" }] });
  assert.equal(built.success, true);
  assert.equal(built.data.states[0].when, "isPending", "the code condition is not kept for comparison");
});

test("one condition per kind, or two sentences claim the same moment", () => {
  const twice = Part.safeParse({
    id: "p",
    role: "entry",
    states: [
      { kind: "invalid", says: "First message." },
      { kind: "invalid", says: "Second message." },
    ],
  });
  assert.equal(twice.success, false, "a part declared the same condition twice");
  assert.match(twice.error.issues[0].message, /twice/);
});

test("a state of a screen is a label with either a picture or conditions — never neither", () => {
  const empty = View.safeParse({
    id: "v",
    title: "V",
    states: [{ label: "Loading" }],
  });
  assert.equal(empty.success, false, "a state with no picture and no conditions was accepted");
  assert.match(JSON.stringify(empty.error.issues), /nothing here to review/);

  /** Either one satisfies it: conditions compose, a picture stands alone. */
  assert.equal(
    View.safeParse({ id: "v", title: "V", states: [{ label: "Loading", holds: { list: "loading" } }] }).success,
    true,
  );
  assert.equal(
    View.safeParse({ id: "v", title: "V", states: [{ label: "Loading", sketch_html: "<div>…</div>" }] }).success,
    true,
  );
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

test("two fields in error and a working button is ONE state on ONE picture", () => {
  const v = form();
  /** ⛔ The case the old shape could not express at all. */
  const html = pictureOf(v, {
    label: "Both missing, submitting",
    holds: { "deal-name": "invalid", borrower: "invalid", continue: "busy" },
  });

  assert.match(html, /data-part="deal-name" data-in="invalid" data-says="A deal name is required\."/);
  assert.match(html, /data-part="borrower" data-in="invalid" data-says="Borrower is required\."/);
  assert.match(html, /data-part="continue" data-in="busy"/);

  /** ⛔ And it is the screen's own drawing, not a copy — the base markup is still all there. */
  assert.ok(html.includes('placeholder="Enter deal name"'), "the composed picture lost the form");
  assert.ok(html.length < v.sketch_html.length * 1.6, "composition produced something closer to a second screenshot");
});

test("a part that appears more than once is marked everywhere, not just the first time", () => {
  /**
   * ⛔ A column header and its cells, or a control repeated per row. Marking only the first would
   * put one row in an error state and leave its siblings looking fine — a picture that lies rather
   * than one that is thin.
   */
  const html = mark('<tr data-part="row">a</tr><tr data-part="row">b</tr>', "row", "failed", "Could not load.");
  assert.equal((html.match(/data-in="failed"/g) ?? []).length, 2);
});

test("the words come from the part, so one message is not repeated in every state", () => {
  const v = form();
  assert.equal(saysFor(v, "borrower", "invalid"), "Borrower is required.");
  assert.equal(saysFor(v, "continue", "busy"), undefined, "a busy button invented a message");
  assert.equal(saysFor(v, "nope", "invalid"), undefined);
});

test("a condition naming a part the screen does not have is caught, not silently ignored", () => {
  /**
   * ⛔ WITHOUT THIS IT COMPOSES TO THE DEFAULT FRAME AND LOOKS CORRECT, which is the worst outcome
   * available: a reviewer agrees to a picture that does not contain the case they were asked about.
   */
  const v = form();
  assert.deepEqual(unknownParts(v, { label: "Typo", holds: { borower: "invalid" } }), ["borower"]);
  assert.deepEqual(unknownParts(v, { label: "Fine", holds: { borrower: "invalid" } }), []);
});

test("it can say which conditions nothing has drawn — the question the old shape could not ask", () => {
  const v = form();
  const drawn = [{ label: "Submitting", holds: { continue: "busy" } }];
  const undrawn = undrawnConditions(v, drawn);

  const asKeys = undrawn.map((u) => `${u.part}/${u.condition}`).sort();
  assert.deepEqual(asKeys, [
    "borrower/invalid",
    "continue/disabled",
    "deal-name/invalid",
    "matches/empty",
    "matches/loading",
  ]);
  assert.ok(!asKeys.includes("continue/busy"), "a drawn condition was reported as undrawn");
});

test("a state that brings its own picture still wins, so no corpus has to be migrated", () => {
  const v = form();
  const own = "<div>a genuinely different arrangement</div>";
  assert.equal(pictureOf(v, { label: "Folder step", sketch_html: own, holds: {} }), own);
});

// ---------------------------------------------------------------------------
// What it renders as
// ---------------------------------------------------------------------------

test("a composed condition actually renders, inside the shadow root the mock lives in", { skip }, async () => {
  const v = form();
  const html = pictureOf(v, {
    label: "Both missing, submitting",
    holds: { "deal-name": "invalid", borrower: "invalid", continue: "busy", matches: "loading" },
  });

  /**
   * ⛔ IN A SHADOW ROOT, because that is where the real page puts it and page CSS does not reach
   * across. The stylesheet goes inside with the markup, exactly as `PT_STYLE` does.
   */
  const page = await openPage(
    `<!doctype html><html><body><div id="host"></div><script>
       const host = document.getElementById("host").attachShadow({ mode: "open" });
       host.innerHTML = ${JSON.stringify(STATE_CSS + html)};
     </script></body></html>`,
  );
  try {
    const look = async (part, prop) =>
      page.evaluate(
        `getComputedStyle(document.getElementById("host").shadowRoot.querySelector('[data-part="${part}"]')).${prop}`,
      );

    /** An invalid field is outlined in red — ⛔ asserted as computed style, not as a class name. */
    assert.match(await look("borrower", "outlineColor"), /rgb\(220, 38, 38\)/, "an invalid field is not outlined");
    assert.match(await look("borrower", "outlineStyle"), /solid/);

    /** ⛔ AND IT SAYS THE WORDS. A red border with no message is the defect, not the fix. */
    const says = await page.evaluate(
      `getComputedStyle(document.getElementById("host").shadowRoot.querySelector('[data-part="borrower"]'), "::after").content`,
    );
    assert.match(says, /Borrower is required\./, `the message does not render: ${says}`);

    /** A busy control cannot be pressed, and says so by not accepting pointers. */
    assert.equal(await look("continue", "pointerEvents"), "none", "a busy button is still pressable");

    /** A loading region hides its contents rather than showing stale ones. */
    assert.equal(await look("matches", "color"), "rgba(0, 0, 0, 0)", "a loading region still shows its text");

    /** ⛔ And an unheld part is untouched, or every state would look like every other. */
    assert.equal(await look("deal-name", "pointerEvents"), "auto");
    const quiet = await page.evaluate(
      `getComputedStyle(document.getElementById("host").shadowRoot.querySelector('[data-part="continue"]'), "::after").content`,
    );
    assert.ok(!/required/.test(quiet), "a button inherited a field's message");
  } finally {
    await page.close();
  }
});

test("the stylesheet says something about every kind, so none renders as nothing", () => {
  /**
   * ⛔ A KIND WITH NO RULE COMPOSES CORRECTLY AND LOOKS IDENTICAL TO THE DEFAULT. That is the one
   * failure mode of marking rather than rewriting, so it is pinned here rather than noticed later.
   */
  for (const kind of PartStateKind.options) {
    assert.ok(
      STATE_CSS.includes(`[data-in="${kind}"]`),
      `"${kind}" has no appearance — a state using it would render as though nothing had happened`,
    );
  }
});

// ---------------------------------------------------------------------------
// A state changes anything on screen, not only a condition
// ---------------------------------------------------------------------------

test("a state can hide a part, change its words, or both — not only put it in a condition", () => {
  /**
   * ⛔ THE HALF THE FIRST CUT COULD NOT SAY. Peter: *"it can change anything on screen"*. A loading
   * state that also hides the toolbar, or an error state that swaps the heading, had nowhere to go
   * — and the only way to express it was the whole second screenshot this work exists to remove.
   */
  const v = form();
  const html = pictureOf(v, {
    label: "Checking the folder",
    holds: {
      matches: "loading",
      continue: { hidden: true },
      borrower: { in: "invalid", says: "That sponsor is already on another deal." },
    },
  });

  assert.match(html, /data-part="matches" data-in="loading"/);
  assert.match(html, /data-part="continue" data-gone="true"/, "a hidden part was not marked");

  /** ⛔ The state's own words win over the part's — the exception is sayable in one place. */
  assert.match(html, /data-says="That sponsor is already on another deal\."/);
  assert.ok(!html.includes("Borrower is required."), "the part's default message overrode the state's");
});

test("the short and long forms mean the same thing, read through one function", () => {
  /**
   * ⛔ Every caller asking "string or object?" is a caller that gets it wrong once, and the bug
   * would be a state that silently changes nothing.
   */
  assert.deepEqual(differenceOf("invalid"), { in: "invalid" });
  assert.deepEqual(differenceOf({ in: "busy" }), { in: "busy" });
  assert.deepEqual(differenceOf({ hidden: true }), { hidden: true });

  const v = form();
  assert.equal(
    pictureOf(v, { label: "a", holds: { borrower: "invalid" } }),
    pictureOf(v, { label: "a", holds: { borrower: { in: "invalid" } } }),
    "the two forms composed differently",
  );
});

test("a difference that says nothing is different is refused", () => {
  const got = View.safeParse({ id: "v", title: "V", states: [{ label: "Nothing", holds: { thing: {} } }] });
  assert.equal(got.success, false, "a state claimed a part was different and said how in no way");
  assert.match(JSON.stringify(got.error.issues), /says nothing is different/);
});

test("a product's own condition composes and is marked, without this file inventing a look", () => {
  /**
   * ⛔ WHAT IT MUST NOT DO IS GUESS. Deciding what `syncing` looks like would be this file making a
   * design decision for somebody else's product; rendering it as nothing would be worse — a
   * reviewer shown the default screen while being asked about a case it does not contain.
   */
  const base = form();
  const v = {
    ...base,
    parts: [
      ...base.parts,
      {
        id: "sync-badge",
        role: "display",
        label: "Sync",
        states: [{ kind: "syncing" }, { kind: "stale", says: "Last synced 2 days ago." }],
      },
    ],
    sketch_html: base.sketch_html + '<span data-part="sync-badge">Synced</span>',
  };

  assert.match(pictureOf(v, { label: "Syncing", holds: { "sync-badge": "syncing" } }), /data-part="sync-badge" data-in="syncing"/);

  /** ⛔ The catch-all rule is what keeps it visible rather than invisible. */
  assert.match(STATE_CSS, /\[data-in\]:not/, "a declared condition would render as nothing at all");

  /** A declared condition carrying words still says them, through the same rule as a built-in. */
  assert.match(pictureOf(v, { label: "Stale", holds: { "sync-badge": "stale" } }), /data-says="Last synced 2 days ago\."/);
});

test("a condition no part declares is reported, which is the spell check openness still allows", () => {
  /**
   * ⛔ Nothing can say `syncing` belongs on a region rather than a button, but it can say no part
   * claims that condition at all — catching the typo that would otherwise compose to a mark no
   * stylesheet mentions and render as though nothing had happened.
   */
  const v = form();
  assert.deepEqual(undeclaredConditions(v, { label: "Typo", holds: { borrower: "invald" } }), [
    { part: "borrower", condition: "invald" },
  ]);
  assert.deepEqual(undeclaredConditions(v, { label: "Fine", holds: { borrower: "invalid" } }), []);

  /** ⛔ Hiding a part declares no condition, so it must not be reported as an undeclared one. */
  assert.deepEqual(undeclaredConditions(v, { label: "Hidden", holds: { continue: { hidden: true } } }), []);
});
