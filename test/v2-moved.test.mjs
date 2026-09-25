/**
 * ⛔ WHAT THE CODE HAS DECIDED SINCE THIS TRUTH WAS WRITTEN.
 *
 * Peter: "we should also walk git history, right?" — after a whole feature was found to be
 * describing a screen somebody had deleted that morning, which two people only found by reading
 * source by hand, after one of them disbelieved the other.
 *
 * A recorded commit says THAT things moved. The history says WHAT and WHY, and in this codebase the
 * why is written down: the commit that deleted the pricing grid quoted the operator — "Computed
 * work and editable cells all need to be ripped out" — and said of itself "this deletes rather than
 * builds". No diff carries that.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { whatMoved, repoOf, headOf } from "../dist/v2/moved.js";
import { loadCorpus } from "../dist/v2/load.js";

const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** A tiny repo with a component, and a corpus whose drawing records where it came from. */
function scene() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "moved-repo-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "t@t");
  git(repo, "config", "user.name", "t");
  fs.mkdirSync(path.join(repo, "app"), { recursive: true });
  fs.writeFileSync(path.join(repo, "app/Pane.tsx"), "export default function Pane() { return <div/> }\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "first");
  const drawnAt = git(repo, "rev-parse", "HEAD");

  const corpus = fs.mkdtempSync(path.join(os.tmpdir(), "moved-corpus-"));
  for (const d of ["truth", "rules", "readings", "verdicts"]) fs.mkdirSync(path.join(corpus, d), { recursive: true });
  const write = (at) =>
    fs.writeFileSync(
      path.join(corpus, "truth", "thing.md"),
      `---\nid: thing\ntitle: A thing\nexists: kept\nviews:\n  - id: pane\n    title: Pane\n    walked: true\n    drawn_from: app/Pane.tsx\n${
        at ? `    drawn_at: ${at}\n` : ""
      }    sketch_html: |\n      <div></div>\n    parts: []\n---\n\nA scope.\n`
    );
  return { repo, corpus, drawnAt, write };
}

test("it walks what happened to the source since the drawing was made, and reports what the commits say", () => {
  const { repo, corpus, drawnAt, write } = scene();
  write(drawnAt);

  // Nothing has happened yet.
  assert.deepEqual(whatMoved(loadCorpus(corpus), repo)[0].since, [], "a quiet history reported as movement");

  // A decision lands, with its reasoning in the body — which is the part that matters.
  fs.writeFileSync(path.join(repo, "app/Pane.tsx"), "export default function Pane() { return <span/> }\n");
  git(repo, "commit", "-q", "-am", "the grid is the captured sheet, not an entry form\n\nOperator: editable cells all need to be ripped out.");

  const moved = whatMoved(loadCorpus(corpus), repo)[0];
  assert.equal(moved.since.length, 1, "the commit was not found");
  assert.match(moved.since[0].subject, /captured sheet/);
  /**
   * ⛔ THE BODY IS THE POINT. A diff shows a span replacing a div; the message says a product
   * decision was made and quotes who made it. That is what the corpus had not heard.
   */
  assert.match(moved.since[0].body, /ripped out/, "the commit's reasoning was dropped");

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(corpus, { recursive: true, force: true });
});

test("a drawing that cannot be compared says so, rather than reading as unchanged", () => {
  /**
   * ⛔ THE FAILURE THIS MODULE EXISTS TO STOP, REPRODUCED INSIDE IT. Reporting nothing for a
   * drawing with no recorded commit reads as "nothing has changed" — which is exactly the silence
   * that hid a deleted screen for a day.
   */
  const { repo, corpus, write } = scene();
  write(undefined);
  const row = whatMoved(loadCorpus(corpus), repo)[0];
  assert.match(row.why ?? "", /no commit was recorded/, "a drawing with no baseline read as unchanged");

  /**
   * ⛔ AND AN ALL-DIGIT SHA MUST SURVIVE YAML. This fixture found a real defect: an unquoted
   * commit with no letters in it parses as a NUMBER, the schema refuses it, and the corpus will not
   * load at all — because of a provenance line. `draw` quotes both fields now.
   */
  write('"0000000000000000000000000000000000000000"');
  const alien = whatMoved(loadCorpus(corpus), repo)[0];
  assert.match(alien.why ?? "", /not in this repository/, "a foreign commit read as unchanged");

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(corpus, { recursive: true, force: true });
});

test("the repo is asked of the file, never assumed", () => {
  /**
   * ⛔ WRONG PROVENANCE IS WORSE THAN NONE. The first cut derived the repo from the project's
   * configured components directory while the file being read was in a detached worktree at a
   * different commit — so it recorded the drawing as coming from the project's HEAD when it came
   * from somewhere else. Nothing downstream could tell, and every comparison would have been
   * against the wrong baseline.
   */
  const { repo, drawnAt } = scene();
  const found = repoOf(path.join(repo, "app/Pane.tsx"));
  assert.equal(fs.realpathSync(found.root), fs.realpathSync(repo), "the file's own repository was not found");
  assert.equal(found.head, drawnAt, "the commit came from somewhere other than the file's repository");
  assert.equal(repoOf(path.join(os.tmpdir(), "definitely-not-a-repo-xyz", "x.tsx")), undefined, "a non-repo reported a commit");
  assert.equal(headOf(repo), drawnAt);
  fs.rmSync(repo, { recursive: true, force: true });
});
