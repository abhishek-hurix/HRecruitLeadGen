import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdminRole } from '@prisma/client';
import { api, getTestApp, loginSuperAdmin } from '../helpers/app';
import { generateAdminToken } from '../../src/utils/jwt';
import { hasTestDatabase, disconnectTestDb, getTestPrisma } from '../helpers/db';
import { createTestAdmin, createTestCandidate } from '../helpers/factories';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Candidate Management — medium priority APIs', () => {
  const app = getTestApp();
  let superToken: string;
  let adminToken: string;

  beforeAll(async () => {
    superToken = await loginSuperAdmin(app);
    const admin = await createTestAdmin(AdminRole.ADMIN);
    adminToken = generateAdminToken(admin.id, admin.email, AdminRole.ADMIN);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('includes requestId on list and validation errors', async () => {
    const bad = await api(app)
      .get('/api/admin/candidates')
      .query({ sortBy: 'not-a-field' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(bad.status).toBe(400);
    expect(bad.body.requestId).toBeTruthy();

    const ok = await api(app)
      .get('/api/admin/candidates')
      .query({ page: 1, pageSize: 25, sortBy: 'registeredAt', sortOrder: 'desc' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
  });

  it('filters by countryCodes and inactivityDays', async () => {
    const res = await api(app)
      .get('/api/admin/candidates')
      .query({ countryCodes: 'IN,US', inactivityDays: 90, pageSize: 25 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta || res.body.pagination).toBeTruthy();
  });

  it('returns score breakdown for active candidate only', async () => {
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;

    const ok = await api(app)
      .get(`/api/admin/candidates/${id}/score-breakdown`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.candidateId).toBe(id);
    expect(ok.body.data.aggregateOnly).toBe(true);

    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const gone = await api(app)
      .get(`/api/admin/candidates/${id}/score-breakdown`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(gone.status).toBe(404);
  });

  it('blocks ADMIN owner assignment and allows SUPER_ADMIN', async () => {
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;
    const owners = await api(app)
      .get('/api/admin/candidate-owners')
      .set('Authorization', `Bearer ${superToken}`);
    expect(owners.status).toBe(200);
    const ownerId = owners.body.data[0]?.id;

    const denied = await api(app)
      .patch(`/api/admin/candidates/${id}/owner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ownerAdminId: ownerId });
    expect(denied.status).toBe(403);

    const allowed = await api(app)
      .patch(`/api/admin/candidates/${id}/owner`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ownerAdminId: ownerId });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.owner?.id).toBe(ownerId);
  });

  it('activity timeline returns events for active candidate', async () => {
    const user = await createTestCandidate();
    const id = user.candidateProfile!.id;
    const res = await api(app)
      .get(`/api/admin/candidates/${id}/activity`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.events)).toBe(true);
  });
});
