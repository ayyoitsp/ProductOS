/**
 * ⛔ THE INSTANCE COULD NOT SAY WHERE A REQUEST'S TIME WENT, AND THAT IS WHAT COST THE DAY.
 *
 * Peter: *"should we add logs or instrumentation? this is ridiculous"*.
 *
 * He is right, and PT-0007 is the evidence. Every number came from a harness built for the
 * occasion, and the harness was wrong about the environment six times: a synthetic corpus instead
 * of Bilrost's, a corpus read from files while the instance reads a store, a browser probe that
 * measured `about:blank`, a profile of an empty corpus, a local store with no network, and
 * `PRODUCTOS_AUTH` on while the instance runs it off. From outside, the deploy session got 71.7s,
 * 40.9s and 26.7s for the same unchanged page and could not say why.
 *
 * ⛔ SO WHAT IS ASSERTED HERE IS THAT THE LINE IS TRUE, not that it exists. A log that counts the
 * wrong thing is worse than no log: it is the same failure as a measurement that agrees with you,
 * and there were six of those today.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { instanceRoute, createProject } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, singleAccount } from "../dist/v2/store/identity.js";
import { traced, noteQuery, noteCorpus, noteDir, line, tracingOn, queryCounter } from "../dist/v2/store/trace.js";

/**
 * ⛔ THE WIRING, BECAUSE THE FIRST VERSION OF THE COUNTER WAS DEAD IN PRODUCTION. It hooked
 * `postgres-js`, which ships, so the count was zero under PGlite, which the tests run — an untested
 * counter that silently reports nothing. `server.ts` already carries a ⛔ about those two drivers
 * disagreeing. This asserts the shipping path passes the counter at all, since no test here can
 * construct the real driver.
 */
test("the shipping server actually passes the counter to drizzle", () => {
  const src = fs.readFileSync("src/v2/store/server.ts", "utf-8");
  assert.match(
    src,
    /drizzle\(client, \{ logger: queryCounter \}\)/,
    "the hosted server builds its db without the query counter, so db= would be 0 on every request"
  );
});

test("a trace counts what happened inside it and nothing outside it", async () => {
  /** ⛔ Outside a request there is no trace, and noting must not throw. */
  noteQuery(1);
  noteCorpus("read");

  const { trace } = await traced(async () => {
    noteQuery(0);
    noteQuery(0);
    noteCorpus("cached");
    noteDir("reused");
  });
  assert.equal(trace.queries, 2, "the trace did not count the queries made inside it");
  assert.equal(trace.corpus, "cached");
  assert.equal(trace.dir, "reused");

  const after = await traced(async () => {});
  assert.equal(after.trace.queries, 0, "a fresh trace inherited counts from the one before it");
  assert.equal(after.trace.corpus, "untouched", "a request that never wanted a corpus claims one");
});

/**
 * ⛔ THE REASON THIS IS `AsyncLocalStorage` AND NOT A COUNTER. The instance serves overlapping
 * requests — the deploy session fired four at once to check isolation — and a module-level counter
 * would bill one request's queries to another. A measurement that lies is worse than one that is
 * missing, so this interleaves two traces deliberately.
 */
test("two requests in flight at once do not count each other's queries", async () => {
  const slow = traced(async () => {
    noteQuery(0);
    await new Promise((r) => setTimeout(r, 30));
    noteQuery(0);
    noteCorpus("read");
  });
  const quick = traced(async () => {
    noteQuery(0);
    noteCorpus("cached");
  });

  const [a, b] = await Promise.all([slow, quick]);
  assert.equal(a.trace.queries, 2, `the slow request counted ${a.trace.queries} instead of 2`);
  assert.equal(b.trace.queries, 1, `the quick request counted ${b.trace.queries} instead of 1`);
  assert.equal(a.trace.corpus, "read");
  assert.equal(b.trace.corpus, "cached", "one request's corpus verdict leaked into the other's");
});

test("the line says the things somebody chasing a slow request needs", () => {
  const out = line("GET", "/p/prj-x/v2", 200, 2977164, 961, { queries: 5, dbMs: 0, corpus: "cached", dir: "reused" });
  for (const want of ["GET /p/prj-x/v2", "200", "2977164b", "961ms", "db=5q", "corpus=cached", "dir=reused"]) {
    assert.ok(out.includes(want), `the line is missing ${want}: ${out}`);
  }
  assert.ok(out.startsWith("[productos] "), "the line is not greppable with everything else");
  assert.equal(out.split("\n").filter(Boolean).length, 1, "one request produced more than one line");
  /** ⛔ No invented duration. The logger fires when a statement is issued, not when it returns. */
  assert.ok(!/db=5q\/\d+ms/.test(out), "the line claims a per-query duration the driver cannot give it");
});

test("it can be silenced, and is not silent by default", () => {
  assert.equal(tracingOn({}), true, "an instance with no env set says nothing about its requests");
  assert.equal(tracingOn({ PRODUCTOS_QUIET: "1" }), false, "there is no way to turn it off");
});

/** ⛔ And end to end: a real request through the hosted route produces a true line. */
test("a real request through the hosted route reports what it really did", async () => {
  const client = new PGlite();
  await applyMigrations((sql) => client.exec(sql));
  const db = drizzle(client, { logger: queryCounter });
  const who = await accountFor(db, "peter@example.com");
  await createProject(db, { id: "prj-trace", owner: who, slug: "trace", name: "Trace" });
  const store = await storeFor(db, { kind: "browser", account: who, reach: [] }).project("prj-trace");
  assert.ok(!isRefusal(store));
  for (const i of [0, 1, 2]) {
    await store.put(`truth/t${i}.md`, `---\nid: t${i}\ntitle: T${i}\nexists: kept\n---\n\nT${i}.\n`);
  }

  const said = [];
  const realWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    const s = String(chunk);
    if (s.startsWith("[productos] GET") || s.startsWith("[productos] POST")) said.push(s.trim());
    return realWrite(chunk, ...rest);
  };

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url ?? "/", "http://localhost").pathname;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404);
    res.end("no");
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/p/prj-trace`;
  /**
   * ⛔ SIGNED IN, OR THIS MEASURES A 401. My sweep harness made exactly this mistake and timed six
   * auth refusals at 0-18ms, which read like the instance was instant.
   */
  const { session } = await singleAccount(db, "peter@example.com");
  const COOKIE = { cookie: `productos_session=${session}` };

  try {
    const first = await fetch(`${base}/api/v2/corpus`, { headers: COOKIE });
    const body = await first.text();
    assert.equal(first.status, 200, `the request failed: ${body.slice(0, 120)}`);

    assert.ok(said.length >= 1, "a request produced no line at all");
    const mine = said.find((l) => l.includes("/api/v2/corpus"));
    assert.ok(mine, `no line for the request that was made: ${said.join(" | ")}`);

    /** ⛔ The counts have to be REAL, which is the whole point — a line of zeroes is no line. */
    const queries = Number(/db=(\d+)q/.exec(mine)?.[1] ?? "0");
    assert.ok(queries > 0, `the line says db=${queries}q for a request that read a corpus: ${mine}`);
    const bytes = Number(/ (\d+)b /.exec(mine)?.[1] ?? "0");
    assert.ok(bytes > 100, `the line says ${bytes}b for a response of ${body.length}: ${mine}`);
    assert.match(mine, /corpus=(read|cached)/, `the line does not say where the corpus came from: ${mine}`);

    /** ⛔ And a second read must say it reused what the first one read, or the caching is not working. */
    await (await fetch(`${base}/api/v2/corpus`, { headers: COOKIE })).text();
    const second = said.filter((l) => l.includes("/api/v2/corpus")).at(-1);
    assert.match(second, /corpus=cached/, `the second read did not reuse the first: ${second}`);
    assert.match(second, /dir=reused/, `the second read laid the corpus out again: ${second}`);
  } finally {
    process.stderr.write = realWrite;
    server.close();
  }
});
