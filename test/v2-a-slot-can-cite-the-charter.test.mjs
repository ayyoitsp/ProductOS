/**
 * ⛔ AN AUTHOR RESTATED ONE CHARTER SECTION IN TWO SLOTS, BECAUSE IT HAD NOWHERE TO POINT.
 *
 * Recorded as fg-0013, with `forced_into` naming the damage:
 *
 *     resolve-an-organizations-stages#…#fails and #…#fails — both restate the substance of the
 *     charter's "an unreadable value is said, not shown as absent"
 *
 * That is the duplication the first rule of this repo forbids — every fact has exactly one home —
 * and the author had no alternative. A slot could already say "a rule still holds here" with
 * `defers_to`; a charter section is the same kind of thing one level up and had no field at all.
 *
 * ⛔ `rests_on` IS A CITATION, NOT A GOVERNOR, and the tests below hold that line. A rule SUPPLIES
 * or CONSTRAINS a slot — it reaches in and changes what the slot promises. A charter section
 * settles a design argument and governs nothing mechanically. So `check` resolves the ref and
 * stops, and nothing derives a promise from it. A field that quietly started supplying answers
 * would be a second rule system with no selector and no conformance criterion.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));

/** A seed corpus, plus whatever `rests_on` the test wants on one slot. */
function corpusWith(restsOn) {
  const dir = path.join(temp("v2rests-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

  /**
   * ⛔ THE SEED CARRIES NO CHARTER, so the fixture writes one. There has to be a REAL section for a
   * citation to resolve to, or "a real section is accepted" is a claim about nothing.
   */
  /** ⛔ The seed does not create charter/ at all, so make it. */
  fs.mkdirSync(path.join(dir, "charter"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "charter", "decisions.md"),
    `---
id: decisions
title: Decisions
sections:
  - id: an-unreadable-value-is-said-not-shown-as-absent
    title: An unreadable value is said, not shown as absent
    says: >-
      Where this product cannot read a value, it says so. It never renders the gap as though the
      value were absent, because those are different facts and a reader acts differently on each.
---

The decisions this product has already taken.
`
  );

  const corpus = loadCorpus(dir);
  const entry = corpus.scopes.find((s) => s.scope.exchanges?.length);
  assert.ok(entry, "the seed states no scope with exchanges");
  const ex = entry.scope.exchanges[0];

  /** ⛔ Edited through the file, so this exercises the real reader rather than an object literal. */
  const text = fs.readFileSync(entry.file, "utf-8");
  const line = restsOn === null ? "" : `\n        rests_on: [${restsOn}]`;
  const patched = text.replace(
    /^(\s+)answer:$/m,
    (_m, indent) => `${indent}answer:${line}`
  );
  /**
   * ⛔ Only when something was actually inserted. With `restsOn === null` the replacement is a
   * no-op by design — that call exists to read the seed's charter — and the first version of this
   * guard fired on it, failing three tests over a fixture that was working.
   */
  if (restsOn !== null) assert.notEqual(patched, text, "the fixture did not find an `answer:` slot to edit");
  fs.writeFileSync(entry.file, patched);
  return { dir, ref: `${entry.scope.id}#${ex.id}`, charter: corpus.charter };
}

const check = (dir) => {
  try {
    return execFileSync("node", [CLI, "v2", "check", "--at", dir], { encoding: "utf-8" });
  } catch (e) {
    return (e.stdout ?? "") + (e.stderr ?? "");
  }
};

test("the seed has a charter section to cite, or this fixture proves nothing", () => {
  const { charter } = corpusWith(null);
  assert.ok(charter.length, "the seed carries no charter, so nothing here could be cited");
  const first = charter[0];
  assert.ok(first.charter?.sections?.length, `the seed's charter "${first.charter?.id}" has no sections`);
});

test("a slot can cite the charter section it follows from", () => {
  const { charter: ch } = corpusWith(null);
  const doc = ch[0].charter;
  const ref = `${doc.id}#${doc.sections[0].id}`;

  const { dir } = corpusWith(JSON.stringify(ref));
  const out = check(dir);
  assert.ok(
    !/rests-on-nothing/.test(out),
    `a real charter section was rejected, so an author still has to restate it:\n${out}`
  );
  /** ⛔ And it loaded — a field the reader drops is a field only a hand-typed corpus has. */
  const corpus = loadCorpus(dir);
  const slot = corpus.scopes.flatMap((s) => s.scope.exchanges).map((e) => e.slots?.answer).find((f) => f?.rests_on);
  assert.ok(slot, "rests_on did not survive the read");
  assert.deepEqual(slot.rests_on, [ref], "rests_on came back as something else");
});

/**
 * ⛔ THE ONE THAT MATTERS. A citation pointing at nothing is WORSE than the restatement it
 * replaced: it tells a reader the sentence has a principle behind it and gives them no way to read
 * it. So the claim is checked, not taken.
 */
test("a citation that points at nothing is refused", () => {
  const { dir } = corpusWith('"no-such-charter#no-such-section"');
  const out = check(dir);
  assert.match(
    out,
    /rests-on-nothing/,
    `a charter section that does not exist was accepted, so the citation can point anywhere:\n${out.slice(0, 600)}`
  );
});

/** ⛔ And a RULE is not a charter section — `defers_to` is the field for that, and they differ. */
test("citing a rule where a charter section belongs is refused", () => {
  const { dir } = corpusWith('"some-rule-id"');
  const out = check(dir);
  assert.match(
    out,
    /rests-on-nothing/,
    "a bare id was accepted as a charter section, so `rests_on` and `defers_to` have started to blur"
  );
});

/**
 * ⛔ IT GOVERNS NOTHING. The packet prints the citation; no slot gains an answer from it. If this
 * ever changes, `rests_on` has become a rule system with no selector and no conformance criterion.
 */
test("the packet cites it and nothing derives a promise from it", () => {
  const { charter: ch } = corpusWith(null);
  const doc = ch[0].charter;
  const ref = `${doc.id}#${doc.sections[0].id}`;
  const { dir, ref: scopeRef } = corpusWith(JSON.stringify(ref));

  const packet = execFileSync("node", [CLI, "v2", "packet", scopeRef.split("#")[0], "--at", dir], {
    encoding: "utf-8",
  });
  assert.match(packet, /rest on, rather than restate/i, "the packet does not show what the sentence rests on");
  assert.match(packet, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the packet does not name the section");

  const src = fs.readFileSync("src/v2/check.ts", "utf-8");
  assert.ok(
    !/rests_on[\s\S]{0,400}?(supplies|constrains)/.test(src),
    "check has started treating `rests_on` as supplying or constraining a slot — that is `defers_to`'s job"
  );
});
