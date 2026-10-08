/**
 * ⛔ A PRESS ON A PAGE HAS TO REACH A SESSION, AND EXACTLY ONE OF THEM.
 *
 * Peter: "mcp main interface, a loop back path that claude sessions will poll from for now."
 *
 * The hosted design rests on the instance owning the truth and both clients — the browser and the
 * session — being readers of one event log. Everything here is a property of that log that, if it
 * quietly stopped holding, would look exactly like a working system:
 *
 *   - a press that is never announced is indistinguishable, from the page, from a press that never
 *     happened
 *   - a cursor that advances past a note means "I saw your feedback" has come to mean "your
 *     feedback happened", and nothing ever reports the difference
 *   - two sessions authoring one note means the second silently overwrites the first
 *   - a lease that never expires strands a request forever the first time a session dies, which is
 *     the failure nobody is watching for
 *
 * Every one of those is a silent failure, so every one is pinned.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadCorpus } from "../dist/v2/load.js";
import { readLog } from "../dist/v2/log.js";
import { inbox } from "../dist/v2/inbox.js";
import { fileNote, closeNote, claimNote, readNotes } from "../dist/v2/notes.js";
import YAML from "yaml";
import { perform } from "../dist/v2/acts.js";
import { checkCorpus } from "../dist/v2/check.js";

const CLI = path.resolve("dist/cli/index.js");

/** A pristine corpus per test, so no test can pass because of what another one left behind. */
function corpus() {
  const dir = path.join(temp("productos-loop-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}
const rootOf = (dir) => loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;

const note = (dir, says, by = "peter") =>
  fileNote(dir, { about: rootOf(dir), says, by, via: "page", at: new Date().toISOString().slice(0, 10) });

test("a press is announced once, saying who and what", () => {
  const dir = corpus();
  const before = readLog(dir).length;
  const r = perform(dir, "read", { scope: rootOf(dir), buildable: false, note: "having a look" }, { by: "peter", via: "page" });
  assert.ok(r.ok, `the act itself failed: ${JSON.stringify(r)}`);
  const added = readLog(dir).slice(before);
  assert.equal(added.length, 1, "a press announced twice is counted twice by the page");
  assert.equal(added[0].kind, "press");
  assert.equal(added[0].by, "peter");
  assert.equal(added[0].via, "page");
  assert.match(added[0].says, /peter read/);
  assert.equal(added[0].work, undefined, "a press owes a session nothing — the truth already moved");
});

test("a refused act announces nothing", () => {
  const dir = corpus();
  const before = readLog(dir).length;
  // ⛔ A placeholder name is refused by `perform`. An event for it would wake somebody to look at
  // a corpus that has not moved.
  const r = perform(dir, "read", { scope: rootOf(dir), buildable: false }, { by: "you", via: "page" });
  assert.equal(r.ok, false, "this act was supposed to be refused, so the test proves nothing");
  assert.equal(readLog(dir).length, before, "an act that did not happen was announced");
});

test("a note is the only event that carries work, and the cursor stops at it", () => {
  const dir = corpus();
  const filed = note(dir, "this behaviour belongs on the other screen");
  assert.ok(filed.ok);

  const read = inbox(dir, {});
  const carried = read.events.filter((e) => e.work);
  assert.equal(carried.length, 1, "exactly one event should carry work");
  assert.equal(carried[0].work, filed.note.id);
  assert.ok(
    read.next_cursor < carried[0].seq,
    `the cursor advanced past unfinished work — it is at ${read.next_cursor}, the note is at ${carried[0].seq}`
  );
  assert.equal(read.head, readLog(dir).length, "head should be the end of the log");
});

test("a session that lost its place is handed its unfinished work again", () => {
  const dir = corpus();
  const filed = note(dir, "the sketch is out of date");
  const first = inbox(dir, { claim: "session-a" });
  assert.ok(first.events.some((e) => e.work === filed.note.id), "the note was never delivered");

  // The session dies. It comes back with the only number it persisted.
  const again = inbox(dir, { since: first.next_cursor, claim: "session-a" });
  assert.ok(
    again.events.some((e) => e.work === filed.note.id),
    "a session that crashed mid-authoring lost the request — which is the press most likely to matter"
  );
});

test("once the work is done the cursor moves past it, and the close is announced", () => {
  const dir = corpus();
  const filed = note(dir, "this reads as though it were decided, and it is not");
  const stuck = inbox(dir, {});
  const closed = closeNote(dir, filed.note.id, "reworded the slot and re-derived the grid under it");
  assert.ok(closed.ok, JSON.stringify(closed));

  const after = inbox(dir, {});
  assert.ok(after.next_cursor > stuck.next_cursor, "closing the note did not release the cursor");
  assert.equal(after.next_cursor, after.head, "nothing is outstanding, so the cursor should be at the end");
  assert.ok(
    readLog(dir).some((e) => e.kind === "note-closed" && e.says.includes("re-derived")),
    "the person who asked has no way to learn that anything happened"
  );
});

test("two sessions cannot both take the same note, and the second is told who has it", () => {
  const dir = corpus();
  const filed = note(dir, "two of us must not author this at once");

  const a = inbox(dir, { claim: "session-a" });
  assert.ok(a.events.some((e) => e.work === filed.note.id));

  const b = inbox(dir, { claim: "session-b" });
  assert.ok(
    !b.events.some((e) => e.work === filed.note.id),
    "both sessions were handed the same note — the second will overwrite the first and neither will find out"
  );
  /**
   * ⛔ Told, not merely withheld. An empty inbox and one somebody else is working through call for
   * opposite behaviour, and from here they would look identical.
   */
  const held = b.held.find((h) => h.work === filed.note.id);
  assert.ok(held, "the second session saw an empty inbox rather than work in progress");
  assert.equal(held.by, "session-a");
  assert.ok(held.until, "a claim with no expiry strands the note the first time a session dies");
});

test("a lease that lapses puts the work back", () => {
  const dir = corpus();
  const filed = note(dir, "somebody will pick this up and die holding it");
  // A session takes it and never comes back: the lease is already in the past.
  const got = claimNote(dir, filed.note.id, "session-that-died", new Date(Date.now() - 1000).toISOString());
  assert.ok(got.ok);

  const next = inbox(dir, { claim: "session-b" });
  assert.ok(
    next.events.some((e) => e.work === filed.note.id),
    "a dead session stranded the request forever — the one failure nobody is watching for"
  );
  assert.equal(readNotes(dir).find((n) => n.id === filed.note.id).claimed_by, "session-b");
});

test("looking without claiming takes nothing", () => {
  const dir = corpus();
  const filed = note(dir, "a status display must not steal the work it is reporting");
  const looked = inbox(dir, {});
  assert.ok(looked.events.some((e) => e.work === filed.note.id));
  assert.equal(
    readNotes(dir).find((n) => n.id === filed.note.id).claimed_by,
    undefined,
    "reading without a claim leased the note anyway"
  );
});

test("closing a note hands the lease back with it", () => {
  const dir = corpus();
  const filed = note(dir, "a done note holding a lease is a lease nothing will release");
  inbox(dir, { claim: "session-a" });
  closeNote(dir, filed.note.id, "authored the change and regenerated what derives from it");
  const n = readNotes(dir).find((x) => x.id === filed.note.id);
  assert.equal(n.state, "done");
  assert.equal(n.claimed_by, undefined);
  assert.equal(n.claimed_until, undefined);
});

test("check reports work nothing can ever close", () => {
  const dir = corpus();
  note(dir, "this note is about to be deleted by hand");
  // A hand edit removes the note; the event that carries it remains.
  fs.writeFileSync(path.join(dir, "notes", "notes.yaml"), "notes:\n");
  const { findings } = checkCorpus(dir);
  const f = findings.find((x) => x.kind === "work-nothing-can-close");
  assert.ok(f, "a cursor pinned forever behind work that cannot exist was reported by nothing");
  assert.ok(f.fix, "every finding says what to do");
});

test("check reports a note somebody picked up and never came back to", () => {
  const dir = corpus();
  const filed = note(dir, "picked up and dropped");
  claimNote(dir, filed.note.id, "session-that-died", new Date(Date.now() - 60_000).toISOString());
  const f = checkCorpus(dir).findings.find((x) => x.kind === "picked-up-and-dropped");
  assert.ok(f, "the queue looks busy and is not, and nothing said so");
  assert.match(f.what, /session-that-died/);
});


test("a note older than the log still reaches the inbox, and only once", () => {
  const dir = corpus();
  /**
   * ⛔ FOUND ON THE FIRST REAL CORPUS THIS WAS POINTED AT, which held one open note filed long
   * before any of this existed. The page counted it as waiting and the inbox reported nothing to
   * do — two surfaces, opposite answers, and the one a session reads said no. A corpus older than
   * the log is the normal case for a long time, so it cannot be a special case somebody remembers.
   */
  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "notes", "notes.yaml"),
    YAML.stringify({
      notes: [
        { id: "older-than-the-log", about: "money", says: "this predates the event log entirely", by: "peter", at: "2026-09-23", via: "page", state: "open" },
      ],
    })
  );
  assert.equal(readLog(dir).length, 0, "the log was not empty, so this proves nothing");

  const first = inbox(dir, {});
  const carried = first.events.filter((e) => e.work === "older-than-the-log");
  assert.equal(carried.length, 1, "a request nobody will ever be told about");
  assert.ok(first.next_cursor < carried[0].seq, "the cursor advanced past work nobody has done");

  // ⛔ Idempotent: a second event for one note pins the cursor behind work that is already finished.
  inbox(dir, {});
  inbox(dir, {});
  assert.equal(readLog(dir).filter((e) => e.work === "older-than-the-log").length, 1, "reading the inbox duplicated the work in it");

  closeNote(dir, "older-than-the-log", "authored the change and re-derived what depends on it");
  const after = inbox(dir, {});
  assert.equal(after.next_cursor, after.head, "closing a carried-in note did not release the cursor");
});
