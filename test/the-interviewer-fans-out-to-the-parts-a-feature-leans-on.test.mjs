/**
 * ⛔ STARTED ON A FEATURE, THE INTERVIEW REACHES THE PARTS THAT FEATURE LEANS ON.
 *
 * Peter: *"we should be able to start the interviewer on a feature, and have it fan out to the
 * gloassary/capabilities that are needed to support the feature."* The glossary half landed and the
 * capability half was reported as "partly there" — because `unserved` existed, and `unserved` goes
 * quiet the moment one part serves one behaviour. On staging: 50 capabilities, none validated,
 * `map-the-statement` leaning on 13 of them, and the interviewer said nothing about any.
 *
 * ⛔ FOUR DISTINGUISHABLE OUTCOMES, because the correct answer for a corpus with no capabilities is
 * zero `part` questions — and zero is also what shipping nothing produces.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";

const { loadCorpus } = await import("../dist/v2/load.js");
const { interviewFor } = await import("../dist/v2/interview.js");
const { perform } = await import("../dist/v2/acts.js");

const LEDGER = "ledger#offers#increment-balance";
const CLOCK = "clock#offers#now";

const part = (id, title, does, cap, capDoes, serves) =>
  [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    `does: ${does}`,
    "offers:",
    `  - id: ${cap}`,
    `    does: ${capDoes}`,
    "    serves:",
    ...serves.map((r) => `      - ${r}`),
    "---",
    "",
    `# ${title}`,
    "",
  ].join("\n");

function seed(prefix, { parts = true } = {}) {
  const dir = temp(prefix);
  fs.cpSync("v2-seed", dir, { recursive: true });
  if (parts) {
    fs.mkdirSync(`${dir}/capabilities`, { recursive: true });
    fs.writeFileSync(
      `${dir}/capabilities/ledger.md`,
      part(
        "ledger",
        "The ledger",
        "Holds every movement of a kid's money as an append-only record, and answers what a kid has now.",
        "increment-balance",
        "Appends one movement against one kid and returns what the kid has afterwards.",
        ["money#see-a-balance#answer", "money#record-earning#after"]
      )
    );
    fs.writeFileSync(
      `${dir}/capabilities/clock.md`,
      part(
        "clock",
        "The clock",
        "Answers what day it is, as one place, so every movement is stamped the same way.",
        "now",
        "Answers the current day, in the family's own timezone.",
        ["money#see-a-balance#answer"]
      )
    );
  }
  assert.deepEqual(loadCorpus(dir).broken, [], "the fixture wrote a corpus the loader refused");
  return dir;
}

const partsAsked = (dir) => (interviewFor(loadCorpus(dir), "money")?.owed ?? []).filter((o) => o.owes === "part");

const agree = (dir, ref) =>
  perform(dir, "accept", { target: ref }, { by: "peter", via: "page", because: "the part is right as it reads" });

test("⛔ no parts at all: nothing to fan out to", () => {
  assert.deepEqual(partsAsked(seed("pos-parts-none-", { parts: false })), []);
});

test("⛔ every part a feature leans on is asked once, in its own words, with what leans on it", () => {
  const asked = partsAsked(seed("pos-parts-asked-"));
  assert.deepEqual(asked.map((o) => o.ref).sort(), [CLOCK, LEDGER]);

  const ledger = asked.find((o) => o.ref === LEDGER);
  /** ⛔ The part's own sentence — the thing the stamp hashes — and not the interviewer's paraphrase. */
  assert.match(ledger.asks, /relies on The ledger, which says: Appends one movement against one kid/);
  assert.match(ledger.asks, /Nobody has checked it\. Is that what it does\?/);
  /** ⛔ One question for two behaviours: the behaviours are the context, never the count. */
  assert.match(ledger.why, /^2 behaviours here lean on it/);
  assert.equal(ledger.about.already.find((a) => a.asks === "what here leans on it").says.split(" · ").length, 2);
  /** ⛔ An acceptance, not a choice — a capability has no slot to draft options for. */
  assert.equal(ledger.candidates.length, 0);
  assert.match(ledger.act, /a person agrees to this part on the page/);
  assert.deepEqual(ledger.fills, [LEDGER]);
});

test("⛔ a part somebody agreed to leaves the interview, and the others stay", () => {
  const dir = seed("pos-parts-agreed-");
  const r = agree(dir, LEDGER);
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(partsAsked(dir).map((o) => o.ref), [CLOCK]);
});

test("⛔ a part agreed and reworded since is asked again — as a re-check, not from scratch", () => {
  const dir = seed("pos-parts-stale-");
  agree(dir, CLOCK);
  const f = `${dir}/capabilities/clock.md`;
  const src = fs.readFileSync(f, "utf-8");
  const out = src.replace("in the family's own timezone", "in UTC");
  assert.notEqual(out, src, "the sentence this test rewords has changed; find the new wording");
  fs.writeFileSync(f, out);

  const clock = partsAsked(dir).find((o) => o.ref === CLOCK);
  assert.ok(clock, "a reworded part dropped out of the interview instead of being asked again");
  assert.match(clock.asks, /peter agreed to it, and it has changed since\. Is it still right\?/);
  assert.doesNotMatch(clock.asks, /Nobody has checked it/);
});

const { renderScopePage, standalone } = await import("../dist/v2/page.js");
const { browserOrSkip, openPage } = await import("./support/chrome.mjs");
const { exe, skip } = browserOrSkip();

/**
 * ⛔ ON THE PAGE, IN A REAL BROWSER. `readinessOf` holds a build on these parts; a feature page that
 * does not say which is a gate refusing for a reason the surface he reviews on never shows.
 *
 * ⛔ Read where a person reads it — the sub-view it lives in is opened first, so a section rendered
 * into a tab nobody can reach does not pass.
 */
test("⛔ the feature page names the parts it relies on that nobody has checked", { skip }, async () => {
  const shown = async (dir) => {
    const page = await openPage(standalone("parts", renderScopePage(loadCorpus(dir), "money", { interactive: false })), { exe });
    try {
      return await page.evaluate(`(() => {
        const box = document.querySelector(".unchecked");
        if (!box) return null;
        const view = box.closest("[data-sub-view]");
        const tab = view && document.querySelector('[data-sub="' + view.dataset.subView + '"]');
        if (tab) tab.click();
        return {
          refs: [...box.querySelectorAll("li[data-ref]")].map((li) => li.dataset.ref).sort(),
          visible: box.getBoundingClientRect().height > 0 && getComputedStyle(box).display !== "none",
          link: box.querySelector("li a")?.getAttribute("href") ?? null,
        };
      })()`);
    } finally {
      await page.close();
    }
  };

  const dir = seed("pos-parts-page-");
  const before = await shown(dir);
  assert.ok(before, "the feature page has no section for the parts it relies on");
  assert.deepEqual(before.refs, [CLOCK, LEDGER]);
  assert.equal(before.visible, true, "the section is rendered and nobody can see it");
  assert.match(before.link, /subsystems/);

  agree(dir, LEDGER);
  agree(dir, CLOCK);
  assert.equal(await shown(dir), null, "a part everybody agreed to is still listed as unchecked");
});
