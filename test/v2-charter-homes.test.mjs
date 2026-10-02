/**
 * ⛔ TWO DOCUMENTS STOPPED BEING DOCUMENTS, AND A CORPUS THAT HAS THEM IS TOLD WHERE EACH SENTENCE
 * GOES.
 *
 * Peter, reading them: *"'Decisions' - these are all way too feature specific, doesn't belong at top
 * level, should be behaviors. 'Non-goals' - also feature specific, should be behaviors"* — then the
 * question that settled it: *"why can't we delete the non-goals section and decisions section?"*
 *
 * Nothing stopped us. They existed because the migrator carried v1's context model across unchanged
 * and nobody asked whether the Exchange model still needed them. It does not:
 *
 *   a non-goal  →  a slot's `standing: out_of_scope` with a reason · a `refuses` outcome ·
 *                  `happy_path.not`
 *   a decision  →  a `Verdict`, carrying who decided, their reason, and what it replaced
 *
 * ⛔ Those homes attach the sentence to the feature it constrains, are agreed to one at a time, and
 * go stale when the thing they are about changes. A document gives a sentence none of the three.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkCorpus } from "../dist/v2/check.js";
import { loadCorpus } from "../dist/v2/load.js";
import { DOCUMENTS, NOT_A_DOCUMENT } from "../dist/v2/schema.js";

function corpus(docs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2chart-"));
  fs.mkdirSync(path.join(dir, "charter"), { recursive: true });
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  for (const [id, sections] of Object.entries(docs))
    fs.writeFileSync(path.join(dir, "charter", `${id}.md`), `---\nid: ${id}\ntitle: ${id}\nsections:\n${sections}---\n`);
  fs.writeFileSync(path.join(dir, "truth", "pay.md"), `---\nid: pay\ntitle: Pay\nexists: kept\nviews: []\nexchanges: []\n---\n`);
  const { corpus: c, findings } = checkCorpus(dir);
  assert.deepEqual(c.broken, [], `the fixture did not parse: ${JSON.stringify(c.broken)}`);
  return findings;
}

const SEC = (id, says) => `  - id: ${id}\n    title: ${id}\n    says: ${JSON.stringify(says)}\n`;

test("every section of a no-longer-document is reported, with its home named", () => {
  const found = corpus({
    "non-goals":
      SEC("computing-the-loan", "No note rate or loan amount is computed here; the workbook does that.") +
      /** ⛔ The one a regex misses: the negation is not at the front. */
      SEC("writing-their-cells", "This product writes one sheet of its own and never writes into their calculations.") +
      /** ⛔ And this one, which a regex misses entirely. */
      SEC("minting-versions", "Settings save; they do not mint versions, and a deal pins the input version it was priced from."),
  }).filter((f) => f.kind === "this-belongs-to-a-feature");

  assert.equal(found.length, 3,
    "a section was not reported — an under-reporting finding is worse than none here, because the ones it stays quiet about read as fine");
  assert.ok(found.every((f) => /out_of_scope|refuses|happy_path\.not/.test(f.fix)), "it does not say where the sentence goes");
  /**
   * ⛔ A REFUSAL, AND THIS ASSERTION USED TO SAY THE OPPOSITE.
   *
   * It asserted `note`, on the reasoning that refusing would reject a corpus over sections somebody
   * wrote in good faith. Peter, after being shown a long explanation of why one document's content
   * was too valuable to move: *"don't care - just delete them. this is a framework thing. decisions
   * at the top level don't exist. DELETE THEM."*
   *
   * He was right, and the giveaway was in how I used the note: not to schedule the move, but to
   * keep the document and write three paragraphs about why its content mattered. A severity that
   * lets a structural error be explained rather than fixed is the wrong severity. These documents
   * do not exist in this model — the same kind of error as a container at the wrong depth, which
   * this check already refuses.
   */
  assert.ok(found.every((f) => f.severity === "refuse"),
    "a document that does not exist in this model is only a note, so a corpus carrying one can still be handed over");
});

test("a decision document is reported the same way, with a different home", () => {
  const found = corpus({
    decisions: SEC("the-rate-is-typed", "**Chosen 2026-09-14.** The index rate is typed on the deal, per option."),
  }).filter((f) => f.kind === "this-belongs-to-a-feature");
  assert.equal(found.length, 1);
  assert.match(found[0].fix, /Verdict/, "a decision is not sent to the verdict log, which is the only home with a hash");
});

/** ⛔ The four that remain are the ones with no other home, and they are left alone. */
test("the documents that survive are not reported", () => {
  const found = corpus({
    goals: SEC("one-truth", "Somebody looking for what the product promises finds it in one place."),
    principles: SEC("blank-is-not-zero", "An unset value renders as blank — never as a zero, never as the row above."),
    personas: SEC("the-analyst", "An analyst who prices eight deals a week and lives in a spreadsheet."),
    voice: SEC("plain", "Say what happened, in the words the reader would use for it."),
  });
  assert.deepEqual(found.filter((f) => f.kind === "this-belongs-to-a-feature"), [],
    "a legitimate product-wide document was reported as belonging to a feature");
});

/**
 * ⛔ A CHOICE RECORDED INSIDE ONE OF THE FOUR is the one case with nothing exact to key on, so a
 * heuristic is used there and only there.
 */
test("a dated choice inside a surviving document is still reported", () => {
  const found = corpus({
    principles: SEC("we-chose-this", "**Chosen 2026-09-14.** Edits collect and one deliberate action lands them."),
  });
  assert.ok(found.some((f) => f.kind === "a-decision-kept-as-prose"),
    "a choice kept as prose in a legitimate document was accepted, so it carries no hash and reads as current forever");
});

/**
 * ⛔ THE LIST OF SURVIVORS IS A REFERENCE, NOT A WHITELIST — which is how we got here. v1 had a
 * fixed list of six, the migrator carried it across, and two documents existed for years because a
 * list said they should. Four hardcoded names would be the same mistake with a shorter list.
 */
test("a project may add a document of its own and nothing objects", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2own-"));
  fs.mkdirSync(path.join(dir, "charter"), { recursive: true });
  fs.writeFileSync(path.join(dir, "charter", "compliance.md"),
    `---\nid: compliance\ntitle: Compliance\nsections:\n${SEC("retain-seven-years", "Every document a borrower supplies is kept for seven years after the loan closes.")}---\n`);
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, []);
  assert.ok(c.charter.some((x) => x.charter.id === "compliance"), "a project's own document did not load");
  assert.ok(!DOCUMENTS.includes("compliance"), "this test proves nothing if compliance is on the list");
  assert.ok(!NOT_A_DOCUMENT.compliance, "a project's own document is being told it has a better home");
});

/** ⛔ And the migrator no longer produces the two, so this does not arrive again. */
test("the migrator no longer treats them as documents", () => {
  const src = fs.readFileSync("src/v2/migrate.ts", "utf-8");
  assert.match(src, /const KINDS = \["goals", "principles", "personas", "voice"\]/,
    "the migrator's list is back to carrying v1's shape across");
  assert.match(src, /NO_LONGER_DOCUMENTS/, "it drops them silently — discarding a document somebody wrote is worse than misfiling it");
});
