/**
 * ⛔ 129 OF 208 FILES DISCARDED IN SILENCE, AND `loadCorpus` REPORTED ZERO BROKEN.
 *
 * Every file-level collection read `raw.<key> ?? []`. A file holding a single bare object — the
 * entry's own fields at the top level, which is what an author writes when they follow the example
 * rather than the schema — produced an empty list, looped zero times, and pushed nothing to
 * `broken`. A file saying nothing the loader understood was indistinguishable from a file saying
 * nothing at all.
 *
 * Found mid-index on a real corpus by an author who noticed its own evidence was missing. Twenty-odd
 * authors had each written readings with file:line pointers and none of them could have discovered
 * that over half were never read.
 *
 * ⛔ IT IS THE INVERSE OF #132 AND WORSE. Those findings fired on correct output: noisy, and
 * self-announcing. This one goes quiet on incorrect output — the failure that cannot be detected
 * from the outside, and the one this codebase keeps legislating against.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const CLI = path.resolve("dist/cli/index.js");

const seeded = () => {
  const dir = path.join(temp("silent-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
};

/** The shape an author writes when they follow a single-entry example: no wrapper. */
const BARE = `id: a-reading-with-no-wrapper
bears_on: money
observes: >
  Written as a bare object, the way an example of ONE entry reads, rather than wrapped in a list.
basis:
  kind: trial
  ref: a fixture
  at: 2026-10-14
`;

test("a readings file with no `readings:` wrapper is reported, not dropped", () => {
  const dir = seeded();
  const before = loadCorpus(dir).readings.length;
  fs.writeFileSync(path.join(dir, "readings", "bare.yaml"), BARE);

  const c = loadCorpus(dir);
  const mine = (c.broken ?? []).filter((b) => b.file.endsWith("bare.yaml"));

  /** ⛔ The non-zero first. Silence here is the whole defect. */
  assert.equal(mine.length, 1, "a file the loader could not read was discarded without a word");
  assert.match(mine[0].why, /no `readings:` at the top level/);
  /** ⛔ And it names the author's OWN keys, so they can see the missing wrapper rather than guess. */
  assert.match(mine[0].why, /id, bears_on, observes, basis/);
  /** Nothing valid was lost in the process. */
  assert.equal(c.readings.length, before, "reporting the bad file changed what the good ones loaded");
});

test("an empty or comment-only file is still fine", () => {
  /**
   * ⛔ A blank file is visibly blank to whoever opens it — there is no hidden content to lose, so
   * reporting it would be noise. Only a file plainly holding SOMETHING unrecognised is reported.
   */
  const dir = seeded();
  fs.writeFileSync(path.join(dir, "readings", "blank.yaml"), "");
  fs.writeFileSync(path.join(dir, "readings", "comments.yaml"), "# nothing here yet\n");
  const c = loadCorpus(dir);
  const noisy = (c.broken ?? []).filter((b) => /blank\.yaml|comments\.yaml/.test(b.file));
  assert.deepEqual(noisy, [], "an empty file was reported as broken, which is noise");
});

test("an empty list is an answer, and stays one", () => {
  const dir = seeded();
  fs.writeFileSync(path.join(dir, "readings", "none.yaml"), "readings: []\n");
  const c = loadCorpus(dir);
  assert.deepEqual(
    (c.broken ?? []).filter((b) => b.file.endsWith("none.yaml")),
    [],
    "`readings: []` is a deliberate empty answer and must not be reported"
  );
});

test("the same silence is closed for notes, steers, access and verdicts", () => {
  /**
   * ⛔ ONE PATTERN, FIVE COLLECTIONS. Fixing only the one that was noticed leaves four files that
   * can still vanish — and `notes/` is the queue a person's request arrives in, so a dropped note
   * is somebody's press disappearing.
   */
  const dir = seeded();
  const cases = {
    "notes/bare.yaml": "id: n-bare\nabout: money\nsays: a note with no wrapper\nby: peter\nat: 2026-10-14\nvia: page\n",
    "steers/bare.yaml": "id: s-bare\nsays: a steer with no wrapper\nsteers: generation\n",
    "verdicts/bare.yaml": "kind: accept\ntarget: money\nby: peter\nvia: page\nat: 2026-10-14\n",
  };
  for (const [rel, body] of Object.entries(cases)) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  fs.writeFileSync(path.join(dir, "access.yaml"), "id: a-bare\nkind: role\nmeans: a role written with no wrapper at all\n");

  const broken = loadCorpus(dir).broken ?? [];
  for (const rel of [...Object.keys(cases), "access.yaml"]) {
    const name = path.basename(rel);
    const dir_ = path.dirname(rel);
    assert.ok(
      broken.some((b) => b.file.endsWith(name) && (dir_ === "." || b.file.includes(dir_))),
      `${rel} was discarded in silence — the same defect, in a collection nobody checked`
    );
  }
});
