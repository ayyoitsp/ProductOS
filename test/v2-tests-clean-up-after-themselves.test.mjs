/**
 * ⛔ THE SUITE LEFT 58,932 DIRECTORIES IN THE SYSTEM TEMP ROOT, AND THEN READ THEM BACK.
 *
 * Peter: *"wtf? where are those 60k files at?"*
 *
 * 95% of everything in `/var/folders/…/T` was ours — one throwaway corpus per `fs.mkdtempSync`,
 * accumulated over ten days, because 45 of 74 test files never removed what they made. It was not
 * merely untidy: `drawFromRoute` indexes a route's neighbourhood, and a route in
 * `/var/folders/…/T/draw5-x/` has the temp ROOT one level up — so the suite's own litter became the
 * suite's input, 52 seconds a call and 216 seconds in one test.
 *
 * `v2-draw-stays-in-the-project` bounded the walk, so the drawing no longer READS the litter. This
 * is the half that stops it being MADE, and it is two assertions because either alone is hollow:
 *
 *   · the reaping works — asserted by running a real process and looking at the disk after it dies
 *   · nothing bypasses it — asserted over the source, because the fix is worth nothing if the next
 *     file written calls `mkdtempSync` itself, which is what all 74 of them did
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp, tempsMade } from "./support/temp.mjs";

/**
 * ⛔ A REAL CHILD PROCESS, BECAUSE THE GUARANTEE IS ABOUT EXIT AND THIS PROCESS HAS NOT EXITED.
 * Calling `reap()` directly would assert that `rmSync` removes a directory — true, and not the
 * claim. The claim is that a test file which never mentions cleanup still cleans up, and the only
 * witness is a process that has already died.
 */
test("a directory a test makes is gone once that test's process exits", () => {
  const here = path.resolve("test/support/temp.mjs");
  const out = execFileSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(here)}).then(({ temp }) => {
         const a = temp("reaped-");
         const b = temp("reaped-");
         require("node:fs").writeFileSync(a + "/something.md", "a corpus");
         console.log(JSON.stringify([a, b]));
       })`,
    ],
    { encoding: "utf-8" }
  );
  const [a, b] = JSON.parse(out.trim());

  /** ⛔ Non-empty first: a vacuous pass here would be the leak reported as a fix. */
  assert.ok(a && b && a !== b, `the child did not make two directories: ${out}`);
  assert.ok(!fs.existsSync(a), `${a} outlived the process that made it — with a file in it`);
  assert.ok(!fs.existsSync(b), `${b} outlived the process that made it`);
});

/**
 * ⛔ AND A THROWING TEST IS THE CASE A TRAILING `rmSync` NEVER COVERED. 29 of 74 files did call it,
 * at the end of the test — which is not reached when an assertion fails, so the files that "cleaned
 * up" still littered on every red run. An exit hook does not care how the process got there.
 */
test("a directory survives nothing, not even the test that made it throwing", () => {
  const here = path.resolve("test/support/temp.mjs");
  let out = "";
  try {
    execFileSync(
      process.execPath,
      [
        "-e",
        `import(${JSON.stringify(here)}).then(({ temp }) => {
           const d = temp("threw-");
           console.log(d);
           process.exitCode = 1;
           throw new Error("the test failed, as tests do");
         })`,
      ],
      { encoding: "utf-8" }
    );
  } catch (e) {
    out = e.stdout ?? "";
  }
  const dir = out.trim().split("\n").pop();
  assert.ok(dir && dir.includes("threw-"), `the child never reported its directory: ${JSON.stringify(out)}`);
  assert.ok(!fs.existsSync(dir), `${dir} survived a failing test — the leak is still open on every red run`);
});

/**
 * ⛔ THE ONE THAT MATTERS IN SIX MONTHS. Every one of those 74 files was written by somebody who
 * could have cleaned up and did not, 45 times out of 74 — so the fix cannot be a convention. Same
 * argument as `framework-not-just-output`: prose with a ⛔ on it did not stop this, a failing build
 * does.
 */
test("no test reaches for mkdtempSync itself", () => {
  const files = fs
    .readdirSync("test")
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => path.join("test", f))
    .concat(
      fs
        .readdirSync("test/support")
        .filter((f) => f.endsWith(".mjs"))
        .map((f) => path.join("test/support", f))
    );
  assert.ok(files.length > 50, `only found ${files.length} test files — this check is looking in the wrong place`);

  const offenders = files.filter(
    (f) =>
      f !== path.join("test", "support", "temp.mjs") &&
      /**
       * ⛔ A CALL, NOT THE WORD — this file names it in prose four times and tripped its own check
       * on the first run. The dot and the paren are what make it a call site.
       */
      /\.mkdtempSync\(/.test(fs.readFileSync(f, "utf-8"))
  );
  assert.deepEqual(
    offenders,
    [],
    `these call mkdtempSync directly, so what they make is never reaped — use temp() from ./support/temp.mjs:\n  ` +
      offenders.join("\n  ")
  );

  /** ⛔ And the route they must use still registers the hook, or the check above guards a no-op. */
  const src = fs.readFileSync("test/support/temp.mjs", "utf-8");
  assert.match(src, /process\.on\("exit", reap\)/, "temp() no longer reaps at exit — every test leaks again");
});

/** `temp()` is still a temp directory, and still carries the prefix that attributes a leak. */
test("temp() hands back a real directory under the system temp root, named for its test", () => {
  const d = temp("pos-reap-");
  assert.ok(fs.statSync(d).isDirectory(), `${d} is not a directory`);
  /**
   * ⛔ `os.tmpdir()` UNRESOLVED. The first version compared against `fs.realpathSync(os.tmpdir())`
   * and failed — on macOS that is `/private/var/folders/…` while `mkdtempSync` hands back
   * `/var/folders/…`. My assertion was wrong, not the directory.
   */
  assert.equal(path.dirname(d), os.tmpdir(), `${d} is not directly under the temp root`);
  assert.match(path.basename(d), /^pos-reap-/, "the prefix is gone, so a leaked directory names nothing");
  assert.ok(tempsMade().includes(d), "it was handed back without being registered for reaping");
});
