/**
 * The reviewer's worklist — every open decision in the corpus, ranked, each stated as a
 * question with what you need to answer it.
 *
 * ⛔ EVERYTHING HERE EXISTED AND NOTHING PRESENTED IT. A reader had to open a page, expand
 * a readiness panel, and read forty-two undifferentiated lines to find the one that was
 * theirs — on a corpus with 250 blockers across 26 pages. Peter, naming the failure and
 * generalising it past this tool: *"instead of having them search for it. Same complaint I
 * have for Claude Code — it's starting to embed questions into dense prose. I want it
 * ready with questions, explanations as necessary, clearly explaining the question."*
 *
 * So this is not a report. Every entry is a **question addressed to a person**, with the
 * facts needed to answer it and what it costs to get wrong, ordered so that working
 * top-down is the correct order.
 *
 * ⛔ THE ORDER IS THE ARGUMENT. You must not accept a claim that is contradicted or
 * ambiguous: stamping "this is what we intend" onto a sentence with two meanings is worse
 * than leaving it unstamped, because now it looks settled. So conflicts come before gaps,
 * gaps before acceptance, and context before the claims that rest on it.
 */
import {
  Behavior,
  FeatureDocument,
  isUndefinedBehavior,
} from "./product.js";
import { FeatureTracking } from "./tracking.js";
import { derivedVerification } from "./derived-state.js";
import type { ContextDocument, ContextSection } from "./context.js";
import type { ContextSectionState } from "./context.js";

export type DecisionKind =
  | "contradiction"
  | "ambiguity"
  | "could-not-build"
  | "undecided"
  | "unaccepted-rule"
  | "unaccepted-claim";

export interface Decision {
  kind: DecisionKind;
  /** Lower is sooner. Ties broken by how much the answer unblocks. */
  rank: number;
  container: string;
  behavior?: string;
  /** Stated as a question, because that is what it is. */
  question: string;
  /** What a person needs in front of them to answer it. One item per line. */
  context: string[];
  /** What it costs to answer wrong, or to leave unanswered. Omitted when there is no
   *  honest answer rather than filled with a guess. */
  stakes?: string;
  /** Who owes the answer, when the corpus says. */
  owedBy?: string;
  /** How many other things an answer unblocks. Drives ordering within a kind. */
  unblocks: number;
  /** The single thing to do about it. */
  action: string;
  /**
   * Where to go to look at it.
   *
   * ⛔ Carried here rather than derived from `container` by each renderer. A rule's
   * container is a context document name, not a routable id, so deriving `/{container}`
   * produced four 404s the moment the queue shipped — the link has to be built by whoever
   * knows what kind of thing this is.
   */
  href: string;
}

const BASE: Record<DecisionKind, number> = {
  contradiction: 0,
  ambiguity: 100,
  "could-not-build": 200,
  undecided: 300,
  // ⛔ Rules before the claims that cite them. A claim resting on an unaccepted rule is
  // resting on something an agent may have written, so accepting the claim first blesses
  // the rule by implication.
  "unaccepted-rule": 900,
  "unaccepted-claim": 1000,
};

export function buildWorklist(
  containers: FeatureDocument[],
  trackingFor: (id: string) => FeatureTracking | null,
  contextStates: Map<string, ContextSectionState> = new Map(),
  contextDocs: Array<{ doc: ContextDocument; section: ContextSection; ref: string }> = []
): Decision[] {
  const out: Decision[] = [];

  // How many behaviors each question blocks — `blocks` finally used for ranking rather
  // than only for rendering.
  const blockedBy = new Map<string, number>();
  for (const c of containers) {
    for (const b of c.frontmatter.behaviors) {
      const key = `${c.frontmatter.id}#${b.id}`;
      blockedBy.set(key, (b.blocks ?? []).length);
    }
  }
  const sameAsGroups = new Map<string, string[]>();
  for (const c of containers) {
    for (const b of c.frontmatter.behaviors) {
      if ((b.same_as ?? []).length === 0) continue;
      sameAsGroups.set(`${c.frontmatter.id}#${b.id}`, b.same_as ?? []);
    }
  }

  for (const c of containers) {
    const id = c.frontmatter.id;
    const tracking = trackingFor(id);

    for (const b of c.frontmatter.behaviors) {
      if (b.deprecated) continue;
      const ref = `${id}#${b.id}`;

      // ---- a conflict: somebody must rule ----
      for (const other of b.contradicts ?? []) {
        out.push({
          kind: "contradiction",
          rank: BASE.contradiction,
          container: id,
          behavior: b.id,
          question: "Which of these two claims is right? They cannot both hold.",
          context: [
            `This page says: ${oneLine(b.claim)}`,
            `${other} says the opposite.`,
            b.contradiction_note ? `Why they conflict: ${oneLine(b.contradiction_note)}` : "",
          ].filter(Boolean),
          stakes:
            "Until this is settled neither claim can be built from — and an engineer who picks one will pass every test either way.",
          unblocks: 2,
          action: "Reword or retire whichever is wrong, then remove the declaration.",
          href: `/${id}#behavior-${b.id}`,
        });
      }

      // ---- an ambiguity: the claim is true and does not pin the build ----
      for (const a of b.ambiguous ?? []) {
        out.push({
          kind: "ambiguity",
          rank: BASE.ambiguity,
          container: id,
          behavior: b.id,
          question: "Which of these did you mean?",
          context: [
            `The claim: ${oneLine(b.claim)}`,
            ...a.readings.map((r, i) => `Reading ${i + 1}: ${oneLine(r)}`),
            a.raised_by ? `Raised by ${a.raised_by}.` : "",
          ].filter(Boolean),
          stakes:
            a.cost ??
            "Two engineers would build different things from this sentence and both would pass every test case on it.",
          unblocks: 1,
          action:
            "Reword the claim so only one reading survives, or split the readings into separate behaviors.",
          href: `/${id}#behavior-${b.id}`,
        });
      }
    }

    // ---- a person read it and could not build ----
    const reads = [...(c.frontmatter.read_throughs ?? [])].sort((a, b) =>
      String(b.at).localeCompare(String(a.at))
    );
    if (reads.length > 0 && !reads[0]!.buildable) {
      const r = reads[0]!;
      out.push({
        kind: "could-not-build",
        rank: BASE["could-not-build"],
        container: id,
        question: `${r.by} read this end to end and could not build from it. What has to change?`,
        context: [
          r.note ? `They said: ${oneLine(r.note)}` : "",
          r.blocked_by.length ? `Blocked on: ${r.blocked_by.join(", ")}` : "",
          `Read on ${String(r.at).slice(0, 10)}.`,
        ].filter(Boolean),
        stakes:
          "This is the only signal here that nothing computes — a corpus can satisfy every check and still be unbuildable.",
        unblocks: r.blocked_by.length,
        action: "Settle what they were blocked on, then have somebody read it again.",
        href: `/${id}`,
      });
    }

    // ---- nobody has decided ----
    for (const b of c.frontmatter.behaviors) {
      if (b.deprecated || !isUndefinedBehavior(b)) continue;
      const ref = `${id}#${b.id}`;
      const group = sameAsGroups.get(ref) ?? [];
      const unblocks = (b.blocks ?? []).length + group.length;
      const proposal = (b.notes ?? "").includes("Proposed by")
        ? oneLine(b.notes ?? "")
        : "";
      out.push({
        kind: "undecided",
        rank: BASE.undecided - Math.min(unblocks, 20),
        container: id,
        behavior: b.id,
        question: oneLine(b.question ?? ""),
        context: [
          group.length
            ? `This is the same question as ${group.length} other${group.length === 1 ? "" : "s"} — one answer closes all ${group.length + 1}.`
            : "",
          b.blocks === undefined
            ? "Nobody has worked out what this blocks."
            : b.blocks.length === 0
              ? "Blocks nothing — the rest of this can ship without it."
              : `Blocks: ${b.blocks.join(", ")}`,
          b.asked_at ? `Open since ${String(b.asked_at).slice(0, 10)}.` : "",
          proposal,
        ].filter(Boolean),
        owedBy: b.asked_of,
        unblocks,
        action: `productos decide ${id} ${b.id} --claim "…" --because "…"`,
        href: `/${id}#behavior-${b.id}`,
      });
    }

    // ---- waiting for you to agree ----
    for (const b of c.frontmatter.behaviors) {
      if (b.deprecated || isUndefinedBehavior(b)) continue;
      if ((b.contradicts ?? []).length > 0 || (b.ambiguous ?? []).length > 0) continue;
      const d = derivedVerification(b, tracking?.behaviors?.[b.id] ?? null);
      if (d.state !== "unverified") continue;
      const t = tracking?.behaviors?.[b.id];
      out.push({
        kind: "unaccepted-claim",
        rank: BASE["unaccepted-claim"],
        container: id,
        behavior: b.id,
        question: `Is this what we intend?\n    ${oneLine(b.claim, 400)}`,
        context: [
          t?.confidence === "guessed"
            ? "An agent inferred this with no direct evidence. Read it closely."
            : t?.confidence === "observed"
              ? `Read off the code: ${oneLine(t.basis?.[0]?.quote ?? t.basis?.[0]?.ref ?? "", 160)}`
              : t?.confidence === "stated"
                ? "Somebody told us this."
                : "No confidence recorded — nothing says where this came from.",
          `${(b.test_cases ?? []).length} acceptance case${(b.test_cases ?? []).length === 1 ? "" : "s"}.`,
        ].filter(Boolean),
        unblocks: 0,
        action: `productos verify ${id} ${b.id}`,
        href: `/${id}#behavior-${b.id}`,
      });
    }
  }

  // ---- rules nobody has accepted ----
  for (const { doc, section, ref } of contextDocs) {
    if (contextStates.get(ref) === "validated") continue;
    const restingOn = containers.flatMap((c) =>
      c.frontmatter.behaviors.filter((b) => (b.cites ?? []).includes(ref)).map(() => c.frontmatter.id)
    );
    // ⛔ Only rules something actually rests on. An unaccepted rule nothing cites is a
    // suggestion, not a blocker, and putting it in a person's queue is the overwhelming
    // this list exists to avoid.
    if (restingOn.length === 0) continue;
    out.push({
      kind: "unaccepted-rule",
      rank: BASE["unaccepted-rule"] - Math.min(restingOn.length, 20),
      container: doc.name,
      question: `Is this rule what we intend?\n    ${oneLine(section.title)} — ${oneLine(section.text, 300)}`,
      context: [
        `${restingOn.length} claim${restingOn.length === 1 ? "" : "s"} rest${restingOn.length === 1 ? "s" : ""} on it, so accepting them means accepting this first.`,
        contextStates.get(ref) === "stale"
          ? "It was accepted once and the wording changed afterwards."
          : "No human has accepted it.",
      ],
      unblocks: restingOn.length,
      action: `productos verify-context ${ref}`,
      href: `/_context#${section.anchor}`,
    });
  }

  return out.sort((a, b) => a.rank - b.rank || b.unblocks - a.unblocks);
}

/** Group the list the way the two tenets divide it. */
export function groupWorklist(list: Decision[]): Array<{
  title: string;
  why: string;
  items: Decision[];
}> {
  const pick = (...kinds: DecisionKind[]) => list.filter((d) => kinds.includes(d.kind));
  return [
    {
      title: "Settle these first — what is written does not pin the build",
      why:
        "Nothing is missing here; the words are the problem. Accepting a claim in this group would stamp “this is what we intend” onto a sentence with two meanings, which is worse than leaving it unstamped — it would look settled.",
      items: pick("contradiction", "ambiguity", "could-not-build"),
    },
    {
      title: "Then these — nobody has decided yet",
      why:
        "Questions with no answer. Each names who owes it and what it blocks, so the ones holding up the most work come first.",
      items: pick("undecided"),
    },
    {
      title: "Then agree with what is written",
      why:
        "Nothing is wrong with these. Somebody has to read each one and say whether it is what the team intends — the one thing an agent cannot do. Rules come before the claims that cite them.",
      items: pick("unaccepted-rule", "unaccepted-claim"),
    },
  ].filter((g) => g.items.length > 0);
}

function oneLine(s: string, max = 220): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}
