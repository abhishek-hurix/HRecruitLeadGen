import bcrypt from 'bcryptjs';
import { Language, Difficulty, AssessmentStatus, AdminRole, CandidateStatus, SelectionStatus, ExperienceCategory, AnswerMode, JobRoleStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { generateAdminToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { storage } from './storage/storage.service';
import { assessmentTokenService, JourneyStatus } from './assessment-token.service';
import { aiAssessmentService } from './ai-assessment.service';
import { getPermissionsForRole } from '../config/permissions';
import { getExperienceLabel } from '../utils/experience';

export class AdminService {
  async login(email: string, password: string) {
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin) {
      throw new AppError(401, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid credentials');
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: { adminUserId: admin.id, action: 'LOGIN', entityType: 'admin' },
    });

    const token = generateAdminToken(admin.id, admin.email, admin.role);
    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: getPermissionsForRole(admin.role),
      },
    };
  }

  async getMe(adminId: string) {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new AppError(401, 'Invalid admin session');
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: getPermissionsForRole(admin.role),
      lastLoginAt: admin.lastLoginAt,
    };
  }

  async getDashboard(role: AdminRole) {
    const [
      totalCandidates,
      registered,
      verified,
      started,
      submitted,
      selected,
      rejected,
      totalAdmins,
      avgScore,
      experienceGroups,
    ] = await Promise.all([
      prisma.candidateProfile.count(),
      prisma.candidateProfile.count({ where: { candidateStatus: CandidateStatus.REGISTERED } }),
      prisma.candidateProfile.count({ where: { emailVerified: true } }),
      prisma.candidateProfile.count({ where: { candidateStatus: CandidateStatus.STARTED } }),
      prisma.candidateProfile.count({ where: { candidateStatus: CandidateStatus.SUBMITTED } }),
      prisma.candidateProfile.count({ where: { selectionStatus: SelectionStatus.SELECTED } }),
      prisma.candidateProfile.count({ where: { selectionStatus: SelectionStatus.REJECTED } }),
      role === AdminRole.SUPER_ADMIN ? prisma.adminUser.count() : Promise.resolve(0),
      prisma.submission.aggregate({ _avg: { score: true } }),
      role === AdminRole.SUPER_ADMIN
        ? prisma.candidateProfile.groupBy({
            by: ['experienceCategory'],
            _count: { _all: true },
            where: { experienceCategory: { not: null } },
          })
        : Promise.resolve([] as Array<{ experienceCategory: string | null; _count: { _all: number } }>),
    ]);

    const base = {
      totalCandidates,
      completedAssessments: submitted,
      averageScore: Number(avgScore._avg.score || 0).toFixed(1),
    };

    if (role === AdminRole.SUPER_ADMIN) {
      return {
        ...base,
        registered,
        verified,
        startedAssessment: started,
        submittedAssessment: submitted,
        selected,
        rejected,
        totalAdmins,
        candidatesByExperience: experienceGroups
          .filter((g) => g.experienceCategory)
          .map((g) => ({
            category: getExperienceLabel(g.experienceCategory as ExperienceCategory),
            count: g._count._all,
          }))
          .sort((a, b) => b.count - a.count),
      };
    }

    return base;
  }

  async getCandidates(params: {
    search?: string;
    status?: string;
    experience?: string;
    country?: string;
    role?: string;
    minScore?: number;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CandidateProfileWhereInput = {};

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    if (params.experience) {
      where.experienceCategory = params.experience as ExperienceCategory;
    }

    if (params.country) {
      where.phoneCountry = { equals: params.country, mode: 'insensitive' };
    }

    if (params.role && params.role !== 'all') {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { selectedRoleId: params.role },
            { assessments: { some: { jobRoleId: params.role } } },
            { submissions: { some: { assessment: { jobRoleId: params.role } } } },
          ],
        },
      ];
    }

    if (typeof params.minScore === 'number' && Number.isFinite(params.minScore)) {
      where.submissions = {
        some: {
          score: { gte: params.minScore },
        },
      };
    }

    if (params.status && params.status.startsWith('ASSESSMENT_')) {
      const assessmentStatus = params.status.replace('ASSESSMENT_', '') as Prisma.EnumCandidateAssessmentStatusFilter['equals'];
      where.assessmentStatus = assessmentStatus;
    }

    const [candidates, total, roleRows] = await Promise.all([
      prisma.candidateProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
          assessments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { jobRole: { select: { id: true, title: true } } },
          },
          submissions: {
            orderBy: { submittedAt: 'desc' },
            take: 1,
            include: { assessment: { include: { jobRole: { select: { id: true, title: true } } } } },
          },
        },
      }),
      prisma.candidateProfile.count({ where }),
      prisma.jobRole.findMany({
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
    ]);

    let mapped = candidates.map((c) => {
      const latestToken = c.assessmentTokens[0];
      const journeyStatus = assessmentTokenService.resolveJourneyStatus({
        emailVerified: c.emailVerified,
        tokenStatus: latestToken?.status,
        tokenExpiresAt: latestToken?.expiresAt,
        hasSubmission: c.submissions.length > 0,
        assessmentInProgress: c.assessments[0]?.status === AssessmentStatus.IN_PROGRESS,
      });

      const displayRole =
        c.submissions[0]?.assessment.jobRole?.title ||
        c.assessments[0]?.jobRole?.title ||
        c.selectedRoleName ||
        null;

      return {
        id: c.id,
        applicationId: c.id.slice(0, 8).toUpperCase(),
        fullName: c.fullName,
        email: c.user.email,
        phone: c.fullPhone || c.phone,
        phoneCountry: c.phoneCountry,
        countryCode: c.countryCode,
        experienceLabel: getExperienceLabel(c.experienceCategory),
        linkedinUrl: c.linkedinUrl,
        appliedRole: displayRole,
        referralCode: c.referralCode,
        emailVerified: c.emailVerified,
        journeyStatus,
        assessmentStatus: c.assessmentStatus,
        appliedCountry: c.selectedCountry,
        appliedCompensation: c.selectedCompensation,
        score: c.submissions[0] ? Number(c.submissions[0].score) : null,
        submittedAt: c.submissions[0]?.submittedAt || null,
        createdAt: c.createdAt,
      };
    });

    if (params.status && !params.status.startsWith('ASSESSMENT_')) {
      const filter = params.status.toUpperCase();
      mapped = mapped.filter((c) => c.journeyStatus === filter);
    }

    return {
      data: mapped,
      roleFilters: roleRows
        .map((role) => role.title)
        .filter((role) => Boolean(role.trim())),
      pagination: { page, limit, total: params.status ? mapped.length : total, totalPages: Math.ceil((params.status ? mapped.length : total) / limit) },
    };
  }

  async getCandidateById(id: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id },
      include: {
        user: true,
        assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessments: { include: { submission: { include: { answers: { include: { question: true } } } } } },
        submissions: { include: { answers: { include: { question: true } } } },
      },
    });

    if (!candidate) throw new AppError(404, 'Candidate not found');

    const latestToken = candidate.assessmentTokens[0];
    const journeyStatus = assessmentTokenService.resolveJourneyStatus({
      emailVerified: candidate.emailVerified,
      tokenStatus: latestToken?.status,
      tokenExpiresAt: latestToken?.expiresAt,
      hasSubmission: candidate.submissions.length > 0,
      assessmentInProgress: candidate.assessments[0]?.status === AssessmentStatus.IN_PROGRESS,
    });

    return {
      ...candidate,
      phone: candidate.fullPhone || candidate.phone,
      experienceLabel: getExperienceLabel(candidate.experienceCategory),
      journeyStatus,
      assessmentStatus: candidate.assessmentStatus,
    };
  }

  async getResume(id: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { id } });
    if (!candidate) throw new AppError(404, 'Candidate not found');
    const buffer = await storage.get(candidate.resumePath);
    return { buffer, filename: `${candidate.fullName.replace(/\s+/g, '_')}_resume.pdf` };
  }

  async exportCandidatesCSV() {
    const candidates = await prisma.candidateProfile.findMany({
      include: {
        user: true,
        assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { jobRole: { select: { id: true, title: true } } },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          include: { assessment: { include: { jobRole: { select: { id: true, title: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Full Name', 'Email', 'Phone', 'Phone Country', 'Experience', 'LinkedIn', 'Role', 'Referral Code', 'Applied Role', 'Role Country', 'Compensation', 'Source', 'Medium', 'Campaign', 'First Touch', 'Last Touch', 'Journey Status', 'Assessment Status', 'Score', 'Submitted At'];
    const rows = candidates.map((c) => {
      const latestToken = c.assessmentTokens[0];
      const journeyStatus = assessmentTokenService.resolveJourneyStatus({
        emailVerified: c.emailVerified,
        tokenStatus: latestToken?.status,
        tokenExpiresAt: latestToken?.expiresAt,
        hasSubmission: c.submissions.length > 0,
        assessmentInProgress: c.assessments[0]?.status === AssessmentStatus.IN_PROGRESS,
      });

      const displayRole =
        c.submissions[0]?.assessment.jobRole?.title ||
        c.assessments[0]?.jobRole?.title ||
        c.selectedRoleName ||
        '';

      return [
        c.fullName,
        c.user.email,
        c.fullPhone || c.phone,
        c.phoneCountry || '',
        getExperienceLabel(c.experienceCategory),
        c.linkedinUrl,
        displayRole,
        c.referralCode || '',
        displayRole,
        c.selectedCountry || '',
        c.selectedCompensation || '',
        c.utmSource || '',
        c.utmMedium || '',
        c.utmCampaign || '',
        c.firstTouchSource || '',
        c.lastTouchSource || '',
        journeyStatus,
        c.assessments[0]?.status || 'NOT_STARTED',
        c.submissions[0] ? String(c.submissions[0].score) : '',
        c.submissions[0]?.submittedAt?.toISOString() || '',
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
  }

  async getQuestions(language?: Language, page = 1, limit = 20, jobRoleId?: string) {
    const where: Prisma.QuestionWhereInput = {
      isActive: true,
      jobRoleId: jobRoleId || { not: null },
      jobRole: { status: JobRoleStatus.ACTIVE },
      answerMode: AnswerMode.MCQ,
    };
    if (language) where.language = language;

    const skip = (page - 1) * limit;
    const filterWhere: Prisma.QuestionWhereInput = {
      isActive: true,
      jobRoleId: jobRoleId || { not: null },
      jobRole: { status: JobRoleStatus.ACTIVE },
      answerMode: AnswerMode.MCQ,
    };

    const [questions, total, roleRows, languageRows] = await Promise.all([
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          jobRole: { select: { id: true, title: true } },
          testCases: { orderBy: { sortOrder: 'asc' } },
        },
      }),
      prisma.question.count({ where }),
      prisma.question.findMany({
        where: {
          isActive: true,
          jobRoleId: { not: null },
          jobRole: { status: JobRoleStatus.ACTIVE },
          answerMode: AnswerMode.MCQ,
        },
        distinct: ['jobRoleId'],
        include: { jobRole: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.question.findMany({
        where: filterWhere,
        distinct: ['language'],
        select: { language: true },
        orderBy: { language: 'asc' },
      }),
    ]);

    return {
      data: questions,
      roleFilters: roleRows
        .map((q) => q.jobRole)
        .filter((role): role is { id: string; title: string } => Boolean(role)),
      languageFilters: languageRows.map((q) => q.language),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createQuestion(data: {
    language: Language;
    jobRoleId?: string | null;
    experienceCategory?: ExperienceCategory | null;
    answerMode?: AnswerMode;
    title: string;
    description: string;
    inputFormat: string;
    outputFormat: string;
    sampleInput: string;
    sampleOutput: string;
    constraints: string;
    difficulty: Difficulty;
    topic: string;
    starterCode: string;
    testCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }>;
  }, adminId: string) {
    const question = await prisma.question.create({
      data: {
        ...data,
        testCases: {
          create: data.testCases.map((tc, i) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
            sortOrder: i,
          })),
        },
      },
      include: { testCases: true },
    });

    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'CREATE_QUESTION', entityType: 'question', entityId: question.id },
    });

    return question;
  }

  async updateQuestion(id: string, data: Partial<{
    jobRoleId: string | null;
    experienceCategory: ExperienceCategory | null;
    answerMode: AnswerMode;
    title: string;
    description: string;
    inputFormat: string;
    outputFormat: string;
    sampleInput: string;
    sampleOutput: string;
    constraints: string;
    difficulty: Difficulty;
    topic: string;
    starterCode: string;
    isActive: boolean;
    testCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }>;
  }>, adminId: string) {
    const { testCases, ...questionData } = data;

    if (testCases) {
      await prisma.questionTestCase.deleteMany({ where: { questionId: id } });
      await prisma.questionTestCase.createMany({
        data: testCases.map((tc, i) => ({
          questionId: id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          sortOrder: i,
        })),
      });
    }

    const question = await prisma.question.update({
      where: { id },
      data: questionData,
      include: { testCases: { orderBy: { sortOrder: 'asc' } } },
    });

    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'UPDATE_QUESTION', entityType: 'question', entityId: id },
    });

    return question;
  }

  async deleteQuestion(id: string, adminId: string) {
    await prisma.question.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'DELETE_QUESTION', entityType: 'question', entityId: id },
    });
  }

  async getSubmission(id: string) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        candidate: { include: { user: true } },
        answers: { include: { question: true } },
        assessment: true,
      },
    });
    if (!submission) throw new AppError(404, 'Submission not found');
    return submission;
  }

  async getSubmissionMarkdown(id: string) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        candidate: { include: { user: true } },
        answers: { include: { question: true } },
        assessment: true,
      },
    });
    if (!submission) throw new AppError(404, 'Submission not found');

    const lines = [
      `# Assessment Submission - ${submission.candidate.fullName}`,
      '',
      `- **Candidate:** ${submission.candidate.fullName}`,
      `- **Email:** ${submission.candidate.user.email}`,
      `- **Language:** ${submission.assessment.language}`,
      `- **Score:** ${Number(submission.score)}/10`,
      `- **Passed Questions:** ${submission.passedQuestions}/${submission.totalQuestions}`,
      `- **Submitted At:** ${submission.submittedAt.toISOString()}`,
      '',
    ];

    submission.answers.forEach((answer, index) => {
      const options = Array.isArray(answer.question.mcqOptions)
        ? (answer.question.mcqOptions as string[])
        : [];
      const selectedOption = answer.selectedOptionIndex == null
        ? 'Skipped'
        : options[answer.selectedOptionIndex] || `Option ${answer.selectedOptionIndex + 1}`;
      const correctOptionIndex = answer.question.correctOptionIndex;
      const correctOption = typeof correctOptionIndex === 'number'
        ? `${String.fromCharCode(65 + correctOptionIndex)}. ${options[correctOptionIndex] || `Option ${correctOptionIndex + 1}`}`
        : 'Not available';

      lines.push(
        `## Question ${index + 1}: ${answer.question.title}`,
        '',
        answer.question.description,
        '',
      );

      if (options.length > 0) {
        lines.push(
          '### Options',
          '',
          ...options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`),
          '',
          '### Candidate Answer',
          '',
          selectedOption,
          '',
          '### Correct Answer',
          '',
          correctOption,
          '',
          `**Result:** ${answer.isFullyPassed ? 'Correct' : 'Incorrect / Skipped'}`,
          '',
        );
        return;
      }

      lines.push(
        '### Candidate Answer',
        '',
        '```',
        answer.code,
        '```',
        '',
        `**Tests:** ${answer.passedTests} passed, ${answer.failedTests} failed`,
        '',
      );
    });

    return {
      filename: `${submission.candidate.fullName.replace(/\s+/g, '_')}_assessment.md`,
      markdown: lines.join('\n'),
    };
  }

  async runAiReview(id: string, roleApplied?: string) {
    await aiAssessmentService.reviewSubmission(id, roleApplied);
    return this.getSubmission(id);
  }

  async listAdmins() {
    return prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdmin(
    data: { email: string; password: string; role: AdminRole },
    createdById: string
  ) {
    if (data.role !== AdminRole.ADMIN && data.role !== AdminRole.SUPER_ADMIN) {
      throw new AppError(400, 'Invalid role');
    }
    const existing = await prisma.adminUser.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new AppError(409, 'Admin with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const admin = await prisma.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        createdById,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: { adminUserId: createdById, action: 'CREATE_ADMIN', entityType: 'admin', entityId: admin.id },
    });

    return admin;
  }

  async updateAdmin(
    id: string,
    data: { role?: AdminRole; password?: string },
    actorId: string
  ) {
    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new AppError(404, 'Admin not found');

    const update: Prisma.AdminUserUpdateInput = {};
    if (data.role) update.role = data.role;
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 12);

    const updated = await prisma.adminUser.update({
      where: { id },
      data: update,
      select: { id: true, email: true, role: true, createdAt: true, lastLoginAt: true },
    });

    await prisma.auditLog.create({
      data: { adminUserId: actorId, action: 'UPDATE_ADMIN', entityType: 'admin', entityId: id },
    });

    return updated;
  }

  async deleteAdmin(id: string, actorId: string) {
    if (id === actorId) throw new AppError(400, 'Cannot delete your own account');
    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new AppError(404, 'Admin not found');
    const firstAdmin = await prisma.adminUser.findFirst({ orderBy: { createdAt: 'asc' } });
    if (firstAdmin?.id === id) {
      throw new AppError(400, 'First admin cannot be deleted');
    }

    await prisma.adminUser.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { adminUserId: actorId, action: 'DELETE_ADMIN', entityType: 'admin', entityId: id },
    });
  }

  async getSettings() {
    const settings = await prisma.platformSetting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async updateSettings(
    settings: Record<string, string>,
    adminId: string
  ) {
    const allowedKeys = ['assessment_question_count', 'assessment_duration_minutes'];
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;
      await prisma.platformSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: adminId },
        update: { value, updatedBy: adminId },
      });
    }
    await prisma.auditLog.create({
      data: { adminUserId: adminId, action: 'UPDATE_SETTINGS', entityType: 'settings' },
    });
    return this.getSettings();
  }
}

export const adminService = new AdminService();
