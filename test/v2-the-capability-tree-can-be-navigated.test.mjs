/**
 * ⛔ THE CAPABILITY TREE SHIPPED WITH NO WAY IN.
 *
 * Peter, on the corpus the conversion had just produced: *"wtf happened to capabilities tab? I see a
 * bunch of capabilities flattend in the menu. is the tree completely gone?"*, then *"capabilities is
 * a separate tree, when did that change???"*.
 *
 * It had not changed, and it was not gone. The tree was right in the data — 27 subsystems, 12 at the
 * top, 15 nested, nothing dangling — and right in its own render. It simply had no NAVIGATION:
 *
 *   · `renderNav` walks `corpus.scopes`, and a subsystem is not a scope, so no row could exist.
 *   · there was no address for a subsystem at all, so there was nowhere for a row to go.
 *   · every subsystem rendered on ONE view, nesting visible only as indentation inside 145 KB.
 *
 * So the "Capabilities" he used to navigate was the product AREA, and removing it is what he asked
 * for — but nothing replaced it, because the replacement had a model and a renderer and no menu.
 *
 * ⛔ WHY THE ADDRESSES ARE A SEPARATE SPACE, AND IT IS NOT TIDINESS. Four ids in the real corpus name
 * BOTH a product scope and a subsystem. A bare `/v2/<id>` therefore cannot be merged across the two
 * trees without silently changing which page four existing addresses serve, so every subsystem path
 * is headed by the `subsystems` segment. The model says the same thing — Peter: *"product scope sits
 * under product, and they reference capabilities"*.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { temp } from "./support/temp.mjs";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage } from "../dist/v2/page.js";
import { subsystemTrailsOf } from "../dist/v2/subsystems.js";
import { v2Route } from "../dist/v2/serve.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

/** `records` holds `ledger` and `clock` — a container and two parts, so nesting is real. */
const RECORDS = `---
id: records
title: Records
does: Everything this product keeps about what happened, and the parts that read it back.
---
An area, not a part.
`;
const LEDGER = `---
id: ledger
title: The ledger
does: Holds every movement of a kid's money as an append-only record, and answers what a kid has now.
in: records
offers:
  - id: record-a-movement
    does: Appends one movement against one kid with its day, amount and reason.
    serves: [money#record-earning#after]
---
Append-only is the whole design.
`;
const CLOCK = `---
id: clock
title: The clock
does: Decides when something is due, and hands it over once per day per subject.
in: records
offers:
  - id: fire-a-daily-due-date
    does: Hands over one subject on the day something falls due for it, once per day.
    serves: [money#see-a-balance#answer]
---
The once-per-day guarantee lives here.
`;

function aCorpus() {
  const dir = temp("v2capnav-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
  fs.writeFileSync(path.join(dir, "capabilities", "records.md"), RECORDS);
  fs.writeFileSync(path.join(dir, "capabilities", "ledger.md"), LEDGER);
  fs.writeFileSync(path.join(dir, "capabilities", "clock.md"), CLOCK);
  return dir;
}

const pageOf = (dir, opts = {}) => {
  const corpus = loadCorpus(dir);
  assert.equal(corpus.broken.length, 0, `the fixture does not load: ${corpus.broken.map((b) => b.why).join(" | ")}`);
  const root = corpus.scopes.find((s) => !s.scope.in).scope.id;
  return renderScopePage(corpus, root, {
    interactive: true,
    linkBase: "/v2",
    only: [root, "overview", "subsystems"],
    ...opts,
  });
};

test("a subsystem's trail is its own `in:` chain, not a scope's", () => {
  const corpus = loadCorpus(aCorpus());
  const t = subsystemTrailsOf(corpus);
  assert.deepEqual(t.records.map((c) => c.id), ["records"], "a top-level subsystem has a one-step trail");
  assert.deepEqual(t.ledger.map((c) => c.id), ["records", "ledger"], "a nested subsystem lost its parent");
  assert.deepEqual(t.clock.map((c) => c.id), ["records", "clock"]);
  /** ⛔ Labels come from the subsystem, because the crumb is written with textContent. */
  assert.equal(t.ledger.at(-1).label, "The ledger");
});

test("every subsystem is a row in the menu, nested, with somewhere to go", () => {
  const html = pageOf(aCorpus());
  for (const id of ["records", "ledger", "clock"])
    assert.match(html, new RegExp(`data-subsystem="${id}"`), `${id} has no row in the menu`);

  /** ⛔ A real `<ul>` inside the container's row — an indent is not a container, which is the
   *  defect the scope tree's own comment records. */
  assert.match(html, /data-subsystem="records"[^>]*class="holds[^"]*"/, "the container holds no group, so nothing can collapse");
  const records = html.slice(html.indexOf('data-subsystem="records"'));
  const inside = records.slice(0, records.indexOf("</li>"));
  assert.match(inside, /<ul>/, "the children are not inside the parent's list");

  /** The address, and it is in the machinery's own space. */
  assert.match(html, /href="\/v2\/subsystems\/records\/ledger"/, "the nested subsystem has no address");
  assert.match(html, /href="\/v2\/subsystems\/records"/, "the container has no address");
});

test("the subsystem you are standing on is marked, and the scope tree is untouched by it", () => {
  const html = pageOf(aCorpus(), { subsystem: "ledger" });
  const row = html.slice(html.indexOf('data-subsystem="ledger"'));
  assert.match(row.slice(0, row.indexOf("</li>")), /aria-current="page"/, "nothing says which subsystem this is");
  /**
   * ⛔ AND NOT IN THE OTHER TREE. Four ids in the real corpus name both a scope and a subsystem, so
   * a shared `here` would mark a product row because a subsystem of that name was selected.
   */
  const scopeRows = [...html.matchAll(/data-scope="([^"]+)"[^>]*>[\s\S]{0,400}?aria-current="page"/g)].map((m) => m[1]);
  assert.deepEqual(scopeRows, [], `a product row was marked current by a subsystem selection: ${scopeRows.join(", ")}`);
});

test("one address renders one page — a focused subsystem is not the whole tree", () => {
  const whole = pageOf(aCorpus());
  const one = pageOf(aCorpus(), { subsystem: "ledger" });
  const cards = (h) => {
    const sec = h.slice(h.indexOf('id="view-subsystems"'));
    return (sec.slice(0, sec.indexOf("</section>")).match(/class="subsys"/g) || []).length;
  };
  assert.equal(cards(whole), 3, "the unfocused view should hold the whole tree");
  assert.equal(cards(one), 1, `focusing on the ledger rendered ${cards(one)} cards, so the address did not narrow it`);
  /** ⛔ And the way back up is on the page, because the menu may be collapsed behind a chevron. */
  assert.match(one, /class="subsys-up"/, "a focused page offers no way back up");
  assert.match(one, /href="\/v2\/subsystems"[^>]*>The machinery/, "the trail does not reach the whole tree");
  assert.match(one, /href="\/v2\/subsystems\/records"/, "the trail skips the ancestor it is filed in");
});

/** The route, exercised over real HTTP — a rendered link proves nothing about what answers it. */
async function serving(dir) {
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await v2Route(req, res, p, { dir })) return;
    res.writeHead(404);
    res.end("no route");
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  return { base, stop: () => new Promise((r) => server.close(r)) };
}

test("the addresses the menu writes are the addresses the server answers", async () => {
  const { base, stop } = await serving(aCorpus());
  try {
    const get = (u) => fetch(base + u, { redirect: "manual" });

    assert.equal((await get("/v2/subsystems")).status, 200, "the whole tree stopped answering");
    assert.equal((await get("/v2/subsystems/records")).status, 200, "a top-level subsystem has no page");
    assert.equal((await get("/v2/subsystems/records/ledger")).status, 200, "a nested subsystem has no page");

    /** ⛔ An invented ancestry must not serve the same page — three of them once did, byte-identical. */
    const wrong = await get("/v2/subsystems/made-up/ledger");
    assert.equal(wrong.status, 301, "a wrong ancestry answered instead of redirecting");
    assert.match(wrong.headers.get("location"), /\/v2\/subsystems\/records\/ledger$/, "it redirected somewhere else");

    /** ⛔ And a segment naming nothing is a 404, not its parent served in silence. */
    assert.equal((await get("/v2/subsystems/not-a-subsystem")).status, 404, "a made-up subsystem answered 200");
  } finally {
    await stop();
  }
});

test("⛔ a bare id still names the SCOPE, even where a subsystem shares it", async () => {
  /**
   * The real corpus has four such collisions. If a bare `/v2/<id>` ever started resolving to a
   * subsystem, four existing product addresses would quietly serve a different page.
   */
  const dir = aCorpus();
  const corpus = loadCorpus(dir);
  const scope = corpus.scopes.find((s) => s.scope.in)?.scope.id;
  assert.ok(scope, "the fixture has no nested scope to test with");
  fs.writeFileSync(
    path.join(dir, "capabilities", "collide.md"),
    `---\nid: ${scope}\ntitle: A part sharing a feature's name\ndoes: Exists only to collide with the scope of the same id.\n---\nCollision.\n`
  );
  const after = loadCorpus(dir);
  assert.ok(after.subsystems.some((x) => x.subsystem.id === scope), "the colliding subsystem did not load");

  const { base, stop } = await serving(dir);
  try {
    const r = await fetch(`${base}/v2/subsystems/${scope}`, { redirect: "manual" });
    assert.ok(r.status === 200 || r.status === 301, `the subsystem address answered ${r.status}`);
    /** The scope keeps its own address, under its own trail, with no subsystems segment. */
    const trail = (await import("../dist/v2/page.js")).trailsOf(after)[scope].map((c) => c.id);
    const asScope = await fetch(`${base}/v2/${trail.join("/")}`, { redirect: "manual" });
    assert.equal(asScope.status, 200, "the product scope lost its address to the subsystem of the same name");
  } finally {
    await stop();
  }
});

test("the menu really nests in a browser, and a row really navigates", async () => {
  const exe = browserOrSkip();
  if (!exe) return;
  const { base, stop } = await serving(aCorpus());
  const page = await openPage(null, { url: `${base}/v2/subsystems/records/ledger`, width: 1400, height: 900 });
  try {
    await page.waitFor(`location.href.indexOf("/v2/subsystems/records/ledger") > 0`, "the focused page to load");
    /**
     * ⛔ THE MEASUREMENT CARRIES ITS CONDITIONS, and this test failed twice before it did.
     *
     * A menu is only a menu in the SIDE placement: across the top the tree lives behind the chevron
     * and is collapsed, so `nav.scopes` is `display:none` and every row correctly reports height 0.
     * Measuring there said "the tree renders flat" about a tree that was fine — the same mistake
     * CLAUDE.md records about the side menu being measured in a window narrower than its own
     * breakpoint. Side placement is also the one Peter reads in.
     *
     * 1400px is above the 62rem breakpoint the placement needs, and the toggle is the page's own
     * control rather than an attribute set from outside — using the real control is what makes this
     * evidence about the shipped page.
     */
    const placed = await page.evaluate(
      `(() => { const b = document.querySelector(".navplace"); if (!b) return false; b.click(); return true; })()`
    );
    assert.ok(placed, "the page has no placement control, so the side menu cannot be reached");
    await page.waitFor(`document.documentElement.dataset.nav === "left"`, "the menu to dock to the side");
    await page.waitFor(
      `(() => { const n = document.querySelector("nav.scopes"); return !!n && getComputedStyle(n).display !== "none"; })()`,
      "the tree to become the menu"
    );
    /**
     * ⛔ COMPUTED STYLE AND GEOMETRY, NOT MARKUP. A markup assertion passes on a tree whose rows are
     * all `display:none` inside a collapsed group — which is exactly the state Peter kept reporting
     * as "the menu doesn't expand", and what the scope tree's own filter bug produced.
     */
    const seen = await page.evaluate(
      `(() => {
         const rows = [...document.querySelectorAll('li[data-subsystem]')];
         const vis = rows.filter((r) => r.getBoundingClientRect().height > 0);
         const cur = document.querySelector('li[data-subsystem="ledger"] a[aria-current="page"]');
         const parent = document.querySelector('li[data-subsystem="records"]');
         const child = document.querySelector('li[data-subsystem="ledger"]');
         return {
           rows: rows.length,
           visible: vis.length,
           marked: !!cur,
           nested: !!(parent && child && parent.contains(child)),
           indented: child ? getComputedStyle(child).getPropertyValue('--d').trim() : null,
         };
       })()`
    );
    assert.equal(seen.rows, 3, `the menu holds ${seen.rows} subsystem rows, expected 3`);
    assert.ok(seen.visible >= 3, `only ${seen.visible} of 3 rows have any height — the tree is collapsed or filtered away`);
    assert.ok(seen.marked, "the row for the page on screen is not marked current");
    assert.ok(seen.nested, "the child row is not inside the parent's element, so nothing can collapse");
    assert.equal(seen.indented, "1", `the nested row sits at depth ${seen.indented}, so the tree renders flat`);

    /** And pressing one goes there — the whole complaint was rows that led nowhere. */
    await page.evaluate(`document.querySelector('li[data-subsystem="clock"] a').click()`);
    await page.waitFor(`location.href.indexOf("/v2/subsystems/records/clock") > 0`, "the row to navigate");
    const landed = await page.evaluate(
      `(() => { const s = document.querySelector('#view-subsystems'); return { cards: s ? s.querySelectorAll('.subsys').length : -1 }; })()`
    );
    assert.equal(landed.cards, 1, `landing on one subsystem rendered ${landed.cards} cards`);
  } finally {
    await page.close();
    await stop();
  }
});
