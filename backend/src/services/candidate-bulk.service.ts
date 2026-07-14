import { v4 as uuidv4 } from 'uuid';
import {
  AdminRole,
  AssessmentStatus,
  BulkOperationAction,
  BulkOperationStatus,
  CandidateActivityType,
  CandidateStatus,
  JobRoleStatus,
  Prisma,
  SelectionStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { writeAuditLog, sanitizeRejectionReason } from '../utils/admin-safety';
import { activeCandidateWhere, deletedCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { candidateReferenceFromId } from '../utils/idempotency';
import {
  CandidateSelectionInput,
  buildCandidateListWhere,
  buildDeletedCandidateListWhere,
  resolveCandidateIds,
  resolveDeletedCandidateIds,
  CandidateFilterSnapshot,
} from './candidate-selection.service';
import { assessmentTokenService } from './assessment-token.service';
import { getExperienceLabel } from '../utils/experience';

export interface BulkResultItem {
  candidateId: string;
  code?: string;
  message?: string;
  status: 'succeeded' | 'failed' | 'skipped';
}

export interface BulkOperationResult {
  operationId: string;
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  errors: Array<{ candidateId: string; code: string; message: string }>;
}

async function createBulkOperation(params: {
  action: BulkOperationAction;
  adminUserId: string;
  selection: CandidateSelectionInput;
  ids: string[];
  filterSnapshot: CandidateFilterSnapshot | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}) {
  const operationId = uuidv4();
  await prisma.adminBulkOperation.create({
    data: {
      operationId,
      action: params.action,
      status: BulkOperationStatus.RUNNING,
      adminUserId: params.adminUserId,
      selectionMode: params.selection.mode,
      filterSnapshot: (params.filterSnapshot || params.selection.filters || undefined) as Prisma.InputJsonValue,
      excludedCount: params.selection.excludedCandidateIds?.length || 0,
      requestedCount: params.ids.length,
      metadata: params.metadata,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });
  return operationId;
}

async function finalizeBulkOperation(
  operationId: string,
  results: BulkResultItem[],
  adminUserId: string,
  action: string,
  extraMeta?: Record<string, unknown>
): Promise<BulkOperationResult> {
  const succeeded = results.filter((r) => r.status === 'succeeded').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const status =
    failed === 0 && skipped === 0
      ? BulkOperationStatus.SUCCEEDED
      : succeeded === 0
        ? BulkOperationStatus.FAILED
        : BulkOperationStatus.PARTIAL;

  await prisma.adminBulkOperation.update({
    where: { operationId },
    data: {
      status,
      succeededCount: succeeded,
      failedCount: failed,
      skippedCount: skipped,
      completedAt: new Date(),
    },
  });

  if (results.length > 0) {
    await prisma.adminBulkOperationItem.createMany({
      data: results.map((r) => ({
        operationId,
        candidateId: r.candidateId,
        candidateReference: candidateReferenceFromId(r.candidateId),
        status: r.status,
        errorCode: r.code || null,
        errorMessage: r.message || null,
      })),
    });
  }

  await writeAuditLog({
    adminUserId,
    action,
    entityType: 'candidate_bulk',
    entityId: operationId,
    metadata: {
      operationId,
      requested: results.length,
      succeeded,
      failed,
      skipped,
      ...extraMeta,
    },
  });

  return {
    operationId,
    summary: { requested: results.length, succeeded, failed, skipped },
    errors: results
      .filter((r) => r.status === 'failed')
      .map((r) => ({ candidateId: r.candidateId, code: r.code || 'ERROR', message: r.message || 'Failed' })),
  };
}

const ALLOWED_JOURNEY_STATUSES: CandidateStatus[] = [
  CandidateStatus.REGISTERED,
  CandidateStatus.EMAIL_SENT,
  CandidateStatus.VERIFIED,
  CandidateStatus.STARTED,
  CandidateStatus.SUBMITTED,
  CandidateStatus.EXPIRED,
];

export class CandidateBulkService {
  async changeStatus(
    selection: CandidateSelectionInput,
    newStatus: string,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    if (!ALLOWED_JOURNEY_STATUSES.includes(newStatus as CandidateStatus)) {
      throw new AppError(400, 'Invalid journey status');
    }

    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.STATUS_CHANGE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { newStatus },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id }),
        });
        if (!current) {
          results.push({ candidateId: id, status: 'failed', code: 'NOT_FOUND', message: 'Candidate not found' });
          continue;
        }
        const previous = current.candidateStatus;
        await prisma.candidateProfile.update({
          where: { id },
          data: { candidateStatus: newStatus as CandidateStatus },
        });
        const { touchCandidateActivity } = await import('./candidate-insight.service');
        await touchCandidateActivity(id, CandidateActivityType.STATUS_CHANGED, {
          actorAdminId: adminUserId,
          operationId,
          metadata: { previous, newStatus },
        });
        results.push({
          candidateId: id,
          status: 'succeeded',
          message: `${previous} → ${newStatus}`,
        });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'UPDATE_FAILED',
          message: e instanceof Error ? e.message : 'Update failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_STATUS_CHANGED', { newStatus });
  }

  async reject(
    selection: CandidateSelectionInput,
    reason: string,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    let sanitized: string;
    try {
      sanitized = sanitizeRejectionReason(reason);
    } catch (e) {
      throw new AppError(400, e instanceof Error ? e.message : 'Invalid rejection reason');
    }

    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.REJECT,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { hasReason: true },
      ...meta,
    });

    const now = new Date();
    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id }),
        });
        if (!current) {
          results.push({ candidateId: id, status: 'failed', code: 'NOT_FOUND', message: 'Candidate not found' });
          continue;
        }
        await prisma.$transaction([
          prisma.candidateProfile.update({
            where: { id },
            data: {
              previousSelectionStatus: current.selectionStatus,
              selectionStatus: SelectionStatus.REJECTED,
              rejectionReason: sanitized,
              rejectedAt: now,
              rejectedByAdminId: adminUserId,
            },
          }),
          prisma.candidateRejection.create({
            data: {
              candidateId: id,
              candidateReference: candidateReferenceFromId(id),
              rejectedByAdminId: adminUserId,
              previousJourneyStatus: current.candidateStatus,
              previousSelectionStatus: current.selectionStatus,
              reason: sanitized,
              rejectedAt: now,
              operationId,
            },
          }),
        ]);
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'REJECT_FAILED',
          message: e instanceof Error ? e.message : 'Reject failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_REJECTED');
  }

  async restoreRejected(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.RESTORE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { scope: 'REJECTED' },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), {
            id,
            selectionStatus: SelectionStatus.REJECTED,
          }),
        });
        if (!current) {
          results.push({
            candidateId: id,
            status: 'failed',
            code: 'NOT_FOUND',
            message: 'Rejected candidate not found',
          });
          continue;
        }

        const restoredStatus =
          current.previousSelectionStatus && current.previousSelectionStatus !== SelectionStatus.REJECTED
            ? current.previousSelectionStatus
            : SelectionStatus.PENDING;

        await prisma.candidateProfile.update({
          where: { id },
          data: {
            selectionStatus: restoredStatus,
            previousSelectionStatus: null,
            rejectionReason: null,
            rejectedAt: null,
            rejectedByAdminId: null,
          },
        });

        const { touchCandidateActivity } = await import('./candidate-insight.service');
        await touchCandidateActivity(id, CandidateActivityType.STATUS_CHANGED, {
          actorAdminId: adminUserId,
          operationId,
          metadata: { action: 'REJECTION_RESTORED', restoredStatus },
        }).catch(() => undefined);

        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'RESTORE_REJECTED_FAILED',
          message: e instanceof Error ? e.message : 'Restore failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_REJECTION_RESTORED');
  }

  async shortlist(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.STATUS_CHANGE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { selectionStatus: 'SHORTLISTED' },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), {
            id,
            selectionStatus: { notIn: [SelectionStatus.SHORTLISTED, SelectionStatus.REJECTED] },
          }),
        });
        if (!current) {
          results.push({
            candidateId: id,
            status: 'failed',
            code: 'NOT_FOUND',
            message: 'Candidate not found or already shortlisted/rejected',
          });
          continue;
        }

        await prisma.candidateProfile.update({
          where: { id },
          data: {
            previousSelectionStatus: current.selectionStatus,
            selectionStatus: SelectionStatus.SHORTLISTED,
          },
        });

        const { touchCandidateActivity } = await import('./candidate-insight.service');
        await touchCandidateActivity(id, CandidateActivityType.STATUS_CHANGED, {
          actorAdminId: adminUserId,
          operationId,
          metadata: { action: 'SHORTLISTED', from: current.selectionStatus },
        }).catch(() => undefined);

        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'SHORTLIST_FAILED',
          message: e instanceof Error ? e.message : 'Shortlist failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_SHORTLISTED');
  }

  async restoreShortlisted(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.RESTORE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { scope: 'SHORTLISTED' },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), {
            id,
            selectionStatus: SelectionStatus.SHORTLISTED,
          }),
        });
        if (!current) {
          results.push({
            candidateId: id,
            status: 'failed',
            code: 'NOT_FOUND',
            message: 'Shortlisted candidate not found',
          });
          continue;
        }

        const restoredStatus =
          current.previousSelectionStatus &&
          current.previousSelectionStatus !== SelectionStatus.SHORTLISTED &&
          current.previousSelectionStatus !== SelectionStatus.REJECTED
            ? current.previousSelectionStatus
            : SelectionStatus.PENDING;

        await prisma.candidateProfile.update({
          where: { id },
          data: {
            selectionStatus: restoredStatus,
            previousSelectionStatus: null,
          },
        });

        const { touchCandidateActivity } = await import('./candidate-insight.service');
        await touchCandidateActivity(id, CandidateActivityType.STATUS_CHANGED, {
          actorAdminId: adminUserId,
          operationId,
          metadata: { action: 'SHORTLIST_RESTORED', restoredStatus },
        }).catch(() => undefined);

        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'RESTORE_SHORTLISTED_FAILED',
          message: e instanceof Error ? e.message : 'Restore failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_SHORTLIST_RESTORED');
  }

  async markAsTestUsers(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.STATUS_CHANGE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { markTestUser: true },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id, isTestUser: false }),
        });
        if (!current) {
          results.push({
            candidateId: id,
            status: 'failed',
            code: 'NOT_FOUND',
            message: 'Candidate not found or already a test user',
          });
          continue;
        }
        await prisma.candidateProfile.update({
          where: { id },
          data: { isTestUser: true },
        });
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'MARK_TEST_FAILED',
          message: e instanceof Error ? e.message : 'Failed to mark as test user',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_MARKED_TEST_USER');
  }

  async removeFromTestUsers(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    if (selection.mode === 'ALL_MATCHING') {
      selection.filters = { ...(selection.filters || {}), isTestUser: true };
    }
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.RESTORE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { removeTestUser: true },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id, isTestUser: true }),
        });
        if (!current) {
          results.push({
            candidateId: id,
            status: 'failed',
            code: 'NOT_FOUND',
            message: 'Test user not found',
          });
          continue;
        }
        await prisma.candidateProfile.update({
          where: { id },
          data: { isTestUser: false },
        });
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'REMOVE_TEST_FAILED',
          message: e instanceof Error ? e.message : 'Failed to remove test user flag',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_REMOVED_FROM_TEST_USERS');
  }

  async assignRole(
    selection: CandidateSelectionInput,
    jobRoleId: string,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const role = await prisma.jobRole.findUnique({ where: { id: jobRoleId } });
    if (!role || role.status !== JobRoleStatus.ACTIVE) {
      throw new AppError(400, 'Job role not found or inactive');
    }

    const compensation =
      role.compensationType === 'HOURLY' && role.hourlyRate != null
        ? `${role.currency} ${role.hourlyRate}/hr`
        : role.monthlySalary != null
          ? `${role.currency} ${role.monthlySalary}/mo`
          : role.currency;

    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.ASSIGN_ROLE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      metadata: { jobRoleId, title: role.title },
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id }),
        });
        if (!current) {
          results.push({ candidateId: id, status: 'failed', code: 'NOT_FOUND', message: 'Candidate not found' });
          continue;
        }
        const previousRole = current.selectedRoleName;
        await prisma.candidateProfile.update({
          where: { id },
          data: {
            selectedRoleId: role.id,
            selectedRoleName: role.title,
            selectedCountry: role.country,
            selectedCompensation: compensation,
            selectedSkills: role.skills as Prisma.InputJsonValue,
            roleSelectedAt: new Date(),
            appliedRole: role.title,
          },
        });
        const { touchCandidateActivity } = await import('./candidate-insight.service');
        await touchCandidateActivity(id, CandidateActivityType.ROLE_ASSIGNED, {
          actorAdminId: adminUserId,
          operationId,
          metadata: { previousRole, jobRoleId: role.id, title: role.title },
        });
        results.push({
          candidateId: id,
          status: 'succeeded',
          message: `${previousRole || 'none'} → ${role.title}`,
        });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'ASSIGN_FAILED',
          message: e instanceof Error ? e.message : 'Assign failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'JOB_ROLE_ASSIGNED', {
      jobRoleId,
      title: role.title,
    });
  }

  async softDelete(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.SOFT_DELETE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      ...meta,
    });

    const now = new Date();
    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(activeCandidateWhere(), { id }),
        });
        if (!current) {
          results.push({ candidateId: id, status: 'failed', code: 'NOT_FOUND', message: 'Candidate not found' });
          continue;
        }
        await prisma.candidateProfile.update({
          where: { id },
          data: { deletedAt: now, deletedByAdminId: adminUserId },
        });
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'DELETE_FAILED',
          message: e instanceof Error ? e.message : 'Delete failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_SOFT_DELETED');
  }

  async restoreBulk(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveDeletedCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.RESTORE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        const current = await prisma.candidateProfile.findFirst({
          where: mergeCandidateWhere(deletedCandidateWhere(), { id }),
        });
        if (!current) {
          results.push({ candidateId: id, status: 'failed', code: 'NOT_FOUND', message: 'Deleted candidate not found' });
          continue;
        }
        await prisma.candidateProfile.update({
          where: { id },
          data: {
            deletedAt: null,
            deletedByAdminId: null,
            restoredAt: new Date(),
            restoredByAdminId: adminUserId,
          },
        });
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'RESTORE_FAILED',
          message: e instanceof Error ? e.message : 'Restore failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_RESTORED');
  }

  async permanentDeleteBulk(
    selection: CandidateSelectionInput,
    adminUserId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const { ids, filterSnapshot } = await resolveDeletedCandidateIds(selection);
    const operationId = await createBulkOperation({
      action: BulkOperationAction.PERMANENT_DELETE,
      adminUserId,
      selection,
      ids,
      filterSnapshot,
      ...meta,
    });

    const results: BulkResultItem[] = [];
    for (const id of ids) {
      try {
        await this.permanentDelete(id, adminUserId);
        results.push({ candidateId: id, status: 'succeeded' });
      } catch (e) {
        results.push({
          candidateId: id,
          status: 'failed',
          code: 'PERMANENT_DELETE_FAILED',
          message: e instanceof Error ? e.message : 'Permanent delete failed',
        });
      }
    }

    return finalizeBulkOperation(operationId, results, adminUserId, 'CANDIDATE_PERMANENTLY_DELETED');
  }

  async restore(candidateId: string, adminUserId: string): Promise<{ id: string }> {
    const candidate = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(deletedCandidateWhere(), { id: candidateId }),
    });
    if (!candidate) throw new AppError(404, 'Deleted candidate not found');

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        deletedAt: null,
        deletedByAdminId: null,
        restoredAt: new Date(),
        restoredByAdminId: adminUserId,
      },
    });

    await writeAuditLog({
      adminUserId,
      action: 'CANDIDATE_RESTORED',
      entityType: 'candidate',
      entityId: candidateId,
    });

    return { id: candidateId };
  }

  async permanentDelete(candidateId: string, adminUserId: string): Promise<{ id: string }> {
    const candidate = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(deletedCandidateWhere(), { id: candidateId }),
      include: { user: true },
    });
    if (!candidate) throw new AppError(404, 'Deleted candidate not found');

    await writeAuditLog({
      adminUserId,
      action: 'CANDIDATE_PERMANENTLY_DELETED',
      entityType: 'candidate',
      entityId: candidateId,
      metadata: {
        email: candidate.user.email,
        fullName: candidate.fullName,
        deletedAt: candidate.deletedAt,
      },
    });

    // Permanent deletion relation strategy:
    // MUST DELETE: resumes, tokens, assessments, submissions/answers, profile
    // RETAIN + SET NULL candidateId: bulk items, reminder deliveries, interview participants, rejection history
    // RETAIN AuditLog (entityId kept as historical reference)
    // SET NULL: visitor.candidateId
    // NEVER cascade: JobRole, Question, AdminUser, shared templates
    await prisma.$transaction(async (tx) => {
      const reference = candidateReferenceFromId(candidateId);

      await tx.adminBulkOperationItem.updateMany({
        where: { candidateId },
        data: { candidateId: null, candidateReference: reference },
      });
      await tx.emailReminderDelivery.updateMany({
        where: { candidateId },
        data: { candidateId: null, candidateReference: reference },
      });
      await tx.candidateInterviewParticipant.updateMany({
        where: { candidateId },
        data: { candidateId: null, candidateReference: reference },
      });
      await tx.candidateRejection.updateMany({
        where: { candidateId },
        data: { candidateId: null, candidateReference: reference },
      });

      await tx.submissionAnswer.deleteMany({ where: { submission: { candidateId } } });
      await tx.submission.deleteMany({ where: { candidateId } });
      await tx.assessment.deleteMany({ where: { candidateId } });
      await tx.assessmentToken.deleteMany({ where: { candidateId } });
      await tx.emailVerificationToken.deleteMany({ where: { candidateId } });
      await tx.candidateResume.deleteMany({ where: { candidateId } });
      await tx.visitor.updateMany({ where: { candidateId }, data: { candidateId: null } });
      await tx.candidateProfile.delete({ where: { id: candidateId } });
    });

    return { id: candidateId };
  }

  async listDeleted(params: {
    search?: string;
    role?: string;
    registeredFrom?: string;
    registeredTo?: string;
    datePreset?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = [5, 10, 20, 30, 50, 100].includes(params.pageSize || 0) ? params.pageSize! : 10;
    const skip = (page - 1) * pageSize;

    const where = buildDeletedCandidateListWhere({
      search: params.search,
      role: params.role || null,
      jobRoleId: params.role || null,
      registeredFrom: params.registeredFrom || null,
      registeredTo: params.registeredTo || null,
      datePreset: (params.datePreset as CandidateFilterSnapshot['datePreset']) || null,
    });

    const [rows, total] = await Promise.all([
      prisma.candidateProfile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { deletedAt: 'desc' },
        include: {
          user: true,
          deletedByAdmin: { select: { id: true, email: true } },
          submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
        },
      }),
      prisma.candidateProfile.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map((c) => ({
        id: c.id,
        applicationId: c.id.slice(0, 8).toUpperCase(),
        fullName: c.fullName,
        email: c.user.email,
        phone: c.fullPhone || c.phone,
        phoneCountry: c.phoneCountry,
        experienceLabel: getExperienceLabel(c.experienceCategory),
        assignedRole: c.selectedRoleName || c.appliedRole,
        assessmentStatus: c.assessmentStatus,
        score: c.submissions[0] ? Number(c.submissions[0].score) : null,
        deletedAt: c.deletedAt,
        deletedBy: c.deletedByAdmin
          ? { id: c.deletedByAdmin.id, email: c.deletedByAdmin.email }
          : null,
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getDeletedById(candidateId: string) {
    const c = await prisma.candidateProfile.findFirst({
      where: mergeCandidateWhere(deletedCandidateWhere(), { id: candidateId }),
      include: {
        user: true,
        deletedByAdmin: { select: { id: true, email: true, role: true } },
        restoredByAdmin: { select: { id: true, email: true } },
        rejectedByAdmin: { select: { email: true } },
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
        rejectionHistory: {
          orderBy: { rejectedAt: 'desc' },
          include: { rejectedByAdmin: { select: { email: true } } },
        },
      },
    });
    if (!c) throw new AppError(404, 'Deleted candidate not found');

    return {
      id: c.id,
      applicationId: c.id.slice(0, 8).toUpperCase(),
      fullName: c.fullName,
      email: c.user.email,
      phone: c.fullPhone || c.phone,
      phoneCountry: c.phoneCountry,
      experienceLabel: getExperienceLabel(c.experienceCategory),
      assignedRole: c.selectedRoleName || c.appliedRole,
      assessmentStatus: c.assessmentStatus,
      score: c.submissions[0] ? Number(c.submissions[0].score) : null,
      selectionStatus: c.selectionStatus,
      deletedAt: c.deletedAt,
      deletedBy: c.deletedByAdmin
        ? {
            id: c.deletedByAdmin.id,
            email: c.deletedByAdmin.email,
            name: c.deletedByAdmin.email,
            role: c.deletedByAdmin.role,
          }
        : null,
      restoredAt: c.restoredAt,
      restoredBy: c.restoredByAdmin?.email || null,
      rejectionReason: c.rejectionReason,
      rejectedAt: c.rejectedAt,
      rejectedBy: c.rejectedByAdmin?.email || null,
      rejectionHistory: c.rejectionHistory.map((r) => ({
        id: r.id,
        reason: r.reason,
        rejectedAt: r.rejectedAt,
        rejectedBy: r.rejectedByAdmin?.email || null,
        previousJourneyStatus: r.previousJourneyStatus,
        operationId: r.operationId,
      })),
      createdAt: c.createdAt,
    };
  }
}

export const candidateBulkService = new CandidateBulkService();
