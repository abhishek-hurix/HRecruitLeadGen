-- CreateEnum
CREATE TYPE "JobRoleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('HOURLY', 'MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "compensation_type" "CompensationType" NOT NULL,
    "hourly_rate" DECIMAL(12,2),
    "monthly_salary" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "status" "JobRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "open_positions" INTEGER NOT NULL DEFAULT 1,
    "applications_received" INTEGER NOT NULL DEFAULT 0,
    "assessment_languages" JSONB NOT NULL DEFAULT '["PYTHON"]',
    "closing_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN "selected_role_id" TEXT,
ADD COLUMN "selected_role_name" TEXT,
ADD COLUMN "selected_country" TEXT,
ADD COLUMN "selected_compensation" TEXT,
ADD COLUMN "selected_skills" JSONB,
ADD COLUMN "role_selected_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "job_role_id" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "job_role_id" TEXT;

-- CreateIndex
CREATE INDEX "job_roles_status_idx" ON "job_roles"("status");

-- CreateIndex
CREATE INDEX "candidate_profiles_selected_role_id_idx" ON "candidate_profiles"("selected_role_id");

-- CreateIndex
CREATE INDEX "assessments_job_role_id_idx" ON "assessments"("job_role_id");

-- CreateIndex
CREATE INDEX "questions_job_role_id_idx" ON "questions"("job_role_id");

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_selected_role_id_fkey" FOREIGN KEY ("selected_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
