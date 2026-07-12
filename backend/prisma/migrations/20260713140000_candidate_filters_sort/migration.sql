-- Phase 1: Country ISO normalization + sortable denormalized score
-- Safe additive migration (nullable columns). Rollback: DROP COLUMN.

ALTER TABLE "candidate_profiles"
  ADD COLUMN IF NOT EXISTS "phone_country_iso" CHAR(2),
  ADD COLUMN IF NOT EXISTS "latest_score" DECIMAL(5, 2);

CREATE INDEX IF NOT EXISTS "candidate_profiles_phone_country_iso_deleted_at_idx"
  ON "candidate_profiles"("phone_country_iso", "deleted_at");

CREATE INDEX IF NOT EXISTS "candidate_profiles_years_of_experience_idx"
  ON "candidate_profiles"("years_of_experience");

CREATE INDEX IF NOT EXISTS "candidate_profiles_latest_score_idx"
  ON "candidate_profiles"("latest_score");

CREATE INDEX IF NOT EXISTS "candidate_profiles_selected_role_name_idx"
  ON "candidate_profiles"("selected_role_name");

-- Backfill latest_score from most recent submission per candidate
UPDATE "candidate_profiles" cp
SET "latest_score" = latest.score
FROM (
  SELECT DISTINCT ON (s.candidate_id)
    s.candidate_id,
    s.score
  FROM "submissions" s
  ORDER BY s.candidate_id, s.submitted_at DESC NULLS LAST, s.created_at DESC
) latest
WHERE cp.id = latest.candidate_id
  AND cp.latest_score IS NULL;

-- Backfill years_of_experience from experience_category where missing
UPDATE "candidate_profiles"
SET "years_of_experience" = CASE "experience_category"
  WHEN 'FRESHER' THEN 0
  WHEN 'ONE_YEAR' THEN 1
  WHEN 'TWO_YEARS' THEN 2
  WHEN 'THREE_YEARS' THEN 3
  WHEN 'FOUR_YEARS' THEN 4
  WHEN 'FIVE_YEARS' THEN 5
  WHEN 'SIX_YEARS' THEN 6
  WHEN 'SEVEN_YEARS' THEN 7
  WHEN 'EIGHT_YEARS' THEN 8
  WHEN 'NINE_YEARS' THEN 9
  WHEN 'TEN_YEARS' THEN 10
  WHEN 'TEN_PLUS' THEN 10
  WHEN 'ZERO_ONE' THEN 1
  WHEN 'ONE_TWO' THEN 2
  WHEN 'TWO_THREE' THEN 3
  WHEN 'THREE_FIVE' THEN 5
  WHEN 'FIVE_SEVEN' THEN 7
  WHEN 'SEVEN_TEN' THEN 10
  ELSE "years_of_experience"
END
WHERE "years_of_experience" IS NULL
  AND "experience_category" IS NOT NULL;

-- Backfill common phone_country display names → ISO (unambiguous only)
UPDATE "candidate_profiles"
SET "phone_country_iso" = CASE lower(trim("phone_country"))
  WHEN 'india' THEN 'IN'
  WHEN 'in' THEN 'IN'
  WHEN 'united states' THEN 'US'
  WHEN 'united states of america' THEN 'US'
  WHEN 'usa' THEN 'US'
  WHEN 'us' THEN 'US'
  WHEN 'united kingdom' THEN 'GB'
  WHEN 'uk' THEN 'GB'
  WHEN 'great britain' THEN 'GB'
  WHEN 'gb' THEN 'GB'
  WHEN 'canada' THEN 'CA'
  WHEN 'ca' THEN 'CA'
  WHEN 'australia' THEN 'AU'
  WHEN 'au' THEN 'AU'
  WHEN 'germany' THEN 'DE'
  WHEN 'de' THEN 'DE'
  WHEN 'france' THEN 'FR'
  WHEN 'fr' THEN 'FR'
  WHEN 'singapore' THEN 'SG'
  WHEN 'sg' THEN 'SG'
  WHEN 'united arab emirates' THEN 'AE'
  WHEN 'uae' THEN 'AE'
  WHEN 'ae' THEN 'AE'
  WHEN 'philippines' THEN 'PH'
  WHEN 'ph' THEN 'PH'
  WHEN 'indonesia' THEN 'ID'
  WHEN 'id' THEN 'ID'
  WHEN 'malaysia' THEN 'MY'
  WHEN 'my' THEN 'MY'
  WHEN 'nepal' THEN 'NP'
  WHEN 'np' THEN 'NP'
  WHEN 'bangladesh' THEN 'BD'
  WHEN 'bd' THEN 'BD'
  WHEN 'sri lanka' THEN 'LK'
  WHEN 'lk' THEN 'LK'
  WHEN 'pakistan' THEN 'PK'
  WHEN 'pk' THEN 'PK'
  WHEN 'south africa' THEN 'ZA'
  WHEN 'za' THEN 'ZA'
  WHEN 'nigeria' THEN 'NG'
  WHEN 'ng' THEN 'NG'
  WHEN 'kenya' THEN 'KE'
  WHEN 'ke' THEN 'KE'
  WHEN 'ireland' THEN 'IE'
  WHEN 'ie' THEN 'IE'
  WHEN 'netherlands' THEN 'NL'
  WHEN 'nl' THEN 'NL'
  WHEN 'sweden' THEN 'SE'
  WHEN 'se' THEN 'SE'
  WHEN 'switzerland' THEN 'CH'
  WHEN 'ch' THEN 'CH'
  WHEN 'new zealand' THEN 'NZ'
  WHEN 'nz' THEN 'NZ'
  WHEN 'japan' THEN 'JP'
  WHEN 'jp' THEN 'JP'
  WHEN 'south korea' THEN 'KR'
  WHEN 'korea' THEN 'KR'
  WHEN 'kr' THEN 'KR'
  WHEN 'china' THEN 'CN'
  WHEN 'cn' THEN 'CN'
  WHEN 'hong kong' THEN 'HK'
  WHEN 'hk' THEN 'HK'
  WHEN 'brazil' THEN 'BR'
  WHEN 'br' THEN 'BR'
  WHEN 'mexico' THEN 'MX'
  WHEN 'mx' THEN 'MX'
  ELSE "phone_country_iso"
END
WHERE "phone_country_iso" IS NULL
  AND "phone_country" IS NOT NULL
  AND trim("phone_country") <> '';
