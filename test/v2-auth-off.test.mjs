/**
 * ⛔ AUTH OFF IS A REAL STATE WITH A REAL COST, SO IT IS TESTED LIKE ONE.
 *
 * Peter: *"just disable auth for now until we're ready to implement a full flow"*. There is no
 * sign-in route, so the alternatives were single-account mode or a session minted from a terminal —
 * and the second 404s the moment you name an address that is not the project's owner, which reads
 * as a broken login rather than a different account.
 *
 * Two things have to hold, and they pull in opposite directions:
 *
 *   1. With it ON, nothing is in the way: any request is a signed-in person, any project is
 *      reachable, and a press records.
 *   2. With it OFF — which is the default, and anything other than the exact string `off` — every
 *      boundary is exactly where it was. ⛔ A switch that half-disables is worse than none, because
 *      an instance would be unprotected while appearing not to be.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "../dist/v2/store/migrate.js";
import { authIsOff, principalFrom, accountFor } from "../dist/v2/store/identity.js";
import { storeFor, isRefusal } from "../dist/v2/store/access.js";
import { createProject } from "../dist/v2/store/instance.js";
import { mayRecord, HUMAN_VIA } from "../dist/v2/identity.js";

async function twoOwners() {
  const client = new PGlite();
  const db = drizzle(client);
  await applyMigrations((sql) => client.exec(sql));
  const ada = await accountFor(db, "ada@example.com");
  const bo = await accountFor(db, "bo@example.com");
  await createProject(db, { id: "prj-ada", owner: ada, slug: "a", name: "A" });
  await createProject(db, { id: "prj-bo", owner: bo, slug: "b", name: "B" });
  return { db, ada, bo };
}

test("only the exact string `off` disables it", () => {
  assert.equal(authIsOff({}), false, "absent must mean on");
  assert.equal(authIsOff({ PRODUCTOS_AUTH: "" }), false);
  assert.equal(authIsOff({ PRODUCTOS_AUTH: "on" }), false);
  /** ⛔ Not "false", not "0", not "no" — a half-set environment must leave auth ON. */
  assert.equal(authIsOff({ PRODUCTOS_AUTH: "false" }), false);
  assert.equal(authIsOff({ PRODUCTOS_AUTH: "0" }), false);
  assert.equal(authIsOff({ PRODUCTOS_AUTH: "disabled" }), false);

  assert.equal(authIsOff({ PRODUCTOS_AUTH: "off" }), true);
  assert.equal(authIsOff({ PRODUCTOS_AUTH: " OFF " }), true, "whitespace and case are forgiven");
});

test("with auth off, a request with nothing on it is a signed-in person", async () => {
  const { db } = await twoOwners();
  const env = { PRODUCTOS_AUTH: "off", PRODUCTOS_SINGLE_ACCOUNT: "me@localhost" };

  const p = await principalFrom(db, {}, undefined, env);
  assert.ok(p, "auth off still produced nobody");
  assert.equal(p.kind, "browser");
  assert.equal(p.actor, "me@localhost");
  /** The cost, stated as an assertion: this principal can record agreement. */
  for (const via of HUMAN_VIA) assert.equal(mayRecord(p, via), null, `cannot record ${via}`);
});

test("with auth off, a bearer token is not treated as a token", async () => {
  const { db } = await twoOwners();
  const env = { PRODUCTOS_AUTH: "off" };
  /**
   * ⛔ Checked BEFORE the bearer branch. An unrecognised token would otherwise come back as a
   * principal holding no scopes, which behaves exactly like auth still being on — the switch would
   * appear not to work for the one caller most likely to be testing it.
   */
  const p = await principalFrom(db, { authorization: "Bearer whatever" }, undefined, env);
  assert.equal(p.kind, "browser", "a token still came back as a token with auth off");
});

test("with auth off, every project is reachable; with it on, only your own", async () => {
  const { db, ada } = await twoOwners();
  const who = { kind: "browser", account: ada, reach: [] };

  /** ⛔ The confusion the switch exists to remove: a 404 on a project you can see in the list. */
  process.env.PRODUCTOS_AUTH = "off";
  try {
    assert.deepEqual((await storeFor(db, who).reachable()).sort(), ["prj-ada", "prj-bo"]);
    const theirs = await storeFor(db, who).project("prj-bo");
    assert.ok(!isRefusal(theirs), "auth off still refused another account's project");
  } finally {
    delete process.env.PRODUCTOS_AUTH;
  }

  /** ⛔ And the boundary is back with no code change — the same function decides either way. */
  assert.deepEqual(await storeFor(db, who).reachable(), ["prj-ada"]);
  assert.ok(isRefusal(await storeFor(db, who).project("prj-bo")), "the boundary did not come back");
});

test("with auth on, nothing about the refusals changed", async () => {
  const { db } = await twoOwners();
  /** The guarantees from `v2-store-identity` must still hold when the switch is simply absent. */
  assert.equal(await principalFrom(db, {}, undefined, {}), null);
  assert.equal(await principalFrom(db, {}, "sess-forged", {}), null);

  const unknown = await principalFrom(db, { authorization: "Bearer nope" }, undefined, {});
  assert.equal(unknown.kind, "token");
  assert.deepEqual(unknown.scopes, []);
  for (const via of HUMAN_VIA)
    assert.ok(mayRecord(unknown, via), `a token recorded ${via} with auth on`);
});
