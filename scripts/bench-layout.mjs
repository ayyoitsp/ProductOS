/**
 * What is left on a save once the network reads are gone: laying the corpus out on disk and
 * parsing it back.
 *
 * ⛔ A MUTATING REQUEST CANNOT SHARE A DIRECTORY, so a save pays this every time — `writeBack`
 * diffs the files on disk against what the request was given, and a shared directory would have
 * one request's writes read as somebody else's. The read path already reuses a pristine one
 * (1062ms to 49ms); the write path cannot, so this is the floor a save still pays.
 *
 * ⛔ TIMED, UNLIKE `bench-split.mjs`, BECAUSE HERE THE CLOCK IS THE QUESTION. Bytes off the wire
 * is a property of the code; local disk and YAML is work actually done, and the only thing that
 * says how much is doing it. So each phase runs several times and the spread is printed — a single
 * number on this machine has been wrong by 2.7x before.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject } from "../dist/v2/store/instance.js";
import { storeFor } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";
import { loadCorpus, corpusFiles } from "../dist/v2/load.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const client = new PGlite();
const db = drizzle(client);
await applyMigrations((sql) => client.exec(sql));
const who = await accountFor(db, "peter@example.com");
await createProject(db, { id: "prj-layout", owner: who, slug: "layout", name: "Layout" });
const store = await storeFor(db, { kind: "browser", account: who, reach: [] }).project("prj-layout");

/**
 * Bilrost's shape, and the documents have to be REAL for the parse to cost what it costs — a
 * million x's is not YAML. Each is a small feature with a handful of behaviours.
 */
const TRUTH_DOCS = 108;
const DRAW_DOCS = 60;
const DRAW_EACH = 247_000;

const feature = (i) => {
  const says = Array.from(
    { length: 24 },
    (_, k) =>
      `  - id: beh-${i}-${k}\n    says: Somebody doing the ${k}th thing in feature ${i} sees what they asked for.\n    status: drafted\n`
  ).join("");
  return `---\nid: thing-${i}\ntitle: Thing ${i}\nexists: kept\nkind: feature\nbehaviors:\n${says}---\n\nThing ${i} is what somebody does when they want the ${i}th outcome this product promises.\n`;
};

const documents = {};
for (let i = 0; i < TRUTH_DOCS; i++) documents[`truth/thing-${i}.md`] = feature(i);
for (let i = 0; i < DRAW_DOCS; i++) {
  documents[`drawings/area-${i}/view.html`] = `<div>${"y".repeat(DRAW_EACH)}</div>`;
}
for (const [p, s] of Object.entries(documents)) await store.put(p, s);

const total = Object.values(documents).reduce((n, s) => n + s.length, 0);
const drawn = Object.entries(documents)
  .filter(([p]) => p.startsWith("drawings/"))
  .reduce((n, [, s]) => n + s.length, 0);
console.log(
  `\n${Object.keys(documents).length} documents, ${(total / 1e6).toFixed(2)} MB, of which ${(drawn / 1e6).toFixed(2)} MB drawings\n`
);

const ROUNDS = 5;
const times = (label, fn) => {
  const took = [];
  for (let r = 0; r < ROUNDS; r++) {
    const t = process.hrtime.bigint();
    fn();
    took.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  took.sort((a, b) => a - b);
  console.log(
    `  ${label.padEnd(36)} ${took[Math.floor(ROUNDS / 2)].toFixed(0).padStart(5)}ms   (${took[0].toFixed(0)}–${took[ROUNDS - 1].toFixed(0)}ms)`
  );
};

/** Lay a set of documents out the way `materialize` does, into a directory we can time twice. */
const layOut = (docs) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-layout-"));
  for (const [p, s] of Object.entries(docs)) {
    const at = path.join(dir, p);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, s);
  }
  return dir;
};

const made = [];
const keep = (d) => (made.push(d), d);

const sentences = Object.fromEntries(Object.entries(documents).filter(([p]) => !p.startsWith("drawings/")));

times("lay out everything", () => keep(layOut(documents)));
times("lay out the sentences only", () => keep(layOut(sentences)));

const whole = keep(layOut(documents));
const thin = keep(layOut(sentences));

/**
 * ⛔ WEIGHED BEFORE IT IS TIMED, BECAUSE THE FIRST VERSION OF THIS SCRIPT REPORTED 1ms FOR 15 MB.
 *
 * 15 GB/s off local disk is not a fast read, it is a read that did not happen — `corpusFiles` went
 * one level deep and matched only `.md|.yaml`, so every drawing was skipped. That impossible
 * number is what found silent data loss in the write path: `writeBack` diffs this against the
 * store, so a drawing it cannot see reads as REMOVED. So the bytes are printed next to the time,
 * and a timing with nothing behind it is visible rather than flattering.
 */
const weight = (o) => Object.values(o).reduce((n, v) => n + v.length, 0);
const readWhole = weight(corpusFiles(whole));
console.log(
  `  (corpusFiles reads back ${(readWhole / 1e6).toFixed(2)} MB of the ${(total / 1e6).toFixed(2)} MB laid out)`
);
if (readWhole < total * 0.9) {
  console.log(`⛔ ${((1 - readWhole / total) * 100).toFixed(0)}% of the corpus is invisible to corpusFiles`);
}

times("read the files back (everything)", () => corpusFiles(whole));
times("read the files back (sentences)", () => corpusFiles(thin));
times("parse it (everything)", () => loadCorpus(whole));
times("parse it (sentences)", () => loadCorpus(thin));

for (const d of made) fs.rmSync(d, { recursive: true, force: true });

console.log(
  "\n⛔ A save cannot share a directory, so whatever the first two lines cost, it pays — every time."
);
