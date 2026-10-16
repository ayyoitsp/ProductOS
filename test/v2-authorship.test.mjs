/**
 * ⛔ THREE SITUATIONS WORE ONE LABEL, AND THE MVP DEPENDS ON SEPARATING THEM.
 *
 * From the usability review: *"A claim an agent inferred from a call transcript and a claim a PM
 * typed but has not yet confirmed both read 'not confirmed'. A grooming agent needs to tell them
 * apart, because the first should be raised as a question in the ticket and the second only needs a
 * stamp."* And "not confirmed" is also what a sentence nobody has ever looked at says — so there
 * were three states and one word for all of them.
 *
 * ⛔ A ZERO PROVES NOTHING UNLESS YOU CAN SAY WHAT A FAILING ZERO LOOKS LIKE. The failing version of
 * this file is the one where all three cases come back the same value, so every assertion below
 * names the OTHER two it must not equal. Verified red-first: with the precedence in `authorshipOf`
 * reversed (slot before statement), "an agent's sentence inside a person's slot" reports `person`
 * and this file fails; with `handOf` defaulting to `"person"` instead of `"unrecorded"`, the
 * migrated case fails.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import {
  Authorship,
  SlotFill,
  Statement,
  Rule,
  RefusalOutcome,
  authorshipOf,
  handOf,
  criterionHand,
} from "../dist/v2/schema.js";
import { loadCorpus } from "../dist/v2/load.js";
import { stampFor } from "../dist/v2/stamp.js";
import { confidenceOf } from "../dist/v2/confidence.js";
import { preview, perform, wroteBy } from "../dist/v2/acts.js";

const SEED = path.resolve("v2-seed");
const seeded = () => {
  const dir = temp("v2authorship-");
  fs.cpSync(SEED, dir, { recursive: true });
  return dir;
};

const PERSON = { hand: "person", as: "peter" };
const AGENT = { hand: "agent", as: "productos-machinist", from: "the spend handler in SpendForm.tsx:112" };

// ---------------------------------------------------------------------------
// The three outcomes, out of the built module.

test("a person's claim, an agent's claim and a migrated claim are three different answers", () => {
  const person = handOf({ wrote: PERSON });
  const agent = handOf({ wrote: AGENT });
  /** ⛔ The migrated case: nothing recorded it, which is absence and not a value. */
  const migrated = handOf({ says: "What v1 said, carried across verbatim." });

  assert.equal(person, "person");
  assert.equal(agent, "agent");
  assert.equal(migrated, "unrecorded");

  assert.equal(new Set([person, agent, migrated]).size, 3, "three situations must not share one label");
  /** ⛔ The specific collapse the review names: an inference reading as somebody's draft. */
  assert.notEqual(agent, person);
  assert.notEqual(migrated, person, "absence must never be read as a person having typed it");
});

test("a claim with no author at all answers the same as one in a corpus nobody attributed", () => {
  assert.equal(handOf(undefined), "unrecorded");
  assert.equal(handOf(null, undefined), "unrecorded");
});

// ---------------------------------------------------------------------------
// The grain. ⛔ This is where a slot-only field would have lied.

test("an agent's statement inside a person's slot reports the agent", () => {
  const fill = SlotFill.parse({
    says: [
      { id: "money-comes-off", says: "The amount is taken off what the kid has.", wrote: PERSON },
      { id: "history-entry", says: "The act appears at the top of their history, dated today.", wrote: AGENT },
      { id: "returned", says: "The parent is returned to the kid's money." },
    ],
    wrote: PERSON,
  });
  const [typed, inferred, neither] = fill.says;

  assert.equal(handOf(typed, fill), "person");
  /**
   * ⛔ THE WHOLE REASON THE FIELD IS AT THIS GRAIN. A slot of statements a person wrote that gains
   * one an agent inferred must report the agent FOR THAT ONE — otherwise the single claim a
   * grooming agent has to raise is filed under the hand that wrote its neighbours.
   */
  assert.equal(handOf(inferred, fill), "agent");
  assert.notEqual(handOf(inferred, fill), handOf(typed, fill));
  /** A statement that records nothing falls through to the slot, which does. */
  assert.equal(handOf(neither, fill), "person");
  assert.equal(authorshipOf(inferred, fill).from, AGENT.from);
});

test("a named refusal carries its own hand, and falls through to the slot when it does not", () => {
  const fill = SlotFill.parse({
    outcomes: [
      { name: "not-yours", when: "the kid is not theirs", told: "Nothing about this kid.", wrote: AGENT },
      { name: "too-much", when: "the amount is larger than what they have", told: "There is not that much." },
    ],
    wrote: PERSON,
  });
  assert.equal(handOf(fill.outcomes[0], fill), "agent");
  assert.equal(handOf(fill.outcomes[1], fill), "person");
});

test("a rule records its own hand and has nothing to fall through to", () => {
  const rule = Rule.parse({
    id: "only-a-parent-moves-money",
    statement: "Only a parent may change what a kid has, on any screen in the product.",
    in: "family-wallet",
    fills: ["may"],
    mode: "supplies",
    scope: { term: "money", acts_on: "changes", asked_by: "person" },
    criteria: [{ id: 1, slot: "may", kind: "conformance", then: "a kid pressing it is refused" }],
    wrote: AGENT,
  });
  assert.equal(handOf(rule), "agent");
  assert.equal(handOf({ ...rule, wrote: undefined }), "unrecorded");
});

// ---------------------------------------------------------------------------
// ⛔ The line it must not cross.

test("authorship is unreadable as consent — no value of it moves a stamp or a confidence", () => {
  const dir = seeded();
  const file = path.join(dir, "truth", "money.md");
  const ref = "money#record-earning#after";
  const before = loadCorpus(dir);
  const stampBefore = stampFor(before, ref);
  const confBefore = confidenceOf(before, ref);

  /** The strongest-looking authorship the schema permits, written by hand onto a slot. */
  const original = fs.readFileSync(file, "utf-8");
  const patched = original.replace(
    "        says: The kid has that much more than they had before.",
    "        says: The kid has that much more than they had before.\n" +
      "        wrote: { hand: person, as: peter }"
  );
  assert.notEqual(patched, original, "the fixture slot should have been found");
  fs.writeFileSync(file, patched, "utf-8");

  const after = loadCorpus(dir);
  assert.equal(handOf(after.scopes.find((s) => s.scope.id === "money").scope.exchanges.find((e) => e.id === "record-earning").slots.after), "person");

  const stampAfter = stampFor(after, ref);
  const confAfter = confidenceOf(after, ref);
  /**
   * ⛔ THE PROPERTY, NOT A HABIT. `via` is the single most protected field in the model because
   * `mayRecord` refuses a token that claims a human one. Authorship answers a different question
   * and must never answer that one: a sentence a person TYPED is still a sentence nobody agreed to.
   */
  assert.equal(stampAfter.state, stampBefore.state, "writing an author must not change whether anything is accepted");
  assert.equal(confAfter.confirmed, confBefore.confirmed, "writing an author must not confirm anything");
  assert.equal(confAfter.strength, confBefore.strength, "writing an author must not strengthen anything");
  assert.equal(confAfter.sources, confBefore.sources);
  assert.equal(confAfter.inherited.length, confBefore.inherited.length);
});

test("the schema charges the stronger claim, and refuses an unattributable one", () => {
  /** ⛔ `person` suppresses the question an `agent` claim raises, so it has to name whom. */
  assert.equal(Authorship.safeParse({ hand: "person" }).success, false, "`person` with no name is the cheapest lie available");
  assert.equal(Authorship.safeParse({ hand: "person", as: "peter" }).success, true);
  /** ⛔ `agent` has to say what it read, or the question raised in a ticket is unanswerable. */
  assert.equal(Authorship.safeParse({ hand: "agent", as: "productos-scoper" }).success, false);
  assert.equal(Authorship.safeParse(AGENT).success, true);
  /** ⛔ There is no third value. Unknown is absence, so it cannot be asserted as a fact. */
  assert.equal(Authorship.safeParse({ hand: "unrecorded", as: "x" }).success, false);
  assert.equal(Authorship.safeParse({ hand: "nobody", as: "x" }).success, false);
  /** ⛔ And it cannot smuggle a surface in beside the hand. */
  assert.equal(Authorship.safeParse({ hand: "person", as: "peter", via: "page" }).success, false);
  /** Every grain accepts the same shape and nothing else. */
  assert.equal(Statement.safeParse({ id: "x", says: "A sentence long enough.", wrote: PERSON }).success, true);
  assert.equal(RefusalOutcome.safeParse({ name: "x-y", when: "something", told: "a message", wrote: AGENT }).success, true);
});

// ---------------------------------------------------------------------------
// The write paths.

test("an act writes the hand its own `via` implies, and a model cannot claim a person's", () => {
  /**
   * ⛔ DERIVED FROM `via`, which is what `mayRecord` already refuses a token for claiming. There is
   * no flag that sets this, so there is no second gate to keep in step with the first.
   */
  assert.equal(wroteBy({ by: "peter", via: "cli" }).hand, "person");
  assert.equal(wroteBy({ by: "peter", via: "page" }).hand, "person");
  assert.equal(wroteBy({ by: "peter", via: "question" }).hand, "person");
  assert.equal(wroteBy({ by: "peter", via: "chat" }).hand, "person");
  const software = wroteBy({ by: "a-session", via: "agent" });
  assert.equal(software.hand, "agent");
  assert.ok(software.from, "software's words have to say where they came from");
  /** Whatever it is handed, the shape it produces is one the schema accepts. */
  for (const via of ["page", "question", "chat", "cli", "agent"])
    assert.equal(Authorship.safeParse(wroteBy({ by: "x", via })).success, true, via);
});

test("ruling a question records who supplied the sentence", () => {
  const dir = seeded();
  const ref = "money#record-spending#again";
  const corpus = loadCorpus(dir);
  const ex = corpus.scopes
    .find((s) => s.scope.id === "money")
    .scope.exchanges.find((e) => e.id === "record-spending");
  assert.ok(ex, "the seed should carry this exchange");
  assert.equal(handOf(ex.slots.again), "unrecorded", "nothing in the seed records an author");

  const out = perform(
    dir,
    "rule",
    {
      slot: ref,
      says: "A second press on the same day changes nothing — the allowance is applied once a day.",
      because: "Applying it twice would hand out money nobody offered, which is the one failure this product cannot have.",
    },
    { by: "peter", via: "cli" }
  );
  assert.equal(out.ok, true, out.ok ? "" : `${out.why} — ${(out.detail ?? []).join(" / ")}`);

  const after = loadCorpus(dir);
  const slot = after.scopes
    .find((s) => s.scope.id === "money")
    .scope.exchanges.find((e) => e.id === "record-spending").slots.again;
  assert.equal(handOf(slot), "person", "a person typed this sentence at the command line");
  assert.equal(authorshipOf(slot).as, "peter");
  /** ⛔ Still not agreed. A ruling is a decision about the question, not a stamp on the sentence. */
  assert.equal(stampFor(after, ref).state, "never", "writing an author must not produce an acceptance");
});

test("a migrated corpus answers `unrecorded` for every claim in it", () => {
  /**
   * ⛔ THE COMMONEST ANSWER, AND IT IS A REAL ONE. v1 recorded nothing about who typed a claim, so
   * the migration writes nothing — `person` would be the tool deciding on no evidence that a human
   * read every sentence it copied, and `agent` would be a lie about words somebody may well have
   * written years ago. Asserted over the seed, which is the corpus every other test reads.
   */
  const corpus = loadCorpus(SEED);
  const claims = [];
  for (const { scope } of corpus.scopes)
    for (const ex of scope.exchanges)
      for (const [name, fill] of Object.entries(ex.slots ?? {})) {
        if (!fill) continue;
        claims.push([`${scope.id}#${ex.id}#${name}`, handOf(fill)]);
        for (const s of Array.isArray(fill.says) ? fill.says : [])
          claims.push([`${scope.id}#${ex.id}#${name}#${s.id}`, handOf(s, fill)]);
      }
  assert.ok(claims.length > 20, `expected the seed to hold claims, saw ${claims.length}`);
  assert.deepEqual(
    claims.filter(([, hand]) => hand !== "unrecorded"),
    [],
    "nothing in a corpus written before this field existed may claim an author"
  );
});

test("a criterion answers from what derived it, and absence is still unrecorded", () => {
  /** ⛔ No second field beside `derived` — one fact, one home. */
  assert.equal(criterionHand({ derived: { by: "productos-demonstrator", at: "2026-10-16", from: "sha256:abc12345" } }), "agent");
  assert.equal(criterionHand({}), "unrecorded");
  assert.notEqual(criterionHand({}), "person", "a typed criterion and an unattributed one are not the same record");
});

// ---------------------------------------------------------------------------
// What a person is told at the moment they are asked to agree.

test("the accept preview says whose words these are, in all three cases", () => {
  const dir = seeded();
  const file = path.join(dir, "truth", "money.md");
  const ref = "money#record-earning#after";

  const unattributed = preview(dir, "accept", { target: ref });
  assert.equal(unattributed.ok, true);
  assert.match(unattributed.reads.join("\n"), /nobody recorded who wrote this/i);

  const original = fs.readFileSync(file, "utf-8");
  fs.writeFileSync(
    file,
    original.replace(
      "        says: The kid has that much more than they had before.",
      "        says: The kid has that much more than they had before.\n" +
        "        wrote: { hand: agent, as: productos-machinist, from: the ledger write in recordEarning.ts }"
    ),
    "utf-8"
  );
  const inferred = preview(dir, "accept", { target: ref });
  assert.equal(inferred.ok, true);
  const said = inferred.reads.join("\n");
  assert.match(said, /worked out by productos-machinist/);
  assert.match(said, /nobody has read them/);
  assert.doesNotMatch(said, /nobody recorded who wrote this/i, "it knows who wrote this one");
});
