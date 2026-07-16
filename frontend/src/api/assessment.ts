import { api, setAuthToken } from './client';
import type { AssessmentSession, Language, TestResult } from '../types';

export function initSessionAuth(token: string) {
  setAuthToken(token);
}

export async function getReadyInfo() {
  const { data } = await api.get('/assessment/ready');
  return data as {
    candidateName: string;
    hasCompleted: boolean;
    hasInProgress: boolean;
    hasRoleSelected: boolean;
    selectedRoleName: string | null;
    questionCount: number;
    durationMinutes: number;
  };
}

export async function getJobRoles() {
  const { data } = await api.get('/assessment/job-roles');
  return data.data as Array<{
    id: string;
    title: string;
    country: string;
    compensation: string;
    skills: string[];
    description: string | null;
    openPositions: number;
  }>;
}

export async function selectRoleAndStart(jobRoleId: string) {
  const { data } = await api.post('/assessment/select-role', { jobRoleId });
  return data as AssessmentSession & { token?: string };
}

export async function startAssessment(language?: Language) {
  const { data } = await api.post('/assessment/start', language ? { language } : {});
  return data as AssessmentSession;
}

export async function getSession() {
  const { data } = await api.get('/assessment/session');
  return data as AssessmentSession;
}

export async function runCode(questionId: string, code: string) {
  const { data } = await api.post('/assessment/run', { questionId, code });
  return data as {
    results: TestResult[];
    passedCount: number;
    totalCount: number;
    executionTimeMs: number;
  };
}

export async function submitAssessment(answers: Array<{ questionId: string; code?: string; selectedOptionIndex?: number | null }>) {
  const { data } = await api.post('/assessment/submit', { answers });
  return data;
}

export async function getThankYouInfo() {
  const { data } = await api.get('/assessment/thank-you');
  return data;
}

// Backward-compatible aliases
export const initAssessmentAuth = initSessionAuth;
