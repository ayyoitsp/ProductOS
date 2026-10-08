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
import { TOKEN_SCOPES, mintsHumanConsent, mayRecord, mayRelay, principalOf, HUMAN_VIA } from "../dist/v2/identity.js";
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
