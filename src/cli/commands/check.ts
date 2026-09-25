import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { checkConformance } from "../../core/conformance.js";
import { groupingAdvice } from "../../core/grouping.js";
import { listProducts, listCapabilities } from "../../core/product.js";
import { readConfig } from "../../core/config.js";

/**
 * `productos check` — does this corpus satisfy the model?
 *
 * Run it before asking anyone to review. It answers the question an author cannot
 * answer about their own work: is this the shape the documentation says it should be.
 */
export function checkCommand(): Command {
  return new Command("check")
    .description("Check the corpus against the model — run before asking anyone to review")
    .action(() => {
      const paths = resolvePathsOrThrow();
      const { problems, suggestions, highFindings } = checkConformance(paths);
      const advice = groupingAdvice(listProducts(paths), readConfig(paths).grouping, listCapabilities(paths));

      if (problems.length === 0 && highFindings.length === 0 && advice.length === 0 && suggestions.length === 0) {
        console.log(pc.green("✓"), "Corpus conforms to the model. Ready for review.");
        return;
      }

      if (problems.length) {
        console.log(
          pc.bold(pc.red(`\n${problems.length} structural problem${problems.length === 1 ? "" : "s"}`))
        );
        for (const p of problems) {
          console.log(`  ${pc.red("✗")} ${p.what}`);
          console.log(`    ${pc.dim(p.rule)}`);
        }
      }

      if (highFindings.length) {
        console.log(
          pc.bold(pc.red(`\n${highFindings.length} high audit finding${highFindings.length === 1 ? "" : "s"}`))
        );
        for (const f of highFindings) {
          console.log(
            `  ${pc.red("✗")} ${pc.cyan(f.feature_id)}${f.behavior_id ? "#" + f.behavior_id : ""} ${pc.dim(f.kind)}`
          );
          console.log(`    ${f.message.split("\n")[0]}`);
        }
      }

      if (suggestions.length) {
        console.log(
          pc.bold(pc.yellow(`\n${suggestions.length} thing${suggestions.length === 1 ? "" : "s"} worth a look`))
        );
        for (const s of suggestions) {
          console.log(`  ${pc.yellow("→")} ${s.what}`);
          console.log(`    ${pc.dim(s.rule)}`);
          if (s.where) console.log(`    ${pc.dim(s.where)}`);
        }
      }

      // ⛔ Advice, not a problem. Grouping is a judgement call — a corpus mid-growth
      // is legitimately lopsided, and failing the gate on shape would train people to
      // pass `--no-whatever` rather than read it. So it prints and never sets the code.
      if (advice.length) {
        console.log(
          pc.bold(pc.yellow(`\n${advice.length} grouping suggestion${advice.length === 1 ? "" : "s"}`))
        );
        for (const a of advice) {
          console.log(`  ${pc.yellow("→")} ${a.what}`);
          console.log(`    ${pc.dim(a.rule)}`);
          for (const c of a.clusters ?? []) {
            const name =
              c.members.length === 1
                ? pc.dim("stays here")
                : c.slug
                  ? pc.cyan(c.slug)
                  : pc.red("<name-this>");
            console.log(`      ${name}  ${pc.dim(c.because)}`);
            for (const m of c.members) console.log(`        ${pc.dim(m)}`);
          }
          for (const m of (a.moves ?? []).slice(0, 8)) console.log(`      ${pc.dim("$ " + m)}`);
        }
      }

      if (problems.length === 0 && highFindings.length === 0) {
        console.log(pc.dim("\nNothing structural to fix — the suggestions above are judgement calls."));
        return;
      }

      console.log(pc.dim("\nFix these before asking anyone to review the corpus."));
      process.exitCode = 1;
    });
}
