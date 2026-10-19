/**
 * ⛔ LOOKING AT THE QUEUE TOOK THE PROJECT'S WRITE LOCK, SO WATCHERS BLOCKED THE PERSON PRESSING.
 *
 * Peter: *"page loads are stiill slow, i get stuck and can't even open a page sometimes"*.
 *
 * Measured on the live instance before the fix — six concurrent polls of `/api/v2/inbox`, which is
 * what the two-way window produces whenever more than one session is watching a project:
 *
 *     one poll      1.0s
 *     six at once   0.96 · 1.67 · 2.39 · 3.03 · 3.77 · 4.58s
 *
 * A staircase, about 0.7s a step — each waiting for the one before. `takesTheWriteLock` exempts GET
 * and HEAD and one named POST, and this was a POST, so every watcher held the lock for about a second
 * and anything he PRESSED queued behind all of them. At 120s `serialize` refuses outright with "a
 * write has been running for Ns" — which is the four wedged projects that needed a restart hours
 * earlier the same day, diagnosed then as a store fault. It was polling.
 *
 * ⛔ AND THE ROUTE COULD NOT JUST JOIN `READ_SHAPED_POSTS`. A POST carrying `claim` takes a lease,
 * which is a real write, so exempting the route by name would let two sessions claim one note with no
 * lock between them — the thing `v2-store-loop` exists to catch. The allowlist's own comment warns
 * about exactly that direction: assume read, discover it writes.
 *
 * ⛔ THE ASSERTIONS ARE ON THE LOCK DECISION, NOT ON WALL-CLOCK TIME. A test that timed six requests
 * would be the most load-sensitive thing in a suite that already produced eleven load flakes in one
 * day — and it would fail on a busy machine while the code was correct, which is worse than no test.
 * `takesTheWriteLock` is the function the server actually asks, so it is what gets asked here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { takesTheWriteLock } from "../dist/v2/store/instance.js";

test("looking at the queue takes no lock; claiming takes one", () => {
  assert.equal(takesTheWriteLock("GET", "/api/v2/inbox"), false, "a look still serialises against every other look");
  assert.equal(takesTheWriteLock("GET", "/api/v2/inbox?since=42&limit=5"), false, "a cursor made it a write again");
  /**
   * ⛔ THE HALF THAT MUST NOT MOVE. If this ever returns false, two sessions can take the same note
   * and neither is told — and the note's own lease is what was supposed to prevent it.
   */
  assert.equal(takesTheWriteLock("POST", "/api/v2/inbox"), true, "claiming a note no longer serialises");
});

test("⛔ and the route was not simply added to the read-shaped list, which would have broken claiming", () => {
  const src = fs.readFileSync("src/v2/store/instance.ts", "utf-8");
  const list = src.slice(src.indexOf("READ_SHAPED_POSTS = new Set("), src.indexOf(")", src.indexOf("READ_SHAPED_POSTS = new Set(")) + 1);
  assert.doesNotMatch(
    list,
    /api\/v2\/inbox/,
    "inbox is exempt as a POST, so a claim writes a lease with no lock and two sessions can take one note"
  );
});

test("the client looks with a GET and claims with a POST", () => {
  /**
   * ⛔ LIFTED FROM THE CLIENT, because the server's half is worthless if every caller still POSTs. The
   * sessions polling this route are the load, so the fix only arrives when they change verb.
   */
  const src = fs.readFileSync("src/v2/client.ts", "utf-8");
  const fn = src.slice(src.indexOf("export const inbox ="), src.indexOf("\n};", src.indexOf("export const inbox =")));
  assert.match(fn, /if \(o\.claim\)/, "the client no longer distinguishes a claim from a look");
  assert.match(fn, /method: "POST"/, "a claim is not a POST any more, so it would skip the lock");
  assert.match(fn, /method: "GET"/, "a look is still a POST, so watchers still block the person pressing");
  /** The cursor has to survive the change of verb, or a poll re-reads the whole queue every time. */
  assert.match(fn, /q\.set\("since"/, "the cursor is dropped on the GET path");
  assert.match(fn, /q\.set\("limit"/, "the limit is dropped on the GET path");
});

test("⛔ the server answers a look on the GET path, and the POST path is untouched", () => {
  const src = fs.readFileSync("src/v2/serve.ts", "utf-8");
  assert.match(src, /req\.method === "GET" && p === "\/api\/v2\/inbox"/, "there is no read path, so the client's GET 404s");
  assert.match(src, /req\.method === "POST" && p === "\/api\/v2\/inbox"/, "the claim path was removed");
  /**
   * ⛔ AND THE READ PATH MUST NOT ACCEPT A CLAIM. If it ever reads `claim` from the query string, the
   * lock exemption becomes the silent-loss bug with a different spelling — and it would look like a
   * convenience.
   */
  const get = src.slice(src.indexOf('req.method === "GET" && p === "/api/v2/inbox"'));
  const body = get.slice(0, get.indexOf('req.method === "POST" && p === "/api/v2/inbox"'));
  assert.doesNotMatch(body, /claim:/, "the GET path takes a claim, so claiming can now skip the lock");
});
