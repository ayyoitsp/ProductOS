import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { checkCorpus, summarise } from "../../v2/check.js";
import { loadCorpus } from "../../v2/load.js";
import { SLOTS, type SlotName } from "../../v2/schema.js";
import { gridFor, renderGridText, actsFor, gateFor } from "../../v2/grid.js";
import { compilePacket } from "../../v2/packet.js";

import { questionsFor, descendants } from "../../v2/settle.js";
import { perform, preview, optionText, VIA, type Via, type Outcome, type Refused } from "../../v2/acts.js";
import { HOW } from "../../v2/record.js";
import { renderScopePage, standalone } from "../../v2/page.js";
import { migrate } from "../../v2/migrate.js";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { readConfig } from "../../core/config.js";

/**
 * `productos v2 …` — the Exchange schema, as a parallel track.
 *
 * ⛔ Parallel on purpose. The point of building this is to compare it against the current
 * model, and ripping out something that works would make the comparison impossible and the
 * judgement unfalsifiable.
 *
 * `--at <dir>` everywhere, defaulting to `./v2`, because the reset loop needs to point a
 * run at a pristine copy without touching the original.
 */
/** Short form of what each slot asks, for the answering surface. */
const SLOT_ASKS_SHORT: Record<string, string> = {
  may: "who is permitted to ask",
  with: "what the asker brings",
  answer: "what it does",
  after: "what is different afterwards",
  refuses: "what it refuses, and what the asker is told",
  fails: "what the asker is left with when it cannot",
  again: "what happens when it is asked twice",
  at_once: "what happens when two ask at the same time",
};

/**
 * ⛔ NO ACT OF HUMAN JUDGEMENT IS RECORDED OVER A CORPUS THAT DID NOT LOAD.
 *
 * `corpus.broken` was read by `check` and by nothing else. So a single unparseable file — a
 * stray tab, an unquoted comma in a flow mapping, the two most common hand-edits there are —
 * left every other surface computing over a corpus missing part of itself, and `accept` and
 * `read` would write a person's name to "I read this and could build from it" over it. The
 * stamp is the one thing in the corpus nothing else can reconstruct, and it was the cheapest
 * thing to make false: break a file, stamp, fix the file, and the stamp reads current.
 *
 * Refused for every act that RECORDS, and for `packet`, which is what a builder is handed.
 * The reading surfaces warn instead, because looking at a partial corpus to find out what
 * broke is the reasonable next thing to do.
 */
const brokenLines = (corpus: { broken: Array<{ file: string; why: string }> }): string[] => [
  ...corpus.broken.map((b) => `    ${pc.yellow(b.file.split("/").pop() ?? b.file)} — ${b.why.split("\n")[0]}`),
];

const refuseIfBroken = (corpus: { broken: Array<{ file: string; why: string }> }, act: string): void => {
  if (!corpus.broken.length) return;
  const n = corpus.broken.length;
  console.error(
    pc.red("✗"),
    `${n} file${n === 1 ? "" : "s"} here would not load, so ${act} would stand over a corpus that is missing part of itself:`
  );
  for (const l of brokenLines(corpus)) console.error(l);
  console.error("");
  console.error(pc.dim("  nothing has been recorded — fix the file and run it again"));
  console.error(pc.dim("  productos v2 check"));
  process.exit(1);
};

const warnIfBroken = (corpus: { broken: Array<{ file: string; why: string }> }): void => {
  if (!corpus.broken.length) return;
  const n = corpus.broken.length;
  console.log(pc.yellow("→"), `${n} file${n === 1 ? "" : "s"} would not load — everything below is computed without ${n === 1 ? "it" : "them"}:`);
  for (const l of brokenLines(corpus)) console.log(l);
  console.log("");
};

export function v2Command(): Command {
  const cmd = new Command("v2").description("The Exchange schema (parallel track) — check · grid · acts · packet · reset");
  const at = (o: { at?: string }) => path.resolve(o.at ?? "v2");

  cmd
    .command("check")
    .description("What this corpus refuses, and what it merely notes")
    .option("--at <dir>", "corpus directory", "v2")
    .action((o: { at?: string }) => {
      const { corpus, findings } = checkCorpus(at(o));
      const s = summarise(findings);
      const ex = corpus.scopes.reduce((n, x) => n + x.scope.exchanges.length, 0);
      console.log(
        pc.dim(`${corpus.scopes.length} scopes · ${ex} exchanges · ${corpus.rules.length} rules · ${corpus.readings.length} readings · ${corpus.verdicts.length} verdicts`)
      );
      const group = (sev: "refuse" | "note" | "shape", title: string, col: (x: string) => string) => {
        const list = findings.filter((f) => f.severity === sev);
        if (!list.length) return;
        console.log("");
        console.log(col(`${list.length} ${title}`));
        for (const f of list) {
          console.log(`  ${col(sev === "refuse" ? "✗" : "→")} ${pc.cyan(f.where)} ${pc.dim(f.kind)}`);
          console.log(`    ${f.what}`);
          if (f.fix) console.log(pc.dim(`    ${f.fix}`));
        }
      };
      group("refuse", "refused — this corpus must not be handed over", pc.red);
      group("note", "worth a person's attention", pc.yellow);
      group("shape", "the shape of the whole, which no page can show", pc.cyan);
      if (s.refuse === 0 && s.note === 0) console.log(pc.green("\n✓ nothing refused, nothing noted"));
      if (s.refuse > 0) process.exitCode = 1;
    });

  cmd
    .command("grid")
    .description("The behaviours a scope states, and where each came from")
    .argument("[scope]", "scope id; omit to show every scope")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string | undefined, o: { at?: string }) => {
      const corpus = loadCorpus(at(o));
      warnIfBroken(corpus);
      /**
       * ⛔ DESCENDS, like `decide`, `read` and `packet` already do.
       *
       * `grid checkout` printed `1 exchange · 0 blank` for a container with three scopes
       * beneath it — and the grid is the primary review surface, so it was the one place
       * nesting stopped.
       */
      const ids = scope
        ? descendants(corpus, scope).filter((id) =>
            corpus.scopes.some((s) => s.scope.id === id && s.scope.exchanges.length)
          )
        : corpus.scopes.filter((s) => s.scope.exchanges.length).map((s) => s.scope.id);
      for (const id of ids) {
        // ⛔ A container rendered an empty table reporting `0 exchanges · 0 slots · 0 blank`,
        // which reads as a finished product with nothing wrong with it.
        const s = corpus.scopes.find((x) => x.scope.id === id)?.scope;
        const kids = corpus.scopes.filter((x) => x.scope.in === id);
        if (s && !s.exchanges.length && kids.length && ids.length === 1) {
          console.log("");
          console.log(
            `${s.title} — ${pc.dim(`behaviours nothing itself; it contains ${kids.map((k) => k.scope.id).join(", ")}`)}`
          );
          continue;
        }
        const g = gridFor(corpus, id);
        if (!g) {
          console.error(pc.red("✗"), `no scope "${id}"`);
          process.exitCode = 1;
          continue;
        }
        console.log("");
        console.log(renderGridText(g, (s) => pc.red(s)));
      }
    });

  cmd
    .command("acts")
    .description("How many acts of human judgement this corpus demands, and which are gated")
    .option("--at <dir>", "corpus directory", "v2")
    .action((o: { at?: string }) => {
      const corpus = loadCorpus(at(o));
      warnIfBroken(corpus);
      const a = actsFor(corpus);
      // ⛔ From `SLOTS`, not a literal. A hardcoded 7 here would have under-reported the corpus by one
      // slot per exchange the day an eighth was added, and the count is the mechanism.
      const slots = corpus.scopes.reduce((n, s) => n + s.scope.exchanges.length * SLOTS.length, 0);
      const criteria = corpus.scopes.reduce(
        (n, s) => n + s.scope.exchanges.reduce((m, e) => m + e.criteria.length, 0),
        0
      );
      console.log(pc.bold("What a person is asked to do"));
      console.log(`  ${pc.green(String(a.acceptable.length))} exchanges ready to accept`);
      // ⛔ The NAMES, not the count. `actsFor` computed the list and the CLI threw it away,
      // so a reviewer was told "150 exchanges ready to accept" with no way to find one.
      for (const ref of a.acceptable) console.log(`      ${pc.dim("·")} ${pc.cyan(ref)}`);
      console.log(`  ${pc.green(String(a.rules.length))} rules ready to accept`);
      console.log(`  ${pc.yellow(String(a.rulings.length))} rulings owed — only a person can move these`);
      console.log(
        `  ${pc.dim(String(a.gated.length))} exchanges gated ${pc.dim("(an unsettled slot — never offered, because accepting it would stamp intent onto something unsettled)")}`
      );
      if (a.deferred.length)
        console.log(
          `  ${pc.dim(String(a.deferred.length))} parked ${pc.dim("— read by a person and postponed. Not asked again, and not buildable either")}`
        );
      const acts = a.acceptable.length + a.rules.length + a.rulings.length;
      console.log("");
      console.log(
        `  ${pc.bold(String(acts))} acts now, against ${slots} slots and ${criteria} criteria in the corpus`
      );
      if (a.stale.length) {
        console.log("");
        console.log(pc.red(pc.bold("Accepted, and changed since — these read as reviewed and are not")));
        for (const s of a.stale)
          console.log(`  ${pc.red(s.was.padEnd(16))} ${pc.cyan(s.where)} ${pc.dim(`stamped by ${s.by} on ${s.at}`)}`);
      }
      /**
       * ⛔ HOW EACH STAMP WAS OBTAINED, because a stamp is a claim that a person agreed and
       * how they were asked is part of what it is worth. Without this a reader has to assume
       * the strongest reading of the weakest surface — which is the whole reason `via` exists
       * rather than the acts simply being callable from more places.
       */
      const stamped = corpus.verdicts.filter((v) => v.kind === "accept" || v.kind === "read");
      if (stamped.length) {
        console.log("");
        console.log(pc.bold("How this corpus was validated"));
        const byVia = new Map<string, number>();
        for (const v of stamped) byVia.set(v.via, (byVia.get(v.via) ?? 0) + 1);
        for (const [via, n] of [...byVia].sort((x, y) => y[1] - x[1]))
          console.log(`  ${String(n).padStart(3)}  ${pc.dim(HOW[via as keyof typeof HOW] ?? via)}`);
      }
      if (a.rules.length) {
        console.log("");
        console.log(pc.bold("Rules, by how far one accept reaches"));
        for (const r of a.rules) {
          const warn = r.reaches >= 15 ? pc.red(" ← longest reach; read its criteria closely") : "";
          console.log(`  ${String(r.reaches).padStart(3)} exchanges  ${pc.cyan(r.id)}${warn}`);
        }
      }
      if (a.rulings.length) {
        console.log("");
        console.log(pc.bold("Rulings owed"));
        for (const r of a.rulings) console.log(`  ${pc.yellow(r.kind.padEnd(16))} ${pc.cyan(r.where)} ${pc.dim(r.owed)}`);
      }
      if (a.deferred.length) {
        console.log("");
        console.log(pc.bold("Parked, and what brings each back"));
        for (const d of a.deferred) {
          console.log(`  ${pc.dim(d.kind.padEnd(16))} ${pc.cyan(d.where)} ${pc.dim(`— ${d.by}`)}`);
          console.log(`  ${"".padEnd(16)} ${d.because}`);
          console.log(`  ${"".padEnd(16)} ${pc.dim(`back when: ${d.until}`)}`);
        }
      }
    });

  cmd
    .command("packet")
    .description("Compile the execution packet for one scope — step 1 of the roadmap")
    .argument("<scope>")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: { at?: string }) => {
      const corpus = loadCorpus(at(o));
      refuseIfBroken(corpus, "a packet handed to a builder");
      // ⛔ A container compiles a packet with a glossary and no behaviours, which reads as a
      // finished specification for a thing that has none. Say so before printing it.
      const kids = corpus.scopes.filter((s) => s.scope.in === scope);
      const mine = corpus.scopes.find((s) => s.scope.id === scope)?.scope.exchanges.length ?? 0;
      if (!mine && kids.length)
        console.log(
          pc.yellow("→"),
          pc.dim(
            `${scope} behaviours nothing itself — it contains ${kids.map((k) => k.scope.id).join(", ")}. Compile one of those.`
          ),
          "\n"
        );
      const p = compilePacket(corpus, scope);
      if (!p) {
        console.error(pc.red("✗"), `no scope "${scope}"`);
        process.exitCode = 1;
        return;
      }
      console.log(p);
    });

  /**
   * ⛔ WHERE THE LINE IS NOW, AND WHY IT MOVED.
   *
   * It used to be: *the CLI is the human's surface, and the MCP surface must never expose any
   * of the five acts, because MCP is what a model reaches for unprompted.* That was checked by
   * a test rather than a comment, because a comment had already failed there once.
   *
   * It was opened deliberately. A person answering in conversation, or pressing a button on a
   * rendered page, is the review loop Peter asked for, and neither can happen if only a CLI
   * can record. So this command group is no longer the human's surface at all — **it is the
   * machine interface, and a person should never be handed a flag.** The surfaces a person
   * meets are the rendered page and the question interface.
   *
   * What replaces the old guarantee: every act records `via` — which surface obtained the
   * consent — so a corpus can be read for the quality of its validation and not only for its
   * presence. Weaker than "impossible", and the trade is recorded rather than implied.
   *
   * `by` is still recorded and still NOT authentication. Nothing here can verify who ran it,
   * which is why every surface prints the name attached to a stamp rather than the word
   * "accepted" alone, and why `check` refuses a stamp whose content moved — the only defence
   * that does not depend on trusting the caller.
   */
  const consentFrom = (o: { by: string; via?: string }) => {
    const via = (o.via ?? "cli") as Via;
    if (!VIA.includes(via)) {
      console.error(pc.red("✗"), `"${o.via}" is not a way consent could have been obtained`);
      console.error(pc.dim(`    one of: ${VIA.join(" · ")}`));
      process.exit(1);
    }
    return { by: o.by, via };
  };

  /**
   * The flags an offered act needs, so a printed remedy is runnable.
   *
   * ⛔ RUNNABLE, BECAUSE THE UNRUNNABLE ONES WERE THE DEAD ENDS. Twice, a refusal printed a
   * command the tool then refused: once a `--defers-to` remedy that failed the "nothing to rule
   * on" gate, once `example: true` which does not parse and takes the whole corpus down. A
   * remedy nobody can run leaves hand-editing YAML as the only exit, which is the path `waive`
   * exists to take away.
   */
  const OWES: Record<string, string> = {
    rule: ' --says "…" --because "…"',
    waive: ' --because "…"',
    defer: ' --because "…" --until "…"',
    read: " --buildable no",
    accept: "",
    decide: "",
  };

  /** ⛔ One printer, so a refusal cannot be reported as a success on one command out of five. */
  const report = (r: Outcome | Refused): void => {
    if (!r.ok) {
      console.error(pc.red("✗"), r.why);
      for (const d of r.detail) console.error(pc.dim(`    ${d}`));
      if (r.instead?.length) {
        console.error("");
        for (const i of r.instead) {
          console.error(pc.dim(`    ${i.why}:`));
          const by = i.act === "decide" ? "" : " --by <you>";
          console.error(pc.dim(`      productos v2 ${i.act} ${i.ref}${OWES[i.act] ?? ""}${by}`));
        }
      }
      process.exit(1);
    }
    console.log(pc.green("✓"), r.said);
    for (const d of r.detail) console.log(pc.dim(`  ${d}`));
  };

  cmd
    .command("accept")
    .description("Record that you have read one exchange or one rule and agree to it")
    .argument("<target>", "scope#exchange, or a rule id")
    .requiredOption("--by <who>", "who is accepting")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--at <dir>", "corpus directory", "v2")
    .action((target: string, o: { by: string; via?: string; at?: string }) => {
      const dir = at(o);
      /**
       * ⛔ THE SENTENCES, NOT THEIR PROVENANCE, AND BEFORE THE WRITE.
       *
       * It printed `· may: stated here` — the shape of the slot, not what it says. So a
       * reviewer consented to a sentence while being shown three words that told them nothing.
       * And it printed in the same breath as writing, which a reviewer named: *"there is no
       * point at which a person can decline."* `preview` is now a separate call, so a page can
       * show this before a button exists and a question can carry it in the choice itself.
       */
      const shown = preview(dir, "accept", { target });
      if (!shown.ok) return report(shown);
      console.log(pc.bold(`You are accepting ${target}. Read what you are agreeing to:`));
      console.log("");
      for (const l of shown.reads) console.log(`  ${l}`);
      console.log("");
      report(perform(dir, "accept", { target }, consentFrom(o)));
    });

  cmd
    .command("decide")
    .description("Work one scope's open questions, with what you need to answer each")
    .argument("<scope>")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: { at?: string }) => {
      const corpus = loadCorpus(at(o));
      warnIfBroken(corpus);
      if (!corpus.scopes.some((s) => s.scope.id === scope)) {
        console.error(pc.red("✗"), `no scope "${scope}"`);
        process.exit(1);
      }
      const qs = questionsFor(corpus, scope);
      const live = qs.filter((q) => !q.parked);
      if (!qs.length) {
        console.log(pc.green("✓"), `nothing undecided in ${scope}`);
        return;
      }
      console.log(
        pc.bold(`${live.length} question${live.length === 1 ? "" : "s"} in ${scope}`) +
          (qs.length > live.length ? pc.dim(` · ${qs.length - live.length} parked`) : "")
      );
      for (const q of live) {
        console.log("");
        console.log(`${pc.cyan(q.ref)}  ${pc.dim(q.kind)}`);
        console.log(
          pc.dim(`  on: ${q.exchangeTitle} — ${SLOT_ASKS_SHORT[q.slot]}${q.scope !== scope ? `  (in ${q.scope})` : ""}`)
        );
        console.log("");
        for (const line of q.asks.split("\n")) console.log(`  ${line}`);
        if (q.cost) {
          console.log("");
          console.log(`  ${pc.yellow("what guessing wrong costs:")} ${q.cost.replace(/\s+/g, " ")}`);
        }
        if (q.blocks.length) console.log(`  ${pc.yellow("waiting on this:")} ${q.blocks.join(", ")}`);
        /**
         * ⛔ THE COMMAND PRINTED HERE MUST BE ONE THE TOOL ACCEPTS.
         *
         * All three of the seed's questions printed a command `rule` then refused: `--pick`
         * on a slot with a residual, `--pick` on a disputed slot wanting `--stands`, and a
         * bare open question whose only offer was "ask for candidates to be drafted" with no
         * command that drafts any. A surface that recommends what the tool rejects teaches a
         * reviewer that the queue is decorative, and it does it on the first thing they try.
         */
        if (q.observed.length) {
          console.log("");
          console.log("  What has been observed about this:");
          for (const o of q.observed)
            console.log(`    · ${o.says.replace(/\s+/g, " ").trim()} ${pc.dim(`(${o.basis}${o.at ? `, ${o.at}` : ""})`)}`);
        }
        if (q.conflictsWith.length) {
          console.log("");
          console.log(`  ${pc.red("Cannot hold with:")} ${q.conflictsWith.join(", ")}`);
        }
        if (q.revises) {
          console.log("");
          console.log("  This already says:");
          console.log(`    ${q.revises.replace(/\s+/g, " ").trim()}`);
          if (q.candidates.length) {
            console.log("");
            console.log("  Proposed for the unruled part:");
            q.candidates.forEach((c, i) => {
              console.log(`    ${pc.bold(`${i + 1}.`)} ${optionText(c)}`);
              if (c.consequence) console.log(`       ${pc.dim(`→ ${c.consequence.replace(/\s+/g, " ")}`)}`);
            });
          }
          console.log("");
          if (q.candidatesAreWhole) {
            // ⛔ Each option IS the whole replacement sentence, so one action records the
            // choice — which is what the requirement asks for and what the fragment case
            // could not give.
            console.log(pc.dim("  each option above is the whole sentence, so picking one replaces it cleanly:"));
            console.log(pc.dim(`    productos v2 rule ${q.ref} --pick N --because "…" --by <your name>`));
            console.log(pc.dim(`    or instead: productos v2 rule ${q.ref} --says "…" --because "…" --by <your name>`));
          } else {
            console.log(pc.dim("  the options above answer only the unruled part, and a ruling here becomes the"));
            console.log(pc.dim("  whole sentence — so write the one you want, keeping what is already agreed:"));
            console.log(
              pc.dim(`    productos v2 rule ${q.ref} --says "…the whole sentence…" --because "…" --by <your name>`)
            );
          }
        } else if (q.candidates.length) {
          console.log("");
          console.log(
            q.candidates.length === 1
              ? "  One answer has been proposed. Take it, or replace it:"
              : "  Answers on the table:"
          );
          q.candidates.forEach((c, i) => {
            console.log(`    ${pc.bold(`${i + 1}.`)} ${optionText(c)}`);
            if (c.consequence) console.log(`       ${pc.dim(`→ ${c.consequence.replace(/\s+/g, " ")}`)}`);
          });
          const stands = q.conflictsWith.length ? ` --stands this` : "";
          // ⛔ An org-wide ruling owes its demonstration in the same act, so the command
          // printed has to include it — otherwise the tool refuses what it recommended, which
          // is the failure this surface was rebuilt to remove.
          const then = q.needsThen ? ` --then "…what would show it holding…"` : "";
          const pol = q.asksPolarity ? ` --refuses yes|no` : "";
          console.log("");
          console.log(
            pc.dim(
              q.candidates.length === 1
                ? `  take it:    productos v2 rule ${q.ref} --pick 1${stands}${then}${pol} --because "…" --by <your name>`
                : `  pick one:   productos v2 rule ${q.ref} --pick N${stands}${then}${pol} --because "…" --by <your name>`
            )
          );
          console.log(pc.dim(`  or instead: productos v2 rule ${q.ref} --says "…"${stands}${then}${pol} --because "…" --by <your name>`));
        } else {
          console.log("");
          /**
           * ⛔ It used to say "ask for candidates to be drafted" and there are eleven commands,
           * none of which drafts. Drafting is authoring — it belongs to whoever writes the
           * corpus, which is the skill — so this now says where it comes from.
           */
          console.log(pc.red("  Nothing has been drafted for this, so there is nothing to choose between."));
          console.log(pc.dim("  drafting options is authoring, not an act — ask whoever is scoping this to add"));
          console.log(pc.dim("  `candidates` to the standing (the productos-exchange skill covers the shape), then"));
          console.log(pc.dim("  pick one. Composing product truth at a prompt is how a decision gets made by"));
          console.log(pc.dim("  whoever is tired."));
          const stands = q.conflictsWith.length ? ` --stands this` : "";
          const then = q.needsThen ? ` --then "…what would show it holding…"` : "";
          const pol = q.asksPolarity ? ` --refuses yes|no` : "";
          console.log(pc.dim(`  or answer it now: productos v2 rule ${q.ref} --says "…"${stands}${then}${pol} --because "…" --by <your name>`));
        }
        console.log(pc.dim(`  not now:    productos v2 defer ${q.ref} --because "…" --until "…" --by <your name>`));
      }
    });

  cmd
    .command("rule")
    .description("Settle an unsettled slot — the ruling, and why")
    .argument("<slot>", "scope#exchange#slot")
    .option("--says <sentence>", "what it is, now decided")
    .option("--pick <n>", "choose a drafted candidate by number instead of writing one")
    .requiredOption("--because <why>", "the reasoning, so it is not relitigated")
    .requiredOption("--by <who>", "who ruled")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--also-considered <what>", "what you rejected, and why it lost")
    .option("--defers-to <rule>", "an org-wide rule that still holds here, which your sentence narrows")
    .option("--instead-of <rule>", "an org-wide rule that does NOT hold here, which your sentence replaces")
    .option("--stands <which>", "for a disputed slot: this | the other | neither")
    .option("--then <what>", "for an org-wide rule: what would show it holding")
    .option("--refuses <yes|no>", "for a case asking `whether`: does it refuse at all? `no` retires the case")
    .option("--at <dir>", "corpus directory", "v2")
    .action((slot: string, o: Record<string, string | undefined> & { at?: string }) => {
      const dir = at(o as { at?: string });
      const r = perform(
        dir,
        "rule",
        {
          slot,
          says: o.says,
          pick: o.pick === undefined ? undefined : Number(o.pick),
          because: o.because!,
          alsoConsidered: o.alsoConsidered,
          defersTo: o.defersTo,
          insteadOf: o.insteadOf,
          stands: o.stands,
          then: o.then,
          refuses: o.refuses === undefined ? undefined : /^(y|yes|true)$/i.test(o.refuses),
        },
        consentFrom(o as { by: string; via?: string })
      );
      report(r);
      /**
       * ⛔ A ruling that displaces an org-wide rule has to say which way, and the remedy is
       * printed WITHOUT a sentence — a governance declaration needs none, so the remedy this
       * used to print failed the very gate whose ⛔ comment says the dead end was closed.
       */
      if (r.ok && r.displaced?.length) {
        console.log(pc.yellow("→"), `your sentence now answers where ${r.displaced.join(", ")} did. Say which it is:`);
        for (const id of r.displaced) {
          console.log(pc.dim(`    if that rule still holds and yours is narrower:`));
          console.log(pc.dim(`      productos v2 rule ${slot} --defers-to ${id} --because "…" --by ${o.by}`));
          console.log(pc.dim(`    if it does not hold here:`));
          console.log(pc.dim(`      productos v2 rule ${slot} --instead-of ${id} --because "…" --by ${o.by}`));
        }
      }
    });

  cmd
    .command("read")
    .description("Record that you read a scope end to end, and whether you could build from it")
    .argument("<scope>")
    .requiredOption("--by <who>")
    .requiredOption("--buildable <yes|no>")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--blocked-by <refs>", "comma-separated slot refs that stopped you")
    .option("--note <text>")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: Record<string, string | undefined> & { at?: string }) => {
      const dir = at(o as { at?: string });
      const buildable = /^(y|yes|true)$/i.test(o.buildable ?? "");
      report(
        perform(
          dir,
          "read",
          {
            scope,
            buildable,
            blockedBy: (o.blockedBy ?? "").split(",").map((x) => x.trim()).filter(Boolean),
            note: o.note,
          },
          consentFrom(o as { by: string; via?: string })
        )
      );
    });

  cmd
    .command("waive")
    .description("Declare that this is deliberately not answered here — the builder's latitude")
    .argument("<slot>", "scope#exchange#slot")
    .requiredOption("--because <why>", "why this is not ours to answer")
    .requiredOption("--by <who>", "who decided")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--at <dir>", "corpus directory", "v2")
    .action((slot: string, o: { because: string; by: string; via?: string; at?: string }) => {
      report(perform(at(o), "waive", { slot, because: o.because }, consentFrom(o)));
    });

  cmd
    .command("defer")
    .description("Park a question you have read and are not answering now")
    .argument("<slot>", "scope#exchange#slot")
    .requiredOption("--because <why>", "why not now")
    .requiredOption("--until <what>", "what brings it back — an event, not a date")
    .requiredOption("--by <who>", "who parked it")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--at <dir>", "corpus directory", "v2")
    .action((slot: string, o: { because: string; until: string; by: string; via?: string; at?: string }) => {
      report(perform(at(o), "defer", { slot, because: o.because, until: o.until }, consentFrom(o)));
    });

  cmd
    /**
     * ⛔ THE REVIEWER'S SURFACE, WHICH IS NOT THIS COMMAND.
     *
     * A page is produced here so it can be opened or embedded; the acts on it are performed by
     * a person pressing a button, not by flags. The flags on `rule`/`accept`/`read`/`waive`/
     * `defer` are a harness for verifying the model by running it, and they stay because a
     * test drives them — they are not the interface, and presenting them as one was a mistake.
     */
    .command("page")
    .description("Render one scope as a page a person can review — the acts, the grid, every behaviour")
    .argument("<scope>")
    .requiredOption("--out <file>", "where to write the HTML")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: { out: string; at?: string }) => {
      const corpus = loadCorpus(at(o));
      warnIfBroken(corpus);
      const page = renderScopePage(corpus, scope);
      if (!page) {
        console.error(pc.red("✗"), `no scope "${scope}"`);
        process.exit(1);
      }
      const entry = corpus.scopes.find((s) => s.scope.id === scope)!;
      fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
      fs.writeFileSync(path.resolve(o.out), standalone(entry.scope.title || scope, page));
      console.log(pc.green("✓"), `${o.out}`);
      console.log(pc.dim("  read-only — the acts are shown inert, because a button that records nothing is worse than none"));
    });

  cmd
    /**
     * ⛔ THE GATE IS HERE, NOT IN MY JUDGEMENT.
     *
     * Publishing is the only way a button inside Claude records anything — a strict CSP stops a
     * rendered page reaching localhost — so it is worth having. It also copies product truth to
     * claude.ai, and product truth routinely names a real client. That decision belongs to whoever
     * owns the corpus, and a protection that depends on an agent remembering to ask, every time,
     * under time pressure, is not a protection.
     */
    .command("publishable")
    .description("Emit the interactive page for publishing, if this corpus is allowed to be published")
    .argument("<scope>")
    .requiredOption("--by <who>", "the name a press will be recorded under")
    .option("--out <file>", "write the page here instead of stdout")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: { by: string; out?: string; at?: string }) => {
      const dir = at(o);
      let allowed = false;
      let where = "productos/config.yaml";
      try {
        /**
         * ⛔ RESOLVED FROM THE CORPUS, NOT FROM WHERE THE COMMAND WAS RUN.
         *
         * `resolvePathsOrThrow()` defaults to `process.cwd()`, so the permission came from whatever
         * project the shell happened to be in. Running this from the ProductOS checkout — which
         * allows publishing, because its only corpus is a fictional seed — would have published a
         * client's corpus on the seed's authority, and the refusal would never have fired.
         *
         * The gate's whole claim is that permission belongs to a corpus. Reading it from the cwd
         * attached it to a shell.
         */
        const paths = resolvePathsOrThrow(dir);
        where = paths.configFile;
        allowed = readConfig(paths).exchange.publish === "allow";
      } catch {
        allowed = false;
      }
      if (!allowed) {
        console.error(pc.red("✗"), "this corpus is not allowed to be published");
        console.error(pc.dim("  publishing copies the product truth to claude.ai, where it is out of your control."));
        console.error(pc.dim("  if that is fine for THIS corpus, say so and run it again:"));
        console.error(pc.dim(`      ${where}`));
        console.error(pc.dim(`      exchange:`));
        console.error(pc.dim(`        publish: allow`));
        console.error("");
        console.error(pc.dim("  the page served at /v2 needs no permission and never leaves this machine."));
        process.exit(1);
      }
      const corpus = loadCorpus(dir);
      refuseIfBroken(corpus, "a page anybody is asked to agree on");
      /**
       * ⛔ `records: "db"` — a published page's ONLY channel. Its presses land in the artifact's
       * own database and are turned into product truth by the same `perform` every other surface
       * uses; nothing about a press is truth until that happens.
       */
      const page = renderScopePage(corpus, scope, {
        interactive: true,
        records: "db",
        by: o.by,
        recordsTo: "read back from this page and written into the product truth",
      });
      if (!page) {
        console.error(pc.red("✗"), `no scope "${scope}"`);
        process.exit(1);
      }
      const entry = corpus.scopes.find((s) => s.scope.id === scope)!;
      /**
       * ⛔ NOT WRAPPED IN A DOCUMENT. The publishing surface supplies `<!doctype>`, `<html>`,
       * `<head>` and `<body>` itself and only wants the page content — a second skeleton nested
       * inside the first is invalid and renders unpredictably. `v2 page` is the wrapped one, for
       * opening a file directly.
       */
      const doc = `<title>${(entry.scope.title || scope).replace(/[<&]/g, "")}</title>\n${page}`;
      if (!o.out) {
        console.log(doc);
        return;
      }
      fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
      fs.writeFileSync(path.resolve(o.out), doc);
      console.log(pc.green("✓"), `${o.out}`);
      console.log(pc.dim("  publish it with capabilities {db:{}}; presses land in the artifact's database"));
      console.log(pc.dim(`  every press is recorded as ${o.by}, via: page`));
    });

  cmd
    /**
     * ⛔ CONVERTS WHAT v1 RECORDED, AND REFUSES THE REST BY NAME.
     *
     * v1 only ever recorded answers, so a mechanical fill of eight slots from one claim would
     * invent seven-eighths of a product's truth in bulk with nobody's name on it. What v1 had no
     * word for is written as the open question it actually is, and what cannot be carried honestly
     * lands in `not-carried.yaml` for a person.
     */
    .command("migrate")
    .description("Convert a v1 corpus into the Exchange model, carrying only what v1 recorded")
    .requiredOption("--from <dir>", "the v1 productos/ directory")
    .requiredOption("--out <dir>", "where to write the Exchange corpus")
    .option("--force", "overwrite an existing corpus at --out")
    .action((o: { from: string; out: string; force?: boolean }) => {
      const from = path.resolve(o.from);
      const out = path.resolve(o.out);
      if (!fs.existsSync(path.join(from, "products")) && !fs.existsSync(path.join(from, "capabilities"))) {
        console.error(pc.red("✗"), `no v1 corpus at ${o.from} — expected products/ or capabilities/ inside it`);
        process.exit(1);
      }
      // ⛔ Never over an existing corpus without being told. A migration is a bulk write, and the
      // thing it would overwrite may hold a person's verdicts, which nothing can reconstruct.
      if (fs.existsSync(path.join(out, "truth")) && !o.force) {
        console.error(pc.red("✗"), `${o.out} already holds a corpus`);
        console.error(pc.dim("  migrating over it would overwrite truth, and any verdicts beside it cannot be reconstructed"));
        console.error(pc.dim("  pass --force if that is what you want"));
        process.exit(1);
      }
      /**
       * ⛔ EVERYTHING THIS COMMAND WRITES, NOT JUST `truth/`.
       *
       * Clearing only truth left the previous run's `rules/` and `charter/` in place, so a
       * re-migration silently kept files the new run would never have produced. It is how seven
       * org-wide rules that had been deleted from the migrator went on governing a corpus through
       * two further runs — invisible, because nothing regenerates a file it no longer writes.
       *
       * ⛔ `verdicts/` IS NOT TOUCHED, EVER. A person's acts are the one thing in the corpus nothing
       * can reconstruct, and `--force` is about discarding derived output.
       */
      if (o.force) for (const d of ["truth", "rules", "charter"]) fs.rmSync(path.join(out, d), { recursive: true, force: true });
      const m = migrate(from, out, new Date().toISOString().slice(0, 10));
      const c = m.carried;
      console.log(pc.green("✓"), `${o.out}`);
      console.log(`  ${c.scopes} scopes · ${c.views} screens · ${c.exchanges} asks · ${c.criteria} criteria`);
      console.log("");
      /**
       * ⛔ THE MEASUREMENT, NOT A BACKLOG. This used to report seven org-wide questions it had
       * written itself, which read as "answer these and you are done" when what it meant was "one
       * slot in eight was ever recorded". The number is the finding.
       */
      console.log(pc.bold("  What v1 knew, against what this model asks"));
      const owed = c.exchanges * SLOTS.length;
      console.log(`    ${pc.green(String(c.answered))} of ${owed} slots carry a sentence v1 recorded`);
      console.log(
        `    ${pc.yellow(String(owed - c.answered))} say nothing ${pc.dim("— v1 had no field for them, so nobody ever wrote them down")}`
      );
      if (owed)
        console.log(
          pc.dim(`    that is ${Math.round((c.answered / owed) * 100)}% of this product written down, which is the measurement`)
        );
      console.log(
        pc.dim("    no questions were invented to stand in for the rest — a blank is what a blank is")
      );
      if (m.refused.length) {
        console.log("");
        console.log(pc.red(pc.bold(`  ${m.refused.length} things were NOT carried`)) + pc.dim(" — each needs a person, not a better script"));
        for (const r of m.refused.slice(0, 8)) console.log(`    ${pc.yellow(r.what)} — ${r.why}`);
        if (m.refused.length > 8) console.log(pc.dim(`    …and ${m.refused.length - 8} more`));
        console.log(pc.dim(`    all of them: ${path.relative(process.cwd(), path.join(out, "not-carried.yaml"))}`));
      }
      console.log("");
      console.log(pc.dim(`  productos v2 check --at ${o.out}`));
      console.log(pc.dim(`  productos serve --v2 ${o.out}   → review it at /v2`));
    });

  cmd
    .command("reset")
    .description("Restore a corpus from the pristine seed, so every run starts identical")
    .option("--at <dir>", "corpus directory to restore INTO", "v2")
    .option("--from <dir>", "the pristine seed", "v2-seed")
    .action((o: { at?: string; from?: string }) => {
      const dest = at(o);
      const src = path.resolve(o.from ?? "v2-seed");
      if (!fs.existsSync(src)) {
        console.error(pc.red("✗"), `no seed at ${src}`);
        process.exit(1);
      }
      // ⛔ Refuse to delete anything that is not recognisably a v2 corpus. A reset that can
      // be pointed at the wrong directory is a reset that eventually is.
      if (fs.existsSync(dest)) {
        const looksRight = ["truth", "rules"].every((d) => fs.existsSync(path.join(dest, d)));
        if (!looksRight) {
          console.error(pc.red("✗"), `${dest} exists and does not look like a v2 corpus — refusing to replace it`);
          console.error(pc.dim("  expected truth/ and rules/ inside it"));
          process.exit(1);
        }
        fs.rmSync(dest, { recursive: true, force: true });
      }
      fs.cpSync(src, dest, { recursive: true });
      const { corpus } = checkCorpus(dest);
      console.log(
        pc.green("✓"),
        `reset ${path.relative(process.cwd(), dest)} from ${path.relative(process.cwd(), src)} — ${corpus.scopes.length} scopes, ${corpus.rules.length} rules, ${corpus.verdicts.length} verdicts`
      );
    });

  return cmd;
}
