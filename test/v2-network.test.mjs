/**
 * ⛔ IT WAS ALREADY ANSWERING THE WHOLE NETWORK, AND A PRESS FROM ANYWHERE ON IT WAS SIGNED
 * WITH THE SERVER'S ACCOUNT.
 *
 * Peter: *"can we make it accessible from other machines in the network too? i'm on a remote
 * control session, would like to be able to see the productos page"*.
 *
 * It already was. `listen(port)` with no host binds every interface, so a corpus naming a real
 * client had been readable from any machine on the LAN for as long as this has existed — while the
 * one line it printed said localhost. Somebody who wanted it could not find the address; somebody
 * who did not want it was never told they had it.
 *
 * ⛔ AND READING WAS NEVER THE RISK. `whoIsPressing` returned the OS account of the process, with
 * no override on the note path at all — so an act or a request for change performed from another
 * machine was recorded as the person who happened to START the server. A verdict says a human
 * agreed. That one would have named the wrong human, which is tenet one broken quietly by a
 * convenience nobody chose.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { isLocal } = await import(path.resolve("dist/v2/serve.js"));

const from = (addr) => ({ socket: { remoteAddress: addr } });

test("only this machine is this machine", () => {
  for (const a of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "127.1.2.3"])
    assert.equal(isLocal(from(a)), true, `${a} is loopback and was not recognised as it`);

  /** ⛔ A private address is still another machine. "Inside the network" is not "is me". */
  for (const a of ["192.168.68.80", "10.0.0.4", "100.107.79.97", "172.16.3.9", "203.0.113.7"])
    assert.equal(isLocal(from(a)), false, `${a} was treated as this machine, so a press from it would be signed here`);

  /** ⛔ And an address that is merely SHAPED like loopback is not loopback. */
  for (const a of ["127.0.0.1.evil.test", "1127.0.0.1", ""])
    assert.equal(isLocal(from(a)), false, `${a} was accepted as loopback`);
});

/**
 * ⛔ A PRESS FROM ANOTHER MACHINE IS SIGNED WITH THIS MACHINE'S ACCOUNT, DELIBERATELY.
 *
 * The first cut refused it and asked the presser who they were. Peter hit that immediately,
 * reviewing over a remote session — the exact case he had just asked for — and said *"don't even
 * ask right now"*. He is right: a guarantee that blocks the work it protects is one somebody turns
 * off, and this is a single-operator machine on a private network.
 *
 * ⛔ SO THE COMPROMISE IS RECORDED RATHER THAN HIDDEN. `isLocal` exists and nothing calls it yet —
 * that is the point: the day this serves more than one person, the question is already answerable.
 * fg-0002 holds why it is not answered today.
 */
test("a remote press records, and the compromise is written down rather than silent", (t) => {
  const src = fs.readFileSync("src/v2/serve.ts", "utf-8");
  assert.doesNotMatch(src, /SAY_WHO/, "the refusal is back, and it blocks the review it protects");
  assert.match(src, /fg-0002/, "the compromise is in the code with nothing recording that it is one");
  /**
   * ⛔ THE GAP LEDGER LIVES IN EXACTLY ONE CHECKOUT, SO IT IS READ FROM THERE.
   *
   * This read `productos/framework-gaps.yaml` relative to the cwd, and `/productos/` is gitignored
   * on purpose — `.gitignore` calls it derived state that anyone who runs `init` gets. A WORKTREE
   * therefore has no such file, and this failed permanently for every session working the way the
   * repo tells them to work. Found by a worktree session, after the suite was green in the main
   * checkout.
   *
   * ⛔ RESOLVED TO THE MAIN CHECKOUT RATHER THAN SKIPPED, because unlike everything else under
   * `productos/` the gap ledger is NOT derived — it is a record addressed to us, and the only copy
   * is wherever `init` was run. Skipping would have made the assertion disappear for exactly the
   * sessions most likely to add a forced fit.
   */
  const mainCheckout = execFileSync("git", ["worktree", "list"], { encoding: "utf-8" })
    .trim()
    .split("\n")[0]
    .split(" ")[0];
  const ledger = path.join(mainCheckout, "productos", "framework-gaps.yaml");
  if (!fs.existsSync(ledger)) {
    /**
     * ⛔ UNVERIFIABLE, AND SAID SO — NOT PASSED AND NOT FAILED. Nobody has run `init` in this
     * checkout, so there is no ledger to assert against; failing would be a statement about the
     * environment and passing would be a lie about the corpus.
     */
    t.skip(`no gap ledger at ${ledger} — run \`productos init\` in the main checkout to make this checkable`);
    return;
  }
  assert.match(fs.readFileSync(ledger, "utf-8"), /fg-0002/, "fg-0002 is cited in the source and does not exist");
});

/** ⛔ The banner says where it is reachable, or an exposure nobody chose stays invisible. */
test("the server says which interfaces it is answering on", () => {
  const src = fs.readFileSync("src/ui/server.ts", "utf-8");
  assert.match(src, /on this network/, "the startup banner still claims localhost only");
  assert.match(src, /--host 127\.0\.0\.1/, "nothing tells anybody how to close it");
  assert.match(src, /server\.listen\(port, host,/, "the bind address is not a thing anybody can choose");
});
