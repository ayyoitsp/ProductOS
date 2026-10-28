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
 * How long a slot may exist with no pid file before it counts as abandoned rather than mid-claim.
 *
 * ⛔ Longer than the gap between `mkdirSync` and `writeFileSync` can plausibly be, which on a
 * machine at load 500 is not microseconds — that is the whole reason this exists.
 */
const HALF_MADE_MS = 5000;

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
    /**
     * ⛔ A SLOT WITH NO PID IS NOT ABANDONED YET — IT IS PROBABLY BEING MADE RIGHT NOW.
     *
     * Claiming is two steps: `mkdirSync(slot)` then `writeFileSync(slot/pid)`. Between them the
     * directory exists and has no pid, which is indistinguishable from a crash — so a second process
     * reclaimed it, removed the directory, and the FIRST process's write landed on nothing:
     *
     *     ENOENT: no such file or directory, open '…/productos-browser-slots/slot-1/pid'
     *       at takeABrowserSlot (browser-slots.mjs:126)
     *
     * That failed the gate on a menu test which had nothing to do with it, and it is a race in the
     * cap itself rather than in anything the cap was protecting.
     *
     * ⛔ A GRACE PERIOD, NOT A LOCK. Two steps cannot be made atomic across processes with mkdir
     * alone, so the reclaimer waits instead: a pid-less directory younger than this is somebody
     * mid-claim, older than this is a crash between the two writes. Generous, because the cost of
     * waiting is one extra loop and the cost of being wrong is somebody else's ENOENT.
     */
    try {
      if (Date.now() - fs.statSync(slot).mtimeMs < HALF_MADE_MS) return false;
    } catch {
      /** It vanished while we looked: not ours to reclaim, and no longer held either. */
      return true;
    }
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
/**
 * ⛔ THE WAIT MUST NOT EAT THE FILE'S WHOLE BUDGET, AND AT 240000 IT DID.
 *
 * `npm test` runs with `--test-timeout=300000`, which exists so a hang becomes a verdict instead of
 * a green suite — the Makefile records why. A file that waited the old 240s for a permit then had
 * 60s to do its actual work, so under load it was killed by the file timeout WHILE QUEUING:
 *
 *     not ok test/v2-a-deep-address-lands-where-it-points.test.mjs — timed out after 300000ms
 *       at takeABrowserSlot (browser-slots.mjs:107)
 *       at async openPage (chrome.mjs:196)
 *
 * That blocked main from deploying, which is the opposite of what a flake cap is for: it traded
 * nine flakes for a gate that could not pass at all.
 *
 * ⛔ 90s, AND IT PROCEEDS RATHER THAN FAILING — the cap is advisory under starvation by design. A
 * file that has waited 90s has already lost whatever race the cap was smoothing; spending the rest
 * of its budget waiting serves nobody. Three browsers at once is the common case this bounds, and
 * the pathological case must degrade to "slower", never to "the suite cannot run".
 */
export async function takeABrowserSlot({ waitMs = 90000, now = () => Date.now() } = {}) {
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
      /**
       * ⛔ AND LOSING THE RACE IS NOT AN ERROR. The grace period above makes this rare rather than
       * impossible: a reclaimer can still decide between our mkdir and our write. Throwing ENOENT
       * out of a test's `openPage` reports a defect in whatever file happened to be running, which
       * is precisely how this surfaced — so the claim is simply abandoned and the loop goes on.
       */
      try {
        fs.writeFileSync(path.join(slot, "pid"), String(process.pid));
      } catch {
        continue;
      }
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
