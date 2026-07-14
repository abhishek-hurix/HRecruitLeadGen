import { prisma } from '../src/config/database';

async function main() {
  const testUserIds = await prisma.candidateProfile.findMany({
    where: { isTestUser: true },
    select: { userId: true },
    distinct: ['userId'],
  });
  const userIds = testUserIds.map((row) => row.userId);
  const updated = await prisma.candidateProfile.updateMany({
    where: { userId: { in: userIds }, isTestUser: false },
    data: { isTestUser: true },
  });
  console.log(`Synced ${updated.count} profile(s) for ${userIds.length} test user account(s).`);
}

main().finally(() => prisma.$disconnect());
