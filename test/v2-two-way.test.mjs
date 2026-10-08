/**
 * ⛔ THE PAGE WAS WRITE-ONLY, AND HE IS MOVING HIS WORK INTO IT.
 *
 * Peter: *"i'm going to drive things mostly through product OS now, but let's add a 2-way window so
 * you can send messages back as well. if i tag pos: {blah blah} in the message, that indicates a
 * framework issue and to fix the framework issue (agent setup), and you respond concisely that it
 * has been updated or fixed"*.
 *
 * Two things were missing and they compound. Nothing could be said in reply except `outcome`, which
 * CLOSES the note — so every answer doubled as a decision that the matter was finished. And every
 * note arrived looking like a corpus request, so which kind it was got decided by whoever read it,
 * from the prose, differently each time.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { fileNote, replyToNote, closeNote, POS } = await import(path.resolve("dist/v2/notes.js"));
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));

const corpus = () => {
  const dir = temp("notes-");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "a.md"), "---\nid: a\ntitle: A\nviews: []\nexchanges: []\n---\n\nProse.\n");
  return dir;
};
const file = (dir, says) => fileNote(dir, { about: "a", says, by: "peter", via: "page", at: "2026-09-30" });
const only = (dir) => loadCorpus(dir).notes[0];

test("a pos: tag files a framework issue, and his words keep the tag", () => {
  const dir = corpus();
  const r = file(dir, "pos: the completeness agent never runs on a fullscan");
  assert.equal(r.ok, true);
  assert.equal(r.note.kind, "framework", "a tagged note was filed as a corpus request");
  /** ⛔ The tag stays in what he said. The one rule about feedback here is to quote him. */
  assert.match(only(dir).says, /^pos:/, "the tag was stripped out of his words");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an untagged note is a corpus request", () => {
  const dir = corpus();
  assert.equal(file(dir, "this feature reads thin").note.kind, "corpus");
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * ⛔ ANCHORED AT THE START. A note that MENTIONS the tag is not a note using it — "the pos: prefix
 * is confusing" is a corpus request about a label, and matching anywhere files it against us.
 */
test("a note that merely mentions the tag is not tagged", () => {
  const dir = corpus();
  assert.equal(file(dir, "the pos: prefix is confusing, can we rename it").note.kind, "corpus");
  assert.equal(POS.test("pos: fix this"), true);
  assert.equal(POS.test("  POS:fix this"), true, "it must survive spacing and case");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a reply says something back without deciding the matter is over", () => {
  const dir = corpus();
  const { note } = file(dir, "pos: the dead-end check fires on read-only features");
  const r = replyToNote(dir, note.id, "claude", "Narrowed it — it now only fires where you act on the other screens.");
  assert.equal(r.ok, true, r.ok ? "" : r.why);

  const after = only(dir);
  assert.equal(after.state, "open", "replying closed the note, which is the thing it exists not to do");
  assert.equal(after.replies.length, 1);
  assert.equal(after.replies[0].by, "claude");
  assert.match(after.replies[0].says, /Narrowed it/);

  /** ⛔ Append-only. A thread with the middle rewritten lies about how a decision was reached. */
  replyToNote(dir, note.id, "peter", "good");
  assert.deepEqual(only(dir).replies.map((x) => x.by), ["claude", "peter"]);

  /** ⛔ And closing keeps every reply — the outcome is the last one, not a replacement for them. */
  closeNote(dir, note.id, "Fixed, and pinned by a test that fires on a read-only feature.");
  const done = only(dir);
  assert.equal(done.state, "done");
  assert.equal(done.replies.length, 2, "closing ate the conversation");
  assert.match(done.outcome, /Fixed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an empty reply is refused — it reads as an answer", () => {
  const dir = corpus();
  const { note } = file(dir, "something");
  assert.equal(replyToNote(dir, note.id, "claude", "   ").ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** ⛔ The instructions have to carry it, or the next session answers in a chat window he left. */
test("the working rules say what pos: means and how to reply", () => {
  const md = fs.readFileSync("CLAUDE.md", "utf-8");
  assert.match(md, /pos:/, "nothing tells a future session what the tag means");
  assert.match(md, /notes say/, "nothing tells a future session how to reply without closing");
  assert.match(md, /concise/i, "the reply discipline he asked for is not written down");
});
