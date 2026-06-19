import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { verifyEmailToken } from '../api/verifyEmail';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiErrors';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/expired', { replace: true });
      return;
    }

    verifyEmailToken(token)
      .then(() => {
        navigate('/email-verified-success', { replace: true });
      })
      .catch((err) => {
        const status = getApiErrorStatus(err);
        if (status === 401) {
          navigate('/expired', { replace: true });
          return;
        }
        setError(getApiErrorMessage(err, 'Unable to verify your email. Please try again.'));
      });
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
        <div className="card-premium max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/login" className="btn-primary inline-block">
            Go To Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hurix-light">
      <Loader2 className="animate-spin text-hurix-blue mb-4" size={40} />
      <p className="text-hurix-gray">Verifying your email...</p>
    </div>
  );
}
