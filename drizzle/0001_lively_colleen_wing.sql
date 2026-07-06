-- Idempotent migration — safe to run on databases created with db:push
ALTER TYPE "public"."change_status" ADD VALUE IF NOT EXISTS 'rolled_back';
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" DROP CONSTRAINT "change_snapshots_issue_id_issues_id_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" DROP CONSTRAINT "change_snapshots_cms_connection_id_cms_connections_id_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "change_snapshots" ALTER COLUMN "issue_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "change_snapshots" ALTER COLUMN "cms_connection_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "page_url" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "field_changed" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "rolled_back_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "suggestion_id" uuid;
--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_suggestion_id_ai_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."ai_suggestions"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_cms_connection_id_cms_connections_id_fk" FOREIGN KEY ("cms_connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_snapshots_page_url_idx" ON "change_snapshots" USING btree ("page_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_snapshots_status_idx" ON "change_snapshots" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_snapshots_suggestion_id_idx" ON "change_snapshots" USING btree ("suggestion_id");
