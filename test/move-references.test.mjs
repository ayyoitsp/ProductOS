/**
 * ⛔ A MOVE THAT SAID "NOTHING POINTS AT THIS" WHILE TWO THINGS DID.
 *
 * Moving the CRE documents area reported no references to repoint. Two behaviours carried
 * `same_as: cre/documents/rent-roll/publish-a-roll#…`, and four of the schema's reference-bearing
 * fields — `same_as`, `blocks`, `contradicts`, `cites`, all on a behaviour — were never scanned,
 * plus a reading's `blocked_by` and `suspected_depends_on`.
 *
 * `productos check` would have caught the dangling refs afterwards. The report claiming there were
 * none is the defect: it is what somebody reads as "safe to move".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { planMove } from "../dist/core/move.js";
import { resolvePathsOrThrow } from "../dist/core/paths.js";

/** A corpus where one feature points at another by every reference kind that exists. */
function corpus() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "move-refs-"));
  const P = path.join(dir, "productos");
  fs.mkdirSync(path.join(P, "products", "shop", "papers"), { recursive: true });
  fs.writeFileSync(path.join(P, "config.yaml"), "product:\n  name: Shop\n");
  fs.writeFileSync(
    path.join(P, "products", "shop", "README.md"),
    "---\ntitle: Shop\n---\n\nWhere the buying happens, and the paperwork that backs it.\n"
  );
  fs.writeFileSync(
    path.join(P, "products", "shop", "papers", "README.md"),
    "---\ntitle: Papers\n---\n\nThe documents a purchase is checked against before it is allowed to complete.\n"
  );
  fs.writeFileSync(
    path.join(P, "products", "shop", "papers", "sign-it.md"),
    `---
id: shop/papers/sign-it
title: Sign it
kind: feature
status: built
description: A buyer signs the paperwork for a purchase.
behaviors:
  - id: who-may-sign
    claim: Only the account holder named on the purchase may sign the paperwork for it.
---

Signing is the last gate before a purchase completes.
`
  );
  fs.writeFileSync(
    path.join(P, "products", "shop", "checkout.md"),
    `---
id: shop/checkout
title: Checkout
kind: feature
status: built
description: A buyer pays for what is in the basket.
depends_on:
  - shop/papers/sign-it
affected_by:
  - shop/papers/sign-it
read_throughs:
  - by: dana
    at: 2026-09-01
    buildable: false
    blocked_by:
      - shop/papers/sign-it#who-may-sign
    note: Could not tell who is allowed to sign.
suspected_depends_on:
  - id: shop/papers/sign-it
    because: Checkout will not complete until the paperwork is signed, so the edge is probably real.
ux:
  - id: checkout-page
    title: Checkout
    sketch: |
      [ Pay ]  <Paperwork>
    elements:
      - id: papers-link
        kind: link
        label: Paperwork
        leads_to: shop/papers/sign-it
behaviors:
  - id: who-may-pay
    claim: Only the account holder named on the basket may pay for it.
    same_as:
      - shop/papers/sign-it#who-may-sign
    blocks:
      - shop/papers/sign-it
    contradicts:
      - shop/papers/sign-it#who-may-sign
    contradiction_note: The paperwork names a signer and the basket names a payer, and nothing says they must be the same person.
    cites:
      - shop/papers/sign-it
---

Paying is what turns a basket into a purchase.
`
  );
  return dir;
}

test("a move repoints every kind of reference the schema has", () => {
  const dir = corpus();
  const paths = resolvePathsOrThrow(dir);
  const plan = planMove(paths, "shop/papers", "shop", "documents");

  const fields = plan.edges.map((e) => e.field).sort();
  /**
   * ⛔ Every one of these was a real reference in a real corpus and four of them were invisible.
   * If a new reference-bearing field is added to the schema, this list is what fails.
   */
  assert.deepEqual(fields, [
    "affected_by",
    "behaviors/who-may-pay.blocks",
    "behaviors/who-may-pay.cites",
    "behaviors/who-may-pay.contradicts",
    "behaviors/who-may-pay.same_as",
    "depends_on",
    "read_throughs/dana.blocked_by",
    "suspected_depends_on",
    "ux/checkout-page/papers-link.leads_to",
  ]);

  // The anchor survives repointing — a ref to a behaviour must not become a ref to the container.
  const same = plan.edges.find((e) => e.field === "behaviors/who-may-pay.same_as");
  assert.equal(same.from, "shop/papers/sign-it#who-may-sign");
  assert.equal(same.to, "shop/documents/sign-it#who-may-sign");

  fs.rmSync(dir, { recursive: true, force: true });
});
