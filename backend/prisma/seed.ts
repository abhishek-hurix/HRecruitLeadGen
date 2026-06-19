import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient, Language } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateAllQuestions } from './question-bank';

// Load .env before PrismaClient reads DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Ensure backend/.env exists.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Hurix Talent Assessment Platform...');
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@hurixdigital.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'HurixAdmin@2026';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'SUPER_ADMIN' },
    create: { email: adminEmail, passwordHash, role: 'SUPER_ADMIN' },
  });
  console.log(`✓ Admin user: ${adminEmail}`);

  const referrals = [
    { employeeId: 'EMP001', employeeName: 'John Smith' },
    { employeeId: 'EMP002', employeeName: 'Sarah Johnson' },
    { employeeId: 'EMP003', employeeName: 'Mike Chen' },
  ];

  for (const ref of referrals) {
    await prisma.referral.upsert({
      where: { employeeId: ref.employeeId },
      update: {},
      create: ref,
    });
  }
  console.log(`✓ Referral codes: ${referrals.length}`);

  const pyCount = await prisma.question.count({ where: { language: Language.PYTHON } });
  const jsCount = await prisma.question.count({ where: { language: Language.JAVASCRIPT } });

  if (pyCount >= 100 && jsCount >= 100) {
    console.log(`✓ Questions already seeded (${pyCount} Python, ${jsCount} JavaScript)`);
  } else {
    const { python, javascript } = generateAllQuestions();
    console.log(`Generated ${python.length} Python + ${javascript.length} JavaScript question templates`);

    if (pyCount < 100) {
      for (const q of python) {
        await prisma.question.create({
          data: {
            language: Language.PYTHON,
            title: q.title,
            description: q.description,
            inputFormat: q.inputFormat,
            outputFormat: q.outputFormat,
            sampleInput: q.sampleInput,
            sampleOutput: q.sampleOutput,
            constraints: q.constraints,
            difficulty: q.difficulty,
            topic: q.topic,
            starterCode: q.starterCodePy,
            testCases: {
              create: q.testCases.map((tc, i) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.isHidden,
                sortOrder: i,
              })),
            },
          },
        });
      }
      console.log(`✓ Seeded ${python.length} Python questions`);
    }

    if (jsCount < 100) {
      for (const q of javascript) {
        await prisma.question.create({
          data: {
            language: Language.JAVASCRIPT,
            title: q.title,
            description: q.description,
            inputFormat: q.inputFormat,
            outputFormat: q.outputFormat,
            sampleInput: q.sampleInput,
            sampleOutput: q.sampleOutput,
            constraints: q.constraints,
            difficulty: q.difficulty,
            topic: q.topic,
            starterCode: q.starterCodeJs,
            testCases: {
              create: q.testCases.map((tc, i) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.isHidden,
                sortOrder: i,
              })),
            },
          },
        });
      }
      console.log(`✓ Seeded ${javascript.length} JavaScript questions`);
    }
  }

  const finalPy = await prisma.question.count({ where: { language: Language.PYTHON } });
  const finalJs = await prisma.question.count({ where: { language: Language.JAVASCRIPT } });
  const testCaseCount = await prisma.questionTestCase.count();

  const roleCount = await prisma.jobRole.count();
  if (roleCount === 0) {
    const closing = new Date();
    closing.setFullYear(closing.getFullYear() + 1);

    await prisma.jobRole.createMany({
      data: [
        {
          title: 'Python Developer',
          country: 'India',
          compensationType: 'HOURLY',
          hourlyRate: 10,
          currency: 'USD',
          skills: ['Python', 'FastAPI', 'SQL'],
          description: 'Build scalable backend services with Python and FastAPI.',
          status: 'INACTIVE',
          openPositions: 5,
          assessmentLanguages: ['PYTHON'],
          closingDate: closing,
        },
        {
          title: 'Node.js Developer',
          country: 'India',
          compensationType: 'MONTHLY',
          monthlySalary: 8,
          currency: 'INR',
          skills: ['Node.js', 'Express', 'MongoDB'],
          description: 'Develop REST APIs and microservices with Node.js.',
          status: 'INACTIVE',
          openPositions: 3,
          assessmentLanguages: ['JAVASCRIPT'],
          closingDate: closing,
        },
        {
          title: 'Full Stack Developer',
          country: 'Canada',
          compensationType: 'ANNUAL',
          monthlySalary: 70000,
          currency: 'CAD',
          skills: ['React', 'Node.js', 'PostgreSQL'],
          description: 'End-to-end product development across frontend and backend.',
          status: 'INACTIVE',
          openPositions: 2,
          assessmentLanguages: ['PYTHON', 'JAVASCRIPT'],
          closingDate: closing,
        },
      ],
    });
    console.log('✓ Seeded 3 default job roles');
  }

  console.log('\n=== Seed Verification ===');
  console.log(`Questions (Python):     ${finalPy}`);
  console.log(`Questions (JavaScript): ${finalJs}`);
  console.log(`Questions (Total):      ${finalPy + finalJs}`);
  console.log(`QuestionTestCases:      ${testCaseCount}`);
  console.log('=========================\n');

  if (finalPy + finalJs < 200 || testCaseCount === 0) {
    throw new Error('Seed verification failed: insufficient questions or test cases');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
