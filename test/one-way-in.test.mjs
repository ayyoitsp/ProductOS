/**
 * ⛔ ONE WAY TO ACT ON A CORPUS, NOT TWO.
 *
 * Peter, shown that seven of fourteen intents had a second, operation-shaped name on the MCP
 * surface: *"yes, retire the duplicates"*.
 *
 * `theDoor` already carried the argument, written to justify NOT adding more of them: *"a model
 * choosing between `productos_exchange_agree_to` and `productos_accept` has been handed a decision
 * with no right answer."* It held just as well for the ones that were already there — the door had
 * quietly turned five acts and two note operations into second names for intents it takes.
 *
 * ⛔ AND IT IS NOT TIDINESS. `refuseIntent` is where the authority rules are asked. Two ways in is
 * two places that have to keep asking them, and the second is the one nobody updates when an intent
 * gains a rule — which is how a relay reaches an authority the page cannot.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { INTENTS, intentNamed, unwitnessed } from "../dist/v2/intents.js";
import { exchangeTools as tools } from "../dist/mcp/v2-tools.js";
import {
  EXCHANGE_ACT_TOOLS,
  EXCHANGE_LOOP_TOOLS,
  RETIRED_ACT_TOOLS,
  RETIRED_LOOP_TOOLS,
} from "../dist/mcp/v2-tools.js";

const offered = new Set(tools.map((t) => t.name));

/** Each retired tool, beside the intent that now carries it. */
const RETIRED = [
  ["productos_exchange_agree_to", "accept"],
  ["productos_exchange_settle", "rule"],
  ["productos_exchange_grant_latitude", "waive"],
  ["productos_exchange_park", "defer"],
  ["productos_exchange_record_read_through", "read"],
  ["productos_exchange_say_on_note", "say"],
  ["productos_exchange_close_note", "close"],
];

test("⛔ no act has a second name on the surface", () => {
  for (const [name, intent] of RETIRED)
    assert.ok(
      !offered.has(name),
      `${name} is offered beside \`productos_in { intent: "${intent}" }\` — a model picking between them is making a decision with no right answer`
    );
});

test("⛔ and nothing was lost — every retired tool is still reachable through the door", () => {
  /**
   * The failure this could have been is the opposite one: taking a capability away while reporting
   * a smaller surface. Each retired name is asserted against the intent that carries it.
   */
  const names = new Set(INTENTS.map((i) => i.name));
  for (const [name, intent] of RETIRED)
    assert.ok(names.has(intent), `${name} was retired and \`${intent}\` does not exist — that is a capability gone, not moved`);
});

test("⛔ what the door does NOT take stays on the surface", () => {
  /**
   * Reading the inbox takes a lease rather than saying anything, and there is no `release` intent —
   * so handing a note back has no other way in. A sweep that removed these because they sit beside
   * the retired ones would have taken the loop with them.
   */
  const names = new Set(INTENTS.map((i) => i.name));
  assert.ok(!names.has("release"), "there is now a `release` intent — release_note should move too");
  assert.ok(offered.has("productos_exchange_release_note"));
  assert.ok(offered.has("productos_exchange_inbox"));
});

test("the definitions are kept, unregistered — empty means not offered, never gone", () => {
  /**
   * They are what the HTTP act routes are checked against; deleting them would take the comparison
   * with them. So the groups are empty and the tools still exist.
   */
  assert.deepEqual(EXCHANGE_ACT_TOOLS, []);
  assert.equal(RETIRED_ACT_TOOLS.length, 5);
  assert.deepEqual(RETIRED_LOOP_TOOLS.map((t) => t.name).sort(), [
    "productos_exchange_close_note",
    "productos_exchange_say_on_note",
  ]);
  assert.deepEqual(EXCHANGE_LOOP_TOOLS.map((t) => t.name).sort(), [
    "productos_exchange_inbox",
    "productos_exchange_release_note",
  ]);
});

test("⛔ every intent the door takes has exactly one name a model can call", () => {
  /**
   * The general form, so the next intent that gains an operation-shaped twin fails here rather than
   * in front of a model choosing between them. Matched on the verb an intent is named for.
   */
  /**
   * ⛔ THE VERB THE TOOL LEADS WITH, not the intent appearing anywhere in the name — which the
   * first version did, and `productos_exchange_release_note` failed it for containing `note`.
   * Releasing a lease is not filing one; a matcher that cannot tell them apart would have been
   * silenced by loosening it, and the loosening is what lets a real twin through next time.
   */
  const verbOf = (n) => n.replace("productos_exchange_", "").split("_")[0];
  const names = new Set(INTENTS.map((i) => i.name));
  const twins = [...offered]
    .filter((n) => n.startsWith("productos_exchange_") && names.has(verbOf(n)))
    .map((n) => `${verbOf(n)} ← ${n}`);
  assert.deepEqual(twins, [], "these intents have a second name on the surface");
});
