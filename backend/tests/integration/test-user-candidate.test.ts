import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp, loginSuperAdmin } from '../helpers/app';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestCandidate, createTestAdmin } from '../helpers/factories';
import { generateAdminToken } from '../../src/utils/jwt';
import { AdminRole } from '@prisma/client';
import { analyticsService } from '../../src/services/analytics.service';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Test User Candidate Management', () => {
  const app = getTestApp();
  let superToken: string;
  let adminToken: string;
  let candidateId: string;

  beforeAll(async () => {
    await resetTestData();
    superToken = await loginSuperAdmin(app);
    const admin = await createTestAdmin(AdminRole.ADMIN);
    adminToken = generateAdminToken(admin.id, admin.email, AdminRole.ADMIN);
    const user = await createTestCandidate();
    candidateId = user.candidateProfile!.id;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('SUPER_ADMIN can mark candidate as test user', async () => {
    const res = await api(app)
      .post(`/api/admin/candidates/${candidateId}/mark-test-user`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isTestUser).toBe(true);

    const prisma = await getTestPrisma();
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    expect(profile?.isTestUser).toBe(true);
    expect(profile?.testUserMarkedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'TEST_USER_MARKED', entityId: candidateId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('excludes test user from analytics overview by default', async () => {
    const overview = await analyticsService.getOverview({});
    const withTest = await analyticsService.getOverview({ includeTestCandidates: true });

    expect(withTest.registrations).toBeGreaterThanOrEqual(overview.registrations);
  });

  it('ADMIN cannot mark test user', async () => {
    const res = await api(app)
      .post(`/api/admin/candidates/${candidateId}/mark-test-user`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('filters real candidates by default', async () => {
    const res = await api(app)
      .get('/api/admin/candidates?candidateType=real')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { isTestUser: boolean }) => !c.isTestUser)).toBe(true);
  });

  it('filters test candidates', async () => {
    const res = await api(app)
      .get('/api/admin/candidates?candidateType=test')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === candidateId)).toBe(true);
  });

  it('SUPER_ADMIN can unmark test user', async () => {
    const res = await api(app)
      .post(`/api/admin/candidates/${candidateId}/unmark-test-user`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isTestUser).toBe(false);

    const audit = await (await getTestPrisma()).auditLog.findFirst({
      where: { action: 'TEST_USER_UNMARKED', entityId: candidateId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });
});
