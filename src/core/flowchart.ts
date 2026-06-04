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
  /** Optional human-readable label of the triggering element ("+ Add a kid"); used
   *  to render user-meaningful action names ("add a kid") instead of element ids. */
  via_element_label?: string;
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
        via_element_label: el.label,
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

  // Edges — use the human-readable action label so the web flow uses the
  // same words as the CLI ("add a kid", "earn") instead of element ids.
  for (const e of graph.edges) {
    const from = mermaidId(e.from_ux);
    const to = mermaidId(e.to);
    const label = mermaidLabel(actionLabel(e));
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

// ===========================================================================
// ASCII flow chart — boxes with real arrows between them.
// ===========================================================================
//
// v1 layout strategy:
//   - Internal screens stack top-to-bottom in render order (declaration order
//     of the UX array).
//   - Internal-to-internal edges become vertical arrows with the action label.
//     If the target is directly below the source in render order, it's a
//     short arrow. If target is N>1 rows below, the line runs in a right-side
//     channel that "passes alongside" the intermediate boxes.
//   - External (cross-feature) edges fan to the right of each source box,
//     one per row of the box's right edge.
//   - "Action" labels come from element.label (lowercased, leading "+ "
//     stripped). For unlabeled elements, fall back to element id with
//     dashes-to-spaces.
//
// Multi-internal-branching to siblings at the same render row (e.g. A → B
// and A → C where B and C are both at row 1) renders as side-by-side
// columns. For 3+ siblings we degrade to stacked with explicit edge lines.

const MIN_BOX_INNER = 26;
const MAX_BOX_INNER = 44;
const LEFT_MARGIN = 2;
const BOX_GAP_Y = 3;
const EXT_GAP_X = 1;

interface BoxLayout {
  id: string;
  title: string;
  summaryLines: string[];
  externals: { action: string; target: string; kind?: "external" | "internal" }[];
  innerWidth: number;
  innerLines: string[];   // padded content rows (title + summary + blanks)
  width: number;          // total box width incl. borders
  height: number;         // total box height incl. borders
  x: number;              // canvas column of left border
  y: number;              // canvas row of top border
}

export function renderAscii(
  graph: FlowGraph,
  uxSummary?: Map<string, string>
): string {
  if (!graph.has_flow) return "(no UX views)";

  const internal = graph.nodes.filter((n) => !n.external);
  if (internal.length === 0) return "(no UX views)";

  // Index internal node by id for fast lookups.
  const indexById = new Map<string, number>();
  internal.forEach((n, i) => indexById.set(n.id, i));

  // Partition edges into three groups:
  //   - primaryInternal: source → next-in-declaration-order target (drawn as
  //     a vertical arrow connecting two boxes)
  //   - sideInternal: source → some other internal target (rendered as
  //     fan-right with "(internal)" tag; same screen still renders below
  //     in declaration order)
  //   - external: cross-feature (rendered as fan-right with "(cross-feature)")
  type Fan = { action: string; target: string; kind: "external" | "internal" };
  const primaryInternal = new Map<string, FlowEdge>(); // by source id
  const fansByFrom = new Map<string, Fan[]>();
  for (const e of graph.edges) {
    const fromIdx = indexById.get(e.from_ux);
    const toIdx = indexById.get(e.to);
    if (fromIdx !== undefined && toIdx === fromIdx + 1 && !primaryInternal.has(e.from_ux)) {
      // Direct down-arrow case.
      primaryInternal.set(e.from_ux, e);
      continue;
    }
    const fan: Fan = {
      action: actionLabel(e),
      target: e.to,
      kind: e.external ? "external" : "internal",
    };
    const arr = fansByFrom.get(e.from_ux) ?? [];
    arr.push(fan);
    fansByFrom.set(e.from_ux, arr);
  }

  // 1. First pass: figure out content for each box (pre-width).
  type Pre = {
    id: string;
    title: string;
    summary: string;
    fans: Fan[];
  };
  const pre: Pre[] = internal.map((n) => ({
    id: n.id,
    title: n.title,
    summary: uxSummary?.get(n.id) ?? "",
    fans: fansByFrom.get(n.id) ?? [],
  }));

  // 2. Pick one common inner width for all boxes so they align.
  const widthCandidates = pre.map((p) => {
    const idMin = p.id.length + 6; // " {id} ─" plus borders
    const titleLen = p.title.length;
    // Try a soft target width to fit the longest summary word at MIN_BOX_INNER.
    const summaryWordMax = p.summary
      ? Math.max(...p.summary.split(/\s+/).map((w) => w.length))
      : 0;
    return Math.max(MIN_BOX_INNER, idMin, titleLen, summaryWordMax);
  });
  let commonInnerWidth = Math.min(MAX_BOX_INNER, Math.max(...widthCandidates));

  // 3. Build BoxLayouts with that common width.
  const boxes: BoxLayout[] = pre.map((p) => {
    const summaryLines = p.summary ? wrapText(p.summary, commonInnerWidth) : [];
    const contentRows: string[] = [p.title, ...summaryLines];
    const wantedH = Math.max(contentRows.length, p.fans.length);
    while (contentRows.length < wantedH) contentRows.push("");
    return {
      id: p.id,
      title: p.title,
      summaryLines,
      externals: p.fans.map((f) => ({ action: f.action, target: f.target, kind: f.kind })),
      innerWidth: commonInnerWidth,
      innerLines: contentRows,
      width: commonInnerWidth + 4,
      height: contentRows.length + 2,
      x: LEFT_MARGIN,
      y: 0,
    };
  });

  // 2. Place boxes vertically with gap.
  let cursorY = 0;
  for (const b of boxes) {
    b.y = cursorY;
    cursorY += b.height + BOX_GAP_Y;
  }

  // 3. Compute canvas size.
  const maxRightOfBox = Math.max(...boxes.map((b) => b.x + b.width));
  const maxExtLine = boxes.reduce((m, b) => {
    for (const e of b.externals) {
      const tag = e.kind === "internal" ? " (internal)" : " (cross-feature)";
      const s = ` ── ${e.action} ──► ${e.target}${tag}`;
      if (s.length > m) m = s.length;
    }
    return m;
  }, 0);

  const canvasWidth = maxRightOfBox + EXT_GAP_X + maxExtLine + 1;
  const canvasHeight = cursorY;
  const canvas = new Canvas(canvasWidth, canvasHeight);

  // 4. Draw each box.
  for (const b of boxes) drawBox(canvas, b);

  // 5. Draw fan edges to the right of each box.
  for (const b of boxes) {
    for (let i = 0; i < b.externals.length; i++) {
      const e = b.externals[i];
      const rowY = b.y + 1 + i;
      const startX = b.x + b.width;
      const tag = e.kind === "internal" ? " (internal)" : " (cross-feature)";
      const line = ` ── ${e.action} ──► ${e.target}${tag}`;
      canvas.writeText(startX, rowY, line);
    }
  }

  // 6. Draw primary internal vertical arrows between consecutive boxes only.
  for (const [fromId, e] of primaryInternal) {
    const src = boxes[indexById.get(fromId)!];
    const tgt = boxes[indexById.get(e.to)!];
    drawAdjacentEdge(canvas, src, tgt, actionLabel(e));
  }

  return canvas.toString();
}

// ---------------------------------------------------------------------------
// Drawing primitives

class Canvas {
  private grid: string[][];

  constructor(width: number, height: number) {
    this.grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => " ")
    );
  }

  set(x: number, y: number, ch: string): void {
    if (y < 0 || y >= this.grid.length) return;
    if (x < 0) return;
    const row = this.grid[y];
    while (row.length <= x) row.push(" ");
    row[x] = ch;
  }

  writeText(x: number, y: number, s: string): void {
    for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i]);
  }

  hLine(x1: number, x2: number, y: number, ch = "─"): void {
    if (x2 < x1) [x1, x2] = [x2, x1];
    for (let x = x1; x <= x2; x++) this.set(x, y, ch);
  }

  vLine(y1: number, y2: number, x: number, ch = "│"): void {
    if (y2 < y1) [y1, y2] = [y2, y1];
    for (let y = y1; y <= y2; y++) this.set(x, y, ch);
  }

  toString(): string {
    return this.grid.map((row) => row.join("").trimEnd()).join("\n");
  }
}

function drawBox(canvas: Canvas, b: BoxLayout): void {
  const top = b.y;
  const bot = b.y + b.height - 1;
  const left = b.x;
  const right = b.x + b.width - 1;

  // Top border: ┌─ id ──────┐
  canvas.set(left, top, "┌");
  canvas.set(right, top, "┐");
  // " id " label inside the top border, starting at left+2
  canvas.hLine(left + 1, right - 1, top, "─");
  canvas.writeText(left + 2, top, ` ${b.id} `);

  // Sides + content rows
  for (let i = 0; i < b.innerLines.length; i++) {
    const y = top + 1 + i;
    canvas.set(left, y, "│");
    canvas.set(right, y, "│");
    // " content "
    canvas.writeText(left + 2, y, b.innerLines[i]);
  }

  // Bottom border
  canvas.set(left, bot, "└");
  canvas.set(right, bot, "┘");
  canvas.hLine(left + 1, right - 1, bot, "─");
}

/**
 * Draw a vertical arrow between adjacent boxes (in declaration order).
 * Source bottom-middle ──→ target top-middle, with the action label
 * written to the right of the line.
 *
 * Non-adjacent internal edges aren't drawn in v1 — they're rendered as
 * fan-right entries with the "(internal)" tag instead, so the user can
 * see the relationship without a tangled multi-lane arrow.
 */
function drawAdjacentEdge(
  canvas: Canvas,
  src: BoxLayout,
  tgt: BoxLayout,
  action: string
): void {
  const srcBottom = src.y + src.height - 1;
  const tgtTop = tgt.y;
  if (tgtTop <= srcBottom) return;

  const x = Math.floor(src.x + src.width / 2);
  // Source bottom: line continues DOWN → ┬
  canvas.set(x, srcBottom, "┬");
  // Target top: line approaches from ABOVE → ┴
  canvas.set(x, tgtTop, "┴");
  for (let y = srcBottom + 1; y < tgtTop; y++) {
    canvas.set(x, y, "│");
  }
  canvas.set(x, tgtTop - 1, "▼");
  const midY = srcBottom + Math.floor((tgtTop - srcBottom) / 2);
  canvas.writeText(x + 2, midY, action);
}

// ---------------------------------------------------------------------------
// Action label heuristic

function actionLabel(e: FlowEdge): string {
  if (e.via_element_label) {
    // Strip leading + and -, lowercase. "+ Add a kid" → "add a kid".
    return e.via_element_label.replace(/^[+\-\s]+/, "").trim().toLowerCase();
  }
  // Fall back to element id with dashes as spaces, dropping common suffixes
  // that name the WIDGET rather than the ACTION ("-button", "-link", "-cta").
  const id = e.via_element.replace(/-(button|link|cta|action|trigger)$/, "");
  return id.replace(/-/g, " ");
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
