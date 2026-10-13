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
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "splits_on:",
      "  - id: line",
      "    asks: Which product line?",
      "  - id: role",
      "    asks: Which role?",
      "prototypes:",
      "  - id: cre-admin",
      "    title: CRE — admin",
      `    starts_at: ${views[0]}`,
      "    is:",
      "      line: CRE",
      "      role: admin",
      "  - id: pl-proc",
      "    title: Private lending — processor",
      `    starts_at: ${views[1] ?? views[0]}`,
      "    is:",
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
    await page.waitFor("!!document.querySelector('[data-sel-save]')", "the selection editor to be on the page");
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

test("⛔ pressing Save placements sends one prototype intent per row, with every axis", async (t) => {
  if (skip) return t.skip(skip);
  const sent = await inThePage(`
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
  /** ⛔ Both axes travel, which is the whole reason one axis was wrong. */
  const admin = posts.find((p) => p.body.id === "cre-admin");
  assert.ok(admin, "the first prototype was not sent");
  assert.deepEqual(admin.body.is, { line: "CRE", role: "admin" });
  /** ⛔ And the half-placed one sends its empty axis as empty rather than omitting it. */
  const proc = posts.find((p) => p.body.id === "pl-proc");
  assert.deepEqual(proc.body.is, { line: "private lending", role: "" });
});

test("⛔ a typed answer reaches the request — the inputs are the source, not the render", async (t) => {
  if (skip) return t.skip(skip);
  const sent = await inThePage(`
    const row = document.querySelector('[data-sel-proto="pl-proc"]');
    const roleInput = [...row.querySelectorAll('input')].find((i) => i.getAttribute('name') === 'role');
    roleInput.value = 'loan processor';
    document.querySelector('[data-sel-save]').click();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify(window.__sent);
  `);
  const proc = JSON.parse(sent).find((p) => p.body.id === "pl-proc");
  assert.deepEqual(proc.body.is, { line: "private lending", role: "loan processor" });
});

test("⛔ saving the axes sends them as a list, one per line", async (t) => {
  if (skip) return t.skip(skip);
  const sent = await inThePage(`
    const form = document.querySelector('form[data-sel-axes]');
    form.querySelector('textarea').value = 'Which product line?\\nWhich role?\\n\\nSigned in?';
    form.requestSubmit();
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify(window.__sent);
  `);
  const posts = JSON.parse(sent);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.intent, "splits-on");
  /**
   * ⛔ THE BLANK LINE IS DROPPED AND THE THIRD SURVIVES. This is the assertion the `\n` bug would
   * have failed: with the escape eaten, the string literal broke and the whole script died, so
   * nothing was sent at all.
   */
  assert.deepEqual(posts[0].body.axes, ["Which product line?", "Which role?", "Signed in?"]);
});

test("an empty axes box refuses locally and sends nothing", async (t) => {
  if (skip) return t.skip(skip);
  const sent = await inThePage(`
    const form = document.querySelector('form[data-sel-axes]');
    form.querySelector('textarea').value = '   \\n  ';
    form.requestSubmit();
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify({ sent: window.__sent, said: form.querySelector('.status').textContent });
  `);
  const { sent: posts, said } = JSON.parse(sent);
  assert.deepEqual(posts, [], "it posted an empty split");
  assert.match(said, /Say what they split on/);
});

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
