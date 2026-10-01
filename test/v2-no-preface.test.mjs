/**
 * ⛔ A FEATURE HAS NO STANDALONE PREFACE — IT HAS A PURPOSE SOMEBODY AGREED TO.
 *
 * Peter, reading create-deal: *"the 'what this feature is for' is the overview, the preface seems to
 * be unnecessary — should be constructed from the confirmed truths, not a standalone section that
 * may need to be regenerated. Let's just remove the preface for now."*
 *
 * Four paragraphs sat above "What this feature is for" saying the same things — what it is, where it
 * is reached from, what the form holds, what it does not do. Each of those is a sentence somebody
 * can agree to further down the page. Up there it was agreed to by nobody and could not be acted
 * on, which made the first thing a reviewer met the one part of the page they could not trust.
 *
 * ⛔ IT IS THE "ONE HOME" RULE, which is what this test is really holding. A paragraph restating the
 * behaviours is a second copy with no forcing function: reword a behaviour and the paragraph stays,
 * nothing detects it, and a reader cannot tell which is current. Deleting the render alone would
 * have been the worse half of the fix — the paragraphs stay in the corpus and every future scoper
 * goes on writing them — so the check and the scoper's instruction are pinned here too.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";
import { checkCorpus } from "../dist/v2/check.js";

const PREFACE =
  "Completing a task is how a kid turns a chore into pocket money. Reached from the task list, " +
  "which already knows whose task it is, so nothing here asks. It is one press and then a wait.";

/**
 * ⛔ The seed files are pure frontmatter with no closing delimiter and therefore no body, so giving
 * one a preface means closing the frontmatter first. Worth saying: the first version of this
 * inserted at `indexOf("\n---\n")`, which is -1 in these files, and happily wrote the paragraph
 * four characters in — producing an unparseable corpus the assertion then "passed" on.
 */
function withPreface(dir, file, prose) {
  const f = path.join(dir, "truth", file);
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace(/\s*$/, "") + "\n---\n\n" + prose + "\n");
  return dir;
}

function seeded() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2pref-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return withPreface(dir, "tasks.md", PREFACE);
}

test("a feature's preface is not rendered, and its purpose still is", () => {
  const dir = seeded();
  const corpus = loadCorpus(dir);
  assert.deepEqual(corpus.broken, [], "the fixture did not parse, so nothing below is evidence of anything");
  const html = renderScopePage(corpus, "tasks", { interactive: true, by: "a-person" });
  assert.ok(html, "no page was rendered at all");
  assert.ok(!html.includes("turns a chore into pocket money"),
    "a feature still renders a standalone preface above the thing somebody can agree to");
  assert.match(html, /What this feature is for/,
    "the purpose went with it — that is the overview, and it is the half that was meant to stay");
});

/**
 * ⛔ A GROUPING KEEPS ITS PROSE, and the exception proves the rule: a group has no happy path and no
 * behaviours of its own, so prose is the only thing it can say about itself. There it is the single
 * home rather than a duplicate of one.
 */
test("a grouping still renders its prose", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2pref2-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  withPreface(dir, "family-wallet.md", "A shared wallet two parents and two kids all see.");
  const html = renderScopePage(loadCorpus(dir), "family-wallet", { interactive: true, by: "a-person" });
  assert.match(html, /two parents and two kids all see/,
    "a grouping lost its prose, which is the only thing it can say about itself");
});

/**
 * ⛔ AND THE CORPUS IS TOLD, because removing the render without this leaves the paragraphs in place
 * and invisible — prose that reads as content to anybody opening the file and reaches no reader.
 */
test("a feature carrying a preface is reported, and a grouping is not", () => {
  /** ⛔ `checkCorpus` takes the directory and loads it itself — handing it a corpus silently fails. */
  const found = checkCorpus(seeded()).findings.filter((f) => f.kind === "a-preface-nobody-reads");
  assert.ok(found.length, "a feature carries prose nothing renders and no finding says so");
  assert.ok(found.every((f) => f.where !== "family-wallet"), "a grouping was reported, but its prose is still shown");
  assert.match(found[0].fix, /happy_path/, "the fix does not say where the content should go instead");
});

/** ⛔ The layer this project skips: a rule nothing tells the next author is a rule that comes back. */
test("the scoper is told not to write one", () => {
  const doc = fs.readFileSync("agents/productos-scoper.md", "utf-8");
  assert.match(doc, /no prose preface on a feature/i, "the role that writes scopes is not told this");
  assert.match(doc, /container is the exception/i, "it is not told that a grouping keeps its prose, so it will strip those too");
});
