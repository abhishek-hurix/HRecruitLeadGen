ALTER TABLE "candidate_profiles"
  ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phone_verified_at" TIMESTAMP(3),
  ADD COLUMN "phone_otp_sent_at" TIMESTAMP(3),
  ADD COLUMN "phone_verification_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "phone_verification_attempts_window_start" TIMESTAMP(3);

CREATE TABLE "mobile_verification_otps" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "otp_hash" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mobile_verification_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mobile_verification_otps_candidate_id_idx" ON "mobile_verification_otps"("candidate_id");
CREATE INDEX "mobile_verification_otps_expires_at_idx" ON "mobile_verification_otps"("expires_at");

ALTER TABLE "mobile_verification_otps"
  ADD CONSTRAINT "mobile_verification_otps_candidate_id_fkey"
  FOREIGN KEY ("candidate_id")
  REFERENCES "candidate_profiles"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
