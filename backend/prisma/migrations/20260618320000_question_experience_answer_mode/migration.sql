CREATE TYPE "AnswerMode" AS ENUM ('CODE', 'COMPREHENSIVE');

ALTER TABLE "questions"
  ADD COLUMN "experience_category" "ExperienceCategory",
  ADD COLUMN "answer_mode" "AnswerMode" NOT NULL DEFAULT 'CODE';

CREATE INDEX "questions_experience_category_idx" ON "questions"("experience_category");
