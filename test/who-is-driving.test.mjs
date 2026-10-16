/**
 * ⛔ WHO AGREED, WHILE NOTHING CAN PROVE IT.
 *
 * Peter: *"we're still in unauthenticated mode - let's have the sessions identify the human driving
 * and we'll use that"*.
 *
 * `authIsOff` says what that mode costs, where it is switched on: *every verdict written while this
 * is set is one NOBODY CAN PROVE A HUMAN MADE.* So the question is not which name is provable —
 * none is — but which is true more often. Both earlier answers were worse:
 *
 *   - `localAccount()` is an OS username. It says who owns the laptop, never who is driving, and
 *     it arrives looking exactly as authoritative as a real account.
 *   - taking it off the wire unconditionally let a token write `by: peter` while authenticated as
 *     `ci-bot`. That was driven, not reasoned about, and it is why this is keyed on the mode.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { intentNamed } from "../dist/v2/intents.js";
import { loadCorpus } from "../dist/v2/load.js";

const seed = () => {
  const dir = temp("who-drives-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};
const REF = "money#see-a-balance";
const accept = () => intentNamed("accept");
const browser = { kind: "browser", actor: "os-username", scopes: ["read", "author"] };
const token = { kind: "token", actor: "ci-bot", scopes: ["read", "author"] };

/** ⛔ Set and cleared around each case — the rule is keyed on the mode, so the mode is the fixture. */
function withAuth(off, fn) {
  const was = process.env.PRODUCTOS_AUTH;
  if (off) process.env.PRODUCTOS_AUTH = "off";
  else delete process.env.PRODUCTOS_AUTH;
  try {
    return fn();
  } finally {
    if (was === undefined) delete process.env.PRODUCTOS_AUTH;
    else process.env.PRODUCTOS_AUTH = was;
  }
}

test("⛔ auth off, nobody named — refused, and it says what to send", () => {
  withAuth(true, () => {
    const dir = seed();
    const r = accept().run({ dir, who: browser, pressing: "x" }, { ref: REF, via: "chat" });
    assert.equal(r.ok, false, "a verdict was written attributing agreement to whoever owns the machine");
    assert.match(r.why, /say `by`/);
    assert.match(r.why, /driving this session/);
    assert.ok(
      r.detail.some((d) => /never who is driving/.test(d)),
      "it does not say why the account this runs as is the wrong answer"
    );
    assert.equal(loadCorpus(dir).verdicts.length, 0, "⛔ the refusal still wrote one");
  });
});

test("auth off — the session says who is driving, and that is what is recorded", () => {
  withAuth(true, () => {
    const dir = seed();
    const r = accept().run({ dir, who: browser, pressing: "x" }, { ref: REF, by: "peter", via: "chat" });
    assert.equal(r.ok, true, JSON.stringify(r));
    const v = loadCorpus(dir).verdicts.at(-1);
    assert.equal(v.by, "peter", "the session named peter and the OS username was recorded instead");
    assert.equal(v.via, "chat");
  });
});

test("⛔ auth ON — the wire is discarded for the identity the instance knows", () => {
  /**
   * The forgery this closed: a token authenticated as `ci-bot` asking for `by: peter`. The act
   * tools always prevented it — *a name from the wire would let a session write somebody else's
   * agreement and have it read, later, as though that person had been asked* — and retiring them
   * made this the only path.
   */
  withAuth(false, () => {
    const dir = seed();
    const r = accept().run({ dir, who: token, pressing: "ci-bot" }, { ref: REF, by: "peter", via: "agent" });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(loadCorpus(dir).verdicts.at(-1).by, "ci-bot", "a token wrote somebody else's name");
  });
});

test("⛔ blank is not a name", () => {
  withAuth(true, () => {
    const dir = seed();
    const r = accept().run({ dir, who: browser, pressing: "x" }, { ref: REF, by: "   ", via: "chat" });
    assert.equal(r.ok, false, "whitespace passed as the human driving");
  });
});

test("⛔ it never falls back to the account the process runs as", () => {
  /**
   * The shape of every bug in this area: a default that is correct often enough that nobody checks
   * the case where it is not. If this ever returns the OS username, the refusal above becomes a
   * verdict nobody made.
   */
  withAuth(true, () => {
    const dir = seed();
    accept().run({ dir, who: browser, pressing: "x" }, { ref: REF, via: "chat" });
    const names = loadCorpus(dir).verdicts.map((v) => v.by);
    assert.ok(!names.includes("os-username"), `the principal's actor leaked in as who agreed: ${names.join(", ")}`);
  });
});

test("the page is unaffected — it sends `by`, so auth off changes nothing for a press", () => {
  /**
   * ⛔ The regression this could have been. With auth off the door now requires `by`, and a page
   * that did not send one would have stopped recording presses the moment this landed. It does
   * send one: the page is rendered with `opts.by` from `whoIsPressing`, and every act payload
   * carries it.
   */
  const src = fs.readFileSync(path.join(process.cwd(), "src/v2/page.ts"), "utf-8");
  assert.match(src, /const payload = \{ act, ref, by: BY, via: "page" \}/, "the page stopped sending who pressed");
  assert.match(src, /const BY = \$\{JSON\.stringify\(opts\.by/, "BY is no longer rendered from the request");

  const serve = fs.readFileSync(path.join(process.cwd(), "src/v2/serve.ts"), "utf-8");
  assert.match(serve, /by: whoIsPressing\(req/, "the page is rendered without an identity");
});
