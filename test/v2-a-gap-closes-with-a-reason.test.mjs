/**
 * ⛔ NINE GAPS WERE CLOSED BY HAND, AND THE TENTH WAS REPORTED CLOSED WHILE STILL OPEN.
 *
 * Peter: *"are all your changes merged? any other framework gaps?"* — and the honest answer was
 * six, not the five I had just said. `rests_on` had shipped, was verified present in `main`, and
 * `fg-0013` still read `status: open`, because closing a gap had **no command**. It was a hand-edit
 * to a YAML file, and nothing anywhere forced it.
 *
 * Hand-editing that same file had already broken it twice in one session with a duplicate key,
 * after which `productos todo` printed *"No open framework gaps"* — the record of what the model
 * cannot express reading as a finished backlog, which is the worst way for it to fail.
 *
 * ⛔ AND THE MECHANISM BUILT TO CATCH EXACTLY THIS WAS ITSELF BLIND, three ways, each measured
 * rather than reasoned about. `gapsWhoseFieldShipped` exists because an architect counted five of
 * fifteen open gaps naming fields that had already shipped. It was finding **37 of the 146 fields
 * in `v2/schema.ts`**:
 *
 *   · it required EXACTLY two spaces of indent, so every nested field was invisible
 *   · it required `z.` on the SAME LINE, so `rests_on: z` + newline + `.array(…)` was invisible —
 *     which is how the field that exposed all this is actually written, and `set_by` too
 *   · the CLI handed it `core/product.ts` alone, the v1 schema, where no v2 field can ever appear
 *
 * Its answer was zero either way, which is the shape CLAUDE.md opens on: a zero that agrees with
 * what you wanted to be true and has no failing state to distinguish it from a broken check.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { shippedFields, gapsWhoseFieldShipped, readFrameworkGaps, settleFrameworkGap } = await import(
  path.resolve("dist/core/framework-gaps.js")
);

const gap = (id, what, status = "open") => ({
  id,
  detected_at: "2026-10-14",
  detector: "authored",
  what,
  evidence: [],
  status,
});

/**
 * ⛔ THE TWO DECLARATION SHAPES THAT WERE INVISIBLE, as the real schema writes them. Asserted
 * against a literal rather than the live file, so this keeps testing the extraction after somebody
 * reformats `schema.ts`.
 */
test("a field is found however the formatter broke its line", () => {
  const source = `
export const Thing = z.object({
  flat: z.string(),
  nested: z.object({
    deeper: z.string().optional(),
  }),
  /** the shape that was invisible — the chain starts on the next line */
  wrapped: z
    .array(z.string())
    .min(1)
    .optional(),
});
`;
  const found = shippedFields(source);
  /** ⛔ Non-empty first: every assertion below passes vacuously on an empty list. */
  assert.ok(found.length >= 4, `found almost nothing: ${JSON.stringify(found)}`);
  assert.ok(found.includes("flat"), "a two-space field is no longer found — this went backwards");
  assert.ok(found.includes("nested"), "an object-valued field is not found");
  assert.ok(found.includes("deeper"), "a field nested one level deeper is invisible, as it was before");
  assert.ok(found.includes("wrapped"), "a field whose zod chain starts on the next line is invisible");
});

/**
 * ⛔ AND AGAINST THE REAL SCHEMA, because the literal above proves the regex and not that it is
 * pointed at anything. These three are tonight's fields and two of the three are wrapped.
 */
test("the fields this session shipped are visible to the detector", () => {
  const found = shippedFields(fs.readFileSync("src/v2/schema.ts", "utf-8"));
  assert.ok(found.length > 120, `only ${found.length} fields found in v2/schema.ts — the extraction is still partial`);
  for (const f of ["rests_on", "set_by", "no_screen", "repeats"]) {
    assert.ok(found.includes(f), `${f} shipped and the detector cannot see it`);
  }
});

/**
 * ⛔ FOUR DISTINGUISHABLE OUTCOMES, because "0 gaps flagged" is what both a working detector and a
 * broken one print against this backlog. The real open gaps genuinely name no shipped field — a gap
 * describes what is MISSING — so the zero has to be shown to be a true zero.
 */
test("the detector separates a shipped field from an absent one, and ignores settled gaps", () => {
  const schema = fs.readFileSync("src/v2/schema.ts", "utf-8");
  const hit = gapsWhoseFieldShipped([gap("probe-a", "A slot cannot use `rests_on` to cite a charter section.")], schema);
  const miss = gapsWhoseFieldShipped([gap("probe-b", "A slot cannot use `cites_vibe` for anything.")], schema);
  const settled = gapsWhoseFieldShipped(
    [gap("probe-c", "A slot cannot use `rests_on` here.", "closed")],
    schema
  );

  assert.equal(hit.length, 1, "a gap naming a field that has shipped was not flagged");
  assert.deepEqual(hit[0].fields, ["rests_on"], `flagged for the wrong reason: ${JSON.stringify(hit[0].fields)}`);
  assert.equal(miss.length, 0, "a gap naming a field that does not exist was flagged");
  assert.equal(settled.length, 0, "an already-closed gap was flagged, so the list never empties");
});

/** A corpus with a gaps file, written through the real recorder so the shape is the real shape. */
function corpusWithGaps() {
  const root = temp("gapclose-");
  const dir = path.join(root, "productos");
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(
    "node",
    [
      CLI, "todo", "add", "A slot cannot cite a charter section, so a feature restates it",
      "--costs", "you copy the charter sentence into the feature, and nothing updates it when the charter changes",
      "--forced-into", "somewhere#a-slot",
    ],
    { cwd: root, stdio: "pipe" }
  );
  execFileSync("node", [
    CLI, "todo", "add", "A second thing the model cannot express at all",
    "--costs", "you leave the thing out of the corpus entirely, so a builder never learns it",
  ], {
    cwd: root,
    stdio: "pipe",
  });
  return { root, dir };
}

test("the fixture records two open gaps, or nothing below is a test", () => {
  const { dir } = corpusWithGaps();
  const gaps = readFrameworkGaps({ root: dir });
  assert.equal(gaps.length, 2, `the fixture recorded ${gaps.length} gaps`);
  assert.ok(gaps.every((g) => g.status === "open"), "a freshly recorded gap is not open");
});

test("closing a gap needs a reason somebody could argue with", () => {
  const { dir } = corpusWithGaps();
  assert.throws(
    () => settleFrameworkGap({ root: dir }, "fg-0001", "closed", "   "),
    /needs a resolution/,
    "a gap was closed with no account of what changed"
  );
  assert.equal(readFrameworkGaps({ root: dir })[0].status, "open", "it was closed anyway");
});

test("closing an id that does not exist names the ones that do", () => {
  const { dir } = corpusWithGaps();
  assert.throws(
    () => settleFrameworkGap({ root: dir }, "fg-9999", "closed", "whatever"),
    (e) => {
      assert.match(e.message, /no framework gap fg-9999/);
      /** ⛔ The open ids, because "no such gap" sends somebody to open the file by hand — which is
       *  the thing this whole file exists to stop. */
      assert.match(e.message, /fg-0001/, `the message does not say what is open: ${e.message}`);
      return true;
    }
  );
});

test("closing one gap settles that one and leaves the others alone", () => {
  const { dir } = corpusWithGaps();
  const r = settleFrameworkGap({ root: dir }, "fg-0001", "closed", "the field shipped at 70ee76f");

  assert.equal(r.status, "closed");
  assert.equal(r.resolution, "the field shipped at 70ee76f", "the resolution was not kept");

  const after = readFrameworkGaps({ root: dir });
  assert.equal(after.length, 2, "closing a gap changed how many there are");
  assert.equal(after.find((g) => g.id === "fg-0001").status, "closed");
  assert.equal(after.find((g) => g.id === "fg-0002").status, "open", "closing one gap closed another");
  /** ⛔ And the file still parses — hand-editing broke it twice, which is why this is a command. */
  assert.match(fs.readFileSync(path.join(dir, "framework-gaps.yaml"), "utf-8"), /^# Framework gaps/, "the header is gone");
});

/**
 * ⛔ THE HALF THAT IS NOT THE CODE. `forced_into` names a compromise sitting in a corpus, and
 * shipping the field does not go back for it. If closing a gap does not say so, nothing ever will.
 */
test("closing a gap says what is still forced into the corpus", () => {
  const { root } = corpusWithGaps();
  const out = execFileSync("node", [CLI, "todo", "close", "fg-0001", "--resolution", "the field shipped"], {
    cwd: root,
    encoding: "utf-8",
  });
  assert.match(out, /fg-0001 is closed/, out);
  assert.match(out, /Still forced/i, "closing a gap said nothing about the compromise it licensed");
  assert.match(out, /somewhere#a-slot/, `it does not name where: ${out}`);
});

/** ⛔ And reading the backlog runs the staleness check — it used to run only under `scan`. */
test("the plain read warns about gaps that may already be closed", () => {
  const { root, dir } = corpusWithGaps();
  const file = path.join(dir, "framework-gaps.yaml");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf-8").replace("cannot cite a charter section", "cannot use `rests_on` to cite anything")
  );

  const out = execFileSync("node", [CLI, "todo"], { cwd: root, encoding: "utf-8" });
  assert.match(out, /may already be closed/, `reading the backlog did not mention the shipped field:\n${out}`);
  assert.match(out, /rests_on/, "it does not name the field that shipped");
  assert.match(out, /todo close/, "it does not say how to close it");
});
