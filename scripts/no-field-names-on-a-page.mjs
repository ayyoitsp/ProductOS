#!/usr/bin/env node
/**
 * Does any served page show a reader the name of a field?
 *
 * ⛔ "THE OUTPUT IS PRODUCT TRUTH; KEEP THE SUBSTRATE OUT OF IT." A reader's page is about their
 * product. A field name on it is the tool talking about itself, and it is usually a sign that a real
 * concept had nowhere to live and got smuggled into prose.
 *
 * It shipped: Peter opened the Prototype tab and found a complaint reading
 * `state it with \`splits_on\``. A test asserting no field name appeared had been written — and it
 * rendered a corpus that HAD dimensions, so the gap that prints the name, which only fires when
 * nothing names one, never ran. A page with the field name on it, asserted not to have the field
 * name, by a fixture that could not reach the line.
 *
 * ⛔ SO THIS RUNS AGAINST WHAT WENT OUT, NOT AGAINST STATES SOMEBODY THOUGHT TO RENDER. That is the
 * whole reason it lives here rather than in the suite: a fixture can only check the states its
 * author imagined, and the one that leaked was the one nobody imagined.
 *
 * ⛔ THE VOCABULARY IS DERIVED FROM THE SCHEMA, NEVER TYPED. A hand-written list of field names is a
 * list that goes stale the day somebody adds a field, and silently — the check keeps passing.
 *
 * ⛔ AND IT IS RESTRICTED TO NAMES CONTAINING AN UNDERSCORE, WHICH IS THE LOAD-BEARING CHOICE.
 * `is`, `in`, `title`, `what` and `kind` are all schema keys and all ordinary English; matching them
 * would fail correct pages constantly. An underscore is a property of the NAME — not of what else
 * happens to be on the page — so this cannot start true and rot, which is the trap that kept a
 * `${`-leak check out of the deploy.
 *
 * ⛔ SCRIPTS, STYLES AND TAGS ARE STRIPPED FIRST. `data-walk-dim` in a live script is an identifier,
 * not something a reader sees; counting it would make the check cry wolf on correct pages. What is
 * matched is text a person reads, plus the handful of attributes that are themselves visible.
 *
 * Usage:  node scripts/no-field-names-on-a-page.mjs --from <base> [<url> …]
 */
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const fromAt = args.indexOf("--from");
let URLS = args.filter((a, i) => !a.startsWith("--") && !(fromAt >= 0 && i === fromAt + 1));

if (fromAt >= 0) {
  const base = (args[fromAt + 1] ?? "").replace(/\/$/, "");
  if (!base) {
    console.error("--from needs a base url, e.g. --from http://localhost:4100");
    process.exit(2);
  }
  const index = await fetch(base + "/").then((r) => r.text());
  const found = [...index.matchAll(/href="(\/p\/[a-z0-9-]+\/v2)"/g)].map((m) => base + m[1]);
  URLS = [...new Set([...URLS, ...found])];
  if (!found.length) {
    console.error(`✗ ${base}/ links to no corpus page — nothing to check, which is not a pass`);
    process.exit(1);
  }
}
if (!URLS.length) {
  console.error("usage: node scripts/no-field-names-on-a-page.mjs --from <base> [<url> …]");
  process.exit(2);
}

/** Every key the schema declares, at any depth, that carries an underscore. */
const vocabulary = async () => {
  const mod = await import(pathToFileURL(new URL("../dist/v2/schema.js", import.meta.url).pathname).href);
  const names = new Set();
  const walk = (z, depth = 0) => {
    if (!z || depth > 8) return;
    const d = z._def ?? {};
    const shape = typeof d.shape === "function" ? d.shape() : d.shape;
    if (shape) for (const [k, v] of Object.entries(shape)) { names.add(k); walk(v, depth + 1); }
    for (const k of ["innerType", "type", "schema", "element", "valueType"]) if (d[k]) walk(d[k], depth + 1);
    if (Array.isArray(d.options)) for (const o of d.options) walk(o, depth + 1);
  };
  for (const v of Object.values(mod)) if (v && typeof v === "object" && v._def) walk(v);
  return [...names].filter((n) => n.includes("_")).sort();
};

/** What a person actually reads: text nodes, plus attributes that are themselves shown. */
const VISIBLE_ATTRS = ["title", "placeholder", "alt", "aria-label", "aria-description", "label"];
const readable = (html) => {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const shown = [];
  for (const a of VISIBLE_ATTRS) {
    const re = new RegExp(`\\b${a}\\s*=\\s*"([^"]*)"`, "gi");
    for (let m; (m = re.exec(stripped)); ) shown.push(m[1]);
  }
  /** Tags removed last, so attribute values are collected before they are discarded. */
  return stripped.replace(/<[^>]*>/g, " ") + " " + shown.join(" ");
};

const FIELDS = await vocabulary();
if (FIELDS.length < 10) {
  console.error(`✗ only ${FIELDS.length} field names derived from the schema — the vocabulary is not being read`);
  process.exit(1);
}

let failures = 0;
for (const url of URLS) {
  let html;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.error(`✗ ${url} answered ${res.status}`); failures += 1; continue; }
    html = await res.text();
  } catch (e) { console.error(`✗ ${url} could not be fetched: ${e.message}`); failures += 1; continue; }

  const text = readable(html);
  const leaks = [];
  for (const f of FIELDS) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${f}(?![A-Za-z0-9_])`);
    const m = re.exec(text);
    if (m) leaks.push({ f, near: text.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\s+/g, " ").trim() });
  }
  if (leaks.length) {
    failures += 1;
    console.error(`✗ ${url} shows a reader ${leaks.length} field name(s):`);
    for (const l of leaks) console.error(`    ${l.f} — …${l.near}…`);
  } else {
    console.log(`✓ ${url} — ${FIELDS.length} field names checked, none reaches a reader`);
  }
}

process.exit(failures ? 1 : 0);
