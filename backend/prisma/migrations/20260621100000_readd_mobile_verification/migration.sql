ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "phone_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "phone_otp_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "phone_verification_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "phone_verification_attempts_window_start" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "mobile_verification_otps" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "otp_hash" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mobile_verification_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mobile_verification_otps_candidate_id_idx" ON "mobile_verification_otps"("candidate_id");
CREATE INDEX IF NOT EXISTS "mobile_verification_otps_expires_at_idx" ON "mobile_verification_otps"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mobile_verification_otps_candidate_id_fkey'
  ) THEN
    ALTER TABLE "mobile_verification_otps"
      ADD CONSTRAINT "mobile_verification_otps_candidate_id_fkey"
      FOREIGN KEY ("candidate_id")
      REFERENCES "candidate_profiles"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
