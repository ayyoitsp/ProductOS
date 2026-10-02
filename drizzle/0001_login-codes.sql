CREATE TABLE "login_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "login_code_email_idx" ON "login_codes" USING btree ("email");