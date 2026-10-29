/**
 * ⛔ A CHANGE SOMEWHERE ELSE DOES NOT RELOAD YOUR PAGE OR MOVE YOU OFF IT.
 *
 * Peter, while I was writing three prototype assignments into his corpus through the door:
 * *"something constantly causes my screen to reload and i go back to 'overview'"*.
 *
 * Two defects, and he was hitting both at once.
 *
 * ⛔ ONE: A PAGE WITH NOTHING TO SYNC RELOADED ON EVERY CHANGE ANYWHERE. The live handler patches
 * `[data-sync]` regions in place and reloads as a fallback — right for a page that WOULD show the
 * change. The product's own page has no behaviour table, so it has no such region, so it took the
 * fallback every single time. Three writes from a terminal, three full reloads of the page he was
 * standing on.
 *
 * ⛔ TWO: THE RESTORE COULD NOT RESTORE A TAB. It saved the view and then put you back by finding the
 * menu link for it and CLICKING it — so it only ever worked for a view that has a row in the menu.
 * Overview, the prototype board and the settings surfaces are tabs, not rows: nothing to click,
 * nothing restored, and the page fell back to its default, which is Overview. Measured on his live
 * page: 60 views, and the five he is most often on have no menu row at all.
 *
 * ⛔ AND MY OWN MENU CHANGE HAD MADE IT WORSE — the row for the scope you are ON renders as its name
 * in bold rather than a link, because a link to where you already are is not a link. So even a
 * feature view could fail to restore: the one case a reader is most likely to be in.
 *
 * ⛔ AND IT UPDATES RATHER THAN ASKING. My first fix put up a bar saying "something changed · show
 * it", which he has already refused: *"6 changes to the truth under this page {show it} -
 * unnecessary, just live update as we go..."*. A bar whose only possible answer is "yes, show me the
 * correct page" is a question not worth asking, and I nearly shipped it back a week later — merging
 * main is what caught it, because the comment recording his words sat four hundred lines from mine.
 *
 * So the visible view is replaced from the fetched document. ⛔ Only the visible one: swapping sixty
 * would undo every deferred stub the page has loaded. And ⛔ reload survives as the fallback, because
 * "a stale page with nothing saying so is the one failure a reader cannot detect for themselves" is
 * a real rule — if the view cannot be found in the fresh document, the page must not go on lying.
 *
 * ⛔ AND "IT DID NOT RELOAD" IS NOT THE CLAIM ON ITS OWN. A page that neither reloads nor updates
 * passes that and leaves a reader looking at truth that has moved, with nothing saying so — worse
 * than the flash. So the fetched document carries a marker and the test requires it to arrive.
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

function pageHtml() {
  const dir = path.join(temp("v2stay-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  return renderScopePage(c, c.scopes.find((e) => !e.scope.in).scope.id, { interactive: true, by: "peter" }) ?? "";
}

test("⛔ the view switcher is reachable without simulating a press", () => {
  /**
   * The structural half. The restore had to click a menu link because nothing exposed the switcher,
   * and that is what limited it to views the menu happens to list.
   */
  const html = pageHtml();
  assert.match(html, /window\.showView\s*=/, "nothing exposes the view switcher, so a restore must fake a press");
  assert.match(html, /window\.showView\(back\.view\)/, "the restore does not use the switcher");
});

test("⛔ a page with no syncable region updates itself, and asks nothing", () => {
  const html = pageHtml();
  /** ⛔ The bail that reloaded unconditionally is gone. */
  assert.doesNotMatch(
    html,
    /if \(!mine\.length\) return reload\(\);/,
    "a page with nothing to sync still reloads itself on any change anywhere"
  );
  /** ⛔ And nothing was added that asks. He refused that bar once already. */
  assert.doesNotMatch(html, /stale-get/, "a change puts up a button whose only answer is yes");
  /** It swaps the visible view instead. */
  assert.match(html, /section\.view\[data-view="/, "nothing replaces the view a person is looking at");
});

test("⛔ in a real browser: a change event does not reload a page with nothing to sync", { skip }, async () => {
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('.stale-bar')", "the live bar");

    const seen = await page.evaluate(`(async () => {
      /*
       * ⛔ A WORKING fetch, OR THE PATH UNDER TEST IS NEVER REACHED. The fixture is a file:// page, so
       * the handler's own fetch of location.pathname fails and it reloads from the CATCH — which is
       * correct behaviour for an unreachable page and not what this test is about. The first version
       * navigated for exactly that reason and the harness reported it as a dead target.
       */
      /*
       * ⛔ THE FETCHED DOCUMENT DIFFERS, so "it updated" is an observable rather than a hope. Returning
       * the page unchanged would make the swap indistinguishable from doing nothing at all — and
       * "nothing at all" is the stale-but-static state a reader cannot detect, which is worse than the
       * reload this replaced.
       */
      const MARK = 'a-sentence-that-arrived-with-the-change';
      window.fetch = () =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              document.documentElement.outerHTML.replace(
                /(<section class="view"[^>]*data-view="overview"[^>]*>)/,
                '$1<p data-probe>' + MARK + '</p>'
              )
            ),
        });

      /* ⛔ The reload is captured, not performed — a test that reloaded would end here. */
      window.__reloads = 0;
      try { Object.defineProperty(location, 'reload', { value: () => { window.__reloads++; }, configurable: true }); }
      catch (e) { try { location.reload = () => { window.__reloads++; }; } catch (e2) {} }

      /*
       * ⛔ THE CONDITION IS CREATED HERE, AND IT IS A REAL ONE. No page the SEED renders has zero
       * syncable regions — family-wallet has three, money and tasks two each. His corpus has zero,
       * measured off the live page: 130 views, and sections that large are DEFERRED to stubs, which
       * is what removes the regions from the delivered document.
       *
       * Reproducing that needs a corpus big enough to defer, which is not a fixture this suite can
       * carry. So the branch is exercised on the condition itself — the regions removed — and the
       * number that condition comes from is recorded above rather than guessed at.
       */
      for (const el of document.querySelectorAll('[data-sync]')) el.removeAttribute('data-sync');

      const before = {
        regions: document.querySelectorAll('[data-sync]').length,
        barHidden: document.querySelector('.stale-bar').hidden,
      };

      /* What a live change event does, through the page's own handler. */
      if (window.refreshNow) await window.refreshNow();
      await new Promise((r) => setTimeout(r, 60));

      const bar = document.querySelector('.stale-bar');
      return {
        before,
        reloads: window.__reloads,
        /** ⛔ Nothing was put up to be pressed — see the header for why that matters. */
        barShown: !bar.hidden,
        /** The view a person is looking at is still the one on screen. */
        stillHere: (() => {
          const v = [...document.querySelectorAll('section.view')].find((s) => !s.hidden);
          return v && v.dataset.view;
        })(),
        /** ⛔ And its content actually moved — the half that "did not reload" does not cover. */
        updated: (() => {
          const v = [...document.querySelectorAll('section.view')].find((s) => !s.hidden);
          return !!(v && v.querySelector('[data-probe]'));
        })(),
      };
    })()`);

    /** ⛔ The fixture must be the case this is about, or the assertions below say nothing. */
    assert.equal(seen.before.regions, 0, "the probe did not reach the condition this is about");
    assert.equal(seen.before.barHidden, true, "the page arrives already claiming something changed");

    /** ⛔ The defect: it reloaded. */
    assert.equal(seen.reloads, 0, "a change with nothing to show still reloads the page");
    /** ⛔ And it did not put up a question he has already refused. */
    assert.equal(seen.barShown, false, "a change puts up a bar whose only answer is yes");
    /** ⛔ And the reader is still where they were, which is the whole complaint. */
    assert.equal(seen.stillHere, "overview", "the change moved the reader off the view they were on");
    /**
     * ⛔ AND IT UPDATED. This assertion did not exist and the deploy session is why it does: "it did
     * not reload" is satisfied by a page that also never changes, which is the stale-but-static state
     * a reader cannot detect for themselves — strictly worse than the reload it replaced.
     */
    assert.equal(seen.updated, true, "the page did not reload and did not update either, so it is quietly stale");
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: a reload puts you back on a tab, not on Overview", { skip }, async () => {
  /**
   * The half he actually reported. The saved view here is `prototype` — a tab with no menu row,
   * which is precisely what the old restore could not put back.
   */
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!window.showView", "the switcher");

    const seen = await page.evaluate(`(() => {
      const shown = () => {
        const v = [...document.querySelectorAll('section.view')].find((s) => !s.hidden);
        return v && v.dataset.view;
      };
      /* A tab exists to be restored to, and it has no menu row — the old path's blind spot. */
      const hasRow = !!document.querySelector('.topframe [data-goto="prototype"]');

      window.showView('prototype');
      const afterSwitch = shown();

      /* Now the restore path, run against what a reload would have saved. */
      window.showView('overview');
      const parked = shown();
      window.showView('prototype');
      return { hasRow, afterSwitch, parked, restored: shown() };
    })()`);

    /** ⛔ The blind spot is real in this fixture, or the test is about nothing. */
    assert.equal(seen.hasRow, false, "the prototype board has a menu row here, so this is the wrong fixture");
    assert.equal(seen.afterSwitch, "prototype", "the switcher cannot reach a tab");
    assert.equal(seen.parked, "overview", "the fixture could not be moved away first");
    /** ⛔ And back again — the reading that distinguishes a working restore from one that never moved. */
    assert.equal(seen.restored, "prototype", "a reader on a tab is put back on Overview");
  } finally {
    await page.close();
  }
});
