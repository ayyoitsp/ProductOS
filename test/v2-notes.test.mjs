/**
 * ⛔ A NOTE IS A REQUEST, NOT A JUDGEMENT, AND THE MODEL HAS TO KEEP THOSE APART.
 *
 * The five acts say whether a sentence is right. A reviewer looking at a screen and thinking "the
 * tab strip should also show the pinned version" has nowhere to put that, and every option in front
 * of them is a wrong answer — so it gets mis-filed as a rewording, or not said at all.
 *
 * Filed as a verdict or as a slot, a request would read as a decision: a packet would ship "the tab
 * strip should show the pinned version" as something the product does.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Note } from "../dist/v2/schema.js";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

const corpus = loadCorpus("v2-seed");

test("a note carries what the person was looking at", () => {
  const ok = Note.safeParse({
    id: "n-1",
    about: "money#see-a-balance",
    says: "The balance should show the date of the last movement.",
    by: "peter",
    at: "2026-09-23",
    via: "page",
  });
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues));
  assert.equal(ok.data.state, "open", "a note has to start somewhere, and open is the only honest default");

  // ⛔ An empty note is a click nobody can act on.
  assert.equal(Note.safeParse({ id: "n", about: "x", says: "", by: "p", at: "d", via: "page" }).success, false);

  /**
   * ⛔ Closing one says what was done. `done` with no outcome cannot be told apart from a note
   * somebody dropped because they did not fancy it, and the next reader has no way to know which.
   */
  const closedBlind = Note.safeParse({
    id: "n-2", about: "x", says: "something", by: "p", at: "d", via: "page", state: "done",
  });
  assert.equal(closedBlind.success, false, "a note was closed with no account of what happened");
  assert.match(closedBlind.error.issues[0].message, /cannot be told apart/);
});

test("notes are kept apart from verdicts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2notes-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "notes", "notes.yaml"),
    `notes:\n  - id: n-1\n    about: money#see-a-balance\n    says: The balance should show the date of the last movement.\n    by: peter\n    at: 2026-09-23\n    via: page\n    state: open\n`
  );
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, JSON.stringify(c.broken));
  assert.equal(c.notes.length, 1);
  // ⛔ The one thing that must never be true: a request counted among the acts of judgement.
  assert.equal(c.verdicts.length, 0, "a note landed in the verdict log");
});

test("the composer is docked, always there, and never asks what you are looking at", () => {
  const live = renderScopePage(corpus, "family-wallet", { interactive: true, records: "http", by: "peter" });
  assert.match(live, /id="note-bar"/, "there is no way to ask for a change");
  assert.match(live, /id="note-text"/, "there is no box to type in");

  /**
   * ⛔ IT WAS A FLOATING BUTTON THAT HID ITSELF WHILE IN USE, over a panel with an "attach it to"
   * dropdown. Peter: "change something here should always be visible. fixed to the bottom of the
   * screen. 'attach it to' shouldn't be an option, should always just capture context of current
   * section. just a text box, minimal UX."
   *
   * The dropdown is the worse half: it asked the reader to re-state what the page already knows,
   * and every field between somebody and the text box is a chance to not bother. A request nobody
   * bothered to make looks exactly like a page with nothing wrong with it.
   */
  assert.doesNotMatch(live, /id="note-open"/, "the floating button came back");
  assert.doesNotMatch(live, /id="note-about"[^-]/, "the attach-it-to dropdown came back");
  assert.doesNotMatch(live, /<select/, "the composer is asking a question again");

  /**
   * ⛔ THE CAPTURE GOES DOWN TO THE SUBSECTION, AND ITS TRAIL SITS ABOVE THE BOX.
   *
   * Peter: "the context aware tab should be aware of subsections - e.g. overview/producttruth vs
   * overview/product goals. and make it above the textbox line."
   *
   * The visible view alone was too coarse — on Overview every request arrived attached to the same
   * ref whether somebody was reading the queue, the goals or the principles. So every section the
   * renderer emits for a model object carries its ref and its name, and the composer reads the
   * page's own answer instead of computing a second one.
   */
  for (const attr of ["data-ref", "data-label"])
    assert.ok(
      (live.match(new RegExp(attr, "g")) ?? []).length > 5,
      `sections do not carry ${attr}, so the capture cannot see past the whole view`
    );
  // Views are in the same chain as everything else: a tab renders SEVERAL of them at once, and
  // naming "the first visible view" separately put the wrong scope at the head of every trail.
  assert.match(live, /class="view"[^>]*data-ref=/, "a view carries no ref, so it cannot be part of the trail");
  // The trail is its own line above the box, not a column beside it competing for width.
  assert.match(live, /class="note-at"[\s\S]{0,200}class="note-row"/, "the captured place is not above the box");

  // Docked, not floated, and the body makes room so it never covers the last card.
  assert.match(live, /\.note-bar \{[^}]*position: fixed/, "the composer is not pinned to the viewport");
  assert.match(live, /\.note-bar \{[^}]*bottom: 0/, "the composer is not at the bottom of the screen");
  assert.match(live, /body\.has-note-bar \{ padding-bottom/, "nothing makes room for the composer");

  // ⛔ And not on a read-only render, where it would collect words that go nowhere.
  const ro = renderScopePage(corpus, "family-wallet");
  assert.doesNotMatch(ro, /id="note-bar"/, "a read-only page offered to record a note it cannot send");
});

test("a regenerate discards derived truth and keeps what people said", () => {
  /**
   * ⛔ `--force` exists to throw away everything the migrator produces, because a file it no longer
   * writes is a file nothing regenerates — that is how seven deleted org-wide rules went on
   * governing a corpus for two further runs.
   *
   * Verdicts and notes are the exception, and for the same reason: a person's judgement and a
   * person's request are the only things in a corpus nothing can reconstruct. `notes/` was outside
   * the clear list by omission rather than by decision, which is not a protection.
   */
  const src = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  const clause = /if \(o\.force\) for \(const d of \[([^\]]*)\]\)/.exec(src);
  assert.ok(clause, "the force-clear list moved — find it and re-pin what it must never delete");
  const cleared = clause[1].split(",").map((s) => s.trim().replace(/["']/g, ""));
  for (const sacred of ["verdicts", "notes"])
    assert.ok(!cleared.includes(sacred), `--force would delete ${sacred}/, which nothing can reconstruct`);
  assert.deepEqual(cleared, ["truth", "rules", "charter"], "the clear list changed — decide deliberately, then update this");
});
