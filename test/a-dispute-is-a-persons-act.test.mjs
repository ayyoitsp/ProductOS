/**
 * ⛔ WITHDRAWING A QUESTION IS SOMETHING A PERSON DOES, AND AN AGENT DID IT.
 *
 * `Note.disputes` takes a question off the worklist: `questionsFor` stamps it `disputed`, the page
 * stops offering it, and `interviewFor` turns it into work for an author instead of a question for
 * anybody. The gate on that was `isHuman(n.via)` — a claim about how a request ARRIVED — and the
 * door defaulted `via` from the principal's `kind`.
 *
 * An interviewer agent, reading its own write back off a live instance:
 *
 *   "I sent no `via`; the door recorded `via: "page"`, which `isHuman` counts as a person. Harmless
 *    here (no `disputes`, and `by: productos-interviewer`), but it means an agent filing
 *    `disputes: true` through this HTTP door would withdraw a question from the worklist as though a
 *    person had rejected it — `questionsFor` gates that on `isHuman(n.via)`, not on `by`. Worth a
 *    look at `watchedAPerson` for a token coming in over `/api/v2/in`."
 *
 * It was right, and the hole was one layer below the line it points at: `PRODUCTOS_AUTH=off` — which
 * is how the instance he reviews on runs — returned `kind: "browser"` for EVERY request, including
 * one carrying a `Bearer`. So the default read its caller correctly and the caller had been
 * misdescribed. Measured before the fix, on the shipped modules:
 *
 *     auth off + Bearer         -> principal kind: browser
 *     note, no via, disputes    -> accepted, recorded `via: page`, question withdrawn
 *     relay token, via: chat    -> accepted, question withdrawn, nothing saying a courier carried it
 *
 * Three things changed, and this file is one test per thing:
 *
 *   1. auth off is a SIGN-IN switch. A credentialled request is still a token.
 *   2. `disputes` with a `via` nobody could have said it through is refused at the SHAPE, so every
 *      writer is covered and not only the door.
 *   3. a relayed note records `relayed_by`, the way a relayed verdict always has — so a press the
 *      instance watched and somebody's word for one are tellable apart on disk and on the surface.
 *
 * ⛔ AND THE ACCEPTED CASES ARE ASSERTED BESIDE THE REFUSALS. A guard that refuses everything would
 * pass every test above and make the feature unreachable by the only person it is now reserved for.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { temp } from "./support/temp.mjs";

const CLI = path.resolve("dist/cli/index.js");

const { loadCorpus } = await import("../dist/v2/load.js");
const { raiseQuestion } = await import("../dist/v2/suggest.js");
const { questionsFor } = await import("../dist/v2/settle.js");
const { intentNamed } = await import("../dist/v2/intents.js");
const { interviewFor } = await import("../dist/v2/interview.js");
const { renderScopePage } = await import("../dist/v2/page.js");
const { checkCorpus } = await import("../dist/v2/check.js");
const { principalFrom } = await import("../dist/v2/store/identity.js");
const { applyMigrations } = await import("../dist/v2/store/migrate.js");
const { accountFor } = await import("../dist/v2/store/identity.js");

const REF = "spending#record-a-spend#fails";
const AGREED =
  "Nothing of the kid's money is changed, the amount the parent typed stays on the screen, and the parent can try again without starting over.";
const REJECTION = "this question makes no sense to me, no idea what you're talking about";

/** A corpus with exactly one open question, so a worklist count of 1 or 0 means something. */
function oneQuestion() {
  const dir = temp("pos-dispute-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "truth", "spending.md"),
    `---
id: spending
title: Spending
in: family-wallet
exists: kept
happy_path:
  accomplishes: A parent records that a kid spent some of their money
  brings: the kid, and what was spent
  ends_with: the kid's money is smaller by that amount and the spend is on the list
  through: [spend-form]
exchanges:
  - id: record-a-spend
    title: A parent records a spend
    asked_by: person
    at:
      view: spend-form
      part: save-button
    reads: [money, kid]
    changes: [money]
    slots:
      may:
        says: A parent may record a spend for any kid in their family.
      fails:
        says: ${AGREED}
---

# Spending
`
  );
  const c = loadCorpus(dir);
  assert.equal(c.broken.length, 0, `the fixture does not load: ${c.broken.map((b) => b.why).join("; ")}`);
  const asked = raiseQuestion(dir, {
    ref: REF,
    question: "A parent taps save and it cannot be reached. Are they told why?",
    about: "whether the parent is told why it could not be saved",
    candidates: [
      {
        says: "The parent is told the store could not be reached.",
        consequence: "a parent knows it was not their mistake",
        replaces: "adds a statement",
      },
      { says: "The parent is told only that it did not save.", consequence: "less to read", replaces: "adds a statement" },
    ],
    cost: "a parent who cannot tell a bug from an outage stops trusting the balance",
    blocks: [],
    asked_of: "peter",
    by: "demo",
  });
  assert.ok(asked.ok, `the question was not raised: ${asked.why}`);
  /**
   * ⛔ THE NON-ZERO EVERY COUNT BELOW IS READ AGAINST, and there are deliberately TWO questions.
   *
   * "the ref is not offered" is also what an empty worklist produces, and what a broken fixture
   * produces. The second question is the control: it must still be offered after every one of these
   * acts, or what is being measured is a surface that stopped showing anything.
   */
  assert.ok(offered(dir).includes(REF), "the fixture does not offer the question it is about");
  assert.ok(offered(dir).length > 1, "there is no second question to tell a withdrawal from a blank worklist");
  return dir;
}

const note = intentNamed("note");
const file = (dir, who, body) =>
  note.run({ dir, who, pressing: "whoever-is-at-this-machine" }, { about: REF, says: REJECTION, ...body });

/**
 * The refs a person is actually offered — the same filter `renderScopePage` and `interviewFor`
 * apply: `!q.parked && !q.disputed`.
 */
const offered = (dir) =>
  questionsFor(loadCorpus(dir), "spending")
    .filter((q) => !q.parked && !q.disputed)
    .map((q) => q.ref);
const theOne = (dir) => questionsFor(loadCorpus(dir), "spending").find((q) => q.ref === REF);

/** ⛔ The control: nothing here may empty the worklist, only take one ref off it. */
const stillOffered = (dir) => assert.ok(offered(dir).some((r) => r !== REF), "the whole worklist went quiet");

const BROWSER = { kind: "browser", actor: "peter@example.com", session: "sess-1", scopes: ["read", "author"] };
const COURIER = { kind: "token", actor: "productos-interviewer", scopes: ["read", "author", "relay"] };
const PLAIN_TOKEN = { kind: "token", actor: "productos-interviewer", scopes: ["read", "author"] };

// ---------------------------------------------------------------------------
// 1. What the instance KNOWS about the caller.

test("⛔ auth off is a sign-in switch, not a consent switch — a credentialled request is still a token", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  await accountFor(db, "me@localhost");
  const off = { PRODUCTOS_AUTH: "off", PRODUCTOS_SINGLE_ACCOUNT: "me@localhost" };

  /**
   * ⛔ THE NUMBER THAT WAS WRONG. This returned `browser` for a Bearer, which is what made the
   * note's `via` default to `page` for an agent — and `browser` is the one kind `watchedAPerson`
   * lets claim a person with no scope at all.
   */
  const token = await principalFrom(db, { authorization: "Bearer an-agents-token" }, undefined, off);
  assert.equal(token.kind, "token", "auth off still calls a token a browser");

  /** ⛔ AND THE SWITCH STILL GETS OUT OF THE WAY — the reason it short-circuits in the first place. */
  assert.deepEqual([...token.scopes].sort(), ["author", "read", "relay"], "auth off made a token useless");

  /** ⛔ The accepted case beside it: a request with no credential is a person, which IS the cost. */
  const anybody = await principalFrom(db, {}, undefined, off);
  assert.equal(anybody.kind, "browser");
  assert.equal(anybody.actor, "me@localhost");
});

// ---------------------------------------------------------------------------
// 2. A dispute needs somebody whose rejection it is.

test("⛔ an agent filing a dispute as itself is refused, and the question stays on the worklist", () => {
  const dir = oneQuestion();
  /** Exactly what the interviewer sent: no `via` at all. The door now reads it as `agent`. */
  const out = file(dir, COURIER, { by: "productos-interviewer", disputes: true });
  assert.equal(out.ok, false, "an agent withdrew a question from a person's worklist");
  assert.match((out.detail ?? []).join(" "), /cannot dispute a question/);
  assert.match((out.detail ?? []).join(" "), /nobody whose rejection this would be/);
  assert.ok(offered(dir).includes(REF), "the question came off the worklist anyway");
  stillOffered(dir);
  assert.equal(loadCorpus(dir).notes.length, 0, "a refused dispute still reached disk");
});

test("⛔ a judge's `review` finding cannot dispute either — a finding is work, not a rejection", () => {
  const dir = oneQuestion();
  const out = file(dir, COURIER, {
    by: "productos-buildability",
    via: "review",
    assumed: "that a parent is told nothing, because no screen in the corpus says otherwise",
    disputes: true,
  });
  assert.equal(out.ok, false, "a reviewer's finding withdrew a question");
  assert.match((out.detail ?? []).join(" "), /a finding to act on, not a rejection/);
  assert.ok(offered(dir).includes(REF), "a reviewer's finding took the question off the worklist");

  /** ⛔ AND THE SAME FINDING LANDS WITHOUT `disputes` — or this refusal has removed the feature. */
  const owed = file(dir, COURIER, {
    by: "productos-buildability",
    via: "review",
    assumed: "that a parent is told nothing, because no screen in the corpus says otherwise",
  });
  assert.ok(owed.ok, `a review finding was refused outright: ${owed.why} — ${(owed.detail ?? []).join(" ")}`);
  assert.equal(loadCorpus(dir).notes.length, 1);
});

test("⛔ a token that may not carry somebody's words may not carry their rejection", () => {
  const dir = oneQuestion();
  const out = file(dir, PLAIN_TOKEN, { by: "peter", via: "chat", disputes: true });
  assert.equal(out.ok, false, "an author-only token spoke for a person");
  assert.match(out.why, /may not carry somebody else's press/);
  assert.ok(offered(dir).includes(REF), "an author-only token took the question off the worklist");
  stillOffered(dir);
});

// ---------------------------------------------------------------------------
// 3. The two ways a dispute can be honest — and they are tellable apart.

test("⛔ a person pressing on a page withdraws the question, with no courier to name", () => {
  const dir = oneQuestion();
  const out = file(dir, BROWSER, { by: "peter", disputes: true });
  assert.ok(out.ok, `a press was refused: ${out.why} — ${(out.detail ?? []).join(" ")}`);

  const [n] = loadCorpus(dir).notes;
  assert.equal(n.via, "page", "a browser press was not recorded as a press");
  assert.equal(n.disputes, true);
  assert.equal(n.relayed_by, undefined, "a press the instance watched named a courier");

  assert.ok(!offered(dir).includes(REF), "the question a person rejected is still being offered");
  stillOffered(dir);
  assert.equal(theOne(dir).disputed.by, "peter");
  assert.equal(theOne(dir).disputed.relayedBy, undefined);

  /** ⛔ Shown rather than hidden, and with no courier line, because there was no courier. */
  const page = renderScopePage(loadCorpus(dir), "spending", { interactive: true, by: "peter" }) ?? "";
  assert.match(page, /question somebody has rejected/i);
  assert.ok(!page.includes("Carried in by"), "a press was rendered as though something carried it");
});

test("⛔ a courier may carry a rejection, and the record says it did — `relayed_by`", () => {
  const dir = oneQuestion();
  const out = file(dir, COURIER, { by: "peter", via: "chat", disputes: true });
  assert.ok(out.ok, `a relay was refused: ${out.why} — ${(out.detail ?? []).join(" ")}`);

  /** ⛔ Off disk, through `asYaml` and `loadCorpus` — the layer three fields have been dropped at. */
  const [n] = loadCorpus(dir).notes;
  assert.equal(n.by, "peter", "the courier became the presser");
  assert.equal(n.via, "chat");
  assert.equal(n.relayed_by, "productos-interviewer", "nothing recorded that an agent carried it");

  assert.ok(!offered(dir).includes(REF), "a carried rejection did not withdraw the question");
  stillOffered(dir);
  assert.equal(theOne(dir).disputed.relayedBy, "productos-interviewer");

  /** ⛔ And both surfaces say so, because a question is hidden on the strength of it. */
  const page = renderScopePage(loadCorpus(dir), "spending", { interactive: true, by: "peter" }) ?? "";
  assert.match(page, /Carried in by productos-interviewer/);
  const owed = interviewFor(loadCorpus(dir), "spending").owed.find((o) => o.owes === "disputed");
  assert.ok(owed, "the interview does not raise a disputed question as work for an author");
  assert.match(owed.why, /carried in by productos-interviewer rather than pressed here/);
});

// ---------------------------------------------------------------------------
// 4. The other place a person stands — their own terminal.

/**
 * ⛔ THE CLI IS THE DOOR THAT POINTS AT ITSELF AS THE HONEST ROUTE, so it is the one that must not
 * be a way round. Every refusal in `identity.ts` names *the person's own CLI*, and an agent with a
 * Bash tool is holding that CLI — which is why `consentFrom` exists and why `--disputes` asks the
 * same question.
 */
const cli = (args, dir, env = {}) =>
  spawnSync("node", [CLI, "v2", "notes", "add", ...args, "--at", dir], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });

test("⛔ `--disputes` from a shell software is driving is refused, and an ordinary note is not", () => {
  const dir = oneQuestion();
  const common = ["--about", REF, "--by", "peter", "--via", "chat"];

  const refused = cli([REJECTION, ...common, "--disputes"], dir, { CLAUDECODE: "1" });
  assert.equal(refused.status, 1, "an agent's shell withdrew a question from a person's worklist");
  assert.match(refused.stderr, /cannot dispute a question/);
  /** ⛔ It says what gave the shell away, or the refusal is unactionable. */
  assert.match(refused.stderr, /CLAUDECODE is set in this environment/);
  /** ⛔ And it names the route that works, or hand-editing YAML is the only exit. */
  assert.match(refused.stderr, /without --disputes/);
  assert.ok(offered(dir).includes(REF), "the question came off the worklist anyway");

  /**
   * ⛔ THE ACCEPTED CASE, FROM THE SAME SHELL. Carrying what somebody said is the designed path and
   * one gated flag must not take it away — this is the only clause distinguishing "the flag is
   * gated" from "the command is broken".
   */
  const filed = cli([REJECTION, ...common], dir, { CLAUDECODE: "1" });
  assert.equal(filed.status, 0, `an ordinary note was refused: ${filed.stderr}`);
  const [n] = loadCorpus(dir).notes;
  assert.equal(n.via, "chat");
  assert.equal(n.disputes, undefined, "a note filed without the flag disputed anyway");
  assert.ok(offered(dir).includes(REF), "a note with no `disputes` withdrew the question");
});

// ---------------------------------------------------------------------------
// 5. A rejection that withdraws nothing.

test("⛔ a dispute pointed at nothing is reported, and one pointed at a real question is not", () => {
  const dir = oneQuestion();
  const kinds = () => checkCorpus(dir).findings.map((f) => f.kind);

  /** ⛔ The non-zero: an honest dispute must NOT produce this finding, or it fires on everything. */
  assert.ok(file(dir, BROWSER, { by: "peter", disputes: true }).ok);
  assert.ok(
    !kinds().includes("a-rejection-that-withdraws-nothing"),
    "a dispute against a real question was reported as withdrawing nothing"
  );

  /** And one against a ref nothing answers to: it reads as handled and takes nothing off. */
  const stray = note.run(
    { dir, who: BROWSER, pressing: "peter" },
    { about: "spending#record-a-spend#a-slot-that-moved", says: REJECTION, by: "peter", disputes: true }
  );
  assert.ok(stray.ok, `the note was refused: ${stray.why} — ${(stray.detail ?? []).join(" ")}`);
  const found = checkCorpus(dir).findings.find((f) => f.kind === "a-rejection-that-withdraws-nothing");
  assert.ok(found, "a rejection that withdraws nothing was not reported");
  assert.match(found.what, /still being offered/);
  /** ⛔ Every finding names a fix an author can act on — see `framework-not-just-output`. */
  assert.ok(found.fix, "the finding says what is wrong and not what to do");
});

test("⛔ a probe cannot withdraw a question — counted nowhere and taking one off a queue are opposites", () => {
  /**
   * ⛔ FOUND BY A DEPLOY SESSION PROBING THE CONSENT FIX AND NOT BEING ABLE TO ACCOUNT FOR WHAT IT
   * SAW: a 200 with nothing visible written. The note WAS written — `probe: true` means "counted
   * nowhere and shown on no surface a person reviews" — and the invisibility hid the effect rather
   * than there being no effect.
   *
   * Measured before the fix, on a seed corpus: a probe carrying `disputes: true` took answerable
   * questions from 3 to 2. A question vanished from somebody's queue with nothing on any surface
   * to say why.
   *
   * ⛔ TWO PLACES, DELIBERATELY. The door refuses the next one, where a caller can be told. The
   * derivation ignores any already on disk — a refusal at the SHAPE would stop a corpus that
   * carries one from loading at all, which is the model area's rule about not making a field
   * required on the day it lands, wearing its other face.
   */
  const dir = oneQuestion();
  const before = offered(dir);

  const refused = file(dir, BROWSER, { probe: true, disputes: true });
  assert.equal(refused.ok, false, "a probe was allowed to withdraw a question");
  assert.match(refused.why, /counted nowhere/);
  /** ⛔ Both ways out named, or a caller has a refusal and no move. */
  assert.match(refused.detail.join(" "), /drop `probe`/);
  assert.match(refused.detail.join(" "), /drop `disputes`/);

  assert.deepEqual(offered(dir), before, "a refused probe changed what is offered");
});

test("⛔ and an ordinary probe is still a real write — the refusal is about disputing, not probing", () => {
  /**
   * ⛔ THE NON-REFUSAL. "A probe was refused" on its own is also what breaking probes entirely
   * produces, and a probe is a deliberate feature: *"it is still a real write through the whole
   * path, which is the point of it."*
   */
  const dir = oneQuestion();
  const before = offered(dir);

  const ok = file(dir, BROWSER, { probe: true });
  assert.ok(ok.ok, `an ordinary probe note was refused: ${ok.why ?? ""}`);
  assert.deepEqual(offered(dir), before, "an ordinary probe withdrew a question");
});
