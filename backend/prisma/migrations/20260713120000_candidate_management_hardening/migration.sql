-- Candidate Management schema hardening (additive, production-safe)
-- Depends on: 20260713000000_candidate_management

-- ---------------------------------------------------------------------------
-- A. Enum extensions
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE "InterviewStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- B. CandidateProfile composite indexes (query patterns)
-- registeredAt does not exist; created_at is the registration timestamp.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "candidate_profiles_deleted_at_created_at_idx"
  ON "candidate_profiles"("deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_candidate_status_deleted_at_created_at_idx"
  ON "candidate_profiles"("candidate_status", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_selected_role_id_deleted_at_created_at_idx"
  ON "candidate_profiles"("selected_role_id", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_phone_country_deleted_at_idx"
  ON "candidate_profiles"("phone_country", "deleted_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_assessment_status_deleted_at_idx"
  ON "candidate_profiles"("assessment_status", "deleted_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_full_name_idx"
  ON "candidate_profiles"("full_name");

-- ---------------------------------------------------------------------------
-- C. CandidateRejection history (Super-Admin restricted via services)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "candidate_rejections" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT,
  "candidate_reference" TEXT NOT NULL,
  "rejected_by_admin_id" TEXT,
  "previous_journey_status" TEXT,
  "previous_selection_status" "SelectionStatus",
  "reason" TEXT NOT NULL,
  "rejected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_rejections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "candidate_rejections_candidate_id_idx" ON "candidate_rejections"("candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_rejections_rejected_at_idx" ON "candidate_rejections"("rejected_at");
CREATE INDEX IF NOT EXISTS "candidate_rejections_operation_id_idx" ON "candidate_rejections"("operation_id");
CREATE INDEX IF NOT EXISTS "candidate_rejections_candidate_id_rejected_at_idx"
  ON "candidate_rejections"("candidate_id", "rejected_at");

DO $$ BEGIN
  ALTER TABLE "candidate_rejections" ADD CONSTRAINT "candidate_rejections_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_rejections" ADD CONSTRAINT "candidate_rejections_rejected_by_admin_id_fkey"
    FOREIGN KEY ("rejected_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill rejection history from denormalized candidate snapshot columns
INSERT INTO "candidate_rejections" (
  "id", "candidate_id", "candidate_reference", "rejected_by_admin_id",
  "previous_selection_status", "reason", "rejected_at", "created_at"
)
SELECT
  'rej-backfill-' || cp.id,
  cp.id,
  UPPER(LEFT(REPLACE(cp.id, '-', ''), 8)),
  cp.rejected_by_admin_id,
  cp.previous_selection_status,
  cp.rejection_reason,
  COALESCE(cp.rejected_at, CURRENT_TIMESTAMP),
  COALESCE(cp.rejected_at, CURRENT_TIMESTAMP)
FROM "candidate_profiles" cp
WHERE cp.rejection_reason IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "candidate_rejections" cr WHERE cr.candidate_id = cp.id
  );

-- ---------------------------------------------------------------------------
-- D. AdminBulkOperation hardening
-- ---------------------------------------------------------------------------
ALTER TABLE "admin_bulk_operations" ADD COLUMN IF NOT EXISTS "actor_role" "AdminRole";
ALTER TABLE "admin_bulk_operations" ADD COLUMN IF NOT EXISTS "request_id" TEXT;

CREATE INDEX IF NOT EXISTS "admin_bulk_operations_admin_user_id_created_at_idx"
  ON "admin_bulk_operations"("admin_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_bulk_operations_action_created_at_idx"
  ON "admin_bulk_operations"("action", "created_at");
CREATE INDEX IF NOT EXISTS "admin_bulk_operations_operation_id_idx"
  ON "admin_bulk_operations"("operation_id");

-- Prefer Restrict over Cascade for admin deletion (retain audit parent rows)
DO $$ BEGIN
  ALTER TABLE "admin_bulk_operations" DROP CONSTRAINT IF EXISTS "admin_bulk_operations_admin_user_id_fkey";
  ALTER TABLE "admin_bulk_operations" ADD CONSTRAINT "admin_bulk_operations_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- E. AdminBulkOperationItem — retain after permanent candidate deletion
-- ---------------------------------------------------------------------------
ALTER TABLE "admin_bulk_operation_items" ADD COLUMN IF NOT EXISTS "candidate_reference" TEXT;
ALTER TABLE "admin_bulk_operation_items" ADD COLUMN IF NOT EXISTS "previous_value" JSONB;
ALTER TABLE "admin_bulk_operation_items" ADD COLUMN IF NOT EXISTS "new_value" JSONB;

-- Backfill references before nullability change
UPDATE "admin_bulk_operation_items" i
SET "candidate_reference" = UPPER(LEFT(REPLACE(i.candidate_id, '-', ''), 8))
WHERE i.candidate_id IS NOT NULL AND i.candidate_reference IS NULL;

ALTER TABLE "admin_bulk_operation_items" ALTER COLUMN "candidate_id" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "admin_bulk_operation_items" DROP CONSTRAINT IF EXISTS "admin_bulk_operation_items_candidate_id_fkey";
  ALTER TABLE "admin_bulk_operation_items" ADD CONSTRAINT "admin_bulk_operation_items_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- F. Email reminder templates / deliveries
-- ---------------------------------------------------------------------------
ALTER TABLE "email_reminder_templates" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'REMINDER';
ALTER TABLE "email_reminder_templates" ADD COLUMN IF NOT EXISTS "updated_by_id" TEXT;

CREATE INDEX IF NOT EXISTS "email_reminder_templates_type_is_active_idx"
  ON "email_reminder_templates"("type", "is_active");

DO $$ BEGIN
  ALTER TABLE "email_reminder_templates" ADD CONSTRAINT "email_reminder_templates_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "email_reminder_deliveries" ADD COLUMN IF NOT EXISTS "candidate_reference" TEXT;
ALTER TABLE "email_reminder_deliveries" ADD COLUMN IF NOT EXISTS "error_code" TEXT;
ALTER TABLE "email_reminder_deliveries" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "email_reminder_deliveries" d
SET "candidate_reference" = UPPER(LEFT(REPLACE(d.candidate_id, '-', ''), 8))
WHERE d.candidate_id IS NOT NULL AND d.candidate_reference IS NULL;

ALTER TABLE "email_reminder_deliveries" ALTER COLUMN "candidate_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "email_reminder_deliveries_status_idx" ON "email_reminder_deliveries"("status");
CREATE INDEX IF NOT EXISTS "email_reminder_deliveries_created_at_idx" ON "email_reminder_deliveries"("created_at");
CREATE INDEX IF NOT EXISTS "email_reminder_deliveries_candidate_id_created_at_idx"
  ON "email_reminder_deliveries"("candidate_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" DROP CONSTRAINT IF EXISTS "email_reminder_deliveries_candidate_id_fkey";
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" DROP CONSTRAINT IF EXISTS "email_reminder_deliveries_template_id_fkey";
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "email_reminder_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" DROP CONSTRAINT IF EXISTS "email_reminder_deliveries_admin_user_id_fkey";
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- G. Interviews
-- ---------------------------------------------------------------------------
ALTER TABLE "candidate_interviews" ADD COLUMN IF NOT EXISTS "operation_id" TEXT;
ALTER TABLE "candidate_interviews" ADD COLUMN IF NOT EXISTS "calendar_provider" TEXT NOT NULL DEFAULT 'GOOGLE';
ALTER TABLE "candidate_interviews" ADD COLUMN IF NOT EXISTS "failure_code" TEXT;

CREATE INDEX IF NOT EXISTS "candidate_interviews_scheduled_by_admin_id_created_at_idx"
  ON "candidate_interviews"("scheduled_by_admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "candidate_interviews_operation_id_idx"
  ON "candidate_interviews"("operation_id");

-- Unique google event id (NULLs allowed / distinct in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_interviews_google_event_id_key"
  ON "candidate_interviews"("google_event_id");

DO $$ BEGIN
  ALTER TABLE "candidate_interviews" DROP CONSTRAINT IF EXISTS "candidate_interviews_scheduled_by_admin_id_fkey";
  ALTER TABLE "candidate_interviews" ADD CONSTRAINT "candidate_interviews_scheduled_by_admin_id_fkey"
    FOREIGN KEY ("scheduled_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE "candidate_interview_participants" ADD COLUMN IF NOT EXISTS "candidate_reference" TEXT;

UPDATE "candidate_interview_participants" p
SET "candidate_reference" = UPPER(LEFT(REPLACE(p.candidate_id, '-', ''), 8))
WHERE p.candidate_id IS NOT NULL AND p.candidate_reference IS NULL;

ALTER TABLE "candidate_interview_participants" ALTER COLUMN "candidate_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "candidate_interview_participants_candidate_id_start_utc_idx"
  ON "candidate_interview_participants"("candidate_id", "start_utc");

DO $$ BEGIN
  ALTER TABLE "candidate_interview_participants" DROP CONSTRAINT IF EXISTS "candidate_interview_participants_candidate_id_fkey";
  ALTER TABLE "candidate_interview_participants" ADD CONSTRAINT "candidate_interview_participants_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- H. Admin Google Calendar connection hardening
-- ---------------------------------------------------------------------------
ALTER TABLE "admin_google_calendars" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'GOOGLE';
ALTER TABLE "admin_google_calendars" ADD COLUMN IF NOT EXISTS "granted_scopes" TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/calendar.events';
ALTER TABLE "admin_google_calendars" ADD COLUMN IF NOT EXISTS "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "admin_google_calendars" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Replace single-admin unique with admin+provider+account unique
DROP INDEX IF EXISTS "admin_google_calendars_admin_user_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "admin_google_calendars_admin_user_id_provider_google_email_key"
  ON "admin_google_calendars"("admin_user_id", "provider", "google_email");

CREATE INDEX IF NOT EXISTS "admin_google_calendars_admin_user_id_status_idx"
  ON "admin_google_calendars"("admin_user_id", "status");

-- ---------------------------------------------------------------------------
-- I. Idempotency records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "operation_type" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_body" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_admin_user_id_operation_type_key_key"
  ON "idempotency_records"("admin_user_id", "operation_type", "key");
CREATE INDEX IF NOT EXISTS "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
CREATE INDEX IF NOT EXISTS "idempotency_records_created_at_idx" ON "idempotency_records"("created_at");

DO $$ BEGIN
  ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
