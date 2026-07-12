import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdminRole } from '@prisma/client';
import { api, getTestApp, loginSuperAdmin } from '../helpers/app';
import { generateAdminToken } from '../../src/utils/jwt';
import { hasTestDatabase, disconnectTestDb, getTestPrisma } from '../helpers/db';
import { createTestAdmin, createTestCandidate } from '../helpers/factories';
import { escapeHtml, sanitizeSpreadsheetCell } from '../../src/utils/admin-safety';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describe('admin-safety utilities', () => {
  it('escapes spreadsheet formula injection prefixes', () => {
    expect(sanitizeSpreadsheetCell('=1+1')).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell('+cmd')).toBe("'+cmd");
    expect(sanitizeSpreadsheetCell('-1')).toBe("'-1");
    expect(sanitizeSpreadsheetCell('@sum')).toBe("'@sum");
    expect(sanitizeSpreadsheetCell('normal')).toBe('normal');
  });

  it('escapes HTML for templates', () => {
    expect(escapeHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});

describeIfDb('Candidate Management — bulk & soft delete', () => {
  const app = getTestApp();
  let superToken: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    superToken = await loginSuperAdmin(app);
    const admin = await createTestAdmin(AdminRole.ADMIN);
    adminId = admin.id;
    adminToken = generateAdminToken(admin.id, admin.email, AdminRole.ADMIN);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('returns paginated candidates with meta for ADMIN', async () => {
    await createTestCandidate();
    const res = await api(app)
      .get('/api/admin/candidates')
      .query({ page: 1, pageSize: 25 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(typeof res.body.meta.total).toBe('number');
    expect(typeof res.body.meta.totalPages).toBe('number');
  });

  it('bulk changes status for explicit IDs', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const res = await api(app)
      .post('/api/admin/candidates/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: { mode: 'IDS', candidateIds: [candidateId] },
        newStatus: 'VERIFIED',
      });
    expect(res.status).toBe(200);
    expect(res.body.summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(res.body.operationId).toBeTruthy();
  });

  it('rejects candidates with reason and hides reason from ADMIN detail', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const rejectRes = await api(app)
      .post('/api/admin/candidates/bulk/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: { mode: 'IDS', candidateIds: [candidateId] },
        reason: 'Did not meet role requirements',
      });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.summary.succeeded).toBe(1);

    const adminDetail = await api(app)
      .get(`/api/admin/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.rejectionReason).toBeUndefined();

    const superDetail = await api(app)
      .get(`/api/admin/candidates/${candidateId}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(superDetail.status).toBe(200);
    expect(superDetail.body.rejectionReason).toBe('Did not meet role requirements');
  });

  it('soft-deletes candidates and excludes them from active list', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;

    const del = await api(app)
      .post('/api/admin/candidates/bulk/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ selection: { mode: 'IDS', candidateIds: [candidateId] } });
    expect(del.status).toBe(200);
    expect(del.body.summary.succeeded).toBe(1);

    const list = await api(app)
      .get('/api/admin/candidates')
      .query({ search: user.email, pageSize: 100 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.every((c: { id: string }) => c.id !== candidateId)).toBe(true);
  });

  it('blocks ADMIN from deleted-candidates and permanent delete', async () => {
    const list = await api(app)
      .get('/api/admin/deleted-candidates')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(403);

    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { deletedAt: new Date(), deletedByAdminId: adminId },
    });

    const perm = await api(app)
      .delete(`/api/admin/deleted-candidates/${candidateId}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(perm.status).toBe(403);
  });

  it('allows SUPER_ADMIN to list, restore, and permanently delete', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { deletedAt: new Date(), deletedByAdminId: adminId },
    });

    const list = await api(app)
      .get('/api/admin/deleted-candidates')
      .set('Authorization', `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((c: { id: string }) => c.id === candidateId)).toBe(true);

    const restore = await api(app)
      .post(`/api/admin/deleted-candidates/${candidateId}/restore`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(restore.status).toBe(200);

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { deletedAt: new Date(), deletedByAdminId: adminId },
    });

    const permanent = await api(app)
      .delete(`/api/admin/deleted-candidates/${candidateId}/permanent`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(permanent.status).toBe(200);
  });

  it('exports CSV for ADMIN', async () => {
    const user = await createTestCandidate();
    const res = await api(app)
      .post('/api/admin/candidates/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scope: 'SELECTED',
        format: 'csv',
        selection: { mode: 'IDS', candidateIds: [user.candidateProfile!.id] },
      });
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/csv|octet|text/i);
  });

  it('schedules interview in mock calendar mode', async () => {
    process.env.GOOGLE_CALENDAR_MOCK_MODE = 'true';
    const user = await createTestCandidate();
    const idempotencyKey = `test-interview-${Date.now()}`;
    const res = await api(app)
      .post('/api/admin/candidates/bulk/schedule-interview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: { mode: 'IDS', candidateIds: [user.candidateProfile!.id] },
        title: 'Screening Interview',
        startUtc: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        durationMinutes: 30,
        mode: 'SINGLE',
        createMeet: true,
        idempotencyKey,
      });
    expect(res.status).toBe(201);
    expect(res.body.summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(res.body.interviewId).toBeTruthy();

    const retry = await api(app)
      .post('/api/admin/candidates/bulk/schedule-interview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: { mode: 'IDS', candidateIds: [user.candidateProfile!.id] },
        title: 'Screening Interview',
        startUtc: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        durationMinutes: 30,
        mode: 'SINGLE',
        createMeet: true,
        idempotencyKey,
      });
    expect([200, 201]).toContain(retry.status);
    expect(retry.body.interviewId).toBe(res.body.interviewId);
  });

  it('returns deleted candidate details for SUPER_ADMIN only', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { deletedAt: new Date(), deletedByAdminId: adminId },
    });

    const denied = await api(app)
      .get(`/api/admin/deleted-candidates/${candidateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(denied.status).toBe(403);

    const ok = await api(app)
      .get(`/api/admin/deleted-candidates/${candidateId}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(candidateId);
    expect(ok.body.data.deletedBy?.email).toBeTruthy();
  });

  it('filters candidates by journey status and experience', async () => {
    await createTestCandidate();
    const res = await api(app)
      .get('/api/admin/candidates')
      .query({ status: 'REGISTERED', experience: 'TWO_THREE', pageSize: 25, candidateType: 'all' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(25);
  });

  it('exports XLSX for ADMIN', async () => {
    const user = await createTestCandidate();
    const res = await api(app)
      .post('/api/admin/candidates/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scope: 'SELECTED',
        format: 'xlsx',
        selection: { mode: 'IDS', candidateIds: [user.candidateProfile!.id] },
      });
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/spreadsheet|excel|octet/i);
  });

  it('assigns job role in bulk', async () => {
    const prisma = await getTestPrisma();
    const role = await prisma.jobRole.create({
      data: {
        title: `Role ${Date.now()}`,
        country: 'India',
        compensationType: 'MONTHLY',
        monthlySalary: 100000,
        currency: 'INR',
        skills: [],
        assessmentLanguages: ['PYTHON'],
        status: 'ACTIVE',
      },
    });
    const user = await createTestCandidate();
    const res = await api(app)
      .post('/api/admin/candidates/bulk/assign-role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: { mode: 'IDS', candidateIds: [user.candidateProfile!.id] },
        jobRoleId: role.id,
      });
    expect(res.status).toBe(200);
    expect(res.body.summary.succeeded).toBe(1);
  });

  it('ALL_MATCHING selection respects exclusions', async () => {
    const a = await createTestCandidate();
    const b = await createTestCandidate();
    const res = await api(app)
      .post('/api/admin/candidates/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        selection: {
          mode: 'ALL_MATCHING',
          filters: { search: 'Test Candidate', candidateType: 'all' },
          excludedCandidateIds: [b.candidateProfile!.id],
        },
        newStatus: 'EMAIL_SENT',
      });
    expect(res.status).toBe(200);
    expect(res.body.summary.requested).toBeGreaterThanOrEqual(1);
    const errorsForB = (res.body.errors || []).find(
      (e: { candidateId: string }) => e.candidateId === b.candidateProfile!.id
    );
    expect(errorsForB).toBeUndefined();
    // silence unused var if tree-shaken
    expect(a.candidateProfile).toBeTruthy();
  });
});
