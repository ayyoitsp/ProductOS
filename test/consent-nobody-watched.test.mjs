/**
 * ⛔ CONSENT NOBODY WATCHED HAPPEN HAS TO SAY WHO AGREED, AND HOW.
 *
 * Peter, choosing between tightening the door and putting seven duplicate tools back: *"1 sounds
 * good"*.
 *
 * Retiring the five act tools left the door as the only way for a model to record agreement — and
 * the door was the looser of the two on the one axis that matters. Measured before this existed:
 *
 *     productos_in { intent: "accept", fields: { ref: "money#see-a-balance" } }
 *       → kind: accept · by: peter · via: page
 *
 * `via` defaulted to `page` and `by` fell back to the principal, so a model wrote a verdict
 * byte-identical to one made by a human pressing Accept on a rendered page, having been asked
 * neither question. Nothing downstream can tell those apart, because the difference was never
 * written down.
 *
 * ⛔ The retired tools required both, with no default, and the test that guarded them said why in
 * the words worth keeping: *the weakest provenance would silently wear the strongest name*.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { INTENTS, intentNamed, unwitnessed } from "../dist/v2/intents.js";

test("⛔ a bare consent call is refused, and says what is missing", () => {
  const bare = unwitnessed(intentNamed("accept"), { ref: "money#see-a-balance" });
  assert.ok(bare, "a model can still record agreement without saying who agreed or how");
  assert.match(bare.why, /by/);
  assert.match(bare.why, /via/);
  /** ⛔ And it says what `page` MEANS — the model choosing it is the only thing that can be honest. */
  assert.ok(
    bare.detail.some((d) => /pressed a button on a rendered page/.test(d)),
    "it lists the values without saying what choosing one of them claims"
  );
});

test("⛔ half an answer is refused, and names only the half that is missing", () => {
  const half = unwitnessed(intentNamed("accept"), { ref: "x", via: "chat" });
  assert.ok(half, "stating how but not who was accepted");
  assert.match(half.why, /by/);
  assert.doesNotMatch(half.why, /say .*via/, "it asks again for something already given");
});

test("both stated is allowed — this withholds nothing from a caller that answers", () => {
  assert.equal(unwitnessed(intentNamed("accept"), { ref: "x", by: "peter", via: "chat" }), null);
});

test("⛔ blank is not an answer", () => {
  /** A caller satisfying a required field with "" would have found the same hole the default left. */
  assert.ok(unwitnessed(intentNamed("accept"), { ref: "x", by: "   ", via: "chat" }), "whitespace passed as who decided");
});

test("it charges every consent-gated intent, and no other", () => {
  /**
   * ⛔ The GATE is the fact, not a list of intent names — so an intent that becomes consent-gated
   * later is covered without anybody remembering this file exists.
   */
  for (const i of INTENTS) {
    const bare = unwitnessed(i, {});
    if (i.gate === "consent") assert.ok(bare, `${i.name} is consent-gated and records without saying who agreed`);
    else assert.equal(bare, null, `${i.name} is not an act of human judgement and is being charged for one`);
  }
});

test("⛔ the page is untouched — only MCP asks this", () => {
  /**
   * The defaults are RIGHT for the route that watched somebody press: the account IS who pressed,
   * and `page` IS how. Applied there, this would make a person restate both on every press — the
   * same regression pointed the other way.
   */
  const mcp = fs.readFileSync(path.join(process.cwd(), "src/mcp/v2-tools.ts"), "utf-8");
  assert.match(mcp, /unwitnessed\(intent, body\)/, "MCP no longer asks it");

  const serve = fs.readFileSync(path.join(process.cwd(), "src/v2/serve.ts"), "utf-8");
  assert.ok(!serve.includes("unwitnessed"), "the page route now demands by/via on every press");
});

test("⛔ and it is asked AFTER the refusals the page obeys, never instead of them", () => {
  /**
   * The single door exists so a transport cannot reach an authority the page cannot. This adds a
   * requirement; it must not replace `refuseIntent`, which is where the authority rules live.
   */
  const src = fs.readFileSync(path.join(process.cwd(), "src/mcp/v2-tools.ts"), "utf-8");
  const refuse = src.indexOf("refuseIntent(intent, asking, body)");
  const short = src.indexOf("incomplete(intent, body)");
  const watched = src.indexOf("unwitnessed(intent, body)");
  assert.ok(refuse > 0 && short > refuse, "the route's own order was changed");
  assert.ok(watched > short, "this runs before the refusals the page obeys, which makes it the gate rather than an addition");
});
