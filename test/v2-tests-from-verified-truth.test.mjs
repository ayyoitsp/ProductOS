/**
 * ⛔ A TEST IS BUILDABLE ONLY WHEN THE CLAIM IT DEMONSTRATES IS AGREED.
 *
 * Peter: *"make sure appropriate test cases are being generated based on verified product truth"*,
 * against an MVP whose levels are *"human accepted, derived (from accepted input), suggested"*.
 *
 * Three things were wrong, and each is pinned here through the readers a grooming session uses:
 *
 *   1. a requirement worked out from a draft read `derived`, so a builder's gate let it through;
 *   2. `ready` ignored claims with no test at all, so "0 testing requirements" could read as ready;
 *   3. nothing over MCP could write a requirement, so the demonstrator could not reach a hosted
 *      corpus without replacing a whole feature in YAML and copying a hash by hand.
 *
 * ⛔ The last test walks the whole loop: an exchange in the seed starts not ready, a person agrees,
 * the demonstrator writes the missing test, and it comes back ready — with the new test `derived`.
 * Before this change no exchange in the seed could reach `ready: true` by any sequence of acts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import { intentNamed, refuseIntent, incomplete } from "../dist/v2/intents.js";
import { loadCorpus } from "../dist/v2/load.js";
import { levelOf } from "../dist/v2/level.js";
import { readinessOf, BUILDABLE } from "../dist/v2/readiness.js";
import { claimHash } from "../dist/v2/stamp.js";

const CLI = path.resolve("dist/cli/index.js");
const EX = "money#see-a-balance";

function seed() {
  const dir = path.join(temp("productos-verified-tests-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

const agent = (dir) => ({ dir, who: { kind: "token", actor: "demonstrator", scopes: ["read", "author"] }, pressing: "demonstrator" });
const person = (dir) => ({ dir, who: { kind: "browser", actor: "peter", session: "s-1", scopes: ["read", "author"] }, pressing: "peter" });

function say(intent, fields, asking) {
  const i = intentNamed(intent);
  assert.ok(i, `the door does not take "${intent}"`);
  return refuseIntent(i, asking, fields) ?? incomplete(i, fields) ?? i.run(asking, fields);
}

const criterionAt = (dir, ref) => {
  const [scope, exchange, , id] = ref.split("#");
  return loadCorpus(dir)
    .scopes.find((s) => s.scope.id === scope)
    .scope.exchanges.find((e) => e.id === exchange)
    .criteria.find((c) => c.id === id);
};

test("a requirement written over the door is derived from the claim as it reads, with the server's hash", () => {
  const dir = seed();
  const r = say("demonstrate", {
    ref: "money#record-spending#with",
    given: "a parent on the spend form",
    when: "they record an amount with what it was spent on",
    then: "the history shows the amount with that reason against it",
    /** ⛔ Not a field the intent takes. A caller cannot choose the hash its test is current with. */
    from: "sha256:0000000000000000",
  }, agent(dir));
  assert.equal(r.ok, true, JSON.stringify(r));

  const c = criterionAt(dir, r.ref);
  assert.equal(c.slot, "with");
  assert.equal(c.derived.by, "demonstrator");
  assert.equal(c.derived.from, claimHash(loadCorpus(dir), "money#record-spending#with"), "the hash is not the claim's as it now reads");
});

test("⛔ a requirement worked out from a claim nobody agreed to is suggested, not derived", () => {
  const dir = seed();
  const r = say("demonstrate", { ref: "money#record-spending#with", then: "the history shows the reason against the amount" }, agent(dir));
  assert.equal(r.ok, true, JSON.stringify(r));

  const l = levelOf(loadCorpus(dir), r.ref);
  assert.equal(l.level, "one-source", "⛔ a builder was handed a test for a sentence nobody agreed to, at the level of one somebody did");
  assert.equal(l.route, "worked-out-from-a-draft");
  assert.match(l.because, /nobody has agreed to it yet/);

  const ready = readinessOf(loadCorpus(dir), "money#record-spending");
  const mine = ready.requirements.find((q) => q.ref === r.ref);
  assert.ok(!BUILDABLE.includes(mine.level), `a requirement from an unagreed claim reads ${mine.level}`);
  assert.equal(ready.ready, false);
});

test("the same requirement climbs to derived the moment a person agrees to its claim, with nothing re-derived", () => {
  const dir = seed();
  const r = say("demonstrate", { ref: `${EX}#at_once`, then: "both people looking see the same figure" }, agent(dir));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(!BUILDABLE.includes(levelOf(loadCorpus(dir), r.ref).level), "it passed the gate a builder applies");

  const agreed = say("accept", { ref: EX, via: "page" }, person(dir));
  assert.equal(agreed.ok, true, JSON.stringify(agreed));

  const l = levelOf(loadCorpus(dir), r.ref);
  assert.equal(l.level, "corroborated");
  assert.equal(l.route, "worked-out");
  assert.match(l.because, /peter accepted/);
});

test("a claim that owes a demonstration and has none holds readiness back, and says who owes it", () => {
  const dir = seed();
  const ready = readinessOf(loadCorpus(dir), EX);
  assert.deepEqual(ready.untested, [`${EX}#at_once`], "the seed's untested slot was not reported");
  assert.match(ready.because, /1 claim with nothing that would show it holding \(money#see-a-balance#at_once\) — a demonstrator owes the tests/);
});

test("⛔ the whole loop: not ready, a person agrees, the demonstrator fills the gap, ready — and the new test is derived", () => {
  const dir = seed();
  assert.equal(readinessOf(loadCorpus(dir), EX).ready, false);

  /** A person agrees to the behaviour, and to the rule that supplies who may ask. */
  assert.equal(say("accept", { ref: EX, via: "page" }, person(dir)).ok, true);
  const rule = /the rule ([a-z0-9-]+)/.exec(levelOf(loadCorpus(dir), `${EX}#may`).because)?.[1];
  assert.ok(rule, "the seed's `may` is no longer supplied by a rule; this test needs another way to agree to it");
  assert.equal(say("accept", { ref: rule, via: "page" }, person(dir)).ok, true);

  /** ⛔ Agreed, and still not ready: nothing would show `at_once` holding. */
  const before = readinessOf(loadCorpus(dir), EX);
  assert.equal(before.ready, false, "every claim agreed and one with no test at all read as ready to build");
  assert.deepEqual(before.unagreed, []);
  assert.deepEqual(before.untested, [`${EX}#at_once`]);

  const r = say("demonstrate", {
    ref: `${EX}#at_once`,
    steps: "1. two parents open the same kid's money\n2. one records an amount while the other is looking\n3. the other sees the new figure without reloading",
  }, agent(dir));
  assert.equal(r.ok, true, JSON.stringify(r));

  const after = readinessOf(loadCorpus(dir), EX);
  assert.equal(after.ready, true, after.because);
  assert.deepEqual(after.untested, []);
  const added = after.requirements.find((q) => q.ref === r.ref);
  assert.ok(BUILDABLE.includes(added.level), `a requirement from an agreed claim reads ${added.level}`);
  assert.equal(added.state, "current");
  assert.match(after.because, /^Ready to build/);
});

test("the door refuses a requirement with nothing to observe, an id already taken, and a claim that states nothing", () => {
  const dir = seed();
  assert.match(say("demonstrate", { ref: `${EX}#answer`, given: "a kid" }, agent(dir)).why, /needs a `then` \(or `steps`\)/);
  assert.match(say("demonstrate", { ref: `${EX}#answer`, then: "it shows", id: "1" }, agent(dir)).why, /already has a requirement 1/);
  assert.match(say("demonstrate", { ref: `${EX}#nope`, then: "it shows" }, agent(dir)).why, /not a slot/);
  assert.match(say("demonstrate", { ref: `${EX}#answer`, then: "it shows", level: "manual" }, agent(dir)).why, /not a level/);
});
