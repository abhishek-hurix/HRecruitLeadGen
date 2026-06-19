import { api } from './client';
import type { CandidateDashboard } from '../types';

export async function getCandidateDashboard(): Promise<CandidateDashboard> {
  const { data } = await api.get('/candidate/dashboard');
  return data;
}

export async function getAssessmentAccessToken(): Promise<{ token: string }> {
  const { data } = await api.get('/candidate/assessment-token');
  return data;
}

export async function getCandidateJobRoles() {
  const { data } = await api.get('/candidate/job-roles');
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

export async function resendVerificationEmail(): Promise<{ message: string }> {
  const { data } = await api.post('/candidate/resend-verification');
  return data;
}

export async function getVerificationStatus(): Promise<{
  emailVerified: boolean;
  verifiedAt: string | null;
  verificationSentAt: string | null;
  resendsRemaining: number;
  canResend: boolean;
}> {
  const { data } = await api.get('/candidate/verification-status');
  return data.data;
}
