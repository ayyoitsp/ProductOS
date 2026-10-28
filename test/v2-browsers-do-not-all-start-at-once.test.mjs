/**
 * ⛔ NINE GATE FAILURES IN ONE DAY, EVERY ONE A DIFFERENT TEST, EVERY ONE GREEN ALONE.
 *
 * That is not nine flaky tests. It is one flaky condition with nine landing spots, and it cost about
 * two hours of deploy latency in re-runs — plus three separate sessions each going to look in their
 * own change first, because an assertion mismatch is indistinguishable from a broken feature.
 *
 * The condition, measured: `node --test` runs files in parallel up to `availableParallelism()` —
 * twelve here — in alphabetical order. Fourteen files spawn Chrome and they are NAMED for what they
 * do, so they sort together:
 *
 *     batch 14   3 browsers
 *     batch 15   5 browsers   ← v2-the-mock-…, v2-the-page-asks-…, v2-the-selection-editor-…
 *     batch 16   1 browser
 *
 * `v2-the-selection-editor-in-a-real-browser` is in batch 15 and failed three times.
 *
 * ⛔ THIS TEST ASSERTS THE CAP, NOT THE ABSENCE OF FLAKES. "The suite passed twice in a row" is not a
 * check — it has no failing state you can point at, and it is how a flake gets declared fixed by
 * whoever was lucky. What is checkable is the invariant underneath: however many processes want a
 * browser, only `browserSlots` of them hold one at a time.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { takeABrowserSlot, browserSlots, browserSlotHome } from "./support/browser-slots.mjs";

const held = () => {
  try {
    return fs.readdirSync(browserSlotHome).filter((d) => d.startsWith("slot-")).length;
  } catch {
    return 0;
  }
};

test("the cap is a number the harness and this test read from one place", () => {
  /** ⛔ Or the test asserts three while the harness allows five, and agrees with itself forever. */
  const harness = fs.readFileSync("test/support/chrome.mjs", "utf-8");
  assert.match(harness, /takeABrowserSlot\(\)/, "openPage no longer takes a slot, so nothing is capped");
  assert.match(harness, /releaseSlot\(\)/, "a slot is taken and never given back — the suite would deadlock");
  assert.ok(browserSlots >= 1 && browserSlots <= 6, `a cap of ${browserSlots} is not a cap`);
});

test("⛔ more waiters than slots, and the extra ones wait", async () => {
  const want = browserSlots + 2;
  const got = [];
  const releases = [];
  for (let i = 0; i < browserSlots; i++) releases.push(await takeABrowserSlot());
  assert.equal(held(), browserSlots, `only ${held()} of ${browserSlots} slots were taken`);

  /**
   * ⛔ THE TWO EXTRA MUST NOT RESOLVE YET, which is the whole claim. Without the cap these return
   * immediately and `settled` is 2 — the assertion below is what goes red when somebody deletes the
   * semaphore and leaves the import.
   */
  let settled = 0;
  const extra = Array.from({ length: want - browserSlots }, () =>
    takeABrowserSlot().then((r) => {
      settled++;
      return r;
    })
  );
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(settled, 0, `${settled} browser(s) beyond the cap of ${browserSlots} started anyway`);
  assert.equal(held(), browserSlots, "more slots are held than the cap allows");

  /** Give one back; exactly one waiter may proceed. */
  releases.pop()();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(settled, 1, `releasing one slot let ${settled} waiters through`);

  for (const r of releases) r();
  for (const r of await Promise.all(extra)) r();
  assert.equal(held(), 0, "slots survived their owners");
  got.length = 0;
});

test("⛔ a slot whose owner is dead is reclaimed, or one killed suite deadlocks every later one", async () => {
  /**
   * This is the failure mode that would be worse than the flake: `pkill -f "make deploy"` is how a
   * gate gets abandoned here — it happened four times in one afternoon — and it leaves processes dead
   * mid-test. A lock that outlives them turns an intermittent red into a permanent hang.
   */
  fs.mkdirSync(browserSlotHome, { recursive: true });
  const stale = path.join(browserSlotHome, "slot-0");
  fs.rmSync(stale, { recursive: true, force: true });
  fs.mkdirSync(stale);
  /** A pid that cannot be running: process 2^22 is above every default pid_max. */
  fs.writeFileSync(path.join(stale, "pid"), "4194304");

  const release = await takeABrowserSlot({ waitMs: 3000 });
  const owner = fs.readFileSync(path.join(stale, "pid"), "utf-8").trim();
  assert.equal(owner, String(process.pid), "the dead owner's slot was not reclaimed");
  release();
});

test("⛔ a half-made slot is left alone while it is fresh, and reclaimed once it is stale", async () => {
  /**
   * ⛔ BOTH STATES, BECAUSE THE FIRST VERSION OF THIS ONLY HAD ONE AND THE ONE IT HAD WAS WRONG.
   *
   * It asserted that a pid-less directory is reclaimed IMMEDIATELY. Claiming is two steps —
   * `mkdirSync(slot)` then `writeFileSync(slot/pid)` — so for a moment every legitimate claim looks
   * exactly like a crash. Reclaiming instantly meant a second process removed a directory the first
   * was still filling in, and the first process's write landed on nothing:
   *
   *     ENOENT: no such file or directory, open '…/productos-browser-slots/slot-1/pid'
   *       at takeABrowserSlot (browser-slots.mjs:126)
   *       at async openPage (chrome.mjs:196)
   *
   * It failed the deploy gate on a menu test that had nothing to do with it — a race in the CAP
   * reported as a defect in whatever file was unlucky.
   *
   * So the reclaim waits out a grace period, and this pins the pair: fresh is somebody mid-claim and
   * must be left alone; stale is a crash between the two writes and must be taken. One without the
   * other is satisfied by an implementation that is wrong in the opposite direction.
   */
  fs.mkdirSync(browserSlotHome, { recursive: true });
  const slot = (i) => path.join(browserSlotHome, `slot-${i}`);
  for (let i = 0; i < browserSlots; i++) fs.rmSync(slot(i), { recursive: true, force: true });

  /** FRESH: made a moment ago, no pid yet. Taking it would be taking it from its owner. */
  fs.mkdirSync(slot(0));
  const first = await takeABrowserSlot({ waitMs: 3000 });
  const tookTheFreshOne = fs.existsSync(path.join(slot(0), "pid"));
  first();
  assert.equal(tookTheFreshOne, false, "a slot somebody was still claiming was taken out from under them");

  /** STALE: the same shape, aged past the grace period — a process that died between the two writes. */
  for (let i = 0; i < browserSlots; i++) fs.rmSync(slot(i), { recursive: true, force: true });
  fs.mkdirSync(slot(0));
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(slot(0), old, old);
  const second = await takeABrowserSlot({ waitMs: 3000 });
  assert.equal(
    fs.readFileSync(path.join(slot(0), "pid"), "utf-8").trim(),
    String(process.pid),
    "an abandoned pid-less directory blocked the slot forever"
  );
  second();
});

test("⛔ waiting too long proceeds rather than failing the suite", async () => {
  /**
   * ⛔ THE DIRECTION THAT MATTERS. A semaphore that fails under contention reproduces exactly the
   * flakiness it exists to remove — a red suite, blocking a deploy, for a reason nobody can act on.
   * So past the deadline it runs one extra browser: a slower suite, never a false red.
   */
  const mine = [];
  for (let i = 0; i < browserSlots; i++) mine.push(await takeABrowserSlot());
  const started = Date.now();
  const release = await takeABrowserSlot({ waitMs: 300 });
  assert.ok(Date.now() - started >= 250, "it did not wait at all before giving up");
  assert.equal(typeof release, "function", "past the deadline it refused instead of proceeding");
  release();
  for (const r of mine) r();
});

test("⛔ the wait for a permit leaves the file time to do its work", () => {
  /**
   * ⛔ THIS CAP BLOCKED MAIN FROM DEPLOYING, which is the opposite of what a flake cap is for.
   *
   * `npm test` runs with `--test-timeout`, which exists so a hang becomes a verdict rather than a
   * green suite. The permit wait defaulted to 240s inside a 300s file budget, so under load a file
   * was killed BY THE FILE TIMEOUT WHILE STILL QUEUING, with 60s left for everything it actually
   * came to do:
   *
   *     not ok test/v2-a-deep-address-lands-where-it-points.test.mjs — timed out after 300000ms
   *       at takeABrowserSlot (browser-slots.mjs:107)
   *
   * It traded nine flakes for a gate that could not pass. So the two numbers are not independent,
   * and nothing was holding them in any relation — each looked reasonable alone.
   *
   * ⛔ HALF, NOT "LESS THAN". Waiting 299s of a 300s budget satisfies "less than" and leaves a file
   * one second to render a page in a real browser. The point is that a starved file still has room
   * to finish, not merely that it is not killed mid-wait.
   */
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const fileBudget = Number(/--test-timeout=(\d+)/.exec(pkg.scripts.test)[1]);
  const slots = fs.readFileSync("test/support/browser-slots.mjs", "utf-8");
  const wait = Number(/waitMs = (\d+)/.exec(slots)[1]);

  assert.ok(fileBudget > 0 && wait > 0, `could not read the two budgets: wait ${wait}, file ${fileBudget}`);
  assert.ok(
    wait * 2 <= fileBudget,
    `a file may wait ${wait / 1000}s for a permit inside a ${fileBudget / 1000}s budget — it can be killed while queuing`
  );
  /** ⛔ And the wait has to be long enough to actually smooth a batch, or the cap bounds nothing. */
  assert.ok(wait >= 30000, `a ${wait / 1000}s wait gives up before a slow browser has finished starting`);
});
