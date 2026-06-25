import { api, setAdminToken, clearAdminToken } from './client';
import type { Candidate, DashboardMetrics } from '../types';
import type { AdminSession } from '../contexts/AdminAuthContext';

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
  role?: string;
  minScore?: number;
  candidateType?: 'real' | 'test' | 'all';
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get('/admin/candidates', { params });
  return data as {
    data: Candidate[];
    realCandidateCount: number;
    testCandidateCount: number;
    roleFilters: string[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
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

export async function exportCandidatesCSV(includeTestUsers = false) {
  const { data } = await api.get('/admin/candidates/export', {
    responseType: 'blob',
    params: includeTestUsers ? { includeTestUsers: 'true' } : undefined,
  });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'candidates.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function markCandidateTestUser(id: string) {
  const { data } = await api.post(`/admin/candidates/${id}/mark-test-user`);
  return data;
}

export async function unmarkCandidateTestUser(id: string) {
  const { data } = await api.post(`/admin/candidates/${id}/unmark-test-user`);
  return data;
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
