CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE set null
);
