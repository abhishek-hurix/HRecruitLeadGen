import { listIsoCountries, parseCountryCodesParam, resolveCountryIso } from './country';
import { AppError } from './errors';
import type {
  CandidateFilterSnapshot,
  CandidateSortBy,
  CandidateSortOrder,
} from '../services/candidate-selection.service';

const SORT_BY_ALLOWLIST: CandidateSortBy[] = [
  'name',
  'score',
  'registeredAt',
  'experience',
  'country',
  'assessmentStatus',
  'assignedRole',
  'lastActivity',
];

const SORT_ORDER_ALLOWLIST: CandidateSortOrder[] = ['asc', 'desc'];
const INACTIVITY_MIN = 1;
const INACTIVITY_MAX = 365;
const ROLE_ASSIGNMENT_SPECIAL = new Set(['all', 'assigned', 'unassigned', 'na']);
const DATE_PRESETS = new Set(['today', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'custom']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidIsoCountryCodes(codes: string[]): string[] {
  const known = new Set(listIsoCountries().map((c) => c.code));
  const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  for (const code of normalized) {
    if (!/^[A-Z]{2}$/.test(code) || !known.has(code)) {
      throw new AppError(400, `Invalid country code: ${code}`);
    }
  }
  return normalized;
}

export function parseCandidateListQuery(query: Record<string, unknown>): CandidateFilterSnapshot & {
  page: number;
  pageSize: number;
} {
  const countryRaw = query.countryCodes ?? query.countryCode;
  let countryCodes = parseCountryCodesParam(countryRaw);
  if (countryCodes.length) {
    countryCodes = assertValidIsoCountryCodes(countryCodes);
  }

  const sortByRaw = query.sortBy ? String(query.sortBy) : null;
  const sortOrderRaw = query.sortOrder ? String(query.sortOrder).toLowerCase() : null;

  if (sortByRaw && !SORT_BY_ALLOWLIST.includes(sortByRaw as CandidateSortBy)) {
    throw new AppError(400, `Invalid sortBy. Allowed: ${SORT_BY_ALLOWLIST.join(', ')}`);
  }
  if (sortOrderRaw && !SORT_ORDER_ALLOWLIST.includes(sortOrderRaw as CandidateSortOrder)) {
    throw new AppError(400, 'Invalid sortOrder. Allowed: asc, desc');
  }
  if ((sortByRaw && !sortOrderRaw) || (!sortByRaw && sortOrderRaw)) {
    // Allow sortBy alone with default desc; sortOrder alone is invalid
    if (!sortByRaw && sortOrderRaw) {
      throw new AppError(400, 'sortOrder requires sortBy');
    }
  }

  const roleAssignment = query.roleAssignment != null ? String(query.roleAssignment) : null;
  if (
    roleAssignment &&
    !ROLE_ASSIGNMENT_SPECIAL.has(roleAssignment) &&
    !UUID_RE.test(roleAssignment)
  ) {
    throw new AppError(400, 'Invalid roleAssignment. Use all|assigned|unassigned|na|jobRoleId');
  }

  const datePreset = query.datePreset != null ? String(query.datePreset) : null;
  if (datePreset && !DATE_PRESETS.has(datePreset)) {
    throw new AppError(400, 'Invalid datePreset');
  }

  const registeredFrom = query.registeredFrom ? String(query.registeredFrom) : null;
  const registeredTo = query.registeredTo ? String(query.registeredTo) : null;
  if (registeredFrom && !/^\d{4}-\d{2}-\d{2}$/.test(registeredFrom)) {
    throw new AppError(400, 'registeredFrom must be YYYY-MM-DD');
  }
  if (registeredTo && !/^\d{4}-\d{2}-\d{2}$/.test(registeredTo)) {
    throw new AppError(400, 'registeredTo must be YYYY-MM-DD');
  }
  if (registeredFrom && registeredTo && registeredFrom > registeredTo) {
    throw new AppError(400, 'registeredFrom cannot be after registeredTo');
  }

  let inactivityDays: number | null = null;
  if (query.inactivityDays != null && query.inactivityDays !== '') {
    inactivityDays = Number(query.inactivityDays);
    if (
      !Number.isInteger(inactivityDays) ||
      inactivityDays < INACTIVITY_MIN ||
      inactivityDays > INACTIVITY_MAX
    ) {
      throw new AppError(
        400,
        `inactivityDays must be an integer between ${INACTIVITY_MIN} and ${INACTIVITY_MAX}`
      );
    }
  }

  const ownerId = query.ownerId != null ? String(query.ownerId) : null;
  if (ownerId && ownerId !== 'unassigned' && ownerId !== 'all' && !UUID_RE.test(ownerId)) {
    throw new AppError(400, 'Invalid ownerId');
  }

  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const rawSize = parseInt(String(query.pageSize || query.limit || '10'), 10) || 10;
  const pageSize = [5, 10, 20, 30, 50, 100].includes(rawSize) ? rawSize : 10;

  const minScoreRaw = query.minScore ?? query.score;
  const minScoreToken =
    minScoreRaw !== undefined && minScoreRaw !== '' && minScoreRaw != null
      ? String(minScoreRaw).trim().toLowerCase()
      : '';
  const noScore = minScoreToken === 'na' || minScoreToken === 'none';
  const minScore = !noScore && minScoreToken !== '' ? Number(minScoreToken) : undefined;

  return {
    search: query.search ? String(query.search) : undefined,
    status: query.status ? String(query.status) : undefined,
    experience: query.experience ? String(query.experience) : undefined,
    country: query.country && !countryCodes.length ? String(query.country) : undefined,
    countryCodes: countryCodes.length ? countryCodes : null,
    role: query.role ? String(query.role) : undefined,
    roleAssignment,
    registeredFrom,
    registeredTo,
    datePreset: datePreset as CandidateFilterSnapshot['datePreset'],
    ownerId,
    ownerFilter: ownerId,
    inactivityDays,
    minScore: !noScore && Number.isFinite(minScore) ? minScore : undefined,
    noScore: noScore || null,
    sortBy: (sortByRaw as CandidateSortBy) || null,
    sortOrder: (sortOrderRaw as CandidateSortOrder) || (sortByRaw ? 'desc' : null),
    isTestUser:
      query.isTestUser === true ||
      query.isTestUser === 'true' ||
      query.isTestUser === '1'
        ? true
        : query.isTestUser === false ||
            query.isTestUser === 'false' ||
            query.isTestUser === '0'
          ? false
          : null,
    creationSource: (() => {
      const raw = query.creationSource != null ? String(query.creationSource) : '';
      if (!raw) return null;
      if (raw === 'ADMIN_CREATED' || raw === 'SELF_REGISTERED') return raw;
      throw new AppError(400, 'Invalid creationSource. Use ADMIN_CREATED|SELF_REGISTERED');
    })(),
    page,
    pageSize,
  };
}

export function reportUnmappedCountryValue(raw: string): {
  raw: string;
  resolved: string | null;
} {
  return { raw, resolved: resolveCountryIso(raw) };
}
