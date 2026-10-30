/**
 * ⛔ A PART IS PUT TO A PERSON IN THREE SHORT SENTENCES — WHERE, HOW IT WORKS, ONE QUESTION.
 *
 * Peter, on three successive versions of the same question: *"it's supposed to be human language
 * questions, condensed"*, then *"there's no context. 'how a field is read' - what?????????"*, then
 * *"still too verbose - listing 11 items as a list isn't any better than the table"*.
 *
 * The version that worked was driven against staging and answered in one pass. What made it work is
 * a rule in the interviewer's brief, and a brief is prose a later edit can quietly lose — so the
 * parts of that rule that carry it are pinned here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

const brief = fs.readFileSync("agents/productos-interviewer.md", "utf-8");
const section = (() => {
  const at = brief.indexOf("### ⛔ Putting a part of the system to a person");
  assert.ok(at >= 0, "the interviewer has no rule for putting a part to a person");
  return brief.slice(at, brief.indexOf("\n### ", at + 10));
})();

test("a part is put to a person in three sentences", () => {
  assert.match(section, /Three short sentences\. No list\./);
  for (const step of [/\*\*Where\*\*/, /\*\*How it works, with the example inside the sentence\*\*/, /\*\*One question\*\*/])
    assert.match(section, step, `the rule lost a step: ${step}`);
});

test("and it names what made the earlier versions fail", () => {
  for (const banned of [/a list of promises/, /the part's own nouns/, /operations, method names/, /a count/, /more than three sentences/])
    assert.match(section, banned, `the rule no longer forbids ${banned}`);
});

test("the installed interviewer carries the same rule", () => {
  const installed = fs.readFileSync(".claude/agents/productos-interviewer.md", "utf-8");
  assert.ok(installed.includes(section.trim()), "the installed copy has drifted from agents/productos-interviewer.md");
});
