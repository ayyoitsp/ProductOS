CREATE TABLE "document_migrations" (
	"project_id" text NOT NULL,
	"migration_id" text NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_migrations_project_id_migration_id_pk" PRIMARY KEY("project_id","migration_id")
);
--> statement-breakpoint
ALTER TABLE "document_migrations" ADD CONSTRAINT "document_migrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;