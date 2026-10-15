/**
 * ⛔ FIVE OF ANOTHER SESSION'S WRITE-PATH PROBES TOLD PETER SIX PEOPLE WERE WAITING ON HIM.
 *
 * Peter, at the banner: *"and what are those 6 requests, i did not send any requests"*. He had not.
 * `staleness-probe-231153`, `concurrent-probe-005057`, `fingerprint-probe-011554`,
 * `fingerprint-probe2-011604` and `split-probe-172049` were written by a session investigating a
 * hung write path, and rendered on his review surface as five people asking him for changes.
 *
 * ⛔ AND THE QUEUE WAS THE ONLY WRITABLE THING TO PROBE, so the pollution is the model's fault and
 * not that session's: a probe had no way to say what it was.
 *
 * Second half, same press: *"and we should have a history available of requests that were
 * answered..."*. There was one, in the data — a closed note keeps `state: done` and its `outcome`.
 * The page filtered acknowledgements to `kind === "framework"`, and every request Peter has ever
 * filed is `kind: corpus`, so he had four answered requests and the surface showed him none.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { fileNote } = await import(path.resolve("dist/v2/notes.js"));

const seeded = () => {
  const dir = path.join(temp("queue-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
};

test("a probe is not a request anybody is waiting on", () => {
  const dir = seeded();
  fileNote(dir, { about: "money", says: "a real person asking for something", by: "peter", via: "page", at: "2026-10-15" });
  fileNote(dir, { about: "money", says: "staleness-probe-231153", by: "deploy-session", via: "cli", at: "2026-10-15", probe: true });

  const notes = loadCorpus(dir).notes;
  /** ⛔ The non-zero first: both were really written. A probe that is not stored probes nothing. */
  assert.equal(notes.length, 2, "the probe was not written at all, so it exercised no write path");
  assert.equal(notes.filter((n) => n.probe).length, 1);
  /** And the thing a person is told is one, not two. */
  assert.equal(notes.filter((n) => n.state === "open" && !n.probe).length, 1, "⛔ the probe counts as somebody waiting");
});

test("a probe is only ever a probe where somebody said so", () => {
  /**
   * ⛔ INFERRING ONE WOULD DISCARD A REQUEST. "It looks like a test" applied to a person's words is
   * how a real ask disappears — and the words here were `staleness-probe-231153`, which a classifier
   * would be right about and still must not be trusted to decide.
   */
  const dir = seeded();
  fileNote(dir, { about: "money", says: "fingerprint-probe-011554", by: "peter", via: "page", at: "2026-10-15" });
  const n = loadCorpus(dir).notes.at(-1);
  assert.notEqual(n.probe, true, "a note was treated as a probe because of how it reads");
});

test("the answered history carries every kind, not just the framework ones", () => {
  const dir = seeded();
  /** ⛔ `fileNote` returns `{ok, note}` — `a.id` is undefined and the close then silently no-ops. */
  const a = fileNote(dir, { about: "money", says: "pricing should sit beside the rent roll", by: "peter", via: "page", at: "2026-10-15" });
  assert.ok(a.ok, "the fixture note was not filed");
  execFileSync("node", [CLI, "v2", "notes", "done", a.note.id, "--at", dir, "--outcome", "moved it beside the rent roll"], { stdio: "pipe" });

  const done = loadCorpus(dir).notes.filter((n) => n.state === "done");
  assert.equal(done.length, 1, "the answered request was not recorded as answered");
  assert.equal(done[0].kind ?? "corpus", "corpus", "the fixture is not exercising the kind that was being dropped");
  assert.match(done[0].outcome, /moved it beside the rent roll/, "the outcome is not kept, so the history says nothing was done");
});

test("the page's acknowledgements no longer filter on framework, and no longer cap", () => {
  /**
   * ⛔ ASSERTED OVER THE SOURCE, because the filter is inlined JS inside the page and the defect was
   * one clause in it. Rendering nine answered notes in a browser to count eight would be a slower
   * way to read the same line.
   */
  const src = fs.readFileSync(path.resolve("src/v2/page.ts"), "utf-8");
  const at = src.indexOf("lastAcks = (b.notes || [])");
  const block = src.slice(at, src.indexOf("paintAcks(lastAcks)", at));
  assert.doesNotMatch(block, /kind === "framework"/, "⛔ answered corpus requests are still invisible");
  assert.doesNotMatch(block, /slice\(-8\)/, "the history still silently forgets the ninth answer");
  assert.match(block, /state === "done"/, "it no longer selects answered notes at all");
});
