/**
 * ⛔ A PROTOTYPE'S MENU IS THE AUTHOR'S, ONCE THEY HAVE TOUCHED IT.
 *
 * Peter: *"one thing I want to allow users to do is change high level navigation ... say a user
 * just wanted to do something like 'oh, I want 3 main prototypes, prototype 1 is for the admin
 * role, 2 is for the loan processor role'"*.
 *
 * Several prototypes was already expressible. Editing one's menu was not: `v2 prototypes` replaced
 * `nav` wholesale on every run, so an author who cut four items from the admin walk got them back
 * the next time anybody drew a screen. A role's navigation is a product decision — it is precisely
 * what somebody builds a prototype to try — and a generator that overwrites it makes the surface
 * read-only in the one place it must not be.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { aimNav, navIn } from "../dist/v2/shell.js";

const SCREENS = [
  { ref: "deal-list#deals-list", title: "CRE Deals" },
  { ref: "org-loan-terms#org-loan-terms", title: "Fannie Mae program settings" },
  { ref: "deal-workspace#activity-tab", title: "Activity" },
];

test("a menu item is pointed at the screen it names", () => {
  const aimed = aimNav([{ label: "CRE Deals" }, { label: "Activity" }], SCREENS);
  assert.equal(aimed[0].to, "deal-list#deals-list", "a menu item naming a screen exactly was not aimed at it");
  assert.equal(aimed[1].to, "deal-workspace#activity-tab", "a second item was not aimed");
});

test("an item that names no screen is left alone rather than aimed at the nearest thing", () => {
  /**
   * ⛔ A MENU THAT SILENTLY GOES SOMEWHERE WRONG IS WORSE THAN ONE THAT DOES NOT MOVE. "Borrowers"
   * is real chrome in a product whose corpus has no borrowers screen; pretending it navigates would
   * be the prototype lying about the product.
   */
  const aimed = aimNav([{ label: "Borrowers" }, { label: "Incoming" }], SCREENS);
  assert.equal(aimed[0].to, undefined, "an item naming no screen was aimed at something anyway");
  assert.equal(aimed[1].to, undefined, "an item naming no screen was aimed at something anyway");
});

test("an author's order is the order, and aiming does not reshuffle it", () => {
  const authored = [{ label: "Activity" }, { label: "CRE Deals" }];
  assert.deepEqual(
    aimNav(authored, SCREENS).map((n) => n.label),
    ["Activity", "CRE Deals"],
    "the menu was reordered under the author"
  );
});

test("two screens answering a menu item equally well is a guess, so neither is taken", () => {
  /** ⛔ The same reasoning as `connect`'s margin rule: a close call is not an answer. */
  const twins = [
    { ref: "a#one", title: "Deals" },
    { ref: "b#two", title: "Deals" },
  ];
  assert.equal(aimNav([{ label: "Deals" }], twins)[0].to, undefined, "an ambiguous item was aimed at one of two");
});

test("a menu is read out of the chrome, including items that are not anchors", () => {
  /**
   * ⛔ The product this was built against renders every item as `<Link>` — a component the drawing
   * cannot resolve, so it arrives as `<div data-component="Link">`. Matching only anchors and
   * buttons found a nav of fifteen items and reported it empty.
   */
  const chrome =
    '<nav><div data-component="Link"><span>Dashboard</span></div>' +
    '<a href="/x"><span>CRE Deals</span></a>' +
    '<button><svg /></button></nav>';
  const found = navIn(chrome).map((n) => n.label);
  assert.deepEqual(found, ["Dashboard", "CRE Deals"], "the menu was not read out of the chrome as written");
});
