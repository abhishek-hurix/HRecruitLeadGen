import { ExperienceCategory, Prisma, SelectionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { activeCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';

export type CandidateSelectionMode = 'IDS' | 'ALL_MATCHING';

export interface CandidateFilterSnapshot {
  search?: string;
  journeyStatus?: string | null;
  experience?: string | null;
  /** Free-text country (phoneCountry display name), matching existing HP. */
  country?: string | null;
  score?: number | null;
  minScore?: number | null;
  jobRoleId?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface CandidateSelectionInput {
  mode: CandidateSelectionMode;
  candidateIds?: string[];
  filters?: CandidateFilterSnapshot;
  excludedCandidateIds?: string[];
}

const DEFAULT_MAX_IDS = Number(process.env.BULK_OPERATION_MAX_CANDIDATES || 5000);
const CHUNK_SIZE = 500;

export function normalizeFilterSnapshot(filters: CandidateFilterSnapshot = {}): CandidateFilterSnapshot {
  return {
    search: filters.search?.trim() || undefined,
    journeyStatus: filters.journeyStatus ?? filters.status ?? null,
    status: filters.status ?? filters.journeyStatus ?? null,
    experience: filters.experience || null,
    country: filters.country?.trim() || null,
    score: filters.score ?? null,
    minScore: filters.minScore ?? filters.score ?? null,
    jobRoleId: filters.jobRoleId || filters.role || null,
    role: filters.role || filters.jobRoleId || null,
  };
}

export function buildCandidateListWhere(
  filters: CandidateFilterSnapshot = {},
  options: { includeDeleted?: boolean } = {}
): Prisma.CandidateProfileWhereInput {
  const parts: Prisma.CandidateProfileWhereInput[] = [];

  if (!options.includeDeleted) {
    parts.push(activeCandidateWhere());
  }

  const search = filters.search?.trim();
  if (search) {
    if (search.length > 200) {
      throw new AppError(400, 'Search query is too long');
    }
    parts.push({
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  if (filters.experience) {
    parts.push({ experienceCategory: filters.experience as ExperienceCategory });
  }

  if (filters.country?.trim()) {
    parts.push({ phoneCountry: { equals: filters.country.trim(), mode: 'insensitive' } });
  }

  const roleId = filters.jobRoleId || filters.role;
  if (roleId && roleId !== 'all') {
    parts.push({
      OR: [
        { selectedRoleId: roleId },
        { assessments: { some: { jobRoleId: roleId } } },
        { submissions: { some: { assessment: { jobRoleId: roleId } } } },
      ],
    });
  }

  const minScore = filters.minScore ?? filters.score;
  if (typeof minScore === 'number' && Number.isFinite(minScore)) {
    parts.push({ submissions: { some: { score: { gte: minScore } } } });
  }

  const status = filters.journeyStatus || filters.status;
  if (status) {
    if (status.startsWith('ASSESSMENT_')) {
      const assessmentStatus = status.replace(
        'ASSESSMENT_',
        ''
      ) as Prisma.EnumCandidateAssessmentStatusFilter['equals'];
      parts.push({ assessmentStatus });
    } else if (status === 'REJECTED') {
      parts.push({ selectionStatus: SelectionStatus.REJECTED });
    } else if (['REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED'].includes(status)) {
      parts.push({ candidateStatus: status as Prisma.EnumCandidateStatusFilter['equals'] });
    }
  }

  return mergeCandidateWhere(...parts);
}

/**
 * Chunked iteration over matching candidate IDs (id + createdAt cursor).
 * Yields batches without loading full candidate rows.
 */
export async function* iterateCandidateIds(
  selection: CandidateSelectionInput,
  options: { maxIds?: number } = {}
): AsyncGenerator<string[]> {
  const maxIds = options.maxIds ?? DEFAULT_MAX_IDS;

  if (selection.mode === 'IDS') {
    const unique = [...new Set((selection.candidateIds || []).filter(Boolean))];
    if (unique.length === 0) {
      throw new AppError(400, 'No candidates selected');
    }
    if (unique.length > maxIds) {
      throw new AppError(400, `Selection exceeds maximum of ${maxIds} candidates`);
    }
    const rows = await prisma.candidateProfile.findMany({
      where: mergeCandidateWhere(activeCandidateWhere(), { id: { in: unique } }),
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      throw new AppError(400, 'No candidates selected');
    }
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      yield ids.slice(i, i + CHUNK_SIZE);
    }
    return;
  }

  const where = buildCandidateListWhere(normalizeFilterSnapshot(selection.filters || {}));
  const excluded = new Set(selection.excludedCandidateIds || []);
  let cursor: { id: string; createdAt: Date } | undefined;
  let yielded = 0;

  while (true) {
    const batch = await prisma.candidateProfile.findMany({
      where: cursor
        ? mergeCandidateWhere(where, {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          })
        : where,
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: CHUNK_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((r) => r.id).filter((id) => !excluded.has(id));
    if (ids.length) {
      yielded += ids.length;
      if (yielded > maxIds) {
        throw new AppError(400, `Selection exceeds maximum of ${maxIds} candidates`);
      }
      yield ids;
    }

    const last = batch[batch.length - 1];
    cursor = { id: last.id, createdAt: last.createdAt };
    if (batch.length < CHUNK_SIZE) break;
  }

  if (yielded === 0) {
    throw new AppError(400, 'No candidates match the current filters');
  }
}

export async function resolveCandidateIds(
  selection: CandidateSelectionInput,
  options: { maxIds?: number } = {}
): Promise<{
  ids: string[];
  count: number;
  filterSnapshot: CandidateFilterSnapshot | null;
}> {
  const all: string[] = [];
  for await (const chunk of iterateCandidateIds(selection, options)) {
    all.push(...chunk);
  }
  return {
    ids: all,
    count: all.length,
    filterSnapshot:
      selection.mode === 'ALL_MATCHING'
        ? normalizeFilterSnapshot(selection.filters || {})
        : null,
  };
}
