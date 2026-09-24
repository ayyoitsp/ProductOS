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
