/**
 * ⛔ A DRAWING THAT MIRRORS THE MARKUP AND NOT THE NAVIGATION IS A SCREENSHOT.
 *
 * Peter, on the drawn CRE deals list: *"prototype doesn't actually walk anyways, no deal links are
 * clickable, none of the individual features got new pages"*. And, on the deal page: *"the deal
 * overview page doesn't even have the right fucking tabs… still has this bullshit 'blue harbour,
 * fairview court, northwind' tabs at the top? no tabs for any of the verticals?"*.
 *
 * Two defects, both in the generator, both the same shape — the drawer read his file and threw away
 * the part that was not markup:
 *
 *   1. EVERY HANDLER WAS DISCARDED. One line matched /^on[A-Z]/ and dropped the lot, including the
 *      only statement of where a control goes. His deals list says it plainly, in an onClick that
 *      pushes one deal's address. Nothing downstream could recover it: the part list comes from the
 *      truth, so a destination nobody typed by hand did not exist, and `connect` works out what a
 *      control leads to FROM WHAT THE CORPUS SAYS.
 *
 *   2. A LIST WRITTEN "as const" WAS NOT A LIST. His eight tabs are an array of object literals
 *      with the suffix that makes their ids usable as a type. The reader asked whether it had an
 *      array literal, got no — an assertion node is not one — and fell through to the generic three
 *      rows, filled from the only sample values the drawing had. A deal workspace drew three tabs
 *      named after deals.
 *
 * ⛔ AND NEITHER IS ABOUT TABS OR ABOUT ROWS. An assertion changes a type and never a value, so
 * every place a product writes its own words that way drew as three of something; and a handler is
 * where every application in this idiom says where its controls lead.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { drawFromRoute } = await import("../dist/v2/draw.js");
const { routeOfFile, sameRoute, screenAnswering } = await import("../dist/v2/connects.js");

/**
 * A component in the idiom the defects were found in: a list declared "as const" beside the page,
 * handed to a child that reorders it, and a row that navigates from a handler.
 *
 * ⛔ WRITTEN OUT RATHER THAN POINTED AT. The product this was found in is a different repository
 * that this suite cannot require to exist — so the shape is reproduced here, and a fixture that
 * stopped reproducing it would fail loudly rather than quietly passing.
 */
function appWith() {
  const dir = temp("v2-drawn-nav-");
  const app = path.join(dir, "app", "deals");
  fs.mkdirSync(app, { recursive: true });
  fs.mkdirSync(path.join(dir, "app", "deals", "[dealId]"), { recursive: true });
  fs.mkdirSync(path.join(dir, "components"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "components", "Strip.tsx"),
    `import { useMemo } from "react"
export function Strip({ tabs }: { tabs: readonly { id: string; label: string }[] }) {
  const ordered = useMemo(() => [...tabs], [tabs])
  return <nav>{ordered.map((entry) => <button key={entry.id}>{entry.label}</button>)}</nav>
}
`
  );

  fs.writeFileSync(
    path.join(app, "page.tsx"),
    `import { useRouter } from "next/navigation"
import { Strip } from "../../components/Strip"

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'rent-roll', label: 'Rent Roll' },
  { id: 'operating-statements', label: 'Operating Statements' },
] as const

export default function Deals() {
  const router = useRouter()
  const deals = useDeals()
  return (
    <div>
      <Strip tabs={TABS} />
      <table><tbody>
        {deals.map((deal) => (
          <tr key={deal.id} onClick={() => router.push(\`/deals/\${deal.id}\`)}>
            <td>{deal.name}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}
`
  );

  fs.writeFileSync(
    path.join(dir, "app", "deals", "[dealId]", "page.tsx"),
    `export default function Deal() { return <main><h1>One deal</h1></main> }\n`
  );

  return { dir, list: path.join(app, "page.tsx") };
}

test("⛔ a control that navigates says where it goes, instead of being dropped with its handler", () => {
  const { list } = appWith();
  const html = drawFromRoute(list, {}).html ?? "";
  const goes = [...html.matchAll(/data-goes-to="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(
    goes.length >= 1,
    "the drawing carries no destination at all, so nothing downstream can make a row pressable"
  );
  assert.ok(
    goes.includes("/deals/:id"),
    `the pushed address was not recorded as a route — got ${JSON.stringify(goes)}`
  );
  /** ⛔ The substitution stands for a value: this is a picture of the screen, not of one deal. */
  assert.doesNotMatch(html, /data-goes-to="[^"]*\$\{/, "an expression was written into the address as source text");
});

test("⛔ a list written as const is the product's own words, not three of something", () => {
  const { list } = appWith();
  const html = drawFromRoute(list, {}).html ?? "";
  for (const label of ["Overview", "Rent Roll", "Operating Statements"])
    assert.match(html, new RegExp(label), `the drawing is missing the tab "${label}" the code declares`);
  /**
   * ⛔ THE HALF THAT NAMES THE DEFECT, AND IT IS SCOPED TO THE STRIP ON PURPOSE. Three tabs is also
   * what the broken version produced — the difference is that they were samples. Asked of the whole
   * drawing this assertion fails on a correct one, because the table rows beneath are sample values
   * and SHOULD be: a deal's name is a figure nobody knows, while a tab's label is written in the
   * source. That is the distinction the fix is about, so the test has to make it too.
   */
  const strip = /<nav>([\s\S]*?)<\/nav>/.exec(html)?.[1];
  assert.ok(strip, "the list is not drawn as a strip at all, so there is nothing to check");
  assert.doesNotMatch(
    strip,
    /productos-sample/,
    "the tab strip is filled with sample values standing in for a list that was never read"
  );
});

test("⛔ the address a control pushes resolves to the screen that answers it", () => {
  assert.equal(routeOfFile("frontend/app/(app)/cre-deals/[projectId]/page.tsx"), "/cre-deals/:projectId");
  /** ⛔ A parameter matches a parameter whatever either is called — the code and the route name it differently. */
  assert.equal(sameRoute("/cre-deals/:id", "/cre-deals/:projectId"), true);
  assert.equal(sameRoute("/cre-deals", "/cre-deals/:projectId"), false, "a list is not its own detail screen");
  assert.equal(sameRoute("/borrowers/:id", "/cre-deals/:projectId"), false, "two different screens matched");
  /** A group segment is the router's bookkeeping and names nothing a reader types. */
  assert.equal(routeOfFile("app/(marketing)/pricing/page.tsx"), "/pricing");
});


/**
 * A tab strip in the idiom the second round of this was found in: the control that navigates does
 * not navigate — it calls a prop, and every tab pushes the same path with a different query value.
 */
function appWithTabs() {
  const dir = temp("v2-drawn-tabs-");
  const app = path.join(dir, "app", "deals", "[dealId]");
  fs.mkdirSync(app, { recursive: true });
  fs.mkdirSync(path.join(dir, "components"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, "components", "Shell.tsx"),
    `export function Shell({ tabs, onSelectTab }: { tabs: readonly { id: string; label: string }[]; onSelectTab: (id: string) => void }) {
  return <nav>{tabs.map((entry) => <button key={entry.id} onClick={() => onSelectTab(entry.id)}>{entry.label}</button>)}</nav>
}
`
  );

  fs.writeFileSync(
    path.join(app, "page.tsx"),
    `import { useRouter } from "next/navigation"
import { Shell } from "../../../components/Shell"

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'rent-roll', label: 'Rent Roll' },
] as const

export default function Deal() {
  const router = useRouter()
  const dealId = useDealId()
  return <Shell tabs={TABS} onSelectTab={(id) => router.push(\`/deals/\${dealId}?tab=\${id}\`)} />
}
`
  );
  return path.join(app, "page.tsx");
}

test("⛔ a control that calls a prop still says where it goes — the push is one frame up", () => {
  const html = drawFromRoute(appWithTabs(), {}).html ?? "";
  const goes = [...html.matchAll(/data-goes-to="([^"]+)"/g)].map((m) => m[1]);
  /**
   * ⛔ ONE PER TAB, AND DIFFERENT. A component that renders a control is deliberately ignorant of
   * where it leads — reading the handler at the element finds a call to an unknown function and
   * stops, which is what left every tab in a drawn workspace inert.
   */
  assert.equal(goes.length, 2, `expected one destination per tab, got ${JSON.stringify(goes)}`);
  assert.ok(goes.includes("/deals/:dealId?tab=overview"), `overview tab goes nowhere — ${JSON.stringify(goes)}`);
  assert.ok(goes.includes("/deals/:dealId?tab=rent-roll"), `rent roll tab goes nowhere — ${JSON.stringify(goes)}`);
  /** ⛔ The path is still a picture of the screen: the deal stands for itself, the tab does not. */
  assert.ok(
    goes.every((g) => g.includes(":dealId")),
    "one deal's address was written into the drawing instead of standing for any deal"
  );
});

test("⛔ where screens share a path, the query value picks between them", () => {
  const served = [
    { id: "deal-workspace#overview-tab", route: "/deals/:id", screen: "overview" },
    { id: "deal-workspace#rent-roll-tab", route: "/deals/:id", screen: "rent-roll" },
    { id: "deal-workspace#sizing-tab", route: "/deals/:id", screen: "sizing" },
  ];
  const from = "deal-workspace#overview-tab";
  assert.equal(screenAnswering("/deals/:dealId?tab=rent-roll", from, served)?.id, "deal-workspace#rent-roll-tab");
  assert.equal(screenAnswering("/deals/:dealId?tab=sizing", from, served)?.id, "deal-workspace#sizing-tab");
  /**
   * ⛔ A SCREEN MAY POINT AT ITSELF HERE, because a tab strip is on every tab: pressing Overview
   * from Overview is a real control, and refusing it would make one tab inert on every screen.
   */
  assert.equal(screenAnswering("/deals/:dealId?tab=overview", from, served)?.id, "deal-workspace#overview-tab");
  /**
   * ⛔ AND A QUERY NOTHING ANSWERS RESOLVES TO NOTHING, rather than to whichever screen happens to
   * share the path. Three indistinguishable candidates is the state that produced a drawing nobody
   * could press; answering one of them anyway puts a tab on the page that goes somewhere it does
   * not go.
   */
  assert.equal(screenAnswering("/deals/:dealId?tab=appraisal", from, served), undefined);
  /** With nothing recorded about which screen is which, there is no answer to give. */
  const unlabelled = served.map((r) => ({ id: r.id, route: r.route }));
  assert.equal(screenAnswering("/deals/:dealId?tab=rent-roll", from, unlabelled), undefined);

  /**
   * ⛔ TWO SCREENS CLAIMING ONE ARM IS AN AMBIGUITY, NOT A COIN TOSS — and this corpus has one: a
   * workspace shell and the tab it opens on are drawn from the same arm of the same component, so
   * both record "overview". Taking the first put every press of Overview on the chrome instead of
   * the screen, which is a control that is visibly live and lands somewhere else.
   */
  const twoClaims = [
    { id: "deal-workspace#workspace-shell", route: "/deals/:id", screen: "overview" },
    { id: "deal-workspace#overview-tab", route: "/deals/:id", screen: "overview" },
    { id: "deal-workspace#rent-roll-tab", route: "/deals/:id", screen: "rent-roll" },
  ];
  assert.equal(screenAnswering("/deals/:dealId?tab=overview", from, twoClaims), undefined);
  /** ⛔ And only that value is poisoned — the arms nobody disputes still resolve. */
  assert.equal(
    screenAnswering("/deals/:dealId?tab=rent-roll", from, twoClaims)?.id,
    "deal-workspace#rent-roll-tab"
  );
});
