/**
 * `refuses`, `fails` and `again`, read out of a component.
 *
 * ⛔ EVERY ASSERTION HERE IS ABOUT NOT INVENTING. The thing this generator could do wrong is not
 * "miss a refusal" — a missed one leaves a blank somebody fills. It is putting a sentence in front
 * of a reviewer that nobody wrote, which looks exactly like a sentence somebody agreed to. So the
 * cases below are mostly the literals that fooled the first version on real bilrost components.
 */
import { test } from "node:test";
import { temp } from "./support/temp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  readableMessage,
  literals,
  failsFrom,
  againFrom,
  refusesFrom,
  proposeSlots,
} from "../dist/v2/propose-slots.js";

test("a tailwind class list is not a sentence a person is told", () => {
  /**
   * ⛔ THIS EXACT STRING WAS PROPOSED AS `says` on three exchanges of the deals list — lifted off
   * the error box's own className, two lines from the branch that renders it. The guard it defeated
   * was `^[a-z-]+(\s+[a-z0-9:-]+)+$`: `mb-6` has a digit, so the first token never matched.
   */
  assert.equal(readableMessage("mb-6 rounded-md border border-red-200 bg-red-50 p-4"), false);
  assert.equal(readableMessage("flex items-start gap-2"), false);
  assert.equal(readableMessage("mt-6 rounded-md bg-blue-600 px-4 py-2 text-white"), false);
  /** And it still accepts a real one. */
  assert.equal(readableMessage("Failed to load deals"), true);
  assert.equal(readableMessage("Enter an address before continuing"), true);
});

test("a key and a value is code wherever it was found", () => {
  /** ⛔ Reached `says` on the settings screen: `told: "isConfigured: false"`. */
  assert.equal(readableMessage("isConfigured: false"), false);
  assert.equal(readableMessage("status: 404"), false);
  assert.equal(readableMessage("enabled: true"), false);
});

test("a field label is not a refusal", () => {
  /** ⛔ `"Reason (required)"` was proposed as `told` on three exchanges. It is what the field is
   * called, not what the asker is told when it is empty. */
  assert.equal(readableMessage("Reason (required)"), false);
  assert.equal(readableMessage("Borrower name (optional)"), false);
});

test("a developer's words are never a user's", () => {
  for (const bad of [
    "Failed to fetch",
    "unexpected response from the server",
    "TODO handle this case",
    "unknown error occurred",
  ])
    assert.equal(readableMessage(bad), false, `"${bad}" should not reach a reviewer as product copy`);
});

test("the message of a failure is lifted whole, and only from below the branch", () => {
  const src = [
    `      <h2 className="type-display">Sizing Results</h2>`,
    `      {isError && (`,
    `        <div className="mb-6 rounded-md border border-red-200">`,
    `          {error instanceof Error ? error.message : 'Failed to load deals'}`,
    `        </div>`,
    `      )}`,
  ].join("\n");
  const got = failsFrom(src, literals(src));
  assert.ok(got?.candidate?.says, "the failure says nothing");
  assert.match(got.candidate.says, /Failed to load deals/);
  /**
   * ⛔ THE HEADING ABOVE THE BRANCH IS NOT THE MESSAGE. Searching symmetrically around the branch
   * proposed `"Sizing Results"` as what the asker is told when pricing cannot be computed.
   */
  assert.doesNotMatch(got.candidate.says, /Sizing Results/);
});

test("a failure branch that says nothing of its own gets a question and no answer", () => {
  const src = ["  if (isError) {", "    return <ErrorPanel />;", "  }"].join("\n");
  const got = failsFrom(src, literals(src));
  assert.ok(got, "the branch was not noticed at all");
  assert.equal(got.candidate, undefined, "a sentence was invented for a branch with no words in it");
  assert.ok(got.evidence.length, "nothing points at where to look");
});

test("asked twice is read off the guard, which is a fact rather than copy", () => {
  const src = `  <button disabled={isPending} onClick={submit}>Save</button>`;
  const got = againFrom(src);
  assert.ok(got?.candidate?.says, "a disabled-while-pending guard was not read");
  assert.match(got.candidate.says, /second press does nothing/);
  /** No guard, no sentence. */
  assert.equal(againFrom(`  <button onClick={submit}>Save</button>`), undefined);
});

test("a refusal's trigger comes off the check, never out of thin air", () => {
  const src = [
    `const schema = z.object({`,
    `  propertyAddress: z.string().min(1, "Enter the property address"),`,
    `  contactEmail: z.string().email("That is not an email address"),`,
    `});`,
  ].join("\n");
  const got = refusesFrom(src, literals(src));
  const outcomes = got?.candidate?.outcomes ?? [];
  assert.equal(outcomes.length, 2, "both checks should be read");

  const addr = outcomes.find((o) => o.name === "property-address");
  assert.ok(addr, "the field name did not become the case name");
  assert.equal(addr.told, "Enter the property address", "the message was not lifted verbatim");
  /** ⛔ `.min(1)` IS "left empty" — the trigger is the method, not a sentence I wrote. */
  assert.match(addr.when, /left empty/);
  assert.doesNotMatch(addr.when, /does not pass the check/, "the vague placeholder `when` is back");

  const email = outcomes.find((o) => o.name === "contact-email");
  assert.match(email.when, /not an email address/);
});

test("a check whose test nobody can read proposes nothing", () => {
  /** ⛔ `regex` states no trigger in words, so there is no honest `when` and therefore no
   * candidate — the question is raised instead. */
  const src = [`const s = z.object({`, `  code: z.string().regex(/^[A-Z]{3}$/, "Enter a valid code"),`, `});`].join("\n");
  const got = refusesFrom(src, literals(src));
  assert.equal(got?.candidate, undefined, "a trigger was invented for a regex check");
});

test("every candidate carries the one consequence that is a fact", () => {
  const src = `  propertyAddress: z.string().min(1, "Enter the property address"),`;
  const got = refusesFrom(src, literals(src));
  assert.match(got.candidate.consequence, /what the built screen does today/);
  assert.ok(got.candidate.consequence.length >= 10, "the schema floors consequence at 10");
});

/** A corpus on disk, so `proposeSlots` is exercised the way it runs. */
function corpusWith(component, exchanges) {
  const dir = temp("slots-");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/Screen.tsx"), component);
  return { dir, scope: { id: "s", views: [{ id: "v", drawn_from: "src/Screen.tsx" }], exchanges } };
}

test("a control's ask does not inherit the screen's failure", () => {
  /**
   * ⛔ THE DEFECT THIS EXISTS FOR. `deals-list`, `clear-filters` and `new-deal-button` were each
   * given *"the asker is told «Failed to load deals»"*, because the evidence was in the file and
   * the file was reached through all three. Clearing a filter does not fail the way loading the
   * list fails.
   */
  const { dir, scope } = corpusWith(
    [`  {isError && (`, `    <div>{'Failed to load deals'}</div>`, `  )}`].join("\n"),
    [
      { id: "screen-ask", at: { view: "v" }, asked_by: "person", slots: {} },
      { id: "a-button", at: { view: "v", part: "clear-filters" }, asked_by: "person", slots: {} },
    ]
  );
  const props = proposeSlots(scope, dir);
  const owners = [...new Set(props.map((p) => p.exchange))];
  assert.deepEqual(owners, ["screen-ask"], "page-wide evidence was attributed to a control's ask");
});

test("a slot somebody already answered is left alone", () => {
  const component = [`  {isError && (`, `    <div>{'Failed to load deals'}</div>`, `  )}`].join("\n");
  const { dir, scope } = corpusWith(component, [
    { id: "screen-ask", at: { view: "v" }, asked_by: "person", slots: { fails: { says: "They keep the list they already had." } } },
  ]);
  const slots = proposeSlots(scope, dir).map((p) => p.slot);
  assert.ok(!slots.includes("fails"), "it proposed over an answer a person already gave");
});

test("an open question is already somebody's, so it is not asked twice", () => {
  const component = [`  {isError && (`, `    <div>{'Failed to load deals'}</div>`, `  )}`].join("\n");
  const { dir, scope } = corpusWith(component, [
    {
      id: "screen-ask",
      at: { view: "v" },
      asked_by: "person",
      slots: { fails: { standing: { kind: "open", question: "What are they left with?" } } },
    },
  ]);
  const slots = proposeSlots(scope, dir).map((p) => p.slot);
  assert.ok(!slots.includes("fails"), "a question already in somebody's queue was raised a second time");
});

test("a system-asked exchange with no screen is not reached at all", () => {
  /** ⛔ 27 of bilrost's 45 unanswered exchanges are this kind. Proposing sentences for them out of
   * nothing is the failure mode, not the feature. */
  const { dir, scope } = corpusWith(`  {isError && <div>{'Failed to load deals'}</div>}`, [
    { id: "pure-logic", asked_by: "system", slots: {} },
  ]);
  assert.deepEqual(proposeSlots(scope, dir), []);
});
