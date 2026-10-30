/**
 * ⛔ WHAT A PERSON APPROVED KEEPS ITS WORDS — AN AUTHOR ADDS BESIDE IT.
 *
 * Peter: *"why would something i approved have the words change? that shouldn't happen - decomposer
 * should leave those as is, and create new truths about them if necesary"*, and before that: *"why is
 * it even checking if things hold - should hold unless something indicates it might not be true"*.
 *
 * Pinned here, at the door an author's document comes through:
 *   - rewording an approved part is refused, and the document is left exactly as it was;
 *   - adding a new part beside it is not;
 *   - a person's open note against it is what lets a redraft through;
 *   - and a one-click approval is not buried behind questions about words.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { perform } = await import("../dist/v2/acts.js");
const { stampFor } = await import("../dist/v2/stamp.js");
const { INTENTS } = await import("../dist/v2/intents.js");
const { fileNote } = await import("../dist/v2/notes.js");
const { interviewFor } = await import("../dist/v2/interview.js");

const KEY = "capabilities/ledger.md";
const LEDGER = "ledger#offers#increment-balance";
const GUARANTEE = "A movement once recorded is never changed or removed; a correction is a second movement.";

const ledger = ({ guarantee = GUARANTEE, beside = [] } = {}) =>
  [
    "---",
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
    ...beside,
    "---",
    "",
    "# part",
    "",
  ].join("\n");

const BESIDE = [
  "  - id: reverse-movement",
  "    does: Records a correction as a second movement against the one it corrects.",
  "    interface:",
  "      - operation: correct a movement",
  "        through: [append_reversal]",
  "    guarantees:",
  "      - A correction names the movement it corrects, and the two always sum to what was meant.",
  "    serves:",
  "      - money#see-a-balance#answer",
];

function approved(prefix) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  fs.writeFileSync(`${dir}/${KEY}`, ledger());
  const r = perform(dir, "accept", { target: LEDGER }, { by: "peter", via: "page", because: "it reads right" });
  assert.equal(r.ok, true, r.why);
  assert.equal(stampFor(loadCorpus(dir), LEDGER).state, "accepted", "the fixture's part was not approved to begin with");
  return dir;
}

const write = (dir, says) =>
  INTENTS.find((i) => i.name === "document").run({ dir, who: { kind: "browser", reach: [] }, pressing: "decomposer" }, { key: KEY, says });

test("rewording an approved part is refused, and the document is left as it was", () => {
  const dir = approved("approved-reword-");
  const before = fs.readFileSync(`${dir}/${KEY}`, "utf-8");
  const r = write(dir, ledger({ guarantee: "A movement may be edited by a parent within the same day." }));
  assert.equal(r.ok, false, "an author reworded what a person approved");
  assert.ok(r.detail.some((d) => d.includes(LEDGER)), "the refusal does not name what was approved");
  assert.equal(fs.readFileSync(`${dir}/${KEY}`, "utf-8"), before, "the refused write was left on disk");
  assert.equal(stampFor(loadCorpus(dir), LEDGER).state, "accepted");
});

test("a new part beside an approved one goes through, and the approval stands", () => {
  const dir = approved("approved-beside-");
  const r = write(dir, ledger({ beside: BESIDE }));
  assert.equal(r.ok, true, r.why);
  assert.equal(stampFor(loadCorpus(dir), LEDGER).state, "accepted");
  assert.ok(loadCorpus(dir).subsystems.find((x) => x.subsystem.id === "ledger").subsystem.offers.some((o) => o.id === "reverse-movement"));
});

test("a person saying it is wrong is what lets a redraft through — software saying so is not", () => {
  const dir = approved("approved-noted-");
  const reworded = ledger({ guarantee: "A movement may be edited by a parent within the same day." });

  fileNote(dir, { about: LEDGER, says: "this guarantee reads oddly", by: "productos-architect", via: "review", at: "2026-10-30" });
  assert.equal(write(dir, reworded).ok, false, "a judge's note unlocked a person's approval");

  fileNote(dir, { about: `${LEDGER}#guarantees`, says: "parents can fix a movement the same day", by: "peter", via: "chat", at: "2026-10-30" });
  const r = write(dir, reworded);
  assert.equal(r.ok, true, r.why);
  assert.notEqual(stampFor(loadCorpus(dir), LEDGER).state, "accepted", "the redraft kept an approval nobody gave to its words");
});

test("a part ready for one click comes straight after the purpose, ahead of questions about words", () => {
  const dir = temp("approved-order-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  fs.writeFileSync(`${dir}/${KEY}`, ledger());
  const c = loadCorpus(dir);
  const feature = c.scopes.find((x) => x.scope.id === "money" || x.scope.exchanges.some((e) => e.id === "see-a-balance"));
  const owed = interviewFor(c, feature.scope.id).owed;
  const at = owed.findIndex((o) => o.ref === LEDGER);
  assert.ok(at >= 0, "the part was not asked from the feature that leans on it");
  const ahead = owed.slice(0, at).map((o) => o.owes);
  assert.deepEqual(ahead.filter((k) => !["disputed", "purpose", "handover", "capability"].includes(k)), [], `behind: ${ahead.join(", ")}`);
});

test("adding guarantees to a part approved before it had any goes through, and only the additions are asked", () => {
  const dir = temp("approved-added-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
  const bare = ledger().replace(/    interface:\n(.|\n)*?    serves:/, "    serves:");
  assert.ok(!bare.includes("guarantees"), "the fixture still carries guarantees");
  fs.writeFileSync(`${dir}/${KEY}`, bare);
  perform(dir, "accept", { target: LEDGER }, { by: "peter", via: "page", because: "it reads right" });
  assert.equal(stampFor(loadCorpus(dir), LEDGER).state, "accepted");

  const r = write(dir, ledger());
  assert.equal(r.ok, true, r.why);

  const c = loadCorpus(dir);
  const feature = c.scopes.find((x) => x.scope.exchanges.some((e) => e.id === "see-a-balance"));
  const item = interviewFor(c, feature.scope.id).owed.find((o) => o.ref === LEDGER);
  assert.match(item.asks, /nothing in it has changed since/);
  assert.match(item.act, /^a person agrees to what was added/);
  const shown = item.about.already.map((a) => a.asks);
  assert.deepEqual(shown, ["what peter approved", "added — asked of it", "added — it guarantees"], `shown: ${shown.join(" | ")}`);
  assert.equal(item.about.already.at(-1).says, GUARANTEE);
});
