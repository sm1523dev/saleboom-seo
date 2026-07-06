-- Idempotent baseline migration — safe to run on both fresh and existing databases.
-- Uses IF NOT EXISTS / exception handling throughout so it never fails on already-created objects.

DO $$ BEGIN CREATE TYPE "public"."aeo_sentiment" AS ENUM('positive', 'neutral', 'negative'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."change_status" AS ENUM('pending', 'applied', 'failed', 'reverted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cms_type" AS ENUM('wordpress', 'shopify', 'webflow', 'contentful', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."fix_type" AS ENUM('quick', 'major'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."scan_status" AS ENUM('pending', 'running', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'dismissed', 'applied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255),
	"tenant_id" varchar(255),
	"avatar_url" text,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"raw_crawl" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"severity" "severity" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"fix_type" "fix_type",
	"resolved_at" timestamp with time zone,
	"ignored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"page_url" text NOT NULL,
	"current_meta_title" text,
	"current_meta_description" text,
	"current_h1" text,
	"meta_title" text,
	"meta_description" text,
	"h1" text,
	"model" varchar(100),
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"latency_ms" integer,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"dismissed_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aeo_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"provider_type" varchar(30) NOT NULL,
	"endpoint_url" text,
	"api_key_env_var" varchar(100),
	"model" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "aeo_providers_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aeo_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"category_tag" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aeo_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"query_id" uuid NOT NULL,
	"scan_date" date NOT NULL,
	"brand_mentioned" boolean NOT NULL,
	"position_bucket" varchar(20),
	"sentiment" "aeo_sentiment",
	"surrounding_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aeo_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"query_id" uuid NOT NULL,
	"scan_date" date NOT NULL,
	"cited_url" text NOT NULL,
	"is_own_domain" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aeo_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"scored_at" timestamp with time zone NOT NULL,
	"signal1_rate" real NOT NULL,
	"signal2_index" real NOT NULL,
	"signal3_rate" real NOT NULL,
	"composite_score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"referrer_platform" varchar(60) NOT NULL,
	"landing_path" text NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "change_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"cms_connection_id" uuid NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"status" "change_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"cms_type" "cms_type" NOT NULL,
	"credentials_ref" varchar(500),
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dvs_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"scored_at" timestamp with time zone NOT NULL,
	"seo_score" real NOT NULL,
	"aeo_score" real NOT NULL,
	"composite_score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metrics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"value" real,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Add new columns to scans — safe on existing DB (IF NOT EXISTS) and fresh DB (no-op if already created above)
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "pages_scanned" integer;
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "total_pages" integer;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "websites" ADD CONSTRAINT "websites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "scans" ADD CONSTRAINT "scans_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "issues" ADD CONSTRAINT "issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_queries" ADD CONSTRAINT "aeo_queries_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_mentions" ADD CONSTRAINT "aeo_mentions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_mentions" ADD CONSTRAINT "aeo_mentions_provider_id_aeo_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."aeo_providers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_mentions" ADD CONSTRAINT "aeo_mentions_query_id_aeo_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."aeo_queries"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_citations" ADD CONSTRAINT "aeo_citations_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_citations" ADD CONSTRAINT "aeo_citations_provider_id_aeo_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."aeo_providers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_citations" ADD CONSTRAINT "aeo_citations_query_id_aeo_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."aeo_queries"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "aeo_scores" ADD CONSTRAINT "aeo_scores_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_referrals" ADD CONSTRAINT "ai_referrals_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_cms_connection_id_cms_connections_id_fk" FOREIGN KEY ("cms_connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "cms_connections" ADD CONSTRAINT "cms_connections_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dvs_scores" ADD CONSTRAINT "dvs_scores_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "websites_user_id_idx" ON "websites" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_website_id_idx" ON "scans" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_scan_id_idx" ON "issues" USING btree ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_severity_idx" ON "issues" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_scan_id_idx" ON "ai_suggestions" USING btree ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_website_id_idx" ON "ai_suggestions" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_page_url_idx" ON "ai_suggestions" USING btree ("page_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_providers_enabled_idx" ON "aeo_providers" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_queries_website_id_idx" ON "aeo_queries" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_mentions_website_id_idx" ON "aeo_mentions" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_mentions_provider_id_idx" ON "aeo_mentions" USING btree ("provider_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aeo_mentions_provider_query_date_idx" ON "aeo_mentions" USING btree ("provider_id","query_id","scan_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_citations_website_id_idx" ON "aeo_citations" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_citations_provider_id_idx" ON "aeo_citations" USING btree ("provider_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_citations_is_own_domain_idx" ON "aeo_citations" USING btree ("is_own_domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_scores_website_id_idx" ON "aeo_scores" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aeo_scores_scored_at_idx" ON "aeo_scores" USING btree ("scored_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_referrals_website_id_idx" ON "ai_referrals" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_referrals_visited_at_idx" ON "ai_referrals" USING btree ("visited_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_referrals_session_idx" ON "ai_referrals" USING btree ("website_id","session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_snapshots_issue_id_idx" ON "change_snapshots" USING btree ("issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_snapshots_cms_id_idx" ON "change_snapshots" USING btree ("cms_connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cms_connections_website_id_idx" ON "cms_connections" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dvs_scores_website_id_idx" ON "dvs_scores" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dvs_scores_scored_at_idx" ON "dvs_scores" USING btree ("scored_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metrics_events_event_idx" ON "metrics_events" USING btree ("event");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metrics_events_created_at_idx" ON "metrics_events" USING btree ("created_at");
