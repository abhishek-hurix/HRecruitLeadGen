-- Candidate Management data hardening (Low Priority only)
-- Additive + staged backfill. Safe to re-run sections that use IF NOT EXISTS.
-- CandidateActivity / CandidateActivityType already applied in 20260713160000_candidate_activity.
-- Rollback notes at bottom.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "CandidateCreationSource" AS ENUM ('SELF_REGISTERED', 'ADMIN_CREATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. User normalized email
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "normalized_email" TEXT;

UPDATE "users"
SET "normalized_email" = lower(trim("email"))
WHERE "normalized_email" IS NULL
  AND "email" IS NOT NULL;

-- Unique only when populated and distinct; duplicates reported by validation script
CREATE UNIQUE INDEX IF NOT EXISTS "users_normalized_email_key"
  ON "users"("normalized_email")
  WHERE "normalized_email" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "users_normalized_email_idx"
  ON "users"("normalized_email");

-- ---------------------------------------------------------------------------
-- 3. Candidate profile: application id, manual fields, creation source
-- ---------------------------------------------------------------------------
ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "application_id" CHAR(8),
  ADD COLUMN IF NOT EXISTS "current_company" TEXT,
  ADD COLUMN IF NOT EXISTS "current_designation" TEXT,
  ADD COLUMN IF NOT EXISTS "notice_period" TEXT,
  ADD COLUMN IF NOT EXISTS "expected_salary_amount" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "expected_salary_currency" VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "source_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_detail" TEXT,
  ADD COLUMN IF NOT EXISTS "creation_source" "CandidateCreationSource" NOT NULL DEFAULT 'SELF_REGISTERED',
  ADD COLUMN IF NOT EXISTS "created_by_admin_id" TEXT;

-- Persist Application ID from existing UUID convention (first 8 hex chars without hyphens)
UPDATE "candidate_profiles"
SET "application_id" = upper(substr(replace("id"::text, '-', ''), 1, 8))
WHERE "application_id" IS NULL;

-- Resolve rare collisions by appending a deterministic hex nibble from the next char
-- (validation script will flag any remaining duplicates before unique index).
WITH dups AS (
  SELECT "application_id"
  FROM "candidate_profiles"
  WHERE "application_id" IS NOT NULL
  GROUP BY "application_id"
  HAVING COUNT(*) > 1
)
UPDATE "candidate_profiles" cp
SET "application_id" = upper(substr(replace(cp."id"::text, '-', ''), 2, 8))
WHERE cp."application_id" IN (SELECT "application_id" FROM dups)
  AND cp."id" <> (
    SELECT min(c2."id") FROM "candidate_profiles" c2 WHERE c2."application_id" = cp."application_id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_application_id_key"
  ON "candidate_profiles"("application_id")
  WHERE "application_id" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_created_by_admin_id_fkey"
    FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "candidate_profiles_creation_source_idx"
  ON "candidate_profiles"("creation_source");

CREATE INDEX IF NOT EXISTS "candidate_profiles_created_by_admin_id_idx"
  ON "candidate_profiles"("created_by_admin_id");

-- ---------------------------------------------------------------------------
-- 4. Resume metadata enrichment (keep legacy file_path)
-- ---------------------------------------------------------------------------
ALTER TABLE "candidate_resumes"
  ADD COLUMN IF NOT EXISTS "storage_bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "storage_path" TEXT,
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "uploaded_by_admin_id" TEXT,
  ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMP(3);

UPDATE "candidate_resumes"
SET "storage_path" = "file_path",
    "mime_type" = COALESCE("mime_type", 'application/pdf'),
    "uploaded_at" = COALESCE("uploaded_at", "created_at")
WHERE "storage_path" IS NULL;

DO $$ BEGIN
  ALTER TABLE "candidate_resumes"
    ADD CONSTRAINT "candidate_resumes_uploaded_by_admin_id_fkey"
    FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "candidate_resumes_uploaded_by_admin_id_idx"
  ON "candidate_resumes"("uploaded_by_admin_id");

-- ---------------------------------------------------------------------------
-- 5. Supporting indexes for LP search/create (additive only; skip if already present)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "candidate_profiles_phone_country_iso_deleted_at_idx"
  ON "candidate_profiles"("phone_country_iso", "deleted_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_years_of_experience_idx"
  ON "candidate_profiles"("years_of_experience");

CREATE INDEX IF NOT EXISTS "candidate_profiles_latest_score_idx"
  ON "candidate_profiles"("latest_score");

CREATE INDEX IF NOT EXISTS "job_roles_title_idx" ON "job_roles"("title");

CREATE INDEX IF NOT EXISTS "submissions_candidate_id_submitted_at_idx"
  ON "submissions"("candidate_id", "submitted_at");

CREATE INDEX IF NOT EXISTS "submission_answers_question_id_idx"
  ON "submission_answers"("question_id");

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   ALTER TABLE candidate_resumes DROP COLUMN IF EXISTS storage_bucket, storage_path, mime_type, size_bytes, uploaded_by_admin_id, uploaded_at;
--   ALTER TABLE candidate_profiles DROP COLUMN IF EXISTS application_id, current_company, current_designation, notice_period, expected_salary_amount, expected_salary_currency, source_type, source_detail, creation_source, created_by_admin_id;
--   ALTER TABLE users DROP COLUMN IF EXISTS normalized_email;
--   DROP TYPE IF EXISTS "CandidateCreationSource";
-- Do NOT drop phone_country / resume file_path (legacy preserved).
-- Do NOT drop candidate_activities (owned by MP migration 160000).
-- ---------------------------------------------------------------------------
