import bcrypt from 'bcryptjs';
import { Language, Difficulty, AssessmentStatus, AdminRole, CandidateStatus, SelectionStatus, ExperienceCategory, AnswerMode, JobRoleStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { generateAdminToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { storage } from './storage/storage.service';
import { assessmentTokenService, JourneyStatus } from './assessment-token.service';
import { aiAssessmentService } from './ai-assessment.service';
import { getPermissionsForRole, hasPermission, Permission } from '../config/permissions';
import { getExperienceLabel } from '../utils/experience';
import { countryDisplayName } from '../utils/country';
import { activeCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { buildCandidateListOrderBy, buildCandidateListWhere } from './candidate-selection.service';

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
    const active = activeCandidateWhere();
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
      prisma.candidateProfile.count({ where: active }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { candidateStatus: CandidateStatus.REGISTERED }),
      }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { emailVerified: true }),
      }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { candidateStatus: CandidateStatus.STARTED }),
      }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { candidateStatus: CandidateStatus.SUBMITTED }),
      }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { selectionStatus: SelectionStatus.SELECTED }),
      }),
      prisma.candidateProfile.count({
        where: mergeCandidateWhere(active, { selectionStatus: SelectionStatus.REJECTED }),
      }),
      role === AdminRole.SUPER_ADMIN ? prisma.adminUser.count() : Promise.resolve(0),
      prisma.submission.aggregate({
        where: { candidate: active },
        _avg: { score: true },
      }),
      role === AdminRole.SUPER_ADMIN
        ? prisma.candidateProfile.groupBy({
            by: ['experienceCategory'],
            _count: { _all: true },
            where: mergeCandidateWhere(active, { experienceCategory: { not: null } }),
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

  async assertActiveAdminOwner(adminId: string) {
    return prisma.adminUser.findFirst({
      where: {
        id: adminId,
        role: { in: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN] },
      },
      select: { id: true, email: true, role: true },
    });
  }

  async getCandidates(params: {
    search?: string;
    status?: string;
    experience?: string;
    country?: string;
    countryCodes?: string[] | null;
    role?: string;
    roleAssignment?: string | null;
    registeredFrom?: string | null;
    registeredTo?: string | null;
    datePreset?: string | null;
    ownerId?: string | null;
    inactivityDays?: number | null;
    minScore?: number;
    sortBy?: string | null;
    sortOrder?: string | null;
    page?: number;
    limit?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const rawSize = params.pageSize || params.limit || 25;
    const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 25;
    const skip = (page - 1) * pageSize;

    const filterSnapshot = {
      search: params.search,
      status: params.status,
      journeyStatus: params.status,
      experience: params.experience,
      country: params.country,
      countryCodes: params.countryCodes || undefined,
      role: params.role,
      jobRoleId: params.role,
      roleAssignment: params.roleAssignment,
      registeredFrom: params.registeredFrom,
      registeredTo: params.registeredTo,
      datePreset: params.datePreset as import('./candidate-selection.service').CandidateFilterSnapshot['datePreset'],
      ownerId: params.ownerId,
      ownerFilter: params.ownerId,
      inactivityDays: params.inactivityDays,
      minScore: params.minScore,
      sortBy: params.sortBy as import('./candidate-selection.service').CandidateSortBy | undefined,
      sortOrder: params.sortOrder as import('./candidate-selection.service').CandidateSortOrder | undefined,
    };

    const where = buildCandidateListWhere(filterSnapshot);
    const orderBy = buildCandidateListOrderBy(
      filterSnapshot.sortBy,
      filterSnapshot.sortOrder === 'asc' || filterSnapshot.sortOrder === 'desc'
        ? filterSnapshot.sortOrder
        : null
    );

    const [candidates, total, roleRows] = await Promise.all([
      prisma.candidateProfile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          user: true,
          ownerAdmin: { select: { id: true, email: true, role: true } },
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

    const mapped = candidates.map((c) => {
      const latestToken = c.assessmentTokens[0];
      const journeyStatus = assessmentTokenService.resolveJourneyStatus({
        emailVerified: c.emailVerified,
        tokenStatus: latestToken?.status,
        tokenExpiresAt: latestToken?.expiresAt,
        hasSubmission: c.submissions.length > 0,
        assessmentInProgress: c.assessments[0]?.status === AssessmentStatus.IN_PROGRESS,
        selectionStatus: c.selectionStatus,
      });

      const displayRole =
        c.submissions[0]?.assessment.jobRole?.title ||
        c.assessments[0]?.jobRole?.title ||
        c.selectedRoleName ||
        null;

      const hasSubmission = c.submissions.length > 0;
      const scoreValue = hasSubmission
        ? Number(c.submissions[0].score)
        : c.latestScore != null
          ? Number(c.latestScore)
          : null;

      let scoreLabel: string;
      if (hasSubmission && scoreValue != null && !Number.isNaN(scoreValue)) {
        scoreLabel = `${scoreValue}/10`;
      } else if (c.assessmentStatus === 'NOT_STARTED') {
        scoreLabel = 'No Assessment';
      } else {
        scoreLabel = 'Not Available';
      }

      const countryIso = c.phoneCountryIso || null;
      const countryName = countryIso
        ? countryDisplayName(countryIso, c.phoneCountry)
        : c.phoneCountry || '—';

      return {
        id: c.id,
        applicationId: c.id.slice(0, 8).toUpperCase(),
        fullName: c.fullName,
        email: c.user.email,
        phone: c.fullPhone || c.phone,
        phoneCountry: countryName,
        phoneCountryIso: countryIso,
        countryCode: countryIso,
        countryName,
        dialCode: c.countryCode,
        experienceLabel: getExperienceLabel(c.experienceCategory),
        yearsOfExperience: c.yearsOfExperience,
        linkedinUrl: c.linkedinUrl,
        appliedRole: displayRole,
        roleLabel: displayRole || 'Not Assigned',
        hasAssignedRole: Boolean(c.selectedRoleId || displayRole),
        referralCode: c.referralCode,
        emailVerified: c.emailVerified,
        journeyStatus,
        selectionStatus: c.selectionStatus,
        assessmentStatus: c.assessmentStatus,
        appliedCountry: c.selectedCountry,
        appliedCompensation: c.selectedCompensation,
        score: scoreValue,
        scoreLabel,
        hasAssessment: c.assessmentStatus !== 'NOT_STARTED' || hasSubmission,
        submittedAt: c.submissions[0]?.submittedAt || null,
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt || c.createdAt,
        lastActivityType: c.lastActivityType || 'REGISTERED',
        owner: c.ownerAdmin
          ? { id: c.ownerAdmin.id, email: c.ownerAdmin.email, role: c.ownerAdmin.role }
          : null,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: mapped,
      roleFilters: roleRows
        .map((role) => role.title)
        .filter((role) => Boolean(role.trim())),
      roleOptions: roleRows.map((role) => ({ id: role.id, title: role.title })),
      pagination: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        sortBy: filterSnapshot.sortBy || 'registeredAt',
        sortOrder: filterSnapshot.sortOrder || 'desc',
      },
    };
  }

  async getCandidateById(id: string, viewerRole?: AdminRole) {
    const includeDeleted = viewerRole === AdminRole.SUPER_ADMIN;
    const candidate = await prisma.candidateProfile.findFirst({
      where: includeDeleted
        ? { id }
        : mergeCandidateWhere(activeCandidateWhere(), { id }),
      include: {
        user: true,
        ownerAdmin: { select: { id: true, email: true, role: true } },
        rejectedByAdmin: { select: { email: true } },
        deletedByAdmin: { select: { email: true } },
        assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessments: { include: { submission: { include: { answers: { include: { question: true } } } } } },
        submissions: { include: { answers: { include: { question: true } } } },
        resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
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
      selectionStatus: candidate.selectionStatus,
    });

    const resumes = candidate.resumes.length > 0
      ? candidate.resumes
      : candidate.resumePath
        ? [{
            id: 'legacy-primary-resume',
            candidateId: candidate.id,
            fileName: `${candidate.fullName.replace(/\s+/g, '_')}_resume.pdf`,
            filePath: candidate.resumePath,
            isPrimary: true,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
          }]
        : [];

    const canViewRejection =
      !!viewerRole && hasPermission(viewerRole, Permission.VIEW_REJECTION_REASONS);
    const rejectionHistory = canViewRejection
      ? await prisma.candidateRejection.findMany({
          where: { candidateId: id },
          orderBy: { rejectedAt: 'desc' },
          include: { rejectedByAdmin: { select: { email: true } } },
        })
      : [];

    return {
      ...candidate,
      applicationId: candidate.id.slice(0, 8).toUpperCase(),
      phone: candidate.fullPhone || candidate.phone,
      countryCode: candidate.phoneCountryIso,
      countryName: countryDisplayName(candidate.phoneCountryIso, candidate.phoneCountry),
      dialCode: candidate.countryCode,
      experienceLabel: getExperienceLabel(candidate.experienceCategory),
      journeyStatus,
      assessmentStatus: candidate.assessmentStatus,
      lastActivityAt: candidate.lastActivityAt || candidate.createdAt,
      lastActivityType: candidate.lastActivityType || 'REGISTERED',
      owner: candidate.ownerAdmin
        ? {
            id: candidate.ownerAdmin.id,
            email: candidate.ownerAdmin.email,
            role: candidate.ownerAdmin.role,
          }
        : null,
      rejectionReason: canViewRejection ? candidate.rejectionReason : undefined,
      rejectedBy: canViewRejection ? candidate.rejectedByAdmin?.email || null : undefined,
      rejectedAt: canViewRejection ? candidate.rejectedAt : undefined,
      rejectionHistory: canViewRejection
        ? rejectionHistory.map((r) => ({
            id: r.id,
            reason: r.reason,
            rejectedAt: r.rejectedAt,
            previousJourneyStatus: r.previousJourneyStatus,
            previousSelectionStatus: r.previousSelectionStatus,
            rejectedBy: r.rejectedByAdmin?.email || null,
            operationId: r.operationId,
          }))
        : undefined,
      resumes: resumes.map((resume) => ({
        id: resume.id,
        fileName: resume.fileName,
        isPrimary: resume.isPrimary,
        uploadedAt: resume.createdAt,
      })),
    };
  }

  async getResume(id: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { id } });
    if (!candidate) throw new AppError(404, 'Candidate not found');
    const buffer = await storage.get(candidate.resumePath);
    return { buffer, filename: `${candidate.fullName.replace(/\s+/g, '_')}_resume.pdf` };
  }

  async getCandidateResume(candidateId: string, resumeId: string) {
    const resume = await prisma.candidateResume.findFirst({
      where: { id: resumeId, candidateId },
    });
    if (!resume) throw new AppError(404, 'Resume not found');
    const buffer = await storage.get(resume.filePath);
    return { buffer, filename: resume.fileName };
  }

  async exportCandidatesCSV() {
    const candidates = await prisma.candidateProfile.findMany({
      where: activeCandidateWhere(),
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
        selectionStatus: c.selectionStatus,
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
