/**
 * ⛔ MY OWN REGRESSION, FOUND BY AN AUTHOR READING THE OUTPUT.
 *
 * Surfacing contested words at all was the fix for a field no surface read. They then landed in
 * `decide`'s generic no-candidates branch, which says *"ask whoever is scoping this to add
 * `candidates` to the standing"* — and a contested word HAS no standing. `Term.contested` is
 * `{question, with}`, strictly. There is nowhere for a candidate to go, so the advice could not be
 * followed by anybody. Filed as a gap: advice the schema refuses.
 *
 * ⛔ AND THE ANSWER IS A DIFFERENT KIND OF THING. Every other question in the queue chooses between
 * behaviours. This one decides which sense of a word the product means, after which the scopes
 * using the losing names are corrected — so "pick one" would be the surface pretending this
 * question has the shape of the others.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

function corpusWithContestedWord() {
  const dir = temp("cword-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "balances.md"),
    `---
id: balances
title: Balances
in: family-wallet
exists: kept
terms:
  balance:
    means: what is in the pot right now, before anything in flight settles
    contested:
      question: Is a balance the settled figure, or the figure including money in flight?
      with: [available, cleared, spendable]
---

# Balances

What a kid's money adds up to.
`
  );
  return dir;
}

const decide = (dir) => {
  try {
    return execFileSync("node", [CLI, "v2", "decide", "balances", "--at", dir], { encoding: "utf-8" });
  } catch (e) {
    return String(e.stdout ?? "");
  }
};

test("a contested word is not told to add candidates it cannot hold", () => {
  const dir = corpusWithContestedWord();
  const out = decide(dir);

  /** ⛔ The non-zero first: the question is actually reaching the queue. */
  assert.match(out, /contested/i, "the contested word did not reach the queue at all");
  assert.doesNotMatch(
    out,
    /add\s*\n?\s*`?candidates`?/,
    "⛔ it still tells the reader to add `candidates` to a standing that does not exist"
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("it says what ruling it actually needs, and what happens after", () => {
  const dir = corpusWithContestedWord();
  const out = decide(dir);
  assert.match(out, /naming collision, not a choice between behaviours/);
  assert.match(out, /which sense the/, "it does not say what the answer decides");
  assert.match(out, /corrected to match/, "it does not say what follows the ruling");
  assert.match(out, /available, cleared, spendable/, "it does not say which words it collides with");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an ordinary undrafted question still gets the ordinary advice", () => {
  /**
   * ⛔ WITHOUT THIS THE FIX IS A BLANKET REWORDING. The generic branch is right for a slot standing
   * with no candidates — there, `candidates` IS the thing missing and asking for them is correct.
   *
   * ⛔ AND THE SLOT HAS TO SAY NOTHING. A slot that says something AND carries a standing needs an
   * `about`, which routes it down the revises path instead — so the branch under test is only
   * reachable from a slot nobody has written yet. Found by the test failing twice.
   */
  const dir = temp("cword-plain-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "plain.md"),
    `---
id: plain
title: Plain
in: family-wallet
exists: kept
exchanges:
  - id: do-it
    title: Doing it
    asked_by: person
    at: { view: a-screen }
    slots:
      answer:
        standing:
          kind: open
          question: What does the asker get? Nobody has said.
          asked_of: peter
          blocks: []
views:
  - id: a-screen
    title: A screen
    view_kind: list
    sketch: |
      [ a screen ]
---

# Plain

A question with nothing drafted.
`
  );
  let out;
  try {
    out = execFileSync("node", [CLI, "v2", "decide", "plain", "--at", dir], { encoding: "utf-8" });
  } catch (e) {
    out = String(e.stdout ?? "");
  }
  assert.match(out, /Nothing has been drafted for this/, "the ordinary advice was lost");
  assert.doesNotMatch(out, /naming collision/, "a slot standing was called a naming collision");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("it offers no command it cannot honour — neither to answer nor to park", () => {
  /**
   * ⛔ I SHIPPED TWO COMMANDS THAT ERROR, IN TWO SEPARATE PASSES AT THIS FEATURE.
   *
   * #148 surfaced contested words and minted a ref shape no verb accepts: `<scope>#<word>`, where
   * the word is the product's own multi-word phrase. #153 printed `v2 rule <that ref>` as the way
   * to answer it. An author found it on the ninth scope carrying one: *"a ref segment is
   * kebab-case, so every multi-word term is unanswerable."*
   *
   * ⛔ AND WHEN I FIXED THAT, THE `not now` LINE BESIDE IT HAD THE SAME REF. `defer` resolves to an
   * exchange and a slot; a word is neither. `schema.ts` already records somebody hitting exactly
   * this — *"a term is not a slot, so `defer` answered `no exchange \"completion\"`"* — so it was
   * known, written down, and I printed it anyway.
   *
   * Both halves are pinned here because fixing one and leaving its twin is what I did.
   */
  const dir = corpusWithContestedWord();
  const out = decide(dir);

  const offered = out.match(/productos v2 (rule|defer) \S+#[^\n]*/g) ?? [];
  const aboutTheWord = offered.filter((c) => /balance/.test(c));
  assert.deepEqual(
    aboutTheWord,
    [],
    `⛔ it offers a command against a word ref that no verb resolves: ${aboutTheWord.join(" | ")}`
  );
  /** And it says what to do instead, or the reviewer is left with nothing at all. */
  assert.match(out, /there is no command for this one/);
  assert.match(out, /cannot be parked/);
  fs.rmSync(dir, { recursive: true, force: true });
});
