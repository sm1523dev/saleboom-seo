-- Add missing deleted_at column to notification_channels (timestamps helper includes it)
ALTER TABLE "notification_channels"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
