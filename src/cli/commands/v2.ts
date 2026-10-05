import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { checkCorpus, summarise } from "../../v2/check.js";
import { loadCorpus } from "../../v2/load.js";
import { SLOTS, SLOT_ASKS_SHORT, Steer, type SlotName, type View, statements } from "../../v2/schema.js";
import YAML from "yaml";
import { gridFor, renderGridText, actsFor, gateFor } from "../../v2/grid.js";
import { compilePacket } from "../../v2/packet.js";

import { questionsFor, descendants } from "../../v2/settle.js";
import { perform, preview, payloadFrom, optionText, VIA, type Act, type Via, type Outcome, type Refused } from "../../v2/acts.js";
import { fileNote, closeNote, replyToNote } from "../../v2/notes.js";
import { snapshotStyle, styleOf, styleDrift, styleAt, wearTheme } from "../../v2/appcss.js";
import { watchCorpus } from "../../v2/watch.js";
import { inbox } from "../../v2/inbox.js";
import { looksLikeInstance, instanceOf, mirror, act as remoteAct, note as remoteNote, inbox as remoteInbox, preview as remotePreview, whoami as remoteWhoami, presence as remotePresence } from "../../v2/client.js";
import { lineFor } from "../../v2/log.js";
import { drawFromRoute } from "../../v2/draw.js";
import { everyView, everyViewV1, isResolved, resolveRoute } from "../../v2/routes.js";
import { spokenFor } from "../../v2/spoken.js";
import { idiomOf, proposeScreen } from "../../v2/propose.js";
import { inEffect, readSteers, declined } from "../../v2/steers.js";
import { indexDesignSystem } from "../../v2/design.js";
import { inferConnections, type Connection } from "../../v2/connects.js";
import { writeLeadsTo } from "../../v2/draw-write.js";
import { AGENTS, AUTHORS, CASCADE, KINDS, SHIMS, SKILL, byDiscipline } from "../../core/jobs.js";

/** ⛔ Plain text for a terminal and for JSON — never HTML-escaped, which is the page's business. */
const plain = (x: unknown): string => String(x ?? "").replace(/\s+/g, " ").trim();
import { agentsDoc, withPreset } from "../../core/agents-doc.js";
import { readChanges, writeChange, nextId, verify, missing } from "../../core/change.js";
import { writeSketchHtml } from "../../v2/draw-write.js";
import { whatMoved, repoOf } from "../../v2/moved.js";
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
  /**
   * ⛔ THE CORPUS DIRECTORY, AND IT REFUSES RATHER THAN FALLING BACK.
   *
   * `--at` was silently dropped once — `notes add` declared it while its parent `notes` declared it
   * too, so commander banked the value on the parent and handed the child its default. A carry-in
   * meant for a work corpus was written into the seed working copy instead, and every message said
   * ✓. Nothing in the output distinguished that from success.
   *
   * A default that quietly points somewhere real is the dangerous kind: the write lands, the
   * report is green, and the corpus that was supposed to change did not. So the resolved directory
   * has to look like a corpus, and the refusal names both where it looked and where it was run
   * from — because the two differing is the whole failure.
   */
  /**
   * ⛔ AN INSTANCE URL HANDED TO A COMMAND THAT CANNOT SPEAK TO ONE IS REFUSED, NOT RESOLVED.
   *
   * `path.resolve("https://x.productos.dev/cre")` is a perfectly good directory name, so without
   * this a command would report "no corpus at /Users/…/https:/x.productos.dev/cre" — which reads as
   * a typo and sends somebody looking for a folder. Worse, on a machine that happened to have one,
   * it would quietly read the wrong corpus and report ✓.
   *
   * Refusing here means a command gets instance support by CALLING `openAt`, never by forgetting to.
   */
  const refuseUrl = (o: { at?: string }, verb: string) => {
    if (!looksLikeInstance(o.at)) return;
    console.error(pc.red("✗"), `${verb} works on a corpus you have, and ${o.at} is an instance`);
    console.error(pc.dim("  the truth is there, not here — and reading a local copy instead is how two"));
    console.error(pc.dim("  people agree to two different corpora and both see a tick"));
    console.error(pc.dim("  these speak to an instance: check · grid · acts · page · next · packet · inbox · notes · the five acts"));
    process.exit(1);
  };

  /**
   * A corpus to read, wherever it is.
   *
   * ⛔ A MIRROR IS A CACHE OF A READ, NOT A WORKING COPY. It goes to a scratch directory and is
   * thrown away; nothing writes back into it, because every act goes to the instance over HTTP.
   */
  const openAt = async (o: { at?: string; token?: string }): Promise<string> => {
    if (!looksLikeInstance(o.at)) return at(o);
    try {
      return await mirror(instanceOf(o.at!, o.token));
    } catch (e) {
      console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  };

  const at = (o: { at?: string }, mustExist = true) => {
    refuseUrl(o, "this");
    const dir = path.resolve(o.at ?? "v2");
    if (mustExist && !fs.existsSync(path.join(dir, "truth"))) {
      console.error(pc.red("✗"), `no corpus at ${dir}`);
      console.error(pc.dim(`  expected truth/ inside it. run from ${process.cwd()}`));
      console.error(pc.dim(`  point at one with --at <dir>`));
      process.exit(1);
    }
    return dir;
  };

  cmd
    .command("check")
    .description("What this corpus refuses, and what it merely notes")
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (o: { at?: string; token?: string }) => {
      const { corpus, findings } = checkCorpus(await openAt(o));
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
    .action(async (scope: string | undefined, o: { at?: string; token?: string }) => {
      const corpus = loadCorpus(await openAt(o));
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
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (o: { at?: string; token?: string }) => {
      const corpus = loadCorpus(await openAt(o));
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
      /**
       * ⛔ FIRST OF ALL, BECAUSE IT COMES FIRST. A feature whose purpose nobody has agreed offers
       * none of its behaviours — and reporting "0 behaviours to read" without saying why reads as
       * a finished corpus rather than as one waiting on the act that has to happen before any
       * other.
       */
      if (a.ungrounded.length) {
        console.log(
          `  ${pc.yellow(String(a.ungrounded.length))} feature${a.ungrounded.length === 1 ? "" : "s"} waiting on what ${
            a.ungrounded.length === 1 ? "it is" : "they are"
          } for ${pc.dim("— their behaviours are not offered until somebody agrees to that")}`
        );
        for (const u of a.ungrounded.slice(0, 6)) console.log(pc.dim(`      · ${u.scope} — ${u.why}`));
        if (a.ungrounded.length > 6) console.log(pc.dim(`      …and ${a.ungrounded.length - 6} more`));
        console.log(pc.dim(`      productos v2 accept "<feature>#happy-path" --by <who> --via <how>`));
      }
      /**
       * ⛔ FIRST, BECAUSE IT IS THE ONE THAT IS USUALLY OWED. Exchange- and rule-grained
       * acceptances are the wide stamps; a behaviour is the atom, and on any corpus that is not
       * finished it is where all the review actually is.
       */
      console.log(
        `  ${pc.green(String(a.behaviours.length))} behaviours to read ${pc.dim("— one sentence each, settled and not yet agreed to")}`
      );
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
    .action(async (scope: string, o: { at?: string; token?: string }) => {
      const corpus = loadCorpus(await openAt(o));
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
  /**
   * ⛔ RECORD IT WHERE THE TRUTH IS. A directory performs locally; an instance is POSTed to.
   *
   * One helper for all five acts, because the alternative is five places that each have to remember
   * the remote path exists — and the one that forgot would silently write a local file for a corpus
   * that lives somewhere else, which is the divergence this whole client is built to prevent.
   */
  const recordAt = async (
    o: { at?: string; token?: string; by: string; via?: string },
    action: Act,
    ref: string,
    wire: Record<string, unknown> = {}
  ): Promise<Outcome> => {
    const c = consentFrom(o);
    const done = (r: Outcome | Refused): Outcome => {
      // ⛔ `report` exits on a refusal, so anything after it is an act that landed.
      report(r);
      return r as Outcome;
    };
    if (!looksLikeInstance(o.at)) return done(perform(at(o), action, payloadFrom(action, ref, wire), c));
    try {
      return done((await remoteAct(instanceOf(o.at!, o.token), action, ref, c.via, { by: c.by, ...wire })) as Outcome | Refused);
    } catch (e) {
      console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  };

  /** What a press would cover, wherever the corpus is. ⛔ Shown before the write, never with it. */
  const previewAt = async (o: { at?: string; token?: string }, action: Act, ref: string, wire: Record<string, unknown> = {}) => {
    if (!looksLikeInstance(o.at)) return preview(at(o), action, payloadFrom(action, ref, wire));
    try {
      return (await remotePreview(instanceOf(o.at!, o.token), action, ref, wire)) as ReturnType<typeof preview>;
    } catch (e) {
      console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  };

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
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (target: string, o: { by: string; via?: string; at?: string; token?: string }) => {
      /**
       * ⛔ THE SENTENCES, NOT THEIR PROVENANCE, AND BEFORE THE WRITE.
       *
       * It printed `· may: stated here` — the shape of the slot, not what it says. So a
       * reviewer consented to a sentence while being shown three words that told them nothing.
       * And it printed in the same breath as writing, which a reviewer named: *"there is no
       * point at which a person can decline."* `preview` is now a separate call, so a page can
       * show this before a button exists and a question can carry it in the choice itself.
       */
      const shown = await previewAt(o, "accept", target);
      if (!shown.ok) return report(shown);
      console.log(pc.bold(`You are accepting ${target}. Read what you are agreeing to:`));
      console.log("");
      for (const l of shown.reads) console.log(`  ${l}`);
      console.log("");
      await recordAt(o, "accept", target);
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
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (slot: string, o: Record<string, string | undefined> & { at?: string; token?: string }) => {
      const r = await recordAt(o as never, "rule", slot, {
        says: o.says,
        pick: o.pick,
        because: o.because!,
        alsoConsidered: o.alsoConsidered,
        defersTo: o.defersTo,
        insteadOf: o.insteadOf,
        stands: o.stands,
        then: o.then,
        refuses: o.refuses === undefined ? undefined : /^(y|yes|true)$/i.test(o.refuses),
      });
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
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (scope: string, o: Record<string, string | undefined> & { at?: string; token?: string }) => {
      await recordAt(o as never, "read", scope, {
        buildable: /^(y|yes|true)$/i.test(o.buildable ?? ""),
        blockedBy: (o.blockedBy ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        note: o.note,
      });
    });

  cmd
    .command("waive")
    .description("Declare that this is deliberately not answered here — the builder's latitude")
    .argument("<slot>", "scope#exchange#slot")
    .requiredOption("--because <why>", "why this is not ours to answer")
    .requiredOption("--by <who>", "who decided")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (slot: string, o: { because: string; by: string; via?: string; at?: string; token?: string }) => {
      await recordAt(o, "waive", slot, { because: o.because });
    });

  cmd
    .command("defer")
    .description("Park a question you have read and are not answering now")
    .argument("<slot>", "scope#exchange#slot")
    .requiredOption("--because <why>", "why not now")
    .requiredOption("--until <what>", "what brings it back — an event, not a date")
    .requiredOption("--by <who>", "who parked it")
    .option("--via <how>", "how consent was obtained: page | question | chat | cli", "cli")
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .action(async (slot: string, o: { because: string; until: string; by: string; via?: string; at?: string; token?: string }) => {
      await recordAt(o, "defer", slot, { because: o.because, until: o.until });
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
    .action(async (scope: string, o: { out: string; at?: string; token?: string }) => {
      const dir = await openAt(o);
      const corpus = loadCorpus(dir);
      warnIfBroken(corpus);
      const page = renderScopePage(corpus, scope, styleOf(corpus));
      if (!page) {
        console.error(pc.red("✗"), `no scope "${scope}"`);
        process.exit(1);
      }
      const entry = corpus.scopes.find((s) => s.scope.id === scope)!;
      fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
      fs.writeFileSync(path.resolve(o.out), standalone(entry.scope.title || scope, page));
      console.log(pc.green("✓"), `${o.out}`);
      /**
       * ⛔ IT SAID THE OPPOSITE OF WHAT IT DID, in one sentence: "the acts are shown inert, because
       * a button that records nothing is worse than none". If an inert button is worse than none —
       * and this codebase says so repeatedly — then showing them inert is the thing the reason
       * forbids. The acts are omitted, which is what the second half was arguing for.
       */
      console.log(pc.dim("  read-only — no acts on it, because a button that records nothing is worse than none"));
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
    .option("--via-db", "record presses into the artifact's own database instead of calling ProductOS directly")
    .option("--at <dir>", "corpus directory", "v2")
    .action((scope: string, o: { by: string; out?: string; at?: string; viaDb?: boolean }) => {
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
      /**
       * ⛔ SAY WHAT THE PAGE IS WEARING, AND SAY WHEN IT IS WEARING NOTHING. A page whose mocks
       * render unstyled looks exactly like a page whose mocks were never written — and this is the
       * command that sends one to somebody else, so it is the last place anybody will notice.
       *
       * ⛔ AND IT COMES OUT OF THE CORPUS, which is what makes `--at <url>` publishable at all: a
       * corpus on an instance has no stylesheets to read, only the snapshot it carries.
       */
      if (corpus.style?.css)
        console.log(
          pc.dim(
            `  styled with ${corpus.style.sources.map((s) => s.path).join(", ")}${
              corpus.style.theme ? `, wearing ${corpus.style.theme}` : ""
            } — taken ${corpus.style.taken_at ?? "at some point"}`
          )
        );
      else
        console.error(
          pc.yellow("!"),
          "this corpus carries no style, so every drawing on the page will render unstyled — run `productos v2 style --into <corpus>` where the repository is"
        );
      const page = renderScopePage(corpus, scope, {
        interactive: true,
        /**
         * ⛔ `mcp` — the press calls ProductOS on the reader's own machine, so there is no database
         * round-trip and nothing to carry in. `db` remains for a page shared with somebody who has
         * no ProductOS; `--via-db` picks it.
         */
        records: o.viaDb ? "db" : "mcp",
        by: o.by,
        recordsTo: o.viaDb ? "read back from this page and written into the product truth" : dir,
        ...styleOf(corpus),
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
      if (o.viaDb) console.log(pc.dim("  publish it with capabilities {db:{}}; presses land in the artifact's database"));
      else {
        console.log(pc.dim('  publish it with capabilities {mcp:{servers:[{server:"host:productos",tools:[...]}]}}'));
        console.log(pc.dim("  a press then calls ProductOS on the reader's own machine — no database, nothing to carry in"));
        console.log(pc.dim("  ⛔ Claude app only. Elsewhere the page says so rather than failing silently."));
      }
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
       * ⛔ `verdicts/` AND `notes/` ARE NOT TOUCHED, EVER. A person's acts and a person's requests
       * are the two things in the corpus nothing can reconstruct, and `--force` is about discarding
       * derived output. `notes/` survived this list by omission rather than by decision until it was
       * written down here; anyone adding to the list should have to argue past this sentence.
       */
      /**
       * ⛔ AND `truth/` IS NOT ALL DERIVED EITHER, WHICH THIS ASSUMED AND COST TWO SCOPES.
       *
       * The paragraph above is right that `--force` discards derived output and that a person's acts
       * and requests can never be reconstructed. What it missed is that a scope AUTHORED IN v2 —
       * with no v1 source, because it was written here — is equally unreconstructable and lives in
       * `truth/`. Two of them, written one afternoon and drawn from the add-in code, were gone the
       * next morning: deleted by a re-migration that had no way to produce them and no record that
       * it had removed anything.
       *
       * So nothing is deleted outright. The trees are set aside first, and afterwards anything the
       * run did not produce is PUT BACK and named. A regeneration may discard what it can rebuild;
       * removing what it cannot is destroying input, and doing it silently is the whole defect.
       */
      let setAside: string | undefined;
      if (o.force) {
        setAside = path.join(out, ".superseded", new Date().toISOString().replace(/[:.]/g, "-"));
        for (const d of ["truth", "rules", "charter"]) {
          const dir = path.join(out, d);
          if (!fs.existsSync(dir)) continue;
          const keep = path.join(setAside, d);
          fs.mkdirSync(path.dirname(keep), { recursive: true });
          fs.cpSync(dir, keep, { recursive: true });
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      const m = migrate(from, out, new Date().toISOString().slice(0, 10));
      if (setAside) {
        /**
         * ⛔ WHAT A PERSON SAID OUTRANKS WHAT v1 REMEMBERS.
         *
         * Peter: *"--force should only take the user feedback and regenerate based on it, taking the
         * user feedback as truth."*
         *
         * v1 is the OLD understanding. Its `deal-pricing.md` still carries ninety-seven mentions of
         * staged edits, overrides and a publish gate — the model he corrected twice, on the page —
         * while v2 now says nothing on that screen can be typed into. Rebuilding it from v1 restores
         * exactly what he rejected, and the notes recording the rejection are CLOSED, so nothing
         * objects. A regeneration that can undo a human correction is worse than none: the corpus
         * looks freshly derived and is quietly back to a shape somebody already refused.
         *
         * So a scope the human record has touched is put back as it stood, and the rebuild of it is
         * discarded. The cost is real and stated: such a scope stops picking up genuine v1
         * improvements, and the only way it moves again is somebody authoring it here.
         */
        const held: Array<{ file: string; because: string[] }> = [];
        for (const sp of spokenFor(out)) {
          const file = `${sp.scope}.md`;
          const wasAt = path.join(setAside, "truth", file);
          if (!fs.existsSync(wasAt)) continue;
          fs.mkdirSync(path.join(out, "truth"), { recursive: true });
          fs.cpSync(wasAt, path.join(out, "truth", file));
          held.push({ file, because: sp.because });
        }
        if (held.length) {
          console.log(pc.cyan("⤺"), `${held.length} scope(s) kept as they stood — somebody has spoken about these, and what they said outranks v1:`);
          for (const h of held) {
            console.log(pc.dim(`    truth/${h.file}`));
            for (const b of h.because) console.log(pc.dim(`      ${b}`));
          }
          console.log(pc.dim("  the rebuild of these was discarded. They no longer follow v1 — author them here."));
        }

        const restored: string[] = [];
        for (const d of ["truth", "rules", "charter"]) {
          const was = path.join(setAside, d);
          if (!fs.existsSync(was)) continue;
          for (const f of fs.readdirSync(was)) {
            const back = path.join(out, d, f);
            if (fs.existsSync(back)) continue;
            fs.mkdirSync(path.dirname(back), { recursive: true });
            fs.cpSync(path.join(was, f), back);
            restored.push(`${d}/${f}`);
          }
        }
        if (restored.length) {
          console.log(pc.yellow("!"), `kept ${restored.length} file(s) this migration does not produce — written in v2, with no v1 source:`);
          for (const r of restored) console.log(pc.dim(`    ${r}`));
          console.log(pc.dim("  they were set aside and put back. A regeneration may discard what it can rebuild, never what it cannot."));
        }
      }
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

  /**
   * ⛔ WHAT SOMEBODY SAID, AND WHETHER IT REACHED EVERY LAYER IT HAD TO.
   *
   * Peter: "i want to be able to have user changes cascade into all the different areas" — after
   * the fourth time a piece of feedback was answered by editing the output. The instruction to do
   * otherwise already existed, in bold, with the grep to run. It was read and violated anyway,
   * because patching the output is the shortest path to making a complaint stop and nothing failed
   * when that path was taken.
   *
   * `change` is the thing that fails. The words go in verbatim, the kind routes to the layers that
   * kind must reach, each layer is verified by looking rather than by ticking, and `close` refuses
   * while one is unverified and unwaived.
   */
  cmd
    /**
     * ⛔ WHAT THE CODE HAS DECIDED SINCE THIS TRUTH WAS WRITTEN.
     *
     * Peter: "we should also walk git history, right?" Right, and it is the stronger half —
     * a recorded commit says THAT things moved, the history says WHAT and WHY. The commit that
     * deleted the pricing grid quoted the operator and said "this deletes rather than builds";
     * a diff could not have told anybody that, and the corpus describing that screen had not
     * heard about it.
     */
    .command("moved")
    .description("Walk what the code has decided since each screen was drawn, and what the commits say")
    .option("--at <dir>", "corpus directory", "v2")
    .option("--repo <dir>", "the codebase this corpus describes", ".")
    .option("--full", "print each commit's whole message, not its subject")
    .action((o: { at?: string; repo?: string; full?: boolean }) => {
      const corpus = loadCorpus(at(o));
      const repo = path.resolve(o.repo ?? ".");
      const rows = whatMoved(corpus, repo);
      if (!rows.length) {
        console.log(pc.dim("no screen records where it was drawn from — run `productos v2 draw` and this can answer"));
        return;
      }
      let moved = 0;
      let blind = 0;
      let gone = 0;
      for (const r of rows) {
        /**
         * ⛔ FIRST, LOUDEST, AND WITH THE COMMAND THAT FIXES IT.
         *
         * A deleted source used to print as "2 commits since it was drawn" — the same sentence a
         * renamed label gets. It was a 1,192-line component that no longer exists, and the corpus
         * went on describing its five editable controls until somebody read it and wrote "this is
         * all wrong". A report whose strongest finding is phrased as its weakest is a report that
         * gets skimmed.
         */
        if (r.gone) {
          gone++;
          console.log("");
          console.log(`${pc.bold(`${r.scope}#${r.view}`)} ${pc.red(r.from)}`);
          console.log(pc.red("  ✗ the file this was drawn from no longer exists — this screen describes something that was deleted"));
          for (const c of r.since.slice(0, 3)) console.log(`      ${pc.cyan(c.sha)} ${pc.dim(c.when)} ${c.subject}`);
          if (o.full) for (const c of r.since) if (c.body) for (const l of c.body.split("\n").slice(0, 12)) console.log(pc.dim(`        ${l}`));
          /** ⛔ Runnable. A finding that leaves somebody to work out the command is a finding they defer. */
          console.log(pc.dim(`      draw it again:  productos v2 draw "${r.scope}#${r.view}" --route <the component that renders it now> --into ${o.at ?? "v2"}`));
          console.log(pc.dim(`      or, if the screen is genuinely gone:  mark it exists: withdrawn`));
          continue;
        }
        if (r.why) {
          blind++;
          console.log("");
          console.log(`${pc.bold(`${r.scope}#${r.view}`)} ${pc.dim(r.from)}`);
          console.log(pc.yellow(`  ? ${r.why}`));
          continue;
        }
        if (!r.since.length) continue;
        moved++;
        console.log("");
        console.log(
          `${pc.bold(`${r.scope}#${r.view}`)} ${pc.dim(r.from)} ${pc.dim(`— ${r.since.length} commit${r.since.length === 1 ? "" : "s"} since it was drawn`)}`
        );
        for (const c of r.since) {
          console.log(`  ${pc.cyan(c.sha)} ${pc.dim(c.when)} ${c.subject}`);
          /**
           * ⛔ THE BODY IS THE POINT, and it is what a diff cannot give. This codebase writes down
           * why: the operator's words, what was deliberately deleted, what it refuses to do.
           */
          if (o.full && c.body) for (const l of c.body.split("\n").slice(0, 12)) console.log(pc.dim(`      ${l}`));
        }
      }
      console.log("");
      if (gone)
        console.log(
          pc.red("✗"),
          `${gone} screen${gone === 1 ? "" : "s"} drawn from a file that is no longer there. ${pc.dim("this corpus describes something that was deleted")}`
        );
      if (moved)
        console.log(
          pc.yellow("!"),
          `${moved} screen${moved === 1 ? "" : "s"} the code has changed under. ${pc.dim("read what the commits say — the corpus may be behind, or the code may be")}`
        );
      if (!gone && !moved) console.log(pc.green("✓"), "nothing has moved under a drawn screen");
      if (blind) console.log(pc.dim(`  ${blind} could not be compared — see above`));
      /** ⛔ A non-zero exit, so this can gate something. A report nothing can fail on is a report. */
      if (gone) process.exitCode = 1;
    });

  /**
   * ⛔ A STEER IS WRITTEN BY A COMMAND, BECAUSE HAND-AUTHORING IS THE TRAP.
   *
   * The shape was documented in the scoper and in no corpus — so the only way to get one was to
   * type the YAML, which is the specific thing the top of `CLAUDE.md` is about: a typed artefact
   * cannot be re-derived, so it is wrong the day after it is written, and when somebody says it is
   * wrong, typing it again is always the shortest path.
   */
  const steer = cmd.command("steer").description("What this project has learned — habits that shape what gets made, never what it promises");

  steer
    .command("new")
    .description("Record a habit this project works under")
    .argument("<says>", "the habit, in one line somebody can act on")
    .requiredOption("--steers <what>", "generation (a habit — opaque, shapes what gets proposed) | truth (a claim — surfaced on the charter)")
    .option("--learned-from <provenance>", "⛔ required on anything learned — what it was inferred from, so the next person can go and look")
    .option("--id <id>", "one segment, kebab-case — derived from the words if absent")
    .option("--at <dir>", "corpus directory", "v2")
    .action((says: string, o: { steers: string; learnedFrom?: string; id?: string; at?: string }) => {
      /**
       * ⛔ A URL IS REFUSED, NOT RESOLVED AS A FOLDER. Without this, `--at https://…/p/acme` printed
       * a green tick and wrote `./https:/…/p/acme/steers/steers.yaml` on this machine — so somebody
       * recording a habit for a hosted corpus was told it worked, and nothing reached the instance.
       * `path.resolve` turns a URL into a perfectly good folder name, which is why this has to be a
       * refusal rather than something a reader would notice.
       */
      refuseUrl(o, "writing a steer");
      const dir = path.resolve(o.at ?? "v2");
      /**
       * ⛔ THE WORDS THAT CARRY THE MEANING, not the first four. Slicing the opening words produced
       * `buttons-are-named-for` — an id whose last two words are grammar, which somebody then has
       * to type at `decline`. Dropping the filler leaves the part a person would actually recall.
       */
      const FILLER = new Set(
        "a an and are as at be by for from has have in is it its must never no not of on or should that the their them then there they this to was were what when where which who with".split(" ")
      );
      const id =
        o.id ??
        says
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .split(/\s+/)
          .filter((w) => w && !FILLER.has(w))
          .slice(0, 4)
          .join("-");
      const rec = {
        id,
        says,
        steers: o.steers,
        ...(o.learnedFrom ? { learned_from: o.learnedFrom } : {}),
        at: new Date().toISOString().slice(0, 10),
      };
      /**
       * ⛔ PARSED BEFORE IT IS WRITTEN, so the schema's refusals are what the person meets — a
       * learned steer with no provenance, or a truth steer claiming to have been learned. Writing
       * first and checking later is how a corpus comes to hold a record no loader will take.
       */
      const parsed = Steer.safeParse(rec);
      if (!parsed.success) {
        console.error(pc.red("✗"), "that is not a steer:");
        for (const i of parsed.error.issues) console.error(pc.dim(`  ${i.path.join(".") || "(record)"} — ${i.message}`));
        process.exit(1);
      }
      const existing = readSteers(dir);
      if (existing.some((x) => x.id === parsed.data.id)) {
        console.error(pc.red("✗"), `"${parsed.data.id}" already steers this project`);
        console.error(pc.dim("  productos v2 steer list"));
        process.exit(1);
      }
      /**
       * ⛔ WARNED, NOT REFUSED — BECAUSE `check` CALLS THIS A NOTE.
       *
       * A generation steer with no provenance is either under-documented or miscategorised, and
       * there is no legitimate third case, so refusing it here was tempting. But `check` grades it
       * `note`, and a writer stricter than the checker is two strictnesses for one rule — the
       * "second implementation of a predicate" the derive area warns about, which already made two
       * of five seed exchanges permanently unacceptable once. One rule, one severity, said twice.
       */
      if (parsed.data.steers === "generation" && !parsed.data.learned_from) {
        console.log(pc.yellow("!"), "nothing says what this was inferred from");
        console.log(
          pc.dim("  nobody agrees to a habit, so what it was learned from is the only thing anybody can argue with")
        );
        console.log(pc.dim("  --learned-from \"<the screens, the reviews, the rejections>\""));
        console.log(pc.dim("  or, if somebody simply decided it, it is a claim about the product — --steers truth, and into the charter"));
        console.log("");
      }
      const file = path.join(dir, "steers", "steers.yaml");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, YAML.stringify({ steers: [...existing, parsed.data] }, { lineWidth: 0 }));
      console.log(pc.green("✓"), `${parsed.data.id} — ${path.relative(process.cwd(), file)}`);
      console.log(pc.dim(`  "${parsed.data.says}"`));
      console.log("");
      if (parsed.data.steers === "generation") {
        console.log(pc.dim("  it shapes what the authors propose, and nobody agrees to it"));
        console.log(pc.dim("  productos init claude --update   — so every author installs with it"));
      } else {
        console.log(pc.dim("  it is a claim about the product, so it is on the charter where somebody can disagree"));
      }
    });

  steer
    .command("list")
    .description("What steers this project, and where each was learned")
    .option("--at <dir>", "corpus directory", "v2")
    .action((o: { at?: string }) => {
      /** ⛔ It answered "nothing steers this project yet" about somebody else's corpus, confidently. */
      refuseUrl(o, "listing steers");
      const dir = path.resolve(o.at ?? "v2");
      const all = readSteers(dir);
      if (!all.length) {
        console.log(pc.dim("nothing steers this project yet"));
        console.log(pc.dim('  productos v2 steer new "<the habit>" --steers generation --learned-from "<what you noticed it in>"'));
        return;
      }
      const live = inEffect(all);
      const off = declined(all);
      const truth = all.filter((x) => x.steers === "truth");
      if (live.length) {
        console.log("");
        console.log(pc.bold("habits, in force") + pc.dim("  — into every author, and no judge"));
        for (const st of live) {
          console.log(`  ${pc.green("•")} ${pc.bold(st.id)} ${st.says}`);
          /**
           * ⛔ THE PROVENANCE IS THE POINT OF SHOWING IT. A habit with its source shown is one
           * somebody can go and check and decline; without it, it is a rule nobody chose.
           */
          console.log(pc.dim(`    learned from ${st.learned_from ?? "— nothing said, which the loader refuses"}`));
        }
      }
      if (truth.length) {
        console.log("");
        console.log(pc.bold("claims about the product") + pc.dim("  — on the charter, where somebody can disagree"));
        for (const st of truth) console.log(`  ${pc.green("•")} ${pc.bold(st.id)} ${st.says}`);
      }
      if (off.length) {
        console.log("");
        console.log(pc.bold("declined") + pc.dim("  — kept, so the same pattern is not learned again"));
        for (const st of off) {
          console.log(`  ${pc.yellow("~")} ${pc.bold(st.id)} ${pc.dim(st.says)}`);
          console.log(pc.dim(`    because ${st.declined}`));
        }
      }
      console.log("");
    });

  steer
    .command("decline")
    .description("Turn a habit off, with the reason it is not a rule here")
    .argument("<id>", "which steer")
    .requiredOption("--because <reason>", "⛔ why it is not a rule here — a decline with no argument cannot be told from a steer nobody got round to")
    .option("--at <dir>", "corpus directory", "v2")
    .action((id: string, o: { because: string; at?: string }) => {
      refuseUrl(o, "declining a steer");
      const dir = path.resolve(o.at ?? "v2");
      const all = readSteers(dir);
      const hit = all.find((x) => x.id === id);
      if (!hit) {
        console.error(pc.red("✗"), `no steer "${id}"`);
        process.exit(1);
      }
      /**
       * ⛔ DECLINING IS FOR A HABIT, NOT A CLAIM — the schema refuses the other case, and saying so
       * here points at where it is actually withdrawn rather than just failing.
       */
      if (hit.steers === "truth") {
        console.error(pc.red("✗"), `"${id}" is a claim about the product, not a habit`);
        console.error(pc.dim("  a constraint is withdrawn where it was agreed to — take it out of the charter"));
        process.exit(1);
      }
      const next = all.map((x) => (x.id === id ? { ...x, declined: o.because } : x));
      const file = path.join(dir, "steers", "steers.yaml");
      fs.writeFileSync(file, YAML.stringify({ steers: next }, { lineWidth: 0 }));
      console.log(pc.green("✓"), `${id} no longer steers anything`);
      console.log(pc.dim(`  because ${o.because}`));
      console.log("");
      console.log(pc.dim("  it is kept rather than deleted, so the pattern it came from is not learned again"));
      console.log(pc.dim("  productos init claude --update   — so the authors stop carrying it"));
    });

  const change = cmd.command("change").description("Record a piece of feedback and drive it into every layer it affects");

  change
    .command("new")
    .description("Record what somebody said, verbatim, and what kind of change it is")
    .argument("<said>", "their words — ⛔ quoted, never paraphrased")
    .requiredOption("--kind <kind>", `one of: ${KINDS.join(" | ")}`)
    /**
     * ⛔ NO `--at`. A change record is about the REPO — the framework, the agents, the
     * instructions — not about any one corpus, and `writeChange` has always used the working
     * directory. The option was declared here and read by nothing, so `--at <anything>` was
     * accepted in silence and the record landed in the same place regardless. Against a hosted
     * instance that reads as a write going somewhere it never went.
     */
    .action((said: string, o: { kind: string; at?: string }) => {
      if (!KINDS.includes(o.kind)) {
        console.error(pc.red("✗"), `"${o.kind}" is not a kind of change`);
        console.error(pc.dim(`  ${KINDS.join(" · ")}`));
        process.exit(1);
      }
      const root = process.cwd();
      const id = nextId(root);
      const rec = {
        id,
        said,
        at: new Date().toISOString().slice(0, 10),
        kind: o.kind,
        reaches: Object.fromEntries((CASCADE[o.kind] ?? []).map((l) => [l, ""])),
        waived: {},
      };
      const file = writeChange(root, rec);
      console.log(pc.green("✓"), `${id} — ${path.relative(root, file)}`);
      console.log(pc.dim(`  "${said}"`));
      console.log("");
      console.log(`a ${o.kind} change has to reach ${CASCADE[o.kind]?.length} layers:`);
      for (const l of CASCADE[o.kind] ?? []) console.log(pc.dim(`  ${l} — name what satisfies it in reaches.${l}`));
      console.log("");
      console.log(pc.dim("  fill each one in, then: productos v2 change check " + id));
    });

  change
    .command("check")
    .description("Look, layer by layer, at whether this change actually landed")
    .argument("[id]", "one change, or every open one")
    /**
     * ⛔ NO `--at`. A change record is about the REPO — the framework, the agents, the
     * instructions — not about any one corpus, and `writeChange` has always used the working
     * directory. The option was declared here and read by nothing, so `--at <anything>` was
     * accepted in silence and the record landed in the same place regardless. Against a hosted
     * instance that reads as a write going somewhere it never went.
     */
    .action((id: string | undefined) => {
      const root = process.cwd();
      const all = readChanges(root).filter((c) => (id ? c.id === id : !c.closed));
      if (!all.length) {
        console.log(pc.dim(id ? `no change "${id}"` : "nothing open"));
        return;
      }
      let owed = 0;
      for (const rec of all) {
        const v = verify(root, rec);
        const short = missing(v);
        owed += short.length;
        console.log("");
        console.log(`${pc.bold(rec.id)} ${pc.dim(rec.kind)}${rec.closed ? pc.dim(" closed") : ""}`);
        console.log(pc.dim(`  "${rec.said}"`));
        for (const x of v) {
          const mark = x.waived ? pc.yellow("~") : x.ok ? pc.green("✓") : pc.red("✗");
          console.log(`  ${mark} ${x.layer.padEnd(9)} ${pc.dim(x.how)}${x.waived ? pc.dim(` — ${x.waived}`) : ""}`);
        }
      }
      console.log("");
      if (owed) {
        console.log(pc.red("✗"), `${owed} layer${owed === 1 ? "" : "s"} this feedback has not reached`);
        process.exitCode = 1;
      } else console.log(pc.green("✓"), "every layer reached");
    });

  change
    .command("close")
    .description("Close a change — refused while any layer it must reach is unverified")
    .argument("<id>")
    .option("--waive <layer>", "waive one layer (repeatable), with --because", (v: string, all: string[]) => [...all, v], [] as string[])
    .option("--because <why>", "why that layer does not apply here")
    /**
     * ⛔ NO `--at`. A change record is about the REPO — the framework, the agents, the
     * instructions — not about any one corpus, and `writeChange` has always used the working
     * directory. The option was declared here and read by nothing, so `--at <anything>` was
     * accepted in silence and the record landed in the same place regardless. Against a hosted
     * instance that reads as a write going somewhere it never went.
     */
    .action((id: string, o: { waive: string[]; because?: string }) => {
      const root = process.cwd();
      const rec = readChanges(root).find((c) => c.id === id);
      if (!rec) {
        console.error(pc.red("✗"), `no change "${id}"`);
        process.exit(1);
      }
      /**
       * ⛔ A WAIVER CARRIES ITS REASON. "Not applicable" with no argument is how a cascade becomes
       * a formality — the reason is the part somebody can disagree with in six months.
       */
      if (o.waive.length) {
        if (!o.because || o.because.trim().length < 20) {
          console.error(pc.red("✗"), "a waived layer needs a reason somebody could argue with");
          process.exit(1);
        }
        for (const l of o.waive) rec.waived[l] = o.because.trim();
      }
      const short = missing(verify(root, rec));
      if (short.length) {
        console.error(pc.red("✗"), `${short.length} layer${short.length === 1 ? "" : "s"} this has not reached:`);
        for (const x of short) console.error(pc.dim(`    ${x.layer} — ${x.how}`));
        console.error("");
        console.error(pc.dim("  reach them, or waive one with --waive <layer> --because \"...\""));
        console.error(pc.dim(`  ⛔ what this refuses to let you do is call it done after fixing one layer`));
        process.exit(1);
      }
      rec.closed = new Date().toISOString().slice(0, 10);
      writeChange(root, rec);
      console.log(pc.green("✓"), `${id} closed — every layer reached`);
    });

  cmd
    /**
     * ⛔ WHAT TO ASK THIS PERSON NEXT, IN ORDER — because the review surface is the conversation.
     *
     * Peter: "what's the best claude native approach here?" This is the answer's missing half. A
     * published page cannot push and cannot reach his machine; the question interface is native,
     * synchronous and needs no plumbing at all — but nothing handed over WHAT to ask, so every
     * round was improvised, and an improvised order is one where the purpose gets asked after the
     * details it was supposed to frame.
     *
     * So: one feature, in the order the model already gates. The purpose first, alone, because
     * nothing under it is offered until it is agreed. Then its sentences, one at a time.
     */
    .command("next")
    .description("What to ask somebody next about one feature, in the order the model gates it")
    .argument("[scope]", "the feature — omit to be told which one is closest to reviewable")
    .option("--take <n>", "how many to hand over", "4")
    .option("--json", "as data, for driving a question interface")
    .option("--at <dir>", "corpus directory", "v2")
    .action(async (scopeId: string | undefined, o: { take?: string; json?: boolean; at?: string; token?: string }) => {
      const dir = await openAt(o);
      const corpus = loadCorpus(dir);
      refuseIfBroken(corpus, "a review round");
      const a = actsFor(corpus);
      const take = Math.max(1, Number(o.take ?? 4));

      if (!scopeId) {
        /**
         * ⛔ CLOSEST TO REVIEWABLE FIRST, not first in the corpus. A reviewer facing nineteen
         * features is asking which one to start on, and the honest answer is the one where the
         * fewest acts stand between here and a feature somebody could build from.
         */
        const ranked = corpus.scopes
          .filter((x) => x.scope.exchanges.length)
          .map((x) => ({
            id: x.scope.id,
            title: plain(x.scope.title || x.scope.id),
            purpose: !a.ungrounded.some((u) => u.scope === x.scope.id),
            owed: a.written.filter((b) => b.startsWith(`${x.scope.id}#`)).length,
          }))
          .filter((x) => x.owed || !x.purpose)
          .sort((x, y) => Number(y.purpose) - Number(x.purpose) || x.owed - y.owed);
        if (o.json) {
          console.log(JSON.stringify(ranked.slice(0, take), null, 2));
          return;
        }
        console.log(pc.bold("Where to start"));
        for (const r of ranked.slice(0, take))
          console.log(
            `  ${pc.cyan(r.id.padEnd(30))} ${r.purpose ? pc.dim("purpose agreed · ") : pc.yellow("purpose first · ")}${r.owed} sentence${r.owed === 1 ? "" : "s"}`
          );
        return;
      }

      const entry = corpus.scopes.find((x) => x.scope.id === scopeId);
      if (!entry) {
        console.error(pc.red("✗"), `no feature "${scopeId}"`);
        process.exit(1);
      }
      const sc = entry.scope;
      const ungrounded = a.ungrounded.find((u) => u.scope === scopeId);

      /**
       * ⛔ THE PURPOSE IS HANDED OVER ALONE. Offering it beside the details it frames invites
       * somebody to answer them in the same breath, which is the ordering this gate exists to stop.
       */
      if (ungrounded) {
        const hp = sc.happy_path;
        const item = {
          ref: `${scopeId}#happy-path`,
          asks: `Is this what ${plain(sc.title || scopeId)} is for?`,
          why: ungrounded.why,
          says: hp
            ? {
                accomplishes: plain(hp.accomplishes),
                brings: plain(hp.brings),
                ends_with: plain(hp.ends_with),
                through: hp.through.map((v) => plain(sc.views.find((x) => x.id === v)?.title || v)),
                not: hp.not ? plain(hp.not) : undefined,
              }
            : undefined,
          screens: sc.views.filter((v) => v.exists !== "withdrawn").map((v) => ({ id: v.id, title: plain(v.title), drawn: Boolean(v.sketch_html || v.sketch) })),
          act: `productos v2 accept "${scopeId}#happy-path" --by <who> --via question`,
        };
        if (o.json) {
          console.log(JSON.stringify({ scope: scopeId, gate: "purpose", items: [item] }, null, 2));
          return;
        }
        console.log(pc.bold(item.asks));
        console.log(pc.dim(`  ${item.why}`));
        if (hp) {
          console.log("");
          console.log(`  ${plain(hp.accomplishes)}`);
          console.log(pc.dim(`    arrives with: ${plain(hp.brings)}`));
          console.log(pc.dim(`    leaves with:  ${plain(hp.ends_with)}`));
          if (item.says?.through?.length) console.log(pc.dim(`    through:      ${item.says.through.join(" → ")}`));
        }
        console.log("");
        console.log(pc.dim(`  ${item.act}`));
        return;
      }

      /** Its sentences, in reading order, with what would show each holding. */
      const owed = a.written.filter((b) => b.startsWith(`${scopeId}#`)).slice(0, take);
      const items = owed.map((ref) => {
        const [, exId, slot, said] = ref.split("#");
        const ex = sc.exchanges.find((e) => e.id === exId);
        const fill = ex?.slots[slot as SlotName];
        const shown = statements(fill?.says);
        const one = said ? shown.find((x: { id: string }) => x.id === said) : shown[0];
        const shows = (ex?.criteria ?? []).filter((c) => c.slot === slot && (!c.of || c.of === said));
        return {
          ref,
          asks: SLOT_ASKS_SHORT[slot as SlotName] ?? slot,
          on: plain(ex?.title ?? exId),
          at: ex?.at ? { view: ex.at.view, part: ex.at.part } : undefined,
          says: plain(one?.says ?? (fill?.none ? "nothing happens" : fill?.cannot_fail ? "this cannot fail" : "")),
          shown_by: shows.map((c) => plain([c.given && `given ${c.given}`, c.when && `when ${c.when}`, c.then && `then ${c.then}`].filter(Boolean).join(", "))),
          act: `productos v2 accept "${ref}" --by <who> --via question`,
        };
      });
      if (o.json) {
        console.log(JSON.stringify({ scope: scopeId, gate: "none", items }, null, 2));
        return;
      }
      console.log(pc.bold(`${plain(sc.title || scopeId)} — ${a.written.filter((b) => b.startsWith(`${scopeId}#`)).length} sentences nobody has agreed to`));
      for (const it of items) {
        console.log("");
        console.log(`  ${pc.cyan(it.asks)} ${pc.dim("on " + it.on)}`);
        console.log(`    ${it.says}`);
        if (!it.shown_by.length) console.log(pc.yellow("    nothing here says what would show this working"));
      }
    });

  cmd
    /**
     * ⛔ THE AGENT MODEL, PRINTED — because a division of labour nobody can list is one nobody uses.
     *
     * Peter: "each agent should understand the context of what they're supposed to do, like an agent
     * that validates everything is consistent, agent that validates test coverage is there." This is
     * what answers "which of those exist, what does each one ask, and who runs it".
     */
    .command("agents")
    .description("The reviewers: what each one asks, why it exists, and which model runs it")
    .option("--at <dir>", "corpus directory, for the model assignments", "v2")
    .option("--out <file>", "write the whole tree as a document instead of printing a summary")
    .option("--presets", "write each skill's preset into its SKILL.md, from the registry")
    .option("--tree", "print the routes and which roles each one orchestrates, in order")
    .action((o: { at?: string; out?: string; presets?: boolean; tree?: boolean }) => {
      /**
       * ⛔ WHICH ROLES A ROUTE ORCHESTRATES, ON THE SURFACE SOMEBODY ASKS IT FROM.
       *
       * Peter: *"let's map out all the commands/skills and what agents they'd orchestrate and
       * how."* It was answerable from `jobs.ts` and from the generated doc, and not from the
       * command whose entire job is telling you about the roles — so answering it meant reading
       * source, which is the state every generated document here exists to end.
       */
      if (o.tree) {
        for (const sh of SHIMS) {
          console.log("");
          console.log(pc.bold(sh.route) + pc.dim(`  — ${sh.does}`));
          console.log(pc.dim(`  they say: ${sh.when}`));
          /** ⛔ Before the spawns, for the same reason the document prints it there. */
          if (sh.at) console.log(pc.yellow(`  ⛔ only at stage: ${sh.at}`));
          if (!sh.steps.length) console.log(pc.dim("  spawns nothing — every part of this is kept"));
          for (const st of sh.steps) {
            const author = AUTHORS.find((a) => a.name === st.role);
            const agent = AGENTS.find((a) => a.name === st.role);
            const seat = author?.discipline ?? agent?.discipline ?? pc.red("in no registry");
            const kind = author ? pc.cyan("writes") : pc.magenta("judges");
            console.log(`  → ${pc.bold(st.role)}${st.fan ? pc.dim(" ×N") : ""}  ${kind} ${pc.dim(`· ${seat}`)}`);
            console.log(pc.dim(`      ${st.why}`));
          }
          /** ⛔ The kept acts print with the spawns, because a route read without them is a fan-out. */
          for (const k of sh.keeps) console.log(pc.yellow("  ⛔ keeps: ") + pc.dim(k));
        }
        console.log("");
        const named = new Set(SHIMS.flatMap((x) => x.steps.map((st) => st.role)));
        console.log(pc.dim(`  ${named.size} of ${AUTHORS.length + AGENTS.length} roles are named by a route — a role no route names runs only when somebody remembers it`));
        return;
      }
      /**
       * ⛔ THE PRESET REACHES THE SKILL, OR IT REACHES NOBODY. `instruct` is the layer this project
       * skips, and a routing table that lives only in `jobs.ts` is a table a future session never
       * meets — it reads the skill. Generated between markers so the hand-authored rest of a skill
       * survives, and pinned by a test so a preset and its tree cannot disagree.
       */
      if (o.presets) {
        /** ⛔ ONE SKILL. Its routes are the preset; see SHIMS for why there is no longer one each. */
        const f = path.join(path.resolve("skills"), SKILL, "SKILL.md");
        let wrote = 0;
        if (!fs.existsSync(f)) {
          console.log(pc.yellow("!"), `there is no skill at ${f} — the routes have nowhere to be written`);
        } else {
          const was = fs.readFileSync(f, "utf-8");
          const now = withPreset(was, SHIMS);
          if (now === was) console.log(pc.dim(`  ${SKILL} — current`));
          else {
            fs.writeFileSync(f, now);
            wrote++;
            for (const sh of SHIMS)
              console.log(
                pc.green("✓"),
                `${sh.route}  ${pc.dim(
                  sh.steps.length ? sh.steps.map((st) => st.role + (st.fan ? "×N" : "")).join(" → ") : "spawns nothing"
                )}`
              );
          }
        }
        console.log("");
        console.log(pc.dim(`  ${wrote} rewritten from src/core/jobs.ts — a test fails if one drifts`));
        return;
      }
      /**
       * ⛔ THE DOC IS GENERATED. Everything in it is already data in the registry, so a typed copy
       * would be a second record of one fact — and the typed one wins, because it is the one people
       * read, until it is wrong and nothing detects it.
       */
      if (o.out) {
        fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
        fs.writeFileSync(path.resolve(o.out), agentsDoc());
        console.log(pc.green("✓"), `${o.out}`);
        console.log(pc.dim("  generated from src/core/jobs.ts — a test fails if the committed file drifts"));
        return;
      }
      let cfg: ReturnType<typeof readConfig> | undefined;
      try {
        cfg = readConfig(resolvePathsOrThrow(at(o, false)));
      } catch {
        cfg = undefined;
      }
      const models = cfg?.agents.model ?? {};
      const dflt = cfg?.agents.default_model;
      const off = cfg?.agents.off ?? {};
      /**
       * ⛔ BOTH REGISTRIES, AND THE AUTHORS FIRST, BECAUSE THAT IS THE ORDER THE WORK HAPPENS IN.
       *
       * This printed reviewers alone for as long as reviewers were all there were — an accurate
       * picture of a system where authoring had no role behind it.
       */
      /**
       * ⛔ GROUPED BY THE SEAT A PERSON WOULD HAVE SAT IN, because that is the view that shows a
       * team with holes in it. Peter: *"we should be able to describe the roles based on who would
       * have done each task."* Flat, thirteen roles read as complete; by seat, four questions had
       * nobody asking them.
       */
      console.log(pc.bold("THE TEAM") + pc.dim("  — by who would have done the work"));
      for (const g of byDiscipline())
        console.log(`  ${pc.bold(g.discipline.padEnd(22))} ${g.roles.map((r) => r.name).join(pc.dim(" · "))}`);
      console.log("");
      console.log(pc.bold("AUTHORS") + pc.dim("  — every one writes, none may settle"));
      for (const a of AUTHORS) {
        const who = models[a.name] ?? dflt;
        console.log("");
        console.log(
          `${pc.bold(a.name)}  ${pc.dim(who ? `model: ${who}` : "model: whatever the host uses")}${
            off[a.name] ? pc.yellow("  off") : ""
          }${a.prompt ? "" : pc.yellow("  no prompt yet")}${pc.dim(`  · ${a.discipline}`)}${pc.dim(a.each ? `  · one per ${a.each}` : "  · runs once")}`
        );
        console.log(`  ${a.asks}`);
        if (off[a.name]) console.log(pc.dim(`  turned off here: ${off[a.name]}`));
        for (const n of a.never) console.log(pc.dim(`  never ${n}`));
      }
      console.log("");
      console.log(pc.bold("REVIEWERS") + pc.dim("  — each asks one question about the whole; none may write"));
      for (const a of AGENTS) {
        const who = models[a.name] ?? dflt;
        console.log("");
        console.log(
          `${pc.bold(a.name)}  ${pc.dim(who ? `model: ${who}` : "model: whatever the host uses")}${
            off[a.name] ? pc.yellow("  off") : ""
          }${a.prompt ? "" : pc.yellow("  no prompt yet")}${pc.dim(`  · ${a.discipline}`)}`
        );
        console.log(`  ${a.asks}`);
        if (off[a.name]) console.log(pc.dim(`  turned off here: ${off[a.name]}`));
        for (const n of a.never) console.log(pc.dim(`  never ${n}`));
      }
      console.log("");
      const everyone = [...AUTHORS, ...AGENTS];
      const missing = everyone.filter((a) => !a.prompt);
      if (missing.length) {
        console.log(
          pc.yellow("!"),
          `${missing.length} of ${everyone.length} have no prompt written: ${missing.map((m) => m.name).join(", ")}`
        );
        console.log(pc.dim("  they are named here so their absence is visible rather than implied"));
      }
      console.log(pc.dim(`  assign a model per agent in productos/config.yaml under agents.model`));
    });

  cmd
    /**
     * ⛔ ONE PASS THAT REGENERATES EVERYTHING GENERABLE.
     *
     * Peter: *"the framework will now generate these, not me asking you to do it, right?"* — and the
     * honest answer was no. Drawing, proposing and connecting were three commands somebody had to
     * know about, remember the order of, and choose to run. A generator you have to assemble by hand
     * runs on the day somebody is paying attention and never again, which is precisely how six of
     * sixteen screens stayed hand-typed through several re-indexings.
     *
     * So: one command. Screens from the code, then a screen from the truth wherever no code renders
     * one, then the graph from what the corpus says — in that order, because each feeds the next. A
     * screen has to exist before anything can connect to it.
     */
    /**
     * ⛔ THE DESIGN LIBRARIES, COPIED IN RATHER THAN REFERENCED.
     *
     * Peter: *"we should copy the appropriate css files in - were we referencing the repo before?
     * we should have something that keeps the design libraries in sync."* We were, and that is
     * precisely why a hosted instance rendered every drawing unstyled: it materializes a project
     * into a temp directory and there is no repository above it to reference.
     */
    .command("style")
    .description("Copy the application's design libraries into the corpus, so a drawing looks like the product anywhere")
    .option("--into <dir>", "the corpus", ".")
    .option("--check", "say whether the design system has moved since the snapshot, and change nothing")
    /**
     * ⛔ THE CHOICE IS THE PROJECT'S, AND IT IS A VERB RATHER THAN A SETTING. Peter: *"we should be
     * able to choose themes per project."* It was `web.theme` in a repository's config file, which
     * put the decision somewhere whoever is reviewing cannot reach.
     */
    .option("--wear <scheme>", "which of the schemes the design system offers this project shows")
    .option("--bare", "wear none of them — the fallback colours, for a product that ships unthemed")
    .action((o: { into?: string; check?: boolean; wear?: string; bare?: boolean }) => {
      const into = path.resolve(o.into ?? ".");
      const wear = o.bare ? null : o.wear;
      if (!o.check) return takeStyle(into, wear);
      const corpus = loadCorpus(into);
      if (!corpus.style) {
        console.log(pc.yellow("!"), "this corpus carries no style — every drawing in it renders unstyled");
        console.log(pc.dim("  productos v2 style --into <corpus>"));
        return;
      }
      const drift = styleDrift(into, corpus.style);
      if (!drift.known) {
        /**
         * ⛔ "I CANNOT TELL" IS AN ANSWER, AND IT IS THE HOSTED ONE. Reporting in-sync here would be
         * asserting something nothing checked, on the surface where nobody can go and look.
         */
        console.log(pc.dim("?"), `taken ${corpus.style.taken_at ?? "at some point"} from ${corpus.style.sources.length} file(s)`);
        console.log(pc.dim("  no repository here to compare against, so whether it is current cannot be said from this corpus"));
        return;
      }
      const moved = [...drift.moved, ...drift.gone, ...drift.added];
      if (!moved.length) {
        console.log(pc.green("✓"), `current — ${corpus.style.sources.length} file(s), unchanged since ${corpus.style.taken_at ?? "it was taken"}`);
        return;
      }
      console.log(pc.yellow("!"), `the design system has moved since ${corpus.style.taken_at ?? "this was taken"}`);
      for (const p of drift.moved) console.log(`    ${pc.yellow("~")} ${p} changed`);
      for (const p of drift.gone) console.log(`    ${pc.yellow("-")} ${p} is no longer there`);
      for (const p of drift.added) console.log(`    ${pc.yellow("+")} ${p} is new`);
      console.log(pc.dim("\n  productos v2 style --into <corpus>   # take it again"));
    });

  cmd
    .command("generate")
    .description("Regenerate everything generable: screens, their states, and what connects to what")
    .option("--into <dir>", "the corpus", ".")
    .action((o: { into?: string }) => {
      const into = path.resolve(o.into ?? ".");
      /**
       * ⛔ THE STYLE FIRST, BECAUSE IT IS THE ONLY STEP THAT NEEDS THE REPOSITORY.
       *
       * Every other step reads the corpus; this one reads the application's stylesheets, which only
       * exist where somebody has a checkout. Taking it here is what puts them INTO the corpus, so
       * everything downstream — a hosted instance, a packet, a published page — has them without
       * one.
       */
      console.log(pc.bold("What the product looks like"));
      takeStyle(into);
      console.log("");
      console.log(pc.bold("Screens, from the code"));
      drawEverything(into, false);
      console.log("");
      console.log(pc.bold("Screens, from the truth — where no code renders them"));
      proposeScreens(into);
      console.log("");
      console.log(pc.bold("What connects to what"));
      connectAll(into, false);
      console.log("");
      console.log(pc.dim("  all of it is output. Re-run after the code or the truth moves; nothing here is anybody's to maintain."));
    });

  cmd
    /**
     * ⛔ THE GRAPH COMES FROM THE TRUTH, NOT THE CODE.
     *
     * Peter: *"doesn't matter what code says. it should be obvious what connects to what… there's
     * only one thing 'add deal' should do, right?"* and *"code is ONLY reference for
     * initializing/onboarding"*. A graph read out of `router.push` can only join screens that exist;
     * the corpus describes the target, so it can join screens nobody has built.
     */
    .command("connect")
    .description("Work out what each control leads to, from what the corpus says about it")
    .option("--into <dir>", "the corpus", ".")
    .option("-n, --dry-run", "say what it would connect and change nothing")
    .action((o: { into?: string; dryRun?: boolean }) => {
      connectAll(path.resolve(o.into ?? "."), Boolean(o.dryRun));
    });

  cmd
    /**
     * ⛔ THE OTHER DIRECTION FROM `draw`. `draw` needs a component; this needs only the truth, which
     * is what makes a screen possible for a feature nobody has built — and the corpus is the target
     * state, so that screen is not a lesser artefact than a drawn one.
     */
    .command("propose")
    .description("Generate a screen from a view's own parts, in the application's idiom")
    .argument("[view]", "which screen, as <scope>#<view> — omit with --all")
    .option("--all", "every screen that has no picture yet")
    .option("--into <dir>", "the corpus to write into", ".")
    .action((ref: string | undefined, o: { all?: boolean; into?: string }) => {
      proposeScreens(path.resolve(o.into ?? "."), o.all ? undefined : ref);
    });

  cmd
    /**
     * ⛔ THE SCREEN IS GENERATED. NOBODY TYPES IT.
     *
     * Peter, four times over, the last one in capitals: feedback on a rendered screen is a bug
     * report against ProductOS, and the fix is to regenerate rather than to edit the output. He is
     * right about the mechanism and not only the etiquette — eleven screens had been hand-written
     * into a corpus, so when he said they were thin the shortest path was to hand-write them again,
     * and the next corpus and the next session get nothing from it. A typed mock also cannot be
     * re-derived when the application changes, so it is wrong the day after and nothing says so.
     *
     * This reads the route, inlines the primitives it composes, and writes the result into the
     * corpus. Re-run it and the drawing follows the code.
     */
    .command("draw")
    .description("Generate a screen from the codebase and write it into the corpus")
    .argument("[view]", "which screen, as <scope>#<view> — omit with --all")
    .option("--route <file>", "the component that renders it, relative to the repo root")
    /**
     * ⛔ THE SWEEP IS WHY SIXTY SCREENS WERE NEVER DRAWN. A generator that has to be aimed, once
     * per screen, with the component named by hand, runs for the first screen somebody cares about
     * and for none of the others. `--all` is the whole answer to "make it ALWAYS generate".
     */
    .option("--all", "every screen in the corpus, finding each one's component from what it declares")
    .option("--into <dir>", "the corpus to write into — a v1 products tree or a v2 truth tree", ".")
    .option("-n, --dry-run", "print what would be written and change nothing")
    .action((ref: string | undefined, o: { route?: string; into?: string; dryRun?: boolean; all?: boolean }) => {
      if (o.all) return drawEverything(path.resolve(o.into ?? "."), Boolean(o.dryRun));
      if (!ref) {
        console.error(pc.red("✗"), "name a screen as <scope>#<view>, or pass --all");
        process.exit(1);
      }
      if (!o.route) {
        console.error(pc.red("✗"), "say which component renders it with --route, or pass --all to find them");
        process.exit(1);
      }
      const [scopeId, viewId] = ref.split("#");
      if (!scopeId || !viewId) {
        console.error(pc.red("✗"), "name the screen as <scope>#<view>");
        process.exit(1);
      }
      const into = path.resolve(o.into ?? ".");
      let componentsDir: string | undefined;
      let designDir: string | undefined;
      try {
        const paths = resolvePathsOrThrow(into);
        const root = path.dirname(path.dirname(paths.configFile));
        const cfg = readConfig(paths);
        componentsDir = cfg.web.components_dir ? path.resolve(root, cfg.web.components_dir) : undefined;
      } catch {
        componentsDir = undefined;
      }
      const route = path.resolve(o.route!);
      if (!fs.existsSync(route)) {
        console.error(pc.red("✗"), `no component at ${route}`);
        process.exit(1);
      }
      /**
       * ⛔ THE PART LIST GOES IN. The generator stamps `data-part` itself now — the skill used to
       * tell the author to add it afterwards, which is an edit on generator output in a field the
       * next run discards.
       */
      let parts: Array<{ id: string; role: string; label?: string; leads_to?: string; decorative?: boolean }> = [];
      /** Whether a hand-drawn sketch sits beside the generated one — see the warning below. */
      let hasAscii = false;
      try {
        const c = loadCorpus(into);
        const sc = c.scopes.find((x) => x.scope.id === scopeId || x.scope.id === scopeId.split("/").pop())?.scope;
        const v = sc?.views.find((x) => x.id === viewId);
        parts = v?.parts ?? [];
        hasAscii = Boolean(v?.sketch);
      } catch {
        parts = [];
      }
      const drawn = drawFromRoute(route, { componentsDir, parts });
      if (!drawn.html.trim()) {
        console.error(pc.red("✗"), "nothing could be read out of that component");
        for (const u of drawn.unresolved) console.error(pc.dim(`  ${u}`));
        process.exit(1);
      }
      console.log(pc.green("✓"), `${scopeId}#${viewId} — ${drawn.html.length} bytes`);
      console.log(pc.dim(`  built from ${drawn.from.join(", ")}`));
      /**
       * ⛔ SAY WHAT IT COULD NOT READ. This is a transform, not a renderer: it does not run hooks
       * or resolve data. An unreadable expression becomes a marked placeholder in the drawing
       * rather than a guess, and the count belongs in the report — a drawing full of placeholders
       * is the thin drawing again, and the only honest thing is to say so at the moment it is made.
       */
      /**
       * ⛔ THE STATES IT DID NOT DRAW. A screen has more than one appearance and a drawing holds
       * one; saying which were skipped is the difference between a picture of the loaded state and
       * a picture claiming to be the whole screen.
       */
      /**
       * ⛔ AND HOW MANY IT DID DRAW, COUNTED RATHER THAN ASSUMED. This said "drew one state" as a
       * constant, so a screen whose five wizard steps were all drawn still reported one — the run
       * that fixed the generator looked, from its own output, like the run that had not.
       */
      /**
       * ⛔ THE LOUDEST THING THIS COMMAND SAYS, because it is the only failure that produces a
       * drawing nobody can tell is wrong.
       *
       * Peter: *"creating a CRE/multifamily deal does NOT go through a term sheet. it is a manual
       * form only"*. The route switches on project type across five unrelated screens; this drew
       * the default — a five-step term-sheet wizard belonging to a different product — in full, and
       * reported success. Every other failure mode here makes a drawing that looks thin. This one
       * makes a drawing that looks like the product.
       */
      for (const f of drawn.forks) {
        console.log(
          pc.yellow("⚠"),
          `${f.where} renders ${f.others.length + 1} different screens depending on ${pc.bold(f.on)}`
        );
        console.log(pc.yellow(`    drew ${f.chose} — which may not be this one`));
        console.log(pc.dim(`    it could also be: ${f.others.join(", ")}`));
        console.log(
          pc.dim(`    which one this screen IS is a fact about the product, not about the code — if it is not this`)
        );
        console.log(pc.dim(`    one, name the component: productos v2 draw "<scope>#<view>" --route <file> --into <corpus>`));
      }
      if (drawn.states.length || drawn.drawnStates.length) {
        const made = drawn.drawnStates.length + 1;
        const left = drawn.states.length;
        console.log(
          pc.dim(
            `  drew ${made} state${made === 1 ? "" : "s"}` +
              (left ? `; ${left} other${left === 1 ? "" : "s"} named but not drawn:` : "")
          )
        );
        for (const st of drawn.drawnStates) console.log(pc.dim(`    ✓ ${st.label} — ${st.when}`));
        for (const st of drawn.states.slice(0, 6)) console.log(pc.dim(`    ${st}`));
      }
      if (parts.length)
        console.log(
          pc.dim(`  wired ${parts.length - drawn.undrawn.length} of ${parts.length} parts`) +
            (drawn.undrawn.length ? pc.yellow(`  — the drawing does not show ${drawn.undrawn.join(", ")}`) : "")
        );
      /**
       * ⛔ REGENERATING ONE OF THREE RENDERINGS AND SAYING NOTHING IS HOW A FILE COMES TO
       * CONTRADICT ITSELF.
       *
       * This writes `sketch_html`, `drawn_from` and `drawn_at`. It does NOT write the hand-drawn
       * ASCII `sketch`, and it does NOT touch `parts`. So a screen redrawn after its component was
       * replaced ends up holding the new HTML beside an ASCII sketch of the old screen and a parts
       * list naming controls that were deleted — in one file, with nothing saying which is current.
       *
       * That happened: a grid was redrawn from the panel that replaced it, and the ASCII sketch in
       * the same file went on showing "2 staged pricing edits" and a "Review and publish" button
       * that no longer exist. Peter asked "why didn't moved properly regenerate?" — the honest
       * answer is that `draw` does not fully regenerate either, and until it does, it has to say so
       * at the moment it half-does.
       */
      /**
       * ⛔ THE SKETCH IS NO LONGER ON THIS LIST, because this now writes it. What is left is the
       * parts list, which is still somebody's to keep — and when a component is replaced wholesale,
       * every part in it is a control that no longer exists. Saying so is the difference between a
       * regenerated screen and a regenerated screen with a dead vocabulary attached.
       */
      void hasAscii;
      if (!o.dryRun && parts.length && drawn.undrawn.length === parts.length)
        console.log(
          pc.yellow("!"),
          `every declared part is missing from the new drawing — the parts list still describes the old screen, and this does not write it`
        );
      if (drawn.unresolved.length) {
        console.log(pc.yellow("!"), `${drawn.unresolved.length} thing${drawn.unresolved.length === 1 ? "" : "s"} it could not read, left marked in the drawing`);
        for (const u of drawn.unresolved.slice(0, 8)) console.log(pc.dim(`    ${u}`));
        if (drawn.unresolved.length > 8) console.log(pc.dim(`    …and ${drawn.unresolved.length - 8} more`));
      }
      if (o.dryRun) {
        console.log(pc.dim("\ndry run — nothing written"));
        return;
      }
      /**
       * ⛔ RECORD WHERE IT CAME FROM AND WHEN. The generator knew both and threw them away, which
       * is why nothing could say a screen had moved on — and a feature describing a screen somebody
       * had deleted that morning was invisible until two people read the source by hand.
       */
      const origin = repoOf(route);
      if (!origin) console.log(pc.yellow("!"), "the component is not in a git repository, so nothing records where this came from");
      const written = writeSketchHtml(
        into,
        scopeId,
        viewId,
        drawn.html,
        origin ? { from: path.relative(origin.root, route), at: origin.head } : undefined,
        drawn.text,
        drawn.drawnStates.map((st) => ({ when: st.when, label: st.label, html: st.html }))
      );
      if (!written) {
        console.error(pc.red("✗"), `no view "${viewId}" under "${scopeId}" in ${into}`);
        process.exit(1);
      }
      console.log(pc.dim(`  written into ${path.relative(process.cwd(), written)}`));
      console.log(pc.dim("  re-run this after the component changes — the drawing is output, not a document"));
    });

  cmd
    /**
     * ⛔ BLOCK UNTIL SOMETHING HAPPENS, RATHER THAN ASKING WHETHER IT HAS.
     *
     * Peter, after forty-odd empty checks: "we need a better way to monitor than to poll endlessly."
     * Polling was never the design — it was the only thing available for a PUBLISHED page, whose
     * database can only be read through the tool that published it. Nothing there can push, so each
     * tick costs a model call and reports nothing.
     *
     * A press on the served page writes to disk synchronously, so this waits on the filesystem and
     * prints one line per new act or note. Nothing is spent until something is recorded, and when it
     * is, the line says who did what.
     */
    .command("watch")
    .description("Wait, and print a line whenever somebody records an act or asks for a change")
    .option("--at <dir>", "corpus directory", "v2")
    .option("--replay", "print what is already recorded before waiting")
    .action(async (o: { at?: string; replay?: boolean }) => {
      const dir = at(o);
      console.log(pc.dim(`watching ${dir} — acts and notes only. nothing is printed until something is recorded.`));
      const { stopped, stop } = watchCorpus(dir, { replay: o.replay });
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      await stopped;
    });

  cmd
    /**
     * ⛔ WHAT THE INSTANCE THINKS YOU ARE. A client that cannot ask has to infer its permissions
     * from a refusal it gets halfway through doing something — and the refusal that matters most
     * here is the one saying a token may never record a person's agreement.
     */
    .command("whoami")
    .description("What an instance thinks you are, and what it will let you do")
    .option("--at <dir|url>", "an instance URL", "v2")
    .option("--token <t>", "bearer token (or $PRODUCTOS_TOKEN)")
    .action(async (o: { at?: string; token?: string }) => {
      if (!looksLikeInstance(o.at)) {
        console.log(pc.dim(`${at(o)} is a directory — there is nobody to be. Point --at at an instance URL.`));
        return;
      }
      const inst = instanceOf(o.at!, o.token);
      try {
        const me = (await remoteWhoami(inst)) as { kind: string; actor: string; scopes: string[] };
        const now = (await remotePresence(inst)) as { working: Array<{ session: string; at: string }>; waiting: number };
        console.log(`${pc.bold(me.actor)} ${pc.dim(`(${me.kind})`)} — may: ${me.scopes.join(" · ") || pc.red("nothing")}`);
        if (me.kind === "token")
          console.log(
            pc.dim("  ⛔ a token can never record that a person agreed. It may author, it may land a default as `agent`,")
          );
        if (me.kind === "token") console.log(pc.dim("     and it may carry a press somebody actually made — never mint one."));
        console.log(pc.dim(`  ${now.working.length} session(s) working · ${now.waiting} request(s) waiting`));
      } catch (e) {
        console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });

  cmd
    /**
     * ⛔ THE SESSION'S HALF OF THE LOOP, ON THE TERMINAL TOO.
     *
     * The same read MCP offers, so what a session sees and what a person can check are one thing.
     * A loop whose state could only be inspected through the interface that consumes it is a loop
     * nobody can debug when it goes quiet — and going quiet is exactly the failure that matters.
     */
    .command("inbox")
    .description("What has happened since a given position — presses, answered questions, and notes still owed")
    .option("--at <dir|url>", "corpus directory, or an instance URL", "v2")
    .option("--token <t>", "bearer token for an instance (or $PRODUCTOS_TOKEN)")
    .option("--since <n>", "the last position handled", (v) => Number(v), 0)
    .option("--claim <session>", "lease the notes this hands back, as this session")
    .option("--limit <n>", "most events in one answer", (v) => Number(v))
    .option("--json", "the whole answer, for a relay rather than a person")
    .action(async (o: { at?: string; token?: string; since?: number; claim?: string; limit?: number; json?: boolean }) => {
      /**
       * ⛔ THE INBOX IS NOT MIRRORED. Reading it CLAIMS the work in it, so answering from a
       * scratch copy would hand a session a lease that exists on this machine and nowhere else —
       * two sessions would then both believe they held the same note.
       */
      const r = looksLikeInstance(o.at)
        ? await (async () => {
            try {
              return (await remoteInbox(instanceOf(o.at!, o.token), { since: o.since, claim: o.claim, limit: o.limit })) as ReturnType<typeof inbox>;
            } catch (e) {
              console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
              process.exit(1);
            }
          })()
        : inbox(at(o), { since: o.since, claim: o.claim, limit: o.limit });
      if (o.json) return console.log(JSON.stringify(r, null, 2));
      if (!r.events.length && !r.held.length)
        return console.log(pc.dim(`nothing since ${o.since ?? 0} — the log is at ${r.head}`));
      for (const e of r.events) {
        const owed = e.work ? pc.yellow(`  ← owes work: ${e.work}`) : "";
        console.log(`${pc.dim(String(e.seq).padStart(4))}  ${lineFor(e)}${owed}`);
      }
      /**
       * ⛔ PRINTED, NOT OMITTED. An empty inbox and one another session is working through look
       * identical otherwise, and they call for opposite behaviour.
       */
      for (const h of r.held)
        console.log(pc.dim(`${String(h.seq).padStart(4)}  ${h.work} — being worked on by ${h.by} until ${h.until}`));
      console.log(
        pc.dim(
          `\n  head ${r.head} · resume from ${r.next_cursor} after a restart${
            r.next_cursor < r.head ? ` — ${r.head - r.next_cursor} event(s) still carry unfinished work` : ""
          }${r.more ? " · more to read" : ""}`
        )
      );
    });

  /**
   * ⛔ `notes` reads by default; `notes add` and `notes done` hang off it.
   */
  const noteCmd = cmd
    /**
     * ⛔ THE REQUESTS SOMEBODY MADE, WHICH ARE NOT DECISIONS.
     *
     * Kept separate from `acts` because the two lists answer different questions: `acts` is what a
     * person is asked to judge, this is what a person has asked somebody to change. Reported
     * together they would read as one backlog, and a request would look like a decision owed.
     */
    .command("notes")
    .description("What people have asked to be changed, and what they were looking at")
    .option("--all", "include the ones already dealt with")
    .option("--at <dir>", "corpus directory", "v2")
    .action((o: { all?: boolean; at?: string }) => {
      const corpus = loadCorpus(at(o));
      warnIfBroken(corpus);
      const notes = corpus.notes.filter((n) => o.all || n.state === "open");
      if (!notes.length) {
        console.log(pc.dim(o.all ? "no notes at all" : "nothing open — nobody has asked for a change"));
        return;
      }
      console.log(pc.bold(`${notes.length} ${o.all ? "notes" : "open"}`));
      for (const n of notes) {
        console.log("");
        console.log(
          `  ${pc.cyan(n.about)} ${pc.dim(`— ${n.by} on ${n.at}, ${n.via}`)}` +
            (n.kind === "framework" ? ` ${pc.yellow("framework")}` : "")
        );
        for (const l of n.says.split("\n")) console.log(`    ${l}`);
        /**
         * ⛔ THE CONVERSATION READS HERE NOW. It used to render above the composer on the page, and
         * Peter had it removed — *"the history of messages on a screen is unnecessary, the one right
         * above the send button"*. He is right that a log does not belong there; the replies
         * themselves still have to be readable somewhere, and a reply nothing ever shows is a reply
         * that was never sent.
         */
        for (const r of n.replies ?? []) console.log(pc.dim(`    ${pc.bold(r.by)} ${r.says}`));
        if (n.state === "done") console.log(pc.dim(`    ✓ ${n.outcome}`));
      }
      console.log("");
      console.log(pc.dim("  these change nothing on their own — each needs somebody to author the change"));
    });

  noteCmd
    /**
     * ⛔ THE CARRY-IN FOR A PUBLISHED PAGE.
     *
     * A published page's panel writes to the artifact's own database, because a strict CSP stops it
     * reaching the machine the corpus lives on. Without this command that row was a dead end: it
     * could be read back and never filed, so the one surface Peter actually reviews in could collect
     * requests that went nowhere. See WATCHING_PRESSES.md.
     */
    .command("add")
    .description("File a request somebody made — including one carried in from a published page")
    .argument("<says>", "what should change")
    .requiredOption("--about <ref>", "what they were looking at")
    .requiredOption("--by <who>", "who asked")
    .option("--via <how>", `how they asked: ${VIA.join(" | ")}`, "chat")
    .option("--on <date>", "the day they asked (a carried-in row already has one)")
    .option("--id <id>", "the id of the row this was carried in under, so carrying it twice files one note")
    /**
     * ⛔ NO `--at` HERE. The parent declares it; declaring it again is what made the value vanish.
     * `optsWithGlobals` reads it whichever side of the verb it was typed.
     */
    .action(async (says: string, o: { about: string; by: string; via?: string; on?: string; id?: string }, self: Command) => {
      const g = self.optsWithGlobals() as { at?: string; token?: string };
      if (looksLikeInstance(g.at)) {
        try {
          const r = (await remoteNote(instanceOf(g.at!, g.token), o.about, says, o.by)) as Outcome | Refused;
          return report(r);
        } catch (e) {
          console.error(pc.red("✗"), e instanceof Error ? e.message : String(e));
          process.exit(1);
        }
      }
      if (!VIA.includes(o.via as Via)) {
        console.error(pc.red("✗"), `"${o.via}" is not a way somebody could have asked`);
        console.error(pc.dim(`  ${VIA.join(" · ")}`));
        process.exit(1);
      }
      const r = fileNote(at(self.optsWithGlobals()), {
        about: o.about,
        says,
        by: o.by,
        via: o.via as Via,
        at: o.on ?? new Date().toISOString().slice(0, 10),
        id: o.id,
      });
      if (!r.ok) {
        console.error(pc.red("✗"), r.why);
        for (const d of r.detail ?? []) console.error(pc.dim(`  ${d}`));
        process.exit(1);
      }
      console.log(pc.green("✓"), `${r.said} — ${pc.dim(r.note.id)}`);
      console.log(pc.dim("  this changes nothing on its own. author the change, then close it saying what you did."));
    });

  noteCmd
    /**
     * ⛔ THE REPLY THAT DOES NOT CLOSE ANYTHING.
     *
     * Peter: *"let's add a 2-way window so you can send messages back as well"*. `done` was the
     * only thing that could be said in reply, and it ends the request — so a question, a progress
     * line, or "this is a framework gap and here is why" had to be said somewhere he is no longer
     * looking.
     */
    .command("say")
    .description("Reply on a request, without deciding it is finished")
    .argument("<id>")
    .requiredOption("--says <what>", "what to tell them")
    .option("--by <who>", "who is replying", "claude")
    .action((id: string, o: { says: string; by?: string }, self: Command) => {
      const r = replyToNote(at(self.optsWithGlobals()), id, o.by ?? "claude", o.says);
      if (!r.ok) {
        console.error(pc.red("✗"), r.why);
        for (const d of r.detail ?? []) console.error(pc.dim(`  ${d}`));
        process.exit(1);
      }
      console.log(pc.green("✓"), r.said);
      console.log(pc.dim("  it is still open — close it with: productos v2 notes done " + id + ' --outcome "…"'));
    });

  noteCmd
    .command("done")
    .description("Close a request, saying what was done about it")
    .argument("<id>")
    .requiredOption("--outcome <what>", "what actually happened — including \"we are not doing this\"")
    .action((id: string, o: { outcome: string }, self: Command) => {
      const r = closeNote(at(self.optsWithGlobals()), id, o.outcome);
      if (!r.ok) {
        console.error(pc.red("✗"), r.why);
        for (const d of r.detail ?? []) console.error(pc.dim(`  ${d}`));
        process.exit(1);
      }
      console.log(pc.green("✓"), r.said);
    });

  cmd
    .command("reset")
    .description("Restore a corpus from the pristine seed, so every run starts identical")
    .option("--at <dir>", "corpus directory to restore INTO", "v2")
    .option("--from <dir>", "the pristine seed", "v2-seed")
    .action((o: { at?: string; from?: string }) => {
      // The destination may not exist yet — reset does its own, stricter check below.
      const dest = at(o, false);
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

/**
 * Draw every screen in a corpus, working out each one's component itself.
 *
 * ⛔ THE REPORT IS THE POINT AS MUCH AS THE DRAWING. A sweep that quietly draws what it can and
 * says nothing about the rest leaves a corpus that looks fully generated and is not — which is the
 * state this whole change exists to end. So every screen lands in exactly one column, and the ones
 * it would not resolve say why, in words somebody can act on.
 */
/**
 * Take the style snapshot into the corpus.
 *
 * ⛔ IT WRITES A DOCUMENT, NOT A CACHE. `style.yaml` travels with the corpus into the store, into a
 * packet and into an export, because the thing that has to look like the product is wherever the
 * corpus is read — and hosted, that is a container with no repository in it.
 */
function takeStyle(into: string, wear?: string | null): void {
  const file = path.join(into, "style.yaml");
  const had = styleAt(into);
  /**
   * ⛔ `--wear` ALONE CHANGES THE CHOICE AND NOTHING ELSE. Re-reading 800 KB of somebody's build
   * output to record a one-word decision would make choosing a theme depend on having a checkout,
   * which is the whole thing this stopped requiring.
   */
  if (wear !== undefined && had) {
    const worn = wearTheme(had, wear);
    fs.writeFileSync(file, YAML.stringify({ style: worn }, { lineWidth: 0 }));
    console.log(
      pc.green("  ✓"),
      worn.theme ? `now wearing ${pc.cyan(worn.theme)}` : "now unthemed — the fallback colours, which is what an unthemed product ships",
    );
    return;
  }
  const style = wearTheme(snapshotStyle(into, new Date().toISOString().slice(0, 10), had), wear ?? had?.theme ?? null);
  if (!style.css) {
    /**
     * ⛔ NOT WRITTEN EMPTY. An empty snapshot and no snapshot render identically, and `check` can
     * only tell somebody which they have if the two are different on disk.
     */
    console.log(pc.yellow("  !"), "no stylesheets are configured, so there is nothing to carry — see web.stylesheets");
    return;
  }
  fs.writeFileSync(file, YAML.stringify({ style }, { lineWidth: 0 }));
  const kb = Math.round(style.css.length / 1024);
  console.log(
    pc.green("  ✓"),
    `${style.sources.length} stylesheet${style.sources.length === 1 ? "" : "s"}, ${style.faces.length} face${
      style.faces.length === 1 ? "" : "s"
    }, ${kb} KB${style.theme ? ` — wearing ${pc.cyan(style.theme)}` : ""}`
  );
  if (!style.theme && style.offers.length)
    console.log(pc.dim(`      offers ${style.offers.join(", ")} and nothing chose one — productos v2 style --wear <scheme>`));
  for (const u of style.unreachable.slice(0, 3))
    console.log(pc.yellow("      !"), `${u} could not travel — the type there is not the product's`);
  if (style.unreachable.length > 3)
    console.log(pc.dim(`      …and ${style.unreachable.length - 3} more`));
}

/**
 * The file a view says it was drawn from, found where THIS checkout keeps it.
 *
 * ⛔ A RECORDED ROUTE OUTLIVES THE TREE IT WAS RECORDED IN, AND HAS TO.
 *
 * One screen in the bilrost corpus carried
 * `../../../../../../private/tmp/…/scratchpad/dev-tree/frontend/app/components/fannie-sizer/RentRollPresentation.tsx`
 * — written by a session that drew from a temporary copy of the repository. The file it names is
 * real and still in the repo; the path to it died with that directory. So the sweep could not
 * resolve it, fell through to matching on labels, failed that too, and left the screen frozen at
 * whatever had been drawn months earlier: 117 hatched placeholders, no icons, none of the fixes
 * since. It was the single worst screen in the corpus and nothing could reach it.
 *
 * Longest suffix that exists wins, so `frontend/app/components/…/X.tsx` is found whatever absolute
 * prefix was in front of it. Tried from the longest end, so a short tail like `page.tsx` can only
 * match after every longer and more specific one has failed.
 */
function routeHere(repoRoot: string, recorded: string): string | undefined {
  const direct = path.resolve(repoRoot, recorded);
  if (fs.existsSync(direct)) return direct;
  const parts = recorded.split(/[\\/]+/).filter((p) => p && p !== "." && p !== "..");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = path.resolve(repoRoot, parts.slice(i).join("/"));
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function drawEverything(into: string, dryRun: boolean): void {
  /**
   * ⛔ BOTH TREES, OR THE ONE NOBODY SWEEPS QUIETLY ROTS. A repo can hold an Exchange corpus under
   * `truth/` and a products corpus under `productos/products/`, and this read only the first — so
   * the second kept whatever an older `draw` left in it, rendering component names as body text on
   * a page somebody was reviewing. A corpus with neither is still an error; a corpus with one is
   * not.
   */
  let corpus;
  let readFailed: string | undefined;
  try {
    corpus = loadCorpus(into);
  } catch (e) {
    readFailed = (e as Error).message;
  }

  let repoRoot = into;
  let componentsDir: string | undefined;
  try {
    const paths = resolvePathsOrThrow(into);
    repoRoot = path.dirname(path.dirname(paths.configFile));
    const cfg = readConfig(paths);
    componentsDir = cfg.web.components_dir;
  } catch {
    /* a corpus with no config still gets swept — it just searches from where it sits */
  }

  const views: Array<{ scope: string; view: View; root?: string }> = [
    ...(corpus ? everyView(corpus) : []),
    ...everyViewV1(repoRoot),
  ];
  if (!views.length) {
    console.error(pc.red("✗"), `cannot read a corpus at ${into}${readFailed ? `: ${readFailed}` : ""}`);
    process.exit(1);
  }
  const drew: string[] = [];
  const redrew: string[] = [];
  const stuck: Array<{ ref: string; why: string; detail: string; candidates?: Array<{ file: string; matched: number }> }> = [];

  for (const { scope, view, root: viewRoot } of views) {
    const ref = `${scope}#${view.id}`;
    /**
     * ⛔ A SCREEN THAT IS NOT BUILT YET CANNOT BE DRAWN FROM CODE, and saying so is not a failure.
     * Refusing here would make `intended` unusable, and a model that punishes somebody for
     * describing a screen before it exists is a model that gets described after the fact.
     */
    if (view.exists === "intended" || view.exists === "withdrawn") continue;

    /** Already knows where it comes from: redraw it, so a sweep keeps the corpus current. */
    let route: string | undefined;
    let evidence = "";
    const remembered = view.drawn_from ? routeHere(repoRoot, view.drawn_from) : undefined;
    if (remembered) {
      route = remembered;
    } else {
      /**
       * ⛔ SEARCHED WIDER THAN `components_dir`. The screen that proved this resolver — the deals
       * list — is rendered by a route page, not a component, and holds five of five of its labels.
       * A search limited to the configured components directory would have missed it and reported
       * the corpus as unresolvable.
       */
      const roots = [componentsDir, "."].filter(Boolean) as string[];
      const r = resolveRoute(view, { repoRoot, searchRoots: roots });
      if (!isResolved(r)) {
        stuck.push({ ref, why: r.why, detail: r.detail, candidates: r.candidates });
        continue;
      }
      route = path.resolve(repoRoot, r.file);
      evidence = `${r.matched.length}/${r.of} of what it says`;
    }

    const parts = view.parts ?? [];
    let drawn;
    try {
      drawn = drawFromRoute(route, { componentsDir: componentsDir ? path.resolve(repoRoot, componentsDir) : undefined, parts });
    } catch (e) {
      stuck.push({ ref, why: "no-candidate", detail: `could not read ${path.relative(repoRoot, route)}: ${(e as Error).message}` });
      continue;
    }
    if (!drawn.html.trim()) {
      stuck.push({ ref, why: "no-candidate", detail: `nothing could be read out of ${path.relative(repoRoot, route)}` });
      continue;
    }

    const line = `${ref}  ←  ${path.relative(repoRoot, route)}${evidence ? pc.dim(`  (${evidence})`) : ""}`;
    if (dryRun) {
      (view.drawn_from ? redrew : drew).push(line);
      continue;
    }
    const origin = repoOf(route);
    const written = writeSketchHtml(
      // ⛔ The tree this view came out of, which is not always the one the sweep was aimed at.
      viewRoot ?? into,
      scopeId(scope),
      view.id,
      drawn.html,
      origin ? { from: path.relative(origin.root, route), at: origin.head } : undefined,
      drawn.text,
      drawn.drawnStates.map((st) => ({ when: st.when, label: st.label, html: st.html }))
    );
    if (!written) {
      stuck.push({ ref, why: "no-candidate", detail: "the corpus would not take the drawing" });
      continue;
    }
    (view.drawn_from ? redrew : drew).push(line);
  }

  const total = drew.length + redrew.length + stuck.length;
  console.log(pc.green("✓"), `${drew.length + redrew.length} of ${total} screens drawn from the code${dryRun ? pc.dim(" (nothing written)") : ""}`);
  for (const l of drew) console.log(pc.dim("  new    ") + l);
  for (const l of redrew) console.log(pc.dim("  redrew ") + l);
  if (stuck.length) {
    console.log("");
    console.log(pc.yellow(`${stuck.length} could not be resolved — each one says why, and none was guessed:`));
    for (const s of stuck) {
      console.log(`  ${pc.yellow("?")} ${s.ref}`);
      console.log(pc.dim(`      ${s.detail}`));
      for (const c of s.candidates ?? []) console.log(pc.dim(`      closest: ${c.file} (${c.matched})`));
    }
    console.log(pc.dim("\n  name one by hand with: productos v2 draw \"<scope>#<view>\" --route <file> --into <corpus>"));
  }
}

/** A scope id as the corpus files hold it. */
function scopeId(id: string): string {
  return id;
}


/**
 * A screen generated from the truth — one view, or every view that has no picture.
 *
 * ⛔ ONE BODY, TWO CALLERS: the `propose` command and the single `generate` pass. Two copies is two
 * behaviours the day somebody fixes one of them, which is the defect this codebase keeps finding in
 * itself.
 */
function proposeScreens(into: string, ref?: string): void {
      
      let repoRoot = into;
      let componentsDir: string | undefined;
      let designDir: string | undefined;
      try {
        const paths = resolvePathsOrThrow(into);
        repoRoot = path.dirname(path.dirname(paths.configFile));
        const web = readConfig(paths).web;
        componentsDir = web.components_dir ? path.resolve(repoRoot, web.components_dir) : undefined;
        /** ⛔ The product's own vocabulary, where it has one — see `idiomOf`. */
        designDir = web.design_system ? path.resolve(repoRoot, web.design_system) : undefined;
      } catch {
        componentsDir = undefined;
        designDir = undefined;
      }
      const corpus = loadCorpus(into);
      const idiom = idiomOf(componentsDir, designDir);
      if (designDir) {
        const ds = indexDesignSystem(designDir);
        if (ds?.pieces.length)
          console.log(
            pc.dim(`  built from ${path.basename(designDir)} — ${ds.pieces.length} parts of the product's own vocabulary`)
          );
        else console.log(pc.yellow("!"), `nothing readable in ${designDir} — falling back to what the app's components imply`);
      }
      const targets = everyView(corpus).filter((x) =>
        !ref ? !x.view.sketch_html && !x.view.sketch : ref === `${x.scope}#${x.view.id}`
      );
      if (!targets.length) {
        console.error(pc.red("✗"), !ref ? "every screen already has a picture" : `no screen "${ref}"`);
        process.exit(1);
      }
      console.log(
        pc.dim(
          idiom.from.length
            ? `  idiom learned from ${idiom.from.length} of this app's own components`
            : "  no components directory configured — using plain markup"
        )
      );
      /**
       * ⛔ SAID ONCE, FOR THE RUN. Every proposed screen carries the habits that shaped it, and
       * repeating them per screen would bury the one line somebody needs: that this run was shaped
       * by something other than the truth and the app's own idiom.
       */
      const steering = inEffect(corpus.steers);
      if (steering.length)
        console.log(
          pc.dim(`  shaped by ${steering.length} ${steering.length === 1 ? "habit" : "habits"} this project has learned: ${steering.map((st) => st.id).join(", ")}`)
        );
      let made = 0;
      for (const { scope, view } of targets) {
        const { html, placed } = proposeScreen(view, idiom, corpus.steers);
        if (!placed) {
          console.log(pc.yellow("?"), `${scope}#${view.id} — declares no parts, so there is nothing to place. Give it its parts.`);
          continue;
        }
        if (!writeSketchHtml(into, scope, view.id, html)) {
          console.log(pc.red("✗"), `${scope}#${view.id} — the corpus would not take it`);
          continue;
        }
        made++;
        console.log(pc.green("✓"), `${scope}#${view.id}  ${pc.dim(`${placed} part(s) placed`)}`);
      }
      if (made) console.log(pc.dim(`\n  ${made} screen(s) generated from the truth. Re-run after the parts or the design system change — these are output.`));
}

/** Work out the graph from the truth, and write the part of it the model allows to be written. */
function connectAll(into: string, dryRun: boolean): void {
      
      const corpus = loadCorpus(into);
      const { made, missed } = inferConnections(corpus);

      console.log(pc.green("✓"), `${made.length} connection${made.length === 1 ? "" : "s"} the corpus already implies`);
      for (const c of made) {
        console.log(`  ${c.from}  →  ${pc.bold(c.to)}`);
        console.log(pc.dim(`      because both say: ${c.because.join(", ")}${c.runnerUp ? ` (next best: ${c.runnerUp.to})` : ""}`));
      }
      /**
       * ⛔ WHAT IT WOULD NOT SAY, AND WHY — because a graph that quietly connects what it is sure of
       * reads as a complete map. Most controls act on the screen they are on and correctly have no
       * destination; that is a finding, not a gap.
       */
      if (missed.length) {
        const byWhy = new Map<string, number>();
        for (const m of missed) byWhy.set(m.why, (byWhy.get(m.why) ?? 0) + 1);
        console.log("");
        console.log(pc.dim(`${missed.length} left alone:`));
        for (const [why, n] of byWhy) console.log(pc.dim(`  ${n} · ${why}`));
      }
      if (dryRun || !made.length) return;

      /**
       * ⛔ ONLY A CONTROL THAT NAVIGATES MAY CARRY A LINK, AND THE MODEL WAS RIGHT ABOUT IT.
       *
       * Writing `leads_to` onto "New Deal" made the corpus refuse to load: a part that COMMITS does
       * work, and where it lands afterwards belongs to its answer slot rather than to a link. That
       * rule is not in the way of a walkable prototype — it says where the walk is written down.
       *
       * So a navigating control gets the line; a committing one keeps its destination DERIVED, and
       * the page reads it from the same inference at render time. Nothing is stored that the model
       * refuses, and nothing is lost.
       */
      let wrote = 0;
      const derived: Connection[] = [];
      for (const c of made) {
        const [scopeId, viewId, partId] = c.from.split("#");
        const part = corpus.scopes
          .find((x) => x.scope.id === scopeId)
          ?.scope.views.find((v) => v.id === viewId)
          ?.parts.find((p) => p.id === partId);
        if (part?.role === "navigates") {
          if (writeLeadsTo(into, c.from, c.to)) wrote++;
        } else derived.push(c);
      }
      console.log("");
      if (wrote) {
        console.log(pc.green("✓"), `${wrote} written onto the control that navigates`);
        console.log(pc.dim("  a decision, not an agreement — change any line that is wrong, and it stays changed"));
      }
      if (derived.length) {
        console.log(pc.cyan("⤳"), `${derived.length} left derived — these controls COMMIT, and where they land belongs to their answer slot, not to a link`);
        for (const c of derived) console.log(pc.dim(`    ${c.from} → ${c.to}`));
        console.log(pc.dim("  the prototype walks them from this same reading, so nothing is lost by not writing them down"));
      }
}
