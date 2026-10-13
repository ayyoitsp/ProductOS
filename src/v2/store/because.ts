/**
 * What actually went wrong, dug out from under the wrapper.
 *
 * ⛔ `Failed query: <sql>` IS THE ONE PART ANYBODY COULD ALREADY GUESS. drizzle's wrapper message
 * is the SQL text and `params:`. No code, no message, no severity — and the sqlstate that IS the
 * diagnosis sits on `error.cause` the whole time.
 *
 * ⛔ THIS FILE EXISTS BECAUSE THE BOOT PATH GOT IT AND THE REQUEST PATH DID NOT, AND THE REQUEST
 * PATH IS WHERE IT COST TWO HOURS. 4100 failed every corpus read from 11:36 to 13:29 UTC and wrote
 * 2037 log lines doing it — every one of them identical, every one of them
 *
 *     Failed query: select "id" from "accounts" where "accounts"."email" = $1
 *     params: me@localhost
 *
 * and not one of them said why. There is nothing in that to act on: no sqlstate, so no way to tell
 * a dead connection from a missing schema from a permissions change, and no way to tell whether it
 * was the same cause 2037 times. The outage recovered on its own and the diagnosis is gone.
 *
 * One home, because the lesson from `compiler.ts` was that the second copy is the one that gets
 * missed — there, a fix reached `draw.ts` and not `design.ts`, shipped, and deployed.
 */
export function becauseOf(e: unknown): string {
  const seen = new Set<unknown>();
  const lines: string[] = [];
  let cur: unknown = e;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const err = cur as { code?: unknown; detail?: unknown; hint?: unknown; message?: unknown };
    const parts = [err.code, err.message, err.detail, err.hint]
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim());
    if (parts.length) lines.push(parts.join(" · "));
    cur = (cur as { cause?: unknown }).cause;
  }
  /** The wrapper's own message is already printed by the caller; everything under it is the new part. */
  return lines.slice(1).join("\n  because: ");
}
