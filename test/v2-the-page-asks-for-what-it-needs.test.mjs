/**
 * ⛔ THE PAGE SHIPPED 144 SECTIONS AND SHOWED ONE, AND EVERY DRAWING WAS ON THE WIRE FIVE TIMES.
 *
 * Peter: *"let's get this fixed… we should not be dumping everything in a single packet. we should
 * be loading in the appropriate information, like any other web app. this is ridiculous"*.
 *
 * Bilrost: 12 MB of stored truth rendered into one 49.8 MB document, 157s with 150s before the
 * first byte. Reproduced on a corpus built to that shape — 144 scopes, 9.4 MB stored → 57 MB — and
 * then taken apart into two separate causes:
 *
 *   · one drawing was emitted FIVE TIMES VERBATIM: once by the prototype tile and once by the flow
 *     map FOR EVERY ANCESTOR CONTAINER, because `renderGroupUx` runs per container and embeds every
 *     drawing beneath it. That is the superlinear term — 14.4x the scopes cost 21.4x the render.
 *   · 143 of 144 sections arrived hidden. `VIEW_SWITCH`'s `show()` sets `hidden` on all but one.
 *
 * ⛔ AND THE REVIEW SURFACE MUST NOT GET WORSE, which is the only real risk here and the thing
 * PT-0007 warned about: *a drawing nobody can see until they click is not reviewable*. So deferral
 * is per SECTION — already a press away — and thumbnails load ON SCROLL, the way any other web app
 * loads images. The tests below assert exactly that: what a reviewer does to see a thing is what it
 * was, and the thing is really there afterwards.
 *
 * ⛔ IN A REAL BROWSER, ASSERTING COMPUTED STYLE. A markup assertion would pass on a page whose
 * fetched section never hydrated — which is the whole failure mode of this change — and jsdom
 * implements neither `adoptedStyleSheets` nor a cascade, so it would pass on the opposite of the
 * truth. Same reasoning the harness itself records.
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { renderScopePage } = await import(path.resolve("dist/v2/page.js"));
const { v2Route } = await import(path.resolve("dist/v2/serve.js"));

/**
 * A corpus with several features, each with two drawn screens, nested under areas.
 *
 * ⛔ NESTED, because the duplication that mattered recurs with DEPTH — a flat corpus would have
 * shown one extra copy instead of one per ancestor, and the superlinear term would not appear.
 */
function corpusOfSize(n) {
  const dir = path.join(temp("v2defer-"), "v2");
  fs.mkdirSync(path.join(dir, "truth"), { recursive: true });

  const drawing = (scope, view) => {
    let h = `<div class="min-h-screen bg-slate-50"><header class="border-b bg-white px-6 py-4"><h1 class="text-lg font-semibold">${view}</h1></header><main class="p-6">`;
    for (let i = 0; i < 40; i++)
      h += `<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3"><span class="text-sm">Row ${i} of ${scope} ${view}</span></div>`;
    return h + `</main></div>`;
  };

  fs.writeFileSync(path.join(dir, "truth", "everything.md"), `---\nid: everything\ntitle: Everything\nexists: kept\n---\n\nThe lot.\n`);
  const areas = Math.max(1, Math.round(n / 3));
  for (let a = 0; a < areas; a++)
    fs.writeFileSync(path.join(dir, "truth", `part-${a}.md`), `---\nid: part-${a}\ntitle: Part ${a}\nin: everything\nexists: kept\n---\n\nAn area.\n`);

  for (let i = 0; i < n; i++) {
    const id = `thing-${i}`;
    const views = [0, 1]
      .map(
        (v) =>
          `  - id: ${id}-screen-${v}\n    title: Screen ${v} of thing ${i}\n    view_kind: ${v === 0 ? "detail" : "form"}\n` +
          `    sketch_html: ${JSON.stringify(drawing(id, `Screen ${v}`))}\n` +
          `    parts:\n      - id: go\n        role: navigates\n        label: Go\n        leads_to: ${id}-screen-${v === 0 ? 1 : 0}`
      )
      .join("\n");
    const slots = {
      may: "Anybody signed in may do this.",
      with: "An amount and a reason.",
      answer: "It is done and the list shows it.",
      after: "The list has one more row.",
      fails: "A failure is reported rather than shown as nothing.",
      again: "A second press while the first is in flight does nothing.",
      at_once: "Two people doing this at once each see their own.",
    };
    fs.writeFileSync(
      path.join(dir, "truth", `${id}.md`),
      `---\nid: ${id}\ntitle: Thing ${i}\nin: part-${i % areas}\nexists: kept\nviews:\n${views}\n` +
        `exchanges:\n  - id: do-it-${i}\n    title: ${JSON.stringify(`Somebody does it in thing ${i}`)}\n    asked_by: person\n` +
        `    at: { view: ${id}-screen-0, part: go }\n    reads: []\n    changes: []\n    slots:\n` +
        Object.entries(slots)
          .map(([k, v]) => `      ${k}:\n        says: ${JSON.stringify(v)}`)
          .join("\n") +
        `\n      refuses:\n        outcomes:\n          - name: not-a-number\n            when: the amount is not a number\n            told: that it has to be a number\n---\n\nThing ${i}.\n`
    );
  }
  const corpus = loadCorpus(dir);
  assert.equal(corpus.broken.length, 0, `the fixture does not load: ${corpus.broken.map((b) => b.why.split("\n")[0]).join(" | ")}`);
  return { dir, corpus };
}

/** The real route, over real HTTP — the page's own fetches need an origin. */
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

const { dir, corpus } = corpusOfSize(9);

test("the fixture is big enough and nested, or none of this measures anything", () => {
  assert.ok(corpus.scopes.length >= 12, `only ${corpus.scopes.length} scopes`);
  const drawn = corpus.scopes.flatMap((s) => s.scope.views ?? []).filter((v) => v.sketch_html);
  assert.ok(drawn.length >= 18, `only ${drawn.length} drawn screens`);
  /** ⛔ Depth is the point: a flat corpus would not exercise the per-ancestor copy at all. */
  assert.ok(
    corpus.scopes.some((s) => {
      const parent = corpus.scopes.find((x) => x.scope.id === s.scope.in);
      return parent?.scope.in;
    }),
    "nothing in the fixture is nested two deep, so the duplication that recurs with depth cannot appear"
  );
});

test("no thumbnail carries its own copy of a drawing — they all point at the one in the bank", () => {
  const html = renderScopePage(corpus, "everything", { interactive: true, records: "http", linkBase: "/v2" });

  /**
   * ⛔ WHAT THIS CHANGE CLAIMS, PRECISELY — and the first version of this test asserted something
   * else and failed honestly for it. A raw count of a drawing's bytes in the page is 3 here, and
   * correctly so: the screen's own section renders one STATE FRAME PER STATE, and in a fixture whose
   * drawing carries no `data-part` those frames come out byte-identical to each other. They are not
   * duplication — `pictureOf` composes a different picture per state against a real corpus — and
   * deleting them would delete product content while the number improved.
   *
   * The claim is narrower and checkable: the places that SHOW a screen somewhere else — the
   * prototype tiles and the flow map, the ones that recurred with nesting depth — carry no copy at
   * all. They name a drawing and clone it.
   */
  const tiles = [...html.matchAll(/<div class="proto-mock" data-mock(?:-lazy)?="([^"]+)"\s*>(\s*)<\/div>/g)];
  assert.ok(tiles.length > 10, `only ${tiles.length} thumbnails reference a drawing without carrying it`);

  /** ⛔ And none of them holds a template, which is the thing that used to be 36 kB each. */
  assert.ok(
    !/data-mock(?:-lazy)?="[^"]+"><template>/.test(html),
    "a thumbnail still embeds its own <template> — that is the copy this change removes"
  );

  /** The bank exists, and holds at most one entry per drawing. */
  assert.match(html, /<div id="mock-bank" hidden data-root="/, "there is no bank for the single copy to live in");
  const banked = [...html.matchAll(/<template data-mock="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(banked.length, new Set(banked).size, `the bank holds a duplicate: ${banked.length} entries, ${new Set(banked).size} distinct`);
});

test("the page a reader arrives at carries what they are looking at and not the rest", async () => {
  const { base, close } = await serve(dir);
  try {
    const r = await fetch(`${base}/v2`);
    const page = await r.text();
    const everything = renderScopePage(corpus, "everything", { interactive: true, records: "http", linkBase: "/v2" });

    assert.equal(r.status, 200);
    assert.ok(
      page.length * 3 < everything.length,
      `the served page is ${(page.length / 1024) | 0} kB against ${(everything.length / 1024) | 0} kB for everything — it is not deferring much`
    );

    /** ⛔ And the nav still names every one, or a stub is content that was silently dropped. */
    for (const id of ["thing-0", "thing-4", "thing-8"]) {
      assert.ok(page.includes(`data-goto="${id}"`), `the nav does not reach ${id}, so its section is unreachable`);
    }
    assert.match(page, /data-defer="/, "nothing was deferred, so this page is the old one");
  } finally {
    close();
  }
});

test("a view the server cannot render is a 404, not an empty section", async () => {
  const { base, close } = await serve(dir);
  try {
    const bad = await fetch(`${base}/api/v2/section?scope=everything&view=no-such-view`);
    assert.equal(bad.status, 404, "an unknown view answered something other than 404");
    const none = await fetch(`${base}/api/v2/mocks`);
    assert.equal(none.status, 400, "asking for no drawings answered something other than 400");
  } finally {
    close();
  }
});

/* ------------------------------------------------------------------ the browser */

const { exe, skip } = browserOrSkip();

test("switching to a deferred feature fills it in, and what arrives is really on the page", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2` });
  after(() => page.close());
  try {
    /** It starts as a stub with no content of its own. */
    const before = await page.evaluate(
      `(() => { const s = document.querySelector('section.view[data-defer="thing-4"]'); return s ? s.textContent.trim().slice(0, 40) : "NO STUB"; })()`
    );
    assert.notEqual(before, "NO STUB", "there is no deferred section to fill — the page did not defer");

    /** The ordinary way in: press the thing in the menu. */
    await page.evaluate(`document.querySelector('nav.scopes a[data-goto="thing-4"]').click()`);

    await page.waitFor(
      `(() => { const s = document.querySelector('section.view[data-view="thing-4"]'); return !!s && !s.hasAttribute("data-defer"); })()`,
      "the deferred section to be replaced by the real one"
    );

    /**
     * ⛔ COMPUTED STYLE, NOT MARKUP. A section inserted into the document and left `hidden`, or
     * inserted with no height, is markup that passes and a page that shows nothing — and that is
     * precisely what this change could break.
     */
      const shown = await page.evaluate(`(() => {
      const s = document.querySelector('section.view[data-view="thing-4"]');
      if (!s) return { why: "gone" };
      const cs = getComputedStyle(s);
      return { display: cs.display, visibility: cs.visibility, height: s.getBoundingClientRect().height, text: s.textContent.includes("Thing 4") };
    })()`);
    assert.notEqual(shown.display, "none", "the fetched section is in the document but display:none");
    assert.notEqual(shown.visibility, "hidden", "the fetched section is invisible");
    assert.ok(shown.height > 80, `the fetched section computes to ${shown.height}px tall — nothing is in it`);
    assert.ok(shown.text, "the fetched section does not name the feature it is for");

    /**
     * ⛔ ITS DRAWING IS IN A SHADOW ROOT, WHICH IS THE ONLY WAY A MOCK IS EVER VISIBLE — and the
     * host to look at is `div.proto.html`. The element carrying a `productos-mock` class is INSIDE
     * that shadow root, so a light-DOM query for it returns nothing; an earlier version of this
     * assertion looked for it and read the empty result as "nothing hydrated".
     *
     * This is also the assertion that caught the real bug in this change: `asMock` wraps every
     * screen in <template shadowrootmode="open">, which the PARSER turns into a shadow root and
     * `innerHTML` silently does not. The fetched section arrived byte-perfect and inert.
     */
    await page.waitFor(
      `(() => { const s = document.querySelector('section.view[data-view="thing-4"]'); if (!s) return false;
         return [...s.querySelectorAll("div.proto.html")].some((h) => h.shadowRoot && h.shadowRoot.childNodes.length); })()`,
      "the drawing inside the fetched section to hydrate"
    );

    /** ⛔ And it computes a box, because a shadow root full of unstyled nothing would also pass. */
    const row = await page.evaluate(`(() => {
      const s = document.querySelector('section.view[data-view="thing-4"]');
      const h = [...s.querySelectorAll("div.proto.html")].find((x) => x.shadowRoot);
      const r = h && h.shadowRoot.querySelector(".border-b");
      if (!r) return { why: "no row" };
      return { display: getComputedStyle(r).display, height: Math.round(r.getBoundingClientRect().height) };
    })()`);
    assert.ok(row.height > 4, `a row of the fetched drawing computes to ${JSON.stringify(row)} — it is in the DOM and not laid out`);
  } finally {
    close();
  }
});

/**
 * ⛔ GOING SOMEWHERE AND COMING BACK, BECAUSE ONE PRESS WORKS AND THAT IS WHY NOTHING CAUGHT THIS.
 *
 * Peter: *"I'm tapping on 'Versioned Inputs', which 'states nothing of its own'. it incorrectly
 * does not route anywhere. It should have its own page that's mostly blank, or lists its children,
 * should not just keep what is rendered on the screen"*.
 *
 * Everything a single press touches was correct: the nav emits an anchor, the anchor's target is on
 * the page, and `/api/v2/section` answers 200 with the container's own page — prose, and the list of
 * what is filed under it. Driven once on the live instance it routed perfectly. The defect needs a
 * SEQUENCE, and the test above is exactly one press long.
 *
 * `VIEW_SWITCH` captured every `section.view` ONCE at load. `fill()` REPLACES a deferred section
 * with a fresh element off the wire, so that list keeps the detached stub and has never heard of
 * what replaced it:
 *
 *   · navigating AWAY from a filled section never hides it — no entry to set `hidden` on, so it
 *     stays on screen underneath the next one
 *   · navigating BACK to it matches nothing, and the no-match branch un-hides EVERY view on the
 *     page — 130 sections at once on his corpus, which reads exactly like a press that did nothing
 *
 * ⛔ SO THE ASSERTION IS "EXACTLY ONE", NOT "THE RIGHT ONE IS SHOWING". The right one WAS showing
 * the whole time; what was wrong is everything else that was showing with it. An assertion on the
 * target alone passes on the bug.
 */
/**
 * ⛔ ONE SECTION IS SHOWING WHEN THE READER ARRIVES — AND THIS IS A GUARD ON THE SCRIPTS THEMSELVES.
 *
 * It looks like a triviality and it is the cheapest detector this page has for a script that DIED.
 * Every section is server-rendered visible and the switcher hides all but one on load, so if any
 * emitted script throws before that runs, the page arrives as one long scroll of everything.
 *
 * ⛔ AND "EVERY SCRIPT IS VALID JAVASCRIPT" CANNOT CATCH THAT, which is why this exists separately.
 * While fixing the routing above I changed `views` from an array to a function and missed the fifth
 * use of it — `views.find(...)`, 300 lines further down, past where I had grepped. That parses
 * perfectly; it is a TypeError at run time, and it killed the whole switcher. The parse guard was
 * green. What caught it was a DIFFERENT test's arithmetic about hidden sections, by accident.
 *
 * So the observable gets its own name: on arrival, exactly one.
 */
test("the reader arrives looking at exactly one section", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2`, width: 1440, height: 900 });
  after(() => page.close());
  try {
    await page.waitFor(
      `location.href.indexOf(${JSON.stringify(base)}) === 0 && document.readyState === "complete"`,
      "the page to finish loading"
    );
    /** ⛔ Non-vacuous: there have to be several, or "exactly one" is what a one-view page does anyway. */
    const total = await page.evaluate(`document.querySelectorAll("section.view").length`);
    assert.ok(total > 4, `the page has ${total} sections, so showing one proves nothing`);

    const showing = await page.evaluate(
      `[...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view || s.id)`
    );
    assert.deepEqual(
      showing,
      ["overview"],
      `${showing.length} of ${total} sections are showing on arrival — a script that hides the rest did not finish: ${JSON.stringify(showing.slice(0, 6))}`
    );
  } finally {
    close();
  }
});

test("going away from a filled section and back shows exactly it, both times", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2`, width: 1440, height: 900 });
  after(() => page.close());
  try {
    /**
     * ⛔ A CONTAINER, because that is what he was pressing and what states nothing of its own —
     * `part-0` has no exchanges, so its view is the listing of what is filed under it.
     */
    const showing = `[...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view)`;
    const press = (id) => page.evaluate(`document.querySelector('nav.scopes a[data-goto="${id}"]').click()`);
    const filled = (id) =>
      page.waitFor(
        `(() => { const s = document.querySelector('section.view[data-view="${id}"]'); return !!s && !s.hasAttribute("data-defer"); })()`,
        `the deferred section for ${id} to be filled`
      );

    /** ⛔ Non-vacuous: it has to have been DEFERRED, or this test is about a page that never split. */
    const wasStub = await page.evaluate(
      `Boolean(document.querySelector('section.view[data-defer="part-0"]'))`
    );
    assert.ok(wasStub, "part-0 was not deferred, so nothing here exercises the replacement at all");

    await press("part-0");
    await filled("part-0");
    const first = await page.evaluate(showing);
    assert.deepEqual(first, ["part-0"], `pressing the container left ${JSON.stringify(first)} showing`);

    /** ⛔ And it really is the container's page: the thing he said it should be. */
    const holds = await page.evaluate(`(() => {
      const s = document.querySelector('section.view[data-view="part-0"]');
      return { text: s.textContent.includes("What is filed under it"), kids: s.querySelectorAll("ul.contents a[data-goto]").length,
               height: Math.round(s.getBoundingClientRect().height) };
    })()`);
    assert.ok(holds.text, "the container's page does not say what is filed under it");
    assert.ok(holds.kids > 0, "the container's page lists none of its children");
    assert.ok(holds.height > 80, `the container's page computes to ${holds.height}px — nothing is in it`);

    /** Away. ⛔ THE ONE THAT FAILS ON THE PREVIOUS BUILD: the filled section is never hidden. */
    await press("thing-1");
    await filled("thing-1");
    const away = await page.evaluate(showing);
    assert.deepEqual(away, ["thing-1"], `navigating away left ${JSON.stringify(away)} showing at once`);

    /** And back. ⛔ The other half: a filled section matches nothing, so the page reveals all of it. */
    await press("part-0");
    const back = await page.evaluate(showing);
    assert.deepEqual(back, ["part-0"], `coming back left ${JSON.stringify(back)} showing at once`);
  } finally {
    close();
  }
});

test("a drawing arrives without anybody pressing for it, and what is unopened waits", { skip }, async () => {
  const { base, close } = await serve(dir);
  const page = await openPage(null, { exe, url: `${base}/v2` });
  after(() => page.close());
  try {
    /**
     * ⛔ THE SERVED BYTES CARRY NO DRAWING — asserted on the response, not on the DOM.
     *
     * An earlier version asserted the bank was empty in the browser and failed, and the code was
     * right: whatever is on screen when a reader arrives fetches its drawings immediately, which is
     * what loading on demand looks like when the demand is immediate. The byte claim is about what
     * the server sent.
     */
    const sent = await (await fetch(`${base}/v2`)).text();
    assert.equal(
      (sent.match(/<template data-mock=/g) || []).length,
      0,
      "the served page carried drawings in its markup — they are supposed to be fetched"
    );
    assert.ok((sent.match(/data-mock-lazy="/g) || []).length > 10, "nothing on the page is waiting for a drawing");

    /**
     * ⛔ NOBODY PRESSES ANYTHING IN THIS TEST. PT-0007's warning was that a drawing needing a press
     * is a worse review surface than the page had, so the test for it must not contain a press. The
     * reader arrived; that is all. What draws itself here is the walk's own stage, which asks for
     * the screen it opens on.
     */
    await page.waitFor(
      `[...document.querySelectorAll(".proto-mock")].some((h) => h.shadowRoot && h.shadowRoot.childNodes.length)`,
      "a drawing to be fetched and drawn with nobody pressing anything"
    );

    const drew = await page.evaluate(`(() => {
      const h = [...document.querySelectorAll(".proto-mock")].find((x) => x.shadowRoot && x.shadowRoot.childNodes.length);
      return { text: h.shadowRoot.textContent.replace(/\\s+/g, " ").trim().slice(0, 40), rows: h.shadowRoot.querySelectorAll(".border-b").length };
    })()`);
    /** ⛔ A real picture, not an empty root — the drawing's own words have to be in there. */
    assert.match(drew.text, /Row \d+ of/, `it hydrated with something that is not the drawing: ${JSON.stringify(drew)}`);
    assert.ok(drew.rows > 10, `only ${drew.rows} rows of the drawing arrived`);

    /** The bank holds what was drawn, once each however many places show it. */
    const banked = await page.evaluate(`[...document.querySelectorAll("#mock-bank template")].map((t) => t.getAttribute("data-mock"))`);
    assert.ok(banked.length > 0, "something was drawn and the bank is empty");
    assert.equal(banked.length, new Set(banked).size, `the bank holds duplicates: ${JSON.stringify(banked)}`);

    /**
     * ⛔ AND THE OTHER HALF: what nobody has opened has drawn nothing. Without this, "it arrives on
     * demand" would be satisfied by fetching all of it on arrival, which is the 49.8 MB page again
     * with extra steps.
     */
    const waiting = await page.evaluate(`(() => {
      const hidden = [...document.querySelectorAll("section.view")].filter((s) => s.hidden);
      let waited = 0, drawn = 0;
      for (const s of hidden) for (const h of s.querySelectorAll(".proto-mock")) {
        if (h.shadowRoot && h.shadowRoot.childNodes.length) drawn++; else waited++;
      }
      return { sections: hidden.length, waited, drawn, stubs: document.querySelectorAll("section.view[data-defer]").length };
    })()`);
    assert.ok(waiting.sections > 0, "no section is hidden, so nothing is being deferred at all");
    assert.ok(waiting.stubs > 0, "no section is still a stub — everything was fetched up front");
    assert.ok(
      waiting.waited > 0,
      `every thumbnail in every unopened panel had already drawn (${JSON.stringify(waiting)}) — nothing is waiting`
    );

    /**
     * ⛔ AND THE ROUTE EVERY UNPRESSED PATH GOES THROUGH, by name. The board's big view and the walk
     * both open screens a reader never scrolled past; this is what fetches those, and a thumbnail
     * coming into view uses the same endpoint.
     */
    const asked = await page.evaluate(`(async () => {
      const ref = document.querySelector("[data-mock-lazy]").getAttribute("data-mock-lazy");
      const before = document.querySelectorAll("#mock-bank template").length;
      const t = await window.__posEnsureMock(ref);
      return { ref, got: !!t, isTemplate: !!t && t.tagName === "TEMPLATE", named: !!t && t.getAttribute("data-mock") === ref,
               bytes: t ? t.innerHTML.length : 0, grew: document.querySelectorAll("#mock-bank template").length - before };
    })()`);
    assert.ok(asked.got && asked.isTemplate, `asking for ${asked.ref} did not return a drawing: ${JSON.stringify(asked)}`);
    assert.ok(asked.named, `the drawing that came back is not the one asked for: ${JSON.stringify(asked)}`);
    assert.ok(asked.bytes > 1000, `the drawing that came back is ${asked.bytes} bytes — too small to be one`);

    /** ⛔ Asking twice does not bank it twice; otherwise a walk through the product grows the page. */
    const again = await page.evaluate(`(async () => {
      const ref = document.querySelector("#mock-bank template").getAttribute("data-mock");
      const before = document.querySelectorAll("#mock-bank template").length;
      await window.__posEnsureMock(ref);
      return document.querySelectorAll("#mock-bank template").length - before;
    })()`);
    assert.equal(again, 0, "asking for a drawing already in the bank added another copy of it");
  } finally {
    close();
  }
});

/**
 * ⛔ EVERY SCRIPT THE PAGE EMITS MUST PARSE, AND THE BUILD CANNOT TELL YOU THAT.
 *
 * These scripts are TypeScript template literals, so their contents are a string to `tsc`. Writing
 * `await` inside a function I had not made `async` compiled perfectly and shipped a SyntaxError:
 * the browser discarded the ENTIRE script at parse time, so every mock on the page stayed an inert
 * template, the prototype's big view would not open, and nothing reported an error anywhere. It
 * took ten probes to find, and this finds it in a second.
 *
 * ⛔ COMPILED, NOT RUN. These scripts call into a document on purpose; running one here would fail
 * for reasons that are not defects. A SyntaxError is raised at compile time, which is the whole
 * class of bug this covers.
 *
 * ⛔ AND IT CATCHES THE OTHER TRAP IN THE SAME FILE. A backtick in a comment inside one of these
 * closes the literal — that one does break the build, five times in one session, which is how I know
 * to look. This asserts the emitted text is free of them, so the next person gets a named failure
 * instead of forty confusing TS1005s.
 */
test("every script the page emits is valid JavaScript", () => {
  const html = renderScopePage(corpus, "everything", { interactive: true, records: "http", linkBase: "/v2" });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  /** ⛔ Non-empty first: a page with no scripts would pass every assertion below. */
  assert.ok(scripts.length >= 5, `only found ${scripts.length} scripts on the page — this is looking in the wrong place`);

  for (const [i, src] of scripts.entries()) {
    if (!src.trim()) continue;
    const names = [...src.matchAll(/function ([a-zA-Z_$][\w$]*)/g)].map((m) => m[1]).slice(0, 3);
    const where = `script ${i + 1} of ${scripts.length}${names.length ? ` (defines ${names.join(", ")})` : ""}`;
    try {
      new vm.Script(src);
    } catch (e) {
      assert.fail(`${where} does not parse: ${e.message}\n${src.split("\n").slice(0, 3).join("\n")}`);
    }
    /**
     * ⛔ NO BACKTICK ASSERTION HERE, AND THE FIRST VERSION HAD ONE AND WAS WRONG. `liveScript` is
     * built with interpolation, so a backtick can legitimately reach the page inside a JSON string
     * — it flagged that immediately. And the case it was meant to catch cannot reach a test at all:
     * a backtick in one of these literals breaks the BUILD, which is how it announced itself five
     * times in one session. Parsing is the part the build cannot do.
     */
  }
});

/** ⛔ The same, for a fragment — it ships no scripts, and shipping one would be a second copy of them. */
test("a fetched section ships markup only, not another copy of the page's scripts", () => {
  const frag = renderScopePage(corpus, "everything", {
    interactive: true,
    records: "http",
    linkBase: "/v2",
    only: ["thing-3"],
    fragment: "thing-3",
  });
  assert.ok(frag, "no fragment came back for a view that exists");
  assert.equal(
    (frag.match(/<script>/g) || []).length,
    0,
    "a fetched section carries page scripts — they are already on the page, and running them twice rewires it"
  );
  assert.match(frag, /^<section class="view/, "a fragment should be the section itself");
});


/**
 * ⛔ A PAGE WITH NOWHERE TO FETCH FROM MAY NOT LEAVE ANYTHING TO BE FETCHED — and I nearly shipped
 * the opposite.
 *
 * Making every thumbnail lazy looked uniform and was wrong: `v2 page --out` wrote a file with 48
 * blank tiles, no drawings in it and no server to ask. A screen with no picture is a real defect in
 * this repo, and that is what a thumbnail which can never fill is.
 *
 * ⛔ FOUND BY RENDERING THE THREE MODES SIDE BY SIDE, which is the only way the difference shows.
 * Each one alone looks fine: the served page is small, the standalone page is complete, and the
 * published page is the standalone one. It is the COMPARISON that says which of them is lying.
 *
 * So the two wins are separated, because they need different things:
 *
 *   · ONE COPY PER DRAWING needs no server. Always on — that is where the 5x went.
 *   · FETCHING ON SCROLL needs an endpoint. Only on when the page is served.
 */
test("a page with no server carries its drawings; only the served one defers them", () => {
  const corpusDrawings = new Set();
  for (const s of corpus.scopes) for (const v of s.scope.views ?? []) if (v.sketch_html) corpusDrawings.add(`${s.scope.id}#${v.id}`);
  assert.ok(corpusDrawings.size > 8, `the fixture has only ${corpusDrawings.size} drawings`);

  const modes = {
    standalone: renderScopePage(corpus, "everything", {}),
    publishable: renderScopePage(corpus, "everything", { interactive: true, records: "mcp" }),
    served: renderScopePage(corpus, "everything", { interactive: true, records: "http", only: ["overview"] }),
  };

  for (const [name, html] of Object.entries(modes)) {
    const lazy = (html.match(/data-mock-lazy=/g) || []).length;
    const banked = (html.match(/<template data-mock=/g) || []).length;
    const canFetch = html.includes("__posEnsureMock = async function");

    if (name === "served") {
      assert.ok(lazy > 0, "the served page defers nothing — it is the old page");
      assert.ok(canFetch, "the served page has no way to fetch what it deferred");
      continue;
    }

    /** ⛔ The one that matters: nothing is waiting on a request this page cannot make. */
    assert.equal(lazy, 0, `${name} left ${lazy} thumbnails waiting for a server it does not have`);
    assert.equal(
      banked,
      corpusDrawings.size,
      `${name} carries ${banked} drawings for ${corpusDrawings.size} drawn screens — a thumbnail in it points at nothing`
    );

    /** ⛔ And every ref it points at is one it carries, which is the blank-tile failure stated exactly. */
    const wanted = new Set([...html.matchAll(/ data-mock="([^"]+)"/g)].map((m) => m[1]));
    const has = new Set([...html.matchAll(/<template data-mock="([^"]+)"/g)].map((m) => m[1]));
    const missing = [...wanted].filter((r) => !has.has(r));
    assert.deepEqual(missing, [], `${name} shows screens whose drawing is not on the page: ${missing.join(", ")}`);

    /** ⛔ Non-vacuous: something has to point at the bank, or "all refs resolve" is a claim about nothing. */
    assert.ok(wanted.size > 0, `${name} banks ${has.size} drawings and nothing points at them`);
  }

  /** ⛔ And deduplication is on in every mode — that half never needed a server. */
  for (const [name, html] of Object.entries(modes)) {
    assert.ok(
      !/data-mock(?:-lazy)?="[^"]+"><template>/.test(html),
      `${name} still embeds a drawing inside a thumbnail`
    );
  }
});
