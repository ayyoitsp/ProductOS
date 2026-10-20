/**
 * ⛔ WHAT A PERSON SEES WHEN THEY OPEN A FEATURE — and what they saw before this.
 *
 * A usability review walked the Family Wallet corpus at 1440px and 390px and found the review
 * surface answering everything except the question somebody came with:
 *
 *   · the screen panel took the whole first viewport, about 900px of it blank under three small
 *     sketches, before any claim appeared — and "is this ready to build" was nowhere on the page
 *     at all, though the packet had known the answer since it was written
 *   · four yellow boxes saying "Nothing here says…" outnumbered the content of a new feature
 *   · cards were headed `money#record-spending#after` and rules printed `a-kid-sees-only-their-own`
 *     under the sentence — ids, in a project whose first rule is that the substrate stays out
 *   · the row actions were ✓, ✎ and a bin, unlabelled, on the one table that IS the review job
 *   · three counts disagreed: the tab said 21, the heading said 22, the sub-tab said 4
 *   · at 390px the page scrolled sideways and the behaviour table ran past its own right edge
 *
 * ⛔ MEASURED IN A REAL BROWSER, AT A WIDTH SET ON PURPOSE. Every claim here is about layout or
 * visibility, and neither exists in a string of HTML: a `details` that is closed, a panel collapsed
 * to zero, a table 88px wider than its box and a phone-width media query are all invisible to a
 * markup assertion and to any DOM emulator, which is how three defects in this file's history
 * shipped green.
 *
 * ⛔ AND 390 MEANS 390. Chrome floors a window at about 500px, so `--window-size=390` measures a
 * layout no phone ever sees. These set device metrics and assert `innerWidth` before asserting
 * anything about the layout — a measurement carries its conditions, and the width is the condition.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");
const { compilePacket, readinessOf } = await import("../dist/v2/packet.js");
const { actsFor } = await import("../dist/v2/grid.js");

function seed() {
  const dir = temp("v2lead-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], "the seed does not load");
  return c;
}

const corpus = seed();
/**
 * ⛔ THE FEATURE'S OWN PAGE, BECAUSE ONE ADDRESS RENDERS ONE PAGE NOW.
 *
 * This asked for the ROOT's page and then looked for the Money feature's readiness line, verdict
 * and claims inside it — which worked only while a page descended and carried a section for every
 * scope beneath it. That is the architecture Peter had removed: *"just loading data, rendering the
 * page we're on, no tree walking, nothing."* The root's page is now the root's.
 *
 * So these assertions move to where the feature actually lives. They are the same assertions.
 */
const FEATURE = "money";
const html = renderScopePage(corpus, FEATURE, {
  interactive: true,
  by: "a-person",
});

/** The product page, with the Money feature chosen, at an exact viewport. */
async function atWidth(width, probe, { height = 900, sub } = {}) {
  const page = await openPage(html, { exe, width: 1200, height: 900 });
  try {
    await page.resize(width, height);
    assert.equal(await page.evaluate("window.innerWidth"), width, `the viewport is not ${width}px`);
    await page.evaluate(`document.querySelector('[data-tab="money"]').click()`);
    await page.waitFor(`!document.querySelector('section.view[data-view="money"]').hidden`, "the Money view");
    if (sub) {
      await page.evaluate(`document.querySelector('.subtabs[data-tabs="money"] .subtab[data-sub="${sub}"]').click()`);
      await page.waitFor(
        `!document.querySelector('.sub-view[data-tabs="money"][data-sub-view="${sub}"]').hidden`,
        `the ${sub} sub-view`
      );
    }
    return await page.evaluate(`(() => { ${probe} })()`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// 11 · the decision, first

/**
 * ⛔ ONE ANSWER TO "IS THIS READY", NOT TWO.
 *
 * The packet has always printed *"This packet has 2 holes: …"* and the page printed nothing, so the
 * obvious repair was to count unsettled slots in the renderer — which is this project's most
 * frequent self-inflicted defect: two derivations of one verdict, drifting the first time `check`
 * changes its mind about what a hole is. This asserts the two surfaces say the same number, which
 * is false the moment anybody computes it twice.
 */
test("the page's readiness is the packet's readiness", () => {
  const banner = /This packet has (\d+) holes?:/.exec(compilePacket(corpus, "money"));
  assert.ok(banner, "the packet no longer states its holes, so there is nothing for the page to echo");
  const verdict = readinessOf(corpus, "money");
  assert.equal(verdict.holes.length, Number(banner[1]), "the structured verdict and the banner disagree");
  assert.equal(verdict.ready, false, "the seed's Money feature is ready to build, so nothing below is tested");

  /** ⛔ The page says the same number, in words, without a ref in sight. */
  const says = /<p class="verdict blocked">.*?(\d+) things? here/s.exec(html);
  assert.ok(says, "the feature does not lead with a readiness line");
  assert.equal(Number(says[1]), verdict.holes.length, "the page counts holes its own way");

  /** ⛔ And a feature with nothing undecided says so, so there is a failing state for the "no". */
  assert.match(html, /Ready to build: (yes|no)/, "no verdict is stated at all");
});

test("a hole is named by its sentence, never by its address", () => {
  const holes = /<ul class="verdict-holes">(.*?)<\/ul>/s.exec(html);
  assert.ok(holes, "the blocked verdict lists nothing");
  assert.ok(
    !/[a-z0-9]+#[a-z0-9-]+/.test(holes[1]),
    `the readiness list prints refs: ${holes[1]}`
  );
  /** ⛔ The behaviour's own title, which is the thing somebody can argue with. */
  assert.match(holes[1], /A parent records something a kid spent/, "the hole is not named by its behaviour");
});

test("⛔ in a real browser at 1440px: the verdict is above the screen panel and above every claim", { skip }, async () => {
  const seen = await atWidth(1440, `
    const view = document.querySelector('section.view[data-view="money"]');
    const y = (sel) => { const el = view.querySelector(sel); return el ? el.getBoundingClientRect().top + window.scrollY : null; };
    return {
      verdict: y('.verdict'),
      questions: y('.verdict-qs'),
      panel: y('.proto-frame'),
      firstClaim: y('.happy'),
      viewport: window.innerHeight,
    };
  `);
  assert.ok(seen.verdict !== null, "there is no readiness line on the feature");
  assert.ok(seen.questions !== null, "the open questions are not with it");
  assert.ok(seen.verdict < seen.panel, `the screen panel (${seen.panel}) still comes before the verdict (${seen.verdict})`);
  assert.ok(
    seen.questions < seen.firstClaim,
    `the open questions (${seen.questions}) sit below the first claim (${seen.firstClaim})`
  );
  /** ⛔ In the first screenful, which is the whole complaint — not merely in a better order. */
  assert.ok(
    seen.verdict < seen.viewport,
    `the verdict is ${Math.round(seen.verdict)}px down a ${seen.viewport}px viewport`
  );
  assert.ok(
    seen.firstClaim < seen.viewport * 2,
    `the first claim is ${Math.round(seen.firstClaim)}px down, still past the second screen`
  );
});

/**
 * ⛔ THREE DISTINGUISHABLE OUTCOMES, because "collapsed" has a remembered state and a zero is not a
 * check: nothing remembered collapses it, an explicit "off" collapses it, and a remembered height
 * opens it. A test that only saw the first cannot tell a default from a stylesheet that broke.
 */
test("⛔ in a real browser: the screen panel starts collapsed, and a reader's own choice still wins", { skip }, async () => {
  const page = await openPage(html, { exe, width: 1440, height: 900 });
  try {
    const h = () =>
      page.evaluate(
        `Math.round(parseFloat(getComputedStyle(document.querySelector('section.view[data-view="money"] .proto-scroll')).height))`
      );
    await page.evaluate(`document.querySelector('[data-tab="money"]').click()`);
    const fresh = await h();

    /** Pressing the control opens it, which is the state that used to be the default. */
    await page.evaluate(`document.querySelector('section.view[data-view="money"] .proto-hide').click()`);
    const pressed = await h();

    /** And a remembered height is honoured on the next load, rather than being overridden. */
    const remembered = await page.evaluate(`(() => {
      localStorage.setItem("productos:proto", "300");
      const root = document.documentElement;
      delete root.dataset.proto;
      const was = localStorage.getItem("productos:proto");
      if (was === "off" || was === null) root.dataset.proto = "off";
      else root.style.setProperty("--proto-h", Math.max(140, parseFloat(was)) + "px");
      return Math.round(parseFloat(getComputedStyle(document.querySelector('section.view[data-view="money"] .proto-scroll')).height));
    })()`);

    assert.equal(fresh, 0, `the panel opens at ${fresh}px for a reader who has never touched it`);
    assert.ok(pressed > 100, `pressing the control left the panel at ${pressed}px, so nothing can be opened`);
    assert.ok(remembered > 100, `a remembered height of 300px rendered as ${remembered}px — the default overrode a choice`);
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: an empty section is one closed line, not a block of yellow", { skip }, async () => {
  const seen = await atWidth(1440, `
    const view = document.querySelector('section.view[data-view="money"]');
    const shown = [...view.querySelectorAll('p.owes')].filter((p) => p.checkVisibility());
    const folds = [...view.querySelectorAll('details.owes-fold')];
    const open = folds[0];
    let afterOpening = 0;
    if (open) { open.open = true; afterOpening = [...view.querySelectorAll('p.owes')].filter((p) => p.checkVisibility()).length; }
    return { shown: shown.length, folds: folds.length, afterOpening, summary: open ? open.querySelector('summary').textContent.trim() : '' };
  `);
  assert.ok(seen.folds >= 2, `only ${seen.folds} empty sections are folded, so this feature is not the one with four`);
  assert.equal(seen.shown, 0, `${seen.shown} warning blocks are open on arrival`);
  /** ⛔ And the absence is still sayable — folded away is not deleted. */
  assert.equal(seen.afterOpening, 1, "opening the fold does not reveal what is missing");
  assert.match(seen.summary, /nothing written down/, "the closed line does not say the section is empty");
});

// ---------------------------------------------------------------------------
// 12 · no id reaches a reader

/**
 * ⛔ A ZERO WITH A FAILING STATE BESIDE IT. "No refs are visible" is also what a blank page
 * produces, so the same scan is run with the authoring fold open — where refs are deliberately kept,
 * because a builder is addressed there — and must find some. One matcher, two outcomes.
 */
test("⛔ in a real browser: no address reaches a reader, and the scan can still find one", { skip }, async () => {
  /**
   * ⛔ AND IT LOOKS FOR THE CORPUS'S OWN IDS, NOT ONLY FOR THE `a#b` SHAPE. A rule is filed under a
   * bare slug — `a-kid-sees-only-their-own` — so a pattern keyed on the `#` passed over the exact
   * leak the review reported. Found by putting that leak back and watching this stay green.
   */
  const ids = [
    ...corpus.rules.map((r) => r.rule.id),
    ...corpus.scopes.flatMap((s) => [s.scope.id, ...s.scope.exchanges.map((e) => e.id)]),
  ].filter((id) => id.includes("-"));
  assert.ok(ids.length > 3, "the corpus has no hyphenated ids, so a slug leak could not be detected");

  const page = await openPage(html, { exe, width: 1440, height: 900 });
  try {
    const scan = (openFolds) =>
      page.evaluate(`(() => {
        const ids = ${JSON.stringify(ids)};
        const want = { test: (s) => /\\b[a-z0-9]+(?:-[a-z0-9]+)*#[a-z0-9-]+/.test(s) || ids.some((id) => new RegExp("(^|[^a-z0-9-])" + id + "([^a-z0-9-]|$)").test(s)) };
        for (const v of document.querySelectorAll('section.view')) v.hidden = false;
        for (const v of document.querySelectorAll('.sub-view')) v.hidden = false;
        if (${openFolds}) for (const d of document.querySelectorAll('details')) d.open = true;
        const hits = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.checkVisibility()) continue;
          for (const n of el.childNodes)
            if (n.nodeType === 3 && want.test(n.textContent.trim()))
              hits.push(el.tagName + ' :: ' + n.textContent.trim().slice(0, 70));
          const t = el.getAttribute('title');
          if (t && want.test(t)) hits.push('[title] ' + el.tagName + ' :: ' + t.slice(0, 70));
        }
        return hits;
      })()`);

    const plain = await scan(false);
    assert.deepEqual(plain, [], `addresses are on the page as a reader finds it: ${JSON.stringify(plain.slice(0, 5))}`);

    const opened = await scan(true);
    assert.ok(
      opened.length > 0,
      "the scan found nothing even inside the authoring view, so it would pass on a page full of refs"
    );
  } finally {
    await page.close();
  }
});

test("a question card is headed by its kind, and the address is behind a button", () => {
  const card = /<article class="q"[^>]*>\s*<header>(.*?)<\/header>/s.exec(html);
  assert.ok(card, "there are no question cards to check");
  assert.ok(!/class="ref">/.test(card[1]), "the card is still headed by its ref");
  assert.match(card[1], /class="copy-ref" data-copy="[a-z0-9-]/, "the address is not reachable at all any more");
  /** ⛔ And a slot-grained card carries the whole address, which is the one somebody pastes. */
  assert.match(
    html,
    /class="copy-ref" data-copy="money#record-spending#after"/,
    "a slot question's address is not the one a builder would need"
  );
});

test("a rule no longer prints its slug under its sentence", () => {
  const rule = /<article class="beh group-rule[^"]*"[\s\S]*?<\/article>/.exec(html);
  assert.ok(rule, "the seed renders no group rule, so nothing here is tested");
  assert.ok(!/<code>[a-z0-9-]+<\/code>/.test(rule[0]), `the rule still prints its slug: ${rule[0].slice(0, 200)}`);
  assert.match(rule[0], /class="copy-ref"/, "the rule's address is not reachable at all any more");
});

// ---------------------------------------------------------------------------
// 13 · the buttons say what they do

test("⛔ in a real browser: every row action carries a word, not only a glyph", { skip }, async () => {
  const seen = await atWidth(1440, `
    const row = document.querySelector('section.view[data-view="money"] tr.beh .row-acts');
    if (!row) return { bailed: 'no behaviour row has actions' };
    return [...row.querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim());
  `, { sub: "behaviours" });
  assert.ok(!seen.bailed, seen.bailed);
  assert.deepEqual(seen, ["✓ Agree", "✎ Reword", "🗑 Remove"], "the row actions are not labelled");
});

// ---------------------------------------------------------------------------
// 14 · three counts, three names

/**
 * ⛔ THE FIX WAS THE NAMES, NOT THE ARITHMETIC — so this asserts the three stay DIFFERENT and that
 * each says what it is. Forcing them to one number would delete two true facts to make a third one
 * tidy, and a test demanding they agree would have required exactly that.
 */
test("the three counts on a feature each say what they are counting", () => {
  const scope = corpus.scopes.find((s) => s.scope.id === "money").scope;
  const behaviours = scope.exchanges.length;
  const unread = actsFor(corpus).written.filter((r) => r.startsWith("money#")).length;

  const heading = /<h3 class="sub">(\d+) sentences across (\d+) behaviours/.exec(html);
  assert.ok(heading, "the behaviour table's heading does not name what it counts");
  const sentences = Number(heading[1]);

  assert.equal(Number(heading[2]), behaviours, "the heading's behaviour count is not the feature's behaviours");
  assert.ok(sentences > behaviours, `${sentences} sentences across ${behaviours} behaviours is not the shape this is about`);
  assert.ok(unread < sentences, `${unread} unread of ${sentences} written — nothing distinguishes the two numbers`);

  /** The tab, which was the bare 21. */
  assert.match(
    html,
    new RegExp(`data-tab="money">[^<]*<span class="pill quiet"[^>]*aria-label="${unread} sentences nobody has read"[^>]*>${unread}<`),
    "the Money tab's count does not say what it counts"
  );
  /** The sub-tab, which was the honest one and now says so out loud. */
  assert.match(
    html,
    new RegExp(`data-sub="behaviours">Behaviors <span class="pill quiet" title="${behaviours} behaviours">${behaviours}<`),
    "the Behaviors sub-tab's count does not say what it counts"
  );
});

test("the queue opens on what is happening, not on how the model works", () => {
  assert.ok(!/Each reaches every behaviour its selector touches/.test(html), "the queue still opens in model language");
  assert.match(
    html,
    /<p class="lede"><strong>\d+<\/strong> questions? nobody has answered, blocking <strong>\d+<\/strong> behaviours? from being agreed\./,
    "the queue's opening line does not say what the questions are blocking"
  );
});

/**
 * ⛔ A ONE-CRUMB TRAIL IS THE HEADING SAID TWICE — "Money" in the crumb row and "Money" 37px below
 * it. The trail builder already drops the root for this reason and stopped one level short.
 *
 * ⛔ AND THE FIXTURE NESTS, so there is a failing state on both sides: a page with an ancestor must
 * still paint its trail. "The trail is empty" is also what a broken trail builder produces, and a
 * test that only saw the shallow case could not tell the two apart.
 */
test("⛔ in a real browser: a crumb that only repeats the heading is not painted", { skip }, async () => {
  const dir = temp("v2crumb2-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const base = fs.readFileSync(`${dir}/truth/money.md`, "utf-8");
  fs.writeFileSync(
    `${dir}/truth/pocket-money.md`,
    base.replace(/^id: money$/m, "id: pocket-money").replace(/^title: Money$/m, "title: Pocket money").replace(/^in: family-wallet$/m, "in: money")
  );
  const nested = loadCorpus(dir);
  assert.deepEqual(nested.broken, [], "the fixture does not load");
  /**
   * ⛔ ONE PAGE PER SCOPE, SO THE TRAIL IS READ ON EACH SCOPE'S OWN PAGE. This rendered the root's
   * page and clicked between the two features' sections inside it; a page carries only its own
   * scope now, so there was nothing to click to and the heading it looked for was another page's.
   *
   * ⛔ BOTH FAILING STATES SURVIVE THE MOVE, which is the only reason this is the same test: the
   * shallow page must paint NO trail (one crumb is the heading said twice) and the nested page MUST
   * paint one. An empty trail is also what a broken trail builder produces, so checking only the
   * shallow case could not tell a correct trail from no trail at all.
   */
  const read = async (scope, title) => {
    const html = renderScopePage(nested, scope, { interactive: true, by: "a-person" });
    const page = await openPage(html, { exe, width: 1440, height: 900 });
    try {
      /**
       * ⛔ A FILE RENDER HAS NO ADDRESS, SO NOTHING HAS ASKED FOR A SECTION YET. The trail is
       * painted by show(), and show() runs on a cold arrival at a URL — which a page opened from
       * disk never has. Pressing the row for this page's own scope is what a reader does and what
       * the served page does for them; without it this measured an unpainted trail and reported it
       * as a missing one.
       */
      await page.evaluate(`(document.querySelector('[data-goto="${scope}"]') || document.querySelector('[data-tab="${scope}"]')).click()`);
      return await page.evaluate(`(() => {
        const t = document.querySelector('.trail');
        const h = document.querySelector('section.view[data-view="${scope}"] .feature-title');
        return { trail: t ? t.textContent.trim() : null, heading: h ? h.textContent.trim() : null };
      })()`);
    } finally {
      await page.close();
    }
  };

  const shallow = await read("money");
  assert.equal(shallow.heading, "Money", "the feature's own heading is gone");
  assert.equal(shallow.trail, "", `the crumb row repeats the heading: "${shallow.trail}" over "${shallow.heading}"`);

  const nestedSeen = await read("pocket-money");
  assert.equal(nestedSeen.heading, "Pocket money");
  assert.ok(
    nestedSeen.trail.includes("Money"),
    `a page two levels down paints no trail at all ("${nestedSeen.trail}") — where it is filed is now unsayable`
  );
});

// ---------------------------------------------------------------------------
// 15 · a phone is a width somebody reviews at

for (const width of [390, 1440]) {
  test(`⛔ in a real browser at ${width}px: nothing runs off the side and nothing is cut off`, { skip }, async () => {
    const seen = await atWidth(width, `
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.checkVisibility()) continue;
        const b = el.getBoundingClientRect();
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
          bad.push('cut off: ' + el.tagName + '.' + String(el.className || '').slice(0, 40) +
            ' content ' + el.scrollWidth + 'px in a ' + el.clientWidth + 'px box');
        else if (b.width > 0 && b.right > window.innerWidth + 1)
          bad.push('past the edge: ' + el.tagName + '.' + String(el.className || '').slice(0, 40) +
            ' ends at ' + Math.round(b.right));
      }
      return { page: document.documentElement.scrollWidth, viewport: window.innerWidth, bad: bad.slice(0, 8), n: bad.length };
    `, { height: 844, sub: "behaviours" });

    assert.equal(
      seen.page,
      seen.viewport,
      `the page is ${seen.page}px wide in a ${seen.viewport}px window, so it scrolls sideways`
    );
    assert.equal(seen.n, 0, `${seen.n} things do not fit at ${width}px: ${JSON.stringify(seen.bad, null, 2)}`);
  });
}

test("⛔ in a real browser at 390px: every top tab is on screen", { skip }, async () => {
  const seen = await atWidth(390, `
    const tabs = [...document.querySelectorAll('.topframe .tabs .tab')].filter((t) => t.checkVisibility());
    const off = tabs.filter((t) => t.getBoundingClientRect().right > window.innerWidth + 1);
    return { n: tabs.length, off: off.map((t) => t.textContent.trim()), rows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size };
  `, { height: 844 });
  assert.ok(seen.n >= 4, `only ${seen.n} tabs are rendered, so a row that cannot fit is not being tested`);
  assert.deepEqual(seen.off, [], "tabs are off the right edge of the screen");
  assert.ok(seen.rows > 1, "the tab row still fits on one line at 390px, so wrapping is untested");
});
