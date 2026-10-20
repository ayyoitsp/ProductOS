/**
 * ⛔ THE MENU OPENS TO THE ADDRESS YOU ARRIVED AT.
 *
 * Peter, after the landing fix: *"uhm, this is much beter, but we should make sure the menu
 * auto-expands."*
 *
 * He is right, and the previous fix did not do it — it only looked as though it had. That change
 * made a deep address land on the section it names; nothing was ever added that opens the branch
 * containing it. `openOnly` is called from exactly two places, a twisty click and a tab click, and
 * neither runs on boot. What a cold arrival shows is whatever `localStorage` remembered.
 *
 * ⛔ SO IT PASSED BY ACCIDENT ON A PROFILE WITH NOTHING COLLAPSED, which is what I measured and why
 * I reported it as working. The failing case is ordinary: `openOnly(name)` ADDS every other group
 * to the shut set, so merely opening Capabilities collapses Product — and from then on every deep
 * Product address arrives with its branch shut, the item invisible, the reader looking at a menu
 * that does not contain the page they are on.
 *
 * ⛔ THE COLLAPSED STATE IS SET BEFORE THE PAGE'S OWN SCRIPTS RUN, by injecting it ahead of them in
 * the served document. A second `openPage` would get a fresh profile and remember nothing, so the
 * state under test has to arrive with the page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage } = await import("../dist/v2/page.js");

const SHUT = "productos:nav-shut";

async function serving(html) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

/** Run before the page's own scripts, so the nav reads this as remembered state. */
const withShut = (html, groups) =>
  html.replace(
    /<head([^>]*)>/i,
    `<head$1><script>try{localStorage.setItem(${JSON.stringify(SHUT)},${JSON.stringify(
      JSON.stringify(groups),
    )})}catch(e){}</script>`,
  );

/**
 * A page whose tree has a row deep inside a collapsible group — the shape the defect needs.
 *
 * ⛔ Discovered from the rendered markup rather than hardcoded, because the seed's shape is not this
 * test's to assume and a hardcoded id silently stops testing anything the day it is renamed.
 */
function aRowInsideAGroup() {
  const corpus = loadCorpus("v2-seed");
  for (const { scope } of corpus.scopes) {
    const html = renderScopePage(corpus, scope.id, { linkBase: "" });
    const groups = [...html.matchAll(/data-group="([a-z0-9-]+)"/g)].map((m) => m[1]);
    /**
     * ⛔ A GROUP THAT IS ALSO A VIEW, ADDRESSED AT ITS OWN PATH.
     *
     * The first version looked for a tree row three segments deep and found none: the seed is one
     * level deep — its areas sit directly under the root — which `v2-the-breadcrumb-belongs-to-the-
     * page` already records as not enough for a trail. Both tests SKIPPED, and two skips prove
     * exactly nothing, which is the failure mode this project calls a zero with no failing state.
     *
     * The defect does not need depth. It needs a collapsed group and an address inside it, and
     * `/v2/<group>` is such an address at one level.
     */
    const group = groups.find((g) => /^[a-z0-9-]+$/.test(g) && g !== "overview" && g !== "prototype"
      && new RegExp(`data-view="${g}"`).test(html));
    if (group) return { html, group, path: `/v2/${group}`, scope: scope.id };
  }
  return null;
}

test("⛔ arriving at a deep address opens the branch that holds it", async (t) => {
  if (skip) return t.skip(skip);
  const found = aRowInsideAGroup();
  if (!found) return t.skip("no page in the seed has a collapsible group that is also one of its views");

  const { port, close } = await serving(withShut(found.html, [found.group]));
  try {
    const page = await openPage(null, { exe, url: `http://127.0.0.1:${port}${found.path}`, width: 1400 });
    try {
      /** ⛔ The class the nav itself paints, so this asserts what a reader sees and not an intention. */
      const stillShut = await page.evaluate(
        `!!document.querySelector('.tabgroup[data-group=${JSON.stringify(found.group)}].shut')`,
      );
      assert.equal(
        stillShut,
        false,
        `the address names something inside "${found.group}" and that branch arrived collapsed — the reader is looking at a menu that does not contain the page they are on`,
      );
    } finally {
      await page.close();
    }
  } finally {
    await close();
  }
});

test("a branch the address says nothing about is left as the reader left it", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * ⛔ THE OTHER HALF, AND THE REASON THIS IS NOT "OPEN EVERYTHING ON LOAD". Collapsing a group is
   * how somebody says they are not working in it today, and a boot that reopened all of them would
   * make the control pointless — which is the behaviour `paintGroups` was written to preserve.
   */
  const found = aRowInsideAGroup();
  if (!found) return t.skip("no page in the seed has a collapsible group that is also one of its views");

  const others = [...found.html.matchAll(/<div class="tabgroup" data-group="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((g) => g !== found.group);
  if (!others.length) return t.skip("the page has only one group, so there is no bystander to check");

  const { port, close } = await serving(withShut(found.html, [found.group, others[0]]));
  try {
    const page = await openPage(null, { exe, url: `http://127.0.0.1:${port}${found.path}`, width: 1400 });
    try {
      const bystanderShut = await page.evaluate(
        `!!document.querySelector('.tabgroup[data-group=${JSON.stringify(others[0])}].shut')`,
      );
      assert.equal(
        bystanderShut,
        true,
        `"${others[0]}" was collapsed and the address says nothing about it, but it was reopened — collapsing a group has to mean something after a reload`,
      );
    } finally {
      await page.close();
    }
  } finally {
    await close();
  }
});
