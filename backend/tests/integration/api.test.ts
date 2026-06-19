import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp } from '../helpers/app';
import { hasTestDatabase, resetTestData, disconnectTestDb } from '../helpers/db';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('API Integration — Health', () => {
  const app = getTestApp();

  it('GET /api/health returns ok', async () => {
    const res = await api(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describeIfDb('API Integration — Visitors', () => {
  const app = getTestApp();

  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('POST /api/visitors/track creates visitor', async () => {
    const res = await api(app)
      .post('/api/visitors/track')
      .send({
        visitorId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        landingPage: 'https://talent.hurix.com/?utm_source=youtube&utm_medium=video&utm_campaign=e2e',
        utm_source: 'youtube',
        utm_medium: 'video',
        utm_campaign: 'e2e',
        deviceType: 'DESKTOP',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isNew).toBe(true);
  });

  it('rejects invalid visitor ID', async () => {
    const res = await api(app)
      .post('/api/visitors/track')
      .send({ visitorId: 'short', landingPage: 'https://talent.hurix.com' });
    expect(res.status).toBe(400);
  });
});

describeIfDb('API Integration — Admin Auth', () => {
  const app = getTestApp();

  it('POST /api/admin/login with valid credentials', async () => {
    const res = await api(app)
      .post('/api/admin/login')
      .send({ email: 'admin@hurixdigital.com', password: 'HurixAdmin@2026' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /api/admin/login rejects invalid credentials', async () => {
    const res = await api(app)
      .post('/api/admin/login')
      .send({ email: 'admin@hurixdigital.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
