/**
 * ⛔ EVERY WRITE FROM A HOSTED PAGE WAS 404ING, INCLUDING FILING A NOTE.
 *
 * Peter, trying to add a dimension on the live instance: *"Not saved: Not Found"*.
 *
 * Measured against the running instance rather than reasoned about:
 *
 *     POST /p/prj-bks5f4m325/api/v2/in   422   <- the route, answering about the payload
 *     POST /api/v2/in                    404   <- what every handler on the page was posting to
 *
 * An instance serves a corpus under `/p/<project>/`, so a root-relative URL leaves the project
 * behind. There was no `<base>` tag, so this was true of **filing a note** and **recording an act**
 * as well — four call sites, silently wrong wherever the page is not served from the root. The
 * feature that exposed it was the newest one; the defect is as old as the hosted page.
 *
 * ⛔ WHY NOTHING CAUGHT IT. The browser tests replace `fetch` and assert on what the handler SENDS,
 * so a wrong URL is invisible to them — they would pass on `/nonsense`. `live-scripts-parse` checks
 * the script parses. `tsc` cannot see inside a template string. And the local stack serves at the
 * root, where the bug does not exist: every path anybody develops against is the one that works.
 *
 * So this asserts the URL itself, for both shapes of path, by reading the emitted script — which is
 * the only artefact that carries the answer.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

function page() {
  const dir = path.join(temp("v2door-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  return renderScopePage(c, c.scopes.find((e) => (e.scope.views ?? []).length)?.scope.id ?? c.scopes[0].scope.id, {
    interactive: true,
    records: "http",
    by: "peter",
  }) ?? "";
}

/** The live script, as the browser receives it. */
const liveScript = (html) => {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1]
  );
  const live = blocks.find((b) => b.includes("const API"));
  assert.ok(live, "the live script does not define the door, so this test is not about anything");
  return live;
};

/**
 * Evaluate the script's own definition of the door at a given page path.
 *
 * ⛔ THE SCRIPT'S OWN CODE, not a copy of the rule. A test that recomputed the prefix here would be
 * a second implementation agreeing with itself — the divergence this project has been bitten by
 * three times. The definition is extracted from the emitted script and run.
 */
function doorAt(html, pathname) {
  const src = liveScript(html);
  const def = /const API = \(function \(\) \{[\s\S]*?\}\)\(\);/.exec(src);
  assert.ok(def, "the door is no longer defined as one expression — this test cannot read it");
  const ctx = { location: { pathname }, out: null };
  vm.createContext(ctx);
  new vm.Script(def[0] + "\nout = API;").runInContext(ctx);
  return ctx.out;
}

test("⛔ the door is under the project when a project is in the path", () => {
  const html = page();
  assert.equal(doorAt(html, "/p/prj-bks5f4m325/v2"), "/p/prj-bks5f4m325/api/v2/in");
  assert.equal(doorAt(html, "/p/prj-bks5f4m325/v2/money"), "/p/prj-bks5f4m325/api/v2/in");
});

test("the door is at the root when the page is", () => {
  /** The local stack serves here, which is why the bug was invisible for as long as it was. */
  const html = page();
  assert.equal(doorAt(html, "/v2"), "/api/v2/in");
  assert.equal(doorAt(html, "/v2/money"), "/api/v2/in");
});

test("⛔ nothing posts to a hard-coded root path any more", () => {
  /**
   * The fix is only a fix if every call site uses it. There were four — the composer, two act
   * paths, and the selection handlers — and three of them were in the same file as the one that
   * failed, which is how this survived being noticed.
   */
  const src = liveScript(page());
  assert.doesNotMatch(src, /fetch\("\/api\/v2\/in"/, "a handler still posts to the root, ignoring the project");
  const uses = [...src.matchAll(/fetch\(API\b/g)].length;
  assert.ok(uses >= 4, `only ${uses} handlers use the door — one was left behind`);
});
