/**
 * ⛔ THE PURPOSE IS NOT THE FORM, LISTED.
 *
 * Peter, reading a purpose card: *"this includes details that may change - 'arrives with'. I think
 * this 'what this feature is for' card should be more generic. generally what comes with it."*
 *
 * `brings` said *"a name for the deal, the borrower, and the property's address"* against parts
 * labelled "Deal Name", "Borrower" and "Property Address". Three problems, all one problem: the
 * fields are already the view's parts so this is a second copy; adding a field makes the sentence
 * wrong with nothing to detect it; and ⛔ the purpose is what somebody agrees to FIRST, so every
 * detail underneath was gated behind a sentence enumerating details nobody had settled.
 *
 * ⛔ THE MATCHING IS THE WHOLE DIFFICULTY, and both halves of it were learned by running it against
 * the real corpus rather than reasoning about it — once finding nothing, once naming a field he had
 * never written. Both are pinned below, because a rule that misses reads as a clean corpus and a
 * rule that over-reports gets dismissed along with the next one.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkCorpus } from "../dist/v2/check.js";

/** A feature whose purpose lists its own fields, in the phrasing a person actually writes. */
function corpusWith(brings) {
  const dir = temp("v2alt-");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "create-deal.md"), `---
id: create-deal
title: Create a deal
exists: kept
happy_path:
  accomplishes: an analyst starts a deal and links it to the folder its model will live in
  brings: ${JSON.stringify(brings)}
  ends_with: the deal exists on the list with its model in a folder
  through: [create-deal-form]
views:
  - id: create-deal-form
    title: Create a deal
    parts:
      - { id: deal-name, label: Deal Name, role: entry }
      - { id: borrower, label: Borrower, role: entry }
      - { id: property-address, label: Property Address, role: entry }
      - { id: property-name, label: Property Name, role: entry }
      - { id: property-state, label: State, role: entry }
      - { id: save, label: Create deal, role: commits }
exchanges: []
`);
  return dir;
}

/**
 * ⛔ ASSERT THE FIXTURE PARSED. The first version of this had an invalid key, so every corpus was
 * `broken`, every scope list was empty, and "no finding" meant "nothing was read" — which is
 * indistinguishable from the rule working. The same mistake, in a different shape, as the fixture
 * in the preface test an hour earlier.
 */
const fired = (brings) => {
  const { corpus, findings } = checkCorpus(corpusWith(brings));
  assert.deepEqual(corpus.broken, [], "the fixture did not parse, so an empty result proves nothing");
  assert.equal(corpus.scopes.length, 1, "the fixture has no scope in it");
  return findings.filter((f) => f.kind === "the-purpose-lists-the-form");
};

test("a purpose that lists the form is reported, in the phrasing people write", () => {
  /**
   * ⛔ NOT AS FIELD LABELS. Matching the label as a substring found NOTHING here — nobody writes
   * "Deal Name", they write "a name for the deal". One of three matched and the corpus read clean.
   */
  const found = fired("a name for the deal, the borrower, and the property's address");
  assert.equal(found.length, 1, "a purpose listing three of the form's fields was not reported");
  assert.match(found[0].what, /deal name/);
  assert.match(found[0].what, /borrower/);
  assert.match(found[0].what, /property address/);
  /** ⛔ And it must not name what he did not write. */
  assert.ok(!/property name/.test(found[0].what),
    "it named a field that is not in the sentence — two of its words appear, eight words apart");
  assert.ok(!/\bstate\b/.test(found[0].what),
    "it named State, matched on the lone s from property's — a note that invents a field gets dismissed, and so does the next one");
});

test("a purpose at the right altitude is not reported", () => {
  assert.deepEqual(fired("the deal they want to create and where its model should live"), [],
    "a generic purpose was reported, which would push an author back towards listing the fields");
  assert.deepEqual(fired("nothing"), []);
});

/** ⛔ One overlap is ordinary English — a feature about deals says "deal". Two is a list. */
test("one field mentioned is not a list", () => {
  assert.deepEqual(fired("the borrower they are sizing a deal for"), [],
    "a single incidental overlap fired, which makes the check noise");
});

test("the scoper is told the altitude, with both versions", () => {
  const doc = fs.readFileSync("agents/productos-scoper.md", "utf-8");
  assert.match(doc, /never the fields of the form/i, "the role that writes purposes is not told this");
  assert.match(doc, /where its model should live/, "it is told the rule and shown no example of the right altitude");
});
