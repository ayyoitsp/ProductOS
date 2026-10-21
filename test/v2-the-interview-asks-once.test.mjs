/**
 * ⛔ THE SAME QUESTION, ASKED ONCE.
 *
 * Peter: *"Examine product truth for a feature, determine what needs to be answered, have them ask
 * the user for the answers, but combined in a way that lessens the burden on the user."*
 *
 * ⛔ "COMBINED" IS THE FEATURE AND IT IS THE ONLY PART THAT COULD SILENTLY NOT HAPPEN. A command
 * that listed every blank slot as its own question would look exactly like this one, pass every
 * assertion about shape and wording, and hand a person nine questions where there were three. So
 * the tests here are about the ARITHMETIC: how many questions come out against how many holes they
 * close, and those two numbers are asserted apart.
 *
 * ⛔ AND THE FOLD IS MEASURED AGAINST `check`, which is where these blanks come from. `check`
 * reports one `slot-blank` per site, correctly — it is reporting defects. The interview has to turn
 * nine of those into three, and the test reads both numbers off the same corpus, so a fold that
 * stopped happening cannot pass by agreeing with itself.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));
const { coveredBy } = await import(path.resolve("dist/v2/stamp.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));
const { POLICY_SLOTS, DEMONSTRABLE_SLOTS, SLOTS } = await import(path.resolve("dist/v2/schema.js"));
const { gridFor } = await import(path.resolve("dist/v2/grid.js"));
const { descendants } = await import(path.resolve("dist/v2/settle.js"));
const CLI = path.resolve("dist/cli/index.js");

const ex = (id, title) => `  - id: ${id}
    title: ${title}
    asked_by: person
    changes: [job]
    at:
      view: the-list
    slots:
      may:
        says: A parent in this family.
      with:
        says: which kid it is for, and what it is worth
      answer:
        says: The thing they asked for, shown on the list.
      after:
        says: The list has one more thing on it than it had before.
      fails:
        says: They are told it was not recorded and nothing has changed.
`;

/**
 * A feature with three behaviours, each answering the same five slots and each blank on the same
 * three — `refuses`, `again`, `at_once`.
 *
 * ⛔ THOSE THREE ARE THE ONES `propose-slots.ts` NAMES as the slots a real corpus leaves empty
 * (*"on bilrost, 45 of 54 exchanges answer none of the three"*). The fixture is the shape this is
 * actually for, not a shape invented to make the arithmetic come out.
 */
function corpus() {
  const dir = path.join(temp("pos-interview-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  for (const f of fs.readdirSync(path.join(dir, "truth"))) fs.rmSync(path.join(dir, "truth", f));
  for (const f of fs.readdirSync(path.join(dir, "rules"))) fs.rmSync(path.join(dir, "rules", f));
  /** ⛔ `v2 reset` does not create it, and `v2-stages` carries the ⛔ about this passing only on a
   *  working copy that had one lying around. */
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "truth", "chores.md"),
    `---
id: chores
title: Chores
exists: kept
terms:
  job:
    means: something a parent has asked a kid to do, with what it pays
happy_path:
  accomplishes: A parent puts a job on a kid's list and the kid marks it done and is paid for it.
  brings: what the job is and which kid it is for
  ends_with: the job is off the list and what it paid is in the kid's money
  through: [the-list]
views:
  - id: the-list
    title: The list
    view_kind: list
    sketch: |
      +------------------+
      |  The list        |
      +------------------+
    parts:
      - id: row
        role: display
        label: Tidy your room
exchanges:
${ex("offer-a-job", "A parent offers a job")}${ex("mark-it-done", "A kid marks a job done")}${ex("pay-for-it", "A parent pays for a job")}---

# Chores

What a kid is asked to do.
`
  );
  return dir;
}

/**
 * Agrees to what the feature is for — ⛔ WITH THE HASH OF WHAT WAS READ, or the stamp reads stale
 * and the purpose gate never opens. `stampFor` compares `covers_slots` against the wording now, so
 * a verdict that does not say what it covered is correctly read as agreement to something else.
 */
function agreeThePurpose(dir, scopeId = "chores") {
  const c = coveredBy(loadCorpus(dir), `${scopeId}#happy-path`);
  fs.writeFileSync(
    path.join(dir, "verdicts", `2026-10-20-${scopeId}-purpose.yaml`),
    `verdicts:
  - kind: accept
    target: ${scopeId}#happy-path
    because: Read it through with the people who asked for it, and this is what the product should do.
    by: a-person
    via: page
    at: "2026-10-20"
    covers_slots: ${JSON.stringify(c.slots)}
    covers_criteria: ${JSON.stringify(c.criteria)}
`
  );
}

const round = (dir, scopeId = "chores") => {
  const { corpus: c, findings } = checkCorpus(dir);
  return { it: interviewFor(c, scopeId), findings };
};

test("⛔ three behaviours blank on one slot are one question, not three", () => {
  const dir = corpus();
  agreeThePurpose(dir);
  const { it, findings } = round(dir);

  /**
   * ⛔ BOTH NUMBERS, OFF THE SAME CORPUS. The left-hand one is what `check` sees and the right-hand
   * one is what a person is asked. Asserting only the right-hand one would pass on a corpus that
   * had three blanks all along, which is the failing-zero shape this project keeps finding.
   */
  const blanks = findings.filter((f) => f.kind === "slot-blank" && f.where.startsWith("chores#"));
  assert.equal(blanks.length, 9, `the fixture is not blank where this test needs it — check sees ${blanks.length}`);

  const folded = it.owed.filter((o) => o.owes === "blank");
  assert.equal(folded.length, 3, "nine blank slots came back as more than three questions — nothing folded");
  assert.deepEqual(
    folded.map((o) => o.fills.length),
    [3, 3, 3],
    "a folded question does not say how many slots it fills, so nothing records that answering once is enough"
  );
  assert.equal(it.closes, 9, "`closes` is not the number of holes these answers would shut");
});

test("⛔ a blank an existing question already speaks for is not asked a second time", () => {
  /**
   * ⛔ THIS WAS LIVE, AND IT WAS FOUND BY RUNNING THE COMMAND RATHER THAN BY READING IT.
   *
   * Drafting four answers on `offer-a-job#again`, with the two sibling `again` slots in `blocks`,
   * produced FOUR questions: the drafted one naming all three slots it settles, and a blank
   * question for the other two. The same question, put to the same person, twice, on one screen —
   * which is the exact burden this command exists to remove, produced by the command.
   *
   * ⛔ AND `check` IS RIGHT TO STILL REPORT THEM. A slot named in `blocks` is genuinely blank, so
   * the count below does not move; the fold between the two honest surfaces belongs here.
   */
  const dir = corpus();
  agreeThePurpose(dir);
  const before = round(dir).it.owed.length;

  const r = raiseQuestion(dir, {
    ref: "chores#offer-a-job#again",
    question: "What happens when a parent offers the same job twice?",
    asked_of: "peter",
    blocks: ["chores#mark-it-done#again", "chores#pay-for-it#again"],
    cost: "Guessing wrong either puts a job on a kid's list nobody offered, or loses a second job a parent really did offer — and the list is what the kid reads.",
    candidates: [
      {
        says: "Each offer stands on its own. The same job offered twice is on the list twice.",
        consequence: "A parent can offer the same chore twice and the list matches. A double-press puts a job nobody offered on a kid's list.",
      },
      {
        says: "Offering the same job for the same kid on the same day records it once, and the parent is told it is already there.",
        consequence: "A double-press cannot create a job nobody offered. A parent who wants it twice in a day has to change something first.",
      },
    ],
    by: "a-drafting-agent",
  });
  assert.equal(r.ok, true, `the drafting act failed: ${r.ok === false ? r.why : ""}`);

  const { it, findings } = round(dir);
  assert.equal(
    findings.filter((f) => f.kind === "slot-blank" && f.where.endsWith("#again")).length,
    2,
    "check stopped reporting the sibling slots as blank, so this test is no longer about anything"
  );
  assert.equal(it.owed.length, before, "the drafted question was asked beside the blanks it already settles");
  const again = it.owed.filter((o) => o.fills.some((f) => f.endsWith("#again")));
  assert.equal(again.length, 1, "two questions now cover the same slots");
  assert.equal(again[0].owes, "drafted");
  assert.equal(again[0].candidates.length, 2, "the drafted options did not come back with it");
});

test("⛔ a folded question names what it covers, and a lone blank stays at its behaviour", () => {
  /**
   * ⛔ THE SECOND HALF OF THE FOLD, AND THE EASY ONE TO LOSE. Framing every question at the feature
   * reads fine where everything folds and strips a lone blank of the only context a drafter has —
   * which behaviour it is even about. The first version said *"every one of these in Chores"* for
   * both, which is a question about an unnamed set.
   */
  const dir = corpus();
  agreeThePurpose(dir);
  const many = round(dir).it.owed.find((o) => o.owes === "blank" && o.fills.length > 1);
  assert.match(many.asks, /A parent offers a job/, "a folded question does not name the behaviours it covers");
  assert.match(many.asks, /A parent pays for a job/);

  /** Answer `again` on two of the three, leaving exactly one blank at it. */
  const file = path.join(dir, "truth", "chores.md");
  let n = 0;
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf-8")
      .replace(/      fails:\n        says: They are told it was not recorded and nothing has changed\.\n/g, (m) =>
        ++n <= 2 ? `${m}      again:\n        says: The second ask is recorded as its own thing.\n` : m
      )
  );
  const alone = round(dir).it.owed.find((o) => o.owes === "blank" && o.fills[0].endsWith("#again"));
  assert.equal(alone.fills.length, 1, "the fixture edit did not leave exactly one blank `again`");
  assert.match(alone.asks, /^A parent pays for a job —/, "a lone blank lost which behaviour it is about");
});

test("⛔ the question put to a person is a question, not a slot name with a question mark", () => {
  /**
   * ⛔ IT WAS COMPOSED AND IT CAME OUT BROKEN. `SLOT_ASKS` completes *"this slot says ___"* and is
   * a mix of noun phrases and clauses, so building questions as `what is ${SLOT_ASKS[slot]}?`
   * produced **"what is what happens when it is asked twice?"** on two of the eight slots — a
   * template that reads fine on the one you checked. `SLOT_ASKED` is the schema's own wording.
   */
  const dir = corpus();
  agreeThePurpose(dir);
  for (const o of round(dir).it.owed) {
    assert.doesNotMatch(o.asks, /what is what/i, `"${o.asks}" is a template showing through`);
    assert.match(o.asks, /\?$/, `"${o.asks}" is not a question`);
    /** ⛔ No model vocabulary reaches a person — not a slot name, not a ref, not "asker". */
    assert.doesNotMatch(o.asks, /\bat_once\b|\brefuses\b|\basker\b|#/, `"${o.asks}" shows the model to a reader`);
  }
});

test("⛔ the screens are asked about, and a drawing is never asked for as a sentence", () => {
  /**
   * Peter named three things: *"the UX, edge cases, happy path"*. The edge cases are the slots and
   * the happy path is the gate; this is the UX, and it is the one whose answer is not a sentence.
   * A question asking somebody to type a screen would be the hand-authoring trap with a prompt on
   * it — the corpus has generators for exactly this.
   */
  const dir = corpus();
  const file = path.join(dir, "truth", "chores.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf-8").replace(
      "exchanges:\n",
      `  - id: paid
    title: What it paid
    view_kind: detail
    parts:
      - id: amount
        role: display
        label: Worth
exchanges:
`
    )
  );
  agreeThePurpose(dir);
  const ux = round(dir).it.owed.find((o) => o.owes === "screen");
  assert.ok(ux, "a screen with nothing drawn is not asked about at all");
  assert.match(ux.asks, /What it paid/, "the question does not name the screen");
  assert.match(ux.shape, /never typed/, "nothing says the drawing is generated, so a drafter writes markup into truth");
  assert.match(ux.act, /generated/, "the act does not say the picture is generated");
  assert.match(ux.act, /never typed/, "nothing stops a drafter typing the picture, which is the defect this project repeats most");
});

test("⛔ no act is a shell command, and an author's act is one it can actually make", () => {
  /**
   * ⛔ THREE DEFECTS OF THIS SHAPE, THEN PETER NAMED THE FOURTH AND IT WAS THE WHOLE APPROACH.
   *
   * It printed `ask` for every undrafted question including the purpose — and `ask` takes a slot
   * ref, so a happy-path ref is refused. Then it printed `ask --ref …` as though `ask` were a CLI
   * verb; it is an intent, and the CLI reaches no intent at all. Then it printed `rule --pick N` for
   * a contested word, which no verb accepts.
   *
   * Then: *"we should not be creating command line 'instructions' at this point? it should just be
   * another functionality that could be reachable. maybe i'm just taking issue with you saying
   * 'productos v2 interview' command line, like no one will ever use the command line"*.
   *
   * ⛔ WHICH MAKES THE RULE SHARPER THAN "AN ACT THAT EXISTS". Every act is one of two things: an
   * MCP call an author can make right now, or a press only a person can make. A shell line is
   * neither — a person has no terminal, and a model typing `productos v2 rule` is refused by
   * `mayRecord` on purpose. So the assertion is the absence: no act names the CLI.
   */
  const dir = corpus();
  const gated = round(dir).it;
  assert.equal(gated.gate, "purpose");
  assert.match(gated.owed[0].act, /a person agrees to this/, "an unagreed purpose reads as something other than a person's press");

  agreeThePurpose(dir);
  const all = [...gated.owed, ...round(dir).it.owed];
  for (const o of all) {
    if (o.act === null) continue;
    /** ⛔ The one that is the correction itself. */
    assert.doesNotMatch(o.act, /productos v2 |^productos /, `${o.ref} routes through the command line: ${o.act}`);

    if (o.owes === "blank") {
      /** ⛔ Through the door, because drafting is an intent and an author's act. */
      assert.match(o.act, /^productos_in \{/, `a blank at ${o.ref} does not route through the one way in`);
      const body = JSON.parse(o.act.slice("productos_in ".length));
      assert.equal(body.intent, "ask");
      assert.ok(Array.isArray(body.blocks), "`blocks` is not a list — `ask` requires it and never assumes it");
      assert.ok("question" in body && "asked_of" in body && "candidates" in body, "the act omits a field `ask` requires");
    }
    /** ⛔ A ruling is a person's, and the act has to say so rather than hand anybody a verb. */
    if (o.owes === "drafted") assert.match(o.act, /a person answers this/, `a ruling at ${o.ref} reads as somebody else's act`);
  }
});

test("⛔ a question no verb can answer carries no act at all", () => {
  /**
   * ⛔ `rulingAct` RETURNS `null` FOR A CONTESTED WORD AND THE `null` HAS TO SURVIVE. Its ref is
   * `<scope>#<word>` and a multi-word term is not one kebab-case segment, so no verb resolves it;
   * `Term.contested` is `{question, with}` strictly, so no candidate fits in it either. v2.ts records
   * this biting twice — #148 minted the ref shape, #153 printed `v2 rule` against it. A surface that
   * invents an act here is the third time.
   */
  const dir = corpus();
  const file = path.join(dir, "truth", "chores.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf-8").replace(
      "terms:\n  job:\n    means: something a parent has asked a kid to do, with what it pays\n",
      `terms:
  job:
    means: something a parent has asked a kid to do, with what it pays
  what it pays:
    means: the amount a job is worth
    contested:
      question: Is what a job pays the amount offered, or the amount actually moved when it is done?
      with: [worth, earned]
`
    )
  );
  agreeThePurpose(dir);
  const word = round(dir).it.owed.find((o) => o.owes === "drafted" && !o.ref.includes("#" + "offer"));
  const contested = round(dir).it.owed.filter((o) => o.act === null);
  assert.equal(contested.length, 1, `a contested word either vanished or was given an act: ${JSON.stringify(round(dir).it.owed.map((o) => [o.ref, o.act]))}`);
  assert.match(contested[0].asks, /amount offered, or the amount actually moved/, "the question itself is missing");
  void word;
});

test("⛔ it drafts no answers, and that is not an oversight", () => {
  /**
   * ⛔ THE LINE `propose-slots.ts` HOLDS, HELD HERE: *"a sentence this file made up would be
   * indistinguishable from one somebody agreed to"*. The interview says where a question goes and
   * what shape an answer takes; an author writes the options through `ask`. If this fails,
   * something in the derivation started inventing product truth.
   */
  const dir = corpus();
  agreeThePurpose(dir);
  const it = round(dir).it;
  for (const o of it.owed.filter((x) => x.owes !== "drafted"))
    assert.deepEqual(o.candidates, [], `${o.ref} arrived with options nobody wrote`);
  for (const o of it.owed) assert.ok(o.shape.length > 20, `${o.ref} says nothing about what an answer has to be`);
});

test("⛔ the purpose leads and does not suppress — this test used to assert the defect", () => {
  /**
   * ⛔ THIS TEST PINNED THE BUG, AND IT PASSED ALL SESSION.
   *
   * It asserted `owed.length === 1` on an unagreed purpose — "the detail questions were offered
   * beside the purpose they depend on" as the failure message, i.e. it was built to FAIL if the
   * questions showed up. So the single most valuable thing the feature could do was forbidden by
   * its own pin, and nothing could ever have caught it.
   *
   * Peter, on his corpus: *"we have almost ZERO human validated truths. there are a TON of features
   * with behaviors. the goal is to GET HUMAN VALIDATIONS. how can there be ZERO to operate on? do
   * you not understand the feature you are building?"*
   *
   * Measured there: **1,560 questions a person owed, 1,421 already carrying drafted options, and
   * the interview returned 4** — because 102 features had no agreed purpose and this behaviour
   * dropped everything beneath each one.
   *
   * ⛔ THE GATE WAS COPIED FROM THE WRONG ACT. `actsFor` withholds behaviours from being OFFERED
   * FOR ACCEPTANCE until a purpose is agreed, which is right. An open QUESTION is not an
   * acceptance: it is a decision somebody owes, it gates the behaviour whether or not anybody looks
   * at it, and `v2 decide` has never withheld one. So the purpose goes FIRST — it is still the most
   * valuable thing to agree — and the rest follows it.
   */
  const dir = corpus();

  /** An unagreed purpose, and a question drafted underneath it. */
  const r = raiseQuestion(dir, {
    ref: "chores#offer-a-job#again",
    question: "What happens when a parent offers the same job twice?",
    asked_of: "peter",
    blocks: [],
    cost: "Guessing wrong either puts a job on a kid's list nobody offered, or loses a real second job.",
    candidates: [
      { says: "Each offer stands on its own.", consequence: "The list matches a parent who really offered twice; a double-press costs a kid." },
      { says: "The same job on the same day records once.", consequence: "A double-press is harmless; a real second offer needs something changed first." },
    ],
    by: "a-drafting-agent",
  });
  assert.equal(r.ok, true, `the fixture could not be drafted: ${r.ok === false ? r.why : ""}`);

  const it = round(dir).it;
  assert.equal(it.gate, "purpose", "nothing says the purpose is still what to agree first");
  assert.equal(it.owed[0].owes, "purpose", "the purpose is not the first thing asked");

  /** ⛔ THE ASSERTION THAT WAS BACKWARDS. The question a person owes is still on the list. */
  const drafted = it.owed.filter((o) => o.owes === "drafted");
  assert.equal(drafted.length, 1, "a question a person owes was hidden behind an unagreed purpose");
  assert.equal(drafted[0].candidates.length, 2, "it came back without the options somebody drafted");

  /** And the blanks are there too, so the whole feature is visible rather than one line of it. */
  assert.ok(
    it.owed.filter((o) => o.owes === "blank").length >= 2,
    `only ${it.owed.length} thing(s) offered on a feature with nine blanks and a drafted question`
  );
});

test("the command prints both numbers, because they are the only evidence the fold happened", () => {
  const dir = corpus();
  agreeThePurpose(dir);
  const out = execFileSync("node", [CLI, "v2", "interview", "chores", "--at", dir], { encoding: "utf-8" });
  assert.match(out, /3 questions, closing 9 holes/, `the header does not report the fold:\n${out}`);
  /** ⛔ And `--take` changes how much is shown, never what is claimed. */
  const one = execFileSync("node", [CLI, "v2", "interview", "chores", "--at", dir, "--take", "1"], { encoding: "utf-8" });
  assert.match(one, /3 questions, closing 9 holes/, "`--take` rewrote the tally instead of the page");
  assert.equal((one.match(/fills:/g) ?? []).length, 1, "`--take 1` printed more than one question");
});

test("⛔ a policy slot folds and a per-behaviour slot does not, in one corpus", () => {
  /**
   * ⛔ THE FOLD WAS A LIE ON THREE OF THE EIGHT SLOTS AND THE ARITHMETIC AGREED WITH IT.
   *
   * Folding is honest where the slot IS the question — what a product does about refusal, failure,
   * repetition, permission and concurrency is one decision applied everywhere, which is why `Rule`
   * can supply those outright. It is not honest on `with`, `answer` or `after`: three behaviours
   * blank on *"what is different afterwards"* are blank on three DIFFERENT questions, and one
   * pressable option covering all three settles two behaviours the reviewer was never shown.
   *
   * ⛔ AND BOTH KINDS ARE MEASURED OFF ONE CORPUS, so a fold that started applying everywhere — or
   * stopped applying anywhere — cannot pass. Three distinguishable outcomes, which is what this
   * project requires of any count whose correct value could be reached by doing nothing:
   *
   *     a policy slot blank at 3 sites            →  1 question
   *     a per-behaviour slot blank at 3 sites      →  3 questions
   *     a slot an existing question speaks for     →  0 new questions
   */
  const dir = corpus();
  agreeThePurpose(dir);
  /** Blank `after` on all three as well, so both kinds are live at once. */
  const file = path.join(dir, "truth", "chores.md");
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, "utf-8")
      .replace(/      after:\n        says: The list has one more thing on it than it had before\.\n/g, "")
  );

  const { it, findings } = round(dir);
  assert.equal(
    findings.filter((f) => f.kind === "slot-blank" && f.where.startsWith("chores#")).length,
    12,
    "the fixture is not blank where this test needs it"
  );

  const bySlot = (slot) => it.owed.filter((o) => o.owes === "blank" && o.fills.every((f) => f.endsWith(`#${slot}`)));

  /** `at_once` is policy — one question, naming all three. */
  const policy = bySlot("at_once");
  assert.equal(policy.length, 1, "a policy slot stopped folding");
  assert.equal(policy[0].fills.length, 3);

  /** `after` is a fact about one ask — three questions, each at its own behaviour. */
  const perAsk = bySlot("after");
  assert.equal(perAsk.length, 3, "`after` folded, so one option would settle three behaviours nobody was shown");
  assert.deepEqual(perAsk.map((o) => o.fills.length), [1, 1, 1]);
  /** ⛔ The BEHAVIOUR half only — the question itself contains a comma, and the first version of
   *  this assertion matched that and failed on correct output. */
  for (const o of perAsk)
    assert.doesNotMatch(
      o.asks.split(" — ")[0],
      /,/,
      `"${o.asks}" names more than one behaviour for a question that has one answer per behaviour`
    );
});

test("⛔ POLICY_SLOTS is not DEMONSTRABLE_SLOTS, and the one slot between them is the point", () => {
  /**
   * ⛔ THEY ARE ONE SLOT APART AND ANSWER DIFFERENT QUESTIONS. `answer` owes a given/when/then and
   * does NOT fold — what the asker gets is a fact about that ask, even though three rules in the
   * seed declare `fills: [answer]` and constrain how a figure reads. Collapsing the two sets would
   * make the next change to either silently change the other.
   */
  assert.ok(DEMONSTRABLE_SLOTS.includes("answer"), "the premise of this test is gone");
  assert.ok(!POLICY_SLOTS.includes("answer"), "`answer` folded, so one answer now covers several behaviours' returns");
  assert.ok(!POLICY_SLOTS.includes("with") && !POLICY_SLOTS.includes("after"));
  for (const slot of ["may", "refuses", "fails", "again", "at_once"])
    assert.ok(POLICY_SLOTS.includes(slot), `${slot} stopped being a policy, so its question is now asked once per behaviour`);
});

test("⛔ the grid and the check agree about what a blank is, which is what lets the page ask", () => {
  /**
   * ⛔ THE PIN UNDER THE SWITCH THAT MADE THIS REACHABLE AT ALL.
   *
   * `interviewFor` read blanks from `checkCorpus`, which re-reads a corpus off disk — so the page,
   * handed a loaded corpus and no findings, could not call it. Peter: *"this should be a first class
   * representation in the UX - and claude should ideally be able to access this via mcp"*. It now
   * reads the grid's `·` mark, which a loaded corpus answers.
   *
   * ⛔ THAT IS ONLY SAFE WHILE THE TWO AGREE, and both files carry a ⛔ saying they must. The grid
   * keeps `·` (*"nobody has said what this is"*) apart from `⋯Rn` (waiting on an open org-wide rule)
   * and `⋯` (downstream of an unsettled `answer`) — the two cases `check` declines to report as
   * their own hole. If that ever drifts, the interview starts asking about slots `check` knows are
   * somebody else's question, and nothing else would notice.
   */
  const dir = corpus();
  const { corpus: c, findings } = checkCorpus(dir);

  const fromCheck = new Set(
    findings.filter((f) => f.kind === "slot-blank" && f.where.startsWith("chores#")).map((f) => f.where)
  );
  const fromGrid = new Set();
  for (const id of descendants(c, "chores")) {
    const g = gridFor(c, id);
    if (!g) continue;
    for (const row of g.rows)
      for (const slot of SLOTS) if (row.cells[slot].mark === "·") fromGrid.add(`${id}#${row.exchange}#${slot}`);
  }

  /** ⛔ Non-zero first — two empty sets agree about nothing. */
  assert.equal(fromCheck.size, 9, "the fixture is not blank where this test needs it");
  assert.deepEqual(
    [...fromGrid].sort(),
    [...fromCheck].sort(),
    "the grid and the check disagree about what a blank is, so the interview is now asking about a different set than the one check refuses"
  );
});
