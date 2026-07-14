import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

const CANDIDATE_PORTAL_URL = 'https://candidates.hurixsystems.com/';

const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    name: 'Assessment Reminder',
    bodyText: `Hello {{candidateName}},

This is a friendly reminder to complete your Hurix Talent assessment for {{assignedRole}}.

Current status: {{assessmentStatus}}

${CANDIDATE_PORTAL_URL}

Thank you,
Team Hurix Digital`,
  },
  {
    name: 'Application Follow-up',
    bodyText: `Hello {{candidateName}},

We are reviewing applications for {{assignedRole}}. Please ensure your profile is complete.

Application ID: {{applicationId}}

${CANDIDATE_PORTAL_URL}

Regards,
Team Hurix Digital`,
  },
];

function normalizeWhatsAppTemplateInput(input: { name?: string; bodyText?: string }) {
  const name = String(input.name || '').trim();
  const bodyText = String(input.bodyText || '').trim();
  if (!name) throw new AppError(400, 'Template name is required');
  if (!bodyText) throw new AppError(400, 'Message body is required');
  if (name.length > 120) throw new AppError(400, 'Template name is too long');
  if (bodyText.length > 4000) throw new AppError(400, 'Message body is too long');
  return { name, bodyText };
}

async function ensureDefaultTemplates(adminUserId: string) {
  for (const t of DEFAULT_WHATSAPP_TEMPLATES) {
    const existing = await prisma.whatsAppMessageTemplate.findFirst({
      where: { name: t.name, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) {
      await prisma.whatsAppMessageTemplate.create({
        data: { ...t, createdById: adminUserId, updatedById: adminUserId },
      });
      continue;
    }
    if (!existing.bodyText.includes(CANDIDATE_PORTAL_URL) || existing.bodyText.includes('{{companyName}}')) {
      await prisma.whatsAppMessageTemplate.update({
        where: { id: existing.id },
        data: { bodyText: t.bodyText, updatedById: adminUserId },
      });
    }
  }
}

export class WhatsAppTemplateService {
  async listTemplates(adminUserId: string) {
    await ensureDefaultTemplates(adminUserId);
    return prisma.whatsAppMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(adminUserId: string, input: { name: string; bodyText: string }) {
    const data = normalizeWhatsAppTemplateInput(input);
    return prisma.whatsAppMessageTemplate.create({
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
    input: { name: string; bodyText: string }
  ) {
    const existing = await prisma.whatsAppMessageTemplate.findUnique({ where: { id: templateId } });
    if (!existing || !existing.isActive) throw new AppError(404, 'Template not found');
    const data = normalizeWhatsAppTemplateInput(input);
    return prisma.whatsAppMessageTemplate.update({
      where: { id: templateId },
      data: {
        ...data,
        updatedById: adminUserId,
      },
    });
  }

  async deleteTemplate(templateId: string, adminUserId: string) {
    const existing = await prisma.whatsAppMessageTemplate.findUnique({ where: { id: templateId } });
    if (!existing || !existing.isActive) throw new AppError(404, 'Template not found');
    return prisma.whatsAppMessageTemplate.update({
      where: { id: templateId },
      data: { isActive: false, updatedById: adminUserId },
    });
  }
}

export const whatsappTemplateService = new WhatsAppTemplateService();
