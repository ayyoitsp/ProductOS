/**
 * ⛔ SIX AUTHORS FILED THIS GAP INDEPENDENTLY, IN ONE CORPUS, IN ONE DAY.
 *
 * fg-0052, fg-0067, fg-0090, fg-0096, fg-0107, fg-0114. Every one had done the thing this model
 * asks for — the same authorization sentence was about to go on four to eight exchanges, so they
 * wrote it once as a rule — and `held_by` lived only on a `SlotFill`. The ids went into the rule's
 * prose, and those exchanges became invisible to "what can this role reach".
 *
 * ⛔ AND THE FINDING WENT QUIET AT THE SAME MOMENT, which is why six of them hit it rather than
 * one. `who-may-is-only-prose` fires on a slot whose `may` names nobody; a rule-supplied `may` is
 * not blank, so nothing complained. In one author's words: *"the recommended shape is the one that
 * silently loses the permission enumeration."*
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));

/** A product with roles, one exchange whose `may` is a sentence, and a rule that supplies it. */
function corpusWithRule({ held = "[org-loan-manage]", onSlot = false } = {}) {
  /**
   * ⛔ BUILT AS A STRING, NOT AN INLINE TERNARY. Interpolating escaped newlines into a YAML block
   * produced "incomplete explicit mapping pair" and the scope silently did not load — so the
   * finding reported nothing and two tests passed for the wrong reason until I looked.
   */
  const mayBlock = [
    "      may:",
    "        says: Only somebody the deal has been given to may change it.",
    ...(onSlot ? ["        held_by: [org-loan-manage]"] : []),
  ].join("\n");
  const dir = path.join(temp("heldby-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.writeFileSync(
    path.join(dir, "access.yaml"),
    `access:\n  - id: org-loan-manage\n    kind: permission\n    means: may act on a deal and the documents under it\n`
  );
  fs.writeFileSync(
    path.join(dir, "truth", "lending.md"),
    `---
id: lending
title: Lending
in: family-wallet
exists: kept
terms:
  deal:
    means: one borrower's request, from first contact to funding
exchanges:
  - id: change-it
    title: Changing it
    asked_by: person
    at: { view: a-screen }
    reads: [deal]
    changes: [deal]
    slots:
      answer:
        says: The change is recorded against the deal.
${mayBlock}
views:
  - id: a-screen
    title: A screen
    view_kind: list
    sketch: |
      [ a screen ]
---

# Lending

One exchange whose may slot is a sentence and no ids.
`
  );
  if (!onSlot) {
    fs.mkdirSync(path.join(dir, "rules"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "rules", "who-may-change-a-deal.md"),
      `---
id: who-may-change-a-deal
in: family-wallet
fills: [may]
mode: supplies
statement: Only somebody the deal has been given to may change what it is measured against.
held_by: ${held}
why: The same sentence was about to go on every act that changes a deal.
scope:
  asked_by: person
  term: deal
  acts_on: changes
---

# Who may change a deal
`
    );
  }
  return dir;
}

test("a rule can name who holds the `may` it supplies", () => {
  const dir = corpusWithRule();
  const corpus = loadCorpus(dir);
  const rule = corpus.rules.find((r) => r.rule.id === "who-may-change-a-deal");

  /** ⛔ The non-zero first: the field exists and survives a round trip through the loader. */
  assert.ok(rule, "the rule did not load");
  assert.deepEqual(rule.rule.held_by, ["org-loan-manage"], "a rule cannot carry held_by");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("and the exchange it reaches is no longer told its `may` is only prose", () => {
  /**
   * ⛔ THE HALF THAT KEPT IT HIDDEN. The author who writes the rule cannot clear this finding on
   * the exchanges without un-writing the rule, so it fired on work that was correct.
   */
  const dir = corpusWithRule();
  const prose = checkCorpus(dir).findings.filter(
    (f) => f.kind === "who-may-is-only-prose" && f.where.startsWith("lending#change-it")
  );
  assert.deepEqual(prose, [], "⛔ the exchange is still told its `may` names nobody, with a rule naming somebody");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a rule naming a permission the product does not have is refused", () => {
  /**
   * ⛔ OR THE ENUMERATION IS DECORATIVE. Same refusal as on a slot, and it matters more here: a
   * rule reaches every exchange its selector touches, so one bad id is wrong on all of them.
   */
  const dir = corpusWithRule({ held: "[org-loan-manage, a-permission-nobody-declared]" });
  const said = checkCorpus(dir).findings.find(
    (f) => f.kind === "may-names-nothing" && f.where.startsWith("who-may-change-a-deal")
  );
  assert.ok(said, "a rule named a permission that does not exist and nothing refused it");
  assert.equal(said.severity, "refuse");
  assert.match(said.what, /a-permission-nobody-declared/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a slot's own held_by still works, so nothing was moved", () => {
  /**
   * ⛔ WITHOUT THIS, "the finding is quiet" passes on a check that stopped looking at slots. The
   * slot form is the common case and was never the problem.
   */
  const dir = corpusWithRule({ onSlot: true });
  /**
   * ⛔ SCOPED TO THIS EXCHANGE. Declaring an `access.yaml` at all moves the whole corpus off
   * `access: neither`, so the SEED's own exchanges start reporting prose — true of them, and
   * nothing to do with the claim here. My first version asserted over every finding and failed on
   * the fixture's neighbours.
   */
  const prose = checkCorpus(dir).findings.filter(
    (f) => f.kind === "who-may-is-only-prose" && f.where.startsWith("lending#change-it")
  );
  assert.deepEqual(prose, [], "a slot's own held_by stopped satisfying the finding");
  fs.rmSync(dir, { recursive: true, force: true });
});
