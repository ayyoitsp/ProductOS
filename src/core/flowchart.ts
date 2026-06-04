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
const BOX_GAP_X = 4;
const EXT_GAP_X = 1;

type FanKind = "external" | "internal-forward" | "internal-back";

interface BoxLayout {
  id: string;
  title: string;
  summaryLines: string[];
  externals: { action: string; target: string; kind: FanKind }[];
  innerWidth: number;
  innerLines: string[];   // padded content rows (title + summary + blanks)
  width: number;          // total box width incl. borders
  height: number;         // total box height incl. borders
  x: number;              // canvas column of left border
  y: number;              // canvas row of top border
  rowIdx: number;         // logical row (0-based)
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

  // For each source, collect its FORWARD internal targets in declaration
  // order. Forward = target's declaration index > source's index. These
  // become "sibling groups" — the row of children drawn side-by-side
  // below the source.
  const forwardTargetsBySource = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.external) continue;
    const sIdx = indexById.get(e.from_ux);
    const tIdx = indexById.get(e.to);
    if (sIdx === undefined || tIdx === undefined) continue;
    if (tIdx <= sIdx) continue; // back edge
    const arr = forwardTargetsBySource.get(e.from_ux) ?? [];
    if (!arr.includes(e.to)) arr.push(e.to);
    forwardTargetsBySource.set(e.from_ux, arr);
  }

  // 1. Assign each internal node to a row. Walking in declaration order:
  //    when we first see a node, find the source (if any) that has this
  //    node in its forward-targets list and has MULTIPLE such targets —
  //    place all of that source's forward targets in this same row.
  //    Otherwise the node gets its own row.
  const rowOfBox = new Map<string, number>();
  const rows: string[][] = [];
  for (const n of internal) {
    if (rowOfBox.has(n.id)) continue;

    // Find a source that has n among its forward targets.
    let groupedSiblings: string[] | null = null;
    for (const [, targets] of forwardTargetsBySource) {
      if (targets.includes(n.id) && targets.length > 1) {
        // Only group those siblings not already placed.
        const free = targets.filter((t) => !rowOfBox.has(t));
        if (free.length >= 2) {
          groupedSiblings = free;
          break;
        }
      }
    }

    const row = groupedSiblings ?? [n.id];
    const rowIdx = rows.length;
    rows.push(row);
    for (const id of row) rowOfBox.set(id, rowIdx);
  }

  // 2. Classify all edges into:
  //    - rowToRow: source's row → target's row where target row = source row + 1
  //      and source has these as its forward targets. Drawn as vertical
  //      (or forked) arrows.
  //    - fan: everything else (back edges, cross-feature, non-consecutive
  //      forward edges). Rendered as right-fan with appropriate tag.
  type RowEdge = { from: string; to: string; action: string };
  const rowEdgesBySource = new Map<string, RowEdge[]>();
  const fansByFrom = new Map<string, { action: string; target: string; kind: FanKind }[]>();
  for (const e of graph.edges) {
    const sRow = rowOfBox.get(e.from_ux);
    const tRow = rowOfBox.get(e.to);
    const action = actionLabel(e);
    if (!e.external && sRow !== undefined && tRow !== undefined && tRow === sRow + 1) {
      // Forward edge to next row — drawn as a vertical arrow.
      const arr = rowEdgesBySource.get(e.from_ux) ?? [];
      arr.push({ from: e.from_ux, to: e.to, action });
      rowEdgesBySource.set(e.from_ux, arr);
      continue;
    }
    // Fan it.
    let kind: FanKind;
    if (e.external) kind = "external";
    else {
      const sIdx = indexById.get(e.from_ux)!;
      const tIdx = indexById.get(e.to)!;
      kind = tIdx > sIdx ? "internal-forward" : "internal-back";
    }
    const arr = fansByFrom.get(e.from_ux) ?? [];
    arr.push({ action, target: e.to, kind });
    fansByFrom.set(e.from_ux, arr);
  }

  // 3. Compute box content + a single common inner width.
  type Pre = { id: string; title: string; summary: string; fans: { action: string; target: string; kind: FanKind }[] };
  const pre: Pre[] = internal.map((n) => ({
    id: n.id,
    title: n.title,
    summary: uxSummary?.get(n.id) ?? "",
    fans: fansByFrom.get(n.id) ?? [],
  }));
  const widthCandidates = pre.map((p) => {
    const idMin = p.id.length + 6;
    const titleLen = p.title.length;
    const summaryWordMax = p.summary
      ? Math.max(...p.summary.split(/\s+/).map((w) => w.length))
      : 0;
    return Math.max(MIN_BOX_INNER, idMin, titleLen, summaryWordMax);
  });
  const commonInnerWidth = Math.min(MAX_BOX_INNER, Math.max(...widthCandidates));

  // 4. Build boxes (without final x/y).
  const boxesById = new Map<string, BoxLayout>();
  for (const p of pre) {
    const summaryLines = p.summary ? wrapText(p.summary, commonInnerWidth) : [];
    const contentRows: string[] = [p.title, ...summaryLines];
    const wantedH = Math.max(contentRows.length, p.fans.length);
    while (contentRows.length < wantedH) contentRows.push("");
    boxesById.set(p.id, {
      id: p.id,
      title: p.title,
      summaryLines,
      externals: p.fans,
      innerWidth: commonInnerWidth,
      innerLines: contentRows,
      width: commonInnerWidth + 4,
      height: contentRows.length + 2,
      x: LEFT_MARGIN,
      y: 0,
      rowIdx: rowOfBox.get(p.id)!,
    });
  }

  // 5. Per-row width budget for fans on the rightmost box in that row.
  function fanTag(k: FanKind): string {
    if (k === "external") return " (cross-feature)";
    if (k === "internal-back") return " (internal — back)";
    return " (internal)";
  }
  function fanLine(f: { action: string; target: string; kind: FanKind }): string {
    return ` ── ${f.action} ──► ${f.target}${fanTag(f.kind)}`;
  }

  // Decide which boxes can render fans to the right vs below: only the
  // RIGHTMOST box in each row gets the fan-right slot. Other boxes' fans
  // get rendered as dedicated lines BELOW the box so they don't overlap
  // with the next sibling.
  const fansBelowOf = new Map<string, { action: string; target: string; kind: FanKind }[]>();
  for (const rowIds of rows) {
    const rightmost = rowIds[rowIds.length - 1];
    for (const id of rowIds) {
      if (id === rightmost) continue;
      const b = boxesById.get(id)!;
      if (b.externals.length === 0) continue;
      fansBelowOf.set(id, b.externals);
      // Also reduce the box's "padded" inner height — those rows were padded
      // to make room for fans to the right, but they no longer need it.
      // Recompute innerLines based on actual content only.
      const summaryLines = b.summaryLines;
      const contentRows = [b.title, ...summaryLines];
      b.innerLines = contentRows;
      b.height = contentRows.length + 2;
    }
  }

  // 6. Position boxes — for each row, lay siblings out horizontally;
  //    rows stack vertically with gap. Reserve extra rows below for
  //    "fans-below" lines that need to render under non-rightmost boxes.
  let cursorY = 0;
  for (const rowIds of rows) {
    let cursorX = LEFT_MARGIN;
    let rowH = 0;
    let maxFansBelow = 0;
    for (const id of rowIds) {
      const b = boxesById.get(id)!;
      b.x = cursorX;
      b.y = cursorY;
      cursorX += b.width + BOX_GAP_X;
      if (b.height > rowH) rowH = b.height;
      const below = fansBelowOf.get(id);
      if (below && below.length > maxFansBelow) maxFansBelow = below.length;
    }
    cursorY += rowH + maxFansBelow + BOX_GAP_Y;
  }

  // 7. Compute canvas size.
  const boxes = Array.from(boxesById.values());
  const maxRightOfBox = Math.max(...boxes.map((b) => b.x + b.width));
  // Fan column starts after the RIGHTMOST box in each row. For a single-box
  // row that's that box's right edge; for multi-box rows externals go right
  // of the last box. Compute max fan extent globally.
  let maxFanExtent = maxRightOfBox;
  for (const b of boxes) {
    const startX = b.x + b.width;
    for (const f of b.externals) {
      const totalRight = startX + fanLine(f).length;
      if (totalRight > maxFanExtent) maxFanExtent = totalRight;
    }
  }
  const canvasWidth = maxFanExtent + EXT_GAP_X + 1;
  const canvasHeight = cursorY;
  const canvas = new Canvas(canvasWidth, canvasHeight);

  // 8. Draw boxes.
  for (const b of boxes) drawBox(canvas, b);

  // 9. Draw fan edges. Rightmost-in-row boxes fan to the right; non-rightmost
  //    boxes (in multi-box rows) render fans on dedicated lines below the
  //    box so they don't collide with the next sibling.
  for (const b of boxes) {
    const below = fansBelowOf.get(b.id);
    if (below) {
      for (let i = 0; i < below.length; i++) {
        const rowY = b.y + b.height + i;
        canvas.writeText(b.x + 2, rowY, fanLine(below[i]).trimStart());
      }
    } else {
      for (let i = 0; i < b.externals.length; i++) {
        const e = b.externals[i];
        const rowY = b.y + 1 + i;
        canvas.writeText(b.x + b.width, rowY, fanLine(e));
      }
    }
  }

  // 10. Draw row-to-row vertical arrows. For each source with forward edges:
  //     - 1 target → single vertical arrow
  //     - 2+ targets → forked arrow (source bottom center, drop one row,
  //       horizontal segment to each target center, vertical drop to each
  //       target top with ▼).
  for (const [srcId, targets] of rowEdgesBySource) {
    const src = boxesById.get(srcId)!;
    const targetBoxes = targets.map((t) => ({ box: boxesById.get(t.to)!, action: t.action }));
    drawForwardEdges(canvas, src, targetBoxes);
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
 * Draw row-to-row forward arrows.
 *
 * Single target: straight vertical from source bottom-center to target
 * top-center, with the action label to the right of the line.
 *
 * Multi-target (source has 2+ children at the next row): the source's
 * bottom-center descends one row, then a horizontal segment extends to
 * cover all target centers, and each target gets its own vertical drop
 * from that horizontal down to its top with ▼. Action labels go to the
 * right of each vertical.
 *
 * Corner chars on the horizontal:
 *   - leftmost target: ┌ (horizontal goes right, vertical goes down)
 *   - rightmost target: ┐ (horizontal comes from left, vertical down)
 *   - any other target in the middle: ┬
 *   - source descender point: ┴ if mid-horizontal, otherwise becomes one
 *     of the ends.
 */
function drawForwardEdges(
  canvas: Canvas,
  src: BoxLayout,
  targets: Array<{ box: BoxLayout; action: string }>
): void {
  if (targets.length === 0) return;
  const srcBottom = src.y + src.height - 1;
  const srcMidX = Math.floor(src.x + src.width / 2);

  if (targets.length === 1) {
    const tgt = targets[0].box;
    const tgtTop = tgt.y;
    if (tgtTop <= srcBottom) return;
    const x = srcMidX;
    canvas.set(x, srcBottom, "┬");
    canvas.set(x, tgtTop, "┴");
    for (let y = srcBottom + 1; y < tgtTop; y++) canvas.set(x, y, "│");
    canvas.set(x, tgtTop - 1, "▼");
    const midY = srcBottom + Math.floor((tgtTop - srcBottom) / 2);
    canvas.writeText(x + 2, midY, targets[0].action);
    return;
  }

  // Multi-target.
  const horizY = srcBottom + 1;
  const sortedTargets = targets
    .map((t) => ({ ...t, midX: Math.floor(t.box.x + t.box.width / 2) }))
    .sort((a, b) => a.midX - b.midX);
  const leftX = sortedTargets[0].midX;
  const rightX = sortedTargets[sortedTargets.length - 1].midX;
  // Include source descender column in horizontal span (in case source is
  // outside [leftX, rightX]).
  const horizLeft = Math.min(leftX, srcMidX);
  const horizRight = Math.max(rightX, srcMidX);

  // Source bottom → ┬, descend one row.
  canvas.set(srcMidX, srcBottom, "┬");

  // Lay the horizontal.
  for (let x = horizLeft; x <= horizRight; x++) {
    canvas.set(x, horizY, "─");
  }

  // Stamp endpoint and target corner chars on the horizontal.
  const targetMids = new Set(sortedTargets.map((t) => t.midX));
  for (let i = 0; i < sortedTargets.length; i++) {
    const t = sortedTargets[i];
    let ch: string;
    if (t.midX === horizLeft && t.midX === srcMidX) {
      // Source descends here AND horizontal extends right AND vertical goes
      // down → 3-way (no left). Use ┌ for now (close enough; the source
      // descender disappears into the corner).
      ch = "├";
    } else if (t.midX === horizRight && t.midX === srcMidX) {
      ch = "┤";
    } else if (t.midX === horizLeft) {
      ch = "┌";
    } else if (t.midX === horizRight) {
      ch = "┐";
    } else if (t.midX === srcMidX) {
      ch = "┼"; // source descends here AND vertical continues to target
    } else {
      ch = "┬";
    }
    canvas.set(t.midX, horizY, ch);
  }
  // If source descender is OUTSIDE all target mids, mark it too.
  if (!targetMids.has(srcMidX)) {
    let ch: string;
    if (srcMidX === horizLeft) ch = "┌"; // horizontal extends right
    else if (srcMidX === horizRight) ch = "┐"; // horizontal extends left
    else ch = "┴"; // horizontal extends both ways, vertical goes up to source
    canvas.set(srcMidX, horizY, ch);
  }

  // Drop verticals from horizontal to each target.
  for (const t of sortedTargets) {
    const tgtTop = t.box.y;
    for (let y = horizY + 1; y < tgtTop; y++) {
      canvas.set(t.midX, y, "│");
    }
    canvas.set(t.midX, tgtTop - 1, "▼");
    canvas.set(t.midX, tgtTop, "┴");
    const midY = horizY + Math.floor((tgtTop - horizY) / 2);
    canvas.writeText(t.midX + 2, midY, t.action);
  }
}

// ---------------------------------------------------------------------------
// Action label heuristic

function actionLabel(e: FlowEdge): string {
  if (e.via_element_label) {
    // Strip leading + and - and unicode minus, lowercase.
    // "+ Add a kid" → "add a kid"; "− Spend" → "spend".
    return e.via_element_label.replace(/^[+\-−\s]+/, "").trim().toLowerCase();
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
