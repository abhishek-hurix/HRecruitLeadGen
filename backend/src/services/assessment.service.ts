import { Language, AssessmentStatus, Prisma, AnswerMode } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { executionService } from './execution.service';
import { evaluationService } from './evaluation.service';
import { assessmentTokenService } from './assessment-token.service';
import { candidateStatusService } from './candidate-status.service';
import { jobRoleService, parseAssessmentLanguages } from './job-role.service';

const ASSESSMENT_QUESTION_COUNT = 10;

async function resolveDurationMinutes(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: 'assessment_duration_minutes' },
  });
  const fromDb = row ? parseInt(row.value, 10) : NaN;
  if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;
  return config.assessment.durationMinutes;
}

export class AssessmentService {
  private async getCandidate(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        assessments: { orderBy: { createdAt: 'desc' } },
        submissions: true,
        selectedRole: true,
      },
    });

    if (!candidate) {
      throw new AppError(404, 'Candidate not found');
    }

    return candidate;
  }

  async getReadyInfo(candidateId: string) {
    const candidate = await this.getCandidate(candidateId);
    const hasCompleted = candidate.submissions.length > 0 ||
      candidate.assessments.some((a) => a.status === AssessmentStatus.COMPLETED);
    const now = new Date();

    const staleIds = candidate.assessments
      .filter(
        (a) =>
          a.status === AssessmentStatus.IN_PROGRESS &&
          a.expiresAt &&
          a.expiresAt <= now
      )
      .map((a) => a.id);
    if (staleIds.length > 0) {
      await prisma.assessment.updateMany({
        where: { id: { in: staleIds } },
        data: { status: AssessmentStatus.EXPIRED },
      });
    }

    const inProgress = candidate.assessments.some(
      (a) =>
        a.status === AssessmentStatus.IN_PROGRESS &&
        a.expiresAt &&
        a.expiresAt > now
    );
    const durationMinutes = await resolveDurationMinutes();

    return {
      candidateName: candidate.fullName,
      hasCompleted,
      hasInProgress: inProgress,
      hasRoleSelected: Boolean(candidate.selectedRoleId),
      selectedRoleName: candidate.selectedRoleName,
      questionCount: ASSESSMENT_QUESTION_COUNT,
      durationMinutes,
    };
  }

  async listJobRoles() {
    return jobRoleService.listActiveRoles();
  }

  /** Assign a role without starting the timed assessment session. */
  async assignRole(candidateId: string, jobRoleId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { user: true, submissions: { include: { assessment: true } } },
    });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    const roleProfile = await prisma.candidateProfile.findFirst({
      where: { userId: candidate.userId, selectedRoleId: jobRoleId },
      include: { submissions: { include: { assessment: true } } },
    });
    const activeCandidate = roleProfile || candidate;
    const hasCompletedRole = activeCandidate.submissions.some(
      (submission) => submission.assessment.jobRoleId === jobRoleId
    );
    if (hasCompletedRole) {
      throw new AppError(403, 'You have already completed this role assessment.');
    }

    const { role, candidateId: selectedCandidateId } =
      candidate.selectedRoleId === jobRoleId
        ? { role: await prisma.jobRole.findUniqueOrThrow({ where: { id: jobRoleId } }), candidateId }
        : await jobRoleService.selectRoleForCandidate(candidateId, jobRoleId);

    const result: { roleId: string; roleName: string; token?: string } = {
      roleId: role.id,
      roleName: role.title,
    };

    if (selectedCandidateId !== candidateId) {
      const { token } = await assessmentTokenService.createToken(
        selectedCandidateId,
        candidate.user.email
      );
      result.token = token;
    }

    return result;
  }

  async selectRoleAndStart(candidateId: string, jobRoleId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { user: true, assessments: true, submissions: { include: { assessment: true } } },
    });

    if (!candidate) throw new AppError(404, 'Candidate not found');

    const roleProfile = await prisma.candidateProfile.findFirst({
      where: { userId: candidate.userId, selectedRoleId: jobRoleId },
      include: { assessments: true, submissions: { include: { assessment: true } } },
    });
    const activeCandidate = roleProfile || candidate;
    const hasCompletedRole = activeCandidate.submissions.some((submission) => submission.assessment.jobRoleId === jobRoleId);
    if (hasCompletedRole) {
      throw new AppError(403, 'You have already completed this role assessment.');
    }

    const existing = activeCandidate.assessments.find((a) => a.status === AssessmentStatus.IN_PROGRESS);
    if (existing) {
      if (existing.jobRoleId !== jobRoleId) {
        throw new AppError(409, 'Please complete your in-progress assessment before starting another role.');
      }
      await prisma.assessment.updateMany({
        where: {
          candidateId: activeCandidate.id,
          jobRoleId,
          status: AssessmentStatus.IN_PROGRESS,
        },
        data: { status: AssessmentStatus.EXPIRED },
      });
    }

    const role = candidate.selectedRoleId === jobRoleId
      ? await prisma.jobRole.findUniqueOrThrow({ where: { id: jobRoleId } })
      : (await jobRoleService.selectRoleForCandidate(candidateId, jobRoleId)).role;
    const selectedCandidateId = roleProfile?.id || (candidate.selectedRoleId === jobRoleId
      ? candidateId
      : (await prisma.candidateProfile.findFirstOrThrow({
          where: { userId: candidate.userId, selectedRoleId: role.id },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        })).id);
    const languages = parseAssessmentLanguages(role.assessmentLanguages);
    const primaryLanguage = languages[0];

    const questionWhere: Prisma.QuestionWhereInput = {
      isActive: true,
      answerMode: AnswerMode.MCQ,
      language: languages.length === 1 ? languages[0] : { in: languages },
      OR: [{ jobRoleId: role.id }, { jobRoleId: null }],
    };

    let questions = await prisma.question.findMany({
      where: questionWhere,
      include: { testCases: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
    });

    if (questions.length < ASSESSMENT_QUESTION_COUNT && candidate.experienceCategory) {
      questions = await prisma.question.findMany({
        where: {
          isActive: true,
          answerMode: AnswerMode.MCQ,
          language: languages.length === 1 ? languages[0] : { in: languages },
          OR: [{ jobRoleId: role.id }, { jobRoleId: null }],
        },
        include: { testCases: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
      });
    }

    if (questions.length < ASSESSMENT_QUESTION_COUNT) {
      throw new AppError(
        500,
        `Insufficient questions for ${role.title}. Please contact support.`
      );
    }

    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, ASSESSMENT_QUESTION_COUNT);
    const questionIds = selected.map((q) => q.id);

    const expiresAt = new Date();
    const durationMinutes = await resolveDurationMinutes();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const assessment = await prisma.assessment.create({
      data: {
        candidateId: selectedCandidateId,
        jobRoleId: role.id,
        language: primaryLanguage,
        status: AssessmentStatus.IN_PROGRESS,
        questionIds,
        startedAt: new Date(),
        expiresAt,
      },
    });

    await assessmentTokenService.markStarted(selectedCandidateId);
    await candidateStatusService.markStarted(selectedCandidateId);

    const response = this.formatAssessmentResponse(assessment.id, selected);
    if (selectedCandidateId !== candidateId) {
      const { token } = await assessmentTokenService.createToken(selectedCandidateId, candidate.user.email);
      return { ...response, token };
    }
    return response;
  }

  /** Start a fresh timed session from the instruction page. */
  async startAssessment(candidateId: string, _language?: Language) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { assessments: true, submissions: true },
    });

    if (!candidate) throw new AppError(404, 'Candidate not found');

    if (!candidate.selectedRoleId) {
      throw new AppError(400, 'Please select a job role before starting the assessment.');
    }

    const hasCompleted = candidate.submissions.length > 0 ||
      candidate.assessments.some((a) => a.status === AssessmentStatus.COMPLETED);
    if (hasCompleted) {
      throw new AppError(403, 'You have already completed this assessment.');
    }

    // Always begin a new session when the candidate clicks Start Assessment.
    await prisma.assessment.updateMany({
      where: { candidateId, status: AssessmentStatus.IN_PROGRESS },
      data: { status: AssessmentStatus.EXPIRED },
    });

    return this.selectRoleAndStart(candidateId, candidate.selectedRoleId);
  }

  async getActiveSession(candidateId: string) {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId, status: AssessmentStatus.IN_PROGRESS },
      orderBy: { createdAt: 'desc' },
    });

    if (!assessment) {
      throw new AppError(404, 'No active assessment session');
    }

    if (assessment.expiresAt && assessment.expiresAt < new Date()) {
      await prisma.assessment.update({
        where: { id: assessment.id },
        data: { status: AssessmentStatus.EXPIRED },
      });
      throw new AppError(403, 'Assessment session has expired');
    }

    return this.getAssessmentSession(assessment.id, candidateId);
  }

  private async getAssessmentSession(assessmentId: string, candidateId: string) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, candidateId },
    });

    if (!assessment) throw new AppError(404, 'Assessment not found');

    const questionIds = assessment.questionIds as string[];
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: { testCases: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
    });

    const ordered = questionIds.map((id, index) => {
      const q = questions.find((q) => q.id === id);
      if (!q) {
        throw new AppError(500, `Question ${id} not found in database`);
      }
      return { ...q, order: index + 1 };
    });

    return {
      assessmentId: assessment.id,
      language: assessment.language,
      expiresAt: assessment.expiresAt,
      questions: ordered.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        sampleInput: q.sampleInput,
        sampleOutput: q.sampleOutput,
        constraints: q.constraints,
        starterCode: q.starterCode,
        answerMode: q.answerMode,
        mcqOptions: q.mcqOptions,
        language: q.language,
        order: q.order,
      })),
    };
  }

  private async formatAssessmentResponse(
    assessmentId: string,
    questions: Array<{
      id: string;
      title: string;
      description: string;
      inputFormat: string;
      outputFormat: string;
      sampleInput: string;
      sampleOutput: string;
      constraints: string;
      starterCode: string;
      answerMode: AnswerMode;
      mcqOptions: Prisma.JsonValue | null;
      language: Language;
    }>
  ) {
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    return {
      assessmentId,
      language: assessment!.language,
      expiresAt: assessment!.expiresAt,
      questions: questions.map((q, i) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        sampleInput: q.sampleInput,
        sampleOutput: q.sampleOutput,
        constraints: q.constraints,
        starterCode: q.starterCode,
        answerMode: q.answerMode,
        mcqOptions: q.mcqOptions,
        language: q.language,
        order: i + 1,
      })),
    };
  }

  async runCode(candidateId: string, questionId: string, code: string) {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId, status: AssessmentStatus.IN_PROGRESS },
    });

    if (!assessment) throw new AppError(403, 'No active assessment');
    if (assessment.expiresAt && assessment.expiresAt < new Date()) {
      throw new AppError(403, 'Assessment session has expired');
    }

    const questionIds = assessment.questionIds as string[];
    if (!questionIds.includes(questionId)) {
      throw new AppError(400, 'Question not part of this assessment');
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new AppError(404, 'Question not found');
    if (question.answerMode !== AnswerMode.CODE) {
      throw new AppError(400, 'This question cannot be executed.');
    }

    const testCases = await prisma.questionTestCase.findMany({
      where: { questionId, isHidden: false },
      orderBy: { sortOrder: 'asc' },
    });

    return executionService.runAgainstTestCases(question.language, code, testCases);
  }

  async submitAssessment(
    candidateId: string,
    answers: Array<{ questionId: string; code?: string; selectedOptionIndex?: number | null }>
  ) {
    const assessment = await prisma.assessment.findFirst({
      where: { candidateId, status: AssessmentStatus.IN_PROGRESS },
    });

    if (!assessment) throw new AppError(403, 'No active assessment to submit');

    const existingSubmission = await prisma.submission.findUnique({
      where: { assessmentId: assessment.id },
    });
    if (existingSubmission) {
      throw new AppError(409, 'Assessment already submitted');
    }

    const questionIds = assessment.questionIds as string[];

    if (answers.length > questionIds.length) {
      throw new AppError(400, 'Too many answers submitted');
    }

    for (const answer of answers) {
      if (!questionIds.includes(answer.questionId)) {
        throw new AppError(400, 'Invalid question in submission');
      }
    }

    const normalizedAnswers = questionIds.map((questionId) => {
      const answer = answers.find((item) => item.questionId === questionId);
      return {
        questionId,
        code: answer?.code || '',
        selectedOptionIndex: answer?.selectedOptionIndex ?? null,
      };
    });

    const evaluation = await evaluationService.evaluateSubmission(assessment, normalizedAnswers);

    const submission = await prisma.$transaction(async (tx) => {
      const sub = await tx.submission.create({
        data: {
          assessmentId: assessment.id,
          candidateId,
          score: evaluation.score,
          passedQuestions: evaluation.passedQuestions,
          totalQuestions: evaluation.totalQuestions,
          answers: {
            create: evaluation.answers.map((a) => ({
              questionId: a.questionId,
              code: a.code,
              selectedOptionIndex: a.selectedOptionIndex,
              passedTests: a.passedTests,
              failedTests: a.failedTests,
              executionTimeMs: a.executionTimeMs,
              memoryKb: a.memoryKb,
              testResults: a.testResults as unknown as Prisma.InputJsonValue,
              isFullyPassed: a.isFullyPassed,
            })),
          },
        },
        include: { answers: true },
      });

      await tx.assessment.update({
        where: { id: assessment.id },
        data: { status: AssessmentStatus.COMPLETED },
      });

      await tx.candidateProfile.update({
        where: { id: candidateId },
        data: { latestScore: evaluation.score },
      });

      return sub;
    });

    await assessmentTokenService.markSubmitted(candidateId);
    await candidateStatusService.markSubmitted(candidateId);

    const { touchCandidateActivity } = await import('./candidate-insight.service');
    const { CandidateActivityType } = await import('@prisma/client');
    await touchCandidateActivity(candidateId, CandidateActivityType.ASSESSMENT_SUBMITTED);

    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });

    return {
      success: true,
      submittedAt: submission.submittedAt,
      candidateName: candidate!.fullName,
      status: 'COMPLETED' as const,
    };
  }

  async getThankYouInfo(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
    });

    if (!candidate || candidate.submissions.length === 0) {
      throw new AppError(404, 'No submission found');
    }

    return {
      candidateName: candidate.fullName,
      submittedAt: candidate.submissions[0].submittedAt,
      status: 'COMPLETED',
    };
  }
}

export const assessmentService = new AssessmentService();
