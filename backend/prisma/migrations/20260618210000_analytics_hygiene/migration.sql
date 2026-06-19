-- Extend SelectionStatus for hiring funnel stages
ALTER TYPE "SelectionStatus" ADD VALUE IF NOT EXISTS 'SHORTLISTED';
ALTER TYPE "SelectionStatus" ADD VALUE IF NOT EXISTS 'INTERVIEWED';

-- Visitor traffic hygiene flags
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "is_test" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "visitors_is_test_idx" ON "visitors"("is_test");
CREATE INDEX IF NOT EXISTS "visitors_is_internal_idx" ON "visitors"("is_internal");

-- Backfill existing records
UPDATE "visitors"
SET "is_internal" = true
WHERE "landing_page" ILIKE '%localhost%'
   OR "landing_page" ILIKE '%127.0.0.1%'
   OR "landing_page" ILIKE '%[::1]%';

UPDATE "visitors"
SET "is_test" = true
WHERE "visitor_id" LIKE 'test_%'
   OR "visitor_id" LIKE 'organic_%'
   OR "visitor_id" LIKE 'dedup_%';
