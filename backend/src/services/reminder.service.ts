import { v4 as uuidv4 } from 'uuid';
import { BulkOperationAction, CandidateActivityType, ReminderDeliveryStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { escapeHtml, writeAuditLog } from '../utils/admin-safety';
import { candidateReferenceFromId, beginIdempotentOperation } from '../utils/idempotency';
import { emailService } from './email.service';
import { config } from '../config';
import {
  CandidateSelectionInput,
  resolveCandidateIds,
} from './candidate-selection.service';
import { BulkOperationResult } from './candidate-bulk.service';

const CANDIDATE_PORTAL_URL = 'https://candidates.hurixsystems.com/';

const DEFAULT_TEMPLATES = [
  {
    name: 'Assessment Reminder',
    subject: 'Reminder: Complete your Hurix Talent Assessment',
    bodyHtml: `<p>Hello {{candidateName}},</p>
<p>This is a friendly reminder to complete your Hurix Talent assessment for <strong>{{assignedRole}}</strong>.</p>
<p>Current status: {{assessmentStatus}}</p>
<p>{{#assessmentLink}}<a href="{{assessmentLink}}">Continue your assessment</a>{{/assessmentLink}}</p>
<p><a href="${CANDIDATE_PORTAL_URL}">${CANDIDATE_PORTAL_URL}</a></p>
<p>Thank you,<br/>Team Hurix Digital</p>`,
  },
  {
    name: 'Application Follow-up',
    subject: 'Update on your application at Hurix',
    bodyHtml: `<p>Hello {{candidateName}},</p>
<p>We are reviewing applications for <strong>{{assignedRole}}</strong>. Please ensure your profile is complete.</p>
<p>Application ID: {{applicationId}}</p>
<p><a href="${CANDIDATE_PORTAL_URL}">${CANDIDATE_PORTAL_URL}</a></p>
<p>Regards,<br/>Team Hurix Digital</p>`,
  },
];

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), escapeHtml(value));
  }
  // Strip simple conditional blocks when empty
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, inner) =>
    vars[key] ? inner.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), escapeHtml(vars[key])) : ''
  );
  return out;
}

async function ensureDefaultTemplates(adminUserId: string) {
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await prisma.emailReminderTemplate.findFirst({
      where: { name: t.name, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) {
      await prisma.emailReminderTemplate.create({
        data: { ...t, createdById: adminUserId, updatedAt: new Date() },
      });
      continue;
    }
    // Keep seeded defaults in sync (portal link, sign-off, etc.) without wiping custom-named templates.
    if (!existing.bodyHtml.includes(CANDIDATE_PORTAL_URL) || existing.bodyHtml.includes('{{companyName}}')) {
      await prisma.emailReminderTemplate.update({
        where: { id: existing.id },
        data: {
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          updatedById: adminUserId,
        },
      });
    }
  }
}

function normalizeEmailTemplateInput(input: {
  name?: string;
  subject?: string;
  bodyHtml?: string;
}) {
  const name = String(input.name || '').trim();
  const subject = String(input.subject || '').trim();
  const bodyHtml = String(input.bodyHtml || '').trim();
  if (!name) throw new AppError(400, 'Template name is required');
  if (!subject) throw new AppError(400, 'Subject is required');
  if (!bodyHtml) throw new AppError(400, 'Email body is required');
  if (name.length > 120) throw new AppError(400, 'Template name is too long');
  if (subject.length > 300) throw new AppError(400, 'Subject is too long');
  return { name, subject, bodyHtml };
}

export class ReminderService {
  async listTemplates(adminUserId: string) {
    await ensureDefaultTemplates(adminUserId);
    return prisma.emailReminderTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(
    adminUserId: string,
    input: { name: string; subject: string; bodyHtml: string }
  ) {
    const data = normalizeEmailTemplateInput(input);
    return prisma.emailReminderTemplate.create({
      data: {
        ...data,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });
  }

  async updateTemplate(
    templateId: string,
    adminUserId: string,
    input: { name: string; subject: string; bodyHtml: string }
  ) {
    const existing = await prisma.emailReminderTemplate.findUnique({ where: { id: templateId } });
    if (!existing || !existing.isActive) throw new AppError(404, 'Template not found');
    const data = normalizeEmailTemplateInput(input);
    return prisma.emailReminderTemplate.update({
      where: { id: templateId },
      data: {
        ...data,
        updatedById: adminUserId,
      },
    });
  }

  async deleteTemplate(templateId: string, adminUserId: string) {
    const existing = await prisma.emailReminderTemplate.findUnique({ where: { id: templateId } });
    if (!existing || !existing.isActive) throw new AppError(404, 'Template not found');
    return prisma.emailReminderTemplate.update({
      where: { id: templateId },
      data: { isActive: false, updatedById: adminUserId },
    });
  }

  async preview(templateId: string, sample: Record<string, string>) {
    const template = await prisma.emailReminderTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) throw new AppError(404, 'Template not found');
    return {
      subject: renderTemplate(template.subject, sample),
      bodyHtml: renderTemplate(template.bodyHtml, sample),
    };
  }

  async sendBulk(
    selection: CandidateSelectionInput,
    templateId: string,
    adminUserId: string,
    operationIdInput?: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const operationId = operationIdInput || uuidv4();

    return beginIdempotentOperation({
      adminUserId,
      operationType: 'REMINDER_SEND',
      key: operationId,
      requestPayload: { selection, templateId },
      execute: async () => {
        const body = await this.executeSendBulk(selection, templateId, adminUserId, operationId, meta);
        return { status: 200, body };
      },
    });
  }

  private async executeSendBulk(
    selection: CandidateSelectionInput,
    templateId: string,
    adminUserId: string,
    operationId: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult> {
    const template = await prisma.emailReminderTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) throw new AppError(404, 'Template not found');

    const existing = await prisma.emailReminderDelivery.findFirst({ where: { operationId } });
    if (existing) {
      throw new AppError(409, 'This reminder operation was already processed');
    }

    const { ids, filterSnapshot } = await resolveCandidateIds(selection);

    await prisma.adminBulkOperation.create({
      data: {
        operationId,
        action: BulkOperationAction.REMINDER,
        status: 'RUNNING',
        adminUserId,
        selectionMode: selection.mode,
        filterSnapshot: (filterSnapshot || selection.filters || undefined) as object,
        excludedCount: selection.excludedCandidateIds?.length || 0,
        requestedCount: ids.length,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
      },
    });

    const candidates = await prisma.candidateProfile.findMany({
      where: { id: { in: ids } },
      include: { user: true, assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const byId = new Map(candidates.map((c) => [c.id, c]));
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ candidateId: string; code: string; message: string }> = [];

    const CONCURRENCY = 5;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (candidateId) => {
          const c = byId.get(candidateId);
          if (!c?.user?.email) {
            skipped += 1;
            await prisma.emailReminderDelivery.create({
              data: {
                operationId,
                candidateId,
                candidateReference: candidateReferenceFromId(candidateId),
                templateId,
                adminUserId,
                recipientEmail: '',
                subjectRendered: template.subject,
                status: ReminderDeliveryStatus.SKIPPED,
                errorCode: 'INVALID_EMAIL',
                errorSummary: 'Missing email',
              },
            });
            errors.push({ candidateId, code: 'INVALID_EMAIL', message: 'Candidate has no valid email address.' });
            return;
          }

          const vars = {
            candidateName: c.fullName,
            candidateEmail: c.user.email,
            applicationId: c.id.slice(0, 8).toUpperCase(),
            assignedRole: c.selectedRoleName || c.appliedRole || 'General',
            assessmentStatus: c.assessmentStatus,
            assessmentLink: '',
            companyName: 'Team Hurix Digital',
          };

          const subject = renderTemplate(template.subject, vars);
          const bodyHtml = renderTemplate(template.bodyHtml, vars);

          try {
            await emailService.sendCustomEmail({
              to: c.user.email,
              subject,
              html: bodyHtml,
            });
            succeeded += 1;
            await prisma.emailReminderDelivery.create({
              data: {
                operationId,
                candidateId,
                candidateReference: candidateReferenceFromId(candidateId),
                templateId,
                adminUserId,
                recipientEmail: c.user.email,
                subjectRendered: subject,
                status: ReminderDeliveryStatus.SENT,
                sentAt: new Date(),
              },
            });
            const { touchCandidateActivity } = await import('./candidate-insight.service');
            await touchCandidateActivity(candidateId, CandidateActivityType.REMINDER_SENT, {
              actorAdminId: adminUserId,
              operationId,
              metadata: { templateId },
            });
          } catch (e) {
            failed += 1;
            const msg = e instanceof Error ? e.message : 'Send failed';
            const safeMsg = msg
              .replace(/pass(word)?[=:].*/gi, '[redacted]')
              .replace(/auth[=:].*/gi, '[redacted]')
              .slice(0, 300);
            await prisma.emailReminderDelivery.create({
              data: {
                operationId,
                candidateId,
                candidateReference: candidateReferenceFromId(candidateId),
                templateId,
                adminUserId,
                recipientEmail: c.user.email,
                subjectRendered: subject,
                status: ReminderDeliveryStatus.FAILED,
                errorCode: 'SMTP_ERROR',
                errorSummary: safeMsg,
              },
            });
            errors.push({ candidateId, code: 'SMTP_ERROR', message: 'Email delivery failed' });
          }
        })
      );
    }

    const status =
      failed === 0 && skipped === 0 ? 'SUCCEEDED' : succeeded === 0 ? 'FAILED' : 'PARTIAL';

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

    await writeAuditLog({
      adminUserId,
      action: 'REMINDER_SENT',
      entityType: 'candidate_bulk',
      entityId: operationId,
      metadata: { operationId, templateId, succeeded, failed, skipped, frontendUrl: config.frontendUrl },
    });

    return {
      operationId,
      summary: { requested: ids.length, succeeded, failed, skipped },
      errors,
    };
  }
}

export const reminderService = new ReminderService();
