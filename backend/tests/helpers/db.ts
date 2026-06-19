import { PrismaClient } from '@prisma/client';

export function hasTestDatabase(): boolean {
  return !!process.env.TEST_DATABASE_URL;
}

export async function getTestPrisma(): Promise<PrismaClient> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for integration tests');
  }
  const { prisma } = await import('../../src/config/database');
  return prisma;
}

export async function disconnectTestDb() {
  const globalForPrisma = globalThis as { prisma?: PrismaClient };
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    delete globalForPrisma.prisma;
  }
}

export async function resetTestData() {
  const prisma = await getTestPrisma();
  await prisma.submissionAnswer.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.assessmentToken.deleteMany();
  await prisma.visitor.deleteMany();
  await prisma.user.deleteMany();
}
