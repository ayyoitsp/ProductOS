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

/** Any screen that actually exists, whichever scope holds it. */
const aScreen = (dir) => {
  const c = loadCorpus(dir);
  const ref = c.scopes.flatMap((e) => (e.scope.views ?? []).map((v) => `${e.scope.id}#${v.id}`))[0];
  assert.ok(ref, "the seed has no screens, so a prototype could not open on one");
  return ref;
};

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
      /**
       * ⛔ A THIRD VALUE NOTHING COVERS, ON PURPOSE. The dimming assertion below used to say only
       * that nothing WAS dimmed — which proves the marker is not too wide and never proves it
       * fires. The deploying session's fixture happened to contain an uncovered combination and
       * produced the firing side by accident, which is the cheap way: a fixture where everything is
       * covered cannot test the uncovered path at all.
       */
      "    values: [admin, loan processor, auditor]",
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

test("⛔ the dropdowns are filters, and the prototypes carry chips", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * Peter, drawing it himself after I built three wrong ones: *"so the prototypes just has chips of
   * which dimension, e.g. role:admin. and the drop down selectors will be filters"*, and
   * *"Prototypes are shown by which dimensions they specify, with 'no dimensions' specified - they
   * can then assign it"*.
   *
   * ⛔ FILTERS, NOT A COORDINATE. I had built them as a coordinate resolving to one prototype, so a
   * combination nothing covered needed a special case and a reader saw one thing at a time. As
   * filters, "nothing covers this" is just an empty list — the same information with no mechanism.
   */
  const out = await inThePage(`
    const rows = () => [...document.querySelectorAll('[data-proto-row]')].filter((r) => !r.hidden);
    const sel = (dim) => document.querySelector('[data-walk-dim="' + dim + '"]');
    const pick = (dim, v) => { const s = sel(dim); s.value = v; s.dispatchEvent(new Event('change')); };
    const seen = { all: rows().length, dims: document.querySelectorAll('[data-walk-dim]').length };

    /* Every dimension starts on Any, so nothing is filtered out. */
    seen.anyFirst = [...sel('role').options][0].textContent.trim();

    pick('role', 'admin');
    await new Promise((r) => setTimeout(r, 80));
    seen.admin = rows().map((r) => r.getAttribute('data-proto-row'));

    pick('line', 'private lending');
    await new Promise((r) => setTimeout(r, 80));
    seen.adminPrivate = rows().map((r) => r.getAttribute('data-proto-row'));
    seen.emptyShown = !document.querySelector('[data-proto-empty]').hidden;
    seen.count = document.querySelector('[data-proto-count]').textContent.trim();

    /* Back to Any on both — the whole list returns. */
    pick('role', ''); pick('line', '');
    await new Promise((r) => setTimeout(r, 80));
    seen.back = rows().length;

    seen.chips = [...document.querySelectorAll('[data-proto-row] .pchip')].map((c) => c.textContent.trim());
    return JSON.stringify(seen);
  `);
  const seen = JSON.parse(out);
  assert.equal(seen.dims, 2, `expected one dropdown per dimension, got ${seen.dims}`);
  assert.equal(seen.anyFirst, "Any", "a filter does not default to matching everything");
  assert.equal(seen.all, 2, "the prototypes are not listed");
  assert.deepEqual(seen.admin, ["cre-admin"], "filtering by one dimension did not narrow the list");
  /** ⛔ A combination nothing covers is an EMPTY list, said out loud — no special case. */
  assert.deepEqual(seen.adminPrivate, [], "a combination nothing covers still listed a prototype");
  assert.equal(seen.emptyShown, true, "an empty result says nothing about itself");
  assert.equal(seen.count, "0");
  assert.equal(seen.back, 2, "clearing the filters did not bring the list back");
  /** ⛔ The chips say what each one specifies, in his words: role:admin. */
  assert.ok(seen.chips.includes("role:admin"), `chips were ${JSON.stringify(seen.chips)}`);
  assert.ok(seen.chips.includes("product line:CRE"), `chips were ${JSON.stringify(seen.chips)}`);
});

test("⛔ a prototype specifying nothing says so, and can be assigned from the list", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * *"with 'no dimensions' specified - they can then assign it"*. Hiding an unplaced prototype until
   * somebody placed it would hide the thing that needs doing — the same instinct as dimming a value
   * nothing covers rather than removing it.
   */
  const dir = corpus();
  const ref = aScreen(dir);
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "splits_on:",
      "  - id: role",
      "    asks: Role",
      "    values: [admin, loan processor]",
      "prototypes:",
      "  - id: placed",
      "    title: Placed one",
      `    starts_at: ${ref}`,
      "    is:",
      "      role: admin",
      "  - id: unplaced",
      "    title: Unplaced one",
      `    starts_at: ${ref}`,
      "",
    ].join("\n")
  );
  const c = loadCorpus(dir);
  const page = await openPage(
    standalone("rows", renderScopePage(c, c.scopes[0].scope.id, { interactive: true, by: "peter" }) ?? ""),
    { exe }
  );
  try {
    await page.waitFor("!!document.querySelector('[data-proto-row]')", "the prototype list");
    const out = await page.evaluate(`(() => {
      const row = document.querySelector('[data-proto-row="unplaced"]');
      const placed = document.querySelector('[data-proto-row="placed"]');
      return JSON.stringify({
        none: !!row.querySelector('[data-no-dims]'),
        noneText: row.querySelector('.pchip').textContent.trim(),
        assign: (row.querySelector('.prow-assign') || {}).textContent,
        placedChip: placed.querySelector('.pchip').textContent.trim(),
        placedAction: (placed.querySelector('.prow-assign') || {}).textContent,
      });
    })()`);
    const seen = JSON.parse(out);
    assert.equal(seen.none, true, "an unplaced prototype does not say it specifies nothing");
    assert.equal(seen.noneText, "no dimensions");
    assert.match(seen.assign ?? "", /assign/, "there is no way to assign it from the list");
    assert.equal(seen.placedChip, "role:admin");
    assert.match(seen.placedAction ?? "", /change/, "a placed one offers the same word as an unplaced one");
  } finally {
    await page.close();
  }
});

test("⛔ the assignment detail is shut until asked for", async (t) => {
  if (skip) return t.skip(skip);
  const out = await inThePage(`
    const detail = document.querySelector('[data-sel-detail]');
    const before = detail.hidden;
    document.querySelector('[data-sel-more]').click();
    await new Promise((r) => setTimeout(r, 60));
    return JSON.stringify({ before, after: detail.hidden });
  `);
  const { before, after } = JSON.parse(out);
  assert.equal(before, true, "the placement grid is open by default");
  assert.equal(after, false, "asking for it did not open it");
});

test("⛔ there is exactly one place to name a dimension", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * The old dimension table was left behind in the detail when the bar gained "Add a dimension",
   * and a test pointed at it. Two surfaces for one fact is two surfaces that have to agree about
   * what the dimensions are — a surface nobody removed is a surface somebody will use.
   */
  const out = await inThePage(`
    document.querySelector('[data-sel-more]').click();
    await new Promise((r) => setTimeout(r, 60));
    return JSON.stringify({
      forms: document.querySelectorAll('[data-dim-form]').length,
      saves: document.querySelectorAll('[data-dim-save]').length,
      oldTable: document.querySelectorAll('[data-dim-row]').length,
      oldSave: document.querySelectorAll('[data-dims-save]').length,
    });
  `);
  const seen = JSON.parse(out);
  assert.equal(seen.forms, 1, "there is not exactly one add-a-dimension form");
  assert.equal(seen.saves, 1);
  assert.equal(seen.oldTable, 0, "the old dimension table is still there");
  assert.equal(seen.oldSave, 0, "a second way to save dimensions is still there");
});

test("⛔ Add a dimension brings up the form, and saving it keeps the ones already named", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * Peter: *"Add a dimension brings up the form, saying dimension type, and values."*
   *
   * ⛔ AND THE EXISTING ONES TRAVEL. The intent replaces the whole list, so sending only the new
   * dimension would delete every one already named — the same tidying-away this surface has been
   * bitten by twice.
   */
  const out = await inThePage(`
    const form = document.querySelector('[data-dim-form]');
    const before = form.hidden;
    document.querySelector('[data-dim-add]').click();
    const opened = form.hidden;
    form.querySelector('input[name="asks"]').value = 'Signed in?';
    form.querySelector('input[name="values"]').value = 'yes, no';
    document.querySelector('[data-dim-save]').click();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify({ before, opened, sent: window.__sent });
  `);
  const { before, opened, sent } = JSON.parse(out);
  assert.equal(before, true, "the form is open before anybody asks for it");
  assert.equal(opened, false, "Add a dimension did not bring up the form");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.intent, "splits-on");
  assert.equal(sent[0].body.axes.length, 3, "saving a new dimension dropped the ones already named");
  assert.deepEqual(sent[0].body.axes[2], { id: "", asks: "Signed in?", values: ["yes", "no"] });
  /** ⛔ Including a value nothing uses — a save must not prune it, or the uncovered case vanishes. */
  assert.deepEqual(sent[0].body.axes[0].values, ["admin", "loan processor", "auditor"]);
});

test("⛔ choosing + add a value opens the form for that dimension, and does not filter on it", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * *"Each drop down has the ones we already have indexed, otherwise an option to add another."*
   *
   * ⛔ AND THE SENTINEL MUST NOT STICK. Leaving it selected would filter the list on a value that
   * does not exist — an empty list that looks like a finding and is an artefact of the control.
   */
  const out = await inThePage(`
    const sel = document.querySelector('[data-walk-dim="role"]');
    const was = sel.value;
    sel.value = '__add__';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 80));
    const form = document.querySelector('[data-dim-form]');
    return JSON.stringify({
      stuck: sel.value === '__add__',
      restored: sel.value === was,
      open: !form.hidden,
      asks: form.querySelector('input[name="asks"]').value,
      values: form.querySelector('input[name="values"]').value,
      rows: [...document.querySelectorAll('[data-proto-row]')].filter((r) => !r.hidden).length,
    });
  `);
  const seen = JSON.parse(out);
  assert.equal(seen.stuck, false, "the add-a-value sentinel stayed selected and is now filtering");
  assert.equal(seen.restored, true, "the dropdown did not go back to what it was");
  assert.equal(seen.open, true, "it did not bring up the form");
  assert.equal(seen.asks, "Role", "the form does not know which dimension it is adding to");
  assert.match(seen.values, /admin/, "the values already named were not carried in");
  assert.ok(seen.rows > 0, "the list is being filtered on a value that does not exist");
});

test("⛔ a dim: tag in the composer names a dimension — explicit, never inferred", async (t) => {
  if (skip) return t.skip(skip);
  /**
   * Peter: *"Adding dimensions are also available via the text input, right?"*
   *
   * Yes, through a TAG. This project already works this way for the pos: tag — *"The tag sets
   * Note.kind; nothing infers it. A classifier reading the sentence would be a guess wearing a
   * decision's clothes."* Parsing "add a dimension for role with admin and processor" out of prose
   * is exactly that classifier, writing product truth on a guess.
   *
   * ⛔ ONE SUBMIT PER PAGE, because the handler reloads on success at 700ms and a second submit after
   * that navigates the page out from under the test — which reports as "Inspected target navigated"
   * and names no assertion.
   */
  const out = await inThePage(`
    const bar = document.getElementById('note-bar');
    document.getElementById('note-text').value = 'dim: Signed in = yes, no';
    bar.requestSubmit();
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify(window.__sent);
  `);
  const sent = JSON.parse(out);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.intent, "splits-on", "a dim: tag did not name a dimension");
  const added = sent[0].body.axes[sent[0].body.axes.length - 1];
  assert.equal(added.asks, "Signed in");
  assert.deepEqual(added.values, ["yes", "no"]);
  /** ⛔ The ones already named travel, same as from the form. */
  assert.equal(sent[0].body.axes.length, 3, "the tag replaced the dimensions instead of adding one");
});

test("⛔ and ordinary prose is still a request, not an act", async (t) => {
  if (skip) return t.skip(skip);
  /** The second half of the tag rule: untagged text must not be treated as a command. */
  const out = await inThePage(`
    const bar = document.getElementById('note-bar');
    document.getElementById('note-text').value = 'the admin walk feels thin';
    bar.requestSubmit();
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify(window.__sent);
  `);
  const sent = JSON.parse(out);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.intent, "note", "an untagged sentence was treated as a command");
  assert.equal(sent[0].body.says, "the admin walk feels thin");
});
