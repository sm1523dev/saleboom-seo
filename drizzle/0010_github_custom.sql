-- Add "github" value to cms_type enum
ALTER TYPE "cms_type" ADD VALUE IF NOT EXISTS 'github';

-- Add PR tracking columns to change_snapshots
ALTER TABLE "change_snapshots"
  ADD COLUMN IF NOT EXISTS "pr_url"    text,
  ADD COLUMN IF NOT EXISTS "pr_number" integer,
  ADD COLUMN IF NOT EXISTS "merge_sha" text;
