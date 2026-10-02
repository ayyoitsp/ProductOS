CREATE TYPE "public"."claim_origin" AS ENUM('authored', 'baseline');--> statement-breakpoint
CREATE TYPE "public"."container_kind" AS ENUM('feature', 'capability');--> statement-breakpoint
CREATE TYPE "public"."context_kind" AS ENUM('goal', 'principle', 'persona', 'non_goal', 'voice', 'glossary');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('active', 'under_review', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."edge_kind" AS ENUM('depends_on', 'uses', 'affected_by', 'decided_by', 'implements');--> statement-breakpoint
CREATE TYPE "public"."lifecycle" AS ENUM('planned', 'built', 'retired');--> statement-breakpoint
CREATE TYPE "public"."signal_kind" AS ENUM('check_failed', 'contradiction', 'duplicate', 'challenge', 'code_changed');--> statement-breakpoint
CREATE TYPE "public"."validation_provenance" AS ENUM('human', 'self_heal');--> statement-breakpoint
CREATE TABLE "behaviors" (
	"container_id" text NOT NULL,
	"id" text NOT NULL,
	"claim" text NOT NULL,
	"notes" text,
	"lifecycle" "lifecycle" DEFAULT 'planned' NOT NULL,
	"origin" "claim_origin" DEFAULT 'authored' NOT NULL,
	"origin_detail" text,
	"surface_id" text,
	"element_id" text,
	"interaction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone,
	"deprecated_reason" text,
	CONSTRAINT "behaviors_container_id_id_pk" PRIMARY KEY("container_id","id")
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "container_kind" NOT NULL,
	"title" text NOT NULL,
	"area" text NOT NULL,
	"description" text,
	"lifecycle" "lifecycle" DEFAULT 'planned' NOT NULL,
	"owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "context_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "context_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "decision_status" DEFAULT 'active' NOT NULL,
	"decided_on" timestamp with time zone NOT NULL,
	"owner" text,
	"context" text NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen" text NOT NULL,
	"body" text,
	"revisit_after" timestamp with time zone,
	"reaffirmed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"superseded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"kind" "edge_kind" NOT NULL,
	"from_type" text NOT NULL,
	"from_id" text NOT NULL,
	"to_type" text NOT NULL,
	"to_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elements" (
	"surface_id" text NOT NULL,
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"notes" text,
	"leads_to" text,
	"deprecated_at" timestamp with time zone,
	CONSTRAINT "elements_surface_id_id_pk" PRIMARY KEY("surface_id","id")
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "signal_kind" NOT NULL,
	"container_id" text NOT NULL,
	"behavior_id" text,
	"summary" text NOT NULL,
	"detail" jsonb,
	"source" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surfaces" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"path" text,
	"sketch" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"container_id" text NOT NULL,
	"behavior_id" text NOT NULL,
	"number" integer NOT NULL,
	"description" text NOT NULL,
	"given" text,
	"when" text,
	"then" text,
	"deprecated_at" timestamp with time zone,
	"replaced_by" integer,
	CONSTRAINT "test_cases_container_id_behavior_id_number_pk" PRIMARY KEY("container_id","behavior_id","number")
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" text PRIMARY KEY NOT NULL,
	"container_id" text NOT NULL,
	"behavior_id" text NOT NULL,
	"provenance" "validation_provenance" NOT NULL,
	"reason" text,
	"actor" text NOT NULL,
	"claim_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "behaviors" ADD CONSTRAINT "behaviors_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behaviors" ADD CONSTRAINT "behaviors_surface_id_surfaces_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."surfaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements" ADD CONSTRAINT "elements_surface_id_surfaces_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."surfaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elements" ADD CONSTRAINT "elements_leads_to_surfaces_id_fk" FOREIGN KEY ("leads_to") REFERENCES "public"."surfaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "behavior_surface_idx" ON "behaviors" USING btree ("surface_id");--> statement-breakpoint
CREATE INDEX "container_kind_idx" ON "containers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "container_area_idx" ON "containers" USING btree ("area");--> statement-breakpoint
CREATE INDEX "context_kind_idx" ON "context_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "decision_status_idx" ON "decisions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "edge_unique" ON "edges" USING btree ("kind","from_type","from_id","to_type","to_id");--> statement-breakpoint
CREATE INDEX "edge_from_idx" ON "edges" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "edge_to_idx" ON "edges" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "signal_behavior_idx" ON "signals" USING btree ("container_id","behavior_id");--> statement-breakpoint
CREATE INDEX "signal_open_idx" ON "signals" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "validation_behavior_idx" ON "validations" USING btree ("container_id","behavior_id");