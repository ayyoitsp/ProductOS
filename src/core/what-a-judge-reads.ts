/**
 * ⛔ WHAT A JUDGE IS READING — HOW ESTABLISHED EACH SENTENCE IS — ONE HOME, IN EVERY JUDGE'S BRIEF.
 *
 * Peter, on `buildability` being let past the sign-off gate: *"uhm, what? why? buildability should
 * take validation into account. if a verdict has low confidence/no agreement, why the fuck would it
 * trust it?"*
 *
 * He is right, and it dissolves the question I had put to him. I had offered three ways to handle a
 * judge reading a draft — gate it, exempt it, or split the role — and every one of them treats "how
 * settled is this" as a property of the WHOLE FEATURE, decided by a gate, outside the judge. The
 * corpus answers it per sentence and always has: `levelOf` returns `accepted | derived | suggested |
 * open` with its own reason, `confidenceOf` says how much supports it, `stampFor` says whether
 * anybody agreed. **The packet already prints the level on every slot line** — `LEVEL_WORD` beside
 * each one — and the judge reading that packet was never told the words were there.
 *
 * ⛔ MEASURED BEFORE WRITING THIS: every one of the ten AUTHORS' briefs says something about what
 * is agreed and what is not, because `whereAnAuthorWrites` tells each of them *"nothing you write
 * is agreed"*. **Not one of the fifteen judges mentions it at all.** So every reviewer in this
 * project reads a corpus as though every sentence in it were equally established — which is exactly
 * what he is objecting to, and it is systemic rather than a buildability problem.
 *
 * ⛔ GENERATED RATHER THAN PASTED INTO FIFTEEN PROMPTS, for the reason the author block gives:
 * fifteen hand copies of one paragraph cannot all be kept right, so they are kept right for none.
 * `productos v2 agents --presets` writes it between markers into every member of `AGENTS`, and a
 * test fails when one drifts or a new judge arrives without it.
 *
 * ⛔ AND IT IS NOT A LICENCE TO IGNORE A DRAFT. A sentence nobody has agreed to is still the
 * product's intent and still reviewable; what changes is what a finding against it MEANS. "This
 * cannot be built because nothing says where the stage order comes from" is a finding. "This cannot
 * be built because the thing it rests on is only a suggestion" is not — it is the draft being a
 * draft, and reporting it as a defect is how a reviewer sends somebody rewriting truth to satisfy a
 * reviewer rather than the person whose product it is.
 */
import { LEVEL_WORD, type LevelName } from "../v2/level.js";

/**
 * ⛔ THE ORDER A READER MEETS THEM IN, strongest first — and the KEYS come from `LEVEL_WORD`, so a
 * level added to `level.ts` without being listed here is a type error rather than a paragraph that
 * quietly describes three of four.
 */
const ORDER: readonly LevelName[] = ["accepted", "derived", "suggested", "open"];

export const LEVEL_OPEN = "<!-- productos:what-you-are-reading -->";
export const LEVEL_CLOSE = "<!-- /productos:what-you-are-reading -->";

/**
 * ⛔ THE FOUR NAMES COME FROM `level.ts`, so this cannot describe a level the model does not have —
 * the same reason the author block reads its field descriptions off `INTENTS`.
 */
export function whatAJudgeReads(): string {
  const names = ORDER.map((l) => `\`${LEVEL_WORD[l]}\``).join(" · ");
  return `${LEVEL_OPEN}
## ⛔ What you are reading — and how settled each sentence of it is

> Generated — do not edit between the markers. \`productos v2 agents --presets\` rewrites it, and a test fails if it drifts.

**Not every sentence in a corpus is equally established, and you are the one who has to notice.** Every claim carries a level: ${names}. The packet prints it beside each slot; \`productos_exchange_questions\` returns it on every question; \`productos_exchange_can_be_agreed_to\` says what is blocking a behaviour and why — ⛔ and that last one **records nothing**, whatever its name suggests: it reports the gate, it does not open it, and agreeing to anything is a person's act that no tool of yours can perform.

- **\`${LEVEL_WORD.accepted}\`** — a person read this and agreed to it. This is the only thing in a corpus anybody has stood behind.
- **\`${LEVEL_WORD.derived}\`** — software worked it out from something agreed, and it is current with it.
- **\`${LEVEL_WORD.suggested}\`** — somebody or something wrote it and **nobody has confirmed it**. Most of a fresh corpus is this.
- **\`${LEVEL_WORD.open}\`** — a question somebody owes an answer to. It is not a claim at all.

⛔ **Weigh what you read by what stands behind it, and say so in your finding.** A problem with an \`${LEVEL_WORD.accepted}\` sentence is a problem with the product: somebody agreed to it and it is wrong. The same problem in a \`${LEVEL_WORD.suggested}\` one may be nothing — a draft that has not been looked at yet, where the author already expects to be corrected.

⛔ **And never report a draft's unfinishedness as a defect.** "This cannot be built because nothing says where the stage order comes from" is a finding. "This cannot be built because the thing it rests on is only a suggestion" is not — that is the draft being a draft. Reporting it as a defect is how a reviewer sends somebody rewriting product truth to satisfy a reviewer rather than the person whose product it is, which is the one failure this whole arrangement is built to prevent.

⛔ **A verdict that ignored the levels is worth less than no verdict.** If most of what you read is unconfirmed, the honest answer is not "this is unbuildable" — it is which parts nobody has agreed to yet, and what you would need agreed before the rest could be judged at all.
${LEVEL_CLOSE}`;
}

/**
 * A brief with its section current.
 *
 * ⛔ BETWEEN MARKERS, NEVER THE WHOLE FILE — the rest of a brief is hand-authored. Where no markers
 * exist yet it goes before the first `##` heading, so a judge meets what it is reading before it
 * meets the question it is being asked. Same placement as the author block, for the same reason.
 */
export function withWhatAJudgeReads(body: string): string {
  const block = whatAJudgeReads();
  const open = body.indexOf(LEVEL_OPEN);
  if (open !== -1) {
    const close = body.indexOf(LEVEL_CLOSE, open);
    if (close === -1) throw new Error("the brief's what-you-are-reading block was opened and never closed");
    return body.slice(0, open) + block + body.slice(close + LEVEL_CLOSE.length);
  }
  const heading = /^## /m.exec(body);
  if (!heading) return `${body.trimEnd()}\n\n${block}\n`;
  return `${body.slice(0, heading.index)}${block}\n\n${body.slice(heading.index)}`;
}
