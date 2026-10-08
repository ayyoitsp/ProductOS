/**
 * ⛔ A PROJECT KNOWS THINGS THAT ARE NOT CLAIMS ABOUT ITS PRODUCT.
 *
 * Peter: *"we need a 'framework way' to track more context about a project, like design system
 * concepts, feedback given, etc. some stuff should be opaque and auto-training, while others are
 * made obvious in product OS"*.
 *
 * Before this, context had two fates and neither fits. It became a sentence in a corpus — where it
 * has to be agreed to and can be wrong — or it lived in a session and died with it. A design
 * system, a naming habit, "he rejects screens with more than three required fields": none of those
 * is a claim anybody validates, and all of them steer the work.
 *
 * ⛔ THE SPLIT IS BY WHAT IT STEERS, which is the cut Peter chose: generation is opaque, truth is
 * surfaced.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { Steer } = await import(path.resolve("dist/v2/schema.js"));
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));

const ok = (x) => {
  const r = Steer.safeParse(x);
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues.map((i) => i.message)));
  return r.data;
};
const refused = (x) => {
  const r = Steer.safeParse(x);
  assert.equal(r.success, false, `should have been refused: ${JSON.stringify(x)}`);
  return r.error.issues.map((i) => i.message).join(" ");
};

test("a steer says what it steers, and that is the whole split", () => {
  ok({ id: "short-forms", says: "Forms ask for as little as the product can proceed with.", steers: "truth", at: "2026-10-01" });
  ok({
    id: "rejects-long-forms",
    says: "Screens with more than three required fields come back for another pass.",
    steers: "generation",
    learned_from: "four screens returned in September, each over three required fields",
    at: "2026-10-01",
  });
  /** ⛔ There is no third kind. Something that steers neither is not context, it is a note. */
  assert.match(refused({ id: "x", says: "something or other", steers: "vibes", at: "2026-10-01" }), /Invalid|expected/i);
});

/**
 * ⛔ A CLAIM ABOUT THE PRODUCT IS SOMEBODY'S, NOT SOMETHING THAT ACCUMULATED.
 *
 * The dangerous shape is a constraint on the product carrying `learned_from` — a rule nobody put
 * their name to, reading as though somebody had decided it. That is how an inferred habit becomes
 * product truth without anybody agreeing to anything.
 */
test("a steer that constrains the product cannot claim to have been learned", () => {
  const why = refused({
    id: "no-modals",
    says: "Nothing in this product confirms in a modal.",
    steers: "truth",
    learned_from: "he rejected two modals",
    at: "2026-10-01",
  });
  assert.match(why, /somebody's decision|not a pattern noticed/i);
});

/** ⛔ And a learned steer says where it was learned, or it is a rule nobody can argue with. */
test("an opaque steer carries its provenance", () => {
  const s = ok({
    id: "verb-buttons",
    says: "Buttons are named for the verb they perform, never Submit.",
    steers: "generation",
    learned_from: "every button renamed in review since August",
    at: "2026-10-01",
  });
  assert.ok(s.learned_from, "nothing records what this was inferred from");
});

test("a corpus loads what steers it, beside the truth and never inside it", () => {
  const dir = temp("steers-");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.mkdirSync(path.join(dir, "steers"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "a.md"), "---\nid: a\ntitle: A thing\nviews: []\nexchanges: []\n---\n\nProse.\n");
  fs.writeFileSync(
    path.join(dir, "steers", "steers.yaml"),
    [
      "steers:",
      "  - id: verb-buttons",
      '    says: "Buttons are named for the verb they perform, never Submit."',
      "    steers: generation",
      '    learned_from: "every button renamed in review since August"',
      "    at: 2026-10-01",
    ].join("\n")
  );
  const c = loadCorpus(dir);
  assert.equal(c.steers.length, 1, `expected one steer, got ${JSON.stringify(c.steers)}`);
  assert.equal(c.steers[0].steers, "generation");
  /** ⛔ It is not a scope, not a note, not a verdict. Three different things with three homes. */
  assert.equal(c.scopes.length, 1);
  assert.equal(c.notes.length, 0);
  assert.equal(c.verdicts.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
