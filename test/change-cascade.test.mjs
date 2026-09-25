/**
 * ⛔ THE RECORD THAT REFUSES TO LET ONE LAYER COUNT AS DONE.
 *
 * Peter: "i want to be able to have user changes cascade into all the different areas" — said after
 * the fourth time a piece of feedback was answered by editing the output. The instruction to do
 * otherwise already existed, in bold, with the exact grep to run, and it was read and violated
 * anyway: patching the output is the shortest path to making a complaint stop, and nothing failed
 * when that path was taken.
 *
 * This is the thing that fails. On its first real run it caught a layer I had skipped — the group
 * high-level view, built and rendered and driven in a browser with nothing asserting a line of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import { ChangeRecord, verify, missing, nextId, readChanges, writeChange } from "../dist/core/change.js";
import { CASCADE, KINDS } from "../dist/core/jobs.js";

const scratch = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "chg-"));
  // A tiny stand-in framework, so the verifiers have somewhere real to look.
  fs.mkdirSync(path.join(d, "src/v2"), { recursive: true });
  fs.mkdirSync(path.join(d, "skills/x"), { recursive: true });
  fs.mkdirSync(path.join(d, "test"), { recursive: true });
  fs.writeFileSync(path.join(d, "src/v2/schema.ts"), "export const X = { widget: 1 };\n");
  fs.writeFileSync(path.join(d, "src/v2/page.ts"), "function renderWidget() {}\n");
  // ⛔ A concept reaches derive and generate too — it did not, and that is how happy_path skipped
  // the migrator while the gate that needs it refused every behaviour in a real corpus.
  fs.writeFileSync(path.join(d, "src/v2/grid.ts"), "const widgetGate = 1;\n");
  fs.writeFileSync(path.join(d, "src/v2/migrate.ts"), "carry widgetGate across\n");
  fs.writeFileSync(path.join(d, "src/v2/check.ts"), 'kind: "no-widget-anywhere",\n');
  fs.writeFileSync(path.join(d, "skills/x/SKILL.md"), "author it as `widget:` in the file\n");
  fs.writeFileSync(path.join(d, "test/widget.test.mjs"), 'test("a widget is offered", () => {});\n');
  return d;
};

test("the words are kept verbatim and the kind routes to the layers", () => {
  const rec = ChangeRecord.parse({
    id: "0001",
    said: "screens overall are very thin",
    at: "2026-09-24",
    kind: "concept",
  });
  /**
   * ⛔ THE WORDS, NOT A SUMMARY OF THEM. A paraphrase is where a requirement quietly becomes the
   * thing that was convenient to build: "screens overall are very thin" rendered as "improve the
   * screens" loses the only part that was checkable.
   */
  assert.equal(rec.said, "screens overall are very thin");

  // A concept has to reach the layer that was skipped four times, and something that fails.
  assert.ok(CASCADE.concept.includes("instruct"), "a new concept can be finished without telling anyone to write it");
  assert.ok(CASCADE.concept.includes("pin"), "a new concept can be finished without pinning anything");
  /**
   * ⛔ AND `generate`. It was missing, so a concept was never required to reach the migrator —
   * which is exactly how `happy_path` did not, while the gate that depends on it refused every
   * behaviour in a 34-scope corpus: nineteen features waiting on a purpose, nothing offered.
   */
  assert.ok(CASCADE.concept.includes("generate"), "a new concept can be finished without reaching the generators");
  assert.ok(CASCADE.concept.includes("derive"), "a new concept can be finished without reaching what is computed from it");
  for (const k of KINDS) assert.ok(CASCADE[k].length, `"${k}" routes nowhere`);
});

test("a layer is verified by looking, and says what it looked for", () => {
  const dir = scratch();
  const rec = { id: "0001", said: "we need a widget", at: "2026-09-24", kind: "concept", reaches: {}, waived: {} };

  // Nothing named: every layer short, and each says so rather than passing by default.
  const blind = verify(dir, ChangeRecord.parse(rec));
  assert.equal(missing(blind).length, CASCADE.concept.length, "an empty record verified as reached");
  for (const v of blind) assert.match(v.how, /nothing named/, `${v.layer} passed with nothing named`);

  // Named and present: reached, with the search reported so a wrong pass is arguable.
  const named = ChangeRecord.parse({
    ...rec,
    reaches: {
      model: "widget",
      derive: "widgetGate",
      generate: "widgetGate",
      surface: "renderWidget",
      check: "no-widget-anywhere",
      instruct: "widget:",
      pin: "a widget is offered",
    },
  });
  const full = verify(dir, named);
  assert.deepEqual(missing(full), [], JSON.stringify(full.filter((f) => !f.ok)));
  for (const v of full) assert.ok(v.how.includes(v.by), `${v.layer} does not say what it looked for`);

  /**
   * ⛔ AND A NAME THAT IS NOT THERE IS SHORT. This is the whole mechanism: `instruct` is the layer
   * that gets skipped, and the only way to catch it is to look in skills/ for the concept by name.
   */
  const lying = ChangeRecord.parse({ ...named, reaches: { ...named.reaches, instruct: "never-written-anywhere" } });
  const short = missing(verify(dir, lying));
  assert.deepEqual(short.map((s) => s.layer), ["instruct"]);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("a waived layer carries a reason, and waiving is not free", () => {
  const dir = scratch();
  const rec = ChangeRecord.parse({
    id: "0001",
    said: "we need a widget",
    at: "2026-09-24",
    kind: "concept",
    reaches: {
      model: "widget",
      derive: "widgetGate",
      generate: "widgetGate",
      surface: "renderWidget",
      check: "no-widget-anywhere",
      instruct: "widget:",
      pin: "nothing",
    },
    waived: { pin: "this one is exercised by the browser drive, which lives outside the suite" },
  });
  const v = verify(dir, rec);
  assert.deepEqual(missing(v), [], "a waived layer still read as short");
  const waived = v.find((x) => x.layer === "pin");
  /**
   * ⛔ THE REASON IS THE POINT. "Not applicable" with no argument is how a cascade becomes a
   * formality; the reason is the part somebody can disagree with in six months.
   */
  assert.match(waived.waived, /browser drive/);
  assert.equal(waived.how, "waived", "a waiver was reported as though something had been checked");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("records round-trip, and ids do not collide", () => {
  const dir = scratch();
  assert.equal(nextId(dir), "0001");
  writeChange(dir, ChangeRecord.parse({ id: nextId(dir), said: "first thing", at: "2026-09-24", kind: "surface" }));
  assert.equal(nextId(dir), "0002");
  writeChange(dir, ChangeRecord.parse({ id: nextId(dir), said: "second thing", at: "2026-09-24", kind: "concept" }));
  const all = readChanges(dir);
  assert.deepEqual(all.map((c) => c.said), ["first thing", "second thing"]);
  // ⛔ Nothing in the record is invented on read: what went in is what comes out.
  assert.deepEqual(Object.keys(YAML.parse(fs.readFileSync(path.join(dir, "changes", "0001.yaml"), "utf-8"))).sort(), [
    "at",
    "id",
    "kind",
    "reaches",
    "said",
    "waived",
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});
