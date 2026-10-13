import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { temp } from "./support/temp.mjs";

/**
 * ⛔ A DOOR ONTO NOTHING IS WORSE THAN NO DOOR, BECAUSE THE PAGE OFFERS IT.
 *
 * `check` refuses a `depends_on`, an `affected_by`, a `leads_to` and a `within` that resolve to
 * nothing. `starts_at` is a reference of exactly that kind and was not among them, so a prototype
 * could name a screen that does not exist and pass handover in silence.
 *
 * Found on the DEPLOYED Bilrost corpus, not in a fixture: the **Admin** option opened on
 * `org-loan-terms#org-loan-terms`, while that scope's views are `fannie-program-settings`,
 * `program-control`, `conventions-section` … — no view of that id. It had been leading nowhere on
 * the page that corpus is reviewed on, and nothing said so.
 */

/**
 * ⛔ THE REAL SEED, COPIED — NOT A HAND-ROLLED SCOPE.
 *
 * The first version of this test wrote its own `truth/money.md` with an `id`, a `title` and a
 * `views:` list, which looked like a scope and loaded as NONE: a real one also needs `in:`,
 * `exists:` and `happy_path:`. So `corpus.scopes` was empty, every ref was unresolvable, and BOTH
 * directions of this test passed on zero findings — the refusal case because nothing ran, and the
 * "left alone" case for the same reason. Two green assertions measuring nothing.
 */
const corpusWith = (prototypes) => {
  const dir = temp("productos-proto-");
  fs.cpSync("v2-seed", dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prototypes.yaml"), `prototypes:\n${prototypes}`);
  return dir;
};

const doors = (findings) => findings.filter((f) => f.kind === "a-prototype-opens-on-nothing");

test("a prototype opening on a screen that does not exist is refused, and named", async () => {
  const { checkCorpus } = await import("../dist/v2/check.js");

  const dir = corpusWith(
    "  - id: admin\n    title: Admin\n    is: an administrator\n    starts_at: money#does-not-exist\n",
  );
  const found = doors(checkCorpus(dir).findings);

  assert.equal(found.length, 1, "a prototype pointing at no screen passed handover");
  assert.equal(found[0].severity, "refuse", "reported rather than refused — the reader still gets the option");
  assert.equal(found[0].where, "admin", "the refusal does not name which prototype");
  assert.match(found[0].what, /money#does-not-exist/, "the refusal does not name the ref that fails");
});

/**
 * ⛔ THE HALF THAT MATTERS MORE. The first version resolved with `resolveRef`, which resolves
 * EXCHANGES — so `money#balance`, a perfectly good screen, came back `no exchange "balance" in
 * money` and EVERY prototype was refused. A check that refuses correct corpora is worse than no
 * check, and it surfaced only because the fixture had a valid door beside the broken one.
 */
test("a prototype opening on a real screen is left alone", async () => {
  const { checkCorpus } = await import("../dist/v2/check.js");

  const dir = corpusWith("  - id: ok\n    title: Fine\n    is: a person\n    starts_at: money#balance\n");
  assert.deepEqual(doors(checkCorpus(dir).findings), [], "a valid prototype was refused");

  /** And a bare view id, which `resolveView` accepts within a scope. */
  const bare = corpusWith("  - id: ok\n    title: Fine\n    is: a person\n    starts_at: balance\n");
  assert.deepEqual(doors(checkCorpus(bare).findings), [], "a bare view id was treated as unresolvable");
});

test("one broken door among several does not condemn the others", async () => {
  const { checkCorpus } = await import("../dist/v2/check.js");

  const dir = corpusWith(
    "  - id: admin\n    title: Admin\n    is: an administrator\n    starts_at: money#nope\n" +
      "  - id: ok\n    title: Fine\n    is: a person\n    starts_at: money#balance\n",
  );
  const found = doors(checkCorpus(dir).findings);
  assert.equal(found.length, 1, `expected exactly the broken one, got ${JSON.stringify(found.map((f) => f.where))}`);
  assert.equal(found[0].where, "admin");
});

test("a prototype with no starts_at at all is not this finding's business", async () => {
  const { checkCorpus } = await import("../dist/v2/check.js");
  const dir = corpusWith("  - id: bare\n    title: Bare\n    is: a person\n");
  assert.deepEqual(doors(checkCorpus(dir).findings), [], "a missing starts_at was reported as an unresolvable one");
});
