/**
 * ⛔ NOBODY WRITES A CRITERION, AND THE LAYER THAT DID HAD A JUDGE AND NO AUTHOR.
 *
 * Peter: *"there's no longer a standalone 'packet'. the packet is what we've defined in the
 * product truth, the capabilities, and the test cases. a product person doesn't write a criterion
 * - what even is this? this is old shit. the agents decide what kind of tests need to exist."*
 *
 * Before this, a `criteria:` block was hand-authored YAML and `productos-scoper.md` was the only
 * role that wrote one — 15 mentions there, zero in the machinist, instrumenter, surveyor or
 * designer. So the artefact a builder implements was produced by a product person as a side-effect
 * of describing a feature, and reviewed by `test-design`, whose whole question is *"would this
 * criterion show its claim holding, or would it just pass"* and which is explicitly forbidden to
 * write: *"⛔ Naming the defect is the output."* A judge with no author.
 *
 * What the tests below pin is the machinery that makes derivation worth anything — which is NOT
 * the deriving (a role does that, reading the claim) but the arithmetic around it:
 *
 *   · re-running over unchanged truth leaves the set alone — otherwise every run throws the
 *     previous answer away and a corpus can never accumulate a test set at all
 *   · rewording one sentence stales exactly the requirements worked out from THAT sentence
 *   · ⛔ and a derived set can never stale a human's acceptance, because a person cannot have
 *     agreed to words a machine wrote after they signed
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { claimHash, stampFor, coveredBy } from "../dist/v2/stamp.js";
import { demonstrationOf, tally } from "../dist/v2/demonstrate.js";
import { compilePacket } from "../dist/v2/packet.js";
import { parseFrontmatter } from "../dist/core/frontmatter.js";

const MONEY = path.join("truth", "money.md");

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2der-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}

/** Rewrite one exchange's frontmatter through the parser, so a fixture cannot drift on whitespace. */
function editExchange(dir, exId, fn) {
  const f = path.join(dir, MONEY);
  const p = parseFrontmatter(fs.readFileSync(f, "utf-8"));
  const ex = p.data.exchanges.find((e) => e.id === exId);
  assert.ok(ex, `no exchange ${exId} in the seed — re-aim this test`);
  fn(ex);
  fs.writeFileSync(f, `---\n${YAML.stringify(p.data)}---\n${p.content}`);
}

/**
 * The seed with ONE of `see-a-balance`'s `answer` criteria marked as worked out from the claim as
 * it now reads, and its neighbour left as somebody typed it.
 *
 * ⛔ A MIXED SLOT ON PURPOSE, which is also the only honest shape during a migration: a corpus does
 * not flip from authored to derived in one step. It is what lets the acceptance test below assert
 * both halves of the rule on one slot — a derived criterion must not stale a stamp, and an
 * authored one must still do so.
 */
function derived() {
  const dir = seed();
  const at = claimHash(loadCorpus(dir), "money#see-a-balance#answer");
  assert.ok(at, "nothing hashes the claim — re-aim this test");
  editExchange(dir, "see-a-balance", (ex) => {
    const one = ex.criteria.find((c) => c.slot === "answer");
    assert.ok(one, "the seed has no answer criterion — re-aim this test");
    one.derived = { by: "demonstrator", at: "2026-10-07", from: at };
  });
  return { dir, at };
}

test("a requirement records the claim it was worked out from, and reads as current", () => {
  const { dir } = derived();
  const corpus = loadCorpus(dir);
  assert.deepEqual(corpus.broken, [], "a derived criterion would not load");
  const d = demonstrationOf(corpus, "money", "see-a-balance");
  const states = Object.fromEntries(d.requirements.map((r) => [r.criterion.id, r.state]));
  assert.equal(states["1"], "current");
  /**
   * ⛔ The ones nobody worked out are a third state, not an error. Every corpus in existence is
   * full of them, and a corpus mid-migration carries both kinds on one slot.
   */
  assert.equal(states["2"], "authored");
  assert.equal(states["3"], "authored");
});

/**
 * ⛔ THE IDEMPOTENCE PIN. "need a way to manage tests and keep them idempotent as truth changes" is
 * the half of the original ask that nothing answered: without `derived.from`, re-deriving is a
 * fresh unrelated set every run and the previous answer is unrecoverable.
 */
test("re-deriving over unchanged truth leaves every requirement current", () => {
  const { dir, at } = derived();
  // The same question asked twice gives the same answer — this is what makes a re-run cheap.
  assert.equal(claimHash(loadCorpus(dir), "money#see-a-balance#answer"), at);
  const t = tally(loadCorpus(dir));
  assert.equal(t.stale, 0, "nothing changed and something reads as stale");
  assert.ok(t.current >= 1, `only ${t.current} current`);
});

test("rewording a claim stales the requirements worked out from it, and only those", () => {
  const { dir } = derived();
  const before = demonstrationOf(loadCorpus(dir), "money", "see-a-balance");
  const wasCurrent = before.requirements.filter((r) => r.state === "current").map((r) => r.criterion.id);
  assert.ok(wasCurrent.length >= 1, "fixture did not derive anything");

  editExchange(dir, "see-a-balance", (ex) => {
    ex.slots.answer.says = "What the kid has now, and everything recorded against them oldest first.";
  });

  const after = demonstrationOf(loadCorpus(dir), "money", "see-a-balance");
  const stale = after.requirements.filter((r) => r.state === "stale").map((r) => r.criterion.id);
  assert.deepEqual(stale.sort(), wasCurrent.sort(), "the wrong requirements went stale");
  // ⛔ And the ones nobody derived are untouched — staleness is about derivation, not about age.
  assert.ok(after.requirements.some((r) => r.state === "authored"));

  // `check` refuses it, because a stale requirement passes and proves the old sentence.
  const found = checkCorpus(dir).findings.filter((f) => f.kind === "a-requirement-older-than-its-claim");
  assert.equal(found.length, stale.length);
  assert.equal(found[0].severity, "refuse");

  // ⛔ And the packet says so on the requirement itself, not only in a summary.
  const packet = compilePacket(loadCorpus(dir), "money");
  assert.match(packet, /⛔ \*\*DO NOT IMPLEMENT THIS YET\.\*\*/);
  assert.match(packet, /worked out from an earlier wording/);
});

/**
 * ⛔ THE ONE THAT MATTERS MOST, AND IT RUNS THE OTHER WAY FROM EVERYTHING ELSE IN `stamp.ts`.
 *
 * The criteria half of a stamp exists because accepting a claim used to silently bless every case
 * attached to it, including ones nobody read. That reasoning holds for a criterion a PERSON wrote
 * and was shown. It inverts for a derived one: a re-derivation would stale every acceptance in a
 * corpus at once, invalidating somebody's consent because a machine rewrote words they never saw.
 *
 * So `coveredBy` hashes only the criteria nobody derived. ⛔ Which means a derived set cannot
 * launder its way into a stamp either: it is not covered, so it is never claimed as agreed.
 */
test("a derived requirement cannot stale a human's acceptance, and an authored one still can", () => {
  const { dir } = derived();
  const ref = "money#see-a-balance#answer";

  /** A real acceptance, recorded the way `accept` records one. */
  const cov = coveredBy(loadCorpus(dir), ref);
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "verdicts", "accepts.yaml"),
    YAML.stringify({
      verdicts: [
        {
          kind: "accept",
          by: "peter",
          at: "2026-10-07",
          via: "page",
          target: ref,
          covers_slots: cov.slots,
          covers_criteria: cov.criteria,
        },
      ],
    })
  );
  assert.equal(stampFor(loadCorpus(dir), ref).state, "accepted", "the fixture's acceptance did not take");

  // ⛔ Re-derive: every derived criterion is reworded wholesale. The stamp must not move.
  editExchange(dir, "see-a-balance", (ex) => {
    for (const c of ex.criteria)
      if (c.derived) c.then = `${c.then}, and the figure is shown to the nearest penny`;
  });
  assert.equal(
    stampFor(loadCorpus(dir), ref).state,
    "accepted",
    "a machine rewriting the derived test set invalidated a person's acceptance"
  );

  // An AUTHORED criterion on the same slot still does, because somebody wrote and read that one.
  editExchange(dir, "see-a-balance", (ex) => {
    const typed = ex.criteria.find((c) => !c.derived && c.slot === "answer");
    assert.ok(typed, "the fixture has no authored criterion on this slot — re-aim this test");
    typed.then = "something else entirely happens";
  });
  assert.equal(
    stampFor(loadCorpus(dir), ref).state,
    "criteria-changed",
    "rewording a criterion somebody typed and read no longer stales their stamp"
  );
});

test("the corpus says how many of its requirements nobody worked out, once, with a count", () => {
  const notes = checkCorpus("v2-seed").findings.filter((f) => f.kind === "requirements-nobody-worked-out");
  assert.equal(notes.length, 1, "reported per requirement instead of once");
  assert.match(notes[0].where, /^\d+ of \d+$/);
  // ⛔ The pristine seed is entirely authored, which is the honest reading of where it has got to.
  assert.match(notes[0].where, /^(\d+) of \1$/);

  // And a corpus that has derived some says a smaller number.
  const { dir } = derived();
  const after = checkCorpus(dir).findings.filter((f) => f.kind === "requirements-nobody-worked-out")[0];
  const [typed, all] = after.where.split(" of ").map(Number);
  assert.ok(typed < all, `${after.where} — deriving some requirements did not reduce the count`);
});

/**
 * ⛔ A RULE OWES A CONFORMANCE CRITERION, AND THAT REFUSAL HAD TO MOVE OUT OF THE SCHEMA.
 *
 * It was a LOAD refusal: a rule with no conformance criterion would not parse. Right about the
 * guarantee, impossible in the sequence — the scoper writes a rule before sign-off and the
 * demonstrator works out its criteria after, so for the whole interval between those steps every
 * rule in a corpus has none. As a load refusal that made the corpus unreadable to everybody,
 * including the role whose job was to fix it and including `check`.
 */
test("a rule with nothing demonstrating it loads, and is refused at handover", () => {
  const dir = seed();
  const f = path.join(dir, "rules", "only-a-parent-moves-money.md");
  const p = parseFrontmatter(fs.readFileSync(f, "utf-8"));
  assert.ok(p.data.criteria?.length, "the seed rule has no criteria — re-aim this test");
  delete p.data.criteria;
  fs.writeFileSync(f, `---\n${YAML.stringify(p.data)}---\n${p.content}`);

  const { corpus, findings } = checkCorpus(dir);
  // ⛔ It LOADS. This is the deadlock that is gone: the demonstrator can now read what it must fix.
  assert.deepEqual(corpus.broken, [], "a rule awaiting its criteria still takes the corpus down");
  const hit = findings.filter((x) => x.kind === "a-rule-that-demonstrates-nothing");
  assert.equal(hit.length, 1, "a rule that demonstrates nothing was handed over");
  assert.equal(hit[0].severity, "refuse");
  assert.match(hit[0].what, /on \d+ exchanges/);
});

/**
 * ⛔ THREE STATES, ONE PICTURE — found on Bilrost, and the `walked` class of defect.
 *
 * `review-the-rows` carries three states of one screen — "Needs look pass", "With pass remaining",
 * "File open" — whose `sketch_html` is byte-identical, 153,107 characters each. Whatever captured
 * them never put the screen into any of the three states: it captured the default render three
 * times and labelled them differently. A reviewer clicking through sees one screen under three
 * names, cannot tell, and signs off on states nobody ever looked at.
 *
 * Nothing else could catch it. `the-states-of-this-screen-are-unspoken` counts states; the rendered
 * checks read one drawing at a time; both are happy with three copies of one picture. And captured
 * markup is 84% of that corpus by bytes — 1.72 MB of 2.05 MB — so this is not a rounding error.
 */
test("two states of one screen drawn with the same picture are refused", () => {
  const dir = seed();
  const f = path.join(dir, MONEY);
  const p = parseFrontmatter(fs.readFileSync(f, "utf-8"));
  const view = p.data.views[0];
  assert.ok(view, "the seed has no views — re-aim this test");
  view.states = [
    { when: "empty", label: "Nothing recorded yet", sketch_html: "<div>the same picture</div>" },
    { when: "loaded", label: "With history", sketch_html: "<div>the same picture</div>" },
  ];
  fs.writeFileSync(f, `---\n${YAML.stringify(p.data)}---\n${p.content}`);

  const hit = checkCorpus(dir).findings.filter((x) => x.kind === "one-picture-labelled-as-several-states");
  assert.equal(hit.length, 1, "one picture labelled as two states was accepted");
  assert.equal(hit[0].severity, "refuse");
  assert.match(hit[0].what, /Nothing recorded yet, With history/);

  // ⛔ And two genuinely different drawings are fine — otherwise the check forbids having states.
  view.states[1].sketch_html = "<div>a different picture entirely</div>";
  fs.writeFileSync(f, `---\n${YAML.stringify(p.data)}---\n${p.content}`);
  assert.equal(
    checkCorpus(dir).findings.filter((x) => x.kind === "one-picture-labelled-as-several-states").length,
    0,
    "distinct drawings are refused, so the check forbids states rather than duplicates"
  );
});

/** ⛔ The prompt tells the role to run this. An instruction naming a command that does not exist
 *  is the defect found twice in the scoper this morning. */
test("the command the demonstrator is told to run exists and answers", async () => {
  const doc = fs.readFileSync("agents/productos-demonstrator.md", "utf-8");
  const m = /productos (v2 claim) <scope>#<exchange>#<slot>/.exec(doc);
  assert.ok(m, "the prompt no longer documents how to get a claim hash");

  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(
    process.execPath,
    ["dist/cli/index.js", "v2", "claim", "money#see-a-balance#answer", "--at", "v2-seed"],
    { encoding: "utf-8" }
  ).trim();
  assert.match(out, /^sha256:[0-9a-f]{16}$/, `the claim verb printed ${JSON.stringify(out)}`);
  assert.equal(out, claimHash(loadCorpus("v2-seed"), "money#see-a-balance#answer"));
});
