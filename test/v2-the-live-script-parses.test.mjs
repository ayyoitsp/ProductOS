/**
 * ⛔ THE PAGE'S SCRIPTS ARE TEMPLATE STRINGS, SO NOTHING TYPE-CHECKS THEM — AND A SYNTAX ERROR IN
 * ONE KILLS EVERY SCRIPT ON THE PAGE, NOT JUST ITS OWN FEATURE.
 *
 * Adding the prototype-selection editor I wrote `.split("\n")` inside the live script. TypeScript
 * consumed the escape, so the browser received a string literal broken across two lines: "Invalid
 * or unexpected token" — and with it the composer, the walk, every act button, the whole live
 * script. `tsc` was clean. 846 tests were green. The page was dead.
 *
 * Two traps in one, both invisible from the source:
 *
 *   1. `\n` in a template literal reaches the browser as a real newline. It needs `\\n`.
 *   2. a backtick anywhere in that region — including in a COMMENT — closes the literal. My first
 *      attempt to document trap 1 used backticks around the escape and broke the compile.
 *
 * ⛔ AND A TYPE ANNOTATION IS THE SAME CLASS. The first draft of that editor was written as
 * TypeScript — `as HTMLFormElement | null` — which the compiler never sees, because it is a string.
 * It would have shipped as a syntax error too.
 *
 * So every inline script the page emits is parsed here the way a browser parses it. ⛔ Not executed:
 * these touch `document` and `fetch`, and the question is whether they PARSE — which is the failure
 * that takes the page out.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/** A corpus with the surfaces that carry scripts: prototypes, two axes, a half-placed option. */
function corpus() {
  const dir = path.join(temp("v2script-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const views = c.scopes.flatMap((e) => (e.scope.views ?? []).map((v) => `${e.scope.id}#${v.id}`));
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "splits_on:",
      "  - id: line",
      "    asks: Which product line?",
      "  - id: role",
      "    asks: Which role?",
      "prototypes:",
      "  - id: cre-admin",
      "    title: CRE — admin",
      `    starts_at: ${views[0]}`,
      "    is:",
      "      line: CRE",
      "      role: admin",
      "  - id: pl-proc",
      "    title: Private lending — processor",
      `    starts_at: ${views[1] ?? views[0]}`,
      "    is:",
      "      line: private lending",
      "",
    ].join("\n")
  );
  return dir;
}

const scriptsIn = (html) =>
  [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test("⛔ every inline script the page emits parses as a browser would parse it", () => {
  const dir = corpus();
  const c = loadCorpus(dir);
  /** ⛔ `interactive`, or `liveScript` is never emitted and this test checks the inert stub. */
  const html = renderScopePage(c, c.scopes[0].scope.id, { interactive: true, by: "peter" }) ?? "";
  assert.ok(html, "nothing rendered");

  const blocks = scriptsIn(html);
  assert.ok(blocks.length >= 5, `only ${blocks.length} inline scripts — this test is not reaching them`);

  /** ⛔ The live script specifically, which is the one that carries every interaction. */
  assert.ok(
    blocks.some((b) => b.includes("wireSelectionEditor")),
    "the live script is absent, so a syntax error in it would not be caught here"
  );

  const bad = [];
  blocks.forEach((src, i) => {
    try {
      new vm.Script(src);
    } catch (e) {
      bad.push(`block ${i}: ${e.message}`);
    }
  });
  assert.deepEqual(bad, [], `an inline script does not parse — the whole page's JavaScript is dead:\n  ${bad.join("\n  ")}`);
});

test("⛔ no TypeScript leaked into a script the browser runs", () => {
  /**
   * `tsc` cannot see inside these strings, so an annotation written out of habit compiles and then
   * fails in the browser. The parse test above catches most of it; this names the cause, because
   * "Unexpected token" at character 9,000 of a minified blob is not a diagnosis.
   */
  const dir = corpus();
  const c = loadCorpus(dir);
  const html = renderScopePage(c, c.scopes[0].scope.id, { interactive: true }) ?? "";
  for (const src of scriptsIn(html)) {
    assert.doesNotMatch(src, /\bas HTML[A-Za-z]+Element\b/, "a TypeScript cast reached the browser");
    assert.doesNotMatch(src, /:\s*Promise<|:\s*Record<|:\s*string\[\]/, "a TypeScript type annotation reached the browser");
  }
});
