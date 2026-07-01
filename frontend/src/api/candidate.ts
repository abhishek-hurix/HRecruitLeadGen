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

export async function updateCandidatePhone(payload: {
  phoneCountryIso: string;
  phoneNumber: string;
}): Promise<{
  phone: string;
  phoneNumber: string;
  countryCode: string;
  phoneCountry: string;
}> {
  const { data } = await api.patch('/candidate/phone', payload);
  return data.data;
}

export async function resendVerificationEmail(): Promise<{ message: string }> {
  const { data } = await api.post('/candidate/resend-verification');
  return data;
}

export async function uploadCandidateResume(file: File) {
  const formData = new FormData();
  formData.append('resume', file);
  const { data } = await api.post('/candidate/resumes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as {
    id: string;
    fileName: string;
    isPrimary: boolean;
    uploadedAt: string;
  };
}

export async function setPrimaryCandidateResume(resumeId: string) {
  const { data } = await api.patch('/candidate/resumes/primary', { resumeId });
  return data.data as { resumeId: string };
}

export async function getCandidateResumePreviewUrl(resumeId: string) {
  const { data } = await api.get(`/candidate/resumes/${resumeId}`, { responseType: 'blob' });
  return window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
}

export async function deleteCandidateResume(resumeId: string) {
  const { data } = await api.delete(`/candidate/resumes/${resumeId}`);
  return data.data as { deletedResumeId: string; primaryResumeId: string | null };
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
