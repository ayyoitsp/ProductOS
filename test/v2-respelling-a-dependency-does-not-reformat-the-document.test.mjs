/**
 * ⛔ RE-SPELLING ONE DEPENDENCY REWROTE 497 LINES OF A DOCUMENT NOBODY CONVERTED.
 *
 * The capability conversion re-spells a feature's `depends_on` so it names the subsystem's contract
 * — `pin-a-version` → `pin-a-version#offers`. That went through `write()`, which runs the whole
 * frontmatter back through `YAML.stringify`: prose re-wraps at `lineWidth`, and every flow sequence
 * `[a, b]` becomes a block sequence. `truth/map-the-statement.md` — a feature filed under
 * `operating-statements`, with nothing to do with the capability tree — came out with 497 changed
 * lines to re-spell four entries. With the in-place edit it is 8: the four entries, and nothing else.
 *
 * ⛔ `0001-drop-walked` ALREADY KNEW, which is what makes this worth pinning. Its comment says a
 * YAML-reserialise "would reformat every document it touched and lose comment placement and key
 * order", and it deletes whole lines for exactly that reason. The rule next to it ignored that.
 *
 * ⛔ AND THIS IS NOT WHY THE CORPUS GOES STALE — a claim I got wrong three times before isolating
 * it. `coveredBy` hashes the RESOLVED meaning, so moving a depended-on scope out of product truth
 * moves the dependent's claim hash whatever the spelling looks like. Measured: deprecating the 36
 * documents and writing nothing else reproduces all 333 stale requirements on its own. So this test
 * is about not churning documents gratuitously; it is NOT a guard against staleness, and a future
 * reader must not treat a green run here as evidence that validations are safe.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { respellDependsOn } from "../dist/v2/convert-capabilities.js";

const block = `---
id: map-the-statement
title: Map the statement
terms:
  line-item:
    means: One row of the borrower's own statement — what they call something the property earned
      or spent, with the figure it carries for each period.
    set_by: [read-a-supplied-file]
depends_on:
  - pin-a-version
  - read-a-supplied-file
exists: kept
---

Body text, which must not move.
`;

const flow = `---
id: deal-list
depends_on: [resolve-an-organizations-stages, access-control]
exists: kept
---

Body.
`;

test("a block-style dependency is re-spelled, and nothing else in the document moves", () => {
  const out = respellDependsOn(block, "pin-a-version", "pin-a-version#offers");
  assert.ok(out, "the entry could not be placed, so the caller falls back to a full reserialise");
  assert.match(out, /^ {2}- pin-a-version#offers$/m, "the entry was not re-spelled");

  /** ⛔ The whole point: every OTHER line byte-identical. */
  const was = block.split("\n");
  const now = out.split("\n");
  assert.equal(now.length, was.length, "the line count moved, so something was reformatted");
  const moved = was.map((l, i) => [i, l, now[i]]).filter(([, a, b]) => a !== b);
  assert.equal(moved.length, 1, `${moved.length} lines changed, expected exactly 1: ${JSON.stringify(moved)}`);
  /** The things a reserialise destroyed, each checked by name. */
  assert.match(out, /\n {4}set_by: \[read-a-supplied-file\]\n/, "a flow sequence was expanded to a block list");
  assert.match(out, /property earned\n {6}or spent/, "the prose was re-wrapped at a different column");
  assert.ok(out.endsWith("Body text, which must not move.\n"), "the body moved");
});

test("a flow-style dependency is re-spelled in place too — both styles are in use", () => {
  const out = respellDependsOn(flow, "access-control", "access-control#offers");
  assert.ok(out, "flow style could not be placed");
  assert.match(out, /depends_on: \[resolve-an-organizations-stages, access-control#offers\]/, "flow style was not re-spelled, or was expanded");
  assert.equal(out.split("\n").length, flow.split("\n").length, "the document grew or shrank");
});

test("⛔ it matches the whole scalar, never something containing it", () => {
  const near = `---
id: x
depends_on:
  - pin-a-version-2
  - pin-a-version
---

B.
`;
  const out = respellDependsOn(near, "pin-a-version", "pin-a-version#offers");
  assert.ok(out);
  assert.match(out, /^ {2}- pin-a-version-2$/m, "a longer id containing the target was corrupted");
  assert.match(out, /^ {2}- pin-a-version#offers$/m, "the exact entry was not re-spelled");
});

test("⛔ it refuses rather than guesses, so the caller can fall back", () => {
  assert.equal(respellDependsOn("no frontmatter here", "a", "b"), null, "a document with no frontmatter was edited anyway");
  assert.equal(respellDependsOn(`---\nid: x\nexists: kept\n---\n\nB.\n`, "a", "b"), null, "a document with no depends_on was edited anyway");
  /** ⛔ The entry must be found INSIDE the block — a word elsewhere in the frontmatter is not it. */
  const elsewhere = `---\nid: x\ndepends_on:\n  - other\nnotes: pin-a-version is mentioned here\n---\n\nB.\n`;
  const out = respellDependsOn(elsewhere, "pin-a-version", "pin-a-version#offers");
  assert.equal(out, null, "it reached outside the depends_on block and edited an unrelated field");
});
