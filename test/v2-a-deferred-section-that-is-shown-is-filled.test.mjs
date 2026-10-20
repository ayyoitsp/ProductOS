/**
 * ⛔ A DEFERRED SECTION THAT BECOMES VISIBLE IS FILLED, HOWEVER IT BECAME VISIBLE.
 *
 * Peter, driving the page: choosing **Product** left the body reading *"Loading this…"* and it never
 * resolved. Not slow — **nothing was ever fetched**. `GET /v2/product` answers 200, so the route was
 * fine and the request was simply never made.
 *
 * ⛔ THE CAUSE WAS A LIST OF ENTRY POINTS WHERE AN INVARIANT WAS MEANT. Three things triggered a
 * fill: a press on something carrying the menu's goto attribute, a hash change, and whatever was
 * already showing at boot. The tab row is a fourth way in and carries a different attribute, so
 * choosing an area revealed the stub and no code anywhere asked for its content.
 *
 * ⛔ AND IT IS THE ONE STATE THE ERROR HANDLING CANNOT REACH. The fill has a careful failure path —
 * it says what went wrong and offers "Try again" — but that only runs when a fetch was ATTEMPTED.
 * With no attempt there is no failure, so the page sat on the most misleading thing it could say:
 * a progress message for work that was not happening.
 *
 * So the trigger became the invariant — a deferred section that is visible gets filled — with the
 * entry points kept, because they fill BEFORE the switch and that is what stops a half-replaced
 * section flashing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/**
 * A page rendered with deferral on, so there are stubs to fill.
 *
 * ⛔ `only` IS WHAT DEFERS, and without it there are no stubs at all. The first version of this test
 * rendered the seed plainly and timed out waiting for a stub — reading as the feature being broken
 * when it was the fixture never reaching the state the feature is about. The server passes `only`
 * for a page this size; the seed is small enough that nothing would be deferred by default.
 */
function pageHtml() {
  const dir = path.join(temp("v2defer-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const root = c.scopes.find((e) => !e.scope.in).scope.id;
  const html =
    renderScopePage(c, root, { interactive: true, by: "peter", only: ["overview"] }) ?? "";
  /** ⛔ The fixture must actually hold stubs, or every assertion below is about nothing. */
  assert.match(html, /data-defer="/, "nothing was deferred, so there is no stub to reveal");
  return html;
}

test("⛔ a tab press asks for the section, not only a menu press", () => {
  /**
   * The structural half, and the one that names the defect: the delegated handler read the menu's
   * attribute alone. A tab is how most people reach a section at all.
   */
  const html = pageHtml();
  assert.match(
    html,
    /getAttribute\("data-goto"\) \|\| el\.getAttribute\("data-tab"\)/,
    "a tab press still asks for nothing, so choosing an area loads forever"
  );
});

test("⛔ and visibility itself triggers it, so the next new way in is already covered", () => {
  const html = pageHtml();
  assert.match(html, /MutationObserver/, "nothing watches for a section becoming visible");
  assert.match(
    html,
    /attributeFilter: \["hidden"\]/,
    "the watcher is not watching the attribute that makes a section visible"
  );
});

test("⛔ in a real browser: revealing a stub fetches it, and a stub nobody revealed does not", { skip }, async () => {
  /**
   * ⛔ BOTH HALVES. "It fetches" alone is satisfied by a page that fetches all 132 stubs at boot —
   * which would be the deferral removed, the opposite of the point, and would read as a fix.
   */
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('section.view[data-defer]')", "a deferred stub");

    const seen = await page.evaluate(`(async () => {
      /* Every request this page makes, captured — the question is which ones it makes. */
      window.__asked = [];
      window.fetch = (url) => {
        window.__asked.push(String(url));
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<section class="view" data-view="probe"><p id="arrived">it arrived</p></section>'),
        });
      };

      const stubs = [...document.querySelectorAll('section.view[data-defer]')];
      const total = stubs.length;
      const atBoot = window.__asked.length;

      /* Reveal one the way the frame does — by clearing hidden, which is all a tab switch does. */
      const one = stubs[0];
      const name = one.getAttribute('data-defer');
      one.hidden = false;
      await new Promise((r) => setTimeout(r, 80));

      return {
        total,
        atBoot,
        asked: window.__asked.length,
        forThisOne: window.__asked.some((u) => u.includes(encodeURIComponent(name)) || u.includes(name)),
        filled: !!document.getElementById('arrived'),
      };
    })()`);

    assert.ok(seen.total > 1, `this page has ${seen.total} stubs, so the many-stub case is untested`);
    /** ⛔ The half that keeps deferral honest: revealing one must not fetch the rest. */
    assert.equal(seen.atBoot, 0, "the page fetched sections before anything was revealed");
    assert.equal(seen.asked, 1, `revealing one stub asked for ${seen.asked} sections`);
    /** ⛔ And it asked for the right one, and put the answer on the page. */
    assert.equal(seen.forThisOne, true, "it fetched something, but not the section that was revealed");
    assert.equal(seen.filled, true, "the section was fetched and never replaced, so it still says Loading");
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: a stub that is never revealed stays a stub", { skip }, async () => {
  /**
   * The cost side of the same invariant. If watching visibility had been written as "fill
   * everything", the page would have paid for all 132 sections at load — and the test above would
   * still pass.
   */
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('section.view[data-defer]')", "a deferred stub");
    const seen = await page.evaluate(`(async () => {
      window.__asked = [];
      window.fetch = (url) => { window.__asked.push(String(url)); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }); };
      await new Promise((r) => setTimeout(r, 150));
      return { asked: window.__asked.length, stillStubs: document.querySelectorAll('section.view[data-defer]').length };
    })()`);
    assert.equal(seen.asked, 0, "the page fetched sections nobody asked to see");
    assert.ok(seen.stillStubs > 1, "the stubs were filled without being revealed");
  } finally {
    await page.close();
  }
});
