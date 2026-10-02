/**
 * The hosted store.
 *
 * ⛔ TWO PLANES, AND THE SPLIT IS THE WHOLE DESIGN. The control plane — who exists, who may reach
 * what, what happened — is relational and wants transactions. The corpus is DOCUMENTS, one row per
 * file the parser already reads, stored as the bytes it reads. Shredding a `Scope` across ten
 * tables to reassemble it on every read is work with nothing to show for it: nothing queries across
 * scopes except the reviewers, and they read whole corpora anyway.
 *
 * See `planning/HOSTED_TENANCY.md`. Three properties in here are load-bearing and each is explained
 * where it lives:
 *
 *   1. `documents` carries NO owner. Ownership lives on `projects` and nowhere else, so a transfer
 *      is one UPDATE and the owner model can change without touching a document.
 *   2. `source` is the authority; `projection` is derived and never read back into the model.
 *   3. Nothing here can mint human consent. `sessions` is what makes `via: page` provable;
 *      `tokens` carries scopes, and no scope in the vocabulary reaches a verdict.
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Control plane
// ---------------------------------------------------------------------------

/**
 * ⛔ REACH, AND NOTHING ELSE. A role says which projects you can see and author in. None of them
 * says whether you may record agreement — that is gated on being a browser session the instance
 * issued, in `mayRecord`, and it must stay there.
 *
 * ⛔ THERE IS NO `validator` ROLE AND THERE NEVER WILL BE. It would be the exact failure
 * `identity.ts` was written to prevent: "a permission that can be granted is a permission somebody
 * eventually grants." The same reason `accepted-by-human` is not a token scope that is merely off.
 */
export const projectRole = pgEnum("project_role", ["owner", "member", "reader"]);

/** ⛔ Mirrors `TOKEN_SCOPES` in `../identity.ts`. That file is the vocabulary; this is its column. */
export const tokenScope = pgEnum("token_scope", ["read", "author", "relay"]);

/**
 * A person.
 *
 * Replaces `localAccount()` — `os.userInfo().username`, which is forgeable and meaningless the
 * moment two machines are involved. A verdict's `by` becomes this row rather than a string somebody
 * typed.
 */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("account_email_idx").on(t.email)]);

/**
 * One product, holding one corpus. The isolation boundary.
 *
 * ⛔ `ownerId` LIVES HERE AND NOWHERE ELSE. Denormalising it onto every document would make a
 * transfer a rewrite of the whole project and would put one fact in two homes. Keeping it to one
 * row is also what makes the flat owner model reversible: an owning group arriving later is a
 * second KIND of owner and the same single UPDATE.
 *
 * ⛔ `slug` IS NOT AN IDENTIFIER. It is unique per owner, so a transfer into an owner that already
 * holds that slug forces a rename — exactly as GitHub does it. `id` is the address; the slug is a
 * human-typable alias. A client config pinned to a slug breaks on a change nobody told it about.
 */
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => accounts.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  /**
   * ⛔ A LABEL, NOT A CREDENTIAL AND NOT A LOOKUP KEY. "Worked on from acme/web" is useful on a
   * settings page. ProductOS holds no repo token, clones nothing and stores no source — the tie to
   * a repo is an authenticated MCP connection naming a project, which is why this column can be
   * free text nobody resolves. And it is on the project, never in a document: a repo name inside
   * product truth is the substrate leak the house rule is about.
   */
  repoLabel: text("repo_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("project_owner_slug_idx").on(t.ownerId, t.slug)]);

/** How a second person gets reach. Without it only the owner can press, and the loop needs two. */
export const projectMembers = pgTable("project_members", {
  projectId: text("project_id").notNull().references(() => projects.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  role: projectRole("role").notNull(),
}, (t) => [primaryKey({ columns: [t.projectId, t.accountId] })]);

/**
 * What something automated holds.
 *
 * ⛔ HASHED AT REST. An env var in a container is one secret an operator set; a multi-tenant table
 * of plaintext credentials is a different object entirely, and the blast radius of reading it is
 * every customer's roadmap.
 *
 * `reach` is the projects this token may address — ⛔ empty means every project its account can
 * reach, NOT every project. There is no value of this column that crosses an account.
 */
export const tokens = pgTable("tokens", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  hash: text("hash").notNull(),
  /** What the audit trail calls it. Not a credential; a name for a thing that holds one. */
  actor: text("actor").notNull(),
  scopes: tokenScope("scopes").array().notNull(),
  reach: text("reach").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** So a forgotten token is visible rather than merely still valid. */
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("token_hash_idx").on(t.hash)]);

/**
 * A one-time code proving somebody controls an address.
 *
 * ⛔ HASHED AND SINGLE-USE. `usedAt` is written rather than the row deleted, so a code that turns up
 * again in a mail archive is visibly spent instead of merely absent. Delivery is the host's
 * business — see `requestLogin`, which returns the code rather than pretending to send it.
 */
export const loginCodes = pgTable("login_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  hash: text("hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [index("login_code_email_idx").on(t.email)]);

/**
 * ⛔ THIS TABLE IS WHAT MAKES `via: page` PROVABLE RATHER THAN CLAIMED.
 *
 * The instance issued this session and watched the press arrive on it, so it knows the press did
 * not come from a token. Until now that was honour-system: the CLI wrote whatever `--by` it was
 * handed. This row is the difference between "a human validated this" meaning something and meaning
 * "something in the pipeline believed it".
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("session_account_idx").on(t.accountId)]);

/**
 * The one log, two readers — the page streams it, a session reads it as an inbox with a cursor.
 *
 * ⛔ `seq` IS MONOTONIC PER PROJECT, NOT GLOBAL. A cursor is meaningless if it moves because another
 * project changed, and per-project numbering is also why a transfer neither resets nor renumbers it.
 */
export const events = pgTable("events", {
  projectId: text("project_id").notNull().references(() => projects.id),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.seq] })]);

/**
 * A claim on one note, with an expiry.
 *
 * ⛔ THE LEASE IS ON THE NOTE, NOT THE INBOX. Locking the feed would make a second session useless
 * when its entire value is being a second pair of hands. An expired lease returns the note to the
 * queue, so a dead session does not strand somebody's request forever.
 */
export const leases = pgTable("leases", {
  projectId: text("project_id").notNull().references(() => projects.id),
  noteId: text("note_id").notNull(),
  sessionId: text("session_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.projectId, t.noteId] })]);

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

/**
 * One row per file the parser reads. ⛔ AND THE PARSER STAYS THE ONLY MODEL.
 *
 * `source` holds the bytes `loadCorpus` already reads, so there is one set of refusals and one set
 * of `broken` messages whether a corpus is on disk or in here. A column holding PARSED frontmatter
 * would be a second implementation of the model the moment anything loaded from it — so
 * `projection` is written in the same transaction, used for listing and filtering only, and never
 * read back into a `Scope`.
 *
 * ⛔ `path` IS A PATH AND THAT IS NOT A LEAK — the same argument `memoryStore` already makes in
 * `../load.ts`. These keys are the wire between two halves of one program; a file-shaped key here
 * is no more product truth than a column name is. What would be a leak is one reaching a page.
 *
 * It also makes export exact by construction: writing every row's `source` to its `path` reproduces
 * the corpus byte-for-byte, which is PT-0001's third "done when" rather than a hope.
 *
 * ⛔ NO OWNER COLUMN. See `projects`.
 */
export const documents = pgTable("documents", {
  projectId: text("project_id").notNull().references(() => projects.id),
  /** Relative to the corpus root, e.g. `truth/pricing.md`. The key `corpusFiles` already uses. */
  path: text("path").notNull(),
  source: text("source").notNull(),
  projection: jsonb("projection").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** ⛔ Nothing is deleted. There is no delete path for a document, only this. */
  deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.projectId, t.path] })]);

/**
 * Which document migrations a project has already had.
 *
 * ⛔ A SECOND LEDGER, NOT A ROW IN THE FIRST. `_productos_migrations` records the shape of the STORE
 * moving forward; this records the CONTENT OF DOCUMENTS moving forward, and they advance
 * independently — a fresh database is current on one and has every document rule still to run on
 * any corpus later imported into it. One table for both would make "up to date" ambiguous.
 *
 * ⛔ KEYED BY PROJECT, because corpora arrive by import at any time. A project added after a rule
 * ran would otherwise never see it, and would be the one broken corpus on an instance that believes
 * it is current.
 *
 * `documents` keeps what the rule actually touched, so a changed sentence has something to point at
 * besides "the server did it".
 */
export const documentMigrations = pgTable("document_migrations", {
  projectId: text("project_id").notNull().references(() => projects.id),
  migrationId: text("migration_id").notNull(),
  documents: jsonb("documents").$type<string[]>().notNull().default([]),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.migrationId] })]);

export const schema = {
  accounts,
  documentMigrations,
  loginCodes,
  projects,
  projectMembers,
  tokens,
  sessions,
  events,
  leases,
  documents,
};
