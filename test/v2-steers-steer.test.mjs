/**
 * ⛔ A STEER REACHES AN AUTHOR, AND NEVER A JUDGE.
 *
 * `Steer` shipped defined, loaded, refused-when-malformed and rendered on the charter — and read by
 * nothing that makes anything. No corpus held one, no command wrote one, and the ticket proposing a
 * learning loop recorded them as "read by the generators", which was simply false. So the whole
 * concept was a field an author could write that changed nothing, and the loop built on top of it
 * would have produced records that read as closed and did nothing.
 *
 * Prose did not catch that for the life of the concept. These do.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { inEffect, declined, addendum, readSteers } from "../dist/v2/steers.js";
import { Steer } from "../dist/v2/schema.js";

const steer = (over = {}) => ({
  id: "verb-buttons",
  says: "Buttons are named for the verb they perform, never Submit.",
  steers: "generation",
  learned_from: "every button renamed in review since August",
  at: "2026-10-01",
  ...over,
});

test("a steer that constrains the product never reaches an author as taste", () => {
  const all = [steer(), steer({ id: "short-forms", steers: "truth", learned_from: undefined })];
  const live = inEffect(all);
  assert.deepEqual(
    live.map((s) => s.id),
    ["verb-buttons"],
    "a truth steer belongs on the charter, where somebody can disagree — feeding it to an author as a habit launders a constraint"
  );
});

test("a declined steer is gone from what is in force, not softened", () => {
  const all = [steer(), steer({ id: "three-fields", declined: "the design system settled it" })];
  assert.deepEqual(inEffect(all).map((s) => s.id), ["verb-buttons"]);
  assert.deepEqual(
    declined(all).map((s) => s.id),
    ["three-fields"],
    "it is kept, so the pattern it was learned from is not learned again by the next scan"
  );
});

test("declining is refused on a claim about the product", () => {
  /**
   * ⛔ Turning off something that steers TRUTH is withdrawing a constraint, which is a verdict — it
   * belongs in a scope, where something records who withdrew it. A line in a settings file quietly
   * retracting product truth is the whole shape this concept is organised against.
   */
  const bad = Steer.safeParse(steer({ steers: "truth", learned_from: undefined, declined: "changed my mind" }));
  assert.equal(bad.success, false);
  assert.match(bad.error.issues[0].message, /withdrawn where it was agreed to/);
});

test("the addendum says it is not framework truth, and carries provenance", () => {
  const text = addendum([steer()]);
  assert.match(text, /not framework truth/i, "an author cannot tell a guarantee from a preference unless told which this is");
  assert.match(text, /the truth wins/i, "where a habit would make an author write something untrue, the habit is what was wrong");
  assert.match(
    text,
    /every button renamed in review since August/,
    "⛔ the provenance is visible, not a comment — an author who cannot see what a habit came from cannot judge whether it applies"
  );
});

test("nothing in force means no addendum at all, not an empty heading", () => {
  assert.equal(addendum([]), "");
  assert.equal(addendum([steer({ declined: "no longer a habit here" })]), "");
});

test("⛔ the install adapter appends to authors and to no judge", () => {
  /**
   * The guarantee is structural rather than a prohibition in a prompt: `AUTHORS` and `AGENTS` are
   * two registries walked by two functions, and only one of them appends taste. A judge told what
   * this project likes is a judge that can no longer notice the project is wrong — the same reason
   * the newcomer is never told what ProductOS is.
   *
   * ⛔ READ OFF THE SOURCE, because installing for real would write into the host's agent directory.
   * What is asserted is the shape that makes the guarantee true: one call site, in the authors.
   */
  const src = fs.readFileSync(path.join(process.cwd(), "src/adapters/claude.ts"), "utf-8");
  const authors = src.indexOf("function installClaudeAuthors");
  const agents = src.indexOf("function installClaudeAgents");
  assert.ok(authors > 0 && agents > authors, "both installers present, authors first");

  const calls = [...src.matchAll(/addendum\(/g)].map((m) => m.index);
  assert.equal(calls.length, 1, "exactly one place appends what a project has learned");
  assert.ok(
    calls[0] > authors && calls[0] < agents,
    "⛔ it is inside installClaudeAuthors — a judge that gets handed a project's habits cannot notice the project is wrong"
  );
});

test("a steers file that will not parse does not take the install down", () => {
  /**
   * ⛔ Install time is exactly where there may be no good corpus. A project installing ProductOS
   * for the first time has config and little else, and making the install throw on a bad file
   * would break it for the people most likely to be running it.
   */
  const dir = temp("pos-steers-");
  fs.mkdirSync(path.join(dir, "steers"));
  fs.writeFileSync(path.join(dir, "steers", "steers.yaml"), "steers: [ this is not: valid: yaml");
  assert.deepEqual(readSteers(dir), []);

  fs.writeFileSync(path.join(dir, "steers", "ok.yaml"), "steers:\n  - id: a-habit\n    says: Something this project does every time.\n    steers: generation\n    learned_from: three reviews\n    at: 2026-10-01\n");
  assert.deepEqual(
    readSteers(dir).map((s) => s.id),
    ["a-habit"],
    "one unparseable file must not hide the files that are fine"
  );
});

test("a corpus with no steers directory is not an error", () => {
  const dir = temp("pos-nosteers-");
  assert.deepEqual(readSteers(dir), []);
});

// ─── the surface ──────────────────────────────────────────────────────────────────────────────

import { renderScopePage } from "../dist/v2/page.js";
import { checkCorpus } from "../dist/v2/check.js";

/** The smallest corpus that renders: one scope, which is also the commonest shape in a seed. */
const oneScope = (steers = []) => ({
  paths: { root: "/tmp/x" },
  scopes: [
    {
      scope: { id: "wallet", title: "Family Wallet", kind: "feature", views: [], exchanges: [] },
      body: "",
      file: "wallet.md",
    },
  ],
  charter: [],
  notes: [],
  readings: [],
  verdicts: [],
  steers,
  access: [],
  rules: [],
  /**
   * ⛔ PRESENT AND EMPTY, NOT ABSENT. A hand-built corpus has to carry every list the real loader
   * produces, and this one did not when `capabilities` landed — `renderNav` read
   * `corpus.capabilities.length` and all five tests below died on *"Cannot read properties of
   * undefined"*.
   *
   * ⛔ The fix belongs here rather than a `?.` in the renderer. `Corpus` documents the difference
   * between a list that is empty and one that is missing — see the note on `style` — and an
   * optional-by-accident field is exactly how a hosted corpus that failed to load its subsystems
   * would render as a product that has none.
   */
  capabilities: [],
  broken: [],
});

test("⛔ the fixed tabs render in a one-scope corpus — the prototype board was unreachable without this", () => {
  /**
   * `renderNav` returned "" for the whole frame when the scope tree had fewer than two rows, which
   * took the tab row with it. So Overview, Prototype and this settings surface were all rendered,
   * all `display: none`, and nothing on the page could switch between them — in every single-scope
   * corpus, including the seed this repo ships and serves.
   *
   * ⛔ ASSERTING ON THE MARKUP IS WHAT MISSED IT. Every section was present in the HTML and every
   * `data-label` read correctly; the defect only existed once a browser applied the stylesheet.
   * What makes this test worth anything is that it checks for the CONTROL, not the destination.
   */
  const html = renderScopePage(oneScope([steer()]), "wallet", {});
  for (const tab of ["overview", "prototype", "settings"])
    assert.match(html, new RegExp(`data-tab="${tab}"`), `no way to reach ${tab} — the section renders and nothing opens it`);
});

test("a dead chevron is not offered where there is no tree to expand", () => {
  const html = renderScopePage(oneScope([steer()]), "wallet", {});
  assert.doesNotMatch(html, /class="chev"/, "a control that expands nothing reads as 'there is more here' and answers nothing");
});

test("⛔ the settings surface is not a sub-view, or nothing on it is ever shown", () => {
  /**
   * A `.sub-view` is hidden by the frame's script and revealed one at a time by a `subtabs` row,
   * which this surface does not have. Wrapped that way both lists rendered into the DOM and neither
   * was ever visible: the tab worked, the section opened, and the page was blank below the lede.
   */
  const html = renderScopePage(oneScope([steer()]), "wallet", {});
  const sec = html.slice(html.indexOf('id="view-settings"'));
  const end = sec.indexOf("</section>");
  assert.doesNotMatch(sec.slice(0, end), /class="sub-view"/, "the frame hides these, and nothing here reveals them");
  assert.match(sec.slice(0, end), /Screens with more than three|steer-block/);
});

test("⛔ a habit stays off the charter, and a constraint stays off settings", () => {
  const habit = steer({ id: "verb-buttons" });
  const claim = steer({ id: "no-typing", says: "Nothing on a pricing screen can be typed into.", steers: "truth", learned_from: undefined });
  const html = renderScopePage(oneScope([habit, claim]), "wallet", {});
  const settings = html.slice(html.indexOf('id="view-settings"'));
  const inSettings = settings.slice(0, settings.indexOf("</section>"));
  assert.ok(
    !inSettings.includes("pricing screen can be typed"),
    "⛔ a constraint somebody agreed to belongs on the charter — on a settings surface it reads as taste nobody has to keep"
  );
  assert.ok(
    inSettings.includes("Buttons are named for the verb"),
    "the habit is here, where it can be seen and refused"
  );
});

test("no settings tab at all where nothing has been learned", () => {
  /** ⛔ An empty tab reads as *already checked that*, which is this page's oldest complaint. */
  const html = renderScopePage(oneScope([]), "wallet", {});
  assert.doesNotMatch(html, /data-tab="settings"/);
  assert.doesNotMatch(html, /id="view-settings"/);
});

test("⛔ provenance that cites a change record has to cite one that exists", () => {
  /**
   * `learned_from` is free text on purpose — "every button renamed in review since August" is a
   * good account of where a habit came from. But citing records by id makes a checkable claim, and
   * an id resolving to nothing is worse than the prose it replaced: it reads as a citation, so
   * nobody goes looking, and the habit keeps its authority on a reference that was never there.
   *
   * The same refusal `depends_on`, `affected_by` and `leads_to` already carry.
   */
  const dir = temp("pos-prov-");
  fs.cpSync(path.join(process.cwd(), "v2-seed"), path.join(dir, "v2"), { recursive: true });
  // a project root: `<root>/productos/config.yaml` is what makes `changes/` findable
  fs.mkdirSync(path.join(dir, "productos"), { recursive: true });
  fs.writeFileSync(path.join(dir, "productos", "config.yaml"), "version: 0.0.1\n");
  fs.mkdirSync(path.join(dir, "changes"), { recursive: true });
  fs.writeFileSync(path.join(dir, "changes", "0012.yaml"), 'id: "0012"\nsaid: something somebody said\nat: 2026-10-01\nkind: surface\n');

  fs.mkdirSync(path.join(dir, "v2", "steers"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "v2", "steers", "steers.yaml"),
    "steers:\n" +
      "  - id: real\n    says: Drawn from a record that exists.\n    steers: generation\n    learned_from: change 0012\n    at: 2026-10-01\n" +
      "  - id: dangling\n    says: Drawn from a record that does not.\n    steers: generation\n    learned_from: changes 0012, 9999\n    at: 2026-10-01\n"
  );

  const { findings } = checkCorpus(path.join(dir, "v2"));
  const hits = findings.filter((f) => f.kind === "a-steer-learned-from-nothing");
  assert.equal(hits.length, 1, "only the dangling citation is reported");
  assert.match(hits[0].where, /dangling/);
  assert.match(hits[0].what, /9999/);
  assert.doesNotMatch(hits[0].what, /0012/, "a record that resolves is not reported as missing");
});

test("free-text provenance naming no record is left alone", () => {
  /** ⛔ The point is a citation nobody can follow — not a demand that every habit cite a ticket. */
  const dir = temp("pos-prose-");
  fs.cpSync(path.join(process.cwd(), "v2-seed"), path.join(dir, "v2"), { recursive: true });
  fs.mkdirSync(path.join(dir, "productos"), { recursive: true });
  fs.writeFileSync(path.join(dir, "productos", "config.yaml"), "version: 0.0.1\n");
  fs.mkdirSync(path.join(dir, "changes"), { recursive: true });
  fs.writeFileSync(path.join(dir, "changes", "0012.yaml"), 'id: "0012"\nsaid: x\nat: 2026-10-01\nkind: surface\n');
  fs.mkdirSync(path.join(dir, "v2", "steers"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "v2", "steers", "steers.yaml"),
    "steers:\n  - id: prose\n    says: Buttons are named for the verb they perform.\n    steers: generation\n    learned_from: every button renamed in review since August\n    at: 2026-10-01\n"
  );
  const { findings } = checkCorpus(path.join(dir, "v2"));
  assert.equal(findings.filter((f) => f.kind === "a-steer-learned-from-nothing").length, 0);
});

// ─── who a habit reaches ──────────────────────────────────────────────────────────────────────

import { reaches, wouldReach } from "../dist/v2/steers.js";
import { AUTHORS, AGENTS } from "../dist/core/jobs.js";

const aimed = (at) => steer({ id: `aimed-${at.join("-")}`, for: at });

test("a habit aimed at a role reaches that role and no other", () => {
  const s = aimed(["machinist"]);
  assert.ok(reaches(s, "machinist"));
  for (const a of AUTHORS.filter((x) => x.name !== "machinist"))
    assert.ok(!reaches(s, a.name), `${a.name} is being told a habit about somebody else's craft`);
});

test("⛔ a habit aimed at a seat reaches authors that do not exist yet", () => {
  /**
   * This is the whole argument for keeping disciplines alongside roles. Scoping "never name the
   * substrate" to the engineering roles that happened to exist would have silently stopped covering
   * the next one — and nothing would have said so.
   */
  const s = aimed(["engineering"]);
  const eng = AUTHORS.filter((a) => a.discipline === "engineering").map((a) => a.name);
  assert.ok(eng.length > 1, "the point needs more than one author in the seat to be demonstrable");
  for (const n of eng) assert.ok(reaches(s, n), `${n} sits in the seat and is not reached`);
  for (const a of AUTHORS.filter((x) => x.discipline !== "engineering"))
    assert.ok(!reaches(s, a.name));
});

test("an untargeted habit still reaches every author — nothing already written changes meaning", () => {
  const s = steer();
  assert.deepEqual(s.for ?? [], [], "the fixture is supposed to be untargeted");
  for (const a of AUTHORS) assert.ok(reaches(s, a.name));
});

test("⛔ no judge is reached, including by an untargeted habit", () => {
  /**
   * The first cut returned `true` for an empty `for` before looking at who was asking, so asking
   * about `buildability` answered yes. Nothing calls it that way — the installer walks `AUTHORS` —
   * but that made the guarantee a property of the caller rather than of this function.
   */
  for (const j of AGENTS) {
    assert.ok(!reaches(steer(), j.name), `${j.name} judges and was reached by an untargeted habit`);
    assert.ok(!reaches(aimed([j.discipline]), j.name), `${j.name} was reached through its own seat`);
    assert.ok(!reaches(aimed([j.name]), j.name), `${j.name} was reached by being named outright`);
  }
});

test("⛔ the three ways to aim at nobody are each named, not lumped together", () => {
  /** A target that reaches nothing is the `integrator` shape: writable, inert, and reads as working. */
  assert.deepEqual(wouldReach("machinist").authors, ["machinist"]);
  assert.ok(wouldReach("engineering").authors.length > 1, "a seat resolves to its members");

  assert.match(wouldReach("buildability").why, /judges/, "a judge is refused as a judge, not as unknown");
  assert.match(wouldReach("the framework itself").why, /seat of reviewers/, "a seat with no authors needs its own reason");
  assert.match(wouldReach("desgner").why, /no role or discipline/, "a typo needs to read as a typo");
});

test("⛔ `design` and `designer` are one character apart and mean different things", () => {
  /** The only near-miss across the two namespaces, and the reason both lists are checked. */
  assert.deepEqual(wouldReach("designer").authors, ["designer"]);
  const seat = wouldReach("design").authors;
  assert.ok(seat.includes("designer"));
  assert.notDeepEqual(seat, [], "the seat has to resolve, or the pair is not actually ambiguous");
});

test("⛔ a target that rots is a finding, never a parse failure", async () => {
  /**
   * A role gets renamed. A schema refusing an unknown name would take every corpus steering it
   * OFFLINE rather than merely wrong — which is exactly what `walked` did to two files here, and
   * why a document migration had to be built. So the schema takes any string; `check` reports it.
   */
  const dir = temp("pos-rot-");
  fs.cpSync(path.join(process.cwd(), "v2-seed"), path.join(dir, "v2"), { recursive: true });
  fs.mkdirSync(path.join(dir, "v2", "steers"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "v2", "steers", "steers.yaml"),
    "steers:\n  - id: aimed-at-a-ghost\n    says: A habit aimed at a role somebody has since renamed.\n    steers: generation\n    learned_from: three reviews\n    for: [scopers]\n    at: 2026-10-07\n"
  );
  const { corpus, findings } = checkCorpus(path.join(dir, "v2"));
  assert.deepEqual(corpus.broken, [], "⛔ the corpus went offline over a renamed role");
  assert.equal(corpus.steers.length, 1);
  const hit = findings.find((f) => f.kind === "a-steer-aimed-at-nobody");
  assert.ok(hit, "a habit nothing carries is one somebody believes is in force");
  assert.match(hit.what, /scopers/);
});

test("the install asks per author, not once for everybody", () => {
  /** Before this, every author got the identical block — a craft habit landed in every seat. */
  const src = fs.readFileSync(path.join(process.cwd(), "src/adapters/claude.ts"), "utf-8");
  assert.match(src, /addendum\(steers \?\? \[\], author\.name\)/, "the addendum is still built once for everybody");
});

// ─── a habit learned from what people did ──────────────────────────────────────────────────────

import { learnFrom } from "../dist/v2/steers.js";

const ruling = (target, replaced, says, over = {}) => ({
  kind: "rule", by: "peter", at: "2026-10-07", via: "page", target, settles: target, replaced, says,
  because: "An amount without a currency is a number somebody will read as their own.", ...over,
});
const corpusOf = (verdicts = [], notes = [], steers = []) => ({ verdicts, notes, steers });

const CURRENCY = [
  ruling("money#a#answer", "The balance is shown.", "The balance is shown with its currency."),
  ruling("money#b#answer", "The amount is recorded.", "The amount is recorded with its currency."),
  ruling("tasks#c#answer", "The reward is shown.", "The reward is shown with its currency."),
];

test("⛔ a habit is never learned from software's own acts", () => {
  /**
   * The refusal the whole concept rests on. A ruling recorded `via: agent` is the system's own
   * output; a learner that reads those closes a loop with nothing human left in it, and every pass
   * afterwards is the system agreeing with itself more loudly — with `learned_from` populated, and
   * worthless.
   */
  const byAgent = CURRENCY.map((r) => ({ ...r, via: "agent" }));
  assert.deepEqual(learnFrom(corpusOf(byAgent)), [], "software taught itself a habit");

  const human = learnFrom(corpusOf(CURRENCY));
  assert.ok(human.length, "the same acts, made by a person, teach nothing");
});

test("one agent ruling among human ones does not count toward the pattern", () => {
  /** The exclusion has to be per act, not all-or-nothing — a mixed record is the normal case. */
  const mixed = [...CURRENCY, ruling("tasks#d#answer", "It is shown.", "It is shown with its currency.", { via: "agent" })];
  const added = learnFrom(mixed.length ? corpusOf(mixed) : corpusOf([])).find((l) => l.id === "says-currency");
  assert.ok(added);
  assert.equal(added.from.length, 3, "the agent's ruling was counted as evidence");
  assert.ok(!added.from.includes("tasks#d#answer"));
});

test("⛔ two is not a habit", () => {
  assert.deepEqual(learnFrom(corpusOf(CURRENCY.slice(0, 2))), [], "a coincidence was reported as taste");
});

test("⛔ it states what was observed, not a principle nobody said", () => {
  /**
   * "`currency` was put into 3 rulings that did not have it" is checkable. "Amounts are always
   * shown with their currency" is a generalisation nobody made — a decision nobody took, written
   * as though somebody had.
   */
  const says = learnFrom(corpusOf(CURRENCY)).find((l) => l.id === "says-currency").says;
  assert.match(says, /3 rulings/, "the sentence does not carry its own evidence");
  assert.match(says, /"currency"/);
});

test("the same reasoning settling several slots is its own habit", () => {
  const hit = learnFrom(corpusOf(CURRENCY)).find((l) => l.id.startsWith("because-"));
  assert.ok(hit, "a standing argument is not being noticed");
  assert.equal(hit.from.length, 3);
});

test("a word taken OUT repeatedly is a habit too", () => {
  const out = [
    ruling("a#x#answer", "Press Submit to continue.", "Press Continue."),
    ruling("b#x#answer", "Submit the form.", "Send the form."),
    ruling("c#x#answer", "Submit when ready.", "Send when ready."),
  ];
  const hit = learnFrom(corpusOf(out)).find((l) => l.id === "not-submit");
  assert.ok(hit, "a word repeatedly removed says as much as one repeatedly added");
});

test("⛔ grammar is not taste", () => {
  /** Without filler words, the commonest pattern across any two sentences is `the`. */
  const ids = learnFrom(corpusOf(CURRENCY)).map((l) => l.id);
  for (const w of ["says-the", "says-with", "says-its", "not-the"]) assert.ok(!ids.includes(w), `${w} was learned`);
});

test("⛔ a declined habit is not learned straight back", () => {
  /**
   * The acts it came from are all still in the record, so without this the next pass learns it
   * again and declining is a thing somebody has to keep doing forever.
   */
  const declinedAlready = [{
    id: "says-currency", says: "x", steers: "generation", learned_from: "a, b, c",
    at: "2026-10-07", declined: "the design system settles this", for: [],
  }];
  const ids = learnFrom(corpusOf(CURRENCY, [], declinedAlready)).map((l) => l.id);
  assert.ok(!ids.includes("says-currency"), "a refused habit came straight back");
});

test("a habit already recorded is not recorded twice", () => {
  const already = [{ id: "says-currency", says: "x", steers: "generation", learned_from: "a, b, c", at: "2026-10-07", for: [] }];
  assert.ok(!learnFrom(corpusOf(CURRENCY, [], already)).map((l) => l.id).includes("says-currency"));
});

test("only requests somebody acted on count", () => {
  /** An open note is a request, not a thing this project does. */
  const asks = (state, outcome) =>
    [1, 2, 3, 4].map((i) => ({ id: `n${i}`, says: "the currency should be beside the amount", state, outcome }));
  assert.deepEqual(learnFrom(corpusOf([], asks("open", undefined))), [], "open requests were read as habits");
  assert.ok(learnFrom(corpusOf([], asks("done", "did it"))).some((l) => l.id === "asked-currency"));
});

test("⛔ unread is a mark and never a gate", () => {
  /**
   * Peter chose "In force immediately" over a press. A learned habit that did not steer until
   * acknowledged would be the other option, arrived at by a rendering change nobody would read as
   * a reversal — so what `acknowledged` controls is asserted to be nothing but visibility.
   */
  const unread = steer({ id: "learned-thing", learned_from: "a, b, c" });
  const read = { ...unread, acknowledged: "2026-10-07" };
  for (const a of AUTHORS) {
    assert.equal(reaches(unread, a.name), reaches(read, a.name), "acknowledging changed who it steers");
    assert.ok(reaches(unread, a.name), "an unread habit is not steering, which makes it a gate");
  }
  assert.equal(inEffect([unread]).length, 1, "an unread habit is not in force");
});
