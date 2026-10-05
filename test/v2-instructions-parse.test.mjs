/**
 * ⛔ WHAT THE AUTHORING INSTRUCTIONS TELL SOMEBODY TO WRITE MUST ACTUALLY PARSE.
 *
 * A scoper re-scoping a real feature reported four fields documented with the wrong shape, each of
 * which produces truth the model refuses to load:
 *
 *   | the doc said | the schema has |
 *   | --- | --- |
 *   | `asks:` carrying prose on an open standing | `question:` — `asks` is an enum (`whether · when · told`) on a refusal OUTCOME |
 *   | `cannot_fail: true` | a STRING — the reason it cannot fail |
 *   | `set_outside: false` / `read_outside: false` | objects owing `because`, `by`, `at` |
 *   | `walked: false` on a view | nothing. The field was removed and the doc kept teaching it |
 *
 * ⛔ THIS IS THE WORST CLASS OF DEFECT THIS PROJECT HAS, and the rule at the top of `CLAUDE.md` is
 * about exactly it: the schema can support a concept perfectly while every session keeps writing
 * the old shape, because the instructions were never corrected. `framework-not-just-output` already
 * checks that every schema field is NAMED by a skill — it cannot see that a named field is
 * described with the wrong type, which is worse than not describing it, because it is confidently
 * wrong and an author has no reason to doubt it.
 *
 * Four assertions for the four that happened, plus one general: a field name in an authoring
 * document that the schema does not have at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const DOCS = [
  ...fs.readdirSync("agents").filter((f) => f.endsWith(".md")).map((f) => path.join("agents", f)),
  ...fs.readdirSync("skills").flatMap((d) =>
    fs.existsSync(path.join("skills", d, "SKILL.md")) ? [path.join("skills", d, "SKILL.md")] : []
  ),
];

/** Every fenced yaml block in the authoring documents, with where it came from. */
function blocks() {
  const out = [];
  for (const f of DOCS) {
    const body = fs.readFileSync(f, "utf-8");
    for (const m of body.matchAll(/```ya?ml\n([\s\S]*?)```/g)) out.push({ file: f, text: m[1] });
  }
  return out;
}

const schema = fs.readFileSync("src/v2/schema.ts", "utf-8");

test("an open standing is documented with the field it actually requires", () => {
  /** ⛔ The schema is the authority here, so read it rather than restating it. */
  assert.match(schema, /question: z\.string\(\)/, "the standing's question field is gone — this test is now wrong");
  assert.match(schema, /asks: z\.enum\(\["whether", "when", "told"\]\)/, "`asks` is no longer an enum — re-check this");

  for (const { file, text } of blocks()) {
    /**
     * `asks:` is legitimate inside a refusal outcome's own standing, where it is one of three
     * words. Prose after it is the mistake, because that is what a free-text field looks like.
     */
    for (const line of text.split("\n")) {
      const m = /^\s*asks:\s*(.+)$/.exec(line);
      if (!m) continue;
      const value = m[1].trim().replace(/\s*#.*$/, "");
      assert.ok(["whether", "when", "told"].includes(value),
        `${file} tells an author to write "asks: ${value}" — \`asks\` is an enum of whether|when|told, so that is a parse refusal. An open standing owes \`question:\``);
    }
  }
});

test("cannot_fail is documented as the reason, not as true", () => {
  assert.match(schema, /cannot_fail: z\.string\(\)/, "cannot_fail is no longer a string — re-check this test");
  for (const { file, text } of blocks())
    for (const line of text.split("\n")) {
      const m = /^\s*cannot_fail:\s*(true|false)\b/.exec(line);
      assert.ok(!m, `${file} documents \`cannot_fail: ${m?.[1]}\` — it is a string, and "true" asserts the claim without the argument a reader needs`);
    }
});

test("set_outside and read_outside are documented as what they are", () => {
  for (const { file, text } of blocks())
    for (const line of text.split("\n")) {
      const m = /^\s*(set_outside|read_outside):\s*(true|false)\b/.exec(line);
      assert.ok(!m, `${file} documents \`${m?.[1]}: ${m?.[2]}\` as a boolean — it is an object owing because, by and at`);
    }
});

/**
 * ⛔ THE GENERAL CASE, which is how `walked:` survived its own deletion. A field removed from the
 * schema leaves no trace in a document, and the document is what the next session reads.
 */
test("no authoring document teaches a field the schema does not have", () => {
  const known = new Set([...schema.matchAll(/^\s*([a-z_]+):\s*z\./gm)].map((m) => m[1]));
  /** Keys that are a model's own vocabulary rather than schema fields. */
  const vocabulary = new Set(["given", "when", "then", "kind", "says", "because", "by", "at", "id", "title", "label", "role", "means", "name", "told", "to", "from", "of", "it"]);
  const bad = new Map();
  for (const { file, text } of blocks())
    for (const line of text.split("\n")) {
      const m = /^\s{2,}([a-z][a-z_]{2,})::?\s/.exec(line.replace(/::/, ":")) ?? /^\s{2,}([a-z][a-z_]{2,}):\s*\S/.exec(line);
      if (!m) continue;
      const key = m[1];
      if (known.has(key) || vocabulary.has(key)) continue;
      if (!bad.has(key)) bad.set(key, file);
    }
  /**
   * ⛔ `walked` by name, because it is the one that actually happened and a general check with an
   * allow-list can be widened until it says nothing.
   */
  assert.ok(!bad.has("walked"), `${bad.get("walked")} still teaches \`walked:\`, which the schema no longer has`);

  /**
   * ⛔ MENTIONING IT IS NOT TEACHING IT, and the first version of this assertion could not tell the
   * difference — it forbade the string outright and so failed on the line that says the field was
   * removed and must not come back. ⛔ That sentence is the most useful one in the document on this
   * subject: a deleted field leaves no trace, and the next author's only protection is being told
   * it is gone. A test that deletes the warning recreates the hole it was written for.
   */
  const doc = fs.readFileSync("agents/productos-scoper.md", "utf-8");
  assert.match(doc, /There is no `walked:` field/,
    "the scoper is no longer told that walked: was removed — so the next session has nothing stopping it writing one");
});

/**
 * ⛔ A MARKED EXAMPLE IS PARSED AGAINST THE SHAPE IT CLAIMS TO BE, NOT CHECKED FOR KNOWN FIELD NAMES.
 *
 * The general assertion above compares every key in every example against a flat union of all field
 * names in the schema. That can never catch the defect that actually happened: a field valid on some
 * OTHER object, written on this one. `Reading.basis` was documented with `what:` — and `what` is a
 * real field elsewhere in the schema, so the union said nothing.
 *
 * The documented example failed three ways at once, all of them fatal because `Reading` is
 * `.strict()`: no `id`, no `basis.ref`, and `basis.what` unrecognized. So every reading anybody
 * wrote from these instructions was refused by the loader, `readings/` stayed empty in every corpus
 * — including the one being reviewed — and the natural conclusion was that the concept did not work
 * rather than that the instruction was wrong.
 *
 * ⛔ THIS BLOCKED SOMETHING MUCH LARGER. `Reading` is the unit of support: the thing a confidence
 * scale counts. PT-0002 asks "what is a unit of support?" and the schema had already answered —
 * `bears_on` + `observes` + `basis` — but nothing could be authored, so any scale built on it would
 * have computed "no support" for every statement in the corpus.
 *
 * Only examples that name their file are parsed. That is three of them today, and the count is
 * asserted so this cannot quietly become zero while still passing.
 */
const SHAPES = {
  "readings/": "Reading",
  "verdicts/": "Verdict",
  "notes/": "Note",
  "steers/": "Steer",
  "access/": "Access",
  "rules/": "Rule",
};

test("every example that names its file parses against the shape that file holds", async () => {
  const schemaModule = await import("../dist/v2/schema.js");
  const checked = [];

  for (const { file, text } of blocks()) {
    const marker = /^#\s*([a-z-]+\/)/.exec(text.trim());
    if (!marker) continue;
    const shapeName = SHAPES[marker[1]];
    if (!shapeName) continue;
    const shape = schemaModule[shapeName];
    assert.ok(shape, `${file} names ${marker[1]} and there is no exported ${shapeName} to check it against`);

    const body = text.replace(/^#[^\n]*\n/, "");
    let parsed;
    try {
      parsed = yaml.parse(body);
    } catch (e) {
      assert.fail(`${file}: the ${shapeName} example is not valid YAML — ${e.message}`);
    }

    const r = shape.safeParse(parsed);
    assert.ok(
      r.success,
      `${file}: the documented ${shapeName} example does not parse —\n    ` +
        (r.error?.issues ?? []).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n    "),
    );
    checked.push(shapeName);
  }

  /**
   * ⛔ THE COUNT IS ASSERTED, OR THIS PASSES BY CHECKING NOTHING. A renamed marker, a reformatted
   * fence, or somebody dropping the `# readings/…` comment would silently empty this loop — and a
   * test that checks zero examples reports a pass. That is the failure mode of the assertion above,
   * which gathers fifteen findings and asserts one.
   */
  assert.ok(checked.length >= 1, "no marked examples were found — the marker convention has drifted");
  assert.ok(checked.includes("Reading"), "the Reading example is no longer marked, so nothing parses it");
});

/**
 * ⛔ A CHECK THAT COLLECTS FINDINGS AND ASSERTS ONE OF THEM REPORTS A PASS.
 *
 * The assertion above builds `bad` — every key taught in an authoring document that the schema does
 * not have — and then asserts only on `walked`. The other findings are gathered and dropped. At the
 * time of writing that set held fifteen entries and the suite was green.
 *
 * Thirteen of the fifteen turned out to be collection failures rather than doc bugs: the matcher
 * only recognises a field declared as `name: z.…`, so anything declared through a shared sub-schema
 * (`set_outside`, `candidates`, `standing`) or living in another schema file (`components_dir`,
 * `design_system`) reads as unknown. So widening `known` would make that check MORE permissive, not
 * less — which is why the shape-parsing above is the one that can actually catch a wrong field.
 *
 * This asserts the honest version: the collected set may not GROW. A new unknown key is either a
 * real doc bug or a new hole in collection, and both are worth a look before the number moves.
 */
test("the set of keys the schema cannot explain does not grow unnoticed", () => {
  const known = new Set([...schema.matchAll(/^\s*([a-z_]+):\s*z\./gm)].map((m) => m[1]));
  const vocabulary = new Set(["given", "when", "then", "kind", "says", "because", "by", "at", "id", "title", "label", "role", "means", "name", "told", "to", "from", "of", "it"]);
  const unexplained = new Set();
  for (const { text } of blocks())
    for (const line of text.split("\n")) {
      const m = /^\s{2,}([a-z][a-z_]{2,})::?\s/.exec(line.replace(/::/, ":")) ?? /^\s{2,}([a-z][a-z_]{2,}):\s*\S/.exec(line);
      if (!m) continue;
      if (!known.has(m[1]) && !vocabulary.has(m[1])) unexplained.add(m[1]);
    }

  /**
   * ⛔ `what` IS GONE FROM THIS SET, AND THAT IS THE POINT OF RECORDING THE NUMBER. It was the only
   * real doc bug among the fifteen, and it sat in a set nothing asserted on.
   */
  assert.ok(!unexplained.has("what"), "`what:` is being taught again — it is not a field on Reading, and .strict() rejects it");
  assert.ok(
    unexplained.size <= 14,
    `the authoring documents now teach ${unexplained.size} keys the schema cannot explain, up from 14:\n    ` +
      [...unexplained].join(", "),
  );
});
