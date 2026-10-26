/**
 * ⛔ THE SUBSYSTEM TREE IS ASKED FOR ONCE, WITH THE PRODUCT'S OWN NOUNS IN THE QUESTION.
 *
 * Peter: *"Even with no capabilities mapped, it should be asking to populate the capability tree"*,
 * then *"it should be trying to populate the features too"*.
 *
 * Measured on his corpus when he asked: **131 features, ZERO capabilities**, every one reported
 * `missing — no part of the system says it serves anything this feature promises`. That is one
 * decision standing in front of all of them, and `ANALYSES.capabilities.settleFirst` already said
 * so — *"a subsystem serves many features, so which parts exist is not a per-feature question"*,
 * measured: three decomposers fanned cold produced three disjoint trees and zero shared parts.
 *
 * ⛔ AND A BARE QUESTION IS THE STATE THIS WHOLE ROLE EXISTS TO PREVENT. He had already rejected one
 * for having nothing to pick between. So the question carries what the corpus already says — the
 * areas it has, the nouns behaviours move the state of, what features rest on — lifted, never
 * invented, because a proposed tree is a reading and this file writes none.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));
const { capabilityTree } = await import(path.resolve("dist/v2/subsystems.js"));
const CLI = path.resolve("dist/cli/index.js");

/** The seed, which is a root with areas, behaviours that change things, and no capabilities. */
const seed = () => {
  const dir = temp("pos-tree-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  return dir;
};

const root = (dir) => loadCorpus(dir).scopes.find((x) => !x.scope.in).scope.id;
const kinds = (dir, scope) => {
  const it = interviewFor(loadCorpus(dir), scope);
  const k = {};
  for (const o of it.owed) k[o.owes] = (k[o.owes] ?? 0) + 1;
  return k;
};

test("⛔ with no capabilities, the tree is asked for once — at the product, not per feature", () => {
  const dir = seed();
  const c = loadCorpus(dir);
  /**
   * ⛔ THROUGH `capabilityTree`, NOT A RAW FIELD — and the field this used to read no longer exists.
   *
   * Reading one is the mistake that produced the worst claim of the session: I counted
   * `corpus.capabilities`, got zero on a corpus holding 47, and told Peter his product had none.
   * He was looking at the page. A test that counts its own way can pin an interview to arithmetic
   * no surface agrees with, so this asks the same function the page, `check` and MCP ask.
   */
  assert.equal(capabilityTree(c).counts.capabilities, 0, "the seed has a tree, so this test is measuring nothing");

  const at = root(dir);
  assert.equal(kinds(dir, at).parts, 1, "nothing asks what parts the product consists of");

  /** ⛔ AND NOWHERE ELSE. A feature cannot answer it, and asking there is the arithmetic this avoids. */
  for (const { scope } of c.scopes.filter((x) => x.scope.in))
    assert.ok(!kinds(dir, scope.id).parts, `"${scope.id}" is asked what the product's parts are, and it cannot know`);
});

test("⛔ the question carries the corpus's own nouns, so nobody starts from a blank page", () => {
  const dir = seed();
  const q = interviewFor(loadCorpus(dir), root(dir)).owed.find((o) => o.owes === "parts");
  assert.ok(q, "the tree is not asked for at all");

  const labels = q.about.already.map((a) => a.asks);
  assert.ok(labels.some((l) => /areas/.test(l)), "it does not offer the areas the corpus already has");
  assert.ok(labels.some((l) => /move the state of/.test(l)), "it does not offer what behaviours change");

  /** ⛔ The material is real, not an empty heading. */
  for (const a of q.about.already) assert.ok(a.says.length > 3, `"${a.asks}" is an empty line`);

  /** ⛔ LIFTED, NOT INVENTED — every area it names is a scope that exists. */
  const titles = new Set(loadCorpus(dir).scopes.map(({ scope }) => (scope.title || scope.id).replace(/\s+/g, " ").trim()));
  const offered = q.about.already.find((a) => /areas/.test(a.asks)).says.split(" · ");
  for (const o of offered) assert.ok(titles.has(o), `"${o}" is offered as an area and is not a scope in this corpus`);

  /** ⛔ And it drafts nothing: a tree is a reading, and this file writes none. */
  assert.deepEqual(q.candidates, [], "the tree arrived as drafted options, which is software writing the decomposition");
  assert.match(q.act, /a person settles the subsystem tree/, "it does not route to the person who has to settle it");
});

test("⛔ one part flips it: the product stops being asked and the features start", () => {
  /**
   * ⛔ THE NON-ZERO BESIDE THE ZERO. "No `unserved` items" proves nothing on its own — it is also
   * what a broken reader produces. So both states are measured on one corpus: with no tree the
   * product is asked once; with a tree the features are asked instead.
   */
  const dir = seed();
  const at = root(dir);
  const before = kinds(dir, at);
  assert.equal(before.parts, 1);
  assert.ok(!before.unserved, "features are asked which parts serve them before any part exists");

  const c = loadCorpus(dir);
  const first = c.scopes.find((x) => x.scope.exchanges.length).scope;
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "capabilities", "a-part.md"),
    `---
id: a-part
title: A part of the system
does: Holds some state and answers about it.
in: ${at}
offers:
  - id: does-one-thing
    does: Does one thing somebody promised
    serves: [${first.id}#${first.exchanges[0].id}]
---

# A part of the system
`
  );

  const after = loadCorpus(dir);
  assert.equal(after.broken.length, 0, `the fixture does not load: ${after.broken.map((b) => b.why).join("; ")}`);
  assert.equal(capabilityTree(after).counts.capabilities, 1, "the part written above is not in the tree");

  const now = kinds(dir, at);
  assert.ok(!now.parts, "the product is still asked what its parts are after a part exists");
  assert.ok(now.unserved >= 1, "no feature is asked which parts serve it, though a tree now exists");
});

test("⛔ a feature asked which parts serve it is shown the parts that exist", () => {
  /**
   * Otherwise it is an invitation to invent more subsystems, which is exactly what `settleFirst`
   * says must not happen per feature.
   */
  const dir = seed();
  const at = root(dir);
  const c = loadCorpus(dir);
  const first = c.scopes.find((x) => x.scope.exchanges.length).scope;
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "capabilities", "a-part.md"),
    `---
id: a-part
title: A part of the system
does: Holds some state and answers about it.
in: ${at}
offers:
  - id: does-one-thing
    does: Does one thing somebody promised
    serves: [${first.id}#${first.exchanges[0].id}]
---

# A part of the system
`
  );

  const q = interviewFor(loadCorpus(dir), at).owed.find((o) => o.owes === "unserved");
  assert.ok(q, "no feature is asked which parts serve it");
  const parts = q.about.already.find((a) => /parts the system already has/.test(a.asks));
  assert.ok(parts, "the question does not say which parts exist, so it reads as an invitation to invent some");
  assert.match(parts.says, /A part of the system/);
  assert.match(q.shape, /a part the tree is missing rather than a promise to drop/, "nothing says what to do when no part fits");
  assert.match(q.act, /decomposer/, "it does not route to the role that works this out");
});
