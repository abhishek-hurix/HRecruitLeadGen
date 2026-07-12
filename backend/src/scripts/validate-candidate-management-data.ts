/**
 * Pre/post migration data validation for Candidate Management DB hardening.
 * Run: npx tsx src/scripts/validate-candidate-management-data.ts
 * Requires DATABASE_URL. Exits 1 if blocking issues found.
 */
import { PrismaClient } from '@prisma/client';
import { resolveCountryIso } from '../utils/country';

const prisma = new PrismaClient();

type Report = {
  ok: boolean;
  checks: Array<{ name: string; severity: 'info' | 'warn' | 'block'; detail: string; count?: number; samples?: unknown[] }>;
};

async function main() {
  const report: Report = { ok: true, checks: [] };

  const push = (
    name: string,
    severity: 'info' | 'warn' | 'block',
    detail: string,
    count?: number,
    samples?: unknown[]
  ) => {
    report.checks.push({ name, severity, detail, count, samples });
    if (severity === 'block') report.ok = false;
  };

  // Duplicate normalized emails
  const emailDupes = await prisma.$queryRaw<Array<{ normalized_email: string; c: bigint }>>`
    SELECT lower(trim(email)) AS normalized_email, COUNT(*)::bigint AS c
    FROM users
    GROUP BY lower(trim(email))
    HAVING COUNT(*) > 1
  `;
  push(
    'duplicate_normalized_emails',
    emailDupes.length ? 'block' : 'info',
    emailDupes.length ? 'Duplicate emails after normalize' : 'No duplicate normalized emails',
    emailDupes.length,
    emailDupes.slice(0, 20)
  );

  // Unmapped countries (active candidates)
  const countries = await prisma.candidateProfile.findMany({
    where: { deletedAt: null },
    select: { id: true, phoneCountry: true, phoneCountryIso: true },
    take: 50000,
  });
  const unmapped = countries.filter((c) => !c.phoneCountryIso && c.phoneCountry?.trim());
  const unmappedValues = [...new Set(unmapped.map((c) => c.phoneCountry.trim()))];
  const ambiguous: string[] = [];
  for (const v of unmappedValues) {
    // Ambiguous if resolveCountryIso returns null but value looks like a code/name attempt
    if (!resolveCountryIso(v) && /^[A-Za-z\s.'-]{2,}$/.test(v)) ambiguous.push(v);
  }
  push(
    'unmapped_countries',
    unmappedValues.length ? 'warn' : 'info',
    `Unmapped phone_country values preserved as text (${unmapped.length} rows)`,
    unmappedValues.length,
    unmappedValues.slice(0, 50)
  );
  push(
    'country_mapped_count',
    'info',
    'Candidates with phoneCountryIso set',
    countries.filter((c) => Boolean(c.phoneCountryIso)).length
  );

  // Experience missing years
  const missingYears = await prisma.candidateProfile.count({
    where: { experienceCategory: { not: null }, yearsOfExperience: null },
  });
  push(
    'experience_missing_years',
    missingYears ? 'warn' : 'info',
    'Profiles with category but null yearsOfExperience',
    missingYears
  );

  // Orphan owner refs
  const orphanOwners = await prisma.$queryRaw<Array<{ id: string; owner_admin_id: string }>>`
    SELECT cp.id, cp.owner_admin_id
    FROM candidate_profiles cp
    LEFT JOIN admin_users a ON a.id = cp.owner_admin_id
    WHERE cp.owner_admin_id IS NOT NULL AND a.id IS NULL
  `;
  push(
    'orphan_owners',
    orphanOwners.length ? 'block' : 'info',
    'Candidates whose ownerAdminId no longer exists',
    orphanOwners.length,
    orphanOwners.slice(0, 20)
  );

  // Application ID duplicates / missing
  const appIdDupes = await prisma.$queryRaw<Array<{ application_id: string; c: bigint }>>`
    SELECT application_id, COUNT(*)::bigint AS c
    FROM candidate_profiles
    WHERE application_id IS NOT NULL
    GROUP BY application_id
    HAVING COUNT(*) > 1
  `;
  const missingAppId = await prisma.candidateProfile.count({ where: { applicationId: null } });
  push(
    'application_id_duplicates',
    appIdDupes.length ? 'block' : 'info',
    'Duplicate application_id values',
    appIdDupes.length,
    appIdDupes.slice(0, 20)
  );
  push(
    'application_id_missing',
    missingAppId ? 'warn' : 'info',
    'Profiles missing application_id (ok until backfill)',
    missingAppId
  );

  // Invalid job role refs
  const orphanRoles = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT cp.id FROM candidate_profiles cp
    LEFT JOIN job_roles jr ON jr.id = cp.selected_role_id
    WHERE cp.selected_role_id IS NOT NULL AND jr.id IS NULL
  `;
  push(
    'orphan_job_roles',
    orphanRoles.length ? 'warn' : 'info',
    'selectedRoleId pointing to missing job role',
    orphanRoles.length,
    orphanRoles.slice(0, 20)
  );

  // Missing registration timestamps (should be impossible with default)
  const missingCreated = await prisma.candidateProfile.count({
    where: { createdAt: undefined as never },
  });
  push('missing_created_at', 'info', 'Profiles missing createdAt (expect 0)', missingCreated);

  // Soft-deleted vs active
  const deleted = await prisma.candidateProfile.count({ where: { deletedAt: { not: null } } });
  const active = await prisma.candidateProfile.count({ where: { deletedAt: null } });
  push('soft_delete_counts', 'info', `active=${active}, deleted=${deleted}`);

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
