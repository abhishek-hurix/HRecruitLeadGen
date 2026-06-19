import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { generateSessionToken } from '../src/utils/jwt';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: `test.${Date.now()}@hurix.com`,
      candidateProfile: {
        create: {
          fullName: 'Test Candidate',
          phone: '1234567890',
          linkedinUrl: 'https://linkedin.com/in/testcandidate',
          resumePath: 'resumes/test.pdf',
        },
      },
    },
    include: { candidateProfile: true },
  });

  const candidateId = user.candidateProfile!.id;
  const token = generateSessionToken(candidateId);
  console.log(JSON.stringify({ candidateId, token }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
