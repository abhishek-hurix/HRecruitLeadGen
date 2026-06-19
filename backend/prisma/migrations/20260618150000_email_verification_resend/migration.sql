-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN "verification_sent_at" TIMESTAMP(3),
ADD COLUMN "verification_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "verification_attempts_window_start" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_jti_key" ON "email_verification_tokens"("jti");

-- CreateIndex
CREATE INDEX "email_verification_tokens_candidate_id_idx" ON "email_verification_tokens"("candidate_id");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
