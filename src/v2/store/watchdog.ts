/**
 * Ends this process when a project's write is never going to finish.
 *
 * ⛔ DETECTION LANDED AND THE REMEDY DID NOT, WHICH IS WORSE IN ONE SPECIFIC WAY. `/health` reports a
 * project whose write is stuck, with its age. Twice in one day it fired correctly —
 * `{"ok":false,"writes":"stuck","because":"prj-… has had a write running for 1850s"}` — and nothing
 * acted on it: `RestartPolicy: no`, `RestartCount: 0`, the probe failing every 30s. A signal that
 * looks like it will self-heal and does not is a worse position than no signal, because it gets
 * trusted.
 *
 * ⛔ AND DOCKER DOES NOT RESTART A CONTAINER FOR FAILING A HEALTHCHECK. An earlier commit of mine
 * said "Docker will restart on it", and that was wrong twice over: the policy was `no`, AND a
 * restart policy acts on the process EXITING rather than on health. A healthcheck only sets a status
 * an orchestrator may read; plain compose reads nothing. So the remedy is the process ending itself,
 * with `restart: unless-stopped` to bring it back.
 *
 * ⛔ ITS OWN MODULE, BECAUSE `boot.ts` RUNS ON IMPORT. That file ends in `main().catch(… exit(1))`,
 * so importing it to test anything boots a server and then kills the test process — a file-level
 * failure with no test named, which is what the first attempt produced. An entrypoint is not
 * importable, so nothing that needs testing can live in one.
 */
import { stuckWrites } from "./instance.js";

/**
 * ⛔ FIVE TIMES THE REFUSAL DEADLINE, NOT EQUAL TO IT.
 *
 * A waiter already gives up at 120s and says why, which is the right first answer — the largest
 * corpus here writes in about 3 seconds, so two minutes is already extraordinary. Ending the
 * process is for what has not moved in ten minutes, where the only other outcome is a person
 * noticing by hand.
 *
 * ⛔ AND IT COSTS THE OTHER PROJECTS A RESTART TO FIX ONE. Taken deliberately: the lock is per
 * project so the others stay writable, but a five second restart against a project that is
 * unwritable until somebody intervenes is not a close call.
 */
const EXIT_AFTER_MS = 600_000;
const LOOK_EVERY_MS = 60_000;

export function watchForAStuckWrite(
  exitAfterMs: number = EXIT_AFTER_MS,
  everyMs: number = LOOK_EVERY_MS,
  held: typeof stuckWrites = stuckWrites,
  end: (code: number) => void = (code) => process.exit(code),
): { stop: () => void } {
  const timer = setInterval(() => {
    const stuck = held(exitAfterMs);
    if (!stuck.length) return;
    /** ⛔ Said out loud first, or the restart reads as a crash to whoever opens the log. */
    for (const w of stuck) {
      process.stderr.write(
        `[productos] ${w.project} has had a write running for ${w.seconds}s and is not going to ` +
          `finish — ending this process so the restart policy brings it back\n`,
      );
    }
    end(1);
  }, everyMs);
  /** ⛔ Unref'd, so this timer alone never holds the process open. */
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
