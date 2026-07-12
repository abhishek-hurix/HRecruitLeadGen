import { AdminRole, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export type AuditActionType =
  | 'CANDIDATE_STATUS_CHANGED'
  | 'CANDIDATE_REJECTED'
  | 'REMINDER_SENT'
  | 'JOB_ROLE_ASSIGNED'
  | 'INTERVIEW_SCHEDULED'
  | 'CANDIDATES_EXPORTED'
  | 'CANDIDATE_SOFT_DELETED'
  | 'CANDIDATE_RESTORED'
  | 'CANDIDATE_PERMANENTLY_DELETED'
  | string;

export interface AuditWriteInput {
  adminUserId?: string | null;
  actorRole?: AdminRole | string | null;
  action: AuditActionType;
  entityType?: string;
  entityId?: string;
  operationId?: string;
  selectionMode?: string;
  filterSnapshot?: Prisma.InputJsonValue;
  candidateCount?: number;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  result?: 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | string;
  errorSummary?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Reusable audit writer. Never stores JWTs, passwords, SMTP, or OAuth tokens.
 * Parent bulk operations live in AdminBulkOperation; this service writes AuditLog
 * tombstones / high-level events and supports Super-Admin retrieval.
 */
class AuditService {
  async write(input: AuditWriteInput): Promise<void> {
    try {
      const safeMeta: Record<string, unknown> = {
        ...(typeof input.metadata === 'object' && input.metadata && !Array.isArray(input.metadata)
          ? (input.metadata as Record<string, unknown>)
          : input.metadata
            ? { value: input.metadata }
            : {}),
      };

      if (input.operationId) safeMeta.operationId = input.operationId;
      if (input.selectionMode) safeMeta.selectionMode = input.selectionMode;
      if (input.filterSnapshot !== undefined) safeMeta.filterSnapshot = input.filterSnapshot;
      if (input.candidateCount !== undefined) safeMeta.candidateCount = input.candidateCount;
      if (input.previousValue !== undefined) safeMeta.previousValue = input.previousValue;
      if (input.newValue !== undefined) safeMeta.newValue = input.newValue;
      if (input.result) safeMeta.result = input.result;
      if (input.errorSummary) safeMeta.errorSummary = String(input.errorSummary).slice(0, 500);
      if (input.actorRole) safeMeta.actorRole = input.actorRole;
      if (input.userAgent) safeMeta.userAgent = String(input.userAgent).slice(0, 300);
      if (input.requestId) safeMeta.requestId = input.requestId;

      // Strip accidental secrets if present in metadata
      for (const key of Object.keys(safeMeta)) {
        const lower = key.toLowerCase();
        if (
          lower.includes('password') ||
          lower.includes('token') ||
          lower.includes('secret') ||
          lower.includes('smtp') ||
          lower.includes('refresh')
        ) {
          delete safeMeta[key];
        }
      }

      await prisma.auditLog.create({
        data: {
          adminUserId: input.adminUserId || null,
          action: input.action,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          metadata: safeMeta as Prisma.InputJsonValue,
          ipAddress: input.ipAddress || null,
        },
      });
    } catch (error) {
      logger.error('Failed to write audit log', { action: input.action, error });
    }
  }

  /** Super Admin only — elevated audit listing. */
  async listForSuperAdmin(params: {
    action?: string;
    adminUserId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
    const where: Prisma.AuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.adminUserId) where.adminUserId = params.adminUserId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { adminUser: { select: { id: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}

export const auditService = new AuditService();
