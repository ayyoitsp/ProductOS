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

const root = fs.mkdtempSync(path.join(os.tmpdir(), "productos-live-"));
const dir = path.join(root, "v2");
execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
const SCOPE = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;

test("a change made anywhere reaches a page somebody has open", async () => {
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
  await new Promise((r) => setTimeout(r, 500));

  // Somebody else changes the truth: a Claude session, another window, the CLI. Same corpus.
  execFileSync("node", [CLI, "v2", "notes", "add", "the page should hear about this",
    "--about", SCOPE, "--by", "tester", "--via", "chat", "--at", dir], { stdio: "pipe" });
  await new Promise((r) => setTimeout(r, 1200));

  const stream = got.join("");
  assert.match(stream, /event: changed/, `nobody told the open page. stream: ${JSON.stringify(stream)}`);
  assert.match(stream, /the page should hear about this/, "told, but not what changed");

  req.destroy();
  await new Promise((r) => server.close(r));
});

test("a served page listens; a standalone file does not pretend to", () => {
  const corpus = loadCorpus(dir);
  const served = renderScopePage(corpus, SCOPE, { interactive: true, records: "http" });
  for (const needed of ["/api/v2/live", "EventSource", "live-bar"])
    assert.ok(served.includes(needed), `a served page must carry ${needed}`);

  /**
   * ⛔ A standalone file has no server to ask, so listening there is a connection that can only
   * fail — and a live indicator that never lights reads as "nothing has changed", which is the
   * exact false reassurance this whole mechanism exists to remove.
   */
  const asFile = renderScopePage(corpus, SCOPE, { interactive: true, records: "mcp" });
  assert.ok(!asFile.includes("new EventSource"), "a page with no server must not try to listen");
});

test("it says what changed and waits, instead of reloading under somebody mid-sentence", () => {
  const src = fs.readFileSync("src/v2/page.ts", "utf-8");
  /**
   * ⛔ Losing what a person wrote is the one thing this surface must never do. A reviewer typing a
   * reason is the most expensive state on the page and the easiest to destroy with a reload.
   */
  assert.match(src, /typing\(\)/, "the live bar must check whether somebody is mid-sentence");
  assert.match(src, /if \(!typing\(\)\) show\(\)/, "it must not announce over somebody's typing");
  assert.match(src, /productos-at/, "'show it' must come back to where the reader was");
});
