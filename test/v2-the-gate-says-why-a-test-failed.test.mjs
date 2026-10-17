/**
 * ⛔ "A TEST FAILED" IS NOT A DIAGNOSIS, AND THE GATE THREW THE DIAGNOSIS AWAY.
 *
 * Nine gate failures in one day. Every one printed its title and nothing else:
 *
 *     ✗ tests fail — not deploying. The failures:
 *         not ok 1053 - a second session sees the note as held rather than taking it twice
 *
 * So every one cost a separate re-run of that file just to learn whether it was a real defect or a
 * flake — one to three minutes each, before any thinking started. The reason was in `npm test`'s
 * output the whole time and `grep '^not ok'` dropped it:
 *
 *     error: |-
 *       {"raw":""}
 *       404 !== 200
 *     location: '…/test/v2-store-mcp.test.mjs:195:1'
 *
 * That is the difference between "a test failed" and "it got a 404 where it wanted a 200, at line
 * 195" — which is enough to tell a race from a regression without running anything.
 *
 * ⛔ LIFTED FROM THE MAKEFILE, NOT RETYPED. A copy of the extraction in this file would agree with
 * the gate on the day it was written and never again — the same reason `v2-staging-serves-what-is-merged`
 * lifts `MERGED_CHECK` instead of asserting the Makefile contains it.
 *
 * ⛔ AND DRIVEN AGAINST REAL TAP, not a hand-written imitation of it. The fixture below is node's
 * actual output shape, indentation included, because the extraction is entirely about indentation:
 * node indents a failure's YAML block by two spaces and ends it with `  ...`, and an anchored
 * `^not ok` is exactly what misses it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const makefile = () => fs.readFileSync(path.resolve("Makefile"), "utf-8");

/** The gate's own extraction, as a runnable command. */
function extractor() {
  const mk = makefile();
  const i = mk.indexOf("\nsuite-now:");
  assert.ok(i >= 0, "suite-now is gone");
  const body = mk.slice(i, mk.indexOf("\n\n", i + 1) === -1 ? undefined : mk.indexOf("\nverify", i));
  const line = body.split("\n").find((l) => l.includes("awk") && l.includes("not ok"));
  assert.ok(
    line,
    "suite-now no longer extracts a failure's diagnostic — it is back to printing titles, and every failure costs a re-run to diagnose"
  );
  return (
    line
      .replace(/^\s*/, "")
      /** make's escape for a literal shell `$`. */
      .replace(/\$\$/g, "$")
      .replace(/;\s*exit 1;\s*\\?\s*$/, "")
      /** The gate pipes its captured output in; here it comes from stdin. */
      .replace(/^echo "\$out" \|/, "cat |")
  );
}

/** node's real TAP for one passing and one failing test, indentation exactly as emitted. */
const TAP = `TAP version 13
# Subtest: a thing that works
ok 1 - a thing that works
  ---
  duration_ms: 1.5
  ...
# Subtest: the tool surface is listed over Streamable HTTP
not ok 2 - the tool surface is listed over Streamable HTTP
  ---
  duration_ms: 4024.292125
  location: 'test/v2-store-mcp.test.mjs:195:1'
  failureType: 'testCodeFailure'
  error: |-
    {"raw":""}

    404 !== 200

  code: 'ERR_ASSERTION'
  expected: 200
  actual: 404
  ...
1..2
# tests 2
# pass 1
# fail 1
`;

const run = (script, input) =>
  execFileSync("sh", ["-c", script], { input, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });

test("the gate prints the reason a test failed, not only its name", () => {
  const out = run(extractor(), TAP);
  assert.match(out, /not ok 2 - the tool surface is listed over Streamable HTTP/, "the failure's name is gone");
  /**
   * ⛔ THE THREE THAT TURN A RE-RUN INTO A READ. Without the assertion text there is no way to tell a
   * flake from a regression; without the location there is no way to find it; and `expected`/`actual`
   * is what distinguishes "it answered wrongly" from "it never answered".
   */
  assert.match(out, /404 !== 200/, "the assertion that failed is not shown");
  assert.match(out, /v2-store-mcp\.test\.mjs:195/, "where it failed is not shown");
  assert.match(out, /expected: 200/, "what it wanted is not shown");
});

test("⛔ a passing test's block is not dragged in with it", () => {
  /**
   * The extraction keys on indentation, so the obvious wrong version — print everything after the
   * first `not ok` — would include every later test's output and bury the failure it exists to show.
   */
  const out = run(extractor(), TAP);
  assert.doesNotMatch(out, /a thing that works/, "a passing test's output came along");
  assert.doesNotMatch(out, /^1\.\.2$/m, "the plan line came along, so the block never closed");
});

test("⛔ two failures are both reported, with their own reasons", () => {
  const two = TAP.replace(
    "1..2",
    `# Subtest: a second session sees the note as held
not ok 3 - a second session sees the note as held
  ---
  location: 'test/v2-store-loop.test.mjs:88:1'
  error: |-
    held !== taken
  ...
1..3`
  );
  const out = run(extractor(), two);
  assert.match(out, /404 !== 200/, "the first failure's reason is missing");
  assert.match(out, /held !== taken/, "the second failure's reason is missing");
  assert.match(out, /v2-store-loop\.test\.mjs:88/, "the second failure's location is missing");
});

test("⛔ it is bounded, because a suite that fails everywhere must not bury the gate's own verdict", () => {
  /**
   * A run where a hundred tests fail would otherwise print thousands of lines and push
   * `make: *** [deploy-check] Error 2` — the thing a reader is looking for — off the top.
   */
  const line = makefile()
    .split("\n")
    .find((l) => l.includes("awk") && l.includes("not ok"));
  assert.match(line, /head -\d+/, "the failure report is unbounded");
});
