/**
 * Statements filed under the wrong question — and which question they actually answer.
 *
 * ⛔ WHY THIS IS THE FIRST LEVER AND NOT THE LAST. 45 of bilrost's 54 exchanges have exactly one
 * slot filled, and it is always `answer`. That is not sloppy authoring: those exchanges carry
 * `was:` provenance from a v1 corpus, where a feature held a flat list of **behaviours** and there
 * was no `may`, `with`, `after`, `refuses`, `fails`, `again` or `at_once` to file anything under. So
 * `migrate` put every behaviour in the one slot that existed.
 *
 * The nine statements on `deal-list#deals-list` are those nine v1 behaviours, ids intact. One of
 * them reads *"When the list cannot be loaded, the reason is shown above the table and the
 * previously loaded page is kept"* — which is not what the asker GETS, it is what they are left with
 * when it cannot be done. It is a `fails` sentence sitting in `answer` because v1 had nowhere else
 * to put it.
 *
 * ⛔ SO THIS INVENTS NOTHING, WHICH IS WHY IT COMES BEFORE READING COMPONENTS. The words already
 * exist and were already reviewed once. Moving a statement to the slot whose question it answers
 * costs no new prose, and it makes `fails` and the rest non-empty from truth somebody has already
 * agreed to — where `propose-slots` has to go and find new sentences in code.
 *
 * ⛔ IT PROPOSES, AND A PERSON MOVES IT. The words do not change and the id does not change, but
 * which question a sentence answers is a reading, and a wrong move is a claim relocated under a
 * heading nobody checked it against. Every proposal carries the phrase that triggered it so the
 * reading can be argued with.
 */
import type { Scope } from "./schema.js";
import { SLOTS, saysText } from "./schema.js";

export type Slot = (typeof SLOTS)[number];

export interface Reslot {
  scope: string;
  exchange: string;
  statement: string;
  /** Where it sits now. */
  from: Slot;
  /** The question it actually answers. */
  to: Slot;
  /** The words, unchanged. */
  says: string;
  /** What in the sentence says so — the reading, made arguable. */
  because: string;
  /**
   * ⛔ WHETHER THIS IS A MOVE OR A REWRITE, BECAUSE `refuses` IS NOT LIKE THE OTHERS. Six of the
   * seven slots hold a sentence, so relocating one is exactly a move: same words, same id, new
   * question. `refuses` holds NAMED CASES — a `name`, a `when` and the `told` the asker reads — so
   * a statement bound for it has to be split into one, and that is authoring, not filing.
   *
   * Saying so on the proposal is the difference between a person approving a move and a person
   * being handed a rewrite labelled as a move.
   */
  needs: "a move — the same words under a question that fits" | "a named case: name, when, and the words the asker is told";
}

/**
 * The language that marks a sentence as answering a particular question.
 *
 * ⛔ PRECISION OVER RECALL, DELIBERATELY. A statement left where it is costs a blank slot, which
 * every other part of this system already reports. A statement moved wrongly costs a claim filed
 * under a question it does not answer — and it arrives there carrying a v1 id and a review history,
 * so it looks settled. Each pattern below is a phrase that can only be about one question.
 */
/**
 * What the asker is shown — required alongside a failure phrase.
 *
 * ⛔ A FAILURE MENTIONED IS NOT A FAILURE ANSWERED, and widening the `fails` pattern proved it
 * immediately. `nothing-here-is-editable` says *"A Bilrost-side edit could not reach the workbook
 * before the next pull, so there is no version of this screen that recomputes a deal live"* — the
 * failure phrase sits in a subordinate clause explaining WHY the screen is read-only. It is a
 * perfectly good `answer` sentence and moving it would have filed a design rationale under "what
 * the asker is left with".
 *
 * Every genuine one pairs the failure with what the person then sees: the reason *is shown*, the
 * screen *says so*, the panel *names* which ones, the previous page *stays on screen*.
 */
const TELLS =
  /\b(is (shown|reported|told|named|displayed)|says (so|plainly|the|that|which)|names which|is kept|stays on screen|are named|offers? (a|the) way back|rather than (an?|rendering|being))\b/i;

const MARKS: { to: Slot; pattern: RegExp; why: string; and?: RegExp }[] = [
  {
    to: "fails",
    /**
     * ⛔ `could not <verb>`, NOT `could not be`. The narrower form missed *"departures it could not
     * record"* — the same sentence shape in the active voice, and one of only two real misses in
     * the corpus.
     */
    pattern: /\b(cannot be (loaded|saved|reached|read|written)|could not (be|\w+)|fails to|when .{0,30}fails\b|is unavailable|times out|the request fails)\b/i,
    why: "says what happens when the thing cannot be done",
    and: TELLS,
  },
  {
    to: "again",
    pattern: /\b(a second (press|click|attempt)|asked twice|pressed twice|press(ing)? it again|re-?submit(ting)?|more than once|only once)\b/i,
    why: "says what a repeat ask does",
  },
  {
    to: "at_once",
    pattern: /\b(at the same time|simultaneous(ly)?|concurrent(ly)?|two (people|readers|askers|users)|while another)\b/i,
    why: "says what happens when two askers arrive together",
  },
  {
    to: "may",
    pattern: /\b(only (a|an|the) [a-z]{3,}( [a-z]{3,})? (may|can)\b|is permitted to|may not (see|open|change|edit)|anybody (who|on)\b|requires? permission)\b/i,
    why: "says who is permitted to ask",
  },
  {
    to: "refuses",
    pattern: /\b(is (refused|rejected|not accepted|disallowed)|refuses to|is told that .{0,40}already (exists|has)|will not accept)\b/i,
    why: "names a case it says no to",
  },
  {
    to: "refuses",
    /**
     * ⛔ A UNIQUENESS RULE IS A REFUSAL WEARING A FACT'S CLOTHES. *"Two structures in one lender's
     * catalogue cannot share a name. A repeated name is reported before the catalogue is saved"* —
     * stated as a property of the data, and the only thing it is really saying is what happens when
     * you try. Missed entirely by the refusal verbs.
     */
    pattern: /\b(cannot share a (name|title)|must be unique|is unique within|no two .{0,25}(may|can) (share|have the same)|a repeated \w+ is)\b/i,
    why: "a uniqueness rule, which is a refusal stated as a property",
  },
];

/**
 * ⛔ A SENTENCE THAT IS ALREADY ABOUT WHAT THE ASKER GETS STAYS PUT, even where it mentions a
 * failure in passing. *"…the reason is shown above the table and the previously loaded page is
 * kept"* is a `fails` sentence; *"a row opens the deal"* is not, and neither is a sentence whose
 * failure word is inside a quoted message.
 */
const STAYS = /\b(each row|the row|selecting|the columns?|the list shows|appears only when|is carried in the address)\b/i;

/** Every statement in a slot, with its id — `says` may be one sentence or several. */
function statementsOf(fill: unknown): { id: string; says: string }[] {
  const says = (fill as { says?: unknown } | undefined)?.says;
  if (!says) return [];
  if (typeof says === "string") return [];
  if (!Array.isArray(says)) return [];
  return says
    .filter((s): s is { id: string; says: string } => typeof s === "object" && s !== null && "id" in s)
    .map((s) => ({ id: s.id, says: saysText(s.says) }));
}

/**
 * Which statements in this scope answer a different question from the one they are filed under.
 *
 * ⛔ Only out of `answer`, and only on an exchange whose other slot is empty. A statement moved on
 * top of an existing sentence would be merging two answers, which is a different and larger act
 * than filing one — and one nobody asked for.
 */
export function reslot(scope: Scope): Reslot[] {
  const out: Reslot[] = [];
  for (const e of scope.exchanges ?? []) {
    const slots = (e as unknown as { slots?: Record<string, unknown> }).slots ?? {};
    const filled = (s: Slot): boolean => {
      const f = slots[s] as { says?: unknown; outcomes?: unknown[]; cannot_fail?: unknown; none?: unknown } | undefined;
      return Boolean(f && (f.says || (f.outcomes ?? []).length || f.cannot_fail || f.none));
    };

    for (const st of statementsOf(slots.answer)) {
      if (STAYS.test(st.says)) continue;
      for (const m of MARKS) {
        if (!m.pattern.test(st.says)) continue;
        if (m.and && !m.and.test(st.says)) continue;
        /** ⛔ Never onto an answer somebody already gave. */
        if (filled(m.to)) break;
        const hit = st.says.match(m.pattern);
        out.push({
          scope: scope.id,
          exchange: e.id,
          statement: st.id,
          from: "answer",
          to: m.to,
          says: st.says,
          because: `${m.why} — "${(hit?.[0] ?? "").trim()}"`,
          needs:
            m.to === "refuses"
              ? "a named case: name, when, and the words the asker is told"
              : "a move — the same words under a question that fits",
        });
        break;
      }
    }
  }
  return out;
}
