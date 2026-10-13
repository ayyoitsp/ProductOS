/**
 * ⛔ WHAT REVIEWS PRODUCTOS IS NOT PART OF ANYBODY'S PRODUCT.
 *
 * Peter: *"let's separate our 'dev' agent/skill from the product os framework agent/skills"*.
 *
 * The distinction was already in the registry — `discipline: "the framework itself"` — and enforced
 * nowhere. `installClaudeAgents` walked `AGENTS` with no filter, so every consumer received
 * `consistency` and `can-the-model-say-it`, two reviewers whose prompts open by telling the reader
 * to go and read `src/core/jobs.ts` and `src/v2/schema.ts` — files that exist only in this
 * repository. A reviewer that cannot run is worse than an absent one: it reads as a capability the
 * product has and does not.
 *
 * The same leak was fixed once for skills, when the migrations skill turned out to be shipping to
 * consumers and moved to `.claude/skills/`. Agents and routes never got the same treatment.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";

import { intact } from "./support/intact.mjs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { AGENTS, AUTHORS, SHIMS, aboutProductOS, frameworkRoles, shippedRoutes } from "../dist/core/jobs.js";
import { installClaudeSkills } from "../dist/adapters/claude.js";

const DEV = ["consistency", "can-the-model-say-it"];

test("the roles that review ProductOS are declared, and there are exactly the ones we think", () => {
  assert.deepEqual(frameworkRoles().map((r) => r.name).sort(), [...DEV].sort());
});

test("⛔ one declaration, not two — the discipline IS the fact", () => {
  /**
   * A separate `ships:` flag beside `discipline` would be two ways to say one thing, which is how
   * they come to disagree. Anything in the framework-itself seat is withheld; nothing else is.
   */
  for (const r of [...AGENTS, ...AUTHORS])
    assert.equal(
      aboutProductOS(r),
      r.discipline === "the framework itself",
      `${r.name} is sorted by something other than its declared discipline`
    );
});

test("⛔ a consumer receives no reviewer of ProductOS, and loses nothing else", () => {
  /**
   * ⛔ THE TARGET DECIDES, NOT THE SOURCE — and the first version of this got that wrong. It asked
   * whether the BUNDLED code had a sibling `src/`, which is true for anybody installing from a
   * checkout, including this checkout installing into somebody else's project. A consumer served by
   * a linked dev build still got both. Installing into a scratch consumer and counting is what
   * caught it, so that is what this test does.
   */
  /** ⛔ `temp`, not `mkdtempSync` — the suite cleans up after itself and a test is not exempt. */
  const dir = temp("pos-consumer-");
  fs.mkdirSync(path.join(dir, "productos"), { recursive: true });
  fs.writeFileSync(path.join(dir, "productos", "config.yaml"), "version: 0.0.1\n");
  installClaudeSkills({ update: true, configRoot: dir });

  const got = fs.readdirSync(path.join(dir, ".claude", "agents"));
  for (const n of DEV)
    assert.ok(!got.includes(`productos-${n}.md`), `a consumer was handed ${n}, which reads this repo's source`);

  /** ⛔ And the product's own roles still arrive — a filter that takes too much is the other failure. */
  for (const n of ["productos-scoper.md", "productos-designer.md", "productos-newcomer.md"])
    assert.ok(got.includes(n), `${n} stopped shipping`);
  assert.equal(got.length, AGENTS.length + AUTHORS.length - DEV.length);
});

test("this repository still gets them, because this is where the files they read are", () => {
  /** Withholding them everywhere would be a simpler rule and would delete the review of ProductOS. */
  /** ⛔ Read INSIDE the block: `intact` removes what the install added, so after it is too late. */
  intact([".claude/agents", ".claude/skills"], () => {
    installClaudeSkills({ update: true, configRoot: process.cwd() });
    const got = fs.readdirSync(path.join(process.cwd(), ".claude", "agents"));
    for (const n of DEV) assert.ok(got.includes(`productos-${n}.md`), `${n} is gone from its own repo`);
  });
});

test("⛔ the predicate is about the destination, and names the file it is about", () => {
  /**
   * Read off the source: the check must look at the configRoot, not at where the bundle came from.
   * `src/core/jobs.ts` is the very file `consistency` opens by naming, so the framework reviewers
   * install exactly where the things they read exist — no flag, nothing to set, nothing to drift.
   */
  const src = fs.readFileSync(path.join(process.cwd(), "src/adapters/claude.ts"), "utf-8");
  const line = src.split("\n").find((l) => l.includes("const ownRepo ="));
  assert.ok(line, "the predicate was renamed — this test is now checking nothing");
  assert.match(line, /cfgRoot/, "it is asking about the bundle again, which ships to consumers");
  assert.match(line, /jobs\.ts/);
});

test("⛔ a route about the framework does not ship, and is declared rather than inferred", () => {
  /**
   * `review ProductOS itself` spawns `architecture` and `coverage`, which are ordinary product
   * reviewers — so "dev if any role is dev" would ship it. The audience is a fact about the route.
   */
  const dev = SHIMS.filter((r) => r.about === "the framework").map((r) => r.route);
  assert.deepEqual(dev, ["review ProductOS itself"]);
  assert.ok(!shippedRoutes().some((r) => r.route === "review ProductOS itself"));
});

test("⛔ a route a consumer wants keeps its useful half, and loses only the framework step", () => {
  /**
   * `check it communicates` is `newcomer` plus `can-the-model-say-it`. Dropping the route would take
   * away the one review that answers "could somebody build from this"; keeping the step would send
   * a consumer to run a reviewer that opens `src/v2/schema.ts`.
   */
  const here = SHIMS.find((r) => r.route === "check it communicates");
  assert.ok(here.steps.some((s) => s.role === "can-the-model-say-it"), "the fixture no longer demonstrates the case");

  const shipped = shippedRoutes().find((r) => r.route === "check it communicates");
  assert.ok(shipped, "the whole route was dropped, and newcomer went with it");
  assert.deepEqual(shipped.steps.map((s) => s.role), ["newcomer"]);
});

test("⛔ nothing in the shipped skill names a framework role or route", () => {
  const skill = fs.readFileSync(path.join(process.cwd(), "skills/productos/SKILL.md"), "utf-8");
  for (const n of DEV) assert.ok(!skill.includes(n), `the shipped skill still tells somebody to run ${n}`);
  assert.ok(!skill.includes("review ProductOS itself"));
});

test("⛔ and the registries themselves are untouched — this withholds, it does not delete", () => {
  /**
   * The framework reviewers are still roles, still routed, still documented in AGENTS.md. A
   * separation that removed them would have answered the question by deleting the thing asked
   * about.
   */
  for (const n of DEV) assert.ok(AGENTS.some((a) => a.name === n), `${n} was deleted rather than withheld`);
  assert.ok(SHIMS.some((r) => r.route === "review ProductOS itself"));
  const doc = fs.readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf-8");
  for (const n of DEV) assert.ok(doc.includes(n), `${n} vanished from the generated map`);
});

/**
 * ⛔ NO TEST MAY INSTALL INTO THIS CHECKOUT WITHOUT PUTTING IT BACK.
 *
 * `6c36230` changed two roles' prompts in `src/core/jobs.ts` and did not regenerate their committed
 * copies, so the drift test correctly went red. Then a LATER test installed into `process.cwd()`,
 * rewrote those two files to match, and the second full run passed — the failure healed itself and
 * took the evidence with it. Verified by injecting a stale marker: without the wrapper the run
 * rewrites it, with the wrapper it survives.
 *
 * ⛔ And it breaks the deploy gate's premise: `staging-guard` refuses unless the tree is clean,
 * because the image is built from the WORKING TREE — so "I ran the tests" and "I may deploy" were
 * in conflict, and the honest guard looked broken.
 *
 * A test rather than a convention: the generated-copies hazard is invisible while the copies happen
 * to be current, which is most of the time.
 */
test("no test installs into this checkout without restoring it", () => {
  const offenders = [];
  for (const f of fs.readdirSync("test").filter((n) => n.endsWith(".test.mjs"))) {
    const text = fs.readFileSync(path.join("test", f), "utf-8");
    /** Every call that targets the real tree, and whether `intact` is the thing wrapping it. */
    for (const m of text.matchAll(/configRoot:\s*process\.cwd\(\)/g)) {
      const window = text.slice(Math.max(0, m.index - 400), m.index);
      if (!/intact\(\s*\[/.test(window)) offenders.push(`test/${f}`);
    }
  }
  assert.deepEqual(
    [...new Set(offenders)],
    [],
    "these install into this checkout and leave it modified, which heals a red main and dirties the deploy gate's tree",
  );
});
