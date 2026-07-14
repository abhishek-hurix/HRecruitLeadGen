import { Response } from 'express';
import { BulkOperationAction } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
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

/** Column template: header + Excel width (character units). */
export const EXPORT_COLUMN_TEMPLATE = [
  { header: 'Application ID', width: 14 },
  { header: 'Name', width: 24 },
  { header: 'Email', width: 34 },
  { header: 'Phone', width: 18 },
  { header: 'Country', width: 14 },
  { header: 'Experience', width: 14 },
  { header: 'Assigned Role', width: 24 },
  { header: 'Journey Status', width: 16 },
  { header: 'Assessment Status', width: 18 },
  { header: 'Score', width: 10 },
] as const;

export const EXPORT_HEADERS = EXPORT_COLUMN_TEMPLATE.map((c) => c.header);

type ExportRowModel = {
  applicationId: string;
  fullName: string;
  email: string;
  phone: string;
  phoneCountry: string | null;
  experienceLabel: string;
  assignedRole: string;
  journeyStatus: string;
  assessmentStatus: string;
  score: string;
};

function toCells(c: ExportRowModel): string[] {
  return [
    c.applicationId,
    c.fullName,
    c.email,
    c.phone,
    c.phoneCountry || '',
    c.experienceLabel,
    c.assignedRole,
    c.journeyStatus,
    c.assessmentStatus,
    c.score,
  ];
}

function toCsvRow(c: ExportRowModel): string[] {
  return toCells(c).map(sanitizeSpreadsheetCell);
}

async function loadExportRows(ids: string[]): Promise<ExportRowModel[]> {
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
      applicationId: (c.applicationId || c.id.slice(0, 8)).toUpperCase(),
      fullName: c.fullName,
      email: c.user.email,
      phone: c.fullPhone || c.phone,
      phoneCountry: c.phoneCountry,
      experienceLabel: getExperienceLabel(c.experienceCategory),
      assignedRole: c.selectedRoleName || c.appliedRole || '',
      journeyStatus: String(journey || '').replace(/_/g, ' '),
      assessmentStatus: String(c.assessmentStatus || '').replace(/_/g, ' '),
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
        const line = toCsvRow(row)
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',');
        params.res.write(`${line}\n`);
      }
      params.res.end();
      return;
    }

    // XLSX via exceljs — column widths from EXPORT_COLUMN_TEMPLATE
    params.res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    params.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: params.res,
      useStyles: true,
    });
    const sheet = workbook.addWorksheet('Candidates', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    EXPORT_COLUMN_TEMPLATE.forEach((col, index) => {
      sheet.getColumn(index + 1).width = col.width;
    });

    const headerRow = sheet.addRow([...EXPORT_HEADERS]);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.commit();

    for (const row of rows) {
      const values = toCells(row);
      const excelRow = sheet.addRow(values);
      excelRow.getCell(3).numFmt = '@';
      excelRow.getCell(4).numFmt = '@';
      excelRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
      excelRow.commit();
    }

    await workbook.commit();
  }
}

export const candidateExportService = new CandidateExportService();
