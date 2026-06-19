import { api } from './client';

export async function verifyEmailToken(token: string): Promise<{
  candidateName: string;
  email: string;
}> {
  const { data } = await api.get('/verify-email', { params: { token } });
  return data;
}
