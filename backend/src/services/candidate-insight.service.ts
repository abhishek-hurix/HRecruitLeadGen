import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { activeCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { AdminRole, CandidateActivityType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export type ActivityType = CandidateActivityType;

function applicationIdDisplay(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Update denormalized last activity and append history row. */
export async function touchCandidateActivity(
  candidateId: string,
  type: CandidateActivityType,
  options: {
    at?: Date;
    actorAdminId?: string | null;
    operationId?: string | null;
    metadata?: Prisma.InputJsonValue;
  } = {}
) {
  const at = options.at || new Date();
  await prisma.$transaction([
    prisma.candidateProfile.updateMany({
      where: { id: candidateId },
      data: {
        lastActivityAt: at,
        lastActivityType: type,
      },
    }),
    prisma.candidateActivity.create({
      data: {
        id: randomUUID(),
        candidateId,
        type,
        actorAdminId: options.actorAdminId || null,
        operationId: options.operationId || null,
        metadata: options.metadata,
        occurredAt: at,
      },
    }),
  ]);
}

export async function getScoreBreakdown(candidateId: string) {
  const candidate = await prisma.candidateProfile.findFirst({
    where: mergeCandidateWhere(activeCandidateWhere(), { id: candidateId }),
    include: {
      user: { select: { email: true } },
      submissions: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        include: {
          answers: {
            include: { question: { select: { id: true, title: true } } },
          },
          assessment: {
            include: { jobRole: { select: { title: true } } },
          },
        },
      },
      assessments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { jobRole: { select: { title: true } } },
      },
    },
  });

  if (!candidate) throw new AppError(404, 'Candidate not found');

  const applicationId = applicationIdDisplay(candidate.id);
  const submission = candidate.submissions[0];
  const assessment = submission?.assessment || candidate.assessments[0];

  const summary = {
    candidateId: candidate.id,
    applicationId,
    fullName: candidate.fullName,
    email: candidate.user.email,
    assignedRole: candidate.selectedRoleName || assessment?.jobRole?.title || null,
    assessmentStatus: candidate.assessmentStatus,
  };

  if (!submission) {
    return {
      ...summary,
      hasSubmission: false,
      aggregateOnly: true,
      status: candidate.assessmentStatus,
      score: candidate.latestScore != null ? Number(candidate.latestScore) : null,
      maximumScore: 10,
      correctCount: null,
      incorrectCount: null,
      unansweredCount: null,
      startedAt: assessment?.startedAt || null,
      submittedAt: null,
      questionResults: undefined,
      message:
        candidate.assessmentStatus === 'NOT_STARTED'
          ? 'No assessment has been started.'
          : 'Assessment result is not available yet.',
    };
  }

  const totalQuestions = submission.totalQuestions || submission.answers.length || 0;
  const correctCount = submission.passedQuestions;
  const answered = submission.answers.filter(
    (a) => (a.code && a.code.trim()) || a.selectedOptionIndex != null
  ).length;
  const unansweredCount = Math.max(0, totalQuestions - answered);
  const incorrectCount = Math.max(0, answered - correctCount);

  const questionResults =
    submission.answers.length > 0
      ? submission.answers.map((a, idx) => ({
          number: idx + 1,
          questionId: a.questionId,
          title: a.question?.title || null,
          awardedMarks: a.isFullyPassed ? 1 : 0,
          maximumMarks: 1,
          answered: Boolean((a.code && a.code.trim()) || a.selectedOptionIndex != null),
          correct: a.isFullyPassed,
        }))
      : undefined;

  return {
    ...summary,
    hasSubmission: true,
    aggregateOnly: !questionResults,
    status: candidate.assessmentStatus,
    score: Number(submission.score),
    maximumScore: 10,
    correctCount,
    incorrectCount,
    unansweredCount,
    startedAt: assessment?.startedAt || null,
    submittedAt: submission.submittedAt,
    ...(questionResults ? { questionResults } : {}),
  };
}

export async function getCandidateActivityTimeline(candidateId: string) {
  const candidate = await prisma.candidateProfile.findFirst({
    where: mergeCandidateWhere(activeCandidateWhere(), { id: candidateId }),
    select: {
      id: true,
      createdAt: true,
      lastActivityAt: true,
      lastActivityType: true,
    },
  });
  if (!candidate) throw new AppError(404, 'Candidate not found');

  const rows = await prisma.candidateActivity.findMany({
    where: { candidateId },
    orderBy: { occurredAt: 'desc' },
    take: 100,
    include: { actorAdmin: { select: { email: true, role: true } } },
  });

  const events: Array<{
    type: string;
    at: string;
    summary: string;
    adminEmail: string | null;
    operationId: string | null;
    metadata?: Record<string, unknown>;
  }> = rows.map((r) => ({
    type: r.type,
    at: r.occurredAt.toISOString(),
    summary: r.type.replace(/_/g, ' '),
    adminEmail: r.actorAdmin?.email || null,
    operationId: r.operationId,
    ...(r.metadata ? { metadata: r.metadata as Record<string, unknown> } : {}),
  }));

  // Ensure REGISTERED appears if activity table empty (legacy rows)
  if (!events.some((e) => e.type === 'REGISTERED')) {
    events.push({
      type: CandidateActivityType.REGISTERED,
      at: candidate.createdAt.toISOString(),
      summary: 'Candidate registered',
      adminEmail: null,
      operationId: null,
    });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  return {
    candidateId,
    applicationId: applicationIdDisplay(candidate.id),
    lastActivityAt: candidate.lastActivityAt,
    lastActivityType: candidate.lastActivityType,
    events: events.slice(0, 100),
  };
}

export async function assignCandidateOwner(params: {
  candidateId: string;
  ownerAdminId: string | null;
  actorAdminId: string;
  actorRole: AdminRole;
}) {
  if (params.actorRole !== AdminRole.SUPER_ADMIN) {
    throw new AppError(403, 'Only Super Admin may assign candidate owners');
  }

  const candidate = await prisma.candidateProfile.findFirst({
    where: mergeCandidateWhere(activeCandidateWhere(), { id: params.candidateId }),
  });
  if (!candidate) throw new AppError(404, 'Candidate not found');

  if (params.ownerAdminId) {
    const owner = await prisma.adminUser.findUnique({ where: { id: params.ownerAdminId } });
    if (!owner || (owner.role !== AdminRole.ADMIN && owner.role !== AdminRole.SUPER_ADMIN)) {
      throw new AppError(400, 'Owner must be an active ADMIN or SUPER_ADMIN');
    }
  }

  const previousOwnerId = candidate.ownerAdminId;
  const at = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.candidateProfile.update({
      where: { id: params.candidateId },
      data: {
        ownerAdminId: params.ownerAdminId,
        ownerAssignedAt: params.ownerAdminId ? at : null,
        ownerAssignedByAdminId: params.ownerAdminId ? params.actorAdminId : null,
        lastActivityAt: at,
        lastActivityType: CandidateActivityType.OWNER_ASSIGNED,
      },
      include: {
        ownerAdmin: { select: { id: true, email: true, role: true } },
      },
    });

    await tx.candidateActivity.create({
      data: {
        id: randomUUID(),
        candidateId: params.candidateId,
        type: CandidateActivityType.OWNER_ASSIGNED,
        actorAdminId: params.actorAdminId,
        occurredAt: at,
        metadata: { previousOwnerId, newOwnerId: params.ownerAdminId },
      },
    });

    await tx.auditLog.create({
      data: {
        adminUserId: params.actorAdminId,
        action: 'CANDIDATE_OWNER_ASSIGNED',
        entityType: 'candidate',
        entityId: params.candidateId,
        metadata: {
          previousOwnerId,
          newOwnerId: params.ownerAdminId,
          assignedAt: at.toISOString(),
          assignedByAdminId: params.actorAdminId,
        },
      },
    });

    return row;
  });

  return {
    candidateId: updated.id,
    owner: updated.ownerAdmin
      ? { id: updated.ownerAdmin.id, email: updated.ownerAdmin.email, role: updated.ownerAdmin.role }
      : null,
    ownerAssignedAt: updated.ownerAssignedAt,
    previousOwnerId,
  };
}

export async function listCandidateOwners() {
  const admins = await prisma.adminUser.findMany({
    where: {
      role: { in: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN] },
    },
    select: { id: true, email: true, role: true },
    orderBy: { email: 'asc' },
  });
  return admins;
}
