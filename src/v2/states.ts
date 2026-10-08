/**
 * Composing a screen's state from what is different about its parts.
 *
 * Peter: *"we need to have STATES on a screen, rich enough to describe VARIOUS TYPES OF ERRORS,
 * LOADING STATES, etc. multiple buttons could have LOADING States. MULTIPLE FIELDS COULD HAVE ERROR
 * STATES."* Then, on the first cut: *"Loading/busy shouldn't be hard coded. We should support lots
 * of different states, right? And it can change anything on screen"*.
 *
 * ⛔ WHAT WAS WRONG ORIGINALLY, MEASURED RATHER THAN ASSERTED. `create-deal-form` stored its error
 * state as a complete second copy of the screen: 3,244 bytes, 96% byte-identical to the default
 * frame, differing in 129 bytes — one red line under one field. One form cost 19,723 bytes across
 * five pictures. A state held as a whole picture cannot compose, so two fields in error was a third
 * screenshot nobody would generate, and loading was absent entirely because it is not a branch in a
 * render tree a code reader can find.
 *
 * ⛔ IT MARKS, IT DOES NOT REWRITE. A change becomes `data-in="invalid"` on the element already
 * carrying `data-part="borrower"`, and one stylesheet says what that looks like. Two reasons, and
 * the second is the better one:
 *
 *   1. Injecting an attribute at a known point is safe. Finding an element's end in arbitrary
 *      markup with a regex is not, and the markup here comes from somebody else's components.
 *   2. Otherwise every state's appearance is whatever that component happened to render, so
 *      `invalid` looks different on every screen and a reviewer cannot learn it once.
 *
 * ⛔ AND THE CONDITIONS ARE OPEN. Six are built in because every product has them; anything else is
 * a word the product declares in its scope's `terms`. A declared condition gets a neutral
 * appearance here and the product's own stylesheet can say more — what this file will not do is
 * pretend to know what `syncing` looks like.
 */
import { BUILT_IN_CONDITIONS, isBuiltInCondition, type PartState, type View } from "./schema.js";

/** What a state says is different about one part. The short form is just the condition. */
export type Difference = string | { in?: string; hidden?: boolean; says?: string };

/** A state of a screen, as the model now holds it. */
export interface ViewState {
  label: string;
  when?: string;
  sketch_html?: string;
  holds: Record<string, Difference>;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The long form of a difference, whichever form was written.
 *
 * ⛔ ONE READER FOR BOTH SHAPES. Every caller asking "is this a string or an object" is a caller
 * that will get it wrong once — and the bug would be a state that silently changes nothing.
 */
export const differenceOf = (d: Difference): { in?: string; hidden?: boolean; says?: string } =>
  typeof d === "string" ? { in: d } : d;

/** Every condition this screen's parts can be in, built-in or declared. */
export function conditionsOn(view: Pick<View, "parts">): Set<string> {
  const out = new Set<string>();
  for (const p of view.parts) for (const st of (p.states as PartState[] | undefined) ?? []) out.add(st.kind);
  return out;
}

/** What the person is told while this part is in this condition, if anybody said. */
export function saysFor(view: Pick<View, "parts">, partId: string, condition: string): string | undefined {
  const part = view.parts.find((p) => p.id === partId);
  return (part?.states as PartState[] | undefined)?.find((s) => s.kind === condition)?.says;
}

/**
 * Mark one part with what is different about it.
 *
 * ⛔ EVERY OCCURRENCE, because a part can legitimately appear more than once — a column header and
 * its cells, a control repeated per row. Marking only the first would put one row in an error state
 * and leave its siblings looking fine, which is a picture that lies rather than one that is thin.
 */
export function mark(html: string, partId: string, diff: Difference, fallbackSays?: string): string {
  const needle = `data-part="${partId}"`;
  if (!html.includes(needle)) return html;

  const d = differenceOf(diff);
  const says = d.says ?? fallbackSays;

  const attrs = [
    d.in ? ` data-in="${esc(d.in)}"` : "",
    /** ⛔ An attribute rather than removal: taking the element out would break every other mark. */
    d.hidden ? ` data-gone="true"` : "",
    says ? ` data-says="${esc(says)}"` : "",
  ].join("");

  return attrs ? html.split(needle).join(`${needle}${attrs}`) : html;
}

/**
 * The picture for one state of one screen.
 *
 * ⛔ `sketch_html` STILL WINS WHERE IT IS GIVEN. A state that genuinely is a different arrangement
 * of the screen needs its own drawing, and every corpus in existence holds its states that way — so
 * this composes only where the model has been told what is different. The old shape keeps working,
 * and nothing has to be migrated before the new one is useful.
 */
/**
 * Which picture a state should be composed onto.
 *
 * ⛔ NOT ALWAYS THE DEFAULT FRAME, AND ASSUMING SO MADE 16 OF 18 DERIVED STATES RENDER NOTHING.
 *
 * Found by taking a screenshot rather than by reading: pressing "While it works" on bilrost's
 * create-deal showed the plain form, because `use-existing-folder` is a control on the FOLDER step
 * and the folder step is filed as another state with its own picture. The derivation was right and
 * the marking was right; the thing being marked did not contain the control.
 *
 * ⛔ AND IT IS THE FAILURE THIS WHOLE FILE WARNS ABOUT — a state that composes cleanly and renders
 * as though nothing happened. A reviewer presses the tab, sees the ordinary screen, and concludes
 * the case does not exist rather than that the picture is wrong.
 *
 * So the base is the picture that actually holds the parts: the default frame where it has them,
 * otherwise whichever state's own drawing holds the most of them. `connects.ts` already reasons
 * this way in `stateShowing`, which finds the state whose picture contains a part.
 */
export function baseFor(
  view: Pick<View, "sketch_html"> & { states?: Array<{ sketch_html?: string }> },
  partIds: string[],
): string {
  const held = (html: string | undefined): number =>
    html ? partIds.filter((id) => html.includes(`data-part="${id}"`)).length : 0;

  const frame = view.sketch_html ?? "";
  const inFrame = held(frame);
  if (!partIds.length || inFrame === partIds.length) return frame;

  let best = frame;
  let bestCount = inFrame;
  for (const st of view.states ?? []) {
    const n = held(st.sketch_html);
    /** ⛔ Strictly better, so the default frame wins a tie — it is the screen as it is. */
    if (n > bestCount) {
      bestCount = n;
      best = st.sketch_html!;
    }
  }
  return best;
}

export function pictureOf(
  view: Pick<View, "sketch_html" | "parts"> & { states?: Array<{ sketch_html?: string }> },
  state: ViewState,
): string {
  if (state.sketch_html) return state.sketch_html;

  let html = baseFor(view, Object.keys(state.holds ?? {}));
  for (const [partId, diff] of Object.entries(state.holds ?? {})) {
    const d = differenceOf(diff);
    html = mark(html, partId, diff, d.in ? saysFor(view, partId, d.in) : undefined);
  }
  return html;
}

/**
 * Parts a state is about that appear in no picture this screen has.
 *
 * ⛔ THE ONE WAY COMPOSITION FAILS SILENTLY. Marking is a string substitution: a part the picture
 * does not contain is simply not marked, and the result is a correct-looking screen missing the
 * very case somebody was asked to review.
 */
export function unpicturedParts(
  view: Pick<View, "sketch_html"> & { states?: Array<{ sketch_html?: string }> },
  state: ViewState,
): string[] {
  if (state.sketch_html) return [];
  const ids = Object.keys(state.holds ?? {});
  const base = baseFor(view, ids);
  return ids.filter((id) => !base.includes(`data-part="${id}"`));
}

/**
 * Conditions a state uses that nothing has declared.
 *
 * ⛔ THE SPELL CHECK THAT OPENNESS STILL ALLOWS. A condition can be any word, so nothing can say
 * `syncing` belongs on a region rather than a button — but it can say that no part claims to have a
 * `syncing` condition at all, which catches the typo that would otherwise compose to a mark no
 * stylesheet mentions and render as though nothing had happened.
 */
export function undeclaredConditions(view: Pick<View, "parts">, state: ViewState): Array<{ part: string; condition: string }> {
  const out: Array<{ part: string; condition: string }> = [];
  for (const [partId, diff] of Object.entries(state.holds ?? {})) {
    const cond = differenceOf(diff).in;
    if (!cond) continue;
    const part = view.parts.find((p) => p.id === partId);
    const declared = ((part?.states as PartState[] | undefined) ?? []).some((s) => s.kind === cond);
    if (!declared) out.push({ part: partId, condition: cond });
  }
  return out;
}

/**
 * Which parts a state mentions that the screen does not have.
 *
 * ⛔ A DIFFERENCE ON A PART THE SCREEN DOES NOT HAVE RENDERS AS NOTHING. Without this the state
 * composes to the default frame and looks correct, which is the worst available outcome: a reviewer
 * agrees to a picture that does not contain the case they were asked about.
 */
export function unknownParts(view: Pick<View, "parts">, state: ViewState): string[] {
  const known = new Set(view.parts.map((p) => p.id));
  return Object.keys(state.holds ?? {}).filter((id) => !known.has(id));
}

/**
 * The conditions a part can be in that no state of this screen shows.
 *
 * Answers the question the old shape could not even ask: *does every field that can be invalid
 * appear invalid somewhere a person can look at?*
 */
export function undrawnConditions(
  view: Pick<View, "parts">,
  states: ViewState[],
): Array<{ part: string; condition: string }> {
  const shown = new Set<string>();
  for (const st of states) {
    for (const [partId, diff] of Object.entries(st.holds ?? {})) {
      const cond = differenceOf(diff).in;
      if (cond) shown.add(`${partId}/${cond}`);
    }
  }
  const out: Array<{ part: string; condition: string }> = [];
  for (const p of view.parts) {
    for (const st of (p.states as PartState[] | undefined) ?? []) {
      if (!shown.has(`${p.id}/${st.kind}`)) out.push({ part: p.id, condition: st.kind });
    }
  }
  return out;
}

/**
 * How a condition looks, once, for every screen.
 *
 * ⛔ THE SIX BUILT-INS GET AN APPEARANCE; A DECLARED ONE GETS A NEUTRAL MARK AND NOTHING MORE.
 * Guessing what `syncing` or `over-quota` looks like would be this file making a design decision
 * for somebody else's product — so a declared condition is visibly marked as being in a condition,
 * says its words if it has any, and leaves the rest to the product's own stylesheet.
 */
export const STATE_CSS = `<style>
  /* ⛔ Not on the screen in this state — which is not the same as disabled. */
  [data-gone="true"] { display: none !important; }

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

  /* A field whose contents are not acceptable. */
  [data-in="invalid"] { outline: 2px solid #dc2626; outline-offset: 1px; border-color: #dc2626 !important; }

  /* ⛔ THE WORDS, FOR ANY CONDITION THAT HAS THEM — including a declared one. A condition that says
     something and renders silently is the defect this whole change is about. */
  [data-says]::after {
    content: attr(data-says); display: block;
    margin-block-start: .35rem; font-size: .8rem; line-height: 1.35; color: #6b7280;
  }
  [data-in="invalid"][data-says]::after { color: #dc2626; }
  [data-in="failed"][data-says]::after { color: #b91c1c; }
  /* ⛔ busy already uses ::after for its spinner, so its words must not fight it for the slot. */
  [data-in="busy"][data-says]::after { content: ""; }

  /* Waiting for what goes in it. A shimmer over the element's own shape, so the layout does not move. */
  [data-in="loading"] {
    color: transparent !important; border-radius: .25rem;
    background-image: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%);
    background-size: 400% 100%; animation: productos-shimmer 1.4s ease infinite;
  }
  [data-in="loading"] > * { visibility: hidden; }
  @keyframes productos-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

  /* It arrived and holds nothing — ⛔ a different sentence from loading, and from a failure. */
  [data-in="empty"] { color: #6b7280; }
  [data-in="empty"] > * { display: none; }

  /* It could not get what it shows. */
  [data-in="failed"] { color: #b91c1c; }
  [data-in="failed"] > * { display: none; }

  /* ⛔ ANY OTHER CONDITION — a word this product declared. Marked as being in one, and nothing
     invented about what it means. The product's own stylesheet is where that belongs. */
  [data-in]:not([data-in="disabled"]):not([data-in="busy"]):not([data-in="invalid"]):not([data-in="loading"]):not([data-in="empty"]):not([data-in="failed"]) {
    outline: 1px dashed #9ca3af; outline-offset: 1px;
  }
</style>`;

export { BUILT_IN_CONDITIONS, isBuiltInCondition };
