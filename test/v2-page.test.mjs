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
import { loadCorpus } from "../dist/v2/load.js";
import { gridFor } from "../dist/v2/grid.js";
import { descendants, questionsFor } from "../dist/v2/settle.js";
import { renderScopePage } from "../dist/v2/page.js";
import { SLOTS } from "../dist/v2/schema.js";
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
  assert.match(html, /Nothing here is undecided/);
  assert.match(html, /almost none of it is written/i, "an empty queue read as a finished corpus");
  // ⛔ Whitespace-tolerant: the template wraps mid-sentence, and a test that only matches one line
  // break's worth of formatting fails on the next reflow while the copy is perfectly correct.
  assert.match(
    html.replace(/\s+/g, " "),
    /Nothing can be agreed to while a behaviour has a slot that says nothing/,
    "it does not say what the blanks block"
  );
  /**
   * ⛔ And it says what to DO. "Somebody should write it down" is a diagnosis; a reviewer facing 539
   * blanks needs to know which feature to start with, which is what the worklist is for.
   */
  assert.match(html, /table class="worklist"/, "a diagnosis with no next action");
  assert.match(html.replace(/\s+/g, " "), /ordered smallest first/, "the worklist does not say what its order means");
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

    const cards = (html.match(/article class="beh"/g) ?? []).length;
    assert.equal(cards, said.length, `${scope.id}: ${cards} cards for ${said.length} stated behaviours`);

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
