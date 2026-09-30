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
