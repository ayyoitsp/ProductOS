/**
 * Duplicate detection.
 *
 * Non-redundancy is the primary lever on review burden: if nothing is restated,
 * review cost tracks new information rather than corpus size. Conflict detection
 * therefore has two modes — contradiction AND duplication — and this is the
 * second (OVERVIEW.md §Non-redundancy).
 *
 * Also the structural answer to the observed agent failure mode: given append
 * semantics, a model that re-proposes existing content silently creates
 * duplicates. Here it gets rejected with the id of what already exists.
 *
 * Trigram Jaccard over normalized text. No embeddings — deterministic, cheap,
 * no model dependency, and good enough to catch restatement. It will not catch
 * semantic duplicates phrased entirely differently; that's a known gap.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "and", "or", "but", "if", "then", "than", "when", "while", "of", "to",
  "in", "on", "at", "for", "with", "by", "from", "that", "this", "it",
  "its", "as", "will", "shall", "should", "must", "can", "may",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .join(" ");
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** 0 = unrelated, 1 = identical after normalization. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = trigrams(na);
  const tb = trigrams(nb);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Default threshold. Deliberately conservative — a false rejection is a visible
 * annoyance the author immediately corrects, while a false accept silently
 * grows the corpus, which is the failure that compounds.
 *
 * Tuning this against a real corpus is tracked as open (ARCHITECTURE.md §10).
 */
export const DUPLICATE_THRESHOLD = 0.72;

export interface DuplicateMatch {
  containerId: string;
  behaviorId: string;
  claim: string;
  score: number;
}

export function findDuplicates(
  claim: string,
  existing: Array<{ containerId: string; behaviorId: string; claim: string }>,
  threshold = DUPLICATE_THRESHOLD,
): DuplicateMatch[] {
  return existing
    .map((e) => ({ ...e, score: similarity(claim, e.claim) }))
    .filter((e) => e.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
