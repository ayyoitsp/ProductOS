/**
 * ⛔ WHAT 68 PIECES OF FEEDBACK SAY ABOUT HOW THIS PROJECT WORKS — WHICH NOTHING HAS EVER READ.
 *
 * Peter: *"we should have product OS self improve from the get-go. all the feedback it receives we
 * should record and figure out how to improve the agents. if it's make consistent errors or if it
 * corrections indicate it should add an agent/adjust an agent, we should do that"*.
 *
 * Recording the feedback was done long ago: every correction is in `changes/`, verbatim, with the
 * layers it had to reach. What was missing is anything that reads sixty-eight of them and notices
 * that four are the same mistake. Today that pattern is found by a person remembering — which is
 * how `walked:` survived its own deletion for months.
 *
 * ⛔ THIS IS THE HALF THAT NEEDS NO MODEL, AND IT IS THE HALF NOBODY HAS LOOKED AT. "Which layer
 * gets waived most" is arithmetic over records already on disk. It is not a judgement, it cannot
 * hallucinate, it runs in CI, and on this repo it answers immediately: `check` — the layer whose
 * absence makes every other layer unfalsifiable.
 *
 * ⛔ AND IT ONLY REPORTS. Nothing here writes a lesson, a steer, or a line of anybody's
 * instructions. An agent that edits its own instructions is the one boundary this project has not
 * crossed, and the way it stays uncrossed is that the thing which notices has no way to write.
 */
import fs from "node:fs";
import path from "node:path";
import { readChanges, type ChangeRecord } from "./change.js";
import { CASCADE } from "./jobs.js";

export interface Lesson {
  /** A stable name for the shape, so two runs of this agree about what they found. */
  kind:
    | "layer-most-waived"
    | "cascade-left-open"
    | "waiver-argued-twice"
    | "layer-most-corrected";
  /** What the record says, in one line. */
  what: string;
  /**
   * ⛔ THE RECORDS IT WAS DRAWN FROM, ALWAYS. A pattern you cannot go and look at is a number that
   * looks like information — and the whole argument for `learned_from` one level up is that a
   * reader can check what something was inferred from.
   */
  drawn_from: string[];
  /**
   * ⛔ WHAT THIS DOES NOT MEAN. Every one of these has a reading that is wrong and convenient, and
   * a report that omits it invites exactly that reading — "45 open" as a backlog to burn down
   * rather than a question about whether `close` is reachable.
   */
  not: string;
}

/** Waived layers, with the reason each was waived, flattened across every record. */
const waivers = (recs: ChangeRecord[]): Array<{ id: string; layer: string; why: string }> =>
  recs.flatMap((r) => Object.entries(r.waived ?? {}).map(([layer, why]) => ({ id: r.id, layer, why })));

const tally = <T>(xs: T[], key: (x: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    (m.get(k) ?? m.set(k, []).get(k)!).push(x);
  }
  return m;
};

/** ⛔ Squashed before comparing, so the same argument made with different wrapping still matches. */
const normalise = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Read the record and say what shape it is in.
 *
 * ⛔ THRESHOLDS ARE NAMED, NOT BURIED. Each finding says how many it took to count as a pattern, so
 * somebody disagreeing with the threshold can argue with a number instead of with the output.
 */
export function noticedIn(recs: ChangeRecord[]): Lesson[] {
  const out: Lesson[] = [];
  if (!recs.length) return out;

  const w = waivers(recs);
  if (w.length) {
    const byLayer = [...tally(w, (x) => x.layer).entries()].sort((a, b) => b[1].length - a[1].length);
    const top = byLayer[0]![1].length;
    /**
     * ⛔ A TIE IS REPORTED, NOT SUPPRESSED — and this was written the other way first.
     *
     * The guard read `top > second`, so two layers level at the top cancelled each other and the
     * finding vanished. On this repo that is exactly what happened: `derive` and `check` are both
     * waived eleven times against eight for the next, which is the strongest signal in the record,
     * and it printed nothing. A pattern dropped for being doubly true is the silent cap this file's
     * own rule forbids.
     */
    const leaders = byLayer.filter(([, h]) => h.length === top);
    /** The best any layer outside the tie managed — what makes the lead a lead. */
    const next = byLayer.find(([, h]) => h.length < top)?.[1].length ?? 0;
    const hits = leaders.flatMap(([, h]) => h);
    /**
     * ⛔ AND A TIE ACROSS *EVERY* LAYER IS NOT A LEAD. Reporting a tie is right where something sits
     * below it; where nothing does, "they are all waived equally" is being dressed as a finding, and
     * the headline would read "against 0 for the next" with no next in existence. One layer on its
     * own still leads — it is the only one anybody has waived.
     */
    const differentiated = leaders.length === 1 || leaders.length < byLayer.length;
    if (top >= 3 && top > next && differentiated) {
      const names = leaders.map(([l]) => `\`${l}\``).join(" and ");
      out.push({
        kind: "layer-most-waived",
        what:
          leaders.length === 1
            ? `${names} is waived more than any other layer — ${top} times, against ${next} for the next`
            : `${names} are waived more than any other layer — ${top} times each, against ${next} for the next`,
        drawn_from: [...new Set(hits.map((x) => x.id))],
        not: leaders.some(([l]) => l === "check")
          ? "⛔ not that those waivers were wrong — each carried a reason somebody could argue with. It means the layer whose absence makes every OTHER layer unfalsifiable is among the ones this project most often argues its way past, so the cascade is thinnest exactly where it is load-bearing"
          : "⛔ not that those waivers were wrong. Each carried a reason somebody could argue with. It means this is where the cascade keeps not applying, which is either a routing table asking the wrong question or a layer that needs a cheaper way to be reached",
      });
    }
  }

  const open = recs.filter((r) => !r.closed);
  if (open.length && open.length > recs.length / 2)
    out.push({
      kind: "cascade-left-open",
      what: `${open.length} of ${recs.length} changes were never closed`,
      drawn_from: open.map((r) => r.id),
      not: "⛔ not a backlog to burn down. A change is closed when every layer is reached or waived, so a majority left open says either that the work genuinely did not finish, or that `close` is asking for something nobody can give it — and those have opposite fixes",
    });

  /**
   * ⛔ THE SAME ARGUMENT MADE TWICE IS THE STRONGEST SIGNAL HERE, and the cheapest to compute. A
   * waiver is meant to be a decision somebody could disagree with; one that has been written out
   * verbatim on three separate changes has stopped being a decision and become a form of words.
   * That is either a rule the cascade should know, or a layer that should not have been routed to.
   */
  for (const [, same] of tally(w, (x) => `${x.layer}::${normalise(x.why)}`))
    if (same.length >= 2)
      out.push({
        kind: "waiver-argued-twice",
        what: `the same reason has waived \`${same[0]!.layer}\` ${same.length} times: "${same[0]!.why.replace(/\s+/g, " ").slice(0, 120)}${same[0]!.why.length > 120 ? "…" : ""}"`,
        drawn_from: same.map((x) => x.id),
        not: "⛔ not that the reason is wrong — it may be exactly right every time. A standing argument belongs in the routing table, so nobody has to make it again; re-making it by hand is how a waiver becomes paperwork",
      });

  const byKind = [...tally(recs, (r) => r.kind).entries()].sort((a, b) => b[1].length - a[1].length);
  const layers = tally(
    recs.flatMap((r) => (CASCADE[r.kind] ?? []).filter((l) => r.reaches?.[l]).map((l) => ({ id: r.id, l }))),
    (x) => x.l
  );
  const ranked = [...layers.entries()].sort((a, b) => b[1].length - a[1].length);
  if (ranked.length && ranked[0]![1].length >= 5)
    out.push({
      kind: "layer-most-corrected",
      what: `most feedback lands in \`${ranked[0]![0]}\` — ${ranked[0]![1].length} changes reached it, and the commonest kind of change is \`${byKind[0]![0]}\` (${byKind[0]![1].length})`,
      drawn_from: ranked[0]![1].map((x) => x.id),
      not: "⛔ not a problem on its own — the layer that gets corrected most may simply be the layer with the most surface. It is worth reading next to what gets WAIVED most: a layer high on both is one the project keeps touching and keeps declining to verify",
    });

  return out;
}

/** Every change record this project keeps, or an empty list where it keeps none. */
export function recordsIn(root: string): ChangeRecord[] {
  return fs.existsSync(path.join(root, "changes")) ? readChanges(root) : [];
}
