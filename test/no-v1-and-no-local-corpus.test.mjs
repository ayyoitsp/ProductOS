/**
 * ⛔ THE RETIRED MODEL AND THE LOCAL CORPUS STAY GONE.
 *
 * Peter: *"there should be no 'v1 anything'. there should be no 'local corpus'. that should be
 * completely stripped"* and *"yes, always hosted server"*.
 *
 * Two models ran side by side for months, and an agent connecting through `init` landed on a local
 * stdio server holding 37 v1 tools beside the Exchange ones, over which it could record a person's
 * agreement by typing `via: page`. Prose saying "retiring" did not stop either; these assertions do.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { exchangeTools } from "../dist/mcp/v2-tools.js";

const CLI = path.resolve("dist/cli/index.js");

test("the CLI carries the Exchange model and the hosted operator verbs, and nothing else", () => {
  const help = execFileSync("node", [CLI, "--help"], { encoding: "utf-8" });
  const commands = help.split(/^Commands:$/m)[1] ?? "";
  assert.ok(commands, "the help has no Commands section to read");
  const verbs = [...commands.matchAll(/^ {2}([a-z][a-z0-9-]*)\b/gm)].map((m) => m[1]).filter((v) => v !== "help");
  assert.deepEqual(verbs.sort(), ["hosted", "init", "learn", "todo", "v2"]);
});

test("no v1 tool is on the MCP surface, and there is one surface", () => {
  const v1 = /^productos_(get_feature|list_features|propose_feature|add_behavior|update_tracking|list_feedback|claim_task|scaffold_tests|record_test_results|get_context|list_areas)$/;
  assert.deepEqual(exchangeTools.filter((t) => v1.test(t.name)).map((t) => t.name), []);
  assert.ok(!fs.existsSync("src/mcp/tools.ts"), "the v1 tool list is back");
  assert.ok(!fs.existsSync("src/mcp/server.ts"), "a local stdio server is back");
});

test("nothing renders or serves a corpus from a directory on this machine", () => {
  for (const gone of ["src/ui", "src/cli/commands/serve.ts", "src/core/product.ts", "src/v2/migrate.ts"])
    assert.ok(!fs.existsSync(gone), `${gone} is back`);
  /** A registration that spawns a process is a local server, whatever it is called. */
  const adapter = fs.readFileSync("src/adapters/claude.ts", "utf-8");
  assert.doesNotMatch(adapter, /"serve", "--mcp"/, "the installer registers a local server again");
});

test("an author is not sent to a verb that is gone", () => {
  const files = ["CLAUDE.md", "skills/productos/SKILL.md", "prompts/groom-a-ticket.md", ...fs.readdirSync("agents").map((f) => `agents/${f}`)];
  const found = [];
  for (const f of files)
    for (const [i, line] of fs.readFileSync(f, "utf-8").split("\n").entries())
      if (/`productos (serve|product|feedback|scan|review|area|configure|doctor|byok|env|queue|verify|gaps)\b|v2 migrate\b|todo scan\b/.test(line))
        found.push(`${f}:${i + 1}: ${line.trim()}`);
  assert.deepEqual(found, []);
});
