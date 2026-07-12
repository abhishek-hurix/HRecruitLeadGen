-- Candidate management: soft delete, rejection, bulk ops, reminders, interviews

-- Soft delete + rejection fields
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "deleted_by_admin_id" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP(3);
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "restored_by_admin_id" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "rejected_by_admin_id" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "previous_selection_status" "SelectionStatus";

CREATE INDEX IF NOT EXISTS "candidate_profiles_deleted_at_idx" ON "candidate_profiles"("deleted_at");
CREATE INDEX IF NOT EXISTS "candidate_profiles_selection_status_idx" ON "candidate_profiles"("selection_status");
CREATE INDEX IF NOT EXISTS "candidate_profiles_candidate_status_idx" ON "candidate_profiles"("candidate_status");
CREATE INDEX IF NOT EXISTS "candidate_profiles_created_at_idx" ON "candidate_profiles"("created_at");

DO $$ BEGIN
  ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_deleted_by_admin_id_fkey"
    FOREIGN KEY ("deleted_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_restored_by_admin_id_fkey"
    FOREIGN KEY ("restored_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_rejected_by_admin_id_fkey"
    FOREIGN KEY ("rejected_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enums
DO $$ BEGIN
  CREATE TYPE "BulkOperationAction" AS ENUM (
    'STATUS_CHANGE', 'REMINDER', 'ASSIGN_ROLE', 'REJECT', 'SOFT_DELETE',
    'RESTORE', 'PERMANENT_DELETE', 'EXPORT', 'SCHEDULE_INTERVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BulkOperationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReminderDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InterviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InterviewMode" AS ENUM ('SINGLE', 'GROUP', 'SEQUENTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bulk operations
CREATE TABLE IF NOT EXISTS "admin_bulk_operations" (
  "id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "action" "BulkOperationAction" NOT NULL,
  "status" "BulkOperationStatus" NOT NULL DEFAULT 'PENDING',
  "admin_user_id" TEXT NOT NULL,
  "selection_mode" TEXT NOT NULL,
  "filter_snapshot" JSONB,
  "excluded_count" INTEGER NOT NULL DEFAULT 0,
  "requested_count" INTEGER NOT NULL DEFAULT 0,
  "succeeded_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "error_summary" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "admin_bulk_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_bulk_operations_operation_id_key" ON "admin_bulk_operations"("operation_id");
CREATE INDEX IF NOT EXISTS "admin_bulk_operations_admin_user_id_idx" ON "admin_bulk_operations"("admin_user_id");
CREATE INDEX IF NOT EXISTS "admin_bulk_operations_action_idx" ON "admin_bulk_operations"("action");
CREATE INDEX IF NOT EXISTS "admin_bulk_operations_created_at_idx" ON "admin_bulk_operations"("created_at");

DO $$ BEGIN
  ALTER TABLE "admin_bulk_operations" ADD CONSTRAINT "admin_bulk_operations_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "admin_bulk_operation_items" (
  "id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_bulk_operation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_bulk_operation_items_operation_id_idx" ON "admin_bulk_operation_items"("operation_id");
CREATE INDEX IF NOT EXISTS "admin_bulk_operation_items_candidate_id_idx" ON "admin_bulk_operation_items"("candidate_id");

DO $$ BEGIN
  ALTER TABLE "admin_bulk_operation_items" ADD CONSTRAINT "admin_bulk_operation_items_operation_id_fkey"
    FOREIGN KEY ("operation_id") REFERENCES "admin_bulk_operations"("operation_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "admin_bulk_operation_items" ADD CONSTRAINT "admin_bulk_operation_items_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reminder templates
CREATE TABLE IF NOT EXISTS "email_reminder_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body_html" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_reminder_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_reminder_templates_is_active_idx" ON "email_reminder_templates"("is_active");

DO $$ BEGIN
  ALTER TABLE "email_reminder_templates" ADD CONSTRAINT "email_reminder_templates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "email_reminder_deliveries" (
  "id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "recipient_email" TEXT NOT NULL,
  "subject_rendered" TEXT NOT NULL,
  "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error_summary" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_reminder_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_reminder_deliveries_operation_id_candidate_id_key"
  ON "email_reminder_deliveries"("operation_id", "candidate_id");
CREATE INDEX IF NOT EXISTS "email_reminder_deliveries_operation_id_idx" ON "email_reminder_deliveries"("operation_id");
CREATE INDEX IF NOT EXISTS "email_reminder_deliveries_candidate_id_idx" ON "email_reminder_deliveries"("candidate_id");

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "email_reminder_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_reminder_deliveries" ADD CONSTRAINT "email_reminder_deliveries_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Interviews
CREATE TABLE IF NOT EXISTS "candidate_interviews" (
  "id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "mode" "InterviewMode" NOT NULL DEFAULT 'SINGLE',
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "start_utc" TIMESTAMP(3) NOT NULL,
  "end_utc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "gap_minutes" INTEGER NOT NULL DEFAULT 0,
  "status" "InterviewStatus" NOT NULL DEFAULT 'PENDING',
  "google_event_id" TEXT,
  "meet_url" TEXT,
  "calendar_owner_email" TEXT,
  "failure_summary" TEXT,
  "email_status" TEXT,
  "scheduled_by_admin_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "cancelled_at" TIMESTAMP(3),
  CONSTRAINT "candidate_interviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_interviews_idempotency_key_key" ON "candidate_interviews"("idempotency_key");
CREATE INDEX IF NOT EXISTS "candidate_interviews_scheduled_by_admin_id_idx" ON "candidate_interviews"("scheduled_by_admin_id");
CREATE INDEX IF NOT EXISTS "candidate_interviews_status_idx" ON "candidate_interviews"("status");
CREATE INDEX IF NOT EXISTS "candidate_interviews_start_utc_idx" ON "candidate_interviews"("start_utc");

DO $$ BEGIN
  ALTER TABLE "candidate_interviews" ADD CONSTRAINT "candidate_interviews_scheduled_by_admin_id_fkey"
    FOREIGN KEY ("scheduled_by_admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "candidate_interview_participants" (
  "id" TEXT NOT NULL,
  "interview_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "start_utc" TIMESTAMP(3) NOT NULL,
  "end_utc" TIMESTAMP(3) NOT NULL,
  "google_event_id" TEXT,
  "meet_url" TEXT,
  "email_status" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_interview_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_interview_participants_interview_id_candidate_id_key"
  ON "candidate_interview_participants"("interview_id", "candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_interview_participants_candidate_id_idx" ON "candidate_interview_participants"("candidate_id");

DO $$ BEGIN
  ALTER TABLE "candidate_interview_participants" ADD CONSTRAINT "candidate_interview_participants_interview_id_fkey"
    FOREIGN KEY ("interview_id") REFERENCES "candidate_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_interview_participants" ADD CONSTRAINT "candidate_interview_participants_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Google Calendar tokens
CREATE TABLE IF NOT EXISTS "admin_google_calendars" (
  "id" TEXT NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "google_email" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_google_calendars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_google_calendars_admin_user_id_key" ON "admin_google_calendars"("admin_user_id");

DO $$ BEGIN
  ALTER TABLE "admin_google_calendars" ADD CONSTRAINT "admin_google_calendars_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
