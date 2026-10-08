/**
 * ⛔ A ROLE WRITING INTO A MIRROR LOSES ITS WORK, AND NOTHING SAID SO.
 *
 * Reading an instance works by mirroring its corpus into a scratch directory. `openAt`'s own note
 * has always said what that is — *"A MIRROR IS A CACHE OF A READ, NOT A WORKING COPY. It goes to a
 * scratch directory and is thrown away; nothing writes back into it"* — and `refuseUrl` refuses an
 * instance URL on every ProductOS write path.
 *
 * Neither protects the case that actually loses work. A ROLE is handed that directory and writes
 * into it with the host's own Write and Edit tools. ProductOS cannot intercept those: the role
 * succeeds, reports what it wrote, the scratch tree is reaped, and the work is gone with no error
 * anywhere. Peter asked for exactly this guard before the endpoint that would make the write real.
 *
 * ⛔ SO THE GUARD IS THE FILESYSTEM, NOT A CHECK. A check is something a writer has to call, and
 * the writer is somebody else's tool. Read-only permissions are enforced by the OS against every
 * writer there will ever be, and they fail loudly.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MIRROR_MARKER, isMirror, lockMirror } from "../dist/v2/client.js";
import { CORPUS_DIRS } from "../dist/v2/load.js";

/**
 * A directory with a corpus in it, put through the REAL guard.
 *
 * ⛔ THROUGH `lockMirror`, AND THE FIRST VERSION OF THIS TEST DID NOT. It built its own mirror and
 * chmod'd the fixture itself — so deleting the lock from `mirror()` left every assertion green. It
 * was asserting that `chmod` works, which nobody doubted.
 *
 * Reaching the real `mirror()` needs a running instance, and a guard that skips on every machine
 * without one is not a guard. So the mechanism is one exported function, this calls it, and the
 * last test holds `mirror()` to calling it.
 */
function likeAMirror() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mirrortest-")), "corpus");
  for (const sub of CORPUS_DIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "money.md"), "---\nid: money\ntitle: Money\n---\n");
  lockMirror(dir, "http://localhost:4100/p/example");
  return dir;
}

test("a mirror says what it is, in a file anything reading the directory will see", () => {
  const dir = likeAMirror();
  assert.ok(isMirror(dir), "a mirror cannot be told from a corpus");
  const said = fs.readFileSync(path.join(dir, MIRROR_MARKER), "utf-8");
  /** ⛔ It has to say DO NOT WRITE and where the truth is — a marker nobody can act on is a label. */
  assert.match(said, /mirror, not a corpus/i);

  /** And an ordinary corpus is not one, or the guard would refuse every real write. */
  const real = fs.mkdtempSync(path.join(os.tmpdir(), "realcorpus-"));
  fs.mkdirSync(path.join(real, "truth"), { recursive: true });
  assert.equal(isMirror(real), false, "a corpus somebody owns reads as a mirror");
});

/**
 * ⛔ THE ONE THAT MATTERS. This is the write a role makes — not through ProductOS, straight at the
 * file — and it has to fail.
 */
test("writing a document in a mirror fails loudly rather than succeeding and being thrown away", () => {
  const dir = likeAMirror();
  const doc = path.join(dir, "truth", "money.md");

  let code = null;
  try {
    fs.appendFileSync(doc, "\n# a role working here\n");
  } catch (e) {
    code = e.code;
  }
  assert.equal(code, "EACCES", "a role's write into a mirror succeeded, and that work would be lost silently");

  /** The same for a wholesale rewrite, which is what `Write` does rather than `Edit`. */
  code = null;
  try {
    fs.writeFileSync(doc, "replaced entirely");
  } catch (e) {
    code = e.code;
  }
  assert.equal(code, "EACCES", "overwriting a mirrored document succeeded");

  // ⛔ And it is still READABLE, because the whole purpose of a mirror is being read.
  assert.match(fs.readFileSync(doc, "utf-8"), /id: money/);
});

/**
 * ⛔ THE DIRECTORIES STAY WRITABLE ON PURPOSE. Locking them would stop the scratch tree being
 * cleaned up, and a mirror that cannot be reaped is a different bug — a disk filling with copies of
 * somebody's corpus.
 */
test("a mirror can still be cleaned up", () => {
  const dir = likeAMirror();
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  assert.equal(fs.existsSync(dir), false, "a mirror cannot be removed, so they accumulate");
});

/**
 * ⛔ THE MARKER IS NOT A CORPUS DOCUMENT, and this is the shape that has caught two concepts in
 * this repo already: `CORPUS_DIRS` decides what a corpus is made of, and a stray file landing in it
 * would reach markdown export and a packet.
 */
/**
 * ⛔ AND `mirror()` HAS TO CALL IT, which is the half the fixture cannot prove.
 *
 * Read off the source, for the reason `v2-steers-steer` reads the install adapter off the source:
 * doing it for real would need an instance, and the guarantee worth asserting is the shape that
 * makes it true — one call, at the end, after the files are written.
 */
test("the function that reads an instance locks what it mirrored", () => {
  const src = fs.readFileSync("src/v2/client.ts", "utf-8");
  const fn = src.slice(src.indexOf("export async function mirror"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /lockMirror\(dir, i\.url\)/, "mirror() no longer locks what it read — a role's write there is lost silently");
  /** ⛔ After the writes, or it locks an empty directory and the documents land writable. */
  assert.ok(
    body.indexOf("writeFileSync") < body.indexOf("lockMirror"),
    "mirror() locks before writing the documents, so they end up writable"
  );
});

test("the marker is not something the corpus loader reads", () => {
  assert.ok(!CORPUS_DIRS.includes(MIRROR_MARKER), "the marker is being treated as a corpus directory");
  assert.ok(MIRROR_MARKER.endsWith(".md"), "it should read as prose to whoever opens it");
  /** It sits at the root rather than inside `truth/`, so no scope loader ever parses it. */
  assert.ok(!MIRROR_MARKER.includes("/"), "the marker is inside a corpus directory, where a loader will try to parse it");
});
