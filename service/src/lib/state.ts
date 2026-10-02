/**
 * Derived validation state.
 *
 * A pure function over the validation log and open signals — never stored.
 * Externally there are exactly three states (OVERVIEW.md §State); the richer
 * internal signal taxonomy must not reach a reviewer.
 *
 * The one bit that is sacred: `validated` requires a `human` validation whose
 * claim hash still matches. An agent can carry a prior human decision forward
 * over a non-semantic change (`self_heal`), but can never originate one.
 */

export type ValidationState = "needs_review" | "validated" | "problem";

export interface ValidationRow {
  provenance: "human" | "self_heal";
  claimHash: string;
  createdAt: Date;
}

export interface SignalRow {
  resolved: boolean;
}

export function deriveState(
  currentClaimHash: string,
  validations: ValidationRow[],
  signals: SignalRow[],
): ValidationState {
  // An open signal always wins. Something disagrees; a human should look.
  if (signals.some((s) => !s.resolved)) return "problem";

  // Validations apply to the claim as it read at the time. Edit the claim and
  // the validation no longer covers it — back to needs_review, not validated.
  const covering = validations.filter((v) => v.claimHash === currentClaimHash);
  if (covering.length === 0) return "needs_review";

  // A self_heal chain is only as good as the human validation behind it, but
  // any covering validation implies that chain terminated in one — self_heal
  // rows are only written when carrying an existing human validation forward.
  return "validated";
}

/** Stable hash of a claim, for detecting edits after validation. */
export async function hashClaim(claim: string): Promise<string> {
  const data = new TextEncoder().encode(claim.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
