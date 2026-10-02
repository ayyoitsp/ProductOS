/**
 * ⛔ WHY, RISKS, MEASURES AND WHAT GETS RECORDED — the framing a PRD has and product truth did not.
 *
 * Peter, after reviewing create-deal against what a PRD carries: *"let's add tabs here - 'why',
 * 'success measures', 'risks' can all be cards that are added in the 'overview' tab.
 * instrumentation should be added as well. success measures and instrumentation should be in a
 * 'Metrics' tab. the existing table should be in the 'Behaviors' tab."*
 *
 * The functional half was already stronger than most PRDs: create-deal had forty-eight specified
 * behaviours including what happens when it is pressed twice and when two people do it at once.
 * `Scope` had eleven fields and not one could hold why the feature was worth building, how anybody
 * would know it worked, what could go wrong, or what gets recorded.
 *
 * ⛔ THE MEASURE-TO-INSTRUMENT PAIRING IS WHY THESE ARE NOT FOUR INDEPENDENT LISTS, and it is the
 * part worth protecting: a measure nothing records cannot be known, and an instrument feeding no
 * measure is telemetry somebody maintains for nobody. Both are invisible while the two lists are
 * separate, and both are the shape of `nothing-reads-what-this-sets` — which exists in this model
 * because the identical mistake happened with terms.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { resolveRef } from "../dist/v2/ref.js";
import { stampFor } from "../dist/v2/stamp.js";
import { perform } from "../dist/v2/acts.js";
import { renderScopePage } from "../dist/v2/page.js";

const FRAMING = `why:
  - id: chores-are-argued-about
    says: A parent and a kid remember the same chore differently, so pocket money is negotiated every week instead of earned.
risks:
  - id: kids-game-the-list
    says: A kid marks a task done that nobody checked, and the money moves before a parent sees it.
    mitigated_by: a parent approves before anything moves into the kid's money
measures:
  - id: fewer-arguments
    says: Chores stop being renegotiated — a week passes with no task disputed.
    target: in four of five households, zero disputed tasks in a fortnight
  - id: no-target-yet
    says: Kids come back to the list without being asked to.
instruments:
  - id: disputed-tasks
    says: Each time a parent rejects a completion a kid claimed, with the task and the day.
    feeds: [fewer-arguments]
  - id: orphan-telemetry
    says: Every time the task list is opened, and by whom.
    feeds: []
`;

function seeded(framing = FRAMING) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2frame-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const f = path.join(dir, "truth", "tasks.md");
  const was = fs.readFileSync(f, "utf-8");
  fs.writeFileSync(f, was.replace("\nviews:", `\n${framing}views:`));
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], `the fixture did not parse: ${JSON.stringify(c.broken)}`);
  return dir;
}
const kinds = (dir) => checkCorpus(dir).findings.map((f) => f.kind);

test("a feature carries why, risks, measures and instruments", () => {
  const sc = loadCorpus(seeded()).scopes.find((s) => s.scope.id === "tasks").scope;
  assert.equal(sc.why.length, 1);
  assert.equal(sc.risks.length, 1);
  assert.equal(sc.measures.length, 2);
  assert.equal(sc.instruments.length, 2);
});

/** ⛔ Each is addressable, or a list of four risks takes one stamp for four claims. */
test("each card can be referred to, and a wrong name says what exists", () => {
  const c = loadCorpus(seeded());
  for (const ref of ["tasks#why#chores-are-argued-about", "tasks#risk#kids-game-the-list", "tasks#measure#fewer-arguments", "tasks#instrument#disputed-tasks"]) {
    const r = resolveRef(c, ref);
    assert.ok(!("error" in r), `${ref} cannot be referred to: ${JSON.stringify(r)}`);
    assert.equal(r.ref.kind, "card");
  }
  const bad = resolveRef(c, "tasks#risk#nope");
  assert.ok("error" in bad);
  assert.match(bad.error, /kids-game-the-list/, "it refuses without saying what was available");
});

/**
 * ⛔ THE ONE THAT MAKES THE REST WORTH ANYTHING. An agreement to a risk must break when the risk is
 * reworded — otherwise a stamp stands for a sentence nobody read, and nothing can tell.
 */
test("a card can be agreed to, and rewording it breaks the agreement", () => {
  const dir = seeded();
  const ref = "tasks#risk#kids-game-the-list";
  assert.ok(perform(dir, "accept", { target: ref }, { by: "a-person", via: "page" }).ok);
  assert.equal(stampFor(loadCorpus(dir), ref).state, "accepted");

  const f = path.join(dir, "truth", "tasks.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace("before a parent sees it.", "before a parent sees it at all."));
  const st = stampFor(loadCorpus(dir), ref);
  assert.equal(st.state, "claim-changed", "a reworded risk still reads as agreed — the stamp is permanent, which is worse than absent");
  assert.equal(st.by, "a-person", "it forgot who agreed, so there is nothing to go back to");
});

test("a measure nothing records, and an instrument nothing asked for, are both reported", () => {
  const found = kinds(seeded());
  assert.ok(found.includes("a-measure-nothing-records"), "a measure nothing feeds was accepted — it is an aspiration where a measure belongs");
  assert.ok(found.includes("nothing-asked-for-this-recording"), "an instrument feeding no measure was accepted — somebody will maintain it for nobody");
  assert.ok(found.includes("a-measure-with-no-target"), "a measure with no number was accepted, so nobody can say afterwards whether it worked");
});

/** ⛔ A ref that resolves to nothing reads as a connection and is none — refused, like every other. */
test("an instrument feeding a measure that does not exist is refused", () => {
  const dir = seeded(FRAMING.replace("feeds: [fewer-arguments]", "feeds: [a-measure-that-does-not-exist]"));
  const f = checkCorpus(dir).findings.find((x) => x.kind === "an-instrument-feeds-nothing-that-exists");
  assert.ok(f, "a dangling feeds was accepted");
  assert.equal(f.severity, "refuse");
});

test("a feature with behaviours and no stated reason is reported", () => {
  const dir = seeded("");
  const f = checkCorpus(dir).findings.find((x) => x.kind === "nothing-says-why-this-is-worth-building" && x.where === "tasks");
  assert.ok(f, "a feature specifying behaviours against no written reason was accepted");
  assert.match(f.fix, /name changed/, "the fix does not warn that restating the feature is not a reason");
});

/** ⛔ Three tabs, and the behaviour table is in the third. */
test("the feature renders Overview, Metrics and Behaviors", () => {
  const html = renderScopePage(loadCorpus(seeded()), "tasks", { interactive: true, by: "a-person" });
  for (const label of ["Overview", "Metrics", "Behaviors"])
    assert.match(html, new RegExp(`data-label="${label}"`), `there is no ${label} tab`);
  const tab = (name) => new RegExp(`data-sub-view="${name}"[\\s\\S]*?(?=data-sub-view=|$)`).exec(html)?.[0] ?? "";
  assert.match(tab("overview"), /#why#chores-are-argued-about/, "the reason is not in Overview");
  assert.match(tab("overview"), /#risk#kids-game-the-list/, "the risk is not in Overview");
  assert.match(tab("metrics"), /#measure#fewer-arguments/, "the measure is not in Metrics");
  assert.match(tab("metrics"), /#instrument#disputed-tasks/, "the instrument is not in Metrics");
  assert.match(tab("behaviours"), /table class="beh-table"/, "the behaviour table is not in Behaviors");
  /** ⛔ The instrument names the measure it feeds, or its reason is invisible. */
  assert.match(tab("metrics"), /#tasks-measure-fewer-arguments|measure#fewer-arguments/, "the instrument does not point at what it tells us");
});
