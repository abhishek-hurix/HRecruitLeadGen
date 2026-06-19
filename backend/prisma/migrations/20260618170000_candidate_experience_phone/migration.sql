-- CreateEnum
CREATE TYPE "ExperienceCategory" AS ENUM ('FRESHER', 'ZERO_ONE', 'ONE_TWO', 'TWO_THREE', 'THREE_FIVE', 'FIVE_SEVEN', 'SEVEN_TEN', 'TEN_PLUS');

-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN "country_code" TEXT NOT NULL DEFAULT '+91',
ADD COLUMN "phone_number" TEXT,
ADD COLUMN "full_phone" TEXT,
ADD COLUMN "phone_country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN "years_of_experience" INTEGER,
ADD COLUMN "experience_category" "ExperienceCategory";

-- Backfill from legacy phone column
UPDATE "candidate_profiles"
SET
  "phone_number" = regexp_replace("phone", '[^0-9]', '', 'g'),
  "full_phone" = CASE
    WHEN "phone" LIKE '+%' THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 10 THEN '+91' || regexp_replace("phone", '[^0-9]', '', 'g')
    ELSE '+' || regexp_replace("phone", '[^0-9]', '', 'g')
  END
WHERE "phone_number" IS NULL;

UPDATE "candidate_profiles" SET "full_phone" = '+91' || "phone_number" WHERE "full_phone" IS NULL AND "phone_number" IS NOT NULL;

CREATE INDEX "candidate_profiles_experience_category_idx" ON "candidate_profiles"("experience_category");
CREATE INDEX "candidate_profiles_phone_country_idx" ON "candidate_profiles"("phone_country");
