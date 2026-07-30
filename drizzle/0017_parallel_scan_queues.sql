-- Separate SEO (Firecrawl) and AEO (NIM) phases so they run in parallel.
-- ai_triggered_at acts as a DB-level lock: the first phase to complete that
-- satisfies the join condition owns the lock and enqueues the ai-suggest job.
ALTER TABLE "scans"
  ADD COLUMN IF NOT EXISTS "seo_completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "aeo_completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "ai_triggered_at"  timestamptz,
  ADD COLUMN IF NOT EXISTS "aeo_expected"     boolean NOT NULL DEFAULT false;
