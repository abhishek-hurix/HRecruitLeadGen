import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, Clock, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAssessmentToken } from '../hooks/useAssessmentToken';
import { useTimer } from '../hooks/useTimer';
import { isMobilePhone } from '../utils/device';
import { MobileAssessmentBlocker } from '../components/assessment/MobileAssessmentBlocker';
import {
  initSessionAuth,
  getSession,
  submitAssessment,
} from '../api/assessment';
import { isLinkExpiredError, isNoSessionError, getApiErrorMessage } from '../utils/apiErrors';
import { GlassDialog } from '../components/ui/GlassDialog';
import type { AssessmentSession } from '../types';

export function AssessmentPage() {
  const token = useAssessmentToken();
  const navigate = useNavigate();
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const hasAutoSubmittedRef = useRef(false);
  const hasSeenActiveTimerRef = useRef(false);
  const isMobile = isMobilePhone();

  const handleExpire = useCallback(() => {
    setError('Time is up! Your assessment session has expired.');
  }, []);

  const { timeLeft, formatted, isLow, isExpired } = useTimer(session?.expiresAt || null, handleExpire);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      hasSeenActiveTimerRef.current = true;
    }
  }, [timeLeft]);

  useEffect(() => {
    if (!isExpired || !session || hasAutoSubmittedRef.current || !hasSeenActiveTimerRef.current) return;

    hasAutoSubmittedRef.current = true;
    setSubmitting(true);
    setShowSubmitConfirm(false);
    setError('Time is up. Submitting your assessment automatically...');

    const allAnswers = session.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIndex: answers[q.id] ?? null,
    }));

    submitAssessment(allAnswers)
      .then(() => {
        navigate(`/thank-you?token=${encodeURIComponent(token!)}`);
      })
      .catch((err) => {
        hasAutoSubmittedRef.current = false;
        setError(getApiErrorMessage(err, 'Auto submission failed'));
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [answers, isExpired, navigate, session, token]);

  useEffect(() => {
    if (!token) {
      navigate('/expired');
      return;
    }

    initSessionAuth(token);

    const init = async () => {
      try {
        const data = await getSession();
        setSession(data);
        const initial: Record<string, number | null> = {};
        data.questions.forEach((q) => {
          initial[q.id] = null;
        });
        setAnswers(initial);
        if (data.questions[0]) {
          setVisited({ [data.questions[0].id]: true });
        }
      } catch (err) {
        if (isNoSessionError(err)) {
          navigate(`/ready?token=${encodeURIComponent(token)}`);
          return;
        }
        if (isLinkExpiredError(err)) {
          navigate('/expired');
          return;
        }
        setError(getApiErrorMessage(err, 'Failed to load assessment session.'));
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, navigate]);

  const currentQuestion = session?.questions[currentIndex];

  const handleSubmit = async () => {
    if (!session) return;
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!session) return;

    const allAnswers = session.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIndex: answers[q.id] ?? null,
    }));

    setSubmitting(true);
    setError('');
    try {
      await submitAssessment(allAnswers);
      navigate(`/thank-you?token=${encodeURIComponent(token!)}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Submission failed'));
    } finally {
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    setError('');
    const nextIndex = Math.min(currentIndex + 1, (session?.questions.length || 1) - 1);
    const nextQuestion = session?.questions[nextIndex];
    if (nextQuestion) {
      setVisited((prev) => ({ ...prev, [nextQuestion.id]: true }));
    }
    setCurrentIndex(nextIndex);
  };

  const handlePrevious = () => {
    if (!currentQuestion) return;
    setError('');
    const previousIndex = Math.max(currentIndex - 1, 0);
    const previousQuestion = session?.questions[previousIndex];
    if (previousQuestion) {
      setVisited((prev) => ({ ...prev, [previousQuestion.id]: true }));
    }
    setCurrentIndex(previousIndex);
  };

  const goToQuestion = (index: number) => {
    const question = session?.questions[index];
    if (!question) return;
    setVisited((prev) => ({ ...prev, [question.id]: true }));
    setCurrentIndex(index);
  };

  const selectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
    setVisited((prev) => ({ ...prev, [currentQuestion.id]: true }));
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-white" size={40} />
      </div>
    );
  }

  if (isMobile) {
    return <MobileAssessmentBlocker />;
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
        <div className="card-premium max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(`/ready?token=${encodeURIComponent(token!)}`)}
            className="btn-primary"
          >
            Back to Ready Page
          </button>
        </div>
      </div>
    );
  }

  if (!session || !currentQuestion) return null;

  if (isExpired && !hasSeenActiveTimerRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
        <div className="card-premium max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="text-amber-600" size={34} />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-hurix-charcoal">Assessment Session Expired</h1>
          <p className="mb-8 text-hurix-gray">
            This assessment session is no longer active. Please login again or request a fresh assessment link to continue.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-primary px-8"
          >
            Login Again
          </button>
        </div>
      </div>
    );
  }

  const getQuestionButtonClass = (questionId: string, index: number) => {
    const isActive = index === currentIndex;
    const isAnswered = answers[questionId] !== null && answers[questionId] !== undefined;
    const isVisited = visited[questionId];

    let color = 'border-black/10 bg-white/80 text-slate-800 shadow-sm';
    if (isAnswered) color = 'border-green-600 bg-green-600 text-white shadow-green-500/20';
    else if (isVisited) color = 'border-red-600 bg-red-600 text-white shadow-red-500/20';

    return `${color} ${isActive ? 'ring-2 ring-black ring-offset-2 ring-offset-white' : ''}`;
  };

  const options = Array.isArray(currentQuestion.mcqOptions) ? currentQuestion.mcqOptions : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_10%_15%,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(148,163,184,0.22),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#e5e7eb_100%)] text-slate-950">
      <header className="shrink-0 border-b border-black/10 bg-white/70 px-5 py-3 shadow-sm backdrop-blur-xl">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <img src="/hurix-logo.png" alt="Hurix" className="h-8" />
            <span className="rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-sm font-semibold text-slate-900 shadow-sm">
            Question {currentIndex + 1} of {session.questions.length}
          </span>
        </div>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-base font-bold shadow-sm ${
            isLow ? 'border-red-200 bg-red-50 text-red-600' : 'border-black/10 bg-white/75 text-slate-950'
          }`}>
          <Clock size={20} />
          {formatted}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/20 text-red-300 px-4 py-2 text-sm text-center">{error}</div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden rounded-[2rem] border border-black/10 bg-white/58 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl lg:grid-cols-[minmax(0,1fr)_310px]">
          <main className="min-h-0 overflow-y-auto p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-5xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-full border border-black bg-black px-3 py-1 text-xs font-semibold text-white shadow-sm">
                MCQ {currentIndex + 1}
              </span>
                <span className="text-sm font-medium text-slate-500">{currentQuestion.topic}</span>
            </div>
              <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-950">{currentQuestion.title}</h1>
              <p className="mb-8 max-w-4xl whitespace-pre-wrap text-base leading-7 text-slate-700">{currentQuestion.description}</p>

              <div className="space-y-4">
              {options.map((option, index) => {
                const selected = answers[currentQuestion.id] === index;
                return (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    onClick={() => selectOption(index)}
                    disabled={isExpired}
                      className={`group flex w-full items-center rounded-2xl border px-5 py-4 text-left shadow-sm backdrop-blur transition-all ${
                      selected
                          ? 'border-black bg-black text-white shadow-xl shadow-black/15'
                          : 'border-black/10 bg-white/76 text-slate-800 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white'
                    }`}
                  >
                      <span className={`mr-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                        selected ? 'border-white/40 bg-white text-black' : 'border-black/15 bg-white text-slate-900 group-hover:border-black/30'
                      }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                      <span>{option}</span>
                  </button>
                );
              })}
              </div>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col border-t border-black/15 bg-white/34 p-5 backdrop-blur-xl lg:border-l lg:border-t-0">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Questions</p>
              <h2 className="mb-5 text-lg font-bold text-slate-950">Navigate Test</h2>
              <div className="grid grid-cols-5 gap-2">
              {session.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                    className={`h-11 rounded-xl border text-sm font-bold transition-all hover:-translate-y-0.5 ${getQuestionButtonClass(q.id, i)}`}
                >
                  {i + 1}
                </button>
              ))}
              </div>
            </div>

            <div className="mt-auto rounded-3xl border border-black/10 bg-white/66 p-4 shadow-xl shadow-slate-950/10 backdrop-blur-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Question Actions
            </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={isExpired || currentIndex === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-bold text-slate-950 transition-all hover:border-black/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <ArrowLeft size={15} />
                  Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={isExpired || currentIndex >= session.questions.length - 1}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-3 text-xs font-bold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Next
                <ArrowRight size={15} />
              </button>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || isExpired}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-black bg-black px-4 py-4 font-bold text-white shadow-xl shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Submit Test
            </button>
          </div>
          </aside>
        </div>
      </div>
      {showSubmitConfirm && (
        <GlassDialog
          title="Submit Assessment?"
          message="Are you sure you want to submit this assessment? This action cannot be undone."
          confirmLabel="Submit Test"
          cancelLabel="Cancel"
          isLoading={submitting}
          onConfirm={confirmSubmit}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}
    </div>
  );
}
