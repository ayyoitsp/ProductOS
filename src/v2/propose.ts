/**
 * A screen generated from the truth, in the application's own idiom.
 *
 * ⛔ WHY THIS EXISTS. Peter: *"why can't claude generate proposed screens? it's the STYLES that
 * should be taken from things, should be able to extrapolate a new feature..."*
 *
 * `draw` is a transform: a component goes in, a picture comes out. So a screen could only have a
 * picture if something already rendered it — which tied the corpus to what was built and left every
 * unbuilt screen with nothing to look at. This is the other direction: **truth in, picture out.**
 *
 * ⛔ AND IT IS NOT A LESSER KIND OF SCREEN. The corpus is the target state, so a screen generated
 * from the truth is the same target screen as one populated from a component — what differs is only
 * whether there is code to compare it against yet, which is a fact about the build. Treating it as
 * a second-class "proposal" was the same mistake as gating truth on code, one layer along.
 *
 * ⛔ IT EXTRAPOLATES STYLE, NEVER CONTENT. Every word on the generated screen comes from the corpus
 * — part labels are the product's own words. What comes from the codebase is the IDIOM: how this
 * application writes a card, a field, a primary button. Inventing copy would put sentences nobody
 * wrote in front of a reviewer who is there to judge sentences.
 */
import fs from "node:fs";
import { indexDesignSystem, drawWith } from "./design.js";
import path from "node:path";
import type { Part, Steer, View } from "./schema.js";
import { inEffect } from "./steers.js";

/** How this application writes each kind of thing, learned from its own components. */
export interface Idiom {
  /** Most common class list for a container/card. */
  card: string;
  field: string;
  button: string;
  heading: string;
  label: string;
  muted: string;
  /** Files the idiom was learned from, for the report. */
  from: string[];
}

const FALLBACK: Idiom = {
  card: "rounded-lg border p-4",
  field: "w-full rounded-md border px-3 py-2",
  button: "rounded-md px-3 py-2",
  heading: "text-lg font-semibold",
  label: "text-sm font-medium",
  muted: "text-sm opacity-70",
  from: [],
};

function commonest(values: string[]): string | undefined {
  const tally = new Map<string, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function sources(dir: string, limit = 400): string[] {
  const out: string[] = [];
  const walk = (d: string, depth: number): void => {
    if (depth > 8 || out.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (["node_modules", ".next", ".git", ".claude", "dist"].includes(e.name)) continue;
        walk(full, depth + 1);
      } else if (/\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) out.push(full);
    }
  };
  walk(dir, 0);
  return out;
}

/**
 * Learn how this application dresses things, from the application.
 *
 * ⛔ THE COMMONEST, NOT THE FIRST. One component's flourish is not the house style, and a screen
 * generated in a one-off idiom reads as a different product than the one beside it.
 */
export function idiomOf(componentsDir: string | undefined, designSystemDir?: string): Idiom {
  /**
   * ⛔ A DESIGN SYSTEM REMOVES THE GUESS, it does not improve it.
   *
   * Peter: *"can we index the actual design system bilrost has with the prototypes now?"* Learning
   * an idiom by FREQUENCY is a reasonable guess about what a button looks like and never more than
   * one: it cannot tell a button from a thing shaped like one, it averages over every variant, and
   * it drifts the moment somebody writes a one-off. Where the product says authoritatively what its
   * parts ARE, that is what a drawing is built from.
   *
   * ⛔ AND IT FALLS BACK PER KIND. A system with a Button and no Card should give its real button
   * and let the card be learned, rather than being all-or-nothing about it.
   */
  if (designSystemDir) {
    const ds = indexDesignSystem(designSystemDir);
    if (ds?.pieces.length) {
      const learned = componentsDir && fs.existsSync(componentsDir) ? idiomOf(componentsDir) : FALLBACK;
      return {
        ...learned,
        button: drawWith(ds, "commits") ?? learned.button,
        field: drawWith(ds, "entry") ?? learned.field,
        card: drawWith(ds, "region") ?? learned.card,
        from: [`${path.basename(designSystemDir)} — ${ds.pieces.length} parts`, ...learned.from].slice(0, 8),
      };
    }
  }
  if (!componentsDir || !fs.existsSync(componentsDir)) return FALLBACK;
  const files = sources(componentsDir);
  const bag = { card: [] as string[], field: [] as string[], button: [] as string[], heading: [] as string[], label: [] as string[], muted: [] as string[] };
  const used: string[] = [];
  for (const f of files) {
    let body: string;
    try {
      body = fs.readFileSync(f, "utf-8");
    } catch {
      continue;
    }
    let touched = false;
    const grab = (re: RegExp, into: string[]): void => {
      for (const m of body.matchAll(re)) {
        const cls = m[1];
        if (cls && !cls.includes("${") && cls.length < 160) {
          into.push(cls);
          touched = true;
        }
      }
    };
    grab(/<div[^>]*className="([^"]*rounded-lg[^"]*border[^"]*)"/g, bag.card);
    /**
     * ⛔ SHAPE FIRST, THEN FREQUENCY — because the commonest is not the representative.
     *
     * Taking the most common `<input>` in this application learned a CHECKBOX (`h-4 w-4 … rounded`)
     * and dressed every text field as one; taking the most common `<button>` learned the dismiss ×
     * in modals (`text-gray-400 … text-2xl`) and dressed every primary action as an icon. Both were
     * genuinely the most frequent, and both produced a visibly broken screen.
     *
     * So the candidates are narrowed by what the markup says the thing IS — a text field is full
     * width or padded, never a 4x4 box; a primary action has a fill — and the commonest is taken
     * from within that set.
     */
    for (const m of body.matchAll(/<input([^>]*)className="([^"]*)"/g)) {
      const attrs = m[1] ?? "";
      const cls = m[2] ?? "";
      if (/type="(checkbox|radio)"/.test(attrs)) continue;
      if (/\bh-4\b|\bw-4\b/.test(cls)) continue;
      if (!/\bw-full\b/.test(cls) && !/\bpx-\d/.test(cls)) continue;
      if (cls && !cls.includes("${") && cls.length < 160) { bag.field.push(cls); touched = true; }
    }
    for (const m of body.matchAll(/<button[^>]*className="([^"]*)"/g)) {
      const cls = m[1] ?? "";
      if (!/\bbg-[a-z]/.test(cls)) continue; // a primary action is filled; an icon button is not
      if (cls && !cls.includes("${") && cls.length < 160) { bag.button.push(cls); touched = true; }
    }
    grab(/<h[123][^>]*className="([^"]*)"/g, bag.heading);
    grab(/<label[^>]*className="([^"]*)"/g, bag.label);
    grab(/className="(type-secondary[^"]*)"/g, bag.muted);
    if (touched) used.push(path.basename(f));
  }
  return {
    card: commonest(bag.card) ?? FALLBACK.card,
    field: commonest(bag.field) ?? FALLBACK.field,
    button: commonest(bag.button) ?? FALLBACK.button,
    heading: commonest(bag.heading) ?? FALLBACK.heading,
    label: commonest(bag.label) ?? FALLBACK.label,
    muted: commonest(bag.muted) ?? FALLBACK.muted,
    from: used.slice(0, 8),
  };
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A screen for this view, from its own parts.
 *
 * ⛔ EVERY PART IS PLACED, INCLUDING THE ONES THAT ARE AWKWARD. A generator that renders the parts
 * it understands and drops the rest produces a screen that looks complete and is missing controls
 * the truth declares — the thin drawing again, arrived at from a new direction.
 */
/**
 * ⛔ AND THE RUNTIME HALF OF THE ADDENDUM — CARRIED AND DECLARED, NOT "APPLIED".
 *
 * Peter asked for a project addendum reaching *"Both"* install time and runtime. This is runtime,
 * and being exact about what it can do matters more than making it sound bigger:
 *
 * A generation steer is PROSE — *"buttons are named for the verb they perform"*. This function is a
 * deterministic transform from parts to markup; it cannot read that sentence and act on it, and
 * pattern-matching keywords out of it to fake the effect would be a guess wearing a decision's
 * clothes, which is the correction this repo has had to make three times in one day. The sentence
 * is acted on by the AUTHORS, which is exactly why the addendum goes into their prompts at install.
 *
 * What this layer owes a reviewer is different and real: **which habits were in force when this was
 * drawn.** A generated screen shaped by five project habits, shown with no sign of them, is a screen
 * a reviewer cannot account for — they would be judging the habits without being shown them, and a
 * constraint nobody can see is the defect the whole steer concept is organised against.
 */
export function proposeScreen(
  view: View,
  idiom: Idiom,
  steers: readonly Steer[] = []
): { html: string; placed: number } {
  const parts = view.parts ?? [];
  const one = (p: Part): string => {
    const label = esc(p.label ?? p.id);
    const mark = ` data-part="${esc(p.id)}"${p.leads_to ? ` data-goes="${esc(p.leads_to)}"` : ""}`;
    switch (p.role) {
      case "entry":
        return `<div class="pp-row"><label class="${idiom.label}">${label}</label><input class="${idiom.field}"${mark} placeholder="${label}" /></div>`;
      case "commits":
        return `<button type="button" class="${idiom.button}"${mark}>${label}</button>`;
      case "navigates":
        return `<a class="pp-nav"${mark}>${label}</a>`;
      case "region":
        return `<section class="${idiom.card}"${mark}><h3 class="${idiom.heading}">${label}</h3></section>`;
      default:
        return `<div class="pp-shown"${mark}><span class="${idiom.muted}">${label}</span></div>`;
    }
  };
  const body = parts.map(one).join("\n      ");
  /**
   * ⛔ IT SAYS WHERE IT CAME FROM, ON THE SCREEN. Generated from sentences, this is as persuasive as
   * a drawing of the real thing — and a reviewer who cannot tell which they are looking at may
   * validate a screen the product does not have. The line is content, not styling, so it survives
   * whatever the application's stylesheet does to the rest.
   */
  /**
   * ⛔ NAMED, AND SAID TO BE HABITS RATHER THAN TRUTH. A reviewer who reads these as claims about
   * the product would start agreeing to them, and a generation steer is the one kind of context
   * nobody agrees to — the moment one carries weight in a gate it has become product truth.
   */
  const live = inEffect(steers);
  const steered = live.length
    ? `<p class="pp-steered">Shaped by ${live.length} ${live.length === 1 ? "habit" : "habits"} this project has learned, not by anything it promises: ${live
        .map((st) => esc(st.says))
        .join(" ")}</p>`
    : "";
  const html = `<div class="pp">
      <h2 class="${idiom.heading}">${esc(view.title || view.id)}</h2>
      <p class="pp-from">Generated from this screen's own parts — nothing renders it yet.</p>
      ${steered}
      ${body || '<p class="pp-from">This screen declares no parts, so there was nothing to place.</p>'}
    </div>`;
  return { html, placed: parts.length };
}
