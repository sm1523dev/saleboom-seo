ALTER TABLE "cms_connections"
  ADD COLUMN IF NOT EXISTS "capabilities" jsonb;
