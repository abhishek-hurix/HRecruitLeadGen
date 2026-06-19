ALTER TYPE "AnswerMode" ADD VALUE 'MCQ';

ALTER TABLE "questions"
  ADD COLUMN "mcq_options" JSONB,
  ADD COLUMN "correct_option_index" INTEGER,
  ADD COLUMN "explanation" TEXT;

ALTER TABLE "submission_answers"
  ADD COLUMN "selected_option_index" INTEGER;
