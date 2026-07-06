ALTER TYPE "public"."change_status" ADD VALUE 'rolled_back';--> statement-breakpoint
ALTER TABLE "change_snapshots" DROP CONSTRAINT "change_snapshots_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "change_snapshots" DROP CONSTRAINT "change_snapshots_cms_connection_id_cms_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "change_snapshots" ALTER COLUMN "issue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "change_snapshots" ALTER COLUMN "cms_connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "page_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "field_changed" text NOT NULL;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "rolled_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "suggestion_id" uuid;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_suggestion_id_ai_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."ai_suggestions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD CONSTRAINT "change_snapshots_cms_connection_id_cms_connections_id_fk" FOREIGN KEY ("cms_connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_snapshots_page_url_idx" ON "change_snapshots" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "change_snapshots_status_idx" ON "change_snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "change_snapshots_suggestion_id_idx" ON "change_snapshots" USING btree ("suggestion_id");