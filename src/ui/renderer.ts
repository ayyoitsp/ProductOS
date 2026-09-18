import { GroupingAdvice } from "../core/grouping.js";
import type { Decision } from "../core/worklist.js";
import { marked } from "marked";
import {
  AreaDocument,
  GroupDocument,
  groupFeatures,
  type CapabilitySystemDocument,
  type ProductDocument,
  Behavior,
  Element,
  FeatureDocument,
  Surface,
  isUndefinedBehavior,
} from "../core/product.js";
import { BehaviorTracking, FeatureTracking } from "../core/tracking.js";
import { FeedbackEntry } from "../core/feedback.js";
import {
  contextSectionState,
  decisionRuling,
  parseSections,
  sectionAnchor,
  type ContextDocument,
  type ContextSection,
} from "../core/context.js";
import { readinessHeadline, acceptanceCount, type FeatureReadiness } from "../core/readiness.js";
import { derivedVerification, DerivedVerification } from "../core/derived-state.js";
import { buildAreaFlowGraph, renderMermaid } from "../core/flowchart.js";
import { auditArea, auditFeature, type AuditFinding } from "../core/audit.js";

const SHELL_CSS = `
:root {
  /* Light mode (default) */
  --bg: #fbfbfc;
  --surface: #ffffff;
  --surface-2: #f3f4f7;
  --surface-3: #e4e6eb;
  --text: #1f2329;
  --dim: #6b7280;
  --accent: #2563eb;
  --green: #16a34a;
  --yellow: #ca8a04;
  --red: #dc2626;
  --blue: #2563eb;
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root.system-theme {
    --bg: #0f1115;
    --surface: #161922;
    --surface-2: #1d2230;
    --surface-3: #232838;
    --text: #e6e8ee;
    --dim: #8a93a6;
    --accent: #4f8cff;
    --green: #2ecc71;
    --yellow: #f5c518;
    --red: #ff4d4f;
    --blue: #4f8cff;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font: 15px/1.55 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
  display: grid; grid-template-columns: 280px 1fr; min-height: 100vh;
}
aside {
  background: var(--surface); border-right: 1px solid var(--surface-3);
  padding: 24px 16px; overflow-y: auto; max-height: 100vh; position: sticky; top: 0;
}
aside .sidebar-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
aside .sidebar-top .brand { flex: 1; }
aside .sidebar-top .refresh {
  background: transparent; border: 1px solid var(--surface-3); color: var(--dim);
  width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: 14px;
  padding: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
}
aside .sidebar-top .refresh:hover { color: var(--accent); border-color: var(--accent); }
aside .sidebar-top .refresh.spinning { animation: spin 0.6s linear; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
aside h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); margin: 24px 0 8px; padding: 0 8px; }
aside a { color: var(--text); text-decoration: none; display: block; padding: 5px 10px; border-radius: 6px; font-size: 13px; }
aside a:hover { background: var(--surface-2); color: var(--accent); }
aside a.active { background: var(--surface-2); color: var(--accent); }
aside .area { margin: 4px 0 12px; }
aside .area > .area-title { font-weight: 600; padding: 5px 10px; color: var(--text); font-size: 13px; display: flex; align-items: center; gap: 6px; }
aside .area > .area-title::before { content: "▸"; color: var(--dim); font-size: 10px; }
aside .area > .area-title a { padding: 0; color: var(--text); }
aside .area > .area-title a:hover { background: transparent; }
aside .area .feat-list { border-left: 2px solid var(--surface-3); margin-left: 17px; padding-left: 4px; margin-top: 2px; }
aside .area .feat { padding-left: 12px; color: var(--dim); font-size: 12.5px; }
aside .area .feat.active { color: var(--accent); }

main { padding: 36px 48px; max-width: 920px; min-width: 0; }
header.feature { margin-bottom: 24px; }
header.feature .feature-title-row { display: flex; align-items: baseline; gap: 16px; margin-bottom: 4px; }
header.feature .feature-title-row h1 { margin: 0; flex: 0 0 auto; }
header.feature .feature-title-row .feature-id { color: var(--dim); font-family: var(--mono); font-size: 13px; flex: 1 1 auto; }
header.feature .feature-title-row .feature-status { flex: 0 0 auto; }

/* AI assistant pane — sticky at the bottom of a feature page. */
.ai-assist-pane {
  position: sticky; bottom: 0; z-index: 10;
  background: var(--surface); border: 1px solid var(--surface-3); border-top-width: 2px;
  border-radius: 12px 12px 0 0;
  padding: 14px 18px 16px;
  margin: 32px -48px -36px;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.04);
}
.ai-assist-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.ai-assist-title { font-weight: 600; font-size: 14px; color: var(--text); }
.ai-assist-hint { color: var(--dim); font-size: 12px; flex: 1; }
.ai-assist-input {
  width: 100%; min-height: 50px; max-height: 200px;
  background: var(--surface-2); color: var(--text);
  border: 1px solid var(--surface-3); border-radius: 6px;
  padding: 8px 12px; font: inherit; font-size: 13px; resize: vertical;
}
.ai-assist-input:focus { outline: none; border-color: var(--accent); }
.ai-assist-actions { display: flex; gap: 12px; margin-top: 8px; align-items: center; }
.ai-assist-actions button { padding: 6px 16px; }
.ai-assist-status { color: var(--dim); font-size: 12px; flex: 1; }
.ai-assist-status.success { color: var(--green); }
.ai-assist-status.warning { color: var(--yellow); }
.ai-assist-status.error { color: var(--red); }

/* UX mock — user provided sketch_html, rendered with their own CSS via
   /_user-style.css. We give it a scoping container so the user can scope
   styles via .ux-mock { ... } if they want. Minimal defaults: just a
   bordered card that contains the mock cleanly. */
.ux-mock {
  border: 1px solid var(--surface-3);
  border-radius: 12px;
  padding: 18px;
  background: #fff;
  color: #111;
  overflow: hidden;
}
.ux-mock * { box-sizing: border-box; }

/* Collapsible surface + behavior blocks ---------------------------------- */
.surface-details { margin: 16px 0; border: 1px solid var(--surface-3); border-radius: 12px; background: var(--surface); }
.surface-details > summary.surface-summary { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; list-style: none; font-size: 14px; user-select: none; }
.surface-details > summary.surface-summary::-webkit-details-marker { display: none; }
.surface-disclosure { color: var(--dim); transition: transform 0.15s ease; font-size: 11px; }
.surface-details[open] > summary > .surface-disclosure { transform: rotate(90deg); }
.surface-details > summary > .surface-title { font-weight: 600; color: var(--text); }
.surface-details > summary > .surface-id { color: var(--dim); font-family: var(--mono); font-size: 12px; }
.surface-verified { color: var(--green); font-weight: 600; font-size: 12px; }
.surface-details > section.surface { padding: 0 18px 18px; border-top: 1px solid var(--surface-3); }

.behavior-details { margin: 8px 0; border: 1px solid var(--surface-3); border-radius: 10px; background: var(--surface); }
.behavior-details > summary.behavior-summary { display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; list-style: none; font-size: 13px; user-select: none; flex-wrap: wrap; }
.behavior-details > summary.behavior-summary::-webkit-details-marker { display: none; }
.bsum-disclosure { color: var(--dim); transition: transform 0.15s ease; font-size: 10px; flex: 0 0 auto; }
.behavior-details[open] > summary > .bsum-disclosure { transform: rotate(90deg); }
.bsum-verified { color: var(--green); font-weight: 700; flex: 0 0 auto; }
.bsum-id { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--text); flex: 0 0 auto; }
.bsum-tests { color: var(--dim); font-size: 11px; padding: 2px 6px; background: var(--surface-2); border-radius: 4px; flex: 0 0 auto; }
.bsum-claim { color: var(--dim); flex: 1 1 auto; min-width: 200px; }
.behavior-details > article.behavior { padding: 0 14px 14px; border-top: 1px solid var(--surface-3); }
.behavior-details[open] { background: var(--surface-2); }

/* Flow chart at the top of a feature page — Mermaid graph showing UX views
   + leads_to edges. Renders client-side via the Mermaid CDN. */
.feature-flow { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 18px 20px; margin: 16px 0 20px; }
.feature-flow h2 { margin: 0 0 12px; font-size: 14px; color: var(--dim); font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.feature-flow .mermaid { background: var(--surface-2); border-radius: 8px; padding: 16px; overflow-x: auto; }
.feature-flow .mermaid svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
.feature-flow .mermaid.mermaid-raw { white-space: pre; font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--dim); }
.grouping-advice { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 12px 18px; margin: 24px 0 16px; }
.grouping-advice > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; }
.grouping-advice > summary::-webkit-details-marker { display: none; }
.grouping-advice > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.grouping-advice[open] > summary::before { content: "▾"; }
.ga-head { font-size: 13px; font-weight: 600; color: var(--dim); }
.ga-count { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.ga-item { padding: 10px 0; border-top: 1px solid var(--surface-3); }
.ga-item:first-of-type { border-top: none; }
.ga-what { font-weight: 600; font-size: 14px; }
.ga-rule { color: var(--dim); font-size: 12px; margin-top: 3px; }
.ga-cluster { margin: 10px 0 0 12px; }
.ga-cluster-name { font-family: var(--mono); font-size: 12px; color: var(--accent); font-weight: 600; }
.ga-unnamed { color: var(--red); font-weight: 600; }
.ga-cluster-why { color: var(--dim); font-size: 12px; }
.ga-cluster ul { margin: 4px 0 0 16px; font-size: 12px; }
.ga-moves { background: var(--surface-2); border-radius: 8px; padding: 8px 10px; margin-top: 10px; font-family: var(--mono); font-size: 11px; color: var(--dim); overflow-x: auto; white-space: pre; }
a.ctx-state, a.status { text-decoration: none; }
a.ctx-state:hover, a.status:hover { filter: brightness(0.94); }
.accept-banner { display: flex; flex-direction: column; gap: 4px; background: #fef3c7; border: 1px solid #fcd34d; border-left: 4px solid #d97706; border-radius: 8px; padding: 12px 16px; margin: 0 0 18px; font-size: 13px; color: #713f12; }
.accept-banner.none { background: #fee2e2; border-color: #fca5a5; border-left-color: #dc2626; color: #7f1d1d; }
.accept-banner strong { font-size: 14px; }
.accept-banner a { color: inherit; text-decoration: underline; }
.states { margin: 8px 0 22px; }
.states dt { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--accent); margin-top: 12px; }
.states dd { margin: 3px 0 0; font-size: 14px; color: var(--dim); line-height: 1.6; }
.audit-findings { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 12px 18px; margin: 24px 0 16px; }
.audit-findings > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; }
.audit-findings > summary::-webkit-details-marker { display: none; }
.audit-findings > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.audit-findings[open] > summary::before { content: "▾"; }
.af-head { font-size: 13px; font-weight: 600; color: var(--dim); }
.af-count { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.audit-findings ul { margin: 8px 0 0; padding: 0; list-style: none; }
.af { padding: 8px 0 8px 10px; border-left: 3px solid var(--surface-3); margin-bottom: 6px; }
.af-high { border-left-color: var(--red); }
.af-medium { border-left-color: var(--yellow); }
.af-msg { font-size: 13px; }
.af-where { font-size: 11px; color: var(--dim); margin-top: 3px; }
.af-kind { font-family: var(--mono); font-size: 10px; }
.oq-owed { font-size: 12px; color: var(--dim); margin-top: 4px; }
.oq-age.stale { color: var(--red); font-weight: 600; }
.oq-blocks { font-size: 12px; color: var(--text); margin-top: 4px; }
.oq-blocks.none { color: var(--dim); font-style: italic; }
.oq-blocks.unknown { color: var(--red); }
.answered { margin: 8px 0; font-size: 13px; }
.answered > summary { cursor: pointer; list-style: none; display: flex; gap: 8px; align-items: baseline; }
.answered > summary::-webkit-details-marker { display: none; }
.answered > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.answered[open] > summary::before { content: "▾"; }
.ans-head { font-size: 12px; font-weight: 600; color: var(--dim); }
.ans-who { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.ans-q { margin: 6px 0 0 16px; color: var(--dim); font-style: italic; }
.ans-why { margin: 6px 0 0 16px; color: var(--text); }
.holds-for { display: inline-block; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 3px 9px; font-size: 12px; color: #713f12; margin: 6px 0; }
.contradiction { background: #fee2e2; border: 1px solid #fca5a5; border-left: 4px solid #dc2626; border-radius: 8px; padding: 10px 14px; margin: 10px 0; font-size: 13px; color: #7f1d1d; }
.contra-head { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.contradiction ul { margin: 6px 0 0; padding-left: 18px; }
.contradiction a { color: inherit; }
.contra-why { color: #991b1b; margin: 3px 0 4px; }
.contra-warn { margin-top: 6px; font-weight: 600; }
.fw-gaps { background: var(--surface-2); border: 1px dashed var(--surface-3); border-radius: 12px; padding: 14px 18px; margin: 18px 0; }
.fw-gaps h2 { margin: 0 0 2px; font-size: 14px; font-weight: 600; color: var(--dim); }
.fw-gaps ul { margin: 10px 0 0; padding: 0; list-style: none; }
.fwg { padding: 8px 0; border-top: 1px solid var(--surface-3); }
.fwg:first-child { border-top: none; }
.fwg-what { font-size: 13px; }
.fwg-q { font-size: 12px; color: var(--dim); margin-top: 4px; }
.load-bearing { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 13px; color: #713f12; }
.load-bearing.none { background: var(--surface-2); border-color: var(--surface-3); color: var(--dim); }
.load-bearing a { color: inherit; }
.boundary { background: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 12px 16px; margin: 14px 0; }
.boundary h2 { margin: 0 0 2px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #3730a3; }
.boundary ul { margin: 8px 0 0; padding-left: 18px; font-size: 13px; color: #312e81; }
.boundary li { margin-bottom: 5px; }
.open-notes { background: var(--surface-2); border: 1px solid var(--surface-3); border-left: 4px solid var(--yellow); border-radius: 8px; padding: 12px 16px; margin: 14px 0; }
.open-notes h2 { margin: 0 0 2px; font-size: 13px; font-weight: 700; color: var(--dim); }
.open-notes ul { margin: 8px 0 0; padding: 0; list-style: none; }
.onote { padding: 8px 0; border-top: 1px solid var(--surface-3); }
.onote:first-child { border-top: none; }
.onote-body { font-size: 13px; }
.onote-meta { font-size: 11px; color: var(--dim); margin-top: 3px; }
.dep-pill.suspected { border-style: dashed; opacity: 0.85; }
.dep-note.suspected { color: var(--yellow); }
.ctx-uplink { color: var(--dim); font-size: 13px; margin: 14px 0; }
.ambiguity { background: #fef3c7; border: 1px solid #fcd34d; border-left: 4px solid #d97706; border-radius: 8px; padding: 10px 14px; margin: 10px 0; font-size: 13px; color: #713f12; }
.amb-head { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.ambiguity ol { margin: 6px 0; padding-left: 20px; }
.amb-cost { margin-top: 4px; }
.amb-warn { margin-top: 6px; font-weight: 600; }
.readthrough { display: flex; flex-direction: column; gap: 3px; border-radius: 8px; padding: 11px 15px; margin: 0 0 14px; font-size: 13px; }
.readthrough strong { font-size: 14px; }
.readthrough.none { background: var(--surface-2); border: 1px dashed var(--surface-3); color: var(--dim); }
.readthrough.ok { background: #dcfce7; border: 1px solid #86efac; border-left: 4px solid #16a34a; color: #14532d; }
.readthrough.blocked { background: #fee2e2; border: 1px solid #fca5a5; border-left: 4px solid #dc2626; color: #7f1d1d; }
.readthrough a { color: inherit; }
.wrong-page { background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 8px; padding: 11px 15px; margin: 0 0 16px; font-size: 13px; color: var(--dim); }
.sketch-precedence { font-size: 12px; color: var(--dim); background: var(--surface-2); border-radius: 6px; padding: 7px 11px; margin-bottom: 10px; }
.intent-notice { background: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 10px 14px; margin-bottom: 11px; font-size: 13px; color: #312e81; }
.same-as { background: var(--surface-2); border: 1px solid var(--surface-3); border-left: 4px solid var(--accent); border-radius: 8px; padding: 10px 14px; margin: 10px 0; font-size: 13px; }
.sa-head { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); }
.same-as ul { margin: 6px 0; padding-left: 18px; }
.sa-warn { color: var(--dim); }
.el-inventory { margin: 10px 0; }
.el-inventory > summary { cursor: pointer; list-style: none; display: flex; gap: 10px; align-items: baseline; }
.el-inventory > summary::-webkit-details-marker { display: none; }
.el-inventory > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.el-inventory[open] > summary::before { content: "▾"; }
.ei-head { font-size: 12px; font-weight: 600; color: var(--dim); }
.ei-sum { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.el-inventory ul { margin: 8px 0 0; padding: 0; list-style: none; }
.ei { display: flex; gap: 10px; align-items: baseline; font-size: 12px; padding: 3px 0; }
.ei-label { min-width: 140px; }
.ei-id, .ei-kind { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.ei-count { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--dim); }
.ei.none .ei-count { color: var(--red); font-weight: 600; }
.dep-note.none { color: var(--dim); font-size: 12px; }
.shape { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 12px 18px; margin: 16px 0; }
.shape > summary { cursor: pointer; list-style: none; display: flex; gap: 10px; align-items: baseline; }
.shape > summary::-webkit-details-marker { display: none; }
.shape > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.shape[open] > summary::before { content: "▾"; }
.shape-head { font-size: 13px; font-weight: 600; }
.shape-sum { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.shape-row { display: grid; grid-template-columns: 190px 1fr; gap: 10px; padding: 7px 0; border-top: 1px solid var(--surface-3); font-size: 13px; }
.shape-row:first-of-type { border-top: none; }
.shape-label { color: var(--dim); font-size: 12px; }
.shape-val { font-family: var(--mono); font-size: 12px; }
.shape-note { grid-column: 2; color: var(--dim); font-size: 12px; }
.readiness { border-radius: 8px; padding: 11px 15px; margin: 14px 0; font-size: 13px; }
.readiness.ok { display: flex; flex-direction: column; gap: 3px; background: #dcfce7; border: 1px solid #86efac; border-left: 4px solid #16a34a; color: #14532d; }
.readiness.blocked { background: var(--surface-2); border: 1px solid var(--surface-3); border-left: 4px solid var(--yellow); }
.readiness.blocked > summary { cursor: pointer; list-style: none; display: flex; gap: 10px; align-items: baseline; }
.readiness.blocked > summary::-webkit-details-marker { display: none; }
.readiness.blocked > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.readiness.blocked[open] > summary::before { content: "▾"; }
.rd-head { font-weight: 700; font-size: 13px; }
.rd-sum { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.rd-group { margin-top: 10px; }
.rd-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); }
.rd-why { margin: 3px 0 0; font-size: 12px; color: var(--dim); }
.readiness ul { margin: 5px 0 0; padding-left: 18px; }
.readiness li { margin-bottom: 3px; }
.cites-row { font-size: 12px; margin: 8px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.cites-label { color: var(--dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
a.cite { text-decoration: none; }
a.cite code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; color: var(--accent); }
a.cite:hover code { background: var(--surface-3); }
.decide-form { display: none; margin-top: 10px; padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 8px; }
.decide-form.open { display: block; }
.df-intro { font-size: 12px; color: var(--dim); margin-bottom: 8px; }
.decide-form textarea { width: 100%; min-height: 58px; margin-bottom: 8px; font: inherit; font-size: 13px; padding: 8px 10px; border: 1px solid var(--surface-3); border-radius: 6px; background: var(--surface); color: var(--text); box-sizing: border-box; }
.df-actions { display: flex; gap: 10px; align-items: center; }
.df-status { font-size: 12px; color: var(--dim); }
.df-note { margin-top: 8px; font-size: 12px; color: var(--dim); }
.q-group { margin: 22px 0; }
.q-group h2 { display: flex; align-items: baseline; gap: 10px; font-size: 15px; }
.q-count { font-family: var(--mono); font-size: 11px; color: var(--dim); font-weight: 400; }
.q-group ul { margin: 12px 0 0; padding: 0; list-style: none; }
.q-item { border-left: 3px solid var(--surface-3); padding: 10px 0 10px 14px; margin-bottom: 14px; }
.q-item.q-contradiction, .q-item.q-could-not-build { border-left-color: var(--red); }
.q-item.q-ambiguity, .q-item.q-undecided { border-left-color: var(--yellow); }
.q-head { display: flex; flex-wrap: wrap; gap: 9px; align-items: baseline; margin-bottom: 5px; }
.q-tag { font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: 4px; }
.q-tag.conflict { background: #fee2e2; color: #991b1b; font-weight: 700; }
.q-tag.two { background: #fef3c7; color: #854d0e; font-weight: 700; }
.q-tag.undecided { background: #fef3c7; color: #854d0e; }
.q-tag.agree { background: var(--surface-2); color: var(--dim); }
.q-where { font-family: var(--mono); font-size: 11px; color: var(--dim); text-decoration: none; }
.q-where:hover { color: var(--accent); }
.q-owed { font-size: 11px; color: var(--dim); }
.q-question { font-size: 14px; font-weight: 600; white-space: pre-line; margin-bottom: 5px; }
.q-ctx { font-size: 12px; color: var(--dim); margin-top: 2px; }
.q-stakes { font-size: 12px; color: var(--text); margin-top: 5px; }
.q-action { font-family: var(--mono); font-size: 11px; color: var(--dim); margin-top: 6px; }
/* ── Grouping cards: products, areas, capability systems, containers ── */
.group-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin: 14px 0; }
.group-card { display: block; background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 16px 18px; text-decoration: none; color: var(--text); }
.group-card:hover { border-color: var(--accent); }
.group-card-title { font-weight: 600; font-size: 15px; color: var(--accent); }
.group-card-meta { color: var(--dim); font-size: 11px; margin-top: 6px; font-family: var(--mono); }
.group-card-body { color: var(--dim); font-size: 13px; margin-top: 8px; line-height: 1.5; }
/* ── Nav: one tree, two roots. Indentation carries ownership. ── */
.nav-group { margin: 0; }
.nav-summary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; padding: 5px 8px; border-radius: 6px; }
.nav-summary::-webkit-details-marker { display: none; }
.nav-summary::before { content: "▸"; font-size: 9px; color: var(--dim); flex: none; transition: transform 0.12s; }
.nav-group[open] > .nav-summary::before { transform: rotate(90deg); }
.nav-summary:hover { background: var(--surface-2); }
.nav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-count { flex: none; font-family: var(--mono); font-size: 10px; color: var(--dim); }
.nav-depth-1 > .nav-summary .nav-label { font-size: 13px; font-weight: 600; color: var(--text); }
.nav-depth-2 > .nav-summary .nav-label { font-size: 12px; font-weight: 600; color: var(--dim); }
.nav-depth-3 > .nav-summary .nav-label,
.nav-depth-4 > .nav-summary .nav-label { font-size: 12px; font-weight: 500; color: var(--dim); }
.nav-depth-3 > .nav-summary::before,
.nav-depth-4 > .nav-summary::before { font-size: 8px; }
.nav-children { margin-left: 10px; padding-left: 8px; border-left: 1px solid var(--surface-3); }
.nav-overview { display: block; font-size: 11px; color: var(--dim); padding: 3px 8px; text-decoration: none; }
.nav-overview:hover { color: var(--accent); }
.nav-leaf { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 8px; border-radius: 6px; font-size: 13px; text-decoration: none; color: var(--text); }
.nav-leaf:hover { background: var(--surface-2); }
.nav-leaf.active { background: var(--surface-2); font-weight: 600; }
.nav-leaf-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feat-status { flex: none; font-family: var(--mono); font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--surface-2); color: var(--dim); }
.feat-status.s-ready { background: #dcfce7; color: #166534; }
.feat-status.s-undefined { background: #fee2e2; color: #991b1b; }
.feat-status.s-contested { background: #fee2e2; color: #991b1b; }
.feat-status.s-unverified { background: #fef3c7; color: #854d0e; }
.ctx-state { font-size: 11px; font-family: var(--mono); font-weight: 500; padding: 2px 7px; border-radius: 5px; margin-left: 10px; vertical-align: middle; }
.ctx-state.s-validated, .ctx-state.s-active { background: #dcfce7; color: #166534; }
.ctx-state.s-unvalidated { background: #fef3c7; color: #854d0e; }
.ctx-state.s-stale, .ctx-state.s-due-for-review, .ctx-state.s-under-review { background: #fee2e2; color: #991b1b; }
.ctx-state.s-superseded { background: var(--surface-2); color: var(--dim); }
.ctx-cited { font-size: 12px; color: var(--dim); margin: -6px 0 10px; }
.area-context { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 14px 18px; margin: 16px 0; }
.area-context h2 { margin: 0 0 2px; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--dim); }
.ac-doc { margin-top: 12px; }
.ac-title { font-size: 12px; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: 0.04em; }
.area-context ul { margin: 6px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.area-context li { font-size: 14px; }
.ac-term { color: var(--fg); }
.ac-item { font-size: 14px; }
.ac-detail > summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 8px; }
.ac-detail > summary::-webkit-details-marker { display: none; }
.ac-detail > summary::before { content: "▸"; font-size: 9px; color: var(--dim); }
.ac-detail[open] > summary::before { content: "▾"; }
.ac-body { margin: 4px 0 10px 16px; color: var(--dim); font-size: 13px; line-height: 1.6; }
.ac-body p { margin: 0 0 6px; }
.ac-undefined { font-family: var(--mono); font-size: 10px; color: var(--red); }

.deps { margin: 12px 0 4px; display: flex; flex-direction: column; gap: 6px; }
.dep-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dep-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); font-weight: 600; min-width: 116px; }
.dep-pill { background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 6px; padding: 2px 7px; text-decoration: none; }
.dep-pill code { font-size: 11px; color: var(--accent); }
.dep-note { font-size: 12px; color: var(--dim); font-style: italic; padding-left: 124px; }
.kind-group { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--dim); margin: 22px 0 2px; }
.kind-group span { text-transform: none; letter-spacing: 0; font-weight: 400; margin-left: 8px; }
.feat-kind-label { font-size: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); opacity: 0.7; margin: 8px 0 2px 2px; }
.feature-kind.capability { background: #ede9fe; color: #5b21b6; }
.feature-kind.feature { background: var(--surface-2); color: var(--dim); }
.open-questions { background: var(--surface); border: 1px solid var(--surface-3); border-left: 4px solid var(--surface-3); border-radius: 12px; padding: 14px 18px; margin: 16px 0 20px; }
.open-questions.has-blocking { border-left-color: #c9962f; background: #fffaf0; }
.open-questions h2 { margin: 0 0 2px; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--dim); }
.open-questions.has-blocking h2 { color: #8a6416; }
.oq-intro { margin: 0 0 10px; font-size: 13px; color: var(--dim); font-style: italic; }
.open-questions ul { margin: 0; padding: 0; list-style: none; }
.oq { padding: 8px 0; border-top: 1px solid var(--surface-3); }
.oq:first-child { border-top: none; }
.oq-q { font-size: 14px; color: var(--fg); }
.oq-blocking .oq-q { font-weight: 600; }
.oq-blocks, .oq-settled { font-size: 12px; color: var(--dim); margin-top: 3px; }
.oq-blocks code { font-size: 11px; }
.oq-resolved { margin-top: 10px; }
.oq-resolved summary { font-size: 12px; color: var(--dim); cursor: pointer; }
.oq-feature { font-size: 12px; margin-top: 3px; }
.oq-feature a { color: var(--dim); }
.feature-flow .flow-empty { color: var(--dim); font-style: italic; padding: 12px; }

/* Interactive UX preview at the very top of a feature page (before description). */
.ux-preview-h2 { margin: 24px 0 12px; }
.ux-preview { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px; padding: 16px 18px; margin: 8px 0 28px; }
.ux-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.ux-preview-title { font-weight: 600; font-size: 14px; color: var(--dim); }
.ux-preview-panel { display: none; }
.ux-preview-panel.active { display: block; }
.ux-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--surface-3); }
.ux-tab { background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 6px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 12px; color: var(--text); }
.ux-tab:hover { border-color: var(--accent); }
.ux-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
.ux-jump { color: var(--accent); text-decoration: none; font-size: 12px; }
.ux-jump:hover { text-decoration: underline; }

.section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 32px 0 12px; }
.section-head h2 { margin: 0; }
.section-head .rollup { margin: 0; }
.crumb { color: var(--dim); font-size: 12px; margin-bottom: 8px; }
.crumb a { color: var(--dim); text-decoration: none; }
.crumb a:hover { color: var(--text); }
h1 { font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 19px; margin: 32px 0 12px; }
h3 { font-size: 16px; margin: 22px 0 10px; color: var(--dim); }

.meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: var(--dim); font-size: 12px; }

/* Unified pill/chip — used by feature status, behavior derived state, etc.
   Unscoped so it works in headers, behavior cards, anywhere. */
.pill { padding: 2px 10px; border-radius: 999px; font-family: var(--mono); font-size: 11px; border: 1px solid var(--surface-3); color: var(--text); background: transparent; display: inline-block; line-height: 1.5; }
.pill.planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.pill.shipped { color: var(--green); border-color: rgba(46,204,113,0.4); }
.pill.deprecated { color: var(--dim); }

.behavior {
  background: var(--surface); border: 1px solid var(--surface-3); border-radius: 12px;
  padding: 18px 22px; margin: 14px 0;
}
.behavior .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; justify-content: space-between; }
.behavior .head .bid { font-family: var(--mono); font-size: 12px; color: var(--accent); flex: 1 1 auto; }
.behavior .head .status { flex: 0 0 auto; }
/* Derived-state pill for behavior cards. Same chip shape as .pill above. */
.behavior .status {
  font-size: 11px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--surface-3);
  font-family: var(--mono); display: inline-block; line-height: 1.5;
}
.status-verified { color: var(--green); border-color: rgba(46,204,113,0.4); }
.status-proposed { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-planned { color: var(--blue); border-color: rgba(79,140,255,0.4); }
.status-stale { color: var(--yellow); border-color: rgba(245,197,24,0.4); }
.status-contested { color: var(--red); border-color: rgba(255,77,79,0.4); }
.status-deprecated { color: var(--dim); }
.status-unverified { color: var(--dim); border-color: var(--surface-3); }
.status-orphan { color: #d39a3e; border-color: rgba(211,154,62,0.45); }
.status-uncertain { color: #c39bff; border-color: rgba(195,155,255,0.45); }

.evidence { margin-top: 14px; padding: 12px 14px; background: var(--surface-2); border-radius: 8px; font-size: 13px; color: var(--dim); }
.evidence .ev-row { display: flex; gap: 12px; align-items: flex-start; margin: 6px 0; }
.evidence .ev-label { color: var(--dim); width: 84px; flex-shrink: 0; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.06em; padding-top: 3px; }
.evidence .ev-empty { color: var(--dim); font-style: italic; font-size: 12.5px; }
.evidence .ev-pass { color: var(--green); }
.evidence .ev-fail { color: var(--red); }
.evidence .ev-skip { color: var(--dim); }
.evidence .ev-pending { color: var(--yellow); }
.evidence code { font-size: 11.5px; background: var(--surface); padding: 1px 5px; border-radius: 3px; }

.tc-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.tc { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 6px; padding: 10px 12px; }
.tc-head { display: flex; gap: 10px; align-items: center; font-size: 11.5px; }
.tc-id { font-family: var(--mono); color: var(--dim); }
.tc-level { font-family: var(--mono); font-size: 10.5px; padding: 1px 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--surface-3); color: var(--accent); }
.tc-status { font-family: var(--mono); font-size: 11px; }
.tc-when { font-family: var(--mono); font-size: 10.5px; color: var(--dim); margin-left: 4px; }
.tc-desc { color: var(--text); margin: 6px 0 2px; font-size: 13px; }
.tc-detail { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--surface-3); font-size: 12px; color: var(--text); }
.tc-line { display: flex; gap: 10px; margin: 2px 0; }
.tc-key { font-family: var(--mono); font-size: 10.5px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; width: 50px; flex-shrink: 0; padding-top: 1px; }
.tc-steps { margin: 4px 0 0; font-family: var(--mono); font-size: 11.5px; white-space: pre-wrap; background: var(--surface-2); padding: 6px 10px; border-radius: 4px; }
.tc-coverage { margin-top: 6px; font-size: 11.5px; color: var(--dim); }
.tc-coverage code { font-size: 10.5px; }

.surfaces { display: flex; flex-direction: column; gap: 18px; margin: 14px 0 28px; }
.surface { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 10px; padding: 16px 18px; }
.surface-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.surface-head h3 { font-size: 16px; margin: 0; color: var(--text); }
/* surface-path-wrap / .surface-path styles removed — path is not rendered. */
.surface-count { font-size: 11.5px; color: var(--dim); margin-left: auto; }
.surface-count-empty { color: var(--yellow); font-style: italic; }
.surface-sketch {
  font-family: var(--mono); font-size: 12px; line-height: 1.4;
  background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 6px;
  padding: 12px 14px; margin: 8px 0; overflow-x: auto; white-space: pre;
}
/* Sketch element decorations — purely visual, no layout impact (use inline). */
.surface-sketch .sketch-button { color: var(--accent); font-weight: 600; }
.surface-sketch .sketch-input { color: var(--dim); }
.surface-sketch .sketch-checkbox { color: var(--accent); }
.surface-sketch .sketch-dropdown { color: var(--accent); }
.surface-sketch .sketch-textlink { color: var(--blue); }
/* Whole-pattern anchor wrap: the brackets themselves are part of the clickable
   region, so the button reads as a real button. The at-rest treatment uses a
   subtle dotted underline so it's visibly clickable even before hover. */
.surface-sketch a.sketch-anchor {
  text-decoration: underline; text-decoration-style: dotted;
  text-decoration-thickness: 1px; text-underline-offset: 3px;
  text-decoration-color: rgba(37, 99, 235, 0.45);
  cursor: pointer;
}
.surface-sketch a.sketch-anchor:hover { background: rgba(37, 99, 235, 0.12); border-radius: 3px; text-decoration-style: solid; }
.surface-sketch a.sketch-anchor:hover .sketch-button { filter: brightness(1.15); }
.surface-sketch a.sketch-anchor:hover .sketch-textlink { filter: brightness(1.15); }

/* Card / list-item rows. The ▢ or ▦ symbol is colored distinctively so the
   card pattern is identifiable even without a leads_to. When leads_to is set,
   the row is wrapped in sketch-anchor (above) and the whole row becomes
   click-targetable; sketch-card-text gets a subtle treatment too. */
.surface-sketch .sketch-card-glyph { color: var(--accent); font-weight: 600; }
.surface-sketch a.sketch-card-row .sketch-card-text { color: var(--text); }
.surface-sketch a.sketch-card-row:hover .sketch-card-glyph { filter: brightness(1.2); }
/* element-pill row removed — sketch is the canonical element view now */
.surface-notes { margin-top: 10px; color: var(--dim); font-size: 12.5px; padding: 8px 10px; background: var(--surface-2); border-radius: 4px; }
.surface-behaviors { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--surface-3); display: flex; flex-direction: column; gap: 12px; }
.surface-behaviors .behavior { margin: 0; }

.behavior .anchor-strip { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dim); margin: 4px 0 8px; flex-wrap: wrap; }
.behavior .anchor-strip a { color: var(--accent); text-decoration: none; font-family: var(--mono); }
.behavior .anchor-strip a:hover { text-decoration: underline; }
.behavior .anchor-strip .arr { color: var(--surface-3); }
.behavior .anchor-strip .interaction { font-family: var(--mono); padding: 1px 6px; border-radius: 3px; background: var(--surface-2); color: var(--text); font-size: 10.5px; }
.behavior .anchor-strip .element-ref code { font-family: var(--mono); font-size: 11px; color: var(--accent); background: var(--surface-2); padding: 1px 5px; border-radius: 3px; }

.affected-by { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 12px; }
.affected-by-label { font-size: 11.5px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.06em; }
.affected-by-pill { background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 999px; padding: 3px 10px; text-decoration: none; font-size: 11.5px; color: var(--accent); }
.affected-by-pill:hover { border-color: var(--accent); background: var(--surface); }
.affected-by-pill code { font-family: var(--mono); font-size: 11px; color: inherit; background: transparent; padding: 0; }

.rollup { display: flex; gap: 12px; margin: 12px 0 20px; flex-wrap: wrap; }
.rollup .chip { background: var(--surface); border: 1px solid var(--surface-3); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-family: var(--mono); color: var(--dim); }
.rollup .chip strong { color: var(--text); margin-right: 4px; }
.rollup .chip.verified strong { color: var(--green); }
.rollup .chip.contested strong { color: var(--red); }
.rollup .chip.orphan strong { color: #d39a3e; }
.rollup .chip.uncertain strong { color: #c39bff; }
.rollup .chip.unverified strong { color: var(--yellow); }

.behavior .reason { font-size: 11px; color: var(--dim); font-style: italic; margin-top: 2px; }
.edit-form { display: none; margin-top: 10px; }
.edit-form.open { display: block; }
.edit-form textarea { width: 100%; min-height: 70px; background: var(--surface-2); color: var(--text); border: 1px solid var(--surface-3); border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 13px; resize: vertical; }
.edit-form .row { display: flex; gap: 8px; margin-top: 6px; }

.behavior .claim { font-size: 15px; line-height: 1.55; margin: 6px 0 12px; }
.behavior .conf { font-size: 12px; margin: 6px 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.behavior .conf-chip { flex: none; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; }
.behavior .conf-stated .conf-chip { background: #dcfce7; color: #166534; }
.behavior .conf-observed .conf-chip { background: #e0e7ff; color: #3730a3; }
.behavior .conf-guessed .conf-chip { background: #fee2e2; color: #991b1b; font-weight: 600; }
.behavior .conf-basis { color: var(--dim); font-family: var(--mono); font-size: 11px; }
.behavior .conf-ref { display: block; opacity: 0.55; font-size: 10px; margin-top: 2px; }
.behavior .verified-line { color: var(--dim); font-size: 12px; margin: 6px 0; }
.behavior .notes { color: var(--dim); font-size: 13px; margin-top: 12px; padding: 10px 12px; background: var(--surface-2); border-radius: 6px; }
.behavior .impl {
  color: var(--dim); font-size: 11px; font-family: var(--mono); margin-top: 10px;
  padding-top: 10px; border-top: 1px dashed var(--surface-3);
}
.behavior .impl-label { text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); margin-right: 8px; }

.actions { display: flex; gap: 8px; margin-top: 14px; align-items: center; flex-wrap: wrap; }
.actions button, .actions .toggle {
  background: var(--surface-2); border: 1px solid var(--surface-3); color: var(--text);
  padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px;
}
.actions button.primary { background: var(--accent); border-color: var(--accent); color: white; }
.actions button.primary:hover { filter: brightness(1.1); }
.actions button:hover { border-color: var(--accent); }
.actions button.danger { color: var(--red); }
.actions button.danger:hover { border-color: var(--red); }
.actions button:disabled { opacity: 0.5; cursor: wait; }

.feedback-form { margin-top: 12px; display: none; }
.feedback-form.open { display: block; }
.feedback-form textarea {
  width: 100%; min-height: 80px; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--surface-3); border-radius: 6px; padding: 10px 12px;
  font: inherit; font-size: 13px; resize: vertical;
}
.feedback-form .row { display: flex; gap: 8px; margin-top: 8px; }
.feedback-form button { padding: 6px 14px; }

.ai-form { margin-top: 12px; display: none; }
.ai-form.open { display: block; }
.ai-form textarea {
  width: 100%; min-height: 100px; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--surface-3); border-radius: 6px; padding: 10px 12px;
  font: inherit; font-size: 13px; resize: vertical;
}
.ai-form .row { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.ai-form button { padding: 6px 14px; }
.ai-form select {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--surface-3);
  border-radius: 6px; padding: 6px 10px; font: inherit; font-size: 13px;
}

.toast {
  position: fixed; bottom: 24px; right: 24px; background: var(--surface);
  border: 1px solid var(--surface-3); padding: 10px 16px; border-radius: 8px;
  font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); opacity: 0; pointer-events: none;
  transition: opacity 0.15s ease;
}
.toast.show { opacity: 1; }

article.prose { color: var(--text); }
article.prose p { margin: 12px 0; }
article.prose ul, article.prose ol { margin: 12px 0; padding-left: 24px; }
article.prose code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-family: var(--mono); font-size: 13px; }
article.prose pre { background: var(--surface-2); padding: 14px 18px; border-radius: 8px; overflow-x: auto; }
article.prose pre code { background: transparent; padding: 0; font-size: 12px; }
article.prose a { color: var(--accent); }
article.prose hr { border: none; border-top: 1px solid var(--surface-3); margin: 24px 0; }
article.prose blockquote { border-left: 3px solid var(--surface-3); margin: 12px 0; padding: 4px 16px; color: var(--dim); }
article.prose img { max-width: 100%; border-radius: 8px; }

.empty-state { color: var(--dim); padding: 24px; }
.feedback-section { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--surface-3); }
.feedback-section h2 { margin-top: 0; }
article.prose.context h2 { scroll-margin-top: 80px; }
article.prose.context .anchor { color: var(--dim); text-decoration: none; font-weight: 400; margin-right: 6px; }
article.prose.context .anchor:hover { color: var(--accent); }
`;

const APP_JS = `
async function action(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 1800);
}

// UX preview tab clicks — switch the visible panel inside .ux-preview.
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.ux-tab');
  if (!tab) return;
  const targetId = tab.dataset.uxTarget;
  if (!targetId) return;
  const preview = tab.closest('.ux-preview');
  if (!preview) return;
  preview.querySelectorAll('.ux-tab').forEach((b) => b.classList.remove('active'));
  preview.querySelectorAll('.ux-preview-panel').forEach((p) => p.classList.remove('active'));
  tab.classList.add('active');
  const panel = document.getElementById(targetId);
  if (panel) panel.classList.add('active');
});

// Sketch link click handling.
//   - Same-page anchor (#surface-X): if the target surface is also a tab in
//     the UX preview, switch to that tab in-place instead of scrolling.
//   - Cross-feature (/area/feature...): confirm before navigating away.
document.addEventListener('click', (e) => {
  // Match both decorated ASCII sketch anchors AND plain anchors inside
  // a .ux-mock HTML mock. The AI generating sketch_html shouldn't need to
  // know about a ProductOS-internal class — any <a> in .ux-mock counts.
  const a = e.target.closest('.sketch-anchor') ||
            (e.target.closest('.ux-mock') && e.target.closest('a'));
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (href.startsWith('#surface-')) {
    // Try to swap the UX preview tab to this surface if it lives in one.
    const sid = href.slice('#surface-'.length);
    const tab = document.querySelector('.ux-preview .ux-tab[data-ux-target="ux-preview-' + sid + '"]');
    if (tab) {
      e.preventDefault();
      tab.click();
      // also scroll the preview into view so the swap is visible
      const preview = tab.closest('.ux-preview');
      if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    // Otherwise the default anchor jump will take them down to the UX details card.
    return;
  }
  // Cross-feature: confirm before navigating away.
  if (href.startsWith('/') && href.length > 1) {
    const title = a.getAttribute('title') || ('Open ' + href);
    if (!confirm(title + '?')) {
      e.preventDefault();
    }
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;
  const featureId = btn.dataset.feature;
  const behaviorId = btn.dataset.behavior;

  if (a === 'refresh') {
    btn.classList.add('spinning');
    location.reload();
    return;
  } else if (a === 'ai-submit') {
    const pane = btn.closest('.ai-assist-pane');
    const ta = pane.querySelector('.ai-assist-input');
    const text = ta.value.trim();
    const status = pane.querySelector('.ai-assist-status');
    status.className = 'ai-assist-status';
    if (!text) { status.textContent = 'Type a request first.'; return; }
    btn.disabled = true;
    status.textContent = 'Submitting…';
    const res = await action('/api/feedback', {
      feature: featureId, body: text, action: 'feedback',
    });
    if (res.ok) {
      if (res.byok && res.byok.kind === 'applied') {
        status.className = 'ai-assist-status success';
        status.textContent = '✓ Applied: ' + (res.byok.summary || res.byok.ops.join(', '));
        ta.value = '';
        setTimeout(() => location.reload(), 1200);
      } else if (res.byok && res.byok.kind === 'needs_review') {
        status.className = 'ai-assist-status warning';
        status.textContent = '⚠ Needs a person to look at it (' + res.byok.reason + ') — queued for review.';
        ta.value = '';
      } else if (res.byok && res.byok.kind === 'error') {
        status.className = 'ai-assist-status error';
        status.textContent = '✗ Could not apply it now (' + res.byok.message + ') — queued for review instead.';
      } else {
        status.className = 'ai-assist-status success';
        status.textContent = '✓ Queued for review.';
        ta.value = '';
      }
    } else {
      status.className = 'ai-assist-status error';
      status.textContent = '✗ Error: ' + (res.error || 'failed');
    }
    btn.disabled = false;
    return;
  } else if (a === 'verify') {
    btn.disabled = true;
    await action('/api/verify', { feature: featureId, behavior: behaviorId });
    toast(behaviorId + ' accepted');
    setTimeout(() => location.reload(), 400);
  } else if (a === 'reject') {
    const reason = prompt('Reason for rejecting "' + behaviorId + '"? (will be saved as deprecated_reason)') || '';
    if (reason === '') return;
    btn.disabled = true;
    await action('/api/reject', { feature: featureId, behavior: behaviorId, reason });
    toast(behaviorId + ' rejected');
    setTimeout(() => location.reload(), 400);
  } else if (a === 'decide-toggle') {
    const form = btn.closest('.behavior').querySelector('.decide-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea[name=claim]').focus();
  } else if (a === 'decide-submit') {
    const form = btn.closest('.decide-form');
    const status = form.querySelector('.df-status');
    const claim = form.querySelector('textarea[name=claim]').value.trim();
    const because = form.querySelector('textarea[name=because]').value.trim();
    if (claim.length < 10) { status.textContent = 'The claim needs to be a real sentence.'; return; }
    if (because.length < 10) { status.textContent = 'Say why — that is the part that lasts.'; return; }
    btn.disabled = true;
    status.textContent = 'Recording…';
    const res = await action('/api/decide', {
      feature: form.dataset.feature, behavior: form.dataset.behavior, claim, because
    });
    if (res && res.error) { status.textContent = res.error; btn.disabled = false; return; }
    toast('Decided — the claim is awaiting review');
    setTimeout(() => location.reload(), 500);
  } else if (a === 'edit-toggle') {
    const form = btn.closest('.behavior').querySelector('.edit-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea[name=claim]').focus();
  } else if (a === 'edit-cancel') {
    btn.closest('.edit-form').classList.remove('open');
  } else if (a === 'edit-save') {
    const form = btn.closest('.edit-form');
    const claim = form.querySelector('textarea[name=claim]').value.trim();
    const notes = form.querySelector('textarea[name=notes]').value.trim();
    if (claim.length < 10) { toast('claim too short'); return; }
    btn.disabled = true;
    const res = await action('/api/edit-behavior', { feature: featureId, behavior: behaviorId, claim, notes });
    if (res.ok) {
      toast(behaviorId + ' updated');
      setTimeout(() => location.reload(), 400);
    } else {
      toast('error: ' + (res.error || 'failed'));
      btn.disabled = false;
    }
  } else if (a === 'contest') {
    const form = btn.closest('.behavior').querySelector('.feedback-form');
    form.classList.add('open');
    form.querySelector('input[name=action]').value = 'contest';
    form.querySelector('textarea').focus();
  } else if (a === 'feedback-toggle') {
    const form = btn.closest('article, section').querySelector('.feedback-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea').focus();
  } else if (a === 'feedback-cancel') {
    btn.closest('.feedback-form').classList.remove('open');
  } else if (a === 'feedback-submit') {
    const form = btn.closest('.feedback-form');
    const body = form.querySelector('textarea').value.trim();
    if (!body) { toast('write something first'); return; }
    const actType = form.querySelector('input[name=action]')?.value || 'feedback';
    btn.disabled = true;
    const res = await action('/api/feedback', {
      feature: featureId, behavior: behaviorId, body, action: actType,
    });
    if (res.ok) {
      toast(actType === 'contest' ? behaviorId + ' contested' : 'feedback queued');
      form.querySelector('textarea').value = '';
      form.classList.remove('open');
      if (actType === 'contest') setTimeout(() => location.reload(), 400);
    } else {
      toast('error: ' + (res.error || 'failed'));
    }
    btn.disabled = false;
  } else if (a === 'ai-toggle') {
    const form = btn.closest('.behavior').querySelector('.ai-form');
    form.classList.toggle('open');
    if (form.classList.contains('open')) form.querySelector('textarea').focus();
  } else if (a === 'ai-cancel') {
    btn.closest('.ai-form').classList.remove('open');
  } else if (a === 'ai-submit') {
    const form = btn.closest('.ai-form');
    const body = form.querySelector('textarea').value.trim();
    if (!body) { toast('write something first'); return; }
    const kind = form.querySelector('select[name=kind]')?.value || 'freeform';
    btn.disabled = true;
    const res = await action('/api/queue/enqueue', {
      feature: featureId, behavior: behaviorId, body, kind,
    });
    if (res.ok) {
      toast('Queued ' + res.id + ' — say "drain productos queue" in Claude');
      form.querySelector('textarea').value = '';
      form.classList.remove('open');
    } else {
      toast('error: ' + (res.error || 'failed'));
    }
    btn.disabled = false;
  }
});
`;

export interface ShellOptions {
  /** When set, an additional <link rel="stylesheet"> is inserted so the
   *  user's app CSS loads alongside ProductOS's own styles. The server
   *  serves the file at /_user-style.css when web.stylesheet is configured. */
  userStylesheetUrl?: string;
}

export function renderShell(
  title: string,
  body: string,
  sidebar: string,
  options: ShellOptions = {}
): string {
  const userCssLink = options.userStylesheetUrl
    ? `<link rel="stylesheet" href="${escape(options.userStylesheetUrl)}" />`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)} — ProductOS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${SHELL_CSS}</style>
    ${userCssLink}
  </head>
  <body>
    <aside>${sidebar}</aside>
    <main>${body}</main>
    <script>${APP_JS}</script>
    <script type="module">
      // Lazy-load Mermaid only if a flow chart is on the page.
      //
      // ⛔ run() explicitly; never startOnLoad. Mermaid registers its
      // startOnLoad hook as a window 'load' listener when its module
      // evaluates, and this page has no subresources to hold 'load' open —
      // so 'load' fires long before a two-hop CDN fetch lands, the listener
      // is registered too late, and the graph stays raw source. run() does
      // not care when it is called.
      (async () => {
        const blocks = document.querySelectorAll('.feature-flow .mermaid');
        if (blocks.length === 0) return;
        try {
          const m = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
          m.default.initialize({ startOnLoad: false, theme: 'neutral', flowchart: { curve: 'basis' } });
          await m.default.run({ nodes: blocks });
        } catch (e) {
          console.warn('mermaid load failed', e);
          // Unrendered source collapses to one unreadable line in a div.
          // If we could not draw the graph, at least show its source as source.
          for (const b of blocks) b.classList.add('mermaid-raw');
        }
      })();
    </script>
  </body>
</html>`;
}

/**
 * Filter out the scaffolded "example" area once there are real (non-example)
 * areas. Until the user has real content, the example helps; after, it's noise.
 */
export function visibleAreas(areas: AreaDocument[]): AreaDocument[] {
  const real = areas.filter((a) => a.slug !== "example");
  return real.length > 0 ? real : areas;
}

/**
 * One nav row for a container — the leaf of either tree.
 *
 * ⛔ Both trees use this. They previously had separate markup for the same shape:
 * capabilities borrowed the area heading style, which is a flex row with its content
 * pushed apart, so a subsystem's name sat hard against the right edge for no reason
 * anyone could see. Two renderings of one shape drift, and this one drifted visibly.
 */
/**
 * Every reader-facing state word, in one place.
 *
 * ⛔ THESE WORDS ARE THE PRODUCT. Three independent fresh readers misread the old set,
 * and two of the misreadings inverted the meaning:
 *
 * - `not accepted` was read as **rejected** — "I read four design principles and seven
 *   non-goals as *rejected* for the first twenty minutes." Close to the opposite of
 *   "nobody has looked at it yet."
 * - `undefined` was read as **a JavaScript error leaking into the page**, helped along
 *   by being styled red beside a count. The language already owns that word for "bug".
 * - `unverified` and `to verify` named one state in two places, so a reader went
 *   looking for the difference.
 *
 * So the vocabulary lives here and nowhere else, one word per state, and the CSS tone
 * classes keep their old names — the words changed, the styling did not.
 */
export const STATE_WORDS = {
  /** A behavior carrying a question and no claim. */
  undecided: "undecided",
  /** Two claims that cannot both hold. */
  contradiction: "contradiction",
  /** Decided, and two people would build it differently. */
  ambiguous: "ambiguous",
  /** Nobody has accepted it yet. Used for behaviors AND context sections, deliberately
   *  the same word, because it is the same act by the same person. */
  awaitingReview: "awaiting review",
  accepted: "accepted",
  /** Accepted, then the wording changed underneath the stamp. */
  editedSinceAccepted: "edited since accepted",
  contested: "contested",
} as const;

/** The one-line explanation each state owes a reader. Shown on hover AND on /_states. */
export const STATE_HELP: Record<string, string> = {
  undecided:
    "A question with no answer yet. Nothing here can be built from — ask rather than assume.",
  "awaiting review":
    "Written, and no human has accepted it yet. Not rejected, not wrong — nobody has looked.",
  accepted: "A human confirmed this is what the team intends.",
  // ⛔ Decisions have their own states and `/_states` did not carry them, while telling a
  // reader that "a proposal contradicting one of these is wrong before it is evaluated
  // against anything else." A reader: "I am asked to treat as binding a decision labelled
  // `due for review`, with no definition of what that label means."
  active: "This decision still governs. Build to it.",
  "under-review": "Somebody has reopened this decision. It still governs until it is replaced, but do not build new things that depend on it holding.",
  "due for review": "The date this decision asked to be revisited has passed and nobody has. It still governs — and it was written expecting to be checked by now.",
  superseded: "A later decision replaced this one. Kept because the reasoning is still worth reading; it no longer governs.",
  reaffirmed: "Revisited and left as it was. The record of it having been questioned is deliberately kept.",
  "edited since accepted":
    "It was accepted, then the wording changed. The stamp no longer covers what it says.",
  contested: "Somebody says this is not true of the product.",
  contradiction:
    "This claim and another on this site cannot both hold. One of the two is wrong — neither should be built from until somebody says which.",
  ambiguous:
    "Decided, and underdetermined. The claim is not wrong — a reader found two ways to read it, and two engineers would ship different products and both would pass every test case. Resolve it by rewording, or by splitting the readings into separate behaviors.",
  suspected:
    "Somebody believes this dependency exists and the owner of that page has not declared it. It counts toward the impact figure with the doubt attached.",
  "read end to end":
    "A person read the whole page and said whether they could hand it to an engineer. The only signal here that no check can compute — everything else is derived from the page's shape.",
  verified: "Accepted by a human, with evidence behind it.",
  orphan: "Accepted, and nothing has demonstrated it yet.",
  uncertain: "Evidence disagrees with the claim, or the evidence is stale.",
  ready: "Every claim decided and accepted, with acceptance criteria. Buildable.",
  empty: "No behaviors here yet.",
  "no criteria": "Claims are settled, but nothing says what would demonstrate them.",
  planned: "Intended. No code yet.",
  built: "The code exists. Separate from whether anyone accepted the claims about it.",
  retired: "No longer part of the product.",
  feature: "Something a user gets, triggered by a user action, with screens.",
  capability:
    "One thing a subsystem promises, triggered by an input from elsewhere. No screens.",
  stated: "A human said this.",
  observed: "Read off the code, with a citation.",
  guessed: "Inferred. Read this one closely.",
};

/** The word a reader sees for an internal state name. */
export function readerWord(state: string): string {
  if (state === "undefined") return STATE_WORDS.undecided;
  if (state === "unverified") return STATE_WORDS.awaitingReview;
  return state;
}

/** A state word plus its explanation, linked to the full key. */
export function stateChip(word: string, cls: string, prefix = ""): string {
  const help = STATE_HELP[word];
  return `<a class="${cls}" href="/_states#${escape(word.replace(/ /g, "-"))}"${
    help ? ` title="${escape(help)}"` : ""
  }>${prefix}${escape(word)}</a>`;
}

/**
 * Findings about the write-up, on the page they are about.
 *
 * ⛔ The counts existed and the findings did not. A reader met "32 issues" in bold —
 * "the loudest thing on the page" — with no link and no page anywhere listing them:
 * *"Something is telling me 32 things are wrong with the document I am building from,
 * and there is no way to find out what."* A count you cannot open is worse than no
 * count, because it withholds the reason it just gave you to distrust the page.
 *
 * Collapsed, and explicitly labelled as being about the write-up rather than about the
 * product — a reader must not mistake "this claim has no test cases" for "the product
 * is broken".
 */
function renderAuditFindings(findings: AuditFinding[]): string {
  if (findings.length === 0) return "";
  const bySeverity = (s: string) => findings.filter((f) => f.severity === s);
  const order = ["high", "medium", "low"] as const;
  const counts = order
    .filter((s) => bySeverity(s).length)
    .map((s) => `${bySeverity(s).length} ${s}`)
    .join(" · ");
  const rows = order
    .flatMap((s) => bySeverity(s))
    .map(
      (f) => `<li class="af af-${escape(f.severity)}">
          <div class="af-msg">${escape(f.message.split("\n")[0] ?? "")}</div>
          <div class="af-where">${
            f.behavior_id
              ? `<a href="#behavior-${escape(f.behavior_id)}"><code>${escape(f.behavior_id)}</code></a>`
              : f.ux_id
                ? `<a href="#surface-${escape(f.ux_id)}"><code>${escape(f.ux_id)}</code></a>`
                : "this page"
          } · <span class="af-kind">${escape(f.kind)}</span></div>
        </li>`
    )
    .join("");
  return `<details class="audit-findings" id="write-up">
      <summary><span class="af-head">Notes on this write-up</span><span class="af-count">${escape(
        counts
      )}</span></summary>
      <p class="oq-intro">Problems with how this page is <em>written</em>, not with the product. A reader can ignore these; whoever maintains this page cannot.</p>
      <ul>${rows}</ul>
    </details>`;
}

/**
 * A contradiction, rendered on both sides.
 *
 * ⛔ Derived in the incoming direction, exactly like `depends_on` / `Depended on by`.
 * A contradiction declared on one page and invisible from the other reproduces the
 * failure it exists to record: "the next reader of the pricing page sees a clean
 * unverified claim and builds it."
 *
 * Loud, and not collapsible. Every other panel on the page can be skipped; this one
 * says two claims on this site cannot both be true, which is the one thing a reader
 * must not build past.
 */
function contradictionBlock(
  featureId: string,
  b: Behavior,
  incoming: Array<{ from: string; note: string }>
): string {
  const outgoing = (b.contradicts ?? []).map((ref) => ({
    ref,
    note: b.contradiction_note ?? "",
  }));
  if (outgoing.length === 0 && incoming.length === 0) return "";
  const link = (ref: string) => {
    const [cid, bid] = ref.split("#");
    return bid
      ? `<a href="/${escape(cid!)}#behavior-${escape(bid)}"><code>${escape(ref)}</code></a>`
      : `<a href="#behavior-${escape(ref)}"><code>${escape(ref)}</code></a>`;
  };
  const rows = [
    ...outgoing.map(
      (o) => `<li>Cannot both hold with ${link(o.ref)}${
        o.note ? `<div class="contra-why">${escape(o.note)}</div>` : ""
      }</li>`
    ),
    ...incoming.map(
      (i) => `<li>${link(i.from)} says it cannot both hold with this${
        i.note ? `<div class="contra-why">${escape(i.note)}</div>` : ""
      }</li>`
    ),
  ].join("");
  void featureId;
  return `<div class="contradiction">
      <div class="contra-head">Contradiction</div>
      <ul>${rows}</ul>
      <div class="contra-warn">One of the two is wrong. Neither should be built from until somebody says which.</div>
    </div>`;
}

/** Every contradiction pointing AT a behavior, from anywhere in the corpus. */
export function buildContradictionIndex(
  containers: FeatureDocument[]
): Map<string, Array<{ from: string; note: string }>> {
  const index = new Map<string, Array<{ from: string; note: string }>>();
  for (const c of containers) {
    for (const b of c.frontmatter.behaviors) {
      for (const ref of b.contradicts ?? []) {
        const key = ref.includes("#") ? ref : `${c.frontmatter.id}#${ref}`;
        const arr = index.get(key) ?? [];
        arr.push({
          from: `${c.frontmatter.id}#${b.id}`,
          note: b.contradiction_note ?? "",
        });
        index.set(key, arr);
      }
    }
  }
  return index;
}

/**
 * Open framework gaps, on the page they were forced into.
 *
 * ⛔ THIS CLOSES THE GAP A READER NAMED ABOUT THE GAPS THEMSELVES:
 *
 *   "Relations clearly exist as a concept, so I cannot tell from the site whether this
 *    relation is unexpressible or merely unwritten — which is itself the problem: as a
 *    reader I cannot distinguish 'the tool can't say it' from 'nobody said it,' and
 *    those route to different people."
 *
 * The data was already there — `forced_into` names the container the compromise landed
 * in — and it was only ever visible to us, in a YAML file the reader cannot reach. So
 * the reader who hits the compromise now sees that it IS one, and that it is our fault
 * rather than the author's.
 *
 * Deliberately worded as an admission. A reader must be able to stop trying to make
 * sense of a shape that has no correct version yet.
 */
function renderFrameworkGaps(gaps: Array<{ what: string; question?: string }>): string {
  if (gaps.length === 0) return "";
  return `<section class="fw-gaps">
      <h2>${escape(
        `${gaps.length} thing${gaps.length === 1 ? "" : "s"} this page could not say properly`
      )}</h2>
      <p class="oq-intro">Not the author's doing — the tool has no shape for these yet, so what you see below is an approximation somebody was forced into. If a part of this page reads oddly, this is probably why.</p>
      <ul>${gaps
        .map(
          (g) => `<li class="fwg">
              <div class="fwg-what">${escape(g.what)}</div>
              ${g.question ? `<div class="fwg-q">Open with the tool's authors: ${escape(g.question)}</div>` : ""}
            </li>`
        )
        .join("")}</ul>
    </section>`;
}

/**
 * The boundary, at the top of the page it constrains.
 *
 * ⛔ A projection, not a copy — the distinction that makes this legal under
 * "every fact has exactly one home". The non-goal lives in context; this page answers a
 * different question: *what must I not assume here.* The text is read from context, so
 * there is still one place to change it.
 *
 * It exists because the single most load-bearing fact about a feature was two clicks
 * away and 21st of 23 behaviours down the page:
 *
 *   "I assumed a product called 'pricing' prices things. It explicitly refuses to. That
 *    is the single most important fact about this feature and I only found it two clicks
 *    deep. It is not on the feature page's first screen."
 *
 * Only non-goals, and only ones this container's behaviors actually cite. A feature that
 * rests on no non-goal gets nothing.
 */
function boundaryBlock(
  behaviors: Behavior[],
  sections: Map<string, { section: ContextSection; doc: ContextDocument }>
): string {
  const refs = new Set<string>();
  for (const b of behaviors) {
    if (b.deprecated) continue;
    for (const ref of b.cites ?? []) if (/(^|\/)non-goals#/.test(ref)) refs.add(ref);
  }
  if (refs.size === 0) return "";
  const items = [...refs]
    .map((ref) => {
      const hit = sections.get(ref);
      if (!hit) return "";
      const text = hit.section.text.trim().split("\n\n")[0] ?? "";
      return `<li><strong>${escape(hit.section.title)}</strong>${
        text ? ` — ${escape(text.replace(/\s+/g, " ")).slice(0, 220)}` : ""
      }</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `<section class="boundary">
      <h2>What this must not do</h2>
      <p class="oq-intro">Deliberate absences this feature rests on. An agent finding no handling for one of these and calling it a gap is how removed behaviour comes back.</p>
      <ul>${items}</ul>
    </section>`;
}

/**
 * Notes already filed against this page, on the page.
 *
 * ⛔ A queue nobody standing on the page can see is a queue that gets duplicated. A
 * second reviewer walked straight into it:
 *
 *   "`/_feedback` holds eleven open entries, seven of which are prior fresh-eyes
 *    findings against pages I was reviewing, including three against this exact
 *    subsystem. Nothing on those pages shows any trace."
 *
 * So they re-found what somebody had already reported, and the reader after them would
 * have done it again. The entries existed and the page they were about never mentioned
 * them.
 */
function openNotesBlock(entries: FeedbackEntry[]): string {
  const open = entries.filter((e) => e.frontmatter.state !== "processed");
  if (open.length === 0) return "";
  return `<section class="open-notes">
      <h2>${escape(
        `${open.length} note${open.length === 1 ? "" : "s"} already filed against this page`
      )}</h2>
      <p class="oq-intro">Somebody has raised these and nobody has acted on them yet. Read them before you write another — otherwise the same finding gets reported twice and neither copy gets fixed.</p>
      <ul>${open
        .map(
          (e) => `<li class="onote">
              <div class="onote-body">${escape(
                (e.body ?? "").replace(/\s+/g, " ").slice(0, 320)
              )}${(e.body ?? "").length > 320 ? "…" : ""}</div>
              <div class="onote-meta"><a href="/_feedback"><code>${escape(
                e.frontmatter.id
              )}</code></a>${
                e.frontmatter.target?.behavior
                  ? ` · about <code>${escape(e.frontmatter.target.behavior)}</code>`
                  : ""
              }</div>
            </li>`
        )
        .join("")}</ul>
    </section>`;
}

/**
 * "Decided, and two people would read it differently."
 *
 * ⛔ Amber, not red, and deliberately not the same colour as a contradiction. A
 * contradiction says one of two claims is wrong; this says one claim is right and
 * underdetermined. Conflating them would make the loud state mean two things.
 */
function ambiguityBlock(b: Behavior): string {
  const items = b.ambiguous ?? [];
  if (items.length === 0) return "";
  return items
    .map(
      (a) => `<div class="ambiguity">
        <div class="amb-head">Two readings${
          a.raised_by ? ` · raised by ${escape(a.raised_by)}` : ""
        }</div>
        <ol>${a.readings.map((r) => `<li>${escape(r)}</li>`).join("")}</ol>
        ${a.cost ? `<div class="amb-cost">Guessing wrong: ${escape(a.cost)}</div>` : ""}
        <div class="amb-warn">The claim is not wrong — it is underdetermined. Two engineers would ship different products and both would pass every case below.</div>
      </div>`
    )
    .join("");
}

/**
 * Whether a person has actually read this end to end, and whether they could build.
 *
 * ⛔ THE ONLY SIGNAL ON THE PAGE THAT NO CHECK CAN COMPUTE. Everything else — audit
 * notes, readiness, conformance — is derived from structure, and a reviewer showed
 * exactly how far that gets you: thirty-two mechanical notes, none of which was any of
 * the sixteen problems that made the feature unbuildable. Form is checkable; agreement
 * between two sentences is not.
 *
 * Shown at the top, above everything, because it outranks every derived signal: a
 * corpus that passes every check and that nobody could build from is a corpus whose
 * checks are measuring the wrong thing.
 */
function readThroughBlock(
  reads: NonNullable<FeatureDocument["frontmatter"]["read_throughs"]>
): string {
  if (reads.length === 0) {
    return `<div class="readthrough none">Nobody has read this end to end and said whether they could build from it. Every other signal on this page is computed from its shape — none of them can tell you that.</div>`;
  }
  const latest = [...reads].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0]!;
  const blocked = latest.blocked_by.length
    ? ` Blocked on ${latest.blocked_by
        .map((x) =>
          x.includes("#")
            ? `<a href="/${escape(x.split("#")[0]!)}#behavior-${escape(x.split("#")[1]!)}"><code>${escape(x)}</code></a>`
            : `<a href="#behavior-${escape(x)}"><code>${escape(x)}</code></a>`
        )
        .join(", ")}.`
    : "";
  return `<div class="readthrough ${latest.buildable ? "ok" : "blocked"}">
      <strong>${
        latest.buildable
          ? `${escape(latest.by)} read this end to end and could build from it`
          : `${escape(latest.by)} read this end to end and could NOT build from it`
      }</strong>
      <span>${escape(String(latest.at).slice(0, 10))}.${blocked}${
        latest.note ? ` ${escape(latest.note)}` : ""
      }</span>
    </div>`;
}

/**
 * Open questions that are the same hole, grouped — declared on any one, shown on all.
 *
 * ⛔ Symmetric like `contradicts`, and for the same reason: a grouping visible from only
 * the member that declared it leaves the other two looking independent, which is the
 * state that produces three inconsistent answers to one question.
 */
export function buildSameAsIndex(containers: FeatureDocument[]): Map<string, Set<string>> {
  // Union-find over the declarations, so a chain A→B, B→C surfaces as one group of three
  // rather than two pairs.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const c of containers) {
    for (const b of c.frontmatter.behaviors) {
      const self = `${c.frontmatter.id}#${b.id}`;
      for (const ref of b.same_as ?? []) {
        union(self, ref.includes("#") ? ref : `${c.frontmatter.id}#${ref}`);
      }
    }
  }
  const groups = new Map<string, Set<string>>();
  for (const key of parent.keys()) {
    const root = find(key);
    const set = groups.get(root) ?? new Set<string>();
    set.add(key);
    groups.set(root, set);
  }
  const byMember = new Map<string, Set<string>>();
  for (const set of groups.values()) {
    if (set.size < 2) continue;
    for (const m of set) byMember.set(m, set);
  }
  return byMember;
}

function sameAsBlock(self: string, group: Set<string> | undefined): string {
  if (!group || group.size < 2) return "";
  const others = [...group].filter((x) => x !== self).sort();
  return `<div class="same-as">
      <div class="sa-head">The same question as ${others.length === 1 ? "one other" : `${others.length} others`}</div>
      <ul>${others
        .map(
          (x) =>
            `<li><a href="/${escape(x.split("#")[0]!)}#behavior-${escape(
              x.split("#")[1]!
            )}"><code>${escape(x)}</code></a></li>`
        )
        .join("")}</ul>
      <div class="sa-warn">One decision closes all of ${
        group.size
      }. Answered separately they become ${group.size} inconsistent answers, which is worse than ${
        group.size
      } open questions.</div>
    </div>`;
}

/**
 * The corpus's own proportions, on the page a reader lands on.
 *
 * ⛔ THE AGGREGATE IS INVISIBLE FROM INSIDE ANY ONE PAGE, which is how a corpus gets
 * reviewed page by page and approved while being obviously wrong as a whole. Peter, on a
 * corpus three fresh readers had worked through without raising it: "no UX. how can the
 * product PM agents decide this is ok w/o any UX?" — and separately, that two features
 * were carrying an area's worth each, and that the machinery layer was a quarter of the
 * corpus in a product whose whole story is the machinery.
 *
 * Every one of those is a count, and nobody was counting. So the counts are the first
 * thing on the overview, stated flatly, with the ones worth arguing about called out.
 */
function shapeSummary(
  products: ProductDocument[],
  systems: CapabilitySystemDocument[]
): string {
  const feats = products.flatMap((p) => p.areas.flatMap((a) => a.features));
  if (feats.length === 0) return "";
  const caps = systems.flatMap((s) => s.capabilities);
  const fb = feats.reduce((n, f) => n + f.frontmatter.behaviors.length, 0);
  const cb = caps.reduce((n, c) => n + c.frontmatter.behaviors.length, 0);
  const surfaces = feats.flatMap((f) => f.frontmatter.ux ?? []);
  const unwalked = surfaces.filter(
    (u) => u.stub || ((u.sketch ?? "").trim() === "" && (u.elements ?? []).length === 0)
  ).length;
  const machineryShare = fb + cb > 0 ? Math.round((cb / (fb + cb)) * 100) : 0;

  const row = (label: string, value: string, note = "") =>
    `<div class="shape-row"><span class="shape-label">${escape(label)}</span><span class="shape-val">${value}</span>${
      note ? `<span class="shape-note">${note}</span>` : ""
    }</div>`;

  return `<details class="shape">
      <summary><span class="shape-head">The shape of this corpus</span><span class="shape-sum">${
        feats.length
      } features · ${caps.length} capabilities · ${fb + cb} claims</span></summary>
      <p class="oq-intro">Counts, because no single page can show you these — and every question worth asking about a corpus as a whole is one of them.</p>
      ${row(
        "Screens versus machinery",
        `${fb} claims about screens · ${cb} about what runs underneath`,
        machineryShare < 30
          ? `<strong>${machineryShare}%</strong> is machinery. Screens are easy to find and subsystems are not, so a corpus drifts this way unless somebody goes looking.`
          : `${machineryShare}% is machinery.`
      )}
      ${row(
        "Screens declared",
        `${surfaces.length} across ${feats.length} feature${feats.length === 1 ? "" : "s"}`,
        unwalked > 0
          ? `<strong>${unwalked}</strong> not walked — declared, with nothing drawn and no named parts.`
          : ""
      )}
      ${row(
        "Weight by area",
        products
          .flatMap((p) => p.areas)
          .map(
            (a) =>
              `${escape(a.title)} ${a.features.reduce(
                (n, f) => n + f.frontmatter.behaviors.length,
                0
              )}`
          )
          .join(" · "),
        "An area holding most of the product is not an area."
      )}
      ${row(
        "Features declaring nothing beneath them",
        `${feats.filter((f) => (f.frontmatter.depends_on ?? []).length === 0).length} of ${feats.length}`,
        "Either genuinely self-contained, or never traced. A reader cannot tell which."
      )}
    </details>`;
}

/**
 * Whether there is enough here to build, and what is stopping it.
 *
 * ⛔ THE BLOCKERS WERE COMPUTED AND NEVER SHOWN. Readiness reached a reader as a
 * three-word badge in the nav — "2 undecided", "ready" — and the reasons, which are the
 * only actionable part, existed only in memory. A gate whose reasons you cannot read is
 * a score with extra steps, which is the exact thing readiness was designed not to be.
 *
 * Split into two groups on purpose, because they go to different people: what is
 * unsettled **on this page** is the author's, and what is unsettled **underneath it** is
 * whoever owns the machinery. A reader who fixes all of the first and still cannot build
 * needs the second in the same list.
 */
function readinessBlock(r: FeatureReadiness | undefined): string {
  if (!r) return "";
  const SYSTEM = new Set([
    "dependency-missing",
    "dependency-not-ready",
    "dependency-unconfirmed",
    "dependency-has-no-failure-story",
  ]);
  if (r.ready) {
    return `<div class="readiness ok"><strong>Ready to build.</strong><span>Every claim here is decided and accepted, acceptance criteria exist, and the machinery underneath is specified.</span></div>`;
  }
  const own = r.blockers.filter((b) => !SYSTEM.has(b.kind));
  const sys = r.blockers.filter((b) => SYSTEM.has(b.kind));
  const list = (items: typeof r.blockers) =>
    `<ul>${items
      .map(
        (b) =>
          `<li>${
            b.behavior_id
              ? `<a href="#behavior-${escape(b.behavior_id)}"><code>${escape(b.behavior_id)}</code></a> — `
              : ""
          }${escape(b.detail)}</li>`
      )
      .join("")}</ul>`;
  return `<details class="readiness blocked">
      <summary><span class="rd-head">Not ready to build</span><span class="rd-sum">${
        r.blockers.length
      } reason${r.blockers.length === 1 ? "" : "s"}${
        sys.length ? ` · ${sys.length} underneath this` : ""
      }</span></summary>
      ${own.length ? `<div class="rd-group"><div class="rd-label">Unsettled on this page</div>${list(own)}</div>` : ""}
      ${
        sys.length
          ? `<div class="rd-group"><div class="rd-label">Unsettled in the system underneath</div><p class="rd-why">Not this page's author's to fix. A page can have every one of its own sentences settled and still be unbuildable, because the things it calls are not.</p>${list(
              sys
            )}</div>`
          : ""
      }
    </details>`;
}

/**
 * A citation, as a link a reader can follow.
 *
 * ⛔ It rendered as bare text, and the tool's own audit says why that is wrong — a
 * reader quoted it back: *"a third write-up note says 'an authority a reader cannot reach
 * is not evidence, it is a reference to somebody's memory.' It detects it and still
 * renders the dead citation with no path to the live text."*
 *
 * The href has to be built, not copied: a citation reads `principles#x` or
 * `cre/principles#x`, and neither is a URL. Both live on `/_context`, whose anchors are
 * the section slug.
 */
function citeLink(ref: string): string {
  const [doc, anchor] = ref.split("#");
  if (!doc || !anchor) return `<code>${escape(ref)}</code>`;
  const scoped = doc.includes("/");
  const href = `/_context#${escape(anchor)}`;
  return `<a class="cite" href="${href}" title="${
    scoped ? `Scoped to ${escape(doc.split("/")[0]!)} — not product-wide` : "True across the whole product"
  }"><code>${escape(ref)}</code></a>`;
}

/** Everything a behavior rests on, as links. */
function citesBlock(b: Behavior): string {
  const refs = b.cites ?? [];
  if (refs.length === 0) return "";
  return `<div class="cites-row"><span class="cites-label">Rests on</span>${refs
    .map(citeLink)
    .join(" ")}</div>`;
}

/**
 * `/_queue` — the questions waiting on a person, ranked, each stated as a question.
 *
 * ⛔ The same list `productos next` prints, on the surface a product manager actually
 * opens. Every other page here answers "what is true of this thing"; this one answers
 * "what is waiting on me", which is the only question a reviewer arrives with — and until
 * now they had to reconstruct it by opening twenty-six pages and expanding a panel on each.
 *
 * Ordered, not filtered: working top-down is the correct order, because accepting a claim
 * that is contradicted or ambiguous stamps intent onto a sentence with two meanings.
 */
export function renderQueue(groups: Array<{ title: string; why: string; items: Decision[] }>): string {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) {
    return `
      ${renderCrumb([{ label: "Overview", href: "/" }, { label: "Waiting on you" }])}
      <header class="feature"><h1>Waiting on you</h1></header>
      <div class="readiness ok"><strong>Nothing is waiting on a person.</strong><span>Every claim is accepted and nothing is undecided.</span></div>`;
  }
  const tag = (k: Decision["kind"]) =>
    k === "contradiction"
      ? `<span class="q-tag conflict">conflict</span>`
      : k === "ambiguity"
        ? `<span class="q-tag two">two readings</span>`
        : k === "could-not-build"
          ? `<span class="q-tag conflict">could not build</span>`
          : k === "undecided"
            ? `<span class="q-tag undecided">undecided</span>`
            : k === "unaccepted-rule"
              ? `<span class="q-tag agree">rule</span>`
              : `<span class="q-tag agree">claim</span>`;

  const item = (d: Decision) => {
    return `<li class="q-item q-${escape(d.kind)}">
        <div class="q-head">${tag(d.kind)}<a class="q-where" href="${escape(d.href)}">${escape(
          d.behavior ? `${d.container} · ${d.behavior}` : d.container
        )}</a>${d.owedBy ? `<span class="q-owed">${escape(d.owedBy)} owes the answer</span>` : ""}</div>
        <div class="q-question">${escape(d.question)}</div>
        ${d.context.map((c) => `<div class="q-ctx">${escape(c)}</div>`).join("")}
        ${d.stakes ? `<div class="q-stakes">Cost of getting it wrong: ${escape(d.stakes)}</div>` : ""}
        <div class="q-action">${escape(d.action)}</div>
      </li>`;
  };

  return `
    ${renderCrumb([{ label: "Overview", href: "/" }, { label: "Waiting on you" }])}
    <header class="feature">
      <h1>Waiting on you</h1>
      <div class="meta"><span class="pill">${total} decision${total === 1 ? "" : "s"}</span></div>
    </header>
    <p class="oq-intro">In the order worth doing them. Each one is a question, with what you need to answer it — you should not have to go looking for these.</p>
    ${groups
      .map(
        (g) => `<section class="q-group">
          <h2>${escape(g.title)}<span class="q-count">${g.items.length}</span></h2>
          <p class="oq-intro">${escape(g.why)}</p>
          <ul>${g.items.slice(0, 40).map(item).join("")}</ul>
          ${
            g.items.length > 40
              ? `<p class="oq-intro">${g.items.length - 40} more of these. Work the ones above first — they are ordered by how much answering them unblocks.</p>`
              : ""
          }
        </section>`
      )
      .join("")}
  `;
}

/**
 * `/_states` — the key.
 *
 * ⛔ Six or seven words carry real meaning on every page, and they were explained in
 * `title` attributes or nowhere. A tooltip is invisible on touch, invisible when the
 * page is skimmed, invisible when pasted into a doc, and — as one reviewer found —
 * only reachable by curling the HTML. Every state word on the site now links here.
 */
export function renderStates(products: ProductDocument[] = []): string {
  const group = (heading: string, intro: string, words: string[]) => `
    <h2>${escape(heading)}</h2>
    <p class="oq-intro">${escape(intro)}</p>
    <dl class="states">
      ${words
        .map(
          (w) => `<dt id="${escape(w.replace(/ /g, "-"))}">${escape(w)}</dt><dd>${escape(
            STATE_HELP[w] ?? ""
          )}</dd>`
        )
        .join("")}
    </dl>`;

  return `
    ${renderCrumb([{ label: "Overview", href: "/" }, { label: "Status words" }])}
    <header class="feature">
      <h1>Status words used on this site</h1>
      <div class="meta"><span class="pill">reference</span></div>
    </header>
    ${
      products.length
        ? `<div class="wrong-page">Looking for what a word in <em>this product</em> means — a term from the domain rather than a status? That is the product's own glossary: ${products
            .map((p) => `<a href="/${escape(p.slug)}/">${escape(p.title)}</a>`)
            .join(", ")}. This page only explains the labels the site puts on things.</div>`
        : ""
    }
    <article class="prose">
      <p>Two questions get confused constantly, so they are answered separately
      everywhere on this site:</p>
      <ul>
        <li><strong>Is it decided?</strong> — has anybody settled what the product does here.</li>
        <li><strong>Has a human accepted it?</strong> — agents write; only people accept.
        Nothing an agent writes is accepted by being written.</li>
      </ul>
      <p>A claim can be perfectly clear and still unaccepted. That is the normal state of
      a new corpus, and it is not a criticism of the claim.</p>
    </article>
    ${group(
      "Is it decided?",
      "About the claim itself.",
      [
        "undecided",
        "ambiguous",
        "contradiction",
        "contested",
        "accepted",
        "awaiting review",
        "edited since accepted",
      ]
    )}
    ${group(
      "Is there evidence?",
      "About whether anything has demonstrated the claim.",
      ["verified", "orphan", "uncertain"]
    )}
    ${group(
      "Is it buildable?",
      "Rolled up per feature, shown in the sidebar.",
      ["ready", "no criteria", "empty"]
    )}
    ${group("Does the code exist?", "Independent of every question above.", [
      "planned",
      "built",
      "retired",
    ])}
    ${group("What kind of thing is it?", "The two containers.", ["feature", "capability"])}
    ${group(
      "Does a decision still govern?",
      "A decision is not falsifiable, so it carries no validation state — it carries currency.",
      ["active", "under-review", "due for review", "superseded", "reaffirmed"]
    )}
    ${group(
      "Has a person actually read it?",
      "Not computed from anything. A person reporting whether the page did its job.",
      ["read end to end", "suspected"]
    )}
    ${group(
      "Where did the claim come from?",
      "Shown beside a claim so a reviewer knows whether to read closely or skim.",
      ["stated", "observed", "guessed"]
    )}
  `;
}

/**
 * The banner a corpus owes its reader when nothing in it has been accepted.
 *
 * ⛔ This is the single highest-leverage thing on the page, and it used to be a `title`
 * attribute. A reader spent half a review "treating the whole site as an approved
 * specification" and only learned otherwise by reading the HTML source: "I would have
 * written a brief that cites four design principles and two non-goals as binding
 * constraints when not one of them has been accepted by a person."
 *
 * Shown only while it is true, and it shrinks as acceptance grows — a banner that never
 * goes away is one people stop seeing.
 */
export function renderAcceptanceBanner(accepted: number, total: number): string {
  if (total === 0) return "";
  if (accepted === total) return "";
  const none = accepted === 0;
  const headline = none
    ? "Nothing here has been accepted by a human yet."
    : `${total - accepted} of ${total} claims here have not been accepted by a human.`;
  const detail = none
    ? "Every claim and every rule on these pages was written by an agent and is awaiting review. Read it as a proposal, not as policy — a reader who cites it as a constraint is citing something nobody agreed to."
    : "Anything marked <em>awaiting review</em> was written by an agent and nobody has confirmed it yet.";
  return `<div class="accept-banner${none ? " none" : ""}">
      <strong>${escape(headline)}</strong>
      <span>${detail} <a href="/_states">What the words mean</a></span>
    </div>`;
}

/**
 * The trail back up. Every page gets one.
 *
 * ⛔ A container page previously offered only "Overview", so the whole middle of the
 * tree was unreachable from a leaf — a reader on a capability could not get to the
 * subsystem that owns it, and one on a feature could not get to its area. The nav is
 * not a substitute: it answers "what else exists", not "where am I".
 */
function renderCrumb(trail: Array<{ label: string; href?: string }>): string {
  const parts = trail.map((x) =>
    x.href ? `<a href="${escape(x.href)}">${escape(x.label)}</a>` : escape(x.label)
  );
  return `<div class="crumb">${parts.join(" · ")}</div>`;
}

function navLeaf(
  c: FeatureDocument,
  activeId: string | undefined,
  readiness: Map<string, FeatureReadiness>
): string {
  const active = activeId === c.frontmatter.id ? " active" : "";
  const r = readiness.get(c.frontmatter.id);
  const badge = r
    ? `<span class="feat-status s-${readinessHeadline(r).tone}">${escape(
        readinessHeadline(r).label
      )}</span>`
    : "";
  // The name truncates in a narrow sidebar, and truncates harder the deeper it sits,
  // so the full title is always available on hover.
  return `<a class="nav-leaf${active}" href="${escape(c.url_path)}" title="${escape(
    c.frontmatter.title
  )}"><span class="nav-leaf-name">${escape(c.frontmatter.title)}</span>${badge}</a>`;
}

/**
 * A collapsible group. `open` when the active page is inside it, so navigating never
 * hides where you are.
 *
 * `depth` is the real tree depth, not a style variant — the nav nests as deep as the
 * corpus does.
 */
function navGroup(
  label: string,
  href: string,
  children: string,
  opts: { open: boolean; depth: number; count?: number }
): string {
  const count = opts.count === undefined ? "" : `<span class="nav-count">${opts.count}</span>`;
  const d = Math.min(opts.depth, 4);
  return `<details class="nav-group nav-depth-${d}"${opts.open ? " open" : ""}>
      <summary class="nav-summary" title="${escape(label)}"><span class="nav-label">${escape(label)}</span>${count}</summary>
      <div class="nav-children">
        <a class="nav-overview" href="${escape(href)}">Overview</a>
        ${children}
      </div>
    </details>`;
}

/** One group and everything under it. Recursive, because the tree is. */
function navTree(
  groups: GroupDocument[],
  activeId: string | undefined,
  readiness: Map<string, FeatureReadiness>
): string {
  return groups
    .map((g) => {
      const total = groupFeatures(g).length;
      if (total === 0) return "";
      const inside = !!activeId && activeId.startsWith(g.id + "/");
      const children =
        navTree(g.groups, activeId, readiness) +
        g.features.map((f) => navLeaf(f, activeId, readiness)).join("");
      return navGroup(g.title, `/${g.id}/`, children, {
        open: inside,
        depth: g.depth,
        count: total,
      });
    })
    .join("");
}

export function renderSidebar(
  areas: AreaDocument[],
  contextDocs: ContextDocument[],
  activeId?: string,
  openCount = 0,
  readiness: Map<string, FeatureReadiness> = new Map(),
  capabilities: FeatureDocument[] = [],
  capabilitySystems: CapabilitySystemDocument[] = [],
  products: ProductDocument[] = []
): string {
  const parts: string[] = [
    `<div class="sidebar-top">
      <a href="/" class="brand ${activeId === "_root" ? "active" : ""}">📖 Overview</a>
      <button class="refresh" data-action="refresh" title="Reload — picks up changes made elsewhere">↻</button>
    </div>`,
    `<a href="/_queue" class="${activeId === "_queue" ? "active" : ""}">✋ Waiting on you</a>`,
    `<a href="/_feedback" class="${activeId === "_feedback" ? "active" : ""}">💬 Feedback queue${openCount ? ` <span style="color:var(--yellow);font-family:var(--mono);font-size:11px;">(${openCount})</span>` : ""}</a>`,
  ];
  if (contextDocs.length) {
    const active = activeId === "_context" ? " active" : "";
    parts.push(`<a class="${active}" href="/_context">🧭 Strategy</a>`);
  }
  // ⛔ In the nav, not only linked from the chips. A reader who does not yet know that
  // "awaiting review" and "undecided" are different things does not know to look for a
  // key, so the key has to be somewhere they will pass anyway.
  parts.push(
    // ⛔ "What the words mean" was read as the DOMAIN glossary: "I assumed it was the
    // domain glossary. It is not... I spent my first fifteen minutes not knowing what
    // DSCR meant and looking for it in the wrong place." The label now says whose words.
    `<a class="${activeId === "_states" ? "active" : ""}" href="/_states">🔑 Status words</a>`
  );

  // Products lead: they are what the product is. Capabilities are what it is built on.
  if (products.length) {
    parts.push(`<h2>Products</h2>`);
    for (const product of products) {
      const inProduct = !!activeId && activeId.startsWith(product.slug + "/");
      const children =
        navTree(product.groups, activeId, readiness) +
        product.features.map((f) => navLeaf(f, activeId, readiness)).join("");
      parts.push(
        navGroup(product.title, `/${product.slug}/`, children, {
          open: inProduct || products.length === 1,
          depth: 1,
        })
      );
    }
  }

  if (capabilitySystems.length) {
    parts.push(`<h2>Capabilities</h2>`);
    for (const sys of capabilitySystems) {
      if (sys.capabilities.length === 0) continue;
      const inSystem = !!activeId && activeId.startsWith(`capabilities/${sys.slug}/`);
      parts.push(
        navGroup(
          sys.title,
          `/capabilities/${sys.slug}/`,
          sys.capabilities.map((c) => navLeaf(c, activeId, readiness)).join(""),
          { open: inSystem, depth: 1, count: sys.capabilities.length }
        )
      );
    }
  }
  return parts.join("\n");
}

export function renderContextDoc(
  doc: ContextDocument,
  all: ContextDocument[],
  areas: AreaDocument[] = [],
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const isDecisions = doc.name === "decisions";
  const sections = parseSections(doc.body);

  // Who rests on each section — derived from `cites`, never authored twice.
  // This is the traversal that makes an unaccepted rule visible: a principle
  // nobody has agreed to, that twelve behaviors already defer to.
  const citedBy = new Map<string, { featureId: string; behaviorId: string }[]>();
  for (const a of areas) {
    for (const f of a.features) {
      for (const b of f.frontmatter.behaviors) {
        for (const ref of b.cites ?? []) {
          const [d, anchor] = ref.split("#");
          if (d !== doc.name || !anchor) continue;
          const arr = citedBy.get(anchor) ?? [];
          arr.push({ featureId: f.frontmatter.id, behaviorId: b.id });
          citedBy.set(anchor, arr);
        }
      }
    }
  }

  // Anchor every h2 heading by slug so other docs can cite e.g. `principles#numbers-feel-rewarding`.
  // marked emits <h2>X</h2>; we post-process to inject ids, and attach each
  // section's state + dependents directly under its heading.
  const html = String(marked.parse(doc.body)).replace(
    /<h2>([\s\S]*?)<\/h2>/g,
    (_match, inner: string) => {
      const slug = slugify(stripTags(inner));
      const section = sections.find((s) => s.anchor === slug);
      const meta = doc.sections[slug];
      let badge = "";
      if (section) {
        if (isDecisions) {
          const ruling = decisionRuling(meta, today);
          const label =
            ruling === "due-for-review"
              ? "due for review"
              : ruling === "superseded" && meta?.superseded_by
                ? `superseded by ${meta.superseded_by}`
                : ruling;
          badge = `<span class="ctx-state s-${ruling}" title="Whether this decision still governs. A decision is not falsifiable, so it carries no validation state — only currency.">${escape(
            label
          )}</span>`;
        } else {
          const state = contextSectionState(section, meta);
          const title =
            state === "validated"
              ? `Accepted${meta?.verified_by ? " by " + meta.verified_by : ""}${meta?.verified_at ? " on " + meta.verified_at.slice(0, 10) : ""}`
              : state === "stale"
                ? "The wording changed after this was accepted — the stamp no longer covers what it says"
                : "No human has accepted this. Agents can write context, and context governs every behavior beneath it.";
          const word =
            state === "validated"
              ? STATE_WORDS.accepted
              : state === "stale"
                ? STATE_WORDS.editedSinceAccepted
                : STATE_WORDS.awaitingReview;
          badge = stateChip(word, `ctx-state s-${state}`, state === "validated" ? "✓ " : state === "stale" ? "⚠ " : "");
        }
      }
      const deps = citedBy.get(slug) ?? [];
      const depsLine = deps.length
        ? `<div class="ctx-cited">Rested on by ${deps
            .map(
              (d) =>
                `<a href="/${escape(d.featureId)}#behavior-${escape(d.behaviorId)}"><code>${escape(
                  d.behaviorId
                )}</code></a>`
            )
            .join(", ")}</div>`
        : "";
      return `<h2 id="${slug}"><a href="#${slug}" class="anchor">#</a> ${inner}${badge}</h2>${depsLine}`;
    }
  );
  return `
    <div class="crumb"><a href="/">Overview</a> · Strategy</div>
    <header class="feature">
      <h1>${escape(doc.title)}</h1>
      <div class="meta"><span class="pill">${doc.name}</span></div>
    </header>
    <article class="prose context">${html}</article>
  `;
}

/**
 * The state of one context section, as a badge on its heading.
 *
 * ⛔ Two different axes, deliberately not unified. Most context is a claim
 * about what we mean or intend, so it needs ACCEPTANCE. A decision is not
 * falsifiable — it is a record of a choice — so it needs CURRENCY: does it
 * still govern? Asking a human to "verify" a decision is the wrong question.
 */
function sectionStateBadge(
  doc: ContextDocument,
  section: { anchor: string; text: string },
  isDecisions: boolean,
  today: string
): string {
  const meta = doc.sections[section.anchor];
  if (isDecisions) {
    const ruling = decisionRuling(meta, today);
    const label =
      ruling === "due-for-review"
        ? "due for review"
        : ruling === "superseded" && meta?.superseded_by
          ? `superseded by ${meta.superseded_by}`
          : ruling;
    return `<span class="ctx-state s-${ruling}" title="Whether this decision still governs. A decision carries no validation state — it is a record of a choice, not a falsifiable claim.">${escape(
      label
    )}</span>`;
  }
  const state = contextSectionState(section as never, meta);
  const tip =
    state === "validated"
      ? `Accepted${meta?.verified_by ? " by " + meta.verified_by : ""}${meta?.verified_at ? " on " + meta.verified_at.slice(0, 10) : ""}`
      : state === "stale"
        ? "The wording changed after this was accepted — the stamp no longer covers what it says"
        : "No human has accepted this. Agents can write context, and context governs every behavior beneath it.";
  const word =
    state === "validated"
      ? STATE_WORDS.accepted
      : state === "stale"
        ? STATE_WORDS.editedSinceAccepted
        : STATE_WORDS.awaitingReview;
  void tip;
  return stateChip(word, `ctx-state s-${state}`, state === "validated" ? "✓ " : state === "stale" ? "⚠ " : "");
}

/** Behaviors that cite this section — derived from `cites`, never authored twice. */
function restedOnBy(areas: AreaDocument[], docName: string, anchor: string): string {
  const hits = areas
    .flatMap((a) => a.features)
    .flatMap((f) =>
      f.frontmatter.behaviors
        .filter((b) => (b.cites ?? []).includes(`${docName}#${anchor}`))
        .map((b) => ({ featureId: f.frontmatter.id, behaviorId: b.id }))
    );
  if (hits.length === 0) return "";
  return `<div class="ctx-cited">Rested on by ${hits
    .map(
      (h) =>
        `<a href="/${escape(h.featureId)}#behavior-${escape(h.behaviorId)}"><code>${escape(
          h.behaviorId
        )}</code></a>`
    )
    .join(", ")}</div>`;
}

export function renderContextIndex(
  docs: ContextDocument[],
  areas: AreaDocument[] = [],
  today: string = new Date().toISOString().slice(0, 10)
): string {
  if (docs.length === 0) {
    return `
      <header class="feature"><h1>Strategy</h1></header>
      <div class="empty-state">No strategy documents yet. Run <code>productos init claude</code> — it scaffolds empty <code>productos/context/*.md</code> files for goals, principles, personas, etc.</div>
    `;
  }

  // Combine all context docs into ONE page with section anchors per doc.
  // Each doc becomes an h2 (doc.name as anchor); each doc's own h2 headings
  // become h3 inside it so the hierarchy is consistent and items remain
  // citeable as e.g. `principles#numbers-feel-rewarding`.
  const tocLines = docs.map(
    (d) => `<a href="#${escape(d.name)}" style="display:inline-block;margin-right:14px;font-size:13px;color:var(--accent);text-decoration:none;">${escape(d.title)}</a>`
  );
  const sections = docs.map((d) => {
    // Render the doc's body, but bump every h2 → h3 (since the doc title is now an h2)
    // and add anchor ids derived from the heading text, prefixed with the doc name
    // so cross-doc refs like `principles#numbers-feel-rewarding` work.
    const parsed = parseSections(d.body);
    const isDecisions = d.name === "decisions";
    const bodyHtml = String(marked.parse(d.body))
      .replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
        const slug = slugify(stripTags(inner));
        const section = parsed.find((s) => s.anchor === slug);
        const badge = section ? sectionStateBadge(d, section, isDecisions, today) : "";
        const rested = restedOnBy(areas, d.name, slug);
        return `<h3 id="${escape(d.name)}-${slug}"><a href="#${escape(d.name)}-${slug}" class="anchor">#</a> ${inner}${badge}</h3>${rested}`;
      });
    return `
      <section>
        <h2 id="${escape(d.name)}"><a href="#${escape(d.name)}" class="anchor">#</a> ${escape(d.title)}</h2>
        ${bodyHtml}
      </section>`;
  });

  return `
    <header class="feature">
      <h1>Strategy</h1>
      <div class="meta"><span class="pill">${docs.length} document${docs.length === 1 ? "" : "s"}</span></div>
    </header>
    <article class="prose"><p>The overarching layer above features — goals, design principles, personas, non-goals, voice. Read these before proposing or vetting any feature; they constrain every decision below.</p></article>
    <nav class="strategy-toc" style="margin:18px 0 28px;padding:10px 14px;background:var(--surface-2);border-radius:8px;">${tocLines.join("")}</nav>
    <article class="prose context">${sections.join("\n")}</article>
  `;
}

/**
 * Render an ASCII surface sketch with:
 *   - Visual highlighting for [ Button ], <Link>, [_input_], etc.
 *   - Clickable navigation for any element with `leads_to` set, where the
 *     ENTIRE bracket pattern (not just the inner text) is the click target.
 */
function decorateSketch(sketch: string, elements: Element[], featureId: string, surfaceIdsInFeature: Set<string>, surfaceIndex: SurfaceIndex): string {
  const cleaned = sketch.replace(/^\n+|\n+$/g, "");
  // Normalize row markers — the AI uses different glyphs (•, ▢, ▦, ▶, ◇, *)
  // depending on its mood. Convert all of them to → before rendering so the
  // PM always sees a consistent right-arrow row icon regardless of what got
  // written into the markdown.
  const normalized = cleaned.replace(/^(\s*│?\s*)([•▢▦▶◇▷□*])(\s+)/gm, "$1→$3");
  const escaped = escape(normalized);

  // Build a label → leads_to map for O(1) lookups when matching patterns.
  // Keyed by lowercased label so "Edit" matches "<Edit>" or "[ Edit ]".
  type LinkInfo = { target: string; leadsTo: string };
  const linkByLabel = new Map<string, LinkInfo>();
  for (const el of elements) {
    if (!el.leads_to || !el.label) continue;
    const target = resolveLeadsToSmart(el.leads_to, featureId, surfaceIdsInFeature, surfaceIndex);
    if (target) linkByLabel.set(el.label.toLowerCase(), { target, leadsTo: el.leads_to });
  }

  const lookupLink = (innerText: string): LinkInfo | null => {
    const t = innerText.toLowerCase().trim();
    if (linkByLabel.has(t)) return linkByLabel.get(t)!;
    // Fallback: contains/contained-by match for buttons like "+ Add a kid"
    // where the sketch text "+ Add a kid" contains the label "Add a kid".
    for (const [label, info] of linkByLabel) {
      if (t.includes(label) || label.includes(t)) return info;
    }
    return null;
  };

  // Pattern decoration. The ENTIRE bracket pattern becomes the click target
  // when it matches an element with leads_to — so the brackets themselves
  // light up on hover, not just the inner text. This makes the sketch read
  // like a real interface: you click the button, not the label.
  let html = escaped;

  html = html.replace(
    /\[(\s*[^\[\]\n][^\[\]\n]*?\s*)\]/g,
    (match, inner: string) => {
      const trimmed = inner.trim();
      let cls = "sketch-button";
      if (/^_+$/.test(trimmed)) cls = "sketch-input";
      else if (/^[\s✓✗xX]$/.test(trimmed)) cls = "sketch-checkbox";
      else if (/▼$/.test(trimmed)) cls = "sketch-dropdown";

      const link = lookupLink(trimmed);
      const styled = `<span class="${cls}">${match}</span>`;
      return link
        ? `<a class="sketch-anchor" href="${escape(link.target)}" title="goes to ${escape(link.leadsTo)}">${styled}</a>`
        : styled;
    }
  );

  html = html.replace(
    /&lt;([^&\n]{1,40}?)&gt;/g,
    (_match, inner: string) => {
      const link = lookupLink(inner);
      const styled = `<span class="sketch-textlink">&lt;${inner}&gt;</span>`;
      return link
        ? `<a class="sketch-anchor" href="${escape(link.target)}" title="goes to ${escape(link.leadsTo)}">${styled}</a>`
        : styled;
    }
  );

  // Card / list-item rows. The convention is a leading ▢ or ▦ symbol followed
  // by space + content. When a card-kind element on this surface has `leads_to`,
  // wrap the card row (from the symbol up to whitespace gap, end of line, or
  // start of another inline element like a link) in a clickable anchor —
  // clicking the kid card row navigates to the kid-detail surface or whatever
  // `leads_to` points at.
  // Loose match — the AI uses many kind names: kid-card, list-item, row,
  // result-row, transaction-card, etc. Any kind containing one of these
  // substrings (case-insensitive) qualifies if leads_to is set.
  const cardEl = elements.find((e) => {
    if (!e.leads_to) return false;
    const k = (e.kind ?? "").toLowerCase();
    return k.includes("card") || k.includes("row") || k.includes("item") || k.includes("list");
  });
  if (cardEl && cardEl.leads_to) {
    const target = resolveLeadsToSmart(cardEl.leads_to, featureId, surfaceIdsInFeature, surfaceIndex);
    if (target) {
      // Recognize three glyphs as card/row markers: → (preferred), ▢, ▦.
      // Match: glyph + whitespace + content, stopping at an existing anchor
      // (so we don't nest), two-or-more spaces (column gap), or EOL.
      html = html.replace(
        /(→|▢|▦)(\s+)([^\n│]*?)(?=<a\s|\s{2,}|│|$)/g,
        (_m, icon: string, ws: string, content: string) =>
          `<a class="sketch-anchor sketch-card-row" href="${escape(target)}" title="goes to ${escape(cardEl.leads_to!)}"><span class="sketch-card-glyph">${icon}</span>${ws}<span class="sketch-card-text">${content}</span></a>`
      );
    }
  }

  // Color the card glyph (→ / ▢ / ▦) even when the row isn't a link.
  html = html.replace(
    /(?<!<[^>]*)(→|▢|▦)/g,
    '<span class="sketch-card-glyph">$1</span>'
  );

  return html;
}

/**
 * Auto-wire anchors in an HTML mock (sketch_html).
 *
 * Walks every <a> in the mock. If the anchor's text content matches an
 * element's `label` (case-insensitive, with the same fuzzy contained-by
 * matching the ASCII path uses), set the href from that element's
 * leads_to via resolveLeadsToSmart. Existing hrefs get OVERWRITTEN — so
 * the AI generating sketch_html doesn't need to know about the
 * `#surface-X` convention; it can leave hrefs blank or with a
 * placeholder and the renderer fills them in from the schema.
 *
 * Conservative: only acts on existing <a> tags. If the AI didn't wrap a
 * clickable element in an anchor, this doesn't try to inject one — too
 * risky to mutate arbitrary nested HTML. The skill prompt nudges the AI
 * toward anchors for clickable things.
 */
function decorateHtmlMock(
  html: string,
  elements: Element[],
  featureId: string,
  surfaceIdsInFeature: Set<string>,
  surfaceIndex: SurfaceIndex
): string {
  // Build element-id → resolved-target map for elements with leads_to.
  type LinkInfo = { label: string; labelWords: Set<string>; target: string; elementId: string };
  const candidates: LinkInfo[] = [];
  const byElementId = new Map<string, LinkInfo>();
  for (const el of elements) {
    if (!el.leads_to) continue;
    const target = resolveLeadsToSmart(
      el.leads_to,
      featureId,
      surfaceIdsInFeature,
      surfaceIndex
    );
    if (!target) continue;
    const labelLower = (el.label ?? "").toLowerCase().trim();
    const info: LinkInfo = {
      label: labelLower,
      labelWords: wordSet(labelLower),
      target,
      elementId: el.id,
    };
    candidates.push(info);
    byElementId.set(el.id, info);
  }
  if (candidates.length === 0) return html;

  return html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/g,
    (match, attrs: string, inner: string) => {
      // Explicit override: if the AI already tagged the anchor with
      // data-element="<id>", use that element's leads_to directly.
      const explicit = attrs.match(/\bdata-element\s*=\s*"([^"]+)"/);
      let pick: LinkInfo | undefined;
      if (explicit) {
        pick = byElementId.get(explicit[1]);
      } else {
        // Text-based match: lowercase the visible text + the labels, look for
        // word-set overlap (handles cases like label "Override field" vs
        // visible text "⤴ override" where one word-set is a subset of the
        // other). Falls back to substring matching for very short cases.
        const text = inner.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!text) return match;
        const textWords = wordSet(text);
        for (const c of candidates) {
          if (!c.label) continue;
          if (text === c.label || text.includes(c.label) || c.label.includes(text)) {
            pick = c; break;
          }
          if (c.labelWords.size === 0 || textWords.size === 0) continue;
          const allLabelInText = Array.from(c.labelWords).every((w) => textWords.has(w));
          const allTextInLabel = Array.from(textWords).every((w) => c.labelWords.has(w));
          if (allLabelInText || allTextInLabel) { pick = c; break; }
        }
      }
      if (!pick) return match;
      const hasHref = /\bhref\s*=/.test(attrs);
      const newAttrs = hasHref
        ? attrs.replace(/\bhref\s*=\s*"[^"]*"/, `href="${escape(pick.target)}"`)
        : `${attrs} href="${escape(pick.target)}"`;
      const finalAttrs = /\bdata-element\s*=/.test(newAttrs)
        ? newAttrs
        : newAttrs + ` data-element="${escape(pick.elementId)}"`;
      return `<a${finalAttrs}>${inner}</a>`;
    }
  );
}

function wordSet(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
  );
}

/**
 * leads_to resolution. Always returns SOMETHING (never null for non-empty
 * valid input) so rows + elements always wrap as clickable. If the destination
 * doesn't actually exist yet, the click 404s and the PM discovers they need
 * to create the surface — that's better than silently not-clicking.
 *
 * Resolution priority (first match wins):
 *
 *   1. Empty / `https://...` → null (don't link external URLs).
 *   2. `feature#surface` (explicit) → `/<feature>#surface-<id>`.
 *   3. `area/feature` → `/<area>/<feature>` (cross-feature page).
 *   4. Bare `surface-id` that matches a Surface.id ON CURRENT FEATURE →
 *      `#surface-<id>` (same-page anchor jump).
 *   5. Bare `surface-id` that matches a Surface.id ELSEWHERE in the corpus →
 *      `/<owning-feature>#surface-<id>` (cross-feature surface link).
 *   6. Bare value that matches nothing → assume sibling feature in the
 *      current area: `/<currentArea>/<value>` (best-effort guess).
 *
 * Defensive normalization: strip leading `/`, trim whitespace, drop trailing slash.
 */
function resolveLeadsToSmart(
  leadsTo: string,
  featureId: string,
  surfaceIdsInFeature: Set<string>,
  surfaceIndex: SurfaceIndex
): string | null {
  let s = leadsTo.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return null;
  if (s.startsWith("/")) s = s.slice(1);
  s = s.replace(/\/+$/, "");
  if (!s) return null;

  // Cross-feature + surface anchor
  const hashIdx = s.indexOf("#");
  if (hashIdx > 0) {
    const beforeHash = s.slice(0, hashIdx);
    const sid = s.slice(hashIdx + 1);
    if (beforeHash.includes("/") && sid) return `/${beforeHash}#surface-${sid}`;
    if (!beforeHash && sid) return `#surface-${sid}`;
  }

  // Cross-feature page (has slash, no #)
  if (s.includes("/")) return `/${s}`;

  // Bare value resolution
  if (surfaceIdsInFeature.has(s)) return `#surface-${s}`;
  const owningFeature = surfaceIndex.get(s);
  if (owningFeature) return `/${owningFeature}#surface-${s}`;
  // Best-effort guess: a sibling feature in the same area.
  //
  // ⛔ The area is everything BUT the last segment, not the first one. With ids two
  // segments deep those were the same string; once areas nest, `cre/deals/deal-list`
  // made this emit `/cre/<target>` — the product, skipping the area — so every
  // speculative row in a nested corpus pointed at a 404.
  const segs = featureId.split("/");
  if (segs.length > 1) return `/${segs.slice(0, -1).join("/")}/${s}`;
  return `#surface-${s}`;
}

function resolveLeadsTo(leadsTo: string): string | null {
  // Normalize common malformed inputs the skill might write:
  //   "/add-kid"  → "add-kid"           (treat as a surface id on the same page)
  //   "https://example.com/cart"        → reject (external URL, never valid)
  //   trailing slashes / whitespace     → strip
  let s = leadsTo.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return null;
  // Strip ONE leading slash (a common AI mistake — they write a path-shape).
  if (s.startsWith("/")) s = s.slice(1);
  s = s.replace(/\/+$/, "");
  if (!s) return null;

  // "feature_id#surface-id" — cross-feature + surface anchor
  const hashIdx = s.indexOf("#");
  if (hashIdx > 0 && s.includes("/")) {
    const feat = s.slice(0, hashIdx);
    const sid = s.slice(hashIdx + 1);
    return `/${feat}#surface-${sid}`;
  }
  // "area/feature" — cross-feature page
  if (s.includes("/")) return `/${s}`;
  // "surface-id" — same-page anchor
  return `#surface-${s}`;
}

/**
 * ⛔ Delegates. This was a second copy of `sectionAnchor` and the two drifted —
 * one truncated at 80 characters and the other did not, so a long heading got
 * one id in the markup and a different one in every lookup against it.
 * An anchor is an identity; it cannot have two implementations.
 */
function slugify(s: string): string {
  return sectionAnchor(s);
}

/**
 * Heading text, as the author wrote it.
 *
 * ⛔ Entities MUST be decoded before this feeds an anchor. Marked renders an
 * apostrophe as `&#39;`, and the slug rule strips `&` and `;` while keeping
 * digits — so "the deal's" becomes `deal39s` from rendered HTML and `deals`
 * from the markdown source. The two anchors then never match, and the only
 * symptom is that a badge silently fails to render on exactly the headings
 * with apostrophes in them.
 */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * The overview — products and capability systems, not a flat list of areas.
 *
 * ⛔ This listed every area at once, which stopped being the top of anything as soon
 * as areas could nest: a reader landed on twenty entries with no indication which
 * product they belonged to or which contained which. The top of the tree is the
 * product; the areas inside it are the product page's job.
 */
export function renderHome(
  products: ProductDocument[],
  topReadme?: string,
  systems: CapabilitySystemDocument[] = [],
  readiness: Map<string, FeatureReadiness> = new Map(),
  trackingFor: (id: string) => FeatureTracking | null = () => null
): string {
  const acceptance = acceptanceCount(
    [...products.flatMap((p) => p.areas.flatMap((a) => a.features)), ...systems.flatMap((s) => s.capabilities)],
    trackingFor
  );
  const intro = topReadme
    ? `<article class="prose">${marked.parse(topReadme) as string}</article>`
    : `<article class="prose"><p>Browse the product truth below. Each product divides into feature areas, which nest as deep as that product needs; capability systems are the subsystems those features are built on.</p></article>`;

  const productCards = products
    .map((p) => {
      const feats = p.areas.reduce((n, a) => n + a.features.length, 0);
      const ready = p.areas
        .flatMap((a) => a.features)
        .filter((f) => readiness.get(f.frontmatter.id)?.ready).length;
      return `<a class="group-card" href="/${escape(p.slug)}/">
          <div class="group-card-title">${escape(p.title)}</div>
          <div class="group-card-meta">${p.groups.length} area${
            p.groups.length === 1 ? "" : "s"
          } · ${feats} feature${feats === 1 ? "" : "s"}${feats ? ` · ${ready} ready` : ""}</div>
          <div class="group-card-body">${summaryLine(p.body)}</div>
        </a>`;
    })
    .join("");

  const systemCards = systems
    .filter((s) => s.capabilities.length > 0)
    .map(
      (s) => `<a class="group-card" href="/capabilities/${escape(s.slug)}/">
          <div class="group-card-title">${escape(s.title)}</div>
          <div class="group-card-meta">${s.capabilities.length} capabilit${
            s.capabilities.length === 1 ? "y" : "ies"
          }</div>
          <div class="group-card-body">${summaryLine(s.body)}</div>
        </a>`
    )
    .join("");

  const totalFeatures = products.reduce(
    (n, p) => n + p.areas.reduce((m, a) => m + a.features.length, 0),
    0
  );

  return `
    ${renderAcceptanceBanner(acceptance.accepted, acceptance.total)}
    <header class="feature">
      <h1>Product Truth</h1>
      <div class="meta"><span class="pill">${products.length} product${
        products.length === 1 ? "" : "s"
      }</span><span class="pill">${totalFeatures} feature${
        totalFeatures === 1 ? "" : "s"
      }</span>${
        systems.length
          ? `<span class="pill">${systems.length} capability system${systems.length === 1 ? "" : "s"}</span>`
          : ""
      }</div>
    </header>
    ${intro}
    ${shapeSummary(products, systems)}
    <h2>Products</h2>
    <div class="group-cards">${productCards}</div>
    ${systemCards ? `<h2>Capability systems</h2><div class="group-cards">${systemCards}</div>` : ""}
    ${renderFeedbackSection(undefined, undefined, "Feedback")}
  `;
}

/**
 * One line of plain text from a markdown body, for a card summary.
 *
 * ⛔ Escaping the raw line is not enough: `**Commercial real estate lending**` then
 * renders with its asterisks showing, inside a card that has no markdown renderer.
 * The card wants prose, so the emphasis markers come off here.
 */
function summaryLine(body: string, max = 180): string {
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|"));
  if (!line) return "";
  const plain = line
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\w)[*_]([^*_]+)[*_](?!\w)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  if (plain.length <= max) return escape(plain);
  // Cut at a word boundary — slicing mid-word reads as a rendering bug rather than
  // as a summary.
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return escape((lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, "") + "…");
}

/**
 * Grouping advice, on the page it is about.
 *
 * ⛔ Advice, never a grade. Each entry names one edit and prints the exact
 * `productos move` that performs it, because "this area is too big" without the
 * command is a complaint, and a percentage would just invite improving the number.
 * A corpus mid-growth is legitimately lopsided, so nothing here blocks anything.
 */
function renderGroupingAdvice(advice: GroupingAdvice[]): string {
  if (advice.length === 0) return "";
  const items = advice
    .map((a) => {
      const clusters = (a.clusters ?? [])
        .filter((c) => c.members.length > 1)
        .map(
          (c) => `<div class="ga-cluster">
              <div class="ga-cluster-name">${
                c.slug
                  ? escape(c.slug)
                  : `<span class="ga-unnamed">needs a name</span>`
              }</div>
              <div class="ga-cluster-why">${escape(c.because)}</div>
              <ul>${c.members.map((m) => `<li><a href="/${escape(m)}">${escape(m)}</a></li>`).join("")}</ul>
            </div>`
        )
        .join("");
      const moves = (a.moves ?? []).length
        ? `<pre class="ga-moves">${(a.moves ?? []).map((m) => escape(m)).join("\n")}</pre>`
        : "";
      return `<div class="ga-item">
          <div class="ga-what">${escape(a.what)}</div>
          <div class="ga-rule">${escape(a.rule)}</div>
          ${clusters}
          ${moves}
        </div>`;
    })
    .join("");
  // ⛔ Collapsed, and last. This shipped expanded at the top of the area page, above
  // the product content, and the first fresh reader to see it called it out: "addressed
  // to whoever writes the site, not to me." It is housekeeping about the corpus, not
  // truth about the product, so it must never be the first thing a reader meets.
  return `<details class="grouping-advice">
      <summary><span class="ga-head">Shape of this area</span><span class="ga-count">${
        advice.length
      } suggestion${advice.length === 1 ? "" : "s"}</span></summary>
      <p class="oq-intro">Housekeeping for whoever maintains this corpus — not a statement about the product. Nothing here blocks a review.</p>
      ${items}
    </details>`;
}

/**
 * The product's own rules and vocabulary, with the text.
 *
 * ⛔ This rendered **headwords only** — nineteen terms in a list, every definition
 * dropped. Three independent readers hit it: a section announcing "this product's own
 * vocabulary" and then defining none of it is worse than absent, because it looks
 * answered. The definitions were in the file the whole time.
 *
 * Collapsed by default so nineteen terms do not bury the page, and the state badge
 * stays on the summary row where it was — the thing you scan for is still scannable.
 */
function contextSectionList(
  docs: ContextDocument[],
  today: string,
  heading: string,
  intro: string
): string {
  if (docs.length === 0) return "";
  const body = docs
    .map((d) => {
      const secs = parseSections(d.body);
      const items = secs
        .map((s) => {
          const badge = sectionStateBadge(d, s, d.name === "decisions", today);
          const text = s.text.trim();
          if (!text) {
            // An empty section is a finding, not a blank line: somebody listed a term
            // and never said what it means.
            return `<li class="ac-item"><span class="ac-term">${escape(
              s.title
            )}</span>${badge} <span class="ac-undefined">no definition written</span></li>`;
          }
          return `<li class="ac-item"><details class="ac-detail"><summary><span class="ac-term">${escape(
            s.title
          )}</span>${badge}</summary><div class="ac-body">${
            marked.parse(text) as string
          }</div></details></li>`;
        })
        .join("");
      return `<div class="ac-doc"><div class="ac-title">${escape(d.title)}</div><ul>${items}</ul></div>`;
    })
    .join("");
  return `<section class="area-context">
      <h2>${heading}</h2>
      <p class="oq-intro">${intro}</p>
      ${body}
    </section>`;
}

/**
 * Undefined behaviors anywhere beneath a grouping, rolled up onto its page.
 *
 * ⛔ Area pages had this and capability-system pages did not, and the asymmetry
 * actively misinformed: a reader who stopped at a subsystem page was told by the
 * absence that nothing beneath it was unsettled, and concluded a six-capability
 * subsystem was fully settled while one of its capabilities carried a live open
 * question. A roll-up that exists on one grouping and not its twin is worse than no
 * roll-up, because silence reads as an answer.
 */
function undefinedRollup(
  containers: FeatureDocument[],
  scopeLabel: string
): string {
  const items = containers.flatMap((f) =>
    f.frontmatter.behaviors
      .filter(isUndefinedBehavior)
      .map((b) => ({ b, featureId: f.frontmatter.id, featureTitle: f.frontmatter.title }))
  );
  if (items.length === 0) return "";
  return `<section class="open-questions has-blocking">
      <h2>${escape(
        `${items.length} undecided behavior${items.length === 1 ? "" : "s"}`
      )}</h2>
      <p class="oq-intro">No claim decided yet — anywhere in ${escape(
        scopeLabel
      )}. Nothing here can be built from; ask rather than assume.</p>
      <ul>${items
        .map(
          ({ b, featureId, featureTitle }) => `<li class="oq oq-blocking">
              <div class="oq-q">${escape(b.question ?? "")}</div>
              <div class="oq-feature"><a href="/${escape(featureId)}#behavior-${escape(
            b.id
          )}">${escape(featureTitle)}</a> · <code>${escape(b.id)}</code></div>
            </li>`
        )
        .join("")}</ul>
    </section>`;
}

/** Cards for child groups. Used by the product page and by every group page. */
function groupCards(groups: GroupDocument[], readiness: Map<string, FeatureReadiness>): string {
  return groups
    .map((g) => {
      const feats = groupFeatures(g);
      const ready = feats.filter((f) => readiness.get(f.frontmatter.id)?.ready).length;
      const sub = g.groups.length
        ? `${g.groups.length} group${g.groups.length === 1 ? "" : "s"} · `
        : "";
      return `<a class="group-card" href="/${escape(g.id)}/">
          <div class="group-card-title">${escape(g.title)}</div>
          <div class="group-card-meta">${sub}${feats.length} feature${
            feats.length === 1 ? "" : "s"
          }${feats.length ? ` · ${ready} ready` : ""}</div>
          <div class="group-card-body">${summaryLine(g.body)}</div>
        </a>`;
    })
    .join("");
}

/**
 * The trail for anything in the product tree, at any depth.
 *
 * Built from the id's own segments, so it does not need to know how deep the corpus
 * nests — which is the point of letting it nest freely at all.
 */
function productCrumb(
  id: string,
  products: ProductDocument[],
  opts: { self: string; linkSelf?: boolean } 
): string {
  const segs = id.split("/");
  const titleOf = (prefix: string): string => {
    const p = products.find((x) => x.slug === prefix);
    if (p) return p.title;
    return findGroupIn(products, prefix)?.title ?? prefix.split("/").pop()!;
  };
  const trail: Array<{ label: string; href?: string }> = [{ label: "Overview", href: "/" }];
  const upTo = opts.linkSelf ? segs.length : segs.length - 1;
  for (let i = 1; i <= upTo; i++) {
    const prefix = segs.slice(0, i).join("/");
    trail.push({ label: titleOf(prefix), href: `/${prefix}/` });
  }
  if (!opts.linkSelf) trail.push({ label: opts.self });
  return renderCrumb(trail);
}

function findGroupIn(products: ProductDocument[], id: string): GroupDocument | null {
  let found: GroupDocument | null = null;
  const walk = (gs: GroupDocument[]) => {
    for (const g of gs) {
      if (g.id === id) found = g;
      walk(g.groups);
    }
  };
  walk(products.flatMap((x) => x.groups));
  return found;
}

/**
 * A product page — what the product is, and the areas inside it.
 *
 * Deliberately not a feature list: a product's own page answers "what is this product
 * and how is the work divided", and the areas answer the rest.
 */
export function renderProduct(
  product: ProductDocument,
  productContext: ContextDocument[] = [],
  readiness: Map<string, FeatureReadiness> = new Map(),
  advice: GroupingAdvice[] = [],
  trackingFor: (id: string) => FeatureTracking | null = () => null
): string {
  const acceptance = acceptanceCount(
    product.areas.flatMap((a) => a.features),
    trackingFor
  );
  const childCards = groupCards(product.groups, readiness);

  const ctx = contextSectionList(
    productContext,
    new Date().toISOString().slice(0, 10),
    "This product's own rules and vocabulary",
    `True across ${escape(product.title)}, not across everything.`
  );

  return `
    ${renderCrumb([{ label: "Overview", href: "/" }, { label: product.title }])}
    ${renderAcceptanceBanner(acceptance.accepted, acceptance.total)}
    <header class="feature">
      <h1>${escape(product.title)}</h1>
      <div class="meta"><span class="pill">product</span><span class="pill">${
        product.groups.length
      } area${product.groups.length === 1 ? "" : "s"}</span><span class="pill">${
        product.areas.reduce((n, a) => n + a.features.length, 0)
      } features</span></div>
    </header>
    ${product.body ? `<article class="prose">${marked.parse(product.body) as string}</article>` : ""}
    ${ctx}
    <h2>Areas</h2>
    <div class="group-cards">${childCards}</div>
    ${renderGroupingAdvice(advice)}
  `;
}

/** A capability system page — what the subsystem is, and the capabilities it offers. */
export function renderCapabilitySystem(
  system: CapabilitySystemDocument,
  readiness: Map<string, FeatureReadiness> = new Map(),
  trackingFor: (id: string) => FeatureTracking | null = () => null,
  /** This subsystem's own vocabulary and rules. */
  systemContext: ContextDocument[] = [],
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const acceptance = acceptanceCount(system.capabilities, trackingFor);
  const cards = system.capabilities
    .map((c) => {
      const r = readiness.get(c.frontmatter.id);
      const h = r ? readinessHeadline(r) : null;
      return `<a class="group-card" href="${escape(c.url_path)}">
          <div class="group-card-title">${escape(c.frontmatter.title)}</div>
          <div class="group-card-meta">${c.frontmatter.behaviors.length} behavior${
            c.frontmatter.behaviors.length === 1 ? "" : "s"
          }${h ? ` · ${escape(h.label)}` : ""}</div>
          <div class="group-card-body">${summaryLine(c.frontmatter.description ?? "")}</div>
        </a>`;
    })
    .join("");
  return `
    ${renderCrumb([
      { label: "Overview", href: "/" },
      { label: "Capabilities" },
      { label: system.title },
    ])}
    ${renderAcceptanceBanner(acceptance.accepted, acceptance.total)}
    <header class="feature">
      <h1>${escape(system.title)}</h1>
      <div class="meta"><span class="pill capability">capability system</span><span class="pill">${
        system.capabilities.length
      } capabilit${system.capabilities.length === 1 ? "y" : "ies"}</span></div>
    </header>
    ${undefinedRollup(system.capabilities, system.title)}
    ${contextSectionList(
      systemContext,
      today,
      "This subsystem's own vocabulary and rules",
      `True inside ${escape(system.title)}, not across the product. Cited as <code>capabilities/${escape(
        system.slug
      )}/&lt;doc&gt;#&lt;section&gt;</code>.`
    )}
    ${system.body ? `<article class="prose">${marked.parse(system.body) as string}</article>` : ""}
    <h2>Capabilities</h2>
    <div class="group-cards">${cards}</div>
  `;
}

export function renderArea(
  area: AreaDocument,
  areaContext: ContextDocument[] = [],
  today: string = new Date().toISOString().slice(0, 10),
  group?: GroupDocument,
  products: ProductDocument[] = [],
  readiness: Map<string, FeatureReadiness> = new Map(),
  advice: GroupingAdvice[] = [],
  trackingFor: (id: string) => FeatureTracking | null = () => null
): string {
  const bodyHtml = area.body ? (marked.parse(area.body) as string) : "";

  // Audit roll-up across every feature in the area
  const auditSummary = auditArea(area.slug, area.features);

  // ⛔ Features first, then capabilities, each under its own heading. Interleaving
  // them alphabetically reads as one flat list of six comparable things, which
  // is the exact confusion `kind` exists to remove: a promise has no screens
  // and is answerable to the features that depend on it, not to a user.
  const cardFor = (f: (typeof area.features)[number]) => {
      const fAudit = auditSummary.features.find((x) => x.feature_id === f.frontmatter.id);
      const issuePill = fAudit && fAudit.counts.total > 0
        ? `<span style="margin-left:10px;color:${
            fAudit.counts.high > 0 ? "var(--red)" : "var(--yellow)"
          };font-weight:600;">${fAudit.counts.total} note${
            fAudit.counts.total === 1 ? "" : "s"
          } on the write-up</span>`
        : "";
      return `
        <a href="${escape(f.url_path)}" style="display:block;background:var(--surface);border:1px solid var(--surface-3);border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);margin:10px 0;">
          <div style="font-weight:600;font-size:15px;color:var(--accent);">${escape(f.frontmatter.title)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;font-family:var(--mono);">${escape(f.frontmatter.id)}</div>
          <div style="color:var(--dim);font-size:12px;margin-top:6px;">
            <span class="feature-kind pill ${f.frontmatter.kind}">${
              f.frontmatter.kind === "capability" ? "capability" : "feature"
            }</span>
            <span class="pill ${f.frontmatter.status}" style="margin-left:6px;">${f.frontmatter.status}</span>
            <span style="margin-left:10px;">${f.frontmatter.behaviors.length} behavior${f.frontmatter.behaviors.length === 1 ? "" : "s"}</span>
            ${issuePill}
          </div>
        </a>`;
  };

  // An area holds features. Capabilities are their own tree.
  const cards = area.features.map(cardFor).join("\n");

  // Area-level flow chart (aggregated cross-feature edges)
  const areaGraph = buildAreaFlowGraph(area);
  const flowBlock = areaGraph.has_flow
    ? `<section class="feature-flow">
         <h2>Flow across this area</h2>
         <div class="mermaid">${escape(renderMermaid(areaGraph))}</div>
       </section>`
    : "";

  // Audit roll-up summary at the top
  const totals = auditSummary.totals;
  const auditBlock = totals.total > 0
    ? `<section style="background:var(--surface);border:1px solid var(--surface-3);border-radius:12px;padding:16px 18px;margin:16px 0;">
         <div style="font-weight:600;margin-bottom:6px;">Audit roll-up</div>
         <div style="color:var(--dim);font-size:13px;">
           <span style="color:var(--red);font-weight:600;">${totals.high}</span> high ·
           <span style="color:var(--yellow);font-weight:600;">${totals.medium}</span> medium ·
           <span style="color:var(--dim);">${totals.low}</span> low across ${auditSummary.feature_count} feature${auditSummary.feature_count === 1 ? "" : "s"}.
         </div>
       </section>`
    : auditSummary.feature_count > 0
    ? `<section style="background:var(--surface);border:1px solid var(--surface-3);border-radius:12px;padding:12px 18px;margin:16px 0;color:var(--dim);font-size:13px;">
         Audit roll-up: no issues across this area.
       </section>`
    : "";

  // Undefined behaviors across the area — what nobody has decided yet.
  //
  // ⛔ Rendered here as well as on each feature page. Not a duplicate of the
  // same fact: the feature page answers "what must I not assume about THIS
  // feature", the area page answers "what is undecided here at all", which is
  // the question a reader arriving at the area actually has. Both are
  // projections of one source — the behaviors — not two copies.
  // ⛔ The whole subtree, not just direct members. With areas nesting, rolling up only
  // direct features means an open question two levels down is invisible from the area
  // a reader actually lands on.
  const areaUndefinedBlock = undefinedRollup(
    group ? groupFeatures(group) : area.features,
    area.title
  );
  const acceptance = acceptanceCount(group ? groupFeatures(group) : area.features, trackingFor);

  // The area's own context — rules and vocabulary true here but not product-wide.
  // Rendered on the area page rather than a separate tab: it constrains the
  // features listed directly below it, and a reader arriving at the area needs
  // it before the features, not in a different place.
  // ⛔ THIS WAS THE PRODUCT'S CONTEXT, RENDERED AS THE AREA'S, ON EVERY AREA PAGE. Three
  // separate untruths in one block, all caught by one reader:
  //
  //   "The block is byte-identical on /cre/deals/, /cre/documents/ and /cre/pricing/, and
  //    identical to the product-level block on /cre/. Each copy asserts it is
  //    area-specific and each gives a different citation prefix — implying they are
  //    different documents with identical content. Meanwhile deal-workspace carries an
  //    audit note that a behavior citing cre/principles#... is malformed. So the same
  //    principle has three plausible addresses and the tool flags one of them as wrong.
  //    'An option is named by its workbook column' appearing under 'Deal management'
  //    reads as a constraint on the deals list, which makes no sense."
  //
  // An area shows its OWN context and otherwise points up. A link is a projection; a
  // copy is a second home for a fact, which is the thing the model exists to prevent.
  const areaContextBlock = areaContext.length
    ? contextSectionList(
        areaContext,
        today,
        "This area's own rules and vocabulary",
        `True across ${escape(area.title)}, not product-wide. Cited as <code>${escape(
          area.product
        )}/${escape(area.slug)}/&lt;doc&gt;#&lt;section&gt;</code>.`
      )
    : `<p class="ctx-uplink">This area has no rules or vocabulary of its own. The ones that govern it are <a href="/${escape(
        area.product
      )}/">${escape(products.find((x) => x.slug === area.product)?.title ?? area.product)}'s</a>.</p>`;

  return `
    ${productCrumb(`${area.product}/${area.slug}`, products, { self: area.title })}
    ${renderAcceptanceBanner(acceptance.accepted, acceptance.total)}
    <header class="feature">
      <h1>${escape(area.title)}</h1>
      <div class="meta"><span class="pill">area</span>${
        group && group.groups.length
          ? `<span class="pill">${group.groups.length} sub-area${group.groups.length === 1 ? "" : "s"}</span>`
          : ""
      }<span class="pill">${area.features.length} feature${area.features.length === 1 ? "" : "s"}</span></div>
    </header>
    ${
      group && group.groups.length
        ? `<h2>Inside this area</h2><div class="group-cards">${groupCards(group.groups, readiness)}</div>`
        : ""
    }
    ${areaUndefinedBlock}
    ${areaContextBlock}
    ${flowBlock}
    ${auditBlock}
    <article class="prose">${bodyHtml}</article>
    ${area.features.length ? `<h2>Features</h2>${cards}` : `<div class="empty-state">No features in this area yet.</div>`}
    ${renderGroupingAdvice(advice)}
    ${renderFeedbackSection(undefined, undefined, "Feedback on " + area.title)}
  `;
}

/**
 * Map from `surface-id` → `feature-id` covering every surface across the
 * entire corpus. Built by the UI server once per request and passed in so
 * leads_to can resolve a bare surface id to whichever feature actually owns
 * that surface (not to a guessed sibling feature page).
 */
export type SurfaceIndex = Map<string, string>;

export function buildSurfaceIndex(features: FeatureDocument[]): SurfaceIndex {
  const idx: SurfaceIndex = new Map();
  for (const f of features) {
    for (const s of f.frontmatter.ux ?? []) {
      // First-write-wins on collisions; same-feature lookups happen separately
      // via the surfaceIdsInFeature set so this only affects cross-feature
      // resolution of ambiguous ids.
      if (!idx.has(s.id)) idx.set(s.id, f.frontmatter.id);
    }
  }
  return idx;
}

export function renderFeature(
  feature: FeatureDocument,
  area: AreaDocument | undefined,
  tracking: FeatureTracking | null,
  surfaceIndex: SurfaceIndex = new Map(),
  allAreas: AreaDocument[] = [],
  capabilitySystems: CapabilitySystemDocument[] = [],
  products: ProductDocument[] = [],
  /** Every container in the corpus — needed for the incoming half of a contradiction. */
  allContainers: FeatureDocument[] = [],
  /** Open framework gaps forced into THIS container. */
  forcedGaps: Array<{ what: string; question?: string }> = [],
  /** This container's readiness, so its blockers can be read rather than only counted. */
  readiness?: FeatureReadiness,
  /** Every context section in the corpus, for the boundary projection. */
  contextSections: Map<string, { section: ContextSection; doc: ContextDocument }> = new Map(),
  /** Feedback entries already filed against this container. */
  openNotes: FeedbackEntry[] = []
): string {
  const f = feature.frontmatter;
  // A capability's trail runs through its subsystem; a feature's through its product
  // and area. Both end at the thing you are looking at.
  const idParts = f.id.split("/");
  const crumb =
    f.kind === "capability" && idParts.length >= 3
      ? renderCrumb([
          { label: "Overview", href: "/" },
          { label: "Capabilities" },
          {
            label: capabilitySystems.find((s) => s.slug === idParts[1])?.title ?? idParts[1]!,
            href: `/capabilities/${idParts[1]}/`,
          },
          { label: f.title },
        ])
      : idParts.length > 1
        ? productCrumb(f.id, products, { self: f.title })
        : renderCrumb([{ label: "Overview", href: "/" }, { label: f.title }]);

  // Contradictions are corpus-wide: the incoming half comes from other containers.
  // ⛔ Both trees. Scoping this to products alone means a capability declaring a
  // contradiction against a feature is invisible from the feature — which is exactly
  // the one-sided visibility the field exists to prevent, and the real case was a
  // capability contradicting a feature.
  const sameAs = buildSameAsIndex(
    allContainers.length ? allContainers : [...(allAreas ?? []).flatMap((a) => a.features), feature]
  );
  const contradictions = buildContradictionIndex(
    allContainers.length ? allContainers : [...(allAreas ?? []).flatMap((a) => a.features), feature]
  );
  const acc = acceptanceCount([feature], () => tracking);
  const acceptance = renderAcceptanceBanner(acc.accepted, acc.total);
  const writeUpNotes = renderAuditFindings(auditFeature(feature, undefined, tracking));
  const description = f.description
    ? `<article class="prose"><p>${escape(f.description)}</p></article>`
    : "";

  // Implementation paths intentionally NOT rendered. The product-truth site
  // is product-language-only; code references live in `productos/tracking/`
  // (still committed, still queryable, still used by the analyzer / drift
  // skills) but shouldn't compete with the claim for the reader's attention.
  const implBlock = "";

  const surfaces = f.ux ?? [];
  // ⛔ Surfaced on the header, not left to an audit note. A feature stamped `built`
  // with three unbuilt screens inside it was telling a reader the opposite of the
  // truth, and the only trace was a note filed under "problems with how this page is
  // written" — the absence of a screen classified as a documentation defect.
  const unbuiltScreens = surfaces.filter(
    (s) => (s.status ?? f.status) === "planned" || s.stub
  );
  const screensPill = unbuiltScreens.length
    ? `<span class="feature-status pill planned" title="${escape(
        unbuiltScreens.map((s) => s.title).join(", ")
      )}">${unbuiltScreens.length} of ${surfaces.length} screens not built</span>`
    : "";
  const rollup = renderFeatureRollup(f.behaviors, tracking);

  // Partition behaviors by surface anchor: anchored ones live inside their
  // surface card; un-anchored ones (rules/invariants) get a "Rules & Invariants"
  // section after surfaces.
  const surfaceIds = new Set(surfaces.map((s) => s.id));
  const anchored = new Map<string, Behavior[]>();
  const unanchored: Behavior[] = [];
  for (const b of f.behaviors) {
    if (b.surface && surfaceIds.has(b.surface)) {
      const arr = anchored.get(b.surface) ?? [];
      arr.push(b);
      anchored.set(b.surface, arr);
    } else {
      unanchored.push(b);
    }
  }

  const surfaceIdSet = new Set(surfaces.map((s) => s.id));

  // Interactive UX preview at the top. Shows ONE UX view sketch prominently,
  // initially the first one. Click an element to navigate:
  //   - Same-feature surface anchor (#surface-X) → swaps the preview to that UX
  //   - Cross-feature (/area/feature...) → confirm dialog before navigating away
  // Also has a small tab strip listing all UX views in this feature for
  // explicit switching, and a "Jump to UX details ↓" link to the bottom section.
  const uxPreviewBlock = surfaces.length
    ? renderUxPreview(f.id, surfaces, surfaceIdSet, surfaceIndex)
    : "";

  const surfacesBlock = surfaces.length
    ? `<div class="section-head"><h2>UX details</h2>${rollup}</div><div class="surfaces">${surfaces.map((s) => renderSurfaceWithBehaviors(f.id, s, anchored.get(s.id) ?? [], tracking, surfaceIdSet, surfaceIndex, contradictions, f.status, sameAs)).join("\n")}</div>`
    : "";
  const unanchoredHeading = surfaces.length ? "Rules & invariants" : "Behaviors";
  // When there are no surfaces, the rollup hasn't been shown yet — surface it on the Behaviors head.
  const unanchoredRollup = !surfaces.length ? rollup : "";
  const behaviorBlocks = f.behaviors.length
    ? (unanchored.length > 0
        ? `<div class="section-head"><h2>${escape(unanchoredHeading)}</h2>${unanchoredRollup}</div>${unanchored.map((b) => renderBehavior(f.id, b, tracking?.behaviors[b.id], { contradictions, sameAs })).join("\n")}`
        : "")
    : `<div class="empty-state">No behaviors documented yet for this feature.</div>`;

  // Feature body renders inline with the description as a combined overview
  // block at the top — not as a separate "Notes" h2 down below.
  const overviewBody = feature.body
    ? `<article class="prose feature-overview">${marked.parse(feature.body) as string}</article>`
    : "";

  const affectedByBlock = renderAffectedBy(f.affected_by ?? []);
  const openQuestionsBlock = renderUndefinedBehaviors(f.behaviors);
  const depsBlock = renderDependencies(f, allAreas ?? []);
  const boundary = boundaryBlock(f.behaviors, contextSections);
  const notesAlready = openNotesBlock(openNotes);
  const readThrough = readThroughBlock(f.read_throughs ?? []);
  // ⛔ A recorded verdict goes to the TOP — it outranks every derived signal. The nudge
  // asking for one goes to the BOTTOM: it stacked with the acceptance banner and gave
  // every page two grey boxes before its own heading, and a reader who has just finished
  // reading is the right person to be asked.
  const readThroughTop = (f.read_throughs ?? []).length ? readThrough : "";
  const readThroughBottom = (f.read_throughs ?? []).length ? "" : readThrough;
  const loadBearing = loadBearingNote(f, allContainers.length ? allContainers : (allAreas ?? []).flatMap((a) => a.features));

  return `
    ${crumb}
    ${readThroughTop}
    ${acceptance}
    ${readinessBlock(readiness)}
    ${loadBearing}
    <header class="feature">
      <div class="feature-title-row">
        <h1>${escape(f.title)}</h1>
        <code class="feature-id">${escape(f.id)}</code>
        <span class="feature-kind pill ${f.kind}" title="${
          f.kind === "capability"
            ? "What the product can do, as a promise. No screens of its own; answerable to the features that depend on it."
            : "User-facing. Triggered by a user action."
        }">${f.kind}</span>
        ${stateChip(f.status, `feature-status pill ${f.status}`)}
        ${screensPill}
      </div>
      ${implBlock}
    </header>
    ${uxPreviewBlock}
    ${description}
    ${boundary}
    ${overviewBody}
    ${depsBlock}
    ${affectedByBlock}
    ${openQuestionsBlock}
    ${surfacesBlock}
    ${behaviorBlocks}
    ${readThroughBottom}
    ${notesAlready}
    ${renderFrameworkGaps(forcedGaps)}
    ${writeUpNotes}
    ${renderFeedbackSection(f.id, undefined, "Feedback on this feature")}
    ${renderAiAssistPane(f.id)}
  `;
}

function renderAiAssistPane(featureId: string): string {
  return `
    <section class="ai-assist-pane" data-feature="${escape(featureId)}">
      <div class="ai-assist-head">
        <span class="ai-assist-title">🤖 Ask AI to edit this feature</span>
        <span class="ai-assist-hint">Describe the change in plain English. It is applied straight away where that is set up, and queued for review otherwise.</span>
      </div>
      <textarea class="ai-assist-input" placeholder="e.g. 'This claim should say the request is refused, not queued' or 'Add the empty state to this screen&rsquo;s sketch'"></textarea>
      <div class="ai-assist-actions">
        <button class="primary" data-action="ai-submit" data-feature="${escape(featureId)}">Submit</button>
        <span class="ai-assist-status"></span>
      </div>
    </section>
  `;
}

/**
 * Top-of-feature interactive UX preview. Renders one UX view's sketch in a
 * hero container, plus a small tab strip to switch between UX views, plus
 * a "Jump to UX details" link pointing at the lower #ux-details section.
 */

 /**
 * Each UX view's sketch is pre-rendered into a hidden div; the active one
 * is shown. JS in APP_JS handles tab clicks and intercepts cross-feature
 * sketch-anchor clicks for a confirm dialog.
 */
function renderUxPreview(
  featureId: string,
  surfaces: Surface[],
  surfaceIdsInFeature: Set<string>,
  surfaceIndex: SurfaceIndex
): string {
  if (surfaces.length === 0) return "";
  const tabs = surfaces
    .map(
      (s, i) =>
        `<button class="ux-tab${i === 0 ? " active" : ""}" data-ux-target="ux-preview-${escape(s.id)}">${escape(s.title)}</button>`
    )
    .join("");
  const panels = surfaces
    .map((s, i) => {
      const mockContent = renderUxMockContent(
        s,
        (sketch) => decorateSketch(sketch, s.elements, featureId, surfaceIdsInFeature, surfaceIndex),
        (html) => decorateHtmlMock(html, s.elements, featureId, surfaceIdsInFeature, surfaceIndex)
      );
      return `<div class="ux-preview-panel${i === 0 ? " active" : ""}" id="ux-preview-${escape(s.id)}">
        <div class="ux-preview-head">
          <span class="ux-preview-title">${escape(s.title)}</span>
          <a class="ux-jump" href="#surface-${escape(s.id)}">Jump to ${escape(s.title)} details ↓</a>
        </div>
        ${mockContent}
      </div>`;
    })
    .join("\n");
  return `
    <h2 class="ux-preview-h2">UX</h2>
    <section class="ux-preview" data-feature-id="${escape(featureId)}">
      ${surfaces.length > 1 ? `<div class="ux-tabs">${tabs}</div>` : ""}
      ${panels}
    </section>
  `;
}

/**
 * Dependencies, and the reverse edge.
 *
 * ⛔ The reverse traversal is the point. "What breaks if this promise changes"
 * is the question a strict hierarchy cannot answer, and it is derived from the
 * same `depends_on` edges rather than authored a second time — so it cannot
 * disagree with the forward view.
 */
/**
 * Whether an unbuilt thing is load-bearing — derived, never authored.
 *
 * ⛔ Every reviewer asked for build order and none of them should get a field for it: a
 * plan changes weekly and truth would rot at the speed of a sprint board. But the
 * legitimate half of what they wanted is knowable from edges already declared:
 *
 *   "Of three declared-and-unbuilt screens, nothing distinguishes the one that is
 *    load-bearing from the two that are not. I dropped this entirely."
 *
 * A planned container that something already depends on, or whose open questions block
 * named behaviors, IS load-bearing — and the corpus knows it. So the ordering signal is
 * computed and stated, and nobody writes a priority.
 */
function loadBearingNote(
  f: FeatureDocument["frontmatter"],
  allContainers: FeatureDocument[]
): string {
  if (f.status !== "planned") return "";
  const dependents = allContainers.filter((x) =>
    (x.frontmatter.depends_on ?? []).includes(f.id)
  );
  const blockedElsewhere = allContainers.flatMap((c) =>
    c.frontmatter.behaviors.flatMap((b) =>
      (b.blocks ?? [])
        .filter((ref) => ref.startsWith(`${f.id}#`))
        .map(() => `${c.frontmatter.id}#${b.id}`)
    )
  );
  const stubs = (f.ux ?? []).filter((v) => v.stub).length;
  if (dependents.length === 0 && blockedElsewhere.length === 0) {
    return stubs
      ? `<div class="load-bearing none">Nothing else in this corpus depends on this yet — as far as the declared edges go, it can wait.</div>`
      : "";
  }
  const bits: string[] = [];
  if (dependents.length)
    bits.push(
      `${dependents.length} other container${dependents.length === 1 ? "" : "s"} already depend${
        dependents.length === 1 ? "s" : ""
      } on it (${dependents
        .map((d) => `<a href="/${escape(d.frontmatter.id)}"><code>${escape(d.frontmatter.id)}</code></a>`)
        .join(", ")})`
    );
  if (blockedElsewhere.length)
    bits.push(`${blockedElsewhere.length} behaviour${blockedElsewhere.length === 1 ? "" : "s"} elsewhere are blocked on it`);
  return `<div class="load-bearing">This is not built, and it is <strong>load-bearing</strong>: ${bits.join(
    "; "
  )}.</div>`;
}

function renderDependencies(
  f: FeatureDocument["frontmatter"],
  allAreas: AreaDocument[]
): string {
  const rows: string[] = [];

  if (f.depends_on.length) {
    rows.push(
      `<div class="dep-row"><span class="dep-label">Depends on</span>${f.depends_on
        .map((id) => `<a class="dep-pill" href="/${escape(id)}"><code>${escape(id)}</code></a>`)
        .join("")}</div>`
    );
  }

  // Edges somebody believes exist and this page's owner has not confirmed.
  if ((f.suspected_depends_on ?? []).length) {
    rows.push(
      `<div class="dep-row"><span class="dep-label">Suspected</span>${(
        f.suspected_depends_on ?? []
      )
        .map(
          (s) =>
            `<a class="dep-pill suspected" href="/${escape(s.id)}" title="${escape(
              s.because
            )}"><code>${escape(s.id)}</code></a>`
        )
        .join("")}</div>`,
      `<div class="dep-note suspected">Unconfirmed. ${(f.suspected_depends_on ?? [])
        .map(
          (s) =>
            `${escape(s.because)}${s.raised_by ? ` — ${escape(s.raised_by)}` : ""}`
        )
        .join(" ")} The owner of this page has not declared ${
        (f.suspected_depends_on ?? []).length === 1 ? "it" : "them"
      } yet.</div>`
    );
  }

  const pool = allAreas.flatMap((a) => a.features);
  const dependents = pool.filter((x) => (x.frontmatter.depends_on ?? []).includes(f.id));
  const suspectedBy = pool.filter((x) =>
    (x.frontmatter.suspected_depends_on ?? []).some((s) => s.id === f.id)
  );
  // ⛔ NO INCOMING EDGES IS NOT THE SAME AS NOTHING USING THIS, and rendering silence
  // said the wrong one. `depends_on` is declared by the consumer, so a consumer that
  // forgets produces a page that looks unused:
  //
  //   "`rent-roll-review` has no 'Depended on by' at all — the site renders that section
  //    for other pages, so its absence means nothing declares a dependency on this
  //    feature. But the area page says 'everything downstream consumes versions.' Either
  //    a whole delivery path is missing from the corpus, or this feature's stated purpose
  //    is not true of the product. An edge nobody declares is indistinguishable from an
  //    edge that does not exist, and the site renders that silence as 'nothing depends on
  //    this.'"
  //
  // That is also how a blocking contradiction stayed hidden on another page. So the
  // absence is stated, with the reason it might be a lie.
  if (dependents.length === 0 && suspectedBy.length === 0) {
    rows.push(
      `<div class="dep-note none">Nothing in this corpus declares that it depends on this. That may mean nothing does — or that a consumer has not declared it, because this edge is written on the consumer's page and not on this one. If you know of one, add it there, or record it here as suspected.</div>`
    );
  }

  if (dependents.length || suspectedBy.length) {
    rows.push(
      `<div class="dep-row"><span class="dep-label">Depended on by</span>${dependents
        .map(
          (x) =>
            `<a class="dep-pill" href="/${escape(x.frontmatter.id)}"><code>${escape(
              x.frontmatter.id
            )}</code></a>`
        )
        .join("")}${suspectedBy
        .map(
          (x) =>
            `<a class="dep-pill suspected" href="/${escape(x.frontmatter.id)}" title="Suspected, not confirmed by the owner of that page"><code>${escape(
              x.frontmatter.id
            )}</code></a>`
        )
        .join("")}</div>`
    );
    // ⛔ The impact count must carry the doubt. Rendered as a bare confident number it
    // was actively misleading — "changes 1 container" when the true figure was at least
    // three — and a reviewer nearly scoped a change off it. A range with the uncertainty
    // shown is worse to read and far better to act on than a wrong certainty.
    if (f.kind === "capability") {
      const confident = dependents.length;
      const total = confident + suspectedBy.length;
      rows.push(
        `<div class="dep-note">Changing what this promises changes ${
          suspectedBy.length
            ? `<strong>${confident}–${total}</strong> containers — ${confident} declared, ${suspectedBy.length} suspected and unconfirmed`
            : `${confident} ${confident === 1 ? "container" : "containers"}`
        }.</div>`
      );
    }
  }

  return rows.length ? `<div class="deps">${rows.join("")}</div>` : "";
}

function renderAffectedBy(featureIds: string[]): string {
  if (featureIds.length === 0) return "";
  const pills = featureIds
    .map(
      (id) =>
        `<a class="affected-by-pill" href="/${escape(id)}"><code>${escape(id)}</code></a>`
    )
    .join("");
  return `<div class="affected-by"><span class="affected-by-label">Affected by:</span>${pills}</div>`;
}

/**
 * Undefined behaviors, above the defined ones rather than below them.
 *
 * ⛔ Placement is the point. These are what a reader or an agent must NOT
 * assume, so they have to be seen before the claims, not discovered after.
 * Buried at the bottom they read as trivia; at the top they read as a warning.
 */
/**
 * What a reader needs about an undecided behavior beyond the question itself: who owes
 * the answer, how long it has been open, and what it actually blocks.
 *
 * ⛔ `blocks` present-and-empty is NOT the same as absent, and the difference is the
 * whole value. "Blocks nothing" lets a reader proceed; nobody having worked it out does
 * not. The old rendering flagged every question as blocking and named nothing, so "a
 * hard blocker and a nice-to-have" collapsed into one word.
 */
function undecidedMeta(b: Behavior, today: string): string {
  const bits: string[] = [];
  if (b.asked_of) bits.push(`${escape(b.asked_of)} owes the answer`);
  if (b.asked_at) {
    const days = Math.floor(
      (Date.parse(today) - Date.parse(String(b.asked_at).slice(0, 10))) / 86400000
    );
    const age = Number.isFinite(days)
      ? days <= 0
        ? "raised today"
        : days === 1
          ? "open 1 day"
          : days < 45
            ? `open ${days} days`
            : `open ${Math.round(days / 30)} months`
      : "";
    if (age) bits.push(`<span class="oq-age${days >= 30 ? " stale" : ""}">${age}</span>`);
  }
  const blocksLine =
    b.blocks === undefined
      ? `<div class="oq-blocks unknown">Nobody has worked out what this blocks.</div>`
      : b.blocks.length === 0
        ? `<div class="oq-blocks none">Blocks nothing — the rest of this can ship without it.</div>`
        : `<div class="oq-blocks">Blocks ${b.blocks
            .map((x) =>
              x.includes("#")
                ? `<a href="/${escape(x.split("#")[0]!)}#behavior-${escape(
                    x.split("#")[1]!
                  )}"><code>${escape(x)}</code></a>`
                : `<a href="#behavior-${escape(x)}"><code>${escape(x)}</code></a>`
            )
            .join(", ")}</div>`;
  return `${bits.length ? `<div class="oq-owed">${bits.join(" · ")}</div>` : ""}${blocksLine}`;
}

/**
 * The record of a question that got answered — the one verb a product manager did not
 * have.
 *
 * ⛔ Rendered on the claim, permanently. A claim that settled a real disagreement used
 * to read exactly like one nobody ever questioned, because answering deleted the
 * question.
 */
function answeredBlock(b: Behavior): string {
  if (!b.answers) return "";
  const who = [b.decided_by, b.decided_at ? String(b.decided_at).slice(0, 10) : null]
    .filter(Boolean)
    .join(" · ");
  return `<details class="answered">
      <summary><span class="ans-head">This settled an open question</span>${
        who ? `<span class="ans-who">${escape(who)}</span>` : ""
      }</summary>
      <div class="ans-q">${escape(b.answers)}</div>
      ${b.because ? `<div class="ans-why">${escape(b.because)}</div>` : ""}
    </details>`;
}

/**
 * The scope a claim holds over, when it is not the whole product.
 *
 * ⛔ Loud on purpose. Its absence is what let one lender's numbers read as a rule of
 * the product, and a reader who misses it builds the single-tenant version again.
 */
function holdsForBlock(b: Behavior): string {
  if (!b.holds_for) return "";
  return `<div class="holds-for" title="This claim is asserted only of what it names here — not of the product in general.">Only true of <strong>${escape(
    b.holds_for
  )}</strong></div>`;
}

function renderUndefinedBehaviors(behaviors: Behavior[], today: string = new Date().toISOString().slice(0, 10)): string {
  const open = behaviors.filter((b) => !b.deprecated && isUndefinedBehavior(b));
  if (open.length === 0) return "";
  return `<section class="open-questions has-blocking">
      <h2>${escape(`${open.length} undecided behavior${open.length === 1 ? "" : "s"}`)}</h2>
      <p class="oq-intro">No claim decided yet. Nothing here can be built from — ask rather than assume.</p>
      <ul>${open
        .map(
          (b) => `<li class="oq oq-blocking">
            <div class="oq-q">${escape(b.question ?? "")}</div>
            ${undecidedMeta(b, today)}
            <div class="oq-feature"><a href="#behavior-${escape(b.id)}"><code>${escape(
            b.id
          )}</code></a></div>
          </li>`
        )
        .join("")}</ul>
    </section>`;
}

/**
 * Render the visual content for ONE UX view. Fidelity chain:
 *   1. sketch_html (AI-generated mock that mirrors the user's component
 *      structure + classes, produced by reading their src/components)
 *      → rendered as HTML with the user's CSS loaded via /_user-style.css
 *   2. sketch → decorated ASCII sketch with pattern-based decoration
 *   3. nothing → empty-state placeholder
 */
function renderUxMockContent(
  s: Surface,
  decorateAscii: (sketch: string) => string,
  decorateHtml: (html: string) => string = (h) => h
): string {
  if (s.sketch_html) return `<div class="ux-mock">${decorateHtml(s.sketch_html)}</div>`;
  if (s.sketch) return `<pre class="surface-sketch">${decorateAscii(s.sketch)}</pre>`;
  return `<div class="empty-state">No sketch.</div>`;
}

/**
 * A claim on a screen that does not exist yet is INTENT, and reads as observation.
 *
 * ⛔ ProductOS was refusing something it also demanded. `stub-with-no-intent` tells an
 * author to write what an unbuilt screen must do, while a framework gap on the same page
 * said intent for an unbuilt surface can only go in prose — and a reader caught both in
 * one breath:
 *
 *   "The audit demands a thing the model cannot hold, and the tool knows it. My five
 *    behaviors are all future-tense promises about a screen nobody has written. There is
 *    no shape for them. They would have ended up as prose in the surface description,
 *    indistinguishable from the observed claims next to them — which is precisely the
 *    danger."
 *
 * The shape existed and was never named: a behavior on a `planned` surface is a promise
 * about what will be built, and the grammar cannot show that because product truth is
 * written in the present tense throughout. So the SURFACE says it, once, for every claim
 * under it — derived from its status, with no new field and no tense change.
 */
function intentNotice(s: Surface, featureStatus: string): string {
  const planned = (s.status ?? featureStatus) === "planned" || s.stub;
  if (!planned) return "";
  return `<div class="intent-notice">This screen does not exist yet. Everything claimed below is <strong>what it must do</strong> — intent recorded before the code, not an observation of anything running. Nothing here has been seen working, because there is nothing to see.</div>`;
}

/**
 * Every element on a surface, with how many behaviors it carries.
 *
 * ⛔ An element with no behaviors was INVISIBLE rather than empty. Behaviors render
 * grouped under the element they anchor to, so a control with nothing promised about it
 * simply did not appear — while the checker knew it existed:
 *
 *   "`Search` and `+ Add columns` are drawn in the mock and do not appear in the page's
 *    structure. Meanwhile three elements I never saw in the body exist in the model and
 *    surface only as audit notes about their missing links. The checker knows about
 *    elements the reader is never shown. An inventory of every element with its behavior
 *    count would have turned my guess into a glance."
 *
 * So the inventory is the surface's own contents page, and a zero is the finding: a
 * drawn control with no promises is one an engineer will build from the picture.
 */
function elementInventory(s: Surface, anchored: Behavior[]): string {
  const els = s.elements ?? [];
  if (els.length === 0) return "";
  const counts = new Map<string, number>();
  for (const b of anchored) {
    if (b.deprecated || !b.element) continue;
    counts.set(b.element, (counts.get(b.element) ?? 0) + 1);
  }
  const rows = els
    .map((e) => {
      const n = counts.get(e.id) ?? 0;
      return `<li class="ei${n === 0 ? " none" : ""}">
          <span class="ei-label">${escape(e.label ?? e.id)}</span>
          <code class="ei-id">${escape(e.id)}</code>
          <span class="ei-kind">${escape(e.kind ?? "")}</span>
          <span class="ei-count">${
            n === 0 ? "nothing promised" : `${n} behavior${n === 1 ? "" : "s"}`
          }</span>
        </li>`;
    })
    .join("");
  const silent = els.length - [...counts.keys()].filter((k) => els.some((e) => e.id === k)).length;
  return `<details class="el-inventory">
      <summary><span class="ei-head">Everything on this screen</span><span class="ei-sum">${
        els.length
      } element${els.length === 1 ? "" : "s"}${
        silent > 0 ? ` · ${silent} with nothing promised` : ""
      }</span></summary>
      <ul>${rows}</ul>
    </details>`;
}

function renderSurfaceWithBehaviors(
  featureId: string,
  s: Surface,
  anchoredBehaviors: Behavior[],
  tracking: FeatureTracking | null,
  surfaceIdsInFeature: Set<string>,
  surfaceIndex: SurfaceIndex,
  contradictions?: Map<string, Array<{ from: string; note: string }>>,
  featureStatus: string = "built",
  sameAs?: Map<string, Set<string>>
): string {
  // Element pills below the sketch are intentionally NOT rendered — the sketch
  // itself, decorated by decorateSketch() with kind-aware styling and
  // leads_to-aware clickability, is the canonical element view. The element
  // declarations still live in the markdown so behaviors can anchor via
  // `element: <id>` — they just don't render as a separate redundant list.
  const elementsLine = "";
  const sketchBlock = renderUxMockContent(
    s,
    (sketch) => decorateSketch(sketch, s.elements, featureId, surfaceIdsInFeature, surfaceIndex),
    (html) => decorateHtmlMock(html, s.elements, featureId, surfaceIdsInFeature, surfaceIndex)
  );
  // Surface.path (route / URL) is intentionally NOT rendered in the header
  // — it's a routing-implementation detail the PM doesn't read. Data persists
  // in markdown for engineers who need to locate the code.
  const pathLine = "";
  const count = anchoredBehaviors.length;
  const countLine =
    count > 0
      ? `<span class="surface-count">${count} behavior${count === 1 ? "" : "s"}</span>`
      : `<span class="surface-count surface-count-empty">no behaviors anchored</span>`;

  const nestedBehaviors =
    count > 0
      ? `<div class="surface-behaviors">${anchoredBehaviors
          .map((b) => renderBehavior(featureId, b, tracking?.behaviors[b.id], { nestedInSurface: true, contradictions, sameAs }))
          .join("\n")}</div>`
      : "";

  // Verified count for the surface summary line — quick scan signal.
  const verifiedCount = anchoredBehaviors.filter((b) => b.verified === true).length;
  const verifiedBadge = verifiedCount > 0 && count > 0
    ? `<span class="surface-verified" title="${verifiedCount} of ${count} verified">✓ ${verifiedCount}/${count}</span>`
    : "";

  return `
    <details class="surface-details" id="surface-${escape(s.id)}">
      <summary class="surface-summary">
        <span class="surface-disclosure">▸</span>
        <span class="surface-title">${escape(s.title)}</span>
        <code class="surface-id">${escape(s.id)}</code>
        ${verifiedBadge}
        ${countLine}
      </summary>
      <section class="surface">
        ${intentNotice(s, featureStatus)}
        ${
          count > 0
            ? // ⛔ WHICH WINS WHEN THE PICTURE AND THE SENTENCE DISAGREE. Two reviewers
              // hit this three times each — a sketch showing six tabs where the prose
              // said eight, a column labelled R where the naming rule's own case said N,
              // a padlock on the one band the feature exists to let you edit:
              //
              //   "There is no way to rank two artifacts on the same page. A padlock is
              //    the universal glyph for not-editable, and it sits on the one band the
              //    feature exists to let you edit. An engineer building from the mock
              //    alone ships the most important interaction on the screen as
              //    read-only."
              //
              // So the rule is stated where the conflict happens, and it goes one way:
              // a sketch is ASCII and cannot carry a condition, an exception or a state,
              // so it can only ever be an approximation of a claim.
              `<div class="sketch-precedence">The sketch shows roughly where things sit. Where it disagrees with a claim below, <strong>the claim is right</strong> — a drawing cannot carry a condition or an exception, so treat a glyph as a hint and never as a specification.</div>`
            : ""
        }
        ${sketchBlock}
        ${elementInventory(s, anchoredBehaviors)}
        ${elementsLine}
        ${s.notes ? `<div class="surface-notes">${escape(s.notes)}</div>` : ""}
        ${nestedBehaviors}
      </section>
    </details>`;
}


function renderFeatureRollup(behaviors: Behavior[], tracking: FeatureTracking | null): string {
  const counts: Record<DerivedVerification, number> = {
    undefined: 0,
    verified: 0,
    contested: 0,
    orphan: 0,
    uncertain: 0,
    unverified: 0,
  };
  let deprecated = 0;
  for (const b of behaviors) {
    if (b.deprecated) { deprecated += 1; continue; }
    const d = derivedVerification(b, tracking?.behaviors[b.id] ?? null);
    counts[d.state] += 1;
  }
  const chips: string[] = [];
  const order: DerivedVerification[] = ["undefined", "verified", "contested", "orphan", "uncertain", "unverified"];
  for (const k of order) {
    if (counts[k] === 0) continue;
    chips.push(
      `<span class="chip ${k}" title="${escape(
        STATE_HELP[readerWord(k)] ?? ""
      )}"><strong>${counts[k]}</strong>${escape(readerWord(k))}</span>`
    );
  }
  if (deprecated > 0) chips.push(`<span class="chip"><strong>${deprecated}</strong>deprecated</span>`);
  if (chips.length === 0) return "";
  return `<div class="rollup">${chips.join("")}</div>`;
}

/**
 * One behavior card.
 *
 * ⛔ The DOM id is `behavior-<id>`, NOT the bare id. Every link on the site points at
 * `#behavior-<id>` — "Blocks …", "Rested on by …", contradictions, same-as, and every
 * write-up-note link — and this element once answered to the unprefixed form, so all of
 * them dropped the reader at the top of the page.
 *
 * ⛔ And this note lives HERE, not inside the template literal. It shipped as an HTML
 * comment for a while, which put a maintainer instruction — complete with a file-shaped
 * fact and a page count — inside the product-truth document, twenty times per page. A
 * reader found it: "maintainer instructions ship inside the artifact." Invisible in a
 * browser and still wrong: the artifact is the deliverable, and notes to us are not part
 * of it.
 */
function renderBehavior(
  featureId: string,
  b: Behavior,
  t: BehaviorTracking | undefined,
  opts: {
    nestedInSurface?: boolean;
    contradictions?: Map<string, Array<{ from: string; note: string }>>;
    sameAs?: Map<string, Set<string>>;
  } = {}
): string {
  const d = derivedVerification(b, t ?? null);
  const claim = escape(b.claim);
  const scopeBlock = holdsForBlock(b);
  const contraBlock = contradictionBlock(
    featureId,
    b,
    opts.contradictions?.get(`${featureId}#${b.id}`) ?? []
  );
  const answered = answeredBlock(b);
  const sameAs = sameAsBlock(`${featureId}#${b.id}`, opts.sameAs?.get(`${featureId}#${b.id}`));
  const undecided = isUndefinedBehavior(b)
    ? undecidedMeta(b, new Date().toISOString().slice(0, 10))
    : "";
  const verifiedLine = t?.last_verified
    ? `<div class="verified-line">Last accepted ${escape(t.last_verified)}${t.verified_by ? " by " + escape(t.verified_by) : ""}</div>`
    : "";
  // Confidence, next to the claim rather than in a panel.
  //
  // ⛔ Its only job is telling a reviewer whether to read closely or skim, and
  // it cannot do that from somewhere they have to click into. The basis is
  // shown with it, because a confidence nobody can check is just a number an
  // agent chose.
  const confidenceLine = t?.confidence
    ? `<div class="conf conf-${t.confidence}" title="${escape(
        t.confidence === "stated"
          ? "A human stated this explicitly. The basis quotes them."
          : t.confidence === "observed"
            ? "Read off the code and cited. True of what the product does — which is not the same as what anyone intended."
            : "Inferred by an agent with no direct evidence. Start review here."
      )}"><span class="conf-chip">${
        t.confidence === "guessed" ? "guessed \u00b7 review first" : escape(t.confidence)
      }</span>${
        t.basis.length
          ? // ⛔ The quote is evidence a reader can weigh; the ref is a pointer only
            // engineering can follow, and running them together put
            // `frontend/app/.../DealPricingMatrix.tsx:16-22` in a product manager's
            // face on a product-truth page. Quote inline, ref demoted and labelled.
            t.basis
              .map(
                (bb) =>
                  `<span class="conf-basis">${
                    bb.quote ? `\u201c${escape(bb.quote)}\u201d` : ""
                  }${
                    bb.ref
                      ? `<span class="conf-ref" title="Where an engineer can check this">${escape(
                          bb.ref
                        )}</span>`
                      : ""
                  }</span>`
              )
              .join("")
          : ""
      }</div>`
    : "";

  // Per-behavior code refs intentionally NOT rendered (same reason as the
  // feature-level implBlock — product language only). Data persists in
  // productos/tracking/<area>/<feature>.yaml for the analyzer / drift skills.
  const impl = "";
  const notes = b.notes ? `<div class="notes">${escape(b.notes)}</div>` : "";
  const evidence = renderBehaviorEvidence(b, t);
  const isDeprecated = b.deprecated === true;
  const headPills = isDeprecated
    ? `<span class="status status-deprecated">deprecated</span>`
    : stateChip(readerWord(d.state), `status status-${d.state}`);
  // Hide the reason when it just restates the badge ("no human has accepted
  // this Contract yet" is redundant with the Unverified badge). For Contested
  // / Orphan / Uncertain the reason carries actual signal so keep it.
  const reasonIsRedundant = d.state === "unverified";
  const reasonLine = !isDeprecated && d.reason && !reasonIsRedundant ? `<div class="reason">${escape(d.reason)}</div>` : "";
  const deprecatedReason = isDeprecated && b.deprecated_reason ? `<div class="reason">${escape(b.deprecated_reason)}</div>` : "";

  // ⛔ EVERY BUTTON SAYS WHAT IT DOES. Reject and Contest sat side by side with no
  // distinction offered, and two fresh reviewers refused to press either:
  //
  //   "Reject = wrong, Contest = ? Two destructive-looking buttons side by side with no
  //    distinction offered. I would not press either."
  //   "The `!Contest` button might be that, but from the page alone I cannot tell whether
  //    it destroys the claim, hides it, or files a note — and I am not going to click an
  //    unlabelled button on someone else's spec on day one."
  //
  // An unlabelled destructive-looking button on someone else's spec is a button nobody
  // uses, so the two verbs the reviewer most needed were the two they would not touch.
  // ⛔ An UNDECIDED behavior gets a different verb set. Accept would stamp approval on a
  // container the page says holds no claim; Reword would overwrite the question with a
  // claim and lose the record that it was ever open. The act a reader needs here is
  // "answer it", and it is the only one that was missing.
  const decideForm = isUndefinedBehavior(b)
    ? `<div class="actions">
        <button class="primary" data-action="decide-toggle">✓ Answer this</button>
        <button data-action="feedback-toggle" title="Leave a note for whoever maintains this page.">💬 Leave a note</button>
        <button data-action="ai-toggle" title="Queue a change for an agent. Nothing is decided by doing this.">🤖 Ask an agent</button>
      </div>
      <div class="decide-form" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
        <div class="df-intro">You are settling what the product does. The question is kept alongside your answer, so the next reader can see this was in doubt.</div>
        <textarea name="claim" placeholder="What the product does, now that it is decided. One falsifiable sentence, present tense."></textarea>
        <textarea name="because" placeholder="Why this way, and what else you considered. This is the part that stops the question being reopened from scratch."></textarea>
        <div class="df-actions">
          <button class="primary" data-action="decide-submit">Record this decision</button>
          <span class="df-status"></span>
        </div>
        <div class="df-note">Deciding is not accepting. The claim will be <em>awaiting review</em> — somebody still has to confirm it says what you meant.</div>
      </div>`
    : "";

  const actions = isDeprecated
    ? `<div class="actions"><span style="color:var(--dim);font-size:12px;">deprecated — kept for history</span></div>`
    : isUndefinedBehavior(b)
      ? decideForm
      : `<div class="actions">
        <button class="primary" data-action="verify" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}" title="This is what we intend. Accepts the claim in your name — the one act an agent cannot do.">✓ Accept — this is what we intend</button>
        <button data-action="edit-toggle" title="Change the wording. An edit drops any acceptance, because the stamp covered the old words.">✎ Reword</button>
        <button data-action="contest" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}" title="The claim is written down but not true of the product. Keeps the claim and flags the disagreement, so the next reader sees both.">! Not true of the product</button>
        <button class="danger" data-action="reject" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}" title="The product should not promise this at all. Retires the claim; nothing is deleted and the id is kept.">✗ We should not promise this</button>
        <button data-action="feedback-toggle" title="Leave a note for whoever maintains this page.">💬 Leave a note</button>
        <button data-action="ai-toggle" title="Queue a change for an agent to make. Nothing is accepted by doing this.">🤖 Ask an agent</button>
      </div>
      <div class="ai-form">
        <textarea name="ask" placeholder="What should AI do? e.g. 'Verify this claim against the live app and update test cases if they're wrong.' Will be queued; say 'drain productos queue' in Claude to process."></textarea>
        <div class="row">
          <select name="kind">
            <option value="freeform">Freeform</option>
            <option value="address-feedback">Address as feedback</option>
          </select>
          <button class="primary" data-action="ai-submit">Send to queue</button>
          <button data-action="ai-cancel">Cancel</button>
        </div>
      </div>
      <div class="edit-form" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
        <textarea name="claim" placeholder="Claim (what the product does, in product language)">${escape(b.claim)}</textarea>
        <textarea name="notes" placeholder="Optional notes / why this exists / non-obvious context">${escape(b.notes ?? "")}</textarea>
        <div class="row">
          <button class="primary" data-action="edit-save" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">Save</button>
          <button data-action="edit-cancel">Cancel</button>
        </div>
      </div>`;

  const anchorStrip = renderBehaviorAnchor(b, { hideSurfaceName: opts.nestedInSurface === true });
  // Summary line content — visible when the behavior is collapsed.
  // First-sentence-of-claim + ✓ if human-validated + a (N test cases) hint
  // so the reader can scan without expanding.
  const claimSummary = oneLine(b.claim, 140);
  const verifiedTick = b.verified === true
    ? `<span class="bsum-verified" title="Human-validated${b.verified_by ? " by " + escape(b.verified_by) : ""}${b.verified_at ? " at " + escape(b.verified_at) : ""}">✓</span>`
    : "";
  const testCount = b.test_cases.length;
  const testCountChip = testCount > 0
    ? `<span class="bsum-tests">${testCount} test${testCount === 1 ? "" : "s"}</span>`
    : "";

  return `
    <details class="behavior-details" id="behavior-${escape(b.id)}" data-feature="${escape(featureId)}" data-behavior="${escape(b.id)}">
      <summary class="behavior-summary">
        <span class="bsum-disclosure">▸</span>
        ${verifiedTick}
        <span class="bsum-id">${escape(b.id)}</span>
        ${headPills}
        ${testCountChip}
        <span class="bsum-claim">${escape(claimSummary)}</span>
      </summary>
      <article class="behavior">
        ${anchorStrip}
        <div class="claim">${claim}</div>
        ${contraBlock}
        ${citesBlock(b)}
        ${ambiguityBlock(b)}
        ${scopeBlock}
        ${undecided}
        ${sameAs}
        ${answered}
        ${reasonLine}
        ${deprecatedReason}
        ${confidenceLine}${verifiedLine}
        ${notes}
        ${evidence}
        ${impl}
        ${actions}
        ${renderFeedbackForm(featureId, b.id)}
      </article>
    </details>
  `;
}

function oneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function renderBehaviorAnchor(
  b: Behavior,
  opts: { hideSurfaceName?: boolean } = {}
): string {
  if (!b.surface) return "";
  const parts: string[] = [];
  if (!opts.hideSurfaceName) {
    parts.push(`<a href="#surface-${escape(b.surface)}">${escape(b.surface)}</a>`);
  }
  if (b.element) {
    if (parts.length > 0) parts.push(`<span class="arr">›</span>`);
    parts.push(`<span class="element-ref"><code>${escape(b.element)}</code></span>`);
  }
  if (b.interaction) {
    if (parts.length > 0) parts.push(`<span class="arr">·</span>`);
    parts.push(`<span class="interaction">${escape(b.interaction)}</span>`);
  }
  if (parts.length === 0) return "";
  return `<div class="anchor-strip">${parts.join(" ")}</div>`;
}

function renderBehaviorEvidence(b: Behavior, t: BehaviorTracking | undefined): string {
  const runs = t?.test_case_runs ?? {};
  const drifts = (t?.drift_events ?? []).filter((d) => !d.resolved_at);
  const cases = b.test_cases ?? [];

  // ALWAYS render the test cases section — even when empty. Silent absence
  // ("hey, where are my test cases?") was a real reported problem. Make the
  // gap visible so the PM knows there's no scaffolding yet.
  const rows: string[] = [];
  rows.push(renderTestCasesBlock(cases, runs));

  if (drifts.length > 0) {
    const driftLines = drifts.map((d) => {
      const when = String(d.opened_at).slice(0, 19).replace("T", " ");
      const ctx = d.context?.message ? ` — ${escape(String(d.context.message))}` : "";
      return `      <li><span class="ev-fail">${d.kind}</span> opened <code>${when}</code>${ctx}</li>`;
    });
    rows.push(`<div class="ev-row"><span class="ev-label">Open drift</span><ul style="margin:0;padding-left:18px;">${driftLines.join("\n")}</ul></div>`);
  }
  return `<div class="evidence">${rows.join("\n")}</div>`;
}

function renderTestCasesBlock(
  cases: Behavior["test_cases"],
  runs: NonNullable<BehaviorTracking["test_case_runs"]>
): string {
  if (cases.length === 0) {
    // ⛔ No tool commands here. A reader met "Re-run productos-scope or
    // productos-fullscan to propose 1-3 cases per behavior" inside a page they were
    // reading as requirements: "I cannot tell which sentences are addressed to me."
    return `<div class="ev-row"><span class="ev-label">Test cases</span><span class="ev-empty">None yet. Nothing here says what would demonstrate this claim, so nobody can tell whether the product keeps it.</span></div>`;
  }
  const caseBlocks = cases.map((tc) => {
    const run = runs[String(tc.id)];
    const statusBadge = (() => {
      if (tc.deprecated) return `<span class="tc-status ev-skip">deprecated</span>`;
      // ⛔ "No result yet" on all 121 cases in a corpus left a reader unable to tell
      // which of two very different things was true: "either nothing has been run, or
      // results are not wired up — and I cannot tell which, which means I cannot tell
      // whether 'built' means anything." The answer is knowable here: a case with a
      // coverage_ref has a test somebody wrote and no run recorded; one without has
      // nothing to run.
      if (!run)
        return tc.coverage_ref
          ? `<span class="tc-status ev-pending" title="A test exists for this case and no run has been recorded against it — nothing has reported back.">test exists, never reported</span>`
          : `<span class="tc-status ev-pending" title="No test has been written for this case yet, so there is nothing to run.">no test written</span>`;
      const cls = run.status === "pass" ? "ev-pass" : run.status === "fail" || run.status === "error" ? "ev-fail" : "ev-skip";
      const when = String(run.last_run_at).slice(0, 19).replace("T", " ");
      return `<span class="tc-status ${cls}">${run.status}</span> <code class="tc-when">${when}</code>`;
    })();
    const levelBadge = tc.level ? `<span class="tc-level">${tc.level}</span>` : "";
    const coverageLine = tc.coverage_ref ? `<div class="tc-coverage">↳ covered by <code>${escape(tc.coverage_ref)}</code></div>` : "";
    const detail = renderTestCaseDetail(tc);
    return `
      <div class="tc">
        <div class="tc-head">
          <span class="tc-id">case ${tc.id}</span>
          ${levelBadge}
          ${statusBadge}
        </div>
        <div class="tc-desc">${escape(tc.description)}</div>
        ${detail}
        ${coverageLine}
      </div>`;
  });
  return `<div class="ev-row"><span class="ev-label">Test cases</span><div class="tc-list">${caseBlocks.join("\n")}</div></div>`;
}

function renderTestCaseDetail(tc: Behavior["test_cases"][number]): string {
  const lines: string[] = [];
  if (tc.given) lines.push(`<div class="tc-line"><span class="tc-key">given</span>${escape(tc.given)}</div>`);
  if (tc.when) lines.push(`<div class="tc-line"><span class="tc-key">when</span>${escape(tc.when)}</div>`);
  if (tc.then) lines.push(`<div class="tc-line"><span class="tc-key">then</span>${escape(tc.then)}</div>`);
  if (lines.length === 0 && tc.steps) {
    lines.push(`<pre class="tc-steps">${escape(tc.steps.trim())}</pre>`);
  }
  return lines.length ? `<div class="tc-detail">${lines.join("")}</div>` : "";
}

function renderFeedbackForm(featureId: string, behaviorId?: string): string {
  return `
    <div class="feedback-form" data-feature="${escape(featureId)}"${behaviorId ? ` data-behavior="${escape(behaviorId)}"` : ""}>
      <textarea placeholder="What's wrong, missing, or unclear? Claude reads this queue and proposes edits."></textarea>
      <input type="hidden" name="action" value="feedback" />
      <div class="row">
        <button class="primary" data-action="feedback-submit" data-feature="${escape(featureId)}"${behaviorId ? ` data-behavior="${escape(behaviorId)}"` : ""}>Submit</button>
        <button data-action="feedback-cancel">Cancel</button>
      </div>
    </div>
  `;
}

function renderFeedbackSection(featureId?: string, behaviorId?: string, title = "Feedback"): string {
  return `
    <section class="feedback-section">
      <h2>${escape(title)}</h2>
      <p style="color:var(--dim);font-size:13px;">Drop a note for Claude. It lands in <code>productos/feedback/</code> and gets processed in a later session.</p>
      <button data-action="feedback-toggle">💬 Leave feedback</button>
      ${renderFeedbackForm(featureId ?? "", behaviorId)}
    </section>
  `;
}

export function renderFeedbackQueue(entries: FeedbackEntry[]): string {
  if (entries.length === 0) {
    return `
      <header class="feature"><h1>Feedback queue</h1></header>
      <div class="empty-state">No feedback yet.</div>
    `;
  }
  const groups = new Map<string, FeedbackEntry[]>();
  for (const e of entries) {
    const arr = groups.get(e.frontmatter.state) ?? [];
    arr.push(e);
    groups.set(e.frontmatter.state, arr);
  }
  const sections: string[] = [];
  for (const state of ["open", "claimed", "processed"]) {
    const arr = groups.get(state);
    if (!arr || arr.length === 0) continue;
    sections.push(`<h2 style="text-transform:capitalize">${state} (${arr.length})</h2>`);
    for (const e of arr) {
      const target = e.frontmatter.target.feature
        ? `<code>${escape(e.frontmatter.target.feature)}${e.frontmatter.target.behavior ? "#" + escape(e.frontmatter.target.behavior) : ""}</code>`
        : `<span style="color:var(--dim)">(no target)</span>`;
      sections.push(`
        <article class="behavior">
          <div class="head">
            <span class="bid">${escape(e.frontmatter.id)}</span>
            <span class="status status-${e.frontmatter.state}">● ${e.frontmatter.state}</span>
            <span style="color:var(--dim);font-size:12px;margin-left:auto;">${escape(e.frontmatter.created_at)}</span>
          </div>
          <div class="claim">${escape(e.body)}</div>
          <div class="meta" style="margin-top:8px;">
            <span style="color:var(--dim);">target:</span> ${target}
            <span style="color:var(--dim);margin-left:12px;">by:</span> ${escape(e.frontmatter.created_by)}
            <span style="color:var(--dim);margin-left:12px;">source:</span> ${escape(e.frontmatter.source)}
          </div>
        </article>
      `);
    }
  }
  return `
    <header class="feature">
      <h1>Feedback queue</h1>
      <div class="meta"><span class="pill">${entries.length} total</span></div>
    </header>
    <article class="prose">
      <p>Open entries are waiting for Claude (or someone) to interpret them and propose edits to product truth or tracking. Once handled, they transition to <code>processed</code>.</p>
    </article>
    ${sections.join("\n")}
  `;
}

function escape(s: string | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
