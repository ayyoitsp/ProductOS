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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-steers-"));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-nosteers-"));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-prov-"));
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-prose-"));
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
