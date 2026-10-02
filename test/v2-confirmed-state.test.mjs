/**
 * ⛔ ONE PRESS, AND CONFIRMED-OR-NOT WHERE THE SENTENCE IS.
 *
 * Peter, reviewing: *"clicking twice to confirm a behavior is annoying - just a single click. and
 * if it's confirmed, the state should be obvious, there shouldn't be a list of human judgement
 * record. we should show confirmed or not next to a behavior."*
 *
 * Three things, each with its own way of coming back:
 *
 *   — the second press was never a confirmation. An accept owes no words, so the form it opened
 *     had no inputs: a restatement of the button, and another button.
 *   — a collapsed log of acts answered a question nobody asked, on the card where somebody is
 *     being asked to judge one sentence.
 *   — and the state was only derivable by opening that log, which is the opposite of obvious.
 *
 * ⛔ The badge reads `stampFor`, the same function every gate reads, so "confirmed" on the page
 * cannot disagree with what `check` refuses. Three surfaces each built their own accepted-set once,
 * and the packet printed "accepted separately" for rules with no verdict at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2conf-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const page = (dir, scope) => renderScopePage(loadCorpus(dir), scope, { interactive: true, by: "a-person" });

test("a behaviour says whether it is confirmed, without anything being opened", () => {
  const html = page(seed(), "tasks");
  assert.match(html, /class="beh-state"><b>not confirmed<\/b>/,
    "a sentence nobody has agreed to does not say so where it is");
  /** ⛔ The thing he asked to be gone. */
  assert.ok(!/of human judgement recorded here/.test(html.replace(/<article class="q"[\s\S]*?<\/article>/g, "")),
    "a card still carries a list of acts of human judgement");
});

test("agreeing to it changes what the card says, and retires the agree button", () => {
  const dir = seed();
  const run = (...a) => execFileSync("node", [path.resolve("dist/cli/index.js"), "v2", ...a], { encoding: "utf-8" });

  run("rule", "tasks#complete-a-task#at_once",
    "--says", "Whoever presses first claims the task, and the second kid is told it is already done and by whom.",
    "--because", "In the trial two kids both believed they had earned the same reward, so the claim has to be visible at once.",
    "--by", "a-person", "--at", dir);
  /**
   * ⛔ A BEHAVIOUR, NOT THE EXCHANGE. They are separate refs and separate acts: `#complete-a-task`
   * is the whole exchange, `#complete-a-task#may` is one sentence in it. The first version of this
   * test accepted the exchange and then asserted about a behaviour card, and passed its badge
   * assertion by matching the EXCHANGE card's badge — which is how a test ends up green while
   * checking the wrong thing.
   */
  run("accept", "tasks#complete-a-task#may", "--by", "a-person", "--at", dir);

  const html = page(dir, "tasks");
  assert.match(html, /class="beh-state ok"><b>confirmed<\/b><span>by a-person/,
    "it was agreed to and the card does not say confirmed, or does not say by whom");

  /**
   * ⛔ CONFIRMED MEANS THE AGREE BUTTON IS GONE. Offering "That is right" under a badge reading
   * confirmed asks for the same consent twice and makes the badge look advisory.
   */
  /** ⛔ A row now, not an article — the behaviours became one table grouped by screen. */
  const card = /<tr class="beh"[^>]*data-beh="tasks#complete-a-task#may"[\s\S]*?<\/tr>/.exec(html);
  assert.ok(card, "the behaviour card for the sentence that was agreed to is not on the page");
  {
    assert.ok(!/data-act="accept"/.test(card[0]), "a confirmed behaviour still offers to be agreed to");
    /** ⛔ And rewording stays. Truth is the target state, so it has to remain changeable. */
    assert.match(card[0], /data-act="say"/, "a confirmed behaviour cannot be changed — truth is the target state, not a record");
  }
});

/**
 * ⛔ THE SINGLE PRESS, ASSERTED ON THE SCRIPT THE BROWSER ACTUALLY GETS. An act that owes no words
 * records on one press; one that owes words still opens the form, because the form is where the
 * words are typed — removing it would charge a floor with nowhere to satisfy it, which this
 * codebase has shipped three times.
 */
test("an act that owes nothing records on one press; one that owes words still asks", () => {
  const html = page(seed(), "tasks");
  assert.match(html, /if \(!fields\.length\)/, "the page no longer records a no-fields act on one press");
  assert.match(html, /form\.onsubmit/, "the form that gathers words is gone — a floor with no way to satisfy it");
  /** ⛔ As the browser gets it — `OWED` is serialised, so the source spelling is not what is there. */
  assert.match(html, /"accept":\s*\[\]/, "an accept now owes fields, so the single press would skip gathering them");
});
