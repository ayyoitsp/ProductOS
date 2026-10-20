/**
 * ⛔ CLICK A ROW, GET A URL, RELOAD THE URL, GET THE SAME PAGE — AND THE MENU STILL WORKS.
 *
 * Peter, four times across two days, about one defect:
 *
 *   · *"i load a page different than if I went to the menu and cliked through"*
 *   · *"uhm, this is much beter, but we should make sure the menu auto-expands."* → *"i just
 *     reloaded … menu did not expand...."* → *"now i reloaded and back to the original bug"*
 *   · *"menus not operable, in a shit state again"*
 *   · *"and why does the URL NO LONGER CHANGE AFTER I GO THROUGH THE MENU"*
 *
 * All four were one cause: a page descended into every scope beneath it and emitted a section for
 * each, so EVERY scope had two renderings — one as a section of an ancestor's document, one as the
 * landing of its own page — and a client-side router switched between them in place. Measured:
 *
 *     via the menu    data-view="rent-roll"     a section of the ANCESTOR's document
 *     the same URL    data-view="overview"      its own page's landing
 *
 * ⛔ THIS EXISTS BECAUSE THE FIX WENT IN THREE TIMES AND I REPORTED IT DONE TWICE. Each patch was
 * right about the case I had measured and wrong about the rest. Nothing drove the sequence, so
 * nothing could tell a fix from a fix-shaped change.
 *
 * ⛔ AND IT IS A SEQUENCE, NOT A STATE. Every single step passes on the broken build: the root page
 * renders, the deep URL serves, the menu has rows. What fails is clicking and then reloading and
 * comparing — which is exactly what a person does and what no assertion here did.
 *
 * ⛔ THREE LEVELS DEEP, BECAUSE `v2-seed` IS TWO AND TWO CANNOT EXPRESS THIS. Both of my earlier
 * "fixed" claims were measured against a corpus with no area-holding-an-area in it, and passed.
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { v2Route } = await import(path.resolve("dist/v2/serve.js"));

/** product → area → middle → leaf, where the leaf is the only one with anything to agree to. */
function nestedCorpus() {
  const dir = path.join(temp("v2one-"), "v2");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
  const w = (name, body) => fs.writeFileSync(path.join(dir, "truth", name + ".md"), body);

  w("whole", `---\nid: whole\ntitle: The Whole Thing\nexists: kept\n---\n\nEverything.\n`);
  w("area", `---\nid: area\ntitle: An Area\nin: whole\nexists: kept\n---\n\nAn area of the product.\n`);
  w("middle", `---\nid: middle\ntitle: A Middle Layer\nin: area\nexists: kept\n---\n\nAn area inside an area.\n`);
  w("sibling", `---\nid: sibling\ntitle: A Sibling\nin: area\nexists: kept\n---\n\nSomething else in the area.\n`);
  /**
   * ⛔ A SECOND TOP-LEVEL AREA, so "the tree narrows to the half you are in" has a failing state.
   * With one half everything belongs to it, narrowing hides nothing, and a filter that had been
   * switched off entirely would measure identically to a working one.
   */
  w("other", `---\nid: other\ntitle: Another Area\nin: whole\nexists: kept\n---\n\nA different half.\n`);
  w("far", `---\nid: far\ntitle: Something Far\nin: other\nexists: kept\n---\n\nInside the other half.\n`);

  const slots = {
    may: "Anybody signed in may do this.",
    with: "An amount and a reason.",
    answer: "It is done and the list shows it.",
    after: "The list has one more row.",
    fails: "A failure is reported rather than shown as nothing.",
    again: "A second press while the first is in flight does nothing.",
    at_once: "Two people doing this at once each see their own.",
  };
  w(
    "leaf",
    `---\nid: leaf\ntitle: The Leaf\nin: middle\nexists: kept\n` +
      `views:\n  - id: leaf-screen\n    title: The leaf's screen\n    view_kind: detail\n` +
      `    sketch_html: ${JSON.stringify('<div class="p-6"><h1 class="text-lg">The Leaf</h1></div>')}\n` +
      `    parts:\n      - id: go\n        role: navigates\n        label: Go\n        returns: true\n` +
      `exchanges:\n  - id: do-it\n    title: "Somebody does it"\n    asked_by: person\n` +
      `    at: { view: leaf-screen, part: go }\n    reads: []\n    changes: []\n    slots:\n` +
      Object.entries(slots)
        .map(([k, v]) => `      ${k}:\n        says: ${JSON.stringify(v)}`)
        .join("\n") +
      `\n---\n\nThe leaf.\n`
  );

  const corpus = loadCorpus(dir);
  assert.deepEqual(corpus.broken, [], `the fixture does not load: ${corpus.broken.map((b) => b.why).join(" | ")}`);
  return { dir, corpus };
}

async function serve(dir) {
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!(await v2Route(req, res, p, { dir }))) {
      res.writeHead(404);
      res.end("no");
    }
  });
  await new Promise((r) => server.listen(0, r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/**
 * ⛔ A FIRST ARRIVAL PAYS FOR BROWSER STARTUP, AND THE SUITE RUNS MANY AT ONCE. The harness default
 * of 15s is plenty for this file alone and not for this file inside a full run — one of these timed
 * out at 16.3s in the pack and passed 11/11 on its own, which is a flake that reads as a product
 * defect.
 */
const ARRIVAL = 60000;

const { dir, corpus } = nestedCorpus();
const { exe, skip } = browserOrSkip();

test("the fixture is three levels deep, or none of this measures anything", () => {
  const parentOf = (id) => corpus.scopes.find((x) => x.scope.id === id)?.scope.in;
  assert.equal(parentOf("leaf"), "middle");
  assert.equal(parentOf("middle"), "area");
  assert.equal(parentOf("area"), "whole");
  /** ⛔ v2-seed is two deep and both of my earlier fixes passed against it while the bug was live. */
  assert.equal(parentOf("whole"), undefined, "the chain does not reach a root");
});

/**
 * ⛔ THE GUARANTEE THE REST OF THIS FILE RESTS ON, asserted on its own so a failure says which half
 * broke: a served page holds a section for the scope it was served at, and for no other scope.
 */
test("a served page carries its own scope and nobody else's", async () => {
  const { base, close } = await serve(dir);
  try {
    const ids = corpus.scopes.map((s) => s.scope.id);
    for (const at of ["whole", "area", "middle", "leaf"]) {
      const page = await (await fetch(`${base}/v2/${at === "whole" ? "" : pathTo(at)}`)).text();
      const held = [...new Set([...page.matchAll(/data-view="([a-z-]+)"/g)].map((m) => m[1]).filter((v) => ids.includes(v)))];
      /**
       * ⛔ THE CORPUS ROOT IS THE ONE SCOPE WITH NO SECTION NAMED AFTER ITSELF, and that is not the
       * defect this file is about — it IS the Overview, which is what /v2 lands on, and giving it a
       * second section rendered its description under two headings. Every other scope renders as
       * itself; the root renders as Overview and the address resolver knows it.
       */
      assert.deepEqual(held, at === "whole" ? [] : [at], `the page served at ${at} holds ${held.join(", ") || "no scope section"}`);
      if (at === "whole") assert.match(page, /data-view="overview"/, "the root's page has no Overview either");
      /** ⛔ And the others are still REACHABLE, or scoping the page just deleted them. */
      for (const other of ids.filter((i) => i !== at && i !== "whole")) {
        assert.ok(page.includes(`data-goto="${other}"`), `${at}'s page cannot reach ${other}`);
      }
    }
  } finally {
    close();
  }
});

/**
 * ⛔ AND IT REACHES THE READER, WHICH IS NOT THE SAME CLAIM AS "THE SERVER RENDERED IT".
 *
 * Every assertion above passed, the instance served the corrected page in 1.3s, and Peter's own tab
 * went on showing the defect. The page was sent with NO cache headers — no Cache-Control, no ETag,
 * no Last-Modified — and a 200 with no freshness information and no validator is heuristically
 * cacheable, so his browser kept its pre-deploy copy. Measured in his browser: his document had
 * none of the new markers and still deferred feature sections.
 *
 * ⛔ The deploy is only how it announced itself. This corpus changes on every press, so a cacheable
 * page means a reviewer can agree to a sentence that has already been reworded with nothing on
 * screen saying so.
 */
test("a page of product truth is never cacheable", async () => {
  const { base, close } = await serve(dir);
  try {
    for (const at of ["", "/" + pathTo("leaf")]) {
      const r = await fetch(`${base}/v2${at}`);
      assert.equal(r.status, 200, `${at || "/v2"} did not serve`);
      const cc = r.headers.get("cache-control") ?? "";
      assert.match(cc, /no-store/, `${at || "/v2"} is cacheable: cache-control: ${JSON.stringify(cc)}`);
      /**
       * ⛔ And no validator, because a validator is what makes a conditional request possible and
       * there is nothing stable to validate against — the page is recomputed from the corpus.
       */
      assert.equal(r.headers.get("etag"), null, `${at || "/v2"} sends an ETag, so a browser may revalidate into a stale copy`);
    }
  } finally {
    close();
  }
});

/**
 * ⛔ THE TABS ARE NOT ALL HALVES OF THE PRODUCT, AND THE MENU MUST SURVIVE THE ONES THAT ARE NOT.
 *
 * Overview, the prototype board and What steers this are SECTIONS — no scope belongs to any of
 * them. The tree filter compared every row against the current section, so on all four it hid the
 * entire menu. Peter, standing on one of them: *"the menu is broken"*, and
 * *"i'm on another machine, looking at .../v2/prototype"*.
 *
 * ⛔ A PREVIOUS ROUND SPECIAL-CASED "overview" BY NAME AND LEFT ITS THREE SIBLINGS BROKEN, which is
 * why this drives all four rather than the one that was reported.
 */
for (const tab of ["prototype", "settings", "subsystems", "overview"]) {
  test(`/${tab}: a tab no scope belongs to still has a usable menu`, { skip }, async () => {
    const { base, close } = await serve(dir);
    const page = await openPage(null, { exe, url: `${base}/v2/${tab}`, width: 1440, height: 1000 });
    after(() => page.close());
    try {
      await page.waitFor(
        `document.readyState === "complete" && document.querySelectorAll("nav.scopes [data-goto]").length > 0`,
        `the ${tab} page to arrive`,
        ARRIVAL
      );
      await sideMenu(page);
      const seen = await page.evaluate(`(() => {
        const rows = [...document.querySelectorAll("nav.scopes li")].filter((li) => li.dataset.scope);
        const tree = document.querySelector("nav.scopes");
        return {
          rows: rows.length,
          hidden: rows.filter((li) => li.hidden).length,
          laidOut: rows.filter((li) => li.getClientRects().length > 0).length,
          treeHidden: tree ? tree.hidden : "no tree",
        };
      })()`);
      assert.ok(seen.rows > 0, `the ${tab} page renders no menu rows at all`);
      assert.equal(seen.hidden, 0, `${seen.hidden} of ${seen.rows} rows are hidden on /${tab} — no scope belongs to it, so there is no half to narrow to`);
      assert.equal(seen.treeHidden, false, `the tree is hidden on /${tab}, which down the side leaves a column with no way back to it`);
      assert.ok(seen.laidOut > 0, `every row on /${tab} is laid out nowhere`);
    } finally {
      close();
    }
  });
}

/**
 * ⛔ AND A REAL HALF STILL NARROWS, or the fix above is the filter switched off. Needs two halves in
 * the fixture to have a failing state at all.
 */
test("the tree still narrows to the half you are in", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2/${pathTo("area")}`, width: 1440, height: 1000 });
  after(() => page.close());
  try {
    await page.waitFor(
      `document.readyState === "complete" && document.querySelectorAll("nav.scopes [data-goto]").length > 0`,
      "the area page to arrive",
      ARRIVAL
    );
    await sideMenu(page);
    const seen = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll("nav.scopes li")].filter((li) => li.dataset.scope);
      return { total: rows.length, hidden: rows.filter((li) => li.hidden).map((li) => li.dataset.scope) };
    })()`);
    assert.ok(seen.hidden.length > 0, `standing in one half hid none of ${seen.total} rows — the filter does nothing`);
    /** The other half's rows are the ones that go, and this half's stay. */
    assert.ok(seen.hidden.includes("far"), `the other half's rows are still shown: hidden = ${JSON.stringify(seen.hidden)}`);
    assert.ok(!seen.hidden.includes("leaf"), `this half's own rows were hidden: ${JSON.stringify(seen.hidden)}`);
  } finally {
    close();
  }
});

/**
 * ⛔ TOP MODE IS WHAT THE PAGE SHIPS, AND IN TOP MODE THE TABS ARE THE WHOLE OF THE NAVIGATION.
 *
 * The tree is hidden up there, so every one of its links is 0x0 and a reader has only the tab row.
 * Product and Capabilities name SCOPES, whose sections a page no longer carries — so the switcher
 * could not find them, fell into its no-match branch and revealed every section at once, under an
 * address that never moved. No error, no navigation. Peter: *"hahahahahahaha so broken, can't even
 * get to a single page"*.
 *
 * ⛔ AND IT IS THE SAME OMISSION AS THE MENU ROW, IN THE MODE I TOLD TWO OTHER SESSIONS NOT TO
 * MEASURE. Driving side mode was right for what the previous change claimed, and it made the
 * default the one nobody looked at. Nothing is forced here.
 */
test("in the mode the page ships, a tab naming a scope goes there", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2`, width: 1440, height: 1000 });
  after(() => page.close());
  try {
    await page.waitFor(`document.readyState === "complete" && document.querySelectorAll("[data-tab]").length > 0`, "the tab row", ARRIVAL);

    /** ⛔ Non-vacuous on two counts: this really is top mode, and the tree really is unusable in it. */
    const mode = await page.evaluate(`(() => ({
      nav: document.documentElement.getAttribute("data-nav"),
      treeLinks: document.querySelectorAll("nav.scopes a[data-goto]").length,
      treeLinksWithBoxes: [...document.querySelectorAll("nav.scopes a[data-goto]")].filter((a) => a.getClientRects().length).length,
    }))()`);
    assert.notEqual(mode.nav, "left", "this is not the shipped mode, so it does not measure the shipped navigation");
    assert.ok(mode.treeLinks > 0, "there are no tree links at all, so their being unreachable proves nothing");
    assert.equal(mode.treeLinksWithBoxes, 0, "the tree is reachable in top mode, so the tabs are not the only way through");

    /** The tab for a scope this document does not hold — which is every scope tab now. */
    const tab = await page.evaluate(`(() => {
      const fixed = ["overview", "prototype", "settings", "subsystems"];
      const t = [...document.querySelectorAll("[data-tab]")].find((x) => !fixed.includes(x.dataset.tab));
      if (!t) return null;
      return { name: t.dataset.tab, held: !!document.querySelector('section.view[data-view="' + t.dataset.tab + '"]') };
    })()`);
    assert.ok(tab, "there is no tab naming a scope, so there is nothing to press");
    assert.equal(tab.held, false, `this page already holds ${tab.name}, so pressing its tab exercises no navigation`);

    const before = await page.evaluate("location.pathname");
    await page.evaluate(`document.querySelector('[data-tab="${tab.name}"]').click()`);
    await page.waitFor(
      `(() => { const s = document.querySelector('section.view[data-view="${tab.name}"]');
                return document.readyState === "complete" && !!s && !s.hidden; })()`,
      `the page for ${tab.name} to arrive`,
      ARRIVAL
    );

    const after = await page.evaluate(`(() => ({
      path: location.pathname,
      showing: [...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view),
    }))()`);
    assert.notEqual(after.path, before, `pressing the ${tab.name} tab left the address at ${after.path}`);
    assert.deepEqual(after.showing, [tab.name], `it showed ${JSON.stringify(after.showing)} — more than one means the no-match branch revealed everything`);
  } finally {
    close();
  }
});

/**
 * ⛔ AN ADDRESS MAY NAME A STATEMENT INSIDE A FEATURE, AND IT MUST KEEP SAYING WHICH.
 *
 * The last segment of …/leaf/do-it is an EXCHANGE, not a scope, so the server correctly serves the
 * owning scope's page — a statement has no page of its own. The defect was that arriving there
 * rewrote the address to the feature's, because show() wrote addressOf(view) over the top of it.
 * Reported from the live instance as the deepest level losing its last segment:
 * *"clicked …/see-a-fields-definition, landed …/define-a-field-the-product-reads"*.
 *
 * Paste the link, lose the link — the same class as the bug this file was opened for.
 */
test("an address naming a statement inside a feature keeps it", { skip }, async () => {
  const { base, close } = await serve(dir);
  const at = `${base}/v2/${pathTo("leaf")}/do-it`;
  const page = await openPage(null, { exe, url: at, width: 1440, height: 1000 });
  after(() => page.close());
  try {
    await page.waitFor(
      `(() => { const s = document.querySelector('section.view[data-view="leaf"]');
                return document.readyState === "complete" && !!s && !s.hidden; })()`,
      "the leaf's page to arrive",
      ARRIVAL
    );
    /** ⛔ Settle first: the rewrite this guards against happens during hydration, not before it. */
    await new Promise((r) => setTimeout(r, 1500));

    const seen = await page.evaluate(`(() => ({
      path: location.pathname,
      showing: [...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view),
      refOnPage: !![...document.querySelectorAll("[data-ref]")].find((x) => x.dataset.ref === "leaf#do-it"),
    }))()`);

    assert.deepEqual(seen.showing, ["leaf"], `a statement's address showed ${JSON.stringify(seen.showing)} rather than its feature`);
    /** ⛔ Non-vacuous: the statement has to actually be on that page, or there was nothing to keep. */
    assert.ok(seen.refOnPage, "the feature's page does not carry the statement the address names");
    assert.equal(
      seen.path,
      new URL(at).pathname,
      `the address was rewritten from ${new URL(at).pathname} to ${seen.path} — the statement it named is gone`
    );
  } finally {
    close();
  }
});

/** The menu path for a scope, which is what the renderer writes and what a reader bookmarks. */
function pathTo(id) {
  const trail = [];
  for (let at = id; at; at = corpus.scopes.find((x) => x.scope.id === at)?.scope.in) trail.unshift(at);
  return trail.slice(1).join("/");
}

/**
 * ⛔ THE WHOLE SEQUENCE, IN ONE TEST, BECAUSE THE DEFECT ONLY EXISTS BETWEEN THE STEPS.
 *
 * ⛔ AND IN THE SIDE MENU, WHICH IS A CONDITION AND NOT A DETAIL. Its rules live behind
 * :root[data-nav="left"], read from localStorage at boot, so a fresh profile is in TOP mode where
 * the tree is collapsed BY DESIGN — a correct page measures as broken there and a broken one as
 * correct. That is how I came to tell Peter twice that this was fixed.
 *
 * ⛔ SET AS THE ATTRIBUTE, NOT THROUGH localStorage. Writing the preference and reloading means
 * loading the page twice and racing the boot that reads it; worse, openPage returns before a
 * navigation commits, so the write lands on an opaque origin and throws SecurityError — which is a
 * harness failure that reads exactly like a broken menu. The stylesheet keys off the attribute, so
 * setting it on a document already on screen is the whole of what the layout needs.
 */
const sideMenu = async (page) => {
  /**
   * ⛔ AND THE CHROME HAS TO BE TOLD, NOT JUST THE STYLESHEET. Setting the attribute alone restyles
   * the frame and leaves the TREE as the boot laid it out in top mode — collapsed, because that is
   * correct up there — so the row was present, marked and open, and laid out nowhere. The page
   * already has a door for this: it re-reads its placement on a productos:nav event, which is what
   * the real control dispatches.
   */
  await page.evaluate(`(() => {
    try { localStorage.setItem("productos:nav", "left"); } catch (e) {}
    document.documentElement.dataset.nav = "left";
    window.dispatchEvent(new Event("productos:nav"));
  })()`);
  await page.waitFor(`getComputedStyle(document.querySelector(".topframe")).position === "fixed"`, "the side menu to take effect");
};
for (const target of ["leaf", "middle", "sibling"]) {
  test(`${target}: click the row, reload the URL, get the same page, menu still works`, { skip }, async () => {
    const { base, close } = await serve(dir);
    const settle = (page, name) =>
      page.waitFor(
        `(() => { const s = document.querySelector('section.view[data-view="${name}"]');
                  return document.readyState === "complete" && !!s && !s.hidden
                         && document.querySelectorAll("[data-goto]").length > 0; })()`,
        `the page for ${name} to be on screen`,
        ARRIVAL
      );
    const looking = `(() => {
      const vis = [...document.querySelectorAll("section.view")].filter((s) => !s.hidden);
      return { path: location.pathname, visible: vis.map((s) => s.dataset.view),
               heading: vis.map((s) => (s.querySelector("h1,h2,h3") || {}).textContent || "").map((t) => t.trim()) };
    })()`;

    /* ── the reader arrives at the root and presses the row ─────────────────── */
    const first = await openPage(null, { exe, url: `${base}/v2`, width: 1440, height: 1000 });
    let viaMenu, urlFromMenu;
    try {
      await settle(first, "overview");
      await sideMenu(first);

      /** ⛔ Non-vacuous: the destination must NOT already be in this document. */
      const alreadyHere = await first.evaluate(`Boolean(document.querySelector('section.view[data-view="${target}"]'))`);
      assert.ok(!alreadyHere, `the root's page already holds ${target}, so pressing it exercises no navigation`);

      const before = await first.evaluate("location.pathname");
      await first.evaluate(`document.querySelector('nav.scopes a[data-goto="${target}"]').click()`);
      await settle(first, target);
      viaMenu = await first.evaluate(looking);
      urlFromMenu = await first.evaluate("location.href");

      assert.notEqual(viaMenu.path, before, `pressing ${target} left the address at ${viaMenu.path}`);
      assert.deepEqual(viaMenu.visible, [target], `pressing ${target} showed ${JSON.stringify(viaMenu.visible)}`);
    } finally {
      await first.close();
    }

    /* ── and opens that same URL cold ───────────────────────────────────────── */
    const cold = await openPage(null, { exe, url: urlFromMenu, width: 1440, height: 1000 });
    after(() => cold.close());
    try {
      await settle(cold, target);
      await sideMenu(cold);
      const seen = await cold.evaluate(looking);

      /** ⛔ THE ONE THAT FAILS ON THE PREVIOUS BUILD — the menu showed one thing, the URL another. */
      assert.deepEqual(
        seen.visible,
        viaMenu.visible,
        `the menu showed ${JSON.stringify(viaMenu.visible)} and the same URL shows ${JSON.stringify(seen.visible)}`
      );
      assert.deepEqual(seen.heading, viaMenu.heading, "the same address shows different content depending on how you got there");
      assert.equal(seen.path, new URL(urlFromMenu).pathname, `a cold arrival rewrote the address to ${seen.path}`);

      /* ── the menu says where they are, and is open to it ──────────────────── */
      const menu = await cold.evaluate(`(() => {
        const row = document.querySelector('nav.scopes a[data-goto="${target}"]');
        if (!row) return { found: false };
        /* ⛔ ANCESTORS ONLY. The row's OWN li carries no "open" when it holds nothing — a leaf has
           nothing to expand — so including it reported every leaf as sitting in a shut container. */
        const shut = [];
        const own = row.closest("li");
        for (let p = own && own.parentElement ? own.parentElement.closest("li") : null; p;
             p = p.parentElement ? p.parentElement.closest("li") : null) {
          if (!p.classList.contains("open")) shut.push(p.dataset.scope || "?");
        }
        return { found: true, current: row.getAttribute("aria-current"),
                 boxes: row.getClientRects().length, shut };
      })()`);
      assert.ok(menu.found, `the cold page's menu has no row for ${target}`);
      assert.equal(menu.current, "page", "the row the reader is on is not marked, so nothing says where they are");
      assert.ok(menu.boxes > 0, `the row for ${target} is laid out nowhere — the menu did not open to it`);
      assert.deepEqual(menu.shut, [], `the row sits inside shut containers: ${menu.shut.join(", ")}`);

      /* ── and the menu still moves them, with the address following ────────── */
      const other = target === "sibling" ? "leaf" : "sibling";
      const was = await cold.evaluate("location.pathname");
      await cold.evaluate(`document.querySelector('nav.scopes a[data-goto="${other}"]').click()`);
      await settle(cold, other);
      const moved = await cold.evaluate(looking);
      assert.notEqual(moved.path, was, `pressing ${other} after a cold arrival left the address at ${moved.path}`);
      assert.deepEqual(moved.visible, [other], `it showed ${JSON.stringify(moved.visible)}`);
    } finally {
      close();
    }
  });
}
