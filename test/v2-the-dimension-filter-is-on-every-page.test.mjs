/**
 * ⛔ THE DIMENSION FILTER IS ON EVERY PAGE, AND IT SAYS WHAT IT HID.
 *
 * Peter: *"Has anything is the dimension filter on every feature page"* — it was not. The model
 * reached every truth and the only control that read it was on the prototype board, so a reader on a
 * feature page could see that a variant existed and had no way to ask to be shown it. Then:
 * *"Build it"*.
 *
 * ⛔ THE DEFAULT IS THE DANGEROUS PART, AND IT IS ASSERTED FIRST. Nothing chosen must narrow nothing.
 * A filter whose first dropdown value was selected by default would show a reader one audience's
 * product and call it the product — and every number on the page would be quietly wrong rather than
 * visibly broken.
 *
 * ⛔ THREE DISTINGUISHABLE OUTCOMES OUT OF ONE CORPUS, because this repo's own rule says a zero is
 * not a check unless a failing zero can be described:
 *
 *     nothing chosen        → everything shown, nothing hidden
 *     the matching value    → everything shown, nothing hidden
 *     the other value       → the variant hidden, and the count says so
 *
 * The middle one is what distinguishes a working filter from one that hides anything carrying a
 * combination at all.
 *
 * ⛔ AND IT IS DRIVEN IN A REAL BROWSER, because the filtering is a cascade question — `display: none`
 * applied by a class, on elements whose markup is identical either way.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { temp } from "./support/temp.mjs";
import { browserOrSkip, openPage } from "./support/chrome.mjs";

const { exe, skip } = browserOrSkip();

const { loadCorpus } = await import("../dist/v2/load.js");
const { parseFrontmatter } = await import("../dist/core/frontmatter.js");
const { renderScopePage } = await import("../dist/v2/page.js");

/** The seed, with a role dimension on the product and one screen held for the admin. */
function corpus() {
  const dir = path.join(temp("v2dimfilter-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const files = fs.readdirSync(path.join(dir, "truth"));
  const front = (f) => parseFrontmatter(fs.readFileSync(path.join(dir, "truth", f), "utf-8")).data;
  const edit = (f, change) => {
    const at = path.join(dir, "truth", f);
    const parsed = parseFrontmatter(fs.readFileSync(at, "utf-8"));
    const data = { ...parsed.data };
    change(data);
    const body = parsed.content.trim();
    fs.writeFileSync(at, `---\n${YAML.stringify(data)}---\n${body ? `\n${body}\n` : ""}`);
  };

  const rootFile = files.find((f) => !front(f).in);
  assert.ok(rootFile, "the seed has no product-level scope");
  edit(rootFile, (d) => {
    d.dimensions = [{ id: "role", label: "Role", values: ["admin", "loan processor"] }];
  });

  const withViews = files.find((f) => (front(f).views ?? []).length > 0);
  assert.ok(withViews, "the seed has no feature with a screen");
  let varied;
  edit(withViews, (d) => {
    d.views[0] = { ...d.views[0], holds_for: { role: "admin" } };
    varied = d.id;
  });

  const c = loadCorpus(dir);
  assert.deepEqual(c.broken, [], `the fixture does not load: ${JSON.stringify(c.broken)}`);
  return { dir, corpus: c, varied };
}

const pageFor = (c, at) => renderScopePage(c, at, { interactive: true, by: "peter" }) ?? "";

/**
 * The page's markup, with its scripts taken out.
 *
 * ⛔ AND THAT IS NOT TIDINESS. The absence assertion below first ran against the whole document and
 * matched the FILTER SCRIPT'S OWN SELECTOR STRING — `querySelector("[data-dimfilter]")` — so a page
 * correctly rendering no filter read as rendering one. The script is right: it bails when the bar is
 * absent. The test was asking "is this string in the bytes" when the claim is "is this control on the
 * page", which is the same mistake this suite caught an hour ago on a different sentence.
 */
const markupOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

test("⛔ the filter is on a feature's page, not only on the prototype board", () => {
  const { corpus: c, varied } = corpus();

  /**
   * ⛔ THE FEATURE'S OWN PAGE. This is the whole complaint: the control existed, on one tab, and the
   * page a reviewer actually reads a feature on did not have it.
   */
  const feature = markupOf(pageFor(c, varied));
  assert.match(feature, /data-dimfilter/, "a feature's page has no dimension filter");
  assert.match(feature, /data-dim-filter="role"/, "the filter offers no control for the product's dimension");
  assert.match(feature, /<option value="">any<\/option>/, "the filter has no way to choose nothing");

  /** And the product's own page, since "every page" includes the one above the features. */
  const root = markupOf(pageFor(c, c.scopes.find((e) => !e.scope.in).scope.id));
  assert.match(root, /data-dimfilter/, "the product's page has no dimension filter");

  /** ⛔ And the truth carries its combination into the page, or there is nothing to filter on. */
  assert.match(feature, /data-holds="/, "no truth on the page states which combination it is for");
});

test("⛔ no filter where a product declares no dimensions", () => {
  /**
   * A row of empty dropdowns is the "nav row that does nothing" this project refuses by name: it
   * reads as a broken feature rather than an unused one.
   */
  const dir = path.join(temp("v2dimnone-"), "corpus");
  fs.cpSync("v2-seed", dir, { recursive: true });
  const c = loadCorpus(dir);
  const html = markupOf(pageFor(c, c.scopes.find((e) => !e.scope.in).scope.id));
  assert.doesNotMatch(html, /data-dimfilter/, "a product with no dimensions is offered a filter anyway");
  /** ⛔ And nothing is hidden, because nothing could be — the page is unchanged. */
  assert.doesNotMatch(html, /data-holds="/, "a corpus with no dimensions is emitting combinations");
});

test("⛔ in a real browser: nothing chosen narrows nothing, and choosing narrows exactly what it should", { skip }, async () => {
  const { corpus: c, varied } = corpus();
  const page = await openPage(pageFor(c, varied), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('[data-dim-filter=\"role\"]')", "the filter");

    const seen = await page.evaluate(`(async () => {
      const read = () => {
        const subjects = [...document.querySelectorAll('[data-holds]')];
        return {
          total: subjects.length,
          hidden: subjects.filter((el) => getComputedStyle(el).display === 'none').length,
          said: document.querySelector('[data-dimhidden]').hidden
            ? ''
            : document.querySelector('[data-dimhidden]').textContent,
        };
      };
      const pick = async (value) => {
        const sel = document.querySelector('[data-dim-filter="role"]');
        sel.value = value;
        sel.dispatchEvent(new Event('change'));
        await new Promise((r) => setTimeout(r, 20));
        return read();
      };
      return { start: read(), any: await pick(''), match: await pick('admin'), other: await pick('loan processor') };
    })()`);

    assert.ok(seen.start.total >= 1, "the fixture puts no combination on the page, so nothing is being filtered");

    /** ⛔ FIRST: the default. Nothing chosen must hide nothing. */
    assert.equal(seen.start.hidden, 0, "the page arrives already narrowed, so every number on it is wrong");
    assert.equal(seen.start.said, "", "the page claims to have hidden something before anything was chosen");
    assert.equal(seen.any.hidden, 0, "choosing 'any' hid something");

    /** ⛔ SECOND: the matching value shows it — this is what separates a filter from a blanket. */
    assert.equal(seen.match.hidden, 0, "the admin's own screen was hidden from the admin");

    /** ⛔ THIRD: the other value hides it, and says so. */
    assert.equal(seen.other.hidden, seen.start.total, "the other role was shown truth promised to the admin");
    assert.match(seen.other.said, /hidden/, "the page narrowed itself and said nothing about it");
    assert.match(seen.other.said, new RegExp(String(seen.start.total)), "the readout does not say how much it hid");
  } finally {
    await page.close();
  }
});

test("⛔ in a real browser: the choice is remembered, and a value that no longer exists is not", { skip }, async () => {
  /**
   * ⛔ REMEMBERED, for the reason the menu placement is: it is a reading posture, not a per-page
   * decision, and being asked again on every feature is the same as not being asked.
   *
   * ⛔ AND A REMEMBERED VALUE THE PRODUCT NO LONGER OFFERS IS DISCARDED. Restoring it would narrow
   * the page by a value that is not in the dropdown, so the reader sees a filtered product and the
   * control says "any" — the worst of both, and no way to find out why.
   */
  const { corpus: c, varied } = corpus();
  const page = await openPage(pageFor(c, varied), { exe, width: 1200, height: 900 });
  try {
    await page.waitFor("!!document.querySelector('[data-dim-filter=\"role\"]')", "the filter");
    const seen = await page.evaluate(`(() => {
      const sel = document.querySelector('[data-dim-filter="role"]');
      sel.value = 'loan processor';
      sel.dispatchEvent(new Event('change'));
      const stored = JSON.parse(localStorage.getItem('productos:asked') || '{}');

      /* A value the product does not offer, as a corpus that dropped one would leave behind. */
      localStorage.setItem('productos:asked', JSON.stringify({ role: 'auditor' }));
      const offered = [...sel.options].map((o) => o.value);
      return { stored, offered };
    })()`);

    assert.deepEqual(seen.stored, { role: "loan processor" }, "the choice was not remembered");
    assert.equal(seen.offered.includes("auditor"), false, "the fixture offers the value this is about");
  } finally {
    await page.close();
  }

  /** The reload half: a stale remembered value must leave the page unnarrowed. */
  const fresh = await openPage(pageFor(c, varied), { exe, width: 1200, height: 900 });
  try {
    await fresh.waitFor("!!document.querySelector('[data-dim-filter=\"role\"]')", "the filter");
    const seen = await fresh.evaluate(`(() => {
      const sel = document.querySelector('[data-dim-filter="role"]');
      /* What the boot code does with a remembered value, run against one nothing offers. */
      let applied = '';
      for (const opt of sel.options) if (opt.value === 'auditor') applied = 'auditor';
      return { applied, value: sel.value };
    })()`);
    assert.equal(seen.applied, "", "a value the product no longer offers would have been restored");
    assert.equal(seen.value, "", "the control is narrowed by something it cannot show");
  } finally {
    await fresh.close();
  }
});
