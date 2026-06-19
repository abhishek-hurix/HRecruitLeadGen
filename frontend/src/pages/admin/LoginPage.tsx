import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string })?.from || '/admin/dashboard';

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/admin/login', { email, password });
      login(data.token, data.admin);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
      <div className="card-premium w-full max-w-md">
        <img src="/hurix-logo.png" alt="Hurix" className="h-10 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-center text-hurix-charcoal mb-2">Admin Login</h1>
        <p className="text-center text-sm text-hurix-gray mb-6">Email and password only</p>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-hurix-gray mt-6">
          <Link to="/" className="text-hurix-blue hover:underline">Back to Home</Link>
        </p>
      </div>
    </div>
  );
}
