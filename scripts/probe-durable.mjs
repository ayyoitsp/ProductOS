/**
 * Does pressing a nav row leave a link somebody else can open — without reloading the page?
 *
 * Peter: *"we should have durable links for everything in product os. no idea why we use anchors
 * for everything."*
 *
 * Two things have to be true at once, and they pull against each other, which is why this is driven
 * rather than reasoned about:
 *
 *   · the address bar becomes `/…/v2/<scope>` — an address, not a fragment
 *   · the document is NOT reloaded, so a 3 MB page is not re-fetched to reach a section of itself
 *
 * ⛔ THE SECOND IS THE ONE A MARKUP ASSERTION CANNOT SEE, and it is the reason the test this change
 * rewrote asserted fragments in the first place: "jumping within the page you are on beats
 * reloading it" is correct, and it does not follow that the link must be a fragment. A marker set
 * on `window` before the press and read after it is what tells the two apart — it survives a
 * history push and does not survive a navigation.
 *
 *     node scripts/probe-durable.mjs http://localhost:4100/p/<project>/v2
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { openPage, findBrowser } from "../test/support/chrome.mjs";
import { v2Route } from "../dist/v2/serve.js";
import { loadCorpus } from "../dist/v2/load.js";
import { temp } from "../test/support/temp.mjs";

const exe = findBrowser();
if (!exe) {
  console.error("no browser on this machine");
  process.exit(2);
}

/** A corpus of its own, so this says something without an instance to hand. */
const MOUNT = "/p/prj-probe";
const dir = temp("probe-durable-");
fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
fs.writeFileSync(
  path.join(dir, "truth", "everything.md"),
  `---\nid: everything\ntitle: Everything\nexists: kept\n---\n\nThe product.\n`
);
for (let a = 0; a < 3; a++)
  fs.writeFileSync(
    path.join(dir, "truth", `part-${a}.md`),
    `---\nid: part-${a}\ntitle: Part ${a}\nin: everything\nexists: kept\n---\n\nAn area.\n`
  );
for (let i = 0; i < 6; i++) {
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
    path.join(dir, "truth", `thing-${i}.md`),
    `---\nid: thing-${i}\ntitle: Thing ${i}\nin: part-${i % 3}\nexists: kept\nviews:\n` +
      `  - id: thing-${i}-screen\n    title: Screen of thing ${i}\n    view_kind: detail\n` +
      /** ⛔ `returns: true` because a part that navigates nowhere is refused — the loader said so. */
      `    parts:\n      - id: go\n        role: navigates\n        label: Go\n        returns: true\n` +
      `exchanges:\n  - id: do-it-${i}\n    title: ${JSON.stringify(`Somebody does it in thing ${i}`)}\n    asked_by: person\n` +
      `    at: { view: thing-${i}-screen, part: go }\n    reads: []\n    changes: []\n    slots:\n` +
      Object.entries(slots)
        .map(([k, v]) => `      ${k}:\n        says: ${JSON.stringify(v)}`)
        .join("\n") +
      `\n      refuses:\n        outcomes:\n          - name: no\n            when: it cannot be done\n            told: why not\n---\n\nThing ${i}.\n`
  );
}
const corpus = loadCorpus(dir);
if (corpus.broken.length) {
  console.error(`the fixture does not load: ${corpus.broken.map((b) => b.why.split("\n")[0]).join(" | ")}`);
  process.exit(2);
}

/** ⛔ Served UNDER A PATH, because a route at the root is what hid this for months. */
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!p.startsWith(MOUNT)) {
    res.writeHead(404);
    res.end("not mounted here");
    return;
  }
  if (!(await v2Route(req, res, p.slice(MOUNT.length) || "/", { dir, mount: MOUNT }))) {
    res.writeHead(404);
    res.end("no");
  }
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = process.argv[2] ?? `${origin}${MOUNT}/v2`;

const page = await openPage(null, { exe, url, width: 1440, height: 900 });
await page.waitFor(
  `location.href.indexOf(${JSON.stringify(url)}) === 0 && document.readyState === "complete"`,
  `the browser to be on ${url}`
);

/** ⛔ The marker: survives a history push, dies in a navigation. */
await page.evaluate(`window.__probeSurvived = true`);

/**
 * ⛔ THE DEEPEST ROW, because a top-level one proves nothing about the structure. `part-0` sits
 * directly under the root and the root is not a crumb, so its menu path is one segment — which is
 * indistinguishable from the flat `/v2/<scope>` this change replaced. A row two levels down is
 * where `/v2/{area}/{feature}` either appears or does not.
 */
const row = await page.evaluate(`(() => {
  const rows = [...document.querySelectorAll("nav.scopes a[data-goto]")].filter((x) => x.dataset.goto !== "overview");
  const deepest = rows.map((a) => ({ goto: a.dataset.goto, href: a.getAttribute("href"), depth: (a.getAttribute("href") || "").split("/").length }))
    .sort((x, y) => y.depth - x.depth)[0];
  return deepest || null;
})()`);
if (!row) {
  console.error("the nav has no row to press");
  process.exit(2);
}

console.log(`\n the nav addresses "${row.goto}" as   ${row.href}`);
console.log(` a fragment would be                 #at-${row.goto}`);

await page.evaluate(
  `document.querySelector('nav.scopes a[data-goto=' + JSON.stringify(${JSON.stringify(row.goto)}) + ']').click()`
);
await new Promise((r) => setTimeout(r, 400));

const after = await page.evaluate(`({
  path: location.pathname,
  hash: location.hash,
  survived: window.__probeSurvived === true,
  showing: [...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view),
})`);

console.log(`\n after pressing it`);
console.log(`   address   ${after.path}${after.hash}`);
console.log(`   showing   ${JSON.stringify(after.showing)}`);
console.log(`   reloaded  ${after.survived ? "no" : "YES"}`);

/** ⛔ And the address it left behind is opened COLD, in a second page — the whole point of durable. */
const cold = await openPage(null, { exe, url: `${origin}${after.path}`, width: 1440, height: 900 });
await cold.waitFor(
  `location.href.indexOf(${JSON.stringify(origin)}) === 0 && document.readyState === "complete"`,
  "the copied address to open"
);
const landed = await cold.evaluate(`({
  title: document.title,
  views: document.querySelectorAll("section.view").length,
  showing: [...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view),
})`);
console.log(`\n opening ${after.path} cold, in a new page`);
console.log(`   title     ${landed.title}`);
console.log(`   views     ${landed.views}`);
console.log(`   showing   ${JSON.stringify(landed.showing)}`);

console.log("");
const ok = [];
if (!row.href.startsWith(`${MOUNT}/v2/`)) ok.push(`⛔ the nav still writes ${row.href}`);
/**
 * ⛔ NO FRAGMENT ANYWHERE. Peter: *"get rid of the fucking anchors. URLs should follow the menu
 * structure"*. Checked on the link, on the address bar after the press, and on both at once —
 * the previous cut satisfied "has a path" while still writing /v2/part-0#at-part-0.
 */
if (row.href.includes("#")) ok.push(`⛔ the nav link still carries an anchor: ${row.href}`);
if (after.hash) ok.push(`⛔ the address bar still carries an anchor: ${after.hash}`);
if (!after.survived) ok.push("⛔ pressing a durable link reloaded the page");
/** ⛔ The LAST segment is the thing; everything before it is the menu above it. */
if (after.path.split("/").pop() !== row.goto) ok.push(`⛔ the address bar says ${after.path}, which does not end at ${row.goto}`);
if (!after.path.startsWith(`${MOUNT}/v2/`)) ok.push(`⛔ the address bar says ${after.path}, not under ${MOUNT}/v2`);
if (!landed.views) ok.push("⛔ the copied address opened a page with nothing on it");
if (ok.length) ok.forEach((x) => console.log(x));
else console.log(`✓ durable in the address bar, no reload, and the address opens on its own`);

await page.close();
await cold.close();
server.close();
