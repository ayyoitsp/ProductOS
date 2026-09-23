/**
 * The execution packet — step 1 of the roadmap: product truth → something Claude builds from.
 *
 * ⛔ THE PACKET IS THE TEST OF TENET 2. "Sufficient to build from" stops being a judgement
 * call the moment a compiler has to emit one: either every required slot resolves, or the
 * packet has a hole in it and says so. That is why this is short — most of the work was
 * done by the grid refusing blanks.
 *
 * ⛔ It carries no stack, no patterns and no architecture. Those come from the repo. What
 * it does carry, which v1's could not: the LATITUDE, by declaration rather than by absence
 * — `refuses: none`, `cannot_fail`, `out_of_scope` are statements a builder can rely on,
 * where silence would have been something they had to guess about.
 */
import { SLOTS, type SlotName } from "./schema.js";
import { resolveRules, disputeIndex, vocabularyReach, resolveView, DOWNSTREAM_OF_ANSWER, answerIsUnknown, type Corpus } from "./load.js";
import { descendants } from "./settle.js";
import { existsOf } from "./load.js";
import { stampFor, staleReason } from "./stamp.js";


/**
 * One named refusal, and whether anybody has ruled on it.
 *
 * ⛔ An outcome whose own standing is unsettled must not render like a settled one. That is
 * the whole reason a refusal carries a standing: two of the spend form's three refusals are
 * agreed and one is a proposal, and a builder needs to be able to tell which is which.
 */
function outcomeLines(
  o: {
    name: string;
    when: string;
    told: string;
    standing?: { kind: string; about?: string; proposal?: string; question?: string };
  },
  shared = false
): string[] {
  const k = o.standing?.kind ?? "stated";
  const head = `    - refuses **${o.name}** when ${o.when} → ${o.told}${shared ? " *(shared)*" : ""}`;
  if (k === "stated") return [head];
  return [
    `${head}`,
    `        ⛔ **NOT RULED (${k}).** ${
      o.standing?.about ?? o.standing?.question ?? "nobody has decided this case"
    } Build the other cases; stop and ask about this one.`,
  ];
}

/**
 * ⛔ A PACKET COVERS THE SCOPE AND EVERYTHING FILED UNDER IT.
 *
 * `read money --buildable yes` validated the whole subtree and refused; `packet money`
 * stopped at one scope, so a child three levels down with an open question appeared nowhere
 * — under a heading reading "Everything below is what the product must do." `descendants()`
 * existed and this never called it.
 */
export function compilePacket(corpus: Corpus, scopeId: string): string | null {
  const under = descendants(corpus, scopeId);
  if (under.length > 1) {
    const body = under.map((id) => compileOne(corpus, id)).filter(Boolean) as string[];
    return body.length ? body.join("\n\n---\n\n") : null;
  }
  return compileOne(corpus, scopeId);
}

function compileOne(corpus: Corpus, scopeId: string): string | null {
  const entry = corpus.scopes.find((s) => s.scope.id === scopeId);
  if (!entry) return null;
  const { inherited, constrained } = resolveRules(corpus);
  /**
   * ⛔ The packet used to hardcode the words "accepted separately" onto every inherited and
   * every constraining line, without consulting anything. Run against a corpus with ZERO
   * verdicts it asserted six times that rules had been accepted, while `acts` in the same
   * breath reported all six as never stamped. A builder reads "accepted separately" as
   * human-validated truth — so the tool was printing the rubber stamp itself, in the one
   * artifact anybody builds from. Every claim of acceptance below now comes from `stampFor`.
   */
  const ruleStamp = (id: string) => {
    const s = stampFor(corpus, id);
    return s.state === "accepted"
      ? `accepted by ${s.by}`
      : s.state === "never"
        ? "⚠ NOT ACCEPTED BY ANYONE"
        : `⚠ accepted by ${s.by}, and CHANGED SINCE`;
  };
  const disputes = disputeIndex(corpus);
  const deferrals = new Map(corpus.verdicts.filter((v) => v.kind === "defer").map((v) => [v.target!, v]));
  const out: string[] = [];
  const holes: string[] = [];

  out.push(`# Packet — ${entry.scope.title}`);
  out.push("");
  /**
   * ⛔ At the very top, above everything a compiler computed.
   *
   * A human saying "I read this and could not build from it" is the one signal nothing can
   * derive, and it outranks every finding below it. The packet used to compile clean over
   * a scope somebody had declared unbuildable.
   */
  for (const v of corpus.verdicts) {
    if (v.kind !== "read" || v.scope !== scopeId || v.buildable !== false) continue;
    out.push(
      `> ⛔ **${v.by} read this end to end on ${v.at} and could not build from it.**` +
        (v.note ? ` "${v.note}"` : "") +
        (v.blocked_by.length ? ` Stopped by: ${v.blocked_by.join(", ")}.` : "")
    );
    out.push("> Nothing below outranks that. Find out what they hit before you start.");
    out.push("");
  }
  out.push("> Everything below is what the product must do. Nothing below is how to do it:");
  out.push("> no stack, no patterns, no file layout. Those are yours.");
  out.push("");

  if (entry.body) {
    /**
     * ⛔ FRAMING, AND LABELLED AS FRAMING.
     *
     * The scope's prose sat three lines under "Everything below is what the product must do",
     * which made an untyped, unstructured field part of the truth region. Five invented
     * behaviours prepended to it shipped above `accepted by peter` with zero findings, one
     * contradicting the accepted `refuses`. It is hashed now — so an edit breaks the stamp —
     * and it is fenced so a builder can tell orientation from obligation.
     */
    out.push("## Why this exists");
    out.push("");
    out.push("> Orientation, not obligation. Nothing here is a behaviour; every behaviour is a slot below.");
    out.push("");
    out.push(entry.body);
    out.push("");
  }

  if (entry.scope.depends_on.length) {
    // ⛔ What a builder is allowed to assume, and whose behaviour it is — stated rather than
    // left to be inferred from which pages happen to mention each other.
    out.push("## What this rests on, and does not itself behaviour");
    out.push("");
    for (const d of entry.scope.depends_on) {
      const dep = corpus.scopes.find((s) => s.scope.id === d);
      out.push(`- **${dep?.scope.title ?? d}** (\`${d}\`) — its behaviours are its own; do not re-decide them here`);
    }
    out.push("");
  }

  /**
   * ⛔ Observations reach the builder, separated from truth and labelled as observations.
   *
   * A `Reading` is explicitly never truth, which is why it took a while to notice it
   * reached no surface at all: an observation that nobody sees cannot inform anything, and
   * `readings/` stayed empty because the concept had no use rather than no need.
   */
  const readings = corpus.readings.filter((r) => (r.bears_on ?? "").startsWith(scopeId));
  if (readings.length) {
    out.push("## What has been observed");
    out.push("");
    out.push("> These are observations, not behaviours. They explain why the truth above is what it is.");
    out.push("> A builder may not implement one — if an observation matters, it belongs in a slot.");
    out.push("");
    for (const r of readings)
      out.push(
        `- *${r.basis.kind}*${r.basis.at ? ` ${r.basis.at}` : ""} — ${r.observes.replace(/\s+/g, " ").trim()}` +
          (r.basis.quote ? ` ("${r.basis.quote}")` : "")
      );
    out.push("");
  }

  /**
   * ⛔ EVERY WORD THIS SCOPE CAN SEE, not only the ones it declares itself.
   *
   * `packet money` defined none of its words — `kid`, `money`, `balance`, `parent` are all
   * declared on the parent scope — so the one artifact a builder works from had a glossary
   * heading and nothing under it, for a product whose terms are the whole subtlety.
   */
  const terms = Object.entries(
    Object.fromEntries(
      vocabularyReach(corpus, scopeId)
        .reverse()
        .flatMap((id) => Object.entries(corpus.scopes.find((s) => s.scope.id === id)?.scope.terms ?? {}))
    )
  );
  if (terms.length) {
    out.push("## Words, as this product uses them");
    out.push("");
    for (const [t, d] of terms) {
      out.push(
        `- **${t}** — ${d.means}${d.closed ? ` (only: ${(d.members ?? []).join(", ")})` : ""}` +
          (d.set_outside
            ? ` *(nothing in this product sets this — ${d.set_outside.because.replace(/\s+/g, " ").trim()})*`
            : "")
      );
    }
    out.push("");
  }

  /**
   * ⛔ THE SCREEN GOES IN THE PACKET.
   *
   * `packet` never touched `views`, `sketch` or `parts` — it printed `at.view · at.part` as
   * bare ids. So a builder received a form with three entry parts and no picture of it,
   * while a perfectly good sketch sat in the corpus reaching nobody. "No stack, no
   * patterns" is right and a sketch is neither: it is product truth about where the ask
   * arrives, and it is the thing the roadmap means by "tests, designs, etc".
   */
  /**
   * ⛔ A BORROWED SCREEN TRAVELS WITH THE PROMISE, AND AN ARRIVAL FROM ELSEWHERE IS NAMED ON THE
   * SCREEN'S OWN PACKET. This read `entry.scope.views` and nothing else, so a cross-scope `at:`
   * split one picture across two packets and neither half said so.
   *
   * On the pristine seed, pointing `money#see-a-balance` at `tasks`' task-row gave: money's packet
   * naming `task-list · task-row` with **no picture of it** — the sketch sat in the corpus reaching
   * nobody, which is the exact defect the ⛔ below was written for — and tasks' packet, the one a
   * builder implementing that screen receives, never mentioning that a money behaviour lands on its
   * row at all. Both halves passed every check.
   *
   * Views do not inherit and must not start to: a screen has one home. What travels is a copy for
   * reading, labelled as belonging elsewhere, so nobody edits it here.
   */
  const ownViews = entry.scope.views.filter((v) => v.exists !== "withdrawn");
  const borrowed: Array<{ from: string; view: (typeof ownViews)[number] }> = [];
  for (const ex of entry.scope.exchanges) {
    if (!ex.at?.view) continue;
    const r = resolveView(corpus, entry.scope, ex.at.view);
    if (!r || r.scope === scopeId) continue;
    if (borrowed.some((b) => b.view.id === r.view.id && b.from === r.scope)) continue;
    borrowed.push({ from: r.scope, view: r.view });
  }
  /** Behaviours filed in OTHER scopes that arrive on a screen this one owns. */
  const arrivals = new Map<string, string[]>();
  for (const { scope: other } of corpus.scopes) {
    if (other.id === scopeId) continue;
    for (const ex of other.exchanges) {
      if (!ex.at?.view) continue;
      const r = resolveView(corpus, other, ex.at.view);
      if (!r || r.scope !== scopeId) continue;
      const key = r.view.id;
      arrivals.set(key, [...(arrivals.get(key) ?? []), `${other.id}#${ex.id}${ex.at.part ? ` · ${ex.at.part}` : ""}`]);
    }
  }

  const walked = [...ownViews, ...borrowed.map((b) => b.view)];
  if (walked.length) {
    out.push("## Where these asks arrive");
    out.push("");
    for (const v of walked) {
      const lent = borrowed.find((b) => b.view.id === v.id);
      out.push(`### ${v.title}${v.view_kind ? ` *(${v.view_kind})*` : ""}`);
      if (lent)
        out.push(
          "",
          `> ⛔ This screen belongs to **${lent.from}**, not here. It is reproduced so the behaviour that arrives on it can be built — change it there, never here, or two packets will describe one screen differently.`
        );
      const here = arrivals.get(v.id) ?? [];
      if (here.length)
        out.push(
          "",
          `> ⛔ Behaviours from elsewhere arrive on this screen: ${here.map((x) => `\`${x}\``).join(", ")}. Building this screen without reading them ships a control that answers to nothing.`
        );
      if (v.exists === "intended") out.push("", "> ⛔ This screen does not exist yet. Everything here is intent, not observation.");
      if (!v.walked) out.push("", "> ⛔ Nobody has walked this screen. Treat what follows as incomplete.");
      if (v.sketch) {
        out.push("");
        out.push("```");
        out.push(v.sketch.trimEnd());
        out.push("```");
      }
      const parts = v.parts.filter((p) => !p.decorative);
      if (parts.length) {
        out.push("");
        for (const p of parts)
          out.push(
            `- **${p.label ?? p.id}** — ${p.role}${p.leads_to ? ` → ${p.leads_to}` : ""}`
          );
      }
      out.push("");
    }
  }

  for (const ex of entry.scope.exchanges) {
    // ⛔ A withdrawn behaviour is not handed to a builder as truth to build.
    if (existsOf(corpus, scopeId, ex.exists) === "withdrawn") continue;
    const ref = `${scopeId}#${ex.id}`;
    const st = stampFor(corpus, ref);
    const stamp =
      st.state === "accepted" ? `accepted by ${st.by} on ${st.at}` : st.state === "never" ? "NOT YET ACCEPTED" : "ACCEPTANCE IS STALE";
    out.push(`## ${ex.title}`);
    out.push("");
    // ⛔ `when` was hashed into the acceptance and printed nowhere, so a builder could not
    // tell a nightly job from a one-off backfill — which are two different programs.
    const arrives = ex.at
      ? ` at **${ex.at.view}**${ex.at.part ? ` · ${ex.at.part}` : ""}`
      : ex.when
        ? `, handed over by ${ex.when.triggered_by} (**${ex.when.cadence}**${ex.when.because ? `: ${ex.when.because}` : ""})`
        : "";
    out.push(`Asked by a ${ex.asked_by}${arrives}. **${stamp}.**`);
    if (st.state === "never") {
      out.push("");
      out.push(
        `> ⛔ No human has accepted this. Treat it as a proposal, not a constraint — a builder who cites it as agreed is citing something nobody agreed to.`
      );
    } else if (st.state !== "accepted") {
      out.push("");
      out.push(`> ⛔ **THE ACCEPTANCE IS STALE.** ${staleReason(st)}. Treat this as unaccepted.`);
    }
    out.push("");
    const answerUnsettled = answerIsUnknown(ex.slots.answer);
    for (const slot of SLOTS) {
      const fill = ex.slots[slot];
      const inh = inherited.get(`${ref}#${slot}`);
      const cons = constrained.get(`${ref}#${slot}`) ?? [];
      const label = `**${slot}**`;
      // ⛔ Emitted AFTER whatever the slot itself says, on its own line, every time. A
      // constraint the builder has to go and look up in a rule list is a constraint they
      // will not apply — the resolved packet is the entire point of compiling one.
      // ⛔ A `constrains` rule's named cases reach the builder. The mandate requiring them
      // was keyed to `supplies`, so the shared refusal vocabulary the schema made mandatory
      // arrived as a sentence promising named ways with none of them named.
      const alsoLines = cons.flatMap((r) => [
        `    - **and also** ${(r.statement ?? "").replace(/\s+/g, " ")} *(${r.id} — ${ruleStamp(r.id)})*`,
        ...(r.outcomes ?? []).map((o) => `        - refuses **${o.name}** when ${o.when} → ${o.told}`),
      ]);
      if (inh && (!fill || fill.standing.kind !== "stated")) {
        out.push(`- ${label} — ${(inh.statement ?? "").replace(/\s+/g, " ")} *(from ${inh.id} — ${ruleStamp(inh.id)})*`);
        /**
         * ⛔ A rule's NAMED CASES, which the mandate requiring them shipped without.
         *
         * `Rule.outcomes` became mandatory for a rule supplying `refuses` precisely because
         * prose there told a builder nothing implementable — and then no renderer printed
         * them, so the packet read *"it refuses in the same two named ways and in the same
         * words"* with the two named ways nowhere in it. The mandate made the hole
         * INVISIBLE, because an author who obeys the error believes the vocabulary arrived.
         */
        for (const o of inh.outcomes ?? []) out.push(...outcomeLines(o));
        out.push(...alsoLines);
        continue;
      }
      // ⛔ A slot answered only by a rule's named cases still reaches the builder as those
      // cases, not as a hole.
      const ruleCases = slot === "refuses" ? (cons.find((r) => (r.outcomes ?? []).length)?.outcomes ?? []) : [];
      if (!fill && !inh && ruleCases.length) {
        out.push(`- ${label} — the named cases below, and nothing else:`);
        for (const o of ruleCases) out.push(...outcomeLines(o, true));
        // ⛔ Without the rule's own outcome list, which is what was just printed as the answer.
        out.push(...alsoLines.filter((l) => !/^ {8}- refuses /.test(l)));
        continue;
      }
      if (!fill) {
        // ⛔ Must agree with `check` about what a hole is. You cannot say what an act
        // refuses or how a repeat behaves before anyone has ruled on what it DOES, so
        // reporting those as holes told the builder to go and get four answers when there
        // is one to get.
        if (answerUnsettled && DOWNSTREAM_OF_ANSWER.includes(slot)) {
          out.push(`- ${label} — follows from the answer above, which is not ruled yet. Not a hole; not yours to fill.`);
          out.push(...alsoLines);
          continue;
        }
        holes.push(`${ex.id}#${slot}`);
        out.push(`- ${label} — ⛔ **NOTHING SAYS THIS.** Do not invent it.`);
        out.push(...alsoLines);
        continue;
      }
      const k = fill.standing.kind;
      const namedIn = (disputes.get(`${ref}#${slot}`) ?? []).filter((d) => d.from !== `${ref}#${slot}`);
      // ⛔ Before anything else this slot might say. A builder must not receive one side of
      // a contradiction as buildable truth because the other side is the one that spoke.
      if (k !== "disputed" && namedIn.length) {
        holes.push(`${ex.id}#${slot}`);
        out.push(
          `- ${label} — ⛔ **CONTRADICTED.** ${namedIn[0]!.from} says it cannot hold with this: ${namedIn[0]!.because} ` +
            `Whatever this slot says below is one side of an unresolved contradiction. **Stop and ask.**`
        );
        if (fill.says) out.push(`    - it currently says: ${fill.says.replace(/\s+/g, " ").trim()}`);
        out.push(...alsoLines);
        continue;
      }
      if (k === "stated") {
        if (fill.none) out.push(`- ${label} — nothing to refuse. Stated, not omitted.`);
        else if (fill.cannot_fail) out.push(`- ${label} — cannot fail: ${fill.cannot_fail}`);
        // ⛔ A `refuses` slot carries its content in `outcomes`, not in `says`, so a bare
        // template printed the word "undefined" into the artifact a builder works from.
        else if (fill.says)
          out.push(
            `- ${label} — ${fill.says.replace(/\s+/g, " ").trim()}${fill.within ? ` *(within: ${fill.within.replace(/\s+/g, " ").trim()})*` : ""}`
          );
        else out.push(`- ${label} — the named cases below, and nothing else:`);
        /**
         * ⛔ THE SHARED CASES AND THIS SLOT'S OWN, TOGETHER.
         *
         * `refuses` resolved all-or-nothing, so "the shared refusal vocabulary plus one case
         * of my own" was unsayable — which is why the shipped seed hand-types `not-positive`
         * twice, as *"an amount earned is more than nothing"* and *"an amount spent is more
         * than nothing"*, under a rule whose statement behaviours they are identical, with
         * nothing comparing them.
         *
         * A local case of the same name wins, because the narrower sentence is the more
         * considered one — and `check` reports the divergence so it is a choice, not a drift.
         */
        const shared = (cons.find((r) => r.fills.includes(slot))?.outcomes ?? []).filter(
          (so) => !(fill.outcomes ?? []).some((lo) => lo.name === so.name)
        );
        for (const o of shared) out.push(...outcomeLines(o, true));
        for (const o of fill.outcomes ?? []) {
          out.push(...outcomeLines(o));
          // ⛔ An unruled case is a hole in the packet, and the banner counted only slots.
          const ok = o.standing?.kind ?? "stated";
          if (ok !== "stated" && ok !== "out_of_scope") holes.push(`${ex.id}#${slot}#${o.name}`);
        }
        out.push(...alsoLines);
      } else if (k === "out_of_scope") {
        out.push(
          `- ${label} — deliberately not answered here: ${fill.standing.because!.replace(/\s+/g, " ").trim()} ` +
            `*(${fill.standing.answered_by ?? "nobody recorded"}${fill.standing.answered_at ? `, ${fill.standing.answered_at}` : ""})*. ` +
            `**This is your latitude.**`
        );
        out.push(...alsoLines);
      } else {
        /**
         * ⛔ THE CONTENT IS PRINTED FIRST, THEN WHAT IS UNRULED ABOUT IT.
         *
         * This branch used to print only the standing, so a slot that stated what it does
         * AND carried one unruled question shipped as `⛔ UNSETTLED (proposed)` with the
         * authored sentence and every named refusal silently dropped — while the criteria
         * section below went on demonstrating behaviour the packet no longer stated.
         *
         * A standing annotates; it does not replace. The builder gets the settled part,
         * clearly marked as not yet accepted, and the unruled part named.
         */
        const stated: string[] = [];
        if (fill.says) stated.push(fill.says.replace(/\s+/g, " ").trim());
        if (fill.none) stated.push("nothing to refuse. Stated, not omitted.");
        if (fill.cannot_fail) stated.push(`cannot fail: ${fill.cannot_fail}`);
        if (stated.length) {
          out.push(`- ${label} — ${stated.join(" ")}`);
          for (const o of fill.outcomes ?? []) out.push(...outcomeLines(o));
          out.push(
            `    - ⛔ **and one thing about this is not ruled (${k}):** ${
              fill.standing.about ?? "unstated"
            } — **do not decide it for us.**`
          );
          out.push(...alsoLines);
          holes.push(`${ex.id}#${slot} (part)`);
          continue;
        }
        if ((fill.outcomes ?? []).length) {
          out.push(`- ${label} — the named cases below, and nothing else:`);
          for (const o of fill.outcomes ?? []) out.push(...outcomeLines(o));
          out.push(
            `    - ⛔ **and one thing about this is not ruled (${k}):** ${
              fill.standing.about ?? "unstated"
            } — **do not decide it for us.**`
          );
          out.push(...alsoLines);
          holes.push(`${ex.id}#${slot} (part)`);
          continue;
        }
        holes.push(`${ex.id}#${slot}`);
        const put = deferrals.get(`${ref}#${slot}`);
        // ⛔ A parked question is still a hole in the packet. What changes is that the
        // builder is told a person already looked and chose to wait — so the useful move
        // is to build around it, not to go and ask again.
        if (put) {
          out.push(
            `- ${label} — ⛔ **UNSETTLED (${k}), AND PARKED** by ${put.by}: ${put.because} ` +
              `*(comes back when: ${put.until})*. Do not invent an answer, and do not re-ask — build so this stays open.`
          );
          out.push(...alsoLines);
          continue;
        }
        out.push(
          `- ${label} — ⛔ **UNSETTLED (${k}).** ${
            k === "open"
              ? fill.standing.question
              : `disputed with ${(fill.standing.targets ?? []).join(", ")}`
          } **Stop and ask.**`
        );
        out.push(...alsoLines);
      }
    }
    const overrides = [
      ...ex.excepts.map((x) => ({ ...x, how: "does not apply here" })),
      ...SLOTS.flatMap((s) =>
        (ex.slots[s]?.instead_of ?? []).map((x) => ({ ...x, how: `is overridden at \`${s}\` by what this says` }))
      ),
    ];
    if (overrides.length) {
      out.push("");
      out.push("Org-wide rules that do NOT govern here, and why:");
      for (const x of overrides) out.push(`- ~~${x.rule}~~ ${x.how} — ${x.because.replace(/\s+/g, " ").trim()}`);
    }
    // ⛔ The opposite declaration, and it has to read as the opposite. A builder who sees a
    // local sentence and an org rule about the same slot needs to know whether the rule was
    // set aside or is still binding.
    const held = SLOTS.flatMap((s) =>
      (ex.slots[s]?.defers_to ?? []).map((x) => ({ ...x, slot: s }))
    );
    if (held.length) {
      out.push("");
      out.push("Org-wide rules that DO still govern here, alongside what this says:");
      for (const x of held)
        out.push(`- **${x.rule}** still holds at \`${x.slot}\` — ${x.because.replace(/\s+/g, " ").trim()}`);
    }
    /**
     * ⛔ What this ask sets off, printed on the ask that sets it off.
     *
     * The relation existed in prose on the follower only, so an author writing the triggering
     * exchange never saw the sentence that runs after theirs — which is how one event ended up
     * with two flatly opposite answers in two products.
     */
    const setsOff = corpus.scopes.flatMap((s) =>
      s.scope.exchanges
        .filter((x) => x.when?.follows === ref || x.when?.follows?.startsWith(`${ref}#`))
        .map((x) => ({ id: `${s.scope.id}#${x.id}`, title: x.title, says: x.slots.answer?.says }))
    );
    if (setsOff.length) {
      out.push("");
      out.push("What this sets off, which must agree with what it says above:");
      for (const s of setsOff)
        out.push(`- **${s.title}** (\`${s.id}\`) — ${(s.says ?? "nothing stated").replace(/\s+/g, " ").trim()}`);
    }
    const cs = ex.criteria;
    if (cs.length) {
      out.push("");
      out.push("What must be demonstrated:");
      for (const c of cs) {
        const bits = [c.given && `given ${c.given}`, c.when && `when ${c.when}`, c.then && `then ${c.then}`]
          .filter(Boolean)
          .join(", ");
        out.push(
          `- *${c.slot}*${c.level ? ` \`${c.level}\`` : ""} — ${bits || c.steps}${c.example ? " *(an example, not the rule)*" : ""}`
        );
      }
    }
    out.push("");
  }

  if (holes.length) {
    out.unshift("");
    out.unshift(
      `> ⛔ **This packet has ${holes.length} hole${holes.length === 1 ? "" : "s"}: ${holes.join(", ")}.** ` +
        `A builder who fills one has invented product truth. Settle them first.`
    );
  }
  return out.join("\n");
}
