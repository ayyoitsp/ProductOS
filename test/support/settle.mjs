/**
 * Waiting for a thing to happen, and waiting to be sure it has not — ⛔ TWO DIFFERENT WAITS, AND
 * CONFLATING THEM IS WHAT MADE TWO TESTS HANG FOR FOUR GATE ATTEMPTS.
 *
 * `v2-watch` and `v2-live` both slept a fixed number of milliseconds and then asserted. Under load
 * the thing had not arrived yet, the assertion failed — and because each test tore its watcher or
 * its server down on the LAST LINE OF THE BODY, the failure never reached the teardown and the
 * process hung with the event loop held open. A hang prints nothing: `suite-now` captures output, so
 * a killed run named no failing test at all. `v2-deploy-gate` records the cost — four attempts,
 * zero bytes, and it took isolating the suite file by file to find which one.
 *
 * ⛔ SO A FIXED SLEEP IS A BUG WHEN SOMETHING IS EXPECTED. The clock is not the thing being
 * measured; the condition is. `arrives` polls and returns as soon as it is true, which is both
 * faster on a quiet machine and correct on a loaded one.
 *
 * ⛔ AND A FIXED SLEEP IS CORRECT WHEN NOTHING IS EXPECTED, which is why `quietFor` exists and is
 * named differently. "It did not announce the existing corpus" can only be established by waiting
 * and looking — there is no condition to poll for. Giving the two the same name is how a later
 * session turns the second into the first and asserts a zero that cannot fail.
 */

/**
 * Wait until `ready()` is true, or fail saying what never happened.
 *
 * ⛔ THE MESSAGE IS REQUIRED. A bare timeout tells whoever is reading a CI log that something took
 * too long, which is the one fact they can already see.
 */
export async function arrives(ready, what, { within = 10_000, every = 20 } = {}) {
  const until = Date.now() + within;
  for (;;) {
    if (await ready()) return;
    if (Date.now() > until) throw new Error(`timed out after ${within}ms waiting for ${what}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/**
 * Wait, deliberately, to establish that nothing happened.
 *
 * ⛔ SHORT ON PURPOSE AND NOT A POLL. There is nothing to poll for — the claim is an absence — so
 * this is the one place a number of milliseconds is the honest instrument. Keep it small: every
 * millisecond here is spent on every run whether or not anything is wrong.
 */
export const quietFor = (ms) => new Promise((r) => setTimeout(r, ms));
