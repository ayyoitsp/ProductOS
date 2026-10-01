/**
 * ⛔ THE AGENT TREE, RENDERED FROM THE REGISTRY — because a document nobody generates is a document
 * that disagrees with the code within a week.
 *
 * Peter: "draw out our agent tree? let's keep a dedicated doc showing what agents we have."
 *
 * A dedicated doc is the right thing to want and the wrong thing to type. Everything in it already
 * exists as data in `core/jobs.ts`: what each agent asks, why it exists, what it reads, what counts
 * as a finding, what it may never do. Typing a second copy makes two records of one fact, and the
 * typed one wins because it is the one people read — until it is wrong, which nothing detects.
 *
 * So this renders it, a test asserts the committed file still matches, and changing an agent
 * changes the doc or fails the build.
 */
import {
  AGENTS,
  AREAS,
  AUTHORS,
  CASCADE,
  COMMANDS,
  KINDS,
  LAYERS,
  SHIMS,
  type Agent,
  type Shim,
} from "./jobs.js";
/**
 * ⛔ THE PRESET, WRITTEN INTO THE SKILL THAT RUNS IT — because `instruct` is the layer that gets
 * skipped, and a routing table nothing reads is a routing table nobody follows.
 *
 * Peter: *"so like a tree, for the old skills like 'align' or 'exchange', we have a preset for
 * which agents to orchestrate consistently"*. The registry is where the preset LIVES; this is how
 * it reaches the only place a future session will actually look. Generated between markers, so the
 * rest of a skill stays hand-authored and the preset can never drift from the tree.
 */
export const PRESET_OPEN = "<!-- productos:preset -->";
export const PRESET_CLOSE = "<!-- /productos:preset -->";

export function presetBlock(shim: Shim): string {
  const out: string[] = [PRESET_OPEN];
  out.push("## ⛔ The preset — which roles this skill orchestrates");
  out.push("");
  out.push("> **Generated from `src/core/jobs.ts` (`SHIMS`). Do not edit between the markers.**");
  out.push("> `productos v2 agents --presets` rewrites every skill, and a test fails if one drifts.");
  out.push("");
  out.push(
    "You are the **orchestrator**, and you are the session — not a subagent. That is not an " +
      "implementation detail: you are the only thing talking to the person, and talking to the " +
      "person is the one job that may never be delegated."
  );
  out.push("");
  if (shim.steps.length) {
    out.push("**Spawn these, in order:**");
    out.push("");
    for (const st of shim.steps)
      out.push(`- \`${st.role}\`${st.fan ? " — **one per unit, in parallel**" : ""} — ${st.why}`);
  } else {
    out.push("**Spawn nothing.** Every part of this is something you may not hand off.");
  }
  out.push("");
  out.push("**⛔ You keep these yourself, because they may not be delegated:**");
  out.push("");
  for (const k of shim.keeps) out.push(`- ${k}`);
  out.push("");
  out.push(
    "⛔ **Every author writes and none may settle.** An author may propose, populate, draw and " +
      "regenerate; it may never produce a verdict, answer an open question, or mark anything walked " +
      "or validated. None of them can put a question to a person — deliberately, because consent " +
      "obtained inside a subagent has no record of how it was obtained. What an author cannot " +
      "resolve comes back to you as a question, and you put it to the person yourself."
  );
  out.push(PRESET_CLOSE);
  return out.join("\n");
}

/**
 * The skill's text with its preset current.
 *
 * ⛔ BETWEEN MARKERS, NEVER THE WHOLE FILE. A skill is mostly hand-authored — how to write a slot,
 * what belongs in `answer` rather than `may` — and regenerating all of it would delete the part
 * that took the longest to get right. Where no markers exist yet the block goes directly under the
 * first heading, which is where somebody reading the skill meets it before anything else.
 */
export function withPreset(body: string, shim: Shim): string {
  const block = presetBlock(shim);
  const open = body.indexOf(PRESET_OPEN);
  if (open !== -1) {
    const close = body.indexOf(PRESET_CLOSE, open);
    if (close === -1) throw new Error(`${shim.skill}: a preset block was opened and never closed`);
    return body.slice(0, open) + block + body.slice(close + PRESET_CLOSE.length);
  }
  const front = /^---\n[\s\S]*?\n---\n/.exec(body);
  let at = front ? front[0].length : 0;
  const heading = /^#[^#].*$/m.exec(body.slice(at));
  if (heading) at += heading.index + heading[0].length + 1;
  return `${body.slice(0, at)}\n${block}\n${body.slice(at)}`;
}


const bullet = (xs: string[]): string => xs.map((x) => `- ${x}`).join("\n");

/**
 * ⛔ THE TREE AS A DIAGRAM, because "tree" was the word and a list is not one. What it shows is the
 * only structure here that matters: every agent answers a question about the WHOLE map, which is
 * why none of them is scoped to a file and why a consistency question is answerable at all.
 */
function diagram(): string {
  const node = (a: Agent) => `  ${a.name.replace(/-/g, "_")}["${a.name}<br/><i>${a.asks.replace(/"/g, "'")}</i>"]`;
  /**
   * ⛔ BOTH HALVES, BECAUSE A DIAGRAM SHOWING ONLY THE REVIEWERS SAYS THE THING THAT WAS WRONG.
   *
   * For as long as this drew reviewers alone it was an accurate picture of a system in which
   * authoring had no role behind it — eight skills doing it serially in one context while five
   * reviewers stood ready to judge the result.
   */
  const author = (a: (typeof AUTHORS)[number]) =>
    `    ${a.name}["${a.name}<br/><i>${a.asks.replace(/"/g, "'")}</i>${a.each ? `<br/>· per ${a.each} ·` : ""}"]`;
  return [
    "```mermaid",
    "flowchart LR",
    "  subgraph AUTHORS_G[\"authors — every one writes, none may settle\"]",
    "    direction TB",
    ...AUTHORS.map(author),
    "  end",
    "  subgraph REVIEWERS[\"reviewers — each asks one question about the whole\"]",
    "    direction TB",
    ...AGENTS.map(node),
    "  end",
    "  subgraph MAP[\"the map — territory every role reads\"]",
    "    direction TB",
    ...AREAS.map((a) => `    ${a.name}["${a.name}<br/><i>${a.owns.join(", ")}</i>"]`),
    "  end",
    "  AUTHORS_G --> REVIEWERS",
    "  REVIEWERS --> MAP",
    "```",
  ].join("\n");
}

export function agentsDoc(): string {
  const out: string[] = [];
  out.push("# The roles");
  out.push("");
  out.push("> ⛔ **Generated from `src/core/jobs.ts`. Do not edit this file.**");
  out.push("> `productos v2 agents --out AGENTS.md` rewrites it, and a test fails if it drifts.");
  out.push("");
  out.push(
    "Two registries and one routing table. **Authors** write a corpus; **reviewers** judge one. " +
      "Every role answers a single question, and none is scoped to a file — the failure they exist " +
      "to catch is nobody owning *is this concept present everywhere it needs to be*, which is a " +
      "property of the whole and invisible from inside any one layer."
  );
  out.push("");
  out.push(
    "⛔ **Every reviewer judges and none may write. Every author writes and none may settle.** Two " +
      "interfaces, each with a required literal, so neither list can quietly acquire a member of " +
      "the other kind — and an agent's tools are derived from the capabilities it declares, so a " +
      "judge cannot be handed a writing tool and an author cannot be handed a question."
  );
  out.push("");
  out.push(
    "The two halves exist for the same reason, from opposite directions. A reviewer that repairs " +
      "what it finds hides how often it fires, and how often it fires is the only measure of " +
      "whether the model is holding. An author that settles what it wrote produces a corpus where " +
      "every question is answered and none of the answers is anybody's."
  );
  out.push("");
  out.push(diagram());
  out.push("");

  out.push("");
  out.push("## The tree — which roles each skill orchestrates");
  out.push("");
  out.push(
    "⛔ **The orchestrator is the session, and it cannot be a subagent.** It is the only thing " +
      "talking to the person, and talking to the person is the one job that may never be delegated. " +
      "So what is modelled here is not an orchestrating agent — it is the **routing**, declared, so " +
      "a session reads a table instead of deciding from memory which roles a request needs."
  );
  out.push("");
  out.push(
    "Same reason `CASCADE` is a table: a routing decided from memory is decided differently every " +
      "time, and the step that gets skipped is always the one nobody is watching. Here that step is " +
      "`keeps`. Spawning four agents and forgetting somebody still has to **agree** is exactly how " +
      "a corpus ends up fully written, fully checked, and validated by nobody."
  );
  out.push("");
  out.push("```mermaid");
  out.push("flowchart TD");
  for (const sh of SHIMS) {
    const id = sh.skill.replace(/-/g, "_");
    out.push(`  ${id}(["${sh.skill}<br/><i>${sh.does.replace(/"/g, "'")}</i>"])`);
    for (const st of sh.steps) out.push(`  ${id} --> ${id}_${st.role}["${st.role}${st.fan ? " ×N" : ""}"]`);
    out.push(`  ${id} -.->|keeps| ${id}_self(["the session — ${sh.keeps.length} thing${sh.keeps.length === 1 ? "" : "s"} it may not hand off"])`);
  }
  out.push("```");
  out.push("");
  for (const sh of SHIMS) {
    out.push("");
    out.push(`### \`${sh.skill}\``);
    out.push("");
    out.push(sh.does + ".");
    out.push("");
    if (sh.steps.length) {
      out.push("**Spawns, in order:**");
      out.push(bullet(sh.steps.map((st) => `\`${st.role}\`${st.fan ? " — one per unit, in parallel" : ""} — ${st.why}`)));
    } else {
      out.push("**Spawns nothing.** Every part of this is something the session may not hand off.");
    }
    out.push("");
    out.push("**⛔ Keeps, because it may not be delegated:**");
    out.push(bullet(sh.keeps));
  }

  out.push("");
  out.push("## The authors");
  out.push("");
  out.push(
    "⛔ **Every one writes. None may settle.** The exact mirror of the reviewers' rule, and it is " +
      "what makes this a model rather than a refactor. An author may propose, populate, draw and " +
      "regenerate. It may never produce a verdict, answer an open question, or mark anything walked " +
      "or validated — because a subagent that obtains consent is a consent path with no record of " +
      "how consent was obtained, which is the whole thing `Verdict.via` exists to prevent."
  );
  out.push("");
  out.push(
    "Held three ways rather than one: no author declares `ask-the-human`, so no host hands one a " +
      "question tool and the install refuses an author that asks for it; what an author cannot " +
      "resolve becomes a `question:` with no claim, which is writing something down and therefore " +
      "allowed; and anything an author does record carries `via: agent`, which never counts as " +
      "somebody having agreed."
  );
  out.push("");
  out.push(
    "**Skills are the shims.** A skill keeps the orchestration and the conversation with the person " +
      "— which is the part that may not be delegated — and spawns these for the reading and the " +
      "writing. The `per` column is what tells a skill whether to spawn one or thirty."
  );
  out.push("");
  out.push("| author | asks | per | writes |");
  out.push("|---|---|---|---|");
  for (const a of AUTHORS)
    out.push(`| **${a.name}** | ${a.asks} | ${a.each ?? "runs once"} | ${a.writes.join("; ")} |`);

  for (const a of AUTHORS) {
    out.push("");
    out.push(`### \`${a.name}\`${a.prompt ? "" : "  — ⛔ no prompt written yet"}`);
    out.push("");
    out.push(`**Asks:** ${a.asks}`);
    out.push("");
    out.push(`**Exists because:** ${a.because}`);
    out.push("");
    out.push(`**Spawned:** ${a.each ? `once per ${a.each}` : "once"}`);
    out.push("");
    out.push("**Reads, in this order:**");
    out.push(bullet(a.reads));
    out.push("");
    out.push("**Writes:**");
    out.push(bullet(a.writes));
    out.push("");
    out.push("**⛔ Never:**");
    out.push(bullet(a.never));
    out.push("");
    out.push(`**Needs:** ${a.needs.join(" · ")}${a.prompt ? `  ·  **Prompt:** \`${a.prompt}\`` : ""}`);
  }

  out.push("");
  out.push("## The reviewers");
  out.push("");
  out.push(
    "⛔ **None may write, and none may fix what it finds.** Run after a corpus is written, never " +
      "during. An author cannot review their own work, and after a few exchanges there is no reader " +
      "left in a session who has not been told the answer."
  );
  for (const a of AGENTS) {
    out.push("");
    out.push(`### \`${a.name}\`${a.prompt ? "" : "  — ⛔ no prompt written yet"}`);
    out.push("");
    out.push(`**Asks:** ${a.asks}`);
    out.push("");
    out.push(`**Exists because:** ${a.because}`);
    out.push("");
    out.push("**Reads, in this order:**");
    out.push(bullet(a.reads));
    out.push("");
    out.push("**A finding is:**");
    out.push(bullet(a.finds));
    out.push("");
    out.push("**⛔ Never:**");
    out.push(bullet(a.never));
    out.push("");
    out.push(`**Needs:** ${a.needs.join(" · ")}${a.prompt ? `  ·  **Prompt:** \`${a.prompt}\`` : ""}`);
  }

  out.push("");
  out.push("## The commands");
  out.push("");
  out.push(
    "⛔ **Generated from the registry, and a test walks the real CLI against it.** A declared list " +
      "nothing compares against `--help` is a second copy of `--help` that rots, which is the " +
      "failure mode of every document this project has deleted. The test fails both ways: a command " +
      "that exists and is declared nowhere, and a declaration the CLI no longer has."
  );
  out.push("");
  out.push(
    "What `--help` cannot tell you, and why this exists: **who** types it, and **which track** it " +
      "belongs to. *Never hand a human a flag* is a rule the skills state and nothing enforced — a " +
      "command marked `claude` appearing in instructions addressed to a person is now a visible " +
      "contradiction. And two parallel models have been running for months with nothing saying " +
      "which commands belong to which."
  );
  out.push("");
  const live = COMMANDS.filter((c) => c.track !== "v1");
  const old = COMMANDS.filter((c) => c.track === "v1");
  const rows = (xs: typeof COMMANDS): string[] => [
    "| command | does | layer | typed by |",
    "|---|---|---|---|",
    ...xs.map((c) => `| \`productos ${c.name}\` | ${c.does} | ${c.owns} | ${c.who === "claude" ? "the model" : c.who === "person" ? "**a person**" : "either"} |`),
  ];
  out.push(`### Current — ${live.length} commands`);
  out.push("");
  out.push(...rows(live));
  out.push("");
  out.push(`### v1 — ${old.length} commands, on the track the work moved off`);
  out.push("");
  out.push(
    "⛔ Still registered and still working. They are listed apart because the only thing that used " +
      "to distinguish them was knowing, and somebody reading the list is exactly who does not."
  );
  out.push("");
  out.push(...rows(old));

  out.push("");
  out.push("## The map they read");
  out.push("");
  out.push(
    "Territory, not ownership. Nobody is assigned an area — an agent reads this to know what " +
      "*everywhere* means, and a test asserts every layer is held exactly once and every file in the " +
      "track is on it. A file missing from the map is a place no agent will look."
  );
  out.push("");
  out.push("| area | layers | files |");
  out.push("|---|---|---|");
  for (const a of AREAS) out.push(`| **${a.name}** | ${a.owns.join(", ")} | ${a.files.map((f) => `\`${f}\``).join(" ")} |`);

  out.push("");
  out.push("## Where a change has to reach");
  out.push("");
  out.push(
    "`productos v2 change` routes a piece of feedback by its kind, and refuses to close while a " +
      "layer it must reach is unverified. The routing is a table rather than a judgement because the " +
      "layer skipped from memory is always the same one — `instruct`, the authoring instructions, " +
      "which is how a concept can be perfect in the schema and written by nobody."
  );
  out.push("");
  out.push("| kind of change | must reach |");
  out.push("|---|---|");
  for (const k of KINDS) out.push(`| **${k}** | ${CASCADE[k]!.join(" · ")} |`);
  out.push("");
  out.push(`All layers: ${LAYERS.map((l) => `\`${l}\``).join(" · ")}`);

  out.push("");
  out.push("## Which model runs each");
  out.push("");
  out.push(
    "⛔ **No agent names a model.** The spec says what an agent is for, what it must never do, and " +
      "which capabilities it needs; the project says who runs it. An adapter reads both at install " +
      "time and writes whatever the host wants — so the same reviewer runs under a different model " +
      "in a different repo, and a test fails if a model name ever appears in a definition."
  );
  out.push("");
  out.push("```yaml");
  out.push("# productos/config.yaml");
  out.push("agents:");
  out.push("  default_model: sonnet");
  out.push("  model:");
  out.push("    truthfulness: opus        # this one reads the code as well as the corpus");
  out.push("    consistency: opus");
  out.push("  effort:");
  out.push("    truthfulness: high");
  out.push("  off:");
  out.push("    architecture: reviewed by hand here — one promise per subsystem already");
  out.push("```");
  out.push("");
  out.push(
    "⛔ `off` **removes** the agent rather than skipping it. One left on disk from a previous " +
      "install is one the host can still run while the config says otherwise."
  );
  out.push("");
  const missing = AGENTS.filter((a) => !a.prompt);
  if (missing.length) {
    out.push(`## ⛔ ${missing.length} named here with no prompt written`);
    out.push("");
    out.push(bullet(missing.map((m) => `\`${m.name}\` — ${m.asks}`)));
    out.push("");
    out.push("Named so the absence is visible rather than implied.");
  }
  out.push("");
  return out.join("\n");
}
