/**
 * ⛔ "CAN I BUILD THIS?" IS A FIELD, NOT A SENTENCE IN A PREAMBLE.
 *
 * The usability review, on the one surface the MVP's consumer actually needs: *"The packet is one
 * markdown string. The readiness verdict ("This packet has 2 holes… Settle them first") is prose in
 * a preamble rather than a field. An agent deciding 'ready or not' has to parse warnings out of
 * markdown."* 22 KB of it, for one small scope.
 *
 * So this file asserts the three outcomes a grooming agent has to tell apart, and asserts they are
 * DISTINGUISHABLE — same `ready: false`, different reason, different list:
 *
 *   ready                        money#see-a-balance, once every slot it has is agreed
 *   not ready, something open    tasks#complete-a-task — eleven facts agreed and one question owed
 *   not ready, nobody agreed     money#record-earning — no question owed anywhere, and no consent
 *
 * ⛔ THE SECOND AND THIRD ARE THE WHOLE POINT. A verdict that collapsed them would route both to a
 * person: the first needs an ANSWER from whoever was asked, the second needs a READ. Telling them
 * apart is what `level` and `route` were built for, and a boolean on its own cannot.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";

const { loadCorpus, resolveRules } = await import("../dist/v2/load.js");
const { readinessOf, groomingPrompt } = await import("../dist/v2/readiness.js");
const { perform } = await import("../dist/v2/acts.js");
const { SLOTS } = await import("../dist/v2/schema.js");

/** A copy of the shipped seed, with whatever acceptances a case needs recorded through `perform`. */
const seed = (prefix, agree = () => {}) => {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  agree(dir, loadCorpus(dir));
  return loadCorpus(dir);
};

/** Agree to every slot of one exchange, and to any rule that supplies one of them. */
const agreeTo = (ref) => (dir, corpus) => {
  const { inherited } = resolveRules(corpus);
  const rules = new Set(SLOTS.map((s) => inherited.get(`${ref}#${s}`)?.id).filter(Boolean));
  for (const id of rules) perform(dir, "accept", { target: id }, { by: "peter", via: "page", because: "yes" });
  for (const slot of SLOTS)
    perform(dir, "accept", { target: `${ref}#${slot}` }, { by: "peter", via: "page", because: "yes" });
};

const ok = (r) => {
  assert.ok(!("error" in r), `readiness refused: ${r.error}`);
  return r;
};

test("a scope nobody has agreed to is not ready, and says every claim is unagreed rather than open", () => {
  const corpus = seed("v2ready-none-");
  const r = ok(readinessOf(corpus, "money#record-earning"));

  assert.equal(r.ready, false);
  /** ⛔ Nothing is OPEN here — nobody has been asked anything about this exchange. */
  assert.deepEqual(r.holes, []);
  assert.equal(r.counts.open, 0);
  /** Seven slots the exchange states, none of them agreed. `refuses` comes from a rule's cases. */
  assert.equal(r.unagreed.length, 7);
  assert.equal(r.settled.length, 0);
  /** ⛔ And the test list is still there — an unagreed exchange still has requirements. */
  assert.equal(r.requirements.length, 7);
  assert.ok(
    r.requirements.every((x) => x.level === "suggested"),
    "a requirement typed by hand under no acceptance is not buildable"
  );
  assert.equal(r.counts.suggested, 14, "seven slots and seven requirements, all below `derived`");

  /** ⛔ THE SENTENCE A PERSON READS HAS TO NAME WHICH OF THE TWO IT IS. */
  assert.match(r.because, /nobody has agreed/i);
  assert.doesNotMatch(r.because, /nobody has answered/i);
});

test("an exchange with one question owed is not ready, and the question is the only thing in the way", () => {
  const corpus = seed("v2ready-open-", agreeTo("tasks#complete-a-task"));
  const r = ok(readinessOf(corpus, "tasks#complete-a-task"));

  assert.equal(r.ready, false);
  /** ⛔ EVERYTHING ELSE IS AGREED. This is the case a boolean cannot distinguish from the one above. */
  assert.deepEqual(r.unagreed, []);
  assert.equal(r.settled.length, 7, "seven slots agreed — two of them through a rule somebody accepted");
  assert.equal(
    r.settled.filter((x) => x.route === "accepted-through-a-rule").length,
    2,
    "`fails` and `again` come from rules, and accepting the rules is what settles them"
  );
  assert.equal(r.requirements.length, 3);
  assert.ok(r.requirements.every((x) => x.level === "accepted"));

  assert.equal(r.holes.length, 1);
  assert.equal(r.holes[0].ref, "tasks#complete-a-task#at_once");
  assert.equal(r.holes[0].level, "open");
  assert.equal(r.holes[0].route, "unruled");
  assert.match(r.holes[0].because, /Two kids are shown the same task/);

  assert.match(r.because, /nobody has answered/i);
  assert.doesNotMatch(r.because, /nobody has agreed to/i);
});

test("an exchange whose every fact is agreed is ready, and nothing is left in any other list", () => {
  const corpus = seed("v2ready-yes-", agreeTo("money#see-a-balance"));
  const r = ok(readinessOf(corpus, "money#see-a-balance"));

  assert.equal(r.ready, true);
  assert.deepEqual(r.holes, []);
  assert.deepEqual(r.unagreed, []);
  assert.equal(r.settled.length, 8);
  assert.equal(r.requirements.length, 5);
  assert.equal(r.counts.accepted, 13, "eight slots and five requirements");
  assert.equal(r.counts.derived + r.counts.suggested + r.counts.open, 0);

  /**
   * ⛔ ONE SLOT IS AGREED THROUGH A RULE AND IT COUNTS. `money#see-a-balance` states nothing at
   * `may`; `a-kid-sees-only-their-own` supplies every word of it, and accepting the rule is what
   * makes this exchange buildable. A gate reading only local verdicts would hold it open forever.
   */
  assert.ok(
    r.settled.some((x) => x.ref === "money#see-a-balance#may" && x.route === "accepted-through-a-rule"),
    "a slot a rule supplies has to reach the gate through the rule's own acceptance"
  );
  assert.match(r.because, /ready/i);
});

/**
 * ⛔ A QUESTION WITH ANSWERS DRAFTED AGAINST IT IS STILL A QUESTION, AND IT READS `suggested`.
 *
 * `level.ts` reserves `open` for a question nobody has drafted anything for — *"`open` IS RESERVED
 * FOR A QUESTION SOMEBODY OWES"*, and a draft is something written, so a slot with two options on it
 * comes back `suggested` with `route: "drafted"`. A hole list built from `level === "open"` would
 * therefore drop the seed's two best questions — the ones that arrive with options and the cost of
 * guessing wrong — and file them beside thirty sentences nobody has ever questioned.
 */
test("a slot with drafted answers is a hole, not an unagreed claim", () => {
  const corpus = seed("v2ready-drafted-");
  const r = ok(readinessOf(corpus, "money#record-spending"));
  assert.deepEqual(
    r.holes.map((h) => h.ref).sort(),
    ["money#record-spending#after", "money#record-spending#again"],
    "the two slots a person owes an answer on are the holes"
  );
  for (const h of r.holes) {
    assert.equal(h.level, "suggested", "a drafted answer is something written, so the level says so");
    assert.equal(h.route, "drafted");
    assert.ok(!r.unagreed.some((u) => u.ref === h.ref), "a question must not also be filed as an unagreed claim");
  }
  assert.match(r.because, /nobody has answered/i);
});

/**
 * ⛔ A SIBLING'S QUESTION IS NOT THIS BEHAVIOUR'S BUSINESS, AND AN OPEN RULE MAY NOT BE EITHER.
 *
 * `questionsFor` is asked of a SCOPE, so asking about one behaviour hands back its siblings' open
 * questions too. Three outcomes have to stay apart:
 *
 *   on it         `tasks#complete-a-task#at_once` asked about `tasks#complete-a-task` — a hole
 *   around it     an open org-wide rule, or a contested word — raise it, never gate on it
 *   nowhere near  `money#record-spending#after` asked about `money#record-earning` — a sentence it
 *                 does not use and a slot it does not have
 *
 * ⛔ AND THE RULE CASE IS NOT A JUDGEMENT MADE HERE. `resolveRules` records `awaiting` only where the
 * exchange says nothing itself, because an open rule supplies no sentence — so where the slot is
 * stated locally the rule holds nothing open. Gating on where its selector points instead would hold
 * every money behaviour shut on a question about `answer`, which all four of them state themselves.
 */
test("a question about a sibling behaviour is in no list; an open rule that supplies nothing is reported, not gating", () => {
  const corpus = seed("v2ready-nearby-");
  const r = ok(readinessOf(corpus, "money#record-earning"));
  const anywhere = [...r.holes, ...r.unagreed, ...r.latitude, ...r.settled, ...r.framing].map((x) => x.ref);
  for (const sibling of ["money#record-spending#after", "money#record-spending#again"]) {
    assert.ok(!anywhere.includes(sibling), `${sibling} is another behaviour's question`);
    assert.ok(!r.openElsewhere.some((q) => q.ref === sibling), `${sibling} does not reach this behaviour at all`);
  }
  assert.deepEqual(
    r.openElsewhere.map((q) => q.ref),
    ["what-a-kid-sees-of-a-sibling"],
    "the open org-wide rule reaches this work and lands on none of its facts"
  );
  assert.deepEqual(r.holes, [], "and nothing it reports is a hole");

  /** ⛔ The same rule, asked at the scope, still does not gate — every money behaviour states `answer`. */
  const whole = ok(readinessOf(corpus, "money"));
  assert.ok(whole.openElsewhere.some((q) => q.ref === "what-a-kid-sees-of-a-sibling"));
  assert.ok(!whole.holes.some((h) => h.ref === "what-a-kid-sees-of-a-sibling"));
  /** And at the scope the sibling's questions ARE holes, because they are facts of this work. */
  assert.deepEqual(whole.holes.map((h) => h.ref).sort(), [
    "money#record-spending#after",
    "money#record-spending#again",
  ]);
});

/**
 * ⛔ EVERY REQUIREMENT CARRIES ITS REF AND THE HASH OF THE WORDS IT WAS WRITTEN FROM.
 *
 * Peter: *"product os at this point should only generate what the testing requirements are, with an
 * identifier. that's the current boundary"*. The packet prints both; an agent asking for readiness
 * must get the same two without parsing markdown for them.
 */
test("the test list is the packet's list, with the ref and the hash on every row", () => {
  const corpus = seed("v2ready-tests-");
  const r = ok(readinessOf(corpus, "money#record-spending"));
  assert.ok(r.requirements.length > 0);
  for (const req of r.requirements) {
    assert.match(req.ref, /^money#record-spending#shows#/);
    assert.match(req.hash, /^sha256:[0-9a-f]+$/);
    assert.ok(req.says.length > 10, `${req.ref} carries no sentence to demonstrate`);
    assert.ok(req.demonstrates.startsWith("money#record-spending#"), "a requirement names the claim it shows");
  }
});

/**
 * ⛔ `unrecorded` IS A REAL ANSWER AND IT MUST SURVIVE TO THE OUTPUT.
 *
 * The usability review: *"A claim an agent inferred from a call transcript and a claim a PM typed
 * but has not yet confirmed both read 'not confirmed'. A grooming agent needs to tell them apart,
 * because the first should be raised as a question in the ticket and the second only needs a
 * stamp."* On the shipped seed nothing records authorship at all — so the honest answer is that it
 * cannot be told, and a verdict that defaulted it to "a person" would route every inference
 * straight into a build.
 */
test("every claim and every requirement carries who wrote it, including when nobody recorded it", () => {
  const corpus = seed("v2ready-wrote-");
  const r = ok(readinessOf(corpus, "money"));
  const everything = [...r.holes, ...r.unagreed, ...r.latitude, ...r.settled, ...r.framing, ...r.requirements];
  assert.ok(everything.length > 40);
  for (const x of everything) assert.ok(x.wrote, `${x.ref} does not say who wrote it`);
  assert.ok(
    r.unagreed.every((x) => x.wrote.is === "unrecorded"),
    "the shipped seed records no authorship, so the answer is `unrecorded` and never a guess"
  );
  assert.match(r.because, /unrecorded|who wrote/i, "the verdict has to say the authorship could not be told");
});

/**
 * ⛔ A SCOPE ANSWERS FOR EVERYTHING FILED UNDER IT, which is the defect `descendants()` exists for:
 * `packet money` stopped at one scope under a heading reading "Everything below is what the product
 * must do", and a container answers for nothing at all since containers are the scopes with no
 * exchanges of their own.
 */
test("a container's readiness is its subtree's, not its own emptiness", () => {
  const corpus = seed("v2ready-tree-");
  const whole = ok(readinessOf(corpus, "family-wallet"));
  const money = ok(readinessOf(corpus, "money"));
  const tasks = ok(readinessOf(corpus, "tasks"));
  assert.equal(whole.ready, false);
  assert.ok(whole.unagreed.length >= money.unagreed.length + tasks.unagreed.length);
  assert.equal(whole.holes.length, money.holes.length + tasks.holes.length);
  assert.ok(whole.requirements.length > 20, "a container reporting no requirements reports nothing");
});

/** ⛔ A ref it cannot answer about comes back as a reason, never as a verdict somebody could build on. */
test("a ref that is not a feature or a behaviour is refused with a reason", () => {
  const corpus = seed("v2ready-bad-");
  for (const ref of ["nope", "money#no-such-exchange", "money#see-a-balance#answer"]) {
    const r = readinessOf(corpus, ref);
    assert.ok("error" in r, `${ref} produced a verdict instead of a reason`);
    assert.ok(r.error.length > 10);
  }
});

/**
 * ⛔ THE LOOP SHIPS WITH THE SERVER, OR EVERY CONNECTING AGENT INVENTS IT.
 *
 * Usability review, work item 10: *"Ship a grooming prompt with the MCP server: find, check
 * readiness, raise questions, write the test list into the ticket"* — fixing *"Each agent has to
 * invent the loop"*. ⛔ And it names no tracker: the agent holds Linear through its own connector,
 * and ProductOS answers about truth only.
 */
test("the grooming prompt ships, names the four steps, and names no tracker", () => {
  const body = groomingPrompt();
  assert.ok(body.length > 500, "the prompt is a stub");
  for (const step of ["productos_readiness", "productos_exchange_questions", "productos_exchange_packet"])
    assert.ok(body.includes(step), `the prompt never tells the agent to call ${step}`);
  for (const word of ["ready", "question", "test"])
    assert.match(body, new RegExp(word, "i"), `the prompt does not mention ${word}`);
  /**
   * ⛔ Peter: *"we can hash out linear connections later, so ignore those."* A prompt that named a
   * tracker would be ProductOS claiming an integration it does not have, in the one document every
   * connecting agent reads first.
   */
  assert.doesNotMatch(body, /\blinear\b/i, "the prompt names a tracker — ProductOS answers about truth only");
});
