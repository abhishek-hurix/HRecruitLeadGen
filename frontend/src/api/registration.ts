import { api } from './client';

export interface ParsedResumeFields {
  fullName?: string;
  email?: string;
  phoneCountryIso?: string;
  phoneNumber?: string;
  linkedinUrl?: string;
  experienceCategory?: string;
}

export async function registerCandidate(formData: FormData) {
  const { data } = await api.post('/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as {
    success: boolean;
    candidateId: string;
    candidateName: string;
    email: string;
    message: string;
  };
}

export async function parseResume(file: File): Promise<ParsedResumeFields> {
  const formData = new FormData();
  formData.append('resume', file);
  const { data } = await api.post('/register/parse-resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as ParsedResumeFields;
}
