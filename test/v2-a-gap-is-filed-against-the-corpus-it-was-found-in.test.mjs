import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

function run(args, cwd) {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf-8" });
}

/** A repo with its own gap record, and a corpus living somewhere else entirely. */
function twoPlaces() {
  const tmp = temp("pos-gap-");
  const repo = path.join(tmp, "some-other-product");
  fs.mkdirSync(path.join(repo, "productos"), { recursive: true });
  fs.writeFileSync(path.join(repo, "productos", "config.yaml"), "name: some-other-product\n");
  const corpus = path.join(tmp, "the-corpus-being-authored");
  fs.mkdirSync(path.join(corpus, "truth"), { recursive: true });
  return { tmp, repo, corpus };
}

const gapsIn = (dir) => {
  const f = path.join(dir, "framework-gaps.yaml");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : "";
};

test("a gap found while authoring a corpus is filed against that corpus, not the repo cwd happens to be in", () => {
  const { repo, corpus } = twoPlaces();

  // Standing in one product's repo, authoring another product's corpus — the exact shape
  // that put 33 gaps in the wrong record.
  const out = run(
    ["todo", "add", "a slot cannot carry its own standing", "--at", corpus, "--forced-into", "a-scope#a-view"],
    repo
  );

  assert.match(gapsIn(corpus), /a slot cannot carry its own standing/,
    "the gap did not reach the corpus it was found in");
  assert.equal(gapsIn(path.join(repo, "productos")), "",
    "⛔ it was filed against the repo cwd was standing in — the defect this pins");
  assert.match(out, /framework-gaps\.yaml/,
    "`add` must name the file it wrote to; a silent tick is how 33 misfilings went unnoticed");
});

test("without --at it still files against the repo, so v1 corpora are untouched", () => {
  const { repo } = twoPlaces();
  run(["todo", "add", "something the model cannot express here"], repo);
  assert.match(gapsIn(path.join(repo, "productos")), /something the model cannot express here/);
});

test("--at reads back only that corpus's gaps", () => {
  const { repo, corpus } = twoPlaces();
  run(["todo", "add", "a gap belonging to the corpus", "--at", corpus], repo);
  run(["todo", "add", "a gap belonging to the repo itself"], repo);

  const atCorpus = run(["todo", "--at", corpus], repo);
  assert.match(atCorpus, /a gap belonging to the corpus/);
  assert.doesNotMatch(atCorpus, /a gap belonging to the repo itself/,
    "two products' backlogs read as one");
});

test("--at on a directory that is not there says so, rather than inventing a record", () => {
  const { repo, tmp } = twoPlaces();
  assert.throws(
    () => run(["todo", "add", "a gap with nowhere to go", "--at", path.join(tmp, "absent")], repo),
    /No corpus at/
  );
});

test("a gap can be settled in the corpus it lives in", () => {
  const { repo, corpus } = twoPlaces();
  run(["todo", "add", "a gap that gets closed later", "--at", corpus], repo);
  const out = run(["todo", "close", "fg-0001", "--resolution", "the field shipped", "--at", corpus], repo);
  assert.match(out, /closed/);
  assert.match(gapsIn(corpus), /status: closed/,
    "⛔ close without --at would have walked up to the repo and refused an id it cannot see");
});
