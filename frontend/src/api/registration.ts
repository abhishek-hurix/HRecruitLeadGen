import { api } from './client';

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
