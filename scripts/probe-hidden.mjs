/**
 * Which sections are hidden on arrival, and what is inside each — against the defer fixture.
 *
 * ⛔ WRITTEN BECAUSE TWO TESTS DISAGREED AND I WAS ABOUT TO PICK ONE. Making the view switcher read
 * the live DOM fixed the routing Peter reported and turned "what is unopened waits" red, reporting
 * `{sections:14, waited:0, drawn:0, stubs:14}`. Either the fix changed what is hidden, or that test
 * was counting something it did not mean to. Guessing between those is how a real guarantee gets
 * loosened to make a build green, so: look at one instance.
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

/** The same shape as the defer test's fixture: areas with no exchanges, features with two screens. */
const drawing = (id, what) =>
  `<div class="p-4">${Array.from({ length: 14 }, (_, r) => `<div class="border-b">Row ${r} of ${what} in ${id}</div>`).join("")}</div>`;

const dir = temp("probe-hidden-");
fs.mkdirSync(path.join(dir, "truth"), { recursive: true });
fs.writeFileSync(
  path.join(dir, "truth", "everything.md"),
  `---\nid: everything\ntitle: Everything\nexists: kept\n---\n\nThe product.\n`
);
const N = 9;
const areas = Math.max(1, Math.round(N / 3));
for (let a = 0; a < areas; a++)
  fs.writeFileSync(
    path.join(dir, "truth", `part-${a}.md`),
    `---\nid: part-${a}\ntitle: Part ${a}\nin: everything\nexists: kept\n---\n\nAn area.\n`
  );
for (let i = 0; i < N; i++) {
  const id = `thing-${i}`;
  const views = [0, 1]
    .map(
      (v) =>
        `  - id: ${id}-screen-${v}\n    title: Screen ${v} of thing ${i}\n    view_kind: ${v === 0 ? "detail" : "form"}\n` +
        `    sketch_html: ${JSON.stringify(drawing(id, `Screen ${v}`))}\n` +
        `    parts:\n      - id: go\n        role: navigates\n        label: Go\n        leads_to: ${id}-screen-${v === 0 ? 1 : 0}`
    )
    .join("\n");
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
    path.join(dir, "truth", `${id}.md`),
    `---\nid: ${id}\ntitle: Thing ${i}\nin: part-${i % areas}\nexists: kept\nviews:\n${views}\n` +
      `exchanges:\n  - id: do-it-${i}\n    title: ${JSON.stringify(`Somebody does it in thing ${i}`)}\n    asked_by: person\n` +
      `    at: { view: ${id}-screen-0, part: go }\n    reads: []\n    changes: []\n    slots:\n` +
      Object.entries(slots)
        .map(([k, v]) => `      ${k}:\n        says: ${JSON.stringify(v)}`)
        .join("\n") +
      `\n      refuses:\n        outcomes:\n          - name: not-a-number\n            when: the amount is not a number\n            told: that it has to be a number\n---\n\nThing ${i}.\n`
  );
}
const corpus = loadCorpus(dir);
if (corpus.broken.length) {
  console.error(`the fixture does not load: ${corpus.broken.map((b) => b.why.split("\n")[0]).join(" | ")}`);
  process.exit(2);
}

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!(await v2Route(req, res, p, { dir }))) {
    res.writeHead(404);
    res.end("no");
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const page = await openPage(null, { exe, url: `${base}/v2`, width: 1440, height: 900 });
await page.waitFor(
  `location.href.indexOf(${JSON.stringify(base)}) === 0 && document.readyState === "complete"`,
  "the page to load"
);
/**
 * ⛔ TWICE, BECAUSE "WHAT IS SHOWING" IS NOT ONE FACT. Reading it only after the arrival fetches
 * cannot tell a section that was never hidden from one that something un-hid later, and those have
 * different causes.
 */
const showingNow = () =>
  page.evaluate(`[...document.querySelectorAll("section.view")].filter((s) => !s.hidden).map((s) => s.dataset.view || s.id)`);
console.log(` showing at readyState: ${JSON.stringify(await showingNow())}`);

/** Give the arrival fetches a chance, the same way the test does. */
try {
  await page.waitFor(
    `[...document.querySelectorAll(".proto-mock")].some((h) => h.shadowRoot && h.shadowRoot.childNodes.length)`,
    "a drawing to arrive with nobody pressing anything"
  );
} catch (e) {
  console.log(`(${e.message})`);
}

const seen = await page.evaluate(`[...document.querySelectorAll("section.view")].map((s) => ({
  view: s.dataset.view || s.id,
  hidden: s.hidden,
  stub: s.hasAttribute("data-defer"),
  mocks: s.querySelectorAll(".proto-mock").length,
  drawn: [...s.querySelectorAll(".proto-mock")].filter((h) => h.shadowRoot && h.shadowRoot.childNodes.length).length,
}))`);

console.log("\n view                     hidden  stub  mocks  drawn");
for (const r of seen) {
  console.log(
    `  ${String(r.view).padEnd(24)} ${String(r.hidden).padEnd(6)} ${String(r.stub).padEnd(5)} ${String(r.mocks).padStart(5)} ${String(r.drawn).padStart(6)}`
  );
}
const hidden = seen.filter((r) => r.hidden);
console.log(
  `\n hidden: ${hidden.length}   of those stubs: ${hidden.filter((r) => r.stub).length}   mocks inside hidden: ${hidden.reduce((n, r) => n + r.mocks, 0)}   drawn inside hidden: ${hidden.reduce((n, r) => n + r.drawn, 0)}`
);
console.log(` showing: ${JSON.stringify(seen.filter((r) => !r.hidden).map((r) => r.view))}`);

await page.close();
server.close();
