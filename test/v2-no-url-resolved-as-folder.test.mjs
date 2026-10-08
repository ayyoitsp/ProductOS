/**
 * ⛔ A COMMAND TAKING `--at` EITHER SPEAKS TO AN INSTANCE OR REFUSES A URL. NOTHING RESOLVES ONE AS
 * A FOLDER.
 *
 * `path.resolve` turns `https://productos.example.com/p/acme` into a perfectly good folder name. So
 * a command that forgets the guard does not crash — it reads a directory that is not there and
 * answers confidently about it, or creates one and reports success.
 *
 * Both happened, in commands that shipped the day the store landed. `v2 steer list --at <url>` said
 * "nothing steers this project yet" about somebody else's corpus, and `v2 steer new --at <url>`
 * printed a green tick and wrote `./https:/productos.example.com/p/acme/steers/steers.yaml` onto the
 * local machine — so a habit meant for a hosted project was recorded nowhere and the person was
 * told it worked.
 *
 * ⛔ AND THERE WAS ALREADY A TEST, which is the part worth fixing. It named `v2 reset` — one command
 * — so it could only ever catch the command that already had the guard. Three shipped without it
 * and nothing failed.
 *
 * ⛔ THE TREE IS WALKED IN PROCESS. Discovering commands by spawning `--help` for each one took
 * minutes; `v2Command()` is the same object the CLI registers, so the inventory costs nothing and
 * only the commands actually under suspicion are run.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { v2Command } = await import(path.resolve("dist/cli/commands/v2.js"));
const CLI = path.resolve("dist/cli/index.js");
const URL_ = "https://productos.example.com/p/acme";

/**
 * Commands that genuinely reach an instance, each with why. ⛔ This list is the decision — anything
 * absent from it must refuse — and the reason is what a future reader can disagree with, rather
 * than assuming somebody thought about it.
 */
const SPEAKS_TO_INSTANCES = new Map([
  ["v2 check", "reads the instance's corpus and reports what it reports"],
  ["v2 grid", "reads an instance"],
  ["v2 acts", "reads an instance"],
  ["v2 packet", "compiles from the instance's corpus"],
  /**
   * ⛔ A READ, so a URL is the point rather than the hazard. It answers "what does this claim hash
   * to" from whichever corpus `--at` names, which is exactly what the role working out a test set
   * needs against a hosted instance — the same shape as `check`, `grid` and `packet` above.
   */
  ["v2 claim", "hashes a claim out of the instance's corpus"],
  ["v2 page", "renders the instance's corpus"],
  ["v2 next", "reads an instance"],
  ["v2 inbox", "polls the instance's event log"],
  ["v2 watch", "waits on the instance's log"],
  ["v2 whoami", "asks the instance who it thinks you are"],
  ["v2 moved", "reads an instance"],
  ["v2 agents", "reads an instance"],
  ["v2 reset", "refuses a URL outright — it has no idea what an instance is"],
  ["v2 publishable", "reads an instance"],
  ["v2 accept", "one of the five acts — recorded against the instance"],
  ["v2 decide", "one of the five acts"],
  ["v2 rule", "one of the five acts"],
  ["v2 read", "one of the five acts"],
  ["v2 waive", "one of the five acts"],
  ["v2 defer", "one of the five acts"],
]);

/** Every leaf command that declares `--at`, read off the command tree the CLI actually registers. */
const takesAt = () => {
  const out = [];
  const walk = (cmd, trail) => {
    if (cmd.options.some((o) => o.long === "--at") && cmd.commands.length === 0) out.push(trail.join(" "));
    for (const kid of cmd.commands) walk(kid, [...trail, kid.name()]);
  };
  walk(v2Command(), ["v2"]);
  return out;
};

test("the command tree is readable, or this test proves nothing", () => {
  const found = takesAt();
  assert.ok(found.length > 15, `only ${found.length} commands take --at — the walk is wrong, not the CLI`);
});

test("⛔ no command resolves an instance URL into a local folder", () => {
  /**
   * Run from a scratch directory, because the failure being guarded against WRITES — and a test
   * that leaves `https:/…` directories in the repo is its own small version of the bug.
   */
  const cwd = temp("pos-url-");
  const args = {
    "v2 steer new": ["A habit long enough to be a steer.", "--steers", "generation", "--learned-from", "review"],
    "v2 steer decline": ["some-id", "--because", "not a rule here"],
  };

  const guilty = [];
  const untested = [];
  for (const name of takesAt()) {
    if (SPEAKS_TO_INSTANCES.has(name)) continue;
    const parts = name.split(" ").slice(1);
    let out = "";
    try {
      out = execFileSync(process.execPath, [CLI, "v2", ...parts, ...(args[name] ?? []), "--at", URL_], {
        encoding: "utf-8",
        stdio: "pipe",
        cwd,
      });
    } catch (e) {
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    /**
     * ⛔ THE TEST IS "DID IT REFUSE", NOT "DID A PATH LEAK INTO THE OUTPUT" — and the weaker version
     * was written first, which would have missed the very bug that prompted this. `steer list`
     * answered "nothing steers this project yet" and never printed the path it had resolved, so a
     * check looking for a mangled `https:/` passed it. Writing commands give themselves away;
     * reading ones are silent, and the reading one is the more dangerous, because a confident
     * wrong answer about somebody else's corpus is what gets acted on.
     */
    const refuses = /is an instance|cannot reach the instance/.test(out);
    /**
     * ⛔ AND A COMMAND THAT NEVER RAN IS NOT A PASS. Commander bailing on a missing argument means
     * the guard was never reached, so it is reported as untested rather than counted as clean —
     * the gap is in the `args` map above, and it has to be visible.
     */
    if (/^error: (required option|missing required argument)/m.test(out)) {
      untested.push(`${name} — needs arguments before it reaches the guard`);
    } else if (!refuses) {
      guilty.push(`${name} — ${out.split("\n").find((l) => l.trim())?.slice(0, 70) ?? "(said nothing)"}`);
    }
  }
  assert.deepEqual(untested, [], "give these the arguments they need in `args`, or they prove nothing");
  assert.deepEqual(guilty, [], "these did not refuse an instance — so they answered about, or wrote to, a corpus that was not the one asked for");

  const stray = fs.readdirSync(cwd).filter((f) => f.startsWith("https:"));
  assert.deepEqual(stray, [], "a URL became a directory on this machine");
});

test("the steer commands refuse an instance, and write nothing", () => {
  /** The three that shipped without the guard — pinned by name as well as by the class above. */
  const cwd = temp("pos-steer-url-");
  for (const a of [
    ["steer", "list"],
    ["steer", "new", "A habit long enough to be a steer.", "--steers", "generation", "--learned-from", "review"],
    ["steer", "decline", "some-id", "--because", "not a rule here"],
  ]) {
    let out = "";
    try {
      out = execFileSync(process.execPath, [CLI, "v2", ...a, "--at", URL_], { encoding: "utf-8", stdio: "pipe", cwd });
    } catch (e) {
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    assert.match(out, /is an instance/, `v2 ${a[0]} ${a[1]} did not refuse an instance`);
    assert.doesNotMatch(out, /^✓/m, `v2 ${a[0]} ${a[1]} reported success against a corpus it never reached`);
  }
  assert.deepEqual(fs.readdirSync(cwd), [], "something was written for a corpus that lives elsewhere");
});

test("⛔ a change record takes no --at, because it is about the repo and not a corpus", () => {
  /**
   * `writeChange` has always used the working directory — a change record is about the framework,
   * the agents and the instructions, not about any one corpus. The option was declared on `new`,
   * `check` and `close` and read by nothing, so `--at <anything>` was accepted in silence and the
   * record landed in the same place regardless. Against an instance that reads as a write going
   * somewhere it never went.
   */
  const walk = (cmd, trail, out = []) => {
    if (cmd.options.some((o) => o.long === "--at")) out.push(trail.join(" "));
    for (const kid of cmd.commands) walk(kid, [...trail, kid.name()], out);
    return out;
  };
  const withAt = walk(v2Command(), ["v2"]).filter((n) => n.startsWith("v2 change"));
  assert.deepEqual(withAt, [], "a declared option that nothing reads is a promise the command does not keep");
});
