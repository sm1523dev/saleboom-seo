DO $$ BEGIN
  CREATE TYPE "provider_request_status" AS ENUM ('pending', 'in_progress', 'rejected', 'ready');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "provider_requests" (
  "id"               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  "type"             "infra_provider_type" NOT NULL,
  "provider_name"    varchar(100) NOT NULL,
  "reason"           text,
  "requested_by"     uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "developer_email"  text,
  "admin_note"       text,
  "status"           "provider_request_status" NOT NULL DEFAULT 'pending',
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  "deleted_at"       timestamptz
);

CREATE INDEX IF NOT EXISTS "provider_requests_status_idx" ON "provider_requests"("status");
