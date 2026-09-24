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
    const withClass = /class\s*=\s*"([^"]*)"/.test(existing)
      ? existing.replace(/class\s*=\s*"([^"]*)"/, (_m, had: string) => `class="${had} ${cls}"`)
      : `${existing} class="${cls}"`;
    return `${withClass} data-part="${esc(pt.id)}"${pt.leads_to ? ` data-goes="${esc(pt.leads_to)}"` : ""}`;
  };

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
    const hit = re.exec(out);
    if (!hit) continue;
    matched.add(pt.id);
    out = out.replace(hit[0], `<${hit[1]}${attrs(pt, hit[2]!)}>`);
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
