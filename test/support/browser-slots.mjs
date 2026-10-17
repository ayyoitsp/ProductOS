/**
 * ⛔ HOW MANY BROWSERS MAY EXIST AT ONCE, ACROSS EVERY TEST PROCESS AT THE SAME TIME.
 *
 * Nine gate failures in one day re-ran green. Every one was a DIFFERENT test and every one was inside
 * a full-suite run — so it was never nine flaky tests, it was one flaky condition with nine landing
 * spots, and it cost about two hours of deploy latency in re-runs.
 *
 * The condition, measured rather than guessed: `node --test` runs FILES in parallel up to
 * `availableParallelism()` — twelve here — in alphabetical order. Fourteen files spawn Chrome, and
 * they are named for what they do, so they sort together:
 *
 *     batch 14   3 browsers
 *     batch 15   5 browsers   ← v2-the-mock-…, v2-the-page-asks-…, v2-the-selection-editor-…
 *     batch 16   1 browser
 *
 * Five headless Chromes, each rendering a multi-megabyte page, started at the same instant. The
 * naming convention built the contention: everything called `v2-the-…-in-a-real-browser` lands in one
 * batch. Most of the day's flakes live in batch 15, and the selection editor alone failed three times.
 *
 * ⛔ AND THE FAILURES WERE NOT TIMEOUTS, WHICH IS WHY THE CAUSE HID. Not one deploy log contains
 * "timed out waiting" — every failure was an ASSERTION mismatch: `404 !== 200`, `false !== true`. A
 * starved machine does not make the harness give up, it makes a page answer late enough that an
 * assertion reads an intermediate state. That looks exactly like a broken feature, which is why three
 * separate sessions went looking in their own changes first.
 *
 * ⛔ A SEMAPHORE RATHER THAN `--test-concurrency`, AND RATHER THAN RE-ORDERING. Lowering concurrency
 * slows all 197 files to fix 14. Re-ordering works until somebody names a test something else — the
 * ordering is implicit, so it would rot silently, which is this repo's most expensive failure shape.
 * Bounding the scarce resource itself survives both new tests and whatever order they run in.
 *
 * ⛔ FILE-BASED, BECAUSE THE PROCESSES ARE SEPARATE. `node --test` gives each file its own process, so
 * an in-memory counter would bound nothing. `mkdir` is atomic on every platform this runs on: the
 * process that creates the directory holds the slot.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * ⛔ THREE, AND THE NUMBER IS AN ARGUMENT RATHER THAN A FEELING. Twelve cores, and a browser test is
 * a Chrome plus a page render plus whatever the test itself computes — call it two cores while it
 * works. Three leaves half the machine for the other 183 files, which are the ones that make the
 * suite fast. Five was measured failing; one would serialise fourteen files that mostly pass.
 */
const SLOTS = Number(process.env.PRODUCTOS_BROWSER_SLOTS ?? 3);

/** One directory per machine, not per run — the point is to bound processes that cannot see each other. */
const home = path.join(os.tmpdir(), "productos-browser-slots");

/**
 * ⛔ A SLOT WHOSE OWNER IS GONE IS FREE, OR THE FIRST KILLED SUITE DEADLOCKS EVERY LATER ONE.
 *
 * `pkill -f "make deploy"` is how a deploy gets abandoned here, and it leaves Chrome-spawning
 * processes dead mid-test. Without this the lock directory outlives them and every subsequent run
 * waits forever on three slots nobody holds — a fix that converts a flake into a hang, which is worse.
 */
const ownerIsGone = (slot) => {
  let pid;
  try {
    pid = Number(fs.readFileSync(path.join(slot, "pid"), "utf-8").trim());
  } catch {
    /** No pid file: a half-made slot. Treat it as abandoned. */
    return true;
  }
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    /** Signal 0 asks "does this process exist" without touching it. */
    process.kill(pid, 0);
    return false;
  } catch (e) {
    /** EPERM means it exists and is not ours — still alive, so the slot is held. */
    return e.code !== "EPERM";
  }
};

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Take one of the slots, waiting if they are all held. Returns the release function.
 *
 * ⛔ NEVER THROWS ON CONTENTION. A test that cannot get a slot must wait, not fail — a semaphore that
 * fails under load would reproduce the exact flakiness it exists to remove.
 */
export async function takeABrowserSlot({ waitMs = 240000, now = () => Date.now() } = {}) {
  fs.mkdirSync(home, { recursive: true });
  const stop = now() + waitMs;
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const slot = path.join(home, `slot-${i}`);
      try {
        fs.mkdirSync(slot);
      } catch {
        /** Held — unless whoever held it is gone. */
        if (!ownerIsGone(slot)) continue;
        try {
          fs.rmSync(slot, { recursive: true, force: true });
        } catch {
          continue;
        }
        try {
          fs.mkdirSync(slot);
        } catch {
          /** Somebody else reclaimed it first. */
          continue;
        }
      }
      fs.writeFileSync(path.join(slot, "pid"), String(process.pid));
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        try {
          fs.rmSync(slot, { recursive: true, force: true });
        } catch {
          /** A slot we cannot remove is reclaimed by the next run's staleness check. */
        }
      };
      /** ⛔ And on a hard exit too: a test that throws never reaches its own teardown. */
      process.once("exit", release);
      return release;
    }
    /**
     * ⛔ PAST THE DEADLINE, PROCEED ANYWAY RATHER THAN FAIL. Waiting four minutes means something is
     * wrong with the slots, not with the test — and running one extra browser is a slower suite,
     * while refusing here is a red suite that blocks a deploy for a reason nobody can act on.
     */
    if (now() > stop) return () => {};
    await nap(100);
  }
}

/** What the cap is, so a test can assert against the same number the harness uses. */
export const browserSlots = SLOTS;

/** Where the slots live, so a test can count what is held. */
export const browserSlotHome = home;
