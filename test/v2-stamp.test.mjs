/**
 * ⛔ WHAT AN ACCEPTANCE COVERS IS DERIVED FROM THE SCHEMA, NOT FROM A LIST SOMEBODY MAINTAINS.
 *
 * The hash used to name its fields by hand and omitted `notes` and `instead_of` — both of
 * which the packet prints to a builder as truth. So an accepted exchange's `notes` could be
 * rewritten into four new promises, one of them contradicting the accepted sentence above
 * it, and every surface still read "accepted by peter".
 *
 * This asserts the property that makes that impossible: changing ANY key of `SlotFill`
 * changes the slot hash. A field added later is covered the moment it exists, or this fails.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SlotFill } from "../dist/v2/schema.js";
import { loadCorpus } from "../dist/v2/load.js";
import { coveredBy, canon } from "../dist/v2/stamp.js";

const SEED = path.resolve("v2-seed");
const TARGET = "money#record-earning";

/** A plausible non-default value for each key of SlotFill, by shape. */
const SAMPLE = {
  says: "Something entirely different happens here now.",
  standing: { kind: "open", question: "Is this still what it does?", asked_of: "product", blocks: [] },
  within: "the person sees it within a second",
  outcomes: [{ name: "a-new-refusal", when: "something nobody mentioned", told: "a new message" }],
  none: true,
  cannot_fail: "there is nothing that can go wrong here",
  notes: "A sentence a builder reads in the packet and nobody accepted.",
  instead_of: [{ rule: "nothing-half-happens", because: "a reason nobody agreed to at all" }],
  defers_to: [{ rule: "nothing-half-happens", because: "the org rule still holds, narrowed here" }],
  candidates: [{ says: "a drafted answer", consequence: "and what it would force" }],
};

test("every key of SlotFill changes the canonical form the hash is taken over", () => {
  // ⛔ Tested against the SCHEMA rather than against a corpus fixture, so a new field is
  // caught the moment it is added and the test cannot rot when the seed corpus changes.
  const shape = SlotFill._def.schema?.shape ?? SlotFill.shape;
  const keys = Object.keys(shape);
  assert.ok(keys.length >= 6, `expected SlotFill to have several keys, saw ${keys.join(",")}`);

  const base = { says: "What it does, stated plainly enough to build." };
  const baseline = canon(SlotFill.parse(base));
  const uncovered = [];
  for (const key of keys) {
    assert.ok(key in SAMPLE, `no sample value for SlotFill.${key} — add one so this stays honest`);
    const parsed = SlotFill.safeParse({ ...base, [key]: SAMPLE[key] });
    if (!parsed.success) continue; // a value the schema refuses can never reach a stamp
    if (canon(parsed.data) === baseline) uncovered.push(key);
  }
  assert.deepEqual(
    uncovered,
    [],
    `these can be changed under an acceptance without breaking it: ${uncovered.join(", ")}`
  );
});

test("rewriting an exception's reasoning under an acceptance breaks the stamp", () => {
  /**
   * ⛔ `notes` used to be the fixture here and has since been CUT — it answered no slot
   * question, so it had no honest content, and it carried unsettled product truth through
   * `check`, through the accept preview, through `✓ accepted`, and into the packet.
   *
   * The property it was testing is the real one and survives: a sentence the packet prints as
   * truth cannot be rewritten under an acceptance without breaking it.
   */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2stamp-"));
  fs.cpSync(SEED, dir, { recursive: true });
  const file = path.join(dir, "truth", "money.md");
  const before = coveredBy(loadCorpus(dir), TARGET);
  const original = fs.readFileSync(file, "utf-8");
  const doc = original.replace(
    "A parent genuinely does pay the same amount for the same thing twice",
    "Identical records are collapsed, a receipt is emailed, and the entry is held for a day"
  );
  assert.notEqual(doc, original, "the exception fixture should have been found");
  fs.writeFileSync(file, doc, "utf-8");
  const after = coveredBy(loadCorpus(dir), TARGET);
  assert.notEqual(
    after.slots,
    before.slots,
    "an exception's reasoning is printed to a builder, so rewriting it must break the acceptance"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
