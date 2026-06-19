import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp } from '../helpers/app';
import { hasTestDatabase, getTestPrisma, resetTestData, disconnectTestDb } from '../helpers/db';
import { createVerifiedCandidate } from '../helpers/factories';
import { assessmentTokenService } from '../../src/services/assessment-token.service';
import { generateAssessmentToken } from '../../src/utils/jwt';
import { TokenStatus } from '@prisma/client';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Security — Assessment Token Middleware', () => {
  const app = getTestApp();

  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('rejects requests without assessment token', async () => {
    const res = await api(app).get('/api/assessment/ready');
    expect(res.status).toBe(401);
  });

  it('rejects tampered assessment token', async () => {
    const user = await createVerifiedCandidate();
    const { jti } = await assessmentTokenService.createToken(
      user.candidateProfile!.id,
      user.email
    );
    const token = generateAssessmentToken(user.candidateProfile!.id, user.email, jti);
    const tampered = `${token.slice(0, -5)}xxxxx`;
    const res = await api(app)
      .get('/api/assessment/ready')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('allows ready endpoint with valid token', async () => {
    const user = await createVerifiedCandidate();
    const { token } = await assessmentTokenService.createToken(
      user.candidateProfile!.id,
      user.email
    );
    const res = await api(app)
      .get('/api/assessment/ready')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks session after submission except thank-you and ready', async () => {
    const user = await createVerifiedCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    const { token, jti } = await assessmentTokenService.createToken(candidateId, user.email);

    const assessment = await prisma.assessment.create({
      data: { candidateId, language: 'PYTHON', questionIds: [] },
    });
    await prisma.submission.create({
      data: {
        candidateId,
        assessmentId: assessment.id,
        score: 8,
        passedQuestions: 4,
        totalQuestions: 5,
      },
    });
    await prisma.assessmentToken.update({
      where: { jti },
      data: { status: TokenStatus.SUBMITTED },
    });

    const sessionRes = await api(app)
      .get('/api/assessment/session')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionRes.status).toBe(403);

    const thankYouRes = await api(app)
      .get('/api/assessment/thank-you')
      .set('Authorization', `Bearer ${token}`);
    expect(thankYouRes.status).toBe(200);
  });

  it('rejects expired assessment token', async () => {
    const user = await createVerifiedCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const jti = 'expired-jti-test';
    await prisma.assessmentToken.create({
      data: {
        candidateId,
        jti,
        email: user.email,
        expiresAt: past,
        status: TokenStatus.CREATED,
      },
    });
    const token = generateAssessmentToken(candidateId, user.email, jti);
    const res = await api(app)
      .get('/api/assessment/ready')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('blocks admin token on candidate portal routes', async () => {
    const { generateAdminToken } = await import('../../src/utils/jwt');
    const adminToken = generateAdminToken('admin-id', 'admin@hurix.com', 'SUPER_ADMIN');
    const res = await api(app)
      .get('/api/candidate/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});
