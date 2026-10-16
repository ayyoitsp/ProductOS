/**
 * A screen read off the running product — what was on it, and what each thing does.
 *
 * ⛔ WHAT THIS IS FOR. Peter: *"let's add walk-to-index. it doesn't give us CONFIRMED state. but it
 * gives us a starting place for how an existing product already behaves."* bilrost has 74 routes
 * and 681 components, and the corpus reaches five of them. Reading that much code to find out what
 * the product already does is the slow way round when the product is sitting there running.
 *
 * ⛔ IT PROPOSES A SCREEN, NEVER TRUTH, and the distinction is the whole safety argument. A walk of
 * a product with a bug records the bug perfectly — so what comes back is *"this is what it did"*,
 * which is a `kind: walk` reading and a view somebody still has to agree to. It never writes a
 * sentence about what the product SHOULD do, because nothing it can see could tell it that.
 *
 * ⛔ AND IT READS THE ACCESSIBILITY TREE, NOT PIXELS. The tree already says `button`, `textbox`,
 * `link` — which is exactly the question `PartRole` asks — so the mapping is a lookup rather than a
 * judgement. A screenshot would need a model to guess what a thing is, and a guess about whether a
 * control commits or navigates is a guess about what the product promises.
 */
import { PartRole } from "./schema.js";

/** One line of an accessibility tree, as the browser hands it over. */
export interface Node {
  role: string;
  name: string;
  ref?: string;
  href?: string;
}

export interface WalkedPart {
  id: string;
  label: string;
  role: (typeof PartRole.options)[number];
  /** Why it was given that role — the lookup, so a wrong one is arguable. */
  from: string;
}

export interface WalkedView {
  id: string;
  title: string;
  route: string;
  parts: WalkedPart[];
}

/**
 * What a thing on screen is, by what the browser already calls it.
 *
 * ⛔ A LINK IS `navigates` AND A BUTTON IS `commits`, AND THE ONE EXCEPTION IS A LINK STYLED AS A
 * BUTTON. The tree reports `link` with an `href`, so the href is what decides: a control that goes
 * somewhere navigates, whatever it looks like. Guessing from the label would read "Save" on an
 * anchor as a commit and file a navigation as a promise.
 */
const ROLES: { match: RegExp; role: WalkedPart["role"]; why: string }[] = [
  { match: /^(textbox|searchbox|combobox|spinbutton|slider|checkbox|radio|switch)$/i, role: "entry", why: "the browser reports it as something you put a value into" },
  { match: /^(link)$/i, role: "navigates", why: "it is a link, so it goes somewhere" },
  { match: /^(button|menuitem|tab)$/i, role: "commits", why: "the browser reports it as a control you press" },
  { match: /^(table|grid|list|listbox|feed|article|figure|img|image)$/i, role: "display", why: "it shows something rather than taking an action" },
  { match: /^(region|main|form|group|navigation|banner|complementary|dialog|tabpanel)$/i, role: "region", why: "it is a container holding other things" },
];

export const slug = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

/**
 * Parse the tree the browser returns. Lines look like:
 *   button "Create deal" [ref_4]
 *   link "Deals" [ref_2] href="/cre-deals"
 */
export function parseTree(text: string): Node[] {
  const out: Node[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*([a-zA-Z]+)\s+"([^"]*)"(?:\s+\[([^\]]+)\])?(?:\s+href="([^"]*)")?/.exec(line);
    if (!m) continue;
    out.push({ role: m[1], name: m[2], ref: m[3], href: m[4] });
  }
  return out;
}

/**
 * ⛔ A CONTROL WITH NO WORDS IS NOT A PART. The tree is full of unnamed wrappers and icon buttons
 * whose name the browser could not resolve, and a part whose label is "" is one nobody can review,
 * talk about, or find on the screen again. Naming it `button-7` would be inventing the one thing a
 * part is for.
 */
const WORTH_NAMING = (n: Node): boolean => n.name.trim().length >= 2 && n.name.trim().length <= 60;

/**
 * ⛔ A LINK THAT LEAVES THE PRODUCT IS NOT PART OF THE PRODUCT'S SCREEN. Walked against the real
 * sign-in page, the Clerk badge — `link "Clerk logo" href="https://go.clerk.com/components"` — came
 * back as a `navigates` part, which would have put a vendor's marketing site in the corpus as
 * somewhere this product takes you.
 */
function leavesTheProduct(href: string | undefined, origin: string): boolean {
  if (!href) return false;
  if (/^(mailto|tel):/i.test(href)) return true;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return new URL(href).origin !== origin;
  } catch {
    return false;
  }
}

export function partsFrom(nodes: Node[], origin = ""): WalkedPart[] {
  const out: WalkedPart[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (!WORTH_NAMING(n)) continue;
    if (leavesTheProduct(n.href, origin)) continue;
    /** ⛔ `href` beats the reported role — a link styled as a button still goes somewhere. */
    const found: { role: WalkedPart["role"]; why: string } | undefined = n.href
      ? { role: "navigates", why: "it carries an href, so it goes somewhere" }
      : ROLES.find((r) => r.match.test(n.role));
    if (!found) continue;
    const id = slug(n.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: n.name.trim(), role: found.role, from: found.why });
  }
  return out;
}

/** The route as the corpus names screens: a path, not a URL with a host in it. */
export function routeOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

/**
 * ⛔ THE TITLE IS THE PRODUCT'S OWN WORD FOR THE SCREEN, with the brand suffix taken off. "Deals |
 * Bilrost" is a screen called Deals; carrying the suffix into every id would put the company name
 * in thirty screen ids.
 */
export function titleOf(docTitle: string, route: string): string {
  const cleaned = docTitle.split(/\s+[|·—-]\s+/)[0].trim();
  return cleaned || route;
}

/**
 * A screen's id comes from its ROUTE, not its title.
 *
 * ⛔ BECAUSE THE TITLE IS OFTEN JUST THE BRAND, AND THEN EVERY SCREEN HAS ONE ID. Walked against
 * the real product, `/sign-in` came back titled "Bilrost" and was filed as `bilrost` — and so would
 * every other screen in the app, each one silently overwriting the last. A route is unique by
 * construction, which is the property an id needs.
 *
 * ⛔ AND A DYNAMIC SEGMENT IS COLLAPSED, or one screen becomes a thousand. `/cre-deals/a7f3b2…` is
 * the deal workspace, not a screen about that deal — so anything that looks like an id becomes the
 * name of the thing it identifies.
 */
export function idFromRoute(route: string): string {
  const parts = route
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      /^[0-9a-f]{8,}$/i.test(seg) || /^\d+$/.test(seg) || /^[0-9a-f-]{20,}$/i.test(seg) ? "one" : seg,
    );
  return slug(parts.join("-")) || "home";
}

export function viewFrom(input: { url: string; title: string; tree: string }): WalkedView {
  const route = routeOf(input.url);
  const origin = (() => {
    try {
      return new URL(input.url).origin;
    } catch {
      return "";
    }
  })();
  return {
    id: idFromRoute(route),
    title: titleOf(input.title, route),
    route,
    parts: partsFrom(parseTree(input.tree), origin),
  };
}

/**
 * The evidence, as the corpus stores it.
 *
 * ⛔ `ref` IS THE URL AND NOTHING ELSE. A walk earns its rung for one reason — anybody can go to
 * that address and disagree — so a `ref` describing the walk instead of naming the place would take
 * the only property that makes it better than a guess.
 */
export function readingFrom(input: {
  url: string;
  bears_on: string;
  observes: string;
  at: string;
}): { id: string; bears_on: string; observes: string; basis: { kind: "walk"; ref: string; at: string } } {
  return {
    id: `walked-${slug(routeOf(input.url))}-${input.at}`,
    bears_on: input.bears_on,
    observes: input.observes,
    basis: { kind: "walk", ref: input.url, at: input.at },
  };
}
