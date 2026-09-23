/**
 * ⛔ EVERY FIELD AN AUTHOR CAN WRITE HAS A READER, AND THIS TEST EXISTS BECAUSE THAT KEPT
 * BEING FALSE — IN FOUR CONSECUTIVE REVIEW ROUNDS.
 *
 * The file's own header says a required field nothing reads is worse than an absent one, and
 * then: `Rule.carryover` declared and unread (and its default contradicted); `Standing.cost`
 * REQUIRED and shown to nobody, which is the deciding fact for the person being asked;
 * `SlotFill.notes` carrying the safety reasoning for the riskiest exception in the corpus and
 * printed nowhere; `Criterion.level` and `coverage_ref` unread; `Scope.depends_on` validated
 * and rendered nowhere; `Reading.series`; `exists` on Scope and Exchange; and `Rule.outcomes`
 * — which I made MANDATORY and then never rendered, so the mandate made the hole invisible,
 * because an author who obeys the error believes the vocabulary reached the builder.
 *
 * Reviewing for it by hand has failed every time. So: enumerate the schema's own fields and
 * require each to be named somewhere that turns a corpus into something a person reads.
 *
 * A field that genuinely should not surface goes in ALLOWED with the reason. That list is the
 * honest record of what is write-only, and it is meant to stay short.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import * as schema from "../dist/v2/schema.js";

/** Files that turn a corpus into something a human or a builder reads. */
/**
 * ⛔ `page.ts` AND `record.ts` BELONG HERE. The page is now the surface a reviewer actually
 * meets, and `record.ts` exists because the verdict log was append-only and almost entirely
 * write-only — `also_considered` was populated on every pick and rendered nowhere, which is
 * precisely the defect this test was written for.
 */
const SURFACES = ["check.ts", "grid.ts", "packet.ts", "settle.ts", "stamp.ts", "ref.ts", "load.ts", "page.ts", "record.ts", "acts.ts"]
  .map((f) => fs.readFileSync(path.join("src/v2", f), "utf-8"))
  .concat(fs.readFileSync("src/cli/commands/v2.ts", "utf-8"))
  .join("\n");

/**
 * ⛔ THIS CHECK MATCHES A FIELD NAME AGAINST THE SURFACES' TEXT, SO A COMMON NAME PASSES FOR FREE.
 *
 * `Charter.kind` was required, read by nothing, and passed — because `.kind` appears all over for
 * standings and verdicts. The field was removed rather than the check weakened, but the weakness is
 * real: a field called `id`, `title`, `kind` or `at` will always look read. For those, the honest
 * check is to grep for the qualified access and see a reader.
 */

/** Written deliberately and deliberately not surfaced, with why. */
const ALLOWED = new Map([
  ["Scope.was", "a migration alias from the previous model — read by the migrator, not by a reader"],
  ["Scope.tags", "read through Selector.tag, which is the only thing it is for"],
  ["View.sketch_html", "an alternative to sketch, chosen by the web renderer rather than the CLI"],
  ["Part.decorative", "its whole purpose is to suppress a finding, so it is read as an absence"],
  ["Standing.raised_by", "provenance on a question, printed only when the question is"],
]);

function fieldsOf(name, z) {
  let cur = z;
  const seen = new Set();
  while (cur?._def && !seen.has(cur)) {
    seen.add(cur);
    if (cur._def.typeName === "ZodObject") break;
    cur = cur._def.schema ?? cur._def.innerType ?? cur._def.type;
  }
  if (cur?._def?.typeName !== "ZodObject") return [];
  return Object.keys(cur._def.shape()).map((f) => `${name}.${f}`);
}

test("no field an author can write is read by nothing", () => {
  const all = [];
  for (const [name, value] of Object.entries(schema)) {
    if (!/^[A-Z]/.test(name) || name.endsWith("File")) continue;
    all.push(...fieldsOf(name, value));
  }
  assert.ok(all.length > 40, `expected to enumerate the schema's fields, saw ${all.length}`);

  const dead = [];
  for (const q of all) {
    const field = q.split(".")[1];
    if (ALLOWED.has(q)) continue;
    // Named anywhere a surface could reach it: `.field`, `["field"]`, or `field:` in a literal.
    const named =
      SURFACES.includes(`.${field}`) ||
      SURFACES.includes(`"${field}"`) ||
      SURFACES.includes(`${field}:`) ||
      SURFACES.includes(`${field},`);
    if (!named) dead.push(q);
  }
  assert.deepEqual(
    dead,
    [],
    `these can be written and are read by nothing — render them, delete them, or add them to ALLOWED with a reason:\n  - ${dead.join("\n  - ")}`
  );
});
