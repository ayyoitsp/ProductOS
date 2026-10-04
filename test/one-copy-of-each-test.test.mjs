/**
 * ⛔ `npm test` IS A GLOB, SO WHATEVER IS IN `test/` RUNS — INCLUDING A FILE NOBODY MEANT TO COMMIT.
 *
 * `node --test test/*.test.mjs` ran a stale duplicate of a test file for a whole commit. It arrived
 * by accident: a file was redirected to a scratch directory under one name, copied into `test/`
 * without renaming, and the cleanup `rm` named the OTHER filename. `git add -A` committed it.
 *
 * ⛔ AND IT PASSED, WHICH IS WHY NOTHING CAUGHT IT. The duplicate was the version BEFORE two
 * assertions in it were sharpened — including one that failed with "Cannot read properties of null
 * (reading '1')" instead of naming its cause. So the suite reported 491 green while carrying four
 * assertions known to be defective, and the count going UP read as the fix landing. Found by
 * another session reading the commit, not by anything here.
 *
 * The general form, rather than a guard against that one filename: no two files may define a test
 * with the same name. A copy of a file is a copy of every name in it, so this catches the next one
 * without knowing to look for it.
 *
 * ⛔ AND A SHARED NAME IS A DEFECT IN ITS OWN RIGHT, which is what the first run of this found —
 * not a copy, but two genuinely different tests of the same claim at two layers: a token
 * CONFIGURED in the environment, and a token ISSUED into the store. Both read "an unknown scope
 * name in a token grants nothing", so `not ok — an unknown scope name in a token grants nothing`
 * named neither of them. In a 491-test suite the name IS the address of a failure. Both were
 * renamed to say which layer they are about rather than this rule being loosened to tolerate them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

test("no two test files define the same test", () => {
  const files = fs.readdirSync("test").filter((f) => f.endsWith(".test.mjs"));
  assert.ok(files.length > 50, `only ${files.length} test files found — is this running from the repo root?`);

  /** ⛔ The name as written, including the backtick form, because a copy reproduces it exactly. */
  const homes = new Map();
  for (const f of files) {
    for (const m of fs.readFileSync(`test/${f}`, "utf-8").matchAll(/^\s*test\(\s*(["'`])([\s\S]*?)\1/gm)) {
      const name = m[2];
      homes.set(name, [...(homes.get(name) ?? []), f]);
    }
  }
  assert.ok(homes.size > 200, `only ${homes.size} test names parsed — the matcher has stopped working`);

  const shared = [...homes]
    .filter(([, where]) => where.length > 1)
    .map(([name, where]) => `"${name.slice(0, 60)}" in ${where.join(" and ")}`);
  assert.deepEqual(shared, [], `the same test is defined in more than one file:\n  ${shared.join("\n  ")}`);
});
