/**
 * ⛔ A SLOT SAYING SEVEN THINGS RENDERED AS ONE PARAGRAPH, UNDER A NOTE THAT CONTRADICTED THE
 * BUTTONS BESIDE IT.
 *
 * Reported by an author scoping a feature whose `answer` says seven things: *"`v2 decide` prints
 * the whole merged slot under 'This already says' even when the standing names `of:`, so an option
 * replacing one statement of four reads as if picking it deletes the other three. `settle` does the
 * right thing; the surface does not say so."*
 *
 * Both halves were true and the second was worse. `revises` is `saysText(fill.says)`, which joins
 * every statement with a space — right for hashing and matching, wrong for showing somebody what
 * they are about to change. And the page's note read "A ruling here replaces the whole sentence, so
 * it has to be written rather than picked" UNCONDITIONALLY, beside options each rendering a
 * pressable "This one" — so the page told a reviewer they could not do the thing it was offering.
 * The CLI had `candidatesAreWhole` for exactly this and the page read it nowhere.
 *
 * ⛔ AND `standing.of` ALREADY NAMED THE STATEMENT. `settle` replaces that one and leaves its
 * siblings byte-identical. The information existed, was acted on correctly, and was withheld from
 * the only person who needed it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { execFileSync } from "node:child_process";
import { renderScopePage } from "../dist/v2/page.js";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { questionsFor } = await import(path.resolve("dist/v2/settle.js"));

/** A slot saying four things, with a standing naming the third. */
function corpusWithFour({ of = "the-third", replaces = "only the part in question" } = {}) {
  const dir = temp("says-each-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  /**
   * ⛔ A NEW SCOPE UNDER THE SEED'S ROOT, not over one of its files. My first fixture overwrote
   * `family-wallet.md` — the root the other two scopes name in `in:` — so the tree lost its root,
   * `renderScopePage` returned null, and all five tests failed on the fixture rather than the fix.
   */
  const scope = "four-things";
  fs.writeFileSync(
    path.join(dir, "truth", `${scope}.md`),
    `---
id: ${scope}
title: Four Things
in: family-wallet
exists: kept
exchanges:
  - id: see-it
    title: Seeing it
    asked_by: person
    at: { view: a-screen }
    slots:
      answer:
        says:
          - id: the-first
            says: The first thing it says, which nobody is asking about.
          - id: the-second
            says: The second thing it says, also settled.
          - id: the-third
            says: The third thing, which is the one in question.
          - id: the-fourth
            says: The fourth thing it says, equally settled.
        standing:
          kind: open
${of ? `          of: ${of}\n` : ""}          about: whether the third thing holds when the deal has not funded
          question: Does the third thing hold before funding, or only after?
          asked_of: peter
          cost: a deal read before funding shows the wrong answer for this condition
          blocks: []
          candidates:
            - says: It holds only after funding.
              consequence: A deal before funding shows nothing for it.
              replaces: ${replaces}
            - says: It holds throughout.
              consequence: A deal before funding shows it anyway.
              replaces: ${replaces}
views:
  - id: a-screen
    title: A screen
    view_kind: list
    sketch: |
      [ a screen ]
---

# Four Things

A feature whose answer says four separate things.
`
  );
  return { dir, scope };
}

test("every statement is shown, not glued into one sentence", () => {
  const { dir, scope } = corpusWithFour();
  const html = renderScopePage(loadCorpus(dir), scope, { linkBase: "/v2" });

  /** ⛔ The non-zero first: four list items, one per statement. */
  const items = html.match(/<li[^>]*>The (first|second|third|fourth) thing/g) ?? [];
  assert.equal(items.length, 4, `expected four statements shown separately, got ${items.length}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the one in question is marked, because `of` already names it", () => {
  const { dir, scope } = corpusWithFour({ of: "the-third" });
  const html = renderScopePage(loadCorpus(dir), scope, { linkBase: "/v2" });

  const marked = /<li class="in-question">The third thing[^<]*<span class="tag">this one is unruled<\/span>/.test(html);
  assert.ok(marked, "the statement the standing names is not marked");
  /** ⛔ And only that one — marking all four would satisfy the line above and mean nothing. */
  assert.equal((html.match(/class="in-question"/g) ?? []).length, 1, "more than one statement was marked");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("it no longer claims a ruling replaces the whole sentence when the options say otherwise", () => {
  const { dir, scope } = corpusWithFour({ replaces: "only the part in question" });
  const html = renderScopePage(loadCorpus(dir), scope, { linkBase: "/v2" });

  assert.doesNotMatch(
    html,
    /has to be written rather than picked/,
    "⛔ the page still tells a reviewer they cannot pick, beside the pick buttons it renders"
  );
  assert.match(html, /replaces the marked statement only. The others stand/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("where each option IS the whole sentence, it still says so", () => {
  /**
   * ⛔ WITHOUT THIS THE FIX IS JUST THE OPPOSITE BIAS. A whole-sentence ruling really does
   * replace everything, and a page that never says that is wrong in the other direction.
   *
   * ⛔ AND IT NEEDS `of` ABSENT, WHICH THE FIXTURE USED TO SET ANYWAY. This passed
   * `{ replaces: "the whole sentence" }` and inherited `of: the-third` from the default — so it
   * asserted the page should say "picking one replaces it cleanly" in exactly the state where
   * `settle` replaces ONE statement and leaves its siblings byte-identical. The intent above was
   * right and the fixture contradicted it, so the test was pinning the wrong half: `of` decides the
   * scope, never what a candidate claims about itself.
   *
   * Found when `candidatesAreWhole` was made to defer to `of` — after an `interviewer` run read
   * the false sentence off a live page.
   */
  const { dir, scope } = corpusWithFour({ of: "", replaces: "the whole sentence" });
  const html = renderScopePage(loadCorpus(dir), scope, { linkBase: "/v2" });
  assert.match(html, /Each option is the whole sentence, so picking one replaces it cleanly/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("⛔ and where `of` names one statement, a whole-sentence claim does not get to say that", () => {
  /**
   * ⛔ THE CASE THE FIXTURE WAS SILENTLY TESTING AND THE ASSERTION HAD BACKWARDS. A standing with
   * `of` set AND every candidate declaring `the whole sentence`: `settle` scopes the replacement to
   * the named statement regardless, so the page must say the marked-statement sentence. Read off a
   * live instance before this was fixed — two statements, one marked `this one is unruled`, and
   * underneath them "Each option is the whole sentence, so picking one replaces it cleanly."
   *
   * It over-warns rather than destroying anything, which is why nothing caught it: the press is
   * safe and the sentence describing it is wrong, so a reviewer who cares about the other
   * statements declines to press.
   */
  const { dir, scope } = corpusWithFour({ replaces: "the whole sentence" });
  const html = renderScopePage(loadCorpus(dir), scope, { linkBase: "/v2" });
  assert.match(html, /replaces the marked statement only. The others stand/);
  assert.doesNotMatch(
    html,
    /Each option is the whole sentence, so picking one replaces it cleanly/,
    "the page tells a reviewer the press overwrites every statement, when `settle` replaces only the one `of` names"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the question carries the statements, so the CLI could show them too", () => {
  const { dir, scope } = corpusWithFour();
  const q = questionsFor(loadCorpus(dir), scope).find((x) => x.saysEach);
  assert.ok(q, "no question carries its statements");
  assert.equal(q.saysEach.length, 4);
  assert.deepEqual(
    q.saysEach.filter((x) => x.inQuestion).map((x) => x.says),
    ["The third thing, which is the one in question."]
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the CLI lists them too, and does not advise overwriting the siblings", () => {
  /**
   * ⛔ THE PAGE WAS FIXED AND THIS SURFACE WAS NOT, which is the same defect twice. Reported by an
   * author reading the output: a pick "could reasonably be read as deleting the sibling statement
   * it does not touch".
   *
   * ⛔ AND THE ADVICE WAS ACTIVELY DESTRUCTIVE. With `of:` set, `settle` replaces the named
   * statement and leaves its siblings byte-identical — so `--pick` is right. The CLI instead said
   * "a ruling here becomes the whole sentence — so write the one you want, keeping what is already
   * agreed", which would have a reviewer retype four statements and overwrite the three nobody
   * asked about.
   */
  const { dir, scope } = corpusWithFour();
  const out = execFileSync(process.execPath, [path.resolve("dist/cli/index.js"), "v2", "decide", scope, "--at", dir], {
    encoding: "utf-8",
  });

  assert.match(out, /this one is unruled/, "the CLI does not mark which statement is in question");
  assert.match(out, /replaces the marked statement only/, "the CLI does not say what a pick replaces");
  assert.match(out, /--pick N/, "the CLI does not offer the pick that is actually safe");
  assert.doesNotMatch(
    out,
    /write the one you want, keeping what is already agreed/,
    "⛔ the CLI still tells a reviewer to retype the merged sentence, overwriting the siblings"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
