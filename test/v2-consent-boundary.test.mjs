/**
 * ⛔ A SESSION CAN NEVER MINT CONSENT. IT CAN ONLY CARRY ONE.
 *
 * Tenet 1 is *a human validated this*. Until an instance existed, that was honour-system: the CLI
 * wrote whatever `--by` it was handed, and nothing stopped a model recording `via: page` and a name.
 * An instance is the first place it becomes provable, because the instance issued the browser
 * session that pressed the button and therefore knows the press did not come from a token.
 *
 * ⛔ THE GUARANTEE IS AN ABSENCE, AND AN ABSENCE IS EXACTLY WHAT A REVIEW MISSES. Nobody reading a
 * permission list notices the entry that is not there; a year later somebody adds `accept` to it
 * because a workflow needed it, and every corpus written after that has stamps nobody can prove a
 * human made — with no way to audit which. So the absence is asserted over the whole vocabulary,
 * and adding a scope that grants it fails the build.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import {
  TOKEN_SCOPES,
  mintsHumanConsent,
  mayRecord,
  mayRelay,
  mayClaimHand,
  principalOf,
  HUMAN_VIA,
  HUMAN_HAND,
} from "../dist/v2/identity.js";
import { INTENTS, intentNamed, refuseIntent, handClaimedBy } from "../dist/v2/intents.js";
import { v2Route } from "../dist/v2/serve.js";
import { loadCorpus } from "../dist/v2/load.js";
import { readLog } from "../dist/v2/log.js";

const CLI = path.resolve("dist/cli/index.js");

function instance() {
  const dir = path.join(temp("productos-boundary-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}

const serve = async (dir) => {
  const server = http.createServer(async (req, res) => {
    if (await v2Route(req, res, new URL(req.url, "http://x").pathname, { dir })) return;
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
};

const post = (port, route, body, token) =>
  new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        port,
        path: route,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, body: b ? JSON.parse(b) : {} }));
      }
    );
    req.end(data);
  });

const token = (scopes) => ({ PRODUCTOS_TOKENS: JSON.stringify([{ token: "t-secret", actor: "a session", scopes }]) });

test("no scope in the vocabulary mints human consent", () => {
  assert.ok(TOKEN_SCOPES.length > 0, "an empty vocabulary would pass this vacuously");
  for (const s of TOKEN_SCOPES)
    assert.equal(mintsHumanConsent(s), false, `"${s}" grants the one thing no scope may ever grant`);
});

test("a token is refused every way a person could have agreed", () => {
  const agent = { kind: "token", actor: "a session", scopes: ["read", "author", "relay"] };
  assert.ok(HUMAN_VIA.length >= 4, "the list of human surfaces shrank — this test now proves less");
  for (const via of HUMAN_VIA) {
    const r = mayRecord(agent, via);
    assert.ok(r, `a token was allowed to record "${via}", which claims a person agreed`);
    assert.match(r.why, /token/);
  }
});

test("a token holding every scope there is still cannot agree", () => {
  // ⛔ The point of the absence: no amount of granting reaches it.
  const maximal = { kind: "token", actor: "a session", scopes: [...TOKEN_SCOPES] };
  assert.ok(mayRecord(maximal, "page"), "a fully-scoped token minted human consent");
});

test("a token may land a default, which is not agreement", () => {
  assert.equal(mayRecord({ kind: "token", actor: "x", scopes: ["author"] }, "agent"), null);
  assert.ok(mayRecord({ kind: "token", actor: "x", scopes: ["read"] }, "agent"), "read-only wrote to the corpus");
});

test("a browser session may record a press, because the instance watched it happen", () => {
  assert.equal(mayRecord({ kind: "browser", actor: "peter", session: "s-1", scopes: ["read", "author"] }, "page"), null);
});

test("a bearer token is a token even when it also sends a session cookie", () => {
  const p = principalOf({ authorization: "Bearer t-secret" }, "s-1", token(["author"]).PRODUCTOS_TOKENS ? token(["author"]) : {});
  assert.equal(p.kind, "token", "a cookie promoted a token to a browser — a cookie is the easiest thing here to copy");
});

test("over HTTP, a token claiming `via: page` is refused and writes nothing", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  const before = loadCorpus(dir).verdicts.length;
  const logBefore = readLog(dir).length;
  Object.assign(process.env, token(["read", "author", "relay"]));
  try {
    const scope = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
    const r = await post(port, "/api/v2/in", { intent: "read", ref: scope, via: "page", buildable: false, by: "peter" }, "t-secret");
    assert.equal(r.status, 403, `expected a refusal, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.equal(loadCorpus(dir).verdicts.length, before, "the refusal still wrote a verdict");
    assert.equal(readLog(dir).length, logBefore, "the refusal announced an event, so a session was woken for nothing");
  } finally {
    delete process.env.PRODUCTOS_TOKENS;
    await new Promise((r) => server.close(r));
  }
});

test("a carried press keeps the presser's name and records who carried it", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  Object.assign(process.env, token(["read", "author", "relay"]));
  try {
    const scope = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
    const r = await post(
      port,
      "/api/v2/in",
      { intent: "carry", act: "read", ref: scope, by: "peter", via: "page", buildable: false, note: "pressed on a published page" },
      "t-secret"
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = loadCorpus(dir).verdicts.at(-1);
    assert.equal(v.by, "peter", "the courier's identity became the presser's");
    assert.equal(v.via, "page");
    assert.equal(v.relayed_by, "a session", "nothing records that this instance did not watch it happen");
  } finally {
    delete process.env.PRODUCTOS_TOKENS;
    await new Promise((r) => server.close(r));
  }
});

test("carrying needs the relay scope", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  Object.assign(process.env, token(["read", "author"]));
  try {
    const scope = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
    const r = await post(port, "/api/v2/in", { intent: "carry", act: "read", ref: scope, by: "peter", via: "page", buildable: false }, "t-secret");
    assert.equal(r.status, 403);
  } finally {
    delete process.env.PRODUCTOS_TOKENS;
    await new Promise((r) => server.close(r));
  }
});

test("an unknown scope name in a CONFIGURED token grants nothing", () => {
  const env = { PRODUCTOS_TOKENS: JSON.stringify([{ token: "t", actor: "x", scopes: ["accept", "author"] }]) };
  const p = principalOf({ authorization: "Bearer t" }, undefined, env);
  assert.deepEqual(p.scopes, ["author"], "a scope nobody defined was carried into a permission check");
  assert.ok(mayRecord(p, "page"), "an invented scope name reached the one decision it must never reach");
});

test("a browser press is recorded as the account, not as a name the request asked for", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  try {
    const scope = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
    await post(port, "/api/v2/in", { intent: "read", ref: scope, via: "page", buildable: false, by: "somebody-else" });
    const v = loadCorpus(dir).verdicts.at(-1);
    assert.notEqual(v.by, "somebody-else", "the last forgeable thing on this path is still forgeable");
    assert.equal(v.by, os.userInfo().username || "whoever-is-at-this-machine");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("relaying is its own permission, separate from writing", () => {
  assert.equal(mayRelay({ kind: "token", actor: "x", scopes: ["relay"] }), null);
  assert.ok(mayRelay({ kind: "token", actor: "x", scopes: ["author"] }), "writing implied carrying somebody else's consent");
});

// ---------------------------------------------------------------------------
// ⛔ THE SAME ABSENCE, ASKED ABOUT AUTHORSHIP — THE HOLE A WHOLE DOCUMENT OPENED.
//
// `wrote: {hand, as, from}` is DERIVED everywhere a COMMAND writes it, from the `via` `mayRecord`
// already guards — `wroteBy`'s own comment says a `--hand person` flag "would have been a second
// gate, enforced nowhere, reachable by anything that can spell." The `document` intent is not a
// command: it hands over raw bytes, so an agent token holding `author` could simply TYPE
// `hand: person` and its inference became indistinguishable from a person's draft. That is the
// entire distinction the field exists for — a grooming agent raises an agent's claim as a question
// in the ticket and only stamps a person's.
//
// ⛔ A ZERO PROVES NOTHING UNLESS YOU CAN SAY WHAT A FAILING ZERO LOOKS LIKE, so the three outcomes
// are asserted against each other: the forged claim is REFUSED, the honest `agent` claim LANDS, and
// a person at a browser is UNCHANGED. A guard that refused all three would be a lock on a building
// nobody can enter, and it would pass a test that only asserted the refusal.

const doc = (wrote) =>
  [
    "---",
    "id: forged",
    "title: A feature somebody typed",
    "exchanges:",
    "  - id: ask",
    "    says: What this product does when asked.",
    "    wrote:",
    ...Object.entries(wrote).map(([k, v]) => `      ${k}: ${v}`),
    "---",
    "",
    "Framing only. Governs nothing.",
  ].join("\n");

const PERSONS_HAND = { hand: "person", as: "peter" };
const AGENTS_HAND = {
  hand: "agent",
  as: "productos-machinist",
  from: '"the spend handler in SpendForm.tsx:112"',
};

test("the hand a document claims is read out of the document, at whatever grain holds it", () => {
  assert.equal(handClaimedBy(doc(PERSONS_HAND)), "person");
  assert.equal(handClaimedBy(doc(AGENTS_HAND)), "agent");
  /** ⛔ The migrated case: nothing recorded it, which is an absence and not a value. */
  assert.equal(handClaimedBy("---\nid: forged\ntitle: Carried across verbatim\n---\n\nFraming.\n"), null);
  /** ⛔ `person` wins, because a document claiming both contains the claim that gets gated. */
  assert.equal(
    handClaimedBy(
      [
        "---",
        "id: both",
        "exchanges:",
        "  - id: a",
        "    wrote:",
        "      hand: agent",
        "      from: a transcript somewhere",
        "  - id: b",
        "    wrote:",
        "      hand: person",
        "      as: peter",
        "---",
        "",
      ].join("\n")
    ),
    "person"
  );
  /** ⛔ Bytes nobody can parse still land on disk, so the claim inside them is still found. */
  assert.equal(handClaimedBy("---\n\tid: tabbed\n\twrote: {hand: person, as: peter}\n---\n"), "person");
});

test("a token cannot type a person's hand, whatever scopes it holds", () => {
  const maximal = { kind: "token", actor: "a session", scopes: [...TOKEN_SCOPES] };
  const refused = mayClaimHand(maximal, HUMAN_HAND);
  assert.ok(refused, "a fully-scoped token typed a person's hand — no scope may ever reach this");
  assert.match(refused.why, /hand: person/);
  assert.ok(
    refused.detail.some((d) => /hand: agent/.test(d)),
    "the refusal never said what to do instead, so a session has nowhere to go but round it"
  );
  /** ⛔ And an agent's own claim needs no gate — it is an inference a reviewer can disagree with. */
  assert.equal(mayClaimHand(maximal, "agent"), null);
  assert.equal(mayClaimHand(maximal, null), null);
  /** ⛔ A press the instance watched is a person, which is why this reads the PRINCIPAL. */
  assert.equal(
    mayClaimHand({ kind: "browser", actor: "peter", session: "s-1", scopes: ["read", "author"] }, HUMAN_HAND),
    null
  );
});

test("over HTTP, a token's document claiming `hand: person` is refused and writes nothing", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  Object.assign(process.env, token(["read", "author", "relay"]));
  try {
    const r = await post(
      port,
      "/api/v2/in",
      { intent: "document", key: "truth/forged.md", says: doc(PERSONS_HAND) },
      "t-secret"
    );
    assert.equal(r.status, 403, `expected a refusal, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.match(r.body.why, /token/);
    assert.equal(fs.existsSync(path.join(dir, "truth", "forged.md")), false, "the refusal still wrote the document");
    assert.equal(
      readLog(dir).some((e) => e.ref === "truth/forged.md"),
      false,
      "the refusal announced a corpus change, so every session watching was woken for a write that did not happen"
    );
  } finally {
    delete process.env.PRODUCTOS_TOKENS;
    await new Promise((r) => server.close(r));
  }
});

test("the same document claiming `hand: agent` lands, because that claims nothing about a person", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  Object.assign(process.env, token(["read", "author", "relay"]));
  try {
    const r = await post(
      port,
      "/api/v2/in",
      { intent: "document", key: "truth/forged.md", says: doc(AGENTS_HAND) },
      "t-secret"
    );
    assert.equal(r.status, 200, `an honest agent claim was refused: ${JSON.stringify(r.body)}`);
    const landed = fs.readFileSync(path.join(dir, "truth", "forged.md"), "utf-8");
    assert.match(landed, /hand: agent/);
    assert.doesNotMatch(landed, /hand: person/);
  } finally {
    delete process.env.PRODUCTOS_TOKENS;
    await new Promise((r) => server.close(r));
  }
});

test("a browser press writing the same `hand: person` is unchanged — the instance watched somebody type it", async () => {
  const dir = instance();
  const { server, port } = await serve(dir);
  try {
    const r = await post(port, "/api/v2/in", { intent: "document", key: "truth/forged.md", says: doc(PERSONS_HAND) });
    assert.equal(r.status, 200, `a person at a page was refused their own words: ${JSON.stringify(r.body)}`);
    assert.match(fs.readFileSync(path.join(dir, "truth", "forged.md"), "utf-8"), /hand: person/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("every field a caller supplies wholesale is asked the question — not the one called `says`", () => {
  /**
   * ⛔ THE GUARD IS DECLARED ON THE FIELD, so the next intent that takes a whole document gets it by
   * declaring one. A check keyed on the intent's name, or on a field happening to be called `says`,
   * would be this hole back the first time somebody adds a second raw-bytes intent — which is
   * exactly how this one arrived: every other field is read apart and rebuilt by its `run`, so
   * nothing before `document` needed the question asked at all.
   */
  const raw = INTENTS.flatMap((i) => i.takes.filter((f) => f.raw).map((f) => `${i.name}.${f.name}`));
  assert.deepEqual(raw, ["document.says"], "a raw-bytes field appeared or went away — if it appeared, this is the boundary it needs");
  const asking = { dir: ".", who: { kind: "token", actor: "a session", scopes: ["read", "author"] }, pressing: "a session" };
  for (const named of raw) {
    const [intent, field] = named.split(".");
    assert.ok(
      refuseIntent(intentNamed(intent), asking, { key: "truth/forged.md", [field]: doc(PERSONS_HAND) }),
      `${named} takes bytes wholesale and nothing asked whose hand they claim`
    );
  }
});
