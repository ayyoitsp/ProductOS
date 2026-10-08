/**
 * ⛔ THE STATES ARE DERIVED, NOT WRITTEN DOWN.
 *
 * Peter: *"THE WHOLE SYSTEM IS TO MAKE IT EASIER TO INFER SHIT NEEDS TO BE DONE, WHY WOULD WE ASK
 * PEOPLE TO WRITE ANYTHING DOWN?"* — and then, on the design: *"Yes, let's make this derivable."*
 *
 * Three slots describe nothing but view states and have since the slots existed. `refuses` carries
 * a name, the condition it fires under, and the words the asker reads; `fails` says what they are
 * left with; `again` says what happens on a second press, which is the in-flight moment no code
 * reader could ever find because it is not a render branch.
 *
 * ⛔ THE HARD PART IS KNOWING WHEN TO STOP. An error placed on the wrong field is worse than an
 * error with no field at all: the picture looks correct, somebody agrees to it, and the sentence
 * they agreed to was about a different control. So the tests that matter here are the ones that
 * assert it REFUSES to place something, and says why.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { deriveStates, partsForRefusal } from "../dist/v2/derive-states.js";
import { pictureOf } from "../dist/v2/states.js";
import { parseFrontmatter } from "../dist/core/frontmatter.js";

/** A form with two fields, a commit, and a region, as a corpus holds one. */
const view = () => ({
  id: "create-deal-form",
  sketch_html:
    "<form>" +
    '<input data-part="deal-name" />' +
    '<input data-part="borrower" />' +
    '<button data-part="continue">Continue</button>' +
    '<div data-part="matches">a match</div>' +
    "</form>",
  parts: [
    { id: "deal-name", role: "entry", label: "Deal Name", states: [] },
    { id: "borrower", role: "entry", label: "Borrower", states: [] },
    { id: "continue", role: "commits", label: "Continue", states: [] },
    { id: "matches", role: "region", label: "Matching folders", states: [] },
  ],
});

test("a named refusal becomes a state, with its own trigger and its own words", () => {
  const scope = {
    exchanges: [
      {
        id: "create-deal-form",
        at: { view: "create-deal-form", part: "continue" },
        slots: {
          refuses: {
            outcomes: [
              { name: "borrower-required", when: "the borrower is blank", told: "Borrower is required." },
            ],
          },
        },
      },
    ],
  };

  const { states, conditions, unplaced } = deriveStates(scope, view());
  assert.deepEqual(unplaced, []);
  assert.equal(states.length, 1);

  const st = states[0];
  assert.equal(st.label, "Borrower required", "the label is not the product's own word for the case");
  assert.equal(st.when, "the borrower is blank", "the trigger was not carried across");
  assert.deepEqual(st.holds, { borrower: { in: "invalid", says: "Borrower is required." } });
  assert.equal(st.from, "create-deal-form#refuses/borrower-required", "nothing records that this was derived");

  /** The part gains the condition too, so `undrawnConditions` can ask about it later. */
  assert.deepEqual(conditions, [
    {
      part: "borrower",
      condition: "invalid",
      says: "Borrower is required.",
      from: "create-deal-form#refuses/borrower-required",
    },
  ]);

  /** ⛔ And it composes onto the one picture, which is the whole point. */
  assert.match(pictureOf(view(), st), /data-part="borrower" data-in="invalid" data-says="Borrower is required\."/);
});

test("`again` becomes the in-flight state — the one nothing could harvest from code", () => {
  /**
   * ⛔ PRESSING TWICE ONLY MEANS SOMETHING IF THERE IS A DURING. `create-deal-form`'s Continue
   * button carries a `disabled:` style in its own markup, so the code has a pending moment — and no
   * drawn state had it, because pending is not a branch a render-tree reader can see.
   */
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form", part: "continue" },
        slots: { again: { says: "Pressing Continue twice creates one deal, not two." } },
      },
    ],
  };

  const { states, conditions } = deriveStates(scope, view());
  assert.equal(states.length, 1);
  assert.equal(states[0].label, "While it works");
  assert.equal(states[0].holds.continue.in, "busy");
  assert.match(states[0].holds.continue.says, /one deal, not two/);

  /** ⛔ `disabled` as well: stopping the second press is how a product usually answers `again`. */
  assert.deepEqual(
    conditions.map((c) => `${c.part}/${c.condition}`).sort(),
    ["continue/busy", "continue/disabled"],
  );
});

test("`fails` lands on something that can show a failure, never on the button", () => {
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form" },
        slots: { fails: { says: "The folder could not be reached, and the deal exists without one." } },
      },
    ],
  };
  const { states, conditions } = deriveStates(scope, view());
  assert.equal(states[0].holds.matches.in, "failed");
  assert.equal(conditions[0].part, "matches");

  /**
   * ⛔ A SCREEN WITH NOTHING THAT CAN SHOW A FAILURE SAYS SO. My first version of this asserted it
   * would fall back to the button — and the code reported instead, which is the better answer: a
   * failure message is not a thing a button shows, and inventing a place for it would put the
   * sentence somewhere nobody designed.
   */
  const onlyAButton = { ...view(), parts: [{ id: "continue", role: "commits", label: "Continue", states: [] }] };
  const nowhere = deriveStates(scope, onlyAButton);
  assert.deepEqual(nowhere.states, [], "it invented a place for a failure");
  assert.match(nowhere.unplaced[0].why, /nothing that could show a failure/);

  /** ⛔ But where the ask ARRIVES at a control, the failure is reported there — `invalid`, not `failed`. */
  const atTheButton = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form", part: "continue" },
        slots: { fails: { says: "The folder could not be reached." } },
      },
    ],
  };
  const onIt = deriveStates(atTheButton, onlyAButton);
  assert.equal(onIt.states[0].holds.continue.in, "invalid", "a control was marked failed");
});

test("`cannot_fail` is a real answer and asserts no state", () => {
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form" },
        slots: { fails: { says: "n/a", cannot_fail: "it is a local form with nothing to call" } },
      },
    ],
  };
  assert.deepEqual(deriveStates(scope, view()).states, [], "a stated impossibility produced a state");
});

// ---------------------------------------------------------------------------
// Knowing when to stop
// ---------------------------------------------------------------------------

test("a refusal naming two fields is reported, not placed on the first one", () => {
  /**
   * ⛔ THE CASE THAT MUST NOT BE GUESSED. "the deal name or the borrower is blank" is a product
   * decision about which field carries the message, and getting it wrong produces a picture that
   * looks right and says the wrong thing.
   */
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form", part: "continue" },
        slots: {
          refuses: {
            outcomes: [
              /**
               * ⛔ NO DISTRIBUTIVE WORD, which is what makes this the ambiguous case. The first
               * version of this fixture said "Fill in EVERY required field" — and once a
               * distributive word became the signal, that sentence answered the question itself
               * and the test was asserting the old behaviour.
               */
              { name: "incomplete", when: "either the deal name or the borrower is blank", told: "Fill one of them in." },
            ],
          },
        },
      },
    ],
  };
  const { states, unplaced } = deriveStates(scope, view());
  assert.deepEqual(states, [], "it placed a refusal that names two fields");
  assert.equal(unplaced.length, 1);
  assert.match(unplaced[0].why, /names 2 fields/);
  assert.match(unplaced[0].why, /without saying it appears on each/);
  assert.match(unplaced[0].why, /deal-name/);
  assert.match(unplaced[0].why, /borrower/);
  /** ⛔ The question carries the words, so the person is asked something answerable. */
  assert.equal(unplaced[0].told, "Fill one of them in.");
});

test("a refusal naming nothing, on an ask that arrives nowhere, is reported", () => {
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form" },
        slots: {
          refuses: { outcomes: [{ name: "not-yours", when: "the reader is not on the deal", told: "You cannot start a deal here." }] },
        },
      },
    ],
  };
  const { states, unplaced } = deriveStates(scope, view());
  assert.deepEqual(states, []);
  assert.match(unplaced[0].why, /does not arrive at one/);
});

test("a refusal of the whole ask is reported on the control it was made from", () => {
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form", part: "continue" },
        slots: {
          refuses: { outcomes: [{ name: "already-exists", when: "a deal with that name exists", told: "That deal already exists." }] },
        },
      },
    ],
  };
  const { states } = deriveStates(scope, view());
  assert.equal(states[0].holds.continue.in, "disabled", "a refusal of the ask was not reported where it was made");
  assert.equal(states[0].holds.continue.says, "That deal already exists.");
});

test("partsForRefusal explains itself either way, because the reason is the useful part", () => {
  const v = view();
  const named = partsForRefusal(v, { id: "x", at: {} }, { name: "n", when: "the borrower is blank", told: "t" });
  assert.deepEqual(named.parts, ["borrower"]);
  assert.match(named.why, /names this field/);

  const nowhere = partsForRefusal(v, { id: "x", at: {} }, { name: "n", when: "something else", told: "t" });
  assert.deepEqual(nowhere.parts, []);
  assert.ok(nowhere.why.length > 20, "a refusal to place something said nothing a person could act on");
});

test("a refusal that says it appears beside EACH field places on all of them, as one state", () => {
  /**
   * ⛔ THE FIRST REAL SENTENCE THIS WAS ASKED ABOUT ANSWERED IT ITSELF. bilrost's
   * `something-required-is-missing` says *"beside each one that is missing, that it is required"*
   * and names four fields — and the first version reported it as ambiguous. Four fields invalid at
   * once is the exact case a state made of part conditions exists to express, so asking about it
   * was the one-picture-per-state assumption still talking.
   */
  const scope = {
    exchanges: [
      {
        id: "x",
        at: { view: "create-deal-form", part: "continue" },
        slots: {
          refuses: {
            outcomes: [
              {
                name: "something-required-is-missing",
                when: "the deal name or the borrower is blank",
                told: "beside each one that is missing, that it is required",
              },
            ],
          },
        },
      },
    ],
  };

  const { states, unplaced } = deriveStates(scope, view());
  assert.deepEqual(unplaced, [], "it still asked about a sentence that answers itself");
  assert.equal(states.length, 1, "it split one moment into several states");

  /** ⛔ ONE state holding BOTH — splitting it would ask somebody to agree twice to one decision. */
  assert.deepEqual(Object.keys(states[0].holds).sort(), ["borrower", "deal-name"]);
  assert.equal(states[0].holds.borrower.in, "invalid");
  assert.equal(states[0].holds["deal-name"].in, "invalid");

  /** ⛔ AND IT IS THE WORD, NOT THE COUNT. "either/or" with no distributive word keeps asking. */
  const either = partsForRefusal(
    view(),
    { id: "x", at: {} },
    { name: "n", when: "either the deal name or the borrower is blank", told: "Fill one in." },
  );
  assert.deepEqual(either.parts, [], "plurality alone was treated as meaning every field");
  assert.match(either.why, /without saying it appears on each/);
});

test("a screen with no exchanges derives nothing, rather than inventing a default", () => {
  assert.deepEqual(deriveStates({ exchanges: [] }, view()), { states: [], conditions: [], unplaced: [] });
  assert.deepEqual(deriveStates({}, view()).states, []);
});

// ---------------------------------------------------------------------------
// Against the real corpus
// ---------------------------------------------------------------------------

const BILROST = "/Users/peter/repositories/bilrost/bilrost-workers/v2/truth";

test(
  "it runs over a real corpus and never places a refusal it cannot justify",
  { skip: fs.existsSync(BILROST) ? false : "the bilrost corpus is not on this machine" },
  () => {
    /**
     * ⛔ THE ONLY HONEST TEST OF A DERIVATION IS SOMEBODY'S REAL SENTENCES. A fixture proves the
     * code runs; a corpus written without this feature in mind proves the sentences carry enough.
     */
    let views = 0;
    let derived = 0;
    let asked = 0;

    for (const file of fs.readdirSync(BILROST).filter((f) => f.endsWith(".md"))) {
      const { data } = parseFrontmatter(fs.readFileSync(`${BILROST}/${file}`, "utf-8"));
      for (const v of data?.views ?? []) {
        views++;
        const out = deriveStates(data, { id: v.id, parts: v.parts ?? [], sketch_html: v.sketch_html });
        derived += out.states.length;
        asked += out.unplaced.length;

        /** Every derived state must compose onto a part the screen actually has. */
        for (const st of out.states) {
          const ids = Object.keys(st.holds);
          /**
           * ⛔ AT LEAST ONE, NOT EXACTLY ONE. I asserted exactly one and the corpus produced a
           * four-part state from "beside each one that is missing" — which is the feature, not a
           * fault. Several parts at once is the whole reason a state is conditions rather than a
           * picture.
           */
          assert.ok(ids.length >= 1, `${v.id}: a derived state holds no parts`);
          for (const id of ids)
            assert.ok(
              (v.parts ?? []).some((p) => p.id === id),
              `${v.id}: derived a condition on "${id}", which this screen does not have`,
            );
          assert.ok(st.from, `${v.id}: a derived state does not record where it came from`);
        }

        /** And every question it asks must carry the words, or nobody can answer it. */
        for (const u of out.unplaced) {
          assert.ok(u.told && u.told.length > 3, `${v.id}: asked about "${u.outcome}" without the words`);
          assert.ok(u.why && u.why.length > 20, `${v.id}: asked about "${u.outcome}" without saying why`);
        }
      }
    }

    /**
     * ⛔ 17, NOT 36. The corpus has 36 scopes and most are capabilities with no screens at all —
     * I asserted >20 on the scope count and the real figure is the view count. Worth keeping the
     * floor, worth it being the right number.
     */
    assert.ok(views > 10, `only ${views} views read — the corpus moved and this proves less than it looks`);
    /** ⛔ Reported rather than asserted: what matters is that it ran clean over 36 real features. */
    console.log(`      bilrost: ${views} screens · ${derived} states derived · ${asked} questions to ask`);
  },
);
