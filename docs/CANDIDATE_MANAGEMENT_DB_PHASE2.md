# Candidate Management — DB Migration Guide (medium priority)

## Relation map

```
User (email UNIQUE)
  └── 1—* CandidateProfile  (= application; no separate Application model)
        ├── phoneCountry (display text, preserved)
        ├── phoneCountryIso CHAR(2)? (canonical filter/sort)
        ├── yearsOfExperience Int? + experienceCategory enum
        ├── latestScore Decimal? (denormalized for sort)
        ├── ownerAdminId → AdminUser (SET NULL)
        ├── ownerAssignedByAdminId → AdminUser (SET NULL)
        ├── lastActivityAt / lastActivityType (denormalized)
        ├── 1—* CandidateActivity (append-only history)
        ├── *—1 JobRole (selectedRoleId, SET NULL)
        ├── 1—* Assessment → 0..1 Submission → * SubmissionAnswer
        └── soft-delete: deletedAt / deletedByAdminId
AdminUser
  └── SUPER_ADMIN | ADMIN
AuditLog (existing high-level admin audit; complementary to CandidateActivity)
```

**Application ID (display only):** first 8 hex chars of UUID (no hyphens), uppercased.
Not persisted as a DB column in medium priority.

**Email identity:** uniqueness remains on `User.email`. Multiple
`CandidateProfile` rows per user are supported (multi-application).

## Migrations (order)

1. `20260713140000_candidate_filters_sort` — phone_country_iso, latest_score, indexes, country/experience backfill
2. `20260713150000_candidate_owner_activity` — owner + last_activity (text), seed REGISTERED
3. `20260713160000_candidate_activity` — CandidateActivityType enum, typed last_activity_type, candidate_activities table + indexes

## Deploy

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Rollback

Prefer forward-fix. Manual rollback of activity migration:

- Drop `candidate_activities`
- Drop owner / last_activity / phone_country_iso / latest_score columns added by 140000–160000
- Drop enum `CandidateActivityType`
- Keep `phone_country` forever

## Locks

Additive `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — brief ACCESS EXCLUSIVE on ALTER TYPE rename path for `last_activity_type`. Prefer off-peak deploy.
