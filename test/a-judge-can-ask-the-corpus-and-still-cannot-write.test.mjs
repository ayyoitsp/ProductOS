/**
 * ⛔ THE ROLES COULD NOT REACH PRODUCTOS AT ALL, AND OPENING THAT DOOR IS WHERE THE ONE STRUCTURAL
 * GUARANTEE ABOUT JUDGES COULD HAVE BEEN LOST.
 *
 * `TOOL_FOR` mapped capabilities to built-ins and Chrome. No role was ever handed an
 * `mcp__…__productos_*` tool, so every author and every judge read a corpus by opening its files
 * while the MCP server — the surface a consumer holds, and the one the MVP is built on — was used
 * only by the main session. The roles that know this model best were the ones never exercising it.
 *
 * ⛔ AND THE REASON THIS IS DELICATE: an agent's tools are DERIVED from the capabilities it declares
 * precisely so that a judge cannot be handed a writing tool. That guarantee used to rest on two
 * facts about a closed set — `write-corpus` is the only capability reaching `Write`/`Edit`, and no
 * judge declares it. A judge holding ProductOS tools breaks the closed set: the MCP surface grows
 * without this repo's adapter being opened, and `productos_in` can perform ANY intent, including
 * one behind the consent gate. A reviewer that could call it would be a reviewer able to mint
 * consent — the one thing nothing in this system may do.
 *
 * So the replacement is default-deny, in the derivation rather than in a list somebody maintains:
 * anything ProductOS offers that is not in the read capability counts as writing, and the install
 * REFUSES a judge whose derived tools include one rather than installing a narrowed version.
 *
 * ⛔ EACH ASSERTION BELOW WAS WATCHED GOING RED. Giving `test-design` `write-corpus`, and putting
 * `productos_in` into the read capability, each fail these tests and neither fails the test that
 * previously held this guarantee — which is why that one was not enough on its own.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENTS, AUTHORS, CAPABILITIES } from "../dist/core/jobs.js";
import { toolsFor, writingToolsIn, hostToolName, mcpServerName } from "../dist/adapters/claude.js";
/**
 * ⛔ THE READ/ACT/DOOR SPLIT IS DECIDED IN THE MCP SERVER, NOT IN THE ADAPTER. The adapter names the
 * tools a capability reaches because tool names are one host's dialect; which of them are READS is a
 * fact about the surface, and a second opinion about it is how one of the two comes to allow
 * something the other refuses. Pinned here, against the group itself.
 */
import { EXCHANGE_READ_TOOLS, EXCHANGE_ACT_TOOLS, EXCHANGE_LOOP_TOOLS, EXCHANGE_DOOR_TOOLS } from "../dist/mcp/v2-tools.js";

/** ⛔ A real registration name, not the plain one: from a worktree it is `productos-<slug>`. */
const SERVER = "productos-some-worktree";
const judges = () => AGENTS.filter((a) => a.prompt);
const ours = (tools) => tools.filter((t) => t.startsWith(`mcp__${SERVER}__`)).map((t) => t.replace(`mcp__${SERVER}__`, ""));

test("a judge holds ProductOS's read tools, named for the server this checkout registered", () => {
  const asking = judges().filter((a) => a.needs.includes("ask-the-corpus"));
  assert.ok(asking.length >= 8, `only ${asking.length} judges can ask the corpus — the surface is exercised by nobody again`);

  for (const a of asking) {
    const tools = toolsFor(a.needs, SERVER);
    const mine = ours(tools);
    assert.ok(mine.length >= 7, `"${a.name}" reaches ${mine.length} ProductOS tools`);
    /**
     * ⛔ THE PREFIX IS THE WHOLE POINT OF DERIVING IT AT INSTALL. A hardcoded `mcp__productos__…`
     * would hand every judge in a worktree a list of tools that do not exist — the install-and-fail-
     * halfway-through shape the author refusal is written against, on exactly the machines this
     * project is developed on.
     */
    for (const t of mine) assert.ok(!t.startsWith("mcp__"), `"${a.name}" holds a double-prefixed tool: ${t}`);
    assert.ok(
      tools.includes(`mcp__${SERVER}__productos_exchange_grid`),
      `"${a.name}" cannot ask where a behaviour stands`
    );
  }
});

test("every ProductOS tool a judge can reach is one the MCP server calls a read", () => {
  const reads = new Set(EXCHANGE_READ_TOOLS.map((t) => t.name));
  assert.ok(reads.size >= 7, `the read group reads as ${reads.size} tools — re-read it before trusting this`);
  for (const a of judges())
    for (const t of ours(toolsFor(a.needs, SERVER)))
      assert.ok(reads.has(t), `the judge "${a.name}" is handed ${t}, which the server does not group as a read`);
});

/**
 * ⛔ THE GUARANTEE ITSELF, ASKED OF THE DERIVATION RATHER THAN OF THE REGISTRY.
 *
 * The existing registry assertion — no judge declares `write-corpus` — is satisfied by a judge that
 * reaches `productos_in` through some other capability. This asks the question the installer asks:
 * what would this role actually be handed, and can any of it change anything.
 */
test("no judging capability yields a tool that can write", () => {
  for (const a of judges()) {
    const tools = toolsFor(a.needs, SERVER);
    assert.deepEqual(
      writingToolsIn(tools),
      [],
      `the judge "${a.name}" reaches a writing tool — a reviewer that repairs hides how often it fires`
    );
  }
  /** And capability by capability, so the finding names the capability rather than the role. */
  const judging = new Set(judges().flatMap((a) => a.needs));
  for (const c of judging)
    assert.deepEqual(
      writingToolsIn(toolsFor([c], SERVER)),
      [],
      `"${c}" is declared by a judge and reaches a writing tool`
    );
});

/**
 * ⛔ AND THE PREDICATE IS DEFAULT-DENY OVER PRODUCTOS'S OWN SURFACE, which is the half that cannot
 * be held by a name list. The act group is empty today — the door took the five acts over — so a
 * test naming the acts would pass on a build that handed a judge `productos_in` itself.
 */
test("anything ProductOS offers that is not a read counts as writing", () => {
  const notReads = [...EXCHANGE_ACT_TOOLS, ...EXCHANGE_LOOP_TOOLS, ...EXCHANGE_DOOR_TOOLS].map((t) => t.name);
  assert.ok(notReads.includes("productos_in"), "the door is not in the groups a judge may not hold — re-read them");
  for (const t of notReads) {
    assert.deepEqual(
      writingToolsIn([hostToolName(t, SERVER)]),
      [`mcp__${SERVER}__${t}`],
      `${t} is not a read and is not treated as writing — a judge could be handed it`
    );
  }
  /** ⛔ A tool nobody has written yet, so this is not a list of today's acts. */
  assert.deepEqual(writingToolsIn([hostToolName("productos_settle_everything", SERVER)]), [
    `mcp__${SERVER}__productos_settle_everything`,
  ]);
  /** ⛔ And the built-in editors, in both dialects, or the old half of the guarantee has gone. */
  assert.deepEqual(writingToolsIn(["Read", "Bash", "Write", "Edit", "Grep"]), ["Write", "Edit"]);
  /** ⛔ Chrome is not ProductOS: default-deny must not swallow another server's tools. */
  assert.deepEqual(writingToolsIn(["mcp__claude-in-chrome__read_page"]), []);
});

/**
 * ⛔ THE NEWCOMER IS THE ONE JUDGE THIS CAPABILITY IS WITHHELD FROM, and it is withheld for the
 * reason its other two prohibitions exist: a tool list reading `productos_exchange_scopes` has told
 * the reader what a scope is, what an exchange is, and that ProductOS exists, before they have
 * opened the URL. A reviewer who has been told cannot detect that the page failed to tell them.
 */
test("the newcomer is handed nothing that tells it what ProductOS is", () => {
  const nc = AGENTS.find((a) => a.name === "newcomer");
  assert.ok(nc, "the newcomer is gone");
  assert.ok(!nc.needs.includes("ask-the-corpus"), "the newcomer can ask the corpus — it has been told what the model is");
  const tools = toolsFor(nc.needs, SERVER);
  assert.deepEqual(ours(tools), [], `the newcomer holds ProductOS tools: ${ours(tools).join(", ")}`);
  for (const t of tools) assert.ok(!/productos/i.test(t), `the newcomer's tool list names ProductOS: ${t}`);
});

/**
 * ⛔ THE WRITERS STILL DERIVE CORRECTLY, which is the half a narrowing fix would have broken
 * silently: an author whose tools came back empty is skipped by the installer, so "no author was
 * installed" and "every author was installed with no way to write" look identical from outside.
 */
test("an author still reaches Write and Edit, and no author is handed a question", () => {
  assert.ok(AUTHORS.length >= 3, "the author registry is empty again");
  for (const a of AUTHORS) {
    const tools = toolsFor(a.needs, SERVER);
    assert.ok(tools.includes("Write") && tools.includes("Edit"), `the author "${a.name}" cannot write`);
    assert.ok(!tools.includes("AskUserQuestion"), `the author "${a.name}" can put a question to a person`);
  }
});

test("every capability maps to at least one tool on this host", () => {
  /**
   * ⛔ A CAPABILITY THAT MAPS TO NOTHING INSTALLS A ROLE WITH NO TOOLS, OR SKIPS IT ENTIRELY —
   * `if (!tools.length) continue`. Both are silent, and a role that is absent because a capability
   * was mistyped looks exactly like a role that was switched off on purpose.
   */
  for (const c of CAPABILITIES)
    assert.ok(toolsFor([c], SERVER).length, `the capability "${c}" reaches no tool on this host`);
});

test("the server a role's tools name is the server the install registers", () => {
  /**
   * ⛔ NOT A HARDCODED STRING. `mcpServerName` is what `installClaude` writes into `.mcp.json`, and
   * it is the same function the tool names are resolved through — so the two cannot disagree about
   * which server a judge is calling. In this checkout it is a worktree name, which is precisely the
   * case a plain `mcp__productos__…` would have got wrong.
   */
  const name = mcpServerName();
  assert.match(name, /^productos(-[a-z0-9-]+)?$/, `the registration name reads as ${JSON.stringify(name)}`);
  assert.equal(hostToolName("productos_exchange_grid", name), `mcp__${name}__productos_exchange_grid`);
  /** ⛔ And a non-ProductOS tool is left exactly as the host spells it. */
  assert.equal(hostToolName("Read", name), "Read");
  assert.equal(hostToolName("mcp__claude-in-chrome__navigate", name), "mcp__claude-in-chrome__navigate");
});
