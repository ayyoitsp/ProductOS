/**
 * Grouping advice — is this tree readable?
 *
 * ⛔ Unbounded nesting without this is a regression, not a feature. Once areas can
 * nest freely, nothing stops a corpus from becoming one bag of forty features or a
 * six-deep chain of single-child groups, and both are less readable than the fixed
 * two levels they replaced. Depth is only worth having if something says where the
 * joints should be.
 *
 * What this is NOT: a score. Every output names a specific group, says what is wrong
 * with its size, and — for a split — proposes the actual clusters, so the answer is
 * always an edit somebody can accept or reject rather than a number to improve.
 *
 * The clustering signal is deliberately structural: shared navigation, shared
 * dependencies, shared vocabulary. A proposal is never asserted to be right — a
 * cluster with no obvious name is reported as needing one, because a group whose
 * name is a guess is exactly the failure mode `check` refuses elsewhere.
 */
import { FeatureDocument, GroupDocument, ProductDocument, groupFeatures, walkGroups } from "./product.js";

/** What a readable group looks like. Configurable; these are the defaults. */
export interface SizeTargets {
  /** Fewer than this in a group that has siblings — it is a name, not a grouping. */
  group_min: number;
  /** The comfortable ceiling. Past it, propose sub-areas. */
  group_max: number;
  /** Past this, a feature is probably two features. */
  behaviors_max: number;
}

export const DEFAULT_SIZE_TARGETS: SizeTargets = {
  group_min: 2,
  group_max: 8,
  behaviors_max: 24,
};

export type AdviceKind =
  | "split-area"
  | "thin-area"
  | "pass-through-area"
  | "loose-features"
  | "oversized-feature"
  | "feature-is-an-area"
  | "lopsided-product"
  | "thin-capability-layer"
  | "unwired-feature";

export interface GroupingAdvice {
  kind: AdviceKind;
  /** The group or feature id the advice is about. */
  where: string;
  what: string;
  /** Why the shape is a problem, in one line. */
  rule: string;
  /** For `split-area`, the proposed sub-areas; for `feature-is-an-area`, the candidate features. */
  clusters?: ProposedCluster[];
  /** The `productos move` invocations that would carry it out. */
  moves?: string[];
}

export interface ProposedCluster {
  /** A slug derived from what the members share — `null` when nothing named them. */
  slug: string | null;
  /** Why these are together. */
  because: string;
  members: string[];
}

// ---------------------------------------------------------------------------
// Clustering

/** Grammar, not vocabulary — safe to drop in any corpus. */
const STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "for", "and", "or", "with", "in", "on", "at", "by",
  "from", "into", "per", "this", "that", "is", "are", "be", "as", "its", "it",
]);

function rawTokens(f: FeatureDocument): string[] {
  const raw = `${f.frontmatter.id.split("/").pop()} ${f.frontmatter.title}`.toLowerCase();
  return [
    ...new Set(
      raw
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
        .map((w) => (w.endsWith("s") && w.length > 4 ? w.slice(0, -1) : w))
    ),
  ];
}

/**
 * Words that name nothing **in this set**, derived rather than listed.
 *
 * ⛔ An earlier version hardcoded "deal", "user" and "page" as filler. That is a
 * guess about one corpus: `deal` is noise in a CRE product and the entire subject in
 * a deal-desk one. A token carried by most of the siblings cannot distinguish any of
 * them, whatever the word is — so the set computes its own filler and stays correct
 * in a corpus nobody here has seen.
 */
function uninformative(features: FeatureDocument[]): Set<string> {
  const freq = new Map<string, number>();
  for (const f of features) for (const w of rawTokens(f)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const ceiling = Math.max(2, Math.ceil(features.length * 0.5));
  return new Set([...freq].filter(([, n]) => n >= ceiling).map(([w]) => w));
}

function tokens(f: FeatureDocument, filler: Set<string> = new Set()): Set<string> {
  return new Set(rawTokens(f).filter((w) => !filler.has(w)));
}

/** Surfaces a feature declares, plus everything its elements navigate to. */
function navEdges(f: FeatureDocument): Set<string> {
  const out = new Set<string>();
  for (const v of f.frontmatter.ux) {
    out.add(`${f.frontmatter.id}#${v.id}`);
    for (const el of v.elements ?? []) {
      if (!el.leads_to) continue;
      const target = el.leads_to.includes("/")
        ? el.leads_to.split("#")[0]!
        : `${f.frontmatter.id}#${el.leads_to}`;
      out.add(target);
    }
  }
  return out;
}

function affinity(
  a: FeatureDocument,
  b: FeatureDocument,
  filler: Set<string>
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Navigation: one screen leading to another is the strongest signal that two
  // features are one concern, because it is the user's own path between them.
  const aNav = navEdges(a);
  const bNav = navEdges(b);
  const linked =
    [...aNav].some((e) => e.startsWith(b.frontmatter.id)) ||
    [...bNav].some((e) => e.startsWith(a.frontmatter.id));
  if (linked) {
    score += 3;
    reasons.push("one navigates to the other");
  }

  const aDeps = new Set(a.frontmatter.depends_on);
  const shared = b.frontmatter.depends_on.filter((d) => aDeps.has(d));
  if (shared.length) {
    score += shared.length;
    reasons.push(`both depend on ${shared.join(", ")}`);
  }

  const aAff = new Set(a.frontmatter.affected_by ?? []);
  if (
    aAff.has(b.frontmatter.id) ||
    (b.frontmatter.affected_by ?? []).includes(a.frontmatter.id)
  ) {
    score += 2;
    reasons.push("one changes the other's state");
  }

  const aTok = tokens(a, filler);
  const overlap = [...tokens(b, filler)].filter((w) => aTok.has(w));
  if (overlap.length) {
    score += overlap.length;
    reasons.push(`both about "${overlap.sort().join('", "')}"`);
  }

  return { score, reasons };
}

/**
 * Connected components over the affinity graph, at a threshold.
 *
 * Union-find rather than k-means: the question is not "cut this into N parts" but
 * "which of these actually belong together", and features with no affinity to
 * anything must be allowed to come out alone rather than be assigned somewhere.
 */
export function clusterFeatures(
  features: FeatureDocument[],
  threshold = 2
): ProposedCluster[] {
  const ids = features.map((f) => f.frontmatter.id);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const filler = uninformative(features);
  const why = new Map<string, Set<string>>();
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const { score, reasons } = affinity(features[i]!, features[j]!, filler);
      if (score < threshold) continue;
      const a = find(features[i]!.frontmatter.id);
      const b = find(features[j]!.frontmatter.id);
      if (a !== b) parent.set(a, b);
      const root = find(a);
      // A set, because "one navigates to the other" holds for three of four pairs and
      // saying it three times reads as three findings.
      const bucket = why.get(root) ?? new Set<string>();
      reasons.forEach((r) => bucket.add(r));
      why.set(root, bucket);
    }
  }

  const byRoot = new Map<string, FeatureDocument[]>();
  for (const f of features) {
    const r = find(f.frontmatter.id);
    byRoot.set(r, [...(byRoot.get(r) ?? []), f]);
  }

  const out: ProposedCluster[] = [];
  for (const [root, members] of byRoot) {
    const reasons = new Set<string>();
    for (const [k, v] of why) if (find(k) === find(root)) v.forEach((x) => reasons.add(x));
    out.push({
      slug: members.length === 1 ? null : clusterSlug(members, filler),
      because:
        members.length === 1
          ? "shares nothing structural with the rest — leave it where it is"
          : [...reasons].filter(Boolean).slice(0, 3).join("; "),
      members: members.map((m) => m.frontmatter.id).sort(),
    });
  }
  return out.sort((a, b) => b.members.length - a.members.length);
}

/**
 * The word every member shares, if there is one.
 *
 * Returns `null` rather than inventing a name. A group called `group-2` or named
 * after whichever feature sorted first is worse than an unnamed proposal, because
 * it looks decided.
 */
function clusterSlug(members: FeatureDocument[], filler: Set<string>): string | null {
  if (members.length < 2) return null;
  const sets = members.map((m) => tokens(m, filler));
  const common = [...sets[0]!].filter((w) => sets.every((s) => s.has(w)));
  if (common.length === 0) return null;
  return common.sort((a, b) => b.length - a.length)[0]!;
}

// ---------------------------------------------------------------------------
// Advice

export function groupingAdvice(
  products: ProductDocument[],
  targets: SizeTargets = DEFAULT_SIZE_TARGETS,
  /** The capability tree, so the two halves can be compared against each other. */
  allCapabilities: FeatureDocument[] = []
): GroupingAdvice[] {
  const out: GroupingAdvice[] = [];
  const allFeatures = products.flatMap((p) => p.areas.flatMap((a) => a.features));

  for (const product of products) {
    if (product.features.length) {
      out.push({
        kind: "loose-features",
        where: product.slug,
        what: `${product.features.length} feature${
          product.features.length === 1 ? " sits" : "s sit"
        } directly in "${product.slug}" with no area`,
        rule: "a feature lives in an area, so the product page reads as concerns rather than a list",
        moves: product.features.map(
          (f) => `productos move ${f.frontmatter.id} ${product.slug}/<area>`
        ),
      });
    }

    // ⛔ Size advice needs a corpus big enough for size to mean anything. In a product
    // with fewer features than a single area's ceiling, every area is legitimately
    // small and "move it up or grow it" has nowhere to point — the advice fires on
    // every new corpus and trains people to ignore the whole section.
    const productTotal = product.areas.reduce((n, a) => n + a.features.length, 0);
    const worthRegrouping = productTotal > targets.group_max;
    walkGroups(product.groups, (g) => {
      advise(g, targets, out, worthRegrouping);
    });
  }

  // ⛔ THE CAPABILITY LAYER, MEASURED. The two trees were each checked against their own
  // ceilings and never against EACH OTHER, so a corpus could be all screens and nothing
  // underneath while every individual page passed.
  //
  // Peter: "there's no capabilities around document processing, upload, etc. how could
  // this possibly work? the capabilities are SO thin." The corpus was 111 behaviours of
  // screen against 35 of machinery, in a product whose own overview says the real work
  // happens underneath.
  //
  // The framework causes this. A feature has screens, sketches, elements and a route to
  // find it by; a capability has none of those, and the scan skills say outright that
  // capabilities are "the easiest thing to miss in a fullscan, because there is no route
  // to find them by". A model that makes one tree easy to populate and the other
  // laborious gets corpora shaped like that, and calling it an authoring failure every
  // time is how it stays that way.
  const featureBehaviors = allFeatures.reduce((n, f) => n + f.frontmatter.behaviors.length, 0);
  const capabilityBehaviors = allCapabilities.reduce(
    (n, c) => n + c.frontmatter.behaviors.length,
    0
  );
  if (featureBehaviors >= 40) {
    const share = capabilityBehaviors / (featureBehaviors + capabilityBehaviors);
    if (share < 0.3) {
      out.push({
        kind: "thin-capability-layer",
        where: "capabilities",
        what: `${capabilityBehaviors} behaviors of machinery against ${featureBehaviors} of screen — ${Math.round(
          share * 100
        )}% of this corpus is what the product does underneath`,
        rule: "screens are easy to find and subsystems are not, so a corpus drifts this way unless somebody goes looking — the machinery is where the hard failures live, and it is the half an agent cannot infer from a route",
      });
    }
  }

  // ⛔ A feature with real weight and nothing declared beneath it. Either it genuinely
  // does everything itself — rare, and worth saying out loud — or nobody traced it, and
  // the capability it rests on does not exist yet. A reader cannot tell which, and that
  // ambiguity is the one the model is supposed to keep separable.
  for (const f of allFeatures) {
    const n = f.frontmatter.behaviors.length;
    if (n < 8) continue;
    if ((f.frontmatter.depends_on ?? []).length > 0) continue;
    if ((f.frontmatter.suspected_depends_on ?? []).length > 0) continue;
    out.push({
      kind: "unwired-feature",
      where: f.frontmatter.id,
      what: `"${f.frontmatter.id}" has ${n} behaviors and depends on nothing`,
      rule: "a feature this size that rests on no capability is either genuinely self-contained — say so — or the machinery under it has no owner yet",
    });
  }

  return out;
}

function advise(
  g: GroupDocument,
  targets: SizeTargets,
  out: GroupingAdvice[],
  worthRegrouping: boolean
): void {
  const direct = g.features;

  // A group holding only one child group adds a level and separates nothing.
  if (g.groups.length === 1 && direct.length === 0) {
    const child = g.groups[0]!;
    out.push({
      kind: "pass-through-area",
      where: g.id,
      what: `"${g.id}" contains only "${child.slug}"`,
      rule: "a level that separates nothing is a level to collapse",
      moves: [`productos move ${child.id} ${g.segments.slice(0, -1).join("/")}`],
    });
  }

  if (direct.length > targets.group_max) {
    const clusters = clusterFeatures(direct);
    const splittable = clusters.filter((c) => c.members.length > 1);
    out.push({
      kind: "split-area",
      where: g.id,
      what: `"${g.id}" holds ${direct.length} features (target ${targets.group_max})`,
      rule: "past the target nobody reads the list; the area is hiding sub-areas",
      clusters,
      moves: splittable.flatMap((c) =>
        c.members.map((m) => `productos move ${m} ${g.id}/${c.slug ?? "<name-this>"}`)
      ),
    });
  }

  if (
    worthRegrouping &&
    direct.length > 0 &&
    direct.length < targets.group_min &&
    g.groups.length === 0 &&
    g.depth > 1
  ) {
    out.push({
      kind: "thin-area",
      where: g.id,
      what: `"${g.id}" holds ${direct.length} feature${direct.length === 1 ? "" : "s"}`,
      rule: "a grouping of one is a name, not a grouping — move it up or grow it",
      moves: direct.map(
        (f) => `productos move ${f.frontmatter.id} ${g.segments.slice(0, -1).join("/")}`
      ),
    });
  }

  // ⛔ Direct members only. Walking all descendants reports a feature once for its own
  // area and again for every ancestor above it, so a nested corpus prints the same
  // finding three times and the count stops meaning anything.
  // ⛔ A FEATURE THAT IS AN AREA'S WORTH OF WORK. The two size checks were blind to this
  // between them: an area is measured by how many FEATURES it holds, and a feature by how
  // many BEHAVIORS. So an area holding two features of twenty behaviours each passed both
  // — two is under the area ceiling, twenty is under the behaviour ceiling — while being
  // the heaviest thing in the product.
  //
  // Peter: "operating statement and rent roll are HUGE features - why did they not get
  // their own feature area?" They were 20 and 19 behaviours, 18 and 17 elements, in a
  // two-feature area, and nothing said a word.
  //
  // The signal is mass relative to the area, not an absolute: a feature carrying most of
  // its area's weight, with several screens and an area's worth of interface, is an area
  // whose parts have not been named.
  const areaTotal = direct.reduce((n, f) => n + f.frontmatter.behaviors.length, 0);
  for (const f of direct) {
    const n = f.frontmatter.behaviors.length;
    const screens = (f.frontmatter.ux ?? []).length;
    const els = (f.frontmatter.ux ?? []).reduce((m, u) => m + (u.elements ?? []).length, 0);
    const dominant = areaTotal > 0 && n / areaTotal >= 0.4;
    if (n >= 15 && els >= 12 && screens >= 2 && dominant) {
      out.push({
        kind: "feature-is-an-area",
        where: f.frontmatter.id,
        what: `"${f.frontmatter.id}" carries ${n} behaviors, ${screens} screens and ${els} elements — ${Math.round(
          (n / areaTotal) * 100
        )}% of its area`,
        rule: "a feature with an area's worth of interface is an area whose features have not been named — split it, and let each screen be the feature it is",
        // ⛔ Not a `move`. Turning a feature into an area is not re-filing it — it is
        // naming the features inside it, which only a person who understands the product
        // can do. The screens are the candidates, so name them.
        clusters: (f.frontmatter.ux ?? [])
          .filter((u) => !u.stub)
          .map((u) => ({
            slug: u.id,
            because: `${
              f.frontmatter.behaviors.filter((b) => b.surface === u.id).length
            } behaviors anchor here — a candidate feature`,
            members: [],
          })),
      });
    }
  }

  for (const f of direct) {
    const n = f.frontmatter.behaviors.length;
    if (n > targets.behaviors_max) {
      out.push({
        kind: "oversized-feature",
        where: f.frontmatter.id,
        what: `"${f.frontmatter.id}" carries ${n} behaviors (target ${targets.behaviors_max})`,
        rule: "a feature this large is usually two, and nobody reviews it in one sitting",
      });
    }
  }
}
