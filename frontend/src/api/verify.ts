import { api } from './client';

export async function verifyAssessmentToken(token: string) {
  const { data } = await api.get('/verify', { params: { token } });
  return data as {
    success: boolean;
    token: string;
    candidateName: string;
    email: string;
  };
}
