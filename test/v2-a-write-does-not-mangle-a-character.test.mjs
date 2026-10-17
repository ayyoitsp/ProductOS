/**
 * ⛔ THE WRITE PATH DESTROYED A CHARACTER THAT STRADDLED A CHUNK BOUNDARY, AND IT COST A CORPUS
 * SIXTY-FOUR FALSE REFUSALS BEFORE ANYBODY LOOKED AT THE BYTES.
 *
 * `readJson` accumulated the request body as a STRING:
 *
 *     let body = "";
 *     req.on("data", (d) => (body += d));
 *
 * `d` is a Buffer, so `+=` decodes it as UTF-8 ONCE PER CHUNK. A character whose bytes land either
 * side of a chunk boundary is therefore decoded as two invalid sequences, and every byte of it
 * becomes U+FFFD. A 4-byte emoji comes out as four replacement characters — which is exactly what
 * was found in `truth/review-the-rows.md` on the live corpus:
 *
 *     Sizing model ���� Excluded
 *
 * ⛔ AND IT WAS DIAGNOSED AS SOMETHING ELSE FIRST, WHICH IS THE EXPENSIVE PART. A demonstrator's
 * 64 requirements all read `a-requirement-older-than-its-claim` at once. The hash they were derived
 * against was real and the hash the corpus now computed was real; what nobody suspected was that
 * the SKETCH had changed under them. `view.sketch` feeds `claimHash`, so mangling one emoji moved
 * every claim hash in the scope. I theorised sentence drift and sent that role a recipe for a
 * problem it did not have; the role that found it went and read the bytes.
 *
 * ⛔ IT ONLY BITES LARGE DOCUMENTS, which is why no test and no hand-probe caught it. A small body
 * arrives in one chunk and survives perfectly — I posted emoji, astral-plane and CJK through the
 * live door and got them all back byte-identical. The corpus documents that carry drawings are
 * several hundred kilobytes, so they are the ones that split, and they are the ones holding the
 * product's pictures.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { temp } from "./support/temp.mjs";

const { v2Route } = await import("../dist/v2/serve.js");

function corpus() {
  const dir = path.join(temp("v2mangle-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/**
 * A request whose body arrives in chunks split at a byte offset we choose.
 *
 * ⛔ SPLIT DELIBERATELY MID-CHARACTER. A real socket splits wherever the kernel does, so a test
 * that sends one chunk is a test of the case that always worked. The whole defect lives at the
 * boundary, so the boundary is the fixture.
 */
function requestSplitAt(payload, at) {
  const bytes = Buffer.from(payload, "utf-8");
  const req = new EventEmitter();
  req.method = "POST";
  req.url = "/api/v2/in";
  req.headers = { "content-type": "application/json" };
  setImmediate(() => {
    req.emit("data", bytes.subarray(0, at));
    req.emit("data", bytes.subarray(at));
    req.emit("end");
  });
  return req;
}

function capture() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.body = "";
  res.writeHead = (s) => ((res.statusCode = s), res);
  res.write = (c) => ((res.body += c), true);
  res.end = (c) => ((res.body += c ?? ""), res);
  res.setHeader = () => res;
  return res;
}

/** The emoji sits at a known offset so the split can be aimed into the middle of it. */
const SAYS = `---\nid: money\ntitle: Pocket money 📊 for a family\nin: family-wallet\nexists: kept\n---\n\n# Pocket money\n`;
const PAYLOAD = JSON.stringify({ intent: "document", key: "truth/money.md", says: SAYS });

test("a character split across two chunks survives the write", async () => {
  const dir = corpus();
  /** ⛔ Aimed into the emoji's four bytes, not at a random offset. */
  const bytes = Buffer.from(PAYLOAD, "utf-8");
  const emojiAt = bytes.indexOf(Buffer.from("📊", "utf-8"));
  assert.ok(emojiAt > 0, "the fixture's payload has no multi-byte character to split");

  const res = capture();
  const handled = await v2Route(requestSplitAt(PAYLOAD, emojiAt + 2), res, "/api/v2/in", { dir });
  assert.ok(handled, "the door did not handle the write");
  assert.match(res.body, /"ok":\s*true/, `the write was refused: ${res.body.slice(0, 200)}`);

  const stored = fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8");
  assert.ok(!stored.includes("�"), `the stored document holds replacement characters: ${stored.slice(0, 120)}`);
  assert.match(stored, /Pocket money 📊 for a family/, "the character did not survive the round trip");
  assert.equal(stored, SAYS, "the document was not stored byte-for-byte");
});

test("and a body that arrives in one chunk still works", async () => {
  /** ⛔ The case that always passed. A fix that broke it would be worse than the bug. */
  const dir = corpus();
  const res = capture();
  await v2Route(requestSplitAt(PAYLOAD, Buffer.byteLength(PAYLOAD)), res, "/api/v2/in", { dir });
  assert.match(res.body, /"ok":\s*true/, `the write was refused: ${res.body.slice(0, 200)}`);
  assert.equal(fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8"), SAYS);
});

test("a split anywhere in the body is safe", async () => {
  /**
   * ⛔ Every offset, because the defect is positional and one lucky offset proves nothing. This is
   * the assertion that would have caught it on the day `readJson` was written.
   */
  const bytes = Buffer.from(PAYLOAD, "utf-8");
  /**
   * ⛔ EVERY offset, stepping by one. The first version of this stepped by 7, never landed inside
   * the emoji's four bytes, and passed against the defect — a loop that looks exhaustive and tests
   * the one case that was never broken.
   *
   * ⛔ One corpus, reused: the write replaces the document each time, and copying the seed 200
   * times is the only slow part of this file.
   */
  const dir = corpus();
  const bad = [];
  for (let at = 1; at < bytes.length; at++) {
    const res = capture();
    await v2Route(requestSplitAt(PAYLOAD, at), res, "/api/v2/in", { dir });
    if (fs.readFileSync(path.join(dir, "truth", "money.md"), "utf-8") !== SAYS) bad.push(at);
  }
  assert.deepEqual(bad, [], `splits at these byte offsets corrupted the document: ${bad.join(", ")}`);
});
