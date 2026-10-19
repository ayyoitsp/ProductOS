/**
 * ⛔ AN AUTHOR WITH ONLY THE HOSTED MCP AND A TOKEN WAS NEVER TOLD HOW TO LAND ITS WORK.
 *
 * Peter: *"there should be no 'local corpus'... always hosted server"*.
 *
 * Every author's brief described writing `truth/<scope>.md` into a corpus directory, and the only
 * documented way from a directory into a hosted project was `productos hosted import` — an operator
 * command that needs the database address, which no author session holds. So an author did its
 * work, wrote it to disk, and the product never saw it. The door already took a whole document
 * (`productos_in { intent: "document" }`); nothing an author reads said so, and no author's tool
 * list held the door at all.
 *
 * ⛔ THE AUTHOR LIST IS READ OFF THE REGISTRY, so a role added to `AUTHORS` cannot dodge this by
 * being new. And the block is GENERATED — one home, `whereAnAuthorWrites` — so the assertion is that
 * every author carries the current one, not that nine prompts happen to contain some words.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTHORS } from "../dist/core/jobs.js";
import { INTENTS } from "../dist/v2/intents.js";
import { toolsFor } from "../dist/adapters/claude.js";
import { exchangeTools } from "../dist/mcp/v2-tools.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = "productos-some-worktree";
const authors = AUTHORS.filter((a) => a.prompt);
const installedOf = (a) => path.join(ROOT, ".claude", "agents", path.basename(a.prompt));
const bodyOf = (file) => fs.readFileSync(file, "utf-8").replace(/^---\n[\s\S]*?\n---\n/, "");

const door = await import("../dist/core/where-an-author-writes.js").catch(() => null);

test("there is one home for where an author writes, and it names the door and the document intent", () => {
  assert.ok(door, "dist/core/where-an-author-writes.js does not exist — nothing generates the section");
  const block = door.whereAnAuthorWrites();
  assert.match(block, /productos_in/, "the generated section does not name the door");
  assert.match(block, /intent: "document"/, "the generated section does not name the document intent");
  assert.match(block, /productos_exchange_check/, "the generated section does not say how to read the work back");
  assert.doesNotMatch(block, /hosted import/, "the generated section sends an author to the operator's import");
  /** ⛔ Every intent it names is one the door takes — a generated list that names nothing real is worse than none. */
  for (const m of block.matchAll(/intent: "([a-z-]+)"/g))
    assert.ok(INTENTS.some((i) => i.name === m[1]), `the section names intent "${m[1]}", which the door does not take`);
});

test("⛔ every author's installed definition carries the current section — derived from the registry", () => {
  assert.ok(authors.length >= 9, `only ${authors.length} authors have prompts — the registry walk is wrong`);
  assert.ok(door, "nothing generates the section");
  const block = door.whereAnAuthorWrites();
  const short = [];
  for (const a of authors) {
    for (const [what, file] of [["source", a.prompt], ["installed", installedOf(a)]]) {
      if (!fs.existsSync(file)) {
        short.push(`${a.name}: no ${what} definition at ${path.relative(ROOT, file)}`);
        continue;
      }
      const body = bodyOf(file);
      if (!body.includes("productos_in")) short.push(`${a.name} (${what}) never names productos_in`);
      if (!body.includes('intent: "document"')) short.push(`${a.name} (${what}) never names the document intent`);
      if (!body.includes(block)) short.push(`${a.name} (${what}) does not carry the current section — run \`productos v2 agents --presets\``);
    }
  }
  assert.deepEqual(short, [], "an author would land its work nowhere a hosted project can see");
});

test("⛔ and every author is handed the door and the read-back, not only told about them", () => {
  /**
   * A brief naming a tool its role was not handed is an instruction that fails halfway through a
   * run — and reads, from inside the session, as ProductOS not working.
   */
  const offered = new Set(exchangeTools.map((t) => t.name));
  for (const name of ["productos_in", "productos_intents", "productos_exchange_check"])
    assert.ok(offered.has(name), `${name} is not on the MCP surface`);
  for (const a of authors) {
    const tools = toolsFor(a.needs, SERVER);
    for (const name of ["productos_in", "productos_intents", "productos_exchange_check"])
      assert.ok(tools.includes(`mcp__${SERVER}__${name}`), `${a.name} is told to call ${name} and is not handed it`);
  }
});

test("no author brief sends an author to the operator's import", () => {
  const seen = authors.filter((a) => /hosted import/.test(fs.readFileSync(a.prompt, "utf-8"))).map((a) => a.name);
  assert.deepEqual(seen, [], "an author is told to hand a directory to `hosted import`, which needs a database address it does not hold");
});

test("the document intent says itself that it is how an author lands work over MCP", () => {
  const doc = INTENTS.find((i) => i.name === "document");
  assert.ok(doc, "the door no longer takes a whole document");
  assert.match(doc.does, /author/i, "the document intent's description does not say it is how an author lands work");
  assert.match(doc.does, /MCP|hosted/i, "the document intent's description does not say it reaches the hosted project");
});

test("the skill tells the orchestrator where its authors' work lands", () => {
  const skill = fs.readFileSync(path.join(ROOT, "skills", "productos", "SKILL.md"), "utf-8");
  assert.match(skill, /productos_in \{ intent: "document"/, "the skill never says how an author lands a document");
  assert.doesNotMatch(
    skill,
    /^\s*productos hosted import/m,
    "the skill prints `hosted import` as a step for an author"
  );
});
