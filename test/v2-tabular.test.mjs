/**
 * ⛔ BEHAVIOURS ARE ROWS: COLLAPSED, WITH THE THREE THINGS A READER DOES TO ONE.
 *
 * Peter: *"let's make the behaviors more tabular now - collapse all the info, only on row tap does
 * it expand. and have a 'checkmark' to approve, 'trash' icon to delete, 'edit' button to make
 * changes. they should also be able to just edit the text directly."*
 *
 * A card carried the sentence, where it happens, its evidence, a picture of the control, its state
 * and three buttons — hundreds of pixels each, and a feature has thirty. So reading a feature meant
 * scrolling past everything about sentence one to reach sentence two, and the shape of the whole —
 * which of thirty are confirmed — could not be seen at all.
 *
 * ⛔ What stays in the row is what you CHOOSE BY. What supports a judgement rather than being one —
 * evidence, the drawing, where it lands — is behind the tap.
 *
 * ⛔ TWO OF THESE TESTS ARE INTEGRATION BUGS THAT MADE THE TRASH ICON A CONTROL THAT COULD NOT WORK.
 * Both were found by pressing it in a browser against a real corpus, and both had the same shape: a
 * hand-maintained list beside a union that is not, defaulting to the wrong member.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";
import { payloadFrom } from "../dist/v2/acts.js";
import { perform } from "../dist/v2/acts.js";

function seeded() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2tab-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const page = (dir) => renderScopePage(loadCorpus(dir), "tasks", { interactive: true, by: "a-person", mode: "http" });

test("a behaviour is a collapsed row, and what supports the judgement is behind the tap", () => {
  const html = page(seeded());
  /**
   * ⛔ ONE TABLE, GROUPED BY SCREEN. Peter went further the next turn: *"even MORE tabular. single
   * table. do not truncate text, make the text all visible, group into subsections based on which
   * screen it applies to."* This test pinned the intermediate shape — 201 separate collapsed
   * elements — and the sentence was clipped with an ellipsis, which put the one thing a reviewer
   * judges behind a tap.
   */
  assert.match(html, /<table class="beh-table">/, "behaviours are not one table");
  assert.match(html, /<tbody data-screen=/, "the rows are not grouped by the screen they apply to");
  assert.ok(!/<details class="beh-row"/.test(html), "the old per-behaviour collapsed element is back");
  /** The sentence is a cell, in full. */
  assert.match(html, /<td class="row-says">/);
  /** ⛔ Detail opens as its own row, because a table cannot nest a details element. */
  assert.match(html, /<tr class="beh-detail"[^>]*hidden>/, "there is nothing to open under a row");
  /** The evidence is not. */
  assert.match(html, /beh-shows|beh-nothing/, "the evidence block is gone rather than behind the tap");
});

test("the row carries confirm, reword and take-out", () => {
  const html = page(seeded());
  for (const [act, why] of [
    ["accept", "there is no checkmark to approve"],
    ["say", "there is no edit control"],
    ["withdraw", "there is no trash control"],
  ])
    assert.ok(new RegExp(`class="act icon[^"]*" data-act="${act}"`).test(html), why);
});

/**
 * ⛔ NO TRASH WHERE THE ACT CANNOT SUCCEED. A slot and a statement have no `exists` field, so
 * withdrawing one that carries a stamp is refused — agreed truth is reworded, which keeps the id
 * and breaks the stamp. A button whose only outcome is a refusal is the defect this codebase has
 * shipped three times.
 */
test("a confirmed row offers no trash, and no second confirm", () => {
  const dir = seeded();
  perform(dir, "accept", { target: "tasks#complete-a-task#with" }, { by: "a-person", via: "page" });
  const html = page(dir);
  const card = /<tr class="beh"[^>]*data-ref="tasks#complete-a-task#with"[\s\S]*?<\/tr>/.exec(html);
  assert.ok(card, "the accepted behaviour is not on the page");
  assert.ok(!/data-act="withdraw"/.test(card[0]), "a confirmed row offers a trash icon that can only refuse");
  assert.ok(!/data-act="accept"/.test(card[0]), "a confirmed row still asks to be confirmed");
  assert.match(card[0], /data-act="say"/, "a confirmed row cannot be reworded — the only honest act is gone");
});

/** ⛔ A press in the summary must not also toggle the row, or every confirmation opens what it confirmed. */
test("a row act stops the row from toggling", () => {
  const html = page(seeded());
  /** ⛔ The toggle ignores a press on a button, so confirming does not also open what it confirmed. */
  assert.match(html, /if \(ev\.target\.closest\("button, a, textarea, summary"\)\) return;/,
    "pressing a row's button also opens the row, which reads as the press having done something else");
});

/** ⛔ Edit the sentence where it is, rather than retyping one you can no longer see. */
test("the sentence can be edited in place, and escape puts it back", () => {
  const html = page(seeded());
  assert.match(html, /addEventListener\("dblclick"/, "the text cannot be edited directly");
  assert.match(html, /says-edit/, "there is no edit box");
  assert.match(html, /e\.key === "Escape"/, "an edit box with no way out traps a reader in a field");
  /** ⛔ It goes through the existing act, so the reason floor and the record are unchanged. */
  assert.match(html, /btn\.dataset\.says = now/, "a direct edit bypasses the act, and with it the floor and the record");
});

/**
 * ⛔ BUG ONE. `payloadFrom` is a chain of ternaries ending in the RULING payload, so a new act
 * silently gets `{ slot }` instead of `{ target }`. `withdraw` did, `doWithdraw` read an undefined
 * target, and the endpoint answered "server error: Cannot read properties of undefined" — from a
 * trash icon that looked fine.
 */
test("withdraw gets a target, not a ruling's slot", () => {
  assert.deepEqual(payloadFrom("withdraw", "pay#send#may", {}), { target: "pay#send#may", because: undefined });
  assert.deepEqual(payloadFrom("accept", "pay#send#may", {}), { target: "pay#send#may" });
});

/**
 * ⛔ BUG TWO, the same shape in a second place: the HTTP route's list of acceptable acts is
 * maintained by hand beside the `Act` union. `withdraw` was missing, so the press was refused as an
 * unknown act.
 */
test("every act the page can press is one the endpoint accepts", () => {
  const serve = fs.readFileSync("src/v2/serve.ts", "utf-8");
  const listed = /const ACTS: readonly Act\[\] = \[([^\]]*)\]/.exec(serve);
  assert.ok(listed, "the endpoint's list of acts is gone");
  const html = page(seeded());
  for (const m of html.matchAll(/data-act="([a-z]+)"/g)) {
    const act = m[1] === "say" ? "rule" : m[1];
    assert.match(listed[1], new RegExp(`"${act}"`), `the page presses "${act}" and the endpoint does not accept it`);
  }
});
