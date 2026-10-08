/**
 * ⛔ ONE ANALYSIS ACROSS A WHOLE CORPUS, OVER ONLY WHAT IS OUTSTANDING.
 *
 * Peter: *"let's do it - let's do the decomposer across a corpus. this should be extendable to view
 * state analysis, product analysis, etc."*
 *
 * `decomposer` landed with a grain — `each: "feature"` — and no way to ask which features still
 * needed one. So indexing a corpus meant a person listing its features by eye and spawning a role
 * per name: tedious on 36 scopes, and silently incomplete, because nothing said which were already
 * done and nothing said which were done against truth that has since moved.
 *
 * ⛔ WHAT IS PINNED HERE IS THE MECHANISM, NOT THE ANALYSES. Three things have to hold or
 * "extendable" is a claim rather than a property: every analysis answers the same three questions,
 * a sweep is incremental, and nothing in the sweep writes or spawns anything.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadCorpus } from "../dist/v2/load.js";
import { ANALYSES, sweep, sweeps, outstanding } from "../dist/v2/analyse.js";
import { servesHash } from "../dist/v2/demonstrate.js";
import { AUTHORS, SHIMS, COMMANDS } from "../dist/core/jobs.js";
import { parseFrontmatter } from "../dist/core/frontmatter.js";

function seed() {
  const dir = temp("v2an-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/**
 * ⛔ THE EXTENSIBILITY TEST, and it is the one worth having. Peter asked for a mechanism that
 * extends to analyses nobody has written. That is only true if every row owes the same contract and
 * nothing walks a special case — so this asserts the contract over the whole registry rather than
 * over the three rows that happen to exist.
 */
test("every analysis declares a real role, a grain, and units with a state and a reason", () => {
  assert.ok(ANALYSES.length >= 3, `only ${ANALYSES.length} analyses — this is asserting nothing`);
  const roles = new Set(AUTHORS.map((a) => a.name));
  const corpus = loadCorpus("v2-seed");

  for (const a of ANALYSES) {
    assert.ok(roles.has(a.role), `${a.name} names "${a.role}", which is not an author in the registry`);
    assert.ok(a.grain.length > 2, `${a.name} does not say what one unit is`);
    assert.ok(a.does.length > 20, `${a.name} does not say what it is for`);

    const units = a.units(corpus);
    assert.ok(units.length > 0, `${a.name} finds no units in the seed corpus at all`);
    for (const u of units) {
      assert.ok(["done", "stale", "missing"].includes(u.state), `${a.name} invented the state "${u.state}"`);
      assert.ok(u.ref && u.title, `${a.name} produced a unit with no ref or no title`);
      /** ⛔ A worklist entry with no reason is one somebody has to go and work out for themselves. */
      assert.ok(u.why && u.why.length > 10, `${a.name} unit ${u.ref} does not say why it needs doing`);
    }
    /** Refs are unique, or fanning over them runs the same role twice on one unit. */
    assert.equal(new Set(units.map((u) => u.ref)).size, units.length, `${a.name} returns a ref twice`);
  }
});

test("a sweep counts what is done, what is stale and what was never done", () => {
  const s = sweep(loadCorpus("v2-seed"), "capabilities");
  assert.ok(s, "the capabilities analysis is gone");
  assert.equal(s.done + s.stale + s.missing, s.units.length, "the tally does not add up to the units");
  // ⛔ The pristine seed has no capability layer at all, so every feature is work.
  assert.equal(s.done, 0);
  assert.ok(s.missing >= 2, `only ${s.missing} features need parts`);
  assert.equal(sweep(loadCorpus("v2-seed"), "a-name-nobody-registered"), null);
});

/**
 * ⛔ THE INCREMENTAL PROPERTY IS THE WHOLE VALUE. A sweep that returns every feature every time
 * costs thirty role runs to redo twenty-nine finished ones, and is a sweep nobody runs twice.
 */
test("doing the work takes a unit off the list, and rewording the truth puts it back", () => {
  const dir = seed();
  const before = sweep(loadCorpus(dir), "capabilities");
  assert.ok(
    outstanding(before).some((u) => u.ref === "money"),
    "money is not outstanding in the pristine seed — re-aim this test"
  );

  /** A part that serves two of money's promises, worked out from them as they now read. */
  const refs = ["money#record-earning#after", "money#record-spending#after"];
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  const write = (from) =>
    fs.writeFileSync(
      path.join(dir, "capabilities", "ledger.md"),
      `---\nid: ledger\ntitle: The ledger\ndoes: Holds every movement of a kid's money as an append-only record.\noffers:\n  - id: record-a-movement\n    does: Appends one movement against one kid and returns what they have afterwards.\n    serves:\n${refs
        .map((r) => `      - ${r}`)
        .join("\n")}\n    derived:\n      by: decomposer\n      at: 2026-10-08\n      from: ${from}\n---\nAppend-only is the whole design.\n`
    );
  write("sha256:placeholder0000");
  write(servesHash(loadCorpus(dir), refs));

  const after = sweep(loadCorpus(dir), "capabilities");
  assert.ok(
    !outstanding(after).some((u) => u.ref === "money"),
    `money is still outstanding after being worked out: ${JSON.stringify(after.units.find((u) => u.ref === "money"))}`
  );
  assert.equal(after.done, 1);

  /** ⛔ And the moment one of those promises is reworded it comes back, as STALE rather than
   *  missing — which is the distinction that makes a second run worth anything. */
  const money = path.join(dir, "truth", "money.md");
  const src = fs.readFileSync(money, "utf-8");
  const anchor = "The kid has that much more than they had before.";
  assert.ok(src.includes(anchor), "seed shape moved — re-aim this test");
  fs.writeFileSync(money, src.replace(anchor, "The kid has that much more than they had before, to the penny."));

  const reworded = sweep(loadCorpus(dir), "capabilities");
  const unit = reworded.units.find((u) => u.ref === "money");
  assert.equal(unit.state, "stale", "rewording a promise did not put its feature back on the list");
  assert.match(unit.why, /worked out from truth that has changed/);
  // ⛔ Stale sorts first: a unit that was done and now answers an older wording looks finished.
  assert.equal(outstanding(reworded)[0].ref, "money");
});

/**
 * ⛔ THE GRAIN IS NOT ALWAYS A FEATURE, which is the other half of "extendable". `designer`
 * declares `each: "screen no component renders"` and nothing could enumerate them.
 */
test("an analysis can run at a grain that is not a feature", () => {
  const drawings = ANALYSES.find((a) => a.name === "drawings");
  assert.ok(drawings, "the drawings analysis is gone");
  assert.equal(drawings.grain, "screen");
  const units = drawings.units(loadCorpus("v2-seed"));
  assert.ok(units.every((u) => u.ref.includes("#")), "a screen-grained unit is not addressed as one");
  assert.ok(units.length > 2, `only ${units.length} screens found`);

  /** A screen whose appearances share one picture is work, and reads as stale rather than missing. */
  const dir = seed();
  const f = path.join(dir, "truth", "money.md");
  const p = parseFrontmatter(fs.readFileSync(f, "utf-8"));
  const v = p.data.views[0];
  v.sketch_html = "<div>the screen</div>";
  v.states = [
    { when: "a", label: "One way", sketch_html: "<div>same</div>" },
    { when: "b", label: "Another way", sketch_html: "<div>same</div>" },
  ];
  fs.writeFileSync(f, `---\n${YAML.stringify(p.data)}---\n${p.content}`);
  const hit = sweep(loadCorpus(dir), "drawings").units.find((u) => u.ref === `money#${v.id}`);
  assert.equal(hit.state, "stale", "two appearances drawn with one picture read as finished");
});

/**
 * ⛔ IT WRITES NOTHING AND SPAWNS NOTHING, and that boundary is asserted rather than trusted.
 *
 * ProductOS cannot spawn a role — the host does, through the skill. A sweep that produced the
 * analysis itself would be the hand-authoring trap with a bigger engine behind it.
 */
test("a sweep writes nothing and names the role rather than running it", () => {
  const dir = seed();
  const snapshot = () =>
    fs
      .readdirSync(path.join(dir, "truth"))
      .map((f) => `${f}:${fs.statSync(path.join(dir, "truth", f)).size}`)
      .join("|");
  const before = snapshot();
  for (const a of ANALYSES) sweep(loadCorpus(dir), a.name);
  assert.equal(snapshot(), before, "running every analysis changed the corpus");
  assert.ok(!fs.existsSync(path.join(dir, "capabilities")), "a sweep created a capability layer");

  /**
   * The module names roles as strings and imports nothing that could spawn one or write.
   *
   * ⛔ READ OFF THE IMPORTS, NOT THE TEXT. The first version matched `spawn|exec|writeFile` against
   * the whole file and failed — on the header comment that says it does not spawn anything. A
   * guarantee asserted against prose is a guarantee that breaks when somebody documents it.
   */
  const src = fs.readFileSync("src/v2/analyse.ts", "utf-8");
  const imports = [...src.matchAll(/^import .*?from "(.+?)";$/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0, "the import walk is wrong, not the module");
  for (const i of imports)
    assert.ok(
      !/^node:/.test(i),
      `analyse.ts imports ${i} — a sweep that reaches the filesystem or a process can write or spawn`
    );
});

test("the route and the command that reach this are both declared", () => {
  const route = SHIMS.find((s) => s.route === "index a corpus");
  assert.ok(route, "nothing routes a corpus-wide analysis — it runs only when somebody remembers it");
  /** ⛔ The analysis roles are fanned, because one session doing all of them writes the shape it
   *  wrote last — the same reason the scan route fans its scopers. */
  for (const r of ["decomposer", "demonstrator", "designer"]) {
    const step = route.steps.find((s) => s.role === r);
    assert.ok(step, `${r} is not in the sweep route`);
    assert.equal(step.fan, true, `${r} is not fanned`);
  }
  /** ⛔ And the route keeps the thing that makes a sweep cheap: run the command first. */
  assert.ok(
    route.keeps.some((k) => k.includes("v2 analyse")),
    "the route does not keep running the command first, so a fan goes over everything"
  );
  assert.ok(COMMANDS.some((c) => c.name === "v2 analyse"), "the command is not declared");
});
