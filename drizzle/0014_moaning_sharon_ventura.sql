CREATE TYPE "public"."alert_type" AS ENUM('aeo_mention_drop', 'aeo_sentiment_spike', 'scan_failed');--> statement-breakpoint
CREATE TYPE "public"."infra_provider_type" AS ENUM('ai', 'crawl', 'queue', 'storage', 'notifications', 'major_fix');--> statement-breakpoint
CREATE TYPE "public"."infra_switch_mode" AS ENUM('runtime', 'restart', 'redeploy');--> statement-breakpoint
CREATE TYPE "public"."provider_request_status" AS ENUM('pending', 'in_progress', 'rejected', 'ready');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
ALTER TYPE "public"."cms_type" ADD VALUE 'github';--> statement-breakpoint
CREATE TABLE "infra_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "infra_provider_type" NOT NULL,
	"name" varchar(50) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"encrypted_key_blob" text,
	"switch_mode" "infra_switch_mode" DEFAULT 'runtime' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infra_providers_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "provider_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "infra_provider_type" NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"reason" text,
	"requested_by" uuid NOT NULL,
	"developer_email" text,
	"admin_note" text,
	"status" "provider_request_status" DEFAULT 'pending' NOT NULL,
	"issue_id" uuid,
	"website_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aeo_providers" ADD COLUMN "encrypted_key_blob" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "live_value" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "verify_error" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "pr_url" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "pr_number" integer;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "merge_sha" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "pr_comment_count" integer;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "pr_review_state" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "quality_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "quality_flag_comment" text;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "quality_flagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cms_connections" ADD COLUMN "capabilities" jsonb;--> statement-breakpoint
ALTER TABLE "cms_connections" ADD COLUMN "wrong_framework_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "platform_hint" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "platform_hint_status" text DEFAULT 'unconfirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "wrong_detection_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_requests_status_idx" ON "provider_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_alerts_user_id_idx" ON "user_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_alerts_website_id_idx" ON "user_alerts" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "user_alerts_read_at_idx" ON "user_alerts" USING btree ("read_at");