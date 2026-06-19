import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestCandidate } from '../helpers/factories';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Database Integration', () => {
  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates and reads candidate profile', async () => {
    const user = await createTestCandidate();
    expect(user.candidateProfile?.fullName).toBe('Test Candidate');
  });

  it('enforces unique email constraint', async () => {
    const email = `unique.${randomUUID().slice(0, 8)}@hurix.com`;
    await createTestCandidate(email);
    await expect(createTestCandidate(email)).rejects.toThrow();
  });

  it('cascade deletes candidate data when user deleted', async () => {
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    await (await getTestPrisma()).user.delete({ where: { id: user.id } });
    const profile = await (await getTestPrisma()).candidateProfile.findUnique({ where: { id: candidateId } });
    expect(profile).toBeNull();
  });

  it('enforces unique visitor_id', async () => {
    const visitorId = randomUUID();
    await (await getTestPrisma()).visitor.create({
      data: {
        visitorId,
        landingPage: 'https://talent.hurix.com',
      },
    });
    await expect(
      (await getTestPrisma()).visitor.create({
        data: { visitorId, landingPage: 'https://talent.hurix.com' },
      })
    ).rejects.toThrow();
  });

  it('has seeded super admin', async () => {
    const admin = await (await getTestPrisma()).adminUser.findUnique({
      where: { email: 'admin@hurixdigital.com' },
    });
    expect(admin).toBeTruthy();
    expect(admin?.role).toBe('SUPER_ADMIN');
  });
});
