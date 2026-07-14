-- AlterTable (column may already exist in some environments)
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "is_test_user" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_is_test_user_deleted_at_idx" ON "candidate_profiles"("is_test_user", "deleted_at");
