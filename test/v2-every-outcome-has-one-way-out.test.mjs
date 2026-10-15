/**
 * ⛔ ONE WAY OUT, BECAUSE THERE IS ONE WAY IN.
 *
 * Peter: *"we need better error handling - we should just pass the response to a notification bar or
 * something... a generic 'out' way to message back to the user if it's not from the chat interface"*.
 *
 * He had been handed the raw answer, and before that "Not saved: Not Found" — an HTTP status line
 * standing in for an account of what happened. Every control formatted its own outcome into whatever
 * status span happened to sit beside it, so whether anything was said at all, and how much, depended
 * on which control you had pressed.
 *
 * ⛔ "IF IT'S NOT FROM THE CHAT INTERFACE" IS PART OF THE REQUIREMENT. The composer has a thread of
 * its own and answers there; the bar is for every other control on the page, which had nowhere to
 * answer. So this drives one of those — the prototype row's drop control, which goes through the
 * sender — and not the composer, whose own reporting is deliberately left alone.
 *
 * ⛔ AND IT IS DRIVEN IN A REAL BROWSER, because the bar is built and filled by the live script. The
 * three defects this harness exists for all lived in a browser and would all have passed a markup
 * assertion; and this script is a template literal inside TypeScript, where a stray escape has twice
 * killed every line of it while the compiler stayed clean.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { renderScopePage, standalone } = await import("../dist/v2/page.js");

/** The seed plus one placed prototype, so the board has a row with a control on it. */
function pageHtml() {
  const dir = path.join(temp("v2out-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const views = loadCorpus(dir).scopes.flatMap((e) => (e.scope.views ?? []).map((v) => `${e.scope.id}#${v.id}`));
  assert.ok(views.length, "the seed has no screens, so no prototype could be placed");
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    [
      "splits_on:",
      "  - id: role",
      "    label: Role",
      "    values: [admin, processor]",
      "prototypes:",
      "  - id: p1",
      "    title: One",
      `    starts_at: ${views[0]}`,
      "    is:",
      "      role: admin",
      "",
    ].join("\n")
  );
  const c = loadCorpus(dir);
  /**
   * ⛔ `interactive: true`, AND WRAPPED BY `standalone`. Without the flag the page renders with no
   * live script at all — so the first version of this test pressed a button that had no handler and
   * reported "nothing was announced", which looks exactly like the feature being broken.
   */
  const html = standalone("out", renderScopePage(c, c.scopes.find((s) => !s.scope.in).scope.id, { interactive: true, by: "peter" }) ?? "");
  /** ⛔ The control this test presses, and the sender it must reach, are both on the page. */
  assert.match(html, /data-sel-drop=/, "the fixture renders no control that sends anything");
  assert.match(html, /function announce\(out\)/, "the page carries no way out for an outcome to reach");
  return html;
}

/**
 * One page with `fetch` replaced, so the answer under test is the one this test chose, and a real
 * control pressed. Returns what the bar ended up holding.
 */
async function whenTheCorpusSays(reply, status = 200) {
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.getElementById('out') && !!document.querySelector('[data-sel-drop]')", "the bar and a control");
    return await page.evaluate(`(async () => {
      window.fetch = () => Promise.resolve({
        ok: ${status} < 400,
        status: ${status},
        statusText: ${JSON.stringify(status === 404 ? "Not Found" : "OK")},
        json: () => Promise.resolve(${reply === null ? "{}" : JSON.stringify(reply)}),
      });
      /** The success path reloads, which would end the test before it could read the bar. */
      window.location.reload = () => { window.__reloaded = true; };
      document.querySelector('[data-sel-drop]').click();
      await new Promise((r) => setTimeout(r, 80));
      const bar = document.getElementById('out');
      const note = bar.lastElementChild;
      return {
        notes: bar.children.length,
        tone: note ? note.className : null,
        head: note ? note.querySelector('strong').textContent : null,
        detail: note ? [...note.querySelectorAll('span:not(.outnote-x)')].map((s) => s.textContent) : [],
        dismissable: note ? !!note.querySelector('.outnote-x') : false,
        shown: getComputedStyle(bar).display,
      };
    })()`);
  } finally {
    await page.close();
  }
}

test("⛔ a refusal is announced, with its reason and its detail", { skip }, async () => {
  const seen = await whenTheCorpusSays({
    ok: false,
    why: 'no screen "org-loan-terms#org-loan-terms" in this corpus, so nothing can open on it',
    detail: ["that feature has: fannie-program-settings"],
  });
  assert.equal(seen.notes, 1, "nothing was announced at all");
  assert.match(seen.tone, /\bbad\b/, "a refusal is not marked as one");
  assert.match(seen.head, /no screen/, "the reason was not shown");
  assert.deepEqual(seen.detail, ["that feature has: fannie-program-settings"], "the detail was dropped");
  assert.equal(seen.dismissable, true, "a refusal cannot be dismissed, so it is on screen forever");
  assert.notEqual(seen.shown, "none", "the bar is not showing");
});

test("⛔ and so is a success, told apart from a refusal", { skip }, async () => {
  /**
   * The other half, and the one that makes the first mean something: a bar that rendered everything
   * the same way would be the original complaint again — an outcome he could not read at a glance.
   */
  const seen = await whenTheCorpusSays({ ok: true, said: "unplaced One", detail: [] });
  assert.equal(seen.notes, 1, "a success says nothing");
  assert.match(seen.tone, /\bok\b/, "a success is not marked as one");
  assert.doesNotMatch(seen.tone, /\bbad\b/, "a success is marked as a refusal");
  assert.match(seen.head, /unplaced One/, "what it did was not shown");
});

test("⛔ an HTTP failure becomes an outcome rather than a bare status line", { skip }, async () => {
  /**
   * This is the one he actually hit — *"Not saved: Not Found"*. A 404 carries none of the four
   * fields, so without this the bar announces nothing and the page reports two words of HTTP.
   */
  const seen = await whenTheCorpusSays(null, 404);
  assert.equal(seen.notes, 1, "a 404 was swallowed");
  assert.match(seen.tone, /\bbad\b/, "a 404 is not reported as a failure");
  assert.match(seen.head, /404/, "the status is not reported at all");
  assert.deepEqual(seen.detail, ["nothing was written"], "it does not say whether anything landed");
});

test("⛔ an instance that gives no answer at all is still announced", { skip }, async () => {
  /** A dropped connection produces no response, so the handler that announces never runs. */
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('[data-sel-drop]')", "a control");
    const seen = await page.evaluate(`(async () => {
      window.fetch = () => Promise.reject(new Error('Failed to fetch'));
      document.querySelector('[data-sel-drop]').click();
      await new Promise((r) => setTimeout(r, 80));
      const bar = document.getElementById('out');
      const note = bar.lastElementChild;
      return {
        notes: bar.children.length,
        head: note ? note.querySelector('strong').textContent : null,
        detail: note ? [...note.querySelectorAll('span:not(.outnote-x)')].map((s) => s.textContent) : [],
      };
    })()`);
    assert.equal(seen.notes, 1, "a dead instance reports nothing");
    assert.match(seen.head, /could not reach/, "it does not say what went wrong");
    assert.deepEqual(seen.detail, ["Failed to fetch"], "the underlying error was dropped");
  } finally {
    await page.close();
  }
});

test("⛔ announced once, not twice", { skip }, async () => {
  /**
   * The refusal path announces and then throws, so a `catch` that announced unconditionally would put
   * every refusal on screen twice — and the second copy would say "could not reach the corpus" about
   * an instance that had answered perfectly well.
   */
  const seen = await whenTheCorpusSays({ ok: false, why: "refused for a reason", detail: [] });
  assert.equal(seen.notes, 1, `the same outcome was announced ${seen.notes} times`);
});

test("⛔ the bar is empty and invisible until something happens", { skip }, async () => {
  /**
   * ⛔ A ZERO THAT HAS A FAILING STATE. On its own, "the bar holds nothing" is also what a page with
   * no bar at all produces — so it is asserted together with the element existing, and every test
   * above produces a one.
   */
  const page = await openPage(pageHtml(), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.getElementById('out')", "the bar");
    const seen = await page.evaluate(`(() => {
      const bar = document.getElementById('out');
      return { there: !!bar, notes: bar.children.length, shown: getComputedStyle(bar).display };
    })()`);
    assert.equal(seen.there, true, "the page has no notification bar");
    assert.equal(seen.notes, 0, "the bar is announcing something nobody did");
    assert.equal(seen.shown, "none", "an empty bar is taking up the corner of the screen");
  } finally {
    await page.close();
  }
});
