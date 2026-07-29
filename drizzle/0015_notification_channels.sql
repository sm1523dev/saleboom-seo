-- Multi-channel notification routing table
-- Replaces the single Slack webhook in systemSettings
-- Credentials encrypted via encryptSecret (Key Vault on Azure)
CREATE TYPE "notification_channel_type" AS ENUM ('email', 'slack', 'whatsapp');

CREATE TABLE IF NOT EXISTS "notification_channels" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_type"         notification_channel_type NOT NULL,
  "name"                 varchar(100) NOT NULL,
  "provider"             varchar(50) NOT NULL,
  "encrypted_key_blob"   text,
  "config"               jsonb NOT NULL DEFAULT '{}',
  "enabled"              boolean NOT NULL DEFAULT true,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now()
);
