/**
 * ⛔ STAMPING A DRAWING'S CONTROLS, IN ONE PLACE, FOR TWO CALLERS.
 *
 * A generated drawing needs `data-part` on the elements that are parts, and so does a hand-written
 * one. Both used to be done by hand — the skill said "GENERATE IT. DO NOT TYPE IT." and then, two
 * steps later, "say which element is which part, with data-part=". That is an edit applied on top
 * of generator output, in a field the next `draw` overwrites, which is the exact shape the same
 * skill forbids. The reviewer that found it put it plainly: the fix belongs in `draw`, which has
 * the part list at the call site, not in an instruction to the author.
 *
 * So the wiring lives here and runs at GENERATION time, writing the attribute into the corpus. The
 * renderer still calls it as a fallback for drawings that predate the generator — those have no
 * attribute and would otherwise be unclickable — and the two callers cannot drift because they are
 * the same function.
 */

export interface WireablePart {
  id: string;
  role: string;
  label?: string;
  /** ⛔ What this control repeats over, when it appears once per something (fg-0009). */
  repeats?: string;
  leads_to?: string;
  decorative?: boolean;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Wired {
  html: string;
  /** Parts the drawing actually shows. ⛔ The rest are reported as undrawn, never dropped. */
  matched: Set<string>;
}

export function wireParts(html: string, parts: WireablePart[]): Wired {
  const matched = new Set<string>();
  let out = html;

  const attrs = (pt: WireablePart, existing: string): string => {
    const cls = `pt pt-${pt.role}`;
    /**
     * ⛔ A VOID ELEMENT'S SLASH COMES LAST, AND THIS USED TO WRITE PAST IT.
     *
     * `<input placeholder="…" />` came out as `<input placeholder="…" / class="pt" data-part="…">`
     * — attributes after the self-closing slash, which is not markup any parser agrees about. It
     * only appeared once inputs started carrying attributes at all, because before that there was
     * nothing between the tag name and the slash to notice.
     */
    const selfClosing = /\/\s*$/.test(existing);
    const body = selfClosing ? existing.replace(/\s*\/\s*$/, "") : existing;
    const withClass = /class\s*=\s*"([^"]*)"/.test(body)
      ? body.replace(/class\s*=\s*"([^"]*)"/, (_m, had: string) => `class="${had} ${cls}"`)
      : `${body} class="${cls}"`;
    const goes = pt.leads_to ? ` data-goes="${esc(pt.leads_to)}"` : "";
    return `${withClass} data-part="${esc(pt.id)}"${goes}${selfClosing ? " /" : ""}`;
  };

  /**
   * ⛔ A MARK ALREADY IN THE DRAWING MAY STILL BE ON THE WRONG ELEMENT, AND FOR `entry` THAT IS
   * VISIBLE TO A REVIEWER.
   *
   * Seen on 4100: *"Something required is missing"* drew its red outline around the word
   * **Borrower** and pushed the message between the label and the box. The corpus holds
   * `<label><span data-part="borrower">Borrower</span> …</label><input …>` — the mark on the label's
   * text, written by an earlier generator, with the input beside it unmarked.
   *
   * ⛔ UNWRAPPED HERE RATHER THAN FIXED IN THE CORPUS, because `draw` and the page call this same
   * function: correcting it here fixes every drawing already written as well as every one generated
   * from now on, and editing the corpus would fix one and leave the generator free to do it again.
   * The text survives — only the marker moves, to the control the label names.
   */
  for (const pt of parts.filter((p) => p.role === "entry")) {
    const on = new RegExp(`<(\\w+)\\b[^>]*\\bdata-part\\s*=\\s*["']${pt.id}["'][^>]*>`, "i").exec(out);
    if (!on || /^(input|textarea|select)$/i.test(on[1]!)) continue;
    /** Only a bare wrapper is safe to remove — unwrap `<span …>Text</span>` back to `Text`. */
    const wrapper = new RegExp(`<span\\b[^>]*\\bdata-part\\s*=\\s*["']${pt.id}["'][^>]*>([^<]*)</span>`, "i");
    if (!wrapper.test(out)) continue;
    out = out.replace(wrapper, "$1");
  }

  // 1. Anything already carrying the attribute is done — give it the class and move on.
  for (const pt of parts) {
    const has = new RegExp(`data-part\\s*=\\s*["']${pt.id}["']`).test(out);
    if (!has) continue;
    matched.add(pt.id);
    out = out.replace(new RegExp(`(<[a-zA-Z][^>]*?)(\\s*data-part\\s*=\\s*["']${pt.id}["'])([^>]*)>`), (_m, open: string, dp: string, rest: string) => {
      const inner = `${open}${rest}`;
      const cls = `pt pt-${pt.role}`;
      const withClass = /class\s*=\s*"([^"]*)"/.test(inner)
        ? inner.replace(/class\s*=\s*"([^"]*)"/, (_x, had: string) => `class="${had} ${cls}"`)
        : `${inner} class="${cls}"`;
      return `${withClass}${dp}${pt.leads_to ? ` data-goes="${esc(pt.leads_to)}"` : ""}>`;
    });
  }

  /**
   * ⛔ AN INPUT CARRIES ITS NAME IN AN ATTRIBUTE, NOT IN TEXT. A form's search field is named by its
   * placeholder; text matching alone can never point at an entry control, which is most of what a
   * person actually touches. Narrow on purpose — the three attributes that NAME a control to a
   * person, on elements that take input. Matching any attribute would wire a class or a test id.
   */
  for (const pt of parts.filter((p) => !matched.has(p.id))) {
    const label = esc(pt.label ?? pt.id);
    const re = new RegExp(
      `<(input|textarea|select|button)\\b([^>]*\\b(?:placeholder|aria-label|title)\\s*=\\s*["'][^"']*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["'][^>]*)>`,
      "i"
    );
    /**
     * ⛔ EVERY OCCURRENCE WHEN THE PART REPEATS, THE FIRST OTHERWISE.
     *
     * A part is one control, so this matched once — right for a Save button, wrong for a sortable
     * column heading that appears once per column. The other four headings then drew as things
     * nobody had promised anything about, which is the opposite of what marking is for: a reviewer
     * reads an unmarked control as "the corpus says nothing here".
     *
     * ⛔ And the first-match behaviour is kept for a part that does NOT declare `repeats`, because
     * marking every "Save" on a screen that has two different Saves would bind one promise to two
     * controls — the mistake this loop's narrowness already exists to avoid.
     */
    if (pt.repeats) {
      const all = new RegExp(re.source, "gi");
      let any = false;
      out = out.replace(all, (whole, tag, inner) => {
        any = true;
        return `<${tag}${attrs(pt, inner as string)}>`;
      });
      if (any) matched.add(pt.id);
      continue;
    }
    const hit = re.exec(out);
    if (!hit) continue;
    matched.add(pt.id);
    out = out.replace(hit[0], `<${hit[1]}${attrs(pt, hit[2]!)}>`);
  }

  /**
   * ⛔ A LABEL NAMES A CONTROL; IT IS NOT THE CONTROL. THIS IS THE STEP THAT WAS MISSING.
   *
   * Seen on 4100: the derived state *"Something required is missing"* drew its red outline around
   * the word **Borrower** and injected the message between the label and the box, shoving the form
   * down — because the input's placeholder is "Sponsor or borrowing entity", which does not contain
   * the word "Borrower". Attribute matching therefore missed, and the text pass below wrapped the
   * label instead. A reviewer reads that as "the label is wrong".
   *
   * A form says which control a label belongs to, in two ways, and both are cheap to follow:
   * `for="x"` pointing at `id="x"`, or the control that comes next. So an `entry` part resolves
   * through its label to the thing you actually type in.
   *
   * ⛔ AND IT RUNS BEFORE THE TEXT PASS, NOT AFTER, because the text pass would have claimed the
   * label first and marked this part done.
   */
  for (const pt of parts.filter((p) => !matched.has(p.id) && p.role === "entry")) {
    const label = esc(pt.label ?? pt.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    /** The <label> whose text is this part's name — its `for`, if it has one. */
    const lab = new RegExp(`<label\\b([^>]*)>\\s*${label}\\b`, "i").exec(out);
    if (!lab) continue;
    const forId = /\bfor\s*=\s*["']([^"']+)["']/i.exec(lab[1] ?? "")?.[1];

    let target: RegExpExecArray | null = null;
    if (forId) {
      const byId = new RegExp(`<(input|textarea|select)\\b([^>]*\\bid\\s*=\\s*["']${forId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*)>`, "i");
      target = byId.exec(out);
    }
    /** ⛔ No `for`, so the next control after the label — which is what the markup means by position. */
    if (!target) {
      const after = out.slice(lab.index);
      const next = /<(input|textarea|select)\b([^>]*)>/i.exec(after);
      if (next) {
        target = next;
        target.index += lab.index;
      }
    }
    if (!target) continue;
    matched.add(pt.id);
    out = out.slice(0, target.index) + `<${target[1]}${attrs(pt, target[2]!)}>` + out.slice(target.index + target[0].length);
  }

  /**
   * ⛔ WHOLE WORDS ONLY, AT BOTH ENDS, AND TEXT NODES ONLY.
   *
   * A part labelled "No deals yet" bound itself to the "No" inside "Northgate" — a row in the
   * drawing — so clicking a deal name reported on the empty state. A control wired to the WRONG
   * text is strictly worse than one left unwired: the reviewer is shown a confident answer about
   * something they did not click, and nothing says the binding was guessed. And only the runs
   * between a `>` and the next `<` are candidates, because a label can occur inside an attribute
   * and splicing there corrupts the markup.
   */
  const byLength = parts.filter((p) => !matched.has(p.id)).sort((a, b) => (b.label ?? b.id).length - (a.label ?? a.id).length);
  for (const pt of byLength) {
    const label = pt.label ?? pt.id;
    if (!label) continue;
    const probes = [label, ...label.split(/\s+/).slice(0, 1).filter((w) => w.length >= 5)];
    let done = false;
    for (const probe of probes) {
      if (done) break;
      const needle = esc(probe);
      out = out.replace(/>([^<]+)</g, (whole: string, text: string) => {
        if (done) return whole;
        const at = text.indexOf(needle);
        if (at < 0) return whole;
        if (/[a-z0-9]/i.test(text[at - 1] ?? "") || /[a-z0-9]/i.test(text[at + needle.length] ?? "")) return whole;
        done = true;
        matched.add(pt.id);
        const goes = pt.leads_to ? ` data-goes="${esc(pt.leads_to)}"` : "";
        return `>${text.slice(0, at)}<span class="pt pt-${esc(pt.role)}" data-part="${esc(pt.id)}"${goes} role="button" tabindex="0">${needle}</span>${text.slice(
          at + needle.length
        )}<`;
      });
    }
  }

  return { html: out, matched };
}
