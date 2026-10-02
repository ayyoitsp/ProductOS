/**
 * ⛔ THE THREE STAGES, AND THAT THE LAST TWO ARE REACHABLE BY WORK RATHER THAN BY TYPING.
 *
 * Peter: *"wait, what are our main stages? we should have 'specification', 'ready for review',
 * 'ready for build' - ready for review is when the builders get involved.. design and product have
 * signed off, more or less"*.
 *
 * Nothing stores the stage. That is the design — a `stage:` field would be a second record of
 * consent, and the stored one wins because it is what a page prints. The cost of deriving it is
 * that it can be derived WRONGLY, which is not hypothetical: the first version read the stage off
 * `actsFor`, whose counts are purpose-gated, and rendered *"this feature states nothing yet"* onto
 * a feature with four exchanges. It looked completely plausible on the page.
 *
 * So the two things worth pinning are opposites:
 *   — the later stages are REACHABLE, by agreeing and reading through and nothing else
 *   — and UNREACHABLE while a question is open, however much else has been agreed
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { gridFor, stageOf } from "../dist/v2/grid.js";
import { STAGES } from "../dist/v2/schema.js";
import { execFileSync } from "node:child_process";

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2stage-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  /**
   * ⛔ A SEED HAS NO VERDICTS, DELIBERATELY — AND `stamp` BELOW WRITES ONE.
   *
   * `v2-seed/` is committed with `truth/`, `rules/` and `readings/` and nothing else, because a
   * seed nobody has agreed to is the point of it. So this test passed only where somebody's working
   * copy had an untracked `v2-seed/verdicts/` left over, and failed in a fresh clone and in CI.
   * `v2 reset` creates the directory; copying the seed by hand does not.
   */
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  return dir;
}

const stamp = (dir, v) =>
  fs.writeFileSync(path.join(dir, "verdicts", `${v.at}-${Math.random().toString(36).slice(2, 8)}.yaml`),
    Object.entries(v).map(([k, x]) => `${k}: ${JSON.stringify(x)}`).join("\n") + "\n");

/** Agrees to every behaviour one feature states — product and design signing off. */
function signOff(dir, scopeId) {
  const g = gridFor(loadCorpus(dir), scopeId);
  for (const row of g.rows)
    stamp(dir, {
      kind: "accept",
      target: `${scopeId}#${row.exchange}`,
      because: "Read it through with the people who asked for it, and this is what the product should do.",
      by: "a-person",
      via: "page",
      at: "2026-10-01",
    });
}

test("a feature states nothing, so it is at the first stage and says so", () => {
  const dir = seed();
  const c = loadCorpus(dir);
  for (const id of ["money", "tasks"]) {
    const st = stageOf(c, id);
    assert.equal(st.stage, "specification");
    assert.ok(st.because.length > 10, `"${id}" gives a stage with no reason — a bare badge is a fact nobody can check`);
  }
});

/**
 * ⛔ A GROUPING IS NOT A FEATURE. The first run over a real corpus called four containers
 * "specification — this feature states nothing yet", which is true of their own content and wrong
 * about what they are. A rollup would be a number every ancestor repeats and none owns.
 */
test("a grouping has no stage at all, rather than a wrong one", () => {
  const c = loadCorpus(seed());
  assert.equal(stageOf(c, "family-wallet"), null);
  assert.equal(stageOf(c, "no-such-feature"), null);
});

/**
 * ⛔ THE WHOLE POINT: the builders' stage arrives because somebody AGREED, not because anybody set
 * a field. If this ever passes without the accepts, the stage has become storable and the two
 * tenets have a way around them.
 */
test("agreeing to every behaviour is what reaches the builders' stage", () => {
  const dir = seed();

  /** The seed has an open question in each feature; settle them the way a person would. */
  const before = stageOf(loadCorpus(dir), "tasks");
  assert.equal(before.stage, "specification");
  assert.match(before.because, /unsettled|blank/);

  const c0 = loadCorpus(dir);
  const g = gridFor(c0, "tasks");
  const unsettledCells = g.rows.flatMap((r) =>
    Object.entries(r.cells).filter(([, cell]) => cell.mark === "○" || cell.mark === "·").map(([slot]) => `${r.exchange}.${slot}`)
  );
  assert.ok(unsettledCells.length, "the seed has nothing unsettled — this test proves nothing");

  /**
   * ⛔ Signing off WITHOUT settling must not advance it. An accept on every behaviour while a
   * question is still open is exactly the shape of a corpus that looks agreed and is not, and it is
   * the one case where a derived stage could be generous in the dangerous direction.
   */
  signOff(dir, "tasks");
  const still = stageOf(loadCorpus(dir), "tasks");
  assert.equal(still.stage, "specification",
    "a feature reached the builders while a question was still open — agreement is not a substitute for an answer");
});

/**
 * ⛔ THE WALK, BECAUSE A TRANSITION NOBODY RAN IS A GUESS.
 *
 * The test above proves the later stages are not reached EARLY, which is half a claim. This one
 * proves they are reached at all — and that each one arrives from the act that is supposed to cause
 * it and from nothing else. Driven through the CLI rather than by writing verdict files, so the
 * floors each act charges are charged here too.
 */
test("settling, agreeing and reading through is the whole way to the last stage", () => {
  const dir = seed();
  const at = ["--at", dir];
  const run = (...args) => execFileSync("node", [path.resolve("dist/cli/index.js"), "v2", ...args], { encoding: "utf-8" });
  const now = () => stageOf(loadCorpus(dir), "tasks");

  assert.equal(now().stage, "specification");

  /** 1. Answer the open question. ⛔ Still specification — nobody has agreed to anything. */
  run("rule", "tasks#complete-a-task#at_once",
    "--says", "Whoever presses first claims the task, and the second kid is told it is already done and by whom.",
    "--because", "In the trial the pain was two kids both believing they had earned the same reward, so the claim has to be visible at once.",
    "--by", "a-person", ...at);
  assert.equal(now().stage, "specification", "answering a question is not somebody agreeing to the answer");
  assert.match(now().because, /agreed to/, "the reason no longer says what is actually missing");

  /** 2. Product and design sign off. ⛔ THIS is the transition, and it is an accept — nothing else. */
  run("accept", "tasks#complete-a-task", "--by", "a-person", ...at);
  assert.equal(now().stage, "ready for review",
    "agreeing to every behaviour did not reach the builders' stage — the derivation and the acts have diverged");

  /** 3. A builder reads it through. */
  run("read", "tasks", "--buildable", "yes", "--by", "a-builder", ...at);
  const built = now();
  assert.equal(built.stage, "ready for build");
  assert.match(built.because, /a-builder/, "the last stage does not say who read it — then it is a badge, not a record");

  /**
   * ⛔ AND IT GOES BACK. A builder saying it is NOT buildable returns the feature to specification
   * with the blockers named. Not a fourth stage, and never a silent hold — the reason is the point.
   */
  run("read", "tasks", "--buildable", "no", "--by", "a-builder",
    "--note", "Nothing says where the claim is recorded when two devices are offline at once.",
    "--blocked-by", "tasks#complete-a-task#at_once", ...at);
  const back = now();
  assert.equal(back.stage, "specification", "a builder said it was not buildable and the feature stayed ready for build");
  assert.deepEqual(back.blocked_by, ["tasks#complete-a-task#at_once"]);
  assert.match(back.because, /not buildable/);
});

test("every stage a route names is a stage a feature can actually be at", async () => {
  /**
   * ⛔ THE DIVERGENCE THIS WOULD OTHERWISE BECOME. A route gating on a stage string the model does
   * not derive is a gate that can never open, and it would read as a workflow nobody follows rather
   * than as a typo.
   */
  const { SHIMS } = await import("../dist/core/jobs.js");
  for (const sh of SHIMS)
    if (sh.at) assert.ok(STAGES.includes(sh.at), `the route "${sh.route}" gates on "${sh.at}", which is not a stage`);
});
