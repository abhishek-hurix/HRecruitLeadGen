import { AnswerMode, CompensationType, Difficulty, ExperienceCategory, JobRoleStatus, Language, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getExperienceLabel } from '../utils/experience';

export function formatCompensation(role: {
  compensationType: CompensationType;
  hourlyRate: Prisma.Decimal | null;
  monthlySalary: Prisma.Decimal | null;
  currency: string;
}): string {
  const cur = role.currency;
  if (role.compensationType === CompensationType.HOURLY && role.hourlyRate != null) {
    return `${cur} ${Number(role.hourlyRate)}/hour`;
  }
  if (role.compensationType === CompensationType.MONTHLY && role.monthlySalary != null) {
    if (cur === 'INR') return `₹${Number(role.monthlySalary)} LPA`;
    return `${cur} ${Number(role.monthlySalary)}/month`;
  }
  if (role.compensationType === CompensationType.ANNUAL && role.monthlySalary != null) {
    return `${cur} ${Number(role.monthlySalary).toLocaleString()}/year`;
  }
  return 'Competitive';
}

export function parseAssessmentLanguages(raw: unknown): Language[] {
  if (!Array.isArray(raw)) return [Language.PYTHON];
  const langs = raw.filter((l): l is Language => l === 'PYTHON' || l === 'JAVASCRIPT');
  return langs.length > 0 ? langs : [Language.PYTHON];
}

const GENERATION_EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  ExperienceCategory.FRESHER,
  ExperienceCategory.ZERO_ONE,
  ExperienceCategory.ONE_TWO,
  ExperienceCategory.TWO_THREE,
  ExperienceCategory.THREE_FIVE,
  ExperienceCategory.FIVE_SEVEN,
  ExperienceCategory.SEVEN_TEN,
  ExperienceCategory.TEN_PLUS,
];

const MCQ_DIFFICULTY_DISTRIBUTION: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.HARD,
  Difficulty.HARD,
  Difficulty.HARD,
];

type GeneratedQuestion = {
  title: string;
  description: string;
  difficulty?: Difficulty;
  topic?: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
};

function truncate(value: string, maxLength = 1000): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function normalizeGeneratedQuestion(question: Partial<GeneratedQuestion>, language: Language): GeneratedQuestion {
  const options = Array.isArray(question.options)
    ? question.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 4)
    : [];
  const normalizedOptions = options.length === 4
    ? options
    : ['Option A', 'Option B', 'Option C', 'Option D'];
  const correctOptionIndex =
    typeof question.correctOptionIndex === 'number' &&
    question.correctOptionIndex >= 0 &&
    question.correctOptionIndex <= 3
      ? question.correctOptionIndex
      : 0;

  return {
    title: truncate(String(question.title || 'Generated Assessment Question'), 180),
    description: String(question.description || 'Choose the best answer.'),
    difficulty:
      question.difficulty === Difficulty.EASY ||
      question.difficulty === Difficulty.MEDIUM ||
      question.difficulty === Difficulty.HARD
        ? question.difficulty
        : Difficulty.MEDIUM,
    topic: truncate(String(question.topic || `${language} MCQ`), 80),
    options: normalizedOptions,
    correctOptionIndex,
    explanation: String(question.explanation || ''),
  };
}

export class JobRoleService {
  formatRoleForCandidate(role: {
    id: string;
    title: string;
    country: string;
    compensationType: CompensationType;
    hourlyRate: Prisma.Decimal | null;
    monthlySalary: Prisma.Decimal | null;
    currency: string;
    skills: unknown;
    description: string | null;
    openPositions: number;
    closingDate: Date | null;
  }) {
    return {
      id: role.id,
      title: role.title,
      country: role.country,
      compensation: formatCompensation(role),
      skills: Array.isArray(role.skills) ? (role.skills as string[]) : [],
      description: role.description,
      openPositions: role.openPositions,
      closingDate: role.closingDate,
    };
  }

  async listActiveRoles() {
    const now = new Date();
    const roles = await prisma.jobRole.findMany({
      where: {
        status: JobRoleStatus.ACTIVE,
        OR: [{ closingDate: null }, { closingDate: { gte: now } }],
        questions: {
          some: {
            isActive: true,
            answerMode: AnswerMode.MCQ,
          },
        },
      },
      orderBy: { title: 'asc' },
    });
    return roles.map((r) => this.formatRoleForCandidate(r));
  }

  async listAllRoles() {
    const roles = await prisma.jobRole.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(roles.map((r) => this.enrichWithAnalytics(r)));
  }

  async getRoleById(id: string) {
    const role = await prisma.jobRole.findUnique({ where: { id } });
    if (!role) throw new AppError(404, 'Job role not found');
    return this.enrichWithAnalytics(role);
  }

  private async enrichWithAnalytics(role: {
    id: string;
    title: string;
    country: string;
    compensationType: CompensationType;
    hourlyRate: Prisma.Decimal | null;
    monthlySalary: Prisma.Decimal | null;
    currency: string;
    skills: unknown;
    description: string | null;
    status: JobRoleStatus;
    openPositions: number;
    applicationsReceived: number;
    assessmentLanguages: unknown;
    closingDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const candidates = await prisma.candidateProfile.findMany({
      where: { selectedRoleId: role.id },
      include: { submissions: true, assessments: true },
    });

    const started = candidates.filter(
      (c) =>
        c.assessmentStatus === 'IN_PROGRESS' ||
        c.assessmentStatus === 'SUBMITTED' ||
        c.candidateStatus === 'STARTED' ||
        c.candidateStatus === 'SUBMITTED'
    ).length;

    const submitted = candidates.filter((c) => c.submissions.length > 0).length;
    const scores = candidates.flatMap((c) => c.submissions.map((s) => Number(s.score)));
    const averageScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const activeQuestionCount = await prisma.question.count({
      where: { jobRoleId: role.id, isActive: true, answerMode: AnswerMode.MCQ },
    });

    const applications = role.applicationsReceived;
    const conversionRate =
      applications > 0 ? ((submitted / applications) * 100).toFixed(0) + '%' : '0%';

    return {
      ...role,
      skills: Array.isArray(role.skills) ? (role.skills as string[]) : [],
      assessmentLanguages: parseAssessmentLanguages(role.assessmentLanguages),
      compensationDisplay: formatCompensation(role),
      analytics: {
        applicationsReceived: applications,
        assessmentStarted: started,
        assessmentSubmitted: submitted,
        averageScore: averageScore != null ? Number(averageScore.toFixed(1)) : null,
        conversionRate,
      },
      activeQuestionCount,
    };
  }

  async createRole(
    data: {
      title: string;
      country: string;
      compensationType: CompensationType;
      hourlyRate?: number | null;
      monthlySalary?: number | null;
      currency: string;
      skills: string[];
      description?: string | null;
      openPositions: number;
      closingDate?: Date | null;
      status?: JobRoleStatus;
      assessmentLanguages: Language[];
    },
    adminId: string
  ) {
    const role = await prisma.jobRole.create({
      data: {
        title: data.title.trim(),
        country: data.country.trim(),
        compensationType: data.compensationType,
        hourlyRate: data.hourlyRate ?? null,
        monthlySalary: data.monthlySalary ?? null,
        currency: data.currency,
        skills: data.skills,
        description: data.description?.trim() || null,
        openPositions: data.openPositions,
        closingDate: data.closingDate ?? null,
        status: data.status ?? JobRoleStatus.ACTIVE,
        assessmentLanguages: data.assessmentLanguages,
      },
    });

    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'CREATE_JOB_ROLE', entityType: 'job_role', entityId: role.id },
    });

    return this.getRoleById(role.id);
  }

  async updateRole(
    id: string,
    data: Partial<{
      title: string;
      country: string;
      compensationType: CompensationType;
      hourlyRate: number | null;
      monthlySalary: number | null;
      currency: string;
      skills: string[];
      description: string | null;
      openPositions: number;
      closingDate: Date | null;
      status: JobRoleStatus;
      assessmentLanguages: Language[];
    }>,
    adminId: string
  ) {
    await prisma.jobRole.findUniqueOrThrow({ where: { id } });
    await prisma.jobRole.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'UPDATE_JOB_ROLE', entityType: 'job_role', entityId: id },
    });
    return this.getRoleById(id);
  }

  async setRoleStatus(id: string, status: JobRoleStatus, adminId: string) {
    await prisma.jobRole.update({ where: { id }, data: { status } });
    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: `JOB_ROLE_${status}`, entityType: 'job_role', entityId: id },
    });
    return this.getRoleById(id);
  }

  async deleteRole(id: string, adminId: string) {
    const applicants = await prisma.candidateProfile.count({ where: { selectedRoleId: id } });
    if (applicants > 0) {
      throw new AppError(400, 'Cannot delete a role with candidate applications. Archive it instead.');
    }
    await prisma.jobRole.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'DELETE_JOB_ROLE', entityType: 'job_role', entityId: id },
    });
  }

  async generateQuestionsForRole(id: string, adminId: string) {
    if (!config.ai.openaiApiKey) {
      throw new AppError(400, 'OPENAI_API_KEY is not configured.');
    }

    const role = await prisma.jobRole.findUnique({ where: { id } });
    if (!role) throw new AppError(404, 'Job role not found');

    const skills = Array.isArray(role.skills) ? (role.skills as string[]) : [];
    const languages = parseAssessmentLanguages(role.assessmentLanguages);
    const primaryLanguage = languages[0];
    let createdCount = 0;

    await prisma.question.updateMany({
      where: { jobRoleId: role.id, isActive: true },
      data: { isActive: false },
    });

    const questions = await this.requestAiQuestions({
      roleTitle: role.title,
      skills,
      language: primaryLanguage,
      description: role.description,
    });

    for (const [index, rawQuestion] of questions.slice(0, 10).entries()) {
      const question = normalizeGeneratedQuestion(rawQuestion, primaryLanguage);
      await prisma.question.create({
        data: {
          jobRoleId: role.id,
          experienceCategory: null,
          answerMode: AnswerMode.MCQ,
          language: primaryLanguage,
          title: question.title,
          description: question.description,
          inputFormat: 'Choose one option.',
          outputFormat: 'Selected option.',
          sampleInput: '',
          sampleOutput: '',
          constraints: 'Select the best answer from the four options.',
          difficulty: MCQ_DIFFICULTY_DISTRIBUTION[index] || question.difficulty || Difficulty.MEDIUM,
          topic: question.topic || 'Role Specific MCQ',
          starterCode: '',
          mcqOptions: question.options || [],
          correctOptionIndex: question.correctOptionIndex ?? 0,
          explanation: question.explanation || null,
        },
      });
      createdCount++;
    }

    await prisma.auditLog.create({
      data: {
        adminUserId: adminId,
        action: 'GENERATE_JOB_ROLE_QUESTIONS',
        entityType: 'job_role',
        entityId: role.id,
        metadata: { createdCount, language: primaryLanguage, questionType: 'MCQ' },
      },
    });

    return { createdCount };
  }

  private async requestAiQuestions(params: {
    roleTitle: string;
    skills: string[];
    language: Language;
    description: string | null;
  }): Promise<GeneratedQuestion[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.scoringModel,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You generate practical hiring assessment questions. Return strict JSON only. Questions must be original, role-specific, and suitable for timed online assessments.',
          },
          {
            role: 'user',
            content: `Generate exactly 10 multiple-choice assessment questions for this job role.

Role: ${params.roleTitle}
Role description: ${params.description || 'N/A'}
Skills: ${params.skills.join(', ') || 'N/A'}
Language: ${params.language}

Required distribution:
- Exactly 3 EASY questions
- Exactly 4 MEDIUM questions
- Exactly 3 HARD questions

Return JSON:
{
  "questions": [
    {
      "title": "string",
      "description": "string",
      "difficulty": "EASY" or "MEDIUM" or "HARD",
      "topic": "string",
      "options": ["A", "B", "C", "D"],
      "correctOptionIndex": 0,
      "explanation": "short explanation"
    }
  ]
}

Rules:
- Each question must have exactly 4 plausible options.
- correctOptionIndex must be 0, 1, 2, or 3.
- Questions should test practical role-specific knowledge, debugging, architecture, and production judgment.
- Do not generate coding tasks. Generate MCQs only.
- The final array must contain exactly 10 questions in this order: first 3 EASY, next 4 MEDIUM, last 3 HARD.
- Keep each question self-contained and avoid trick questions.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI question generation failed', { status: response.status, error: truncate(errorText, 500) });
      throw new AppError(502, `OpenAI question generation failed (${response.status}).`);
    }

    const completion = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new AppError(502, 'OpenAI returned an empty question generation response.');

    const parsed = JSON.parse(content) as { questions?: Partial<GeneratedQuestion>[] };
    if (!Array.isArray(parsed.questions)) {
      throw new AppError(502, 'OpenAI returned invalid question generation JSON.');
    }
    return parsed.questions.map((question) => normalizeGeneratedQuestion(question, params.language));
  }

  async selectRoleForCandidate(candidateId: string, jobRoleId: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    const role = await prisma.jobRole.findUnique({ where: { id: jobRoleId } });
    if (!role || role.status !== JobRoleStatus.ACTIVE) {
      throw new AppError(404, 'This position is not available.');
    }

    if (role.closingDate && role.closingDate < new Date()) {
      throw new AppError(400, 'This position has closed.');
    }

    const compensation = formatCompensation(role);
    const skills = Array.isArray(role.skills) ? (role.skills as string[]) : [];

    if (candidate.selectedRoleId === role.id) {
      return { role, compensation, skills, candidateId: candidate.id };
    }

    if (candidate.selectedRoleId) {
      const existingRoleProfile = await prisma.candidateProfile.findFirst({
        where: { userId: candidate.userId, selectedRoleId: role.id },
      });
      if (existingRoleProfile) {
        return { role, compensation, skills, candidateId: existingRoleProfile.id };
      }

      const created = await prisma.$transaction(async (tx) => {
        const newCandidate = await tx.candidateProfile.create({
          data: {
            userId: candidate.userId,
            fullName: candidate.fullName,
            phone: candidate.phone,
            countryCode: candidate.countryCode,
            phoneNumber: candidate.phoneNumber,
            fullPhone: candidate.fullPhone,
            phoneCountry: candidate.phoneCountry,
            yearsOfExperience: candidate.yearsOfExperience,
            experienceCategory: candidate.experienceCategory,
            linkedinUrl: candidate.linkedinUrl,
            resumePath: candidate.resumePath,
            appliedRole: role.title,
            referralCode: candidate.referralCode,
            emailVerified: candidate.emailVerified,
            emailVerifiedAt: candidate.emailVerifiedAt,
            candidateStatus: candidate.candidateStatus,
            utmSource: candidate.utmSource,
            utmMedium: candidate.utmMedium,
            utmCampaign: candidate.utmCampaign,
            utmTerm: candidate.utmTerm,
            utmContent: candidate.utmContent,
            firstTouchSource: candidate.firstTouchSource,
            lastTouchSource: candidate.lastTouchSource,
            attributionLandingPage: candidate.attributionLandingPage,
            attributionReferrer: candidate.attributionReferrer,
            attributionDevice: candidate.attributionDevice,
            selectedRoleId: role.id,
            selectedRoleName: role.title,
            selectedCountry: role.country,
            selectedCompensation: compensation,
            selectedSkills: skills,
            roleSelectedAt: new Date(),
          },
        });

        await tx.jobRole.update({
          where: { id: role.id },
          data: { applicationsReceived: { increment: 1 } },
        });

        return newCandidate;
      });

      return { role, compensation, skills, candidateId: created.id };
    }

    await prisma.$transaction([
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: {
          selectedRoleId: role.id,
          selectedRoleName: role.title,
          selectedCountry: role.country,
          selectedCompensation: compensation,
          selectedSkills: skills,
          roleSelectedAt: new Date(),
        },
      }),
      prisma.jobRole.update({
        where: { id: role.id },
        data: { applicationsReceived: { increment: 1 } },
      }),
    ]);

    return { role, compensation, skills, candidateId: candidate.id };
  }
}

export const jobRoleService = new JobRoleService();
