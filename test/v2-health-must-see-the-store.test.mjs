import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";

/**
 * ⛔ 4100 FAILED EVERY CORPUS READ FOR NEARLY TWO HOURS AND REPORTED ITSELF HEALTHY THROUGHOUT.
 *
 * 2026-10-13, 11:36:28 → 13:29:08 UTC. All four projects, every request, 500. The container:
 *
 *     restarts=0   health=healthy   docker healthcheck exit=0 at 13:28:57
 *     a request at 13:28:53 and another at 13:29:08 — both 500
 *
 * `/health` answered `{ok:true}` from the fact that its handler ran. It touched no store and read
 * no corpus, so Docker's HEALTHCHECK polls it and never restarted, and `make deploy`'s own "waiting
 * for health" would have passed a container that could not serve a page. A person noticing was the
 * only thing that worked, and it recovered on its own with the diagnosis gone.
 *
 * ⛔ THE SAME SHAPE THIS CODEBASE KEEPS LEGISLATING AGAINST, in the one place nobody put a guard:
 * a surface reporting itself healthy while being broken. `/api/v2/live` had it, the presence banner
 * had it, and the health check had it.
 */


/**
 * The `/health` route's own source, bounded structurally.
 *
 * ⛔ NOT A FIXED NUMBER OF CHARACTERS. Both assertions below used `slice(at, at + 2000)`, and adding
 * a comment to the route pushed `503` past the window — so a correct route failed with "/health
 * cannot answer anything but 200". A test pinned to a byte count is a test that breaks when
 * somebody explains themselves, which is the same family as a matcher stricter than its claim.
 */
const healthRoute = () => {
  const src = fs.readFileSync("src/v2/store/server.ts", "utf-8");
  const at = src.indexOf('pathname === "/health"');
  assert.ok(at > 0, "there is no /health route to read");
  /** To the next route test, which is where this one demonstrably ends. */
  const next = src.indexOf('pathname ===', at + 10);
  return src.slice(at, next > at ? next : src.length);
};

/** A `Db` whose execute fails the way the outage did — wrapper on the outside, sqlstate underneath. */
const brokenDb = (code = "57P01") => ({
  execute: async () => {
    const e = new Error('Failed query: select "id" from "accounts" where "accounts"."email" = $1');
    e.cause = Object.assign(new Error("terminating connection due to administrator command"), { code });
    throw e;
  },
});
const workingDb = () => ({ execute: async () => [{ count: 2 }] });

test("the probe reads a real table, and reports the sqlstate when it cannot", async () => {
  const { storeReachable } = await import("../dist/v2/store/server.js");

  assert.deepEqual(await storeReachable(workingDb()), { ok: true });

  const bad = await storeReachable(brokenDb("57P01"));
  assert.equal(bad.ok, false);
  /** ⛔ The sqlstate, because that is the entire diagnosis and 2037 log lines lacked it. */
  assert.match(bad.why, /57P01/, "the probe does not surface the sqlstate");
  assert.match(bad.why, /administrator command/, "the probe does not surface the underlying message");
});

test("the probe is bounded, so a store that never answers is still a verdict", async () => {
  const { storeReachable } = await import("../dist/v2/store/server.js");
  const hangs = { execute: () => new Promise(() => {}) };
  const started = process.hrtime.bigint();
  const out = await storeReachable(hangs, 150);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(out.ok, false, "a store that never answers came back healthy");
  assert.ok(ms < 2000, `the probe took ${Math.round(ms)}ms — an unbounded probe is a timed-out healthcheck with no reason`);
  assert.match(out.why, /150ms/, "it does not say that nothing answered");
});

test("/health is 503 and says why when the store cannot be read", async () => {
  const { startHosted } = await import("../dist/v2/store/server.js");
  /** Not reachable from here without a store; assert the route's shape from the source instead. */
  const route = healthRoute();
  assert.match(route, /storeReachable/, "/health does not look at the store at all");
  assert.match(route, /503/, "/health cannot answer anything but 200, so it can never report broken");
  assert.match(route, /because/, "/health reports unhealthy without saying why");
  assert.ok(typeof startHosted === "function");
});

test("every caller that gates on health is gating on something that sees the store", () => {
  /**
   * ⛔ BOTH CALLERS, because either one trusting a blind check is the whole defect. Docker's
   * HEALTHCHECK decides whether to restart; the deploy gate decides whether a deploy succeeded.
   */
  const dockerfile = fs.readFileSync("Dockerfile", "utf-8");
  assert.match(dockerfile, /\/health/, "the container healthcheck no longer polls /health");
  assert.match(dockerfile, /r\.ok\?0:1|r\.ok \? 0 : 1/, "the healthcheck ignores the status code, so 503 would read as healthy");

  const mk = fs.readFileSync("Makefile", "utf-8");
  /** ⛔ `curl -fsS` is what makes a 503 a failure rather than a body nobody reads. */
  const wait = mk.slice(mk.indexOf("waiting for health"), mk.indexOf("waiting for health") + 600);
  assert.match(wait, /curl -fsS/, "the deploy's health wait would accept a 503");
  assert.match(wait, /\/health/, "the deploy no longer waits on /health");
});

test("the cause walker has one home, and both paths use it", () => {
  const strip = (p) => fs.readFileSync(p, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /** ⛔ One copy. The compiler fix reached one module of two, shipped, and deployed. */
  const boot = strip("src/v2/store/boot.ts");
  const server = strip("src/v2/store/server.ts");
  for (const [name, text] of [["boot.ts", boot], ["server.ts", server]]) {
    assert.match(text, /becauseOf/, `${name} does not report the underlying cause`);
    assert.doesNotMatch(text, /const becauseOf\s*=|function becauseOf/, `${name} carries its own copy of the walker`);
  }
  assert.match(strip("src/v2/store/because.ts"), /export function becauseOf/, "the one home has moved");
});

/**
 * ⛔ A READABLE STORE IS NOT A WRITABLE ONE, AND THIS ENDPOINT LEARNED THAT THE SECOND TIME.
 *
 * It was taught to read the store after it reported healthy through a two-hour outage. Then staging
 * answered GETs on all four projects while POSTs to two of them hung forever — and it was green
 * again, because reading was exactly what still worked. One abandoned client held a per-project
 * write lock; Postgres had no open transaction and no ungranted lock, so there was nothing in the
 * store to find.
 */
test("/health is 503 when a project's write is stuck, and names it", async () => {
  const { stuckWrites } = await import("../dist/v2/store/instance.js");
  assert.equal(typeof stuckWrites, "function", "nothing can report a stuck write");
  /** Nothing in flight in this process, so the honest answer is none. */
  assert.deepEqual(stuckWrites(0), []);

  const body = healthRoute();
  assert.match(body, /stuckWrites/, "/health does not ask whether a write is stuck");
  assert.match(body, /stuck\.length/, "/health computes it and then ignores it");
  assert.match(body, /writes/, "/health reports unhealthy without saying it is the writes");
});

/**
 * ⛔ AND A REFUSAL MUST NOT ARRIVE AS 500. "This server is broken" and "another write on this
 * project is stuck" are different facts, and the status is the only part a client can act on.
 */
test("an error carrying a status gets that status, not 500", () => {
  const src = fs.readFileSync("src/v2/store/server.ts", "utf-8");
  const at = src.indexOf("internal_error");
  const around = src.slice(Math.max(0, at - 900), at + 200);
  assert.match(around, /status/, "the handler cannot carry a refusal's own status");
  assert.match(around, /503|code/, "every failure is reported as 500");
});
