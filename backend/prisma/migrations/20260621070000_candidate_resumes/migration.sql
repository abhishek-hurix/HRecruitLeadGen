CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "candidate_resumes" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "candidate_resumes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "candidate_resumes" (
  "id",
  "candidate_id",
  "file_name",
  "file_path",
  "is_primary",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::TEXT,
  "id",
  REPLACE("full_name", ' ', '_') || '_resume.pdf',
  "resume_path",
  true,
  "created_at",
  "updated_at"
FROM "candidate_profiles"
WHERE "resume_path" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "candidate_resumes"
    WHERE "candidate_resumes"."candidate_id" = "candidate_profiles"."id"
  );

CREATE INDEX "candidate_resumes_candidate_id_idx" ON "candidate_resumes"("candidate_id");
CREATE INDEX "candidate_resumes_candidate_id_is_primary_idx" ON "candidate_resumes"("candidate_id", "is_primary");
CREATE UNIQUE INDEX "candidate_resumes_one_primary_per_candidate_idx"
  ON "candidate_resumes"("candidate_id")
  WHERE "is_primary" = true;

ALTER TABLE "candidate_resumes"
  ADD CONSTRAINT "candidate_resumes_candidate_id_fkey"
  FOREIGN KEY ("candidate_id")
  REFERENCES "candidate_profiles"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
