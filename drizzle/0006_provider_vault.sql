-- infra_provider_type enum
DO $$ BEGIN
  CREATE TYPE "infra_provider_type" AS ENUM ('ai', 'crawl', 'queue', 'storage', 'notifications');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- infra_switch_mode enum
DO $$ BEGIN
  CREATE TYPE "infra_switch_mode" AS ENUM ('runtime', 'restart', 'redeploy');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- unified infra providers table (one row per type, updated in-place when switching)
CREATE TABLE IF NOT EXISTS "infra_providers" (
  "id"                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  "type"                "infra_provider_type" NOT NULL UNIQUE,
  "name"                varchar(50) NOT NULL,
  "config"              jsonb       DEFAULT '{}',
  "encrypted_key_blob"  text,
  "switch_mode"         "infra_switch_mode" NOT NULL DEFAULT 'runtime',
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

-- encrypted key column on aeo_providers (prefer over apiKeyEnvVar when set)
ALTER TABLE "aeo_providers"
  ADD COLUMN IF NOT EXISTS "encrypted_key_blob" text;

-- seed current env-var-based infra config as readable rows (no keys yet — admin sets via UI)
INSERT INTO "infra_providers" ("type", "name", "switch_mode") VALUES
  ('ai',            'nim',      'runtime'),
  ('crawl',         'firecrawl','runtime'),
  ('queue',         'bullmq',   'restart'),
  ('storage',       'local',    'restart'),
  ('notifications', 'mock',     'runtime')
ON CONFLICT ("type") DO NOTHING;
