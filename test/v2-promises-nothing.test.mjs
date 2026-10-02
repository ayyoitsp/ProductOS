/**
 * ⛔ A CONTROL THAT COMMITS AND PROMISES NOTHING IS NAMED, ONE BY ONE, AND REFUSED.
 *
 * Peter, after clicking through a prototype: *"it dead ends. no way to complete setup"*, and later
 * *"what isn't back is the linking between features and any behaviors"* → *"yes, fix the
 * framework..."*
 *
 * ⛔ THE DETECTION WAS NEVER MISSING, WHICH IS THE WHOLE LESSON OF THIS FILE. Both shapes were
 * already in the output: one as `slot-blank`, phrased identically to a blank slot on a label, among
 * 322 of them; the other inside an aggregated note reading "9 controls the screens draw, that no
 * behaviour says anything about" — one `where`, committing controls mixed in with decorative ones.
 * Every dead end he walked into had been reported the whole time, indistinguishable from a sentence
 * nobody had got round to writing.
 *
 * So what is pinned here is not "it is detected" but **it is distinguishable**: its own kind, its
 * own severity, and one finding per control rather than a count — because the question a reader has
 * is *which* door, and a number cannot answer that.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkCorpus } from "../dist/v2/check.js";

function corpus(parts, exchanges) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2prom-"));
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "pay.md"), `---
id: pay
title: Pay somebody
exists: kept
happy_path:
  accomplishes: somebody sends money to a person they have paid before
  brings: who they are paying and how much
  ends_with: the money has moved and both of them can see it
  through: [pay-form]
views:
  - id: pay-form
    title: Pay somebody
    parts:
${parts}
exchanges:
${exchanges}
`);
  const { corpus: c, findings } = checkCorpus(dir);
  assert.deepEqual(c.broken, [], "the fixture did not parse, so an empty result proves nothing");
  return findings;
}

const SEND = "      - { id: send, label: Send it, role: commits }\n";
const NOTE = "      - { id: blurb, label: What this does, role: display }\n";
const NONE = "exchanges: []".slice(11); // deliberately empty

test("a committing control nothing is anchored at is refused, by name", () => {
  const found = corpus(SEND + NOTE, "  []").filter((f) => f.kind === "pressing-this-promises-nothing");
  assert.equal(found.length, 1, "a control that commits with nothing said about it was not refused");
  assert.equal(found[0].severity, "refuse", "it is a note — then it reads as incompleteness, which is how it stayed unfound");
  assert.equal(found[0].where, "pay#pay-form#send", "it does not name WHICH control — a count cannot be acted on");
  assert.match(found[0].what, /Send it/, "it does not use the label a reviewer sees on the screen");
  assert.match(found[0].what, /anchored at it at all/, "it does not distinguish nothing-anchored from a blank answer");
});

/**
 * ⛔ AND THE OTHER SHAPE: something IS anchored and its answer is blank. One kind covers both,
 * because it is one hole — and one predicate, in one place. The same check written twice is the
 * gateFor/check divergence this codebase has already paid for.
 */
test("a committing control whose answer says nothing is the same finding", () => {
  const ex = `  - id: send-it
    title: Somebody sends the money
    asked_by: person
    at: { view: pay-form, part: send }
    slots:
      may:
        says: anybody who can see this person can pay them
`;
  const found = corpus(SEND, ex).filter((f) => f.kind === "pressing-this-promises-nothing");
  assert.equal(found.length, 1, "an exchange with a blank answer on a committing control was not refused");
  assert.ok(!/anchored at it at all/.test(found[0].what),
    "it says nothing is anchored, when something is — the reader will go looking for a behaviour that exists");
});

test("saying where it lands clears it", () => {
  const ex = `  - id: send-it
    title: Somebody sends the money
    asked_by: person
    at: { view: pay-form, part: send }
    slots:
      answer:
        says: the money has moved, and it shows on the list of payments with today's date
`;
  assert.deepEqual(
    corpus(SEND, ex).filter((f) => f.kind === "pressing-this-promises-nothing"), [],
    "stating the outcome did not clear it, so there is no way for an author to satisfy this"
  );
});

/**
 * ⛔ IT DOES NOT CLAIM THE CONTROL NAVIGATES. The first version said "commits, so pressing it takes
 * somebody away" and reported that about a button which adds a row to the table it stands in. A
 * commit CHANGES something; only some of them also move somebody. A finding whose first clause is
 * false about the thing it names is one the reader stops believing, and they are right to.
 */
test("it does not assert that every commit takes somebody elsewhere", () => {
  const found = corpus("      - { id: add-row, label: Add row, role: commits }\n", "  []")
    .filter((f) => f.kind === "pressing-this-promises-nothing");
  assert.equal(found.length, 1);
  assert.ok(!/takes somebody away|where they arrive/.test(found[0].what),
    "it tells an author their in-place button navigates somewhere");
  assert.match(found[0].what, /changes something/);
});

/** ⛔ Other roles stay where they were — a label nobody describes is incompleteness, not a dead end. */
test("a control of another role is not swept into this", () => {
  const found = corpus(NOTE, "  []");
  assert.deepEqual(found.filter((f) => f.kind === "pressing-this-promises-nothing"), [],
    "a display part was refused as a dead end");
  void NONE;
});
