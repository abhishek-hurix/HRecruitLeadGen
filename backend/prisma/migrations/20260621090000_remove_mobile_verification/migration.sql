DROP TABLE IF EXISTS "mobile_verification_otps";

ALTER TABLE "candidate_profiles"
  DROP COLUMN IF EXISTS "phone_verified",
  DROP COLUMN IF EXISTS "phone_verified_at",
  DROP COLUMN IF EXISTS "phone_otp_sent_at",
  DROP COLUMN IF EXISTS "phone_verification_attempts",
  DROP COLUMN IF EXISTS "phone_verification_attempts_window_start";
