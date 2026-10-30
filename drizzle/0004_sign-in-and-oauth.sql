CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"challenge" text NOT NULL,
	"account_id" text NOT NULL,
	"scopes" "token_scope"[] NOT NULL,
	"reach" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"family" text NOT NULL,
	"hash" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"account_id" text NOT NULL,
	"scopes" "token_scope"[] NOT NULL,
	"reach" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_links" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"account_id" text NOT NULL,
	"refresh" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_links_issuer_subject_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "sign_in_requests" (
	"state" text PRIMARY KEY NOT NULL,
	"verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"next" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "grant_id" text;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_links" ADD CONSTRAINT "provider_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_grant_hash_idx" ON "oauth_grants" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "oauth_grant_family_idx" ON "oauth_grants" USING btree ("family");--> statement-breakpoint
CREATE INDEX "oauth_grant_account_idx" ON "oauth_grants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "provider_link_account_idx" ON "provider_links" USING btree ("account_id");