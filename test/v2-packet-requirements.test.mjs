/**
 * ⛔ THE PACKET IS THE RELEASE, SO ITS REQUIREMENTS HAVE TO BE ADDRESSABLE.
 *
 * Peter: *"our initial product OS release is to produce an execution packet for a coding agent to
 * autonomously take end-to-end, implementing all the tests described. product os at this point
 * should only generate what the testing requirements are, with an identifier. that's the current
 * boundary"*.
 *
 * Before this, "What must be demonstrated" printed `- *answer* — given …, when …, then …` and
 * nothing more. Everything below is a thing that was wrong with that and is invisible without a
 * test, because the section LOOKED right — prose a person reads and nods at:
 *
 *   - no identifier, so nothing an agent wrote could be pointed back at the sentence it came from,
 *     and no surface could ever say which tests to revisit when truth moved
 *   - no hash, so the same
 *   - `of` dropped by the renderer, so a slot saying three things showed three criteria all
 *     labelled *answer* — the exact failure `of` was re-added to the schema to prevent
 *   - no count, so a packet missing half its requirements read as complete
 *
 * ⛔ And the obvious address was wrong, which is the finding worth keeping. The first cut used
 * `<scope>#<exchange>#<slot>#<case>` — `REF_MESSAGE` literally calls that last segment `<case>`.
 * `resolveRef` answers it with a named refusal first and a statement second, never a criterion:
 * `money#see-a-balance#answer#1` came back *"see-a-balance's answer has no 1"*. One address,
 * three meanings. Hence `#shows#`, and hence the test below that the printed ref resolves.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import { loadCorpus } from "../dist/v2/load.js";
import { compilePacket } from "../dist/v2/packet.js";
import { resolveRef } from "../dist/v2/ref.js";
import { checkCorpus } from "../dist/v2/check.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** A throwaway copy of the pristine seed, so a mutation cannot leak into another test. */
function seed() {
  const dir = temp("v2req-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

const MONEY = path.join("truth", "money.md");

/** Every `- \`<ref>\` \`<hash>\`` line, as {ref, hash}. */
function requirementsIn(packet) {
  return [...packet.matchAll(/^- `([^`]+#shows#[^`]+)` `(sha256:[0-9a-f]+)`/gm)].map((m) => ({
    ref: m[1],
    hash: m[2],
  }));
}

test("every testing requirement in a packet carries its own ref and the hash of its words", () => {
  const corpus = loadCorpus("v2-seed");
  const packet = compilePacket(corpus, "money");
  const reqs = requirementsIn(packet);

  assert.ok(reqs.length > 15, `only ${reqs.length} requirements found — the section stopped rendering`);

  // ⛔ The count in the manifest is what tells an agent the list is the whole job. If it can
  // disagree with the list, it is worse than absent.
  const claimed = Number(packet.match(/\*\*(\d+) testing requirements? below\.\*\*/)?.[1]);
  assert.equal(claimed, reqs.length, "the manifest count and the printed requirements disagree");

  // One address per requirement. A duplicate means two tests would claim the same sentence.
  assert.equal(new Set(reqs.map((r) => r.ref)).size, reqs.length, "two requirements share an address");

  // ⛔ Distinct hashes for distinct words. One hash over the whole set is what `Covered.criteria`
  // already does and is the thing this is NOT — see `requirementHash`.
  assert.equal(new Set(reqs.map((r) => r.hash)).size, reqs.length, "two differently-worded requirements hash alike");

  // Each requirement's section also says how many it contains.
  assert.match(packet, /What must be demonstrated — \d+ requirements?:/);
});

/**
 * ⛔ THE IDEMPOTENCE PIN, AND THE WHOLE REASON THE HASH IS PER-REQUIREMENT.
 *
 * `Covered.criteria` hashes the criteria as a SET, deliberately — that answers "has anything about
 * what must be demonstrated here moved since a human agreed". Reword one `then` and all of them
 * look stale, so nobody can tell which test to revisit and in practice nobody revisits any.
 */
test("rewording one requirement moves that requirement's hash and no other", () => {
  const dir = seed();
  const f = path.join(dir, MONEY);
  const before = fs.readFileSync(f, "utf-8");
  const original = "then: the kid has $12.50, and tidying is at the top of their history dated today";
  assert.ok(before.includes(original), "seed shape moved — re-aim this test");

  const was = requirementsIn(compilePacket(loadCorpus(dir), "money"));
  fs.writeFileSync(f, before.replace(original, "then: the kid has $12.50, and tidying is in their history"));
  const now = requirementsIn(compilePacket(loadCorpus(dir), "money"));

  assert.equal(now.length, was.length, "rewording a requirement changed how many there are");
  const moved = now.filter((r, i) => r.hash !== was[i].hash);
  assert.equal(moved.length, 1, `${moved.length} hashes moved — a reword must be traceable to one requirement`);
  assert.equal(moved[0].ref, "money#record-earning#shows#1");

  // ⛔ And the ref is stable across the reword. An identifier that changes when the words change
  // cannot tell a consumer "this is the same requirement, worded differently" — which is the only
  // thing it is for.
  assert.equal(now[0].ref, was[0].ref);
});

test("the ref a packet hands a builder resolves to exactly that requirement", () => {
  const corpus = loadCorpus("v2-seed");
  const packet = compilePacket(corpus, "money");

  /**
   * ⛔ ASSERTED NON-EMPTY, BECAUSE THIS TEST PASSED WITH THE DEFECT PUT BACK.
   *
   * Restoring the anonymous `- *answer* — given …` line made `requirementsIn` return nothing, the
   * loop below ran zero times, and the two explicit assertions after it still held — so a packet
   * carrying no addressable requirement at all reported this green. A loop over a list that can be
   * empty is not a test of the list.
   */
  const reqs = requirementsIn(packet);
  assert.ok(reqs.length > 15, `only ${reqs.length} requirements — nothing below is being tested`);

  for (const { ref } of reqs) {
    const out = resolveRef(corpus, ref);
    assert.ok(!out.error, `the packet printed ${ref} and nothing can resolve it: ${out.error}`);
    assert.equal(out.ref.kind, "requirement", `${ref} resolved as ${out.ref.kind}`);
    assert.equal(out.ref.id, ref);
  }

  // ⛔ The spelling that LOOKS right, pinned as wrong on purpose. `<slot>#<case>` resolves a named
  // refusal and then a statement, so a requirement addressed that way means whatever matched first.
  const collides = resolveRef(corpus, "money#see-a-balance#answer#1");
  assert.ok(collides.error, "`<scope>#<exchange>#<slot>#<id>` resolved a criterion — the grains have collided");

  // A requirement id that is not there says so, naming the ones that are.
  const missing = resolveRef(corpus, "money#record-earning#shows#99");
  assert.match(missing.error ?? "", /has no requirement "99" — it has 1, 2/);
});

/**
 * ⛔ `of` WAS IN THE SCHEMA, CHECKED BY NOTHING, AND THROWN AWAY BY THE RENDERER.
 *
 * Its own schema comment records v1 losing this field in the migration, and that flattening
 * thirty-one cases onto one statement showed a reviewer the evidence for all thirteen claims. The
 * field came back. `packet.ts` then printed `c.slot` and never `c.of`, so the defect was
 * reproduced in the artifact a builder implements, with the fix sitting unused one file away.
 */
test("a requirement on a slot saying several things names which one, or the packet says it did not", () => {
  const dir = seed();
  const f = path.join(dir, MONEY);
  const before = fs.readFileSync(f, "utf-8");
  const one = `      answer:
        says: >
          What the kid has now, and everything recorded against them most recent first,
          each with the day, what it was for, and the amount.`;
  assert.ok(before.includes(one), "seed shape moved — re-aim this test");
  const several = `      answer:
        says:
          - id: the-figure
            says: What the kid has now.
          - id: the-history
            says: >
              Everything recorded against them most recent first, each with the day, what it
              was for, and the amount.`;

  // No `of` on either criterion: the packet must say so rather than implying both are covered.
  fs.writeFileSync(f, before.replace(one, several));
  let packet = compilePacket(loadCorpus(dir), "money");
  assert.match(packet, /\*\*answer says 2 things and this names none of them\.\*\*/);

  // ⛔ And `check` counts it, so it is visible before anybody compiles a packet.
  const notes = checkCorpus(dir).findings.filter((x) => x.kind === "requirement-names-no-statement");
  assert.ok(notes.length >= 2, `check found ${notes.length} — a slot saying several things with no pointer is silent`);
  assert.match(notes[0].where, /#shows#/);

  // With `of`, the packet names the sentence being demonstrated — and the one nothing reaches.
  fs.writeFileSync(
    f,
    before
      .replace(one, several)
      .replace(
        "        then: the three are listed most recent first, each with the day, what it was for, and the amount",
        "        of: the-history\n        then: the three are listed most recent first, each with the day, what it was for, and the amount"
      )
  );
  packet = compilePacket(loadCorpus(dir), "money");
  assert.match(packet, /demonstrates \*\*answer\*\* `the-history`/);
  assert.match(packet, /nothing demonstrates `answer` `the-figure`/);
  assert.match(packet, /stated sentences? inside a slot/);
});

/**
 * ⛔ ON A MULTI-STATEMENT SLOT ONLY, AND THE FIRST VERSION OF THIS TEST PINNED A BUG.
 *
 * It added a bad `of` to a criterion on the seed's `answer`, which says ONE bare sentence, and
 * asserted the refusal. `statements()` normalises a bare sentence into one statement whose id is
 * the literal string `it` — so the refusal fired for the wrong reason, and it fired on every `of`
 * ever written against a single-statement slot. Run against the real Bilrost corpus: 67 refusals,
 * each reading *"names `x`, and `answer` says only it"*, blocking a handover on a corpus nothing
 * had previously complained about.
 *
 * Where a slot says one thing, a pointer is redundant, not ambiguous — there is nothing a builder
 * could fail to tell apart. The test now sets up the condition the refusal is actually about.
 */
test("a requirement pointing at a statement that is not there is refused, not guessed", () => {
  const dir = seed();
  const f = path.join(dir, MONEY);
  const before = fs.readFileSync(f, "utf-8");
  const one = `      answer:
        says: >
          What the kid has now, and everything recorded against them most recent first,
          each with the day, what it was for, and the amount.`;
  const several = `      answer:
        says:
          - id: the-figure
            says: What the kid has now.
          - id: the-history
            says: Everything recorded against them, most recent first.`;
  assert.ok(before.includes(one), "seed shape moved — re-aim this test");
  fs.writeFileSync(
    f,
    before
      .replace(one, several)
      .replace(
        "        then: the three are listed most recent first, each with the day, what it was for, and the amount",
        "        of: a-sentence-nobody-wrote\n        then: the three are listed most recent first, each with the day, what it was for, and the amount"
      )
  );
  const refusals = checkCorpus(dir).findings.filter((x) => x.kind === "requirement-points-at-nothing");
  assert.equal(refusals.length, 1, "a requirement naming a statement that does not exist passed unmentioned");
  assert.equal(refusals[0].severity, "refuse");

  // ⛔ And a pointer on a slot that says ONE thing is silent. This is the regression that cost a
  // real corpus 67 refusals; `it` is a synthetic id no author ever typed.
  const redundant = seed();
  const g = path.join(redundant, MONEY);
  fs.writeFileSync(
    g,
    fs
      .readFileSync(g, "utf-8")
      .replace(
        "        then: the three are listed most recent first, each with the day, what it was for, and the amount",
        "        of: whatever-an-author-happened-to-write\n        then: the three are listed most recent first, each with the day, what it was for, and the amount"
      )
  );
  assert.equal(
    checkCorpus(redundant).findings.filter((x) => x.kind === "requirement-points-at-nothing").length,
    0,
    "a redundant pointer on a single-statement slot is refused as if it were ambiguous"
  );
});

/**
 * ⛔ "IMPLEMENT ALL THE TESTS DESCRIBED" IS NOT AN INSTRUCTION OVER A LIST THAT MIGHT BE SHORT.
 *
 * The holes banner counts UNSETTLED TRUTH — slots nobody has decided. How much of the SETTLED
 * truth has nothing demonstrating it is a different question, and it was answered nowhere in the
 * artifact an agent is handed.
 */
test("a stated behaviour with no requirement at all is counted in the packet's manifest", () => {
  const packet = compilePacket(loadCorpus("v2-seed"), "money");
  assert.match(packet, /stated behaviour has no requirement at all.*money#see-a-balance#at_once/s);

  // ⛔ The packet and `check` must agree about which slots those are — one predicate, one home.
  const bare = new Set(
    checkCorpus("v2-seed")
      .findings.filter((x) => x.kind === "nothing-demonstrates-this")
      .map((x) => x.where)
  );
  const counted = [...(packet.match(/money#[a-z-]+#[a-z_]+(?=\))/g) ?? [])];
  for (const c of counted) assert.ok(bare.has(c), `the packet counts ${c} as bare and check does not`);
});
