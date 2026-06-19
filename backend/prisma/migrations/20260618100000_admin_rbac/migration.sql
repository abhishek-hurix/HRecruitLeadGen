-- AlterEnum AdminRole
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- CreateEnum SelectionStatus
CREATE TYPE "SelectionStatus" AS ENUM ('PENDING', 'SELECTED', 'REJECTED');

-- AlterTable candidate_profiles
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "selection_status" "SelectionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable admin_users
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "updated_by" TEXT,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "platform_settings" ("key", "value", "updated_at") VALUES
  ('assessment_question_count', '10', NOW()),
  ('assessment_duration_minutes', '60', NOW())
ON CONFLICT ("key") DO NOTHING;
