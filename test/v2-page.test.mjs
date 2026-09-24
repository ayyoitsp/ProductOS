/**
 * ⛔ THE PAGE MAY NOT DISAGREE WITH THE CORPUS, AND IT DID — TWICE, ON ITS FIRST RENDER.
 *
 * Both failures were the same mistake: the page re-derived something that already had exactly
 * one home. It read the raw slot instead of `resolveRules`, so two slots an org-wide rule was
 * answering printed as "nobody has said what this is" — directly above a grid on the same page
 * marking them `↑R5` and `↑R2`. And it called `gridFor` once for the named scope, which reads
 * one scope's own exchanges, so every container rendered `0 exchanges` above cards for every
 * behaviour underneath it.
 *
 * A reviewer cannot tell which of two numbers on one screen is the real one, and the stamp
 * they leave is over whichever they believed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCorpus, resolveRules, lineageOf } from "../dist/v2/load.js";
import { gridFor, actsFor, ruleHomes } from "../dist/v2/grid.js";
import { descendants, questionsFor } from "../dist/v2/settle.js";
import { renderScopePage } from "../dist/v2/page.js";
import { SLOTS, statements } from "../dist/v2/schema.js";
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

test("a container renders the behaviours filed beneath it, not an empty grid", () => {
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
    // One grid heading per scope that actually has behaviours.
    const headings = (html.match(/<h2>Behaviours in [^<]*<\/h2>/g) ?? []).length;
    assert.ok(headings >= 1, `${id} rendered no grid for ${under} behaviours beneath it`);
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

/**
 * ⛔ A PAGE IS NAVIGABLE BY ANCHOR FOR EVERY SCOPE IT HOLDS, WHATEVER SURFACE IT IS ON.
 *
 * "Never emit a link that cannot resolve" is the right rule; falling back to plain text without a
 * `linkBase` was the wrong conclusion drawn from it. A published artifact is ONE page with no
 * server, so every scope in it rendered as an unclickable label — which made "review one feature",
 * the entire purpose of the surface, impossible on it.
 *
 * Three cases, and the middle one is the one that shipped broken.
 */
test("a page navigates within itself, and across pages only for what it does not hold", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const leaf = corpus.scopes.find((s) => s.scope.exchanges.length && s.scope.in).scope.id;

  // 1. The root holds the whole subtree, so it anchors — even when a base is available, because
  //    jumping within the page you are on beats reloading it.
  for (const opts of [{}, { linkBase: "/v2" }]) {
    const html = renderScopePage(corpus, root, opts);
    assert.match(html, /nav class="scopes"/, "no nav at all");
    assert.ok(
      (html.match(/nav class="scopes"[\s\S]*?<\/nav>/)[0].match(/href="#/g) ?? []).length >= 2,
      `root${opts.linkBase ? " (served)" : ""}: the nav is not navigable`
    );
  }

  // 2. A leaf holds only itself, so the rest of the tree needs cross-page links where served…
  const servedLeaf = renderScopePage(corpus, leaf, { linkBase: "/v2" });
  assert.match(servedLeaf, /href="\/v2\//, "a served leaf offered no way to the other scopes");

  // 3. …and is honest about them where there is nowhere to send you.
  const aloneLeaf = renderScopePage(corpus, leaf);
  assert.doesNotMatch(aloneLeaf, /href="\/v2/, "a standalone file offered a link it cannot follow");
  assert.match(aloneLeaf, /class="unlinked"/, "a standalone leaf claimed to reach scopes it does not hold");
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

/**
 * ⛔ ONE FEATURE AT A TIME, OR THE SURFACE IS NOT REVIEWABLE.
 *
 * The page rendered every descendant on one scroll. On a real product that is ten grids and 51
 * behaviours in a single artifact — and the surface exists to review ONE feature, which Peter could
 * not do on it. It is cut into views now, with the menu switching between them.
 *
 * Asserted as structure, because the switching itself is browser behaviour: every scope that has
 * behaviours gets exactly one view and exactly one menu entry, the questions get their own, and the
 * whole thing works with the script removed.
 */
test("each feature is its own view, reachable from the menu", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const html = renderScopePage(corpus, root, { linkBase: "/v2" });

  const withBehaviours = descendants(corpus, root).filter(
    (id) => (corpus.scopes.find((s) => s.scope.id === id)?.scope.exchanges.length ?? 0) > 0
  );
  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  // ⛔ Scoped to the nav. `data-goto` is no longer nav-only — a container's contents list uses it
  // too — and counting both made every feature look like it had two menu rows.
  const navHtml = /<nav class="scopes">[\s\S]*?<\/nav>/.exec(html)[0];
  const menu = [...navHtml.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1]);

  for (const id of withBehaviours) {
    assert.ok(views.includes(id), `${id} has behaviours and no view of its own`);
    assert.ok(menu.includes(id), `${id} has a view and no way to reach it`);
  }
  /**
   * ⛔ The queue lives on Overview now, reached by a TAB rather than a row in the tree. Beside the
   * features it sat at the same level as the things it asks about, and the product's own framing had
   * nowhere to be read.
   */
  assert.ok(views.includes("overview"), "there is no Overview, so the queue has no home");
  assert.match(html, /class="tab" data-tab="overview"/, "Overview is not reachable");
  assert.ok(!menu.includes("overview"), "the queue is still a row in the tree");
  // ⛔ Exactly one of each — a duplicate view means two sections claiming one feature, and a
  // duplicate menu row means one of them silently does nothing.
  assert.equal(new Set(views).size, views.length, "a feature has more than one view");
  assert.equal(new Set(menu).size, menu.length, "a feature has more than one menu row");

  // ⛔ Progressive enhancement: nothing is hidden in the markup, so a saved file or a page whose
  // script fails still shows everything rather than a blank screen.
  assert.doesNotMatch(html, /section class="view"[^>]*hidden/, "a view is hidden before any script runs");
});

/**
 * ⛔ THE TREE IS A TOP FRAME THAT COLLAPSES TO WHERE YOU ARE.
 *
 * Sixteen nav rows permanently on screen is a table of contents competing with the thing being
 * reviewed. The trail is the one line worth the space once a feature is chosen, and the tree is one
 * press away. Structure is asserted here; the collapsing itself is browser behaviour and was
 * verified by driving it.
 */
test("the top frame carries a trail for every view it can reach", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const html = renderScopePage(corpus, root, { linkBase: "/v2" });

  assert.match(html, /class="topframe"/, "no top frame");
  /**
   * ⛔ THE CHEVRON EXPANDS; THE TRAIL NAVIGATES. One control doing both meant every attempt to go up
   * a level dropped the whole tree on you — the opposite of what a breadcrumb is for.
   */
  assert.match(html, /class="chev" aria-expanded="false"/, "nothing expands the tree");
  assert.doesNotMatch(html, /class="crumbs"[^>]*aria-expanded/, "the trail is still the expander");

  const raw = /data-trails="([^"]+)"/.exec(html);
  assert.ok(raw, "the frame carries no trails");
  const trails = JSON.parse(raw[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  /**
   * ⛔ An apostrophe in a scope title used to cut this attribute in half — "Resolve an
   * organization's stages" ended it early, JSON.parse threw, and every breadcrumb fell back to a
   * bare id with nothing reporting an error.
   */
  assert.ok(Object.keys(trails).length > 1, "the trails did not survive being written into an attribute");

  // ⛔ Every view the menu offers has a trail, or selecting it leaves the frame lying about where
  // you are — which is worse than no trail at all.
  const nav = /<nav class="scopes">[\s\S]*?<\/nav>/.exec(html)[0];
  for (const view of [...nav.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(trails[view]?.length, `${view} is reachable and has no trail`);
    // ⛔ Every crumb carries the id it navigates to. With labels alone the ancestors were decoration.
    for (const crumb of trails[view]) assert.ok(crumb.id && crumb.label, `a crumb of ${view} cannot be followed`);
  }

  // ⛔ The trail is the `in:` chain, root first — the same one the rows are indented by.
  const leaf = descendants(corpus, root).find((id) => {
    const sc = corpus.scopes.find((s) => s.scope.id === id)?.scope;
    return sc?.exchanges.length && sc.in && sc.in !== root;
  });
  if (leaf) {
    const t = trails[leaf];
    assert.ok(t.length >= 3, `${leaf} is nested and its trail is ${JSON.stringify(t)}`);
    const title = corpus.scopes.find((s) => s.scope.id === leaf).scope.title;
    assert.equal(t[t.length - 1].label, title, "the trail does not end where you are");
    assert.equal(t[t.length - 1].id, leaf);
  }
});

/**
 * ⛔ THE TOP LEVEL IS A ROW, NOT A DEPTH IN A DROPDOWN.
 *
 * The two halves of a product — what it states a person, and the machinery underneath — are the
 * split a reader navigates by constantly. Buried at depth 1 of a collapsed tree, the most-used move
 * cost two presses and a scan. And the queue sat in that tree beside the features, at the same level
 * as the things it asks about, which left the product's own framing with nowhere to be read at all.
 */
test("the frame has tabs for each half, and Overview carries the queue", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const html = renderScopePage(corpus, root, { linkBase: "/v2" });

  const tabs = [...html.matchAll(/class="tab" data-tab="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(tabs[0], "overview", "Overview is not the first thing offered");
  for (const half of corpus.scopes.filter((s) => s.scope.in === root))
    assert.ok(tabs.includes(half.scope.id), `${half.scope.id} is a half of the product and has no tab`);

  // ⛔ What a person sees comes before the machinery underneath it. File order put subsystems first.
  const screensUnder = (id) =>
    descendants(corpus, id).reduce(
      (n, d) => n + (corpus.scopes.find((y) => y.scope.id === d)?.scope.views.length ?? 0),
      0
    );
  const halves = tabs.slice(1);
  for (let i = 1; i < halves.length; i++)
    assert.ok(
      screensUnder(halves[i - 1]) >= screensUnder(halves[i]),
      `${halves[i]} has more screens than ${halves[i - 1]} and comes after it`
    );

  // ⛔ The root is a tab, not a crumb — repeating it spent the widest part of the line on the one
  // place the tab row already names, and read as a level you could go up to that was another tab.
  const trails = JSON.parse(/data-trails="([^"]+)"/.exec(html)[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [view, t] of Object.entries(trails))
    // ⛔ The root's own trail is necessarily itself — it is the one scope with nothing above it.
    if (view !== "overview" && view !== root)
      assert.notEqual(t[0].id, root, `${view}'s trail starts at the root`);

  /**
   * ⛔ Overview is a set of product-wide pages, not one scroll: the queue, what the product is, and
   * every charter document. Stacked together the principles sit under seven open questions and
   * nobody reads them.
   */
  assert.match(html, /data-sub-view="queue"/, "Overview does not carry the queue");
  assert.match(html, /data-sub-view="about"[\s\S]{0,300}class="prose"/, "Overview does not say what the product is");
  for (const c of corpus.charter)
    assert.match(
      html,
      new RegExp(`data-sub-view="${c.charter.id}"`),
      `${c.charter.id} is product-wide truth with nowhere to be read`
    );
});

/**
 * ⛔ HIDING MUST ACTUALLY HIDE, AND THE ATTRIBUTE ALONE DOES NOT.
 *
 * `[hidden]` is a UA rule of `display:none`, and any class setting `display` beats it. Every row of
 * the tree, the crumb row and Overview's menu are `display:flex`, so everything the switcher marked
 * hidden stayed on screen: choosing one half of the product still showed the whole tree, and the
 * Overview menu sat on top of the breadcrumbs.
 *
 * It survived a browser check because that check read the `hidden` PROPERTY, which was set correctly
 * the whole time. The property is what the script controls; visibility is what a reader gets.
 */
test("everything the page can hide is overridden back into view by nothing", () => {
  const html = renderScopePage(corpus, corpus.scopes.find((s) => !s.scope.in).scope.id, { linkBase: "/v2" });
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1];

  assert.match(style, /\[hidden\]\s*\{\s*display:\s*none\s*!important/, "nothing forces hidden to hide");

  // ⛔ Every selector that sets `display` is a candidate to beat the UA rule. If one is added for a
  // thing the switcher hides, and the override above is ever removed, this is the tripwire.
  const setsDisplay = [...style.matchAll(/([^{}]+)\{[^}]*display:\s*(?!none)[a-z-]+/g)].map((m) => m[1].trim());
  assert.ok(
    setsDisplay.some((sel) => /nav\.scopes li/.test(sel)),
    "the tree rows no longer set display — re-check whether the override is still needed"
  );
});

/**
 * ⛔ AN EMPTY QUEUE MUST NOT READ AS A FINISHED CORPUS.
 *
 * "Nothing is undecided" is true of a corpus nobody has written, and on a migrated one it means the
 * opposite of what it says: there are no questions because nobody has written enough down to have a
 * question about it. A reviewer told "nothing to decide" over 539 blank slots has been told it is
 * ready.
 *
 * This is the shape a migration actually produces, so it is the shape that has to be honest.
 */
test("a queue with no questions says how much is unwritten", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2bare-"));
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  for (const d of ["rules", "readings", "verdicts"]) fs.mkdirSync(path.join(dir, d), { recursive: true });
  // One behaviour, one slot said, the rest blank — a migration's output in miniature.
  fs.writeFileSync(
    path.join(dir, "truth", "thing.md"),
    `---\nid: thing\ntitle: A thing\nexists: kept\nviews:\n  - id: a-screen\n    title: A screen\n    walked: true\n    parts:\n      - id: go\n        role: commits\n        label: Go\nexchanges:\n  - id: press-go\n    title: Somebody presses Go\n    asked_by: person\n    at: { view: a-screen, part: go }\n    slots:\n      answer:\n        says: Something is recorded, and the person is told it was.\n    criteria: []\n---\n\nA scope with one sentence and seven blanks.\n`
  );
  const bare = loadCorpus(dir);
  assert.equal(bare.broken.length, 0, JSON.stringify(bare.broken));

  const html = renderScopePage(bare, "thing");
  /**
   * ⛔ Whitespace-tolerant throughout: the template wraps mid-sentence, and a test matching one
   * line break's worth of formatting fails on the next reflow while the copy is perfectly correct.
   */
  const flat = html.replace(/\s+/g, " ");
  assert.match(flat, /Nothing here is undecided/);
  /**
   * ⛔ Two different numbers, and they are not the same work: sentences waiting to be READ, and
   * slots waiting to be WRITTEN. An empty queue that reports neither reads as a finished corpus.
   *
   * An earlier version asserted "nothing can be agreed to", which was true only while a stamp had
   * to cover a whole exchange — it stopped being true the moment one behaviour became acceptable.
   */
  assert.match(flat, /behaviours? nobody has agreed to yet/, "it does not say what is waiting to be read");
  assert.match(flat, /slots carry a sentence/, "it does not say how much is unwritten");
  assert.match(flat, /say nothing at all/, "an empty queue read as a finished corpus");
  /**
   * ⛔ And it says what to DO. "Somebody should write it down" is a diagnosis; a reviewer facing 539
   * blanks needs to know which feature to start with, which is what the worklist is for.
   */
  assert.match(html, /table class="worklist"/, "a diagnosis with no next action");
  assert.match(flat, /ordered smallest first/, "the worklist does not say what its order means");
  assert.match(html, /<code>may<\/code>/, "the worklist does not say which slots are missing");
  // ⛔ The figures come from the grid, so the page and the grid cannot disagree about what is empty.
  const grid = gridFor(bare, "thing");
  assert.match(html, new RegExp(`${grid.counts.blank} say nothing`), "the count is not the grid's");
});

/**
 * ⛔ A REVIEWER IS ASKED ABOUT A BEHAVIOUR, NOT ABOUT AN EIGHT-COMPARTMENT CLUSTER.
 *
 * The page handed over an exchange with its eight slots and asked a person to fill them, which
 * produced "Deal row on CRE Deals → refuses" — not a hard question, not a question. `GLOSSARY.md`
 * calls one falsifiable claim "the atom": it is what somebody reads and has an opinion about. The
 * slots are an AUTHORING device that makes thinness countable; using them as the reviewer's unit of
 * work was the error everything else followed from.
 */
test("a feature offers its behaviours one at a time, and the slot machinery is folded away", () => {
  const scopes = corpus.scopes.filter((s) => s.scope.exchanges.length);
  assert.ok(scopes.length, "the seed has no scope with behaviours");
  for (const { scope } of scopes) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "/v2" });

    // Every stated sentence is offered on its own, and nothing blank is.
    const said = scope.exchanges.flatMap((ex) =>
      SLOTS.filter((sl) => {
        const f = ex.slots[sl];
        return f && (f.says || f.none || f.cannot_fail || f.outcomes?.length);
      }).map((sl) => `${scope.id}#${ex.id}#${sl}`)
    );
    for (const ref of said)
      assert.match(html, new RegExp(`id="at-${ref.replace(/[^a-z0-9]+/gi, "-")}"`), `${ref} is stated and not offered`);

    /**
     * ⛔ ONE CARD PER STATEMENT, not per slot. A slot may say thirteen things; thirteen claims and
     * thirty-one criteria under one "That is right" is not review, which is what one-card-per-slot
     * produced on a real corpus.
     */
    // ⛔ A group's own rules render as cards too, and they are NOT this scope's statements — they
    // are what holds across everything filed under it. Counted together they hid a real regression.
    const expected = scope.exchanges.reduce(
      (n, ex) =>
        n +
        SLOTS.reduce((m, sl) => {
          const f = ex.slots[sl];
          if (!f) return m;
          if (f.none || f.cannot_fail || f.outcomes?.length) return m + 1;
          return m + statements(f.says).length;
        }, 0),
      0
    );
    const cards = (html.match(/article class="beh"/g) ?? []).length;
    assert.equal(cards, expected, `${scope.id}: ${cards} cards for ${expected} statements`);

    /**
     * ⛔ The act aims at the BEHAVIOUR — aiming it at the exchange is the grain error in one line.
     *
     * But only where the sentence is settled. A sentence carrying an unruled aspect is shown and
     * deliberately NOT offered: agreeing to it would stamp the part nobody has decided along with
     * the part they have, which is the whole reason `about` exists.
     */
    for (const ref of said) {
      const [, exId, sl] = ref.split("#");
      const fill = scope.exchanges.find((e) => e.id === exId).slots[sl];
      const offered = new RegExp(`data-act="accept" data-ref="${ref}"`).test(html);
      if (fill.standing.kind === "stated")
        assert.ok(offered, `${ref} is settled and cannot be agreed to on its own`);
      else assert.ok(!offered, `${ref} is ${fill.standing.kind} and was offered for agreement anyway`);
    }

    // ⛔ And the grid is behind a fold. It is how an author finds a hole, not how a reviewer works.
    assert.match(html, /details class="fold"/, "the authoring view is not folded away");
    assert.doesNotMatch(html, /<details class="fold" open/, "the authoring view opens by default");
  }
});

/**
 * ⛔ THE TREE SAYS WHERE THE WORK IS, AND IT USED TO SAY NOTHING.
 *
 * Every row reported exchange-grained acceptances, which are zero on any corpus that is not
 * finished — so the whole tree read "waiting on the shared questions" and could not answer the one
 * question it exists for: which of these do I look at next.
 */
test("every section says how much it is holding", () => {
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const html = renderScopePage(corpus, root, { linkBase: "/v2" });
  const acts = actsFor(corpus);
  const nav = /<nav class="scopes">[\s\S]*?<\/nav>/.exec(html)[0];

  /**
   * ⛔ ITS OWN FIGURE, AND WHAT IS BELOW SAID SEPARATELY.
   *
   * Peter: "i don't think subsections should sum up questions below it — each section should have
   * their own behaviors and own unanswered count."
   *
   * A rolled-up number is one every ancestor repeats and no ancestor is responsible for: the root
   * said "126 to read", so did the product, so did the area, and none of them was where the work
   * was. Worse, it concealed that in a real 34-scope corpus EVERY group stated nothing of its own —
   * each row looked like it held something, and what it held was its children.
   */
  const homes = ruleHomes(corpus);
  for (const { scope } of corpus.scopes) {
    if (scope.id === root) continue;
    const ownStated = [...homes].filter(([id, home]) => home === scope.id).map(([id]) => id)
      .filter((id) => !corpus.rules.find((r) => r.rule.id === id)?.rule.standing || corpus.rules.find((r) => r.rule.id === id)?.rule.standing?.kind === "stated").length;
    const own = acts.behaviours.filter((b) => b.startsWith(`${scope.id}#`)).length + ownStated;
    const below = descendants(corpus, scope.id).filter((d) => d !== scope.id);
    const under = acts.behaviours.filter((b) => below.some((u) => b.startsWith(`${u}#`))).length;
    const row = new RegExp(`data-goto="${scope.id}"[^]*?</li>`).exec(nav);
    if (!own && !under) continue;
    assert.ok(row, `${scope.id} has no row`);
    if (own) assert.match(row[0], new RegExp(`${own} to read`), `${scope.id}'s row does not say what IT holds (${own})`);
    // What is filed beneath is reported, and reported as being beneath.
    if (under) assert.match(row[0], new RegExp(`${under} below`), `${scope.id}'s row does not say ${under} sit below it`);
    // ⛔ And a group holding nothing of its own says so, rather than showing its children's total.
    if (!own && under) assert.match(row[0], /states nothing of its own/, `${scope.id} is silent and does not say so`);
  }

  /**
   * ⛔ THE TAB STAYS A ROLL-UP, DELIBERATELY. It answers "which side has the work" before either
   * tree is open, which is a question about a subtree — the row answers "what does this one owe",
   * which is a question about one scope. Two questions, two numbers.
   */
  for (const half of corpus.scopes.filter((s) => s.scope.in === root)) {
    const under = descendants(corpus, half.scope.id);
    const n = acts.behaviours.filter((b) => under.some((u) => b.startsWith(`${u}#`))).length;
    if (n)
      assert.match(
        html,
        new RegExp(`data-tab="${half.scope.id}">[^<]*<span class="pill quiet">${n}</span>`),
        `the ${half.scope.id} tab does not carry its count`
      );
  }
});

test("a rule belongs to the narrowest group that contains its whole reach", () => {
  /**
   * ⛔ EVERY RULE WAS REPORTED AS ORG-WIDE, ON EVERY ROW.
   *
   * The model could always scope a rule to a subtree — the selector takes `under:` — but nothing
   * ever asked where a rule LIVED. So a sentence holding for one area read as a decision the whole
   * company owed, and it read that way on sixteen rows at once. The nav's job is "which one next",
   * and a number identical everywhere answers nothing.
   */
  const homes = ruleHomes(corpus);
  assert.equal(homes.size, corpus.rules.length, "some rule was not placed anywhere");

  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  const { reach } = resolveRules(corpus);
  for (const { rule } of corpus.rules) {
    const home = homes.get(rule.id);
    const hits = [...new Set((reach.get(rule.id) ?? []).map((r) => r.split("#")[0]))];
    if (!hits.length) continue;

    // ⛔ The root is not a group. A rule reaching the whole product is nobody's in particular,
    // which is the only thing org-wide should ever have meant.
    assert.notEqual(home, root, `${rule.id} is filed on the root rather than read as shared`);

    if (home === undefined) continue;
    // Everything it reaches is inside its home…
    for (const h of hits)
      assert.ok(
        lineageOf(corpus, h).includes(home),
        `${rule.id} lives in ${home} but reaches ${h}, which is outside it`
      );
    // …and its home is the NARROWEST such scope: no child of it contains the whole reach.
    for (const kid of corpus.scopes.filter((s) => s.scope.in === home))
      assert.ok(
        !hits.every((h) => lineageOf(corpus, h).includes(kid.scope.id)),
        `${rule.id} is filed on ${home} when all of it fits inside ${kid.scope.id}`
      );
  }

  // The seed is the worked example, so it has to demonstrate both kinds or nobody will write one.
  const grouped = [...homes.values()].filter(Boolean).length;
  const shared = [...homes.values()].filter((h) => h === undefined).length;
  assert.ok(grouped > 0, "no rule in the seed belongs to a group — the concept has no example");
  assert.ok(shared > 0, "no rule in the seed is genuinely shared — the concept has no example");
});

test("a screen is a prototype: every part is a control, wired to the right text", () => {
  /**
   * ⛔ A FENCED DRAWING AND A LIST OF NAMES IS NOT UX.
   *
   * Peter: "we need to actually incorporate real UX. this is useless without UX. it should be able
   * to render prototypes, and per-card show the interactions interactively."
   *
   * A behaviour like "the deal row refuses" cannot be judged without the row. The model already
   * connected them — an exchange arrives `at: {view, part}` — and the renderer computed that anchor
   * and threw it away (`void at`).
   */
  const withScreens = corpus.scopes.filter((s) => s.scope.views.some((v) => v.exists !== "withdrawn" && v.sketch));
  assert.ok(withScreens.length, "the seed has no drawn screen");

  for (const { scope } of withScreens) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "/v2" });
    for (const v of scope.views) {
      if (v.exists === "withdrawn" || !v.sketch) continue;

      for (const pt of v.parts) {
        // Drawn or not, every part is reachable as a control — an undrawn one is listed, never dropped.
        assert.match(
          html,
          new RegExp(`data-part="${pt.id}"`),
          `${v.id}/${pt.id} cannot be pointed at on the prototype`
        );
        /**
         * ⛔ WIRED TO THE RIGHT TEXT, OR NOT WIRED. A part bound to the wrong words is strictly
         * worse than one left unbound: the reviewer gets a confident answer about something they
         * did not click, and nothing on the page says the binding was guessed. "No deals yet" bound
         * itself to the "No" inside "Northgate".
         */
        const wrap = new RegExp(`<button[^>]*data-part="${pt.id}"[^>]*>([^<]*)</button>`).exec(html);
        if (wrap && v.sketch.includes(wrap[1])) {
          const inside = wrap[1];
          const label = pt.label ?? pt.id;
          assert.ok(
            label.toLowerCase().startsWith(inside.toLowerCase().trim()) || inside.toLowerCase().includes(label.toLowerCase()),
            `${v.id}/${pt.id} is labelled "${label}" and got wired to "${inside}"`
          );
          assert.ok(inside.trim().length >= 5 || label.split(/\s+/).length === 1, `${pt.id} was wired to "${inside}" — too short to be evidence`);
        }
        // A part that goes somewhere carries where, so the flow can be walked.
        if (pt.leads_to)
          assert.match(html, new RegExp(`data-part="${pt.id}"[^>]*data-goes="[^"]`), `${pt.id} goes somewhere and the prototype does not know where`);
      }
    }

    // ⛔ And what is stated at each control ships with the page, so clicking works with nothing
    // behind it — a published artifact has no server to ask.
    assert.match(html, /id="part-facts"/, "the prototype has no facts to show when a control is clicked");
  }
});

test("a card about a control can take you to it", () => {
  for (const { scope } of corpus.scopes.filter((s) => s.scope.exchanges.some((e) => e.at?.view))) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "/v2" });
    for (const ex of scope.exchanges) {
      if (!ex.at?.view) continue;
      assert.match(
        html,
        new RegExp(`data-show-part="${ex.at.view}/${ex.at.part ?? ""}"`),
        `${scope.id}#${ex.id} arrives at ${ex.at.view} and no card offers to show it`
      );
    }
    // ⛔ And one that names no screen says so, rather than printing a bare id nobody can follow.
    if (scope.exchanges.some((e) => !e.at?.view) && scope.views.length)
      assert.match(html, /nothing says where this happens/, "a behaviour with no screen is silent about it");
  }
});

test("a generated screen keeps the app's CSS out of the review page", () => {
  /**
   * ⛔ Peter: "i don't think we should have ascii, we should try to generate what it'd look like
   * from the codebase."
   *
   * A mock in the application's real class names needs the application's real CSS, and that CSS
   * styles `.flex`, `*` and `:root`. Inlined into this page it restyles the page — the review
   * surface starts looking like the thing under review, and any later change to their stylesheet
   * can break this page's layout with nothing connecting cause to effect.
   */
  const scope = corpus.scopes.find((s) => s.scope.views.some((v) => v.parts.length));
  assert.ok(scope, "the seed has no screen with parts");
  const view = scope.scope.views.find((v) => v.parts.length);

  // Stand in a mock for the seed's screen, in the shape a generated one has.
  const withHtml = structuredClone(corpus);
  const target = withHtml.scopes.find((s) => s.scope.id === scope.scope.id).scope.views.find((v) => v.id === view.id);
  target.sketch_html = `<div class="flex p-4"><button class="rounded bg-blue-600">${view.parts[0].label ?? view.parts[0].id}</button><input placeholder="nothing" /></div>`;

  const html = renderScopePage(withHtml, scope.scope.id, {
    linkBase: "/v2",
    appCss: ":root { --x: red } .flex { display: flex } * { box-sizing: border-box }",
  });

  // Isolated from the page: the mock is a shadow tree, so the app's CSS cannot restyle the page.
  assert.match(html, /<template shadowrootmode="open">/, "the mock is not isolated from the page");
  const shadow = /<template shadowrootmode="open">([\s\S]*?)<\/template>/.exec(html);
  assert.ok(shadow, "no shadow tree was emitted");

  /**
   * ⛔ THE STYLESHEET SHIPS ONCE. Inlining it inside each shadow root put 370 KB into the page
   * eleven times — a 4.7 MB document and eleven parses of one stylesheet. It travels as a single
   * template that every shadow root adopts by reference.
   */
  const copies = [...html.matchAll(/\.flex \{ display: flex \}/g)].length;
  assert.equal(copies, 1, `the app's stylesheet is in the page ${copies} times`);
  const tpl = /<template id="app-css">([\s\S]*?)<\/template>/.exec(html);
  assert.ok(tpl, "the app's CSS does not travel with the page at all");

  /**
   * ⛔ `:root` does not match inside a shadow tree, so a design system defining its tokens there
   * would hand the mock variables that resolve to nothing — every colour and spacing value empty,
   * which renders as an unstyled page rather than as an error.
   */
  assert.match(tpl[1], /:host, :root \{ --x: red \}/, ":root was left unreachable inside the shadow tree");

  // The selection marker has to be inside too: page CSS does not cross the boundary.
  assert.match(shadow[1], /\.pt\.on \{/, "nothing inside the mock can show which control is selected");

  // And the part is wired in the generated markup, not just in the ASCII path.
  assert.match(shadow[1], new RegExp(`data-part="${view.parts[0].id}"`), "the generated mock has no wired control");

  // ⛔ And where no CSS is supplied, nothing claims otherwise.
  const bare = renderScopePage(withHtml, scope.scope.id, { linkBase: "/v2" });
  assert.doesNotMatch(bare, /id="app-css"/, "a page with no app CSS emitted an empty stylesheet template");
});

test("a label the browser writes as text is escaped once, not twice", () => {
  /**
   * ⛔ "Pricing & loan terms" APPEARED IN THE BREADCRUMB AS "Pricing &amp; loan terms".
   *
   * `line()` escapes for HTML, which is right for markup and wrong for a value that goes into an
   * attribute and is later assigned to `textContent`: the escaping happens once on the way out and
   * once more on the way in. It hit the crumbs and the note composer's trail, on every title
   * containing an ampersand or a quote — and it is invisible in the HTML, because `&amp;amp;` looks
   * like correctly-escaped markup right up until a browser renders it.
   */
  const amp = corpus.scopes.find((s) => /[&"']/.test(s.scope.title ?? ""));
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;

  // The seed may have no such title; construct one rather than skip, because the bug is the encoding.
  const c = structuredClone(corpus);
  const victim = c.scopes.find((s) => s.scope.in === root) ?? c.scopes[1];
  victim.scope.title = 'Pricing & "loan" terms';
  const html = renderScopePage(c, root, { linkBase: "/v2", interactive: true, records: "http", by: "t" });

  const trails = /data-trails="([^"]*)"/.exec(html);
  assert.ok(trails, "the frame carries no trails");
  // Decoded once from the attribute, the JSON must hold the RAW title — no entities inside it.
  const json = trails[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const parsed = JSON.parse(json);
  const labels = Object.values(parsed).flat().map((x) => x.label);
  assert.ok(
    labels.includes('Pricing & "loan" terms'),
    `a trail label is double-escaped: ${JSON.stringify(labels.filter((l) => /&amp;|&quot;/.test(l)))}`
  );
  for (const l of labels) assert.doesNotMatch(l, /&(amp|quot|lt|gt|#39);/, `"${l}" carries an HTML entity into textContent`);

  // Same for every data-label, which the composer writes as text.
  for (const m of html.matchAll(/data-label="([^"]*)"/g)) {
    const once = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    assert.doesNotMatch(once, /&(amp|quot|lt|gt|#39);/, `data-label="${m[1]}" is escaped twice`);
  }
  void amp;
});
