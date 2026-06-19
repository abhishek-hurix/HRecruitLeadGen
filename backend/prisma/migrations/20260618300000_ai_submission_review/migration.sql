ALTER TABLE "submissions"
  ADD COLUMN "ai_review_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "ai_review" JSONB,
  ADD COLUMN "ai_review_error" TEXT,
  ADD COLUMN "ai_reviewed_at" TIMESTAMP(3);