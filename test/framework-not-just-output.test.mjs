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

/**
 * The authoring instructions. If a concept is not in here, nobody writes it.
 *
 * ⛔ THAT IS NO LONGER ONE SKILL DIRECTORY. There were eight skills; there is one, and the rules
 * for writing a scope moved into the role that writes one — the scoper — because a rule delivered
 * to everybody and used by one is a rule that drifts. The instruct layer is wherever a future
 * session is TOLD what to write, which is now the skill plus the author prompts.
 */
const SKILL_TEXT = [
  ...fs.readdirSync("skills").flatMap((d) => {
    const f = path.join("skills", d, "SKILL.md");
    return fs.existsSync(f) ? [fs.readFileSync(f, "utf-8")] : [];
  }),
  ...fs.readdirSync("agents").filter((f) => f.endsWith(".md")).map((f) => fs.readFileSync(path.join("agents", f), "utf-8")),
].join("\n");

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
  /**
   * ⛔ THESE THREE ESCAPED THE TEST THAT EXISTS TO CATCH EXACTLY THIS.
   *
   * The file's own header says a schema field no skill writes only ever appears where somebody
   * typed it by hand. `Steer` was the proof: defined, loaded, checked, rendered — and authorable
   * only by hand-writing YAML, which is the trap `CLAUDE.md` opens on. It was absent from this
   * list, so the mechanism meant to notice could not see it. `Note` and `Access` were absent for
   * the same reason: nobody added them when they landed.
   */
  "Steer",
  "Note",
  "Access",
  /**
   * ⛔ AND THIS ONE ESCAPED A SECOND WAY: IT HAD NO NAME TO PUT IN THE LIST.
   *
   * The three above were named shapes somebody forgot to add. `ViewState` was an anonymous object
   * inside `View.states`, and this test walks each named shape exactly one level deep — so for
   * `View` it confirmed `states:` was documented and never descended into what a state is made of.
   *
   * `holds` was the cost. Defined in the schema, composed by `states.ts`, rendered on the page,
   * and named in no authoring instruction anywhere — so every state in every corpus kept being
   * written as a whole second screenshot: 43 of them across bilrost, not one declaring it, which is
   * precisely "a field that only ever appears where somebody typed it by hand".
   *
   * ⛔ So a shape being anonymous is now itself the bug. A field this test cannot reach is a field
   * it is not checking, and an inline shape is unreachable by construction.
   */
  "ViewState",
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

/**
 * The key an author writes this shape UNDER — so an ambiguous field can be checked against the
 * place it is actually written rather than against the whole document.
 *
 * ⛔ WITHOUT THIS THE TEST WAS VACUOUS FOR A FIFTH OF THE MODEL. 21 of 107 field names sit on more
 * than one shape, and the check was a match against one concatenated blob — so a field documented
 * on ANY shape marked that name documented on EVERY shape.
 *
 * Two real gaps were passing because of it, both of them concepts somebody had asked for by name:
 *
 *   ViewState.holds   passed on `Access.holds` — "what a role actually grants, listed", a flat list
 *                     of permission names on an unrelated object. 43 states across bilrost carry a
 *                     whole picture and not one declares `holds`, because no author was ever told
 *                     it exists.
 *   Part.states       passed on `View.states`. Peter: *"multiple buttons could have LOADING States.
 *                     MULTIPLE FIELDS COULD HAVE ERROR STATES"* — the whole part-condition
 *                     vocabulary (`busy`, `invalid`, `disabled`, `loading`, `empty`, `failed`)
 *                     appears nowhere in any authoring instruction.
 *
 * ⛔ So a name is not an address. A field is documented when it is shown where it is written: in a
 * fenced example that also carries the key its shape hangs off.
 */
/** Every fenced block in the instruction text, so a field can be read in context. */
const BLOCKS = [...SKILL_TEXT.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);

/**
 * Is this block an example OF this shape? It is, if it carries two or more of that shape's own
 * fields — enough that a reader would recognise what they are looking at.
 *
 * ⛔ TWO, AND IT IS SELF-CALIBRATING RATHER THAN A LIST I MAINTAIN. The first cut demanded the
 * parent key in the same block — `states:` for a `ViewState`, `parts:` for a `Part` — and reported
 * 18 fields, 16 of which were fine and merely shown in a fragment that omitted the parent. A check
 * that is wrong 16 times out of 18 gets waived on sight, which would have cost more than the hole
 * it closes.
 */
function isExampleOf(block, fields) {
  let hit = 0;
  for (const f of fields) if (new RegExp(`(^|\\s)${f}:`, "m").test(block)) hit++;
  return hit >= 2;
}

/**
 * Ambiguous fields documented in prose rather than in an example, each with the sentence that does
 * it. ⛔ An entry here is a claim that a named sentence tells an author what to write — not a way to
 * silence the test, the same contract `NOT_AUTHORED` carries.
 *
 * ⛔ AND IT IS A LIST RATHER THAN A PATTERN, BECAUSE THE PATTERN REOPENED THE HOLE. The first
 * attempt matched the shape's own word within 400 characters of the field. `ViewState`'s word is
 * "state", which appears on nearly every page of these instructions — so `holds` passed on
 * proximity to prose about something else entirely, which is precisely the false green this whole
 * check exists to remove. Verified by deleting the real documentation and watching the test stay
 * green.
 */
const DOCUMENTED_IN_PROSE = new Map([
  [
    "Selector.view_kind",
    'the scoper: "`tags`, `view_kind` and a part\'s `role` exist so a rule can select on them — `tag:`, `view_kind:` and `part_role:` in a selector"',
  ],
]);

/** Which shapes each field name sits on — the thing that makes a bare match unsafe. */
const SHARED = (() => {
  const seen = new Map();
  for (const name of AUTHORED_SHAPES) {
    const obj = schema[name];
    if (!obj) continue;
    for (const f of Object.keys(shapeOf(name, obj))) seen.set(f, (seen.get(f) ?? 0) + 1);
  }
  return seen;
})();

test("no field in the model is invisible to the skill that authors it", () => {
  const missing = [];
  for (const name of AUTHORED_SHAPES) {
    const obj = schema[name];
    assert.ok(obj, `${name} is declared here and not exported by the schema`);
    const shape = shapeOf(name, obj);
    for (const field of Object.keys(shape)) {
      if (NOT_AUTHORED.has(field)) continue;
      /**
       * ⛔ AN AMBIGUOUS FIELD MUST BE SHOWN WHERE IT IS WRITTEN. One example carrying both its
       * shape's key and the field is proof an author was told; the bare name proves nothing, since
       * some other shape may own the only mention.
       */
      if ((SHARED.get(field) ?? 0) > 1) {
        const siblings = Object.keys(shape);
        const shown =
          BLOCKS.some((b) => isExampleOf(b, siblings) && new RegExp(`(^|\\s)${field}:`, "m").test(b)) ||
          DOCUMENTED_IN_PROSE.has(`${name}.${field}`);
        if (!shown)
          missing.push(
            `${name}.${field}  — the name is documented, but on ${SHARED.get(field) - 1} other shape(s), and no example of a ${name} shows it`
          );
        continue;
      }
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
    )}\n\nName them where a future session is told what to write — the skill, or the prompt of the role that writes it. That is the third layer CLAUDE.md says is the most-missed, and this test exists because it was missed four times.`
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
