/**
 * ⛔ A DOCUMENT THAT WILL NOT LOAD MUST SAY WHICH SCREEN IT IS.
 *
 * Peter, looking at a product whose Deal Overview had vanished from its area: *"wtf? overview just
 * disappeared?"*. It had not disappeared — it failed validation, the loader recorded it, and the
 * page printed the alarm faithfully. What the alarm said was:
 *
 *     1 file here would not load … views.0.parts.6.leads_to — "Sizing, Review, …" navigates and
 *     says nowhere
 *
 * A zod path and a quoted label, and NOWHERE the name of the screen. So the page reported the
 * defect and still left the only question a reader has — *which one of my screens is gone?* —
 * unanswerable, and reading it as a deletion was the correct inference from what was shown.
 *
 * ⛔ AND THE FILENAME IS NOT THE ANSWER, which is why it was missing rather than merely forgotten.
 * Nothing a reader sees may mention the storage. The name has to come from the document's own
 * `title`, which parses perfectly — the failure is always deeper in, so the thing that identifies
 * it to a person is available every time it is needed.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** A scope that parses as YAML, names itself, and fails the Part refinement — the real case. */
const BROKEN = `---
id: deal-overview
title: Deal Overview
in: money
exists: kept
views:
  - id: a-deals-overview
    name: A deal's overview
    parts:
      - id: the-other-views-of-this-deal
        role: navigates
        label: Sizing, Review, Documents, Rent Roll
        repeats: one per view of the deal this page offers
---

# Deal Overview
`;

function rendered() {
  const dir = temp("v2broken-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "truth", "deal-overview.md"), BROKEN);
  const out = path.join(dir, "page.html");
  execFileSync("node", ["dist/cli/index.js", "v2", "page", "money", "--at", dir, "--out", out], { stdio: "ignore" });
  const html = fs.readFileSync(out, "utf-8");
  fs.rmSync(dir, { recursive: true, force: true });
  return html;
}

const html = rendered();

test("the alarm names the screen that would not load", () => {
  const m = html.match(/files? here would not load[\s\S]{0,900}?<\/ul>/);
  assert.ok(m, "no would-not-load alarm on the page at all");
  assert.match(
    m[0],
    /Deal Overview/,
    "the alarm does not name the screen — a reader cannot tell which of their screens is missing",
  );
});

test("and it does not leak the file it came from", () => {
  const m = html.match(/files? here would not load[\s\S]{0,900}?<\/ul>/);
  assert.doesNotMatch(m[0], /\.md\b/, "the alarm prints a filename, which is substrate and not product truth");
  assert.doesNotMatch(m[0], /truth\//, "the alarm prints a path");
});

test("the reason survives beside the name", () => {
  const m = html.match(/files? here would not load[\s\S]{0,900}?<\/ul>/);
  assert.match(m[0], /navigates and says nowhere/, "the name replaced the reason instead of joining it");
});

/**
 * ⛔ AND IT STAYS IN THE MENU. Peter, told the alarm would name it: *"'file would not load' should
 * definitely still show up in the menu."* The nav walks the scopes that parsed, so the row simply
 * was not there — the area showed one fewer child than it has, which is what "disappeared" looks
 * like no matter how carefully the banner is worded.
 */
test("the menu keeps a row for it, marked, and linking nowhere", () => {
  const row = html.match(/<li[^>]*class="unloadable"[\s\S]{0,400}?<\/li>/);
  assert.ok(row, "no row in the menu for the document that would not load");
  assert.match(row[0], /Deal Overview/, "the row does not name the screen");
  assert.match(row[0], /would not load/, "the row does not say what is wrong with it");
  assert.doesNotMatch(row[0], /<a\b/, "the row is a link, and there is no page for it to go to");
});
