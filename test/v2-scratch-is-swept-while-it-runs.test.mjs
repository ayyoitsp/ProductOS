import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { temp } from "./support/temp.mjs";

/**
 * ⛔ 885 ABANDONED SCRATCH DIRECTORIES TOOK 4100 DOWN, AND THE SYMPTOM WAS A SILENT HANG.
 *
 * Every request materializes the corpus into a temp directory. A mutating request removes its own;
 * a dirty shared one is thrown away. But a SUPERSEDED shared directory is only dropped from the
 * cache — `entry.dir` replaced on a new fingerprint, `forgetDir`, `forgetRead`, eviction at
 * `READ_CEILING` — and nothing removes it. The first of those fires on every write.
 *
 * One orphan per write, all day, at 17.5 MB each. The only sweeper ran at BOOT, so startup had to
 * walk and delete gigabytes before `server.listen` — and logged nothing while doing it. The store
 * was reachable, DNS resolved, TCP connected, a query answered in 801ms, the port was mapped, and
 * nothing was listening. ⛔ The cost of starting grew with how long it had run, which is why it had
 * always worked before.
 */

const scratch = (root, name, ageMs = 0) => {
  const d = path.join(root, name, "corpus");
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "truth.md"), "x");
  if (ageMs) {
    const when = new Date(Date.now() - ageMs);
    fs.utimesSync(path.join(root, name), when, when);
  }
  return path.join(root, name);
};

test("a sweep removes what is old and leaves what a request may still be reading", async () => {
  const { sweepScratch } = await import("../dist/v2/store/server.js");
  const root = temp("productos-sweeptest-");

  const old = scratch(root, "productos-project-aaaaaa", 2 * 60 * 60 * 1000);
  const fresh = scratch(root, "productos-project-bbbbbb", 0);
  /** ⛔ Not ours, however old — the temp root is shared with whatever else runs. */
  const alien = scratch(root, "something-else-cccccc", 2 * 60 * 60 * 1000);

  const removed = sweepScratch(60 * 60 * 1000, root, Date.now());

  assert.deepEqual(removed, ["productos-project-aaaaaa"], `removed ${JSON.stringify(removed)}`);
  assert.equal(fs.existsSync(old), false, "the old scratch survived");
  assert.equal(fs.existsSync(fresh), true, "a fresh directory was removed — an in-flight request reads from it");
  assert.equal(fs.existsSync(alien), true, "something that is not ours was removed");
});

/**
 * ⛔ THE FIX IS THAT IT RUNS WHILE THE INSTANCE RUNS. The sweep itself already worked and was
 * already age-gated; what was missing is that it only ever ran once, at boot.
 */
test("the sweep runs on a timer, not only at boot", async () => {
  const { sweepScratchWhileRunning } = await import("../dist/v2/store/watchdog.js");

  let calls = 0;
  const said = [];
  const w = sweepScratchWhileRunning(5, () => { calls += 1; return calls === 1 ? ["productos-project-x"] : []; }, (s) => said.push(s));
  await new Promise((r) => setTimeout(r, 60));
  w.stop();

  assert.ok(calls >= 2, `the sweep ran ${calls} time(s) — it is not on a timer`);
  /** ⛔ One line when it removed something, silence when it did not. */
  assert.equal(said.length, 1, `said ${JSON.stringify(said)}`);
  assert.match(said[0], /swept 1 abandoned scratch/);
});

test("a sweep that throws does not take the instance down", async () => {
  const { sweepScratchWhileRunning } = await import("../dist/v2/store/watchdog.js");
  let calls = 0;
  const w = sweepScratchWhileRunning(5, () => { calls += 1; throw new Error("disk is angry"); }, () => {});
  await new Promise((r) => setTimeout(r, 60));
  w.stop();
  assert.ok(calls >= 2, "it stopped sweeping after the first throw");
});

/**
 * ⛔ AND BOOT SAYS WHAT IT IS DOING BEFORE THE SLOW PART. A startup stuck in the sweep was
 * indistinguishable from a dead process, because the newest line in the log was from the previous
 * boot. Checked on the source, since the alternative is booting an instance against a temp root
 * holding gigabytes.
 */
test("boot announces the sweep before it runs, and says so either way", () => {
  const src = fs.readFileSync("src/v2/store/server.ts", "utf-8");
  const at = src.indexOf("sweepScratch()");
  assert.ok(at > 0, "boot no longer sweeps");
  const before = src.slice(Math.max(0, at - 700), at);
  assert.match(before, /sweeping abandoned scratch/, "nothing is said BEFORE the slow step");
  const after = src.slice(at, at + 400);
  assert.match(after, /no abandoned scratch directories/, "a clean sweep says nothing, so silence stays ambiguous");
});

test("the periodic sweep is started from boot", () => {
  const boot = fs.readFileSync("src/v2/store/boot.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(boot, /sweepScratchWhileRunning\(/, "nothing starts the periodic sweep, so it only runs at boot again");
});
