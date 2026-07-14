import { CandidateCreationSource, ExperienceCategory, Prisma, SelectionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { activeCandidateWhere, deletedCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { parseCountryCodesParam } from '../utils/country';
import {
  istInclusiveRangeToUtc,
  resolveDatePreset,
  getIstYmd,
  istStartOfDayUtc,
  type DatePreset,
} from '../utils/ist-dates';

export type CandidateSelectionMode = 'IDS' | 'ALL_MATCHING';

export type RoleAssignmentFilter = 'all' | 'assigned' | 'unassigned' | 'na' | string;

export type CandidateSortBy =
  | 'name'
  | 'score'
  | 'registeredAt'
  | 'experience'
  | 'country'
  | 'assessmentStatus'
  | 'assignedRole'
  | 'lastActivity';

export type CandidateSortOrder = 'asc' | 'desc';

export interface CandidateFilterSnapshot {
  search?: string;
  journeyStatus?: string | null;
  experience?: string | null;
  /** Legacy single free-text country (phoneCountry display name). Prefer countryCodes. */
  country?: string | null;
  /** ISO alpha-2 codes, multi-select. */
  countryCodes?: string[] | null;
  score?: number | null;
  minScore?: number | null;
  /** When true, only candidates with no scored submission (shows as — / blank). */
  noScore?: boolean | null;
  jobRoleId?: string | null;
  role?: string | null;
  /** all | assigned | unassigned | specific job role UUID */
  roleAssignment?: RoleAssignmentFilter | null;
  registeredFrom?: string | null;
  registeredTo?: string | null;
  datePreset?: DatePreset | null;
  ownerId?: string | null;
  /** unassigned | specific admin id */
  ownerFilter?: 'all' | 'unassigned' | string | null;
  /** 7 | 30 | 90 — lastActivityAt <= IST cutoff */
  inactivityDays?: number | null;
  status?: string | null;
  /** When true, only test-user profiles; when false/omit, exclude test users from main lists. */
  isTestUser?: boolean | null;
  /** SELF_REGISTERED | ADMIN_CREATED — when set, filter by CandidateProfile.creationSource */
  creationSource?: string | null;
  sortBy?: CandidateSortBy | null;
  sortOrder?: CandidateSortOrder | null;
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
  const countryCodes = parseCountryCodesParam(filters.countryCodes);
  return {
    search: filters.search?.trim() || undefined,
    journeyStatus: filters.journeyStatus ?? filters.status ?? null,
    status: filters.status ?? filters.journeyStatus ?? null,
    experience: filters.experience || null,
    country: filters.country?.trim() || null,
    countryCodes: countryCodes.length ? countryCodes : null,
    score: filters.score ?? null,
    minScore: filters.minScore ?? filters.score ?? null,
    noScore: filters.noScore ?? null,
    jobRoleId: filters.jobRoleId || filters.role || null,
    role: filters.role || filters.jobRoleId || null,
    roleAssignment: filters.roleAssignment || null,
    registeredFrom: filters.registeredFrom || null,
    registeredTo: filters.registeredTo || null,
    datePreset: filters.datePreset || null,
    ownerId: filters.ownerId || null,
    ownerFilter: filters.ownerFilter || filters.ownerId || null,
    inactivityDays: filters.inactivityDays ?? null,
    isTestUser: filters.isTestUser ?? null,
    creationSource: filters.creationSource || null,
    sortBy: filters.sortBy || null,
    sortOrder: filters.sortOrder || null,
  };
}

function applyRegisteredDateFilter(
  parts: Prisma.CandidateProfileWhereInput[],
  filters: CandidateFilterSnapshot
) {
  let fromYmd = filters.registeredFrom || undefined;
  let toYmd = filters.registeredTo || undefined;

  if (filters.datePreset && filters.datePreset !== 'custom') {
    const resolved = resolveDatePreset(filters.datePreset);
    if (resolved) {
      fromYmd = resolved.fromYmd;
      toYmd = resolved.toYmd;
    }
  }

  if (!fromYmd && !toYmd) return;

  if (fromYmd && !toYmd) toYmd = fromYmd;
  if (!fromYmd && toYmd) fromYmd = toYmd;

  try {
    const { fromUtc, toExclusiveUtc } = istInclusiveRangeToUtc(fromYmd!, toYmd!);
    parts.push({
      createdAt: {
        gte: fromUtc,
        lt: toExclusiveUtc,
      },
    });
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : 'Invalid registered date range');
  }
}

export function buildCandidateListWhere(
  filters: CandidateFilterSnapshot = {},
  options: { includeDeleted?: boolean } = {}
): Prisma.CandidateProfileWhereInput {
  const parts: Prisma.CandidateProfileWhereInput[] = [];

  if (!options.includeDeleted) {
    parts.push(activeCandidateWhere());
  }

  if (filters.isTestUser === true) {
    parts.push({ isTestUser: true });
  } else {
    parts.push({ isTestUser: false });
  }

  if (filters.creationSource === 'ADMIN_CREATED') {
    parts.push({ creationSource: CandidateCreationSource.ADMIN_CREATED });
  } else if (filters.creationSource === 'SELF_REGISTERED') {
    parts.push({ creationSource: CandidateCreationSource.SELF_REGISTERED });
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

  const countryCodes = filters.countryCodes?.length
    ? filters.countryCodes.map((c) => c.toUpperCase())
    : parseCountryCodesParam(filters.countryCodes);
  if (countryCodes.length > 0) {
    parts.push({ phoneCountryIso: { in: countryCodes } });
  } else if (filters.country?.trim()) {
    parts.push({ phoneCountry: { equals: filters.country.trim(), mode: 'insensitive' } });
  }

  const roleAssignment = filters.roleAssignment;
  if (roleAssignment === 'assigned') {
    parts.push({ selectedRoleId: { not: null } });
  } else if (roleAssignment === 'unassigned' || roleAssignment === 'na') {
    parts.push({ selectedRoleId: null });
  } else {
    const roleId =
      filters.jobRoleId ||
      filters.role ||
      (roleAssignment && roleAssignment !== 'all' ? roleAssignment : null);
    if (roleId && roleId !== 'all') {
      parts.push({
        OR: [
          { selectedRoleId: roleId },
          { assessments: { some: { jobRoleId: roleId } } },
          { submissions: { some: { assessment: { jobRoleId: roleId } } } },
        ],
      });
    }
  }

  if (filters.noScore) {
    // No submission score yet — shown as "—" / blank in the UI.
    parts.push({ submissions: { none: {} } });
  } else {
    const minScore = filters.minScore ?? filters.score;
    if (typeof minScore === 'number' && Number.isFinite(minScore)) {
      parts.push({ submissions: { some: { score: { gte: minScore } } } });
    }
  }

  const status = filters.journeyStatus || filters.status;
  // Rejected / Shortlisted belong on their own pages — keep them out of the main list
  // (and any non-status-specific filters / bulk ALL_MATCHING selections).
  // Test Users page may include rejected/shortlisted test accounts.
  if (status === 'REJECTED') {
    parts.push({ selectionStatus: SelectionStatus.REJECTED });
  } else if (status === 'SHORTLISTED') {
    parts.push({ selectionStatus: SelectionStatus.SHORTLISTED });
  } else if (filters.isTestUser === true) {
    // no selection-status restriction for the dedicated test-users view
    if (status) {
      if (status.startsWith('ASSESSMENT_')) {
        const assessmentStatus = status.replace(
          'ASSESSMENT_',
          ''
        ) as Prisma.EnumCandidateAssessmentStatusFilter['equals'];
        parts.push({ assessmentStatus });
      } else if (
        ['REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED'].includes(status)
      ) {
        parts.push({ candidateStatus: status as Prisma.EnumCandidateStatusFilter['equals'] });
      }
    }
  } else {
    parts.push({
      selectionStatus: { notIn: [SelectionStatus.REJECTED, SelectionStatus.SHORTLISTED] },
    });
    if (status) {
      if (status.startsWith('ASSESSMENT_')) {
        const assessmentStatus = status.replace(
          'ASSESSMENT_',
          ''
        ) as Prisma.EnumCandidateAssessmentStatusFilter['equals'];
        parts.push({ assessmentStatus });
      } else if (
        ['REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED'].includes(status)
      ) {
        parts.push({ candidateStatus: status as Prisma.EnumCandidateStatusFilter['equals'] });
      }
    }
  }

  applyRegisteredDateFilter(parts, filters);

  const ownerFilter = filters.ownerFilter || filters.ownerId;
  if (ownerFilter === 'unassigned') {
    parts.push({ ownerAdminId: null });
  } else if (ownerFilter && ownerFilter !== 'all') {
    parts.push({ ownerAdminId: ownerFilter });
  }

  if (
    filters.inactivityDays &&
    Number.isInteger(filters.inactivityDays) &&
    filters.inactivityDays >= 1 &&
    filters.inactivityDays <= 365
  ) {
    const { y, m, d } = getIstYmd();
    const cutoffDay = new Date(Date.UTC(y, m, d - filters.inactivityDays));
    const cutoff = istStartOfDayUtc(
      cutoffDay.getUTCFullYear(),
      cutoffDay.getUTCMonth(),
      cutoffDay.getUTCDate()
    );
    parts.push({
      OR: [
        { lastActivityAt: { lte: cutoff } },
        { lastActivityAt: null, createdAt: { lte: cutoff } },
      ],
    });
  }

  return mergeCandidateWhere(...parts);
}

export function buildCandidateListOrderBy(
  sortBy?: CandidateSortBy | null,
  sortOrder?: CandidateSortOrder | null
): Prisma.CandidateProfileOrderByWithRelationInput[] {
  const dir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  const nulls: Prisma.NullsOrder = 'last';

  if (!sortBy || !sortOrder) {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  const secondary: Prisma.CandidateProfileOrderByWithRelationInput = { id: 'desc' };

  switch (sortBy) {
    case 'name':
      return [{ fullName: dir }, secondary];
    case 'score':
      return [{ latestScore: { sort: dir, nulls } }, secondary];
    case 'registeredAt':
      return [{ createdAt: dir }, secondary];
    case 'experience':
      return [{ yearsOfExperience: { sort: dir, nulls } }, secondary];
    case 'country':
      return [{ phoneCountryIso: { sort: dir, nulls } }, { phoneCountry: dir }, secondary];
    case 'assessmentStatus':
      return [{ assessmentStatus: dir }, secondary];
    case 'assignedRole':
      return [{ selectedRoleName: { sort: dir, nulls } }, secondary];
    case 'lastActivity':
      return [{ lastActivityAt: { sort: dir, nulls } }, secondary];
    default:
      throw new AppError(400, 'Invalid sortBy');
  }
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

/** Resolve IDs among soft-deleted candidates only (Deleted Candidates page). */
export function buildDeletedCandidateListWhere(
  filters: CandidateFilterSnapshot = {}
): Prisma.CandidateProfileWhereInput {
  const parts: Prisma.CandidateProfileWhereInput[] = [deletedCandidateWhere()];

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

  const roleId =
    filters.jobRoleId ||
    filters.role ||
    (filters.roleAssignment &&
    filters.roleAssignment !== 'all' &&
    filters.roleAssignment !== 'assigned' &&
    filters.roleAssignment !== 'unassigned' &&
    filters.roleAssignment !== 'na'
      ? filters.roleAssignment
      : null);
  if (roleId && roleId !== 'all') {
    parts.push({
      OR: [
        { selectedRoleId: roleId },
        { assessments: { some: { jobRoleId: roleId } } },
        { submissions: { some: { assessment: { jobRoleId: roleId } } } },
      ],
    });
  }

  applyRegisteredDateFilter(parts, filters);

  return mergeCandidateWhere(...parts);
}

export async function resolveDeletedCandidateIds(
  selection: CandidateSelectionInput,
  options: { maxIds?: number } = {}
): Promise<{
  ids: string[];
  count: number;
  filterSnapshot: CandidateFilterSnapshot | null;
}> {
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
      where: mergeCandidateWhere(deletedCandidateWhere(), { id: { in: unique } }),
      select: { id: true },
    });
    if (rows.length === 0) {
      throw new AppError(400, 'No candidates selected');
    }
    return { ids: rows.map((r) => r.id), count: rows.length, filterSnapshot: null };
  }

  const filterSnapshot = normalizeFilterSnapshot(selection.filters || {});
  const where = buildDeletedCandidateListWhere(filterSnapshot);

  const excluded = new Set(selection.excludedCandidateIds || []);
  const rows = await prisma.candidateProfile.findMany({
    where,
    select: { id: true },
    orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
    take: maxIds + 1,
  });
  const ids = rows.map((r) => r.id).filter((id) => !excluded.has(id));
  if (ids.length === 0) {
    throw new AppError(400, 'No candidates match the current filters');
  }
  if (ids.length > maxIds) {
    throw new AppError(400, `Selection exceeds maximum of ${maxIds} candidates`);
  }

  return {
    ids,
    count: ids.length,
    filterSnapshot,
  };
}
