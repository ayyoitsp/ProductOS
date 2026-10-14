/**
 * ⛔ THE ENVIRONMENT CONVENIENT TO MEASURE IN IS NOT THE ENVIRONMENT THE THING LIVES IN.
 *
 * Peter, pressing Add on the live page: *"Not saved: Not Found"*.
 *
 * Three defects in two days, same shape — the code right about where it was tested and wrong about
 * where it runs:
 *
 *   1. every page write, checked against the local stack. Local serves at `/`, hosted serves under
 *      `/p/<project>/` — so seven root-relative urls, including the composer, the acknowledgement
 *      thread and the live connection, 404ed on the only page anybody reviews on.
 *   2. the side menu, measured in the default headless window. Its rules live inside
 *      `@media (min-width: 62rem)`, so a correct page measured as broken.
 *   3. the config, read from a corpus directory, which is reachable in a way a temp dir is not.
 *
 * ⛔ THE FIRST IS THE ONE NOTHING COULD SEE, and it is why this is written down rather than
 * remembered. A browser test that replaces `fetch` asserts what a handler SENDS, so a wrong url
 * passes — it would go green on `/nonsense`. A parse check reads the script. `tsc` cannot see inside
 * a template string. And the stack anybody develops against is the one where the bug cannot occur.
 *
 * ⛔ A TEST, BECAUSE PROSE HAS FAILED HERE BEFORE. `framework-not-just-output` exists because a rule
 * with a ⛔ on it was violated four times in one session, and this file is the same device: the rule
 * and its remedy must be in both places a session reads, with the words that produced it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

/** CLAUDE.md is what a session reads; the skill is what an author reads. Both, or it reaches one. */
const WHERE = ["CLAUDE.md", "skills/productos/SKILL.md"];

test("the rule about environments is in the instructions, in both places", () => {
  for (const file of WHERE) {
    const text = fs.readFileSync(file, "utf-8");
    assert.match(
      text,
      /environment convenient to measure in is not the environment the thing lives in/,
      `${file} does not carry the rule — three defects in two days came from exactly this`
    );
    /**
     * ⛔ THE REMEDY, NOT JUST THE PROHIBITION. "Beware your environment" leaves somebody with
     * nothing to do; what closed all three was verifying against the shape the thing ships in.
     */
    assert.match(text, /verify against the shape the thing (actually )?ships in/i, `${file} names the mistake and not what to do instead`);
  }
});

test("⛔ the environment rule quotes him, because a pattern cannot author an instruction", () => {
  /**
   * CLAUDE.md: the only route from a noticed pattern to a framework change is a change record, and
   * that requires somebody's verbatim words. A rule drawn from three of my own mistakes, written in
   * my own words, would be an agent editing its own instructions.
   */
  for (const file of WHERE)
    assert.match(fs.readFileSync(file, "utf-8"), /Not saved: Not Found/, `${file} states the rule without the report it came from`);
});

test("⛔ all three instances are named, not just the one that was reported", () => {
  /**
   * One instance is an anecdote and reads as a fixed bug. The rule is only worth having because the
   * same shape produced three unrelated defects — a serving path, a viewport width, and a working
   * directory — and a reader who sees only the url one will not recognise the next.
   */
  const text = fs.readFileSync("CLAUDE.md", "utf-8");
  for (const [what, pattern] of [
    ["the serving path", /\/p\/<project>\//],
    ["the viewport width", /min-width: 62rem/],
    ["the working directory", /temp dir/],
  ])
    assert.match(text, pattern, `${what} is not named, so the rule reads as one fixed bug`);
});

test("the environment rule's change record names both layers and is closed", () => {
  const rec = fs.readFileSync("changes/0141.yaml", "utf-8");
  assert.match(rec, /kind: instruction/);
  assert.match(rec, /instruct: \S/, "the instruct layer is unnamed");
  assert.match(rec, /pin: \S/, "the pin layer is unnamed — this file is it");
  assert.match(rec, /closed:/, "the record is open while the rule is in force");
});
