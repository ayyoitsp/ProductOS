/**
 * ⛔ TWO ROLES HASH AT TWO GRAINS, AND `v2 claim` ONLY KNEW ABOUT ONE OF THEM.
 *
 * `demonstrator` hashes a SLOT, because a requirement is worked out against one sentence.
 * `decomposer` hashes whatever a capability's `serves` set points at, and that is coarser **on
 * purpose** — its own instructions say to point `serves` at `<scope>#<exchange>`, or at another part
 * (`<subsystem>#offers#<id>`), because *"a part is coarse — roughly what they do"*.
 *
 * The CLI guard allowed only `slot` and `statement`. So the decomposer could not compute
 * `derived.from` for the very forms it is told to write, and that is not cosmetic: `derived.from` is
 * the entire reason capabilities may be generated before anybody agrees to the truth. It is what
 * leaves a part **invalidated and named** when a promise is reworded instead of silently answering
 * something nobody said. Without it the layer cannot be re-run — which is the requirement it exists
 * for: *"capabilities should be generated based on current truth, have the accepted state feed in …
 * they should just carry an invalidated state"*.
 *
 * ⛔ FOUND BY USING IT, NOT BY READING IT. Three decomposers were being fanned over a real corpus
 * and the instruction they had been given named a form the tool refused.
 *
 * ⛔ AND `claimHash` ALREADY HANDLED THE WIDER SET — only the guard refused. Demonstrated before
 * the change rather than assumed: `claimHash(corpus, "<scope>#<exchange>")` returned a hash while
 * the CLI exited 1 on the same ref. So this is a test of the GUARD, and it drives the CLI.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

/** A corpus from the pristine seed, so the refs below are whatever the seed actually states. */
const dir = path.join(temp("v2claim-"), "v2");
execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const corpus = loadCorpus(dir);

/**
 * The first exchange the seed states, and one slot inside it that carries wording.
 *
 * ⛔ ANY scope with exchanges, NOT a top-level one. The first version filtered on `!s.scope.in` and
 * found nothing: the seed's top-level scope is `family-wallet`, which groups and states no exchange
 * of its own — every exchange is on a nested scope (`money`, `tasks`). Caught by the fixture
 * assertion below rather than by four tests passing over `undefined`.
 */
const scope = corpus.scopes.find((s) => s.scope.exchanges?.length)?.scope;
const exchange = scope?.exchanges?.[0];
const slot = exchange ? Object.keys(exchange.slots ?? {})[0] : undefined;

function claim(ref) {
  try {
    return { ok: true, out: execFileSync("node", [CLI, "v2", "claim", ref, "--at", dir], { encoding: "utf-8" }).trim() };
  } catch (e) {
    return { ok: false, out: ((e.stdout ?? "") + (e.stderr ?? "")).trim() };
  }
}

test("the seed gives us a scope, an exchange and a slot to hash", () => {
  /** ⛔ First, because every assertion below is vacuous if these are undefined. */
  assert.ok(scope, "the seed states no scope with exchanges at all");
  assert.ok(exchange, `${scope.id} states no exchanges`);
  assert.ok(slot, `${scope.id}#${exchange.id} states no slots`);
});

test("a slot hashes — the grain a requirement is worked out against", () => {
  const r = claim(`${scope.id}#${exchange.id}#${slot}`);
  assert.ok(r.ok, `the demonstrator's own grain was refused: ${r.out}`);
  assert.match(r.out, /^sha256:[0-9a-f]{16}$/, `not a hash: ${JSON.stringify(r.out)}`);
});

/**
 * ⛔ THE ONE THIS FILE EXISTS FOR. Refused before the guard was widened, with a message that said
 * "a requirement is worked out against a slot" — correct for the demonstrator, and an instruction
 * the decomposer cannot follow.
 */
test("an exchange hashes too — the grain a capability's `serves` is allowed to use", () => {
  const r = claim(`${scope.id}#${exchange.id}`);
  assert.ok(
    r.ok,
    `an exchange-level ref was refused, so a capability cannot record what it was derived from: ${r.out}`
  );
  assert.match(r.out, /^sha256:[0-9a-f]{16}$/, `not a hash: ${JSON.stringify(r.out)}`);
});

/**
 * ⛔ AND THE HASHES DIFFER, because otherwise "it accepts both" would be true of a verb that
 * silently ignored the slot and hashed the exchange either way — which would make every
 * requirement in a feature share one hash and stale together.
 */
test("the two grains are different hashes, not one answer for both", () => {
  const atSlot = claim(`${scope.id}#${exchange.id}#${slot}`);
  const atExchange = claim(`${scope.id}#${exchange.id}`);
  assert.ok(atSlot.ok && atExchange.ok, "one of the two grains was refused");
  assert.notEqual(
    atSlot.out,
    atExchange.out,
    "a slot and its whole exchange hash identically — the grain is being ignored, so nothing could stale independently"
  );
});

/** ⛔ Still refused, because a scope has no wording of its own. Widening is not removing. */
test("a scope is still refused, and the message names both uses", () => {
  const r = claim(scope.id);
  assert.equal(r.ok, false, "a bare scope was hashed, but a scope states no claim of its own");
  assert.match(r.out, /resolves to scope/, r.out);
  /** Both roles named, so neither is sent to the other's grain by the error text. */
  assert.match(r.out, /a requirement is worked out against/, `the message does not help the demonstrator: ${r.out}`);
  assert.match(r.out, /serves/, `the message does not help the decomposer: ${r.out}`);
});
