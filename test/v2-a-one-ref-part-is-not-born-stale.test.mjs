/**
 * ⛔ A CAPABILITY SERVING EXACTLY ONE PROMISE WAS STALE FROM THE MOMENT IT WAS WRITTEN.
 *
 * `derived.from` is compared against two different functions depending on who wrote the thing:
 *
 *   · a requirement's  →  `claimHash(oneRef)`              — one sentence, one hash
 *   · a capability's   →  `servesHash(theWholeServesSet)`  — and `servesHash` WRAPS the list
 *
 * Wrapping means it never equals the bare hash, not even for a single-element set:
 *
 *     claimHash  (what `v2 claim <ref>` printed)   sha256:4be20645a387522f
 *     servesHash (what staleness compares against) sha256:a51da286359160ae
 *
 * And `v2 claim` chose between the two **by asking whether its argument contained a comma.** So a
 * part serving one promise — common, and correct — was handed the requirement's hash and read
 * `a-part-older-than-what-it-serves` immediately and forever.
 *
 * ⛔ FOUND BY A DECOMPOSER DOING THE WORK, NOT BY READING THE CODE. Fanned over the Bilrost corpus,
 * it reported: *"any offering with exactly one `serves` entry reads stale immediately. Two of mine
 * did until I computed `servesHash` directly."* Nothing in the suite had ever written a capability
 * with one `serves` entry and then asked whether it was stale.
 *
 * ⛔ THE COUNT OF REFS CANNOT CARRY THE DISTINCTION, which is the actual lesson. A comma is
 * punctuation, not an intent — so `--serves` says which hash is wanted and a single ref is no
 * longer a different question from two.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

const dir = path.join(temp("v2stale-"), "v2");
execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { servesHash } = await import(path.resolve("dist/v2/demonstrate.js"));
const { claimHash } = await import(path.resolve("dist/v2/stamp.js"));

const corpus = loadCorpus(dir);
const scope = corpus.scopes.find((s) => s.scope.exchanges?.length)?.scope;
const exchange = scope?.exchanges?.[0];
const slots = exchange ? Object.keys(exchange.slots ?? {}) : [];
const one = `${scope?.id}#${exchange?.id}#${slots[0]}`;
const two = `${scope?.id}#${exchange?.id}#${slots[1]}`;

const claim = (args) =>
  execFileSync("node", [CLI, "v2", "claim", ...args, "--at", dir], { encoding: "utf-8" }).trim();

test("the seed gives us an exchange with at least two slots", () => {
  /** ⛔ First — every comparison below is vacuous if these are undefined. */
  assert.ok(scope && exchange, "the seed states no scope with exchanges");
  assert.ok(slots.length >= 2, `${scope.id}#${exchange.id} states ${slots.length} slot(s), need 2`);
});

/**
 * ⛔ THE DEFECT, STATED AS THE EQUALITY THAT HAS TO HOLD. Not "the flag exists" — that a part with
 * ONE serves entry gets the number its own staleness check will look for.
 */
test("a one-ref `serves` set hashes as staleness will compare it", () => {
  const printed = claim([one, "--serves"]);
  const compared = servesHash(corpus, [one]);
  assert.equal(
    printed,
    compared,
    "a capability serving one promise records a hash nothing will ever match, so it is stale the moment it is written"
  );
});

/** And the requirement's grain is untouched — widening one use must not move the other. */
test("a bare ref still gives the requirement's own hash", () => {
  assert.equal(
    claim([one]),
    claimHash(corpus, one),
    "the demonstrator's grain moved, so every existing criterion would read stale"
  );
});

/**
 * ⛔ AND THE TWO ARE STILL DIFFERENT NUMBERS. If `--serves` were implemented by returning the bare
 * hash for a single ref, the test above would pass and every one-ref part would still be stale —
 * because `servesHash` is what the check calls, and it wraps.
 */
test("the two grains do not collapse into one answer", () => {
  assert.notEqual(
    claim([one, "--serves"]),
    claim([one]),
    "`--serves` returned the bare claim hash, which is the bug it exists to fix"
  );
});

/** The comma shorthand keeps working, and agrees with the flag. */
test("several refs hash as a set, with or without the flag", () => {
  const withFlag = claim([`${one},${two}`, "--serves"]);
  const withoutFlag = claim([`${one},${two}`]);
  const direct = servesHash(corpus, [one, two]);
  assert.equal(withoutFlag, direct, "the comma form no longer matches servesHash");
  assert.equal(withFlag, direct, "the flag disagrees with the comma form on the same set");
});

/**
 * ⛔ ORDER IS PART OF THE SET'S IDENTITY, and the role definition tells authors to pass the refs
 * "in the order you wrote them". If that were not load-bearing the instruction would be noise; if
 * it is, two orders must differ — otherwise an author reordering `serves` for readability would
 * silently keep a hash that no longer describes what they wrote.
 */
test("the order the refs are given in is part of the hash", () => {
  assert.notEqual(
    claim([`${one},${two}`, "--serves"]),
    claim([`${two},${one}`, "--serves"]),
    "two orders of the same refs hash identically — then the instruction to preserve order is noise"
  );
});
