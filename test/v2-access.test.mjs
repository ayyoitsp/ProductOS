/**
 * ⛔ WHO MAY IS A THING THE PRODUCT HAS, NOT A SENTENCE EACH FEATURE WRITES AGAIN.
 *
 * Peter, reading a `may` slot that said *"Anybody in the organization whose role lets them create
 * deals here"*: *"we should probably solidify 'roles/permissions' as a cross-product concept, and
 * enumerate which permissions can access it. and at the top level we can configure whether we use
 * roles, permissions, or nothing like that."*
 *
 * That sentence is the tell. It names a role without naming it: it cannot be listed, cannot be
 * checked, and gets retyped slightly differently on every exchange in the product — so *"what can
 * an underwriter reach"* was answerable only by reading everything and trusting four spellings of
 * one idea.
 *
 * ⛔ AND THE PRODUCT DECIDES WHETHER IT HAS THE CONCEPT AT ALL. A one-user tool has no roles, and a
 * framework that nags it about them is making products describe themselves in its vocabulary rather
 * than their own. So every finding here is gated on `access:`, and `neither` is a real answer.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { reachOf } from "../dist/v2/grid.js";
import { Access, Exchange } from "../dist/v2/schema.js";

const ACCESS = `access:
  - id: underwriter
    kind: role
    means: somebody who prices deals and signs off on what the product tells a borrower
    holds: [create-deals, price-deals]
  - id: create-deals
    kind: permission
    means: may start a deal and put it on the list
  - id: price-deals
    kind: permission
    means: may run a sizing and publish what it produces
`;

function corpus({ access = "roles", held = ["create-deals"], says = "anybody whose role lets them create deals here" } = {}) {
  const dir = temp("v2acc-");
  fs.mkdirSync(path.join(dir, "corpus", "truth"), { recursive: true });
  fs.mkdirSync(path.join(dir, "productos"), { recursive: true });
  fs.writeFileSync(path.join(dir, "productos", "config.yaml"), `version: "0.1.0"\nexchange:\n  access: ${access}\n`);
  fs.writeFileSync(path.join(dir, "corpus", "access.yaml"), ACCESS);
  fs.writeFileSync(path.join(dir, "corpus", "truth", "pay.md"), `---
id: pay
title: Start a deal
exists: kept
happy_path:
  accomplishes: somebody starts a deal and it appears on the list
  brings: the deal they want to create
  ends_with: the deal is on the list at its first stage
  through: [the-form]
views:
  - id: the-form
    title: Start a deal
    parts:
      - { id: start, label: Start, role: commits }
exchanges:
  - id: start-a-deal
    title: Somebody starts a deal
    asked_by: person
    at: { view: the-form, part: start }
    finishes: true
    slots:
      may:
        says: ${JSON.stringify(says)}
${held.length ? `        held_by: [${held.join(", ")}]` : ""}
      answer:
        says: the deal is on the list at its first stage, with nothing sized yet
`);
  return path.join(dir, "corpus");
}

const kinds = (dir) => {
  const { corpus: c, findings } = checkCorpus(dir);
  assert.deepEqual(c.broken, [], `the fixture did not parse: ${JSON.stringify(c.broken)}`);
  return findings.map((f) => f.kind);
};

test("the roles and permissions a product has are loaded once and shared", () => {
  const c = loadCorpus(corpus());
  assert.equal(c.access.length, 3, "the product's access list did not load");
  assert.deepEqual(
    c.access.filter((a) => a.kind === "permission").map((a) => a.id),
    ["create-deals", "price-deals"]
  );
});

test("naming who may clears the prose finding", () => {
  assert.ok(!kinds(corpus()).includes("who-may-is-only-prose"));
});

/**
 * ⛔ THE FINDING THE CONCEPT EXISTS FOR, and it is a NOTE: the sentence is still the thing a person
 * agrees to, and an author may legitimately not know the role yet.
 */
test("prose with no name is reported where the product has roles", () => {
  const found = kinds(corpus({ held: [] }));
  assert.ok(found.includes("who-may-is-only-prose"), "a `may` that names nothing was not reported");
});

test("and is NOT reported where the product has no such concept", () => {
  assert.ok(!kinds(corpus({ access: "neither", held: [] })).includes("who-may-is-only-prose"),
    "a product with no roles is being told to name one — that is the framework imposing its vocabulary");
});

/** ⛔ A name resolving to nothing reads as a constraint and enforces none. Refused, like every other dangling ref. */
test("a may that names something the product does not have is refused", () => {
  const { findings } = checkCorpus(corpus({ held: ["chief-underwriter"] }));
  const f = findings.find((x) => x.kind === "may-names-nothing");
  assert.ok(f, "a `may` naming a role nobody defined was accepted");
  assert.equal(f.severity, "refuse");
  assert.match(f.what, /chief-underwriter/);
});

test("naming a permission in a product configured for roles only is reported", () => {
  const found = kinds(corpus({ access: "roles", held: ["create-deals"] }));
  assert.ok(found.includes("an-access-model-this-product-does-not-use"),
    "a permission was named in a roles-only product and nothing said so");
  assert.ok(!kinds(corpus({ access: "both", held: ["create-deals"] })).includes("an-access-model-this-product-does-not-use"));
});

/**
 * ⛔ THE QUESTION PROSE COULD NEVER ANSWER, from the end somebody asks it from: what can an
 * underwriter do here.
 */
test("what each role reaches is derived, through the permissions it holds", () => {
  const reach = reachOf(loadCorpus(corpus({ access: "both", held: ["create-deals"] })));
  const uw = reach.find((r) => r.id === "underwriter");
  assert.deepEqual(uw.reaches, ["pay#start-a-deal"],
    "a role did not inherit the reach of a permission it holds, so the same fact answers differently depending on which name an exchange used");
  assert.deepEqual(reach.find((r) => r.id === "create-deals").reaches, ["pay#start-a-deal"]);
  /** ⛔ A permission inside a role that nothing anywhere names. */
  assert.deepEqual(uw.idle, ["price-deals"]);
});

test("a role or permission nothing uses is reported", () => {
  const found = kinds(corpus({ access: "both", held: ["create-deals"] }));
  assert.ok(found.includes("nothing-uses-this-access"),
    "a permission that controls nothing was accepted — somebody will build a screen to grant it");
});

/** ⛔ A permission is not a bag of permissions. Only a role is. */
test("the model refuses a permission that holds things", () => {
  assert.ok(Access.safeParse({ id: "x", kind: "role", means: "a role that holds two things", holds: ["a", "b"] }).success);
  const bad = Access.safeParse({ id: "x", kind: "permission", means: "a permission pretending to be a role", holds: ["a"] });
  assert.ok(!bad.success, "a permission was allowed to hold permissions, so a role and a permission become the same thing");
});

/**
 * ⛔ `held_by` ANSWERS "WHO MAY", so it belongs to that slot and nowhere else — the same reasoning
 * as `outcomes` on `refuses`. A field meaningful on one slot and accepted on all eight gets written
 * on the wrong one, read by nothing, and looks correct in the file.
 */
test("held_by is refused on any slot but may", () => {
  const base = { id: "e", title: "An ask", asked_by: "person", at: { view: "v", part: "p" } };
  assert.ok(Exchange.safeParse({ ...base, slots: { may: { says: "an underwriter may", held_by: ["underwriter"] } } }).success);
  const bad = Exchange.safeParse({ ...base, slots: { answer: { says: "the deal is on the list", held_by: ["underwriter"] } } });
  assert.ok(!bad.success, "held_by was accepted on `answer`, where nothing reads it");
});
