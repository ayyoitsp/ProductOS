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

/**
 * ⛔ TWO AUTHORS DECLARED THE CRITERIA LAYER, AND IT IS THE FIELD WHERE THAT COSTS THE MOST.
 *
 * Peter: *"a product person doesn't write a criterion - what even is this? this is old shit. the
 * agents decide what kind of tests need to exist."* The `demonstrator` was added for exactly that,
 * and `agents/productos-scoper.md` was rewritten to say *"Write no `criteria:` at all"* — but the
 * scoper's own `writes` still said *"criteria — what would show a sentence holding"*. So the field
 * whose owner decides whether tests are well defined had two owners in the one list that exists to
 * stop that, and an author reading the registry saw permission the prompt had taken away.
 *
 * ⛔ WHY THIS FIELD AND NOT ANOTHER: what a second owner produces is a typed criterion beside a
 * derived one with no `derived.from` — so nothing can re-derive it, nothing stales it when the claim
 * is reworded, and `analyse requirements` reports the feature as done.
 */
test("⛔ the criteria layer has exactly one owner, and it is not the scoper", () => {
  const mentions = AUTHORS.flatMap((a) => a.writes.filter((w) => /\bcriteri/.test(w)).map((w) => [a.name, w]));
  assert.deepEqual(
    mentions.filter(([, w]) => /^criteria\b/.test(w)).map(([n]) => n),
    ["demonstrator"],
    "the artefact a builder implements is owned by none or by several"
  );
  /**
   * ⛔ AND THE ONE OTHER ROLE THAT SAYS THE WORD IS POINTING AT THEM, NOT WRITING THEM. The
   * `evidencer` writes *"evidence against criteria"* — the opposite direction, and the distinction
   * is the whole reason `test-design` exists: finding what already demonstrates a claim is not
   * deciding what would have to be demonstrated.
   */
  for (const [name, w] of mentions)
    if (name !== "demonstrator")
      assert.match(w, /evidence against criteria/, `the author "${name}" claims part of the criteria layer: ${w}`);
  /** ⛔ And the owner owns the whole of it — a criterion nobody can re-derive is the defect. */
  assert.match(author("demonstrator").writes.join(" | "), /`derived`/);
  /** ⛔ The prompt already said so; this is the half that lagged, so both are asserted. */
  assert.match(prompt("scoper"), /Write no `criteria:` at all/);
  /** ⛔ And the judge of this layer is still forbidden to fix what it finds. */
  const td = AGENTS.find((a) => a.name === "test-design");
  assert.ok(td?.judges, "the role that reads criteria no longer judges");
  assert.ok(!td.needs.includes("write-corpus"), "the criteria judge can write — it would repair instead of reporting");
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

  /**
   * ⛔ `buildability` IS EXEMPT BY DECISION, AND IT IS THE ONLY ONE.
   *
   * The rule above is right about what a judge's read does to a draft. What changed is a number:
   * on Peter's corpus 1 of 131 features is past `ready for review`, so the one role that can find
   * what is MISSING rather than what is blank could run on one feature — and only on features
   * already validated, which is backwards. Offered split / exempt / leave-gated, he chose
   * *"Exempt it — just run it early ... verdict and all."* `agents-and-areas` carries the longer
   * note and what to do if it bites.
   *
   * ⛔ THE TEST STILL BITES FOR EVERY OTHER ENGINEERING JUDGE — `truthfulness` and `architecture`
   * — so this is one named exemption rather than the split being abandoned.
   */
  const judgeNames = new Set(
    AGENTS.filter((a) => a.discipline === "engineering" && a.name !== "buildability").map((a) => a.name)
  );
  for (const n of names)
    assert.ok(!judgeNames.has(n), `${n} judges, and judging a draft nobody agreed to is what the split exists to prevent`);
  /** ⛔ And the exemption is real rather than vacuous: the role it names is actually on the route. */
  assert.ok(names.includes("buildability"), "buildability was exempted from the gate and then not run early anyway");
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
    /**
     * ⛔ THE CLAIM, NOT THE PHRASING. This matched `/stamp anything/` and broke when the
     * decomposer's line became "stamp, validate or accept anything — ⛔ including a capability",
     * which says strictly more of the same thing. A pattern coupled to one wording turns every
     * sharpening of an instruction into a failure, and the next person makes the words fit the
     * regex rather than the regex fit the words.
     */
    assert.match(
      a.never.join(" | "),
      /\bstamp\b[^|]*\banything\b/,
      `${a.name} does not say it may not stamp anything`
    );
  }
});
