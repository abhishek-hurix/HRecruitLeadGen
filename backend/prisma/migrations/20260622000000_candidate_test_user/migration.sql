-- Enterprise test candidate management
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "is_test_user" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "test_user_marked_at" TIMESTAMP(3);
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "test_user_marked_by" TEXT;

CREATE INDEX IF NOT EXISTS "candidate_profiles_is_test_user_idx" ON "candidate_profiles"("is_test_user");
