# Candidate Management — Database Migration Guide

## Migrations

| Name | Purpose |
|------|---------|
| `20260713000000_candidate_management` | Soft delete, bulk ops, reminders, interviews, calendar |
| `20260713120000_candidate_management_hardening` | Rejection history, SET NULL retention, indexes, idempotency |

## Deployment order

1. Deploy application code that remains compatible with pre-hardening schema (nullable columns unused).
2. Run `npx prisma migrate deploy` against Supabase/Postgres.
3. Run `npx prisma generate` on app hosts.
4. Deploy services that write `CandidateRejection` / `candidateReference`.
5. Validate with post-migration queries below.

## Lock impact

- Additive `ALTER TABLE ... ADD COLUMN` (nullable / defaulted): short `ACCESS EXCLUSIVE` on Postgres for catalog update; typically brief on Supabase.
- `CREATE INDEX IF NOT EXISTS` (non-CONCURRENT): can lock writes on large `candidate_profiles`. Prefer off-peak. Prisma does not emit `CONCURRENTLY` by default.
- FK drop/recreate: brief exclusive lock on child tables.
- Enum `ADD VALUE`: cannot run inside a transaction block on older Postgres; migration uses `DO $$` guards.

## Backfill

- Rejection history backfilled from denormalized `rejection_reason` columns.
- `candidate_reference` backfilled from candidate UUID prefix for existing bulk/reminder/interview rows.

## Rollback approach

1. Application rollback first (stop writing new tables/columns).
2. Do **not** drop columns in production without a data export; prefer leaving additive columns.
3. If required, reverse in a follow-up migration:
   - Drop `idempotency_records`, `candidate_rejections` only after confirming no dependency.
   - Revert FK actions carefully (SET NULL → CASCADE) only if no null `candidate_id` rows exist.

## Encryption key rotation (Calendar)

- Refresh tokens stored only as `refresh_token_encrypted`.
- Encryption key lives in `TOKEN_ENCRYPTION_KEY` (env / secret manager), never in DB.
- Rotation: decrypt with old key → re-encrypt with new key → update rows → retire old key after dual-read window.

## Validation queries

```sql
-- Soft-delete columns present
SELECT column_name FROM information_schema.columns
WHERE table_name = 'candidate_profiles'
  AND column_name IN ('deleted_at', 'deleted_by_admin_id');

-- Rejection history table
SELECT COUNT(*) FROM candidate_rejections;

-- Active scope sanity
SELECT COUNT(*) FROM candidate_profiles WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM candidate_profiles WHERE deleted_at IS NOT NULL;

-- Audit retention columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'admin_bulk_operation_items'
  AND column_name IN ('candidate_reference', 'previous_value', 'new_value');

-- Idempotency + calendar uniqueness
SELECT indexname FROM pg_indexes
WHERE tablename IN ('idempotency_records', 'admin_google_calendars');
```

## Post-migration verification

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM candidate_profiles
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 25;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM candidate_profiles
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 25;
```

Expect index usage on `candidate_profiles_deleted_at_created_at_idx` (or bitmap/index scan on `deleted_at`).
