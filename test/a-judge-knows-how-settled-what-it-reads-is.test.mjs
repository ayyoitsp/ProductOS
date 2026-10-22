/**
 * ⛔ NOT ONE OF THE JUDGES KNEW WHAT IT WAS READING.
 *
 * Peter, on `buildability` being let past the sign-off gate: *"uhm, what? why? buildability should
 * take validation into account. if a verdict has low confidence/no agreement, why the fuck would it
 * trust it?"*
 *
 * He was right, and it dissolved the question that had been put to him. Three options had been
 * offered — gate the role, exempt it, or split it — and every one treats "how settled is this" as a
 * property of the WHOLE FEATURE, decided by a gate, outside the judge. The corpus answers it per
 * sentence and always has: `levelOf` returns `accepted | derived | suggested | open`, and the packet
 * PRINTS that word beside every slot line. The judges reading that packet were never told.
 *
 * Measured before the fix: all ten authors' briefs say something about what is agreed and what is
 * not, because `whereAnAuthorWrites` tells each of them. **Zero of the judges mentioned it.** So
 * every reviewer in this project read a corpus as though every sentence in it were equally
 * established.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const { AGENTS, AUTHORS } = await import(path.resolve("dist/core/jobs.js"));
const { whatAJudgeReads, LEVEL_OPEN, LEVEL_CLOSE, withWhatAJudgeReads } = await import(
  path.resolve("dist/core/what-a-judge-reads.js")
);
const { LEVEL_WORD } = await import(path.resolve("dist/v2/level.js"));

/** The judges that read a corpus through ProductOS — ⛔ which is every one but the newcomer. */
const readers = AGENTS.filter((a) => a.prompt && a.needs.includes("ask-the-corpus"));

test("⛔ every judge that reads a corpus is told how settled what it reads is", () => {
  assert.ok(readers.length >= 10, `only ${readers.length} judges read the corpus — this test is measuring the wrong set`);
  for (const a of readers) {
    const body = fs.readFileSync(path.resolve(a.prompt), "utf-8");
    assert.ok(body.includes(LEVEL_OPEN), `"${a.name}" is not told how settled what it reads is`);
    assert.ok(body.includes(LEVEL_CLOSE), `"${a.name}" has an unclosed block`);
  }
});

test("⛔ and it is generated, so a judge's copy cannot drift from the one home", () => {
  /**
   * The same guarantee the author block has, for the reason that one gives: fifteen hand copies of
   * one paragraph cannot all be kept right, so they are kept right for none.
   */
  const block = whatAJudgeReads();
  for (const a of readers) {
    const body = fs.readFileSync(path.resolve(a.prompt), "utf-8");
    const i = body.indexOf(LEVEL_OPEN);
    const j = body.indexOf(LEVEL_CLOSE) + LEVEL_CLOSE.length;
    assert.equal(body.slice(i, j), block, `"${a.name}" has drifted — run productos v2 agents --presets`);
  }
});

test("⛔ the newcomer is never told, because being told is what would ruin it", () => {
  /**
   * ⛔ THE FIRST RUN OF THE GENERATOR WROTE INTO IT. `newcomer` is a product manager handed a URL
   * with no knowledge of ProductOS, and `ask-the-corpus` carries the same refusal for the same
   * reason: a role that has been told what the model is can no longer detect that the page failed
   * to say. A section naming levels, the packet and three tool names tells it in prose, which is
   * worse than a tool list because it reads as help.
   */
  const nc = AGENTS.find((a) => a.name === "newcomer");
  assert.ok(nc, "the newcomer is gone, and this test is the only thing that would have noticed");
  assert.ok(!nc.needs.includes("ask-the-corpus"), "the newcomer now reads the corpus through ProductOS");
  const body = fs.readFileSync(path.resolve(nc.prompt), "utf-8");
  assert.ok(!body.includes(LEVEL_OPEN), "the newcomer has been told what the model is");
  assert.ok(!/\bsuggested\b|levelOf|productos_exchange/.test(body), "the newcomer's brief names the model's own vocabulary");
});

test("⛔ it names every level the model has, in the model's own words", () => {
  /**
   * ⛔ READ OFF `LEVEL_WORD`, so a paragraph describing three of four levels is impossible. A judge
   * told about `agreed` and `suggested` but not `derived` would read a derived sentence as
   * unconfirmed and report a defect against software's own arithmetic.
   */
  const block = whatAJudgeReads();
  for (const [name, word] of Object.entries(LEVEL_WORD))
    assert.ok(block.includes(`\`${word}\``), `the level "${name}" (${word}) is not described to any judge`);
});

test("⛔ it says a draft's unfinishedness is not a defect — the thing the gate used to prevent", () => {
  /**
   * This is why `buildability` may now run before anybody has agreed to a feature. The protection
   * is no longer "engineering waits"; it is that a judge knows what it is looking at. If this
   * sentence goes, the exemption in `agents-and-areas` is unguarded again.
   */
  const block = whatAJudgeReads();
  assert.match(block, /never report a draft's unfinishedness as a defect/i);
  assert.match(block, /rewriting product truth to satisfy a reviewer/i, "nothing says what the harm is");
  assert.match(block, /worth less than no verdict/i, "nothing tells a judge what to do when most of it is unconfirmed");
});

test("the block is idempotent, and replaces rather than stacks", () => {
  /** ⛔ Two copies in one brief is a role told the same thing twice and a diff nobody can read. */
  const once = withWhatAJudgeReads("Top line.\n\n## A heading\n\nbody\n");
  const twice = withWhatAJudgeReads(once);
  assert.equal(twice, once);
  assert.equal(twice.split(LEVEL_OPEN).length - 1, 1, "the block was added a second time");
});

test("⛔ authors are not given it — they have their own, and it answers a different question", () => {
  /**
   * An author's block says where its work LANDS and that nothing it writes is agreed. This one says
   * how settled what it READS is. Giving an author both would be two paragraphs about agreement,
   * and the one that matters for an author is the one about its own writes.
   */
  for (const a of AUTHORS.filter((x) => x.prompt)) {
    const body = fs.readFileSync(path.resolve(a.prompt), "utf-8");
    assert.ok(!body.includes(LEVEL_OPEN), `the author "${a.name}" was given the judges' block`);
  }
});
