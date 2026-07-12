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
  await prisma.candidateInterviewParticipant.deleteMany().catch(() => undefined);
  await prisma.candidateInterview.deleteMany().catch(() => undefined);
  await prisma.emailReminderDelivery.deleteMany().catch(() => undefined);
  await prisma.emailReminderTemplate.deleteMany().catch(() => undefined);
  await prisma.adminBulkOperationItem.deleteMany().catch(() => undefined);
  await prisma.adminBulkOperation.deleteMany().catch(() => undefined);
  await prisma.candidateRejection.deleteMany().catch(() => undefined);
  await prisma.adminGoogleCalendar.deleteMany().catch(() => undefined);
  await prisma.idempotencyRecord.deleteMany().catch(() => undefined);
  await prisma.visitor.deleteMany();
  await prisma.user.deleteMany();
}
