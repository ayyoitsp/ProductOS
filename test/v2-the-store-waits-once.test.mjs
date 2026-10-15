/**
 * ⛔ A SERIAL PAIR OF QUERIES IS INVISIBLE ON A LOCAL STORE AND IS MOST OF A HOSTED PAGE.
 *
 * Peter: *"things like saving prototype on placement takes a LOOONG time - not done w performance
 * issues. do a sweep"*. The deploy session then measured that presence had not moved at all on the
 * instance — 0.84s for 35 bytes — while the same code took 37ms here.
 *
 * The reason was the whole afternoon's lesson: PGlite is in-process, so a query costs nothing and
 * the NUMBER OF TIMES a request crosses the network cannot be seen. Against the hosted store a
 * trivial query is ~180ms of trip whatever it carries — `listening()` was measured at 176ms
 * returning zero rows.
 *
 * ⛔ AND COUNTING QUERIES OVERSTATES IT, which I got wrong first: two queries fired together cross
 * once. `storeFor` already parallelises its reach pair and its comment records the measurement —
 * five sequential 611ms, the same five concurrent 157ms. What matters is the DEPTH of the await
 * chain, so that is what this measures: a delay is injected per query, and a pair that waits twice
 * takes twice as long as a pair that waits once.
 *
 * With the delay injected, this harness reproduced the instance almost exactly — presence 884ms
 * against a measured 0.84s, the page 1858ms against 1.86s — which is why it is worth a test rather
 * than a one-off script.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { createProject } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor } from "../dist/v2/store/identity.js";

/** How long one "network" trip costs in this test. Big enough that one round is unmistakable. */
const TRIP = 150;

/**
 * A store whose every query costs a trip.
 *
 * ⛔ THE DELAY GOES AT THE CLIENT, not around the call — that is the only place a round trip
 * actually is, and it is what makes two concurrent queries cost one wait rather than two.
 */
async function storeWithLatency() {
  const client = new PGlite();
  await applyMigrations((sql) => client.exec(sql));

  const db0 = drizzle(client);
  const who = await accountFor(db0, "peter@example.com");
  await createProject(db0, { id: "prj-trip", owner: who, slug: "trip", name: "Trip" });

  /** ⛔ Installed AFTER the setup, or the fixture pays the latency and the test takes a minute. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let queries = 0;
  const realQuery = client.query.bind(client);
  client.query = async (...a) => {
    queries++;
    await sleep(TRIP);
    return realQuery(...a);
  };

  const store = await storeFor(drizzle(client), { kind: "browser", account: who, reach: [] }).project("prj-trip");
  assert.ok(!isRefusal(store), "the fixture could not reach its own project");
  return { store, counted: () => queries, reset: () => (queries = 0) };
}

const ms = async (fn) => {
  const t = Date.now();
  await fn();
  return Date.now() - t;
};

test("the fixture really is paying a trip per query, or nothing below measures anything", async () => {
  const { store, counted, reset } = await storeWithLatency();
  reset();
  const took = await ms(() => store.documents());
  assert.ok(counted() >= 1, "no query was made");
  assert.ok(
    took >= TRIP,
    `a query took ${took}ms with ${TRIP}ms injected — the latency is not reaching the client, so a serial pair would look free`
  );
});

/**
 * ⛔ THE ONE THIS FILE EXISTS FOR. `listening()` awaited its tidy-up delete before asking its
 * question — on every request, including every presence poll and every write. The two touch
 * disjoint rows: one takes what is older than the floor, the other reads what is newer.
 */
test("listening reaps and answers in one round, not two", async () => {
  const { store, reset } = await storeWithLatency();
  reset();
  const took = await ms(() => store.listening(120_000));
  assert.ok(
    took < TRIP * 1.8,
    `listening took ${took}ms with a ${TRIP}ms trip — that is two waits, so the reap is still blocking the answer`
  );
  /** ⛔ And it did cost one, or the call is not reaching the store at all. */
  assert.ok(took >= TRIP * 0.5, `listening took ${took}ms — it cannot have crossed the network`);
});

/**
 * ⛔ AND THE FINGERPRINT, which I wrote as two sequential awaits four lines from a comment warning
 * about exactly that. It is the read every single request makes to find out whether anything
 * changed, so a wasted trip there is a wasted trip everywhere.
 */
test("the fingerprint is one round", async () => {
  const { store, reset } = await storeWithLatency();
  reset();
  const took = await ms(() => store.fingerprint());
  assert.ok(
    took < TRIP * 1.8,
    `the fingerprint took ${took}ms with a ${TRIP}ms trip — it is asking twice in series`
  );
  assert.ok(took >= TRIP * 0.5, `the fingerprint took ${took}ms — it cannot have crossed the network`);
});

/** ⛔ And it still answers correctly, because a fast wrong fingerprint serves a stale corpus. */
test("one round still notices a write, a deprecation and an event", async () => {
  const { store } = await storeWithLatency();
  const seen = new Set();

  await store.put("truth/a.md", "---\nid: a\ntitle: A\nexists: kept\n---\n\nA.\n");
  seen.add(await store.fingerprint());

  await store.put("truth/a.md", "---\nid: a\ntitle: A changed\nexists: kept\n---\n\nA.\n");
  seen.add(await store.fingerprint());

  await store.put("truth/b.md", "---\nid: b\ntitle: B\nexists: kept\n---\n\nB.\n");
  seen.add(await store.fingerprint());

  await store.deprecate("truth/b.md");
  seen.add(await store.fingerprint());

  await store.append("corpus-changed", { ref: "a", says: "something" });
  seen.add(await store.fingerprint());

  assert.equal(
    seen.size,
    5,
    `five changes produced ${seen.size} distinct fingerprints — one of them is invisible, so a cache keyed on this would serve a corpus that has moved`
  );
});
