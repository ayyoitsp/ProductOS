/**
 * ⛔ THE LAYER A CLAUDE SESSION DELETED, AND THE CHECKS THAT WOULD HAVE NOTICED.
 *
 * v1 had a capability tree — subsystems, nesting to any depth, each offering named capabilities.
 * Commit `3db154c` (2026-09-21) built v2 as a parallel track and did not carry it across. There is
 * no change record and no request from Peter; the only trace was a comment on `depends_on` calling
 * it *"the deleted capability tree"*, written by the same session that deleted it.
 *
 * ⛔ AND NOTHING WENT RED, because two things covered for it:
 *
 *   · `Exchange.asked_by: system` looks close enough to pass for a capability, and is not — that is
 *     machinery-shaped PRODUCT TRUTH, written by a product author and agreed by a product person.
 *   · Change `0090` — *"let's add some engineering authors! they should be authoring the
 *     capabilities anyways"* — added `machinist` and `instrumenter`, who write system-asked
 *     exchanges. The authors came back; the thing they were meant to author did not.
 *
 * ⛔ WHILE A JUDGE WAS ALREADY REVIEWING IT. `productos-architect` asks *"are these the right
 * subsystems, do their boundaries hold"*, and its instructions say *"The site has two halves: the
 * product's user-facing features, and the subsystems beneath them."* It has been dispatched against
 * half a site that did not exist — a reviewer for a layer with no author, which is how a layer goes
 * missing without a single check going red. The same shape as `test-design` judging criteria
 * nobody derives.
 *
 * Peter: *"who deleted the capability tree? those should flow from the product design. engineers
 * should more or less handle the capabilities"* and *"capabilities are like object oriented design.
 * just designing the subsystems, roughly what they do. that's it. they shoudl be logically grouped
 * into areas. they obviously nest, or cross reference other areas."*
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCorpus, CORPUS_DIRS } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { resolveRef } from "../dist/v2/ref.js";
import { capabilityHash } from "../dist/v2/stamp.js";
import { renderScopePage, standalone } from "../dist/v2/page.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const LEDGER = `---
id: ledger
title: The ledger
does: >
  Holds every movement of a kid's money as an append-only record, and answers what a kid has
  now by reading it back.
in: records
uses: [clock]
offers:
  - id: record-a-movement
    does: >
      Appends one movement against one kid with its day, amount and reason, and returns what
      the kid has afterwards.
    serves:
      - money#record-earning#after
      - money#record-spending#after
  - id: read-a-history
    does: Returns everything recorded against one kid, most recent first.
    serves: [money#see-a-balance#answer]
---
Append-only is the whole design.
`;

const RECORDS = `---
id: records
title: Records
does: Everything this product keeps about what happened, and the parts that read it back.
---
An area, not a part.
`;

const CLOCK = `---
id: clock
title: The clock
does: Decides when something is due, and hands it over once per day per subject.
in: records
offers:
  - id: fire-a-daily-due-date
    does: Hands over one subject on the day something falls due for it, once per day.
    serves:
      - money#apply-a-standing-allowance#answer
      - ledger#offers#record-a-movement
---
The once-per-day guarantee lives here.
`;

/** The pristine seed plus a capability layer. Written per test so a mutation cannot leak. */
function withCapabilities(files = { "ledger.md": LEDGER, "records.md": RECORDS, "clock.md": CLOCK }) {
  const dir = temp("v2cap-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  for (const [name, body] of Object.entries(files))
    fs.writeFileSync(path.join(dir, "capabilities", name), body);
  return dir;
}

const kinds = (dir) => checkCorpus(dir).findings.map((f) => f.kind);

test("a corpus carries its subsystems, nested, and each one is addressable", () => {
  const corpus = loadCorpus(withCapabilities());
  assert.deepEqual(corpus.broken, [], "the capability layer would not load");
  assert.equal(corpus.capabilities.length, 3);

  // ⛔ Nesting, which is the shape Peter asked for: "same nested structure as product".
  const byId = new Map(corpus.capabilities.map((c) => [c.capability.id, c.capability]));
  assert.equal(byId.get("ledger").in, "records");
  assert.equal(byId.get("clock").in, "records");
  assert.equal(byId.get("records").in, undefined);
  // ⛔ And cross-reference, which containment cannot express: the ledger leans on the clock.
  assert.deepEqual(byId.get("ledger").uses, ["clock"]);

  const one = resolveRef(corpus, "ledger#offers#record-a-movement");
  assert.ok(!one.error, one.error);
  assert.equal(one.ref.kind, "capability");
  /**
   * ⛔ `<id>#offers`, NOT A BARE ID, AND BILROST IS WHY. The first cut resolved a bare one-segment
   * id as a subsystem — after rules and scopes — with a `check` refusal for the collision. Against
   * the real corpus that refused five of six subsystems: its v1 capability tree had been migrated
   * into `truth/` as scopes keeping their names, so `access-control` names both the part of the
   * system and the area of product truth about it. They SHOULD share a name. The grammar carries
   * the distinction instead, and the collision finding was deleted rather than worked around.
   */
  const sub = resolveRef(corpus, "records#offers");
  assert.equal(sub.ref?.kind, "subsystem");
  assert.ok(resolveRef(corpus, "records").error, "a bare id still resolves as a subsystem");
});

/**
 * ⛔ THE COST OF "ENGINEERS CAN AGREE ON THESE IN THE FUTURE", PAID NOW.
 *
 * Nothing agrees to a capability today and no verdict kind reaches this layer. The hash exists
 * anyway, because the alternative has already happened once: six acceptances on
 * `create-deal#create-deal-form` died when a regeneration reworded what they covered, and the
 * verdict had kept hashes but not the words. A layer that becomes agreeable later without being
 * hashable now ends the same way.
 */
test("a capability's hash moves when what it does moves, and when what it serves moves", () => {
  const corpus = loadCorpus(withCapabilities());
  const cap = corpus.capabilities.find((c) => c.capability.id === "ledger").capability.offers[0];
  const before = capabilityHash(cap);

  assert.notEqual(capabilityHash({ ...cap, does: "Appends two movements." }), before, "rewording what it does left the hash alone");
  assert.notEqual(capabilityHash({ ...cap, serves: ["tasks#complete-a-task#after"] }), before, "pointing it at a different promise left the hash alone");
  // ⛔ Whitespace-insensitive, because a reflow is not a change of meaning — same rule as `canon`.
  assert.equal(capabilityHash({ ...cap, does: cap.does.replace(/\s+/g, "  ") }), before);
});

test("a capability that serves nothing in the corpus is refused", () => {
  const broken = LEDGER.replace("      - money#record-earning#after", "      - money#a-behaviour-nobody-wrote#after");
  assert.ok(kinds(withCapabilities({ "ledger.md": broken, "records.md": RECORDS, "clock.md": CLOCK })).includes("a-capability-serves-nothing-here"));
});

/**
 * ⛔ THE ONE SHAPE LAYERING AND SELF-JUSTIFICATION LOOK IDENTICAL FROM ONE LEVEL UP.
 *
 * `serves` accepts another capability on purpose, because a general subsystem is often two levels
 * from a feature — the clock serves the ledger, and the ledger serves the money. What must not pass
 * is machinery whose whole chain stays inside the machinery.
 */
test("machinery that only ever serves other machinery is refused", () => {
  const inward = CLOCK.replace("      - money#apply-a-standing-allowance#answer\n", "");
  const ledgerInward = LEDGER
    .replace("      - money#record-earning#after", "      - clock#offers#fire-a-daily-due-date")
    .replace("      - money#record-spending#after\n", "")
    .replace("    serves: [money#see-a-balance#answer]", "    serves: [clock#offers#fire-a-daily-due-date]");
  const found = kinds(withCapabilities({ "ledger.md": ledgerInward, "records.md": RECORDS, "clock.md": inward }));
  assert.ok(
    found.includes("a-capability-serves-only-other-machinery"),
    `a closed loop of machinery serving machinery passed: ${[...new Set(found)].join(", ")}`
  );

  // ⛔ And the legitimate two-level case does NOT fire — otherwise the check forbids layering.
  assert.ok(!kinds(withCapabilities()).includes("a-capability-serves-only-other-machinery"));
});

test("a reference to a subsystem that is not there is refused, in both directions", () => {
  const orphan = kinds(withCapabilities({ "ledger.md": LEDGER, "clock.md": CLOCK }));
  assert.ok(orphan.includes("a-subsystem-filed-inside-nothing"), "a dangling parent passed");
  const noClock = kinds(withCapabilities({ "ledger.md": LEDGER, "records.md": RECORDS }));
  assert.ok(noClock.includes("a-subsystem-uses-nothing-that-exists"), "a dangling cross-reference passed");
});

test("subsystems filed inside each other are refused", () => {
  const a = RECORDS.replace("does: Everything", "in: ledger\ndoes: Everything");
  assert.ok(kinds(withCapabilities({ "ledger.md": LEDGER, "records.md": a, "clock.md": CLOCK })).includes("subsystems-filed-inside-each-other"));
});

/**
 * ⛔ THE OPPOSITE OF WHAT THIS TEST FIRST ASSERTED, AND BILROST IS THE REASON.
 *
 * It originally pinned a refusal: a subsystem sharing a one-segment id with a scope or a rule was
 * refused, because a bare ref resolved rule → scope → subsystem and the loser lost silently.
 *
 * Run against the real corpus it refused five of six subsystems. Bilrost's v1 capability tree was
 * migrated into `truth/` as scopes keeping their names, so `access-control`, `agency-pricing`,
 * `cre-templates`, `document-intake` and `pricing` each name a scope AND the obvious name for the
 * part of the system. They should share a name — the two are one subject seen from two sides, the
 * promise and the machinery. A refusal firing on the most natural naming in the commonest
 * migration path is one somebody turns off.
 *
 * So `ref.ts` spells a subsystem `<id>#offers`, nothing is ambiguous, and the finding is gone.
 */
test("a subsystem may share a name with the feature it answers", () => {
  const sameName = RECORDS.replace("id: records", "id: money");
  const dir = withCapabilities({
    "ledger.md": LEDGER.replace("in: records", "in: money"),
    "records.md": sameName,
    "clock.md": CLOCK.replace("in: records", "in: money"),
  });
  const found = kinds(dir);
  assert.ok(
    !found.some((k) => k.includes("shares-an-id")),
    "naming a subsystem after the feature it answers is refused"
  );

  // ⛔ And the two are still told apart, which is the whole reason the refusal could go.
  const corpus = loadCorpus(dir);
  assert.equal(resolveRef(corpus, "money").ref.kind, "scope");
  assert.equal(resolveRef(corpus, "money#offers").ref.kind, "subsystem");
});

/**
 * ⛔ ONE FINDING WITH A COUNT, which is the house idiom for something that would otherwise fire on
 * every behaviour at once. A corpus whose capability layer has just been started has nothing
 * answered, and 38 identical notes is a report nobody reads followed by a check nobody runs.
 */
test("behaviours no subsystem answers are reported once, with a count", () => {
  const found = checkCorpus(withCapabilities()).findings.filter((f) => f.kind === "behaviours-no-subsystem-answers");
  assert.equal(found.length, 1, "reported per behaviour instead of once");
  assert.match(found[0].where, /^\d+ of \d+$/);

  // ⛔ Silent on a corpus with no capability layer at all. A corpus that has not started this
  // must not be told it is incomplete at something it has not begun.
  assert.ok(!kinds("v2-seed").includes("behaviours-no-subsystem-answers"));
});

/** ⛔ The remote copy and the parser must agree about which directories a corpus has. */
test("the capability layer is part of what a corpus is made of", () => {
  assert.ok(CORPUS_DIRS.includes("capabilities"), "a hosted corpus would not carry its subsystems at all");
});

const { exe, skip } = browserOrSkip();

/**
 * ⛔ COMPUTED STYLE IN A REAL BROWSER, because every markup assertion passed on all three of the
 * rendering defects this harness exists for. The only question worth asking of a drawing is what it
 * renders as — and a nested tree that renders flat is a tree nobody can read.
 */
test("the subsystems render as a nested tree a person can read", { skip }, async () => {
  const corpus = loadCorpus(withCapabilities());
  /**
   * ⛔ `standalone(title, page)` — two arguments, and getting it wrong is silent. Passing one put
   * the entire 324KB page inside `<title>`, so Chrome parsed a document with an empty body: zero
   * `.view` elements, `document.body.children` empty, and the text still present in
   * `documentElement.innerHTML`. Every markup-shaped assertion would have been inconclusive in the
   * same way, and the first reading of it was that the renderer was broken.
   */
  const html = standalone("subsystems", renderScopePage(corpus, "family-wallet", { interactive: false }));
  const page = await openPage(html, { exe });
  try {
    const seen = await page.evaluate(`(() => {
      const v = document.querySelector('#view-subsystems');
      if (!v) return { missing: true };
      /**
       * ⛔ REVEALED BEFORE MEASURING. A view carries [hidden] until its tab is chosen, and every
       * rect inside a hidden subtree is zero — so the first run of this reported "the child renders
       * at x=0 and its parent at x=0 — the tree is flat" against a tree that was correct. Measuring
       * a hidden element is not measuring.
       */
      v.hidden = false;
      for (const other of document.querySelectorAll('section.view')) if (other !== v) other.hidden = true;
      const box = (sel) => {
        const el = v.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width };
      };
      return {
        tab: !!document.querySelector('[data-view="subsystems"]'),
        records: box('[data-ref="records"]'),
        ledger: box('[data-ref="ledger"]'),
        clock: box('[data-ref="clock"]'),
        caps: v.querySelectorAll('.cap-list li').length,
        serves: [...v.querySelectorAll('.cap-serves')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()),
        dead: v.querySelectorAll('.cap-dead').length,
      };
    })()`);

    assert.ok(!seen.missing, "the subsystems view did not render at all");
    assert.ok(seen.records && seen.ledger && seen.clock, "a subsystem did not render");
    /**
     * ⛔ CONTAINMENT, NOT AN INDENT MEASUREMENT — and that distinction is the whole lesson here.
     *
     * The first version asserted `child.left > parent.left + 10` against a CSS margin keyed on a
     * depth variable. Deleting that margin rule left the test GREEN, because the parent's own
     * padding is ~15px: it was measuring containment while claiming to measure the indent, and the
     * margin it was supposedly pinning turned out to be redundant with the nesting.
     *
     * What actually matters is that both children render INSIDE their parent's box. If `one()`
     * stops recursing and renders the three subsystems as siblings, all three sit at the same left
     * edge and this fails — which is the failure mode worth having a browser for.
     */
    for (const [name, child] of [["ledger", seen.ledger], ["clock", seen.clock]]) {
      assert.ok(
        child.left > seen.records.left && child.right <= seen.records.right,
        `${name} renders at ${child.left}–${child.right} and its parent at ${seen.records.left}–${seen.records.right} — it is not inside its parent, so the tree rendered flat`
      );
    }
    assert.ok(seen.ledger.width > 100, `a subsystem ${seen.ledger.width}px wide is not readable`);
    assert.equal(seen.caps, 3, "a capability did not render");
    // ⛔ What it serves is resolved to the PROMISE, not left as an address a reader has to go
    // and look up — and the capability-to-capability case reads as what the other part does.
    assert.ok(
      seen.serves.some((s) => /for .*records something a kid earned/i.test(s)),
      `what a capability serves rendered as: ${JSON.stringify(seen.serves)}`
    );
    assert.equal(seen.dead, 0, "something rendered as serving nothing on a corpus check calls clean");
  } finally {
    await page.close();
  }
});
