/**
 * ⛔ AN AGENT CANNOT STAMP. OVER STDIO IT COULD, UNDER TWO DIFFERENT NAMES.
 *
 * Tenet one is *a human validated this*, and both holes let a model write the record of that
 * validation with nobody asked:
 *
 *   1. `productos_in`, over stdio, built itself a `kind: "browser"` principal — the shape that
 *      means *the instance issued this session and watched the press itself*. Nothing watched
 *      anything; a model wrote the JSON. So `mayRecord` was handed the one shape it never refuses
 *      and `{ intent: "accept", fields: { ref, by: "peter", via: "page" } }` produced a verdict
 *      byte-identical to Peter pressing Accept on a rendered page.
 *   2. `productos_update_tracking` took `status: "verified"`, which reaches `recordTransition`
 *      with `setVerified: true` and stamps `verified_by` — `by` defaulting to `"ai-runtime"`.
 *      `productos_verify_behavior` is unregistered precisely so that cannot happen; this was the
 *      same act under another name, guarded by a sentence in a tool description.
 *
 * ⛔ WHY IT IS WORSE THAN ONE BAD STAMP. The MVP is many Claude Code instances, each told to make
 * tickets unambiguous and each therefore tempted to settle what it finds. If any of them can write
 * `via: page`, "human accepted" stops meaning anything — not just there, everywhere, because
 * nothing afterwards can tell which stamps were real.
 *
 * ⛔ AND A REFUSAL ON ITS OWN PROVES NOTHING HERE. "It said no" is also what a gate wired to
 * nothing says, and what a door that refuses everything says. So every case below is one of three
 * distinguishable outcomes out of the same tool:
 *
 *     a session claiming `via: page`     refused, nothing written
 *     a session landing `via: agent`     written, by the session, which satisfies no gate
 *     a person the instance watched      written, `via: page`, under the account
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { exchangeTools } from "../dist/mcp/v2-tools.js";

/** ⛔ The v1 tracking tools this was written against are gone; the general form still holds for the one surface left. */
test("⛔ and no tool on the surface offers `verified` as something to set", () => {
  /**
   * The general form. The hole was not `update_tracking` specifically — it was one enum copied
   * whole from a schema that has a `verified` in it, which the next tracking tool would do again.
   */
  const offered = [];
  for (const t of exchangeTools)
    for (const [field, spec] of Object.entries(t.inputSchema.properties ?? {}))
      if (Array.isArray(spec.enum) && spec.enum.includes("verified")) offered.push(`${t.name}.${field}`);
  assert.deepEqual(offered, [], "a model is being offered human validation as a value to send");
});
