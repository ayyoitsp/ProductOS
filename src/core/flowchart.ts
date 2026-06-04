import { FeatureDocument } from "./product.js";

/**
 * Generate a high-level flow chart from a feature's UX views + element
 * leads_to. Two presentations:
 *
 *   - mermaid: client-rendered graph in the web renderer
 *   - ascii: text rendering for the CLI review REPL and the productos-review
 *     skill (when Claude is talking)
 *
 * Edges are derived ONLY from element `leads_to`. A view with no inbound or
 * outbound leads_to still appears as an island node — it's a screen in the
 * feature, the human should still see it on the map.
 */

export interface FlowEdge {
  /** Source UX view id (within this feature) */
  from_ux: string;
  /** The element on `from_ux` that triggers the navigation */
  via_element: string;
  /** Target — either a same-feature ux id, or a cross-feature reference */
  to: string;
  /** True if `to` is outside this feature (another area/feature, with or without anchor) */
  external: boolean;
}

export interface FlowGraph {
  feature_id: string;
  nodes: Array<{ id: string; title: string; external: boolean }>;
  edges: FlowEdge[];
  has_flow: boolean;
}

export function buildFlowGraph(feature: FeatureDocument): FlowGraph {
  const fm = feature.frontmatter;
  const nodes = new Map<string, { id: string; title: string; external: boolean }>();
  const edges: FlowEdge[] = [];

  for (const u of fm.ux) {
    nodes.set(u.id, { id: u.id, title: u.title, external: false });
  }

  for (const u of fm.ux) {
    for (const el of u.elements) {
      if (!el.leads_to) continue;
      const target = el.leads_to.trim();
      if (!target) continue;
      const external = !nodes.has(target) || target.includes("/");
      if (external && !nodes.has(target)) {
        nodes.set(target, { id: target, title: target, external: true });
      }
      edges.push({
        from_ux: u.id,
        via_element: el.id,
        to: target,
        external,
      });
    }
  }

  return {
    feature_id: fm.id,
    nodes: Array.from(nodes.values()),
    edges,
    has_flow: nodes.size > 0,
  };
}

/**
 * Mermaid `graph LR` source. Cross-feature targets get a dashed/grey style
 * and a click handler that navigates to /<feature_id>.
 */
export function renderMermaid(graph: FlowGraph): string {
  if (!graph.has_flow) return "";
  const lines: string[] = ["graph LR"];

  // Nodes
  for (const n of graph.nodes) {
    const safeId = mermaidId(n.id);
    const label = mermaidLabel(n.title);
    lines.push(`  ${safeId}["${label}"]`);
  }

  // Edges
  for (const e of graph.edges) {
    const from = mermaidId(e.from_ux);
    const to = mermaidId(e.to);
    const label = mermaidLabel(e.via_element);
    lines.push(`  ${from} -->|${label}| ${to}`);
  }

  // Style external nodes
  const externals = graph.nodes.filter((n) => n.external).map((n) => mermaidId(n.id));
  if (externals.length > 0) {
    lines.push(`  classDef external fill:#f5f5f7,stroke:#aaa,stroke-dasharray: 4 3,color:#666`);
    lines.push(`  class ${externals.join(",")} external`);
    // Click handlers — navigate to cross-feature pages.
    for (const n of graph.nodes) {
      if (!n.external) continue;
      // Strip any #anchor suffix when computing the URL.
      const url = "/" + n.id.split("#")[0];
      lines.push(`  click ${mermaidId(n.id)} "${url}" "Go to ${n.title}"`);
    }
  }

  return lines.join("\n");
}

/**
 * ASCII flow chart for the CLI REPL and the productos-review skill.
 *
 * Each internal UX view renders as a box with:
 *   - id in the top border (so it pops visually)
 *   - title on the first line inside
 *   - optional one-line summary on the second line (from notes if provided
 *     by `uxSummary`, otherwise blank)
 *
 * Below each box, outbound edges are listed as:
 *   [element-id] ──→ target  (cross-feature tag if external)
 *
 * Boxes stack top-to-bottom, separated by a blank line.
 */
export function renderAscii(
  graph: FlowGraph,
  uxSummary?: Map<string, string>
): string {
  if (!graph.has_flow) return "(no UX views)";

  const byFrom = new Map<string, FlowEdge[]>();
  for (const e of graph.edges) {
    const arr = byFrom.get(e.from_ux) ?? [];
    arr.push(e);
    byFrom.set(e.from_ux, arr);
  }

  const internalNodes = graph.nodes.filter((n) => !n.external);
  const blocks: string[] = [];

  for (const n of internalNodes) {
    const summary = uxSummary?.get(n.id) ?? "";
    blocks.push(renderUxBox(n.id, n.title, summary));

    const outs = byFrom.get(n.id) ?? [];
    if (outs.length > 0) {
      // Two-space indent under the box.
      const arrowLines: string[] = [];
      // Compute max width of [element] for alignment.
      const maxElLen = Math.max(...outs.map((e) => e.via_element.length));
      for (const e of outs) {
        const elPad = e.via_element.padEnd(maxElLen, " ");
        const tag = e.external ? " (cross-feature)" : "";
        arrowLines.push(`    [${elPad}] ──→ ${e.to}${tag}`);
      }
      blocks.push(arrowLines.join("\n"));
    }
  }

  return blocks.join("\n\n");
}

/**
 * Render one UX view as a box. Top border carries the id. Title and
 * (optional) summary go inside. Box width auto-sizes to longest content
 * line, capped at 60 chars; long summaries wrap.
 */
function renderUxBox(id: string, title: string, summary: string): string {
  const MAX_WIDTH = 60;
  // Wrap summary to fit. Title doesn't wrap (assumed short).
  const titleLine = title;
  const summaryLines = summary ? wrapText(summary, MAX_WIDTH - 4) : [];
  // Inner width = longest of titleLine and any summary line, padded.
  const innerWidth = Math.max(
    titleLine.length,
    ...summaryLines.map((l) => l.length),
    id.length + 4 // make room for top border id
  );
  const usableWidth = Math.min(innerWidth, MAX_WIDTH - 4);

  // Top border: ┌─ id ──────────┐
  const topPad = "─".repeat(Math.max(0, usableWidth - id.length - 2));
  const top = `  ┌─ ${id} ${topPad}─┐`;

  const lines: string[] = [top];
  lines.push(`  │ ${pad(titleLine, usableWidth + 1)}│`);
  for (const s of summaryLines) {
    lines.push(`  │ ${pad(s, usableWidth + 1)}│`);
  }
  const bottom = `  └─${"─".repeat(usableWidth + 2)}┘`;
  lines.push(bottom);
  return lines.join("\n");
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

function wrapText(s: string, width: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= width) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function mermaidId(s: string): string {
  // Mermaid node ids must be alphanumeric + underscore. Hash + slash break it.
  return "n_" + s.replace(/[^a-zA-Z0-9]+/g, "_");
}

function mermaidLabel(s: string): string {
  // Quotes inside the bracket label break the parser; escape minimally.
  return s.replace(/"/g, "&quot;");
}
