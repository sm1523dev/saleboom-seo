ALTER TABLE "websites"
  ADD COLUMN IF NOT EXISTS "platform_hint"        text,
  ADD COLUMN IF NOT EXISTS "platform_hint_status" text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN IF NOT EXISTS "wrong_detection_count" integer NOT NULL DEFAULT 0;
