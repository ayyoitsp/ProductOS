/**
 * What an act is allowed to touch.
 *
 * ⛔ EVERY REFUSAL IN THIS SCHEMA PRICED WHAT A PERSON WRITES BY HAND. NOTHING PRICED WHAT
 * THE TOOL WRITES — AND THE TOOL IS THE SHORTEST ROUTE TO A CORPUS THAT PASSES.
 *
 * The authoring path is guarded well: floors on every answer-bearing string, placeholders
 * refused by name, one answer per slot, a standing beside content having to name what it is
 * about, latitude costing a recorded act. Reviewers attacked those and they held.
 *
 * Then every write path went around them. Each of these was run on a pristine corpus:
 *
 *  - `--pick` on a slot whose standing was `about` ONE aspect replaced the whole sentence.
 *    The agreed behaviour — *"the amount is taken off what the kid has, the act appears at the
 *    top of their history dated today, and the parent is returned to the kid's money"* — was
 *    gone. `check` then refused two surviving CRITERIA for over-asserting, and advised
 *    putting their content "in the slot". The clause with no criterion vanished silently.
 *  - Ruling a named refusal overwrote `told`, destroying the user-facing message, which
 *    appeared in no verdict.
 *  - A ruling that AGREED with an org-wide rule wrote `instead_of` in the ruler's name,
 *    exempting the exchange from the rule it agreed with. Three money writes then carried
 *    `⊗`, and the idempotency rule governed no money write at all.
 *  - `waive` deleted two settled named refusals with no gate and no record.
 *
 * In all four cases nothing printed what was being removed.
 *
 * So: an act declares what it may touch, and anything else it would remove is REFUSED — not
 * warned about, because a warning on a destructive default is a destructive default. What it
 * does remove is printed and goes into the verdict, so the corpus keeps a record of the
 * sentence that used to be there.
 */

/** Content a slot can hold, by the name an author writes. */
export const SLOT_CONTENT = ["says", "none", "cannot_fail", "outcomes", "within", "notes", "instead_of", "defers_to"] as const;
export type SlotContent = (typeof SLOT_CONTENT)[number];

export interface Removal {
  field: string;
  /** The text as it stood, so it can be printed and recorded rather than just counted. */
  was: string;
}

const show = (v: unknown): string =>
  typeof v === "string"
    ? v.replace(/\s+/g, " ").trim()
    : Array.isArray(v)
      ? v.map((x) => show(x)).join(" · ")
      : v && typeof v === "object"
        ? Object.entries(v as Record<string, unknown>)
            .map(([k, x]) => `${k}: ${show(x)}`)
            .join(", ")
        : String(v);

/**
 * Everything this edit would remove or overwrite, beyond what the act declared.
 *
 * ⛔ Compares the parsed BEFORE against the intended AFTER, so it sees through whatever the
 * write function happens to do. A guard written as "remember to delete carefully" is the
 * thing that already failed four times.
 */
export function removals(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  mayTouch: readonly string[]
): Removal[] {
  const out: Removal[] = [];
  for (const key of Object.keys(before)) {
    if (mayTouch.includes(key)) continue;
    const had = before[key];
    if (had === undefined) continue;
    const now = after[key];
    if (now === undefined) out.push({ field: key, was: show(had) });
    else if (show(now) !== show(had)) out.push({ field: key, was: show(had) });
  }
  return out;
}

/**
 * What a person is told when an act would take something down with it.
 *
 * The message names the sentence, because the whole failure was that nothing did.
 */
export function refuseBecause(act: string, ref: string, lost: Removal[]): string {
  const lines = lost.map((l) => `      ${l.field}: ${l.was}`);
  return (
    `${act} at ${ref} would also remove ${lost.length === 1 ? "this, which nobody questioned" : "these, which nobody questioned"}:\n` +
    lines.join("\n") +
    `\n\n  An act settles what was asked, and nothing else. If ${
      lost.length === 1 ? "that sentence is" : "those sentences are"
    } genuinely wrong too,\n` +
    `  say so as its own act — or pass the whole replacement sentence explicitly with --says.`
  );
}

/** For the verdict log: what this act replaced, so the corpus keeps the old sentence. */
export function replacedNote(lost: Removal[]): string | undefined {
  if (!lost.length) return undefined;
  return lost.map((l) => `${l.field} was: ${l.was}`).join(" | ");
}
