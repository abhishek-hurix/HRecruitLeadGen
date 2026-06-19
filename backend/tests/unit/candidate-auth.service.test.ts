import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { AppError } from '../../src/utils/errors';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestCandidate, createVerifiedCandidate } from '../helpers/factories';

const mockVerifyIdToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerifyIdToken;
  },
}));

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('CandidateAuthService', () => {
  let candidateAuthService: typeof import('../../src/services/candidate-auth.service').candidateAuthService;

  beforeAll(async () => {
    await resetTestData();
    ({ candidateAuthService } = await import('../../src/services/candidate-auth.service'));
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('loginWithPassword succeeds for valid credentials', async () => {
    const user = await createTestCandidate();
    const result = await candidateAuthService.loginWithPassword(user.email, 'TestPass123!');
    expect(result.token).toBeDefined();
    expect(result.candidate.email).toBe(user.email);
    expect(result.candidate.fullName).toBe('Test Candidate');
  });

  it('loginWithPassword rejects unknown email', async () => {
    await expect(
      candidateAuthService.loginWithPassword('nobody@hurix.com', 'TestPass123!')
    ).rejects.toThrow(AppError);
  });

  it('loginWithPassword rejects wrong password', async () => {
    const user = await createTestCandidate();
    await expect(
      candidateAuthService.loginWithPassword(user.email, 'WrongPass!')
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('loginWithPassword rejects user without password', async () => {
    const user = await createTestCandidate();
    const prisma = await getTestPrisma();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: null },
    });
    await expect(
      candidateAuthService.loginWithPassword(user.email, 'TestPass123!')
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('loginWithGoogle links account and issues session', async () => {
    const user = await createTestCandidate();
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: user.email, sub: 'google-sub-123' }),
    });

    const result = await candidateAuthService.loginWithGoogle('fake-credential');
    expect(result.token).toBeDefined();
    expect(result.candidate.email).toBe(user.email);

    const prisma = await getTestPrisma();
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.googleId).toBe('google-sub-123');
  });

  it('loginWithGoogle rejects unregistered email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'stranger@hurix.com', sub: 'google-999' }),
    });
    await expect(candidateAuthService.loginWithGoogle('fake')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('loginWithGoogle rejects mismatched Google account', async () => {
    const user = await createTestCandidate();
    const prisma = await getTestPrisma();
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: 'different-google-id' },
    });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: user.email, sub: 'new-google-id' }),
    });
    await expect(candidateAuthService.loginWithGoogle('fake')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('getAssessmentAccessToken requires email verification', async () => {
    const user = await createTestCandidate();
    await expect(
      candidateAuthService.getAssessmentAccessToken(user.candidateProfile!.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('getAssessmentAccessToken issues token for verified candidate', async () => {
    const user = await createVerifiedCandidate();
    const result = await candidateAuthService.getAssessmentAccessToken(user.candidateProfile!.id);
    expect(result.token).toBeDefined();
  });

  it('getAssessmentAccessToken blocks after submission', async () => {
    const user = await createVerifiedCandidate();
    const prisma = await getTestPrisma();
    const candidateId = user.candidateProfile!.id;
    await prisma.submission.create({
      data: {
        candidateId,
        assessmentId: (
          await prisma.assessment.create({
            data: {
              candidateId,
              language: 'PYTHON',
              questionIds: [],
            },
          })
        ).id,
        score: 5,
        passedQuestions: 1,
        totalQuestions: 2,
      },
    });
    await expect(candidateAuthService.getAssessmentAccessToken(candidateId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
