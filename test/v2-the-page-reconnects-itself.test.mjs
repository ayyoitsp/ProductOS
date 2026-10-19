/**
 * ⛔ THE PAGE DETECTED ITS OWN FAILURE, SAID SO TRUTHFULLY, AND COULD NOT UN-BREAK ITSELF.
 *
 * On 2026-10-13, 11:22 → 13:29, every read on the hosted instance 500'd. The page's banner said
 * exactly the right thing — *"Not following any more — nothing heard for N min"* — and then the
 * elapsed time climbed for hours with a working stream one reload away. Verified at the time by
 * opening a fresh stream by hand: beats 25s apart, exactly as designed. The server was fine. The
 * page's connection was dead and had no way back.
 *
 * ⛔ AND "EventSource RETRIES BY ITSELF" IS NOT TRUE OF WHAT HAPPENED, which is the part worth
 * keeping. Its automatic retry covers a DROPPED connection. A non-2xx response is a different
 * thing entirely: the spec says to FAIL the connection — readyState goes to CLOSED, `error` fires,
 * and the browser does not retry. So the FIRST 500 killed it permanently and the remaining two
 * hours of outage were irrelevant.
 *
 * ⛔ SO THIS TEST SERVES A 500 FIRST, not a dropped socket. A test that killed the connection
 * instead would pass on the unfixed page, because the browser would have reconnected on its own —
 * it would assert the one failure mode that was never broken.
 *
 * ⛔ AND IT RUNS IN A REAL BROWSER OVER HTTP. `EventSource`, `readyState`, `visibilitychange` and
 * the spec's retry rules are browser behaviour; jsdom implements none of it, and a `file://` page
 * cannot resolve `/api/v2/live` at all. Either substitute would pass over nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

/**
 * A server that behaves like the incident: the stream 500s until told to recover, and counts how
 * many times the page has tried.
 */
function incidentServer() {
  let healthy = false;
  let attempts = 0;
  const open = new Set();

  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/v2/live")) {
      attempts++;
      if (!healthy) {
        /** ⛔ A 500, which the spec makes FATAL to EventSource — the incident, not a dropped socket. */
        res.writeHead(500, { "content-type": "text/plain" }).end("down");
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write("retry: 2000\n\n");
      res.write(`event: beat\ndata: ${JSON.stringify(new Date().toISOString())}\n\n`);
      open.add(res);
      const beat = setInterval(() => {
        try {
          res.write(`event: beat\ndata: ${JSON.stringify(new Date().toISOString())}\n\n`);
        } catch {
          /* gone */
        }
      }, 300);
      res.on("close", () => {
        clearInterval(beat);
        open.delete(res);
      });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
  });

  return {
    server,
    recover: () => {
      healthy = true;
    },
    attempts: () => attempts,
    streams: () => open.size,
    stop: () => {
      for (const r of open) {
        try {
          r.end();
        } catch {
          /* gone */
        }
      }
      server.close();
    },
  };
}

/**
 * ⛔ THE PAGE'S OWN SCRIPT, LIFTED OUT OF `page.ts` — not a re-implementation.
 *
 * A hand-written copy of the reconnect logic would pass while the shipped page stayed broken, which
 * is the whole failure this is about. So the test extracts the real `FOLLOWS_THE_TRUTH` block from
 * a rendered page and runs that.
 */
const { renderScopePage } = await import("../dist/v2/page.js");
const { loadCorpus } = await import("../dist/v2/load.js");

let PAGE = "";

test("the page's live connection reopens after a 500 kills it", async (t) => {
  /**
   * ⛔ THE ANSWER WAS IGNORED, SO "NO BROWSER" FAILED THE TEST AND THEN HUNG THE FILE. `browserOrSkip`
   * returns what to do; it never skips on its own. Called for effect, a machine with no browser went
   * on to start the incident server, threw at `openPage`, and left the server listening until the
   * file timed out four minutes later.
   */
  const { skip } = browserOrSkip();
  if (skip) return t.skip(skip);

  const { execFileSync } = await import("node:child_process");
  const path = await import("node:path");
  const { temp } = await import("./support/temp.mjs");
  const dir = path.join(temp("v2recon-"), "v2");
  execFileSync("node", [path.resolve("dist/cli/index.js"), "v2", "reset", "--at", dir], { stdio: "pipe" });

  const corpus = loadCorpus(dir);
  const scope = corpus.scopes.find((s) => s.scope.exchanges.length)?.scope.id;
  assert.ok(scope, "the seed has no scope with exchanges to render");
  const html = renderScopePage(corpus, scope, { interactive: true });
  assert.ok(html, "the page did not render");
  /** ⛔ Non-vacuous: if the live script is absent there is nothing under test. */
  assert.match(html, /EventSource/, "the rendered page carries no live connection");
  PAGE = html;

  const inc = incidentServer();
  await new Promise((r) => inc.server.listen(0, "127.0.0.1", r));
  const port = inc.server.address().port;

  const page = await openPage(null, { url: `http://127.0.0.1:${port}/` });
  try {
    /** The first connection 500s, exactly as it did on the day. */
    await page.waitFor(`${JSON.stringify("x")} && true`, "the page to load");
    await page.waitFor("window.__tries === undefined || true", "the page to settle");

    /**
     * ⛔ IT KEEPS TRYING. On the unfixed page this is 1 forever: the first 500 set CLOSED and
     * nothing ever asked again. The assertion is "more than one attempt", not "it succeeded",
     * because at this point the server is still down and succeeding would be wrong.
     */
    const retried = await page
      .waitFor(`${"true"}`, "the page to be up")
      .then(async () => {
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          if (inc.attempts() > 1) return true;
          await new Promise((r) => setTimeout(r, 250));
        }
        return false;
      });
    assert.ok(
      retried,
      `the page tried the stream ${inc.attempts()} time(s) and gave up — a 500 is fatal to EventSource, so without an error handler it never asks again`
    );

    /** Now the server comes back, as it did at 13:29 — and the page must heal with no reload. */
    inc.recover();
    const healed = await (async () => {
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        if (inc.streams() > 0) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    })();
    assert.ok(healed, "the server recovered and the page never reconnected, so it still needs a human to reload it");

    /** ⛔ And exactly one stream, not a new one per retry — a leak would also satisfy "it healed". */
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(
      inc.streams(),
      1,
      `${inc.streams()} live streams open from one page — the reconnect is leaking a connection per attempt`
    );
  } finally {
    await page.close();
    inc.stop();
  }
});
