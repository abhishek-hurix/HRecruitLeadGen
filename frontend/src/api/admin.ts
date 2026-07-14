import { api, setAdminToken, clearAdminToken } from './client';
import type { Candidate, DashboardMetrics } from '../types';
import type { AdminSession } from '../contexts/AdminAuthContext';
import type {
  BulkResult,
  ExportFormat,
  ExportScope,
  ReminderTemplate,
  WhatsAppTemplate,
  SelectionPayload,
  DeletedCandidateRow,
  PaginationMeta,
} from '../types/candidate-management';

export type {
  SelectionPayload,
  BulkResult,
  ReminderTemplate,
  WhatsAppTemplate,
  ExportScope,
  ExportFormat,
  DeletedCandidateRow,
  PaginationMeta,
};

export async function adminLogin(email: string, password: string) {
  const { data } = await api.post('/admin/login', { email, password });
  setAdminToken(data.token);
  return data as {
    success: boolean;
    token: string;
    admin: AdminSession;
  };
}

export function adminLogout() {
  clearAdminToken();
}

export async function getAdminMe() {
  const { data } = await api.get('/admin/me');
  return data as AdminSession & { success: boolean; lastLoginAt?: string };
}

export async function getDashboard(): Promise<DashboardMetrics> {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

export async function getCandidates(params: {
  search?: string;
  status?: string;
  experience?: string;
  country?: string;
  countryCodes?: string[];
  role?: string;
  roleAssignment?: string;
  registeredFrom?: string;
  registeredTo?: string;
  datePreset?: string;
  ownerId?: string;
  inactivityDays?: number;
  minScore?: number | 'na';
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  pageSize?: number;
  isTestUser?: boolean;
  creationSource?: 'ADMIN_CREATED' | 'SELF_REGISTERED';
}) {
  const { data } = await api.get('/admin/candidates', {
    params: {
      ...params,
      countryCodes: params.countryCodes?.length ? params.countryCodes.join(',') : undefined,
      pageSize: params.pageSize || params.limit,
      limit: params.pageSize || params.limit,
      isTestUser: params.isTestUser === undefined ? undefined : params.isTestUser ? 'true' : 'false',
    },
  });
  return data as {
    data: Candidate[];
    roleFilters: string[];
    pagination: {
      page: number;
      limit: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      sortBy?: string;
      sortOrder?: string;
    };
  };
}

export async function getAdminCountries() {
  const { data } = await api.get('/admin/countries');
  return data.data as Array<{ code: string; name: string }>;
}

export async function getCandidateOwners() {
  const { data } = await api.get('/admin/candidate-owners');
  return data.data as Array<{ id: string; email: string; role: string }>;
}

export async function assignCandidateOwner(candidateId: string, ownerAdminId: string | null) {
  const { data } = await api.patch(`/admin/candidates/${candidateId}/owner`, { ownerAdminId });
  return data as {
    success: boolean;
    data: {
      candidateId: string;
      owner: { id: string; email: string; role: string } | null;
      ownerAssignedAt?: string | null;
      previousOwnerId?: string | null;
    };
  };
}

export async function getScoreBreakdown(candidateId: string) {
  const { data } = await api.get(`/admin/candidates/${candidateId}/score-breakdown`);
  return data.data as import('../types/candidate-management').ScoreBreakdown;
}

export async function getCandidateActivity(candidateId: string) {
  const { data } = await api.get(`/admin/candidates/${candidateId}/activity`);
  return data.data as import('../types/candidate-management').CandidateActivityTimeline;
}

export async function globalAdminSearch(q: string) {
  const { data } = await api.get('/admin/search', { params: { q } });
  return data.data as import('../types/candidate-management').GlobalSearchResult;
}

export async function checkCandidateDuplicate(email: string) {
  const { data } = await api.get('/admin/candidates/duplicate-check', { params: { email } });
  return data.data as import('../types/candidate-management').DuplicateCheckResult;
}

export async function createManualCandidate(
  form: FormData,
  idempotencyKey: string
) {
  const { data } = await api.post('/admin/candidates', form, {
    headers: {
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data as import('../types/candidate-management').ManualCreateResult;
}

export async function bulkChangeStatus(selection: SelectionPayload, newStatus: string) {
  const { data } = await api.post('/admin/candidates/bulk/status', { selection, newStatus });
  return data as BulkResult;
}

export async function bulkReject(selection: SelectionPayload, reason: string) {
  const { data } = await api.post('/admin/candidates/bulk/reject', { selection, reason });
  return data as BulkResult;
}

export async function bulkShortlist(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/shortlist', { selection });
  return data as BulkResult;
}

export async function bulkAssignRole(selection: SelectionPayload, jobRoleId: string) {
  const { data } = await api.post('/admin/candidates/bulk/assign-role', { selection, jobRoleId });
  return data as BulkResult;
}

export async function bulkSoftDelete(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/delete', { selection });
  return data as BulkResult;
}

export async function bulkRestoreDeleted(selection: SelectionPayload) {
  const { data } = await api.post('/admin/deleted-candidates/bulk/restore', { selection });
  return data as BulkResult;
}

export async function bulkRestoreRejected(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/restore-rejected', { selection });
  return data as BulkResult;
}

export async function bulkRestoreShortlisted(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/restore-shortlisted', { selection });
  return data as BulkResult;
}

export async function bulkMarkTestUsers(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/mark-test-users', { selection });
  return data as BulkResult;
}

export async function bulkRemoveTestUsers(selection: SelectionPayload) {
  const { data } = await api.post('/admin/candidates/bulk/remove-test-users', { selection });
  return data as BulkResult;
}

export async function bulkPermanentDelete(selection: SelectionPayload) {
  const { data } = await api.post('/admin/deleted-candidates/bulk/permanent', { selection });
  return data as BulkResult;
}

export async function bulkSendReminders(selection: SelectionPayload, templateId: string, operationId?: string) {
  const { data } = await api.post('/admin/candidates/bulk/reminders', { selection, templateId, operationId });
  return data as BulkResult;
}

export async function scheduleInterview(payload: Record<string, unknown>) {
  const { data } = await api.post('/admin/candidates/bulk/schedule-interview', payload);
  return data as BulkResult;
}

export async function getReminderTemplates() {
  const { data } = await api.get('/admin/reminder-templates');
  return data.data as ReminderTemplate[];
}

export async function createReminderTemplate(payload: {
  name: string;
  subject: string;
  bodyHtml: string;
}) {
  const { data } = await api.post('/admin/reminder-templates', payload);
  return data.data as ReminderTemplate;
}

export async function updateReminderTemplate(
  id: string,
  payload: { name: string; subject: string; bodyHtml: string }
) {
  const { data } = await api.put(`/admin/reminder-templates/${id}`, payload);
  return data.data as ReminderTemplate;
}

export async function deleteReminderTemplate(id: string) {
  const { data } = await api.delete(`/admin/reminder-templates/${id}`);
  return data;
}

export async function previewReminderTemplate(templateId: string) {
  const { data } = await api.post('/admin/reminder-templates/preview', { templateId });
  return data.data as { subject: string; bodyHtml: string };
}

export async function getWhatsAppTemplates() {
  const { data } = await api.get('/admin/whatsapp-templates');
  return data.data as WhatsAppTemplate[];
}

export async function createWhatsAppTemplate(payload: { name: string; bodyText: string }) {
  const { data } = await api.post('/admin/whatsapp-templates', payload);
  return data.data as WhatsAppTemplate;
}

export async function updateWhatsAppTemplate(
  id: string,
  payload: { name: string; bodyText: string }
) {
  const { data } = await api.put(`/admin/whatsapp-templates/${id}`, payload);
  return data.data as WhatsAppTemplate;
}

export async function deleteWhatsAppTemplate(id: string) {
  const { data } = await api.delete(`/admin/whatsapp-templates/${id}`);
  return data;
}

export async function getCalendarStatus() {
  const { data } = await api.get('/admin/calendar/status');
  return data.data as { connected: boolean; googleEmail: string | null; mockMode: boolean };
}

export async function exportCandidatesAdvanced(payload: {
  scope: ExportScope;
  format: ExportFormat;
  selection?: SelectionPayload;
  filters?: Record<string, unknown>;
}) {
  try {
    const response = await api.post('/admin/candidates/export', payload, { responseType: 'blob' });
    const contentType = String(response.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      const text = await (response.data as Blob).text();
      const json = JSON.parse(text) as { message?: string; error?: string };
      throw Object.assign(new Error(json.message || json.error || 'Export failed'), {
        response: { status: response.status, data: json },
      });
    }
    const ext = payload.format;
    const date = new Date().toISOString().slice(0, 10);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidates-${payload.scope.toLowerCase()}-${date}.${ext}`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      try {
        const text = await data.text();
        const json = JSON.parse(text) as { message?: string; error?: string };
        throw Object.assign(new Error(json.message || json.error || 'Export failed'), {
          response: {
            status: (err as { response?: { status?: number } }).response?.status,
            data: json,
          },
        });
      } catch (parsed) {
        if (parsed !== err && (parsed as Error).message) throw parsed;
      }
    }
    throw err;
  }
}

export async function getDeletedCandidates(params: {
  search?: string;
  role?: string;
  registeredFrom?: string;
  registeredTo?: string;
  datePreset?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get('/admin/deleted-candidates', { params });
  return data as {
    success: boolean;
    data: DeletedCandidateRow[];
    meta: PaginationMeta;
  };
}

export async function restoreDeletedCandidate(candidateId: string) {
  const { data } = await api.post(`/admin/deleted-candidates/${candidateId}/restore`);
  return data;
}

export async function permanentlyDeleteCandidate(candidateId: string) {
  const { data } = await api.delete(`/admin/deleted-candidates/${candidateId}/permanent`);
  return data;
}

export async function getCandidateById(id: string) {
  const { data } = await api.get(`/admin/candidates/${id}`);
  return data;
}

export async function getSubmissionMarkdown(id: string) {
  const { data } = await api.get(`/admin/submissions/${id}/markdown`, { responseType: 'text' });
  return data as string;
}

export async function runSubmissionAiReview(id: string, roleApplied: string) {
  const { data } = await api.post(`/admin/submissions/${id}/ai-review`, { roleApplied });
  return data;
}

export async function downloadResume(id: string, filename: string) {
  const { data } = await api.get(`/admin/candidates/${id}/resume`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function getResumePreviewUrl(id: string) {
  const { data } = await api.get(`/admin/candidates/${id}/resume`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
}

export async function getCandidateResumePreviewUrl(candidateId: string, resumeId: string) {
  const { data } = await api.get(`/admin/candidates/${candidateId}/resumes/${resumeId}`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
}

export async function exportCandidatesCSV() {
  const { data } = await api.get('/admin/candidates/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'candidates.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function getQuestions(language?: string, page = 1, jobRoleId?: string) {
  const { data } = await api.get('/admin/questions', { params: { language, page, jobRoleId, limit: 50 } });
  return data as {
    data: Array<Record<string, unknown>>;
    roleFilters: Array<{ id: string; title: string }>;
    languageFilters: string[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

export async function createQuestion(question: Record<string, unknown>) {
  const { data } = await api.post('/admin/questions', question);
  return data;
}

export async function updateQuestion(id: string, question: Record<string, unknown>) {
  const { data } = await api.put(`/admin/questions/${id}`, question);
  return data;
}

export async function deleteQuestion(id: string) {
  const { data } = await api.delete(`/admin/questions/${id}`);
  return data;
}

export async function getAdmins() {
  const { data } = await api.get('/admin/users');
  return data as { data: Array<{ id: string; email: string; role: string; lastLoginAt: string | null }> };
}

export async function createAdmin(payload: { email: string; password: string; role: string }) {
  const { data } = await api.post('/admin/users', payload);
  return data;
}

export async function deleteAdmin(id: string) {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data;
}

export async function getSettings() {
  const { data } = await api.get('/admin/settings');
  return data as Record<string, string>;
}

export async function updateSettings(settings: Record<string, string | undefined>) {
  const { data } = await api.put('/admin/settings', settings);
  return data;
}

export async function getJobRoles() {
  const { data } = await api.get('/admin/job-roles');
  return data as { success: boolean; data: Array<{ id: string; title: string; status?: string }> };
}

export async function createJobRole(payload: Record<string, unknown>) {
  const { data } = await api.post('/admin/job-roles', payload);
  return data;
}

export async function updateJobRole(id: string, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/job-roles/${id}`, payload);
  return data;
}

export async function deleteJobRole(id: string) {
  const { data } = await api.delete(`/admin/job-roles/${id}`);
  return data;
}

export async function setJobRoleStatus(id: string, status: string) {
  const { data } = await api.patch(`/admin/job-roles/${id}/status`, { status });
  return data;
}

export async function generateJobRoleQuestions(id: string) {
  const { data } = await api.post(`/admin/job-roles/${id}/generate-questions`);
  return data as { success: boolean; createdCount: number };
}
