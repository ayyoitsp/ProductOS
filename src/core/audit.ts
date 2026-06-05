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
