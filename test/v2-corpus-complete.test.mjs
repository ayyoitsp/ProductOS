/**
 * ⛔ `corpusFiles` AND `loadCorpus` MUST AGREE ON WHAT A CORPUS IS MADE OF.
 *
 * `load.ts` already states this: *"THE COUNTERPART OF `memoryStore`, AND THEY MUST STAY THAT WAY.
 * An instance reads a corpus with this and a remote client parses it with that, so a directory this
 * misses is a directory the remote copy silently does not have — and the two would disagree about
 * what the corpus says while both reported themselves healthy."*
 *
 * Nothing enforced it. `CORPUS_DIRS` lists six directories; `loadCorpus` also reads `steers/`, and
 * the incoming `access:` work reads `access.yaml` at the corpus ROOT, which is not a directory at
 * all. So both were invisible over `--at <url>` and — much worse — absent from the hosted store,
 * where the store IS the authority and a missed file is not a stale read but a deletion.
 *
 * ⛔ AND THE LIST IS DERIVED FROM THE CORPUS, NOT TYPED OUT HERE. A test naming the six things it
 * knows about is the same artefact as `CORPUS_DIRS` itself, and would miss the seventh for exactly
 * the same reason. So it enumerates whatever `loadCorpus` returned and requires the round trip to
 * reproduce all of it — a new kind of document is covered the day it is added, by nobody.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadCorpus, corpusFiles, memoryStore, CORPUS_DIRS } from "../dist/v2/load.js";

const CLI = path.resolve("dist/cli/index.js");

/**
 * A corpus with one of everything, including the kinds the seed does not carry.
 *
 * ⛔ The seed deliberately has no verdicts, no notes and no steers — so a test built only from it
 * would compare empty lists and pass while losing every one of them.
 */
function fullCorpus() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-complete-")), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

  fs.mkdirSync(path.join(dir, "steers"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "steers", "steers.yaml"),
    [
      "steers:",
      "  - id: prefers-plain-sentences",
      '    says: "Write a behaviour as one plain sentence somebody could disagree with."',
      "    steers: generation",
      '    learned_from: "four change records saying the same thing"',
      "    at: 2026-10-02",
      "",
    ].join("\n"),
  );

  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "notes", "notes.yaml"),
    [
      "notes:",
      "  - id: n-example",
      "    about: money",
      '    says: "this reads thin"',
      '    by: "ada@example.com"',
      "    at: 2026-10-02",
      "    via: page",
      "    state: open",
      "    kind: corpus",
      "",
    ].join("\n"),
  );

  /**
   * ⛔ AT THE ROOT, NOT IN A DIRECTORY. This is the shape the incoming `access:` work uses, and the
   * reason "which directories does a corpus consist of" is the wrong question to have asked.
   */
  fs.writeFileSync(
    path.join(dir, "access.yaml"),
    [
      "access:",
      "  - id: parent",
      "    kind: role",
      '    means: "Can see every child in the family and move money between them."',
      "    holds: [move-money]",
      "  - id: move-money",
      "    kind: permission",
      '    means: "Can move money from one balance to another."',
      "",
    ].join("\n"),
  );

  return dir;
}

/** Every list `loadCorpus` returns, by name, so nothing has to be enumerated by hand. */
const listsOf = (corpus) =>
  Object.fromEntries(Object.entries(corpus).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));

test("a corpus read off disk and read through corpusFiles are the same corpus", () => {
  const dir = fullCorpus();

  const local = loadCorpus(dir);
  /** Exactly what the remote client and the hosted store both do. */
  const wire = loadCorpus(dir, memoryStore(dir, corpusFiles(dir)));

  const mine = listsOf(local);
  const theirs = listsOf(wire);

  /** ⛔ Or the comparison is between two empty objects and proves nothing. */
  assert.ok(Object.keys(mine).length >= 7, `only ${Object.keys(mine).length} lists found on a Corpus`);
  const populated = Object.entries(mine).filter(([k, n]) => n > 0 && k !== "broken");
  assert.ok(populated.length >= 5, `the fixture only populated ${populated.length} kinds of document`);

  assert.deepEqual(
    theirs,
    mine,
    "corpusFiles lost something loadCorpus reads — a document the hosted store would never have",
  );
  assert.deepEqual(local.broken, wire.broken, "the wire lost or invented a parse failure");
});

test("every file loadCorpus reads is a file corpusFiles enumerates", () => {
  const dir = fullCorpus();
  const enumerated = new Set(Object.keys(corpusFiles(dir)));

  /**
   * ⛔ THE OTHER DIRECTION, AND THE ONE THAT CATCHES A ROOT-LEVEL FILE. Comparing parsed lists can
   * be satisfied by accident; this walks what is actually on disk and asks whether the enumeration
   * would carry it.
   */
  const onDisk = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel || "."), { withFileTypes: true })) {
      const next = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        walk(next);
      } else if (/\.(md|ya?ml)$/.test(entry.name)) {
        onDisk.push(next);
      }
    }
  };
  walk("");

  const missed = onDisk.filter((f) => !enumerated.has(f) && path.basename(f).toLowerCase() !== "readme.md");
  assert.deepEqual(
    missed,
    [],
    `these files are part of the corpus on disk and would not travel: ${missed.join(", ")}`,
  );
});

test("the event log is still not part of the corpus", () => {
  /**
   * ⛔ THE ONE THING THAT MUST STAY OUT. Widening what a corpus consists of is exactly how an event
   * log becomes a `documents` row, lands in markdown export and in a packet, and starts reading as
   * a claim about the product.
   */
  assert.ok(!CORPUS_DIRS.includes("events"), "the event log became part of the corpus");

  const dir = fullCorpus();
  fs.mkdirSync(path.join(dir, "events"), { recursive: true });
  fs.writeFileSync(path.join(dir, "events", "log.jsonl"), '{"kind":"note","says":"x"}\n');
  assert.ok(
    !Object.keys(corpusFiles(dir)).some((k) => k.startsWith("events/")),
    "the event log is being enumerated as a corpus document",
  );
});
