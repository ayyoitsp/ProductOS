/**
 * ⛔ `v2 draw` REPLACED A GOOD DRAWING WITH PLACEHOLDERS AND REPORTED SUCCESS.
 *
 * Found by a scoper doing real work on Bilrost, in its own words:
 *
 *     "This corpus has no `config.yaml`, so `componentsDir` is undefined and no primitives are
 *      inlined: my first redraw replaced an 11,780-byte drawing with a 4,231-byte one full of
 *      placeholders, reported as a success. … Anybody who runs `v2 draw --all --into` this corpus
 *      will flatten every screen in it."
 *
 * Two faults compounding. A missing config was swallowed by `catch { componentsDir = undefined }`
 * with no word to anybody, and the write then replaced whatever was there — so the worse drawing
 * won, silently, on every screen in a sweep.
 *
 * ⛔ AND A WARNING WOULD NOT HAVE BEEN ENOUGH. `--all` prints a line per screen; nobody reads
 * twenty lines of yellow before noticing sixty screens went flat. The write has to stop, which is
 * why the assertion below is on the exit code and on the drawing still being there afterwards.
 *
 * ⛔ THE TEST IS "NOTHING INLINED **AND** MUCH SMALLER", NEVER SIZE ALONE — the second test here.
 * A screen genuinely simplified in code should shrink, and a guard on size alone would break the
 * generator the first time somebody deleted a panel.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));

/** A corpus with one screen already drawn richly, and no config — the Bilrost situation. */
function corpusWithADrawing(bytes) {
  const root = temp("v2worse-");
  const dir = path.join(root, "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

  /**
   * ⛔ A SCOPE THAT ALREADY HAS SCREENS. The first attempt took the first `.md` in `truth/`, which
   * is `family-wallet` — a container with no `views:` key at all — so the fixture added nothing and
   * the test passed over a corpus with no drawing to lose. Caught by its own non-vacuous assertion.
   */
  const scope = fs
    .readdirSync(path.join(dir, "truth"))
    .filter((f) => f.endsWith(".md"))
    .find((f) => /^views:/m.test(fs.readFileSync(path.join(dir, "truth", f), "utf-8")));
  assert.ok(scope, "no scope in the seed declares any views, so this fixture cannot be built");
  const file = path.join(dir, "truth", scope);
  const text = fs.readFileSync(file, "utf-8");

  /** A view carrying a big `sketch_html`, so there is something real to lose. */
  const id = text.match(/^id:\s*(.+)$/m)[1].trim();
  /** ⛔ No quotes in it: JSON.stringify escaped them and the reader regex could not span \" . */
  const rich = `<div><span>${"x".repeat(bytes)}</span></div>`;
  const out = text.replace(
    /^(views:)/m,
    `views:\n  - id: drawn-screen\n    title: A screen already drawn\n    sketch_html: ${JSON.stringify(rich)}`
  );
  fs.writeFileSync(file, out);

  /** A component that draws to very little — the placeholder outcome. */
  const route = path.join(root, "Thin.tsx");
  fs.writeFileSync(route, `export default function Thin() { return <div className="thin">hi</div> }`);
  return { dir, route, id, before: rich.length };
}

function draw(dir, route, ref, extra = []) {
  try {
    const out = execFileSync("node", [CLI, "v2", "draw", ref, "--route", route, "--into", dir, ...extra], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: ((e.stdout ?? "") + (e.stderr ?? "")).toString() };
  }
}

/**
 * ⛔ THROUGH THE READER, NOT A REGEX ON THE FILE. The hand-rolled version was wrong twice:
 * `[^"]*` cannot span the `\\"` that `JSON.stringify` emits, and after a write the file may quote
 * or fold the value differently than it was written. Asking the loader what the view holds is the
 * only spelling-proof answer — and it is what the product itself does.
 */
const held = (dir, scopeId, viewId = "drawn-screen") => {
  const c = loadCorpus(dir);
  const v = c.scopes.find((s) => s.scope.id === scopeId)?.scope.views.find((x) => x.id === viewId);
  return (v?.sketch_html ?? "").length;
};

test("a redraw that inlines nothing will not replace a much richer drawing", () => {
  const { dir, route, id, before } = corpusWithADrawing(4000);
  /** ⛔ Non-vacuous first: there has to be something worth losing. */
  assert.ok(before > 3000, `the fixture did not create a rich drawing: ${before} bytes`);
  assert.ok(held(dir, id) > 3000, "the corpus did not actually keep the drawing");

  const r = draw(dir, route, `${id}#drawn-screen`);

  assert.notEqual(r.code, 0, `draw replaced a rich drawing with placeholders and exited 0:\n${r.out}`);
  assert.match(r.out, /no component inlined/, `the refusal does not say why: ${r.out}`);
  /** The assertion that matters: the drawing is still there. */
  assert.ok(
    held(dir, id) > 3000,
    "the refusal printed and the drawing was overwritten anyway — which is the whole defect"
  );
});

/**
 * ⛔ AND `--anyway` STILL WORKS, because a screen that really did get simpler must not be
 * impossible to redraw. A guard with no escape becomes a guard somebody deletes.
 */
test("--anyway replaces it, for the screen that really did get simpler", () => {
  const { dir, route, id } = corpusWithADrawing(4000);
  const r = draw(dir, route, `${id}#drawn-screen`, ["--anyway"]);
  assert.equal(r.code, 0, `--anyway was refused: ${r.out}`);
  assert.ok(held(dir, id) < 3000, "--anyway did not replace the drawing");
});

/** ⛔ Size alone is not the test: a corpus with no prior drawing has nothing to lose. */
test("a first drawing is never refused", () => {
  const { dir, route, id } = corpusWithADrawing(0);
  /** Strip the drawing entirely, so this is the never-drawn case. */
  const file = path.join(dir, "truth", `${id}.md`);
  fs.writeFileSync(file, fs.readFileSync(file, "utf-8").replace(/\n\s*sketch_html:\s*("[^"]*"|'[^']*')/, ""));
  assert.equal(held(dir, id), 0, "the fixture still holds a drawing");

  const r = draw(dir, route, `${id}#drawn-screen`);
  assert.equal(r.code, 0, `drawing a screen for the first time was refused: ${r.out}`);
});

/** ⛔ And the missing config is reported rather than swallowed — the first of the two faults. */
test("a corpus with no config says so, instead of quietly drawing placeholders", () => {
  const { dir, route, id } = corpusWithADrawing(0);
  const file = path.join(dir, "truth", `${id}.md`);
  fs.writeFileSync(file, fs.readFileSync(file, "utf-8").replace(/\n\s*sketch_html:\s*("[^"]*"|'[^']*')/, ""));
  const r = draw(dir, route, `${id}#drawn-screen`);
  assert.match(
    r.out,
    /no config for this corpus|no components can be inlined/,
    `nothing said the drawing would be placeholders: ${r.out}`
  );
});
