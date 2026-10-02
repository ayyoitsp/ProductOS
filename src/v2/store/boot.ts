/**
 * The container's entrypoint. ⛔ Nothing here decides anything — see `server.ts`.
 *
 * It exists so the image has one obvious thing to run, and so that a failure to start says what is
 * wrong on one line instead of printing a stack trace into a platform log viewer where the first
 * frame is all anybody sees.
 */
import { startHosted } from "./server.js";

async function main(): Promise<void> {
  const { close } = await startHosted();

  /**
   * ⛔ DRAIN ON A SIGNAL RATHER THAN DYING MID-REQUEST. A platform rolling a revision sends SIGTERM
   * and then waits; a process that exits immediately drops whatever write was in flight, and a
   * dropped write here is somebody's press that reported success.
   */
  const stop = (signal: string) => async () => {
    process.stderr.write(`[productos] ${signal} — draining\n`);
    try {
      await close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", stop("SIGTERM"));
  process.on("SIGINT", stop("SIGINT"));
}

main().catch((e: unknown) => {
  /** ⛔ One line, first, because that is what a platform log viewer shows. */
  process.stderr.write(`[productos] cannot start: ${(e as Error).message}\n`);
  process.exit(1);
});
