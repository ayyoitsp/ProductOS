/**
 * ⛔ 127 OF 137 SCREENS COULD BE REACHED BY NOBODY, AND THE CHECK SAID "2 SCREENS HAVE NO WAY IN".
 *
 * Peter, after a full indexing pass: *"i'm confused why the prototypes don't even exist - when I
 * already asked you to index private lending. how could you have possibly indexed it with no
 * prototypes?????"*
 *
 * Because the walk infers a front door from the shape of the graph:
 *
 *     const entries = [...steps.keys()].filter((ref) => !heldBy.has(ref) && !ledTo.has(ref))
 *
 * Any screen with nothing leading to it is treated as a door. So one product area — 133 screens
 * wired to each other, opened on by NO prototype — flooded `reachable` from doors nobody declared,
 * and `no-way-in` reported two screens belonging to the other area. Everything read as entered.
 * Nothing was.
 *
 * A door is a declared thing: `prototypes.starts_at`. Inferring one from topology is a guess
 * wearing a decision's clothes, and this is what it cost.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";
import { execFileSync } from "node:child_process";

const CLI = path.resolve("dist/cli/index.js");
const { loadCorpus } = await import(path.resolve("dist/v2/load.js"));
const { walkOf } = await import(path.resolve("dist/v2/walk.js"));
const { checkCorpus } = await import(path.resolve("dist/v2/check.js"));

/**
 * An island: the shore leads inland, nothing leads to the shore, and no prototype opens on either.
 *
 * ⛔ ONE-WAY ON PURPOSE. Wired mutually, both screens have inbound edges, no entry is inferred, and
 * the OLD measure catches it — so that fixture would have proved nothing about the new one. The
 * defect needs a screen with nothing leading to it, because that is what the walk mistakes for a
 * declared front door.
 */
function island({ withDoor = false } = {}) {
  const dir = path.join(temp("island-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.writeFileSync(
    path.join(dir, "truth", "island.md"),
    `---
id: island
title: Island
in: family-wallet
exists: kept
exchanges:
  - id: look
    title: Looking
    asked_by: person
    at: { view: the-shore, part: inland }
views:
  - id: the-shore
    title: The shore
    view_kind: list
    sketch: |
      [ the shore ]
    parts:
      - id: inland
        role: navigates
        label: Go inland
        leads_to: island#the-interior
  - id: the-interior
    title: The interior
    view_kind: detail
    sketch: |
      [ the interior ]
    parts:
      - id: deeper
        role: display
        label: Nothing leads out of here
---

# Island

Two screens that lead to each other and nothing opens onto.
`
  );
  if (withDoor)
    fs.writeFileSync(
      path.join(dir, "prototypes.yaml"),
      `prototypes:\n  - id: a-way-in\n    title: A way in\n    starts_at: island#the-shore\n`
    );
  return dir;
}

test("an island nothing opens onto is reported, however well wired it is to itself", () => {
  const dir = island();
  const corpus = loadCorpus(dir);
  const walk = walkOf(corpus);

  /**
   * ⛔ THE OLD MEASURE FIRST, SHOWING WHY IT COULD NOT SEE THIS. Both screens have inbound edges
   * from each other, so a topological entry is inferred and everything reads as reachable.
   */
  assert.deepEqual(
    walk.unreachable.filter((r) => r.startsWith("island#")),
    [],
    "the fixture does not reproduce the defect — the old measure already flags it"
  );

  /** ⛔ And the non-zero that matters: nobody declared a door, so nobody can get in. */
  assert.ok(walk.unentered.includes("island#the-shore"), "the shore is reported as enterable with no door declared");
  assert.ok(walk.unentered.includes("island#the-interior"));

  const { findings } = checkCorpus(dir);
  const said = findings.find((f) => f.kind === "nobody-can-reach-this");
  assert.ok(said, "the check says nothing about a product nobody can enter");
  assert.match(said.what, /no front door at all/, "it does not say the product has no door");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("one declared door is enough, and then it says nothing", () => {
  /**
   * ⛔ WITHOUT THIS THE TEST ABOVE PASSES ON A CHECK THAT COMPLAINS ABOUT EVERY CORPUS. A door at
   * the shore reaches the interior by its own control, so both are entered and there is nothing
   * to report.
   */
  const dir = island({ withDoor: true });
  const walk = walkOf(loadCorpus(dir));
  assert.deepEqual(
    walk.unentered.filter((r) => r.startsWith("island#")),
    [],
    "a declared door did not reach what it leads to"
  );
  const said = checkCorpus(dir).findings.find((f) => f.kind === "nobody-can-reach-this");
  assert.ok(!said || !/island#/.test(said.what), "it still complains about screens a door reaches");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a door onto nothing is not a door", () => {
  /**
   * ⛔ The mirror of `a-prototype-opens-on-nothing`, which is a REFUSAL about the prototype. This
   * says the screens stay unreached — a prototype pointing at a screen that does not exist must
   * not count as having let anybody in.
   */
  const dir = island();
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    `prototypes:\n  - id: a-door-onto-nothing\n    title: A door onto nothing\n    starts_at: island#a-screen-that-is-not-here\n`
  );
  const walk = walkOf(loadCorpus(dir));
  assert.ok(walk.unentered.includes("island#the-shore"), "a door onto nothing was counted as a way in");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a bare view id in `leads_to` means this scope, so the finding does not over-report", () => {
  /**
   * ⛔ MY OWN BUG, AND IN THE WORST DIRECTION FOR A NEW FINDING. My first version compared
   * `leads_to` against the step keys directly, which are `<scope>#<view>` — so `leads_to:
   * earn-form` never matched `money#earn-form`, and the SEED corpus, which declares its
   * navigation exactly that way, reported three of its five screens as reachable by nobody.
   *
   * A finding that over-reports is worse than one that misses: it teaches people to scroll past
   * the thing it was built to make unmissable. `within` has resolved bare ids from the start, with
   * its own note saying that is what an author writing one means.
   */
  const dir = path.join(temp("bare-"), "v2");
  execFileSync("node", [CLI, "v2", "reset", "--at", dir], { stdio: "pipe" });
  fs.writeFileSync(
    path.join(dir, "prototypes.yaml"),
    `prototypes:\n  - id: a-way-in\n    title: A way in\n    starts_at: money#balance\n`
  );
  const walk = walkOf(loadCorpus(dir));

  /** The seed's balance screen leads to both forms with BARE ids. */
  assert.ok(
    !walk.unentered.includes("money#earn-form"),
    "a bare `leads_to` was not resolved, so a screen one control away from the door reads as unreachable"
  );
  assert.ok(!walk.unentered.includes("money#spend-form"));
  fs.rmSync(dir, { recursive: true, force: true });
});
