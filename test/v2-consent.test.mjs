/**
 * ⛔ THE GUARANTEE THAT REPLACED A STRONGER ONE, ASSERTED RATHER THAN ASSUMED.
 *
 * This file was `v2-mcp-boundary.test.mjs`, and it failed the build if any MCP tool could perform
 * one of the five acts — on the reasoning that MCP is what a model reaches for unprompted. That
 * boundary was opened deliberately, so a person can answer in conversation or press a button on a
 * rendered page. "A model cannot produce a verdict" is therefore no longer true.
 *
 * What is true instead has to be mechanical, or it is a comment — and a comment has already failed
 * on this exact boundary once, which is why the old test existed. So:
 *
 *   - every act tool demands `by` AND `via`, and neither may be optional or defaulted
 *   - no act is recordable without the person's own reasoning, where the model charges for it
 *   - a refused act writes NOTHING
 *   - the verdict carries the `via` it was given, unaltered
 *   - one act, four callers, one result — a surface cannot diverge from the others
 *
 * The one prohibition that stays: v1's `verifyBehavior` is still withheld from models. That
 * boundary was not part of this decision.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { tools } from "../dist/mcp/tools.js";
import { EXCHANGE_ACT_TOOLS, EXCHANGE_READ_TOOLS } from "../dist/mcp/v2-tools.js";
import { perform, VIA } from "../dist/v2/acts.js";
import { loadCorpus } from "../dist/v2/load.js";

const REASON =
  "A reason long enough to carry the argument, which is the whole price of the strongest act in the schema.";
const paths = { productsDir: path.resolve("productos/products") };

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2consent-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
}
const verdictsIn = (dir) => loadCorpus(dir).verdicts;

test("every act tool demands who decided and how their consent was obtained", () => {
  assert.ok(EXCHANGE_ACT_TOOLS.length === 5, `expected the five acts, saw ${EXCHANGE_ACT_TOOLS.length}`);
  for (const t of EXCHANGE_ACT_TOOLS) {
    const s = t.inputSchema;
    for (const f of ["by", "via"]) {
      assert.ok(s.properties?.[f], `${t.name} does not take ${f}`);
      assert.ok(s.required?.includes(f), `${t.name} treats ${f} as optional — the record of consent cannot be partial`);
      assert.ok(
        !("default" in (s.properties[f] ?? {})),
        `${t.name} DEFAULTS ${f} — the weakest provenance would silently wear the strongest name`
      );
    }
    assert.deepEqual(
      s.properties.via.enum,
      [...VIA],
      `${t.name} accepts a via the model does not define`
    );
    // ⛔ The description has to say what the value MEANS, because the model writing it has to
    // choose honestly and nothing can check the choice afterwards.
    assert.match(s.properties.via.description ?? "", /press|chose|conversation/i, `${t.name} does not say what via means`);
  }
});

test("the read tools record nothing, whatever they are called with", () => {
  const dir = seed();
  const before = JSON.stringify(verdictsIn(dir));
  for (const t of EXCHANGE_READ_TOOLS) {
    assert.ok(!("by" in (t.inputSchema.properties ?? {})), `${t.name} takes a name — is it an act?`);
  }
  assert.equal(JSON.stringify(verdictsIn(dir)), before);
});

test("a refused act writes nothing at all", () => {
  const dir = seed();
  const cases = [
    // reasoning below the floor the schema charges
    ["rule", { slot: "money#record-spending#after", because: "yes" }],
    // a name that is not a name
    ["waive", { slot: "tasks#complete-a-task#at_once", because: REASON }, { by: "someone", via: "chat" }],
    // a way consent could not have been obtained
    ["defer", { slot: "tasks#complete-a-task#at_once", because: REASON, until: "a second family" }, { by: "peter", via: "telepathy" }],
    // an act aimed at nothing
    ["accept", { target: "money#no-such-exchange" }],
  ];
  for (const [act, payload, consent] of cases) {
    const r = perform(dir, act, payload, consent ?? { by: "peter", via: "chat" });
    assert.equal(r.ok, false, `${act} was allowed: ${JSON.stringify(r)}`);
    assert.ok(r.why, `${act} refused without saying why`);
  }
  assert.deepEqual(verdictsIn(dir), [], "a refused act left a verdict behind");
});

test("the verdict carries the via it was given, unaltered", () => {
  for (const via of VIA) {
    const dir = seed();
    const r = perform(
      dir,
      "defer",
      { slot: "tasks#complete-a-task#at_once", because: REASON, until: "a second family runs the trial" },
      { by: "peter", via }
    );
    assert.equal(r.ok, true, r.why);
    const [v] = verdictsIn(dir);
    assert.equal(v.via, via, `recorded ${v.via} for a ${via} act`);
  }
});

/**
 * ⛔ THE TEST THAT WOULD HAVE CAUGHT THE DEFECT THIS CODEBASE KEEPS FINDING.
 *
 * `gateFor` diverged from `check` by one clause and made two of the five seed exchanges
 * permanently un-acceptable — invisible on every surface, in both directions. Four surfaces now
 * record acts; this asserts they cannot drift apart, by driving the same ruling through the MCP
 * handler and through `perform` and comparing the truth byte for byte.
 */
test("one act, two callers, identical truth — only via differs", async () => {
  const direct = seed();
  const viaMcp = seed();
  const payload = {
    slot: "money#record-spending#after",
    // ⛔ Keeps the agreed clause. The clause-loss guard refuses a ruling that silently drops part
    // of a sentence when only one thing about it was in question, and it caught the first version
    // of this fixture — which is the guard working.
    says: "The kid has that much less than they had before — even past nothing, and their money then reads as owed rather than as a negative number.",
    because: REASON,
  };

  const a = perform(direct, "rule", payload, { by: "peter", via: "cli" });
  assert.equal(a.ok, true, a.why);

  const settle = EXCHANGE_ACT_TOOLS.find((t) => t.name === "productos_exchange_settle");
  const b = await settle.handler({ ...payload, by: "peter", via: "question", dir: viaMcp }, paths);
  assert.equal(b.ok, true, b.why);

  const truth = (d) => fs.readFileSync(path.join(d, "truth", "money.md"), "utf-8");
  assert.equal(truth(viaMcp), truth(direct), "the same ruling produced different product truth");

  const [x] = verdictsIn(direct);
  const [y] = verdictsIn(viaMcp);
  assert.equal(x.via, "cli");
  assert.equal(y.via, "question");
  assert.deepEqual({ ...x, via: null }, { ...y, via: null }, "the verdicts differ by more than how consent was obtained");
});

/**
 * ⛔ A refusal is RETURNED by the MCP handler, not thrown. `server.ts` turns a throw into a bare
 * message, which drops `instead` — and `instead` is what the caller is about to offer a person.
 */
test("a refusal reaches an MCP caller with the honest exits intact", async () => {
  const dir = seed();
  const t = EXCHANGE_ACT_TOOLS.find((x) => x.name === "productos_exchange_record_read_through");
  const r = await t.handler({ scope: "tasks", buildable: true, by: "peter", via: "chat", dir }, paths);
  assert.equal(r.ok, false);
  assert.ok(r.instead?.length, "a refusal with no way forward is where reviewers stop reviewing");
  for (const i of r.instead) {
    assert.ok(i.act && i.ref && i.why, `an offered act is incomplete: ${JSON.stringify(i)}`);
  }
});

/** ⛔ Unchanged: v1 verification is still not a thing a model may do. */
test("v1 behaviour verification is still withheld from models", () => {
  // ⛔ `unverify_behavior` IS registered and should be — withdrawing a stamp is not claiming one.
  const offending = tools.filter((t) => /(^|_)verify_behavior$/i.test(t.name));
  assert.deepEqual(offending.map((t) => t.name), []);
});

/** Every exchange tool is actually registered, or none of the above proves anything. */
test("the exchange tools are on the MCP surface", () => {
  const names = new Set(tools.map((t) => t.name));
  for (const t of [...EXCHANGE_READ_TOOLS, ...EXCHANGE_ACT_TOOLS])
    assert.ok(names.has(t.name), `${t.name} is defined and not registered`);
});

/**
 * ⛔ ONE CORPUS'S WRITE MUST NOT REACH ANOTHER — AND IT DID, THROUGH A PARSER CACHE.
 *
 * `gray-matter` keys a cache on file content and returns a SHALLOW copy on a hit, so `data` is one
 * shared object across every file holding the same bytes. Every write path here is
 * read-modify-write on `data`, so a ruling applied to one copy of a corpus made a second,
 * untouched copy report the slot as settled — while that copy's file on disk still said `open`. A
 * read could return state no file anywhere contained.
 *
 * Found by the cross-caller test above, which compares two copies of one seed. That is the
 * reset-and-compare shape the whole review loop rests on, so it is pinned rather than remembered.
 */
test("a write to one corpus is invisible to an identical one", () => {
  const a = seed();
  const b = seed();
  const standingIn = (d) =>
    loadCorpus(d)
      .scopes.find((s) => s.scope.id === "money")
      .scope.exchanges.find((e) => e.id === "record-spending").slots.after.standing?.kind;

  assert.equal(standingIn(a), "open");
  assert.equal(standingIn(b), "open");

  const r = perform(
    a,
    "rule",
    {
      slot: "money#record-spending#after",
      says: "The kid has that much less than they had before — even past nothing, and their money then reads as owed rather than as a negative number.",
      because: REASON,
    },
    { by: "peter", via: "cli" }
  );
  assert.equal(r.ok, true, r.why);

  assert.equal(standingIn(a), "stated", "the ruling did not land where it was aimed");
  assert.equal(standingIn(b), "open", "the ruling leaked into a corpus nobody touched");
  // ⛔ And the committed fixture itself, which every other test treats as pristine.
  assert.equal(standingIn("v2-seed"), "open", "the ruling reached the committed seed");
  /**
   * ⛔ Asserted on the STANDING, not on the sentence. The bug hid behind a string check twice
   * while I was chasing it: the ruled sentence is a near-copy of the option it was picked from, so
   * grepping the file for it matches the drafted candidate that was always there and reports
   * contamination where there is none. Whether a slot is settled is the fact; the words are not.
   */
});
