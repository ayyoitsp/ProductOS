/**
 * ⛔ A TEST THAT BUILDS A CORPUS AND LEAVES IT THERE COSTS THE NEXT RUN, AND IT COMPOUNDED FOR TEN
 * DAYS.
 *
 * Peter: *"wtf? where are those 60k files at?"* — 58,932 directories in the system temp root, 95% of
 * everything in it, every one of them a throwaway corpus one of these tests built with
 * `fs.mkdtempSync` and never removed. 45 of 74 test files never called `rmSync`.
 *
 * ⛔ IT WAS NOT MERELY UNTIDY — IT CLOSED A LOOP ON ITSELF. `drawFromRoute` indexes a route's
 * neighbourhood to resolve `<Wizard/>`, and a route in `/var/folders/…/T/draw5-x/` has the temp
 * ROOT one level up. So the suite's litter became the suite's own input: 61,520 directories given a
 * recursive descent to yield four `.tsx` files, 52 seconds per call, 216 seconds in one test. The
 * bound on that walk (see `v2-draw-stays-in-the-project`) stopped the drawing READING the litter.
 * This is the other half: the litter stops being made.
 *
 * ⛔ AND IT IS REGISTERED AT EXIT RATHER THAN PER-TEST, BECAUSE PER-TEST IS WHAT FAILED. Every one
 * of those 74 files could have called `rmSync` in the right place; 29 did. A cleanup somebody has to
 * remember at each of 125 call sites is a cleanup that is absent at 45 of them, which is the
 * measured outcome and not a prediction. `node --test` gives each file its own process, so one exit
 * hook per file reaps everything that file made — including the dirs of a test that THREW, which a
 * trailing `rmSync` never does.
 *
 * ⛔ `temp()` IS THE ONLY ROUTE, AND THAT IS A TEST. `v2-tests-clean-up-after-themselves` fails if
 * any file under `test/` calls `mkdtempSync` itself, because this file is worth nothing if the next
 * session writes the old shape — the same reason `framework-not-just-output` exists.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Everything this process made, in the order it was made. */
const made = [];

let hooked = false;

/**
 * ⛔ `force` AND A SWALLOWED THROW, because a reaper that fails the suite is worse than the leak it
 * fixes: a test that passed would report red for a directory a browser subprocess still held open.
 * What it cannot remove it leaves, and the next `reap.mjs` takes it.
 */
function reap() {
  for (const dir of made) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* held open by something; left for the sweep */
    }
  }
  made.length = 0;
}

/**
 * A temp directory that is removed when this test file's process exits.
 *
 * Takes the same prefix `fs.mkdtempSync` took, so a leaked directory still names the test that
 * made it — the only reason the 58,932 could be attributed at all.
 */
export function temp(prefix) {
  if (!hooked) {
    hooked = true;
    /**
     * ⛔ `exit` carries `beforeExit`'s cases too and also fires on an explicit `process.exit()`,
     * which the browser tests use. Only a signal or a hard crash escapes it, and both leave a dir
     * the sweep below can still name.
     */
    process.on("exit", reap);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

/** What this process has made and not yet reaped. For the pin, which has nothing else to look at. */
export function tempsMade() {
  return [...made];
}
