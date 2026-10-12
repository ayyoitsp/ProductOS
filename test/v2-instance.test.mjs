/**
 * ⛔ `--at` TAKES AN INSTANCE, AND THE LOCAL CASE IS NOT A LESSER ONE.
 *
 * Peter: "let's go hosted first."
 *
 * Hosted-first is not hosted-only. A corpus that must never leave the machine runs an instance on
 * the machine and gets the identical loop, because the client speaks HTTP either way and the
 * filesystem is storage behind the API rather than something a client knows about. If the two ever
 * diverge, the gate that protects a corpus naming a real client becomes a punishment for using it.
 *
 * ⛔ AND AN UNREACHABLE INSTANCE REFUSES RATHER THAN FALLING BACK. A local corpus standing in for
 * one that cannot be reached is how two people agree to two different things and both see a tick —
 * and it surfaces weeks later as a stamp over a sentence nobody recognises.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { v2Route } from "../dist/v2/serve.js";
import { loadCorpus, corpusFiles, memoryStore } from "../dist/v2/load.js";
import { worthWaking } from "../dist/mcp/server.js";
import { working } from "../dist/v2/presence.js";
import { inbox } from "../dist/v2/inbox.js";

const CLI = path.resolve("dist/cli/index.js");

function instance() {
  const dir = path.join(temp("productos-instance-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
}
const serve = async (dir) => {
  const server = http.createServer(async (req, res) => {
    if (await v2Route(req, res, new URL(req.url, "http://x").pathname, { dir })) return;
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};
/**
 * ⛔ ASYNC, AND THAT IS NOT A STYLE CHOICE. The instance under test runs in THIS process, so a
 * synchronous child blocks the event loop that has to answer it — the CLI waits for a reply nobody
 * can send, and the test hangs until the runner kills it. It took one deadlock to find.
 */
const exec = promisify(execFile);
const run = async (args) => (await exec("node", [CLI, ...args], { encoding: "utf-8" })).stdout;

test("a corpus over the wire parses into the same corpus as the directory", () => {
  const dir = instance();
  const local = loadCorpus(dir);
  /**
   * ⛔ THE SAME PARSER, not a second model on the server. A server that parsed first would be a
   * second implementation of the schema, and the remote copy would quietly disagree with the local
   * one about what a corpus says while both reported themselves healthy.
   */
  const remote = loadCorpus(dir, memoryStore(dir, corpusFiles(dir)));
  assert.deepEqual(
    remote.scopes.map((s) => s.scope.id).sort(),
    local.scopes.map((s) => s.scope.id).sort()
  );
  assert.equal(remote.rules.length, local.rules.length);
  assert.equal(remote.verdicts.length, local.verdicts.length);
  assert.deepEqual(remote.broken, local.broken, "the wire lost or invented a parse failure");
  assert.ok(local.scopes.length > 0, "an empty corpus would pass this vacuously");
});

test("`check` reads an instance and reports what the directory reports", async () => {
  const dir = instance();
  const { server, url } = await serve(dir);
  try {
    const here = await run(["v2", "check", "--at", dir]);
    const there = await run(["v2", "check", "--at", url]);
    const counts = (s) => s.split("\n")[0].replace(/\s+/g, " ").trim();
    assert.equal(counts(there), counts(here), "the instance and the directory disagree about what is in the corpus");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("an unreachable instance refuses, and reads nothing from this machine instead", async () => {
  let out = "";
  try {
    await run(["v2", "check", "--at", "http://127.0.0.1:1"]);
    assert.fail("an unreachable instance was treated as readable");
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  assert.match(out, /cannot reach the instance/);
  assert.match(out, /the truth is there, not here/);
  assert.doesNotMatch(out, /scopes · .* exchanges/, "it fell back to a corpus on this machine and reported on it");
});

test("a command that cannot speak to an instance refuses the URL rather than resolving it as a folder", async () => {
  let out = "";
  try {
    await run(["v2", "reset", "--at", "https://x.productos.dev/cre"]);
    assert.fail("a URL was accepted by a command that has no idea what an instance is");
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  assert.match(out, /is an instance/);
  /** ⛔ `path.resolve` turns a URL into a perfectly good folder name, which reads as a typo. */
  assert.doesNotMatch(out, /https:\/x\.productos\.dev/, "the URL was resolved as a path");
});

test("an act recorded against an instance lands in the instance's corpus", async () => {
  const dir = instance();
  const { server, url } = await serve(dir);
  try {
    const scope = loadCorpus(dir).scopes.find((s) => !s.scope.in).scope.id;
    const before = loadCorpus(dir).verdicts.length;
    await run(["v2", "read", scope, "--by", "peter", "--buildable", "no", "--via", "cli", "--at", url]);
    assert.equal(loadCorpus(dir).verdicts.length, before + 1, "the act went somewhere other than the instance");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("a ruling recorded over the wire keeps what its author rejected", async () => {
  const dir = instance();
  const { server, url } = await serve(dir);
  try {
    /**
     * ⛔ THIS WAS DROPPED. The HTTP act route assembled every other field of a ruling and lost
     * `also_considered` — silently, into a field the schema accepts as absent. The whole point of
     * the field is that a decision is not relitigated, and a ruling recorded from the page had no
     * record of what had already been argued.
     */
    const corpus = loadCorpus(dir);
    const q = corpus.scopes.flatMap((s) =>
      s.scope.exchanges.flatMap((e) => Object.keys(e.slots ?? {}).map((slot) => `${s.scope.id}#${e.id}#${slot}`))
    );
    assert.ok(q.length, "no slot to rule on — this test proves nothing");
    let ruled = null;
    for (const ref of q) {
      let out = "";
      try {
        out = await run([
          "v2", "rule", ref, "--says", "it is exactly what this sentence now says it is",
          "--because", "nobody had answered it and somebody had to",
          "--also-considered", "leaving it to the builder, which loses the guarantee",
          "--by", "peter", "--via", "cli", "--at", url,
        ]);
      } catch {
        // Most slots in the seed refuse a ruling for good reasons of their own. Try the next.
        continue;
      }
      if (out.includes("✓")) { ruled = ref; break; }
    }
    /**
     * ⛔ A TEST THAT QUIETLY PROVES NOTHING IS WORSE THAN NO TEST. If nothing in the seed can be
     * ruled, this file has stopped checking the thing it was written for and has to say so rather
     * than keep reporting a tick.
     */
    assert.ok(ruled, `none of ${q.length} slots could be ruled over the wire, so this proves nothing`);
    const v = loadCorpus(dir).verdicts.filter((x) => x.kind === "rule").at(-1);
    assert.match(v.also_considered ?? "", /loses the guarantee/, "the wire dropped what the author had rejected");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("the page can tell nobody is working from somebody working", () => {
  const dir = instance();
  assert.deepEqual(working(dir), [], "a fresh corpus reported somebody at the keyboard");
  inbox(dir, { claim: "session-a" });
  assert.deepEqual(working(dir).map((w) => w.session), ["session-a"]);
  /** ⛔ Looking is not working. A status display polling the queue must not read as a pair of hands. */
  const dir2 = instance();
  inbox(dir2, {});
  assert.deepEqual(working(dir2), []);
});

test("a session is woken for work and not for information", () => {
  assert.equal(worthWaking([{ work: "n-1" }]), true);
  /**
   * ⛔ Peter: "Stop the monitor now." Forty wakes that report nothing is what that was, and a press
   * means the truth already moved — there is nothing for a session to do about it.
   */
  assert.equal(worthWaking([{}, {}, {}]), false, "three presses woke a session that had nothing to do");
  assert.equal(worthWaking([{}, { work: "n-2" }]), true, "a note riding behind two presses was swallowed");
  assert.equal(worthWaking([]), false);
});

test("an instance says what it thinks you are, and that it cannot make you a person", async () => {
  const dir = instance();
  const { server, url } = await serve(dir);
  try {
    const out = await run(["v2", "whoami", "--at", url]);
    assert.match(out, /browser/);
    assert.match(out, /session\(s\) working/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
