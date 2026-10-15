/**
 * ⛔ `Term.contested` PARSED, WAS TESTED, AND NO SURFACE READ IT.
 *
 * Two authors found this independently in one session: *"`v2 decide` listed six questions and not
 * the seventh, which sat on a term"*, and *"question 3 reaches nobody — somebody has to route it
 * by hand until that is fixed"*.
 *
 * ⛔ AND THE FIELD WAS ADDED TO PREVENT EXACTLY WHAT CAME BACK. Its own schema comment records
 * fg-0004: a scoper found *version selection*, *model revision*, *master model version* and *input
 * version* used across four places for three distinct objects, and left the collision out of truth
 * ENTIRELY rather than settle it by writing a definition — because a guessed definition reads
 * exactly like a decided one. `contested` gave that a home, and `questionsIn` walked
 * `scope.exchanges` only, so the home was write-only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { openTermQuestions, questionsFor } = await import(path.resolve("dist/v2/settle.js"));
const CLI = path.resolve("dist/cli/index.js");

function corpusWith(terms) {
  const dir = path.join(temp("pos-term-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  /** ⛔ In the FRONTMATTER. Terms are not a fenced block, and a fence loads as prose in silence. */
  fs.writeFileSync(
    path.join(dir, "truth", "money.md"),
    `---\nid: money\ntitle: Money\nin: the-product\nexists: kept\nterms:\n${terms}---\n\n# Money\n\nWhat a kid's money is.\n`
  );
  return dir;
}

const CONTESTED = `  balance:
    means: what is in the pot right now
    contested:
      question: Is a balance the settled figure or the figure including money in flight?
      with: [available, cleared]
`;

test("a word recorded as contested is asked of somebody", () => {
  const dir = corpusWith(CONTESTED);
  const corpus = loadCorpus(dir);
  const found = openTermQuestions(corpus, ["money"]);

  /** ⛔ The non-zero first. Silence is the whole defect. */
  assert.equal(found.length, 1, "a contested word reached nobody");
  const q = found[0];
  assert.equal(q.ref, "money#balance");
  assert.match(q.asks, /settled figure or the figure including money in flight/, "the question itself is missing");
  assert.match(q.asks, /available, cleared/, "it does not say what the word collides with");
  assert.match(q.asks, /what is in the pot right now/, "it does not say what the word means here");
});

test("a word nobody contested is not asked about", () => {
  /**
   * ⛔ WITHOUT THIS THE FIRST TEST PASSES ON A WALKER THAT ASKS ABOUT EVERY WORD — and a queue
   * holding one question per term in the corpus is one nobody reads, which buries the real ones.
   */
  const dir = corpusWith(`  balance:\n    means: what is in the pot right now\n`);
  assert.deepEqual(openTermQuestions(loadCorpus(dir), ["money"]), []);
});

test("it has no slot, and nothing pretends otherwise", () => {
  /**
   * ⛔ A WORD HAS NO SLOT. Pinning the ruling to some exchange's `answer` would put it where no
   * other feature using that name would ever look — and `SLOT_ASKS_SHORT[undefined]` printed
   * `undefined` into the queue, which is how a faked field announces itself.
   */
  const q = openTermQuestions(loadCorpus(corpusWith(CONTESTED)), ["money"])[0];
  assert.equal(q.slot, undefined, "a question about a word was given a slot");
});

test("the answering queue carries it, not just the walker", () => {
  /**
   * ⛔ THE WALKER ALONE PROVES NOTHING. `questionsIn` was correct about slots and the defect was
   * that `questionsFor` never called anything else — so a unit test on a new function would pass
   * while `v2 decide` stayed exactly as silent as before.
   */
  const dir = corpusWith(CONTESTED);
  const all = questionsFor(loadCorpus(dir), "money");
  assert.ok(
    all.some((q) => q.ref === "money#balance"),
    "the queue a person actually reads does not include it"
  );
});

test("`v2 decide` prints it", () => {
  const dir = corpusWith(CONTESTED);
  const out = execFileSync("node", [CLI, "v2", "decide", "money", "--at", dir], { encoding: "utf-8" });
  assert.match(out, /contested word/);
  assert.match(out, /The word "balance"/);
  assert.doesNotMatch(out, /undefined/, "the absent slot printed as `undefined`");
});
