/**
 * ⛔ EVERY SLOT IS ADDRESSABLE, ASSERTED AGAINST `SLOTS` ITSELF.
 *
 * The reference grammar was hand-written as `[a-z0-9][a-z0-9-]*` per segment. `at_once`
 * contains an underscore, so one of the seven required slots could not be ruled on or parked
 * in any corpus that will ever exist — and `v2 defer` on it printed `✓ parked`, wrote the
 * verdict, and left the corpus unjudgeable.
 *
 * A first-party command reporting success while bricking the corpus is the worst shape a
 * defect takes here, and it came from typing out a vocabulary that already existed as a
 * constant. This derives the check from that constant.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SLOTS, REF_PATTERN, Verdict } from "../dist/v2/schema.js";

test("every slot can be addressed by a reference", () => {
  const unaddressable = SLOTS.filter((s) => !REF_PATTERN.test(`scope#exchange#${s}`));
  assert.deepEqual(unaddressable, [], `these slots cannot be ruled on or parked: ${unaddressable.join(", ")}`);
});

test("every slot can carry a ruling and a deferral", () => {
  for (const slot of SLOTS) {
    const ref = `tasks#complete-a-task#${slot}`;
    const ruling = Verdict.safeParse({
      kind: "rule",
      settles: ref,
      by: "peter",
      at: "2026-09-19",
      via: "cli",
      says: "Something a builder could implement.",
      because: "A reason long enough to carry the argument, as the schema requires of a ruling.",
    });
    assert.ok(ruling.success, `a ruling on ${slot} is refused: ${JSON.stringify(ruling.error?.issues)}`);
    const parked = Verdict.safeParse({
      kind: "defer",
      target: ref,
      by: "peter",
      at: "2026-09-19",
      via: "cli",
      because: "not now",
      until: "a second kid is added",
    });
    assert.ok(parked.success, `parking ${slot} is refused: ${JSON.stringify(parked.error?.issues)}`);
  }
});

test("a case inside a slot is addressable", () => {
  assert.ok(REF_PATTERN.test("money#record-spending#refuses#more-than-they-have"));
  assert.ok(REF_PATTERN.test("a-rule-id"));
  assert.ok(!REF_PATTERN.test("money#record-spending#refuses#more#than#deep"));
});
