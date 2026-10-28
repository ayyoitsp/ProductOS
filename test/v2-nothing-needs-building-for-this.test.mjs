/**
 * ⛔ fg-0020, CLOSED — AND THE GATE IT UNBLOCKED.
 *
 * Peter: *"does buildability also ensure capabilities are mapped from a feature?"*, then *"that
 * doesnt change the fact that the feature isn't bcked by a capability"*, then *"let's implement
 * fg0020"*.
 *
 * `readinessOf.unserved` shipped as a report with its reason recorded as a gap. It is the twin of
 * `untested` and could not behave like one:
 *
 *   `untested`   every claim owes a demonstration, so an empty list is reachable
 *   `unserved`   not every claim owes MACHINERY — *"looking is never refused for having been done
 *                before"* is a promise about the absence of behaviour, and there is nothing to
 *                build for it. An empty list was unreachable without inventing a part, which is
 *                verbatim what `none: true` exists to prevent.
 *
 * `needs_nothing` is the somewhere to say it. With it the list can empty honestly, so the gate
 * closes and the asymmetry is gone.
 *
 * ⛔ WHAT THIS FILE IS REALLY FOR IS THE BYPASS. This field is the only route past the only check on
 * this axis. Conclude nothing is needed, reword the promise, and without the hash nothing ever asks
 * again — a permanent exemption for one line. Three of the five cases below are about that, because
 * the gate working is the easy half.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { readinessOf } = await import("../dist/v2/readiness.js");
const { unserved, unservedIn, staleConclusions, typedConclusions } = await import("../dist/v2/demonstrate.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { perform } = await import("../dist/v2/acts.js");
const { SLOTS } = await import("../dist/v2/schema.js");
const { claimHash } = await import("../dist/v2/stamp.js");

const EX = "money#see-a-balance";
const SCOPE = "money";
const EXCHANGE = "see-a-balance";

const seed = (prefix) => {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

/**
 * Write `needs_nothing` entries onto `see-a-balance`, hashed against the claims as they now read.
 *
 * ⛔ Into the YAML rather than through a tool, because there is no `decompose` intent — the
 * decomposer edits the corpus, which is why the fixture looks like this.
 */
function concludeNothingNeeded(dir, refs, { by = "decomposer", at = "2026-10-28", hashOf = null } = {}) {
  const corpus = loadCorpus(dir);
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const entries = refs.flatMap((ref) => {
    const [, , slot, of] = ref.split("#");
    const from = hashOf ? hashOf(ref) : claimHash(corpus, ref);
    assert.ok(from, `no claim at ${ref}, so this fixture is hashing nothing`);
    return [
      `      - slot: ${slot}`,
      ...(of ? [`        of: ${of}`] : []),
      `        because: Nothing has to exist for this; it is a promise about behaviour that does not happen.`,
      `        derived:`,
      `          by: ${by}`,
      `          at: ${at}`,
      `          from: ${from}`,
    ];
  });

  /** Anchored on the one exchange's `criteria:` key, so its twin lands beside it. */
  const marker = "  - id: see-a-balance";
  const at_ = src.indexOf(marker);
  assert.notEqual(at_, -1, "see-a-balance has moved; this fixture anchors on it");
  const next = src.indexOf("\n  - id: ", at_ + marker.length);
  const end = next === -1 ? src.indexOf("\n---", at_) : next;
  const out = src.slice(0, end) + "\n    needs_nothing:\n" + entries.join("\n") + src.slice(end);
  fs.writeFileSync(f, out);
  /** ⛔ Parsed back, so a fixture that writes unloadable YAML fails here and not as a wrong answer. */
  const after = loadCorpus(dir);
  assert.deepEqual(after.broken, [], `the fixture wrote YAML the loader refused: ${JSON.stringify(after.broken)}`);
  return refs;
}

/** Everything a traversal can check about `see-a-balance`, so the machinery axis is the variable. */
function settled(prefix) {
  const dir = seed(prefix);
  const { inherited } = resolveRules(loadCorpus(dir));
  for (const id of new Set(SLOTS.map((x) => inherited.get(`${EX}#${x}`)?.id).filter(Boolean)))
    perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${EX}#${slot}` }, { by: "peter", via: "page", because: "yes" });
  return dir;
}

const ok = (r) => {
  assert.ok(!("error" in r), `readiness refused: ${r.error}`);
  return r;
};

test("a conclusion that nothing needs building takes a promise off the unserved list", () => {
  const dir = seed("v2nn-basic-");
  const before = unserved(loadCorpus(dir), SCOPE, EXCHANGE);
  assert.ok(before.length >= 2, `expected several unserved promises, got ${JSON.stringify(before)}`);

  concludeNothingNeeded(dir, [before[0]]);
  const after = unserved(loadCorpus(dir), SCOPE, EXCHANGE);
  assert.ok(!after.includes(before[0]), `${before[0]} is still unserved after a current conclusion`);
  assert.deepEqual(after, before.slice(1), "concluding about one promise changed the answer for another");

  /** ⛔ And it does not shrink the denominator — that counts promises, not gaps. */
  const c = loadCorpus(dir);
  assert.equal(
    unservedIn(c, [SCOPE], EXCHANGE, true).length,
    unservedIn(loadCorpus(seed("v2nn-basic-ref-")), [SCOPE], EXCHANGE, true).length,
    "a conclusion changed how many promises there are"
  );
});

/**
 * ⛔ THE GATE, WHICH IS THE WHOLE POINT OF THE FIELD EXISTING. Three outcomes from one fixture, and
 * the middle one is the one that could not happen before: ready, with no machinery written.
 */
test("the gate blocks on an unbacked promise and clears once every one is answered or concluded", () => {
  const dir = settled("v2nn-gate-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });

  const demonstrated = () => {
    const c = loadCorpus(dir);
    c.scopes
      .find((s) => s.scope.id === SCOPE)
      .scope.exchanges.find((e) => e.id === EXCHANGE)
      .criteria.push({
        id: "6",
        slot: "at_once",
        kind: "instance",
        then: "both people looking see the same figure",
        derived: { by: "demonstrator", at: "2026-10-17", from: claimHash(c, `${EX}#at_once`) },
      });
    return c;
  };

  const blocked = ok(readinessOf(demonstrated(), EX));
  assert.equal(blocked.ready, false, "every fact agreed, read through, and no machinery anywhere read as ready");
  assert.ok(blocked.unserved.length, "the fixture is not exercising the machinery axis");
  assert.match(blocked.because, /no part of the system behind/);
  assert.match(blocked.because, /a decomposer owes the parts/);

  /** ⛔ Ready with nothing built, which is exactly what fg-0020 made expressible. */
  concludeNothingNeeded(dir, blocked.unserved);
  const clear = ok(readinessOf(demonstrated(), EX));
  assert.deepEqual(clear.unserved, []);
  assert.equal(clear.ready, true, clear.because);
  assert.match(clear.because, /^Ready to build/);
});

/**
 * ⛔ THE BYPASS, AND IT IS THE REASON THE FIELD CARRIES A HASH AT ALL.
 *
 * Conclude nothing is needed, then change what the promise says. Without the hash the promise is
 * never asked about again — a permanent exemption from the only check on this axis, for one line.
 */
test("rewording the promise un-concludes it, and check refuses the stale conclusion", () => {
  const dir = settled("v2nn-stale-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  const refs = unserved(loadCorpus(dir), SCOPE, EXCHANGE);
  concludeNothingNeeded(dir, refs);
  assert.deepEqual(unserved(loadCorpus(dir), SCOPE, EXCHANGE), [], "the conclusions did not take");

  /** Reword one of the promises that was concluded about. */
  const target = refs.find((r) => r.endsWith("#again")) ?? refs[0];
  const f = `${dir}/truth/money.md`;
  const src = fs.readFileSync(f, "utf-8");
  const moved = src.replace("Looking twice shows the same thing", "Looking twice shows whatever is current");
  assert.notEqual(moved, src, "the sentence this test rewords has changed; find the new wording");
  fs.writeFileSync(f, moved);

  const back = unserved(loadCorpus(dir), SCOPE, EXCHANGE);
  assert.ok(
    back.includes(target),
    `${target} stayed concluded through a reword — the bypass this hash exists to close. Got ${JSON.stringify(back)}`
  );

  /** ⛔ And the gate notices, rather than only the finding. */
  assert.equal(ok(readinessOf(loadCorpus(dir), EX)).ready, false);

  const stale = staleConclusions(loadCorpus(dir), SCOPE, EXCHANGE);
  assert.equal(stale.length, 1, `expected one stale conclusion, got ${JSON.stringify(stale)}`);
  assert.equal(stale[0].ref, target);

  const found = checkCorpus(dir).findings.filter((x) => x.kind === "nothing-needed-for-words-that-moved");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "refuse", "⛔ a record asserting something about a sentence that is gone");
  assert.match(found[0].what, /concluded on \d{4}-\d{2}-\d{2} that nothing had to be built/);
  assert.match(found[0].fix, /work it out again against what it says now/);
});

/**
 * ⛔ A TYPED EXEMPTION IS NOT A CONCLUSION. An LLM's YAML is byte-identical to a person's, so
 * reading a bare entry as somebody's judgement would turn the one route past this gate into a line
 * anybody can write. It counts for nothing, and `check` says the role that should have reached it.
 */
test("a conclusion nobody derived counts for nothing at the gate, and is named", () => {
  const dir = settled("v2nn-typed-");
  perform(dir, "read", { scope: EX, buildable: true }, { by: "peter", via: "page" });
  const refs = unserved(loadCorpus(dir), SCOPE, EXCHANGE);

  /** Every conclusion written, and every one of them hashed against nothing. */
  const f = `${dir}/truth/money.md`;
  concludeNothingNeeded(dir, refs);
  const src = fs.readFileSync(f, "utf-8");
  fs.writeFileSync(
    f,
    src.replace(/\n        derived:\n          by: decomposer\n          at: [\d-]+\n          from: \S+/g, "")
  );

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], JSON.stringify(c.broken));
  assert.deepEqual(
    unserved(c, SCOPE, EXCHANGE),
    refs,
    "a typed `needs_nothing` cleared the gate — the one thing it must never do"
  );
  assert.equal(ok(readinessOf(c, EX)).ready, false);
  assert.deepEqual(typedConclusions(c, SCOPE, EXCHANGE).sort(), [...refs].sort());

  const found = checkCorpus(dir).findings.filter((x) => x.kind === "nothing-needed-but-nobody-worked-it-out");
  assert.equal(found.length, refs.length);
  assert.ok(found.every((x) => x.severity === "note"));
  assert.match(found[0].fix, /have `decomposer` reach it/);
});

/**
 * ⛔ THE REASON IS PRICED, because this is the only free escape left on this axis and an unpriced
 * one is the cheapest sentence in a schema — which this project learned once already from
 * `example: true` switching off its best detector for the cost of a boolean.
 */
test("a conclusion with no arguable reason will not load", () => {
  const dir = seed("v2nn-priced-");
  const f = `${dir}/truth/money.md`;
  concludeNothingNeeded(dir, [unserved(loadCorpus(dir), SCOPE, EXCHANGE)[0]]);
  const src = fs.readFileSync(f, "utf-8");
  fs.writeFileSync(
    f,
    src.replace(
      /        because: Nothing has to exist for this; it is a promise about behaviour that does not happen\./,
      "        because: n/a"
    )
  );
  const broken = loadCorpus(dir).broken;
  assert.equal(broken.length, 1, "a one-word reason loaded, so the escape is free");
  assert.match(broken[0].why, /because/);
});
