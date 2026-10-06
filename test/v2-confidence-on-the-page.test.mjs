/**
 * ⛔ THE TWO ZONES, AS RENDERED — WHICH IS THE CONDITION PETER ATTACHED TO CHOOSING THIS.
 *
 * Asked whether a confirmation may raise another statement's standing, he took the most permissive
 * answer on the table: shared support raises confidence too. The option he picked carried two
 * conditions in its own text — the zones stay visibly distinct, and a statement shows which
 * confirmation it inherited from — and he then said it again unprompted: *"yes, the reason why it
 * has confidence needs to be visible as well"*.
 *
 * ⛔ SO THIS ASSERTS THE RENDERED PAGE, NOT THE DERIVATION. `v2-confidence` already covers what the
 * numbers are. A scale that is correct in `confidenceOf` and renders `corroborated` in the same pill
 * as `confirmed` satisfies the model and breaks the promise, and the only way to know is to render
 * it and look — which is how three defects in this feature were found, including a tier named
 * `one-reading` printed over a statement with no readings.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { loadCorpus } = await import("../dist/v2/load.js");
const { coveredBy } = await import("../dist/v2/stamp.js");

const A = "money#see-a-balance#answer";
const B = "money#see-a-balance#refuses";

/**
 * A corpus with one confirmation and a second statement resting on the same pointer — the case the
 * whole mechanism exists for, rendered through the real command.
 */
function rendered() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2cpage-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const now = coveredBy(loadCorpus(dir), A);
  assert.ok(now, `${A} no longer resolves in the seed`);

  fs.mkdirSync(path.join(dir, "readings"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "readings", "shared.yaml"),
    `readings:\n` +
      `  - id: answer-from-code\n    bears_on: ${A}\n` +
      `    observes: the history is read straight off the ledger rows, newest first, with no cache\n` +
      `    basis: { kind: code, ref: "src/money/balance.ts:40" }\n` +
      `  - id: refuses-from-code\n    bears_on: ${B}\n` +
      `    observes: the not-your-kid refusal is the same guard the ledger query uses\n` +
      `    basis: { kind: code, ref: "src/money/balance.ts:40" }\n` +
      `  - id: refuses-from-trial\n    bears_on: ${B}\n` +
      `    observes: no parent in the trial tried to look at another family, so it was never exercised\n` +
      `    basis: { kind: trial, ref: "eleven sessions, September 2026" }\n`,
  );
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "v.yaml"),
    `verdicts:\n  - kind: accept\n    by: peter\n    at: 2026-10-05\n    target: ${A}\n    via: page\n` +
      `    covers_slots: ${now.slots}\n    covers_criteria: ${now.criteria}\n` +
      `    because: this is what the history shows, and the reading matches it\n    resolves: []\n`,
  );

  const out = path.join(dir, "page.html");
  execFileSync("node", ["dist/cli/index.js", "v2", "page", "money", "--at", dir, "--out", out], { stdio: "ignore" });
  const html = fs.readFileSync(out, "utf-8");
  fs.rmSync(dir, { recursive: true, force: true });
  return html;
}

const html = rendered();

test("a confirmed statement wears the pill, and nothing else does", () => {
  assert.match(html, /class="chip ok"[^>]*>confirmed</, "the confirmed chip is gone from the page");
  /**
   * ⛔ THE SHAPE IS THE DISTINCTION, so it is asserted in the stylesheet rather than trusted to a
   * class name. `--ok` is the confirmed colour and nothing in the lower zone may carry it.
   */
  assert.match(html, /\.chip\.support \{[^}]*border-radius: 3px/, "the support chip is not squared off");
  assert.match(html, /\.chip\.ok \{[^}]*var\(--ok\)/);
  const supportRules = [...html.matchAll(/\.chip\.support[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join(" ");
  assert.ok(supportRules.length > 20, "no .chip.support rules found — the zones are not styled apart");
  assert.doesNotMatch(supportRules, /var\(--ok\)/, "⛔ a lower-zone chip paints with the confirmed colour");
});

test("the statement resting on the same evidence says so, in text, on the page", () => {
  /**
   * The chip. ⛔ MATCHED ON CLASS AND TEXT, NOT ON ATTRIBUTE ORDER — this asserted
   * `class="chip support strong">strongly supported` with the `>` adjacent, and broke the day a
   * `title` was added between them. The markup is not the claim; the class and the words are.
   */
  const chips = [...html.matchAll(/<span class="chip ([^"]*)"[^>]*>([^<]*)<\/span>/g)].map((m) => ({
    classes: m[1],
    text: m[2],
  }));
  const strong = chips.find((c) => /support/.test(c.classes) && /strongly supported/.test(c.text));
  assert.ok(strong, `no strongly-supported chip rendered. chips: ${chips.map((c) => c.text).join(" | ")}`);
  assert.match(strong.classes, /\bstrong\b/, "the top tier does not carry the strong class");
  assert.match(strong.text, /· 2$/, "the source count is missing from the chip");

  /**
   * ⛔ THE REASON IS MARKUP, NOT A `title`. A tooltip cannot be scanned down a column, does not
   * survive the screenshot this corpus is reviewed in, and on a touch screen does not exist.
   */
  const whys = [...html.matchAll(/<ul class="why">([\s\S]*?)<\/ul>/g)].map((m) => m[1]);
  assert.ok(whys.length >= 2, `only ${whys.length} reason blocks rendered`);
  const all = whys.join("\n");
  assert.match(all, /peter confirmed this on 2026-10-05/);
  assert.match(all, /Rests on the same evidence as money#see-a-balance#answer, which is confirmed/);
  assert.match(all, /src\/money\/balance\.ts:40/, "the shared pointer is not named, so nobody can go and look");
  assert.match(all, /2 independent sources, so: strongly-supported/);
  /** ⛔ The sentence that keeps the zones apart in words as well as in shape. */
  assert.match(all, /Still not confirmed/);
});

test("⛔ nothing in the lower zone renders the word confirmed as its own state", () => {
  /**
   * The failure this guards is one typo wide: a chip reading `confirmed` over a statement nobody
   * agreed to. `not confirmed` and `Still not confirmed` both contain the word, so the assertion is
   * on the support chip's own text rather than on the page containing a string.
   */
  for (const m of html.matchAll(/class="chip support[^"]*">([^<]*)</g)) {
    assert.doesNotMatch(m[1], /^confirmed/, `a support chip reads "${m[1]}"`);
    assert.match(m[1], /^(one source|corroborated|strongly supported)/, `unexpected support chip text "${m[1]}"`);
  }
});

test("the reason sits in the expanded detail, not on the collapsed row", () => {
  /**
   * Peter asked for the table to be tabular — *"collapse all the info, only on row tap does it
   * expand"*. Three hundred rows each carrying three lines of provenance is the wall that request
   * was about, so the chip is the signal and the argument is one tap away.
   */
  const detail = /<tr class="beh-detail"[^>]*>([\s\S]*?)<\/tr>/.exec(html);
  assert.ok(detail, "there are no expandable detail rows");
  const rows = [...html.matchAll(/<tr class="beh"[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  assert.ok(rows.length > 0);
  for (const r of rows) assert.doesNotMatch(r, /<ul class="why">/, "a collapsed row carries the full reason");
});
