/**
 * ⛔ EVIDENCE THAT ARRIVED AFTER SOMEBODY AGREED, AND WHICH NOBODY HAS LOOKED AT SINCE.
 *
 * Peter: *"when the feature is initially spec'd, or when UX is changed with explicit instructions,
 * and there is confirmation, it should feed into everything that hasn't been confirmed (or
 * confirmed) to make sure there are no discrepancies, and confidence is updated"* — and the
 * *"(or confirmed)"* is the half a confirmation alone does not give.
 *
 * A confirmation is a judgement about a statement AT A MOMENT. Evidence recorded afterwards is the
 * one thing that can make it wrong without anybody touching the sentence, and `stampFor` cannot
 * see it: the three stale states all key on the claim or its criteria moving. So a green stamp sat
 * over a statement something had since been observed about, which is the one place in a corpus
 * where the surface is most confident and the truth is least settled.
 *
 * ⛔ BY DATE, NOT BY PROSE. The over-assertion gate already showed what matching sentences costs,
 * and `check` says so where it refuses to do it. A reading dated after a verdict is an exact fact;
 * whether it contradicts the statement is a question for a person — which is why this produces a
 * QUESTION and never a verdict about the corpus.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { coveredBy } = await import("../dist/v2/stamp.js");
const { discrepancyFor, discrepanciesIn, whyConfident, undatedSupport } = await import("../dist/v2/confidence.js");

const REF = "money#see-a-balance#answer";

/** A corpus with a confirmation on a known date, and readings around it. */
function built(readings) {
  const dir = temp("v2disc-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const now = coveredBy(loadCorpus(dir), REF);
  assert.ok(now, `${REF} no longer resolves in the seed`);
  fs.mkdirSync(path.join(dir, "readings"), { recursive: true });
  fs.writeFileSync(path.join(dir, "readings", "r.yaml"), `readings:\n${readings}`);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "v.yaml"),
    `verdicts:\n  - kind: accept\n    by: peter\n    at: 2026-06-01\n    target: ${REF}\n    via: page\n` +
      `    covers_slots: ${now.slots}\n    covers_criteria: ${now.criteria}\n` +
      `    because: this is what the history shows, agreed in June\n    resolves: []\n`,
  );
  const corpus = loadCorpus(dir);
  return { dir, corpus };
}

const r = (id, on, at) =>
  `  - id: ${id}\n    bears_on: ${on}\n` +
  `    observes: an observation for ${id}, long enough to clear the floor\n` +
  `    basis: { kind: code, ref: "src/money/balance.ts:40", at: ${at} }\n`;

test("evidence recorded after the agreement is a discrepancy, and names what and when", () => {
  const { corpus, dir } = built(r("later", REF, "2026-09-30"));
  const d = discrepancyFor(corpus, REF);
  assert.ok(d, "a reading dated three months after the acceptance was not noticed");
  assert.deepEqual(d.confirmed, { by: "peter", at: "2026-06-01" });
  assert.equal(d.since.length, 1);
  assert.equal(d.since[0].ref, "src/money/balance.ts:40");
  assert.deepEqual(discrepanciesIn(corpus).map((x) => x.ref), [REF]);

  /** ⛔ Said on the confirmed statement itself — that is the row a reader would otherwise skip. */
  const why = whyConfident(corpus, REF).join("\n");
  assert.match(why, /peter confirmed this on 2026-06-01/);
  assert.match(why, /1 observation recorded since/);
  assert.match(why, /nobody has looked again/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("evidence from before the agreement is not a discrepancy — they looked at it", () => {
  const { corpus, dir } = built(r("earlier", REF, "2026-05-01"));
  assert.equal(discrepancyFor(corpus, REF), null, "a reading predating the acceptance was read as newer");
  assert.deepEqual(discrepanciesIn(corpus), []);
  assert.doesNotMatch(whyConfident(corpus, REF).join("\n"), /recorded since/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ a reading about the exchange counts, because containment means it is about this statement", () => {
  const { corpus, dir } = built(r("late-on-exchange", "money#see-a-balance", "2026-09-30"));
  const d = discrepancyFor(corpus, REF);
  assert.ok(d, "late evidence about the whole exchange did not reach its confirmed slot");
  assert.equal(d.since.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ an undated reading is not silently treated as old", () => {
  /**
   * `basis.at` is optional, and the comparison is on strings. Counting a missing date as "before"
   * would make an undated observation invisible to this check forever — and undated is exactly what
   * a hurried author writes. It is reported separately instead of guessed about.
   */
  const { corpus, dir } = built(
    `  - id: undated\n    bears_on: ${REF}\n` +
      `    observes: an observation with no date on it, long enough to clear the floor\n` +
      `    basis: { kind: code, ref: "src/money/undated.ts:1" }\n`,
  );
  assert.equal(discrepancyFor(corpus, REF), null, "an undated reading was ranked against a date");
  assert.deepEqual(undatedSupport(corpus, REF).map((s) => s.reading), ["undated"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("nothing is a discrepancy on a statement nobody confirmed", () => {
  /**
   * ⛔ The check is about a JUDGEMENT being overtaken, not about evidence being recent. An
   * unconfirmed statement with new readings is just a better-supported unconfirmed statement.
   */
  const { corpus, dir } = built(r("late", "money#see-a-balance#refuses", "2026-09-30"));
  assert.equal(discrepancyFor(corpus, "money#see-a-balance#refuses"), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the page says `confirmed · newer evidence`, not `confirmed`", () => {
  /**
   * ⛔ RENDERED, because the whole value is that a reader stops on that row. A model that knows and
   * a page that shows a clean green stamp is the same as not knowing.
   */
  const { corpus, dir } = built(r("later", REF, "2026-09-30"));
  void corpus;
  const out = path.join(dir, "page.html");
  execFileSync("node", ["dist/cli/index.js", "v2", "page", "money", "--at", dir, "--out", out], { stdio: "ignore" });
  const html = fs.readFileSync(out, "utf-8");
  assert.match(html, /confirmed · newer evidence/, "the page still shows a clean confirmation");
  assert.match(html, /observation(s)? recorded since/);
  fs.rmSync(dir, { recursive: true, force: true });
});
