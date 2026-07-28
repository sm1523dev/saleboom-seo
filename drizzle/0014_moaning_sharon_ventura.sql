ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "pr_comment_count" integer;--> statement-breakpoint
ALTER TABLE "change_snapshots" ADD COLUMN IF NOT EXISTS "pr_review_state" text;
