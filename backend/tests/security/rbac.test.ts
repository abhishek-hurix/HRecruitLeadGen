import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp, loginSuperAdmin } from '../helpers/app';
import {
  generateAdminToken,
  generateCandidatePortalToken,
} from '../../src/utils/jwt';
import { hasTestDatabase, getTestPrisma, disconnectTestDb } from '../helpers/db';
import { createTestAdmin } from '../helpers/factories';
import { AdminRole } from '@prisma/client';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Security — RBAC & Authorization', () => {
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

  it('blocks anonymous admin dashboard access', async () => {
    const res = await api(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('blocks anonymous candidates list', async () => {
    const res = await api(app).get('/api/admin/candidates');
    expect(res.status).toBe(401);
  });

  it('allows SUPER_ADMIN dashboard access', async () => {
    const res = await api(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks candidate JWT from admin routes', async () => {
    const candidateToken = generateCandidatePortalToken('fake-id', 'c@test.com');
    const res = await api(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks ADMIN from analytics', async () => {
    const res = await api(app)
      .get('/api/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('allows SUPER_ADMIN analytics access', async () => {
    const res = await api(app)
      .get('/api/admin/analytics/overview')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('visitors');
  });

  it('blocks ADMIN from user management', async () => {
    const res = await api(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects tampered admin JWT', async () => {
    const parts = superToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.bad`;
    const res = await api(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('returns admin role from /admin/me', async () => {
    const res = await api(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('SUPER_ADMIN');
  });
});

describeIfDb('Security — JWT type isolation', () => {
  it('admin token cannot be verified as assessment token', async () => {
    const admin = await (await getTestPrisma()).adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
    expect(admin).toBeTruthy();
    const token = generateAdminToken(admin!.id, admin!.email, AdminRole.SUPER_ADMIN);
    const res = await api(getTestApp())
      .get('/api/assessment/ready')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});
