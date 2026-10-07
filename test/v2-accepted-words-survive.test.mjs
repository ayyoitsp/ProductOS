/**
 * ⛔ THE WORDS SOMEBODY AGREED TO ARE RECORDED, SO A REWORD CAN BE SEEN AND UNDONE.
 *
 * Peter: *"Six of your nine acceptances have gone stale… why did this happen? we should probably
 * prevent this - when regenerating, we should take the approved ones into account and try to keep
 * them."*
 *
 * The cause, found by looking rather than guessed: all six were on `create-deal#create-deal-form`,
 * all accepted on 2026-10-01, and the view was regenerated the next day. Going stale was CORRECT —
 * he agreed to particular words and the words moved. What was not survivable is that the verdict
 * kept two hashes and no text, so nothing could say what he had agreed to. Re-confirming meant
 * reconstructing it from memory.
 *
 * ⛔ THIS DOES NOT KEEP A STAMP ALIVE ACROSS A REWORD, AND MUST NOT. A surviving stamp is consent
 * attached to words nobody read. What it buys: the diff is visible, and an author can be told what
 * not to touch before they touch it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { stampFor, whatChangedSince } = await import("../dist/v2/stamp.js");
const { perform } = await import("../dist/v2/acts.js");

const REF = "money#see-a-balance#with";

const accepted = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2words-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const r = perform(dir, "accept", { target: REF }, {
    by: "peter",
    via: "page",
    because: "this is what somebody must bring, and that is right",
  });
  assert.ok(r.ok, `the fixture acceptance failed: ${r.ok ? "" : r.why}`);
  return dir;
};

/** Reword the slot the way a regeneration would, with no announcement. */
const reword = (dir) => {
  const f = path.join(dir, "truth", "money.md");
  const body = fs.readFileSync(f, "utf-8");
  assert.match(body, /Which kid\./, "the seed's wording moved — this fixture rewords a sentence that is gone");
  fs.writeFileSync(f, body.replace("Which kid.", "Which kid, chosen from the family."));
};

test("accepting records the exact words, not only their hash", () => {
  const dir = accepted();
  const v = loadCorpus(dir).verdicts.at(-1);
  assert.equal(v.kind, "accept");
  assert.ok(v.covers_slots, "the hashes are gone");
  assert.ok(v.covered_text?.length, "⛔ the words were not recorded, which is the whole defect");
  assert.ok(
    v.covered_text.some((l) => /with — Which kid\./.test(l)),
    `the recorded text does not contain the sentence agreed to: ${JSON.stringify(v.covered_text)}`,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the recorded text parses back — it is YAML, and these lines carry colons and dashes", () => {
  /**
   * ⛔ A NAIVE `- ${line}` PRODUCED YAML THAT WOULD NOT LOAD. The hashed reading contains colons,
   * quotes and em dashes, so the field is JSON-quoted. Caught by round-tripping a real acceptance
   * rather than by reading the output: a corpus that will not load is worse than a missing field.
   */
  const dir = accepted();
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], `the corpus stopped loading after an accept: ${JSON.stringify(c.broken)}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ a reword still kills the acceptance — the words being recorded changes nothing about that", () => {
  const dir = accepted();
  assert.equal(stampFor(loadCorpus(dir), REF).state, "accepted");
  reword(dir);
  const st = stampFor(loadCorpus(dir), REF);
  assert.equal(st.state, "claim-changed", "a reword left the acceptance standing");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("and it says exactly which words moved", () => {
  const dir = accepted();
  reword(dir);
  const moved = whatChangedSince(loadCorpus(dir), REF);
  assert.ok(moved, "nothing could say what changed");
  assert.equal(moved.by, "peter");
  assert.deepEqual(moved.gone, ["with — Which kid."]);
  assert.deepEqual(moved.arrived, ["with — Which kid, chosen from the family."]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ a verdict written before the words were recorded says so, rather than reporting no change", () => {
  /**
   * Every acceptance in every existing corpus predates this field — including the six that died.
   * `null` and "nothing changed" are different answers, and conflating them would tell a reviewer
   * their stale acceptance was fine.
   */
  const dir = accepted();
  const f = path.join(dir, "verdicts", fs.readdirSync(path.join(dir, "verdicts"))[0]);
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").split("\n").filter((l) => !/covered_text|^\s+- "/.test(l)).join("\n"));
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "stripping the field broke the corpus");
  assert.equal(c.verdicts.at(-1).covered_text, undefined, "the fixture did not actually strip the field");
  assert.equal(whatChangedSince(c, REF), null, "it reported a diff with nothing to diff against");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the stale finding names the words, so the fix is not `read the whole thing again`", () => {
  const dir = accepted();
  reword(dir);
  /**
   * ⛔ `v2 check` EXITS NON-ZERO WHEN ANYTHING REFUSES, AND A STALE ACCEPTANCE REFUSES. So the
   * harness has to read stdout off the thrown error — `execFileSync` throwing here is the command
   * working, not failing, and the first version of this test reported a pass-shaped crash.
   */
  let out = "";
  try {
    out = execFileSync("node", ["dist/cli/index.js", "v2", "check", "--at", dir], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  assert.ok(out.length > 50, "check produced no output at all");
  assert.match(out, /acceptance-is-stale/);
  assert.match(out, /was: "with — Which kid\."/, "the finding does not say what was agreed to");
  assert.match(out, /now: "with — Which kid, chosen from the family\."/, "the finding does not say what it says now");
  /** ⛔ And it must not suggest re-stamping, which is the one move that launders consent. */
  assert.match(out, /Do not re-stamp it yourself/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("`v2 accepted` prints the agreed wording, from the verdict rather than from the corpus", () => {
  /**
   * ⛔ FROM THE VERDICT. Re-reading the sentence out of the corpus would print whatever is there
   * now — which is exactly what this exists to protect against, and the mistake would be invisible
   * until somebody had already overwritten an agreement.
   */
  const dir = accepted();
  reword(dir);
  const out = execFileSync("node", ["dist/cli/index.js", "v2", "accepted", "money", "--at", dir], {
    encoding: "utf-8",
  }).toString();
  /** The acceptance is stale now, so it is not listed — a stale acceptance is not something to keep. */
  assert.match(out, /nothing in money has been agreed to yet/);

  const fresh = accepted();
  const live = execFileSync("node", ["dist/cli/index.js", "v2", "accepted", "money", "--at", fresh], {
    encoding: "utf-8",
  }).toString();
  assert.match(live, /1 thing somebody has agreed to/);
  assert.match(live, /with — Which kid\./, "the agreed sentence is not printed, so an author cannot keep it");
  assert.match(live, /Keep these words/);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(fresh, { recursive: true, force: true });
});

test("the scoper is told to run it before rewriting", () => {
  /** ⛔ The layer `CLAUDE.md` says is most missed, and the only one that PREVENTS rather than reports. */
  const doc = fs.readFileSync("agents/productos-scoper.md", "utf-8");
  assert.match(doc, /productos v2 accepted/);
  assert.match(doc, /Keep those words/i);
  assert.match(doc, /is not a small edit, it is a withdrawal/);
  assert.match(doc, /never re-stamp it yourself/i);
});
