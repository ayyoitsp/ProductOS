/**
 * ⛔ TWO RECORDS UNDER ONE NUMBER DOES NOT MAKE A VERB AMBIGUOUS — IT TURNS THE CASCADE OFF.
 *
 * The deploy session put it better than I had: `v2 change close` is refused while any layer is
 * unreached, and that refusal is the only thing forcing a piece of feedback into every layer it
 * affects. If two records answer to one id, `find` takes the first — so a change that reached
 * NOTHING can be closed by satisfying the other record's layers, and nothing anywhere says so.
 * The mechanism `CLAUDE.md` is built around is the mechanism that fails, silently.
 *
 * ⛔ AND IT IS NOT HYPOTHETICAL. Four pairs are already on main: `changes/0160.yaml` carries
 * `id: "0155"`, and the same for 0156/0157/0158. A session dodging a filename conflict at the end
 * of a long day renamed the file and left the id inside it. `v2 change check 0155` printed two
 * records and read as thoroughness.
 *
 * ⛔ SEVEN COLLISIONS IN ONE DAY is what made this worth fixing rather than noting. Every one was
 * resolved by hand, and the hand-resolution is what produced the four silent ones.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { nextId, idsInUse, changesWithId } = await import("../dist/core/change.js");

const CLI = path.resolve("dist/cli/index.js");

/** A corpus root with a changes/ directory and nothing else — all these verbs need. */
function withChanges(records) {
  const root = temp("productos-ids-");
  fs.mkdirSync(path.join(root, "changes"), { recursive: true });
  for (const [file, body] of Object.entries(records)) {
    fs.writeFileSync(path.join(root, "changes", file), body);
  }
  return root;
}

const record = (id, extra = "") =>
  `id: "${id}"\nsaid: somebody said a thing\nat: 2026-10-16\nkind: surface\nreaches:\n  surface: ""\n  pin: ""\nwaived: {}\n${extra}`;

test("a number is claimed against the filenames as well as the ids inside them", () => {
  /**
   * ⛔ THE CASE THAT PRODUCED THE FOUR ON MAIN: a record renamed to dodge a filename conflict, so
   * its number is free by one measure and taken by the other. `max(internal id) + 1` handed 0007
   * straight back out while `0007.yaml` was sitting there.
   */
  const root = withChanges({
    "0005.yaml": record("0005"),
    "0007.yaml": record("0003"),
  });

  const got = nextId(root);
  assert.notEqual(got, "0007", "it reissued a number a FILE is already using");
  assert.notEqual(got, "0005", "it reissued a number a record is already using");
  assert.equal(got, "0008", `it allocated ${got}`);

  /** ⛔ Non-vacuous: both forms of claim really are in the map, or the assertions above are luck. */
  const taken = idsInUse(root);
  assert.ok(taken.has("0007"), "the filename 0007 was not counted as taken");
  assert.ok(taken.has("0003"), "the id inside 0007.yaml was not counted as taken");
  assert.ok(taken.has("0005"), "0005 was not counted as taken");
});

test("an unreadable record still holds its number", () => {
  /** ⛔ A file that will not parse is the one most likely to be renamed in a panic. */
  const root = withChanges({ "0004.yaml": "{{{ not yaml at all" });
  const taken = idsInUse(root);
  assert.ok(taken.has("0004"), "a record that would not parse released its number");
  assert.equal(nextId(root), "0005", "it allocated over an unreadable record");
});

test("two records under one number are both found, rather than one of them", () => {
  const root = withChanges({ "0009.yaml": record("0009"), "0011.yaml": record("0009") });
  const both = changesWithId(root, "0009");
  assert.equal(both.length, 2, `only ${both.length} record answered to 0009`);
});

/**
 * ⛔ THE ONE THAT MATTERS, AND IT GOES THROUGH THE REAL CLI. The guarantee is not that a helper
 * returns two rows — it is that the verb a person runs REFUSES. Asserting the helper would pass on
 * a build where `close` still took the first match.
 */
test("close refuses a number two records answer to", () => {
  const root = withChanges({
    /** ⛔ Both reach every layer, so the refusal below cannot be the cascade doing its ordinary job. */
    "0009.yaml": record("0009", "").replace('surface: ""', "surface: renderScopePage").replace('pin: ""', "pin: a page"),
    "0011.yaml": record("0009", "").replace('surface: ""', "surface: renderScopePage").replace('pin: ""', "pin: a page"),
  });

  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [CLI, "v2", "change", "close", "0009"], { cwd: root, encoding: "utf-8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  assert.equal(code, 1, `close exited ${code} on an ambiguous number`);
  assert.match(out, /2 records answer to "0009"/, `it refused for the wrong reason: ${out.slice(0, 200)}`);
  /** ⛔ And it names BOTH files, or the person cannot act on the refusal. */
  assert.match(out, /0009\.yaml/, "the refusal did not name the first file");
  assert.match(out, /0011\.yaml/, "the refusal did not name the second file");

  /** ⛔ Neither was closed — a refusal that writes anyway is worse than no refusal. */
  for (const f of ["0009.yaml", "0011.yaml"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, "changes", f), "utf-8"), /^closed:/m, `${f} was closed anyway`);
  }
});

/**
 * ⛔ AND A NUMBER ONLY ONE RECORD ANSWERS TO STILL CLOSES, or the refusal above is just a broken
 * verb. This is the half that proves the check discriminates rather than always firing.
 */
test("close still works when the number is unambiguous", () => {
  const root = withChanges({
    "0009.yaml": record("0009").replace('surface: ""', "surface: renderScopePage").replace('pin: ""', "pin: a page"),
  });
  /** The layers are verified by looking in real files, so give it something to find. */
  fs.mkdirSync(path.join(root, "src", "v2"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "v2", "page.ts"), "export function renderScopePage() {}\n");
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "test", "a.test.mjs"), 'test("a page", () => {});\n');

  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [CLI, "v2", "change", "close", "0009"], { cwd: root, encoding: "utf-8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  assert.equal(code, 0, `close exited ${code} on an unambiguous number: ${out.slice(0, 300)}`);
  assert.match(
    fs.readFileSync(path.join(root, "changes", "0009.yaml"), "utf-8"),
    /^closed:/m,
    "it reported success and wrote no closure"
  );
});
