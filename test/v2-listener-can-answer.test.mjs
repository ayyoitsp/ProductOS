/**
 * ⛔ THE LISTENER'S HALF OF THE TWO-WAY WINDOW, AGAINST A HOSTED INSTANCE.
 *
 * Peter: "i want you to be the main 'listener' to session on productos:4100 to handle response from
 * the user".
 *
 * That instance has a database behind it, and three things a listener needs did not exist on that
 * path — each one shipped, each one looking healthy from the outside:
 *
 *   1. NO WAY TO REPLY. `notes say` had no remote branch, `/api/v2/say` did not exist, and MCP had
 *      only `close_note`. So the window Peter asked for was write-only wherever it mattered: the
 *      page could SHOW replies (`/api/v2/thread`) that nothing could WRITE, and the only place to
 *      answer was the chat window he is deliberately moving away from.
 *   2. NO WAY TO CLOSE. An authored change could not be recorded as done, so the request came back
 *      on every poll forever and the page went on saying somebody was waiting.
 *   3. PRESENCE WAS SILENTLY DROPPED. `presence.ts` writes `events/sessions.json` beside the
 *      corpus; the hosted path materializes the corpus into a temp directory and deletes it in a
 *      `finally`, and `corpusFiles` carries only `.md`/`.yaml`. Every heartbeat was written and
 *      thrown away, so `/api/v2/presence` answered `working: []` forever — to the person who had
 *      just pressed send. Twice on the record: *"Nobody is working on this right now"* →
 *      *"again??????"*.
 *
 * ⛔ DRIVEN OVER HTTP AGAINST A REAL STORE, not asserted against the functions. All three defects
 * were in the ADAPTER between a route and a database; every one of them would have passed a test
 * that called `replyToNote` or `seen` directly, because those were never the broken part.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { instanceRoute, createProject } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, singleAccount } from "../dist/v2/store/identity.js";
import { importFromDisk } from "../dist/v2/store/corpus.js";
import { loadFromStore } from "../dist/v2/store/corpus.js";

const CLI = path.resolve("dist/cli/index.js");

async function hosted() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));

  const ada = await accountFor(db, "ada@example.com");
  await createProject(db, { id: "prj-ada", owner: ada, slug: "wallet", name: "Family Wallet" });
  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-ada");
  assert.ok(!isRefusal(store));

  const dir = path.join(temp("productos-listener-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  await importFromDisk(store, dir);

  const { session } = await singleAccount(db, "ada@example.com");
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((r) => server.listen(0, r));
  return { db, store, server, session, base: `http://127.0.0.1:${server.address().port}` };
}

const call = async (base, route, { method = "GET", body, session } = {}) => {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { "content-type": "application/json", ...(session ? { cookie: `productos_session=${session}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
};

const scopeIn = async (store) => {
  const corpus = await loadFromStore(store);
  const scope = corpus.scopes.find((s) => !s.scope.in);
  assert.ok(scope, "the seeded corpus has no top-level scope");
  return scope.scope.id;
};

test("a request filed on a hosted instance can be answered where it was filed, and then closed", async () => {
  const { base, session, server, store } = await hosted();
  try {
    const about = await scopeIn(store);

    const filed = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "note", about, says: "this screen says nothing about what happens next" },
    });
    assert.equal(filed.status, 200, `filing failed: ${JSON.stringify(filed.body)}`);

    const open = await call(base, `/p/prj-ada/api/v2/thread?about=${encodeURIComponent(about)}`, { session });
    const note = open.body.notes.find((n) => n.state === "open");
    assert.ok(note, "the note was not readable on the thread it was filed against");
    assert.deepEqual(note.replies, [], "a fresh note already had a reply");

    /**
     * ⛔ THE WHOLE POINT: the reply lands, and it lands WITHOUT closing the request. A listener whose
     * only way to be heard is `close` either closes work it has not finished or says nothing.
     */
    const said = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "say", note: note.id, says: "the framework had no field for this — adding one, then I will redraw it" },
    });
    assert.equal(said.status, 200, `replying failed: ${JSON.stringify(said.body)}`);

    const mid = await call(base, `/p/prj-ada/api/v2/thread?about=${encodeURIComponent(about)}`, { session });
    const answered = mid.body.notes.find((n) => n.id === note.id);
    assert.equal(answered.state, "open", "replying closed the request");
    assert.equal(answered.replies.length, 1, "the reply was not written where he was standing");
    assert.match(answered.replies[0].says, /no field for this/);

    /** ⛔ AND IT SURVIVED THE REQUEST. A reply written into the temp corpus and not carried back
     *  would read correctly from the same process and be gone on the next one. */
    const reloaded = await loadFromStore(store);
    const stored = reloaded.notes.find((n) => n.id === note.id);
    assert.equal(stored.replies.length, 1, "the reply never reached the store");

    const closed = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "close", note: note.id, outcome: "added the field and redrew the screen" },
    });
    assert.equal(closed.status, 200, `closing failed: ${JSON.stringify(closed.body)}`);

    /** ⛔ Closing is the only thing that takes it off the queue — so the queue has to agree. */
    const after = await call(base, "/p/prj-ada/api/v2/presence", { session });
    assert.equal(after.body.waiting, 0, "a closed request is still counted as waiting");

    const inbox = await call(base, "/p/prj-ada/api/v2/inbox", { method: "POST", session, body: { since: 0 } });
    assert.equal(
      inbox.body.events.filter((e) => e.work).length,
      0,
      "a closed note still owes work, so it comes back on every poll"
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("an outcome is still required to close a request over the wire", async () => {
  const { base, session, server, store } = await hosted();
  try {
    const about = await scopeIn(store);
    await call(base, "/p/prj-ada/api/v2/in", { method: "POST", session, body: { intent: "note", about, says: "something is wrong here" } });
    const open = await call(base, `/p/prj-ada/api/v2/thread?about=${encodeURIComponent(about)}`, { session });
    const note = open.body.notes.find((n) => n.state === "open");

    /**
     * ⛔ ONE REFUSAL, NOT TWO. The route does not re-check this — a second gate written beside the
     * first is how the two come to disagree about what an acceptable outcome is.
     */
    const bare = await call(base, "/p/prj-ada/api/v2/in", { method: "POST", session, body: { intent: "close", note: note.id, outcome: "" } });
    assert.equal(bare.status, 422, "a request was closed with no account of what happened");

    const missing = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "say", note: "n-nothing", says: "hello" },
    });
    assert.equal(missing.status, 422, "a reply was accepted on a note that does not exist");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a listening session is reported as working, on an instance with a database behind it", async () => {
  const { base, session, server } = await hosted();
  try {
    const quiet = await call(base, "/p/prj-ada/api/v2/presence", { session });
    assert.deepEqual(quiet.body.working, [], "somebody was reported listening before anybody had");

    /** ⛔ A CLAIMING READ IS WHAT COUNTS. A status display looking at the queue is not working it. */
    const looked = await call(base, "/p/prj-ada/api/v2/inbox", { method: "POST", session, body: { since: 0 } });
    assert.equal(looked.status, 200);
    const still = await call(base, "/p/prj-ada/api/v2/presence", { session });
    assert.deepEqual(still.body.working, [], "a non-claiming read was reported as somebody working");

    await call(base, "/p/prj-ada/api/v2/inbox", { method: "POST", session, body: { since: 0, claim: "the-listener" } });

    /**
     * ⛔ READ ON A SEPARATE REQUEST, WHICH IS THE WHOLE DEFECT. The heartbeat and the answer are
     * two trips through a materialization that is deleted in between, so this passing is the only
     * evidence the beat outlived the request that made it.
     */
    const now = await call(base, "/p/prj-ada/api/v2/presence", { session });
    assert.deepEqual(
      now.body.working.map((w) => w.session),
      ["the-listener"],
      "a listening session was not reported — the page would say nobody is working"
    );

    /** ⛔ One row per listener, not one per beat, or a long-lived listener fills the table. */
    await call(base, "/p/prj-ada/api/v2/inbox", { method: "POST", session, body: { since: 0, claim: "the-listener" } });
    const again = await call(base, "/p/prj-ada/api/v2/presence", { session });
    assert.equal(again.body.working.length, 1, "each heartbeat added a listener instead of moving one");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a press on a hosted instance reaches an open stream, which it never did", async () => {
  const { base, session, server, store } = await hosted();
  /**
   * ⛔ DRIVEN, NOT REASONED ABOUT. This defect is invisible from the outside by construction: the
   * connection opens, the heartbeat arrives, and the page looks completely up to date while every
   * press goes unannounced. The only evidence is a press made with a stream already open.
   */
  const ac = new AbortController();
  try {
    const about = await scopeIn(store);
    const res = await fetch(`${base}/p/prj-ada/api/v2/live`, {
      headers: { accept: "text/event-stream", cookie: `productos_session=${session}` },
      signal: ac.signal,
    });
    assert.equal(res.status, 200);

    const frames = [];
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const pump = (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) if (p.includes("event: changed")) frames.push(p);
      }
    })().catch(() => {});

    /** ⛔ The first frame is the `retry:` preamble, so wait for the stream to be established. */
    const changed = new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = setInterval(() => {
        if (frames.length) {
          clearInterval(tick);
          resolve(frames[0]);
        } else if (Date.now() - started > 8000) {
          clearInterval(tick);
          reject(new Error("the stream announced nothing — a press on a hosted instance reached no reader"));
        }
      }, 50);
    });

    await new Promise((r) => setTimeout(r, 300));
    const filed = await call(base, "/p/prj-ada/api/v2/in", {
      method: "POST",
      session,
      body: { intent: "note", about, says: "the stream has to carry this" },
    });
    assert.equal(filed.status, 200, `filing failed: ${JSON.stringify(filed.body)}`);

    const frame = await changed;
    assert.match(frame, /the stream has to carry this/, "the frame did not carry what was recorded");

    /** ⛔ ONCE, NOT TWICE. A publish and the poll underneath both deliver the same row, and
     *  announcing a press twice reads as two presses. */
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(frames.length, 1, `one press was announced ${frames.length} times`);

    ac.abort();
    await pump;
  } finally {
    ac.abort();
    await new Promise((r) => server.close(r));
  }
});
