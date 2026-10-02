/**
 * ProductOS — Product Truth schema.
 *
 * The graph from OVERVIEW.md, relationally. Three altitudes (Surface / Feature /
 * Capability) with Behavior as the atom, plus Product Context.
 *
 * Two invariants are structural rather than conventional:
 *   1. Natural text ids are primary keys, so a stable id IS the identity.
 *      Renaming a thing is impossible by construction, not by policy.
 *   2. Nothing is deleted. `deprecated_at` retires a row; the row stays.
 *      There is no delete path in the API (ARCHITECTURE.md §4).
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Feature = user-facing. Capability = a promise other containers depend on. */
export const containerKind = pgEnum("container_kind", ["feature", "capability"]);

/** Is it built? Orthogonal to validation. `planned` is where generation lives. */
export const lifecycle = pgEnum("lifecycle", ["planned", "built", "retired"]);

export const contextKind = pgEnum("context_kind", [
  "goal",
  "principle",
  "persona",
  "non_goal",
  "voice",
  "glossary",
]);

/** The record is immutable; the ruling is not. */
export const decisionStatus = pgEnum("decision_status", [
  "active",
  "under_review",
  "superseded",
]);

export const edgeKind = pgEnum("edge_kind", [
  "depends_on", // container -> capability
  "uses", // container -> surface
  "affected_by", // container -> container
  "decided_by", // behavior -> decision
  "implements", // container -> code ref
]);

/** Only ever `human`, or an agent carrying a prior human decision forward. */
export const validationProvenance = pgEnum("validation_provenance", [
  "human",
  "self_heal",
]);

/**
 * Where a claim came from.
 *
 * `authored` = a person wrote it, deliberately. `baseline` = imported from a
 * source (code, tests, docs, feedback) to give the corpus something to work
 * against.
 *
 * This is what lets "in the corpus" differ from "in your queue": baseline
 * claims are excluded from the review queue by origin, so a seeded corpus
 * doesn't manufacture a review backlog nobody asked for. Baseline claims are
 * also never packeted and never emitted to agents (ARCHITECTURE.md §2b).
 */
export const claimOrigin = pgEnum("claim_origin", ["authored", "baseline"]);

/**
 * Internal signal taxonomy. Externally these all collapse to one "problem"
 * state (OVERVIEW.md §State) — this detail exists for analysis, and must not
 * reach a reviewer.
 */
export const signalKind = pgEnum("signal_kind", [
  "check_failed",
  "contradiction",
  "duplicate",
  "challenge",
  "code_changed",
]);

// ---------------------------------------------------------------------------
// Product Context — read first; constrains every behavior below
// ---------------------------------------------------------------------------

export const contextItems = pgTable(
  "context_items",
  {
    id: text("id").primaryKey(), // e.g. "principle/numbers-feel-rewarding"
    kind: contextKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    owner: text("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
  },
  (t) => [index("context_kind_idx").on(t.kind)],
);

/**
 * Decisions carry NO validation state — a decision isn't falsifiable, it's a
 * record of a choice. It can go stale, which is `status`, not validation.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(), // "d-001"
    title: text("title").notNull(),
    status: decisionStatus("status").notNull().default("active"),
    decidedOn: timestamp("decided_on", { withTimezone: true }).notNull(),
    owner: text("owner"),
    /** Why it went this way. When this premise stops holding, revisit. */
    context: text("context").notNull(),
    /** What else was considered, and why it lost. */
    alternatives: jsonb("alternatives").$type<string[]>().notNull().default([]),
    chosen: text("chosen").notNull(),
    body: text("body"),
    /** Surfaces for a look; never invalidates on its own. */
    revisitAfter: timestamp("revisit_after", { withTimezone: true }),
    /** Dates it was revisited and upheld. Reaffirmed twice > never examined. */
    reaffirmed: jsonb("reaffirmed").$type<string[]>().notNull().default([]),
    supersededBy: text("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decision_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// Surfaces — decoupled from containers, so one screen serves many features
// ---------------------------------------------------------------------------

export const surfaces = pgTable("surfaces", {
  id: text("id").primaryKey(), // "document-list"
  title: text("title").notNull(),
  path: text("path"), // route or selector
  /** Interface structure, not design. */
  sketch: text("sketch"),
  /**
   * High-fidelity HTML mock. Rendered in a sandboxed iframe — it is authored
   * content (a person or an agent wrote it), so it is never injected into the
   * app's own document.
   */
  sketchHtml: text("sketch_html"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
});

export const elements = pgTable(
  "elements",
  {
    surfaceId: text("surface_id")
      .notNull()
      .references(() => surfaces.id),
    id: text("id").notNull(), // "delete-button" — unique within the surface
    kind: text("kind").notNull(), // button | input | link | stepper | ...
    label: text("label"),
    notes: text("notes"),
    /** Flow graph: this element leads to that surface. */
    leadsTo: text("leads_to").references(() => surfaces.id),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.surfaceId, t.id] })],
);

// ---------------------------------------------------------------------------
// Containers — features and capabilities share a table; `kind` distinguishes
// ---------------------------------------------------------------------------

export const containers = pgTable(
  "containers",
  {
    id: text("id").primaryKey(), // "documents/delete-document"
    kind: containerKind("kind").notNull(),
    title: text("title").notNull(),
    area: text("area").notNull(), // organizational only; carries no semantics
    /**
     * What this is FOR, in one sentence — distinct from `description`, which
     * says what it is. The packet leads with this: an agent given a goal plus
     * constraints has latitude on *how*, which is the whole point of describing
     * what rather than how. It also gives the agent something to reason against
     * when the behaviors underspecify, which they will.
     */
    goal: text("goal"),
    description: text("description"),
    lifecycle: lifecycle("lifecycle").notNull().default("planned"),
    owner: text("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
  },
  (t) => [index("container_kind_idx").on(t.kind), index("container_area_idx").on(t.area)],
);

/**
 * The atom. Everything verifiable hangs here.
 *
 * Anchored (surface + element) when a user action triggers it — that makes it a
 * feature behavior. Un-anchored when it's a rule or invariant, which is the
 * usual shape for a capability behavior.
 */
export const behaviors = pgTable(
  "behaviors",
  {
    containerId: text("container_id")
      .notNull()
      .references(() => containers.id),
    id: text("id").notNull(), // "delete-removes-from-file"
    claim: text("claim").notNull(),
    notes: text("notes"),
    lifecycle: lifecycle("lifecycle").notNull().default("planned"),
    origin: claimOrigin("origin").notNull().default("authored"),
    /** Which source, e.g. "code:src/api", "tests", "prd:2024-wishlist". */
    originDetail: text("origin_detail"),
    // Anchor — all three null for rules/invariants
    surfaceId: text("surface_id").references(() => surfaces.id),
    elementId: text("element_id"),
    interaction: text("interaction"), // "click", "submit", ...
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    deprecatedReason: text("deprecated_reason"),
  },
  (t) => [
    primaryKey({ columns: [t.containerId, t.id] }),
    index("behavior_surface_idx").on(t.surfaceId),
  ],
);

/**
 * Numbered acceptance scenarios. Ids are immutable and append-only — a case
 * that stops being load-bearing is deprecated, never renumbered, so that any
 * test carrying the stable id keeps resolving.
 */
export const testCases = pgTable(
  "test_cases",
  {
    containerId: text("container_id").notNull(),
    behaviorId: text("behavior_id").notNull(),
    number: integer("number").notNull(),
    description: text("description").notNull(),
    given: text("given"),
    when: text("when"),
    then: text("then"),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    replacedBy: integer("replaced_by"),
  },
  (t) => [primaryKey({ columns: [t.containerId, t.behaviorId, t.number] })],
);

// ---------------------------------------------------------------------------
// Edges — the graph. Polymorphic by (type, id) pairs.
// ---------------------------------------------------------------------------

export const edges = pgTable(
  "edges",
  {
    kind: edgeKind("kind").notNull(),
    fromType: text("from_type").notNull(), // container | behavior
    fromId: text("from_id").notNull(),
    toType: text("to_type").notNull(), // container | surface | decision | code
    toId: text("to_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("edge_unique").on(t.kind, t.fromType, t.fromId, t.toType, t.toId),
    index("edge_from_idx").on(t.fromType, t.fromId),
    index("edge_to_idx").on(t.toType, t.toId),
  ],
);

// ---------------------------------------------------------------------------
// Validation + signals
// ---------------------------------------------------------------------------

/**
 * Append-only. A human accepting a behavior writes a row here; nothing is ever
 * updated or removed. There is deliberately no API path for a model to write
 * `human` provenance (ARCHITECTURE.md §4).
 */
export const validations = pgTable(
  "validations",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id").notNull(),
    behaviorId: text("behavior_id").notNull(),
    provenance: validationProvenance("provenance").notNull(),
    /** For self_heal: why the change was judged non-semantic. */
    reason: text("reason"),
    actor: text("actor").notNull(),
    /** What the claim said when validated — detects later edits. */
    claimHash: text("claim_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("validation_behavior_idx").on(t.containerId, t.behaviorId)],
);

/**
 * Everything that says "reality may disagree". Externally these collapse to a
 * single "problem" state; `kind` and `detail` are for analysis only.
 */
export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    kind: signalKind("kind").notNull(),
    containerId: text("container_id").notNull(),
    behaviorId: text("behavior_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    source: text("source").notNull(), // "ci" | "agent" | "human" | ...
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("signal_behavior_idx").on(t.containerId, t.behaviorId),
    index("signal_open_idx").on(t.resolved),
  ],
);
