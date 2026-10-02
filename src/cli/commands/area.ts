import { Command } from "commander";
import pc from "picocolors";
import { resolvePathsOrThrow } from "../../core/paths.js";
import { listAreas, listProducts, walkGroups, groupFeatures } from "../../core/product.js";
import { buildAreaFlowGraph, renderAscii as renderFlowAscii } from "../../core/flowchart.js";
import { auditArea, renderAreaAuditAscii } from "../../core/audit.js";

/**
 * `productos area <slug>` — area-level overview: features, cross-feature
 * flow chart, audit roll-up. Mirrors the area page in the web renderer
 * for terminal use.
 */
export function areaCommand(): Command {
  return new Command("area")
    .description("Show an area's features, cross-feature flow, and audit roll-up")
    .argument("[slug]", "Area slug like 'wallet'. Omit to list areas.")
    .action((slug?: string) => {
      const paths = resolvePathsOrThrow();
      const areas = listAreas(paths);

      if (!slug) {
        if (areas.length === 0) {
          console.log(pc.dim("No areas yet."));
          return;
        }
        // ⛔ Print the tree, not a flat list. Areas nest, so a flat list of slugs
        // leaves `pricing` and `pricing/agency` looking like peers and gives no way
        // to see that one is inside the other.
        console.log(pc.bold("Areas:"));
        for (const product of listProducts(paths)) {
          console.log(`  ${pc.bold(pc.cyan(product.slug))}  ${pc.dim(product.title)}`);
          walkGroups(product.groups, (g) => {
            const n = groupFeatures(g).length;
            const indent = "  ".repeat(g.depth);
            const label = g.segments.slice(1).join("/");
            console.log(
              `  ${indent}${pc.cyan(label.padEnd(Math.max(4, 26 - indent.length), " "))}  ${
                g.title
              }  ${pc.dim(`(${n} feature${n === 1 ? "" : "s"}${g.groups.length ? `, ${g.groups.length} sub-area${g.groups.length === 1 ? "" : "s"}` : ""})`)}`
            );
          });
        }
        console.log("");
        console.log(pc.dim("productos area <slug> for an overview — the slug is the path below the product, e.g. pricing/agency."));
        return;
      }

      // Accept either the path below the product (`pricing/agency`) or the full id
      // (`cre/pricing/agency`), because both are what a reader has in front of them.
      const area =
        areas.find((a) => a.slug === slug) ??
        areas.find((a) => `${a.product}/${a.slug}` === slug);
      if (!area) {
        console.error(pc.red("✗"), `No area "${slug}". Known: ${areas.map((a) => a.slug).join(", ") || "(none)"}`);
        process.exit(1);
      }

      console.log("");
      console.log(pc.bold(pc.cyan(area.title)) + pc.dim(`  ${area.slug}/`));
      console.log(pc.dim(`  ${area.features.length} feature${area.features.length === 1 ? "" : "s"}`));

      // Flow across the area
      const flowGraph = buildAreaFlowGraph(area);
      if (flowGraph.has_flow) {
        console.log("");
        console.log(pc.bold("  Flow across this area:"));
        console.log("");
        console.log(renderFlowAscii(flowGraph, { stripIdPrefix: `${area.slug}/` }));
      }

      // Features list
      if (area.features.length > 0) {
        console.log("");
        console.log(pc.bold("  Features:"));
        for (const f of area.features) {
          const cnt = f.frontmatter.behaviors.length;
          console.log(
            `    ${pc.cyan(f.frontmatter.id.padEnd(30, " "))}  ${f.frontmatter.title}  ${pc.dim(`(${cnt} behavior${cnt === 1 ? "" : "s"})`)}`
          );
        }
      }

      // Audit roll-up
      console.log("");
      console.log(pc.bold("  ─── Audit roll-up ──────────────────────────────────────"));
      console.log("");
      const summary = auditArea(area.slug, area.features);
      console.log(renderAreaAuditAscii(summary));
      console.log("");
      if (summary.totals.total > 0) {
        console.log(pc.dim(`  productos review <feature_id> to drill into a specific feature's findings.`));
      }
      console.log("");
    });
}
