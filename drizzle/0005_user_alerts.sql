DO $$ BEGIN
  CREATE TYPE "public"."alert_type" AS ENUM('aeo_mention_drop', 'aeo_sentiment_spike', 'scan_failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "website_id" uuid NOT NULL REFERENCES "websites"("id") ON DELETE CASCADE,
  "type" "alert_type" NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_alerts_user_id_idx" ON "user_alerts"("user_id");
CREATE INDEX IF NOT EXISTS "user_alerts_website_id_idx" ON "user_alerts"("website_id");
CREATE INDEX IF NOT EXISTS "user_alerts_read_at_idx" ON "user_alerts"("read_at");
