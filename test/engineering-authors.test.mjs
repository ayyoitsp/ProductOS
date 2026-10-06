/**
 * ⛔ ENGINEERING HAD NO AUTHOR, AND HALF THE MODEL WAS NOBODY'S.
 *
 * Peter: *"let's add some engineering authors! they should be authoring the capabilities anyways"*.
 *
 * `asked_by` has three values and the corpus only ever had an author for one of them. The role that
 * wrote exchanges asks *"where does somebody meet it"* — which a system- or integrator-asked ask has
 * no answer to, because nobody meets it anywhere. Measured before this landed: `integrator` appeared
 * in no authoring prompt at all, `triggered_by` once, `depends_on` once, `instruments` once —
 * against fourteen mentions of `why`.
 *
 * Engineering existed in the registry only as judges: three roles reviewing work no engineering role
 * wrote.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { AUTHORS, AGENTS, SHIMS as ROUTES } from "../dist/core/jobs.js";

const author = (name) => AUTHORS.find((a) => a.name === name);
const prompt = (name) => fs.readFileSync(path.join(process.cwd(), author(name).prompt), "utf-8");

test("an engineering author exists, and writes the half nobody presses", () => {
  const eng = AUTHORS.filter((a) => a.discipline === "engineering");
  assert.ok(eng.length >= 1, "engineering is still judges reviewing work nobody wrote");
  const m = author("machinist");
  assert.equal(m.discipline, "engineering");
  assert.match(m.asks, /nobody presses/, "its question has to be the one the scoper's cannot answer");
});

test("⛔ the machinery half has exactly one owner, and it is not the scoper", () => {
  /**
   * `writes` exists so two authors cannot both believe they own a field. The scoper used to say
   * "exchanges" flat, which claimed the half its question cannot frame.
   */
  const scoper = author("scoper").writes.join(" | ");
  assert.match(scoper, /person-asked exchanges/, "the scoper still claims every exchange");
  assert.doesNotMatch(scoper, /system- and integrator-asked/, "two authors cannot both own the machinery half");
  assert.match(author("machinist").writes.join(" | "), /system- and integrator-asked exchanges/);
});

test("⛔ `depends_on` has an owner, and had none", () => {
  /**
   * The schema calls it "the only thing carrying the structure the deleted capability tree used to
   * hold, so a builder needs it" — and it was named once across every authoring prompt. A field
   * that is validated and rendered and written by nobody is filled in by nobody honestly.
   */
  const owners = AUTHORS.filter((a) => a.writes.some((w) => w.includes("depends_on")));
  assert.equal(owners.length, 1, "`depends_on` is owned by none or by several");
  assert.equal(owners[0].name, "machinist");
});

test("⛔ the measure/instrument seam is split across two disciplines, deliberately", () => {
  /**
   * What counts as having worked is product's call; what gets recorded to answer it is
   * engineering's. One role holding both records what is easy and calls that the measure.
   */
  const inst = author("instrumenter");
  assert.equal(inst.discipline, "engineering");
  assert.match(inst.writes.join(" | "), /instruments/);
  assert.match(inst.never.join(" | "), /write a measure/, "nothing stops it marking its own homework");

  const measureOwners = AUTHORS.filter((a) => a.writes.some((w) => /\bmeasures\b/.test(w)));
  assert.deepEqual(
    measureOwners.map((a) => a.name),
    ["scoper"],
    "⛔ a prohibition on writing measures means nothing until somebody owns them — this was the gap that made the `never` decorative"
  );
});

test("⛔ engineering authors run where truth is written; engineering judges still wait", () => {
  /**
   * The spec pass is product-and-design-only on the strength of "nail down human truth before we
   * need to involve engineers/qa" — and that rule is about a READ of a draft, which comes back
   * phrased as fact. Writing is the opposite act: a trigger is a sentence somebody has to AGREE to,
   * so it must exist before the agreeing or the machinery is the one part nobody ever validated.
   */
  const spec = ROUTES.find((r) => r.route === "scope a feature");
  const names = spec.steps.map((s) => s.role);
  assert.ok(names.includes("machinist"), "the machinery half is written after somebody signed off, or never");
  assert.ok(names.includes("instrumenter"));

  const judgeNames = new Set(AGENTS.filter((a) => a.discipline === "engineering").map((a) => a.name));
  for (const n of names)
    assert.ok(!judgeNames.has(n), `${n} judges, and judging a draft nobody agreed to is what the split exists to prevent`);
});

test("every engineering author is reachable from a route, and fans where a codebase demands it", () => {
  const reached = new Set(ROUTES.flatMap((r) => r.steps.map((s) => s.role)));
  for (const a of AUTHORS.filter((x) => x.discipline === "engineering"))
    assert.ok(reached.has(a.name), `${a.name} runs only when somebody remembers it`);

  const scan = ROUTES.find((r) => r.route === "scan a codebase");
  for (const n of ["machinist", "instrumenter"]) {
    const step = scan.steps.find((s) => s.role === n);
    assert.ok(step?.fan, `${n} must fan over a whole codebase — one session reading all of it writes the shape it wrote last`);
  }
});

test("⛔ the prompts forbid the substrate, which is this role's own failure mode", () => {
  /**
   * The source material for both of these is all machinery and all schema. Transcribing it is the
   * shortest path, and "nothing a reader sees mentions the storage" is the rule it would break.
   */
  assert.match(prompt("machinist"), /queue, a cron expression, a table/i);
  assert.match(prompt("instrumenter"), /column, a table, an event schema/i);
});

test("⛔ neither prompt teaches a refusal that does not exist", () => {
  /**
   * The failure this repo keeps repeating is instructions drifting from the schema — four
   * documented fields that could not parse. Both prompts name refusals; each is asserted here
   * against the thing that actually refuses, rather than trusted.
   */
  assert.match(prompt("machinist"), /nothing saying what sets it off/);
  assert.match(prompt("instrumenter"), /`feeds` resolves to nothing/);

  const check = fs.readFileSync(path.join(process.cwd(), "src/v2/check.ts"), "utf-8");
  assert.match(check, /an-instrument-feeds-nothing-that-exists/, "the instrumenter cites a finding kind that is gone");
});

test("⛔ an engineering author is still an author — it settles nothing and asks nobody", () => {
  for (const a of AUTHORS.filter((x) => x.discipline === "engineering")) {
    assert.equal(a.authors, true);
    assert.ok(!a.needs.includes("ask-the-human"), `${a.name} could obtain consent with no record of how`);
    assert.match(a.never.join(" | "), /stamp anything/, `${a.name} does not say it may not stamp`);
  }
});
