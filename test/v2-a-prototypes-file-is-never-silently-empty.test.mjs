/**
 * ⛔ A FILE SOMEBODY WROTE, THROWN AWAY WITHOUT A WORD.
 *
 * The deploying session wrote a `prototypes.yaml` to a shape I had described badly in prose — a
 * `set:` key instead of `prototypes:` — and `loadCorpus` returned **zero prototypes and zero
 * errors**. So a malformed file was indistinguishable from a corpus that simply had none, and they
 * lost a round of work proving a fixture that had never loaded.
 *
 * Their words: *"the silence is its own defect — a `prototypes.yaml` whose top-level key is not
 * `prototypes:` loads as empty rather than refusing, so my fixture looked like a corpus with no
 * prototypes instead of a malformed file."*
 *
 * Three silent paths in one loop, and `broken` is the channel every sibling loader already used:
 *
 *   1. the wrong top-level key — `if (raw.prototypes)` with no `else`
 *   2. a parse error — the only loader here that discarded its own exceptions
 *   3. `fs.readFileSync` instead of the store's reader, so on any store that is not a directory
 *      every prototype vanishes into (1)'s silence
 *
 * ⛔ AND AN EMPTY FILE MUST STAY SILENT. A stub nobody has filled in is not a mistake, and a
 * detector that cannot tell a stub from a typo would be reported against every half-started corpus
 * until people stopped reading it.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const { loadCorpus, memoryStore, corpusFiles } = await import("../dist/v2/load.js");

function corpus(prototypesYaml) {
  const dir = path.join(temp("v2protoload-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  if (prototypesYaml !== undefined) fs.writeFileSync(path.join(dir, "prototypes.yaml"), prototypesYaml);
  return dir;
}

const about = (c) => c.broken.filter((b) => /prototypes\.ya?ml$/.test(b.file));

test("the wrong top-level key is reported, not silently dropped", () => {
  const c = loadCorpus(corpus("set:\n  - id: cre\n    title: CRE\n    starts_at: money#balance\n"));
  assert.equal(c.prototypes.length, 0, "it somehow read prototypes out of the wrong key");
  const said = about(c);
  assert.equal(said.length, 1, "a file with no `prototypes:` key loaded as empty and said nothing");
  assert.match(said[0].why, /no `prototypes:` at the top level/);
  /** ⛔ It names what it DID find, so somebody can see their own typo rather than guess at it. */
  assert.match(said[0].why, /`set`/);
});

test("a parse error is reported, not swallowed", () => {
  const c = loadCorpus(corpus("prototypes:\n  - id: cre\n   title: bad indent\n"));
  assert.equal(about(c).length, 1, "an unparseable prototypes file loaded in silence");
});

test("a schema violation is reported", () => {
  /** A prototype with no `starts_at` is not a door. It used to vanish along with the whole file. */
  const c = loadCorpus(corpus("prototypes:\n  - id: cre\n    title: CRE\n"));
  assert.equal(about(c).length, 1, "a prototype missing its front door loaded in silence");
});

test("⛔ an empty file stays silent — a stub is not a mistake", () => {
  for (const empty of ["", "\n", "# nothing yet\n"]) {
    const c = loadCorpus(corpus(empty));
    assert.deepEqual(about(c), [], `an empty prototypes file was reported (${JSON.stringify(empty)})`);
  }
});

test("a good file still loads, and is not reported", () => {
  const c = loadCorpus(
    corpus("splits_on: Which role is this for?\nprototypes:\n  - id: cre\n    title: CRE\n    starts_at: money#balance\n    is: processor\n")
  );
  assert.deepEqual(about(c), []);
  assert.equal(c.prototypes.length, 1);
  assert.equal(c.splitsOn, "Which role is this for?");
  assert.equal(c.prototypes[0].is, "processor");
});

test("⛔ it reads through the store, so a corpus that is not a directory still has its prototypes", () => {
  /**
   * This loop reached for `fs.readFileSync` while every other read here goes through `store.read` —
   * the whole reason a corpus on an instance and a corpus in a directory are parsed by one loader.
   * On a store that is not a directory it threw ENOENT into the silent catch, so a product's
   * prototypes did not exist: no finding, no message, an empty selection that looks exactly like a
   * corpus that never declared one.
   *
   * ⛔ It was not broken in production — the hosted instance materialises the corpus, and the live
   * page showed both prototypes when I checked. That is not a defence: it put the failure one
   * deployment decision away, and invisible when it arrived.
   */
  const dir = corpus(
    "splits_on: Which role is this for?\nprototypes:\n  - id: cre\n    title: CRE\n    starts_at: money#balance\n"
  );
  const files = corpusFiles(dir);
  assert.ok(
    Object.keys(files).some((f) => /prototypes\.ya?ml$/.test(f)),
    "the prototypes file is not among the files a corpus travels with, so nothing below is about the loader"
  );

  /** The same corpus with NO filesystem behind it — which is what an instance is. */
  const inMemory = loadCorpus(dir, memoryStore(dir, files));
  assert.equal(inMemory.prototypes.length, 1, "prototypes vanished when the corpus was not a directory");
  assert.equal(inMemory.splitsOn, "Which role is this for?");
  assert.deepEqual(about(inMemory), []);
});
