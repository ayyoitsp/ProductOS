/**
 * ⛔ EVERY SURFACE GIVES THE SAME ANSWER TO "HOW MANY CAPABILITIES, AND DO THEY EXIST".
 *
 * Peter: *"every claude session connecting to staging is confused by the # of capabilities, if they
 * even exist"*. One of those sessions, correcting itself: *"My analyse capabilities read the
 * Capability/offers schema layer, which is empty — but the actual tree on 4100 is built as scopes
 * filed under a capabilities container, which that command doesn't look at."*
 *
 * Two things answered to the word: the tree (subsystems offering capabilities), and the product area
 * the v1 migrator filed the old tree under. Each surface looked at one of them. These pin that every
 * surface names both, and that the old area's scopes are never counted as features needing parts.
 */
import assert from "node:assert/strict";
import { temp } from "./support/temp.mjs";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { loadCorpus } from "../dist/v2/load.js";
import { checkCorpus } from "../dist/v2/check.js";
import { sweep } from "../dist/v2/analyse.js";
import { capabilityTree } from "../dist/v2/subsystems.js";
import { exchangeTools } from "../dist/mcp/v2-tools.js";
import { renderScopePage } from "../dist/v2/page.js";

const CARRIED = `---
id: capabilities
title: Capabilities
in: family-wallet
exists: kept
---
What the product's machinery does, carried over from an older tree.
`;

const LEDGER = `---
id: ledger
title: The ledger
does: Holds every movement of a kid's money and answers what a kid has now.
offers:
  - id: record-a-movement
    does: Appends one movement against one kid and returns what the kid has afterwards.
    serves: [money#record-earning#after]
---
`;

/** The seed, optionally with `tasks` re-filed under a carried `capabilities` area, and a ledger. */
function corpus({ carried = false, ledger = false } = {}) {
  const dir = temp("v2onetree-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  if (carried) {
    fs.writeFileSync(path.join(dir, "truth", "capabilities.md"), CARRIED);
    const f = path.join(dir, "truth", "tasks.md");
    fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace("in: family-wallet", "in: capabilities"));
  }
  if (ledger) {
    fs.mkdirSync(path.join(dir, "capabilities"), { recursive: true });
    fs.writeFileSync(path.join(dir, "capabilities", "ledger.md"), LEDGER);
  }
  return dir;
}

test("three corpora, three different answers — the answer is not a constant", () => {
  const none = capabilityTree(loadCorpus(corpus()));
  const carried = capabilityTree(loadCorpus(corpus({ carried: true })));
  const both = capabilityTree(loadCorpus(corpus({ carried: true, ledger: true })));

  assert.deepEqual(none.counts, { subsystems: 0, capabilities: 0 });
  assert.equal(none.carried.length, 0);
  assert.match(none.says, /tree is empty/);
  assert.doesNotMatch(none.says, /carried/);

  assert.equal(carried.carried.length, 1);
  assert.equal(carried.carried[0].id, "capabilities");
  assert.equal(carried.carried[0].features, 1, "tasks, re-filed, is the one feature in it");
  assert.ok(carried.carried[0].behaviours > 0);
  assert.match(carried.says, /tree is empty/);
  assert.match(carried.says, /"Capabilities" \(1 feature, \d+ behaviours?\) is an older capability tree/);

  assert.deepEqual(both.counts, { subsystems: 1, capabilities: 1 });
  assert.match(both.says, /^The capability tree has 1 subsystem offering 1 capability\./);
  assert.match(both.says, /older capability tree/);
});

test("analyse capabilities does not count the carried area's scopes as features needing parts", () => {
  const plain = sweep(loadCorpus(corpus()), "capabilities");
  const carried = sweep(loadCorpus(corpus({ carried: true })), "capabilities");
  assert.ok(plain.units.some((u) => u.ref === "tasks"), "tasks is a feature in the plain seed");
  assert.ok(!carried.units.some((u) => u.ref === "tasks"), "and not once it is filed under the carried area");
  assert.equal(carried.units.length, plain.units.length - 1);
  assert.match(carried.analysis.context(loadCorpus(corpus({ carried: true }))), /older capability tree/);
});

test("the MCP surface has one read for it, and the first read a session makes carries the sentence", async () => {
  const dir = corpus({ carried: true, ledger: true });
  const treeTool = exchangeTools.find((t) => t.name === "productos_capability_tree");
  assert.ok(treeTool, "productos_capability_tree is offered");
  const tree = await treeTool.handler({ dir }, undefined);
  assert.deepEqual(tree.counts, { subsystems: 1, capabilities: 1 });
  assert.equal(tree.subsystems[0].capabilities[0].ref, "ledger#offers#record-a-movement");
  assert.equal(tree.carried[0].id, "capabilities");

  const scopes = await exchangeTools.find((t) => t.name === "productos_exchange_scopes").handler({ dir }, undefined);
  assert.equal(scopes.capability_tree, tree.says);
});

test("check names the carried area, and only where there is one", () => {
  const kind = "an-older-capability-tree-in-product-truth";
  assert.ok(!checkCorpus(corpus()).findings.some((f) => f.kind === kind));
  const f = checkCorpus(corpus({ carried: true })).findings.find((x) => x.kind === kind);
  assert.ok(f);
  assert.equal(f.severity, "note", "a note: it must not refuse a migrated corpus");
  assert.equal(f.where, "capabilities");
});

test("the page shows How it works on a carried corpus with an empty tree, and says so", () => {
  const plain = renderScopePage(loadCorpus(corpus()), "family-wallet");
  assert.doesNotMatch(plain, /data-view="subsystems"/, "nothing to say, so no tab");
  const page = renderScopePage(loadCorpus(corpus({ carried: true })), "family-wallet");
  assert.match(page, /data-tab="subsystems">How it works</, "the tab a reader clicks, not only the section");
  assert.doesNotMatch(plain, /data-tab="subsystems"/);
  assert.match(page, /data-subsystems="0" data-capabilities="0" data-carried="1"/);
  assert.match(page, /older capability tree carried into product truth/);
});
