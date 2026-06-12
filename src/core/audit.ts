import { FeatureDocument } from "./product.js";

/**
 * Deterministic feature audit. No LLM — pure pattern checks against the
 * Product Truth schema. Surfaces signals the skill / AI editor can then
 * help the user act on.
 *
 * Severities:
 *   - high: dangling refs, zero coverage on shipped features
 *   - medium: thin coverage, implementation-language in claims
 *   - low: missing optional metadata, naming polish
 */

export type AuditSeverity = "high" | "medium" | "low";

export interface AuditFinding {
  severity: AuditSeverity;
  kind: string;          // short tag: "thin-ux-coverage", "no-test-cases", etc.
  message: string;       // human-readable, one line
  feature_id: string;
  // Optional targeting hints — useful when the AI editor needs to act on the finding
  ux_id?: string;
  behavior_id?: string;
  element_id?: string;
}

const INTERACTIVE_KINDS = [
  "button", "input", "link", "cta", "select",
  "checkbox", "radio", "toggle", "stepper", "card", "row",
];

// Regex hits for implementation-leaning claim language.
const IMPL_LANGUAGE_PATTERNS = [
  /\bPOST\b|\bGET\b|\bPUT\b|\bDELETE\b|\bPATCH\b/,
  /\/api\//i,
  /HTTP\s*\d{3}/i,
  /\bstatus\s*(code\s*)?[34]\d\d\b/i,
  /\.tsx?\b|\.jsx?\b|\.py\b|\.go\b/,
  /\bfunction\s+\w+\(/,
  /\bclass\s+[A-Z]\w+/,
  /\bschema\b|\btable\b|\bcolumn\b/i,
];

// Behavior id smells: names a widget interaction rather than a rule.
const WIDGET_NAME_SUFFIX = /-(click|tap|button|press)$/;

// Feature-id smell: starts with an action verb, suggesting it's a sub-feature
// carved out of a noun-feature (e.g. "run-analysis" should probably be inside
// "risk-analysis"). When the feature also has few behaviors, that's the
// pre-decomposition pattern productos-scope explicitly warns against.
const ACTION_VERB_PREFIX = /^(run|trigger|view|show|see|get|create|delete|update|edit|add|remove|open|close|launch|start|stop|enable|disable|toggle)-/;

export function auditFeature(feature: FeatureDocument): AuditFinding[] {
  const fm = feature.frontmatter;
  const findings: AuditFinding[] = [];
  const featureId = fm.id;

  // Feature-level
  if (!fm.description || fm.description.trim().length === 0) {
    findings.push({
      severity: "low",
      kind: "no-description",
      message: "Feature has no description.",
      feature_id: featureId,
    });
  }
  if (fm.behaviors.length === 0) {
    findings.push({
      severity: "high",
      kind: "no-behaviors",
      message: `Feature has 0 behaviors${fm.status === "shipped" ? " (status: shipped)" : ""}.`,
      feature_id: featureId,
    });
  } else if (fm.status === "shipped") {
    const anyTests = fm.behaviors.some((b) => b.test_cases.length > 0);
    if (!anyTests) {
      findings.push({
        severity: "high",
        kind: "shipped-no-test-cases",
        message: "Feature is shipped but no behavior has any test cases.",
        feature_id: featureId,
      });
    }
  }
  // Pre-decomposition smell: feature id starts with an action verb
  // (run-, trigger-, view-, etc.) AND the feature itself is narrow
  // (≤ 4 behaviors AND ≤ 1 UX view). This is the exact pattern of an AI
  // carving a sub-feature out of a larger noun-feature instead of scoping
  // the whole thing. Suggest the parent noun.
  const slug = featureId.split("/").pop() ?? "";
  const verbMatch = slug.match(ACTION_VERB_PREFIX);
  if (verbMatch && fm.behaviors.length <= 4 && fm.ux.length <= 1) {
    const noun = slug.slice(verbMatch[0].length); // strip the "run-" prefix
    findings.push({
      severity: "medium",
      kind: "possibly-pre-decomposed",
      message: `Feature id "${featureId}" starts with the verb "${verbMatch[0].replace("-", "")}" and is narrow (${fm.behaviors.length} behavior${fm.behaviors.length === 1 ? "" : "s"}, ${fm.ux.length} UX view${fm.ux.length === 1 ? "" : "s"}). Was this scoped as a sub-feature when the parent "${noun}" should have been scoped whole?`,
      feature_id: featureId,
    });
  }

  // UX views
  const uxIds = new Set(fm.ux.map((u) => u.id));
  for (const u of fm.ux) {
    const anchored = fm.behaviors.filter((b) => b.surface === u.id);
    const interactive = u.elements.filter((e) =>
      INTERACTIVE_KINDS.some((k) => (e.kind || "").toLowerCase().includes(k))
    );
    if (interactive.length >= 2 && anchored.length <= 1) {
      findings.push({
        severity: "high",
        kind: "thin-ux-coverage",
        message: `UX view "${u.id}" has ${interactive.length} interactive elements but only ${anchored.length} behavior${anchored.length === 1 ? "" : "s"} anchored. Likely missing rules (validation, defaults, disabled-state, focus, error-paths).`,
        feature_id: featureId,
        ux_id: u.id,
      });
    }
    for (const el of u.elements) {
      const isNavLike = /button|link|cta|card|row/.test((el.kind || "").toLowerCase());
      if (isNavLike && !el.leads_to) {
        // Heuristic: only flag if the id reads navigational ("kid-card",
        // "view-detail", "open-X", "go-to-Y", or ends in -card/-row/-link)
        const nameSuggestsNav = /(card|row|link|button|cta|tab)$/.test(el.id) ||
          /^(view|open|go|see|show)-/.test(el.id);
        if (nameSuggestsNav) {
          findings.push({
            severity: "medium",
            kind: "missing-leads-to",
            message: `Element "${u.id}.${el.id}" looks navigational but has no leads_to.`,
            feature_id: featureId,
            ux_id: u.id,
            element_id: el.id,
          });
        }
      }
      if (!el.label && /button|link|cta|card|row|input/.test((el.kind || "").toLowerCase())) {
        findings.push({
          severity: "low",
          kind: "missing-label",
          message: `Element "${u.id}.${el.id}" has no label — flow chart shows the id as the action ("${el.id.replace(/-/g, " ")}").`,
          feature_id: featureId,
          ux_id: u.id,
          element_id: el.id,
        });
      }
    }
  }

  // Behaviors
  for (const b of fm.behaviors) {
    // Dangling surface anchor
    if (b.surface && !uxIds.has(b.surface)) {
      findings.push({
        severity: "high",
        kind: "dangling-surface-anchor",
        message: `Behavior "${b.id}" anchors to UX view "${b.surface}" which doesn't exist.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // Dangling element anchor
    if (b.surface && b.element) {
      const u = fm.ux.find((x) => x.id === b.surface);
      if (u && !u.elements.some((e) => e.id === b.element)) {
        findings.push({
          severity: "high",
          kind: "dangling-element-anchor",
          message: `Behavior "${b.id}" anchors to element "${b.element}" on "${b.surface}" — element doesn't exist there.`,
          feature_id: featureId,
          behavior_id: b.id,
        });
      }
    }
    // Test cases
    if (b.test_cases.length === 0 && !b.deprecated) {
      findings.push({
        severity: fm.status === "shipped" ? "high" : "medium",
        kind: "no-test-cases",
        message: `Behavior "${b.id}" has 0 test cases.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    } else if (b.test_cases.length === 1 && !b.deprecated) {
      findings.push({
        severity: "medium",
        kind: "happy-path-only",
        message: `Behavior "${b.id}" has only 1 test case (likely happy path). Add an error or edge case.`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
    // Implementation language in claim
    if (b.claim) {
      for (const re of IMPL_LANGUAGE_PATTERNS) {
        if (re.test(b.claim)) {
          findings.push({
            severity: "medium",
            kind: "impl-language",
            message: `Behavior "${b.id}" claim contains implementation language. Suggest rewriting in product terms.`,
            feature_id: featureId,
            behavior_id: b.id,
          });
          break;
        }
      }
    }
    // Widget-named id
    if (WIDGET_NAME_SUFFIX.test(b.id)) {
      findings.push({
        severity: "low",
        kind: "widget-named-behavior",
        message: `Behavior id "${b.id}" names a widget interaction rather than a rule. Suggest a rule-style id (e.g. "amount-must-be-positive" not "submit-button-click").`,
        feature_id: featureId,
        behavior_id: b.id,
      });
    }
  }

  // Stable order: by severity, then by kind.
  const sevRank = (s: AuditSeverity) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
  findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.kind.localeCompare(b.kind));
  return findings;
}

// ===========================================================================
// AREA ROLL-UP — aggregate findings across every feature in an area.
// ===========================================================================

export interface AreaAuditSummary {
  area_slug: string;
  feature_count: number;
  features: Array<{
    feature_id: string;
    title: string;
    counts: { high: number; medium: number; low: number; total: number };
  }>;
  totals: { high: number; medium: number; low: number; total: number };
}

export function auditArea(
  areaSlug: string,
  features: FeatureDocument[]
): AreaAuditSummary {
  const perFeature = features.map((f) => {
    const findings = auditFeature(f);
    const counts = {
      high: findings.filter((x) => x.severity === "high").length,
      medium: findings.filter((x) => x.severity === "medium").length,
      low: findings.filter((x) => x.severity === "low").length,
      total: findings.length,
    };
    return {
      feature_id: f.frontmatter.id,
      title: f.frontmatter.title,
      counts,
    };
  });
  perFeature.sort((a, b) => b.counts.high - a.counts.high || b.counts.total - a.counts.total);
  const totals = perFeature.reduce(
    (acc, x) => ({
      high: acc.high + x.counts.high,
      medium: acc.medium + x.counts.medium,
      low: acc.low + x.counts.low,
      total: acc.total + x.counts.total,
    }),
    { high: 0, medium: 0, low: 0, total: 0 }
  );
  return {
    area_slug: areaSlug,
    feature_count: features.length,
    features: perFeature,
    totals,
  };
}

export function renderAreaAuditAscii(summary: AreaAuditSummary): string {
  if (summary.feature_count === 0) return "  (no features in this area)";
  if (summary.totals.total === 0) return "  (no issues across this area — looks clean)";
  const lines: string[] = [];
  lines.push(
    `  Totals: ${summary.totals.high} high, ${summary.totals.medium} medium, ${summary.totals.low} low across ${summary.feature_count} feature${summary.feature_count === 1 ? "" : "s"}.`
  );
  lines.push("");
  for (const f of summary.features) {
    if (f.counts.total === 0) continue;
    const tag = `H:${f.counts.high} M:${f.counts.medium} L:${f.counts.low}`;
    lines.push(`    ${f.feature_id.padEnd(30, " ")}  ${tag}`);
  }
  return lines.join("\n");
}

export function renderAuditAscii(findings: AuditFinding[]): string {
  if (findings.length === 0) return "  (no issues — looks clean)";
  const groups: Record<AuditSeverity, AuditFinding[]> = { high: [], medium: [], low: [] };
  for (const f of findings) groups[f.severity].push(f);

  const lines: string[] = [];
  let n = 1;
  for (const sev of ["high", "medium", "low"] as AuditSeverity[]) {
    if (groups[sev].length === 0) continue;
    lines.push(`  ${sev.toUpperCase()}:`);
    for (const f of groups[sev]) {
      lines.push(`    ${String(n).padStart(2, " ")}. ${f.message}`);
      n++;
    }
  }
  return lines.join("\n");
}
