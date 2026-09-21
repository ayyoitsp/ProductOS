/**
 * ⛔ THE REFUSALS ARE PINNED, BECAUSE DELETING ONE LOOKS LIKE PROGRESS.
 *
 * Twice in one session a block of `check.ts` was spliced out while restructuring the code
 * beside it. Both times the only symptom was the note count going DOWN — which reads as the
 * corpus getting healthier, not as the framework going blind. A tool whose entire claim is
 * that it refuses things cannot have its refusals guarded by somebody noticing a smaller
 * number.
 *
 * `v2-foil/` is a corpus built out of the attacks reviewers actually used. Every kind below
 * must fire on it, and nothing may fire on the pristine seed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCorpus } from "../dist/v2/check.js";
import { loadCorpus } from "../dist/v2/load.js";
import { compilePacket } from "../dist/v2/packet.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Every finding the foil is built to provoke, and what it would mean to lose it. */
const MUST_FIRE = {
  /**
   * ⛔ The eighth slot and the two checks that keep it honest. Before `after` existed, the state
   * change lived as a clause inside `answer` prose: deleting *"the amount is added to what the kid
   * has"* from the pristine seed produced a check output BYTE-IDENTICAL to the original. The money
   * moving, in a pocket-money product, could leave the product truth with every surface reporting
   * the corpus fine — while `changes: [money, balance]` went on claiming otherwise.
   */
  /**
   * ⛔ An exemption from a rule nobody has settled. `excepts` only checked the rule EXISTED, so a
   * reasoned exemption from an unwritten sentence rendered as `⊗Rn` and printed to the builder as a
   * considered decision — and nothing would revisit it once the rule was settled, because the
   * exchange had not changed and its acceptance stamp stayed current.
   */
  /**
   * ⛔ A slot declaring it cannot hold with an org-wide RULE. Reported on the accusing side only —
   * the rule stayed in the ready-to-accept list and `accept` stamped it clean, and one accept on a
   * rule reaches every exchange its selector touches.
   */
  "a-slot-says-this-rule-cannot-hold": "the widest stamp in the model, with a contradiction it could not see",
  "excepts-a-rule-nobody-has-written": "a reasoned exemption from a sentence nobody has read",
  "declares-against-a-rule-nobody-has-written": "the same act at slot grain, which costs the same",
  "says-it-changes-nothing-and-declares-otherwise": "a declared state change with no sentence saying what changed",
  "leaves-something-nothing-declares": "something left behind that no other promise can discover",
  "nothing-demonstrates-what-it-leaves-behind": "the clause with no criterion is the one that goes missing",
  "criterion-asserts-more-than-the-slot": "the criterion is what an engineer implements",
  "criterion-asserts-more-than-the-rule": "a rule criterion reaches every exchange it governs",
  "one-press-two-answers": "two exchanges at one control gave the same press two answers",
  "leads-nowhere": "a sketch promising a screen nobody wrote is one an engineer will invent",
  "depends-on-nothing": "a dependency on something absent is a hole with a confident name",
  "accepts-nothing": "a human's act of acceptance recorded against nothing was silently dropped",
  "acceptance-is-stale": "a stamp that outlived its claim reads as reviewed and was not",
  "ruled-but-not-written": "a ruling recorded and not applied makes the corpus re-ask an answered question",
  "a-person-could-not-build-from-this": "the one signal nothing can compute",
  "rule-governs-nothing": "a principle carrying no weight, which is what v1 could not surface",
  "named-in-a-dispute": "the far side of a contradiction otherwise reads as settled",
  "nothing-in-this-product-sets-this": "an unowned entity, which is not a subsystem",
  "nothing-demonstrates-this": "a promise with nothing that would show it",
  "slot-disputed": "a standing a person has to move",
  "two-rules-answer-this": "which org rule wins was decided by filename",
  "latitude-nobody-granted": "the strongest claim in the schema, made by an edit rather than an act",
  "demonstrates-nothing": "a criterion pointing at a slot nothing answers",
  "two-things-share-an-id": "two scopes declaring one screen was the escape from one-press-two-answers",
  "owns-no-promise": "a container named after data, standing in for a component that owns something",
  "follows-nothing": "machinery following an ask nobody can find",
  "names-no-rule": "a declaration naming a rule that does not exist, printed to the builder as considered",
  "declares-against-nothing": "a formal exemption from a rule that was never there",
  "says-nothing-sets-this-and-something-does": "an unverified claim that silenced requirement 3's detector and printed to the builder",
};

/**
 * Attacks the SCHEMA must refuse, in their own corpus.
 *
 * ⛔ They cannot share a corpus with the semantic foil. `check` stops after a parse failure
 * and reports nothing derived — because one unloaded file turns every other finding into an
 * artefact, and the gate started advising the deletion of the authorization rule.
 */
const MUST_NOT_PARSE = {
  "will-not-parse": "a true sentence with nowhere to live must refuse, not vanish",
  "cannot-judge-this-corpus": "a corpus missing part of itself cannot be judged, and saying so is the point",
};

test("every refusal the foil is built to provoke still fires", () => {
  const { findings } = checkCorpus("v2-foil");
  const fired = new Set(findings.map((f) => f.kind));
  const missing = Object.entries(MUST_FIRE)
    .filter(([kind]) => !fired.has(kind))
    .map(([kind, why]) => `${kind} (${why})`);
  assert.deepEqual(missing, [], `these no longer fire:\n  - ${missing.join("\n  - ")}`);
});

test("the schema refuses what only the schema can catch", () => {
  const { findings } = checkCorpus("v2-foil-parse");
  const fired = new Set(findings.map((f) => f.kind));
  const missing = Object.entries(MUST_NOT_PARSE)
    .filter(([kind]) => !fired.has(kind))
    .map(([kind, why]) => `${kind} (${why})`);
  assert.deepEqual(missing, [], `these no longer fire:\n  - ${missing.join("\n  - ")}`);
  // ⛔ And nothing derived is reported alongside them.
  const derived = findings.filter((f) => !(f.kind in MUST_NOT_PARSE)).map((f) => f.kind);
  assert.deepEqual(
    [...new Set(derived)],
    [],
    `derived findings were computed over a corpus missing part of itself: ${derived.join(", ")}`
  );
});

test("the semantic foil parses, so its detectors can actually run", () => {
  const { corpus } = checkCorpus("v2-foil");
  assert.deepEqual(
    corpus.broken.map((b) => b.file),
    [],
    "v2-foil must load — a parse error there masks every detector it exists to exercise"
  );
});

test("the foil is refused outright", () => {
  const { findings } = checkCorpus("v2-foil");
  const refusals = findings.filter((f) => f.severity === "refuse");
  assert.ok(refusals.length >= 8, `expected the foil to be refused many times over, saw ${refusals.length}`);
});

test("every finding says what to do about it", () => {
  // ⛔ "Every finding says what to do. A finding you cannot act on is a complaint."
  const { findings } = checkCorpus("v2-foil");
  const mute = findings.filter((f) => !f.fix && f.kind !== "will-not-parse").map((f) => f.kind);
  assert.deepEqual([...new Set(mute)], [], `these are reported with no fix: ${mute.join(", ")}`);
});

test("the pristine seed refuses nothing", () => {
  // The corpus every review run starts from. If this goes red, either the seed drifted or a
  // detector became wrong — and both are worth stopping for.
  const { findings } = checkCorpus("v2-seed");
  const refusals = findings.filter((f) => f.severity === "refuse");
  assert.deepEqual(
    refusals.map((f) => `${f.kind} @ ${f.where}`),
    [],
    "the seed must be handable to a reviewer"
  );
});

test("the seed's queue stays small enough to work", () => {
  /**
   * ⛔ A ratchet on review burden, which is tenet 1's constraint and the easiest thing to
   * lose while fixing something else. It has been 12 notes for 5 exchanges once already,
   * and 7 of those 12 were items no person should have been shown.
   */
  /**
   * ⛔ Counts what a person must ACT on, not every note.
   *
   * It counted all notes, so adding an informational one — `leans-on-an-example`, which exists
   * precisely so a corpus cannot come to rest on examples nobody re-read — read as the queue
   * getting worse. The thing that must stay small is the list of decisions somebody owes.
   */
  const { corpus, findings } = checkCorpus("v2-seed");
  const INFORMATIONAL = new Set(["leans-on-an-example", "parked-by-a-person", "one-word-defined-twice"]);
  const questions = findings.filter((f) => f.severity === "note" && !INFORMATIONAL.has(f.kind));
  const exchanges = corpus.scopes.reduce((n, s) => n + s.scope.exchanges.length, 0);
  // ⛔ Rules are in the denominator because a rule is a thing a person reviews, and an
  // org-wide question is a decision about a CLASS rather than about one exchange — counting
  // it against the exchange count punished the mechanism that replaces four questions with one.
  const reviewable = exchanges + corpus.rules.length;
  assert.ok(
    questions.length <= reviewable,
    `${questions.length} decisions owed against ${reviewable} reviewable things — a queue longer than the corpus is one nobody works`
  );
  /**
   * ⛔ The real protection, and the disease the ratchet was written for: 7 of 12 items were
   * `nothing-demonstrates-this` on `may`/`with`, and they were UNCLEARABLE — the fix text
   * offered an escape that did not exist, and the only thing that silenced them was filler
   * criteria landing in the builder's acceptance list.
   */
  for (const q of questions)
    assert.ok(
      q.fix && q.fix.length > 10,
      `${q.kind} at ${q.where} is in the queue with no way to act on it — that is how a queue stops being worked`
    );
});

/**
 * ⛔ A CROSS-SCOPE `at:` SPLIT ONE PICTURE ACROSS TWO PACKETS, AND NEITHER HALF SAID SO.
 *
 * A promise filed in one scope may arrive on a screen owned by another — views have one home and
 * deliberately do not inherit. But the packet read `entry.scope.views` and nothing else, so:
 *
 *   - the scope owning the PROMISE named `task-list · task-row` with no picture of it, while a
 *     perfectly good sketch sat in the corpus reaching nobody
 *   - the scope owning the SCREEN — whose packet is what a builder implementing it receives —
 *     never mentioned that a promise from elsewhere lands on its row
 *
 * Both halves passed every check. Pinned by building the shape rather than by reading the renderer.
 */
test("a promise arriving on another scope's screen is whole in both packets", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2xs-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const f = path.join(dir, "truth", "money.md");
  const before = fs.readFileSync(f, "utf-8");
  assert.ok(before.includes("at: { view: balance, part: figure }"), "seed shape moved — re-aim this test");
  fs.writeFileSync(f, before.replace("at: { view: balance, part: figure }", "at: { view: task-list, part: task-row }"));

  const corpus = loadCorpus(dir);
  const owner = compilePacket(corpus, "money");
  const screen = compilePacket(corpus, "tasks");

  // The promise's packet carries the screen it arrives on, labelled as belonging elsewhere.
  assert.match(owner, /This screen belongs to \*\*tasks\*\*/, "the borrowed screen has no picture");
  assert.ok(owner.includes("│  Tasks"), "the sketch did not travel with the promise");
  // The screen's packet names what arrives on it from elsewhere.
  assert.match(screen, /Promises from elsewhere arrive on this screen/, "the arrival is invisible to whoever builds the screen");
  assert.match(screen, /money#see-a-balance · task-row/);
  // ⛔ And the screen still has exactly one home — it is reproduced, never re-declared.
  assert.equal((screen.match(/### Tasks \*\(list\)\*/g) ?? []).length, 1);
});
