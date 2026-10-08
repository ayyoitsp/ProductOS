/**
 * ⛔ WHAT A PERSON SAID OUTRANKS WHAT v1 REMEMBERS.
 *
 * Peter: *"--force should only take the user feedback and regenerate based on it, taking the user
 * feedback as truth."*
 *
 * `--force` rebuilt the truth tree from v1 and treated that as authoritative. v1 is the OLD
 * understanding: its `deal-pricing.md` carried ninety-seven mentions of staged edits, overrides,
 * typed cells and a publish gate — the model Peter corrected twice, in writing, on the page — while
 * v2 had been rewritten to say nothing on that screen can be typed into.
 *
 * Measured on his real corpus at the time of the fix: with the human record present the correction
 * survived and the rejected model stayed absent; with the record removed, the correction was gone
 * and the rejected wording came back twenty-eight times. Every `--force` was quietly reinstating a
 * shape he had refused — and the notes recording the refusal were CLOSED, so nothing objected.
 */
import { test } from "node:test";
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { spokenFor, scopeOfRef } = await import(path.resolve("dist/v2/spoken.js"));

function corpus(notes, verdicts) {
  const dir = temp("productos-spoken-");
  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  fs.mkdirSync(path.join(dir, "verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "notes/notes.yaml"), notes);
  fs.writeFileSync(path.join(dir, "verdicts/accepts.yaml"), verdicts);
  return dir;
}

test("a scope somebody has acted on is named, with the reason", () => {
  const dir = corpus(
    `notes:
  - id: a1
    about: "deal-pricing#grid#answer#something"
    says: "this is all wrong - pricing happens in the excel"
    by: "peter"
    at: 2026-09-25
    via: page
    state: done
    outcome: "rewritten from the component"
`,
    `verdicts: []
`
  );
  const spoken = spokenFor(dir);
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].scope, "deal-pricing");
  assert.match(spoken[0].because[0], /already acted on/);
});

test("⛔ a CLOSED request counts, and counts most", () => {
  /**
   * An open note is a request nobody has acted on. A closed one means the truth was already changed
   * because of it — and that change is precisely what a rebuild from v1 throws away. Reading only
   * open notes would protect the scopes nothing had happened to and abandon the ones that had.
   */
  const dir = corpus(
    `notes:
  - id: closed
    about: "deal-pricing"
    says: "pricing only happens in excel"
    by: "peter"
    at: 2026-09-28
    via: page
    state: done
    outcome: "rewritten"
`,
    `verdicts: []
`
  );
  assert.equal(spokenFor(dir).length, 1, "a closed note must still hold its scope back");
});

test("⛔ software deciding does not hold a scope back", () => {
  /**
   * `via: agent` is a decision, never somebody agreeing. Letting one hold a scope back would let a
   * model's own output outrank the corpus it was derived from — the same boundary `stampFor` keeps.
   */
  const dir = corpus(
    `notes: []
`,
    `verdicts:
  - kind: accept
    target: deal-pricing#happy-path
    by: productos-shape
    at: 2026-09-24
    via: agent
`
  );
  assert.deepEqual(spokenFor(dir), [], "an agent's verdict must not hold a scope back");

  const human = corpus(
    `notes: []
`,
    `verdicts:
  - kind: accept
    target: deal-pricing#happy-path
    by: peter
    at: 2026-09-24
    via: page
`
  );
  assert.equal(spokenFor(human).length, 1, "a person's stamp must");
});

test("a ref resolves to its scope however deep it points", () => {
  assert.equal(scopeOfRef("deal-pricing#grid#answer#an-untouched-column"), "deal-pricing");
  assert.equal(scopeOfRef("pricing"), "pricing");
});

test("--force holds those scopes back, discards their rebuild, and says so", () => {
  const src = fs.readFileSync("src/cli/commands/v2.ts", "utf-8");
  assert.match(src, /for \(const sp of spokenFor\(out\)\)/, "--force must consult the human record");
  assert.match(src, /outranks v1/, "and say that is what it is doing");
  /** ⛔ The cost is stated rather than hidden: a held scope stops following v1. */
  assert.match(src, /no longer follow v1/, "the trade must be said out loud");
});
