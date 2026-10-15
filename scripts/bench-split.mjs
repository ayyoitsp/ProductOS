/**
 * How many bytes a request pulls out of the store, on a Bilrost-shaped corpus.
 *
 * Peter: *"i don't understand why ecerything is so big? why isn't stuff broken down?"* — and then,
 * about the pictures: *"why can't we just not re-read the images?"*. This is how to check the
 * answer. It seeds 108 documents of sentences (~2.7 MB) and 60 drawings (~14.8 MB), which is the
 * shape Bilrost actually has, and reports what each kind of request asks for.
 *
 * ⛔ COUNTED AT THE STORE BOUNDARY, NOT TIMED. Bytes crossing the wire is a fact about the code;
 * how long they took on this machine is a fact about the afternoon — the measurement that started
 * all of this varied 2.7x between consecutive identical requests. And it runs on PGlite rather
 * than the instance, so it needs no credential and says nothing about network latency.
 *
 * Expected, with the split in place:
 *
 *   cold read                  truth 2.71 MB   drawings 14.82 MB
 *   warm read                  truth 0.00 MB   drawings  0.00 MB
 *   a save, after an edit      truth 2.71 MB   drawings  0.00 MB   ← the point of the split
 *   the page after the save    truth 2.71 MB   drawings  0.00 MB   ← and again on the way back
 *   the page after a redraw    truth 0.00 MB   drawings 14.82 MB   ← the other direction
 *
 * ⛔ 2.71 MB RATHER THAN 17.53 MB, and that is the whole number. It is not zero and must not be:
 * the sentences did change. What changed is that the 14.82 MB of pictures, which a sentence edit
 * cannot have touched, is no longer dragged along behind it.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject, materializeProject, forgetRead } from "../dist/v2/store/instance.js";
import { storeFor } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";

const client = new PGlite();
const db = drizzle(client);
await applyMigrations((sql) => client.exec(sql));
const who = await accountFor(db, "peter@example.com");
await createProject(db, { id: "prj-shape", owner: who, slug: "shape", name: "Shape" });
const reach = { kind: "browser", account: who, reach: [] };
const store = await storeFor(db, reach).project("prj-shape");

/** Bilrost: 168 documents, 17.5 MB, of which 14.8 MB is drawings. */
const TRUTH_DOCS = 108;
const TRUTH_EACH = 25_000;
const DRAW_DOCS = 60;
const DRAW_EACH = 247_000;

for (let i = 0; i < TRUTH_DOCS; i++) {
  await store.put(
    `truth/thing-${i}.md`,
    `---\nid: thing-${i}\ntitle: Thing ${i}\nexists: kept\n---\n\n${"x".repeat(TRUTH_EACH)}\n`
  );
}
for (let i = 0; i < DRAW_DOCS; i++) {
  await store.put(`drawings/area-${i}/view.html`, `<div>${"y".repeat(DRAW_EACH)}</div>`);
}
forgetRead("prj-shape");

/** Weigh what one request asks for, by wrapping the three reads that carry a corpus. */
const weigh = (s) => {
  const got = { truth: 0, drawings: 0, documents: 0 };
  const sum = (o) => Object.values(o).reduce((n, v) => n + v.length, 0);
  return {
    got,
    store: {
      ...s,
      documents: async (...a) => {
        const r = await s.documents(...a);
        got.documents += sum(r);
        return r;
      },
      documentsOutside: async (...a) => {
        const r = await s.documentsOutside(...a);
        got.truth += sum(r);
        return r;
      },
      documentsUnder: async (...a) => {
        const r = await s.documentsUnder(...a);
        got.drawings += sum(r);
        return r;
      },
    },
  };
};

const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
const show = (label, got) =>
  console.log(
    `  ${label.padEnd(28)} truth ${mb(got.truth).padStart(9)}   drawings ${mb(got.drawings).padStart(9)}` +
      (got.documents ? `   WHOLE CORPUS ${mb(got.documents)}` : "")
  );

const run = async (label, mutating) => {
  const w = weigh(store);
  await materializeProject(w.store, mutating);
  show(label, w.got);
  return w.got;
};

console.log(`\n${TRUTH_DOCS} documents of sentences, ${DRAW_DOCS} drawings\n`);
await run("cold read", false);
await run("warm read", false);

/** A save, and then the page that follows it — the sequence Peter was waiting on. */
const other = await storeFor(db, reach).project("prj-shape");
await other.put(
  "truth/thing-0.md",
  `---\nid: thing-0\ntitle: Edited\nexists: kept\n---\n\n${"x".repeat(TRUTH_EACH)}\n`
);
await run("a save, after an edit", true);
const page = await run("the page after the save", false);

/** ⛔ And a redraw, which is the case that MUST still cost the pictures. */
await other.put("drawings/area-0/view.html", `<div>${"z".repeat(DRAW_EACH)}</div>`);
const redrawn = await run("the page after a redraw", false);

console.log("");
if (page.drawings !== 0) console.log("⛔ a sentence edit re-read the pictures — the split is not in force");
if (redrawn.drawings === 0) console.log("⛔ a redraw was served from cache — worse than re-reading");
if (page.drawings === 0 && redrawn.drawings > 0) {
  console.log(`a sentence edit now costs ${mb(page.truth)} instead of ${mb(page.truth + redrawn.drawings)}`);
}
