import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { AdminRole, DeviceType, ExperienceCategory } from '@prisma/client';
import { getTestPrisma } from './db';

export async function createTestAdmin(role: AdminRole = AdminRole.ADMIN) {
  const prisma = await getTestPrisma();
  const email = `admin.${randomUUID().slice(0, 8)}@hurix.com`;
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('TestAdmin123!', 12),
      role,
    },
  });
}

export async function createTestVisitor(overrides: Partial<{
  visitorId: string;
  source: string;
  campaign: string;
  isTest: boolean;
  isInternal: boolean;
}> = {}) {
  const prisma = await getTestPrisma();
  const visitorId = overrides.visitorId || randomUUID();
  return prisma.visitor.create({
    data: {
      visitorId,
      firstTouchSource: overrides.source || 'youtube',
      lastTouchSource: overrides.source || 'youtube',
      lastTouchCampaign: overrides.campaign || 'test_campaign',
      landingPage: 'https://talent.hurix.com/?utm_source=youtube',
      deviceType: DeviceType.DESKTOP,
      isTest: overrides.isTest ?? false,
      isInternal: overrides.isInternal ?? false,
    },
  });
}

export async function createTestCandidate(email?: string) {
  const prisma = await getTestPrisma();
  const userEmail = email || `candidate.${randomUUID().slice(0, 8)}@hurix.com`;
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      candidateProfiles: {
        create: {
          fullName: 'Test Candidate',
          phone: '9876543210',
          countryCode: '+91',
          phoneNumber: '9876543210',
          fullPhone: '+919876543210',
          phoneCountry: 'India',
          experienceCategory: ExperienceCategory.TWO_THREE,
          yearsOfExperience: 2,
          linkedinUrl: 'https://linkedin.com/in/testuser',
          resumePath: 'resumes/test.pdf',
        },
      },
    },
    include: { candidateProfiles: true },
  });

  // Compatibility shim: older tests still read user.candidateProfile
  return {
    ...user,
    candidateProfile: user.candidateProfiles[0] ?? null,
  };
}

export function mockUtmPayload() {
  return {
    utm_source: 'youtube',
    utm_medium: 'video',
    utm_campaign: 'ai_hiring_2026',
    utm_term: 'genai',
    utm_content: 'shorts',
  };
}

export async function createTestQuestion() {
  const prisma = await getTestPrisma();
  return prisma.question.create({
    data: {
      language: 'PYTHON',
      title: 'Sum Two Numbers',
      description: 'Add two integers',
      inputFormat: 'Two integers',
      outputFormat: 'One integer',
      sampleInput: '1 2',
      sampleOutput: '3',
      constraints: 'None',
      difficulty: 'EASY',
      topic: 'math',
      starterCode: 'def solve(data):\n    pass',
      testCases: {
        create: [
          { input: '1 2', expectedOutput: '3', isHidden: true, sortOrder: 0 },
          { input: '5 5', expectedOutput: '10', isHidden: false, sortOrder: 1 },
        ],
      },
    },
    include: { testCases: true },
  });
}

export async function createVerifiedCandidate(email?: string) {
  const user = await createTestCandidate(email);
  const prisma = await getTestPrisma();
  await prisma.candidateProfile.update({
    where: { id: user.candidateProfile!.id },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  });
  return user;
}
