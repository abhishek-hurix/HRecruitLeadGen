import { Prisma } from '@prisma/client';
import { auditService } from '../services/audit.service';

/** @deprecated Prefer auditService.write — kept for call-site compatibility. */
export async function writeAuditLog(params: {
  adminUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await auditService.write({
    adminUserId: params.adminUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
  });
}

/** Strip HTML and truncate rejection reasons. */
export function sanitizeRejectionReason(raw: string, maxLen = 2000): string {
  const cleaned = String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
  if (!cleaned) throw new Error('Rejection reason is required');
  if (cleaned.length < 3) throw new Error('Rejection reason is too short');
  return cleaned.slice(0, maxLen);
}

/** Prevent CSV/Excel formula injection. */
export function sanitizeSpreadsheetCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(str)) return `'${str}`;
  return str;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
