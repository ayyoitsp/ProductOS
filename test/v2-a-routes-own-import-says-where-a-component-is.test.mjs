/**
 * ⛔ A ROUTE'S OWN IMPORT SAYS WHERE A COMPONENT IS, AND THE DRAWER WAS GUESSING INSTEAD.
 *
 * Peter, about the drawings of his product: *"It's way off, no menus in a lot of places."*
 *
 * Walked and then read out of his corpus, which is how this was found rather than reasoned about:
 *
 *     prototype `cre`                       shell_html 7,882 bytes · 15 nav items drawn
 *     prototype `private-lending-…`         shell_html   362 bytes ·  0 nav items drawn
 *
 * The second one in full is four provider divs and `<!--screen-->`. Its route delegates its layout
 * — `<AppProvider>{children}</AppProvider>` — and the sidebar, the nav and the header all live in
 * the provider's own file. The drawer emitted an opaque box and the chrome died with it. The route
 * that DID draw a menu was the one that happened to write its chrome inline at the call site.
 *
 * ⛔ WHY IT COULD NOT FIND IT. Components were resolved by indexing the route's NEIGHBOURHOOD: every
 * `.tsx` within four directories of the route, capped at 400 directories, keyed by filename and by
 * exported name. That exists for a real reason — a wizard beside its route — and it cannot answer
 * for a component that lives anywhere else in the project. The `import` line says exactly where the
 * file is, and nothing read it.
 *
 * ⛔ SO THE FIXTURE PUTS THE PROVIDER OUT OF REACH ON PURPOSE. A provider sitting next to the route
 * would be found by the neighbourhood walk and this test would pass without the fix — which is the
 * shape of a test that asserts nothing. Here the route is buried deep and the provider is at the
 * top of the project, so the only thing that can connect them is the import.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { temp } from "./support/temp.mjs";

const { drawFromRoute } = await import("../dist/v2/draw.js");

/**
 * A project shaped like a real Next app: a deep route, a provider at the top, and an alias.
 *
 * ⛔ `package.json` MARKS THE ROOT, because the neighbourhood walk stops there — without it the walk
 * would climb out of the fixture and into this repository, and what the test measured would depend
 * on what happens to be checked out around it.
 */
function app({ alias = false } = {}) {
  const root = path.join(temp("v2import-"), "app");
  const deep = path.join(root, "frontend", "app", "(app)", "projects");
  const shared = path.join(root, "chrome");
  fs.mkdirSync(deep, { recursive: true });
  fs.mkdirSync(shared, { recursive: true });

  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  if (alias) {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } })
    );
  }

  /**
   * ⛔ THE CHROME IS HERE, NOT BESIDE THE ROUTE. This is the whole point of the fixture: five
   * directories from the route, so the neighbourhood index cannot reach it.
   */
  fs.writeFileSync(
    path.join(shared, "AppProvider.tsx"),
    `export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r">
        <nav className="space-y-1">
          <a href="/loan-pipeline">Dashboard</a>
          <a href="/cre-deals">CRE Deals</a>
          <a href="/activity">Activity</a>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
`
  );

  const spec = alias ? "@/chrome/AppProvider" : "../../../../chrome/AppProvider";
  fs.writeFileSync(
    path.join(deep, "page.tsx"),
    `import { AppProvider } from "${spec}";

export default function ProjectsPage() {
  return (
    <AppProvider>
      <h1>Projects</h1>
    </AppProvider>
  );
}
`
  );
  return { root, route: path.join(deep, "page.tsx") };
}

test("⛔ a component imported from outside the neighbourhood is drawn, not emitted as a box", () => {
  const { route } = app();
  const drawn = drawFromRoute(route);
  const html = drawn?.html ?? "";
  assert.ok(html, "the route drew nothing at all");

  /** ⛔ The nav is the thing he is missing, so the nav is what is asserted. */
  for (const item of ["Dashboard", "CRE Deals", "Activity"])
    assert.match(html, new RegExp(item), `the drawn chrome has no "${item}" — the provider was not entered`);

  /** ⛔ And it is a real sidebar, not the text alone floating in a div. */
  assert.match(html, /w-64/, "the sidebar's own classes are gone, so the layout went with the component");

  /** ⛔ The provider is no longer an unresolved box. */
  assert.doesNotMatch(
    html,
    /data-component="AppProvider"/,
    "the provider is still drawn as an opaque box, which is the defect"
  );

  /** ⛔ And the screen it wraps survived — a chrome that ate its children would be worse. */
  assert.match(html, /Projects/, "the page inside the provider was lost");
});

test("⛔ an aliased import resolves through the project's own tsconfig paths", () => {
  /**
   * ⛔ READ FROM `paths`, NEVER GUESSED. Assuming `@/` means `src/` is true of many projects and
   * false in a way nothing would report — the component would simply go on being a box, which is
   * indistinguishable from not having the fix at all.
   */
  const { route } = app({ alias: true });
  const html = drawFromRoute(route)?.html ?? "";
  assert.match(html, /CRE Deals/, "an aliased provider was not resolved through tsconfig paths");
  assert.doesNotMatch(html, /data-component="AppProvider"/, "the aliased provider is still an opaque box");
});

test("⛔ a package import is left alone rather than chased out of the project", () => {
  /**
   * `import { Toaster } from "sonner"` is not a file in this project. Following it would leave the
   * project — which the neighbourhood walk has a comment refusing to do — and would draw somebody
   * else's component as though it were this product's.
   */
  const { root, route } = app();
  fs.writeFileSync(
    route,
    `import { AppProvider } from "../../../../chrome/AppProvider";
import { Toaster } from "sonner";

export default function ProjectsPage() {
  return (
    <AppProvider>
      <Toaster />
      <h1>Projects</h1>
    </AppProvider>
  );
}
`
  );
  const html = drawFromRoute(route)?.html ?? "";
  /** The provider still resolves — one unresolvable import must not poison the file. */
  assert.match(html, /CRE Deals/, "a package import stopped the local provider resolving");
  /** And the package component stays a box, honestly marked. */
  assert.match(html, /data-component="Toaster"/, "a component from a package was drawn as though it were ours");
  assert.ok(fs.existsSync(path.join(root, "package.json")), "the fixture lost its root marker");
});
