import { Response } from 'express';
import { BulkOperationAction } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { sanitizeSpreadsheetCell, writeAuditLog } from '../utils/admin-safety';
import { getExperienceLabel } from '../utils/experience';
import { assessmentTokenService } from './assessment-token.service';
import {
  CandidateSelectionInput,
  buildCandidateListWhere,
  resolveCandidateIds,
} from './candidate-selection.service';
import { activeCandidateWhere } from '../utils/candidate-scope';

export type ExportScope = 'SELECTED' | 'FILTERED' | 'ALL_ACTIVE';
export type ExportFormat = 'csv' | 'xlsx';

const EXPORT_HEADERS = [
  'Application ID',
  'Name',
  'Email',
  'Phone',
  'Country',
  'Experience',
  'Assigned Role',
  'Assessment Status',
  'Score',
];

function toRow(c: {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  phoneCountry: string | null;
  experienceLabel: string;
  assignedRole: string;
  assessmentStatus: string;
  score: string;
}) {
  return [
    c.id.slice(0, 8).toUpperCase(),
    c.fullName,
    c.email,
    c.phone,
    c.phoneCountry || '',
    c.experienceLabel,
    c.assignedRole,
    c.assessmentStatus,
    c.score,
  ].map(sanitizeSpreadsheetCell);
}

async function loadExportRows(ids: string[]) {
  const candidates = await prisma.candidateProfile.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: {
      user: true,
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
      assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return candidates.map((c) => {
    const journey = assessmentTokenService.resolveJourneyStatus({
      emailVerified: c.emailVerified,
      tokenStatus: c.assessmentTokens[0]?.status,
      tokenExpiresAt: c.assessmentTokens[0]?.expiresAt,
      hasSubmission: c.submissions.length > 0,
      assessmentInProgress: c.assessments[0]?.status === 'IN_PROGRESS',
      selectionStatus: c.selectionStatus,
    });
    return {
      id: c.id,
      fullName: c.fullName,
      email: c.user.email,
      phone: c.fullPhone || c.phone,
      phoneCountry: c.phoneCountry,
      experienceLabel: getExperienceLabel(c.experienceCategory),
      assignedRole: c.selectedRoleName || c.appliedRole || '',
      assessmentStatus: `${c.assessmentStatus} / ${journey}`,
      score: c.submissions[0] ? String(c.submissions[0].score) : '',
    };
  });
}

export class CandidateExportService {
  async resolveExportIds(params: {
    scope: ExportScope;
    selection?: CandidateSelectionInput;
    filters?: CandidateSelectionInput['filters'];
  }): Promise<string[]> {
    if (params.scope === 'SELECTED') {
      if (!params.selection) throw new AppError(400, 'Selection is required for selected export');
      const { ids } = await resolveCandidateIds(params.selection);
      return ids;
    }
    if (params.scope === 'FILTERED') {
      const where = buildCandidateListWhere(params.filters || {});
      const rows = await prisma.candidateProfile.findMany({
        where,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });
      return rows.map((r) => r.id);
    }
    // ALL_ACTIVE
    const rows = await prisma.candidateProfile.findMany({
      where: activeCandidateWhere(),
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    return rows.map((r) => r.id);
  }

  async streamExport(params: {
    scope: ExportScope;
    format: ExportFormat;
    selection?: CandidateSelectionInput;
    filters?: CandidateSelectionInput['filters'];
    adminUserId: string;
    res: Response;
  }) {
    const ids = await this.resolveExportIds(params);
    if (ids.length === 0) throw new AppError(404, 'No candidates to export');

    const rows = await loadExportRows(ids);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `candidates-${params.scope.toLowerCase()}-${dateStamp}.${params.format}`;

    const operationId = uuidv4();
    await prisma.adminBulkOperation.create({
      data: {
        operationId,
        action: BulkOperationAction.EXPORT,
        status: 'SUCCEEDED',
        adminUserId: params.adminUserId,
        selectionMode: params.selection?.mode || params.scope,
        filterSnapshot: (params.filters || params.selection?.filters || undefined) as object,
        requestedCount: ids.length,
        succeededCount: ids.length,
        completedAt: new Date(),
        metadata: { format: params.format, scope: params.scope },
      },
    });

    await writeAuditLog({
      adminUserId: params.adminUserId,
      action: 'CANDIDATES_EXPORTED',
      entityType: 'candidate_bulk',
      entityId: operationId,
      metadata: { scope: params.scope, format: params.format, count: ids.length },
    });

    if (params.format === 'csv') {
      params.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      params.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      params.res.write('\uFEFF');
      params.res.write(`${EXPORT_HEADERS.map((h) => `"${h}"`).join(',')}\n`);
      for (const row of rows) {
        const line = toRow(row)
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',');
        params.res.write(`${line}\n`);
      }
      params.res.end();
      return;
    }

    // XLSX via exceljs WorkbookWriter (memory-conscious)
    // Dynamic import to avoid hard failure if package not installed yet
    let ExcelJS: typeof import('exceljs');
    try {
      ExcelJS = await import('exceljs');
    } catch {
      throw new AppError(500, 'XLSX export requires the exceljs package. Please install it and retry.');
    }

    params.res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    params.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: params.res });
    const sheet = workbook.addWorksheet('Candidates');
    sheet.addRow(EXPORT_HEADERS).commit();
    for (const row of rows) {
      sheet.addRow(toRow(row)).commit();
    }
    await workbook.commit();
  }
}

export const candidateExportService = new CandidateExportService();
