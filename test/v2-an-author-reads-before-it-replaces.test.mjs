/**
 * ⛔ AN AUTHOR CAN READ THE BYTES IT IS ABOUT TO REPLACE.
 *
 * Authors land work through `productos_in { intent: "document" }`, which replaces a whole document.
 * Every other MCP read is a projection — grid, packet, page — so before this an author editing a
 * feature could not see what the project held now, and its write went over whatever a person or
 * another author had changed since. `productos_exchange_document` returns the stored bytes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { temp } from "./support/temp.mjs";
import { exchangeTools, EXCHANGE_READ_TOOLS } from "../dist/mcp/v2-tools.js";
import { intentNamed, refuseIntent, incomplete } from "../dist/v2/intents.js";
import { whereAnAuthorWrites } from "../dist/core/where-an-author-writes.js";

const CLI = path.resolve("dist/cli/index.js");
const seed = () => {
  const dir = path.join(temp("productos-read-doc-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  return dir;
};
const tool = exchangeTools.find((t) => t.name === "productos_exchange_document");
const read = (dir, args) => tool.handler({ dir, ...args }, { repoRoot: dir, root: dir, configFile: "" });

test("it is a read, offered over MCP, and it returns the stored bytes", async () => {
  assert.ok(tool, "there is no tool to read a document");
  assert.ok(EXCHANGE_READ_TOOLS.includes(tool), "a document read was filed somewhere other than the reads");
  const dir = seed();
  const r = await read(dir, { key: "truth/money.md" });
  assert.equal(r.says, fs.readFileSync(path.join(dir, "truth/money.md"), "utf-8"));
});

test("what it returns is what the door wrote — so a read-then-replace keeps somebody else's change", async () => {
  const dir = seed();
  const agent = { dir, who: { kind: "token", actor: "scoper", scopes: ["read", "author"] }, pressing: "scoper" };
  const suggest = intentNamed("suggest");
  const fields = { ref: "money#see-a-balance#answer", says: "A kid's money shows what is owed when it is below nothing.", from: "another author, a minute ago" };
  const s = refuseIntent(suggest, agent, fields) ?? incomplete(suggest, fields) ?? suggest.run(agent, fields);
  assert.equal(s.ok, true, JSON.stringify(s));

  const now = await read(dir, { key: "truth/money.md" });
  assert.match(now.says, /shows what is owed when it is below nothing/, "the read did not see the other author's write");
});

test("without a key it lists every document; a key outside the corpus is refused", async () => {
  const dir = seed();
  const all = await read(dir, {});
  assert.ok(all.keys.includes("truth/money.md"), `the listing missed truth/money.md: ${all.keys.slice(0, 5).join(", ")}`);
  assert.equal((await read(dir, { key: "../../etc/passwd" })).ok, false);
  assert.equal((await read(dir, { key: "/etc/passwd" })).ok, false);
  assert.match((await read(dir, { key: "truth/nothing-here.md" })).why, /there is no truth\/nothing-here.md yet/);
});

test("the authors are told to read before they replace", () => {
  assert.match(whereAnAuthorWrites(), /productos_exchange_document/);
});
