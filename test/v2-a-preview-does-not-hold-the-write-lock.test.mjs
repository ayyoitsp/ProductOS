/**
 * ⛔ A QUESTION HELD THE PROJECT'S WRITE LOCK, AND THREE ROLES HIT IT IN ONE DAY.
 *
 * The lock decided what a write was from the HTTP method:
 *
 *     const mutating = req.method !== "GET" && req.method !== "HEAD";
 *
 * So every POST serialized against every other — and `/api/v2/preview`, which exists to show
 * somebody what an act WOULD do, is both the slowest POST and the one that changes nothing.
 * `preview()` calls `loadCorpus` and returns `{ ok, reads }`. It is a POST because it carries a
 * body, which is a fact about HTTP and not about the corpus.
 *
 * Three roles scoping this corpus in parallel reported the same failure independently, hours apart:
 *
 *     {"error":"busy","message":"another write to this project has been running for 479s and has
 *      not finished … the instance needs a restart"}
 *
 * one of them a `POST /api/v2/preview` that hung for 424 seconds with every write queued behind it,
 * another measuring ~580s and recovering only by verify-and-retry against `/api/v2/corpus`. The
 * lock did exactly what it was told; what it was told was that a question is a write.
 *
 * ⛔ THE LOCK IS RIGHT AND STAYS. Two concurrent writes to one project materialize the same corpus
 * twice and the second simply does not contain the first — silent loss. Narrowing WHICH requests
 * take it is not weakening it, which is why the half of this file that matters most is the half
 * asserting that everything else still takes it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { takesTheWriteLock, __serializeForTest } = await import("../dist/v2/store/instance.js");

test("a preview takes no write lock", () => {
  assert.equal(takesTheWriteLock("POST", "/api/v2/preview"), false);
  /** ⛔ However it is spelled by a caller — a query string and a trailing slash are the same route. */
  assert.equal(takesTheWriteLock("POST", "/api/v2/preview/"), false);
  assert.equal(takesTheWriteLock("POST", "/api/v2/preview?ref=money%23balance"), false);
});

test("every other POST still takes it", () => {
  /**
   * ⛔ THE NON-VACUOUS HALF, AND THE ONE A REGRESSION WOULD BREAK SILENTLY. A fix that returned
   * false for everything would pass the test above and reintroduce the silent-loss bug the lock
   * exists for — two writes materializing one corpus, the second not containing the first.
   */
  for (const route of [
    "/api/v2/in",
    "/api/v2/inbox",
    "/api/v2/act",
    "/api/v2/section",
    "/api/v2/anything-added-later",
    "/v2",
  ]) {
    assert.equal(takesTheWriteLock("POST", route), true, `${route} stopped taking the write lock`);
  }
});

test("a read is still a read", () => {
  for (const route of ["/api/v2/corpus", "/api/v2/live", "/api/v2/preview", "/v2"]) {
    assert.equal(takesTheWriteLock("GET", route), false, `GET ${route} took the write lock`);
    assert.equal(takesTheWriteLock("HEAD", route), false, `HEAD ${route} took the write lock`);
  }
});

test("a route this does not know about writes, by default", () => {
  /**
   * ⛔ AN ALLOWLIST, not a guess at names. A route added later writes until somebody who checked it
   * writes nothing says otherwise. The other direction — assume read, discover it writes — is the
   * silent-loss bug again, and it would arrive as corrupted truth rather than as a slow page.
   */
  assert.equal(takesTheWriteLock("POST", "/api/v2/preview-something-else"), true);
  assert.equal(takesTheWriteLock("POST", "/api/v2/previews"), true);
  assert.equal(takesTheWriteLock("PUT", "/api/v2/preview"), false, "the allowlist is about the route");
  assert.equal(takesTheWriteLock("DELETE", "/api/v2/in"), true);
});

test("what the lock does when it is taken: one at a time, in order", async () => {
  /**
   * ⛔ ASSERTED ON THE REAL `serialize`, so "takes the lock" means something rather than naming a
   * boolean. Two slow operations on one key must not overlap; the same two on different keys must.
   */
  const order = [];
  const slow = (tag, ms) => async () => {
    order.push(`${tag}:start`);
    await new Promise((r) => setTimeout(r, ms));
    order.push(`${tag}:end`);
  };
  await Promise.all([__serializeForTest("one", slow("a", 40)), __serializeForTest("one", slow("b", 10))]);
  assert.deepEqual(order, ["a:start", "a:end", "b:start", "b:end"], "two writes to one project overlapped");

  const both = [];
  const mark = (tag, ms) => async () => {
    both.push(`${tag}:start`);
    await new Promise((r) => setTimeout(r, ms));
    both.push(`${tag}:end`);
  };
  await Promise.all([__serializeForTest("x", mark("x", 40)), __serializeForTest("y", mark("y", 10))]);
  assert.equal(both[0], "x:start");
  assert.equal(both[1], "y:start", "two different projects were serialized against each other");
});
