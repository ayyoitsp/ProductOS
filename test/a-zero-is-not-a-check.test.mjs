/**
 * ⛔ THE RULE THAT SIX WASTED VERIFICATIONS PRODUCED, PINNED SO IT CANNOT QUIETLY LEAVE.
 *
 * Peter: *"why aren't you just looking at all variable substituion? are you just searching for 'n"?
 * what the heck?"* — a count that measured the wrong thing and agreed with what I wanted to be true.
 *
 * Six times in one week, across two sessions, the same shape: the measurement agreed with the
 * hypothesis, so nobody checked the measurement. `grep -c` counts lines, so three hundred
 * placeholders on one line read as 1. A sweep's number was quoted for two days after the sweep had
 * stopped happening that way. A `--since` filter matched nothing and printed an empty 2037-line
 * outage as a clean log.
 *
 * The worst of them is the one this rule is about: an attribute **omitted** when its condition is
 * absent, counted as 0 and reported as working. A zero there is not a weak check — there is no
 * failing state in the observation at all.
 *
 * ⛔ AND IT IS A TEST BECAUSE PROSE HAS NOT BEEN ENOUGH BEFORE. `framework-not-just-output` exists
 * for the same reason: a rule with a ⛔ on it was violated four times in one session. A failing
 * build is the only thing that has ever stopped one of these.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

/** Both files, because an author reads the skill and a session reads CLAUDE.md. */
const WHERE = ["CLAUDE.md", "skills/productos/SKILL.md"];

test("the rule about zeroes is in the instructions, in both places", () => {
  for (const file of WHERE) {
    const text = fs.readFileSync(file, "utf-8");
    assert.match(
      text,
      /A zero proves nothing unless you can say what a failing zero looks like/,
      `${file} does not carry the rule — a verification with no possible failing state is the one mistake made six times this week`
    );
    /**
     * ⛔ THE REMEDY, NOT JUST THE PROHIBITION. "Don't trust a zero" leaves somebody with nothing to
     * do instead; what closed every one of the six was making the shipped code answer differently
     * for cases that differ.
     */
    assert.match(text, /produce a non-zero/i, `${file} names the mistake and not what to do instead`);
  }
});

test("⛔ it quotes him, because a pattern cannot author an instruction", () => {
  /**
   * CLAUDE.md: the only route from a noticed pattern to a framework change is a change record, and
   * that requires somebody's verbatim words. A rule drawn from six of my own mistakes, written in
   * my own words, is an agent editing its own instructions.
   */
  for (const file of WHERE)
    assert.match(
      fs.readFileSync(file, "utf-8"),
      /are you just searching for/,
      `${file} states the rule without the correction it came from`
    );
});

test("the change record for it names both layers and is closed", () => {
  const rec = fs.readFileSync("changes/0135.yaml", "utf-8");
  assert.match(rec, /kind: instruction/);
  assert.match(rec, /instruct: \S/, "the instruct layer is unnamed");
  assert.match(rec, /pin: \S/, "the pin layer is unnamed — this file is it");
  assert.match(rec, /closed:/, "the record is open while the rule is in force");
});
