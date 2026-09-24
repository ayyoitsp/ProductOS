/**
 * ⛔ THE AGENT MODEL IS DATA, SO IT CAN BE CHECKED — and the thing worth checking is not the
 * taxonomy, it is that nothing falls between the agents.
 *
 * Peter: "each agent should understand the context of what they're supposed to do, like an agent
 * that validates everything is consistent, agent that validates test coverage is there."
 *
 * The first cut of this split by layer — one owner for the schema, one for the renderer — and that
 * is the wrong axis for exactly the reason it keeps failing: splitting by layer means nobody owns
 * "is this concept present everywhere it needs to be", which is a property of the whole. So AREAS
 * is territory an agent reads, and AGENTS each answer one question spanning all of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { AGENTS, AREAS, LAYERS, CASCADE, KINDS, CAPABILITIES, areaOf, unwritten } from "../dist/core/jobs.js";

test("every layer is somebody's territory, exactly once", () => {
  for (const layer of LAYERS) {
    const holders = AREAS.filter((a) => a.owns.includes(layer));
    assert.equal(
      holders.length,
      1,
      `${layer} is held by ${holders.length} areas (${holders.map((h) => h.name).join(", ") || "none"}) — ` +
        `a layer with none is where the next unowned change lands, and one with two is where two sets of ` +
        `prohibitions apply and neither is enforced`
    );
  }
  // And the map points at things that exist, or it is a map of somewhere else.
  for (const area of AREAS)
    for (const f of area.files) assert.ok(fs.existsSync(f), `area "${area.name}" claims ${f}, which is not there`);
});

test("every framework file the v2 track has is on the map", () => {
  /**
   * ⛔ THE POINT OF THE MAP IS THAT "EVERYWHERE" IS ENUMERABLE. An agent asked whether a concept is
   * present everywhere it should be needs a list of everywhere; a file missing from it is a place
   * no agent will look.
   */
  const claimed = new Set(AREAS.flatMap((a) => a.files));
  const missing = fs
    .readdirSync("src/v2")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/v2/${f}`)
    .filter((f) => !claimed.has(f));
  assert.deepEqual(missing, [], `these are part of the framework and on nobody's map:\n  ${missing.join("\n  ")}`);
});

test("an agent asks one question, says why it exists, and may not write", () => {
  assert.ok(AGENTS.length >= 4, "the agent model is thinner than the failures it has to catch");
  for (const a of AGENTS) {
    assert.match(a.asks, /\?$/, `"${a.name}" does not state a question — an agent with no question gives no finding`);
    assert.ok(a.because.length > 60, `"${a.name}" does not say what failure it exists to catch`);
    assert.ok(a.reads.length, `"${a.name}" says nothing about the context it must load, so it will answer from a file list`);
    assert.ok(a.finds.length, `"${a.name}" does not say what counts as a finding, so it will report opinions`);
    /**
     * ⛔ NO REVIEWER WRITES. An author cannot review their own work, and a reviewer that repairs
     * what it finds hides how often it fires.
     */
    assert.equal(a.judges, true, `"${a.name}" is not marked as a judge`);
    assert.ok(
      a.never.some((n) => /write|fix|repair|regenerate/i.test(n)),
      `"${a.name}" does not forbid itself from writing`
    );
    // ⛔ Capabilities, not tool names: a spec naming one host's tools is a spec for that host.
    for (const c of a.needs) assert.ok(CAPABILITIES.includes(c), `"${a.name}" needs "${c}", which is not a capability`);
    assert.ok(!a.needs.includes("write-corpus"), `"${a.name}" asks to write a corpus, and it judges`);
  }
});

test("no agent names a model — that is the consumer's choice", () => {
  /**
   * ⛔ Peter: "ideally in the future these job agents will be portable - model agnostic. we should
   * let people assign whatever model they want to each task." An agent that hardcoded one would be
   * portable nowhere; the model is read from the project's config at install time by an adapter.
   */
  const src = fs.readFileSync("src/core/jobs.ts", "utf-8");
  for (const m of ["opus", "sonnet", "haiku", "gpt-", "gemini", "claude-3", "claude-4", "claude-5"])
    assert.ok(!src.toLowerCase().includes(m), `jobs.ts names the model "${m}" — model choice belongs in config`);
  for (const a of AGENTS) assert.ok(!("model" in a), `"${a.name}" carries a model`);
});

test("the cascade routes every kind of change, and only to real layers", () => {
  assert.ok(KINDS.length >= 4, "the cascade covers too few kinds of change to route anything");
  for (const kind of KINDS) {
    const layers = CASCADE[kind];
    assert.ok(layers.length, `"${kind}" reaches nothing`);
    for (const l of layers) {
      assert.ok(LAYERS.includes(l), `"${kind}" routes to "${l}", which is not a layer`);
      assert.ok(areaOf(l), `"${kind}" routes to "${l}", which is on nobody's map`);
    }
    /**
     * ⛔ EVERY KIND REACHES `pin`. The rule this repo keeps breaking is not "change the schema" —
     * it is "leave nothing that fails on its own next time". A kind of change that can be finished
     * without a test is a kind of change that comes back.
     */
    assert.ok(layers.includes("pin"), `a "${kind}" change can be finished without pinning anything`);
  }
  /**
   * ⛔ AND A NEW CONCEPT MUST REACH `instruct`. That is the layer that was skipped four times: a
   * field perfect in the schema that no future session writes.
   */
  assert.ok(CASCADE.concept.includes("instruct"), "a new concept can be finished without telling anyone to write it");
});

test("the agents that have no prompt yet say so", () => {
  // ⛔ Named here and unwritten is honest; named here and silently absent is a registry that lies.
  for (const a of unwritten()) assert.equal(a.prompt, undefined);
  for (const a of AGENTS) if (a.prompt) assert.ok(fs.existsSync(a.prompt), `"${a.name}" points at ${a.prompt}, which is not there`);
});

test("the host's frontmatter is generated, and a judge never gets a writing tool", () => {
  /**
   * ⛔ Peter: "ideally in the future these job agents will be portable - model agnostic."
   *
   * So a prompt file holds the prompt and nothing else. The name, description, tool list and model
   * are one host's dialect, produced at install time from the portable spec plus the project's
   * config. They used to be hand-written into each prompt, which made every agent a Claude agent
   * and made the model something somebody edits inside a prompt.
   */
  for (const a of AGENTS) {
    if (!a.prompt) continue;
    const body = fs.readFileSync(a.prompt, "utf-8");
    assert.doesNotMatch(body, /^---\n/, `${a.prompt} carries frontmatter — that belongs to the adapter`);
    for (const m of ["opus", "sonnet", "haiku", "gpt-4", "gemini"])
      assert.ok(!body.toLowerCase().includes(m), `${a.prompt} names the model "${m}"`);
    /**
     * ⛔ And the body names no host's tools. `ask-the-human` is a capability; `AskUserQuestion` is
     * one product's name for it, and a prompt naming it is a prompt for that product only.
     */
    for (const t of ["AskUserQuestion", "WebFetch", "the Bash tool", "the Read tool", "the Grep tool"])
      assert.ok(!body.includes(t), `${a.prompt} names the host tool "${t}" — declare a capability instead`);
  }

  /**
   * ⛔ THE TOOL LIST IS DERIVED FROM CAPABILITIES, and no capability a judge may declare maps to a
   * writing tool. This is where "a reviewer never writes" is enforced rather than hoped: it is not
   * possible to express an agent that judges and can write.
   */
  const adapter = fs.readFileSync("src/adapters/claude.ts", "utf-8");
  const map = /const TOOL_FOR: Record<Capability, string\[\]> = \{([\s\S]*?)\n\};/.exec(adapter);
  assert.ok(map, "the capability-to-tool map moved — re-read it before trusting this test");
  /**
   * ⛔ Read the VALUES, not the prose. The first version of this grepped the extracted block and
   * matched the word "Write" inside the comment explaining why nothing maps to it — a test failing
   * on its own documentation, which is the same class of mistake as asserting on flattened text.
   */
  const mapped = [...map[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\[([^\]]*)\]/g)].flatMap((m) =>
    m[1].split(",").map((t) => t.trim().replace(/"/g, "")).filter(Boolean)
  );
  assert.ok(mapped.length >= 5, `the capability map reads as ${mapped.length} tools — re-read it`);
  for (const t of mapped)
    assert.ok(!/^(Write|Edit|NotebookEdit|MultiEdit)$/.test(t), `a capability maps to "${t}", which writes`);
  assert.match(map[1], /"write-corpus":\s*\[\]/, "write-corpus gained a mapping — a judge could now be handed it");
});
