-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'BOTH');
CREATE TYPE "CandidateStatus" AS ENUM ('REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED');
CREATE TYPE "CandidateAssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- AlterTable users
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
CREATE INDEX "users_google_id_idx" ON "users"("google_id");

-- AlterTable candidate_profiles
ALTER TABLE "candidate_profiles" ADD COLUMN "candidate_status" "CandidateStatus" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "candidate_profiles" ADD COLUMN "assessment_status" "CandidateAssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "candidate_profiles" ADD COLUMN "assessment_date" TIMESTAMP(3);

-- Backfill candidate status from existing data
UPDATE "candidate_profiles" cp
SET
  "candidate_status" = CASE
    WHEN EXISTS (SELECT 1 FROM submissions s WHERE s.candidate_id = cp.id) THEN 'SUBMITTED'::"CandidateStatus"
    WHEN EXISTS (SELECT 1 FROM assessments a WHERE a.candidate_id = cp.id AND a.status = 'IN_PROGRESS') THEN 'STARTED'::"CandidateStatus"
    WHEN cp.email_verified = true THEN 'VERIFIED'::"CandidateStatus"
    WHEN EXISTS (SELECT 1 FROM assessment_tokens t WHERE t.candidate_id = cp.id AND t.status = 'EMAIL_SENT') THEN 'EMAIL_SENT'::"CandidateStatus"
    ELSE 'REGISTERED'::"CandidateStatus"
  END,
  "assessment_status" = CASE
    WHEN EXISTS (SELECT 1 FROM submissions s WHERE s.candidate_id = cp.id) THEN 'SUBMITTED'::"CandidateAssessmentStatus"
    WHEN EXISTS (SELECT 1 FROM assessments a WHERE a.candidate_id = cp.id AND a.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'::"CandidateAssessmentStatus"
    ELSE 'NOT_STARTED'::"CandidateAssessmentStatus"
  END,
  "assessment_date" = COALESCE(
    (SELECT s.submitted_at FROM submissions s WHERE s.candidate_id = cp.id ORDER BY s.submitted_at DESC LIMIT 1),
    (SELECT a.started_at FROM assessments a WHERE a.candidate_id = cp.id ORDER BY a.started_at DESC LIMIT 1)
  );
