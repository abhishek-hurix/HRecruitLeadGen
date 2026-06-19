import { api } from './client';

export async function loginWithPassword(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data as {
    success: boolean;
    token: string;
    candidate: { id: string; fullName: string; email: string };
  };
}

export async function loginWithGoogle(credential: string) {
  const { data } = await api.post('/auth/google', { credential });
  return data as {
    success: boolean;
    token: string;
    candidate: { id: string; fullName: string; email: string };
  };
}

export async function loginWithSupabase(accessToken: string) {
  const { data } = await api.post('/auth/supabase', { accessToken });
  return data as {
    success: boolean;
    token: string | null;
    requiresRegistration?: boolean;
    email?: string;
    candidate: { id: string; fullName: string; email: string } | null;
  };
}
