import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp } from '../helpers/app';
import { hasTestDatabase, resetTestData, disconnectTestDb } from '../helpers/db';
import { createTestCandidate } from '../helpers/factories';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('API Integration — Candidate Auth', () => {
  const app = getTestApp();

  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('POST /api/auth/login with valid credentials', async () => {
    const user = await createTestCandidate();
    const res = await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.candidate.email).toBe(user.email);
  });

  it('POST /api/auth/login rejects invalid password', async () => {
    const user = await createTestCandidate();
    const res = await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('GET /api/candidate/dashboard requires auth', async () => {
    const res = await api(app).get('/api/candidate/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/candidate/dashboard returns data when authenticated', async () => {
    const user = await createTestCandidate();
    const login = await api(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'TestPass123!' });

    const res = await api(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
  });
});
