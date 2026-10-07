CREATE TABLE "listening" (
	"project_id" text NOT NULL,
	"session" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listening_project_id_session_pk" PRIMARY KEY("project_id","session")
);
--> statement-breakpoint
ALTER TABLE "listening" ADD CONSTRAINT "listening_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;