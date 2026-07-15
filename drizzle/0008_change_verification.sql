ALTER TABLE "change_snapshots"
  ADD COLUMN IF NOT EXISTS "verified_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "live_value"     text,
  ADD COLUMN IF NOT EXISTS "verify_error"   text;
