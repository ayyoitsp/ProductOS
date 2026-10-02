import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listAllContainers, listProducts } from "../../core/product.js";
import { readTracking } from "../../core/tracking.js";
import {
  allContextSections,
  contextSectionState,
  type ContextSectionState,
} from "../../core/context.js";
import { buildWorklist, groupWorklist, type Decision } from "../../core/worklist.js";

/**
 * `productos next` — the questions waiting on a person, ranked, stated as questions.
 *
 * ⛔ EVERY OTHER SURFACE MAKES YOU GO LOOKING. A reader had to open a page, expand a panel
 * and read forty-two undifferentiated lines to find the one that was theirs. Peter, naming
 * it and generalising past this tool: *"instead of having them search for it… I want it
 * ready with questions, explanations as necessary, clearly explaining the question."*
 *
 * So: no prose to mine, no page to find. One question per entry, the facts needed to answer
 * it underneath, and what it costs to get wrong.
 */
export function nextCommand(): Command {
  return new Command("next")
    .description("The decisions waiting on you, ranked — each stated as a question")
    .option("-n, --limit <n>", "How many to show (default 5)", "5")
    .option("--all", "Show every open decision, not the top few")
    .option("--mine <who>", "Only questions owed by this person or role")
    .action((opts: { limit: string; all?: boolean; mine?: string }) => {
      const paths = resolvePathsOrThrow();
      const containers = listAllContainers(paths);
      const products = listProducts(paths).map((p) => p.slug);

      const contextStates = new Map<string, ContextSectionState>();
      const contextDocs: Array<{ doc: never; section: never; ref: string }> = [];
      const sections = allContextSections(paths, products);
      for (const [ref, { section, doc }] of sections) {
        contextStates.set(ref, contextSectionState(section, doc.sections?.[section.anchor]));
        contextDocs.push({ doc: doc as never, section: section as never, ref });
      }

      let list = buildWorklist(
        containers,
        (id) => readTracking(paths, id),
        contextStates,
        contextDocs as never
      );
      if (opts.mine) {
        const who = opts.mine.toLowerCase();
        list = list.filter((d) => (d.owedBy ?? "").toLowerCase().includes(who));
      }

      if (list.length === 0) {
        console.log(pc.green("✓"), "Nothing is waiting on a person. Every claim is accepted and nothing is undecided.");
        return;
      }

      const groups = groupWorklist(list);
      const limit = opts.all ? Infinity : Math.max(1, Number(opts.limit) || 5);
      let shown = 0;

      for (const g of groups) {
        if (shown >= limit) break;
        console.log("");
        console.log(pc.bold(g.title), pc.dim(`(${g.items.length})`));
        console.log(pc.dim(wrap(g.why, 86, "  ")));
        let inGroup = 0;
        for (const d of g.items) {
          if (shown >= limit) {
            console.log(pc.dim(`\n  … and ${g.items.length - inGroup} more here.`));
            break;
          }
          console.log("");
          printDecision(d);
          shown++;
          inGroup++;
        }
      }

      const remaining = list.length - shown;
      if (remaining > 0) {
        console.log(
          pc.dim(`\n${remaining} more waiting. \`productos next -n ${Math.min(remaining + shown, 25)}\` or \`--all\`.`)
        );
      }
    });
}

function printDecision(d: Decision): void {
  const tag =
    d.kind === "contradiction"
      ? pc.red("CONFLICT")
      : d.kind === "ambiguity"
        ? pc.yellow("TWO READINGS")
        : d.kind === "could-not-build"
          ? pc.red("COULD NOT BUILD")
          : d.kind === "undecided"
            ? pc.yellow("UNDECIDED")
            : d.kind === "unaccepted-rule"
              ? pc.cyan("RULE")
              : pc.cyan("CLAIM");

  const where = d.behavior ? `${d.container} · ${d.behavior}` : d.container;
  console.log(`  ${tag}  ${pc.dim(where)}${d.owedBy ? pc.dim(` · ${d.owedBy} owes the answer`) : ""}`);
  // The question, and it reads as one.
  for (const line of d.question.split("\n")) console.log(`  ${pc.bold(line.trim() ? line : "")}`);
  for (const c of d.context) console.log(pc.dim(wrap(c, 86, "    ")));
  if (d.stakes) console.log(pc.dim(wrap(`Cost of getting it wrong: ${d.stakes}`, 86, "    ")));
  console.log(`    ${pc.dim("→")} ${d.action}`);
}

/** Wrap so a long explanation stays readable in a terminal rather than one long line. */
function wrap(s: string, width: number, indent: string): string {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = indent;
  for (const w of words) {
    if (cur.length + w.length + 1 > width && cur.trim()) {
      lines.push(cur);
      cur = indent + w;
    } else {
      cur = cur.trim() ? `${cur} ${w}` : indent + w;
    }
  }
  if (cur.trim()) lines.push(cur);
  return lines.join("\n");
}
