/**
 * ⛔ `returns` IS ONE DESTINATION AND IT REFUSES THE OTHER TWO SPELLINGS OF IT.
 *
 * The field exists because Back had nowhere to live. A field that admits every shape of the thing
 * it replaces replaces nothing — so a part may say it returns, or say where it leads, never both,
 * and only a `navigates` may say it at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

const { Part } = await import(path.resolve("dist/v2/schema.js"));

const bad = (part) => {
  const r = Part.safeParse(part);
  assert.equal(r.success, false, `this should have been refused: ${JSON.stringify(part)}`);
  return r.error.issues.map((i) => i.message).join(" ");
};

test("a navigating control that says nowhere is refused, and told about returns", () => {
  const why = bad({ id: "back", role: "navigates", label: "Back" });
  assert.match(why, /navigates and says nowhere/);
  /** ⛔ The refusal names the way out, or an author writes `commits` again — which is what happened. */
  assert.match(why, /returns: true/, "the refusal does not tell anybody the field exists");
});

test("a control returns, or leads somewhere — never both", () => {
  const why = bad({ id: "x", role: "navigates", label: "X", returns: true, leads_to: "a#b" });
  assert.match(why, /does one or the other/);
});

test("only a navigating control returns", () => {
  const why = bad({ id: "save", role: "commits", label: "Save", returns: true });
  assert.match(why, /which is what `navigates` is/);
});

test("Back, as it is now written", () => {
  const r = Part.safeParse({ id: "back-to-details", role: "navigates", label: "Back", returns: true });
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error?.issues));
});
