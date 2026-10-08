/**
 * ⛔ AUTHORING AGAINST A HOSTED CORPUS NEEDED AN INTENT, NOT AN ENDPOINT — and I said otherwise.
 *
 * Peter: *"why do we need an endpoint to write a corpus doc?"*
 *
 * We did not, and I had answered that question before the single door existed. Once `/api/v2/in`
 * landed, every piece was already here:
 *
 *   · the door — one input, routed by a named intent
 *   · the authority — the `author` gate: this principal's own words, claiming nothing about what
 *     anybody agreed to
 *   · the persistence — `writeBack` diffs `corpusFiles(dir)` against what the request was handed
 *     and stores whatever moved, refusing with a 409 if somebody else moved it underneath
 *
 * So it cost fifteen lines in `INTENTS`. Which is the point his question about endpoint sprawl was
 * making: a new capability should cost an intent, and if it costs a route then the door is not
 * doing its job.
 *
 * ⛔ DRIVEN OVER HTTP AGAINST A REAL STORE, for the reason the listener test gives: the interesting
 * part is the adapter between a route and a database. Calling the intent's `run` directly would
 * assert the fifteen lines and skip `writeBack`, which is the half I was wrong about.
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
import { importFromDisk, loadFromStore } from "../dist/v2/store/corpus.js";
import { CORPUS_DIRS } from "../dist/v2/load.js";

const CLI = path.resolve("dist/cli/index.js");

const LEDGER = `---
id: ledger
title: The ledger
does: Holds every movement of a kid's money as an append-only record, and answers what a kid has now.
---

Written over the wire, into a store, by a role that has no filesystem to write to.
`;

async function hosted() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const ada = await accountFor(db, "ada@example.com");
  await createProject(db, { id: "prj-doc", owner: ada, slug: "wallet", name: "Family Wallet" });
  const store = await storeFor(db, { kind: "browser", account: ada, reach: [] }).project("prj-doc");
  assert.ok(!isRefusal(store));

  const dir = path.join(temp("productos-doc-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  await importFromDisk(store, dir);

  const { session } = await singleAccount(db, "ada@example.com");
  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (await instanceRoute(req, res, p, { db })) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const ask = (body) =>
    fetch(`${base}/p/prj-doc/api/v2/in`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `productos_session=${session}` },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  return { store, server, ask };
}

test("a document written through the one door reaches the store and loads as a corpus", async () => {
  const { store, server, ask } = await hosted();
  try {
    const wrote = await ask({ intent: "document", key: "capabilities/ledger.md", says: LEDGER });
    assert.equal(wrote.status, 200, `the write was refused: ${JSON.stringify(wrote.body)}`);
    assert.match(wrote.body.said, /capabilities\/ledger\.md/);

    /** ⛔ In the STORE, which is the half a unit test of the intent would have skipped. */
    const docs = await store.documents();
    assert.equal(docs["capabilities/ledger.md"], LEDGER, "the document did not reach the store intact");

    /** And it is a corpus afterwards, not just bytes. */
    const corpus = await loadFromStore(store);
    assert.deepEqual(corpus.broken, [], `the written document does not parse: ${JSON.stringify(corpus.broken)}`);
    assert.deepEqual(
      corpus.capabilities.map((c) => c.capability.id),
      ["ledger"],
      "the part is in the store and not in the corpus"
    );
  } finally {
    server.close();
  }
});

/**
 * ⛔ WRITING IS NOT AGREEING, and this is the one that matters for tenet 1. A document authored over
 * the wire arrives unaccepted; the stamp is a separate act, by a person, through its own intent.
 */
test("a document written this way is not accepted by having been written", async () => {
  const { store, server, ask } = await hosted();
  try {
    await ask({ intent: "document", key: "capabilities/ledger.md", says: LEDGER });
    const corpus = await loadFromStore(store);
    assert.equal(corpus.verdicts.length, 0, "authoring a document recorded a verdict");
  } finally {
    server.close();
  }
});

/**
 * ⛔ WHAT A CORPUS IS MADE OF DECIDES WHAT IS WRITABLE. `corpusFiles` is the one answer to that
 * question — `load.ts` says `memoryStore` must agree with it — so a key it does not enumerate would
 * be written into the materialized directory and then silently dropped by `writeBack`, answering
 * `ok` for work that vanished. Refused instead.
 */
test("a key that leaves the corpus, or is not part of one, is refused rather than dropped", async () => {
  const { store, server, ask } = await hosted();
  try {
    const before = await store.documents();
    for (const [key, why] of [
      ["../escape.md", /leaves the corpus/],
      ["/etc/passwd", /leaves the corpus/],
      ["notacorpusdir/x.md", /not part of a corpus/],
    ]) {
      const r = await ask({ intent: "document", key, says: "x" });
      assert.equal(r.status, 422, `${key} was not refused: ${JSON.stringify(r.body)}`);
      assert.match(r.body.why, why);
    }
    /** A missing key, and a document with nothing in it — which is a deletion wearing a write. */
    assert.match((await ask({ intent: "document", says: "x" })).body.why, /say which document/);
    assert.match((await ask({ intent: "document", key: "truth/x.md", says: "   " })).body.why, /deletion/);

    assert.deepEqual(await store.documents(), before, "a refused write changed the store anyway");
  } finally {
    server.close();
  }
});

/** ⛔ Every directory the corpus has is writable, or the gap is a layer nobody can author remotely. */
test("every corpus directory can be written to", async () => {
  const { server, ask } = await hosted();
  try {
    for (const d of CORPUS_DIRS) {
      const r = await ask({ intent: "document", key: `${d}/probe.md`, says: "# probe\n" });
      assert.equal(r.status, 200, `${d}/ cannot be authored over the wire: ${JSON.stringify(r.body)}`);
    }
  } finally {
    server.close();
  }
});

/**
 * ⛔ IT ANNOUNCES. `writeBack` deliberately synthesizes nothing — "a write path that moves a
 * document and says nothing is a gap in THAT path" — so without an event a role could rewrite a
 * feature and no session watching the log would hear it.
 */
test("writing a document tells whoever is watching", async () => {
  const { server, ask, store } = await hosted();
  try {
    await ask({ intent: "document", key: "truth/another.md", says: "---\nid: another\ntitle: Another\n---\n" });
    /**
     * ⛔ `store.since`, NOT `store.documents` — and the first version of this test looked in the
     * wrong place. `events/` is deliberately absent from `corpusFiles`: "a `documents` row would put
     * a heartbeat in markdown export and in a packet". The log is its own thing, carried by
     * `appendedLines` and `store.append`, so asking `documents()` for it finds nothing and says the
     * write announced nothing.
     */
    const events = await store.since(0);
    assert.ok(
      events.some((e) => e.kind === "corpus-changed"),
      `nothing announced the write: ${events.map((e) => e.kind).join(", ") || "an empty log"}`
    );
  } finally {
    server.close();
  }
});
