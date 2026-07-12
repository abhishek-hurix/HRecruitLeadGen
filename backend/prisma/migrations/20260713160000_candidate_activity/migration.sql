-- Medium Priority: CandidateActivity enum + append-only activity table
-- Converts last_activity_type TEXT → CandidateActivityType (from 150000).
-- Does NOT include LP: normalizedEmail, applicationId column, creation source, resume metadata.

DO $$ BEGIN
  CREATE TYPE "CandidateActivityType" AS ENUM (
    'REGISTERED',
    'ASSESSMENT_SUBMITTED',
    'REMINDER_SENT',
    'STATUS_CHANGED',
    'ROLE_ASSIGNED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEW_COMPLETED',
    'OWNER_ASSIGNED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure owner/activity columns exist (idempotent with 150000)
ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "owner_admin_id" TEXT,
  ADD COLUMN IF NOT EXISTS "owner_assigned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "owner_assigned_by_admin_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_activity_type" TEXT;

UPDATE "candidate_profiles"
SET "last_activity_at" = "created_at",
    "last_activity_type" = COALESCE("last_activity_type", 'REGISTERED')
WHERE "last_activity_at" IS NULL;

-- Convert last_activity_type TEXT → enum
ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "last_activity_type_enum" "CandidateActivityType";

UPDATE "candidate_profiles"
SET "last_activity_type_enum" = CASE "last_activity_type"
  WHEN 'REGISTERED' THEN 'REGISTERED'::"CandidateActivityType"
  WHEN 'ASSESSMENT_SUBMITTED' THEN 'ASSESSMENT_SUBMITTED'::"CandidateActivityType"
  WHEN 'REMINDER_SENT' THEN 'REMINDER_SENT'::"CandidateActivityType"
  WHEN 'STATUS_CHANGED' THEN 'STATUS_CHANGED'::"CandidateActivityType"
  WHEN 'ROLE_ASSIGNED' THEN 'ROLE_ASSIGNED'::"CandidateActivityType"
  WHEN 'INTERVIEW_SCHEDULED' THEN 'INTERVIEW_SCHEDULED'::"CandidateActivityType"
  WHEN 'INTERVIEW_COMPLETED' THEN 'INTERVIEW_COMPLETED'::"CandidateActivityType"
  WHEN 'OWNER_ASSIGNED' THEN 'OWNER_ASSIGNED'::"CandidateActivityType"
  ELSE 'REGISTERED'::"CandidateActivityType"
END
WHERE "last_activity_type_enum" IS NULL
  AND "last_activity_type" IS NOT NULL;

ALTER TABLE "candidate_profiles" DROP COLUMN IF EXISTS "last_activity_type";
ALTER TABLE "candidate_profiles" RENAME COLUMN "last_activity_type_enum" TO "last_activity_type";

CREATE TABLE IF NOT EXISTS "candidate_activities" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "type" "CandidateActivityType" NOT NULL,
  "actor_admin_id" TEXT,
  "operation_id" TEXT,
  "metadata" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_activities_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "candidate_activities"
    ADD CONSTRAINT "candidate_activities_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_activities"
    ADD CONSTRAINT "candidate_activities_actor_admin_id_fkey"
    FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "candidate_activities_candidate_id_occurred_at_idx"
  ON "candidate_activities"("candidate_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "candidate_activities_type_occurred_at_idx"
  ON "candidate_activities"("type", "occurred_at");

CREATE INDEX IF NOT EXISTS "candidate_activities_operation_id_idx"
  ON "candidate_activities"("operation_id");

-- Seed REGISTERED activity for candidates lacking any activity row
INSERT INTO "candidate_activities" (
  "id", "candidate_id", "type", "occurred_at", "created_at", "metadata"
)
SELECT
  gen_random_uuid()::text,
  cp."id",
  'REGISTERED'::"CandidateActivityType",
  cp."created_at",
  NOW(),
  jsonb_build_object('source', 'backfill')
FROM "candidate_profiles" cp
WHERE NOT EXISTS (
  SELECT 1 FROM "candidate_activities" ca WHERE ca."candidate_id" = cp."id"
);
