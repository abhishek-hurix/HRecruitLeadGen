import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp } from '../helpers/app';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestCandidate } from '../helpers/factories';
import {
  generateEmailVerificationToken,
  generateCandidatePortalToken,
} from '../../src/utils/jwt';
import { randomUUID } from 'crypto';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Email Verification', () => {
  const app = getTestApp();

  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function createVerificationToken(candidateId: string, email: string) {
    const prisma = await getTestPrisma();
    const jti = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await prisma.emailVerificationToken.create({
      data: { candidateId, jti, email, expiresAt },
    });
    return generateEmailVerificationToken(candidateId, email, jti);
  }

  it('GET /api/verify-email verifies unverified candidate', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const token = await createVerificationToken(candidateId, user.email);

    const res = await api(app).get('/api/verify-email').query({ token });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const prisma = await getTestPrisma();
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    expect(profile?.emailVerified).toBe(true);
    expect(profile?.emailVerifiedAt).not.toBeNull();
  });

  it('rejects already-used verification token', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const token = await createVerificationToken(candidateId, user.email);

    await api(app).get('/api/verify-email').query({ token });
    const res = await api(app).get('/api/verify-email').query({ token });
    expect(res.status).toBe(400);
  });

  it('rejects tampered verification token', async () => {
    const user = await createTestCandidate();
    const token = await createVerificationToken(user.candidateProfile!.id, user.email);
    const tampered = `${token.slice(0, -5)}xxxxx`;
    const res = await api(app).get('/api/verify-email').query({ token: tampered });
    expect(res.status).toBe(401);
  });

  it('rejects expired verification token', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    const jti = randomUUID();
    const past = new Date();
    past.setHours(past.getHours() - 1);
    await prisma.emailVerificationToken.create({
      data: { candidateId, jti, email: user.email, expiresAt: past },
    });
    const token = generateEmailVerificationToken(candidateId, user.email, jti);
    const res = await api(app).get('/api/verify-email').query({ token });
    expect(res.status).toBe(401);
  });

  it('POST /api/candidate/resend-verification requires auth', async () => {
    const res = await api(app).post('/api/candidate/resend-verification');
    expect(res.status).toBe(401);
  });

  it('POST /api/candidate/resend-verification sends for unverified candidate', async () => {
    const user = await createTestCandidate();
    const portalToken = generateCandidatePortalToken(user.candidateProfile!.id, user.email);

    const res = await api(app)
      .post('/api/candidate/resend-verification')
      .set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('sent');
  });

  it('hides resend for verified candidate', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    const portalToken = generateCandidatePortalToken(candidateId, user.email);

    const res = await api(app)
      .post('/api/candidate/resend-verification')
      .set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(400);
  });

  it('rate limits resend to 3 per hour', async () => {
    const user = await createTestCandidate();
    const portalToken = generateCandidatePortalToken(user.candidateProfile!.id, user.email);
    const auth = { Authorization: `Bearer ${portalToken}` };

    await api(app).post('/api/candidate/resend-verification').set(auth);
    await api(app).post('/api/candidate/resend-verification').set(auth);
    await api(app).post('/api/candidate/resend-verification').set(auth);
    const res = await api(app).post('/api/candidate/resend-verification').set(auth);
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Too many');
  });

  it('GET /api/candidate/verification-status returns status', async () => {
    const user = await createTestCandidate();
    const portalToken = generateCandidatePortalToken(user.candidateProfile!.id, user.email);

    const res = await api(app)
      .get('/api/candidate/verification-status')
      .set('Authorization', `Bearer ${portalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.emailVerified).toBe(false);
    expect(res.body.data.canResend).toBe(true);
  });
});
