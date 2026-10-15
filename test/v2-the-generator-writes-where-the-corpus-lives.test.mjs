/**
 * ⛔ THE GENERATOR COULD ONLY WRITE TO A DIRECTORY, SO A HOSTED CORPUS HAD TWO WRITABLE COPIES.
 *
 * Peter: *"what is a 'disk file' anyways? why aren't we operating this on 4100 where we're supposed
 * to? what's going on?"* and then *"uh, duh? no idea why it wouldn't do that in the first place"*.
 *
 * There was no good reason. Drawing reads a CODEBASE — components for the mock, stylesheets for the
 * theme — which genuinely lives in a checkout. It writes TRUTH, which for a hosted product lives on
 * the instance. Those two were collapsed into one `--into <dir>`, so the loop was: draw into a
 * checkout, push the whole corpus at the instance, and lose anything authored there. On his corpus
 * the checkout held 51 documents and the instance 169 — the disk copy was a stale subset that won
 * every time.
 *
 * ⛔ `load.ts` HAD ALREADY SOLVED THIS AND THE WRITERS IGNORED IT. Its header: the filesystem is
 * *"STORAGE BEHIND THE API, not something a client knows about"* — one parser, two implementations
 * of "give me these bytes". `Pages` is that seam for the other direction, so there is one
 * line-surgery implementation and two places it can land.
 *
 * ⛔ WHAT IS PINNED IS THE SEAM, not one command's flags. The surgery has corrupted a corpus twice by
 * getting block bounds wrong, and it must behave identically whichever side it writes to — so the
 * same write is made through both and the results are compared.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { diskPages, heldPages, writeSketchHtml, writeWithin, writePrototypes } = await import(
  "../dist/v2/draw-write.js"
);
const { loadCorpus, memoryStore, corpusFiles, drawingRel } = await import("../dist/v2/load.js");

function corpus() {
  const dir = path.join(temp("v2pages-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

const aView = (dir) => {
  const c = loadCorpus(dir);
  const e = c.scopes.find((x) => (x.scope.views ?? []).length);
  return { scope: e.scope.id, view: e.scope.views[0].id };
};

test("⛔ the same drawing, written through a directory and through a held map, lands identically", () => {
  /**
   * The point of the seam: one implementation. If the two sides can differ, every defect found on
   * one is still live on the other — which is the two-copies problem moved into the writer.
   */
  const onDisk = corpus();
  const { scope, view } = aView(onDisk);

  const held = heldPages(corpusFiles(onDisk));
  const a = writeSketchHtml(diskPages(onDisk), scope, view, "<b>drawn</b>");
  const b = writeSketchHtml(held, scope, view, "<b>drawn</b>");
  assert.ok(a, "the directory write found no file");
  assert.ok(b, "the held write found no document");

  /** ⛔ Compared as CONTENT, since the keys differ by design: one absolute, one relative. */
  const fromDisk = fs.readFileSync(a, "utf-8");
  const fromHeld = held.read(b);
  assert.equal(fromHeld, fromDisk, "the two sides of the seam produced different bytes");

  /**
   * ⛔ AND THE DRAWING IS NOW ITS OWN FILE, so the seam has to agree about THAT too.
   *
   * It used to be enough to match the HTML inside the document. A screen's picture was 85% of
   * Bilrost's corpus — 14.8 MB of 17.5 — and inside a row it cannot be skipped, so every page view
   * and every save read all of it. It lives at `drawings/<scope>/<view>.html` now.
   *
   * ⛔ THE RISK THE SPLIT INTRODUCES IS EXACTLY WHAT THIS TEST IS FOR: two writes instead of one,
   * and a seam whose two sides could disagree about the second. A drawing that lands on disk and
   * not in the held map is a screen that is drawn locally and blank on the instance.
   */
  const rel = drawingRel(scope, view);
  assert.ok(fs.existsSync(path.join(onDisk, rel)), `the directory write left no ${rel}`);
  const drawnOnDisk = fs.readFileSync(path.join(onDisk, rel), "utf-8");
  const drawnHeld = held.read(held.keyFor(rel));
  assert.equal(drawnHeld, drawnOnDisk, "the two sides of the seam wrote different drawings");
  assert.match(drawnHeld, /<b>drawn<\/b>/, "the drawing did not reach its own file");

  /** ⛔ And it is NOT in the document any more, or the corpus carries it twice. */
  assert.doesNotMatch(fromHeld, /<b>drawn<\/b>/, "the drawing is still inside the document as well");
});

test("a held write records exactly what moved, and nothing else", () => {
  /**
   * ⛔ THIS IS WHAT MAKES THE INSTANCE PATH SAFE. Sending the whole corpus back is the overwrite the
   * change exists to end; sending only what the sweep touched leaves everything else as the instance
   * has it, including anything somebody authored there a minute ago.
   */
  const dir = corpus();
  const { scope, view } = aView(dir);
  const files = corpusFiles(dir);
  const held = heldPages(files);

  assert.deepEqual(held.moved(), [], "something had moved before anything was written");
  const wrote = writeSketchHtml(held, scope, view, "<b>one</b>");

  /**
   * ⛔ TWO THINGS MOVE NOW, AND BOTH MUST BE REPORTED. A screen's picture is its own file, so a
   * drawing write touches the document and `drawings/<scope>/<view>.html`.
   *
   * ⛔ THIS IS THE ASSERTION THAT WOULD HAVE CAUGHT SILENT DATA LOSS. `writeBack` sends the store
   * exactly what `moved()` reports — so a drawing written into the held map and NOT reported would
   * be drawn locally, never reach the instance, and leave every screen blank on the one surface
   * anybody reviews on. The old version of this test said "it reported more than the document it
   * changed", which is the right instinct and the wrong list once a drawing has its own file.
   */
  const drawing = held.keyFor(drawingRel(scope, view));
  assert.deepEqual(
    [...held.moved()].sort(),
    [wrote, drawing].sort(),
    "what moved is not exactly the document and its drawing"
  );
  assert.match(held.read(drawing), /<b>one<\/b>/, "the reported drawing key holds no drawing");

  /** ⛔ And the map it was given is untouched — the caller's copy is not mutated underneath it. */
  assert.ok(!files[wrote].includes("<b>one</b>"), "it wrote into the caller's own map");
  assert.ok(!(drawingRel(scope, view) in files), "it added the drawing to the caller's own map");
});

test("⛔ a held corpus loads, so the sweep reads the truth it is writing to", () => {
  /**
   * ⛔ THE BUG THIS CAUGHT ON ITS FIRST RUN. `loadCorpus(root)` builds `<root>/truth` and
   * `memoryStore(root, files)` strips `root` to get its keys — so passing the CODE directory as one
   * and "" as the other asked the map for an absolute path when it is keyed relative. Every lookup
   * missed, the corpus came back EMPTY, and the sweep silently drew only the v1 tree it found in the
   * checkout: 16 screens where the instance held 92. Nothing threw. A corpus of nothing is a valid
   * corpus.
   *
   * Found by two numbers that should have agreed, which is the only thing that could have found it.
   */
  const dir = corpus();
  const files = corpusFiles(dir);
  const fromDisk = loadCorpus(dir);
  const fromHeld = loadCorpus("", memoryStore("", files));

  assert.deepEqual(fromHeld.broken, [], "the held corpus would not parse");
  assert.ok(fromDisk.scopes.length > 0, "the seed has no scopes, so this test is about nothing");
  assert.equal(fromHeld.scopes.length, fromDisk.scopes.length, "the held corpus lost scopes");
  assert.equal(
    fromHeld.scopes.flatMap((e) => e.scope.views ?? []).length,
    fromDisk.scopes.flatMap((e) => e.scope.views ?? []).length,
    "the held corpus lost screens — which is what made the sweep draw a fraction of them"
  );
});

test("⛔ a writer that CREATES a document names it in the Pages' own terms", () => {
  /**
   * Editing finds its file by looking; creating has to name one, and that is where the two
   * implementations genuinely differ — a directory wants an absolute path and a store wants its own
   * key. Asking the caller to know which would put the filesystem back in its hands.
   */
  const dir = corpus();
  const held = heldPages(corpusFiles(dir));
  const onDisk = writePrototypes(diskPages(dir), [{ id: "a", title: "A", starts_at: "x#y" }]);
  const inHeld = writePrototypes(held, [{ id: "a", title: "A", starts_at: "x#y" }]);

  assert.equal(path.isAbsolute(onDisk), true, "the directory side did not produce a path");
  assert.equal(inHeld, "prototypes.yaml", "the held side did not produce a store key");
  assert.equal(held.read(inHeld), fs.readFileSync(onDisk, "utf-8"), "the two sides wrote different bytes");
});

test("⛔ the sweep offers both destinations, and a URL is not treated as a folder", () => {
  /**
   * The CLI wiring, because the capability is worth nothing if `--all` cannot reach it. `v2 forward`
   * already refuses a URL by name — pointed at one it would have written a corpus into `./https:/…`
   * — so the sweep has to branch rather than resolve a path.
   */
  const cli = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  assert.match(cli, /looksLikeInstance\(o\.into\)/, "the sweep does not notice an instance");
  assert.match(cli, /drawEverythingOn\(/, "there is no sweep that writes to an instance");
  assert.match(cli, /--code <dir>/, "there is no way to say which checkout the code is in");
  /** ⛔ And it writes back through the one door, not a route of its own. */
  assert.match(cli, /putDocument\(/, "the instance sweep does not go through the document intent");
});
