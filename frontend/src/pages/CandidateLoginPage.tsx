import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { loginWithPassword, loginWithGoogle, loginWithSupabase } from '../api/auth';
import { getCandidateToken, setCandidateToken } from '../api/client';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiErrors';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function CandidateLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (getCandidateToken()) {
      navigate('/portal/dashboard', { replace: true });
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;
    const supabaseClient = supabase;

    supabaseClient.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) return;

      setLoading(true);
      setError('');
      try {
        const result = await loginWithSupabase(accessToken);
        if (result.requiresRegistration) {
          navigate(`/register?email=${encodeURIComponent(result.email || '')}`);
          return;
        }
        if (!result.token) {
          throw new Error('Candidate session was not returned.');
        }
        setCandidateToken(result.token);
        await supabaseClient.auth.signOut();
        navigate('/portal/dashboard');
      } catch (err) {
        await supabaseClient.auth.signOut();
        const status = getApiErrorStatus(err);
        if (status && [401, 403].includes(status)) return;
        setError(getApiErrorMessage(err, 'Supabase sign-in failed'));
      } finally {
        setLoading(false);
      }
    });
  }, [navigate]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let result;
      if (isSupabaseConfigured && supabase) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError || !data.session?.access_token) {
          throw new Error(signInError?.message || 'Supabase sign-in failed');
        }
        result = await loginWithSupabase(data.session.access_token);
        if (result.requiresRegistration) {
          navigate(`/register?email=${encodeURIComponent(result.email || email)}`);
          return;
        }
        if (!result.token) {
          throw new Error('Candidate session was not returned.');
        }
        await supabase.auth.signOut();
      } else {
        result = await loginWithPassword(email, password);
      }
      if (!result.token) {
        throw new Error('Candidate session was not returned.');
      }
      setCandidateToken(result.token);
      navigate('/portal/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseOAuth = async (provider: 'google' | 'github') => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    setError('');
    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      setCandidateToken(result.token);
      navigate('/portal/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-hurix-light">
      <Header showNav={false} />
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="card-premium w-full max-w-md">
          <h1 className="text-2xl font-bold text-hurix-charcoal mb-2">Candidate Login</h1>
          <p className="text-hurix-gray text-sm mb-8">
            Sign in to view your application status and assessment results.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isSupabaseConfigured ? (
            <div className="mb-6 space-y-3">
              <button
                type="button"
                onClick={() => handleSupabaseOAuth('github')}
                disabled={loading}
                className="flex w-full items-center overflow-hidden rounded-lg bg-[#24292f] text-left text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
              >
                <span className="flex h-10 w-12 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18A10.97 10.97 0 0 1 12 6.05c.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.16c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                  </svg>
                </span>
                <span className="flex-1 px-3 py-2.5 text-center text-sm font-semibold">
                  Sign in with GitHub
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSupabaseOAuth('google')}
                disabled={loading}
                className="flex w-full items-center overflow-hidden rounded-md bg-[#4f83e8] text-left text-white shadow-md shadow-slate-300/70 transition-opacity hover:opacity-95 disabled:opacity-60"
              >
                <span className="flex h-12 w-14 shrink-0 items-center justify-center bg-white">
                  <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
                    <path fill="#FFC107" d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.26 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.63-.39-3.92Z" />
                    <path fill="#FF3D00" d="m6.31 14.69 6.57 4.82C14.66 15.1 18.98 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.26 4 24 4 16.32 4 9.66 8.34 6.31 14.69Z" />
                    <path fill="#4CAF50" d="M24 44c5.16 0 9.86-1.97 13.41-5.19l-6.19-5.24C29.15 35.15 26.64 36 24 36c-5.2 0-9.61-3.31-11.28-7.93l-6.52 5.02C9.51 39.56 16.24 44 24 44Z" />
                    <path fill="#1976D2" d="M43.61 20.08H42V20H24v8h11.3a12.04 12.04 0 0 1-4.08 5.57l6.19 5.24C36.97 39.21 44 34 44 24c0-1.34-.14-2.63-.39-3.92Z" />
                  </svg>
                </span>
                <span className="flex-1 px-4 py-3 text-center text-lg font-medium">
                  Sign up with Google
                </span>
              </button>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-hurix-gray">or continue with email</span>
                </div>
              </div>
            </div>
          ) : googleClientId && (
            <div className="mb-6">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in was cancelled or failed.')}
                theme="outline"
                size="large"
                width="100%"
                text="signin_with"
              />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-hurix-gray">or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-hurix-gray mt-6">
            New candidate?{' '}
            <Link to="/register" className="text-hurix-blue font-medium hover:underline">
              Apply Now
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
