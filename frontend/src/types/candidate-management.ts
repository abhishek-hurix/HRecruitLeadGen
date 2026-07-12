/** Shared frontend types for Candidate Management (HP admin portal). */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type CountryOption = {
  code: string;
  name: string;
};

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

export type RoleAssignmentFilter = 'all' | 'assigned' | 'unassigned';

export type InactivityDays = 7 | 30 | 90;

export type CandidateOwner = {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | string;
};

export type OwnerAssignmentRequest = {
  ownerAdminId: string | null;
};

export type CandidateListFilters = {
  search: string;
  status: string;
  experience: string;
  country: string;
  countryCodes: string[];
  minScore: string;
  role: string;
  roleAssignment: RoleAssignmentFilter | string;
  registeredFrom: string;
  registeredTo: string;
  datePreset: string;
  ownerId: string;
  inactivityDays: '' | InactivityDays | string;
  sortBy: string;
  sortOrder: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type CandidateListResponse = {
  data: import('../types').Candidate[];
  roleFilters: string[];
  pagination: PaginationMeta & { limit?: number };
  meta: PaginationMeta & { sortBy?: string; sortOrder?: string };
};

export type ScoreQuestionResult = {
  number: number;
  questionId?: string;
  title?: string | null;
  awardedMarks: number;
  maximumMarks: number;
  answered: boolean;
  correct: boolean;
};

export type ScoreBreakdown = {
  candidateId: string;
  applicationId: string;
  fullName: string;
  email: string;
  assignedRole?: string | null;
  assessmentStatus?: string;
  assessmentName?: string | null;
  hasSubmission: boolean;
  aggregateOnly: boolean;
  status?: string;
  score?: number | null;
  totalScore?: number | null;
  maximumScore?: number;
  maxScore?: number;
  correctCount?: number | null;
  incorrectCount?: number | null;
  unansweredCount?: number | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  questionResults?: ScoreQuestionResult[];
  questions?: ScoreQuestionResult[];
  message?: string;
};

export type CandidateActivityType =
  | 'REGISTERED'
  | 'ASSESSMENT_SUBMITTED'
  | 'REMINDER_SENT'
  | 'STATUS_CHANGED'
  | 'ROLE_ASSIGNED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'OWNER_ASSIGNED'
  | string;

export type CandidateActivityEvent = {
  type: CandidateActivityType;
  at: string;
  summary: string;
  adminEmail?: string | null;
  operationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type CandidateActivityTimeline = {
  candidateId: string;
  applicationId?: string;
  lastActivityAt?: string | null;
  lastActivityType?: CandidateActivityType | null;
  events: CandidateActivityEvent[];
};

export type SelectionMode = 'IDS' | 'ALL_MATCHING';

export type SelectionPayload =
  | {
      mode: 'IDS';
      candidateIds: string[];
    }
  | {
      mode: 'ALL_MATCHING';
      filters: Record<string, unknown>;
      excludedCandidateIds: string[];
    };

export type CandidateSelectionState =
  | {
      mode: 'IDS';
      candidateIds: Set<string>;
    }
  | {
      mode: 'ALL_MATCHING';
      filterSnapshot: CandidateListFilters;
      excludedCandidateIds: Set<string>;
      totalMatching: number;
    };

export type BulkOperationSummary = {
  requested: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

export type BulkOperationError = {
  candidateId: string;
  code: string;
  message: string;
};

export type BulkResult = {
  success?: boolean;
  operationId: string;
  summary: BulkOperationSummary;
  errors: BulkOperationError[];
  failedCandidateIds?: string[];
  interviewId?: string;
  meetUrl?: string | null;
  calendarEventLinks?: string[];
  email?: { sent: number; failed: number; skipped: number };
};

export type ReminderTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

export type ExportScope = 'SELECTED' | 'FILTERED' | 'ALL_ACTIVE';
export type ExportFormat = 'csv' | 'xlsx';

export type InterviewScheduleMode = 'SINGLE' | 'GROUP' | 'SEQUENTIAL';

export type InterviewScheduleInput = {
  title: string;
  notes?: string;
  startUtc: string;
  timezone: string;
  durationMinutes: number;
  gapMinutes?: number;
  mode: InterviewScheduleMode;
  createMeet?: boolean;
  idempotencyKey: string;
  interviewerEmails?: string[];
  selection: SelectionPayload;
};

export type DeletedCandidateRow = {
  id: string;
  applicationId?: string;
  fullName: string;
  email: string;
  phone?: string;
  phoneCountry?: string;
  experienceLabel?: string;
  assignedRole?: string;
  appliedRole?: string;
  assessmentStatus?: string;
  score?: number | null;
  deletedAt?: string;
  deletedBy?: { id?: string; email?: string; name?: string } | null;
  deletedByAdmin?: { id?: string; email?: string; name?: string } | null;
};

export type ApiErrorWithRequestId = {
  success?: boolean;
  message?: string;
  code?: string;
  requestId?: string;
  errors?: string[];
};

export function filtersToBackendSnapshot(filters: CandidateListFilters): Record<string, unknown> {
  return {
    search: filters.search || undefined,
    status: filters.status || null,
    experience: filters.experience || null,
    country: filters.country || null,
    countryCodes: filters.countryCodes?.length ? filters.countryCodes : null,
    minScore: filters.minScore ? Number(filters.minScore) : null,
    role: filters.role !== 'all' ? filters.role : null,
    roleAssignment: filters.roleAssignment !== 'all' ? filters.roleAssignment : null,
    registeredFrom: filters.registeredFrom || null,
    registeredTo: filters.registeredTo || null,
    datePreset: filters.datePreset || null,
    ownerId: filters.ownerId || null,
    inactivityDays: filters.inactivityDays ? Number(filters.inactivityDays) : null,
    sortBy: filters.sortBy || null,
    sortOrder: filters.sortOrder || null,
  };
}

export function toSelectionPayload(state: CandidateSelectionState): SelectionPayload {
  if (state.mode === 'ALL_MATCHING') {
    return {
      mode: 'ALL_MATCHING',
      excludedCandidateIds: Array.from(state.excludedCandidateIds),
      filters: filtersToBackendSnapshot(state.filterSnapshot),
    };
  }
  return { mode: 'IDS', candidateIds: Array.from(state.candidateIds) };
}

export function singleCandidatePayload(id: string): SelectionPayload {
  return { mode: 'IDS', candidateIds: [id] };
}

export function getPageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to };
}

export function clampPage(page: number, pageSize: number, total: number): number {
  if (total <= 0) return 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}
