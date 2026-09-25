/**
 * ⛔ FEEDBACK ON THE OUTPUT IS A BUG REPORT AGAINST PRODUCTOS, AND PROSE SAYING SO HAS NOW FAILED
 * FOUR TIMES.
 *
 * Peter: "i've asked multiple times to never do this. what do we have to do so that my feedback
 * applies to the framework? literally like the 4th time. I cannot emphasize the importance of this
 * ENOUGH."
 *
 * CLAUDE.md opens with the rule, in bold, with a ⛔, and gives the grep to run. It was read and
 * violated anyway — because "fix the corpus" is always the shortest path to making the complaint
 * go away, and nothing failed when I took it.
 *
 * So the rule becomes a test. The specific, repeated failure is the LAST of the three layers:
 * the schema gains a concept, the renderer shows it, and the skill is never told — so every future
 * session keeps writing the old shape and the concept only ever exists where somebody typed it by
 * hand. CLAUDE.md names this exact miss and says to check it with `grep -ril "<concept>" skills/`.
 * This is that grep, run every build, over every field the model has.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../dist/v2/schema.js";

/** The skills are the authoring instructions. If a concept is not in here, nobody writes it. */
const SKILL_TEXT = fs
  .readdirSync("skills/productos-exchange")
  .filter((f) => f.endsWith(".md"))
  .map((f) => fs.readFileSync(path.join("skills/productos-exchange", f), "utf-8"))
  .join("\n");

/**
 * Fields an author never writes, with the reason. ⛔ Adding a name here is a claim that no author
 * ever types it — not a way to silence the test. Each one is either derived, or written only by a
 * command on somebody's behalf.
 */
const NOT_AUTHORED = new Map([
  ["id", "every object has one; the grammar is documented once"],
  ["title", "every object has one"],
  ["kind", "set by the act that records it, never typed"],
  ["at", "stamped when something is recorded"],
  ["by", "the name a press is recorded under, supplied by the surface"],
  ["via", "how consent was obtained, supplied by the surface"],
  ["covers_slots", "an acceptance hash, computed"],
  ["covers_criteria", "an acceptance hash, computed"],
  ["state", "a note's lifecycle, moved by `notes done`"],
  ["outcome", "written by `notes done`"],
  ["says", "the sentence itself — the whole subject of the skill, not a field to look up"],
  ["about", "captured by the composer from what the reader was looking at"],
]);

/** Every object in the model an author actually writes by hand. */
const AUTHORED_SHAPES = [
  "Scope",
  "Exchange",
  "View",
  "Part",
  "Rule",
  "Selector",
  "Criterion",
  "Charter",
  "CharterSection",
  "Statement",
  "SlotFill",
  "Standing",
  "RefusalOutcome",
  "Reading",
  "HappyPath",
];

/**
 * ⛔ UNWRAP TO THE OBJECT, AND THIS IS WHERE THIS TEST WAS A LIE.
 *
 * It read `obj._def?.shape?.() ?? obj.shape ?? obj._def?.innerType?.shape` and then `continue`d on
 * anything it could not unwrap. A shape ending in `.superRefine(...)` is a ZodEffects whose inner
 * schema lives at `_def.schema`, NOT `_def.innerType` — so Exchange, Part, Rule and Criterion, the
 * four highest-field-count objects in the model, were silently skipped. The test passed, and
 * `Criterion` — the entire concept — was missing from the authoring instructions the whole time.
 *
 * `v2-no-dead-fields.test.mjs` answers the same question, correctly, in the same directory: two
 * implementations of one predicate diverging by one clause, which is the exact defect
 * `src/core/jobs.ts` names as recurring. Landed inside the test built to stop it.
 *
 * ⛔ AND IT NO LONGER SKIPS QUIETLY. An unwrappable shape is a failure, because a shape this cannot
 * read is a shape it is not checking, and the whole value of this test is that it is not vacuous.
 */
function shapeOf(name, obj) {
  let cur = obj;
  const seen = new Set();
  while (cur?._def && !seen.has(cur)) {
    seen.add(cur);
    if (cur._def.typeName === "ZodObject") break;
    cur = cur._def.schema ?? cur._def.innerType ?? cur._def.type;
  }
  assert.equal(cur?._def?.typeName, "ZodObject", `${name} could not be unwrapped to an object — this test would skip it`);
  return cur._def.shape();
}

test("no field in the model is invisible to the skill that authors it", () => {
  const missing = [];
  for (const name of AUTHORED_SHAPES) {
    const obj = schema[name];
    assert.ok(obj, `${name} is declared here and not exported by the schema`);
    const shape = shapeOf(name, obj);
    for (const field of Object.keys(shape)) {
      if (NOT_AUTHORED.has(field)) continue;
      /**
       * ⛔ NAMED AS A FIELD, not merely present as an English word. `shows` passed a bare word
       * match because the prose elsewhere says "shows" — so a concept nobody had ever been told to
       * author read as documented. A skill names a field the way an author writes it: as YAML
       * (`field:`) or in backticks.
       */
      const named =
        new RegExp(`(^|\\s|\`)${field}:`, "m").test(SKILL_TEXT) || new RegExp("`" + field + "`").test(SKILL_TEXT);
      if (!named) missing.push(`${name}.${field}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `the schema supports these and no skill mentions them, so only a hand-typed corpus will ever have them:\n  ${missing.join(
      "\n  "
    )}\n\nAdd them to skills/productos-exchange/ — that is the third layer CLAUDE.md says is the most-missed, and this test exists because it was missed four times.`
  );
});

test("every check finding names a fix an author can act on", () => {
  /**
   * ⛔ A finding with no fix is a complaint. The point of routing feedback into the framework is
   * that the NEXT corpus gets told what to do — so a detector that cannot say what to change has
   * moved the problem into a backlog rather than into the model.
   */
  const src = fs.readFileSync("src/v2/check.ts", "utf-8");
  const adds = [...src.matchAll(/add\(\{([\s\S]*?)\}\);/g)].map((m) => m[1]);
  const noFix = adds.filter((a) => /kind:/.test(a) && !/fix:/.test(a) && !/severity:\s*"refuse"[\s\S]*will-not-parse/.test(a));
  // A parse refusal carries the parser's own message, which is the fix.
  const real = noFix.filter((a) => !/will-not-parse|broken/.test(a));
  assert.deepEqual(real.map((a) => /kind:\s*"([^"]+)"/.exec(a)?.[1] ?? a.slice(0, 60)), [], "these findings say what is wrong and not what to do");
});
