/**
 * ⛔ THE LOOP: A PERSON ASKS FOR A CHANGE, AND A CLAUDE SESSION IS TOLD.
 *
 * Peter: *"we can still route messages to a claude instance, right?"* — and the honest answer when
 * he asked was "yes, but on a fallback". The loop appeared to work for a reason that had nothing to
 * do with the log:
 *
 * `events/log.jsonl` is deliberately NOT in `CORPUS_DIRS` — it is infrastructure, not product
 * truth, so it is not a `documents` row and not part of markdown export. But the hosted adapter
 * only materialized documents, so every append `acts.ts` and `notes.ts` made inside a request went
 * into a directory that was then deleted. Nothing failed, because
 * `carryOpenNotesIntoTheLog` re-derives events for open notes and covered for it. Everything that
 * was not an open note — a press, a `question-answered`, a cursor that had to outlive one request —
 * was lost, and `hosted-plan.md` §8's warning about "two sources of what happened" had quietly
 * come true: the log the inbox read and the log the store kept were different objects.
 *
 * So this asserts the round trip AND that it runs on the real log.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { instanceRoute, materializeProject } from "../dist/v2/store/instance.js";
import { projectMcpRoute } from "../dist/v2/store/mcp.js";
import { createProject } from "../dist/v2/store/instance.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { accountFor, issueToken, singleAccount } from "../dist/v2/store/identity.js";
import { importFromDisk, loadFromStore, LOG_FILE } from "../dist/v2/store/corpus.js";
import { CORPUS_DIRS } from "../dist/v2/load.js";
import { readLog } from "../dist/v2/log.js";
import { worthWaking } from "../dist/mcp/server.js";

const CLI = path.resolve("dist/cli/index.js");

function corpusOnDisk() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "productos-loop-")), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

async function hosted() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));

  const account = await accountFor(db, "me@localhost");
  await createProject(db, { id: "prj-loop", owner: account, slug: "loop", name: "Loop" });
  const store = await storeFor(db, { kind: "browser", account, reach: [] }).project("prj-loop");
  assert.ok(!isRefusal(store));
  await importFromDisk(store, corpusOnDisk());

  const { token } = await issueToken(db, {
    account,
    actor: "a session",
    scopes: ["read", "author", "relay"],
  });
  const { session } = await singleAccount(db, "me@localhost");

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await projectMcpRoute(req, res, p, { db })) return;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, r));
  return { db, store, server, base: `http://127.0.0.1:${server.address().port}`, token, session };
}

const post = async (base, route, body, { token, session } = {}) => {
  const res = await fetch(`${base}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(session ? { cookie: `productos_session=${session}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : {} };
  } catch {
    return { status: res.status, body: { raw: text.slice(0, 200) } };
  }
};

const callTool = async (base, token, name, args) => {
  const res = await fetch(`${base}/p/prj-loop/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  const frame = text.includes("\ndata: ") ? text.split("data: ").at(-1) : text;
  let body;
  try {
    body = JSON.parse(frame.trim());
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  const out = body?.result?.content?.[0]?.text ?? "";
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    parsed = { raw: out.slice(0, 300) };
  }
  return { status: res.status, isError: !!body?.result?.isError, parsed };
};

test("the log is not a corpus document, and must not become one", () => {
  /**
   * ⛔ IF THIS EVER FAILS, MARKDOWN EXPORT HAS GROWN AN EVENT LOG. The log is how a session is told
   * what happened; it is not a claim about the product, and PT-0001's byte-identical round-trip is
   * over documents.
   */
  assert.ok(!CORPUS_DIRS.includes("events"), "the event log became part of the corpus");
});

test("what a request appends to the log survives the request", async () => {
  const { base, server, store, session } = await hosted();
  try {
    const scope = (await loadFromStore(store)).scopes.find((s) => !s.scope.in).scope.id;

    const pressed = await post(
      base,
      "/p/prj-loop/api/v2/act",
      { act: "read", ref: scope, via: "page", buildable: false },
      { session },
    );
    assert.equal(pressed.status, 200, JSON.stringify(pressed.body).slice(0, 200));

    /** ⛔ The act announced something, and the store kept it. This is what used to be deleted. */
    const events = await store.since(0);
    assert.equal(events.length, 1, `the act's announcement did not survive: ${JSON.stringify(events)}`);
    assert.ok(events[0].payload.says, "the event carries no words");

    /** And it comes back out as the log the existing reader parses, at the same position. */
    const { dir, logHad } = await materializeProject(store);
    assert.equal(logHad, 1);
    assert.ok(fs.existsSync(path.join(dir, LOG_FILE)), "the log was not laid out for the reader");
    const parsed = readLog(dir);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].seq, 1, "seq is the line position, and it moved");
    assert.equal(parsed[0].says, events[0].payload.says, "the table and the file disagree");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a note a person files reaches a session, which claims it", async () => {
  const { base, server, store, session, token } = await hosted();
  try {
    const scope = (await loadFromStore(store)).scopes.find((s) => !s.scope.in).scope.id;

    // 1. A person asks for a change, on the page.
    const filed = await post(
      base,
      "/p/prj-loop/api/v2/note",
      { about: scope, says: "pos: this reads thin" },
      { session },
    );
    assert.equal(filed.status, 200, JSON.stringify(filed.body).slice(0, 200));

    const notes = (await loadFromStore(store)).notes;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].by, "me@localhost", "the note is not attributed to the account");
    /** ⛔ The `pos:` tag sets the kind; nothing infers it from the sentence. */
    assert.equal(notes[0].kind, "framework", "the pos: tag did not set the kind");

    // 2. A session reads its inbox over hosted MCP, claiming what it is handed.
    const inbox = await callTool(base, token, "productos_exchange_inbox", {
      since: 0,
      claim: "session-laptop",
    });
    assert.equal(inbox.status, 200);
    assert.ok(!inbox.isError, JSON.stringify(inbox.parsed).slice(0, 300));

    const work = (inbox.parsed.events ?? []).filter((e) => e.work);
    assert.equal(work.length, 1, `the note did not reach the session: ${JSON.stringify(inbox.parsed).slice(0, 400)}`);
    assert.equal(work[0].work, notes[0].id);
    assert.match(work[0].says, /this reads thin/);

    /** ⛔ The thing that decides whether a session is woken at all. */
    assert.equal(worthWaking(inbox.parsed.events), true, "a note did not count as work worth waking for");

    // 3. ⛔ The cursor does NOT advance past work that is not done.
    assert.equal(inbox.parsed.next_cursor, 0, "the cursor moved past a note nobody has acted on");

    // 4. The claim is on the note, and it persisted into the store.
    const claimed = (await loadFromStore(store)).notes[0];
    assert.equal(claimed.claimed_by, "session-laptop", "the lease did not survive the request");
    assert.ok(claimed.claimed_until, "a claim with no expiry would strand the note forever");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a second session sees the note as held rather than taking it twice", async () => {
  const { base, server, store, session, token } = await hosted();
  try {
    const scope = (await loadFromStore(store)).scopes.find((s) => !s.scope.in).scope.id;
    await post(base, "/p/prj-loop/api/v2/note", { about: scope, says: "please reword this" }, { session });

    const first = await callTool(base, token, "productos_exchange_inbox", { since: 0, claim: "session-a" });
    assert.ok((first.parsed.events ?? []).some((e) => e.work), "the first session got nothing");

    const second = await callTool(base, token, "productos_exchange_inbox", { since: 0, claim: "session-b" });
    /**
     * ⛔ THE LEASE IS ON THE NOTE, NOT THE FEED. The second session must still be useful — its whole
     * value is being a second pair of hands — so it sees the feed and is told this one is taken.
     */
    const offered = (second.parsed.events ?? []).filter((e) => e.work);
    const held = second.parsed.held ?? [];
    assert.equal(offered.length, 0, "two sessions were handed the same note");
    assert.equal(held.length, 1, `the second session was not told who holds it: ${JSON.stringify(second.parsed).slice(0, 300)}`);
    assert.equal(held[0].by, "session-a");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("closing a note is what lets the cursor past it", async () => {
  const { base, server, store, session, token } = await hosted();
  try {
    const scope = (await loadFromStore(store)).scopes.find((s) => !s.scope.in).scope.id;
    await post(base, "/p/prj-loop/api/v2/note", { about: scope, says: "pos: fix the generator" }, { session });

    const claimed = await callTool(base, token, "productos_exchange_inbox", { since: 0, claim: "session-a" });
    const noteId = (claimed.parsed.events ?? []).find((e) => e.work).work;

    const closed = await callTool(base, token, "productos_exchange_close_note", {
      id: noteId,
      outcome: "regenerated the page from the corpus",
    });
    assert.ok(!closed.isError, JSON.stringify(closed.parsed).slice(0, 300));

    /** ⛔ The close has to have landed in the store, or the next read re-offers finished work. */
    const after = (await loadFromStore(store)).notes.find((n) => n.id === noteId);
    assert.equal(after.state, "done", "the note is still open after being closed");
    assert.equal(after.outcome, "regenerated the page from the corpus");

    const next = await callTool(base, token, "productos_exchange_inbox", { since: 0, claim: "session-b" });

    /**
     * ⛔ THE CURSOR, NOT THE EVENT LIST. A closed note's event still CARRIES `work` — it is the
     * historical record of what was asked, and replaying from `since: 0` replays history. What
     * changes is that it is no longer *unfinished*, so it stops pinning the cursor.
     *
     * An earlier version of this asserted the event disappeared, which would have meant the log
     * forgot the request as soon as it was handled.
     */
    assert.equal(
      next.parsed.next_cursor,
      next.parsed.head,
      `the cursor is still pinned behind finished work: ${JSON.stringify(next.parsed).slice(0, 300)}`,
    );
    assert.deepEqual(next.parsed.held, [], "a closed note is being reported as held by somebody");

    /** ⛔ And a different session reading it does not pick finished work back up. */
    const reread = (await loadFromStore(store)).notes.find((n) => n.id === noteId);
    assert.equal(reread.state, "done");
    assert.ok(!reread.claimed_by, "a closed note was claimed again by the next reader");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a lease that expires returns the note rather than stranding it", async () => {
  const { base, server, store, session, token } = await hosted();
  try {
    const scope = (await loadFromStore(store)).scopes.find((s) => !s.scope.in).scope.id;
    await post(base, "/p/prj-loop/api/v2/note", { about: scope, says: "needs a rewrite" }, { session });

    const claimed = await callTool(base, token, "productos_exchange_inbox", {
      since: 0,
      claim: "session-doomed",
    });
    const noteId = (claimed.parsed.events ?? []).find((e) => e.work).work;
    assert.ok(noteId);

    /**
     * The session dies holding the lease. ⛔ MODELLED BY MOVING `claimed_until` INTO THE PAST, not
     * by asking for a short lease: `productos_exchange_inbox` takes no `leaseMs` and hardcodes
     * `DEFAULT_LEASE_MS`, so a `leaseMs` argument is silently dropped — which is how the first
     * version of this test "passed" a lease of 1ms and then wondered why nothing expired.
     */
    const docs = await store.documents();
    const notesDoc = Object.keys(docs).find((k) => k.startsWith("notes/"));
    await store.put(
      notesDoc,
      docs[notesDoc].replace(/claimed_until: "[^"]*"/, 'claimed_until: "2020-01-01T00:00:00.000Z"'),
    );
    assert.match((await store.documents())[notesDoc], /2020-01-01/, "the lease was not aged");

    /**
     * ⛔ OTHERWISE A DEAD SESSION STRANDS SOMEBODY'S REQUEST FOREVER. The lease is what makes a
     * crash recoverable without a human noticing it happened.
     */
    const second = await callTool(base, token, "productos_exchange_inbox", { since: 0, claim: "session-alive" });
    const offered = (second.parsed.events ?? []).filter((e) => e.work);
    assert.equal(offered.length, 1, `the note never came back: ${JSON.stringify(second.parsed).slice(0, 300)}`);
    assert.equal((await loadFromStore(store)).notes.find((n) => n.id === noteId).claimed_by, "session-alive");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
