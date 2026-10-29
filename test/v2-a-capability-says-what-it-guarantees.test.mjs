/**
 * ⛔ A CAPABILITY SAYS WHAT IT IS ASKED AND WHAT IT GUARANTEES — AND ONE PRESS AGREES TO ALL OF IT.
 *
 * Peter, on what a part should carry beyond its `does` sentence: *"ok, sounds good, go ahead and
 * create those fields"*, and on how it is agreed: *"a core philosophy of productos is to limit the
 * user's cognitive load. if they say something that confirms both, it should confirm both the
 * guarantee, interface, capability. questions shoudl be designed to minimize cognitive load and
 * fill the appropriate gaps"*.
 *
 * Pinned here:
 *   - a part written before these fields existed hashes exactly as it did — no default sneaks in
 *     and drops every agreement already given;
 *   - one `accept` covers does, interface and guarantees, and rewording a guarantee sends it back;
 *   - the interview asks a full part as ONE confirmation, and hands a part with a gap to the
 *     decomposer instead of to a person;
 *   - the page shows the guarantees, because a press is only honest about what was in front of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { perform } = await import("../dist/v2/acts.js");
const { stampFor } = await import("../dist/v2/stamp.js");
const { interviewFor } = await import("../dist/v2/interview.js");
const { renderScopePage, standalone } = await import("../dist/v2/page.js");
const { checkCorpus } = await import("../dist/v2/check.js");

const LEDGER = "ledger#offers#increment-balance";
const CLOCK = "clock#offers#now";
const GUARANTEE = "A movement once recorded is never changed or removed; a correction is a second movement.";

function part(dir, file, lines) {
  fs.writeFileSync(`${dir}/capabilities/${file}`, ["---", ...lines, "---", "", "# part", ""].join("\n"));
}

function corpus(prefix, { guarantee = GUARANTEE } = {}) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  part(dir, "ledger.md", [
    "id: ledger",
    "title: The ledger",
    "does: Holds every movement of a kid's money as an append-only record, and answers what a kid has now.",
    "offers:",
    "  - id: increment-balance",
    "    does: Appends one movement against one kid and returns what the kid has afterwards.",
    "    interface:",
    "      - operation: record a movement",
    "        through: [append_movement]",
    "    guarantees:",
    `      - ${guarantee}`,
    "    serves:",
    "      - money#see-a-balance#answer",
  ]);
  /** ⛔ The shape every corpus had before this landed: no interface, no guarantees. */
  part(dir, "clock.md", [
    "id: clock",
    "title: The clock",
    "does: Answers what day it is, as one place, so every movement is stamped the same way.",
    "offers:",
    "  - id: now",
    "    does: Answers the current day, in the family's own timezone.",
    "    serves:",
    "      - money#see-a-balance#answer",
  ]);
  assert.deepEqual(loadCorpus(dir).broken, [], "the fixture wrote a corpus the loader refused");
  return dir;
}

const agree = (dir, ref) => perform(dir, "accept", { target: ref }, { by: "peter", via: "page", because: "it reads right" });
const root = (c) => c.scopes.find((x) => !x.scope.in).scope.id;
const capabilityItems = (dir) => {
  const c = loadCorpus(dir);
  return interviewFor(c, root(c)).owed.filter((o) => o.owes === "capability");
};

test("a part written before these fields gains no key, so an agreement already given survives", () => {
  const c = loadCorpus(corpus("v2cap-g-absent-"));
  const clock = c.subsystems.find((x) => x.subsystem.id === "clock").subsystem.offers[0];
  /**
   * ⛔ ABSENT, NOT EMPTY. The stamp hashes this object's keys; `interface: []` would be a key, and
   * every person's name on every existing part would drop the day this shipped.
   */
  assert.equal("interface" in clock, false);
  assert.equal("guarantees" in clock, false);
});

test("one press agrees to what a part does, is asked and guarantees — and rewording a guarantee sends it back", () => {
  const dir = corpus("v2cap-g-press-");
  const r = agree(dir, LEDGER);
  assert.equal(r.ok, true, r.why);
  assert.equal(stampFor(loadCorpus(dir), LEDGER).state, "accepted");

  const file = `${dir}/capabilities/ledger.md`;
  fs.writeFileSync(file, fs.readFileSync(file, "utf-8").replace(GUARANTEE, "A movement may be edited by a parent within the same day."));
  assert.notEqual(stampFor(loadCorpus(dir), LEDGER).state, "accepted", "a reworded guarantee kept an agreement nobody gave to it");
});

test("the interview asks a full part as one confirmation, and gives a part with a gap to the decomposer", () => {
  const dir = corpus("v2cap-g-ask-");
  const items = capabilityItems(dir);
  /** ⛔ A non-zero first: two parts, two distinguishable outcomes. */
  assert.deepEqual(items.map((o) => o.ref).sort(), [CLOCK, LEDGER].sort());

  const ledger = items.find((o) => o.ref === LEDGER);
  assert.deepEqual(ledger.fills, [LEDGER], "one answer, one part");
  assert.match(ledger.act, /accept/);
  assert.ok(ledger.about.already.some((a) => a.says === GUARANTEE), "the guarantee was not in front of the person asked");
  assert.ok(ledger.about.already.some((a) => a.says === "record a movement"), "the interface was not in front of the person asked");

  const clock = items.find((o) => o.ref === CLOCK);
  assert.match(clock.act, /decomposer/, "a part with nothing to agree to was put to a person");
  assert.match(clock.asks, /what it is asked or what it guarantees/);

  /** Confirmable parts lead: one press is worth more to a person than somebody else's gap. */
  assert.equal(items[0].ref, LEDGER);

  agree(dir, LEDGER);
  assert.deepEqual(capabilityItems(dir).map((o) => o.ref), [CLOCK], "an agreed part was asked again");
});

test("check names a part that guarantees nothing, as a note and only that part", () => {
  const found = checkCorpus(corpus("v2cap-g-check-")).findings.filter((f) => f.kind === "a-capability-that-guarantees-nothing");
  assert.deepEqual(found.map((f) => f.where), [CLOCK]);
  assert.equal(found[0].severity, "note", "every part predating the field would be refused");
});

const { skip, exe } = browserOrSkip();

test("the page shows what a part is asked and what it guarantees", { skip }, async () => {
  const c = loadCorpus(corpus("v2cap-g-page-"));
  const html = standalone("subsystems", renderScopePage(c, root(c), { interactive: false }));
  const page = await openPage(html, { exe });
  try {
    const seen = await page.evaluate(`(() => {
      const v = document.querySelector('#view-subsystems');
      if (!v) return { missing: true };
      v.hidden = false;
      for (const other of document.querySelectorAll('section.view')) if (other !== v) other.hidden = true;
      const li = v.querySelector('[data-ref="${LEDGER}"]');
      const shown = (sel) => [...(li?.querySelectorAll(sel) ?? [])]
        .filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => e.textContent.replace(/\\s+/g, ' ').trim());
      return { guarantees: shown('.cap-guarantees li'), asked: shown('.cap-interface li') };
    })()`);
    assert.ok(!seen.missing, "the subsystems view did not render");
    assert.deepEqual(seen.guarantees, [GUARANTEE]);
    assert.equal(seen.asked.length, 1);
    assert.match(seen.asked[0], /record a movement/);
  } finally {
    await page.close();
  }
});
