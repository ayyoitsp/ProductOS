/**
 * Statements filed under the wrong question.
 *
 * ⛔ THE RISK HERE IS NOT A MISS, IT IS A MOVE. A statement left in `answer` costs a blank slot,
 * which every other part of this system already reports. A statement moved wrongly arrives under a
 * question it does not answer, carrying a v1 id and a review history — so it looks settled. Every
 * case below is either a sentence that fooled the first version or one that must not move.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { reslot } from "../dist/v2/reslot.js";

/** One exchange whose `answer` holds the given statements, and nothing else filled. */
const scopeWith = (...says) => ({
  id: "s",
  exchanges: [{ id: "e", at: { view: "v" }, asked_by: "person", slots: { answer: { says } } }],
});

test("a failure the asker is shown moves to fails", () => {
  const got = reslot(
    scopeWith({
      id: "a-failed-load-is-reported-and-keeps-the-last-list",
      says: "When the list cannot be loaded, the reason is shown above the table and the previously loaded page stays on screen.",
    })
  );
  assert.equal(got.length, 1);
  assert.equal(got[0].to, "fails");
  assert.equal(got[0].from, "answer");
  /** ⛔ The words do not change and neither does the id. */
  assert.match(got[0].says, /the reason is shown above the table/);
  assert.equal(got[0].statement, "a-failed-load-is-reported-and-keeps-the-last-list");
  assert.match(got[0].needs, /^a move/);
});

test("a failure mentioned to explain a design decision stays put", () => {
  /**
   * ⛔ THE FALSE POSITIVE THAT WIDENING `could not be` TO `could not <verb>` CREATED. This is a
   * perfectly good `answer` sentence: the failure clause is the REASON the screen is read-only, not
   * something the asker is left with. Moving it would file a design rationale under "what the asker
   * is left with when it cannot do the thing".
   */
  const got = reslot(
    scopeWith({
      id: "nothing-here-is-editable",
      says:
        "Nothing on this screen can be typed into or changed. These are the figures the lender's own model produced in Excel. A Bilrost-side edit could not reach the workbook before the next pull, so there is no version of this screen that recomputes a deal live.",
    })
  );
  assert.deepEqual(got, [], "a design rationale was filed as a failure");
});

test("a failure in the active voice is caught too", () => {
  /** ⛔ `could not record`, not `could not be recorded` — one of only two real misses in the corpus,
   * and invisible to a pattern anchored on "could not be". */
  const got = reslot(
    scopeWith({
      id: "departures-that-could-not-be-written-down-are-named",
      says:
        "Where the capture found departures it could not record, the screen says the list is incomplete and how many are missing from it.",
    })
  );
  assert.equal(got.length, 1);
  assert.equal(got[0].to, "fails");
});

test("a uniqueness rule is a refusal stated as a property", () => {
  /** ⛔ The other real miss. Stated as a fact about the data; the only thing it actually says is
   * what happens when you try. */
  const got = reslot(
    scopeWith({
      id: "a-structure-name-is-unique-within-a-lender",
      says:
        "Two structures in one lender's catalogue cannot share a name. A repeated name is reported before the catalogue is saved, naming the name that repeats.",
    })
  );
  assert.equal(got.length, 1);
  assert.equal(got[0].to, "refuses");
});

test("a statement bound for refuses is a rewrite, and says so", () => {
  /**
   * ⛔ `refuses` HOLDS NAMED CASES, NOT A SENTENCE. Six of the seven slots take a sentence, so
   * relocating one is exactly a move. This one has to become a `name`, a `when` and the `told` the
   * asker reads — which is authoring. A proposal that called it a move would hand somebody a
   * rewrite under the wrong label.
   */
  const got = reslot(
    scopeWith({
      id: "publishing-is-refused-while-an-exception-is-unacknowledged",
      says: "Publishing is refused while any exception the server raised is unacknowledged.",
    })
  );
  assert.equal(got[0].to, "refuses");
  assert.match(got[0].needs, /named case/);
  assert.match(got[0].needs, /when/);
  assert.match(got[0].needs, /told/);
});

test("an ordinary answer is left alone", () => {
  const got = reslot(
    scopeWith(
      { id: "a-row-opens-the-deal", says: "Selecting any part of a row opens that deal's workspace." },
      {
        id: "a-row-identifies-the-deal",
        says: "Each row shows the deal's name, the sponsor it was created under and the property address.",
      }
    )
  );
  assert.deepEqual(got, []);
});

test("nothing is proposed on top of an answer somebody already gave", () => {
  /** ⛔ Moving a statement onto a filled slot is merging two answers, which is a larger act than
   * filing one and is nobody's request. */
  const scope = {
    id: "s",
    exchanges: [
      {
        id: "e",
        at: { view: "v" },
        asked_by: "person",
        slots: {
          answer: {
            says: [
              {
                id: "a-failed-load",
                says: "When the list cannot be loaded, the reason is shown above the table.",
              },
            ],
          },
          fails: { says: "They keep the list they already had, and are told why." },
        },
      },
    ],
  };
  assert.deepEqual(reslot(scope), [], "it proposed over a sentence a person had already written");
});

test("a single-sentence answer is not picked apart", () => {
  /** ⛔ Only a LIST of statements has addressable members. A slot holding one string has no id to
   * move and no way to leave the rest behind, so splitting it would be rewriting the answer. */
  const scope = {
    id: "s",
    exchanges: [
      {
        id: "e",
        at: { view: "v" },
        asked_by: "person",
        slots: { answer: { says: "When the list cannot be loaded, the reason is shown above the table." } },
      },
    ],
  };
  assert.deepEqual(reslot(scope), []);
});
