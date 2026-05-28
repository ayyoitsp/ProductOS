import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const kids = pgTable("kids", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  recurring: integer("recurring").notNull().default(1),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    // task | interest | earn | spend | adjustment
    type: text("type").notNull(),
    relatedTaskId: integer("related_task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byKidCreated: index("idx_tx_kid").on(t.kidId, t.createdAt),
  })
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Kid = typeof kids.$inferSelect;
export type NewKid = typeof kids.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
