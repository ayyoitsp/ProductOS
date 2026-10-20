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
        `the page for ${name} to be on screen`
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
