/**
 * ⛔ EVERY REFERENCE FIELD RESOLVES, AND THIS TEST EXISTS BECAUSE THREE OF TWELVE DID.
 *
 * The schema defines exactly one reference grammar — `REF_PATTERN` plus `ref.ts`, whose header
 * says *"This is the grammar, once, and everything addresses through it"* — and applied it to
 * `when.after`, `Verdict.target` and `Verdict.settles`. **Every field that did not go through
 * it produced a reproducible wrong-software failure**, which is not a coincidence; it is the
 * class.
 *
 * One phantom rule id, three fields, one run: `excepts` refused correctly, `instead_of` printed
 * *"~~a-rule~~ is overridden at `fails`"* to the builder with zero findings, and `defers_to`
 * printed it under *"Org-wide rules that DO still govern here"* — and switched off the check
 * that reports a rule governing nothing.
 *
 * So the property is asserted directly: a made-up name in any reference field is refused.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkCorpus } from "../dist/v2/check.js";

const PHANTOM = "a-rule-that-was-never-written";

function seeded(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2ref-"));
  fs.cpSync("v2-seed", dir, { recursive: true });
  const file = path.join(dir, "truth", "money.md");
  fs.writeFileSync(file, mutate(fs.readFileSync(file, "utf-8")), "utf-8");
  return dir;
}
const refusals = (dir) => checkCorpus(dir).findings.filter((f) => f.severity === "refuse");

for (const field of ["instead_of", "defers_to"]) {
  test(`a made-up rule in \`${field}\` is refused`, () => {
    const dir = seeded((t) =>
      t.replace(
        "      again:\n        says: >",
        `      again:\n        ${field}:\n          - rule: ${PHANTOM}\n            because: a reason long enough to pass the floor on this field\n        says: >`
      )
    );
    const found = refusals(dir);
    assert.ok(
      found.some((f) => f.kind === "names-no-rule"),
      `${field} accepted a rule that does not exist: ${JSON.stringify(found.map((f) => f.kind))}`
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test("a declaration against a rule that does not reach the slot is refused", () => {
  // ⛔ The shipped seed did this: `see-a-balance#at_once` carried an `instead_of` for a rule
  // `acts_on: changes` had never selected. A formal exemption from something never there.
  const dir = seeded((t) =>
    t.replace(
      "      again:\n        says: >",
      "      again:\n        defers_to:\n          - rule: a-kid-sees-only-their-own\n            because: a reason long enough to pass the floor on this field\n        says: >"
    )
  );
  const found = refusals(dir);
  assert.ok(
    found.some((f) => f.kind === "declares-against-nothing"),
    `a declaration against an absent rule was accepted: ${JSON.stringify(found.map((f) => f.kind))}`
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a dispute naming nothing is refused", () => {
  const dir = seeded((t) =>
    t.replace(
      "      again:\n        says: >",
      "      again:\n        standing:\n          kind: disputed\n          targets: [money#no-such-exchange#answer]\n          about: whether these can both hold at once here\n          because: a reason long enough to carry the argument on a dispute\n        says: >"
    )
  );
  const found = refusals(dir);
  assert.ok(
    found.some((f) => f.kind === "dispute-targets-nothing"),
    `a dispute against nothing was accepted: ${JSON.stringify(found.map((f) => f.kind))}`
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
