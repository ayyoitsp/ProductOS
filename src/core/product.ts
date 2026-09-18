import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { ProductosPaths } from "./paths.js";

/**
 * Product Truth lives in productos/products/<area>/<feature>.md.
 * It is implementation-neutral: claims are written in product language,
 * not in API/endpoint/file terms.
 *
 * Operational metadata (which files implement the feature, which code
 * lines back which behavior, who last verified what) lives in a sidecar
 * at productos/tracking/<area>/<feature>.yaml — see tracking.ts.
 *
 * The two files are linked by feature_id and behavior id. Together they
 * compose what an operator sees on the rendered site, but they are
 * editable independently:
 *
 *   - Product truth changes are documentation changes (PR reviewed for
 *     correctness of the claim).
 *   - Tracking changes are operational (verification stamps, code-ref
 *     refresh, history); high-traffic but lower-stakes.
 */

/**
 * YAML parses an unquoted ISO timestamp into a Date, so a stamp written by
 * `productos verify` reads back as a Date while a hand-written one reads back
 * as a string. Accept both.
 *
 * ⛔ This is not cosmetic. With `z.string()` here, verifying a behavior made its
 * feature page return a 500 — the CLI wrote a corpus the renderer could not
 * read. Any date that round-trips through YAML needs this.
 */
function dateLike() {
  return z
    .union([z.string(), z.date()])
    .transform((v) => (v instanceof Date ? v.toISOString() : v));
}

/**
 * Is it built? Orthogonal to validation.
 *
 * `built` rather than `shipped` because code can exist without being released,
 * and `retired` rather than `deprecated` because the latter is borrowed from
 * code. `planned` is where generation lives — truth written before the code.
 *
 * The old words are accepted on read so existing corpora keep loading, and
 * normalised to the new ones. Nothing writes them.
 */
export const FeatureStatus = z.preprocess(
  (v) => (v === "shipped" ? "built" : v === "deprecated" ? "retired" : v),
  z.enum(["planned", "built", "retired"])
);
export type FeatureStatus = z.infer<typeof FeatureStatus>;

/**
 * An interactive element within a Surface (button, input, link, etc.).
 * `kind` is freeform but conventional values are documented in the skill prompt.
 */
export const Element = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Element ids must be kebab-case"),
  kind: z.string().min(1),
  label: z.string().optional(),
  notes: z.string().optional(),
  /**
   * If this element navigates the user to another Surface, name it here.
   * Can be a Surface.id within the same feature (e.g. "checkout-page") or a
   * full feature id (e.g. "wallet/transactions") for cross-feature jumps.
   * The renderer wraps this element's label in the sketch as a clickable
   * link to the target.
   */
  leads_to: z.string().optional(),
});
export type Element = z.infer<typeof Element>;

/**
 * A UX view within a Feature — a screen, modal, drawer, section, or any
 * other piece of user interface that has its own identity. Carries an
 * ASCII `sketch` for rough visual reference (NOT pixel-perfect — just
 * enough to show layout + interactions) and a list of named elements.
 *
 * Behaviors anchor to a UxView (and optionally an Element + interaction)
 * via the `surface` / `element` / `interaction` fields on Behavior.
 * (`surface` is the legacy field name on Behavior; kept for backward
 * compatibility — the new word is "UX".)
 *
 * Internal type name stays UxView; YAML key on Feature is `ux` (with
 * `surfaces` accepted as a legacy alias).
 */
export const UxView = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "UX ids must be kebab-case"),
  title: z.string().min(1),
  /**
   * Declared but not scoped — the screen is real and nobody has walked it yet.
   *
   * ⛔ This exists so an unscoped screen has a HOME instead of being invisible.
   * Without it, behaviors about a screen you haven't scoped are homeless, and
   * they end up filed on whatever container is nearest — which is how an Excel
   * add-in's task pane ended up documented as a capability.
   *
   * A stub is honest about being incomplete: it needs no sketch and no
   * elements, behaviors may anchor to it, and it is reported as known-but-
   * unscoped rather than counted as coverage. A feature holding one is not
   * ready to build, because a screen nobody has walked has unknown behavior.
   *
   * ⛔ NOT a shortcut for "I don't feel like sketching this." The distinction
   * is whether you have walked the screen. If you have, sketch it.
   */
  stub: z.boolean().optional(),
  /**
   * Whether this screen exists yet, independent of the feature around it.
   *
   * ⛔ THE FIELD THAT ANSWERS "WHAT IS THE STATE OF THIS WORK" WAS A CONSTANT. `status`
   * lived only on the container, and a reviewer found every one of eighteen containers
   * stamped `built`:
   *
   *   "Three screens are unbuilt and the only machine-readable trace is an audit note
   *    filed under 'problems with how this page is written' — i.e. the fact that a
   *    screen does not exist is classified as a documentation defect. A surface cannot
   *    be `planned`. So the field that exists to answer 'what is the state of this
   *    work' is, across this entire corpus, a constant. The actual unbuilt work is
   *    three surfaces inside a `built` feature, expressed as English inside the
   *    surface's description."
   *
   * Defaults to the feature's own status when absent, so nothing has to be restated —
   * set it only where a screen differs from the feature it sits in.
   */
  status: FeatureStatus.optional(),
  /**
   * Where this screen runs, when it isn't the app the code lives in — an
   * add-in, a task pane, a mobile app, an emailed view.
   *
   * Recorded because "I found no route for it" is the single most common reason
   * a screen gets misfiled as a capability: a surface in another runtime has no
   * component in the repo you are reading, and is still a surface.
   */
  runtime: z.string().optional(),
  path: z.string().optional(),
  /** ASCII art layout. Always written by the AI when scoping. Used as the
   *  reader-friendly view in CLI / Claude and as the fallback in the web
   *  renderer when sketch_html isn't present. */
  sketch: z.string().optional(),
  /** Optional raw-HTML version of the sketch. When present, the web renderer
   *  uses this INSTEAD of decorating the ASCII sketch — so the UX preview
   *  picks up the user's actual CSS (configured via productos/config.yaml
   *  web.stylesheet) and looks like a real mock of the screen. The AI editor
   *  can generate this from the ASCII sketch + the user's CSS class names. */
  sketch_html: z.string().optional(),
  notes: z.string().optional(),
  elements: z.array(Element).default([]),
});
export type UxView = z.infer<typeof UxView>;
/** Legacy alias — same shape, kept so existing imports keep working. */
export const Surface = UxView;
export type Surface = UxView;

export const TestCaseLevel = z.enum(["unit", "integration", "api", "e2e"]);
export type TestCaseLevel = z.infer<typeof TestCaseLevel>;

export const TestCase = z.object({
  id: z.number().int().positive(),
  description: z.string().min(3),
  given: z.string().optional(),
  when: z.string().optional(),
  then: z.string().optional(),
  steps: z.string().optional(),
  /** Which testing layer this case is best run at. Drives template choice in the scaffolder. */
  level: TestCaseLevel.optional(),
  /** Free-form hint about the harness shape (e.g. "supertest", "playwright-webServer"). */
  harness_hint: z.string().optional(),
  /** Pointer to an existing test that already covers this case (file path or file:line). Set by `productos test align`. */
  coverage_ref: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecated_reason: z.string().optional(),
  replaced_by: z.number().int().positive().optional(),
});
export type TestCase = z.infer<typeof TestCase>;

const BehaviorShape = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Behavior ids must be kebab-case"),
  /**
   * What the product does, as one falsifiable sentence.
   *
   * Empty only on an UNDEFINED behavior — one we know exists but have not yet
   * decided the content of. Those carry `question` instead. Defaulted rather
   * than optional so every reader can treat this as a string.
   */
  claim: z.string().default(""),
  /**
   * What we have not decided yet.
   *
   * ⛔ A behavior with a question has NO claim, and that is the whole point.
   * An agent handed an ambiguous claim does not stop — it guesses, and the
   * guess is indistinguishable from a decision. A behavior that says "this
   * is undecided" cannot be built from by accident.
   *
   * ⛔ If you have a claim AND a nagging question about some edge of it, the
   * question is its OWN undefined behavior. One claim per behavior, one
   * question per behavior, never both on the same id — otherwise the state
   * cannot be derived unambiguously and "is this decided?" has two answers.
   *
   * The id is the same id the claim will eventually carry. Answering the
   * question fills in `claim` in place, so the transition
   * undefined → unverified → verified happens on one stable id, and the
   * history shows that the ambiguity existed.
   */
  question: z.string().min(10).optional(),
  /**
   * Who owes the answer to `question`.
   *
   * ⛔ A field rather than prose, because it was already being written as prose —
   * `notes: Settled by an underwriter.` — which means it cannot be listed, counted,
   * or chased. The same sentence in `notes` is unparseable, and a question nobody is
   * named on is a question nobody answers.
   */
  asked_of: z.string().optional(),
  /**
   * When the question was raised.
   *
   * ⛔ A reader could not tell a question raised yesterday from one open for a year:
   * "I cannot tell whether it was raised yesterday or has been open for a year, or
   * whether anyone ever asked the customer." An undecided behavior with no age looks
   * equally fresh forever, so nothing ever feels overdue.
   */
  asked_at: dateLike().optional(),
  /**
   * What cannot be built until this question is answered — behavior ids in this
   * container, or `<container-id>#<behavior-id>` elsewhere.
   *
   * ⛔ The site flagged every question as blocking and never said WHAT was blocked, so
   * a hard blocker and a nice-to-have rendered identically: "my brief says 'asked for a
   * human' for both, flattening a hard blocker and a nice-to-have into one word."
   *
   * An EMPTY list is meaningful and is rendered as such — "blocks nothing, can ship
   * without this" is exactly what a reader needs in order to proceed. Absent means
   * nobody has worked it out.
   */
  // ⛔ `optional()`, NOT `.default([])`, and the difference is the whole field. `blocks: []`
  // means "the rest can ship without this"; ABSENT means "nobody has worked out what this
  // blocks" — documented opposites, and a reader acts differently on each. `writeFeature`
  // serialises the parsed frontmatter, so the moment somebody adds a default here for
  // tidiness, every save silently converts "nobody looked" into "ships without it" across
  // the whole corpus, and nothing catches it. An architect flagged the fragility before it
  // fired: "the distinction currently survives by one word of schema."
  blocks: z.array(z.string()).optional(),
  /**
   * Another open question this one is the same hole as — `<container>#<behavior>`.
   *
   * ⛔ ONE MISSING THING APPEARING AS THREE UNRELATED QUESTIONS. A reader found three
   * features each carrying an undecided behavior, all of them the same absence:
   *
   *   "`who-may-enter-the-guide-column`, `who-may-acknowledge-an-exception`,
   *    `whether-the-approver-is-a-real-user` — these are one question. Answer 'roles
   *    exist and are enforced' once and all three close; answer it three times and you
   *    get three inconsistent checks. Every container on this site is a feature, an area
   *    or a capability, and this finding belongs to none of them. A queue entry is
   *    targeted at exactly one page, so filing it there would have made it look like a
   *    publish-pricing problem. I would have filed it three times and none of the copies
   *    would carry the observation that they are one thing."
   *
   * Declared on any one of them and rendered on all — the group is what a reader needs
   * to see, and which member declared it does not matter. Three questions that are one
   * question are one decision; answered separately they become three inconsistent
   * answers, which is worse than three open questions.
   */
  same_as: z.array(z.string()).default([]),
  /**
   * The question this claim settled, kept verbatim.
   *
   * ⛔ Answering used to DELETE the question, which loses the one thing the stable-id
   * design was for: "the history shows that the ambiguity existed." A claim that was
   * once undecided reads identically to one nobody ever questioned, so the next reader
   * cannot tell that this sentence is the resolution of a real disagreement.
   */
  answers: z.string().optional(),
  /** Who decided it. Set together with `answers`. */
  decided_by: z.string().optional(),
  decided_at: dateLike().optional(),
  /**
   * Why it was decided that way, and what else was considered.
   *
   * ⛔ This is the verb a product manager did not have. Open questions were first-class
   * and answering them was not: "there is no place to record *I, the PM, decided this,
   * on this date, and here is why* — at the feature level. Decisions of exactly that
   * shape exist on the strategy page, with a date, a rationale and an also-considered
   * list, and they are excellent. They are just not available where the question is
   * asked." So a PM's answer became free text in a queue addressed to an agent.
   */
  because: z.string().optional(),
  /**
   * The scope this claim holds over, when it is NOT the whole product.
   *
   * ⛔ THE HIGHEST-COST AMBIGUITY A FRESH READER FOUND. On one page, one enumeration
   * was one lender's data and the next was a product-wide rule, rendered identically:
   * "two engineers reading this today will answer differently, and both will pass every
   * existing test." One direction removes a guard; the other hard-codes the first
   * customer's numbers and refuses a second customer's legitimate values while
   * reporting it as their template's limitation.
   *
   * Absent means universal — true of the product, for everyone. Present means this
   * claim is only asserted of what it names: `holds_for: the Colliers template`.
   *
   * ⛔ Often the right answer is NOT this field. If the claim states specific values
   * that vary by customer, the values are that customer's data and belong nowhere in
   * product truth; the claim is the rule about them ("a value off the template's ladder
   * is refused rather than rounded"). Reach for `holds_for` when the *rule itself* is
   * narrower than the product, not to license pinning one customer's numbers into a
   * claim.
   */
  holds_for: z.string().optional(),
  /**
   * Another behavior this one cannot both hold with — `<container-id>#<behavior-id>`.
   *
   * ⛔ Every other verb acts on ONE behavior in isolation, and a fresh reviewer's single
   * most important finding was not about one behavior at all:
   *
   *   "It is a disagreement BETWEEN `the-grid-is-always-present` and
   *    `whether-a-pane-is-read-only-is-derived-from-the-selection`, on different pages.
   *    Each offers me Reject and Contest, which act on one behavior; there is no way to
   *    say 'this claim and that claim cannot both hold.' Where it would have ended up: a
   *    contest reason typed against one of them, invisible from the other — so the next
   *    reader of the pricing page sees a clean claim and builds it."
   *
   * Declared on one side and **rendered on both**, derived like `depends_on` is, because
   * a contradiction visible from only one of the two pages is the failure it describes.
   */
  /**
   * Decided, and two competent readers would build it differently.
   *
   * ⛔ THE SINGLE MOST COMMON THING A REVIEWER HAS TO SAY, AND IT HAD NO STATE:
   *
   *   "Almost everything in section 3 is DECIDED AND AMBIGUOUS. My only per-behavior
   *    controls were Accept, Reject, Contest, Edit and free-text Feedback. Contest is
   *    wrong — I am not saying the claim is false, I am saying it has two builds. Reject
   *    is wrong. Accept is very wrong. So all thirteen readable ambiguities went into
   *    free-text feedback boxes, where they become prose an agent must re-derive,
   *    sitting next to a behavior still stamped 'awaiting review' as though nobody had
   *    looked. I looked. I found it ambiguous. There is no stamp for that."
   *
   * Distinct from `contested`, which says the claim is false, and from a question, which
   * says nothing is decided. This says the sentence is true and underdetermined — the
   * state in which two engineers ship different products and both pass every test.
   *
   * ⛔ Addable by a READER, not only the page's owner — the person who finds the
   * ambiguity is by definition not the person who wrote it unambiguously in their head.
   */
  ambiguous: z
    .array(
      z.object({
        /** The two (or more) ways it can be read. Required: "this is vague" is not a
         *  finding; "it could mean X or Y" is one somebody can rule on. */
        readings: z.array(z.string().min(5)).min(2),
        /** What it costs to guess wrong. */
        cost: z.string().optional(),
        raised_by: z.string().optional(),
        raised_at: dateLike().optional(),
      })
    )
    .default([]),
  contradicts: z.array(z.string()).default([]),
  /** Why the two cannot both hold. Required whenever `contradicts` is set. */
  contradiction_note: z.string().optional(),
  notes: z.string().optional(),
  /** Anchor to a Surface within the same feature (by Surface.id). Optional —
   *  rule/invariant behaviors that don't live on a screen leave it blank. */
  surface: z.string().optional(),
  /** Anchor to an Element within the referenced Surface (by Element.id). Optional. */
  element: z.string().optional(),
  /** What user action triggers this behavior. Freeform: click, submit, view, load, input, etc. Optional. */
  interaction: z.string().optional(),
  /**
   * Context this behavior rests on — `<doc>#<section-anchor>`, e.g.
   * `principles#submits-are-idempotent` or `glossary#option`.
   *
   * ⛔ Structured rather than prose, because the reverse traversal is the
   * point: "which behaviors rest on this principle" is what makes an
   * unvalidated principle visible, and what gives a principle a blast radius
   * when it changes. In `notes:` the same sentence is unparseable.
   *
   * A behavior citing an unvalidated context section is not ready to build —
   * the rule it defers to is one an agent may have written.
   */
  cites: z.array(z.string()).default([]),
  test_cases: z.array(TestCase).default([]),
  /** Human-validated. A human reviewed the claim and confirmed it matches
   *  the product's actual behavior. Distinct from being-in-git ("the
   *  markdown is the truth") — checkin alone is NOT validation; a person
   *  has to explicitly stamp this. Use `productos verify` (CLI) or
   *  productos_verify_behavior (MCP) to flip it. */
  verified: z.boolean().optional(),
  verified_at: dateLike().optional(),
  verified_by: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecated_reason: z.string().optional(),
});

/**
 * Either it claims something, or it names what is undecided. Never neither.
 *
 * Enforced at the schema boundary rather than documented, because a behavior
 * with no claim and no question is indistinguishable from a typo, and it would
 * read downstream as a claim nobody has written yet — which is exactly the
 * thing an agent invents its way past.
 */
export const Behavior = BehaviorShape.superRefine((b, ctx) => {
  const hasClaim = b.claim.trim().length > 0;
  if (b.question && hasClaim) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["question"],
      message:
        `behavior "${b.id}" has both a claim and a question. If what it claims is ` +
        `decided, drop the question; if an edge of it is still open, that edge is its ` +
        `own undefined behavior with its own id.`,
    });
  }
  // ⛔ An answer must say who and why. A decided question that records the new claim
  // and nothing else is indistinguishable from a claim nobody ever questioned, which
  // defeats the point of keeping the question: the next reader cannot tell that this
  // sentence settled a real disagreement, or ask the person who settled it.
  if (b.contradicts.length > 0 && !b.contradiction_note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contradiction_note"],
      message:
        `behavior "${b.id}" declares a contradiction without saying what it is. Two ` +
        `claims pointed at each other with no explanation just moves the puzzle.`,
    });
  }
  if (b.answers && !b.decided_by) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["decided_by"],
      message:
        `behavior "${b.id}" answers a question without naming who decided. An answer ` +
        `nobody is attached to cannot be questioned back.`,
    });
  }
  if (b.answers && !b.because) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["because"],
      message:
        `behavior "${b.id}" answers a question without saying why. The reasoning is ` +
        `what stops the question being reopened from scratch next session.`,
    });
  }
  if (b.answers && b.claim.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claim"],
      message: `behavior "${b.id}" records an answer but states no claim.`,
    });
  }
  if (!b.question && b.claim.trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claim"],
      message:
        `behavior "${b.id}" needs a claim of at least 10 characters, or a ` +
        `question if what it should claim is not decided yet.`,
    });
  }
});
export type Behavior = z.infer<typeof Behavior>;

/** Has no claim yet — it names an open question instead. */
export function isUndefinedBehavior(b: Behavior): boolean {
  return !!b.question && b.claim.trim().length === 0;
}



/**
 * Backward-compat layer: existing markdown uses `surfaces:`; new markdown
 * uses `ux:`. If both are present, `ux` wins. Done at the preprocess level
 * so the Zod schema only knows about `ux`.
 */
const FeatureFrontmatterRaw = z.object({
  /**
   * `<area>/<slug>` for a feature, `capabilities/<slug>` for a capability.
   *
   * ⛔ `capabilities/` is RESERVED and is not a product area. A capability is
   * the middle layer — it describes an interface without prescribing how a
   * subsystem keeps it — and many features across many areas depend on one.
   * Giving it an area would make that area part of its identity forever, since
   * ids are immutable.
   */
  id: z.string().regex(/^[a-z0-9][a-z0-9/_-]*\/[a-z0-9][a-z0-9_-]*$/, "Must be area/slug, or capabilities/slug"),
  title: z.string(),
  /**
   * Feature or capability — decided by ONE question: what triggers it?
   *
   *   feature    — a user action triggers it. Has screens. Promised to the user.
   *   capability  — an input from elsewhere in the product triggers it. Has no
   *                 screens. Promised to the features that depend on it.
   *
   * ⛔ A capability is a PROMISE, not a subsystem. "Classification returns a
   * confidence for every document" is a capability claim; "there is a
   * classification service behind a queue" is a thing, and it is engineering's.
   *
   * This is the altitude where product and engineering negotiate, and most
   * teams have no artifact at it — PRDs stop below, design docs start above.
   * It was previously expressible only as prose, which is why it kept ending
   * up in an area README as a table of filenames.
   */
  kind: z.enum(["feature", "capability"]).default("feature"),
  status: FeatureStatus.default("built"),
  description: z.string().optional(),
  /** UX views in this feature — screens, modals, sections, drawers, etc.
   *  Each is sketched (ASCII) and has named elements. Behaviors anchor to
   *  these by id. Optional — omit for pure invariant features (no UI). */
  ux: z.array(UxView).default([]),
  /**
   * Other features whose user-facing triggers cause this feature's state to change.
   *
   * Deterministic rule: a behavior belongs to the feature whose trigger fires.
   * When that behavior also mutates the state of a DIFFERENT feature (e.g. a kid
   * completing a task mutates the wallet balance), the affected feature lists the
   * triggering feature here — rather than duplicating the behavior in both places.
   *
   * Format: feature_ids (e.g. ["tasks/complete-task", "wallet/interest"]).
   * Renders as an "Affected by:" pill row on the feature page.
   */
  affected_by: z.array(z.string()).default([]),
  /**
   * Capabilities this container relies on — the promises it is built on top of.
   *
   * ⛔ NOT the same edge as `affected_by`, and conflating them was a real bug:
   * `affected_by` means "another feature's user-facing trigger mutates MY
   * state" (completing a task changes a balance). `depends_on` means "I am
   * built on this promise and break if it changes". Using affected_by for a
   * dependency renders as "Affected by:", which asserts something false.
   *
   * ⛔ Points at capabilities. A feature depending on another feature is
   * either `affected_by`, or a sign the shared part is a capability nobody has
   * named yet.
   *
   * The reverse traversal — "what breaks if this promise changes" — is where
   * the value concentrates, and it is the question a hierarchy structurally
   * cannot answer. It is derived from these edges, never authored twice.
   *
   * Format: container ids (e.g. ["pricing/limit-resolution"]). Cross-area is
   * legal and expected; a capability is an altitude, not a container.
   */
  depends_on: z.array(z.string()).default([]),
  /**
   * An edge somebody believes exists and this page's owner has not declared.
   *
   * ⛔ THE HIGHEST-COST THING A REVIEWER COULD NOT SAY. `depends_on` is authored on the
   * page, by whoever owns the page — so a reader who spots a missing edge has no way to
   * assert it, and the derived impact count stays wrong:
   *
   *   "`cre/pricing/deal-pricing` and `cre/pricing/org-loan-terms` both read facts out
   *    of the template while declaring no dependency on the subsystem that owns it — and
   *    `deliver-to-the-workbook` consequently advertises 'Changing what this promises
   *    changes 1 container' when the true number is at least 3. I nearly scoped the
   *    change to six capability pages on the strength of it. The only container that
   *    would hold my correction was the freeform feedback box, which routes to a queue.
   *    So the correction to a rendered impact count that is actively misleading readers
   *    ends up in a note the reader of that count will never see."
   *
   * A wrong number is worse than no number, because it is scoped off. This is the one
   * edge a NON-OWNER may add: it renders as unconfirmed on both sides, it counts toward
   * the impact figure with the doubt attached, and it is resolved by the owner either
   * promoting it to `depends_on` or removing it with a reason.
   */
  /**
   * Somebody read this container end to end and said whether they could build from it.
   *
   * ⛔ THE MOST IMPORTANT THING A REVIEWER SAID IN THE WHOLE EXERCISE:
   *
   *   "The 32 'notes on this write-up' on this feature contain none of the sixteen
   *    problems I found. They are all missing-validation-stamps, malformed citations,
   *    and one complaint about the word 'column'. The checks that exist are checks of
   *    FORM. Everything that would produce wrong software here is a matter of AGREEMENT
   *    BETWEEN TWO SENTENCES, and nothing on this site checks that. A corpus can pass
   *    every automated check it has, read beautifully, and still contain a blocker that
   *    makes the feature unbuildable. There is no counter, chip or stamp anywhere for
   *    'a human read this end to end and could not build it.' That is the only signal I
   *    had to give, and it has no home."
   *
   * Every other signal here is derived from structure. This one cannot be: it is a
   * person reporting whether a document did its job, which no check can compute and no
   * amount of conformance can substitute for.
   */
  read_throughs: z
    .array(
      z.object({
        by: z.string().min(1),
        at: dateLike(),
        /** Could they have handed this to an engineer? */
        buildable: z.boolean(),
        /** Behavior ids or `<container>#<behavior>` refs that stopped them. */
        blocked_by: z.array(z.string()).default([]),
        /** What they would tell the room. */
        note: z.string().optional(),
      })
    )
    .default([]),
  suspected_depends_on: z
    .array(
      z.object({
        /** The container it is suspected of depending on. */
        id: z.string(),
        /** Why the reviewer believes the edge exists. Required — a hunch with no
         *  evidence gives the owner nothing to confirm. */
        because: z.string().min(10),
        raised_by: z.string().optional(),
        raised_at: dateLike().optional(),
      })
    )
    .default([]),
  behaviors: z.array(Behavior).default([]),
});

/**
 * Feature frontmatter with backward compat: accept `surfaces:` as an alias
 * for `ux:`. If both are present, `ux` wins (preprocess applies before
 * validation, so the schema only sees `ux`).
 */
export const FeatureFrontmatter = z.preprocess((raw: unknown) => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.ux === undefined && r.surfaces !== undefined) {
      return { ...r, ux: r.surfaces };
    }
  }
  return raw;
}, FeatureFrontmatterRaw);
export type FeatureFrontmatter = z.infer<typeof FeatureFrontmatter>;

export interface FeatureDocument {
  frontmatter: FeatureFrontmatter;
  body: string;
  filepath: string;
  url_path: string;
}

/**
 * A grouping in the product tree, at any depth.
 *
 * ⛔ The tree used to be exactly product → area → feature, and that was wrong for
 * any product bigger than a demo. "CRE" has deal management, and deal management has
 * pricing, and pricing splits by agency — a fixed depth forces one of those joints to
 * be flattened into a name (`deal-pricing-agency`) or into a bag of thirty features
 * nobody can read. Depth is a property of the product, not of ProductOS.
 *
 * A group holds nested groups, features, or both. Its description lives in its
 * `README.md`.
 */
export interface GroupDocument {
  /** Path segments below `products/`, e.g. `["cre","pricing","agency"]`. */
  segments: string[];
  /** `segments.join("/")` — also the URL path and the prefix of every id inside. */
  id: string;
  /** Last segment. */
  slug: string;
  title: string;
  body: string;
  /** 1 = product. */
  depth: number;
  /** Nested groups, one level down. */
  groups: GroupDocument[];
  /** Features filed directly here — not in a nested group. */
  features: FeatureDocument[];
  filepath: string;
}

/** Every feature at or below this group. */
export function groupFeatures(g: GroupDocument): FeatureDocument[] {
  return [...g.features, ...g.groups.flatMap(groupFeatures)];
}

/** Depth-first walk of a group and its descendants. */
export function walkGroups(gs: GroupDocument[], fn: (g: GroupDocument) => void): void {
  for (const g of gs) {
    fn(g);
    walkGroups(g.groups, fn);
  }
}

/**
 * A group that directly holds features — "an area" in the older two-level language.
 *
 * Kept as a view over {@link GroupDocument} because most consumers want exactly this:
 * the places features actually live. `slug` is the path **below the product** and may
 * be several segments deep (`pricing/agency`), so `/{product}/{slug}/` stays the URL.
 */
export interface AreaDocument {
  slug: string;
  title: string;
  body: string;
  features: FeatureDocument[];
  filepath: string;
  /** The product this area belongs to. */
  product: string;
}

/**
 * A product — the top of the product tree.
 *
 * ⛔ A product is not an area. "CRE" is a whole product with deal management,
 * document review and pricing inside it; filing all of that as one area puts
 * unrelated concerns in one flat bag and leaves the product's own vocabulary
 * with nowhere to live. One repo commonly holds several products.
 */
export interface ProductDocument {
  slug: string;
  title: string;
  body: string;
  /** Immediate child groups, each recursive. */
  groups: GroupDocument[];
  /** Features filed directly under the product, ungrouped. */
  features: FeatureDocument[];
  /** Every descendant group that directly holds features, flattened. */
  areas: AreaDocument[];
  filepath: string;
}

export function productReadmePath(paths: ProductosPaths, product: string): string {
  return path.join(productsRoot(paths), product, "README.md");
}

function readGrouping(readme: string, slug: string): { title: string; body: string } {
  if (!fs.existsSync(readme)) return { title: slug, body: "" };
  const parsed = matter(fs.readFileSync(readme, "utf-8"));
  return { title: parsed.data.title ?? slug, body: parsed.content.trim() };
}

/** Directory names that are never groups. */
const NON_GROUP_DIRS = new Set(["context", "tracking"]);

function readGroupTree(
  paths: ProductosPaths,
  dir: string,
  segments: string[],
  byGroup: Map<string, FeatureDocument[]>
): GroupDocument[] {
  const out: GroupDocument[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (NON_GROUP_DIRS.has(name) || name.startsWith(".")) continue;
    const sub = path.join(dir, name);
    if (!fs.statSync(sub).isDirectory()) continue;
    const segs = [...segments, name];
    const id = segs.join("/");
    const readme = path.join(sub, "README.md");
    const meta = readGrouping(readme, name);
    out.push({
      segments: segs,
      id,
      slug: name,
      title: meta.title,
      body: meta.body,
      depth: segs.length,
      groups: readGroupTree(paths, sub, segs, byGroup),
      features: byGroup.get(id) ?? [],
      filepath: readme,
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The product tree, nested to whatever depth the corpus uses. */
export function listProducts(paths: ProductosPaths): ProductDocument[] {
  const root = productsRoot(paths);
  if (!fs.existsSync(root)) return [];
  // A feature's id is its path, so its group is everything but the last segment.
  const byGroup = new Map<string, FeatureDocument[]>();
  for (const f of listFeatures(paths)) {
    const parts = f.frontmatter.id.split("/");
    const key = parts.slice(0, -1).join("/");
    const arr = byGroup.get(key) ?? [];
    arr.push(f);
    byGroup.set(key, arr);
  }
  const out: ProductDocument[] = [];
  for (const product of fs.readdirSync(root)) {
    if (product === CAPABILITY_AREA || NON_GROUP_DIRS.has(product) || product.startsWith(".")) continue;
    const pdir = path.join(root, product);
    if (!fs.statSync(pdir).isDirectory()) continue;
    const pMeta = readGrouping(productReadmePath(paths, product), product);
    const groups = readGroupTree(paths, pdir, [product], byGroup);
    const areas: AreaDocument[] = [];
    walkGroups(groups, (g) => {
      if (g.features.length === 0) return;
      areas.push({
        slug: g.segments.slice(1).join("/"),
        product,
        title: g.title,
        body: g.body,
        features: g.features,
        filepath: g.filepath,
      });
    });
    areas.sort((a, b) => a.slug.localeCompare(b.slug));
    out.push({
      slug: product,
      title: pMeta.title,
      body: pMeta.body,
      groups,
      features: byGroup.get(product) ?? [],
      areas,
      filepath: productReadmePath(paths, product),
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Find a group by its full id (`cre/pricing/agency`). */
export function findGroup(products: ProductDocument[], id: string): GroupDocument | null {
  let found: GroupDocument | null = null;
  walkGroups(
    products.flatMap((p) => p.groups),
    (g) => {
      if (g.id === id) found = g;
    }
  );
  return found;
}

// ---------------------------------------------------------------------------
// Paths

export function productsRoot(paths: ProductosPaths): string {
  return path.join(paths.root, "products");
}

export function featureFilePath(paths: ProductosPaths, id: string): string {
  // `capabilities/x` resolves into the capabilities tree, not products/capabilities/x.
  if (id.startsWith(CAPABILITY_AREA + "/")) {
    return path.join(paths.capabilitiesDir, `${id.slice(CAPABILITY_AREA.length + 1)}.md`);
  }
  return path.join(productsRoot(paths), `${id}.md`);
}

export function areaReadmePath(paths: ProductosPaths, area: string): string {
  return path.join(productsRoot(paths), area, "README.md");
}

export function topReadmePath(paths: ProductosPaths): string {
  return path.join(productsRoot(paths), "README.md");
}

export function ensureProductsDirs(paths: ProductosPaths): void {
  fs.mkdirSync(productsRoot(paths), { recursive: true });
}

// ---------------------------------------------------------------------------
// Read

export function readFeature(filepath: string): FeatureDocument {
  const raw = fs.readFileSync(filepath, "utf-8");
  const parsed = matter(raw);
  const frontmatter = FeatureFrontmatter.parse(parsed.data);
  return {
    frontmatter,
    body: parsed.content.trim(),
    filepath,
    url_path: "/" + frontmatter.id,
  };
}

export function readFeatureById(paths: ProductosPaths, id: string): FeatureDocument | null {
  const fp = featureFilePath(paths, id);
  if (!fs.existsSync(fp)) return null;
  const doc = readFeature(fp);
  return id.startsWith(CAPABILITY_AREA + "/")
    ? { ...doc, frontmatter: { ...doc.frontmatter, kind: "capability" } }
    : doc;
}

export const CAPABILITY_AREA = "capabilities";

/** Both trees. Most callers want this — the corpus is products + capabilities. */
export function listAllContainers(paths: ProductosPaths): FeatureDocument[] {
  return [...listFeatures(paths), ...listCapabilities(paths)];
}

/**
 * The capabilities tree — a sibling of products/, deliberately not inside it.
 *
 * `kind` is forced to `capability` here rather than trusted from frontmatter:
 * which tree a container lives in IS what it is, so the two cannot disagree.
 */
/**
 * A capability system — the grouping level on the system tree, congruent to a feature
 * area. Its description lives in `capabilities/<system>/README.md`.
 *
 * ⛔ A system without a README is an unnamed subsystem. That state shipped once: ten
 * capabilities rendered as a flat list of operations — "limit resolution", "deliver a
 * version" — with nothing anywhere saying what subsystem offered them or what it was
 * for. A directory name is not a description.
 */
export interface CapabilitySystemDocument {
  slug: string;
  title: string;
  body: string;
  capabilities: FeatureDocument[];
  filepath: string;
}

export function capabilitySystemReadmePath(paths: ProductosPaths, system: string): string {
  return path.join(paths.capabilitiesDir, system, "README.md");
}

export function listCapabilitySystems(paths: ProductosPaths): CapabilitySystemDocument[] {
  const root = paths.capabilitiesDir;
  if (!fs.existsSync(root)) return [];
  const caps = listCapabilities(paths);
  const bySystem = new Map<string, FeatureDocument[]>();
  for (const c of caps) {
    // `capabilities/<system>/<slug>` — the middle segment is the system.
    const parts = c.frontmatter.id.split("/");
    const system = parts.length >= 3 ? parts[1]! : "";
    const arr = bySystem.get(system) ?? [];
    arr.push(c);
    bySystem.set(system, arr);
  }
  const out: CapabilitySystemDocument[] = [];
  for (const slug of fs.readdirSync(root)) {
    const dir = path.join(root, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const readme = capabilitySystemReadmePath(paths, slug);
    let title = slug;
    let body = "";
    if (fs.existsSync(readme)) {
      const parsed = matter(fs.readFileSync(readme, "utf-8"));
      title = parsed.data.title ?? slug;
      body = parsed.content.trim();
    }
    out.push({ slug, title, body, capabilities: bySystem.get(slug) ?? [], filepath: readme });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function listCapabilities(paths: ProductosPaths): FeatureDocument[] {
  const root = paths.capabilitiesDir;
  if (!fs.existsSync(root)) return [];
  const out: FeatureDocument[] = [];
  walk(root, (file) => {
    if (!file.endsWith(".md")) return;
    if (path.basename(file).toLowerCase() === "readme.md") return;
    // ⛔ A subsystem's own context lives at capabilities/<system>/context/. The products
    // walk has excluded its context dir since the area-context feature landed; this one
    // did not, so the first subsystem glossary anybody wrote made every command print a
    // parse failure for it — a file that is not a capability, reported as a broken one.
    if (path.dirname(file).split(path.sep).includes("context")) return;
    try {
      const doc = readFeature(file);
      out.push({ ...doc, frontmatter: { ...doc.frontmatter, kind: "capability" } });
    } catch (e) {
      process.stderr.write(
        `productos: ${path.relative(paths.repoRoot, file)} failed to parse: ${(e as Error).message}\n`
      );
    }
  });
  out.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return out;
}

export function listFeatures(paths: ProductosPaths): FeatureDocument[] {
  const root = productsRoot(paths);
  if (!fs.existsSync(root)) return [];
  const out: FeatureDocument[] = [];
  walk(root, (file) => {
    if (!file.endsWith(".md")) return;
    if (path.basename(file).toLowerCase() === "readme.md") return;
    // ⛔ An area's own context lives at products/<area>/context/. Those are
    // context docs, not features, and parsing them as features reports a
    // spurious parse failure for every one of them.
    if (path.dirname(file).split(path.sep).includes("context")) return;
    try {
      out.push(readFeature(file));
    } catch (e) {
      process.stderr.write(`productos: ${path.relative(paths.repoRoot, file)} failed to parse: ${(e as Error).message}\n`);
    }
  });
  out.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  return out;
}

/** Every area across every product, flattened. Kept for callers that want areas. */
export function listAreas(paths: ProductosPaths): AreaDocument[] {
  return listProducts(paths).flatMap((p) => p.areas);
}

// ---------------------------------------------------------------------------
// Write

export function writeFeature(paths: ProductosPaths, doc: FeatureDocument): void {
  // ⛔ VALIDATE BEFORE WRITING. An MCP input schema that was looser than this one let a
  // one-reading `ambiguous` through, `writeFeature` serialised it, and the corruption
  // surfaced only on the NEXT read — as a parse failure on a file the author had not
  // touched, with the offending tool call long gone.
  //
  // Every writer funnels through here, so this is the one place that can refuse: the
  // framework's own principle is that an invariant only counts if the tool won't let you
  // violate it, and "the tool" has to mean the last gate before disk, not each caller's
  // own idea of the shape. A rejected call is recoverable; a corrupt corpus discovered
  // later is not.
  const check = FeatureFrontmatter.safeParse(doc.frontmatter);
  if (!check.success) {
    const where = check.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(
      `Refusing to write "${doc.frontmatter.id}" — it would not parse back: ${where}`
    );
  }

  const fp = featureFilePath(paths, doc.frontmatter.id);
  // Snapshot the current on-disk version BEFORE overwriting, so undo is
  // always one step away. Skip if this is the first write (no existing
  // file to snapshot).
  if (fs.existsSync(fp)) {
    snapshotFeature(paths, doc.frontmatter.id, fs.readFileSync(fp, "utf-8"));
  }
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const fm = YAML.stringify(doc.frontmatter, { lineWidth: 0, blockQuote: "literal" });
  fs.writeFileSync(fp, `---\n${fm}---\n\n${doc.body.trim()}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Snapshot history — every writeFeature() saves the prior version under
// productos/.local/history/<area>/<feature>/<timestamp>.md. Lets the user
// (or Claude) undo a recent change without git acrobatics.
//
// Capped at MAX_SNAPSHOTS per feature to keep disk use bounded.

const MAX_SNAPSHOTS = 50;

export interface FeatureSnapshot {
  feature_id: string;
  timestamp: string;       // ISO8601
  filepath: string;        // absolute path to snapshot file
  age_seconds: number;     // seconds since snapshot was taken
}

function featureHistoryDir(paths: ProductosPaths, id: string): string {
  return path.join(paths.historyDir, id);
}

function snapshotFeature(paths: ProductosPaths, id: string, raw: string): void {
  const dir = featureHistoryDir(paths, id);
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(dir, `${ts}.md`), raw, "utf-8");
  pruneSnapshots(paths, id);
}

function pruneSnapshots(paths: ProductosPaths, id: string): void {
  const dir = featureHistoryDir(paths, id);
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort(); // ISO timestamps sort lexicographically
  while (files.length > MAX_SNAPSHOTS) {
    const oldest = files.shift()!;
    try { fs.unlinkSync(path.join(dir, oldest)); } catch { /* ignore */ }
  }
}

export function listFeatureSnapshots(paths: ProductosPaths, id: string): FeatureSnapshot[] {
  const dir = featureHistoryDir(paths, id);
  if (!fs.existsSync(dir)) return [];
  const now = Date.now();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // most recent first
  return files.map((f) => {
    const fp = path.join(dir, f);
    const ts = f.replace(/\.md$/, "");
    // Restore the colons / dots that we stripped when writing.
    const iso = ts.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
    const t = Date.parse(iso);
    return {
      feature_id: id,
      timestamp: iso,
      filepath: fp,
      age_seconds: isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 1000)),
    };
  });
}

/**
 * Restore a snapshot by index (1 = most recent). Linear undo: each call
 * consumes the snapshot it restored, so repeated calls to undo walk
 * further back through the history. No redo. If the user actually wanted
 * the post-edit state back, they can re-run the AI edit.
 */
export function restoreFeatureSnapshot(
  paths: ProductosPaths,
  id: string,
  index = 1
): FeatureSnapshot {
  const snaps = listFeatureSnapshots(paths, id);
  if (snaps.length === 0) throw new Error(`No history for ${id}`);
  if (index < 1 || index > snaps.length) {
    throw new Error(`Index ${index} out of range (have ${snaps.length} snapshot${snaps.length === 1 ? "" : "s"})`);
  }
  const snap = snaps[index - 1];
  const raw = fs.readFileSync(snap.filepath, "utf-8");
  const fp = featureFilePath(paths, id);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, raw, "utf-8");
  // Consume the restored snapshot AND any newer ones (so the history
  // reflects a linear walk back). Pressing undo again then restores the
  // NEXT-older snapshot.
  for (let i = 0; i <= index - 1; i++) {
    try { fs.unlinkSync(snaps[i].filepath); } catch { /* ignore */ }
  }
  return snap;
}

export function writeAreaReadme(
  paths: ProductosPaths,
  area: string,
  title: string,
  body: string
): void {
  const fp = areaReadmePath(paths, area);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const fm = YAML.stringify({ title }, { lineWidth: 0 });
  fs.writeFileSync(fp, `---\n${fm}---\n\n${body.trim()}\n`, "utf-8");
}

// ---------------------------------------------------------------------------

function walk(dir: string, fn: (file: string) => void): void {
  for (const entry of fs.readdirSync(dir)) {
    const fp = path.join(dir, entry);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walk(fp, fn);
    else fn(fp);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
