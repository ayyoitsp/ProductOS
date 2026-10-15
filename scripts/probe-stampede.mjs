/**
 * How many times one corpus is read when several requests arrive at once.
 *
 * Read off the live instance's own log: a cold read on Bilrost is 4–21 seconds, and a 35-byte
 * presence poll pays it.
 *
 *     GET …/api/v2/presence 200 35b 20932ms db=6q corpus=read dir=laid-out
 *     GET …/v2             200 2977164b 14413ms db=6q corpus=read dir=laid-out
 *     GET …/api/v2/presence 200 35b 12131ms db=6q corpus=read dir=laid-out
 *
 * Every save calls `forgetRead`, and then the page, presence, live, thread and mocks all arrive
 * together — so the suspicion is that each one independently reads the whole corpus and they
 * contend with each other, which would explain times that climb rather than sitting at one cost.
 *
 * ⛔ COUNTED, NOT TIMED, AND ON PGLITE. "They each read it" is a fact about the code; the 21s is a
 * fact about contention on a particular afternoon. If the count is 1 the suspicion is wrong and the
 * cost is somewhere else — which is the result this probe exists to be able to produce.
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
await createProject(db, { id: "prj-herd", owner: who, slug: "herd", name: "Herd" });
const store = await storeFor(db, { kind: "browser", account: who, reach: [] }).project("prj-herd");

for (let i = 0; i < 40; i++) {
  await store.put(
    `truth/thing-${i}.md`,
    `---\nid: thing-${i}\ntitle: Thing ${i}\nexists: kept\n---\n\n${"x".repeat(20_000)}\n`
  );
}
for (let i = 0; i < 10; i++) await store.put(`drawings/area-${i}/view.html`, `<div>${"y".repeat(100_000)}</div>`);
forgetRead("prj-herd");

const counted = () => {
  const n = { truth: 0, drawings: 0, since: 0, fingerprint: 0 };
  return {
    n,
    store: {
      ...store,
      documentsOutside: (...a) => (n.truth++, store.documentsOutside(...a)),
      documentsUnder: (...a) => (n.drawings++, store.documentsUnder(...a)),
      since: (...a) => (n.since++, store.since(...a)),
      fingerprint: (...a) => (n.fingerprint++, store.fingerprint(...a)),
    },
  };
};

const K = 6;

/** ⛔ Warm first, so the count below is about the stampede and not about a cold start. */
const warm = counted();
await materializeProject(warm.store, false);
console.log(`\n warm-up                    truth=${warm.n.truth} drawings=${warm.n.drawings} since=${warm.n.since}`);

const quiet = counted();
await Promise.all(Array.from({ length: K }, () => materializeProject(quiet.store, false)));
console.log(` ${K} at once, nothing changed  truth=${quiet.n.truth} drawings=${quiet.n.drawings} since=${quiet.n.since}`);

/** ⛔ The real case: a save has just landed, so every one of them has to read. */
forgetRead("prj-herd");
const herd = counted();
await Promise.all(Array.from({ length: K }, () => materializeProject(herd.store, false)));
console.log(` ${K} at once, after a save    truth=${herd.n.truth} drawings=${herd.n.drawings} since=${herd.n.since}`);

console.log("");
if (herd.n.truth <= 1) {
  console.log(`✓ ${K} concurrent requests after a save read the corpus ${herd.n.truth} time — they already share one read`);
} else {
  console.log(`⛔ ${K} concurrent requests after a save read the corpus ${herd.n.truth} times over`);
  console.log(`   each one pulls the whole thing; on Bilrost that is ${herd.n.truth} × 2.7 MB of sentences at the same moment`);
}
if (quiet.n.truth > 0) console.log(`⛔ and ${quiet.n.truth} reads happened with NOTHING changed, which the cache should have made zero`);
