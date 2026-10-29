/**
 * ⛔ A SUBSYSTEM'S BODY IS RENDERED, BECAUSE IT WAS WRITTEN AND NOTHING SHOWED IT.
 *
 * Peter, after agreeing thirty sentences about one subsystem and then reading its page: *"that's it
 * for extraction?"*, then *"why doesn't it render the documet body? let's get this FIXED"*.
 *
 * `renderSubsystems` read the body only through `carriedFor`, which starts at `## Carried from the
 * earlier capability tree` and takes the bullet lines under its `###` headings. A document without
 * that heading — every document an author writes — had its whole body dropped in silence, while a
 * scope has always rendered its body through `renderProse`.
 *
 * ⛔ THREE DISTINGUISHABLE OUTCOMES, because "the prose is on the page" has a failing state that
 * looks identical to shipping nothing when the only case tested is a body that is present:
 *
 *     a body of an author's own prose      -> on the page
 *     a body with only a Carried section   -> read beside its capability, NOT repeated as prose
 *     a body with both                     -> the prose, and the carried line once
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";

const PROSE = "A strategy can fail without the extraction failing; the chain continues.";
const CARRIED_LINE = "test record-a-movement-1: given a kid with nothing, when a movement lands, then the balance says so";

function subsystem(body) {
  return `---
id: ledger
title: The ledger
does: Holds every movement of a kid's money and answers what a kid has now.
offers:
  - id: record-a-movement
    does: Appends one movement against one kid and returns what the kid has afterwards.
    serves: [money#record-earning#after]
---

${body}
`;
}

function page(body) {
  const dir = temp("v2subsysbody-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  fs.writeFileSync(path.join(dir, "capabilities", "ledger.md"), subsystem(body));
  const corpus = loadCorpus(dir);
  assert.equal(corpus.broken.length, 0, `the fixture does not load: ${corpus.broken.map((b) => b.why).join(" | ")}`);
  const root = corpus.scopes.find((x) => !x.scope.in).scope.id;
  return renderScopePage(corpus, root, { only: [root, "overview", "subsystems"] });
}

test("an author's own prose is on the page", () => {
  const html = page(PROSE);
  assert.match(html, /class="subsys-prose"/, "the body renders in its own block");
  assert.ok(html.includes(PROSE), "the sentence an author wrote is on the page");
});

test("a carried section is read beside its capability and not repeated as prose", () => {
  const html = page(`## Carried from the earlier capability tree, 2026-10-26\n\n### record-a-movement\n\n- ${CARRIED_LINE}\n`);
  assert.doesNotMatch(html, /class="subsys-prose"/, "nothing but the carried section means no prose block");
  const seen = html.split(CARRIED_LINE).length - 1;
  assert.equal(seen, 1, `the carried line is on the page exactly once, saw ${seen}`);
});

test("prose above a carried section renders, and the carried line still appears once", () => {
  const html = page(`${PROSE}\n\n## Carried from the earlier capability tree, 2026-10-26\n\n### record-a-movement\n\n- ${CARRIED_LINE}\n`);
  assert.ok(html.includes(PROSE), "the prose above the heading is on the page");
  const seen = html.split(CARRIED_LINE).length - 1;
  assert.equal(seen, 1, `the carried line is on the page exactly once, saw ${seen}`);
});

/**
 * ⛔ AND THE NOTATION AN AUTHOR WRITES IS NOT PRINTED AT A REVIEWER.
 *
 * Peter, reading the live page: the body said `*how could this field be read*` and the product
 * showed him exactly that, asterisks and all. Bold was handled and emphasis was not, so every
 * author writing the other half of one notation got markup on the page.
 *
 * Three distinguishable outcomes, because "emphasis renders" passes on a page with no asterisks in
 * it at all:
 *
 *     *one word*     -> <em>, and no asterisk survives
 *     **one word**   -> <strong>, NOT <em>*one word</em>*
 *     a lone *       -> left exactly as written, swallowing nothing
 */
test("emphasis renders, bold still wins, and a lone asterisk is left alone", () => {
  const html = page("Three areas: *how could this field be read*, and **not** what a figure means. A column width of 8 * 4 is fine.");
  assert.match(html, /<em>how could this field be read<\/em>/, "single asterisks become emphasis");
  assert.match(html, /<strong>not<\/strong>/, "double asterisks still become bold");
  assert.doesNotMatch(html, /<em>\*/, "bold is never re-read as emphasis around a leftover asterisk");
  const prose = html.slice(html.indexOf('class="subsys-prose"'));
  const body = prose.slice(0, prose.indexOf("</div>"));
  assert.ok(body.includes("8 * 4"), "a lone asterisk between spaces is left exactly as written");
  assert.equal(body.split("*").length - 1, 1, "the only asterisk left on the page is that lone one");
});
