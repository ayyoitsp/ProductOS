/**
 * A screen read off the running product.
 *
 * ⛔ EVERY CASE HERE CAME OFF THE REAL APP. The fixtures are the accessibility tree bilrost's own
 * sign-in page returned on localhost:3001, because the two defects worth testing were both
 * invisible until it ran against something real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { viewFrom, partsFrom, parseTree, idFromRoute, titleOf, routeOf, readingFrom } from "../dist/v2/walked.js";

/** Verbatim from http://localhost:3001/sign-in. */
const SIGN_IN = `button "Continue with Apple" [ref_1]
button "Continue with Google" [ref_2]
button "Continue with Microsoft" [ref_3]
textbox "Enter your email address" [ref_4] type="text" placeholder="Enter your email address"
textbox "Enter your password" [ref_5] type="password" placeholder="Enter your password"
button "Show password" [ref_6]
button [ref_7]
link "Clerk logo" [ref_8] href="https://go.clerk.com/components"`;

test("what the browser calls a thing is what the part is", () => {
  const parts = partsFrom(parseTree(SIGN_IN), "http://localhost:3001");
  const by = (id) => parts.find((p) => p.id === id);
  assert.equal(by("continue-with-apple").role, "commits");
  assert.equal(by("enter-your-email-address").role, "entry");
  assert.equal(by("enter-your-password").role, "entry");
  /** ⛔ The role carries its reason, so a wrong one can be argued with rather than just disbelieved. */
  assert.match(by("enter-your-email-address").from, /put a value into/);
});

test("⛔ a control with no words is not a part", () => {
  /** `button [ref_7]` is real and on that page. Naming it `button-7` would invent the one thing a
   * part is for — something a reviewer can find on the screen again. */
  const parts = partsFrom(parseTree(SIGN_IN), "http://localhost:3001");
  assert.ok(!parts.some((p) => /ref|button-\d/.test(p.id)), "an unnamed control was given a made-up name");
  assert.equal(parts.length, 6, "the unnamed button should be the only thing dropped besides the vendor link");
});

test("⛔ a link that leaves the product is not part of the product's screen", () => {
  /**
   * `link "Clerk logo" href="https://go.clerk.com/components"` came back as a `navigates` part on
   * the first real walk — which would have put a vendor's marketing site in the corpus as somewhere
   * this product takes you.
   */
  const parts = partsFrom(parseTree(SIGN_IN), "http://localhost:3001");
  assert.ok(!parts.some((p) => p.id === "clerk-logo"), "an off-origin link became a part of this screen");
});

test("a link inside the product is kept, and navigates", () => {
  const parts = partsFrom(parseTree(`link "Deals" [ref_9] href="/cre-deals"`), "http://localhost:3001");
  assert.equal(parts.length, 1);
  assert.equal(parts[0].role, "navigates");
});

test("⛔ a link styled as a button still goes somewhere", () => {
  /** The href decides, not the label — otherwise "Save" on an anchor files a navigation as a
   * promise the screen makes. */
  const parts = partsFrom(parseTree(`link "Save and continue" [ref_1] href="/next"`), "http://localhost:3001");
  assert.equal(parts[0].role, "navigates");
});

test("⛔ a screen is named by its route, because the title is often just the brand", () => {
  /**
   * THE DEFECT THE FIRST REAL WALK FOUND. `/sign-in` came back titled "Bilrost" and was filed as
   * `bilrost` — and so would every other screen in the app, each silently overwriting the last.
   */
  const v = viewFrom({ url: "http://localhost:3001/sign-in", title: "Bilrost", tree: SIGN_IN });
  assert.equal(v.id, "sign-in");
  assert.notEqual(v.id, "bilrost");
});

test("⛔ a dynamic segment is collapsed, or one screen becomes a thousand", () => {
  assert.equal(idFromRoute("/cre-deals"), "cre-deals");
  assert.equal(idFromRoute("/cre-deals/a7f3b2c891de4455"), "cre-deals-one");
  assert.equal(idFromRoute("/cre-deals/1234/sizing"), "cre-deals-one-sizing");
  assert.equal(idFromRoute("/"), "home");
});

test("the title keeps the product's own word for the screen", () => {
  assert.equal(titleOf("Deals | Bilrost", "/cre-deals"), "Deals");
  assert.equal(titleOf("Security | Bilrost", "/security"), "Security");
});

test("a route is a path, never a host", () => {
  assert.equal(routeOf("http://localhost:3001/cre-deals?stage=term"), "/cre-deals?stage=term");
});

test("⛔ the evidence points at the URL, which is the only reason a walk counts", () => {
  /**
   * A walk earns its rung above an inference for exactly one reason: anybody can go to that address
   * and disagree. A `ref` describing the walk instead of naming the place would take that away and
   * leave a louder guess.
   */
  const r = readingFrom({
    url: "http://localhost:3001/cre-deals",
    bears_on: "deal-list#deals-list",
    observes: "the list loaded twelve deals and an unsized one showed a dash",
    at: "2026-10-09",
  });
  assert.equal(r.basis.kind, "walk");
  assert.equal(r.basis.ref, "http://localhost:3001/cre-deals");
  assert.equal(r.bears_on, "deal-list#deals-list");
});
