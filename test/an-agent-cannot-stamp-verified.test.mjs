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
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { exchangeTools } from "../dist/mcp/v2-tools.js";
import { tools } from "../dist/mcp/tools.js";
import { loadCorpus } from "../dist/v2/load.js";
import { readLog } from "../dist/v2/log.js";
import { readTracking } from "../dist/core/tracking.js";

const door = exchangeTools.find((t) => t.name === "productos_in");
const REF = "money#see-a-balance";
/** The door resolves the corpus from `dir` when it is given one; `paths` is never reached. */
const paths = { productsDir: path.resolve("productos/products") };

function seed() {
  const dir = temp("agent-cannot-stamp-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/** A person the instance authenticated and watched press — what `serve.ts` builds for a real press. */
const aPerson = { kind: "browser", actor: "peter", session: "s-1", scopes: ["read", "author"] };

const accept = (dir, fields, caller) =>
  door.handler({ intent: "accept", fields, dir }, paths, caller);

// ---------------------------------------------------------------------------
// 1. The door, over stdio — where the principal is nobody's press
// ---------------------------------------------------------------------------

const trackingPaths = (dir) => ({ root: dir, repoRoot: dir });
const updateTracking = tools.find((t) => t.name === "productos_update_tracking");

test("⛔ `productos_update_tracking` refuses `verified`, and the sidecar carries no stamp", async () => {
  const dir = temp("agent-cannot-stamp-v1-");
  const p = trackingPaths(dir);

  const r = await updateTracking.handler(
    { feature_id: "wallet", behavior_id: "see-a-balance", status: "verified", by: "ai-runtime" },
    p
  );
  assert.equal(r.ok, false, "⛔ a model stamped a behaviour as human-validated");
  assert.ok(
    r.detail.some((d) => /productos verify|press/.test(d)),
    `the refusal does not name a human path: ${JSON.stringify(r.detail)}`
  );

  const t = readTracking(p, "wallet");
  assert.equal(t, null, "the refusal wrote a sidecar");
});

test("the statuses that claim nothing still land, with their history", async () => {
  /** ⛔ The non-refusal outcome. `contested` can only ever reduce what the corpus claims. */
  const dir = temp("agent-cannot-stamp-v1-ok-");
  const p = trackingPaths(dir);

  const r = await updateTracking.handler(
    { feature_id: "wallet", behavior_id: "see-a-balance", status: "contested", note: "the app shows cents", by: "a session" },
    p
  );
  assert.equal(r.ok, true, JSON.stringify(r));

  const b = readTracking(p, "wallet").behaviors["see-a-balance"];
  assert.equal(b.status, "contested");
  assert.equal(b.history.at(-1).action, "contested");
  assert.ok(!b.verified_by, "⛔ a status that claims nothing still stamped a verifier");
  assert.ok(!b.last_verified, "⛔ a status that claims nothing still stamped a date");
});

test("⛔ and no tool on the surface offers `verified` as something to set", () => {
  /**
   * The general form. The hole was not `update_tracking` specifically — it was one enum copied
   * whole from a schema that has a `verified` in it, which the next tracking tool would do again.
   */
  const offered = [];
  for (const t of tools)
    for (const [field, spec] of Object.entries(t.inputSchema.properties ?? {}))
      if (Array.isArray(spec.enum) && spec.enum.includes("verified")) offered.push(`${t.name}.${field}`);
  assert.deepEqual(offered, [], "a model is being offered human validation as a value to send");
});
