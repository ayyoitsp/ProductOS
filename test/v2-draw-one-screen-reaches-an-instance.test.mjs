/**
 * ⛔ ONE SCREEN, DRAWN STRAIGHT ONTO A HOSTED CORPUS — the half `--all` had and this did not.
 *
 * `drawEverythingOn` has written to an instance since the commit whose message quotes Peter asking
 * *"why aren't we operating this on 4100 where we're supposed to?"*. Naming ONE screen still went
 * through `path.resolve(o.into)`, which treats a URL as a relative path. So this:
 *
 *     v2 draw "deal-overview#a-deals-overview" --route page.tsx --into http://127.0.0.1:4100/p/prj-…
 *
 * read the checkout, inlined 76 components, drew 331kb, printed two green ticks, and then died with
 *
 *     ✗ no view "a-deals-overview" under "deal-overview" in
 *       /Users/peter/…/bilrost-workers/http:/127.0.0.1:4100/p/prj-bks5f4m325
 *
 * ⛔ AND `--dry-run` HAD REPORTED SUCCESS, which is the part that cost the time rather than the
 * crash. A dry run never writes, so the only step that could have refused the URL never ran, and
 * its output was indistinguishable from a supported command. The consequence downstream was worse
 * than a wasted minute: with no way to write one screen to the instance, the drawing was produced
 * in a mirror and transported by hand, and the view ended up with its states drawn and NO picture
 * of its own — so the page served 0 bytes for it and showed a wall of text. Peter: *"uh, what am i
 * looking at on deal overview? just a bunch of text? wtf?"*
 *
 * ⛔ WHAT IS ASSERTED IS THAT THE DOCUMENT ARRIVES THROUGH THE ONE DOOR, not that a function was
 * called. A fake instance serves `/api/v2/corpus` and records every `document` intent posted to
 * `/api/v2/in`, which is exactly the contract `client.ts` speaks — so a regression that writes
 * somewhere else, or writes nothing, fails here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { corpusFiles } = await import("../dist/v2/load.js");

/** A seed corpus as the store holds it, with one view to draw into. */
function heldCorpus() {
  const dir = path.join(temp("v2drawinst-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const name = fs
    .readdirSync(path.join(dir, "truth"))
    .filter((f) => f.endsWith(".md"))
    .find((f) => /^views:/m.test(fs.readFileSync(path.join(dir, "truth", f), "utf-8")));
  assert.ok(name, "no scope in the seed declares any views");
  const text = fs.readFileSync(path.join(dir, "truth", name), "utf-8");
  const scope = text.match(/^id:\s*(.+)$/m)[1].trim();
  const view = text.match(/^\s{2}-\s*id:\s*(.+)$/m)[1].trim();
  return { files: corpusFiles(dir), scope, view };
}

/** An instance that answers what `documents()` asks and remembers what `putDocument()` sends. */
async function fakeInstance(files) {
  const sent = [];
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.includes("/api/v2/corpus")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ dir: "held", files }));
    }
    if (req.method === "POST" && req.url.includes("/api/v2/in")) {
      let body = "";
      req.on("data", (c) => (body += c));
      return req.on("end", () => {
        const payload = JSON.parse(body || "{}");
        sent.push(payload);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    }
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/p/prj-test`;
  return { url, sent, stop: () => new Promise((r) => server.close(r)) };
}

/**
 * ⛔ ASYNC, AND THAT IS NOT A STYLE CHOICE. The first version used `execFileSync`, which BLOCKS
 * THE EVENT LOOP — so the fake instance in this same process could not accept the connection, and
 * the test hung for 30 seconds having served zero requests while the CLI waited for an answer
 * nobody was free to give. A server and a synchronous child cannot share a thread.
 */
const run = promisify(execFile);
async function draw(args, cwd) {
  try {
    const { stdout, stderr } = await run("node", [CLI, "v2", "draw", ...args], { encoding: "utf-8", cwd });
    return { code: 0, out: (stdout ?? "") + (stderr ?? "") };
  } catch (e) {
    return { code: e.code ?? 1, out: ((e.stdout ?? "") + (e.stderr ?? "")).toString() };
  }
}

const { files, scope, view } = heldCorpus();
const work = temp("v2drawcode-");
const route = path.join(work, "Screen.tsx");
fs.writeFileSync(
  route,
  `export default function Screen() {
     return <div className="wrap"><h1>A drawn heading</h1><button>Press me</button></div>;
   }`
);

const inst = await fakeInstance(files);
const ran = await draw([`${scope}#${view}`, "--route", route, "--into", inst.url], work);
await inst.stop();

test("the drawing is posted to the instance through the one door", () => {
  assert.equal(ran.code, 0, `draw failed:\n${ran.out}`);
  const docs = inst.sent.filter((s) => s.intent === "document");
  assert.ok(docs.length, `nothing was posted as a document. output was:\n${ran.out}`);
  /**
   * ⛔ TWO DOCUMENTS, AND WHICH ONE HOLDS THE PICTURE IS THE WHOLE POINT. The drawing is its own
   * document under `drawings/<scope>/<view>.html`; the truth document keeps provenance and parts.
   * Sending only the truth half is precisely what left a screen on the live instance with its
   * states drawn and no picture, serving 0 bytes to the page and reading as a wall of text.
   */
  const truth = docs.find((d) => d.key.startsWith("truth/"));
  assert.ok(truth, `no truth document sent — only ${docs.map((d) => d.key).join(", ")}`);
  const drawing = docs.find((d) => d.key === `drawings/${scope}/${view}.html`);
  assert.ok(
    drawing,
    `the picture was not sent as drawings/${scope}/${view}.html — only ${docs.map((d) => d.key).join(", ")}`
  );
  assert.match(drawing.says, /A drawn heading/, "the drawing sent is not the one built from the component");
  /**
   * ⛔ THE TRUTH DOCUMENT CARRIES IT TOO, and that is the design rather than a leak: `load.ts`
   * prefers the drawing FILE and keeps reading an inline one, so a corpus written before the split
   * still renders. What matters here is that BOTH halves reach the instance — sending only the
   * truth half is what left a live screen with its states drawn, no picture, and 0 bytes served.
   *
   * ⛔ `drawn_from` is deliberately not asserted: this fixture's component sits outside a git
   * repository, so there is no commit to record and the generator says so rather than inventing
   * one. Pinning it would pin the fixture, not the behaviour.
   */
  assert.match(truth.says, /A drawn heading/, "the truth document did not get the drawing either");
});

test("and the url is never treated as a directory", () => {
  /**
   * ⛔ THE EXACT FAILURE. `path.resolve` turned `http://host/p/x` into `<cwd>/http:/host/p/x`, so
   * the whole run was spent and then thrown away. Nothing on disk may be named after a url, and no
   * message may report one as a place.
   */
  assert.doesNotMatch(ran.out, /http:\/[^/]/, `a url was printed as a path:\n${ran.out}`);
  assert.ok(!fs.existsSync(path.join(work, "http:")), "a directory named after the url was created");
});

test("it says where the document went", () => {
  assert.match(ran.out, new RegExp(`written to ${inst.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});
