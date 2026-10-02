/**
 * ⛔ A STEER REACHES AN AUTHOR, AND NEVER A JUDGE.
 *
 * `Steer` shipped defined, loaded, refused-when-malformed and rendered on the charter — and read by
 * nothing that makes anything. No corpus held one, no command wrote one, and the ticket proposing a
 * learning loop recorded them as "read by the generators", which was simply false. So the whole
 * concept was a field an author could write that changed nothing, and the loop built on top of it
 * would have produced records that read as closed and did nothing.
 *
 * Prose did not catch that for the life of the concept. These do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { inEffect, declined, addendum, readSteers } from "../dist/v2/steers.js";
import { Steer } from "../dist/v2/schema.js";

const steer = (over = {}) => ({
  id: "verb-buttons",
  says: "Buttons are named for the verb they perform, never Submit.",
  steers: "generation",
  learned_from: "every button renamed in review since August",
  at: "2026-10-01",
  ...over,
});

test("a steer that constrains the product never reaches an author as taste", () => {
  const all = [steer(), steer({ id: "short-forms", steers: "truth", learned_from: undefined })];
  const live = inEffect(all);
  assert.deepEqual(
    live.map((s) => s.id),
    ["verb-buttons"],
    "a truth steer belongs on the charter, where somebody can disagree — feeding it to an author as a habit launders a constraint"
  );
});

test("a declined steer is gone from what is in force, not softened", () => {
  const all = [steer(), steer({ id: "three-fields", declined: "the design system settled it" })];
  assert.deepEqual(inEffect(all).map((s) => s.id), ["verb-buttons"]);
  assert.deepEqual(
    declined(all).map((s) => s.id),
    ["three-fields"],
    "it is kept, so the pattern it was learned from is not learned again by the next scan"
  );
});

test("declining is refused on a claim about the product", () => {
  /**
   * ⛔ Turning off something that steers TRUTH is withdrawing a constraint, which is a verdict — it
   * belongs in a scope, where something records who withdrew it. A line in a settings file quietly
   * retracting product truth is the whole shape this concept is organised against.
   */
  const bad = Steer.safeParse(steer({ steers: "truth", learned_from: undefined, declined: "changed my mind" }));
  assert.equal(bad.success, false);
  assert.match(bad.error.issues[0].message, /withdrawn where it was agreed to/);
});

test("the addendum says it is not framework truth, and carries provenance", () => {
  const text = addendum([steer()]);
  assert.match(text, /not framework truth/i, "an author cannot tell a guarantee from a preference unless told which this is");
  assert.match(text, /the truth wins/i, "where a habit would make an author write something untrue, the habit is what was wrong");
  assert.match(
    text,
    /every button renamed in review since August/,
    "⛔ the provenance is visible, not a comment — an author who cannot see what a habit came from cannot judge whether it applies"
  );
});

test("nothing in force means no addendum at all, not an empty heading", () => {
  assert.equal(addendum([]), "");
  assert.equal(addendum([steer({ declined: "no longer a habit here" })]), "");
});

test("⛔ the install adapter appends to authors and to no judge", () => {
  /**
   * The guarantee is structural rather than a prohibition in a prompt: `AUTHORS` and `AGENTS` are
   * two registries walked by two functions, and only one of them appends taste. A judge told what
   * this project likes is a judge that can no longer notice the project is wrong — the same reason
   * the newcomer is never told what ProductOS is.
   *
   * ⛔ READ OFF THE SOURCE, because installing for real would write into the host's agent directory.
   * What is asserted is the shape that makes the guarantee true: one call site, in the authors.
   */
  const src = fs.readFileSync(path.join(process.cwd(), "src/adapters/claude.ts"), "utf-8");
  const authors = src.indexOf("function installClaudeAuthors");
  const agents = src.indexOf("function installClaudeAgents");
  assert.ok(authors > 0 && agents > authors, "both installers present, authors first");

  const calls = [...src.matchAll(/addendum\(/g)].map((m) => m.index);
  assert.equal(calls.length, 1, "exactly one place appends what a project has learned");
  assert.ok(
    calls[0] > authors && calls[0] < agents,
    "⛔ it is inside installClaudeAuthors — a judge that gets handed a project's habits cannot notice the project is wrong"
  );
});

test("a steers file that will not parse does not take the install down", () => {
  /**
   * ⛔ Install time is exactly where there may be no good corpus. A project installing ProductOS
   * for the first time has config and little else, and making the install throw on a bad file
   * would break it for the people most likely to be running it.
   */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-steers-"));
  fs.mkdirSync(path.join(dir, "steers"));
  fs.writeFileSync(path.join(dir, "steers", "steers.yaml"), "steers: [ this is not: valid: yaml");
  assert.deepEqual(readSteers(dir), []);

  fs.writeFileSync(path.join(dir, "steers", "ok.yaml"), "steers:\n  - id: a-habit\n    says: Something this project does every time.\n    steers: generation\n    learned_from: three reviews\n    at: 2026-10-01\n");
  assert.deepEqual(
    readSteers(dir).map((s) => s.id),
    ["a-habit"],
    "one unparseable file must not hide the files that are fine"
  );
});

test("a corpus with no steers directory is not an error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-nosteers-"));
  assert.deepEqual(readSteers(dir), []);
});
