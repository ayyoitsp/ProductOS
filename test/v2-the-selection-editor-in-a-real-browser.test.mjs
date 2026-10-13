/**
 * ⛔ THE SELECTION EDITOR, DRIVEN IN A REAL BROWSER — BECAUSE PARSING IS NOT WORKING.
 *
 * Peter: *"I should be able to drive this from the listener/input, right??? why could you possibly
 * need this?"* So the split and each prototype's placement are set from the page, and the only
 * honest check of that is a browser pressing the button.
 *
 * ⛔ A PARSE TEST PASSED ON CODE THAT WAS DEFINITELY BROKEN, which is why this file exists beside
 * it. Fixing the `\n` escape, my edit deleted the `var asks = …` line itself — and
 * `v2-the-live-script-parses` stayed green, because a missing statement is not a syntax error. The
 * handler would have thrown `asks is not defined` on the first press. One test measures that the
 * script loads; only this one measures that pressing it does something.
 *
 * ⛔ NOTHING IS POSTED. `fetch` is replaced before the press, so this asserts what the handler SENDS
 * — the intent name and the body — without an instance. What the intent then does is covered by
 * `v2-prototype-selection`, against the real writer.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { loadCorpus } from "../dist/v2/load.js";
import { renderScopePage, standalone } from "../dist/v2/page.js";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

function corpus() {
  const dir = path.join(temp("v2seleditor-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const views = loadCorpus(dir).scopes.flatMap((e) => (e.scope.views ?? []).map((v) => `${e.scope.id}#${v.id}`));
  /**
   * ⛔ TWO DIMENSIONS WITH VALUES, AND ONE COMBINATION DELIBERATELY UNCOVERED. Peter: *"they should
   * be able to select the appropriate dimensions and that will bring up the right prototype"* — so
   * the fixture has to contain a combination that brings up NOTHING, or the selector could be wrong
   * about that case and every assertion would still pass.
   */
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "splits_on:",
      "  - id: role",
      "    asks: Role",
      "    values: [admin, loan processor]",
      "  - id: line",
      "    asks: Product line",
      "    values: [CRE, private lending]",
      "prototypes:",
      "  - id: cre-admin",
      "    title: CRE admin",
      `    starts_at: ${views[0]}`,
      "    is:",
      "      role: admin",
      "      line: CRE",
      "  - id: pl-proc",
      "    title: Private lending processor",
      `    starts_at: ${views[1] ?? views[0]}`,
      "    is:",
      "      role: loan processor",
      "      line: private lending",
      "",
    ].join("\n")
  );
  return dir;
}

function pageHtml() {
  const dir = corpus();
  const c = loadCorpus(dir);
  return standalone("selection", renderScopePage(c, c.scopes[0].scope.id, { interactive: true, by: "peter" }) ?? "");
}

/**
 * One page, with `fetch` captured. ⛔ Captured BEFORE the press and read after, because the handler
 * is async — asserting on a promise nobody awaited is how a green test says nothing.
 */
async function inThePage(ask) {
  const page = await openPage(pageHtml(), { exe });
  try {
    await page.waitFor("!!document.querySelector('[data-walk-dim]')", "the selector to be on the page");
    await page.evaluate(`(() => {
      window.__sent = [];
      window.fetch = (url, opts) => {
        window.__sent.push({ url, body: JSON.parse(opts.body) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, said: "saved" }) });
      };
      /** ⛔ The handler reloads on success, which would end the test. */
      window.location.reload = () => { window.__reloaded = true; };
      return true;
    })()`);
    return await page.evaluate(`(async () => { ${ask} })()`);
  } finally {
    await page.close();
  }
}

test("⛔ pressing Save placements sends one prototype intent per row, with every dimension", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * ⛔ THE DETAIL IS OPENED FIRST, because the grid is no longer on screen by default — that is the
   * change Peter asked for: *"wtf is this? ... seems like a barf of information"*. A test that
   * clicked blind would pass or fail for reasons unrelated to what it is about.
   *
   * ⛔ AND THE PLACEMENTS ARE SELECTS NOW, not text fields. A dimension that says what it can be
   * leaves nothing to type, and typing was how a prototype came to claim a value nobody could
   * select.
   */
  const sent = await inThePage(`
    document.querySelector('[data-sel-more]').click();
    document.querySelector('[data-sel-save]').click();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify(window.__sent);
  `);
  const posts = JSON.parse(sent);
  assert.equal(posts.length, 2, `expected one request per prototype, got ${posts.length}`);
  for (const p of posts) {
    assert.equal(p.url, "/api/v2/in", "it did not go through the one door");
    assert.equal(p.body.intent, "prototype");
    assert.ok(p.body.startsAt, "no front door was sent");
  }
  /** ⛔ Both dimensions travel, which is the whole reason one axis was wrong. */
  const admin = posts.find((p) => p.body.id === "cre-admin");
  assert.ok(admin, "the first prototype was not sent");
  assert.deepEqual(admin.body.is, { role: "admin", line: "CRE" });
  const proc = posts.find((p) => p.body.id === "pl-proc");
  assert.deepEqual(proc.body.is, { role: "loan processor", line: "private lending" });
});

test("⛔ a changed placement reaches the request — the controls are the source, not the render", async (t) => {
  if (skip) return t.skip(skip);
  const sent = await inThePage(`
    document.querySelector('[data-sel-more]').click();
    const row = document.querySelector('[data-sel-proto="pl-proc"]');
    const role = [...row.querySelectorAll('select')].find((i) => i.getAttribute('name') === 'role');
    role.value = 'admin';
    document.querySelector('[data-sel-save]').click();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify(window.__sent);
  `);
  const proc = JSON.parse(sent).find((p) => p.body.id === "pl-proc");
  assert.deepEqual(proc.body.is, { role: "admin", line: "private lending" });
});

/**
 * ⛔ TWO TESTS REMOVED HERE, DELIBERATELY, AND THIS NOTE IS WHY.
 *
 * They drove a textarea that took one dimension per line and asserted it refused an empty box.
 * Peter: *"why is there a separate input for 'say what these split on'? why doesn't this route
 * through the main interface? what is happening?"* — the textarea was a second place to type on a
 * page whose whole design is one composer plus editing things where they are. It is gone, so the
 * tests of it would now be testing a surface this project decided against.
 *
 * What replaced them, and is asserted below: the dimension's name and its values are the rows they
 * are displayed in, saved through the same one door, and the empty-row case is covered there.
 */

test("⛔ containment is said on the screen itself, through the same door", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * `v2 inside` shipped as a CLI command one hour after Peter said *"I should be able to drive this
   * from the listener/input"* — the same defect he had just corrected, written again. This is the
   * door: a select on each screen, every other screen offered, and the empty option takes it back.
   */
  const sent = await inThePage(`
    const rows = [...document.querySelectorAll('[data-inside]')];
    const row = rows[1];
    const sel = row.querySelector('select');
    /* The first real option — a screen other than this one. */
    sel.value = [...sel.options].map((o) => o.value).filter(Boolean)[0];
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify({ sent: window.__sent, controls: rows.length, options: sel.options.length });
  `);
  const { sent: posts, controls, options } = JSON.parse(sent);
  assert.ok(controls > 1, `only ${controls} screens carry the control`);
  assert.ok(options > 1, "the select offers nothing to be inside");
  assert.equal(posts.length, 1, "a change sent more or less than one request");
  assert.equal(posts[0].body.intent, "inside");
  assert.ok(posts[0].body.view, "it did not say which screen");
  assert.ok(posts[0].body.of, "it did not say what it is inside");
  assert.notEqual(posts[0].body.view, posts[0].body.of, "it offered the screen itself");
});

test("⛔ the empty option takes a containment back, rather than sending nothing", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * The half nobody could do before: `within` had no writer, so there was no way to UNSAY it either.
   * An empty value has to reach the intent — a handler that skipped it would make the control
   * one-way, and a reader would be unable to undo their own mistake.
   */
  const sent = await inThePage(`
    const row = [...document.querySelectorAll('[data-inside]')][0];
    const sel = row.querySelector('select');
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify(window.__sent);
  `);
  const posts = JSON.parse(sent);
  assert.equal(posts.length, 1, "clearing it sent nothing");
  assert.equal(posts[0].body.intent, "inside");
  assert.equal(posts[0].body.of, "", "it did not send the clearing");
});

test("⛔ pressing the values brings up the right prototype", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * Peter: *"they should be able to select the appropriate dimensions and that will bring up the
   * right prototype"*, then *"why is it a drop down?"* — so the values are visible chips, one row
   * per dimension, and pressing one is the act.
   *
   * ⛔ THE UNCOVERED COMBINATION IS THE ASSERTION THAT MATTERS. A selector that left the previous
   * prototype on screen when you asked for one that does not exist would be quietly lying about what
   * you had asked for, and every other assertion here would still pass.
   */
  const out = await inThePage(`
    const rows = [...document.querySelectorAll('[data-walk-dim]')];
    const press = (dim, value) => {
      const row = rows.find((r) => r.getAttribute('data-walk-dim') === dim);
      [...row.querySelectorAll('.wval')].find((b) => b.getAttribute('data-walk-val') === value).click();
    };
    const now = () => document.querySelector('[data-walk-now]').textContent.trim();
    const seen = { rows: rows.length, chips: rows.map((r) => r.querySelectorAll('.wval').length), start: now() };

    press('role', 'admin'); press('line', 'CRE');
    await new Promise((r) => setTimeout(r, 120));
    seen.creAdmin = now();

    press('role', 'loan processor'); press('line', 'private lending');
    await new Promise((r) => setTimeout(r, 120));
    seen.plProc = now();

    /* loan processor · CRE — nothing covers it */
    press('line', 'CRE');
    await new Promise((r) => setTimeout(r, 120));
    seen.uncovered = now();
    seen.uncoveredClass = document.querySelector('[data-walk-now]').className;
    /* ⛔ And exactly one chip chosen per row, never two. */
    seen.onPerRow = rows.map((r) => r.querySelectorAll('.wval.on').length);
    return JSON.stringify(seen);
  `);
  const seen = JSON.parse(out);
  assert.equal(seen.rows, 2, `expected one row per dimension, got ${seen.rows}`);
  assert.deepEqual(seen.chips, [2, 2], "the values are not all on the page");
  assert.equal(seen.creAdmin, "CRE admin");
  assert.equal(seen.plProc, "Private lending processor");
  assert.match(seen.uncovered, /nothing covers this/i, "an uncovered combination left the last prototype on screen");
  assert.match(seen.uncoveredClass, /none/, "an uncovered combination is not marked as one");
  assert.deepEqual(seen.onPerRow, [1, 1], "a dimension ended up with two values chosen at once");
});

test("⛔ a value nothing covers is visible before it is pressed", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * With dropdowns the only way to learn that a combination does not exist was to select it and be
   * told. The whole reason for showing the values is that the hole in the product is on the page.
   *
   * ⛔ THE FIXTURE HAS NO DEAD VALUE, DELIBERATELY: every value here appears in some prototype, so a
   * marker on any of them would be wrong. That is the assertion — a detector that dimmed everything
   * would pass a test that only looked for dimming somewhere.
   */
  const out = await inThePage(`
    const chips = [...document.querySelectorAll('.wval')];
    return JSON.stringify({
      total: chips.length,
      empty: chips.filter((c) => c.classList.contains('empty')).map((c) => c.getAttribute('data-walk-val')),
    });
  `);
  const { total, empty } = JSON.parse(out);
  assert.equal(total, 4, `expected four values across two dimensions, got ${total}`);
  assert.deepEqual(empty, [], "a value that some prototype covers was marked as covering nothing");
});

test("⛔ the detail is shut until asked for — one decision, not five blocks of text", async (t) => {
  if (skip) return t.skip(skip);
  const out = await inThePage(`
    const detail = document.querySelector('[data-sel-detail]');
    const more = document.querySelector('[data-sel-more]');
    const before = detail.hidden;
    if (more) { more.click(); await new Promise((r) => setTimeout(r, 60)); }
    return JSON.stringify({ before, after: detail.hidden, hasMore: !!more, label: more ? more.textContent : "" });
  `);
  const { before, after, hasMore, label } = JSON.parse(out);
  assert.equal(before, true, "the gaps and the dimension table are open by default");
  assert.ok(hasMore, "there is no way to see the detail");
  assert.equal(after, false, "asking for the detail did not open it");
  assert.match(label, /hide/, "the control does not say it will close again");
});

test("⛔ the dimensions and their values save from where they are shown", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * Peter: *"why is there a separate input for 'say what these split on'? why doesn't this route
   * through the main interface?"* — so there is no textarea. The dimension's name and its values are
   * the rows they are displayed in, and they go through the same one door.
   */
  const out = await inThePage(`
    document.querySelector('[data-sel-more]').click();
    const rows = [...document.querySelectorAll('[data-dim-row]')];
    const last = rows[rows.length - 1];
    last.querySelector('input[name="asks"]').value = 'Signed in?';
    last.querySelector('input[name="values"]').value = 'yes, no';
    document.querySelector('[data-dims-save]').click();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify({ sent: window.__sent, rows: rows.length });
  `);
  const { sent, rows } = JSON.parse(out);
  assert.equal(rows, 3, "there is no blank row to add a dimension in");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.intent, "splits-on");
  assert.equal(sent[0].body.axes.length, 3, "the existing dimensions were dropped");
  const added = sent[0].body.axes[2];
  assert.equal(added.asks, "Signed in?");
  assert.deepEqual(added.values, ["yes", "no"], "the values did not travel");
  /** ⛔ And the ones already there keep their values rather than being re-sent empty. */
  assert.deepEqual(sent[0].body.axes[0].values, ["admin", "loan processor"]);
});
