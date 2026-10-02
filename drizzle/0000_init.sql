CREATE TYPE "public"."project_role" AS ENUM('owner', 'member', 'reader');--> statement-breakpoint
CREATE TYPE "public"."token_scope" AS ENUM('read', 'author', 'relay');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"source" text NOT NULL,
	"projection" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone,
	CONSTRAINT "documents_project_id_path_pk" PRIMARY KEY("project_id","path")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"project_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_project_id_seq_pk" PRIMARY KEY("project_id","seq")
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"project_id" text NOT NULL,
	"note_id" text NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "leases_project_id_note_id_pk" PRIMARY KEY("project_id","note_id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" text NOT NULL,
	"account_id" text NOT NULL,
	"role" "project_role" NOT NULL,
	CONSTRAINT "project_members_project_id_account_id_pk" PRIMARY KEY("project_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"repo_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"hash" text NOT NULL,
	"actor" text NOT NULL,
	"scopes" "token_scope"[] NOT NULL,
	"reach" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_slug_idx" ON "projects" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "session_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_hash_idx" ON "tokens" USING btree ("hash");