/**
 * ⛔ BOTH DERIVED LAYERS ARE GENERATED FROM CURRENT TRUTH, AND THIS REPLACED A GATE I HAD NO
 * BUSINESS ADDING.
 *
 * `decomposer` and `demonstrator` were first routed into `hand it to the builders`, behind
 * sign-off, on the reasoning that a capability and a test set both flow from AGREED truth — so
 * deriving either over a draft means doing it twice, and the first pass is what a builder finds
 * lying around.
 *
 * Peter: *"why should capabilities depend on acceptance?"* and then *"capabilities should be
 * generated based on current truth, have the accepted state feed in. test cases should be generated
 * too. they should just carry an invalidated state"*.
 *
 * ⛔ AND THE REGISTRY HAD ALREADY SAID SO, twelve lines above where I put them. `jobs.ts`:
 * *"ENGINEERING AUTHORS RUN HERE; ENGINEERING JUDGES STILL WAIT."* `machinist` and `instrumenter`
 * write during specification, before anybody agrees. Both derived roles are AUTHORS and both were
 * placed on the judges' side of a line this repo had drawn and written down.
 *
 * ⛔ AND THE GATE INVERTED THE STAGE IT SAT IN. `buildability` asks whether somebody could start on
 * Monday and `architecture` asks whether these are the right subsystems — both at `ready for
 * review`. With the decomposition written only there, the person deciding whether to sign off could
 * not see what the promise costs, and the one review that could show a promise to be expensive
 * arrived after the promise was agreed.
 *
 * What replaces a gate is a STATE, and these are the tests that the state is real: a reword
 * invalidates and names, re-deriving over unchanged truth is a no-op, and whether the truth is
 * agreed is reported rather than required.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { derivedCapabilities, servesHash, demonstrationOf } from "../dist/v2/demonstrate.js";
import { claimHash, coveredBy } from "../dist/v2/stamp.js";
import { compilePacket } from "../dist/v2/packet.js";
import { SHIMS } from "../dist/core/jobs.js";

const LEDGER = `---
id: ledger
title: The ledger
does: >
  Holds every movement of a kid's money as an append-only record, and answers what a kid has
  now by reading it back.
offers:
  - id: record-a-movement
    does: Appends one movement against one kid and returns what they have afterwards.
    serves:
      - money#record-earning#after
      - money#record-spending#after
  - id: read-a-history
    does: Returns everything recorded against one kid, most recent first.
    serves: [money#see-a-balance#answer]
---
Append-only is the whole design.
`;

function corpusWithAPart() {
  const dir = temp("v2cur-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  fs.writeFileSync(path.join(dir, "capabilities", "ledger.md"), LEDGER);
  return dir;
}

/** Mark the ledger's first capability as worked out from what it serves, as that truth now reads. */
function workOutTheLedger(dir) {
  const refs = ["money#record-earning#after", "money#record-spending#after"];
  const from = servesHash(loadCorpus(dir), refs);
  const f = path.join(dir, "capabilities", "ledger.md");
  fs.writeFileSync(
    f,
    fs
      .readFileSync(f, "utf-8")
      .replace(
        "      - money#record-spending#after\n",
        `      - money#record-spending#after\n    derived:\n      by: decomposer\n      at: 2026-10-08\n      from: ${from}\n`
      )
  );
  return from;
}

/**
 * ⛔ THE ROUTING IS THE CORRECTION, so it is asserted rather than left to a comment. Read off the
 * registry: both derived authors run where truth is still being written, and both judges do not.
 */
test("the two derived authors run during specification, not behind sign-off", () => {
  const spec = SHIMS.find((s) => s.route === "scope a feature");
  const builders = SHIMS.find((s) => s.route === "hand it to the builders");
  assert.ok(spec && builders, "the two routes moved — re-aim this test");

  const rolesIn = (s) => s.steps.map((x) => x.role);
  for (const author of ["decomposer", "demonstrator"]) {
    assert.ok(rolesIn(spec).includes(author), `${author} does not run where truth is written`);
    assert.ok(
      !rolesIn(builders).includes(author),
      `${author} is gated behind sign-off — an engineering author on the judges' side of the line`
    );
  }
  // ⛔ And the judges stay, which is where a judge belongs.
  for (const judge of ["architecture", "buildability", "test-design"])
    assert.ok(rolesIn(builders).includes(judge), `${judge} left the stage it judges at`);
});

test("a part records what it was worked out from, and reads as current", () => {
  const dir = corpusWithAPart();
  workOutTheLedger(dir);
  const byRef = Object.fromEntries(derivedCapabilities(loadCorpus(dir)).map((d) => [d.ref, d.state]));
  assert.equal(byRef["ledger#offers#record-a-movement"], "current");
  /** The neighbour nobody worked out is a third state, not an error — same as a typed criterion. */
  assert.equal(byRef["ledger#offers#read-a-history"], "authored");
});

test("rewording what a part serves invalidates that part, and only that part", () => {
  const dir = corpusWithAPart();
  workOutTheLedger(dir);
  assert.equal(
    derivedCapabilities(loadCorpus(dir)).filter((d) => d.state === "stale").length,
    0,
    "nothing changed and something already reads as invalidated"
  );

  const money = path.join(dir, "truth", "money.md");
  const src = fs.readFileSync(money, "utf-8");
  const anchor = "The kid has that much more than they had before.";
  assert.ok(src.includes(anchor), "seed shape moved — re-aim this test");
  fs.writeFileSync(money, src.replace(anchor, "The kid has that much more than they had before, to the penny."));

  const stale = derivedCapabilities(loadCorpus(dir))
    .filter((d) => d.state === "stale")
    .map((d) => d.ref);
  assert.deepEqual(stale, ["ledger#offers#record-a-movement"], `wrong parts invalidated: ${stale.join(", ")}`);

  /**
   * ⛔ A NOTE, NOT A REFUSAL, and the asymmetry with `a-requirement-older-than-its-claim` is
   * deliberate: a stale test case gets implemented and passes, proving a sentence nobody agrees to
   * any more, and nothing downstream can catch it. A stale part misleads a reader instead.
   */
  const found = checkCorpus(dir).findings.filter((x) => x.kind === "a-part-older-than-what-it-serves");
  assert.equal(found.length, 1, "a part answering a promise nobody made any more passed unmentioned");
  assert.equal(found[0].severity, "note");
});

/**
 * ⛔ THE ACCEPTED STATE FEEDS IN AND NEVER DECIDES WHETHER THERE IS ANYTHING AT ALL.
 *
 * A gate's only output is absence: the thing is missing, and a reader cannot tell whether that is
 * because nobody agreed the truth or because nobody ran the role. Reporting says strictly more.
 */
test("a part answering truth nobody has agreed to still exists, and says so", () => {
  const dir = corpusWithAPart();
  const found = derivedCapabilities(loadCorpus(dir));
  assert.ok(found.length >= 2, `only ${found.length} parts — nothing below is being tested`);
  assert.ok(
    found.every((d) => d.agreed === false),
    "the seed carries no acceptance, so no part can read as answering agreed truth"
  );
  assert.ok(
    found.some((d) => d.ref === "ledger#offers#record-a-movement"),
    "the part is absent rather than merely marked unagreed — the gate is back"
  );

  /** One of two promises agreed is not enough: a part answering a settled sentence and a proposal
   *  is answering a proposal. */
  const cov = coveredBy(loadCorpus(dir), "money#record-earning#after");
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "a.yaml"),
    YAML.stringify({
      verdicts: [
        {
          kind: "accept",
          by: "peter",
          at: "2026-10-08",
          via: "page",
          target: "money#record-earning#after",
          covers_slots: cov.slots,
          covers_criteria: cov.criteria,
        },
      ],
    })
  );
  const one = derivedCapabilities(loadCorpus(dir)).find((d) => d.ref === "ledger#offers#record-a-movement");
  assert.equal(one.agreed, false, "one of two promises agreed read as fully agreed");
});

test("a requirement carries whether the claim it demonstrates is agreed, and exists either way", () => {
  const dir = corpusWithAPart();
  const before = demonstrationOf(loadCorpus(dir), "money", "record-earning");
  assert.ok(before.requirements.length > 0, "the seed has no requirements here — re-aim this test");
  assert.ok(before.requirements.every((r) => r.agreed === false), "nothing is accepted in the seed");

  const cov = coveredBy(loadCorpus(dir), "money#record-earning#answer");
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "a.yaml"),
    YAML.stringify({
      verdicts: [
        {
          kind: "accept",
          by: "peter",
          at: "2026-10-08",
          via: "page",
          target: "money#record-earning#answer",
          covers_slots: cov.slots,
          covers_criteria: cov.criteria,
        },
      ],
    })
  );
  const after = demonstrationOf(loadCorpus(dir), "money", "record-earning");
  assert.ok(
    after.requirements.some((r) => r.claim === "money#record-earning#answer" && r.agreed),
    "accepting a claim did not reach the requirements that demonstrate it"
  );
  /** ⛔ Statement-grained, so one agreed slot does not make the whole exchange read as agreed. */
  assert.ok(
    after.requirements.some((r) => !r.agreed),
    "accepting one slot marked every requirement on the exchange as resting on agreed truth"
  );

  // And the packet says so, which is the "feed in" an agent actually reads.
  assert.match(compilePacket(loadCorpus(dir), "money"), /rest on a sentence nobody has agreed to yet/);
});

test("the hash a part is worked out from covers the whole set it serves", () => {
  const dir = corpusWithAPart();
  const corpus = loadCorpus(dir);
  const refs = ["money#record-earning#after", "money#record-spending#after"];
  /** ⛔ Not any single member's hash — otherwise one of the two promises moving is invisible. */
  const set = servesHash(corpus, refs);
  for (const r of refs) assert.notEqual(set, claimHash(corpus, r));
  // Stable across reads, which is what makes re-deriving an unchanged part a no-op.
  assert.equal(set, servesHash(loadCorpus(dir), refs));
});
