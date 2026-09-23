/**
 * The grid — the behaviours a scope states, and where each came from.
 *
 * ⛔ THIS IS THE DESIGN MADE VISIBLE. Seven columns, one row per exchange. A cell is
 * stated here, inherited from a rule already accepted, unsettled, or blank — and a blank
 * is the finding. In v1 a reader had to infer completeness from prose; here it is a shape
 * you can see from across a room, which is the only reason "every button has a loading
 * state" can be written once and still be legible on forty pages.
 */
import { SLOTS, type SlotName, type Rule } from "./schema.js";
import { resolveRules, disputeIndex, DOWNSTREAM_OF_ANSWER, answerIsUnknown, type Corpus } from "./load.js";
import { stampFor } from "./stamp.js";
import { existsOf } from "./load.js";

export interface Cell {
  /** Rules that ADD a requirement to this slot, whatever the slot itself says. */
  constrainedBy?: string[];
  /** Rules this exchange has deliberately opted out of at this slot, each with a reason. */
  exceptsRules?: string[];
  /** Rules this slot's own sentence narrows, which still govern here. */
  defersToRules?: string[];
  mark: string;
  meaning: string;
  rule?: string;
}

export interface GridRow {
  exchange: string;
  title: string;
  askedBy: string;
  cells: Record<SlotName, Cell>;
}

export interface Grid {
  scope: string;
  title: string;
  rows: GridRow[];
  rulesUsed: Map<string, Rule>;
  /** rule id → its stable R-number across the whole corpus. */
  number: Map<string, number>;
  counts: {
    stated: number;
    inherited: number;
    unsettled: number;
    blank: number;
    outOfScope: number;
    constrained: number;
    /** A subset of `unsettled` — parked by a person, not still to be raised with one. */
    deferred: number;
  };
}


export function gridFor(corpus: Corpus, scopeId: string): Grid | null {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return null;
  const { inherited, constrained, awaiting } = resolveRules(corpus);
  const disputes = disputeIndex(corpus);
  const deferrals = new Set(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => v.target!));
  /**
   * ⛔ R-numbers are assigned from the corpus's rule order, not from cell-visit order
   * within one grid. They were per-scope, so `R1` meant a different rule on every page —
   * and a shorthand whose only job is to be carried in your head across pages cannot mean
   * something different on each one.
   */
  const ruleNumber = new Map(corpus.rules.map((r, i) => [r.rule.id, i + 1]));
  const rulesUsed = new Map<string, Rule>();
  const counts = { stated: 0, inherited: 0, unsettled: 0, blank: 0, outOfScope: 0, constrained: 0, deferred: 0 };
  const rows: GridRow[] = [];

  for (const ex of entry.scope.exchanges) {
    const cells = {} as Record<SlotName, Cell>;
    const answerUnsettled = answerIsUnknown(ex.slots.answer);
    for (const slot of SLOTS) {
      const fill = ex.slots[slot];
      const inh = inherited.get(`${scopeId}#${ex.id}#${slot}`);
      // ⛔ Collected BEFORE any branch returns, because a constraint applies to a stated
      // slot, an inherited one and an unsettled one alike. The whole reason `mode` exists
      // is that a stated slot used to fall through and escape.
      const cons = constrained.get(`${scopeId}#${ex.id}#${slot}`) ?? [];
      for (const r of cons) rulesUsed.set(r.id, r);
      if (cons.length) counts.constrained++;
      const alsoBy = cons.length ? { constrainedBy: cons.map((r) => r.id) } : {};
      // ⛔ An exception MUST be visible from the grid. A rule opted out of invisibly is
      // worse than no rule: every reader believes it holds here, because it holds
      // everywhere else. The brief asks for this by name.
      const exc = ex.excepts.filter((x) => corpus.rules.some((r) => r.rule.id === x.rule && r.rule.fills.includes(slot)));
      // ⛔ `instead_of` renders the same as `excepts`, because the reader's question is the
      // same one: does this org-wide rule govern here, and if not, is there a reason on
      // file? A declared override that rendered as an ordinary `✓` was the silent escape.
      const over = [...exc.map((x) => x.rule), ...(ex.slots[slot]?.instead_of ?? []).map((x) => x.rule)];
      /**
       * ⛔ `defers_to` IS RENDERED, because it was the attack `instead_of` was priced to close,
       * reopened through the field added to fix it.
       *
       * `defers_to: only-a-parent-moves-money` beside `says: Anybody signed in on the shared
       * device may record what a kid earned, including a kid recording their own.` produced a
       * grid cell reading a bare `✓` with the rule's `R6` simply gone, an accept preview saying
       * `· may: stated here`, and a packet printing the sentence and "still holds" fourteen
       * lines apart. A reader could not see that the two were about the same slot.
       */
      const holds = (ex.slots[slot]?.defers_to ?? []).map((x) => x.rule);
      for (const id of holds) {
        const r = corpus.rules.find((y) => y.rule.id === id);
        if (r) rulesUsed.set(r.rule.id, r.rule);
      }
      const holdsOf = holds.length ? { defersToRules: holds } : {};
      for (const id of over) {
        const r = corpus.rules.find((y) => y.rule.id === id);
        if (r) rulesUsed.set(r.rule.id, r.rule);
      }
      const exceptOf = over.length ? { exceptsRules: over } : {};
      if (inh && (!fill || fill.standing.kind !== "stated")) {
        rulesUsed.set(inh.id, inh);
        counts.inherited++;
        cells[slot] = { mark: "↑", meaning: `inherited from ${inh.id}`, rule: inh.id, ...alsoBy, ...exceptOf, ...holdsOf };
        continue;
      }
      const ruleCases =
        slot === "refuses" && (constrained.get(`${scopeId}#${ex.id}#${slot}`) ?? []).some((r) => (r.outcomes ?? []).length);
      if (!fill && ruleCases) {
        // ⛔ Answered by a rule's named cases. Reads as inherited, because it is.
        counts.inherited++;
        cells[slot] = { mark: "↑", meaning: "the shared named cases", ...alsoBy, ...exceptOf, ...holdsOf };
        continue;
      }
      if (!fill) {
        // ⛔ The grid and `check` must agree about what a hole is, or the page a person
        // reads and the gate that refuses the corpus tell them different things.
        if (answerUnsettled && DOWNSTREAM_OF_ANSWER.includes(slot)) {
          cells[slot] = {
            mark: "⋯",
            meaning: "follows from the answer, which is not ruled yet — not a hole",
            ...alsoBy,
            ...exceptOf,
          };
          continue;
        }
        /**
         * ⛔ WAITING ON AN ORG-WIDE QUESTION IS NOT THE SAME AS NOBODY HAVING THOUGHT ABOUT IT.
         *
         * Both are un-buildable and neither is whitespace, but they are answered in different
         * places: a blank is answered here, and this is answered once at the rule, for every slot
         * it reaches. Marking both `·` told a reviewer to fix 643 cells that were 7 decisions.
         */
        const waits = awaiting.get(`${scopeId}#${ex.id}#${slot}`) ?? [];
        if (waits.length) {
          counts.unsettled++;
          for (const w of waits) rulesUsed.set(w.id, w);
          cells[slot] = {
            mark: `⋯${waits.map((w) => shortRuleId(w.id, ruleNumber)).join("")}`,
            meaning: `waiting on an org-wide question: ${waits.map((w) => w.id).join(", ")}`,
            ...alsoBy,
            ...exceptOf,
            ...holdsOf,
          };
          continue;
        }
        counts.blank++;
        // ⛔ A blank is not a blank — it is the one cell shape that means nobody has
        // thought about it, which is why it reads as a hole rather than as whitespace.
        cells[slot] = { mark: "·", meaning: "nothing says this — a hole, not a silence", ...alsoBy, ...exceptOf, ...holdsOf };
        continue;
      }
      const k = fill.standing.kind;
      // ⛔ A slot NAMED in someone else's dispute renders as disputed too. Otherwise the
      // far side of a contradiction reads `✓` and goes into the packet as settled.
      const namedIn = (disputes.get(`${scopeId}#${ex.id}#${slot}`) ?? []).filter(
        (d) => d.from !== `${scopeId}#${ex.id}#${slot}`
      );
      if (k !== "disputed" && namedIn.length) {
        counts.unsettled++;
        cells[slot] = {
          mark: "✗",
          meaning: `${namedIn[0]!.from} says it cannot hold with this`,
          ...alsoBy,
          ...exceptOf,
          ...holdsOf,
        };
        continue;
      }
      // ⛔ `✓` with a mark appended — stated, and something about it is not ruled. Reading
      // as a plain `✓` is what let the precise version look more finished than the vague one.
      const openCase = (fill.outcomes ?? []).find(
        (o) => o.standing && o.standing.kind !== "stated" && o.standing.kind !== "out_of_scope"
      );
      if (k === "stated") {
        counts.stated++;
        if (openCase) counts.unsettled++;
        cells[slot] = {
          mark: (fill.none ? "–" : fill.cannot_fail ? "⊘" : "✓") + (openCase ? "◒" : ""),
          // ⛔ `none` means a different fact on each slot it is legal on, and one meaning for both
          // would tell a reader of an `after` cell that nothing is REFUSED — a sentence about a
          // different slot entirely — where what is stated is that nothing CHANGES.
          meaning: fill.none
            ? slot === "after"
              ? "nothing is different afterwards, stated"
              : "nothing to refuse, stated"
            : fill.cannot_fail
              ? "cannot fail, stated"
              : "stated here",
          ...alsoBy,
          ...exceptOf,
          ...holdsOf,
        };
      } else if (k === "out_of_scope") {
        counts.outOfScope++;
        cells[slot] = { mark: "∅", meaning: `deliberately not answered here: ${fill.standing.because}`, ...alsoBy, ...exceptOf, ...holdsOf };
      } else {
        counts.unsettled++;
        // ⛔ A deferred question must not look like one nobody has read. The bracket says
        // "a person saw this and parked it" — still unsettled, still ungated, but no
        // longer something to raise with them.
        const put = deferrals.has(`${scopeId}#${ex.id}#${slot}`);
        if (put) counts.deferred++;
        cells[slot] = {
          mark: (k === "open" ? "○" : "✗") + (put ? "]" : ""),
          meaning:
            k === "open" ? `open — ${fill.standing.asked_of} owes the answer` : "disputed",
          ...alsoBy,
          ...exceptOf,
          ...holdsOf,
        };
      }
    }
    rows.push({ exchange: ex.id, title: ex.title, askedBy: ex.asked_by, cells });
  }
  return { scope: scopeId, title: entry.scope.title, rows, rulesUsed, counts, number: ruleNumber };
}

export function renderGridText(g: Grid, colour: (s: string, c: string) => string = (s) => s): string {
  const w = Math.max(24, ...g.rows.map((r) => r.exchange.length));
  /**
   * ⛔ Column width from the widest cell, not a fixed 8.
   *
   * `padEnd(8)` was already at 7 of 8 characters in the shipped corpus. One more
   * constraining rule produced `✓+R2+R3+R6✓` — the next column's mark jammed onto this
   * one's — and the grid IS the review surface, so a reviewer at scale got a garbled
   * table exactly when they had the most rules to hold.
   */
  const cellText = (r: GridRow, s: SlotName) => {
    const c = r.cells[s];
    const base = c.rule ? `${c.mark}${shortRule(c.rule, g)}` : c.mark;
    const plus = (c.constrainedBy ?? []).map((id) => `+${shortRule(id, g)}`).join("");
    const off = (c.exceptsRules ?? []).map((id) => `⊗${shortRule(id, g)}`).join("");
    // ⛔ `≥Rn` — the rule still holds here and this sentence narrows it. Without it a slot
    // that deferred rendered as a bare `✓` with the rule simply gone from the row, which is
    // indistinguishable from a slot no rule ever reached.
    const held = (c.defersToRules ?? []).map((id) => `≥${shortRule(id, g)}`).join("");
    return `${base}${plus}${off}${held}`;
  };
  const cw = Math.max(
    8,
    ...SLOTS.map((s) => Math.max(s.length, ...g.rows.map((r) => cellText(r, s).length))) 
  ) + 2;
  const head = SLOTS.map((s) => s.padEnd(cw)).join("");
  const out: string[] = [];
  const { stated, inherited, unsettled, blank, outOfScope, constrained, deferred } = g.counts;
  const total = stated + inherited + unsettled + blank + outOfScope;
  out.push(
    `${g.title} — ${g.rows.length} exchange${g.rows.length === 1 ? "" : "s"} · ${total} slots · ` +
      `${stated} here · ${inherited} inherited · ${outOfScope} out of scope · ${unsettled} unsettled · ${blank} blank` +
      (constrained ? ` · ${constrained} also carry a rule` : "") +
      (deferred ? ` · ${deferred} of the unsettled parked by a person` : "")
  );
  out.push("");
  out.push(`${"".padEnd(w + 2)}${head}`);
  for (const r of g.rows) {
    // `+R2` reads as "and R2 also applies here"; `⊗R2` as "and deliberately not here".
    const cells = SLOTS.map((s) => cellText(r, s).padEnd(cw)).join("");
    out.push(`${r.exchange.padEnd(w + 2)}${cells}`);
  }
  out.push("");
  out.push("✓ stated here   ↑ a rule SUPPLIES it   +Rn a rule also CONSTRAINS it   ∅ deliberately not answered");
  out.push("⊗Rn a rule deliberately does NOT apply here, with a reason");
  out.push("≥Rn a rule STILL holds here, and this sentence only narrows it");
  // ⛔ Both meanings, because `none` is legal on two slots and means a different fact on each.
  out.push("– nothing to refuse, or on `after`: nothing is different afterwards");
  out.push("⊘ cannot fail   ○ open   ✗ disputed");
  out.push("◒ stated, and one NAMED CASE inside it is not ruled — the rest is buildable");
  out.push("⋯ follows from an answer nobody has ruled on yet");
  out.push("]  a person read this and parked it — still unsettled, still not buildable, no longer asked");
  out.push(colour("· BLANK — nobody has said what this is", "red"));
  if (g.rulesUsed.size) {
    out.push("");
    for (const [id, r] of [...g.rulesUsed].sort((a, b) => (g.number.get(a[0]) ?? 0) - (g.number.get(b[0]) ?? 0)))
      out.push(`R${g.number.get(id)} ${id} — fills ${r.fills.join(" + ")} · ${(r.statement ?? "").replace(/\s+/g, " ")}`);
  }
  return out.join("\n");
}

/** ⛔ Shared with `gridFor`, which needs an R-number before the `Grid` object exists. */
function shortRuleId(id: string, number: Map<string, number>): string {
  const n = number.get(id);
  return n ? `R${n}` : "";
}

function shortRule(id: string, g: Grid): string {
  const n = g.number.get(id);
  return n ? `R${n}` : "";
}

// ---------------------------------------------------------------------------
// Tenet 1: how many acts of human judgement does this corpus demand?

export interface ActCount {
  /**
   * Behaviours settled and not yet agreed to — one sentence each.
   *
   * ⛔ THE NUMBER A REVIEWER IS ACTUALLY FACING, and it was reported as zero. Everything here
   * counted exchange-grained acts, and an exchange is gated until all eight of its slots are
   * settled — so a migrated corpus read "0 acts now" while 47 written sentences waited for somebody
   * to agree to them. The one figure that says how much review is owed said none was.
   */
  behaviours: string[];
  /** One accept per exchange whose every slot is stated. */
  acceptable: string[];
  /** Gated: an exchange with an unsettled slot cannot be accepted yet. */
  gated: string[];
  /** One accept per rule. ⛔ The reach is shown, because one stamp here goes furthest. */
  rules: Array<{ id: string; reaches: number }>;
  /** Rulings owed — a standing only a person can move, and nobody has parked. */
  rulings: Array<{ where: string; kind: string; owed: string }>;
  /** Parked by a person. ⛔ Still unsettled and still gating; simply not asked again. */
  deferred: Array<{ where: string; kind: string; because: string; until: string; by: string }>;
  /** ⛔ Accepted, and then the thing it covered changed. Reads as reviewed; was not. */
  stale: Array<{ where: string; was: string; by: string; at: string }>;
}


/**
 * ⛔ THE GATE, AS ONE FUNCTION, BECAUSE THREE PLACES HAD THREE ANSWERS.
 *
 * `acts` declined to OFFER an exchange with an unsettled slot, printing the reason —
 * "never offered, because accepting it would stamp intent onto something unsettled". And
 * `v2 accept` then stamped that exact exchange, because it gated on
 * `severity === "refuse"` while every unsettled standing is deliberately `severity: "note"`.
 * One command on the pristine corpus put a human's name on `tasks#complete-a-task` while
 * its `at_once` slot held an unanswered question, and the exchange then left the review
 * queue in BOTH directions — neither offered nor gated, so nobody would ever meet it again.
 *
 * A list that declines to offer something is not a gate. This is the gate.
 */
export interface GateResult {
  ok: boolean;
  /** Why it cannot be accepted, one line per reason, in a reviewer's words. */
  blocking: Array<{ slot: SlotName; kind: string; says: string }>;
}

export function gateFor(corpus: Corpus, ref: string): GateResult | null {
  /**
   * ⛔ A RULE IS GATED TOO, and this returned `null` for one — which `accept` reads as "no
   * gate", so `v2 accept <open-rule> --by alice` stamped a rule that has no statement at all.
   * The preview even printed `· statement` and `· 0 criteria`. After that the question was
   * neither acceptable, nor owed, nor gated, nor parked: it had left the corpus.
   */
  const asRule = corpus.rules.find((r) => r.rule.id === ref);
  if (asRule) {
    const k = asRule.rule.standing?.kind ?? "stated";
    /**
     * ⛔ A DISPUTE IS VISIBLE FROM BOTH ENDS, AND FROM THE RULE'S END IT WAS INVISIBLE.
     *
     * A slot may declare `standing: disputed` with `targets: [<a rule id>]` — a formal statement
     * that the two cannot both hold as written. The accusing slot was gated correctly. The rule was
     * not: it stayed in the ready-to-accept list and `v2 accept <rule> --by peter` stamped it
     * **clean**, with nothing on any surface saying a slot was contradicting it. One accept on a
     * rule reaches every exchange its selector touches, so this is the widest stamp in the model
     * and it was the one a contradiction could not reach.
     *
     * `disputeIndex` already keys accusations by target, rule ids included. Nothing consulted it
     * here — the relation was stored once and read from one side.
     */
    const accusedBy = (disputeIndex(corpus).get(ref) ?? []).filter((d) => d.from !== ref);
    if (accusedBy.length)
      return {
        ok: false,
        blocking: accusedBy.map((d) => ({
          slot: asRule.rule.fills[0]!,
          kind: "disputed — from a slot",
          says: `${d.from} declares it cannot hold with this rule${d.because ? `: ${d.because.replace(/\s+/g, " ")}` : ""}`,
        })),
      };
    const openCase = (asRule.rule.outcomes ?? []).find(
      (o) => o.standing && o.standing.kind !== "stated" && o.standing.kind !== "out_of_scope"
    );
    if (openCase)
      return {
        ok: false,
        blocking: [
          {
            slot: asRule.rule.fills[0]!,
            kind: `${openCase.standing!.kind} — shared case`,
            says: `"${openCase.name}" is not ruled, and it reaches every exchange this rule touches`,
          },
        ],
      };
    return k === "stated"
      ? { ok: true, blocking: [] }
      : {
          ok: false,
          blocking: [
            {
              slot: asRule.rule.fills[0]!,
              kind: `${k} — org-wide`,
              says: asRule.rule.standing?.question ?? "nobody has decided what this rule says",
            },
          ],
        };
  }
  const [scopeId, exId] = ref.split("#");
  const scope = corpus.scopes.find((s) => s.scope.id === scopeId)?.scope;
  const ex = scope?.exchanges.find((e) => e.id === exId);
  if (!scope || !ex) return null;
  const { inherited, constrained } = resolveRules(corpus);
  const disputes = disputeIndex(corpus);
  const blocking: GateResult["blocking"] = [];
  for (const slot of SLOTS) {
    const fill = ex.slots[slot];
    const inh = inherited.get(`${ref}#${slot}`);
    /**
     * ⛔ A RULE'S NAMED CASES ANSWER `refuses`, and this clause existed in `check.ts` and not
     * here — so the two disagreed and **two of the five exchanges in the shipped seed were
     * permanently un-acceptable**: the grid read `↑+R3`, `check` was silent, `acts` gated them
     * with zero rulings owed, `accept` refused with `refuses blank — nothing says what this
     * is` and sent the reviewer to `decide`, which never mentioned the exchange at all.
     *
     * One predicate was the whole point of extracting `gateFor`. Missing a clause in it is the
     * same failure in a quieter form.
     */
    if (
      !fill &&
      !inh &&
      slot === "refuses" &&
      (constrained.get(`${ref}#${slot}`) ?? []).some((r) => (r.outcomes ?? []).length)
    )
      continue;
    if (!fill && !inh) {
      blocking.push({ slot, kind: "blank", says: "nothing says what this is" });
      continue;
    }
    // ⛔ Named in someone else's dispute counts, even when this slot reads settled —
    // otherwise the far side of a contradiction is acceptable and the near side is not.
    const namedIn = (disputes.get(`${ref}#${slot}`) ?? []).filter((d) => d.from !== `${ref}#${slot}`);
    if (namedIn.length)
      blocking.push({ slot, kind: "contradicted", says: `${namedIn[0]!.from} says it cannot hold with this` });
    if (!fill) continue;
    // ⛔ A named case nobody has ruled blocks acceptance exactly as a slot-level standing
    // does. Otherwise recording the unruled thing precisely is how you get it past the gate.
    for (const o of fill.outcomes ?? []) {
      const ok = o.standing?.kind ?? "stated";
      if (ok === "stated" || ok === "out_of_scope") continue;
      blocking.push({
        slot,
        kind: `${ok} case`,
        says: `"${o.name}" is not ruled: ${o.standing?.about ?? o.when}`,
      });
    }
    const k = fill.standing.kind;
    if (k === "stated" || k === "out_of_scope") continue;
    blocking.push({
      slot,
      kind: k,
      says:
        k === "open"
          ? (fill.standing.question ?? "an unanswered question")
          : `disputed with ${(fill.standing.targets ?? []).join(", ")}`,
    });
  }
  return { ok: blocking.length === 0, blocking };
}

export function actsFor(corpus: Corpus): ActCount {
  const { inherited, reach } = resolveRules(corpus);
  const acceptable: string[] = [];
  const behaviours: string[] = [];
  const gated: string[] = [];
  const rulings: ActCount["rulings"] = [];
  const deferred: ActCount["deferred"] = [];
  // ⛔ One question, one implementation. See stamp.ts.
  const isAccepted = (target: string) => stampFor(corpus, target).state === "accepted";
  const stale: ActCount["stale"] = [];
  /**
   * ⛔ Deferral silences the ASK and nothing else.
   *
   * A deferred slot is still unsettled, so `settled` below is unaffected and the exchange
   * stays gated. The only thing that changes is that it leaves `rulings` — the list a
   * person is handed. Letting it touch the gate as well would turn "I will think about
   * this later" into "this is agreed", which is the single worst thing this schema could
   * be made to do.
   */
  const deferrals = new Map(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => [v.target!, v]));

  for (const { scope } of corpus.scopes) {
    for (const ex of scope.exchanges) {
      const ref = `${scope.id}#${ex.id}`;
      // ⛔ A withdrawn behaviour is in no queue at all — not offered for acceptance and not
      // owing a ruling. The finding's fix text claimed both and delivered neither.
      if (existsOf(corpus, scope.id, ex.exists) === "withdrawn") continue;
      let settled = true;
      for (const slot of SLOTS) {
        const fill = ex.slots[slot];
        const inh = inherited.get(`${ref}#${slot}`);
        if (!fill && !inh) {
          settled = false;
          continue;
        }
        if (!fill) continue;
        const k = fill.standing.kind;
        /**
         * ⛔ A SETTLED SENTENCE NOBODY HAS AGREED TO IS AN ACT SOMEBODY OWES.
         *
         * Counting only exchange-grained acceptances reported "0 acts now" over 47 written
         * sentences, because an exchange is gated until all eight of its slots are settled. The one
         * figure that says how much review is owed said none was.
         *
         * `out_of_scope` is excluded deliberately: latitude is already a recorded act, and asking
         * somebody to agree to "we deliberately do not answer this" would be asking them to stamp
         * their own waiver.
         */
        if (k === "stated") {
          const said = fill.says || fill.none || fill.cannot_fail || (fill.outcomes ?? []).length;
          if (said && !isAccepted(`${ref}#${slot}`)) behaviours.push(`${ref}#${slot}`);
        }
        if (k === "stated" || k === "out_of_scope") continue;
        settled = false;
        const slotRef = `${ref}#${slot}`;
        const put = deferrals.get(slotRef);
        if (put) {
          deferred.push({ where: slotRef, kind: k, because: put.because!, until: put.until!, by: put.by });
          continue;
        }
        rulings.push({
          where: slotRef,
          kind: k,
          owed: fill.standing.asked_of ?? "nobody named",
        });
      }
      /**
       * ⛔ ONE PREDICATE. `acts` computed its own `settled` flag and so offered exchanges
       * `accept` then refused — a dispute naming a slot made `gateFor` block while `settled`
       * stayed true, so the list said "ready to accept" and the command said no.
       *
       * A list that disagrees with the command behind it is worse than either alone: it
       * teaches a reviewer that the queue is approximate.
       */
      const gate = gateFor(corpus, ref);
      if (gate && !gate.ok) settled = false;
      const st = stampFor(corpus, ref);
      /**
       * ⛔ An ACCEPTED exchange that is no longer settled is the worst state available, and
       * it used to `continue` right here — before the gate was consulted — so it appeared
       * in neither bucket and no surface mentioned it again.
       *
       * It happens without anybody acting in bad faith: accept an exchange, then a later
       * ruling elsewhere opens one of its slots, or a dispute names it. The stamp is
       * current by content hash and the thing under it is not buildable.
       */
      if (st.state === "accepted") {
        if (!settled) stale.push({ where: ref, was: "unsettled-since-accepted", by: st.by, at: st.at });
        continue;
      }
      if (st.state !== "never") {
        // ⛔ A stale stamp is not an accepted thing and not an unaccepted one — it is a
        // thing that reads as reviewed and was not. It goes back in the queue, named.
        stale.push({ where: ref, was: st.state, by: st.by, at: st.at });
        continue;
      }
      // ⛔ THE GATE. An exchange with an unsettled slot is never offered for acceptance —
      // accepting a claim that is disputed or underdetermined stamps intent onto a
      // sentence with two meanings, which is worse than leaving it unstamped.
      (settled ? acceptable : gated).push(ref);
    }
  }
  return {
    acceptable,
    behaviours,
    gated,
    deferred,
    stale,
    rules: corpus.rules
      .filter((r) => {
        // ⛔ An open rule is not offered for acceptance — it is a question, and it appears
        // under rulings owed instead. Offering it let one stamp make the question vanish.
        const openCase = (r.rule.outcomes ?? []).find(
          (o) => o.standing && o.standing.kind !== "stated" && o.standing.kind !== "out_of_scope"
        );
        if (openCase) {
          // ⛔ A shared case nobody has ruled reaches every exchange the selector touches.
          rulings.push({
            where: `${r.rule.id}#${openCase.name}`,
            kind: `${openCase.standing!.kind} — shared case`,
            owed: openCase.standing!.asked_of ?? "nobody named",
          });
          return false;
        }
        if (r.rule.standing && r.rule.standing.kind !== "stated") {
          rulings.push({
            where: r.rule.id,
            kind: `${r.rule.standing.kind} — org-wide`,
            owed: r.rule.standing.asked_of ?? "nobody named",
          });
          return false;
        }
        const s = stampFor(corpus, r.rule.id);
        if (s.state !== "never" && s.state !== "accepted") stale.push({ where: r.rule.id, was: s.state, by: s.by, at: s.at });
        return s.state !== "accepted";
      })
      .map((r) => ({ id: r.rule.id, reaches: (reach.get(r.rule.id) ?? []).length }))
      .sort((a, b) => b.reaches - a.reaches),
    rulings,
  };
}
