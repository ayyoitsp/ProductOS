#!/usr/bin/env node
/**
 * Does every inline script on a served page actually PARSE?
 *
 * ⛔ A SYNTAX ERROR IN ONE INLINE SCRIPT KILLS EVERY BUTTON ON THE PAGE, AND THE PAGE STILL 200s.
 *
 * A `.split("\n")` written inside a TypeScript template literal reaches the browser as a string
 * broken across two real lines. The browser answers `Invalid or unexpected token` and abandons the
 * WHOLE script — so the composer, the walk and every act button died together, while `tsc` was
 * clean, 846 tests were green and the page served 200. That region is a template string, so nothing
 * type-checks it.
 *
 * ⛔ AND A DEPLOY GATE THAT ASKS FOR 200 CANNOT SEE IT. Health, status codes, element counts and
 * rendered markup are all exactly as they should be. The only observable is a console error on
 * load, which nobody is watching.
 *
 * ⛔ COMPILED WITH V8, NOT PATTERN-MATCHED. `new vm.Script` runs the same parser the browser does
 * and does not execute a line of it, so this is the real answer rather than a guess about which
 * mistakes to look for — including the next one nobody has made yet.
 *
 * Usage:
 *   node scripts/live-scripts-parse.mjs <url> [<url> …]   explicit pages
 *   node scripts/live-scripts-parse.mjs --from <base>      every corpus page the index links to
 *
 * ⛔ `--from` EXISTS SO THE LIST CANNOT GO STALE. A hand-written list of pages checks the pages
 * somebody remembered; the index is what the instance itself says it serves.
 */
import vm from "node:vm";

const args = process.argv.slice(2);
/** ⛔ The value after `--from` is a BASE, not a page — including it reported the index as broken. */
const fromAt = args.indexOf("--from");
let URLS = args.filter((a, i) => !a.startsWith("--") && !(fromAt >= 0 && i === fromAt + 1));

/** Discover the corpus pages from the index, so the list is the instance's own answer. */
if (args.includes("--from")) {
  const base = (args[args.indexOf("--from") + 1] ?? "").replace(/\/$/, "");
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
  console.error("usage: node scripts/live-scripts-parse.mjs <url> [<url> …] | --from <base>");
  process.exit(2);
}

/** Inline scripts only — a `src=` is a separate request and is not inline code. */
const inlineScripts = (html) => {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    const attrs = m[1] ?? "";
    if (/\bsrc\s*=/.test(attrs)) continue;
    /** ⛔ JSON and importmaps are data, not code, and must not be compiled as script. */
    if (/type\s*=\s*["'](?!text\/javascript|module|application\/javascript)/i.test(attrs)) continue;
    const body = m[2] ?? "";
    if (body.trim()) out.push({ attrs, body, at: m.index });
  }
  return out;
};

let failures = 0;
for (const url of URLS) {
  let html;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ${url} answered ${res.status}`);
      failures += 1;
      continue;
    }
    html = await res.text();
  } catch (e) {
    console.error(`✗ ${url} could not be fetched: ${e.message}`);
    failures += 1;
    continue;
  }

  const scripts = inlineScripts(html);
  /**
   * ⛔ ZERO INLINE SCRIPTS IS NOT A PASS. A page that stopped emitting its live script would sail
   * through a loop over nothing — the same shape as a zero with no failing state.
   */
  if (!scripts.length) {
    console.error(`✗ ${url} serves no inline script at all — nothing was checked`);
    failures += 1;
    continue;
  }

  let bad = 0;
  for (const [i, s] of scripts.entries()) {
    try {
      const isModule = /type\s*=\s*["']module["']/i.test(s.attrs);
      /** `vm.Script` cannot parse `import`/top-level-await; wrap a module so the parse is honest. */
      new vm.Script(isModule ? `(async()=>{${s.body}})()` : s.body, { filename: `${url}#script${i + 1}` });
    } catch (e) {
      bad += 1;
      failures += 1;
      console.error(`✗ ${url} script ${i + 1} of ${scripts.length} does not parse: ${e.message}`);
      const line = (e.stack ?? "").split("\n").slice(1, 3).join(" ").trim();
      if (line) console.error(`    ${line}`);
    }
  }
  if (!bad) console.log(`✓ ${url} — ${scripts.length} inline script(s), all parse`);
}

process.exit(failures ? 1 : 0);
