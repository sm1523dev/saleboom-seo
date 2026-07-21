ALTER TYPE "infra_provider_type" ADD VALUE IF NOT EXISTS 'major_fix';

ALTER TABLE "provider_requests"
  ADD COLUMN IF NOT EXISTS "issue_id"   uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "website_id" uuid REFERENCES "websites"("id") ON DELETE SET NULL;
