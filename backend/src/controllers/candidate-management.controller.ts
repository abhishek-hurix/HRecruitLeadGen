import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { candidateBulkService } from '../services/candidate-bulk.service';
import { reminderService } from '../services/reminder.service';
import { whatsappTemplateService } from '../services/whatsapp-template.service';
import { candidateExportService } from '../services/candidate-export.service';
import { interviewService } from '../services/interview.service';
import { CandidateSelectionInput } from '../services/candidate-selection.service';
import { AppError } from '../utils/errors';

const selectionSchema = z.object({
  mode: z.enum(['IDS', 'ALL_MATCHING']),
  candidateIds: z.array(z.string().uuid()).optional(),
  excludedCandidateIds: z.array(z.string().uuid()).optional(),
  filters: z
    .object({
      search: z.string().optional(),
      journeyStatus: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      experience: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      countryCodes: z.array(z.string()).optional(),
      score: z.number().nullable().optional(),
      minScore: z.number().nullable().optional(),
      noScore: z.boolean().nullable().optional(),
      jobRoleId: z.string().nullable().optional(),
      role: z.string().nullable().optional(),
      roleAssignment: z.string().nullable().optional(),
      isTestUser: z.boolean().nullable().optional(),
      creationSource: z.string().nullable().optional(),
      registeredFrom: z.string().nullable().optional(),
      registeredTo: z.string().nullable().optional(),
      datePreset: z.string().nullable().optional(),
    })
    .optional(),
});

function parseSelection(body: unknown): CandidateSelectionInput {
  const parsed = selectionSchema.parse(body);
  return parsed as CandidateSelectionInput;
}

function requestMeta(req: AuthRequest) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
  };
}

export async function bulkChangeStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const newStatus = String(req.body.newStatus || req.body.status || '');
    const result = await candidateBulkService.changeStatus(
      selection,
      newStatus,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkReject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const reason = String(req.body.reason || '');
    const result = await candidateBulkService.reject(selection, reason, req.adminId!, requestMeta(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkAssignRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const jobRoleId = String(req.body.jobRoleId || '');
    if (!jobRoleId) throw new AppError(400, 'jobRoleId is required');
    const result = await candidateBulkService.assignRole(
      selection,
      jobRoleId,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkSoftDelete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const result = await candidateBulkService.softDelete(selection, req.adminId!, requestMeta(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkRestoreDeleted(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only Super Admins can restore deleted candidates');
    }
    const selection = parseSelection(req.body.selection || req.body);
    const result = await candidateBulkService.restoreBulk(selection, req.adminId!, requestMeta(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkRestoreRejected(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only Super Admins can restore rejected candidates');
    }
    const selection = parseSelection(req.body.selection || req.body);
    // Ensure ALL_MATCHING stays scoped to rejected profiles
    if (selection.mode === 'ALL_MATCHING') {
      selection.filters = { ...(selection.filters || {}), status: 'REJECTED', journeyStatus: 'REJECTED' };
    }
    const result = await candidateBulkService.restoreRejected(
      selection,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkShortlist(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const result = await candidateBulkService.shortlist(selection, req.adminId!, requestMeta(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkRestoreShortlisted(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only Super Admins can restore shortlisted candidates');
    }
    const selection = parseSelection(req.body.selection || req.body);
    if (selection.mode === 'ALL_MATCHING') {
      selection.filters = { ...(selection.filters || {}), status: 'SHORTLISTED', journeyStatus: 'SHORTLISTED' };
    }
    const result = await candidateBulkService.restoreShortlisted(
      selection,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkMarkTestUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const result = await candidateBulkService.markAsTestUsers(
      selection,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkRemoveTestUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only Super Admins can remove candidates from Test Users');
    }
    const selection = parseSelection(req.body.selection || req.body);
    if (selection.mode === 'ALL_MATCHING') {
      selection.filters = { ...(selection.filters || {}), isTestUser: true };
    }
    const result = await candidateBulkService.removeFromTestUsers(
      selection,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkPermanentDelete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const result = await candidateBulkService.permanentDeleteBulk(
      selection,
      req.adminId!,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkSendReminders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const templateId = String(req.body.templateId || '');
    if (!templateId) throw new AppError(400, 'templateId is required');
    const result = await reminderService.sendBulk(
      selection,
      templateId,
      req.adminId!,
      req.body.operationId,
      requestMeta(req)
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function listReminderTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reminderService.listTemplates(req.adminId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createReminderTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reminderService.createTemplate(req.adminId!, {
      name: String(req.body.name || ''),
      subject: String(req.body.subject || ''),
      bodyHtml: String(req.body.bodyHtml || ''),
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateReminderTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reminderService.updateTemplate(String(req.params.id), req.adminId!, {
      name: String(req.body.name || ''),
      subject: String(req.body.subject || ''),
      bodyHtml: String(req.body.bodyHtml || ''),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteReminderTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await reminderService.deleteTemplate(String(req.params.id), req.adminId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function previewReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const templateId = String(req.body.templateId || req.params.id);
    const sample = (req.body.sample || {}) as Record<string, string>;
    const data = await reminderService.preview(templateId, {
      candidateName: sample.candidateName || 'Jane Doe',
      candidateEmail: sample.candidateEmail || 'jane@example.com',
      applicationId: sample.applicationId || 'ABC12345',
      assignedRole: sample.assignedRole || 'Software Engineer',
      assessmentStatus: sample.assessmentStatus || 'NOT_STARTED',
      assessmentLink: sample.assessmentLink || '',
      companyName: sample.companyName || 'Hurix Digital',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listWhatsAppTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await whatsappTemplateService.listTemplates(req.adminId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createWhatsAppTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await whatsappTemplateService.createTemplate(req.adminId!, {
      name: String(req.body.name || ''),
      bodyText: String(req.body.bodyText || ''),
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateWhatsAppTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await whatsappTemplateService.updateTemplate(String(req.params.id), req.adminId!, {
      name: String(req.body.name || ''),
      bodyText: String(req.body.bodyText || ''),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteWhatsAppTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await whatsappTemplateService.deleteTemplate(String(req.params.id), req.adminId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function exportCandidates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scope = String(req.body.scope || 'FILTERED') as 'SELECTED' | 'FILTERED' | 'ALL_ACTIVE';
    const format = String(req.body.format || 'csv').toLowerCase() as 'csv' | 'xlsx';
    if (!['SELECTED', 'FILTERED', 'ALL_ACTIVE'].includes(scope)) {
      throw new AppError(400, 'Invalid export scope');
    }
    if (!['csv', 'xlsx'].includes(format)) {
      throw new AppError(400, 'format must be csv or xlsx');
    }
    const selection =
      scope === 'SELECTED' ? parseSelection(req.body.selection || req.body) : undefined;
    await candidateExportService.streamExport({
      scope,
      format,
      selection,
      filters: req.body.filters || selection?.filters,
      adminUserId: req.adminId!,
      res,
    });
  } catch (error) {
    next(error);
  }
}

export async function listDeletedCandidates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await candidateBulkService.listDeleted({
      search: req.query.search as string,
      role: req.query.role ? String(req.query.role) : undefined,
      registeredFrom: req.query.registeredFrom ? String(req.query.registeredFrom) : undefined,
      registeredTo: req.query.registeredTo ? String(req.query.registeredTo) : undefined,
      datePreset: req.query.datePreset ? String(req.query.datePreset) : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : 1,
      pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 10,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getDeletedCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await candidateBulkService.getDeletedById(String(req.params.candidateId));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function restoreCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new AppError(403, 'Only Super Admins can restore deleted candidates');
    }
    const result = await candidateBulkService.restore(String(req.params.candidateId), req.adminId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function permanentDeleteCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await candidateBulkService.permanentDelete(
      String(req.params.candidateId),
      req.adminId!
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function scheduleInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const selection = parseSelection(req.body.selection || req.body);
    const result = await interviewService.schedule(
      {
        selection,
        title: String(req.body.title || ''),
        notes: req.body.notes,
        startUtc: String(req.body.startUtc || ''),
        timezone: String(req.body.timezone || 'UTC'),
        durationMinutes: Number(req.body.durationMinutes || 30),
        gapMinutes: Number(req.body.gapMinutes || 0),
        mode: (req.body.mode || 'SINGLE') as 'SINGLE' | 'GROUP' | 'SEQUENTIAL',
        createMeet: req.body.createMeet !== false,
        idempotencyKey: String(req.body.idempotencyKey || ''),
        interviewerEmails: Array.isArray(req.body.interviewerEmails)
          ? req.body.interviewerEmails
          : undefined,
      },
      req.adminId!,
      req.adminEmail || '',
      requestMeta(req)
    );
    const created = Boolean(result.interviewId) && result.summary.succeeded > 0;
    res.status(created ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await interviewService.getCalendarStatus(req.adminId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateByIdWithRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { adminService } = await import('../services/admin.service');
    const candidate = await adminService.getCandidateById(
      String(req.params.id),
      req.adminRole as AdminRole
    );
    res.json(candidate);
  } catch (error) {
    next(error);
  }
}
