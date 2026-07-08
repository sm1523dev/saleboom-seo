DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user';
