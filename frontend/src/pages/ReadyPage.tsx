import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, FileText, Loader2, ArrowRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MobileAssessmentBlocker } from '../components/assessment/MobileAssessmentBlocker';
import { isMobilePhone } from '../utils/device';
import { useAssessmentToken } from '../hooks/useAssessmentToken';
import { initSessionAuth, getReadyInfo } from '../api/assessment';
import { getApiErrorMessage, isLinkExpiredError } from '../utils/apiErrors';

export function ReadyPage() {
  const token = useAssessmentToken();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState('');
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasRoleSelected, setHasRoleSelected] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/expired');
      return;
    }
    initSessionAuth(token);
    getReadyInfo()
      .then((data) => {
        setCandidateName(data.candidateName);
        setHasCompleted(data.hasCompleted);
        setHasRoleSelected(data.hasRoleSelected);
        setQuestionCount(data.questionCount);
        setDurationMinutes(data.durationMinutes);
        if (data.hasInProgress && !data.hasCompleted) {
          navigate(`/assessment?token=${encodeURIComponent(token!)}`);
        } else if (data.hasRoleSelected && !data.hasCompleted) {
          navigate(`/assessment?token=${encodeURIComponent(token!)}`);
        }
      })
      .catch((err) => {
        if (isLinkExpiredError(err)) {
          navigate('/expired');
        } else {
          setError(getApiErrorMessage(err));
        }
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const handleContinue = () => {
    if (!token) return;
    navigate(`/select-role?token=${encodeURIComponent(token)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  if (isMobilePhone()) {
    return <MobileAssessmentBlocker />;
  }

  const instructions = [
    'Stable internet connection',
    'Do not refresh page',
    'Copy/Paste disabled',
    'One attempt only',
    'One position selection only — cannot be changed',
    'Assessment cannot be resumed after submission',
  ];

  if (hasCompleted) {
    return (
      <div className="min-h-screen bg-hurix-light">
        <Header showNav={false} />
        <main className="max-w-3xl mx-auto px-4 py-12">
          <div className="card-premium text-center">
            <h1 className="text-2xl font-bold text-hurix-charcoal mb-4">
              You have already completed this assessment.
            </h1>
            <p className="text-hurix-gray">Our team will reach out to you.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hurix-light">
      <Header showNav={false} />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="card-premium">
          <p className="text-hurix-blue font-semibold text-sm uppercase tracking-wide mb-2">
            Hurix Talent Assessment
          </p>
          <h1 className="text-3xl font-bold text-hurix-charcoal mb-2">
            Welcome, {candidateName}
          </h1>
          <p className="text-hurix-gray mb-8">
            You are ready to begin. Next, select the position you are applying for.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <FileText className="mx-auto text-hurix-blue mb-2" size={24} />
              <p className="text-xs text-hurix-gray">Questions</p>
              <p className="font-semibold">{questionCount}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <Clock className="mx-auto text-hurix-blue mb-2" size={24} />
              <p className="text-xs text-hurix-gray">Duration</p>
              <p className="font-semibold">{durationMinutes} Minutes</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-hurix-charcoal mb-3">Instructions</h3>
            <ul className="space-y-2">
              {instructions.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-hurix-gray">
                  <CheckCircle size={16} className="text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {!hasRoleSelected && (
            <button
              onClick={handleContinue}
              className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
            >
              Select Job Role
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
