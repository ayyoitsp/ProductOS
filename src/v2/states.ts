/**
 * Composing a screen's state from conditions on its parts.
 *
 * Peter: *"we need to have STATES on a screen, rich enough to describe VARIOUS TYPES OF ERRORS,
 * LOADING STATES, etc. multiple buttons could have LOADING States. MULTIPLE FIELDS COULD HAVE ERROR
 * STATES."* And, on what was there instead: *"a fucking form screenshot plus an error screenshot is
 * not the same as having a form screen, with an unfilled/error state."*
 *
 * ⛔ WHAT WAS WRONG, MEASURED RATHER THAN ASSERTED. `create-deal-form` stored its error state as a
 * complete second copy of the screen: 3,244 bytes, 96% byte-identical to the default frame,
 * differing in 129 bytes — one red line under one field. One form cost 19,723 bytes across five
 * pictures. A state held as a whole picture cannot compose, so two fields in error was a third
 * screenshot nobody was ever going to generate, and loading was absent entirely because it is not a
 * branch in a render tree that a code reader can find.
 *
 * ⛔ IT MARKS, IT DOES NOT REWRITE. A condition becomes `data-in="invalid"` on the element already
 * carrying `data-part="borrower-name"`, and the appearance comes from one stylesheet. Two reasons,
 * and the second is the better one:
 *
 *   1. Injecting an attribute at a known point is safe. Finding an element's end in arbitrary
 *      markup with a regex is not, and the markup here comes from somebody else's components.
 *   2. Today every state's appearance is whatever that component happened to render, so "invalid"
 *      looks different on every screen and a reviewer cannot learn it once. One stylesheet means a
 *      red underline means the same thing everywhere — which is the point of a design system and
 *      the thing a per-state screenshot quietly gave up.
 */
import type { PartState, PartStateKind, View } from "./schema.js";

/** A state of a screen, as the model now holds it. */
export interface ViewState {
  label: string;
  when?: string;
  sketch_html?: string;
  holds: Record<string, PartStateKind>;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What the person is told while this part is in this condition, if anybody said. */
export function saysFor(view: Pick<View, "parts">, partId: string, kind: PartStateKind): string | undefined {
  const part = view.parts.find((p) => p.id === partId);
  return (part?.states as PartState[] | undefined)?.find((s) => s.kind === kind)?.says;
}

/**
 * Mark one part as being in one condition.
 *
 * ⛔ EVERY OCCURRENCE, because a part can legitimately appear more than once — a column header and
 * its cells, a control repeated per row. Marking only the first would put one row in an error state
 * and leave its siblings looking fine, which is a picture that lies rather than one that is thin.
 */
export function mark(html: string, partId: string, kind: PartStateKind, says?: string): string {
  const needle = `data-part="${partId}"`;
  if (!html.includes(needle)) return html;
  const extra = ` data-in="${kind}"${says ? ` data-says="${esc(says)}"` : ""}`;
  return html.split(needle).join(`${needle}${extra}`);
}

/**
 * The picture for one state of one screen.
 *
 * ⛔ `sketch_html` STILL WINS WHERE IT IS GIVEN. A state that genuinely is a different arrangement
 * of the screen needs its own drawing, and every corpus in existence holds its states that way — so
 * this composes only where the model has been told which parts are involved. The old shape keeps
 * working, and nothing has to be migrated before the new one is useful.
 */
export function pictureOf(view: Pick<View, "sketch_html" | "parts">, state: ViewState): string {
  if (state.sketch_html) return state.sketch_html;

  let html = view.sketch_html ?? "";
  for (const [partId, kind] of Object.entries(state.holds ?? {})) {
    html = mark(html, partId, kind, saysFor(view, partId, kind));
  }
  return html;
}

/**
 * Which parts a state says nothing about, out of those it claims to hold.
 *
 * ⛔ A CONDITION ON A PART THE SCREEN DOES NOT HAVE IS A TYPO THAT RENDERS AS NOTHING. Without this
 * the state composes to the default frame and looks correct, which is the worst available outcome:
 * a reviewer agrees to a picture that does not contain the case they were asked about.
 */
export function unknownParts(view: Pick<View, "parts">, state: ViewState): string[] {
  const known = new Set(view.parts.map((p) => p.id));
  return Object.keys(state.holds ?? {}).filter((id) => !known.has(id));
}

/**
 * The conditions a part can be in that nothing has drawn.
 *
 * Used to answer the question the old shape could not even ask: *does every field that can be
 * invalid appear invalid in some state of this screen?*
 */
export function undrawnConditions(view: Pick<View, "parts">, states: ViewState[]): Array<{ part: string; kind: PartStateKind }> {
  const shown = new Set<string>();
  for (const st of states) {
    for (const [partId, kind] of Object.entries(st.holds ?? {})) shown.add(`${partId}/${kind}`);
  }
  const out: Array<{ part: string; kind: PartStateKind }> = [];
  for (const p of view.parts) {
    for (const st of (p.states as PartState[] | undefined) ?? []) {
      if (!shown.has(`${p.id}/${st.kind}`)) out.push({ part: p.id, kind: st.kind });
    }
  }
  return out;
}

/**
 * How a condition looks, once, for every screen.
 *
 * ⛔ ONE STYLESHEET, NOT ONE PER SCREENSHOT. The markup a state is composed onto comes from the
 * product's own components, so these deliberately do not restyle the element — they add what the
 * condition means on top of whatever it already looks like.
 */
export const STATE_CSS = `<style>
  /* A control that cannot be used. */
  [data-in="disabled"] { opacity: .5; pointer-events: none; cursor: not-allowed; }

  /* A control doing the work that was asked of it. ⛔ The spinner is on the control, not the page:
     a whole-page overlay is a different product decision and would be drawn as one. */
  [data-in="busy"] { position: relative; opacity: .8; pointer-events: none; }
  [data-in="busy"]::after {
    content: ""; position: absolute; inset-block-start: 50%; inset-inline-end: .5rem;
    width: .85em; height: .85em; margin-block-start: -.45em;
    border: 2px solid currentColor; border-inline-end-color: transparent; border-radius: 50%;
    animation: productos-spin .7s linear infinite;
  }
  @keyframes productos-spin { to { transform: rotate(360deg); } }

  /* A field whose contents are not acceptable, and the words it says. */
  [data-in="invalid"] { outline: 2px solid #dc2626; outline-offset: 1px; border-color: #dc2626 !important; }
  [data-in="invalid"][data-says]::after,
  [data-in="failed"][data-says]::after,
  [data-in="empty"][data-says]::after {
    content: attr(data-says); display: block;
    margin-block-start: .35rem; font-size: .8rem; line-height: 1.35;
  }
  [data-in="invalid"][data-says]::after { color: #dc2626; }

  /* Waiting for what goes in it. A shimmer over the element's own shape, so the layout does not move. */
  [data-in="loading"] {
    color: transparent !important; border-radius: .25rem;
    background-image: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%);
    background-size: 400% 100%; animation: productos-shimmer 1.4s ease infinite;
  }
  [data-in="loading"] * { visibility: hidden; }
  @keyframes productos-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

  /* It arrived and holds nothing — ⛔ a different sentence from loading, and from a failure. */
  [data-in="empty"] { color: #6b7280; }
  [data-in="empty"] > * { display: none; }

  /* It could not get what it shows. */
  [data-in="failed"] { color: #b91c1c; }
  [data-in="failed"] > * { display: none; }
</style>`;
