/**
 * ⛔ THE HAPPY PATH HAS TO JOIN UP, AND NOTHING ASKED WHETHER IT DID.
 *
 * Peter: *"one of our agents most assuredly should check that the happy path is 'complete'. this
 * most certainly isn't."* He found it the only way it could be found — by pressing Continue on a
 * prototype, reaching the folder step, and having nowhere to go. Twice in one session.
 *
 * Every other reviewer looks at the PARTS: is the concept in every layer, is the claim pinned,
 * could a PM build this screen. All of those pass on a feature whose screens do not join into
 * anything, because each screen is individually complete.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import fs from "node:fs";

const { AGENTS } = await import(path.resolve("dist/core/jobs.js"));

test("somebody asks whether a feature can be walked from end to end", () => {
  const it = AGENTS.find((a) => a.name === "completeness");
  assert.ok(it, "no reviewer asks whether the happy path joins up");
  assert.match(it.asks, /start .*end|walk|path/i);
  assert.ok(it.prompt, "the reviewer is named in the registry with no prompt");
  assert.equal(it.judges, true, "it must judge and never write");
  assert.ok(!it.needs.includes("write-corpus"), "a reviewer that repairs hides how often it fires");
  /**
   * ⛔ THE DIRECTION OF A FINDING IS THE HARD PART, so it is in the prohibitions rather than left
   * to the prompt: reporting a framework gap as an author's mistake sends somebody to rearrange a
   * corpus that has no correct arrangement.
   */
  assert.ok(
    it.never.some((n) => /authoring mistake|ours|framework/i.test(n)),
    "nothing stops it routing a framework gap to the author"
  );
  /** ⛔ And it must walk the thing, not read about it — a path described is not a path walkable. */
  assert.ok(it.reads.some((r) => /prototype|render|walk/i.test(r)), "it never looks at the prototype");
});

/**
 * ⛔ EVERY ROLE READ SOURCE, AND A DRAWING IS CORRECT OR NOT VISUALLY.
 *
 * Peter: *"we should have an agent that can view our actually rendered site and match up the UX"*
 * and *"the designer agent should be able to look at existing sites and a design system to put
 * together the screens"*.
 *
 * `truthfulness` compares the corpus against the CODE — which catches a screen describing behaviour
 * the code does not have, and passes a screen that is faithful to the code and looks nothing like
 * the running product. That happened: a screen drawn from a route rendering six different products
 * came out as a wizard belonging to a different one. Legible, complete, about something else. No
 * amount of reading source would have found it, because the source is what produced it.
 */
const { CAPABILITIES, AUTHORS } = await import(path.resolve("dist/core/jobs.js"));

test("somebody looks at the running product, and the designer does too", () => {
  assert.ok(CAPABILITIES.includes("see-a-page"), "no role can look at a rendered page");

  const eyes = AGENTS.find((a) => a.name === "rendered");
  assert.ok(eyes, "no reviewer compares the drawing against the product a person sees");
  assert.ok(eyes.needs.includes("see-a-page"), "the visual reviewer cannot see");
  assert.ok(eyes.needs.includes("run-commands"), "it cannot bring the product up to look at it");
  assert.equal(eyes.judges, true);
  assert.ok(eyes.prompt, "it is named in the registry with no prompt");
  /**
   * ⛔ ITS HARDEST RULE. The corpus is the TARGET state, so a difference is drift — a fact about
   * what was built. A visual reviewer that concluded "the corpus is wrong, it does not match the
   * screen" would quietly make the product authoritative over the truth.
   */
  assert.ok(
    eyes.never.some((n) => /target state|drift|CORPUS being wrong/i.test(n)),
    "nothing stops it treating a difference as the corpus being wrong"
  );

  /** ⛔ And the designer draws by LOOKING, not by reading components. */
  const designer = AUTHORS.find((a) => a.name === "designer");
  assert.ok(designer.needs.includes("see-a-page"), "the designer draws screens it has never seen");
  assert.ok(
    designer.reads.some((r) => /design system/i.test(r)),
    "the designer never looks at the design system it is drawing in"
  );
});

/** ⛔ A capability is portable; only the adapter knows this host's name for it. */
test("the capability maps onto this host, and a prompt never names its tools", () => {
  const adapter = fs.readFileSync("src/adapters/claude.ts", "utf-8");
  assert.match(adapter, /"see-a-page":/, "the new capability has no mapping, so nothing can install with it");
  for (const f of ["agents/productos-rendered.md", "agents/productos-designer.md"]) {
    const body = fs.readFileSync(f, "utf-8");
    assert.doesNotMatch(body, /mcp__claude-in-chrome/, `${f} names this host's tools — declare a capability instead`);
  }
});
