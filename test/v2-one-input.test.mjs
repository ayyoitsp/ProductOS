/**
 * ⛔ ONE DOOR, THREE GATES — AND THE GATE WAS NEVER THE ROUTE.
 *
 * Peter: *"don't we have a 'generic' way to message the system? and have it do whatever is needed?
 * why do we need so many endpoints?"* and then *"the generic door can mint consent - it's a human
 * input. yes, add a single input, get rid of the specific commands. the input should still route to
 * the right subsystem"*.
 *
 * I argued against it, and the argument was confused: I said a generic endpoint would let a model's
 * request arrive wearing a person's authority. `mayRecord` takes the PRINCIPAL and the claimed
 * `via`, so it refuses a token claiming a person pressed something however it asks. `/act`,
 * `/carry`, `/note`, `/say` and `/close` were not five authorities — they were five copies of one
 * authority check, which is why a sixth route would have arrived with its own copy or with none.
 *
 * What these pin is that collapsing the routes moved DISPATCH and not AUTHORITY: every gate that
 * refused something before still refuses it, through one door.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INTENTS, intentNamed, refuseIntent, theIntents } from "../dist/v2/intents.js";
import { ACTS } from "../dist/v2/acts.js";

/** A principal of each kind, as `identity.ts` shapes them. */
const browser = { kind: "browser", actor: "peter", session: "s-1", scopes: ["read", "author", "relay"] };
const token = (scopes) => ({ kind: "token", actor: "a-session", session: "t-1", scopes });

const asking = (who) => ({ dir: "/tmp/nowhere", who, pressing: "peter" });

test("every intent declares a gate, a sentence, and something that runs", () => {
  assert.ok(INTENTS.length >= 9, `only ${INTENTS.length} intents — the registry lost something`);
  for (const i of INTENTS) {
    assert.ok(["consent", "relay", "author", "open"].includes(i.gate), `${i.name} invented the gate "${i.gate}"`);
    assert.ok(i.does.length > 15, `${i.name} does not say what it is for`);
    assert.equal(typeof i.run, "function", `${i.name} has nothing to run`);
  }
  /** Names are unique, or the door routes two things to whichever was declared first. */
  assert.equal(new Set(INTENTS.map((i) => i.name)).size, INTENTS.length, "two intents share a name");
});

/**
 * ⛔ THE ACT IS THE INTENT, not a field inside one. `{intent: "act", act: "accept"}` would be the
 * five old routes with their envelope kept, which is the sprawl this replaced wearing a new shape.
 */
test("each act is an intent of its own, and every act in the type has one", () => {
  for (const act of ACTS) {
    const i = intentNamed(act);
    assert.ok(i, `"${act}" is in the Act type and no intent of that name exists — the page would be refused`);
    assert.equal(i.gate, "consent", `"${act}" does not pass the consent gate`);
  }
  assert.ok(!intentNamed("act"), "there is still a generic `act` intent carrying the act as a field");
});

/**
 * ⛔ THE BOUNDARY, UNCHANGED BY THE DOOR BEING GENERIC. This is the exact claim I was wrong about:
 * the refusal comes from the principal, so it does not matter that every intent now shares a route.
 */
test("a token claiming a person pressed something is refused through the one door", () => {
  const accept = intentNamed("accept");
  const refused = refuseIntent(accept, asking(token(["read", "author", "relay"])), { via: "page" });
  assert.ok(refused, "a token claiming `via: page` was allowed to mint consent");
  assert.equal(refused.ok, false);

  /** And a browser press is not refused — otherwise the gate blocks the thing it protects. */
  assert.equal(refuseIntent(accept, asking(browser), { via: "page" }), null);
});

test("an agent recording its own answer is refused, whatever it claims", () => {
  for (const via of ["page", "question", "chat", "cli"]) {
    const refused = refuseIntent(intentNamed("rule"), asking(token(["read", "author"])), { via });
    assert.ok(refused, `a token claiming \`via: ${via}\` minted consent`);
  }
});

test("carrying needs the relay scope, and replying needs author", () => {
  assert.ok(refuseIntent(intentNamed("carry"), asking(token(["read", "author"])), {}), "carrying without relay was allowed");
  assert.equal(refuseIntent(intentNamed("carry"), asking(token(["read", "relay"])), {}), null);

  for (const name of ["say", "close"]) {
    const refused = refuseIntent(intentNamed(name), asking(token(["read"])), {});
    assert.ok(refused, `${name} without the author scope was allowed`);
    assert.match(refused.detail.join(" "), /needs `author`/);
    assert.equal(refuseIntent(intentNamed(name), asking(token(["read", "author"])), {}), null);
  }
});

/** ⛔ Filing a request is open — anyone looking at the page may say something is wrong. */
test("filing a request needs nothing", () => {
  assert.equal(refuseIntent(intentNamed("note"), asking(token([])), {}), null);
  assert.equal(intentNamed("note").gate, "open");
});

/**
 * ⛔ NAMED, NEVER INFERRED. `CLAUDE.md`: *"The tag sets `Note.kind`; nothing infers it. A classifier
 * reading the sentence would be a guess wearing a decision's clothes."* It binds harder here — a
 * classifier mis-reading a sentence as `accept` mints consent nobody gave.
 */
test("nothing in the registry reads a sentence to decide what was meant", () => {
  assert.equal(intentNamed("please accept this"), undefined, "an intent was matched from prose");
  assert.equal(intentNamed(""), undefined);
  assert.equal(intentNamed("ACCEPT"), undefined, "intent names are matched loosely, so a near-miss routes somewhere");

  const src = fs.readFileSync("src/v2/intents.ts", "utf-8");
  const code = src.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const smell of ["includes(", "match(", "test("])
    assert.ok(
      !new RegExp(`body\\.(says|about|outcome)[^\\n]*${smell.replace("(", "\\(")}`).test(code),
      `something in the registry inspects the words of a message with ${smell} — that is a classifier`
    );
});

/**
 * ⛔ THE ROUTES IT REPLACED ARE GONE, which is the half a registry test cannot show. A door that
 * coexisted with the five would be a sixth way in, not a replacement.
 */
test("the five write routes no longer exist", () => {
  const serve = fs.readFileSync("src/v2/serve.ts", "utf-8");
  for (const old of ["/api/v2/act", "/api/v2/carry", "/api/v2/note", "/api/v2/say", "/api/v2/close"])
    assert.ok(!serve.includes(`p === "${old}"`), `${old} is still handled — the single input is a sixth door`);
  assert.ok(serve.includes('p === "/api/v2/in"'), "the single input is gone");

  /**
   * ⛔ AND `/api/v2/inbox` SURVIVED, because I deleted it while removing the five. They were not
   * contiguous in the file and the splice took everything between them, which the listener test
   * caught as `inbox.body.events` being undefined. Pinned here so the next tidy cannot repeat it.
   */
  assert.ok(serve.includes('p === "/api/v2/inbox"'), "the inbox handler was removed again");
  for (const kept of ["/api/v2/live", "/api/v2/corpus", "/api/v2/preview", "/api/v2/thread", "/api/v2/presence"])
    assert.ok(serve.includes(kept), `${kept} went with the writes`);
});

/** ⛔ An unknown intent is told the list, so no caller has to read the registry to find it. */
test("an unknown intent is refused with the list rather than guessed at", () => {
  const names = theIntents();
  assert.ok(names.includes("accept") && names.includes("note"), `the list is wrong: ${names.join(" ")}`);
  const serve = fs.readFileSync("src/v2/serve.ts", "utf-8");
  assert.match(serve, /theIntents\(\)\.join/, "the refusal does not name what you could have asked for");
  assert.match(serve, /nothing here guesses an intent from a sentence/, "the refusal does not say it will not guess");
});
