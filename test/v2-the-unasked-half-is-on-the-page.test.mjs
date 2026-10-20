/**
 * ⛔ WHAT NOBODY HAS BEEN ASKED YET IS ON THE PAGE, AND IT DOES NOT READ AS A QUEUE.
 *
 * Peter: *"what is 'interview', this should be a first class representation in the UX - and claude
 * should ideally be able to access this via mcp"* — and then, sharper: *"we should not be creating
 * command line 'instructions' at this point? it should just be another functionality that could be
 * reachable. maybe i'm just taking issue with you saying 'productos v2 interview' command line, like
 * no one will ever use the command line"*.
 *
 * The derivation shipped as a CLI verb. That is a capability reachable from a checkout, which is
 * nobody — so it is now an MCP tool and a block on the page, and the CLI verb is the dev surface it
 * always should have been.
 *
 * ⛔ IN A REAL BROWSER AND ON COMPUTED STYLE, because the risk here is not whether the markup
 * exists. It is whether a reviewer can tell these apart from the pressable queue above them. Eight
 * cards that look like questions and carry no buttons is the exact state the queue's own ⛔ calls
 * "reads as finished" — and a markup assertion passes on it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { coveredBy } = await import(path.resolve("dist/v2/stamp.js"));
const { renderScopePage, standalone } = await import(path.resolve("dist/v2/page.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const CLI = path.resolve("dist/cli/index.js");
const { exe, skip } = browserOrSkip();

const ex = (id, title) => `  - id: ${id}
    title: ${title}
    asked_by: person
    changes: [job]
    at:
      view: the-list
    slots:
      may:
        says: A parent in this family.
      with:
        says: which kid it is for, and what it is worth
      answer:
        says: The thing they asked for, shown on the list.
      after:
        says: The list has one more thing on it than it had before.
      fails:
        says: They are told it was not recorded and nothing has changed.
`;

/** Three behaviours, each blank on `refuses`, `again` and `at_once`, with the purpose agreed. */
function page() {
  const dir = path.join(temp("pos-unasked-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  for (const f of fs.readdirSync(path.join(dir, "truth"))) fs.rmSync(path.join(dir, "truth", f));
  for (const f of fs.readdirSync(path.join(dir, "rules"))) fs.rmSync(path.join(dir, "rules", f));
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "chores.md"),
    `---
id: chores
title: Chores
exists: kept
terms:
  job:
    means: something a parent has asked a kid to do, with what it pays
happy_path:
  accomplishes: A parent puts a job on a kid's list and the kid marks it done and is paid for it.
  brings: what the job is and which kid it is for
  ends_with: the job is off the list and what it paid is in the kid's money
  through: [the-list]
views:
  - id: the-list
    title: The list
    view_kind: list
    sketch: |
      +------------------+
      |  The list        |
      +------------------+
    parts:
      - id: row
        role: display
        label: Tidy your room
exchanges:
${ex("offer-a-job", "A parent offers a job")}${ex("mark-it-done", "A kid marks a job done")}${ex("pay-for-it", "A parent pays for a job")}---

# Chores

What a kid is asked to do.
`
  );
  const c = coveredBy(loadCorpus(dir), "chores#happy-path");
  fs.writeFileSync(
    path.join(dir, "verdicts", "2026-10-20-purpose.yaml"),
    `verdicts:
  - kind: accept
    target: chores#happy-path
    because: Read it through with the people who asked for it, and this is what the product should do.
    by: a-person
    via: page
    at: "2026-10-20"
    covers_slots: ${JSON.stringify(c.slots)}
    covers_criteria: ${JSON.stringify(c.criteria)}
`
  );
  return dir;
}

/**
 * ⛔ ONE DRAFTED QUESTION, SO BOTH HALVES ARE ON ONE PAGE.
 *
 * The first version of the style test had no `.q` to compare against — the fixture is all blanks, so
 * nothing pressable rendered and the assertion failed on a missing element rather than on a real
 * likeness. The comparison is the whole point of that test, so the page has to carry both: a
 * question somebody can press, and the holes nobody can.
 */
function withOneDrafted(dir) {
  const r = raiseQuestion(dir, {
    ref: "chores#offer-a-job#again",
    question: "What happens when a parent offers the same job twice?",
    asked_of: "peter",
    blocks: [],
    cost: "Guessing wrong either puts a job on a kid's list nobody offered, or loses a second job a parent really did offer.",
    candidates: [
      {
        says: "Each offer stands on its own. The same job offered twice is on the list twice.",
        consequence: "A parent can offer the same chore twice and the list matches. A double-press puts a job nobody offered on a kid's list.",
      },
      {
        says: "Offering the same job for the same kid on the same day records it once, and the parent is told it is already there.",
        consequence: "A double-press cannot create a job nobody offered. A parent who wants it twice in a day has to change something first.",
      },
    ],
    by: "a-drafting-agent",
  });
  if (!r.ok) throw new Error(`the fixture could not be drafted: ${r.why}`);
  return dir;
}

const render = (dir) => standalone("Chores", renderScopePage(loadCorpus(dir), "chores"));

test("⛔ the unasked questions render, and say how many places one answer covers", { skip }, async () => {
  const p = await openPage(render(page()), { exe });
  try {
    /**
     * ⛔ THE TWO NUMBERS, READ OFF THE RENDERED PAGE. Three questions over nine blank slots. Equal
     * figures would mean nothing folded, and the gap is the only evidence on screen that it did.
     */
    const n = await p.evaluate("document.querySelectorAll('.unasked-list li').length");
    assert.equal(n, 3, `the page offers ${n} unasked questions, not the three the fold produces`);

    const lede = await p.evaluate("document.querySelector('.unasked .lede')?.textContent.replace(/\\s+/g,' ').trim()");
    assert.match(lede, /3 questions/, `the lede does not count the questions: ${lede}`);
    assert.match(lede, /\b9\b/, `the lede does not say how many places they cover: ${lede}`);
    assert.match(lede, /settles several/, `nothing on the page says a question settles more than one place: ${lede}`);

    /** Each one names the behaviours it covers, so a reviewer can judge whether one answer fits. */
    const first = await p.evaluate("document.querySelector('.u-asks')?.textContent.replace(/\\s+/g,' ').trim()");
    assert.match(first, /A parent offers a job/, `the question does not name what it covers: ${first}`);
    assert.match(first, /\?$/, `"${first}" is not a question`);
  } finally {
    await p.close();
  }
});

test("⛔ nothing in it is pressable, and it does not look like the queue", { skip }, async () => {
  /**
   * ⛔ THE ASSERTION THAT MARKUP CANNOT MAKE. A hole with no drafted options cannot be answered by
   * choosing — an author drafts first. So there must be no button, and it must not wear the card
   * treatment the pressable questions wear, or a reviewer reads eight dead cards as a finished
   * corpus.
   */
  const p = await openPage(render(withOneDrafted(page())), { exe });
  try {
    const buttons = await p.evaluate("document.querySelectorAll('.unasked button, .unasked [data-act]').length");
    assert.equal(buttons, 0, "the unasked half offers something to press, which would record an answer nobody drafted");

    /** ⛔ Computed, not declared: it carries the rule down the left and NOT a card background. */
    const style = await p.evaluate(`(() => {
      const el = document.querySelector('.unasked');
      const q = document.querySelector('.q');
      const s = getComputedStyle(el);
      return {
        borderLeftWidth: s.borderLeftWidth,
        borderTopWidth: s.borderTopWidth,
        bg: s.backgroundColor,
        qBg: q ? getComputedStyle(q).backgroundColor : null,
        qBorderTop: q ? getComputedStyle(q).borderTopWidth : null,
      };
    })()`);
    assert.equal(style.borderLeftWidth, "2px", `the offset rule did not render: ${JSON.stringify(style)}`);
    assert.equal(style.borderTopWidth, "0px", "it has grown a full border, so it reads as a card");
    /** ⛔ The fixture guarantees a pressable question exists, so a null here is a broken fixture. */
    assert.ok(style.qBg, "no pressable question rendered, so this test is comparing against nothing");
    assert.notEqual(
      style.qBg,
      style.bg,
      `the unasked half has the same background as a pressable question (${style.bg}), so the two read alike`
    );
    assert.notEqual(style.qBorderTop, "0px", "a pressable question lost its card border, so the contrast is gone");

    /** And the question text is at the page's own ink weight — it is the thing to read. */
    const ink = await p.evaluate(`(() => {
      const a = getComputedStyle(document.querySelector('.u-asks')).color;
      const b = getComputedStyle(document.querySelector('.u-why')).color;
      return { a, b };
    })()`);
    assert.notEqual(ink.a, ink.b, "the question and the reason it is asked render identically, so neither leads");
  } finally {
    await p.close();
  }
});
