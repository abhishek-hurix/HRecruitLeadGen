import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { useAssessmentToken } from '../hooks/useAssessmentToken';
import { initSessionAuth, getThankYouInfo } from '../api/assessment';
import { getCandidateToken, setCandidateToken } from '../api/client';
import { formatDate } from '../utils/validation';
import { isLinkExpiredError, getApiErrorMessage } from '../utils/apiErrors';

export function ThankYouPage() {
  const token = useAssessmentToken();
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ candidateName: string; submittedAt: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redirectSeconds, setRedirectSeconds] = useState(8);

  const goToDashboard = () => {
    const candidateToken = getCandidateToken();
    if (candidateToken) {
      setCandidateToken(candidateToken);
      navigate('/portal/dashboard');
      return;
    }

    navigate('/login');
  };

  useEffect(() => {
    if (!token) {
      navigate('/expired');
      return;
    }
    initSessionAuth(token);
    getThankYouInfo()
      .then(setInfo)
      .catch((err) => {
        if (isLinkExpiredError(err)) {
          navigate('/expired');
        } else {
          setError(getApiErrorMessage(err));
        }
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  useEffect(() => {
    if (loading) return;

    const interval = window.setInterval(() => {
      setRedirectSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(interval);
          goToDashboard();
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-hurix-light">
      <Header showNav={false} />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card-premium max-w-lg text-center">
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-hurix-charcoal">
            Redirecting to candidate dashboard in {redirectSeconds} seconds
          </div>

          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-500" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-hurix-charcoal mb-2">
            Assessment Submitted Successfully
          </h1>
          <p className="text-hurix-gray mb-8">
            Thank you for completing the Hurix Talent Assessment.<br />
            Our team will reach out to you.
          </p>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-6 space-y-3 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-hurix-gray">Candidate</span>
              <span className="font-semibold">{info?.candidateName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-hurix-gray">Submitted</span>
              <span className="font-semibold">{info?.submittedAt ? formatDate(info.submittedAt) : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-hurix-gray">Status</span>
              <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                {info?.status}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={goToDashboard}
            className="mt-6 w-full rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white border border-black transition-colors hover:bg-white hover:text-black"
          >
            Go back to dashboard
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
