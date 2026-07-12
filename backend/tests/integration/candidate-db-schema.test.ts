import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdminRole, SelectionStatus } from '@prisma/client';
import { hasTestDatabase, disconnectTestDb, getTestPrisma } from '../helpers/db';
import { createTestAdmin, createTestCandidate } from '../helpers/factories';
import { candidateBulkService } from '../../src/services/candidate-bulk.service';
import { activeCandidateWhere, deletedCandidateWhere, mergeCandidateWhere } from '../../src/utils/candidate-scope';
import { candidateReferenceFromId, hashIdempotencyRequest } from '../../src/utils/idempotency';
import { PERMANENT_DELETE_RELATION_MAP } from '../../src/docs/permanent-delete-relation-map';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describe('Database design utilities', () => {
  it('builds stable candidate references', () => {
    expect(candidateReferenceFromId('abcdef12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12');
  });

  it('hashes idempotency payloads stably', () => {
    expect(hashIdempotencyRequest({ a: 1 })).toBe(hashIdempotencyRequest({ a: 1 }));
    expect(hashIdempotencyRequest({ a: 1 })).not.toBe(hashIdempotencyRequest({ a: 2 }));
  });

  it('documents permanent deletion relation classes', () => {
    expect(PERMANENT_DELETE_RELATION_MAP.mustDelete).toContain('candidate_profiles');
    expect(PERMANENT_DELETE_RELATION_MAP.retainSetNull).toContain('candidate_rejections');
    expect(PERMANENT_DELETE_RELATION_MAP.neverTouch).toContain('job_roles');
  });
});

describeIfDb('Candidate management database behaviour', () => {
  let adminId: string;

  beforeAll(async () => {
    const admin = await createTestAdmin(AdminRole.SUPER_ADMIN);
    adminId = admin.id;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('scopes active vs deleted candidates', async () => {
    const prisma = await getTestPrisma();
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;

    const active = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(activeCandidateWhere(), { id }),
    });
    expect(active).toBeTruthy();

    await prisma.candidateProfile.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByAdminId: adminId },
    });

    const stillActive = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(activeCandidateWhere(), { id }),
    });
    expect(stillActive).toBeNull();

    const deleted = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(deletedCandidateWhere(), { id }),
    });
    expect(deleted?.deletedByAdminId).toBe(adminId);
  });

  it('writes rejection history and restores soft-deleted candidates', async () => {
    const prisma = await getTestPrisma();
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;

    const reject = await candidateBulkService.reject(
      { mode: 'IDS', candidateIds: [id] },
      'Insufficient role match for current openings',
      adminId
    );
    expect(reject.summary.succeeded).toBe(1);

    const history = await prisma.candidateRejection.findMany({ where: { candidateId: id } });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].reason).toContain('Insufficient');

    await candidateBulkService.softDelete({ mode: 'IDS', candidateIds: [id] }, adminId);
    await candidateBulkService.restore(id, adminId);

    const restored = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(activeCandidateWhere(), { id }),
    });
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.selectionStatus).toBe(SelectionStatus.REJECTED);
  });

  it('retains audit/rejection rows after permanent deletion', async () => {
    const prisma = await getTestPrisma();
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;
    const reference = candidateReferenceFromId(id);

    await candidateBulkService.reject(
      { mode: 'IDS', candidateIds: [id] },
      'Permanent delete retention test reason',
      adminId
    );
    await candidateBulkService.softDelete({ mode: 'IDS', candidateIds: [id] }, adminId);

    const itemsBefore = await prisma.adminBulkOperationItem.count({ where: { candidateId: id } });
    expect(itemsBefore).toBeGreaterThan(0);

    await candidateBulkService.permanentDelete(id, adminId);

    const profile = await prisma.candidateProfile.findUnique({ where: { id } });
    expect(profile).toBeNull();

    const retainedItems = await prisma.adminBulkOperationItem.count({
      where: { candidateId: null, candidateReference: reference },
    });
    expect(retainedItems).toBeGreaterThan(0);

    const retainedRejections = await prisma.candidateRejection.count({
      where: { candidateId: null, candidateReference: reference },
    });
    expect(retainedRejections).toBeGreaterThan(0);
  });

  it('enforces calendar connection uniqueness per admin/provider/account', async () => {
    const prisma = await getTestPrisma();
    await prisma.adminGoogleCalendar.create({
      data: {
        adminUserId: adminId,
        provider: 'GOOGLE',
        googleEmail: `cal-${adminId.slice(0, 6)}@hurix.com`,
        refreshTokenEncrypted: 'encrypted-token-placeholder',
        grantedScopes: 'https://www.googleapis.com/auth/calendar.events',
        status: 'ACTIVE',
      },
    });

    await expect(
      prisma.adminGoogleCalendar.create({
        data: {
          adminUserId: adminId,
          provider: 'GOOGLE',
          googleEmail: `cal-${adminId.slice(0, 6)}@hurix.com`,
          refreshTokenEncrypted: 'encrypted-token-placeholder-2',
          grantedScopes: 'https://www.googleapis.com/auth/calendar.events',
          status: 'ACTIVE',
        },
      })
    ).rejects.toThrow();
  });

  it('stores interview timestamps in UTC with original timezone', async () => {
    const prisma = await getTestPrisma();
    const start = new Date('2026-08-01T10:00:00.000Z');
    const end = new Date('2026-08-01T10:30:00.000Z');
    const interview = await prisma.candidateInterview.create({
      data: {
        idempotencyKey: `db-test-${Date.now()}`,
        title: 'UTC check',
        startUtc: start,
        endUtc: end,
        timezone: 'Asia/Kolkata',
        durationMinutes: 30,
        scheduledByAdminId: adminId,
      },
    });
    expect(interview.startUtc.toISOString()).toBe(start.toISOString());
    expect(interview.timezone).toBe('Asia/Kolkata');
  });
});
