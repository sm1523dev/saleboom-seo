ALTER TABLE "change_snapshots"
  ADD COLUMN IF NOT EXISTS "quality_flagged"        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quality_flag_comment"   text,
  ADD COLUMN IF NOT EXISTS "quality_flagged_at"     timestamp with time zone;

ALTER TABLE "cms_connections"
  ADD COLUMN IF NOT EXISTS "wrong_framework_count"  integer NOT NULL DEFAULT 0;
