/**
 * ⛔ THE PAGE FOLLOWS THE TRUTH — the property that makes this ONE interface rather than three.
 *
 * Peter: "there's still no 'single interface' to go through ProductOS. that's the root ask here."
 *
 * Reading a feature, deciding it, and authoring the consequence happened in three places, and the
 * seam a person actually felt was the reload: the truth changed underneath and the page went on
 * showing the old one until somebody went and checked. So the corpus pushes.
 *
 * This is pinned end to end over a real socket, because a page that has silently stopped following
 * is indistinguishable from one that never did — and the reader cannot tell which they are holding.
 */
import { test } from "node:test";
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";

const CLI = path.resolve("dist/cli/index.js");
const { v2Route } = await import(path.resolve("dist/v2/serve.js"));
const { renderScopePage } = await import(path.resolve("dist/v2/page.js"));
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
import { arrives } from "./support/settle.mjs";

const root = temp("productos-live-");
const dir = path.join(root, "v2");
execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
const SCOPE = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;

test("a change made anywhere reaches a page somebody has open", async (t) => {
  const server = http.createServer(async (req, res) => {
    if (await v2Route(req, res, new URL(req.url, "http://x").pathname, { dir })) return;
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const got = [];
  const req = http.get({ port, path: "/api/v2/live" }, (res) => {
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /event-stream/);
    res.on("data", (c) => got.push(c.toString()));
  });

  /**
   * ⛔ REGISTERED BEFORE ANYTHING CAN THROW, AND THAT IS THE WHOLE FIX.
   *
   * `req.destroy()` and `server.close()` used to be the last two lines of the body. An SSE request
   * is a connection held open BY DESIGN and a listening server holds the event loop — so a failed
   * assertion skipped both and the process hung forever instead of failing. A hang reports nothing
   * through `suite-now`, which captures output: four gate attempts, zero bytes, no test named, and
   * it took isolating the suite file by file to find which one. `v2-deploy-gate` records the cost.
   *
   * ⛔ The order matters: the connection first, then the server. Closing a server with a live
   * request on it waits for the request.
   */
  t.after(async () => {
    req.destroy();
    await new Promise((r) => server.close(r));
  });

  /** ⛔ Waited for, not slept through — the stream has to be open before anything is announced. */
  await arrives(() => got.length > 0 || req.destroyed, "the stream to open");

  // Somebody else changes the truth: a Claude session, another window, the CLI. Same corpus.
  execFileSync("node", [CLI, "v2", "notes", "add", "the page should hear about this",
    "--about", SCOPE, "--by", "tester", "--via", "chat", "--at", dir], { stdio: "pipe" });

  /**
   * ⛔ THE CONDITION, NOT 1200ms. Under load the announcement had not arrived inside the sleep, the
   * assertion below failed, and the failure became a hang. This returns the moment it arrives —
   * faster on a quiet machine and correct on a busy one.
   */
  await arrives(() => got.join("").includes("event: changed"), "the open page to be told");

  const stream = got.join("");
  assert.match(stream, /event: changed/, `nobody told the open page. stream: ${JSON.stringify(stream)}`);
  assert.match(stream, /the page should hear about this/, "told, but not what changed");
});

test("a served page listens; a standalone file does not pretend to", () => {
  const corpus = loadCorpus(dir);
  const served = renderScopePage(corpus, SCOPE, { interactive: true, records: "http" });
  /** ⛔ No `live-bar` any more — the page updates instead of announcing that it should. */
  for (const needed of ["/api/v2/live", "EventSource", "location.reload()"])
    assert.ok(served.includes(needed), `a served page must carry ${needed}`);

  /**
   * ⛔ A standalone file has no server to ask, so listening there is a connection that can only
   * fail — and a live indicator that never lights reads as "nothing has changed", which is the
   * exact false reassurance this whole mechanism exists to remove.
   */
  const asFile = renderScopePage(corpus, SCOPE, { interactive: true, records: "mcp" });
  assert.ok(!asFile.includes("new EventSource"), "a page with no server must not try to listen");
});

/**
 * ⛔ IT UPDATES, AND IT STILL NEVER LOSES WORDS — and this test used to assert the opposite.
 *
 * It pinned "say what changed and wait", which was right until Peter looked at it: *"6 changes to
 * the truth under this page {show it} - unnecessary, just live update as we go..."* A bar whose only
 * possible answer is "yes, show me the correct page" is a question not worth asking.
 *
 * ⛔ What the old test was really protecting is kept, and strengthened: losing what a person wrote
 * is the one thing this surface must never do, and the guard now looks at every open form rather
 * than only at what is focused. A reason typed and then clicked away from is still a reason.
 */
test("the page updates itself, without reloading over words somebody has typed", () => {
  const src = fs.readFileSync("src/v2/page.ts", "utf-8");
  assert.match(src, /if \(!unsent\(\)\) apply\(\)/, "a change is applied without checking for unsent words");
  assert.match(src, /form\.act-form input, form\.act-form textarea/,
    "the guard reads only what is focused, so a half-written reason clicked away from would be destroyed");
  assert.match(src, /if \(pending && !unsent\(\)\) apply\(\)/,
    "a change held back while typing is never applied — the page can sit stale and silent, which is the failure this whole mechanism exists to remove");
  assert.match(src, /productos-at/, "a reload must come back to where the reader was — more so now that nobody asked for it");
  /** ⛔ And no bar, because two mechanisms for one job is how the dismissable one wins. */
  assert.ok(!/class = "live-bar"|className = "live-bar"/.test(src), "the bar is back alongside the live update");
});

