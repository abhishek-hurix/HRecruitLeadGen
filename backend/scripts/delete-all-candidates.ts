import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.candidateProfile.count();

  // Cascade deletes: profiles → assessments, tokens, submissions, etc.
  await prisma.user.deleteMany({});

  const after = await prisma.candidateProfile.count();
  console.log(`Deleted ${before} candidate(s). Remaining: ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
