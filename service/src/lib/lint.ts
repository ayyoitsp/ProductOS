/**
 * Claim linter — mechanical enforcement of the implementation boundary.
 *
 * The observability rule says a claim states what a promisee can observe, never
 * the mechanism. That rule is easy to state and hard to hold: a Thoughtworks
 * distinguished engineer reported losing the functional/technical thread while
 * using a mature spec tool. So it is checked, not trusted.
 *
 * This is deliberately crude. It catches the common leaks — paths, verbs, status
 * codes, code identifiers — and misses subtle ones. Crude and mechanical beats
 * precise and advisory, because advisory rules are the ones that get ignored
 * (ARCHITECTURE.md §4).
 */

export interface LintFinding {
  severity: "error" | "warning";
  rule: string;
  message: string;
  match: string;
}

interface Rule {
  name: string;
  severity: "error" | "warning";
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    name: "file-path",
    severity: "error",
    pattern: /\b[\w./-]+\.(ts|tsx|js|jsx|py|java|go|rb|rs|php|cs|sql|yaml|yml|json)\b/i,
    message: "Names a source file. Truth describes behavior, not where it lives.",
  },
  {
    name: "path-segment",
    severity: "error",
    pattern: /(^|\s)(\.?\/)?(src|lib|app|api|pkg|internal)\/[\w/-]+/i,
    message: "Names a code path.",
  },
  {
    name: "http-method",
    severity: "error",
    pattern: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[\w{}/:.-]*/,
    message: "Names an HTTP endpoint. That's an interface contract, not a product claim.",
  },
  {
    name: "status-code",
    severity: "error",
    pattern: /\b(returns?|responds?\s+with|status(?:\s+code)?(?:\s+of)?)\s+(?:an?\s+)?[1-5]\d\d\b/i,
    message: "Names an HTTP status code. State what the user or consumer observes instead.",
  },
  {
    name: "sql",
    severity: "error",
    pattern: /\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|JOIN)\b/i,
    message: "Contains SQL. That's storage, not behavior.",
  },
  {
    name: "code-identifier",
    severity: "error",
    pattern: /`[^`]+`|\b\w+\(\)|\b[a-z]\w*\.[a-z]\w*\(/,
    message: "Contains a code identifier or call. Describe the effect, not the function.",
  },
  {
    name: "infrastructure-noun",
    severity: "warning",
    pattern:
      /\b(microservice|message queue|redis|kafka|s3 bucket|lambda|cron job|worker pool|load balancer|cache layer|database table|foreign key)\b/i,
    message: "Names infrastructure. Usually a sign the claim describes a thing, not a promise.",
  },
  {
    name: "system-actor",
    severity: "warning",
    pattern: /\bthe (system|service|server|backend|api)\s+(shall|will|must|should)\b/i,
    message:
      "Frames a system as the actor. Prefer the feature or capability by name — 'the system' invites implementation thinking.",
  },
];

export function lintClaim(claim: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const rule of RULES) {
    const m = claim.match(rule.pattern);
    if (m) {
      findings.push({
        severity: rule.severity,
        rule: rule.name,
        message: rule.message,
        match: m[0].trim(),
      });
    }
  }
  return findings;
}

export function hasBlockingFindings(findings: LintFinding[]): boolean {
  return findings.some((f) => f.severity === "error");
}
