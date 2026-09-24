/**
 * ⛔ FORTY-ODD MODEL CALLS TO REPORT NOTHING.
 *
 * Peter: "Stop the monitor now. We need a better way to monitor than to poll endlessly."
 *
 * The polling was not a design. A PUBLISHED page's database can only be read through the tool that
 * published it, so nothing on that path can push, and a watcher there is a loop that costs a call
 * per tick and says "nothing" almost every time. The served surface writes to disk synchronously,
 * so it can be waited on instead — and then the cost is one call, when something actually happened.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchCorpus } from "../dist/v2/watch.js";
import { fileNote } from "../dist/v2/notes.js";
import { perform } from "../dist/v2/acts.js";

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

test("it says nothing until something is recorded, then says what", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2watch-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const lines = [];
  const { stop } = watchCorpus(dir, { quietMs: 20, emit: (l) => lines.push(l) });

  /**
   * ⛔ SILENT ON WHAT WAS ALREADY THERE. A watcher that replays history on startup floods its first
   * notification with things somebody dealt with last week, and the one new thing is lost in it.
   */
  await settle(120);
  assert.deepEqual(lines, [], `it announced the existing corpus: ${JSON.stringify(lines)}`);

  // A request lands.
  const filed = fileNote(dir, {
    about: "money#see-a-balance",
    says: "The balance should show the date of the last movement.",
    by: "peter",
    via: "page",
    at: "2026-09-23",
  });
  assert.equal(filed.ok, true, filed.why);
  await settle(250);
  assert.equal(lines.length, 1, `expected one line, got ${JSON.stringify(lines)}`);
  assert.match(lines[0], /^NOTE\s+peter asked for a change to money#see-a-balance/);
  assert.match(lines[0], /date of the last movement/, "the line does not say what was asked for");

  // And an act.
  const r = perform(dir, "accept", { target: "money#see-a-balance" }, { by: "dana", via: "page" });
  assert.equal(r.ok, true, r.ok ? "" : r.why);
  await settle(250);
  assert.equal(lines.length, 2, JSON.stringify(lines));
  assert.match(lines[1], /^ACT\s+dana accept money#see-a-balance via page/);

  /**
   * ⛔ ONE ANNOUNCEMENT PER RECORD, NOT PER FILE EVENT. The append-only logs are rewritten wholesale
   * on a close, an editor touches them, and one act can fire several events — so a file-change
   * watcher would say "verdicts.yaml is different" repeatedly, which nobody can act on.
   */
  fs.appendFileSync(path.join(dir, "verdicts", "accepts.yaml"), "\n# touched\n");
  await settle(250);
  assert.equal(lines.length, 2, `a file touch was announced as a new act: ${JSON.stringify(lines.slice(2))}`);

  stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--replay is opt-in, and prints what is there", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2watch2-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  fileNote(dir, { about: "money", says: "something recorded before anyone watched", by: "peter", via: "chat", at: "2026-09-01" });

  const lines = [];
  const { stop } = watchCorpus(dir, { quietMs: 20, replay: true, emit: (l) => lines.push(l) });
  await settle(120);
  assert.ok(lines.some((l) => /something recorded before anyone watched/.test(l)), JSON.stringify(lines));
  stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
