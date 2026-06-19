import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getTestApp, loginSuperAdmin } from '../helpers/app';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createVerifiedCandidate } from '../helpers/factories';
import { generateAssessmentToken } from '../../src/utils/jwt';
import { assessmentTokenService } from '../../src/services/assessment-token.service';
import { CompensationType, JobRoleStatus, Language } from '@prisma/client';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('Job Role Management', () => {
  const app = getTestApp();
  let superToken: string;
  let roleId: string;

  beforeAll(async () => {
    await resetTestData();
    superToken = await loginSuperAdmin(app);
    const prisma = await getTestPrisma();

    const role = await prisma.jobRole.create({
      data: {
        title: 'Test Python Dev',
        country: 'India',
        compensationType: CompensationType.HOURLY,
        hourlyRate: 10,
        currency: 'USD',
        skills: ['Python', 'SQL'],
        status: JobRoleStatus.ACTIVE,
        assessmentLanguages: [Language.PYTHON],
      },
    });
    roleId = role.id;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('SUPER_ADMIN can create job role', async () => {
    const res = await api(app)
      .post('/api/admin/job-roles')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        title: 'Backend Engineer',
        country: 'USA',
        compensationType: 'ANNUAL',
        monthlySalary: 120000,
        currency: 'USD',
        skills: ['Node.js'],
        openPositions: 2,
        assessmentLanguages: ['JAVASCRIPT'],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Backend Engineer');
  });

  it('lists job roles for admin', async () => {
    const res = await api(app)
      .get('/api/admin/job-roles')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('candidate can list active roles via assessment auth', async () => {
    const user = await createVerifiedCandidate();
    const { token } = await assessmentTokenService.createToken(user.candidateProfile!.id, user.email);

    const res = await api(app)
      .get('/api/assessment/job-roles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((r: { id: string }) => r.id === roleId)).toBe(true);
  });

  it('selects role and starts role-specific assessment', async () => {
    const user = await createVerifiedCandidate();
    const candidateId = user.candidateProfile!.id;
    const { jti } = await assessmentTokenService.createToken(candidateId, user.email);
    const token = generateAssessmentToken(candidateId, user.email, jti);

    const res = await api(app)
      .post('/api/assessment/select-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobRoleId: roleId });
    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(0);

    const prisma = await getTestPrisma();
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    expect(profile?.selectedRoleId).toBe(roleId);
    expect(profile?.selectedRoleName).toBe('Test Python Dev');
  });

  it('blocks second role selection', async () => {
    const user = await createVerifiedCandidate();
    const candidateId = user.candidateProfile!.id;
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        selectedRoleId: roleId,
        selectedRoleName: 'Test Python Dev',
        roleSelectedAt: new Date(),
      },
    });
    const { jti } = await assessmentTokenService.createToken(candidateId, user.email);
    const token = generateAssessmentToken(candidateId, user.email, jti);

    const res = await api(app)
      .post('/api/assessment/select-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobRoleId: roleId });
    expect(res.status).toBe(403);
  });

  it('deactivates role', async () => {
    const prisma = await getTestPrisma();
    const inactive = await prisma.jobRole.create({
      data: {
        title: 'Inactive Role',
        country: 'UK',
        compensationType: CompensationType.MONTHLY,
        monthlySalary: 5000,
        currency: 'GBP',
        skills: ['Java'],
        status: JobRoleStatus.INACTIVE,
        assessmentLanguages: [Language.PYTHON],
      },
    });

    const res = await api(app)
      .patch(`/api/admin/job-roles/${inactive.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'ARCHIVED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ARCHIVED');
  });
});
