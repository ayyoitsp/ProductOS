/**
 * The chrome a product wears on every screen, and the menu that moves between them.
 *
 * ⛔ A WALK WITHOUT THE MENU IS NOT A WALK, AND THAT IS HOW IT SHIPPED.
 *
 * Peter, earlier: *"i don't think we need to show the full menu in every page, we should just show
 * the relevant inline page"* — right, for reviewing ONE screen beside its behaviours, where the
 * same shell on all seventeen carries no information and takes room from the part under review. So
 * `drawFromRoute` stopped composing layouts, and `layoutsAround` was kept and left unused.
 *
 * Then the walk was built on those same bare drawings, and Peter: *"haha walk looks terrible.. what
 * is this??? no menu, rendering is all wrong, basic buttons like 'back to cre deals' doesn't even
 * work?"* — and *"like this prototype is supposed to span the product?"*
 *
 * Both are right, and they are not in conflict: a screen under review wants no chrome, and a
 * product you walk IS its chrome. The menu is the navigation. "Back to CRE Deals" is a control in
 * the shell, so with no shell there was nothing to press.
 *
 * ⛔ ONE SHELL PER PROTOTYPE, NOT ONE PER PRODUCT. An unauthenticated flow has no application
 * menu at all, so a single shell for the whole product would put the signed-in navigation around a
 * sign-in screen. See `Prototype` in the schema.
 *
 * ⛔ THE NAV IS A BETTER SOURCE OF NAVIGATION THAN WORD-MATCHING. `connect` reads a control's
 * sentence and guesses where it lands; on the corpus this was built against it found four links
 * across seventeen screens. A product's own menu names its areas outright, in its own words, in one
 * file — it is the one place a product says how to get around itself.
 */
import { drawFromRoute, layoutsAround } from "./draw.js";

export interface ShellNav {
  /** What the menu calls it. */
  label: string;
  /** `<scope>#<view>` once something resolves it — left unset where nothing does. */
  to?: string;
}

export interface DrawnShell {
  /**
   * The chrome, with `<!--screen-->` where the screen goes.
   *
   * ⛔ A MARKER RATHER THAN A SLOT ELEMENT, because the walk inserts into it by string and an empty
   * element with a class would be one more thing a stylesheet could reach and move.
   */
  html: string;
  nav: ShellNav[];
  /** The layout files it was composed from, so a reader can go and look. */
  from: string[];
}

/** Where `{children}` ended up once the layouts were drawn. */
const CHILDREN = "<!--children-->";

/**
 * Draw the chrome around a route, without the route's own screen in it.
 *
 * ⛔ DRAWN FROM THE LAYOUTS, NEVER FROM A SCREEN. Composing the page and cutting its content out
 * afterwards would bake one screen's markup into the shell every other screen then wears.
 */
export function drawShellFrom(routeFile: string, opts: { componentsDir?: string } = {}): DrawnShell | undefined {
  const layouts = layoutsAround(routeFile);
  if (!layouts.length) return undefined;

  /**
   * Outermost first. `layoutsAround` walks up, so the nearest layout comes back first and the
   * product's own frame last — composing in that order would put the page chrome inside the tab
   * strip it contains.
   */
  let html = CHILDREN;
  const from: string[] = [];
  for (const layout of layouts) {
    const drawn = drawFromRoute(layout, { componentsDir: opts.componentsDir });
    if (!drawn.html.trim()) continue;
    from.push(layout);
    html = drawn.html.includes(CHILDREN) ? drawn.html.replace(CHILDREN, html) : `${drawn.html}${html}`;
  }
  if (!from.length) return undefined;

  return { html: html.replace(CHILDREN, "<!--screen-->"), nav: navIn(html), from };
}

/**
 * The menu items in a drawn shell.
 *
 * ⛔ READ OUT OF WHAT WAS DRAWN, not out of the source a second time. The drawing already resolved
 * the product's nav config — the list of labels it holds is the product's own list, in its own
 * order, and reading the file again would be a second answer that can disagree with the first.
 */
export function navIn(html: string): ShellNav[] {
  const out: ShellNav[] = [];
  const seen = new Set<string>();
  /** A nav element's own contents, or failing that the whole shell. */
  const nav = /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(html)?.[1] ?? html;

  /**
   * ⛔ A MENU ITEM IS NOT ALWAYS AN `<a>`. The first version matched anchors and buttons, and the
   * product this was built against renders every item as `<Link>` — a component the drawing cannot
   * resolve, so it comes out as `<div data-component="Link">`. Five items in the nav, none of them
   * an anchor, and the menu read as empty.
   *
   * So: anchors, buttons, and anything the drawing marked as an unresolved link component. Nothing
   * else — a `<div>` with text in a nav is as often a heading or a count as a place to go.
   */
  const ITEM = /<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>|<(\w+)\b[^>]*data-component="[^"]*Link[^"]*"[^>]*>([\s\S]*?)<\/\2>/gi;
  for (const m of nav.matchAll(ITEM)) {
    const label = (m[1] ?? m[3] ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    /** A control with no words is an icon-only affordance — real, and not a place to go. */
    if (!label || label.length > 40 || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ label });
  }
  return out;
}

/**
 * Point each menu item at the screen it names.
 *
 * ⛔ A PROTOTYPE'S MENU IS THE AUTHOR'S, ONCE THEY HAVE TOUCHED IT, and this function is why that
 * is possible: it only ever fills in `to`. The labels and their order are whatever it was handed —
 * the product's own menu the first time, and after that whatever the author made of it.
 *
 * Peter: *"I want to allow users to change high level navigation ... prototype 1 is for the admin
 * role, 2 is for the loan processor role"*. A role's navigation is a product decision, and it is
 * precisely what somebody builds a prototype to try; a generator that replaced it on every run
 * made the surface read-only in the one place it must not be.
 *
 * ⛔ ON THE TITLE, AND ONLY WHERE IT IS UNAMBIGUOUS. A menu says "CRE Deals" and a screen is titled
 * "CRE Deals"; that is the product telling you where its menu goes, and it needs no inference. Two
 * screens answering equally well is a guess, and a menu that silently goes to the wrong one is
 * worse than a menu item that does not move.
 */
export function aimNav(nav: ShellNav[], screens: Array<{ ref: string; title: string }>): ShellNav[] {
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return nav.map((item) => {
    const want = norm(item.label);
    if (!want) return item;
    const exact = screens.filter((s) => norm(s.title) === want);
    if (exact.length === 1) return { ...item, to: exact[0]!.ref };
    /** Then a screen whose title contains every word of the item, still only if one does. */
    const words = want.split(" ").filter(Boolean);
    const near = screens.filter((s) => {
      const t = norm(s.title);
      return words.every((w) => t.includes(w));
    });
    return near.length === 1 ? { ...item, to: near[0]!.ref } : item;
  });
}
