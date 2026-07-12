-- Phase 2: Candidate owner + last activity denormalization

ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "owner_admin_id" TEXT,
  ADD COLUMN IF NOT EXISTS "owner_assigned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "owner_assigned_by_admin_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_activity_type" TEXT;

DO $$ BEGIN
  ALTER TABLE "candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_owner_admin_id_fkey"
    FOREIGN KEY ("owner_admin_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_owner_assigned_by_admin_id_fkey"
    FOREIGN KEY ("owner_assigned_by_admin_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "candidate_profiles_owner_admin_id_deleted_at_idx"
  ON "candidate_profiles"("owner_admin_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_last_activity_at_deleted_at_idx"
  ON "candidate_profiles"("last_activity_at", "deleted_at");

-- Seed last_activity_at from created_at where missing
UPDATE "candidate_profiles"
SET "last_activity_at" = "created_at",
    "last_activity_type" = 'REGISTERED'
WHERE "last_activity_at" IS NULL;
