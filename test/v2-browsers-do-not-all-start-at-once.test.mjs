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

test("⛔ a half-made slot with no pid file is not a slot held forever", async () => {
  fs.mkdirSync(browserSlotHome, { recursive: true });
  const broken = path.join(browserSlotHome, "slot-0");
  fs.rmSync(broken, { recursive: true, force: true });
  /** Created, then the process died before it could write its pid — a real window, however small. */
  fs.mkdirSync(broken);

  const release = await takeABrowserSlot({ waitMs: 3000 });
  assert.equal(
    fs.readFileSync(path.join(broken, "pid"), "utf-8").trim(),
    String(process.pid),
    "a directory with no pid in it blocked the slot"
  );
  release();
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
