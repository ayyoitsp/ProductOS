/**
 * ⛔ ONE PARSE, TWO RENDERINGS. NOBODY TYPES EITHER.
 *
 * Peter: "fix the ascii/rendering" — after four days of a corpus that said the opposite of what the
 * product did, and this was the mechanism underneath it.
 *
 * A corpus carries a screen twice: generated HTML for the page, and plain text for a packet, which
 * is what somebody is handed to build from. The text used to be hand-drawn ASCII, and `draw` did not
 * touch it. So regenerating a screen produced ONE FILE holding the new drawing beside a sketch of
 * the screen that had been deleted — "2 staged pricing edits" and a "Review and publish" button that
 * no longer existed, under a drawing that said nothing on the screen was editable.
 *
 * Neither reading was marked as current, and the beautiful one was the wrong one. That is the whole
 * failure mode this repo keeps hitting: a hand-authored artefact cannot be re-derived, so it is
 * wrong the day after it is written and nothing says so.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { drawFromRoute, asText } from "../dist/v2/draw.js";
import { loadCorpus } from "../dist/v2/load.js";

const CLI = path.resolve("dist/cli/index.js");

function fixture(componentSource) {
  const root = temp("productos-sketch-");
  const dir = path.join(root, "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.mkdirSync(path.join(root, "productos"), { recursive: true });
  fs.writeFileSync(path.join(root, "productos", "config.yaml"), "web: {}\n");
  const comp = path.join(root, "app", "TheScreen.tsx");
  fs.mkdirSync(path.dirname(comp), { recursive: true });
  fs.writeFileSync(comp, componentSource);
  const entry = loadCorpus(dir).scopes.find((s) => s.scope.views.length > 0);
  assert.ok(entry, "the seed has no screen, so this proves nothing");
  return { root, dir, comp, scope: entry.scope.id, view: entry.scope.views[0].id, file: entry.file };
}

const SIMPLE = `
export function TheScreen() {
  return (
    <div>
      <h2 className="t">Sizing Results</h2>
      <p>These are the figures the model produced.</p>
      <button type="button">Show workings</button>
    </div>
  )
}
`;

test("draw writes both renderings, and they describe the same screen", () => {
  const f = fixture(SIMPLE);
  execFileSync("node", [CLI, "v2", "draw", `${f.scope}#${f.view}`, "--route", f.comp, "--into", f.dir], {
    cwd: f.root,
    stdio: "pipe",
  });
  const v = loadCorpus(f.dir).scopes.find((s) => s.scope.id === f.scope).scope.views.find((x) => x.id === f.view);
  assert.ok(v.sketch, "no plain-text rendering was written — a packet has nothing to show");
  assert.ok(v.sketch_html, "no HTML rendering was written");
  for (const words of ["Sizing Results", "These are the figures the model produced"])
    assert.ok(v.sketch.includes(words), `the text rendering is missing "${words}"`);
  assert.match(v.sketch, /\[ Show workings \]/, "a button does not read as something you can press");
});

test("regenerating replaces a hand-typed sketch instead of leaving it underneath", () => {
  const f = fixture(SIMPLE);
  /**
   * ⛔ THE EXACT SHAPE THAT BURNED FOUR DAYS. A beautiful, hand-drawn, completely false sketch, in
   * the same file as a freshly generated drawing, with nothing saying which was current.
   */
  const text = fs.readFileSync(f.file, "utf-8");
  fs.writeFileSync(
    f.file,
    text.replace(
      `  - id: ${f.view}\n`,
      `  - id: ${f.view}\n    sketch: |\n      ┌──────────────────────────┐\n      │  2 staged pricing edits  │\n      │  [ Review and publish ]  │\n      └──────────────────────────┘\n`
    )
  );
  assert.match(fs.readFileSync(f.file, "utf-8"), /Review and publish/, "the fixture did not take");

  execFileSync("node", [CLI, "v2", "draw", `${f.scope}#${f.view}`, "--route", f.comp, "--into", f.dir], {
    cwd: f.root,
    stdio: "pipe",
  });
  const after = fs.readFileSync(f.file, "utf-8");
  assert.doesNotMatch(after, /Review and publish/, "the deleted screen survived a regeneration, which is the whole defect");
  assert.doesNotMatch(after, /staged pricing edits/);
  assert.match(after, /Sizing Results/, "and the real screen did not land");
});

test("an unresolved component keeps what is underneath it", () => {
  /**
   * ⛔ The first cut skipped everything under a placeholder, which read as tidy and dropped an
   * entire options grid — the one thing a builder most needs — to avoid a duplicate ellipsis.
   */
  const html = '<div class="productos-unknown" data-component="TableShell"><div>Figure</div><div>Loan amount</div></div>';
  const t = asText(html);
  assert.match(t, /«TableShell»/, "the unreadable component is not named");
  assert.match(t, /Figure/, "the table's contents were swallowed by its wrapper");
  assert.match(t, /Loan amount/);
});

test("a component marker does not say its own name twice", () => {
  const t = asText('<div class="productos-unknown" data-component="AlertTriangle">AlertTriangle</div>');
  assert.equal((t.match(/AlertTriangle/g) ?? []).length, 1, "the marker and its child both printed the name");
});

test("a placeholder keeps the expression it could not read", () => {
  /** ⛔ "…" alone tells a builder nothing about which part of the screen is a guess. */
  const t = asText('<span class="productos-unknown" title="rows.map((r) =&gt; r)">&hellip;</span>');
  assert.match(t, /rows\.map/, "the drawing hid what it could not read");
});

test("the text comes from the drawing, not from a second pass over the component", () => {
  const f = fixture(SIMPLE);
  const drawn = drawFromRoute(f.comp, { componentsDir: path.join(f.root, "app") });
  assert.equal(drawn.text, asText(drawn.html), "the two renderings are produced independently and can disagree");
});
