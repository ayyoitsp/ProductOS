/**
 * ⛔ FOUR MORE THINGS AUTHORS COULD NOT SAY, ALL FOUND BY SCOPING A REAL PRODUCT.
 *
 * Six scopers re-scoped v1-migrated Bilrost features — promises that arrived with only `answer`
 * filled — against the product's own code. Each filed framework gaps for what the model gave it no
 * way to express, with `forced_into` naming where the content had to go meanwhile.
 *
 *   fg-0001  a leaf reads a word a SIBLING sets, and could declare none of them
 *   fg-0006  a leaf SETS a word a sibling reads — the same wall from the other side
 *   fg-0007  `when.follows` was one ref, so machinery with five callers named one
 *   fg-0008  a standing could not attach to ONE statement of a multi-statement slot
 *
 * ⛔ fg-0001 AND fg-0006 ARE ONE GAP SEEN TWICE, which is why they are fixed together. Two
 * findings — `nothing-in-this-product-sets-this` and `nothing-reads-what-this-sets` — each offered
 * exactly two exits: a behaviour is missing, or the word crosses the product's edge. Neither is
 * true when the other half is **another feature in the same corpus**, and a scoper may not read a
 * sibling's scope, so it could not clear the finding truthfully even knowing the answer.
 *
 * ⛔ AND THE FIX IS A DECLARATION, NOT A CHANGE TO REACH. fg-0001 was deliberately left open for a
 * session because widening `vocabularyReach` to follow the reverse `depends_on` edge would change
 * which org-wide rules select which exchanges in every corpus — its own text warned it would
 * "silently change which org-wide rules reach the exchange while reporting a clean corpus".
 * `set_by` / `read_by` change nothing about reach. They record who the other half is, and the ref
 * is resolved, so naming nothing is refused rather than silencing the finding.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { Scope } = await import(path.resolve("dist/v2/schema.js"));

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

const machinery = (when) => ({
  id: "tick",
  title: "Something sets this off",
  asked_by: "system",
  when,
  slots: { answer: { says: "The thing moves on." } },
});

/** ⛔ fg-0007 */
test("machinery can name every caller that sets it off, not just one", () => {
  const one = Scope.safeParse({
    ...base(),
    exchanges: [machinery({ triggered_by: "the clock", cadence: "repeating", follows: "other#ask" })],
  });
  assert.equal(one.success, true, `a single ref stopped parsing: ${JSON.stringify(one.error?.issues)}`);

  const five = Scope.safeParse({
    ...base(),
    exchanges: [
      machinery({
        triggered_by: "five features ask for it",
        cadence: "on-an-event",
        follows: ["a#one", "b#two", "c#three", "d#four", "e#five"],
      }),
    ],
  });
  assert.equal(
    five.success,
    true,
    `machinery with five callers still cannot say so: ${JSON.stringify(five.error?.issues)}`
  );
});

/**
 * ⛔ ONE REF STILL READS AS A LIST. If the transform were missing, every reader would need to know
 * about both spellings and three of the four would have been written to handle only one.
 */
test("one ref and several refs arrive in the same shape", () => {
  const one = Scope.parse({
    ...base(),
    exchanges: [machinery({ triggered_by: "the clock", cadence: "repeating", follows: "other#ask" })],
  });
  assert.deepEqual(one.exchanges[0].when.follows, ["other#ask"], "a single ref did not normalise to a list");
});

/** ⛔ fg-0001 and fg-0006 */
test("a term can say which sibling sets it, and which reads it", () => {
  const r = Scope.safeParse({
    ...base(),
    terms: {
      confidence: {
        means: "how sure the read was of this value",
        read_by: ["review-the-rows", "read-the-exception-log"],
      },
      "a resolved limit": {
        means: "the limit that answered, and which layer answered it",
        set_by: ["limit-resolution#resolves-per-field-not-per-option"],
      },
    },
  });
  assert.equal(r.success, true, `a sibling still cannot be named: ${JSON.stringify(r.error?.issues)}`);

  /** Naming nobody is not an answer. */
  const empty = Scope.safeParse({
    ...base(),
    terms: { thing: { means: "a thing of some kind", read_by: [] } },
  });
  assert.equal(empty.success, false, "`read_by: []` was accepted, which clears a finding by saying nothing");
});

/**
 * ⛔ THE ONE THAT MATTERS: does declaring it actually answer the finding, and is the claim CHECKED?
 * A field the finding ignores is decoration; a field the finding accepts without resolving the ref
 * is a way to silence a check by naming anything.
 */
test("declaring the sibling clears the finding, and a sibling that is not there is refused", () => {
  const dir = path.join(temp("v2sib-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

  const write = (terms) =>
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
${terms}
exchanges:
  - id: tick
    title: A day goes by
    asked_by: system
    when:
      triggered_by: the clock, once a day
      cadence: repeating
    changes: [tally]
    slots:
      answer:
        says: The tally moves on by one.
---

Machinery nobody presses.
`
    );

  const check = () => {
    try {
      return execFileSync("node", [CLI, "v2", "check", "--at", dir], { encoding: "utf-8" });
    } catch (e) {
      return (e.stdout ?? "") + (e.stderr ?? "");
    }
  };

  /** Undeclared: the finding fires, which is what makes the rest of this test meaningful. */
  write("  tally:\n    means: the running count this machinery keeps");
  const before = check();
  assert.match(
    before,
    /nothing-reads-what-this-sets/,
    "the finding this field answers did not fire undeclared, so clearing it proves nothing"
  );

  /** Declared, pointing at a scope the seed really has. */
  write("  tally:\n    means: the running count this machinery keeps\n    read_by: [money]");
  const after = check();
  assert.ok(
    !/nothing-reads-what-this-sets/.test(after),
    "naming the sibling that reads it did not clear the finding, so the field is decoration"
  );

  /** Declared, pointing at nothing. */
  write("  tally:\n    means: the running count this machinery keeps\n    read_by: [no-such-feature]");
  const bogus = check();
  assert.match(
    bogus,
    /says-a-sibling-reads-this-and-it-is-not-there/,
    "a sibling that does not exist was accepted, so the finding can be silenced by naming anything"
  );
});

/** ⛔ fg-0008 */
test("a standing can name the one statement it is about", () => {
  const r = Scope.safeParse({
    ...base(),
    views: [{ id: "here", title: "Here" }],
    exchanges: [
      {
        id: "do-it",
        title: "Doing it",
        asked_by: "person",
        at: { view: "here" },
        slots: {
          answer: {
            says: [
              { id: "first", says: "The first thing is true." },
              { id: "second", says: "The second thing is true." },
            ],
            standing: {
              kind: "open",
              question: "Does the second thing survive a second press, or is it left alone?",
              about: "whether the second thing survives a second press",
              /** ⛔ fg-0008: the standing is about ONE of the two statements. */
              of: "second",
              asked_of: "peter",
              cost: "a builder who guesses wrong makes a second press destructive, which nobody asked for",
              blocks: [],
              candidates: [
                {
                  says: "The second thing is true again.",
                  consequence: "a second press repeats it",
                  /**
                   * ⛔ THIS IS THE OTHER HALF OF fg-0008, AND IT IS WHY `of` MATTERS.
                   *
                   * `replaces` already offered "the whole sentence" or "only the part in question",
                   * and the schema's own message says why the second is bad: *"picking a fragment
                   * deletes the rest of what was agreed"* — so `decide` has to ask for the merged
                   * sentence and the reviewer retypes what they already agreed.
                   *
                   * With `of` naming the statement, "the whole sentence" is finally HONEST at the
                   * statement grain: it replaces all of `second` and leaves `first` byte-identical.
                   * Before this, a question about one of four sentences had no pickable answer.
                   */
                  replaces: "the whole sentence",
                },
                {
                  says: "The second thing is left alone.",
                  consequence: "a second press changes nothing",
                  replaces: "the whole sentence",
                },
              ],
            },
          },
        },
      },
    ],
  });
  assert.equal(r.success, true, `a standing cannot name its statement: ${JSON.stringify(r.error?.issues)}`);

  /** ⛔ And the ruling has to USE it — asserted on the source, because the write is what was broken. */
  const src = fs.readFileSync("src/v2/settle.ts", "utf-8");
  assert.match(
    src,
    /asked\?\.of && Array\.isArray\(slot\.says\)/,
    "a ruling still replaces the whole slot, so settling one sentence of four loses the other three"
  );
  assert.match(
    src,
    /no longer says it/,
    "a ruling whose named statement has gone does not refuse, so it would quietly append a new sentence"
  );
});
