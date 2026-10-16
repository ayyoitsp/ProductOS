/**
 * ⛔ THE LAST DOOR: AN AGENT HOLDING THE PERSON'S OWN CLI.
 *
 * Two sibling routes were shut this week — an MCP token can no longer record a human `via`, and raw
 * YAML can no longer claim `hand: person` — and both refusals point at *the person's own CLI* as the
 * honest path. An agent with a Bash tool is holding that CLI. So
 * `productos v2 accept --by peter --via chat` from a model's shell produced a verdict
 * BYTE-IDENTICAL to one Peter pressed, and tenet 1 is "a human validated this".
 *
 * ⛔ THREE DISTINGUISHABLE OUTCOMES, OR THIS PROVES NOTHING. A test that only watches the refusal
 * cannot tell a closed door from a broken command, and a zero with no failing zero beside it is not
 * a check:
 *
 *   an agent's shell, human `via`   → refused, nothing written
 *   an agent's shell, `via: agent`  → lands, because a default is the designed path
 *   a person at a terminal          → lands, with no flag anybody had to remember
 *
 * The third one is driven through a REAL pty, because it is the one a wrong gate breaks and the
 * one nobody would notice breaking: every automated run of this suite is the first case.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import {
  principalAtTheShell,
  whatIsDriving,
  mayRecord,
  mayClaimHand,
  watchedAPerson,
  DRIVEN_BY,
  PRINCIPAL_KINDS,
  HUMAN_VIA,
  HUMAN_HAND,
} from "../dist/v2/identity.js";

const CLI = path.resolve("dist/cli/index.js");
const REF = "tasks#complete-a-task#may";

const seed = () => {
  const dir = temp("v2-shell-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  return dir;
};

const verdicts = (dir) => {
  const f = path.join(dir, "verdicts", "accepts.yaml");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : "";
};

/** A terminal on every stream — what a person at a keyboard has. */
const AT_A_KEYBOARD = { stdin: true, stdout: true, stderr: true };
/** What an agent's Bash tool has: three pipes. */
const NOTHING_ATTACHED = { stdin: false, stdout: false, stderr: false };

// ---------------------------------------------------------------------------
// The gate, over the shipped module.

test("a shell with a driver's variable set is not a person, terminal or no terminal", () => {
  assert.ok(DRIVEN_BY.length > 0, "an empty list would pass every case below vacuously");
  for (const name of DRIVEN_BY) {
    const env = { [name]: "1" };
    assert.equal(whatIsDriving(env), name, `${name} is in the list and was not noticed`);
    /**
     * ⛔ THE ENVIRONMENT WINS OVER THE TERMINAL. A harness that allocates a pty would otherwise
     * read as a person, and allocating one is a line of code.
     */
    const p = principalAtTheShell(env, AT_A_KEYBOARD);
    assert.equal(p.kind, "driven", `${name} was set and a pty was enough to look like a person`);
    for (const via of HUMAN_VIA) {
      const r = mayRecord(p, via);
      assert.ok(r, `a shell ${name} is driving recorded "${via}", which claims a person agreed`);
      assert.match(r.why, /this shell/);
      assert.ok(
        r.detail.some((d) => d.includes(name)),
        "the refusal never said what gave it away, so nobody can tell a closed door from a bug"
      );
    }
  }
});

test("⛔ a default stays freely available — that is the designed path, not a lesser forgery", () => {
  const driven = principalAtTheShell({ CLAUDECODE: "1" }, NOTHING_ATTACHED);
  assert.equal(mayRecord(driven, "agent"), null, "an agent could no longer land a default for a reviewer to disagree with");
  assert.equal(mayClaimHand(driven, "agent"), null);
  assert.equal(mayClaimHand(driven, null), null);
});

test("a shell with nothing attached to it is nobody, even with no driver named", () => {
  const p = principalAtTheShell({}, NOTHING_ATTACHED);
  assert.equal(p.kind, "driven", "a fully detached shell — CI, a daemon, `ssh` with no -t — read as a person");
  assert.ok(mayRecord(p, "cli"));
  assert.ok(
    mayRecord(p, "cli").detail.some((d) => /no terminal is attached/.test(d)),
    "the refusal does not say that nothing is attached, which is the one thing the caller can change"
  );
});

/**
 * ⛔ THE PERSON MUST NOT BREAK, AND `stdin.isTTY` ALONE BREAKS THEM.
 *
 * Piping input and redirecting output are both things people do, and either one detaches a stream.
 * A terminal on ANY stream means somebody is at one end of this process.
 */
test("a person piping, or redirecting, or in tmux, is still a person", () => {
  for (const [what, attached] of [
    ["at a keyboard", AT_A_KEYBOARD],
    ["piping input in", { stdin: false, stdout: true, stderr: true }],
    ["redirecting output to a file", { stdin: true, stdout: false, stderr: true }],
    ["redirecting both, watching stderr", { stdin: false, stdout: false, stderr: true }],
  ]) {
    const p = principalAtTheShell({}, attached);
    assert.equal(p.kind, "terminal", `somebody ${what} was refused — a new flag to remember is the thing this must not add`);
    for (const via of HUMAN_VIA)
      assert.equal(mayRecord(p, via), null, `somebody ${what} could not record "${via}"`);
    assert.equal(mayClaimHand(p, HUMAN_HAND), null, `somebody ${what} could not claim their own hand`);
  }
});

/**
 * ⛔ NO HATCH, AND IT IS A PROPERTY RATHER THAN A PROMISE. A variable saying "a person really is
 * here" is a variable the agent sets — the argument `mintsHumanConsent` already makes about a token
 * scope. Nothing this function reads can move a driven shell across the line.
 */
test("no variable turns a driven shell back into a person", () => {
  for (const hatch of [
    "PRODUCTOS_I_AM_HERE",
    "PRODUCTOS_HUMAN",
    "PRODUCTOS_TTY",
    "PRODUCTOS_FORCE_HUMAN",
    "PRODUCTOS_CONSENT",
    "FORCE_TTY",
    "PRODUCTOS_AUTH",
  ]) {
    const p = principalAtTheShell({ CLAUDECODE: "1", [hatch]: "1", ...(hatch === "PRODUCTOS_AUTH" ? { PRODUCTOS_AUTH: "off" } : {}) }, AT_A_KEYBOARD);
    assert.equal(p.kind, "driven", `${hatch} minted human consent for whatever is driving the shell`);
    assert.ok(mayRecord(p, "chat"), `${hatch} let a driven shell record agreement`);
  }
});

/**
 * ⛔ EVERY KIND OF CALLER DECIDED, so a fifth one cannot inherit a side of the boundary by accident.
 * `watchedAPerson` is the property; this is the assertion that both gates actually obey it.
 */
test("the two gates agree with `watchedAPerson` for every kind of caller there is", () => {
  assert.ok(PRINCIPAL_KINDS.length >= 4, "the list of callers shrank — this test now proves less");
  /**
   * ⛔ THE VALUES, FIRST, OR THE LOOP BELOW IS A TAUTOLOGY. Deriving the expectation from the
   * property under test means a property that changed its mind agrees with itself perfectly — so
   * the two kinds that may never press are pinned by name before anything is derived from them.
   */
  assert.equal(watchedAPerson("driven"), false, "⛔ a shell software is driving was declared a person");
  assert.equal(watchedAPerson("token"), false, "⛔ a token was declared a person");
  for (const kind of PRINCIPAL_KINDS) {
    const p = { kind, actor: "somebody", scopes: ["read", "author", "relay"] };
    for (const via of HUMAN_VIA) {
      const r = mayRecord(p, via);
      if (watchedAPerson(kind)) assert.equal(r, null, `"${kind}" watched a person and could not record "${via}"`);
      else assert.ok(r, `⛔ "${kind}" recorded "${via}" — tenet 1 is gone and nothing says when`);
    }
    const h = mayClaimHand(p, HUMAN_HAND);
    if (watchedAPerson(kind)) assert.equal(h, null, `"${kind}" watched a person and could not claim their hand`);
    else assert.ok(h, `⛔ "${kind}" typed \`hand: person\``);
  }
});

// ---------------------------------------------------------------------------
// The same three outcomes, out of the shipped CLI.

const run = (args, env) => {
  try {
    return { code: 0, out: execFileSync("node", [CLI, "v2", ...args], { encoding: "utf-8", env, stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

/** This process's environment with every known driver removed — ⛔ still three pipes, so still refused. */
const noDriver = () => {
  const env = { ...process.env };
  for (const name of DRIVEN_BY) delete env[name];
  return env;
};

test("⛔ the CLI refuses a human `via` from an agent's shell, and writes nothing", () => {
  const dir = seed();
  for (const via of HUMAN_VIA) {
    const r = run(["accept", REF, "--by", "peter", "--via", via, "--at", dir], { ...process.env, CLAUDECODE: "1" });
    assert.equal(r.code, 1, `the CLI recorded "${via}" for a person who was never asked`);
    assert.match(r.out, /this shell cannot record/);
    /** ⛔ A refusal with no way forward is where a session starts looking for the way round. */
    assert.match(r.out, /via: agent/, "the refusal never named the route that is open");
    assert.match(r.out, /their own terminal/, "the refusal never named the person's route");
  }
  assert.equal(verdicts(dir), "", "⛔ a refused act still wrote a verdict");
});

test("the same command with `via: agent` lands", () => {
  const dir = seed();
  const r = run(["accept", REF, "--by", "a-session", "--via", "agent", "--at", dir], { ...process.env, CLAUDECODE: "1" });
  assert.equal(r.code, 0, r.out);
  assert.match(verdicts(dir), /via: agent/, "a default a reviewer can disagree with did not land");
});

/**
 * ⛔ AND A PERSON AT A TERMINAL IS UNAFFECTED — through a real pty, because that is the only way to
 * be a person from a test, and because this is the outcome whose breakage nothing else would catch.
 */
test("a person at a real terminal records exactly as before, with no flag to remember", () => {
  const pty = ptyWrapper();
  if (!pty) {
    /** ⛔ Said out loud: a skip here means the person's path was not exercised on this machine. */
    console.error("⛔ no pty available — the person's path was NOT verified on this run");
    return;
  }
  const dir = seed();
  const r = execFileSync(pty.cmd, pty.args([CLI, "v2", "accept", REF, "--by", "peter", "--via", "chat", "--at", dir]), {
    encoding: "utf-8",
    env: noDriver(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.match(r, /agreed/, `a person at a terminal was refused: ${r}`);
  assert.match(verdicts(dir), /via: chat/, "a person's press did not land, or landed as something else");
  assert.match(verdicts(dir), /by: peter/);
});

/**
 * A wrapper that gives the child a real terminal, or nothing.
 *
 * ⛔ PROBED, NOT ASSUMED. `script` differs between BSD and GNU, and a wrapper that silently failed
 * to allocate a pty would turn the person's case into the agent's case and pass for the wrong
 * reason — so the probe has to report a terminal before the case is allowed to run.
 */
function ptyWrapper() {
  const probe = "console.log(process.stdout.isTTY ? 'TTY' : 'PIPE')";
  const forms = [
    { cmd: "script", args: (a) => ["-q", "/dev/null", "node", ...a] },
    { cmd: "script", args: (a) => ["-qec", ["node", ...a].join(" "), "/dev/null"] },
  ];
  for (const f of forms) {
    try {
      const out = execFileSync(f.cmd, f.args(["-e", probe]), { encoding: "utf-8", env: noDriver(), stdio: ["ignore", "pipe", "pipe"] });
      if (/TTY/.test(out)) return f;
    } catch {
      /* try the next form */
    }
  }
  return null;
}
