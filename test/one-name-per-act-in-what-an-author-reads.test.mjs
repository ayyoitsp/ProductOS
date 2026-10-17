/**
 * ⛔ ONE NAME PER ACT WHEREVER SOMEBODY IS TOLD HOW TO PERFORM ONE.
 *
 * Peter, deciding between keeping the old MCP names as aliases and having one name each:
 * *"one name per act — `accept`, `rule`, `waive`, `defer`, `read` — across MCP, CLI and page; drop
 * the duplicate route."* He was offered the aliases and did not take them.
 *
 * `one-way-in` already guards the SURFACE: no act has a second tool a model can call. This guards
 * the half that surface test cannot see — **the instructions**. When the five act tools came off
 * the surface, `skills/productos/SKILL.md` kept printing them as the way to record a decision and
 * `agents/productos-scoper.md` kept naming `productos_exchange_settle` "and friends"; the inbox
 * tool's own description told a model to close a note with `productos_exchange_close_note`.
 *
 * ⛔ A DOCUMENT NAMING A TOOL THAT DOES NOT EXIST IS WORSE THAN ONE NAMING NOTHING. An agent
 * following it writes a call that fails and concludes the concept does not work — so the retirement
 * reads, from inside a session, as the feature being broken. And a document that keeps the old
 * vocabulary alive is how the second vocabulary comes back: two sessions record the same act under
 * different names and nobody can search the corpus for what happened.
 *
 * ⛔ WHICH IS WHY IT IS A TEST AND NOT A NOTE IN CLAUDE.md. The skills are the most-missed layer in
 * this repo — the schema can support a concept perfectly while every future session writes the old
 * shape, because the instructions were never changed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exchangeTools as tools } from "../dist/mcp/v2-tools.js";
import { INTENTS } from "../dist/v2/intents.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const offered = new Set(tools.map((t) => t.name));
const intents = new Set(INTENTS.map((i) => i.name));

/** Every `productos_*` token in a blob, each with where it was read. */
const namesIn = (text) => new Set([...text.matchAll(/productos_[a-z0-9_]+/g)].map((m) => m[0]));

/**
 * What an author or a model is handed: the skills, the roles, the prompts, and the documents at the
 * top of the repo. ⛔ `.claude/agents` is in here deliberately — it is the installed copy, and a
 * fix to `agents/` that never reached it is a fix no session running in this repo ever sees.
 */
function instructionFiles() {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  for (const d of ["skills", "agents", "prompts", ".claude/agents"]) walk(path.join(ROOT, d));
  for (const f of ["AGENTS.md", "README.md", "OVERVIEW.md", "GLOSSARY.md", "EXAMPLE.md", "USAGE.md", "USE_CASES.md"]) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

/**
 * ⛔ THE FIVE ACTS AND THE OPERATION-SHAPED NAME EACH ONE USED TO HAVE.
 *
 * Listed rather than pattern-matched, because the failure has to say what to write instead. A
 * regex over "anything that looks retired" cannot name the intent that replaced it, and a message
 * that only says "this is wrong" sends the next session to re-derive the mapping.
 */
const SECOND_NAMES = [
  ["productos_exchange_agree_to", "accept"],
  ["productos_exchange_settle", "rule"],
  ["productos_exchange_grant_latitude", "waive"],
  ["productos_exchange_park", "defer"],
  ["productos_exchange_record_read_through", "read"],
  ["productos_exchange_say_on_note", "say"],
  ["productos_exchange_close_note", "close"],
];

test("⛔ nothing an author reads names an act by its retired name", () => {
  const seen = [];
  for (const f of instructionFiles()) {
    const names = namesIn(fs.readFileSync(f, "utf8"));
    for (const [gone, intent] of SECOND_NAMES)
      if (names.has(gone)) seen.push(`${path.relative(ROOT, f)} says ${gone} — write productos_in { intent: "${intent}" }`);
  }
  assert.deepEqual(
    seen,
    [],
    "the second vocabulary is back in the instructions; an agent following these writes a call that fails"
  );
});

test("⛔ and no tool's own description does either", () => {
  /**
   * The inbox tool told a model to close a note with a tool that had been retired out from under
   * it. A description is an instruction with a shorter route to a model than any skill file.
   */
  const seen = [];
  for (const t of tools) {
    const names = namesIn(JSON.stringify({ d: t.description, s: t.inputSchema }));
    for (const [gone, intent] of SECOND_NAMES)
      if (names.has(gone)) seen.push(`${t.name} says ${gone} — write productos_in { intent: "${intent}" }`);
  }
  assert.deepEqual(seen, [], "a tool description is naming a tool that no longer exists");
});

test("every tool an instruction names is a tool that exists", () => {
  /**
   * The general form: the retired act names are only the ones that have bitten so far. A skill that
   * invents a plausible tool fails here rather than in front of a session that concludes ProductOS
   * does not do the thing.
   */
  const seen = [];
  for (const f of instructionFiles())
    for (const n of namesIn(fs.readFileSync(f, "utf8")))
      if (!offered.has(n)) seen.push(`${path.relative(ROOT, f)} names ${n}, which is not a tool`);
  assert.deepEqual(seen, [], "an instruction names a tool nothing offers");
});

test("every tool a description names is a tool that exists", () => {
  const seen = [];
  for (const t of tools)
    for (const n of namesIn(JSON.stringify({ d: t.description, s: t.inputSchema })))
      if (!offered.has(n)) seen.push(`${t.name} names ${n}, which is not a tool`);
  assert.deepEqual(seen, [], "a tool description names a tool nothing offers");
});

test("⛔ and the five names the instructions now use are intents the door takes", () => {
  /**
   * The opposite failure: a sweep that replaced the old names with words nothing answers to would
   * pass every assertion above and leave every instruction unfollowable.
   */
  for (const act of ["accept", "rule", "waive", "defer", "read"])
    assert.ok(intents.has(act), `the instructions tell a session to send intent "${act}" and the door does not take it`);
  assert.ok(offered.has("productos_in"), "the one door is not on the surface");
  assert.ok(offered.has("productos_intents"), "the door's manual is not on the surface — an instruction cannot say 'ask it'");
});

test("⛔ the installed roles carry the same words as the ones in the repo", () => {
  /**
   * `.claude/agents/<role>.md` is `agents/<role>.md` with a frontmatter block on top. A fix made in
   * one and not the other is how a correction survives in the source and never reaches a session —
   * and it is the exact shape of the defect this file exists for.
   */
  const dir = path.join(ROOT, "agents");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const installed = path.join(ROOT, ".claude", "agents", f);
    if (!fs.existsSync(installed)) continue;
    const body = fs.readFileSync(installed, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
    assert.equal(body, fs.readFileSync(path.join(dir, f), "utf8"), `.claude/agents/${f} has drifted from agents/${f}`);
  }
});
