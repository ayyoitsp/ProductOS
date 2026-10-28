/**
 * ⛔ A FRAMEWORK GAP SAYS WHAT SOMEBODY CANNOT DO, AND THE BACKLOG LEADS WITH IT.
 *
 * Peter, reading his own gap list: *"i really don't understand what fg-0001 is, wtf are these
 * descriptions?"* and then *"tell me the actual IMPACT, not a wordy thing about holding slots.. none
 * of that makes sense"*.
 *
 * ⛔ THE WORDING WAS THE SYMPTOM AND STALENESS WAS THE DISEASE. `what` is written by whoever hit the
 * gap, in the vocabulary of the layer they were standing in — "a slot holds one standing", "`of:`
 * names one existing statement". Accurate, and unreadable; and unreadable has a consequence, because
 * re-reading four records to ask "is this still true?" costs enough that nobody does it.
 *
 * On the day this was written, **two of four gaps were already fixed and still read `open`** —
 * fg-0001 closed by `adds a statement` and fg-0004 by `blocks` on an existing question, both earlier
 * in the very session that had recorded them. A backlog where half the entries are false agrees with
 * whatever was believed when it was written, which is the same failure as a count that measures the
 * wrong thing and confirms the hypothesis.
 *
 * ⛔ SO `costs` IS CHECKABLE BY TRYING IT and `what` is not: verifying `what` means reading the
 * source, which is exactly the cost that let two records rot.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { FrameworkGap } = await import(path.resolve("dist/core/framework-gaps.js"));
const CLI = path.resolve("dist/cli/index.js");

const run = (args, dir) => {
  try {
    return { ok: true, out: execFileSync("node", [CLI, ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

/** A corpus whose gap record is empty, so `add` is the only thing that writes one. */
const corpus = () => {
  const dir = temp("pos-gap-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "productos"), { recursive: true });
  return dir;
};

test("⛔ a gap cannot be filed without saying what it costs", () => {
  const dir = corpus();
  const without = run(["todo", "add", "the model cannot express a thing that matters"], dir);
  assert.equal(without.ok, false, "a gap was recorded with no impact line");
  assert.match(without.out, /--costs/, "the refusal does not name the field that is missing");

  /** ⛔ THE NON-ZERO BESIDE IT. "add refuses" is also what a broken CLI produces. */
  const with_ = run(
    ["todo", "add", "the model cannot express a thing that matters", "--costs", "you cannot do the obvious thing, so you do it by hand instead"],
    dir
  );
  assert.ok(with_.ok, `a complete gap was refused: ${with_.out}`);
  assert.match(with_.out, /Recorded fg-0001/);
});

test("⛔ the backlog leads with the impact, not with the author's note about a layer", () => {
  const dir = corpus();
  assert.ok(
    run(["todo", "add", "Standing.about requires the question to be about what is there", "--costs", "you get asked about one sentence at a time, so eleven sentences take eleven round trips"], dir).ok
  );

  const listed = run(["todo"], dir);
  assert.ok(listed.ok, listed.out);
  const costsAt = listed.out.indexOf("eleven round trips");
  const whatAt = listed.out.indexOf("Standing.about requires");
  assert.ok(costsAt >= 0, "the impact is not printed at all");
  assert.ok(whatAt >= 0, "the author's note is not printed at all");
  assert.ok(costsAt < whatAt, "the backlog leads with the layer jargon rather than with the impact");
});

test("⛔ and a record written before the field existed still parses — consumer repos have these files", () => {
  /**
   * ⛔ THIS IS THE PROJECT'S OWN RULE FOR THE `model` AREA: never *"make a field required on the day
   * it lands — a schema change nobody can adopt gets reverted"*. Required in the schema, this field
   * stops every consumer repo's `framework-gaps.yaml` PARSING, and those are the records nobody
   * here can backfill. Measured by making it required and watching `todo` die:
   * `framework-gaps.yaml failed to parse: expected string, received undefined`.
   *
   * So the floor is at the door — `todo add` — and the schema stays adoptable.
   */
  const old = FrameworkGap.safeParse({
    id: "fg-0001",
    detected_at: "2026-10-22",
    detector: "authored",
    what: "something the model could not say, recorded before `costs` existed",
  });
  assert.ok(old.success, `an older gap record no longer parses: ${JSON.stringify(old.error?.issues)}`);
  assert.equal(old.data.costs, undefined);

  /** And a `costs` too short to be a sentence is not a `costs`. */
  const thin = FrameworkGap.safeParse({
    id: "fg-0002",
    detected_at: "2026-10-22",
    detector: "authored",
    what: "something the model could not say",
    costs: "bad",
  });
  assert.equal(thin.success, false, "a three-letter impact line was accepted");
});
