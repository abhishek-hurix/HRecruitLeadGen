import dotenv from 'dotenv';
import path from 'path';
import {
  AnswerMode,
  Difficulty,
  ExperienceCategory,
  JobRoleStatus,
  Language,
  PrismaClient,
} from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const MANUAL_TOPIC_PREFIX = 'Manual QA';

const experienceBuckets = [
  ExperienceCategory.TWO_THREE,
  ExperienceCategory.THREE_FIVE,
  ExperienceCategory.FIVE_SEVEN,
  ExperienceCategory.SEVEN_TEN,
];

function languagesForRole(assessmentLanguages: unknown): Language[] {
  if (Array.isArray(assessmentLanguages)) {
    const languages = assessmentLanguages.filter((item): item is Language =>
      item === Language.PYTHON || item === Language.JAVASCRIPT,
    );
    if (languages.length > 0) return languages;
  }

  return [Language.PYTHON];
}

function starterCode(language: Language, answerMode: AnswerMode) {
  if (answerMode === AnswerMode.COMPREHENSIVE) return 'Write your answer here...';

  if (language === Language.PYTHON) {
    return `def solve(nums):\n    # Write your code here\n    return 0\n\nif __name__ == "__main__":\n    nums = list(map(int, input().split()))\n    print(solve(nums))`;
  }

  return `function solve(nums) {\n  // Write your code here\n  return 0;\n}\n\nconst fs = require('fs');\nconst nums = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(solve(nums));`;
}

function codingQuestion(roleTitle: string, language: Language, bucket: ExperienceCategory) {
  return {
    language,
    experienceCategory: bucket,
    answerMode: AnswerMode.CODE,
    title: `${roleTitle} - Manual QA Coding (${bucket})`,
    description:
      'Given a list of integers, return the sum of all even numbers. This is a simple manually seeded question for end-to-end assessment testing.',
    inputFormat: 'A single line containing space-separated integers.',
    outputFormat: 'Print one integer: the sum of all even numbers.',
    sampleInput: '1 2 3 4 5 6',
    sampleOutput: '12',
    constraints: '1 <= number of integers <= 1000. Integers may be negative, zero, or positive.',
    difficulty: Difficulty.EASY,
    topic: `${MANUAL_TOPIC_PREFIX} Coding`,
    starterCode: starterCode(language, AnswerMode.CODE),
    testCases: {
      create: [
        { input: '1 2 3 4 5 6', expectedOutput: '12', isHidden: false, sortOrder: 0 },
        { input: '10 11 12', expectedOutput: '22', isHidden: true, sortOrder: 1 },
        { input: '1 3 5', expectedOutput: '0', isHidden: true, sortOrder: 2 },
      ],
    },
  };
}

function comprehensiveQuestion(roleTitle: string, language: Language, bucket: ExperienceCategory) {
  return {
    language,
    experienceCategory: bucket,
    answerMode: AnswerMode.COMPREHENSIVE,
    title: `${roleTitle} - Manual QA Design Answer (${bucket})`,
    description:
      'Explain how you would design a reliable candidate assessment workflow. Cover data validation, retry handling, scoring, and how you would detect suspicious answer patterns.',
    inputFormat: 'No code input. Write a structured explanation.',
    outputFormat: 'A clear written answer with key design decisions and trade-offs.',
    sampleInput: 'N/A',
    sampleOutput: 'N/A',
    constraints: 'Keep the answer practical and implementation-focused.',
    difficulty: Difficulty.EASY_MEDIUM,
    topic: `${MANUAL_TOPIC_PREFIX} Comprehensive`,
    starterCode: starterCode(language, AnswerMode.COMPREHENSIVE),
    testCases: { create: [] },
  };
}

async function ensureDefaultRoles() {
  const activeCount = await prisma.jobRole.count({ where: { status: JobRoleStatus.ACTIVE } });
  if (activeCount > 0) return;

  const closingDate = new Date();
  closingDate.setFullYear(closingDate.getFullYear() + 1);

  await prisma.jobRole.createMany({
    data: [
      {
        title: 'Python Developer',
        country: 'India',
        compensationType: 'HOURLY',
        hourlyRate: 10,
        currency: 'USD',
        skills: ['Python', 'FastAPI', 'PostgreSQL'],
        description: 'Manual QA role for assessment testing.',
        status: 'ACTIVE',
        openPositions: 5,
        assessmentLanguages: ['PYTHON'],
        closingDate,
      },
      {
        title: 'Node.js Developer',
        country: 'India',
        compensationType: 'MONTHLY',
        monthlySalary: 80000,
        currency: 'INR',
        skills: ['Node.js', 'Express', 'PostgreSQL'],
        description: 'Manual QA role for assessment testing.',
        status: 'ACTIVE',
        openPositions: 5,
        assessmentLanguages: ['JAVASCRIPT'],
        closingDate,
      },
      {
        title: 'Fullstack AI Developer',
        country: 'India',
        compensationType: 'MONTHLY',
        monthlySalary: 120000,
        currency: 'INR',
        skills: ['React', 'Node.js', 'AI APIs'],
        description: 'Manual QA role for assessment testing.',
        status: 'ACTIVE',
        openPositions: 5,
        assessmentLanguages: ['PYTHON', 'JAVASCRIPT'],
        closingDate,
      },
    ],
  });
}

async function main() {
  await ensureDefaultRoles();

  const roles = await prisma.jobRole.findMany({
    where: { status: JobRoleStatus.ACTIVE },
    orderBy: { title: 'asc' },
  });

  await prisma.questionTestCase.deleteMany({
    where: { question: { topic: { startsWith: MANUAL_TOPIC_PREFIX } } },
  });
  const deleted = await prisma.question.deleteMany({
    where: { topic: { startsWith: MANUAL_TOPIC_PREFIX } },
  });

  let created = 0;

  for (const role of roles) {
    const roleLanguages = languagesForRole(role.assessmentLanguages);
    const primaryLanguage = roleLanguages[0];

    for (const bucket of experienceBuckets) {
      await prisma.question.create({
        data: {
          jobRoleId: role.id,
          ...codingQuestion(role.title, primaryLanguage, bucket),
        },
      });
      created += 1;

      await prisma.question.create({
        data: {
          jobRoleId: role.id,
          ...comprehensiveQuestion(role.title, primaryLanguage, bucket),
        },
      });
      created += 1;
    }
  }

  console.log(`Deleted old manual QA questions: ${deleted.count}`);
  console.log(`Seeded manual QA questions: ${created}`);
  console.log(`Active roles covered: ${roles.map((role) => role.title).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
