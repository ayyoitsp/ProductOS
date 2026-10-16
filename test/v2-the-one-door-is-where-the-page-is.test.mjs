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
  const live = blocks.find((b) => b.includes("const UNDER"));
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
  /**
   * ⛔ THE PREFIX AND THE DOOR, both read out of the script. They were one expression until the
   * prefix had to serve seven urls instead of one; a test that kept reading the old shape would have
   * reported the fix as a regression, which is the matcher-too-narrow failure four times over
   * between the two sessions today.
   */
  const under = /const UNDER = \(function \(\) \{[\s\S]*?\}\)\(\);/.exec(src);
  const door = /const API = UNDER \+ "[^"]+";/.exec(src);
  assert.ok(under, "the page no longer derives a prefix — this test cannot read it");
  assert.ok(door, "the door is no longer built from the prefix");
  const ctx = { location: { pathname }, out: null };
  vm.createContext(ctx);
  new vm.Script(under[0] + "\n" + door[0] + "\nout = API;").runInContext(ctx);
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

test("⛔ NOTHING the page reaches for is root-relative, and every site is built from the prefix", () => {
  /**
   * ⛔ MY FIRST FIX REACHED FOUR CALL SITES AND THERE WERE SEVEN.
   *
   * The deploying session built a probe that takes the urls the page's own script NAMES and resolves
   * each the way a browser will. Three were still root-relative:
   *
   *     /api/v2/thread     404 at the origin, 200 under the project
   *     /api/v2/presence   404                200
   *     /api/v2/live       404                200
   *
   * So the acknowledgement thread never loaded on a hosted page, presence never loaded, and the live
   * connection never opened — the two-way window, dead, and it had been.
   *
   * ⛔ AND THE POST PROBE I HAD SUGGESTED WOULD HAVE MISSED ALL THREE. Two are GETs and one is an
   * EventSource. The thing to enumerate is the URLS, not the verb — which is why this asserts on
   * every string the script hands to fetch, EventSource or WebSocket rather than on the door alone.
   *
   * ⛔ IT IS A PROPERTY OF THE SCRIPT, not a list maintained here. A new endpoint added
   * root-relative fails this without anybody remembering to add it.
   */
  const src = liveScript(page());
  const reaches = [
    ...src.matchAll(/(?:fetch|new EventSource|new WebSocket)\(\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  const rooted = reaches.filter((u) => u.startsWith("/"));
  assert.deepEqual(
    rooted,
    [],
    `these leave the project behind when the page is served under one:\n  ${rooted.join("\n  ")}`
  );

  /**
   * ⛔ AND EVERY SITE IS CHECKED FOR ITS SHAPE, RATHER THAN THE SITES BEING COUNTED.
   *
   * This asserted a floor of seven, which is a number that was true on the day it was written and
   * says nothing about any other day. Routing one of the seven through the shared sender — three of
   * them built their own request and their own error message, which is the defect that fix was for —
   * left six, and a correct change failed a test whose subject was something else entirely.
   *
   * A count cannot tell "one was consolidated" from "one was left behind". The shape of each site
   * can: every request the script makes is built from the prefix or from a variable that was, and a
   * new endpoint written root-relative fails this without anybody maintaining a number.
   */
  const sites = [...src.matchAll(/(?:fetch|new EventSource|new WebSocket)\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  assert.ok(sites.length, "the script makes no requests at all, so this proves nothing");
  /**
   * ⛔ AND RE-REQUESTING THE PAGE ITSELF IS ALLOWED, because `location.pathname` IS where the page
   * is — that is the thing the prefix is derived from. Rejecting it would have been this check
   * failing a site that cannot be wrong, which is the other way a guard costs a session its time.
   */
  const wrong = sites.filter(
    (a) => !(a === "API" || a.startsWith("UNDER +") || a.startsWith("location.") || /^[A-Za-z_$][\w$]*$/.test(a))
  );
  assert.deepEqual(wrong, [], `these are not built from the prefix:\n  ${wrong.join("\n  ")}`);
});
