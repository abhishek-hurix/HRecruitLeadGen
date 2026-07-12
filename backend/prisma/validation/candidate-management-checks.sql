-- Pre-constraint validation queries (run against production/staging before tightening uniques)

-- 1) Duplicate emails after normalize
SELECT lower(trim(email)) AS normalized_email, COUNT(*) AS c
FROM users
GROUP BY 1
HAVING COUNT(*) > 1;

-- 2) Unmapped countries (preserve phone_country text)
SELECT phone_country, COUNT(*) AS c
FROM candidate_profiles
WHERE phone_country_iso IS NULL
  AND phone_country IS NOT NULL
  AND trim(phone_country) <> ''
GROUP BY 1
ORDER BY c DESC;

-- 3) Experience category without years
SELECT experience_category, COUNT(*) AS c
FROM candidate_profiles
WHERE experience_category IS NOT NULL AND years_of_experience IS NULL
GROUP BY 1;

-- 4) Application ID issues
SELECT application_id, COUNT(*) AS c
FROM candidate_profiles
WHERE application_id IS NOT NULL
GROUP BY 1
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS missing_application_id
FROM candidate_profiles
WHERE application_id IS NULL;

-- 5) Orphan owners / roles
SELECT cp.id, cp.owner_admin_id
FROM candidate_profiles cp
LEFT JOIN admin_users a ON a.id = cp.owner_admin_id
WHERE cp.owner_admin_id IS NOT NULL AND a.id IS NULL;

SELECT cp.id, cp.selected_role_id
FROM candidate_profiles cp
LEFT JOIN job_roles jr ON jr.id = cp.selected_role_id
WHERE cp.selected_role_id IS NOT NULL AND jr.id IS NULL;

-- 6) Soft-delete counts
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted
FROM candidate_profiles;

-- 7) Activity backfill coverage
SELECT COUNT(*) AS profiles_without_activity
FROM candidate_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM candidate_activities ca WHERE ca.candidate_id = cp.id
);
