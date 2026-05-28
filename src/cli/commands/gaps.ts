import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listTruth } from "../../core/truth.js";

export function gapsCommand(): Command {
  return new Command("gaps")
    .description("Print gap summary")
    .option("--coverage", "Show only coverage gaps (default: both)")
    .option("--product", "Show only product gaps (default: both)")
    .action((opts: { coverage?: boolean; product?: boolean }) => {
      const showBoth = !opts.coverage && !opts.product;
      const paths = resolvePathsOrThrow();
      const docs = listTruth(paths);

      if (showBoth || opts.coverage) {
        const coverage: Array<{ kind: string; doc: typeof docs[number] }> = [];
        for (const d of docs) {
          const f = d.frontmatter;
          if (f.status === "stale") coverage.push({ kind: "staleness", doc: d });
          if (f.status === "validated" && !f.test_file) coverage.push({ kind: "no_test", doc: d });
          if (f.last_test_run?.result === "fail") coverage.push({ kind: "failing_test", doc: d });
        }
        console.log(pc.bold("Coverage gaps:"), coverage.length);
        for (const g of coverage) {
          console.log(`  ${pc.yellow(g.kind.padEnd(14))} ${pc.cyan(g.doc.frontmatter.id)}  ${truncate(g.doc.frontmatter.claim, 70)}`);
        }
        if (coverage.length === 0) console.log(pc.dim("  (none)"));
        console.log();
      }

      if (showBoth || opts.product) {
        const product = docs.filter((d) => d.frontmatter.status === "contested");
        console.log(pc.bold("Product gaps:"), product.length);
        for (const d of product) {
          console.log(`  ${pc.red("contested")}      ${pc.cyan(d.frontmatter.id)}  ${truncate(d.frontmatter.claim, 70)}`);
          for (const e of d.frontmatter.contested_by) {
            console.log(`    ${pc.dim("← " + e.source)} ${e.summary}`);
          }
        }
        if (product.length === 0) console.log(pc.dim("  (none)"));
      }
    });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
