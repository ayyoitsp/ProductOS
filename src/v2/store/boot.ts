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

/**
 * What actually went wrong, dug out from under the wrapper.
 *
 * ⛔ `Failed query: <sql>` IS THE ONE PART ANYBODY COULD ALREADY GUESS. When staging died on its
 * first statement, the whole boot log was drizzle's wrapper message — the SQL text, and `params:`.
 * No code, no message, no severity. Two sessions independently spent four round trips each
 * connecting to the store by hand to learn it was `3F000 no schema has been selected to create in`,
 * which is the entire diagnosis and was sitting on `error.cause` the whole time.
 */
const becauseOf = (e: unknown): string => {
  const seen = new Set<unknown>();
  const lines: string[] = [];
  let cur: unknown = e;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const err = cur as { code?: unknown; severity?: unknown; detail?: unknown; hint?: unknown; message?: unknown };
    const parts = [err.code, err.message, err.detail, err.hint]
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim());
    if (parts.length) lines.push(parts.join(" · "));
    cur = (cur as { cause?: unknown }).cause;
  }
  /** The wrapper's own message is already on the first line; everything under it is the new part. */
  return lines.slice(1).join("\n  because: ");
};

main().catch((e: unknown) => {
  /** ⛔ One line, first, because that is what a platform log viewer shows. */
  process.stderr.write(`[productos] cannot start: ${(e as Error).message}\n`);
  const why = becauseOf(e);
  if (why) process.stderr.write(`[productos]   because: ${why}\n`);
  process.exit(1);
});
