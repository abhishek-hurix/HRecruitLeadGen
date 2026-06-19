import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAssessmentToken } from '../hooks/useAssessmentToken';
import { verifyAssessmentToken } from '../api/verify';
import { getApiErrorStatus } from '../utils/apiErrors';

export function VerifyPage() {
  const token = useAssessmentToken();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/expired', { replace: true });
      return;
    }

    verifyAssessmentToken(token)
      .then((result) => {
        navigate(`/ready?token=${encodeURIComponent(result.token)}`, { replace: true });
      })
      .catch((err) => {
        const status = getApiErrorStatus(err);
        if (status === 401 || status === 403) {
          navigate('/expired', { replace: true });
          return;
        }
        setError('Unable to verify your assessment link. Please try again.');
      });
  }, [token, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
        <div className="card-premium max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/" className="btn-primary inline-block">Back To Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hurix-light">
      <Loader2 className="animate-spin text-hurix-blue mb-4" size={40} />
      <p className="text-hurix-gray">Verifying your assessment link...</p>
    </div>
  );
}
