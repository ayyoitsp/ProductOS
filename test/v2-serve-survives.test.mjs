/**
 * ⛔ A BUILD THAT WILL NOT PARSE MUST NOT TAKE THE REVIEW SURFACE DOWN WITH IT.
 *
 * Three times in one session the server died on a rebuild and did not come back — each time on the
 * same defect, a backtick inside a template literal, which this repo has broken itself on
 * repeatedly. Hot reload spawned a replacement and exited immediately; the replacement could not
 * load, so the old one was gone and the new one never started. The port went dead mid-review and
 * nothing said why.
 *
 * Peter was looking at a page that would not load while I explained fixes to him. A stale page
 * somebody can read beats a dead port every time.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { loads } = await import(path.resolve("dist/core/hot-reload.js"));

test("a module that will not load is caught before the server hands over", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reload-"));

  const good = path.join(dir, "good.mjs");
  fs.writeFileSync(good, "export const x = 1;\n");
  assert.equal(loads(good).ok, true, "a perfectly good module was reported as broken");

  /** ⛔ The actual defect, not a stand-in: a template literal a stray backtick closed early. */
  const broken = path.join(dir, "broken.mjs");
  fs.writeFileSync(broken, "const s = `its `, position;\nexport default s;\n");
  const r = loads(broken);
  assert.equal(r.ok, false, "a module that cannot parse was reported as loadable");
  assert.match(r.why, /SyntaxError|Missing initializer/, `it must say what is wrong; got: ${r.why}`);

  /** ⛔ And a module that throws on load is just as fatal to a restart as one that will not parse. */
  const throws = path.join(dir, "throws.mjs");
  fs.writeFileSync(throws, "throw new Error('boom at import time');\n");
  assert.equal(loads(throws).ok, false, "a module that throws while loading was reported as fine");

  fs.rmSync(dir, { recursive: true, force: true });
});
