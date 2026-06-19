-- Allow one login email/user to submit assessments for multiple job roles.
DROP INDEX IF EXISTS "candidate_profiles_user_id_key";

CREATE INDEX IF NOT EXISTS "candidate_profiles_user_id_idx" ON "candidate_profiles"("user_id");
