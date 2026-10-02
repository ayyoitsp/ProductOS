/**
 * ⛔ THE COMMENT HAS ALREADY FAILED HERE ONCE, SO IT CANNOT BE THE ENFORCEMENT.
 *
 * `schema.ts` opens with "EVERY OBJECT IN THIS FILE IS `.strict()`" and the reasoning for
 * why: an unknown field must be a REFUSAL, never a silent deletion, because that refusal is
 * the framework's only channel for "the model has no way to say this".
 *
 * It was true of five objects out of twelve. The seven that were missed all use the chained
 * `z\n  .object({…})\n  .superRefine(…)` form, which the pass that added strictness searched
 * for as the literal `z.object({` and never matched. A reviewer then wrote five true
 * sentences about a real product — a trigger on a system exchange, a budget and a shared
 * refusal vocabulary on a rule, evidence on a slot, an owner on a criterion — and every one
 * of them parsed clean, reported nothing, and vanished.
 *
 * This asserts the property directly off the exported schemas, so adding an object without
 * `.strict()` fails here rather than being discovered by somebody losing a sentence.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as schema from "../dist/v2/schema.js";

/** Peel `.superRefine`/`.refine`/`.default` wrappers to reach the ZodObject underneath. */
function unwrap(z) {
  let cur = z;
  const seen = new Set();
  while (cur?._def && !seen.has(cur)) {
    seen.add(cur);
    if (cur._def.typeName === "ZodObject") return cur;
    cur = cur._def.schema ?? cur._def.innerType ?? cur._def.type;
  }
  return cur?._def?.typeName === "ZodObject" ? cur : null;
}

test("every exported schema object refuses unknown keys", () => {
  const strip = [];
  for (const [name, value] of Object.entries(schema)) {
    const obj = unwrap(value);
    if (!obj) continue;
    if (obj._def.unknownKeys !== "strict") strip.push(name);
  }
  assert.deepEqual(
    strip,
    [],
    `these accept unknown keys, so a true sentence written into one disappears silently: ${strip.join(", ")}`
  );
});

test("an unknown key is refused rather than dropped", () => {
  for (const [name, value] of [
    ["Scope", schema.Scope],
    ["Exchange", schema.Exchange],
    ["Rule", schema.Rule],
    ["Verdict", schema.Verdict],
  ]) {
    const base = {
      Scope: { id: "s", title: "Scope" },
      Exchange: { id: "e", title: "An ask", asked_by: "system" },
      Rule: {
        id: "a-rule",
        statement: "Something true about a class of exchanges, at length.",
        fills: "answer",
        mode: "supplies",
        scope: { everywhere: true },
        criteria: [{ id: 1, slot: "answer", kind: "conformance", then: "it holds" }],
      },
      Verdict: { kind: "read", by: "someone", at: "2026-01-01", scope: "s", buildable: true },
    }[name];
    const r = value.safeParse({ ...base, retention_period: "two years" });
    assert.equal(r.success, false, `${name} accepted an unknown key instead of refusing it`);
    assert.match(
      JSON.stringify(r.error.issues),
      /[Uu]nrecognized key/,
      `${name} failed for the wrong reason`
    );
  }
});
