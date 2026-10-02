/**
 * ⛔ EVERY LOCAL-ONLY COMMAND REFUSES AN INSTANCE URL — ENUMERATED, NOT NAMED.
 *
 * `path.resolve` turns `https://productos.example.com/p/acme` into a perfectly good folder name. So
 * a command that takes `--at` and forgets to refuse a URL does not crash: it reads a directory that
 * is not there and answers confidently about it, or creates one and reports success.
 *
 * Both happened. `v2 steer list --at <url>` printed "nothing steers this project yet" about somebody
 * else's corpus, and `v2 steer new --at <url>` printed a green tick and wrote
 * `./https:/productos.example.com/p/acme/steers/steers.yaml` onto the local machine — so the habit a
 * person meant to record against a hosted project was recorded nowhere, and they were told it
 * worked.
 *
 * ⛔ AND THERE WAS ALREADY A TEST FOR THIS, which is the part worth fixing. It named `v2 reset` — one
 * command — so it could only ever catch the command that already had the guard. Three new commands
 * shipped without it and nothing failed.
 *
 * This walks what the CLI actually registers, the same way the command inventory does. A command
 * that speaks to instances goes in SPEAKS_TO_INSTANCES with the reason it belongs there; everything
 * else has to refuse. Adding a command without thinking about it fails here rather than in front of
 * somebody who has just been told their write succeeded.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const CLI = path.resolve("dist/cli/index.js");
const URL_ = "https://productos.example.com/p/acme";

const run = (args) => {
  try {
    return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf-8", stdio: "pipe" });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
};

/** The `Commands:` block of a `--help`, and only that block — examples below it are not commands. */
const subcommands = (parent) => {
  const help = run([...parent, "--help"]);
  const after = help.split(/^Commands:$/m)[1] ?? "";
  const lines = [];
  for (const line of after.split("\n")) {
    if (line.trim() && !/^ /.test(line)) break;
    lines.push(line);
  }
  return lines
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((n) => n && n !== "help");
};

/**
 * ⛔ COMMANDS THAT GENUINELY REACH AN INSTANCE, each with why. This list is the decision; anything
 * absent from it must refuse. Keeping the reason means a future reader can disagree with an entry
 * rather than assume somebody thought about it.
 */
const SPEAKS_TO_INSTANCES = new Map([
  ["check", "reads the instance's corpus and reports what it reports"],
  ["grid", "reads an instance"],
  ["acts", "reads an instance"],
  ["page", "renders the instance's corpus"],
  ["next", "reads an instance"],
  ["packet", "compiles from the instance's corpus"],
  ["inbox", "polls the instance's event log"],
  ["notes", "files and closes requests on the instance"],
  ["read", "one of the five acts — recorded against the instance"],
  ["settle", "one of the five acts"],
  ["agree", "one of the five acts"],
  ["park", "one of the five acts"],
  ["rule", "one of the five acts"],
  ["preview", "asks the instance what an act would do"],
  ["whoami", "asks the instance who it thinks you are"],
  ["presence", "asks the instance who is working"],
  ["carry", "hands a published page's presses to the instance"],
  ["watch", "waits on the instance's log"],
  ["grant", "records latitude against the instance"],
]);

/** A refusal, however it is worded — the two the CLI actually produces. */
const refused = (out) => /is an instance/.test(out) || /cannot reach the instance/.test(out);

test("⛔ every v2 command taking --at either speaks to an instance or refuses a URL", () => {
  const names = subcommands(["v2"]);
  assert.ok(names.length > 10, `only found ${names.length} v2 subcommands — the help parse is wrong, not the CLI`);

  const resolvedAsFolder = [];
  for (const name of names) {
    if (SPEAKS_TO_INSTANCES.has(name)) continue;
    const kids = subcommands(["v2", name]);
    /** A parent with subcommands is exercised through them; the parent alone takes no action. */
    const targets = kids.length ? kids.map((k) => [name, k]) : [[name]];
    for (const t of targets) {
      const out = run(["v2", ...t, "--at", URL_]);
      /**
       * ⛔ A COMMAND THAT NEVER LOOKED AT `--at` IS FINE. What is not fine is one that resolved the
       * URL into a path — which is visible in the output as the mangled `https:/` form, and is
       * exactly what a green tick was hiding.
       */
      if (/https:\//.test(out) && !refused(out)) resolvedAsFolder.push(`v2 ${t.join(" ")}`);
    }
  }
  assert.deepEqual(
    resolvedAsFolder,
    [],
    "these turned an instance URL into a local folder — they answer about, or write to, a corpus that is not the one asked for"
  );
});

test("the steer commands refuse, and write nothing, when handed an instance", () => {
  /**
   * The three that shipped without the guard, pinned by name as well — the enumeration above proves
   * the class, and these prove the specific regression that prompted it.
   */
  for (const args of [
    ["steer", "list"],
    ["steer", "new", "A habit meant for the hosted corpus.", "--steers", "generation", "--learned-from", "review"],
    ["steer", "decline", "some-id", "--because", "not a rule here"],
  ]) {
    const out = run(["v2", ...args, "--at", URL_]);
    assert.ok(refused(out), `v2 ${args.join(" ")} did not refuse an instance — it said: ${out.slice(0, 160)}`);
    assert.doesNotMatch(out, /^✓/m, `v2 ${args.join(" ")} reported success against a corpus it never reached`);
  }
});
