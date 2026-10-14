#!/usr/bin/env node
/**
 * Can a served page actually reach the URLs its own script fetches?
 *
 * ⛔ AN INSTANCE SERVES UNDER `/p/<project>/`, SO A ROOT-RELATIVE URL LEAVES THE PROJECT BEHIND.
 * There is no `<base>` tag, so `fetch("/api/v2/in")` from a page at `/p/abc/v2` goes to the origin
 * root and 404s. Every write from a hosted page did this, including filing a note — Peter pressed
 * Add and got "Not saved: Not Found".
 *
 *     POST /p/<project>/api/v2/in   400   <- the route, answering about the payload
 *     POST /api/v2/in               404   <- what the page actually posted to
 *
 * ⛔ AND THE LOCAL STACK SERVES AT THE ROOT, WHERE THIS CANNOT HAPPEN. Every path anybody develops
 * against is the one that works, which is why it survived as long as the hosted page has existed.
 *
 * ⛔ NOTHING ELSE IN EITHER HARNESS COULD SEE IT:
 *   · browser tests replace `fetch` and assert what the handler SENDS — they pass on `/nonsense`
 *   · `live-scripts-parse` reads the script, not where it points
 *   · `tsc` cannot look inside a template string
 *   · the suite runs against a root-served stack
 *
 * So this asks the only question that distinguishes them: take the URLs the page's own script names,
 * resolve them the way the browser will, and see whether anything is there.
 *
 * ⛔ A 4xx THAT IS NOT 404 IS A PASS. The door answering "that payload is wrong" proves it exists,
 * which is the whole claim. Asserting 200 would mean inventing a valid payload per route and would
 * fail for reasons that have nothing to do with reachability.
 *
 * Usage:  node scripts/page-can-reach-what-it-fetches.mjs --from <base> [<url> …]
 */
const args = process.argv.slice(2);
const fromAt = args.indexOf("--from");
let URLS = args.filter((a, i) => !a.startsWith("--") && !(fromAt >= 0 && i === fromAt + 1));

if (fromAt >= 0) {
  const base = (args[fromAt + 1] ?? "").replace(/\/$/, "");
  if (!base) { console.error("--from needs a base url"); process.exit(2); }
  const index = await fetch(base + "/").then((r) => r.text());
  const found = [...index.matchAll(/href="(\/p\/[a-z0-9-]+\/v2)"/g)].map((m) => base + m[1]);
  URLS = [...new Set([...URLS, ...found])];
  if (!found.length) { console.error(`✗ ${base}/ links to no corpus page — not a pass`); process.exit(1); }
}
if (!URLS.length) { console.error("usage: … --from <base> [<url> …]"); process.exit(2); }

/**
 * Every url the page hands to `fetch`, `new EventSource` or `new WebSocket`, classified.
 *
 * ⛔ THE PROPERTY, NOT THE CONSTRUCTION. A first version recognised `API + "…"` and `${API}…`
 * specifically. The fix then renamed the prefix to `UNDER` and passed `API` whole — so the
 * extractor found NOTHING and the probe reported four correct pages as unchecked. The other session
 * predicted exactly that about their own test an hour earlier, and I did it anyway.
 *
 * So nothing here knows how a url is built. What is asserted is the one thing that is always true:
 * a BARE LITERAL beginning with `/` loses the project, and anything concatenated with an identifier
 * carries a prefix by construction. That survives the prefix being renamed again.
 */
const callSites = (html) => {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const bare = new Set();
  let total = 0;
  for (const s of scripts) {
    for (const m of s.matchAll(/(?:fetch|new\s+EventSource|new\s+WebSocket)\s*\(\s*([^,)]+)/g)) {
      total += 1;
      const arg = m[1].trim();
      /** A quoted literal and nothing else — no `+`, no template interpolation. */
      const lit = /^(["'])([^"'`]*)\1$/.exec(arg);
      if (lit && lit[2].startsWith("/")) bare.add(lit[2]);
    }
  }
  return { bare: [...bare], total };
};

let failures = 0;
for (const url of URLS) {
  const page = new URL(url);
  let html;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.error(`✗ ${url} answered ${res.status}`); failures += 1; continue; }
    html = await res.text();
  } catch (e) { console.error(`✗ ${url} could not be fetched: ${e.message}`); failures += 1; continue; }

  const { bare, total } = callSites(html);

  /** ⛔ No call sites at all is not a pass — a page whose script stopped fetching would sail through. */
  if (!total) {
    console.error(`✗ ${url} hands no url to fetch, EventSource or WebSocket — nothing was checked`);
    failures += 1;
    continue;
  }

  const lost = [];
  for (const path of bare) {
    const atOrigin = new URL(path, page.origin).href;
    const scoped = new URL(path.replace(/^\//, ""), page.href.replace(/[^/]*$/, "")).href;
    const code = await fetch(atOrigin).then((r) => r.status).catch(() => 0);
    const scopedCode = await fetch(scoped).then((r) => r.status).catch(() => 0);
    /** ⛔ 404 at the origin while the scoped form answers is the signature of a lost project. */
    if (code === 404 || code === 0) lost.push({ path, code, scoped, scopedCode });
  }

  if (lost.length) {
    failures += 1;
    console.error(`✗ ${url} hands ${lost.length} root-relative url(s) to fetch that it cannot reach:`);
    for (const b of lost) {
      console.error(`    ${b.path} → ${b.code || "no answer"} at the origin`);
      if (b.scopedCode && b.scopedCode !== 404) {
        console.error(`      but ${b.scoped} answers ${b.scopedCode} — the url lost the project`);
      }
    }
  } else {
    console.log(`✓ ${url} — ${total} call site(s), ${bare.length} root-relative, all reachable`);
  }
}

process.exit(failures ? 1 : 0);
