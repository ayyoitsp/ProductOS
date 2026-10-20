/**
 * ⛔ A REQUIREMENT WRITTEN AS STEPS RENDERED AS AN EMPTY BULLET.
 *
 * `Criterion` has carried `steps` for as long as it has carried `given`/`when`/`then`, and the
 * demonstrator brief's own example uses it — a claim whose demonstration is a SEQUENCE ("press it
 * three times and the order cycles") cannot be said in one `when` without reading as a single
 * press. The page built a requirement's text from `given`, `when` and `then` only. So a
 * steps-shaped requirement came out as:
 *
 *     <summary>1 thing that would show this</summary><ul><li></li></ul>
 *
 * A reader is told something demonstrates the claim, and shown nothing. Worse than absent: the
 * count says a demonstration exists, so the one surface that would reveal the gap asserts there
 * is none.
 *
 * ⛔ FOUND ON THE LIVE PAGE, NOT BY READING THE RENDERER. A demonstrator working Peter's deal list
 * wrote one steps-shaped requirement, reported the empty bullet, and said it kept `steps` rather
 * than distorting the artefact to flatter the renderer — which is the right direction and the
 * reason this is a renderer fix. `curl` on the deployed page then showed exactly one
 * `<ul><li></li></ul>`.
 *
 * ⛔ THE PACKET WAS ALREADY RIGHT, which is what made this invisible: the artefact handed to
 * whoever builds the thing printed the steps, so the content was never missing — only the surface
 * a person reviews on dropped it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { execFileSync } from "node:child_process";

/** A corpus whose one requirement is a sequence, which is the shape that disappeared. */
function rendered() {
  const dir = temp("v2steps-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const file = path.join(dir, "truth", "money.md");
  const text = fs.readFileSync(file, "utf-8");
  assert.match(text, /^exchanges:/m, "the seed's money scope has no exchanges to hang a requirement on");
  /**
   * ⛔ BUILT AGAINST THE SCHEMA, after two wrong guesses the loader caught: `criteria` is not a key
   * on a slot (`exchanges.0.slots.with — Unrecognized key(s)`), the seed's exchanges already carry
   * a `criteria:` list so adding the key duplicates it, and every criterion needs `slot`
   * (`exchanges.0.criteria.0.slot — Required`). Each refusal was the loader doing its job.
   */
  const out = text.replace(
    /^(\s+)criteria:$/m,
    (_m, pad) =>
      `${pad}criteria:\n` +
      `${pad}  - id: 99\n` +
      `${pad}    slot: answer\n` +
      `${pad}    steps: |-\n` +
      `${pad}      - press the heading once and the list reads smallest first\n` +
      `${pad}      - press it again and the list reads largest first\n` +
      `${pad}      - press it a third time and the list is in no order at all\n`
  );
  assert.notEqual(out, text, "the fixture matched nothing, so nothing was added");
  fs.writeFileSync(file, out);
  const page = path.join(dir, "page.html");
  execFileSync("node", ["dist/cli/index.js", "v2", "page", "money", "--at", dir, "--out", page], { stdio: "ignore" });
  const html = fs.readFileSync(page, "utf-8");
  fs.rmSync(dir, { recursive: true, force: true });
  return html;
}

const html = rendered();

test("the steps are on the page", () => {
  assert.match(html, /press the heading once and the list reads smallest first/, "the first step is not rendered");
  assert.match(html, /press it a third time and the list is in no order at all/, "the last step is not rendered");
});

test("and no requirement renders as an empty bullet", () => {
  /**
   * ⛔ THE EXACT SHAPE SEEN ON THE DEPLOYED PAGE. Asserting only that the text appears somewhere
   * would pass on a page that renders the steps AND an empty bullet beside them.
   */
  assert.doesNotMatch(html, /<ul><li><\/li><\/ul>/, "a requirement still renders as an empty bullet");
  assert.doesNotMatch(html, /<li>\s*<\/li>/, "a requirement renders as a blank list item");
});

test("the count and the content agree", () => {
  /**
   * ⛔ THE COUNT WAS ALREADY HONEST AND THE LIST WAS NOT, which is what made this expensive to
   * see: the summary read "3 things that would show this" over two sentences and a blank line.
   * A reader counts three, finds two, and cannot tell whether one is missing or they miscounted.
   */
  const m = html.match(/(\d+) things? that would show this/);
  assert.ok(m, "nothing says how many demonstrations there are");
  const shown = (html.match(/<li>(?!\s*<\/li>)[^]*?<\/li>/g) ?? []).length;
  assert.ok(shown >= Number(m[1]), `the summary claims ${m[1]} demonstrations and ${shown} have any content`);
});
