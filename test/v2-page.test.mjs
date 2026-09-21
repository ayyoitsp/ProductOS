/**
 * ⛔ THE PAGE MAY NOT DISAGREE WITH THE CORPUS, AND IT DID — TWICE, ON ITS FIRST RENDER.
 *
 * Both failures were the same mistake: the page re-derived something that already had exactly
 * one home. It read the raw slot instead of `resolveRules`, so two slots an org-wide rule was
 * answering printed as "nobody has said what this is" — directly above a grid on the same page
 * marking them `↑R5` and `↑R2`. And it called `gridFor` once for the named scope, which reads
 * one scope's own exchanges, so every container rendered `0 exchanges` above cards for every
 * promise underneath it.
 *
 * A reviewer cannot tell which of two numbers on one screen is the real one, and the stamp
 * they leave is over whichever they believed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCorpus } from "../dist/v2/load.js";
import { gridFor } from "../dist/v2/grid.js";
import { descendants, questionsFor } from "../dist/v2/settle.js";
import { renderScopePage } from "../dist/v2/page.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const corpus = loadCorpus("v2-seed");
const SCOPES = corpus.scopes.map((s) => s.scope.id);

/** Occurrences of the blank marker on slot rows — the legend mentions the phrase once too. */
const blanksOn = (html) => (html.match(/class="nobody"/g) ?? []).length;

test("the page and the grid agree on how many slots are blank", () => {
  for (const id of SCOPES) {
    const html = renderScopePage(corpus, id);
    assert.ok(html, `no page for ${id}`);
    const expected = descendants(corpus, id)
      .map((d) => gridFor(corpus, d))
      .filter(Boolean)
      .reduce((n, g) => n + g.counts.blank, 0);
    assert.equal(
      blanksOn(html),
      expected,
      `${id}: page shows ${blanksOn(html)} blank slots, the grid counts ${expected}`
    );
  }
});

test("a container renders the promises filed beneath it, not an empty grid", () => {
  const containers = SCOPES.filter(
    (id) => corpus.scopes.find((s) => s.scope.id === id).scope.exchanges.length === 0
  );
  assert.ok(containers.length, "the seed has no container scope, so this proves nothing");
  for (const id of containers) {
    const html = renderScopePage(corpus, id);
    const under = descendants(corpus, id)
      .map((d) => gridFor(corpus, d))
      .filter(Boolean)
      .reduce((n, g) => n + g.rows.length, 0);
    assert.ok(under > 0, `${id} has nothing beneath it, so this proves nothing`);
    // One grid heading per scope that actually has promises.
    const headings = (html.match(/<h2>What [^<]*promises/g) ?? []).length;
    assert.ok(headings >= 1, `${id} rendered no grid for ${under} promises beneath it`);
    assert.equal((html.match(/0 exchange/g) ?? []).length, 0, `${id} claims 0 exchanges`);
  }
});

/**
 * ⛔ EVERY LINK LANDS ON SOMETHING. v1 shipped nav links to pages that 404ed — `CLAUDE.md` names
 * it as one of four ways a handed-over corpus contradicted the documented model at once — and a
 * row that does nothing is worse than prose, because it reads as *already checked that*.
 *
 * Asserted against the rendered document rather than by reading the renderer: a link and its
 * target computing the anchor separately is exactly how this breaks.
 */
test("no link on the page points at an anchor the page does not render", () => {
  for (const id of SCOPES) {
    for (const opts of [{}, { linkBase: "/v2" }]) {
      const html = renderScopePage(corpus, id, opts);
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      const dead = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => !ids.has(a));
      assert.deepEqual(dead, [], `${id}${opts.linkBase ? " (served)" : " (standalone)"}: dead anchors`);
    }
  }
});

/**
 * ⛔ A standalone file cannot resolve a link to another scope's page, so it must not render one.
 * The same page served under a base must.
 */
/**
 * ⛔ A GATED EXCHANGE MAY NOT LINK AT A SLOT THAT IS ANSWERED SOMEWHERE ELSE.
 *
 * The seed cannot catch this: every gated slot there is a question with a card of its own. A slot
 * waiting on an org-wide question has no anchor — it is answered once at the rule — and the gate's
 * "decide it" link pointed at it anyway. On the first real corpus that was **357 dead anchors**.
 *
 * Built here rather than borrowed, so the shape is pinned whatever the seed happens to contain.
 */
test("a slot answered at a rule is named, not linked", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2wait-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  // One org-wide question, unsettled, reaching a slot no exchange states.
  fs.writeFileSync(
    path.join(dir, "rules", "what-happens-at-once.md"),
    `---\nid: what-happens-at-once\nfills: [at_once]\nmode: supplies\nscope: { everywhere: true }\nstanding:\n  kind: open\n  question: >\n    What happens when two askers arrive on one subject? Nobody has been asked anywhere in this\n    product, so every slot it would fill says nothing.\n  asked_of: product\n  asked_at: 2026-09-21\n  blocks: []\ncriteria: []\n---\n\n# Unsettled, and reaching everything\n`
  );
  const corpus = loadCorpus(dir);
  for (const id of corpus.scopes.map((s) => s.scope.id)) {
    const html = renderScopePage(corpus, id, { linkBase: "/v2" });
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const dead = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => !ids.has(a));
    assert.deepEqual(dead, [], `${id}: linked at an anchor it never renders`);
  }
});

test("cross-scope links appear only where they can resolve", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const alone = renderScopePage(corpus, root);
  assert.doesNotMatch(alone, /href="\/v2/, "a standalone file offered a link it cannot follow");
  assert.match(alone, /class="unlinked"/, "nothing marked as unreachable — is the nav rendering at all?");
  const served = renderScopePage(corpus, root, { linkBase: "/v2" });
  assert.match(served, /href="\/v2\//, "a served page rendered no cross-scope link");
});

test("every open question reaches the page, with what it costs to guess wrong", () => {
  for (const id of SCOPES) {
    const html = renderScopePage(corpus, id);
    for (const q of questionsFor(corpus, id)) {
      assert.ok(html.includes(q.ref), `${id}: the page never mentions ${q.ref}`);
      if (q.cost) assert.match(html, /what guessing wrong costs/);
    }
  }
});

/**
 * ⛔ A button that looks live and records nothing is worse than no button, and a page that
 * hides the acts leaves a reviewer unable to see what they are being asked to do.
 */
/**
 * ⛔ The property is not "is anything disabled" — a LIVE page starts disabled too, on purpose:
 * `claude.use` resolves later than first paint by contract, and a button that looks live before
 * a channel exists would record nothing. What separates them is whether a path to enabling them
 * exists at all.
 */
test("a read-only page can never enable an act, and a live one can", () => {
  const ro = renderScopePage(corpus, "tasks");
  assert.match(ro, /Read-only preview/);
  assert.ok((ro.match(/button class="act/g) ?? []).length > 0, "no acts on the page at all");
  assert.match(ro, /b\.disabled = true/, "read-only did not disable the acts");
  assert.doesNotMatch(ro, /disabled = false/, "read-only has a path that enables an act");
  assert.doesNotMatch(ro, /fetch\(|claude\.use/, "read-only has a channel it should not have");

  for (const records of ["http", "db"]) {
    const live = renderScopePage(corpus, "tasks", { interactive: true, records, by: "peter" });
    assert.doesNotMatch(live, /Read-only preview/);
    assert.match(live, /disabled = false/, `${records}: no path enables an act`);
    // Every act it offers owes the same fields the schema charges for.
    assert.match(live, /"because"/, `${records}: no reasoning is asked for`);
    assert.match(live, /"until"/, `${records}: a deferral is not asked what brings it back`);
  }
  // The channel each mode uses, and only that one.
  const http = renderScopePage(corpus, "tasks", { interactive: true, records: "http" });
  assert.match(http, /\/api\/v2\/act/);
  const db = renderScopePage(corpus, "tasks", { interactive: true, records: "db" });
  assert.match(db, /claude\.use\("db"\)/);
  assert.match(db, /collection\("presses"\)/);
});

/** ⛔ The renderer records nothing — the press is the human's act, written by `settle`. */
test("rendering writes nothing to the corpus", () => {
  const before = JSON.stringify(loadCorpus("v2-seed").verdicts);
  for (const id of SCOPES) renderScopePage(corpus, id, { interactive: true });
  assert.equal(JSON.stringify(loadCorpus("v2-seed").verdicts), before);
});
