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
                onClick={() => handleSupabaseOAuth('google')}
                disabled={loading}
                className="btn-secondary w-full py-3"
              >
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleSupabaseOAuth('github')}
                disabled={loading}
                className="btn-secondary w-full py-3"
              >
                Continue with GitHub
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
