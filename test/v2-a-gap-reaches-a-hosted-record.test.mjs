/**
 * ⛔ `todo add --at <url>` RESOLVED THE URL AS A DIRECTORY.
 *
 *     No corpus at /Users/peter/personal/productos/http:/127.0.0.1:4100/p/prj-bks5f4m325
 *
 * Three roles working the hosted corpus hit this in one afternoon, each independently, and each did
 * the right thing with it: refused to file against ProductOS's own record instead, because that
 * puts a consumer corpus's findings in the wrong repository — the misfiling `--at` was added to
 * prevent. So each wrote the gap into a report, and `forced_into` — the field that makes a
 * compromise correctable in one pass instead of becoming the convention — was never recorded at all.
 *
 * ⛔ WHAT IS ASSERTED IS THAT THE RECORD ARRIVES THROUGH THE ONE DOOR, not that a function ran. A
 * fake instance serves `/api/v2/corpus` and records every `document` intent posted to `/api/v2/in`,
 * which is the contract `client.ts` speaks — so a regression that writes to a directory, or writes
 * nothing, fails here.
 *
 * ⛔ AND THE NUMBERING IS THE REASON IT GOES THROUGH `recordFrameworkGap` RATHER THAN THE WIRE. A
 * second implementation against the hosted record would be a second place for the id sequence and
 * the dedup to drift; the hosted record already holds 128 gaps, and a 129th that collides with one
 * of them is worse than an unfiled one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { temp } from "./support/temp.mjs";

const run = promisify(execFile);
const CLI = path.resolve("dist/cli/index.js");

const EXISTING = `# Framework gaps — TODOs for ProductOS's developers, not for this product.
version: 1
gaps:
  - id: fg-0001
    detected_at: 2026-09-01
    detector: authored
    what: something already recorded here
    evidence: []
    status: open
`;

/** An instance that answers `documents()` and remembers what `putDocument()` sends. */
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
        sent.push(JSON.parse(body || "{}"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    }
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}/p/prj-test`, sent, stop: () => new Promise((r) => server.close(r)) };
}

const WHAT =
  "a refusal outcome has no at/view_in/part of its own, so a refusal delivered on another feature's screen cannot say where it is read";
const FORCED = "publish-a-statement#statement-publish-modal#refuses: two cases with no part";
const COSTS = "you file the gap into a report nobody reads back, so it is rediscovered next session";

const inst = await fakeInstance({ "framework-gaps.yaml": EXISTING });
const work = temp("v2gapcwd-");
let out;
try {
  const r = await run("node", [CLI, "todo", "add", WHAT, "--costs", COSTS, "--forced-into", FORCED, "--at", inst.url], {
    encoding: "utf-8",
    cwd: work,
  });
  out = (r.stdout ?? "") + (r.stderr ?? "");
} catch (e) {
  out = ((e.stdout ?? "") + (e.stderr ?? "")).toString();
}
await inst.stop();

test("the gap is posted to the instance through the one door", () => {
  const docs = inst.sent.filter((s) => s.intent === "document");
  assert.ok(docs.length, `nothing was posted. output was:\n${out}`);
  const gaps = docs.find((d) => d.key === "framework-gaps.yaml");
  assert.ok(gaps, `the gap record was not sent — keys: ${docs.map((d) => d.key).join(", ")}`);
  assert.match(gaps.says, /a refusal outcome has no at/, "the gap's own words are not in what was sent");
  assert.match(gaps.says, /two cases with no part/, "forced_into was not sent — the correctable half");
});

test("it keeps what the hosted record already held, and numbers past it", () => {
  /** ⛔ A 129th gap that collides with an existing id is worse than an unfiled one. */
  const gaps = inst.sent.find((s) => s.key === "framework-gaps.yaml");
  assert.match(gaps.says, /something already recorded here/, "the existing gap was dropped");
  assert.match(gaps.says, /id: fg-0002/, "the new gap did not take the next id");
});

test("the gap record's url is never treated as a directory", () => {
  assert.doesNotMatch(out, /No corpus at/, `it still resolved the url as a path:\n${out}`);
  assert.doesNotMatch(out, /http:\/[^/]/, `a url was printed as a path:\n${out}`);
  assert.ok(!fs.existsSync(path.join(work, "http:")), "a directory named after the url was created");
});

test("it says where the gap landed", () => {
  assert.match(out, /Recorded fg-0002/, `it did not report what it recorded:\n${out}`);
  assert.ok(out.includes(inst.url), `it did not name the instance it recorded into:\n${out}`);
});

test("no corpus is left on this machine", () => {
  /** ⛔ One document for the length of one call. A writable local copy is the banned thing. */
  const left = fs.readdirSync(work);
  assert.deepEqual(left, [], `it left files behind: ${left.join(", ")}`);
});

/**
 * ⛔ AND IT CAN BE SETTLED THERE TOO, WHICH THE FIRST FIX LEFT OUT.
 *
 * `list` and `add` were taught the hosted route; `close` was not. So the first attempt to settle
 * one of the very gaps that fix made recordable threw an unhandled Error with a Node stack:
 *
 *     Error: No corpus at /Users/peter/…/http:/127.0.0.1:4100/p/prj-bks5f4m325
 *       at pathsAtCorpus (dist/core/paths.js:42:15)
 *
 * Half a fix, and the worse half to leave: a record that can be written and never settled is a
 * backlog that only grows, which is the one way this file is designed not to fail.
 */
test("a gap can be settled on the instance it was filed against", async () => {
  const held = {
    "framework-gaps.yaml": `version: 1
gaps:
  - id: fg-0001
    detected_at: 2026-09-01
    detector: authored
    what: something recorded here and since fixed
    evidence: []
    forced_into: "a corpus somewhere: the compromise that is now correctable"
    status: open
`,
  };
  const inst = await fakeInstance(held);
  const work = temp("v2gapclose-");
  let out;
  try {
    const r = await run("node", [CLI, "todo", "close", "fg-0001", "--resolution", "the model can say it now", "--at", inst.url], {
      encoding: "utf-8",
      cwd: work,
    });
    out = (r.stdout ?? "") + (r.stderr ?? "");
  } catch (e) {
    out = ((e.stdout ?? "") + (e.stderr ?? "")).toString();
  }
  await inst.stop();

  assert.doesNotMatch(out, /No corpus at/, `it still resolved the url as a path:\n${out}`);
  assert.doesNotMatch(out, /at pathsAtCorpus|node:internal/, `it threw instead of answering:\n${out}`);
  const sent = inst.sent.filter((s) => s.intent === "document").find((d) => d.key === "framework-gaps.yaml");
  assert.ok(sent, `the settled record was not sent back:\n${out}`);
  assert.match(sent.says, /status: closed/, "the gap was not marked closed in what was sent");
  assert.match(sent.says, /the model can say it now/, "the resolution was not recorded");
  /** ⛔ And it still says what is owed — `forced_into` is why closing a gap is not the end of it. */
  assert.match(out, /Still forced/, `it did not say what the closed gap left behind:\n${out}`);
});
