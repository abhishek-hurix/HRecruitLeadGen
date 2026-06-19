-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('CREATED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "assessment_tokens" ADD COLUMN "status" "TokenStatus" NOT NULL DEFAULT 'CREATED';
ALTER TABLE "assessment_tokens" ADD COLUMN "used_at" TIMESTAMP(3);
ALTER TABLE "assessment_tokens" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
