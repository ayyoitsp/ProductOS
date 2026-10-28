/**
 * ⛔ FOUR DEFECTS FOUND BY RUNNING THE `interviewer` AGAINST A LIVE INSTANCE, none of which any
 * test in this repo could see. Each is pinned here against the thing that was actually wrong.
 *
 * The run was the first time that role's brief had been followed end to end rather than simulated
 * by a session calling the derivations directly. Everything below came back from it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { interviewFor } = await import(path.resolve("dist/v2/interview.js"));
const { questionsFor } = await import(path.resolve("dist/v2/settle.js"));
const { fileNote } = await import(path.resolve("dist/v2/notes.js"));
const { raiseQuestion } = await import(path.resolve("dist/v2/suggest.js"));
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));
const { INTENTS } = await import(path.resolve("dist/v2/intents.js"));
const { isHuman, VIA } = await import(path.resolve("dist/v2/acts.js"));
const { NOTE_VIA } = await import(path.resolve("dist/v2/schema.js"));
const CLI = path.resolve("dist/cli/index.js");

const seed = () => {
  const dir = path.join(temp("pos-door-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  return dir;
};

/**
 * ⛔ THE SHAPE THE DOOR DECLARES, read off `productos_in`'s own schema rather than typed here —
 * the point of the defect was that one surface described the call differently from the tool.
 */
const doorFields = () => {
  const door = INTENTS.find((i) => i.name === "document");
  assert.ok(door, "the `document` intent is gone, and it is this test's witness for the shape");
  return door;
};

test("⛔ every act the worklist prints wraps its fields the way the door takes them", () => {
  /**
   * ⛔ THE FOURTH TIME THIS SURFACE PRINTED A CALL THE TOOL REFUSES, at the line already carrying a
   * ⛔ about having fixed it once.
   *
   * `productos_in`'s schema is `{dir?, intent, fields}` with `additionalProperties: false`, so flat
   * fields are dropped before the handler sees them — and the refusal then reads **"ask needs
   * `ref`, `question`, `asked_of`, `blocks`"**, naming the four fields the caller DID supply. The
   * interviewer reported it: *"The worklist instructs a caller to make a call the door refuses."*
   */
  const dir = seed();
  /**
   * ⛔ BOTH DOOR-ROUTED KINDS HAVE TO EXIST, or this measures nothing — which is how its first
   * version failed: the seed has no blank slot and no finding, so every act in it was a press.
   */
  const first = loadCorpus(dir);
  const scope = first.scopes.find((x) => x.scope.exchanges.length).scope.id;
  const ex = first.scopes.find((x) => x.scope.id === scope).scope.exchanges[0].id;

  /** A blank: strip one slot out of the seed's own truth. */
  const file = first.scopes.find((x) => x.scope.id === scope).file;
  const was = fs.readFileSync(file, "utf-8");
  const stripped = was.replace(/\n      again:\n(?:        .*\n)+/, "\n");
  assert.notEqual(stripped, was, "nothing was stripped, so there is no blank slot to measure");
  fs.writeFileSync(file, stripped);

  /** And a finding. */
  const r = fileNote(dir, {
    about: `${scope}#${ex}`,
    says: "Nothing says which screen owns the reader's place in the list.",
    assumed: "that it is not kept, so they land at the top every time",
    by: "productos-buildability",
    via: "review",
    at: "2026-10-22",
  });
  assert.equal(r.ok, true, `the finding could not be filed: ${r.ok === false ? r.why : ""}`);

  const it = interviewFor(loadCorpus(dir), scope);
  const kinds = new Set(it.owed.filter((o) => o.act?.includes("productos_in")).map((o) => o.owes));
  assert.ok(kinds.has("blank"), "no blank reached the worklist");
  assert.ok(kinds.has("found"), "no finding reached the worklist");

  const calls = it.owed.map((o) => o.act).filter((a) => a && a.includes("productos_in"));
  assert.ok(calls.length, "no act routes through the door, so this test is measuring nothing");
  for (const act of calls) {
    /** Every `productos_in {...}` payload in the string, parsed. */
    for (const m of act.matchAll(/productos_in (\{.*?\})(?= —|$)/g)) {
      const body = JSON.parse(m[1]);
      assert.ok(body.intent, `an act names no intent: ${m[1]}`);
      assert.ok(body.fields, `the act for intent "${body.intent}" puts its fields flat, which the door drops: ${m[1]}`);
      for (const k of Object.keys(body))
        assert.ok(["intent", "fields", "dir"].includes(k), `"${k}" sits beside \`fields\`, where the door refuses it`);
      /** ⛔ And the field names are the intent's own, not names this file invented. */
      const spec = INTENTS.find((i) => i.name === body.intent);
      assert.ok(spec, `the act names intent "${body.intent}", which does not exist`);
      const known = new Set(spec.takes.map((f) => f.name));
      for (const k of Object.keys(body.fields))
        assert.ok(known.has(k), `"${body.intent}" does not take "${k}" — it takes ${[...known].join(", ")}`);
      for (const f of spec.takes.filter((x) => x.required))
        assert.ok(f.name in body.fields, `the act for "${body.intent}" omits required field "${f.name}"`);
    }
  }
  void doorFields();
});

test("⛔ a finding's act carries the note's own id, or closing it is unfollowable", () => {
  /**
   * `close` takes the note's id. `Owed.ref` is the note's `about`, which is a slot ref — so
   * *"then close the finding"* required an id the worklist never handed over. Reported verbatim:
   * *"Following the instruction requires an id the worklist does not hand you."*
   */
  const dir = seed();
  const corpus0 = loadCorpus(dir);
  const scope = corpus0.scopes.find((x) => x.scope.exchanges.length)?.scope.id;
  const ex = corpus0.scopes.find((x) => x.scope.id === scope).scope.exchanges[0].id;

  const r = fileNote(dir, {
    about: `${scope}#${ex}`,
    says: "Nothing says where the reader's place in the list lives when they come back.",
    assumed: "that it is not kept at all, so they land at the top every time",
    by: "productos-buildability",
    via: "review",
    at: "2026-10-22",
  });
  assert.equal(r.ok, true, `the finding could not be filed: ${r.ok === false ? r.why : ""}`);

  const f = interviewFor(loadCorpus(dir), scope).owed.find((o) => o.owes === "found");
  assert.ok(f, "a stored finding did not reach the queue");
  assert.match(f.act, new RegExp(`"note":"${r.note.id}"`), `the act does not carry the note's id: ${f.act}`);
  assert.match(f.act, /"intent":"close"/, "nothing in the act closes the finding");
});

test("⛔ the note intent can file a review finding, and exposes the fields that make one", () => {
  /**
   * ⛔ THE FEATURE WAS UNREACHABLE BY THE THING MEANT TO USE IT. This intent exposed
   * `about, says, by?, probe?` and HARDCODED `via: "page"`, so no caller of the door could file a
   * `review` note — option B's whole path had exactly one working route, `fileNote` in-process,
   * which a session against a hosted project does not have.
   *
   * ⛔ AND THE HARDCODE WAS ITSELF A FORGERY: every note through the door claimed a person pressed
   * it on a page.
   */
  const note = INTENTS.find((i) => i.name === "note");
  const takes = new Set(note.takes.map((f) => f.name));
  assert.ok(takes.has("via"), "the note intent cannot say how the request arrived, so every one claims a person pressed it");
  assert.ok(takes.has("assumed"), "the note intent cannot carry what a builder would assume, so no finding can be filed through the door");
});

test("⛔ `review` is a way a request arrives and never a way consent was obtained", () => {
  /**
   * Adding `review` to the note's own enum while the door validated against `VIA` meant the value
   * the schema accepted was refused one layer out: *"review is not a way a request could have
   * arrived"*, listing the five that are not it.
   */
  assert.ok(NOTE_VIA.includes("review"), "a judge's finding has no way to say nobody asked for it");
  assert.ok(NOTE_VIA.includes("agent"), "software filing a request on its own behalf cannot say so");
  assert.ok(!VIA.includes("review"), "`review` became a way consent could be obtained, which it can never be");
});

test("⛔ nobody pressed `review`, and `isHuman` says so positively", () => {
  /**
   * ⛔ IT WAS `via !== "agent"` — correct for the five values consent has, and silently wrong for
   * the first value added beside them. Under the negative reading `review` counted as HUMAN, so
   * `mayRecord` would have refused a token filing a finding on the grounds it was claiming a person
   * did something.
   */
  assert.equal(isHuman("review"), false, "a judge's finding reads as something a person did");
  assert.equal(isHuman("agent"), false);
  for (const v of ["page", "question", "chat", "cli"])
    assert.equal(isHuman(v), true, `${v} stopped counting as a person doing something`);
});

test("⛔ a question is not asked twice on one slot, and the worklist says which it covers", () => {
  /**
   * The brief claimed *"every slot an existing question speaks for is gone from the list"*. True of
   * blank slots; false of the worklist, where an already-drafted question is the queue and belongs
   * there. The interviewer read it as "which is your whole input" and nearly drafted a second
   * question on a slot that already held one — which `raiseQuestion` then refuses:
   * *"one question per slot — answer or reword the one that is there"*.
   */
  const dir = seed();
  const corpus = loadCorpus(dir);
  const scope = corpus.scopes.find((x) => questionsFor(corpus, x.scope.id).length)?.scope.id;
  assert.ok(scope, "the seed holds no questions, so this test is measuring nothing");
  const it = interviewFor(corpus, scope);

  /** Each ref appears once across the whole worklist. */
  const refs = it.owed.map((o) => o.ref);
  assert.equal(new Set(refs).size, refs.length, `a ref is in the worklist twice: ${refs.join(", ")}`);
});

test("⛔ a third option can be added to a question somebody is already weighing", () => {
  /**
   * ⛔ "ONE QUESTION PER SLOT" WAS NEVER A PRODUCT RULE. Peter: *"again, one question per slot is
   * not a requirement"*, and *"questions should seek to answer MULTIPLE questions in an EFFICIENT
   * manner. no idea why this limitation would exist"*.
   *
   * `ask` refused any open slot and advised *"reword the one that is there"* — which no verb
   * implements. So a question was frozen at whatever options its first drafter wrote, and a judge's
   * finding with one wrong option could never be corrected. Found by the interviewer, which wanted
   * a third reading and had nowhere to put it.
   */
  const dir = seed();
  const c = loadCorpus(dir);
  const q = c.scopes
    .flatMap(({ scope }) => questionsFor(c, scope.id))
    .find((x) => x.candidates.length >= 2 && x.ref.includes("#"));
  assert.ok(q, "the seed holds no drafted question, so this measures nothing");
  const before = q.candidates.length;

  const r = raiseQuestion(dir, {
    ref: q.ref,
    question: "ignored on a merge",
    asked_of: "peter",
    blocks: [],
    /**
     * ⛔ `replaces` MIRRORS WHAT IS ALREADY THERE. Where the standing has an `about`, every
     * candidate owes it (fg-0001's requirement) — so an option added to such a question owes it
     * too, and the schema refuses the merge otherwise. Copied from the options already on the
     * table rather than guessed, which is what a drafter adding a third one has to do.
     */
    candidates: [
      {
        says: "A third reading nobody had drafted.",
        consequence: "It is on the table, which is the whole point.",
        ...(q.candidates[0].replaces ? { replaces: q.candidates[0].replaces } : {}),
      },
    ],
    by: "productos-interviewer",
  });
  assert.equal(r.ok, true, `a third option could not be added: ${r.ok === false ? r.why : ""}`);
  assert.match(r.said, /added 1 answer/);

  const after = questionsFor(loadCorpus(dir), q.scope).find((x) => x.ref === q.ref);
  assert.equal(after.candidates.length, before + 1, "the option did not land");
  /** ⛔ APPENDED, NEVER REPLACED — a drafter must not be able to delete what a person was weighing. */
  assert.equal(after.asks, q.asks, "the question was reworded under the person it is asked of");
});

test("⛔ and a merge with nothing to add is refused rather than rewording the question", () => {
  /**
   * The other half: `ask` with no candidates on an open slot is still a refusal, but for the honest
   * reason — there is nothing to add — instead of advising an act that does not exist.
   */
  const dir = seed();
  const c = loadCorpus(dir);
  const q = c.scopes
    .flatMap(({ scope }) => questionsFor(c, scope.id))
    .find((x) => x.candidates.length >= 1 && x.ref.includes("#"));
  const r = raiseQuestion(dir, {
    ref: q.ref,
    question: "a different question entirely",
    asked_of: "peter",
    blocks: [],
    by: "x",
  });
  assert.equal(r.ok, false);
  /**
   * ⛔ TWO THINGS CAN BE ADDED NOW, not one. `candidates` adds an answer; `blocks` says which other
   * questions this one answer settles — the act that closed fg-0004. The refusal names both, because
   * a drafter told only about candidates leaves two questions unlinked and a person answers them
   * into a contradiction.
   */
  assert.match(r.detail.join(" "), /`candidates`/, "it does not say another answer can be added");
  assert.match(r.detail.join(" "), /`blocks`/, "it does not say the questions this one settles can be named");
  /**
   * ⛔ AND THE THIRD THING IS NOW A REWORDING, WHICH IS WHY THIS ASSERTION MOVED. The refusal used
   * to say the question *"is not reworded from here"*, full stop — right about the harm (being
   * rewritten silently) and wrong about the cure, because it froze 1,315 badly-worded questions on
   * a real corpus. So the deliberate act exists and the refusal names it.
   */
  assert.match(r.detail.join(" "), /rephrase/, "the refusal does not say how to say the question better on purpose");

  /**
   * ⛔ THE PROPERTY, WHICH THIS FILE ONLY EVER ASSERTED AS A SENTENCE. It checked that the refusal
   * CLAIMED nothing was rewritten and never checked that nothing was — so the message and the
   * behaviour could have diverged with the test still green.
   */
  const after = loadCorpus(dir).scopes.flatMap(({ scope }) => questionsFor(loadCorpus(dir), scope.id)).find((x) => x.ref === q.ref);
  assert.notEqual(after.question, "a different question entirely", "the question was rewritten under somebody with no `rephrase`");
});

test("⛔ a control that does something and has no behaviour reaches the worklist", () => {
  /**
   * Peter, shown one: *"this is exactly something the interviewer should be asking, right?"*
   *
   * `check` refuses it mechanically — *"pressing it changes something and nothing says what happens.
   * No behaviour is anchored at it at all"* — and the interview reported it in NO form: not a blank
   * slot, not a standing, not an undrawn screen. On the feature where the interviewer found it, it
   * was the only refusal in the whole scope.
   *
   * ⛔ AND IT ARRIVES AS AN AUTHOR'S WORK, NOT AS A QUESTION, because `check`'s own fix is addressed
   * to one: *"state it in the `answer` of an exchange at this control"*. The behaviour has to exist
   * before a question about it has anywhere to live.
   */
  const dir = seed();
  const { corpus, findings } = checkCorpus(dir);
  const wanted = ["pressing-this-promises-nothing", "pressing-this-moves-nothing", "states-no-behaviour"];
  const hit = findings.find((f) => wanted.includes(f.kind));
  if (!hit) {
    /** ⛔ Said out loud rather than passing quietly — a guard that measured nothing must say so. */
    console.log("    (the seed carries none of these kinds; the live-corpus case is covered by the CLI run)");
    return;
  }
  const scope = hit.where.split("#")[0];
  const it = interviewFor(corpus, scope, findings);
  const u = it.owed.filter((o) => o.owes === "unanchored");
  assert.ok(u.length, `check found ${hit.kind} in ${scope} and the worklist reports none of it`);
  for (const o of u) {
    assert.match(o.why, /nothing anywhere says what it does/, "it reads as a question when it is not one yet");
    assert.match(o.act, /an author states the behaviour/, "it does not route to the role that has to write it");
    assert.ok(o.shape.length > 20, "it drops check's own fix, so a reader is told the problem and not the remedy");
  }
});

test("⛔ the author's queue is not routed here, or the few that matter are buried", () => {
  /**
   * A real corpus produces 1,400 findings across twenty-two kinds. 422 `nothing-demonstrates-this`
   * want a criterion; 130 `who-may-is-only-prose` want prose restructured. None stops anybody
   * deciding anything, and routing them in would bury the handful that stop a feature being askable
   * at all — the same failure this derivation exists to prevent, arriving through generosity.
   */
  const dir = seed();
  const { corpus, findings } = checkCorpus(dir);
  const scope = corpus.scopes.find((x) => x.scope.exchanges.length).scope.id;
  const it = interviewFor(corpus, scope, findings);
  const bulk = ["nothing-demonstrates-this", "who-may-is-only-prose", "a-requirement-older-than-its-claim"];
  for (const f of findings.filter((x) => bulk.includes(x.kind))) {
    const o = it.owed.find((x) => x.ref === f.where && x.owes === "unanchored");
    assert.ok(!o, `${f.kind} at ${f.where} was routed to the worklist as something unanchored`);
  }
});
