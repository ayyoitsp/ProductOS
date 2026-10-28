/**
 * ⛔ WHAT WAS DECIDED HERE, AND HOW — the reader for the verdict log.
 *
 * The log was append-only and almost entirely write-only. `Verdict.also_considered` has existed
 * since the model did, is populated on every pick, and was rendered nowhere: the options that
 * lost were recorded specifically so a decision would not be relitigated from scratch, and then
 * no surface showed them to the person about to relitigate it. `chose` and `option_said` landed
 * in the same state the day they were added, and `via` would have.
 *
 * A dead-field test caught it, which is the fourth consecutive round something written by an
 * author reached no reader. Hence one module whose only job is turning the log back into
 * something a person reads.
 */
import type { Corpus } from "./load.js";
/** ⛔ The one home for what a read-through covered — see `readHashFor`. */
import { readHashFor } from "./settle.js";
import type { Verdict } from "./schema.js";

export interface Decision {
  act: Verdict["kind"];
  /** The ref this act was aimed at — a slot, an exchange, a rule or a scope. */
  ref: string;
  by: string;
  at: string;
  /**
   * Which surface obtained the consent.
   *
   * ⛔ SHOWN, NOT JUST STORED. A stamp is a claim that a person agreed; how they were asked is
   * part of how much it is worth, and a reader who cannot see it has to assume the strongest
   * reading of the weakest surface.
   */
  via: Verdict["via"];
  /** What it now says, for a ruling. */
  says?: string;
  because?: string;
  /** For a ruling made by choosing a drafted option: which, and the argument FOR that option. */
  chose?: string;
  optionSaid?: string;
  /** The options that lost, and why — so this is not argued again from nothing. */
  alsoConsidered?: string;
  /** The sentence this ruling revised. */
  replaced?: string;
  /** For a deferral: what brings it back. */
  until?: string;
  /** For a read-through. */
  buildable?: boolean;
  blockedBy?: string[];
  /**
   * Whether a `buildable: true` still stands against the words as they now read.
   *
   * ⛔ WITHOUT THIS THE PAGE RENDERED THE LAUNDERING. A reading whose sentences have all been
   * rewritten showed as *"could build from it"*, indistinguishable from one taken this morning —
   * which is the whole defect `covers_read` closed, left visible on the one surface Peter reviews
   * on. `undefined` where there is nothing to say: a no never expires, and a reading from before
   * the field existed is unprovenanced rather than stale.
   */
  spent?: "stale" | "unrecorded";
  note?: string;
}

const refOf = (v: Verdict): string => v.settles ?? v.target ?? v.scope ?? "";

const asDecision = (corpus: Corpus) => (v: Verdict): Decision => ({
  act: v.kind,
  ref: refOf(v),
  by: v.by,
  at: v.at,
  via: v.via,
  ...(v.says ? { says: v.says } : {}),
  ...(v.because ? { because: v.because } : {}),
  ...(v.chose ? { chose: v.chose } : {}),
  ...(v.option_said ? { optionSaid: v.option_said } : {}),
  ...(v.also_considered ? { alsoConsidered: v.also_considered } : {}),
  ...(v.replaced ? { replaced: v.replaced } : {}),
  ...(v.until ? { until: v.until } : {}),
  ...(v.buildable === undefined ? {} : { buildable: v.buildable }),
  ...(v.blocked_by?.length ? { blockedBy: v.blocked_by } : {}),
  ...(v.kind === "read" && v.buildable === true
    ? !v.covers_read
      ? { spent: "unrecorded" as const }
      : v.covers_read !== readHashFor(corpus, v.scope!)
        ? { spent: "stale" as const }
        : {}
    : {}),
  ...(v.note ? { note: v.note } : {}),
});

/**
 * Every act recorded against exactly this ref, oldest first.
 *
 * ⛔ EXACTLY, not by prefix. A slot's decisions are not its exchange's: rendering an exchange's
 * acceptance under one of its slots would read as "somebody agreed to this sentence" when what
 * they agreed to was the whole exchange, possibly before the sentence existed.
 */
export function decisionsOn(corpus: Corpus, ref: string): Decision[] {
  return corpus.verdicts
    .filter((v) => refOf(v) === ref)
    .map(asDecision(corpus))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Every act recorded against this ref or anything beneath it — a whole exchange's history.
 *
 * ⛔ On a word boundary, not on `#`. `check` reports criterion-level findings as
 * `money#see-a-balance criterion 1` — a space — and the same shape appears in refs a reviewer
 * pastes, so prefix-matching on `#` alone silently skipped them once already.
 */
export function decisionsUnder(corpus: Corpus, ref: string): Decision[] {
  return corpus.verdicts
    .filter((v) => {
      const r = refOf(v);
      return r === ref || (r.startsWith(ref) && /^[#\s]/.test(r.slice(ref.length)));
    })
    .map(asDecision(corpus))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * One line naming how a decision was reached, for a surface with no room for the whole record.
 *
 * ⛔ The surface is named in a reader's words rather than as the stored token, because `via:
 * chat` on a page tells a reader nothing about what it means for the claim's strength.
 */
export const HOW: Record<Verdict["via"], string> = {
  page: "pressed on a page showing what it covered",
  question: "chosen from the options, in the question interface",
  chat: "answered in conversation",
  cli: "recorded at the command line",
  /** ⛔ Not consent. A default landed so somebody has something to disagree with. */
  agent: "decided for you by software, and standing only until somebody says otherwise",
};

export function howItWasDecided(d: Decision): string {
  return `${d.by} on ${d.at} — ${HOW[d.via]}`;
}
