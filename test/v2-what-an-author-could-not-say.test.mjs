/**
 * ⛔ FOUR THINGS AUTHORS COULD NOT SAY, FOUND BY AUTHORS SAYING THEM BADLY INSTEAD.
 *
 * Two scopers re-scoped `pin-a-version` and `limit-resolution` — v1-migrated features that arrived
 * with only `answer` filled — and between them took 105 blank slots to zero against the real
 * product's code. Each filed framework gaps for the things the model gave them no way to express,
 * and crucially each recorded `forced_into`: where the content went meanwhile. That field is what
 * makes this testable, because it names the duplication the gap caused.
 *
 *   fg-0002  a rule owes a conformance criterion, and criteria are not the author's layer — so
 *            `may` and `refuses` were written by hand onto ALL EIGHT exchanges of limit-resolution
 *   fg-0003  nothing says a feature has no screen of its own, so "It has no screen of its own."
 *            was appended to the `may` slot of all eight
 *   fg-0004  a word cannot be recorded as contested, so a four-way name collision was left out of
 *            truth entirely and reported in prose
 *   fg-0005  `asked_by: person` demands a view in this scope, so two reader actions stayed filed
 *            as machinery with `happy_path.through` empty
 *
 * ⛔ fg-0002 WAS NEVER A MODEL GAP AT ALL, which is the most useful of the four. The schema had
 * already moved that refusal to `check` so an author COULD write a rule with `criteria: []` — and
 * the scoper's instructions still said "Without one the schema refuses it outright." The model was
 * right and the instruction was two versions stale, so a capable author reasoned correctly from
 * false premises and duplicated one sentence eight times. That is the failure mode CLAUDE.md names
 * as the most-missed layer, caught here by an agent rather than by a reader.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { Scope } = await import(path.resolve("dist/v2/schema.js"));

/** A minimal scope, so each test changes exactly one thing. */
const base = () => ({
  id: "thing",
  title: "A thing",
  happy_path: {
    accomplishes: "somebody gets a thing done here",
    brings: "the thing they want done",
    ends_with: "the thing is done",
  },
  exchanges: [],
});

const personAsk = (at) => ({
  id: "do-it",
  title: "Doing it",
  asked_by: "person",
  at,
  slots: { answer: { says: "It is done." } },
});

/** ⛔ fg-0005 */
test("a person's ask may name a screen that belongs to another scope", () => {
  const local = Scope.safeParse({ ...base(), views: [{ id: "here", title: "Here" }], exchanges: [personAsk({ view: "here" })] });
  assert.equal(local.success, true, `a local view stopped parsing: ${JSON.stringify(local.error?.issues)}`);

  const cross = Scope.safeParse({ ...base(), exchanges: [personAsk({ view_in: "other-feature#their-screen" })] });
  assert.equal(
    cross.success,
    true,
    `a person's ask whose screen is in another scope is still refused, so it stays filed as machinery: ${JSON.stringify(
      cross.error?.issues
    )}`
  );
});

test("a person's ask still cannot arrive nowhere, and cannot claim two screens", () => {
  /** ⛔ Widening is not removing — the guarantee is "arrives somewhere nameable". */
  const nowhere = Scope.safeParse({ ...base(), exchanges: [personAsk(undefined)] });
  assert.equal(nowhere.success, false, "a person-asked exchange with no screen at all was accepted");
  assert.match(JSON.stringify(nowhere.error.issues), /view_in/, "the refusal does not mention the new form, so an author will not find it");

  const both = Scope.safeParse({
    ...base(),
    views: [{ id: "here", title: "Here" }],
    exchanges: [personAsk({ view: "here", view_in: "other#there" })],
  });
  assert.equal(both.success, false, "an ask claiming a local AND a foreign screen was accepted");
});

/** ⛔ fg-0003 */
test("a feature can say it has no screen of its own, and must give the reason", () => {
  const said = Scope.safeParse({ ...base(), no_screen: "reached only from other features, never opened directly" });
  assert.equal(said.success, true, `a feature cannot say it has no screen: ${JSON.stringify(said.error?.issues)}`);

  /**
   * ⛔ A REASON, NOT A BOOLEAN. `true` is an assertion with nothing behind it; a sentence is
   * checkable against the exchanges.
   */
  const bare = Scope.safeParse({ ...base(), no_screen: true });
  assert.equal(bare.success, false, "`no_screen: true` was accepted, so the reason is optional in practice");
  const terse = Scope.safeParse({ ...base(), no_screen: "n/a" });
  assert.equal(terse.success, false, "a throwaway reason was accepted");
});

/** ⛔ fg-0004 */
test("a word can be recorded as contested, naming what it collides with", () => {
  const contested = Scope.safeParse({
    ...base(),
    terms: {
      "version selection": {
        means: "the one version choice held at a deal",
        contested: {
          question: "Does `model revision` name the same object as `master model version`, or a different one?",
          with: ["model revision", "master model version", "input version"],
        },
      },
    },
  });
  assert.equal(
    contested.success,
    true,
    `a contested word still has nowhere to live, so the collision stays out of truth: ${JSON.stringify(
      contested.error?.issues
    )}`
  );

  /** ⛔ "Contested" without saying against what is a feeling, not a finding. */
  const vague = Scope.safeParse({
    ...base(),
    terms: { thing: { means: "a thing of some kind", contested: { question: "is this contested?", with: [] } } },
  });
  assert.equal(vague.success, false, "a contested word naming nothing it collides with was accepted");
});

/**
 * ⛔ fg-0002 — ASSERTED ON THE INSTRUCTION, because that is where the defect was. The schema was
 * already right; the scoper was told the opposite and believed it, which is why one sentence landed
 * eight times. A test on the schema alone would have passed throughout.
 */
test("the scoper is no longer told that a rule it cannot write is refused by the schema", () => {
  const src = fs.readFileSync("agents/productos-scoper.md", "utf-8");
  assert.ok(
    !/Without one the schema refuses/.test(src),
    "the scoper is still told the schema refuses a rule with no conformance criterion — it does not, and believing it means writing one rule out N times by hand"
  );
  assert.match(
    src,
    /criteria: \[\]/,
    "nothing tells the scoper what to write instead, so it still has no way to author a rule"
  );
  assert.match(
    src,
    /demonstrator/,
    "the instruction does not say who does write the conformance criterion"
  );
});

/** And a corpus using all three new fields loads through the real reader, not just the parser. */
test("a corpus using all of them loads", async () => {
  const dir = path.join(temp("v2says-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.writeFileSync(
    path.join(dir, "truth", "machinery.md"),
    `---
id: machinery
title: Machinery
in: family-wallet
no_screen: reached only from other features, never opened directly
happy_path:
  accomplishes: the tally keeps up with the day
  brings: the day it is now
  ends_with: the tally matches the day
terms:
  tally:
    means: the running count this machinery keeps
    contested:
      question: Is \`tally\` the same object as \`balance\` elsewhere in this corpus?
      with: [balance]
exchanges:
  - id: tick
    title: A day goes by
    asked_by: system
    when:
      triggered_by: the clock, once a day
      cadence: repeating
    slots:
      answer:
        says: The tally moves on by one.
---

Machinery nobody presses.
`
  );
  const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
  const corpus = loadCorpus(dir);
  const mine = corpus.scopes.find((s) => s.scope.id === "machinery");
  assert.ok(mine, `the scope did not load at all. broken: ${JSON.stringify(corpus.broken)}`);
  assert.match(mine.scope.no_screen, /reached only from other features/, "no_screen did not survive the read");
  assert.ok(mine.scope.terms?.tally?.contested, "contested did not survive the read");
  assert.deepEqual(mine.scope.terms.tally.contested.with, ["balance"], "what it collides with did not survive");
});
