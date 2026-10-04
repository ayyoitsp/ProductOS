/**
 * ⛔ HOSTING IS THE FIRST PLACE TENET 1 BECOMES PROVABLE, AND THE FIRST PLACE IT CAN BE LOST QUIETLY.
 *
 * `mayRecord` lets any `browser` principal record a press, because locally that claim is true: one
 * person is at the machine and the instance watched them press the button. The moment the instance
 * is reachable from the internet, that same rule says every anonymous request may mint human
 * consent — so the resolver must refuse to produce a `browser` principal it cannot account for.
 *
 * ⛔ THE GUARANTEE IS AGAIN AN ABSENCE. `test/v2-consent-boundary.test.mjs` asserts no token scope
 * reaches a verdict; this asserts no *request* reaches one either, over every way of arriving:
 * nothing, an unknown bearer, a revoked bearer, a cookie nobody issued, an expired session, and a
 * bearer that also carries a valid cookie.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import {
  accountFor,
  requestLogin,
  redeemLogin,
  issueToken,
  revokeToken,
  hashToken,
  principalFrom,
  singleAccount,
  endSession,
} from "../dist/v2/store/identity.js";
import { tokens, sessions } from "../dist/v2/store/schema.js";
import { mayRecord, mayRelay, HUMAN_VIA, TOKEN_SCOPES } from "../dist/v2/identity.js";

async function freshDb() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  return { client, db };
}

const bearer = (t) => ({ authorization: `Bearer ${t}` });

test("a request with no credential is nobody — not a browser with no scopes", async () => {
  const { db } = await freshDb();
  /**
   * ⛔ THE WHOLE POINT. A scopeless `browser` principal would sail through `mayRecord(p, "page")`,
   * because that function gates on `kind` and not on scopes — correctly, since locally a browser
   * principal means the instance watched a person press. So an unidentifiable request must produce
   * no principal at all.
   */
  assert.equal(await principalFrom(db, {}, undefined), null);
  assert.equal(await principalFrom(db, {}, "sess-nobody-issued"), null);
});

test("an unknown or revoked bearer is a token with nothing, never nobody", async () => {
  const { db } = await freshDb();
  const account = await accountFor(db, "ada@example.com");
  const { token, id } = await issueToken(db, {
    account,
    actor: "a session",
    scopes: ["read", "author", "relay"],
  });

  const unknown = await principalFrom(db, bearer("not-a-real-token"));
  assert.equal(unknown.kind, "token", "an unknown credential fell through to the anonymous path");
  assert.deepEqual(unknown.scopes, []);
  assert.ok(mayRecord(unknown, "page"), "an unknown token minted human consent");

  await revokeToken(db, id);
  const revoked = await principalFrom(db, bearer(token));
  assert.equal(revoked.kind, "token");
  assert.deepEqual(revoked.scopes, [], "a revoked token kept its scopes");
  assert.ok(mayRecord(revoked, "agent"), "a revoked token could still write to the corpus");
});

test("a session the instance issued is the only thing that becomes a browser", async () => {
  const { db } = await freshDb();
  const { email, code } = await requestLogin(db, "Ada@Example.com ");
  assert.equal(email, "ada@example.com", "the address was not normalised, so two accounts can exist");

  const redeemed = await redeemLogin(db, email, code);
  assert.ok(redeemed, "a freshly issued code did not redeem");

  const p = await principalFrom(db, {}, redeemed.session);
  assert.equal(p.kind, "browser");
  assert.equal(p.account, redeemed.account);
  assert.equal(p.actor, "ada@example.com", "a browser principal must carry the account, not a guess");
  assert.equal(mayRecord(p, "page"), null, "the one principal that may press, cannot");
});

test("a login code is single use, and expires", async () => {
  const { db } = await freshDb();
  const { email, code } = await requestLogin(db, "ada@example.com");
  assert.ok(await redeemLogin(db, email, code));
  /** ⛔ A code that still works is a code in a mail archive that still works. */
  assert.equal(await redeemLogin(db, email, code), null, "a spent code redeemed twice");

  const stale = await requestLogin(db, "bo@example.com", -1);
  assert.equal(await redeemLogin(db, stale.email, stale.code), null, "an expired code redeemed");

  assert.equal(await redeemLogin(db, email, "wrong-code"), null);
});

test("an expired or ended session stops being a browser", async () => {
  const { db } = await freshDb();
  const { email, code } = await requestLogin(db, "ada@example.com");
  const { session } = await redeemLogin(db, email, code);

  assert.equal((await principalFrom(db, {}, session)).kind, "browser");

  await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, session));
  assert.equal(await principalFrom(db, {}, session), null, "an expired session still pressed");

  const second = await redeemLogin(db, ...Object.values(await requestLogin(db, "ada@example.com")));
  await endSession(db, second.session);
  assert.equal(await principalFrom(db, {}, second.session), null, "signing out left the session usable");
});

test("a bearer token is a token even when it also sends a valid session cookie", async () => {
  const { db } = await freshDb();
  const { email, code } = await requestLogin(db, "ada@example.com");
  const { session, account } = await redeemLogin(db, email, code);
  const { token } = await issueToken(db, { account, actor: "a session", scopes: [...TOKEN_SCOPES] });

  const p = await principalFrom(db, bearer(token), session);
  assert.equal(p.kind, "token", "⛔ a cookie promoted a token — and a cookie is the easiest thing here to copy");
  for (const via of HUMAN_VIA)
    assert.ok(mayRecord(p, via), `a token carrying a real session recorded "${via}"`);
});

test("no way of arriving lets anything but an issued session record a press", async () => {
  const { db } = await freshDb();
  const account = await accountFor(db, "ada@example.com");
  const { token } = await issueToken(db, { account, actor: "a session", scopes: [...TOKEN_SCOPES] });
  const { email, code } = await requestLogin(db, "ada@example.com");
  const { session } = await redeemLogin(db, email, code);

  const arrivals = [
    ["nothing at all", {}, undefined],
    ["an unknown bearer", bearer("nope"), undefined],
    ["a cookie nobody issued", {}, "sess-forged"],
    ["a maximal bearer", bearer(token), undefined],
    ["a maximal bearer plus a real cookie", bearer(token), session],
  ];

  assert.ok(HUMAN_VIA.length >= 4, "the list of human surfaces shrank — this test now proves less");
  let examined = 0;
  for (const [name, headers, cookie] of arrivals) {
    const p = await principalFrom(db, headers, cookie);
    if (p === null) continue; // nobody; the route refuses it
    examined++;
    for (const via of HUMAN_VIA)
      assert.ok(mayRecord(p, via), `⛔ ${name} recorded "${via}" — tenet 1 is gone and nothing says when`);
  }
  /**
   * ⛔ OR THIS TEST PASSES BY PROVING NOTHING. If the resolver ever returned `null` for every
   * arrival, every `mayRecord` call above would be skipped and the suite would still be green.
   */
  assert.ok(examined >= 3, `only ${examined} arrivals produced a principal to check`);
});

test("a token stores only a hash, so reading the table hands over nothing usable", async () => {
  const { db } = await freshDb();
  const account = await accountFor(db, "ada@example.com");
  const { token } = await issueToken(db, { account, actor: "ci", scopes: ["read"] });

  const [row] = await db.select({ hash: tokens.hash }).from(tokens);
  assert.notEqual(row.hash, token, "the credential is in the table in the clear");
  assert.equal(row.hash, hashToken(token));
  assert.ok(!row.hash.includes(token));
});

test("an unknown scope name in a STORE-ISSUED token grants nothing", async () => {
  const { db } = await freshDb();
  const account = await accountFor(db, "ada@example.com");
  const { token } = await issueToken(db, { account, actor: "x", scopes: ["accept", "author"] });
  const p = await principalFrom(db, bearer(token));
  assert.deepEqual(p.scopes, ["author"], "a scope nobody defined was carried into a permission check");
  assert.ok(mayRecord(p, "page"), "an invented scope name reached the one decision it must never reach");
  assert.ok(mayRelay(p), "`accept` was read as relay");
});

test("single-account mode is a real account and a real session, not a bypass", async () => {
  const { db } = await freshDb();
  const { account, session } = await singleAccount(db, "me@localhost");

  const p = await principalFrom(db, {}, session);
  assert.equal(p.kind, "browser", "the local case got a lesser principal");
  assert.equal(p.account, account);
  assert.equal(mayRecord(p, "page"), null);

  /** ⛔ Idempotent — a restart must not mint a second session per boot. */
  const again = await singleAccount(db, "me@localhost");
  assert.equal(again.session, session);
  assert.equal(again.account, account);
});
