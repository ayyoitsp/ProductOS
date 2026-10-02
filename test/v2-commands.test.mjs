/**
 * ⛔ THE COMMANDS WERE THE ONE THING NOBODY MAINTAINED.
 *
 * Peter: *"is our overall architecture ok? we generally just have 'commands' and 'agents' to back
 * the commands. have we maintained a list anywhere?"*
 *
 * The agents were maintained and generated, with a test against drift. The commands were not
 * maintained at all: fifty-odd of them, the only list being `--help`, nothing tying one to the
 * layer that owns it, and nothing failing when one shipped with no home or stopped being used.
 *
 * ⛔ THIS IS THE PART THAT MAKES IT MAINTAINED. A declared list that nothing compares against the
 * real CLI is a second copy of `--help` that rots — which is precisely the failure mode of every
 * document this project has deleted.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const { COMMANDS, LAYERS, SHIMS, retiring, forPeople, forOperators } = await import(path.resolve("dist/core/jobs.js"));

/** What the CLI actually registers, read from the CLI rather than from a list beside it. */
const real = (args) => {
  const help = execFileSync(process.execPath, [path.resolve("dist/cli/index.js"), ...args, "--help"], {
    encoding: "utf-8",
  });
  /**
   * ⛔ ONLY THE `Commands:` SECTION. Reading every two-space-indented line treated a command's
   * `--help` EXAMPLES as subcommands: `productos hosted` documents its usage with indented sample
   * invocations, and this reported `hosted productos` and `hosted open` as undeclared commands.
   * A check that invents commands is a check somebody silences.
   */
  const after = help.split(/^Commands:$/m)[1] ?? "";
  /**
   * ⛔ AND IT STOPS AT THE END OF THE BLOCK. `addHelpText("after", …)` prints BELOW `Commands:`, so
   * taking everything after that heading still swallowed the examples — the first fix was only half
   * of one. The block ends at the first non-empty line that is not indented.
   */
  const lines = [];
  for (const line of after.split("\n")) {
    if (line.trim() && !/^ /.test(line)) break;
    lines.push(line);
  }
  return lines
    .map((l) => /^ {2}([a-z][\w-]*)/.exec(l))
    .filter(Boolean)
    .map((m) => m[1])
    .filter((n) => n !== "help");
};

test("every command the CLI registers is declared, and every declaration is real", () => {
  /**
   * ⛔ EVERY PARENT IS EXPANDED, OR ITS CHILDREN ARE DECLARED NOWHERE AND NOTHING SAYS SO. `hosted`
   * shipped with seven subcommands and this test was green, because only `v2` was being expanded —
   * so a whole family had one opaque entry standing in for it.
   */
  const actual = new Set([
    ...real([]).map((n) => n),
    ...real(["v2"]).map((n) => `v2 ${n}`),
    ...real(["hosted"]).map((n) => `hosted ${n}`),
  ]);
  const declared = new Set(COMMANDS.map((c) => c.name));

  const undeclared = [...actual].filter((n) => !declared.has(n));
  assert.deepEqual(
    undeclared,
    [],
    `these commands exist and are declared nowhere — add them to COMMANDS with the layer they serve: ${undeclared.join(", ")}`
  );

  /** ⛔ And the other direction, which is how a list becomes fiction: a declared command that is gone. */
  const phantom = [...declared].filter((n) => !actual.has(n));
  assert.deepEqual(phantom, [], `these are declared and the CLI does not have them: ${phantom.join(", ")}`);
});

test("every command says which layer it serves, who types it, and which track it belongs to", () => {
  for (const c of COMMANDS) {
    assert.ok(LAYERS.includes(c.owns), `${c.name} claims the layer "${c.owns}", which is not one`);
    assert.ok(
      ["person", "claude", "both", "operator"].includes(c.who),
      `${c.name} does not say who runs it`,
    );
    assert.ok(["v1", "exchange", "both"].includes(c.track), `${c.name} does not say which track it is on`);
    assert.ok(c.does.length > 15, `${c.name} does not say what it does in a sentence anybody could use`);
    /** ⛔ No duplicates: two entries for one command is two answers to "what is this for". */
    assert.equal(COMMANDS.filter((x) => x.name === c.name).length, 1, `${c.name} is declared twice`);
  }
});

/**
 * ⛔ NEVER HAND A HUMAN A FLAG — a rule the skills state and nothing enforced.
 *
 * The acts are the sharp case. `v2 accept` records that a PERSON agreed, and a skill telling them
 * to type it is the laundering path the whole consent model exists to close: the CLI is how the
 * model records what somebody chose, never how they choose it.
 */
test("the acts are the model's to record, never a person's to type", () => {
  for (const act of ["v2 accept", "v2 rule", "v2 read", "v2 waive", "v2 defer"]) {
    const c = COMMANDS.find((x) => x.name === act);
    assert.ok(c, `${act} is not declared, and it is one of the five acts`);
    assert.equal(c.who, "claude", `${act} is marked as something a person types — that is the laundering path`);
  }
  /** And the ones a person really does open are few, by design. */
  assert.ok(forPeople().length <= 12, `${forPeople().length} commands are aimed at a person — that is a CLI, not a product`);

  /**
   * ⛔ `operator` MUST NOT BECOME THE DOOR AROUND THAT CAP.
   *
   * It was added because provisioning an instance is a real fourth audience and marking it `person`
   * tripped a cap that was right about the number and wrong about the fact. The risk is obvious:
   * anything inconvenient gets filed there. So an operator command has to be about running an
   * instance, and the one thing it may never be is one of the five acts.
   */
  for (const c of forOperators()) {
    assert.match(c.name, /^hosted\b/, `${c.name} claims to be an operator command and is not about running an instance`);
    assert.ok(
      !/\b(accept|rule|read|waive|defer)$/.test(c.name),
      `${c.name} is an act filed as operator work — that is the laundering path with a new label`,
    );
  }
});

/** ⛔ Said out loud rather than implied: which half of the CLI is the track that moved on. */
test("the v1 commands are marked as v1, so the live half is distinguishable", () => {
  const v1 = retiring().map((c) => c.name);
  assert.ok(v1.length > 5, "nothing is marked v1 — the two tracks have become indistinguishable again");
  for (const n of ["v2 check", "v2 generate", "v2 notes"])
    assert.ok(!v1.includes(n), `${n} is marked v1 and it is where the work is`);
});

/**
 * ⛔ THE INSTRUCTIONS MUST NOT SEND ANYBODY TO A COMMAND ON THE TRACK THE WORK LEFT.
 *
 * The registry earned itself on the first run. `CLAUDE.md` opens a ⛔ section with *"Run
 * `productos check` before asking anyone to review a corpus"* — the v1 command, which does not
 * take `--at` and cannot read an Exchange corpus at all. Every session has been told to run a
 * thing that would refuse, and the only reason nobody noticed is that we all typed `v2 check`
 * from memory instead.
 *
 * ⛔ A SWEEP WOULD HAVE FIXED THAT ONCE. This is the mechanism, which is the difference between
 * cleaning up and staying clean.
 */
test("no instruction sends somebody to a v1 command", () => {
  const v1 = new Set(retiring().map((c) => c.name));
  /** The two-word commands are unambiguous; a bare `read` or `test` in prose is not. */
  const risky = [...v1].filter((n) => !/^(read|test|next|ask|check|move|area|queue|review|decide|history|product|scan|undo|gaps|verify|unverify|feedback)$/.test(n));
  void risky;
  /**
   * ⛔ A v1 SKILL CORRECTLY NAMES v1 COMMANDS. `productos-align` is entirely about v1 test cases,
   * and firing on it would be the guard reporting the one file that is consistent. It is marked
   * `track: "v1"` in the registry rather than exempted here, so the fact lives in one place.
   */
  const v1Skills = new Set(SHIMS.filter((sh) => sh.track === "v1").map((sh) => sh.skill));
  const files = ["CLAUDE.md", ...fs.readdirSync("skills").filter((d) => !v1Skills.has(d)).map((d) => `skills/${d}/SKILL.md`)].filter((f) => fs.existsSync(f));
  const found = [];
  for (const f of files) {
    /**
     * ⛔ LINE BY LINE, AND ONLY WHERE IT IS AN INSTRUCTION.
     *
     * Two kinds of false positive, both real in this repo. A trigger phrase — *"work the productos
     * queue"* — is what a PERSON says, not something anybody is told to run. And a line that names
     * a v1 command AS the v1 one — *"(the v1 queue is `productos queue show`)"* — is doing exactly
     * what this test wants: telling somebody which track they are on.
     *
     * So: inside backticks, and not on a line that says v1.
     */
    const lines = fs.readFileSync(f, "utf-8").split("\n");
    const body = lines.filter((l) => !/\bv1\b/.test(l)).map((l) => (l.match(/`[^`]+`/g) ?? []).join(" ")).join("\n");
    for (const name of v1) {
      /**
       * ⛔ Matched as a COMMAND, not as a word: "productos check" and not "check the corpus". The
       * first version of this matched the bare verb and reported forty hits in ordinary prose,
       * which is the shape of false alarm that gets a guard deleted.
       */
      const re = new RegExp(`productos ${name}\\b(?! *\\|)`, "g");
      const hits = (body.match(re) ?? []).length;
      if (hits) found.push(`${f} → productos ${name} (${hits}×)`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `the instructions point at v1 commands, which the Exchange track cannot use:\n  ${found.join("\n  ")}`
  );
});
