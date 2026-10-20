/**
 * ⛔ TWO AUTHORS BROKE THE SAME CORPUS THE SAME TWO WAYS IN ONE AFTERNOON.
 *
 * Writing in parallel on one hosted corpus, two roles each raised an open question and each left
 * out one required field. Both documents stopped parsing — and because a document that will not
 * load makes the whole corpus unjudgeable, `check` answered `cannot-judge-this-corpus` and
 * suppressed EVERY other feature's findings, including the authors who had done nothing wrong.
 *
 * The brief already stated both requirements. What it did not do was show the SHAPE either of them
 * was writing: its worked example puts a standing on `answer`, where the standing sits on the slot,
 * and neither failure was that. One was a standing on a named refusal OUTCOME, which the brief
 * never illustrated at all.
 *
 * ⛔ SO THIS PINS THE GUIDANCE, NOT THE PROSE AROUND IT. What must survive is: the refusal-outcome
 * shape, both field names, the consequence that it takes the whole corpus down rather than one
 * feature, and the instruction to read the document back — because the write SUCCEEDS either way.
 * The door takes the bytes; the refusal only appears when something tries to load them, which is
 * exactly why both authors thought they were finished.
 *
 * ⛔ And it asserts the INSTALLED copy too. A rule only in the repo is a rule no author reads.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const SOURCES = ["agents/productos-scoper.md", ".claude/agents/productos-scoper.md"];

for (const where of SOURCES) {
  test(`${where} shows a standing on a named refusal`, () => {
    const brief = fs.readFileSync(where, "utf-8");
    /** The shape neither author had an example of. */
    assert.match(brief, /refuses:\s*\n\s*outcomes:/, "the brief shows no standing on a refusal outcome");
    assert.match(brief, /asks:\s*told/, "the refusal example does not show what is in question");
  });

  test(`${where} names both fields that stop a corpus loading`, () => {
    const brief = fs.readFileSync(where, "utf-8");
    /**
     * ⛔ Both, by name. `about` without `replaces` is the review-the-rows failure; `replaces`
     * without `about` is the publish-pricing one. Either alone leaves half the hole open.
     */
    assert.match(brief, /\babout\b/, "the brief does not name `about`");
    assert.match(brief, /\breplaces\b/, "the brief does not name `replaces`");
    assert.match(
      brief,
      /REQUIRED beside an `about`|REQUIRED, and this is the one that gets missed/,
      "the brief does not mark either field as required where it is easy to miss"
    );
  });

  test(`${where} says one bad document stops the whole corpus`, () => {
    const brief = fs.readFileSync(where, "utf-8");
    assert.match(
      brief,
      /cannot-judge-this-corpus/,
      "the brief does not say that one unparseable document suppresses every other feature's findings"
    );
  });

  test(`${where} tells the author to read the document back`, () => {
    const brief = fs.readFileSync(where, "utf-8");
    /** The write succeeds either way, which is why "it posted ok" is not evidence. */
    assert.match(brief, /will-not-parse/, "the brief does not name what a reader would see");
    assert.match(
      brief,
      /v2 check --at/,
      "the brief does not tell the author to check the corpus loads before reporting"
    );
  });
}
