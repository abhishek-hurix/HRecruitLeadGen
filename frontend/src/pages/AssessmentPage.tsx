import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, Clock } from 'lucide-react';
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
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const isMobile = isMobilePhone();

  const handleExpire = useCallback(() => {
    setError('Time is up! Your assessment session has expired.');
  }, []);

  const { formatted, isLow, isExpired } = useTimer(session?.expiresAt || null, handleExpire);

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
    setMarkedForReview((prev) => ({ ...prev, [currentQuestion.id]: false }));
    setError('');
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    setVisited((prev) => ({ ...prev, [currentQuestion.id]: true }));
    setMarkedForReview((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
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

  const getQuestionButtonClass = (questionId: string, index: number) => {
    const isActive = index === currentIndex;
    const isAnswered = answers[questionId] !== null && answers[questionId] !== undefined;
    const isVisited = visited[questionId];
    const isReview = markedForReview[questionId];

    let color = 'bg-white text-slate-700 border border-slate-200';
    if (isReview) color = 'bg-violet-600 text-white';
    else if (isAnswered) color = 'bg-green-600 text-white';
    else if (isVisited) color = 'bg-red-600 text-white';

    return `${color} ${isActive ? 'ring-2 ring-hurix-blue ring-offset-2' : ''}`;
  };

  const options = Array.isArray(currentQuestion.mcqOptions) ? currentQuestion.mcqOptions : [];

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <img src="/hurix-logo.png" alt="Hurix" className="h-8 brightness-0 invert" />
          <span className="text-white text-sm font-medium">
            Question {currentIndex + 1} of {session.questions.length}
          </span>
        </div>
        <div className={`flex items-center gap-2 font-mono text-lg font-bold ${isLow ? 'text-red-400' : 'text-white'}`}>
          <Clock size={20} />
          {formatted}
        </div>
      </header>

      {error && (
        <div className="bg-red-500/20 text-red-300 px-4 py-2 text-sm text-center">{error}</div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[7fr_3fr] overflow-hidden min-h-0">
        <div className="bg-white overflow-y-auto p-8">
          <div className="max-w-4xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-hurix-blue px-3 py-1 text-xs font-semibold text-white">
                MCQ {currentIndex + 1}
              </span>
              <span className="text-sm text-hurix-gray">{currentQuestion.topic}</span>
            </div>
            <h1 className="mb-4 text-2xl font-bold text-hurix-charcoal">{currentQuestion.title}</h1>
            <p className="mb-8 whitespace-pre-wrap text-base leading-7 text-slate-700">{currentQuestion.description}</p>

            <div className="space-y-4">
              {options.map((option, index) => {
                const selected = answers[currentQuestion.id] === index;
                return (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    onClick={() => selectOption(index)}
                    disabled={isExpired}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-hurix-blue bg-hurix-blue/10 text-hurix-charcoal'
                        : 'border-slate-200 bg-white hover:border-hurix-blue/50 hover:bg-slate-50'
                    }`}
                  >
                    <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 border-l border-slate-700 bg-slate-900 p-4">
          <div className="rounded-lg bg-slate-800 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Questions</h2>
            <div className="grid grid-cols-5 gap-2">
              {session.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  className={`h-10 rounded text-sm font-semibold ${getQuestionButtonClass(q.id, i)}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <span><b className="text-green-400">Green</b> Attempted</span>
              <span><b className="text-white">White</b> Not visited</span>
              <span><b className="text-red-400">Red</b> Skipped</span>
              <span><b className="text-violet-400">Violet</b> Review</span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleMarkForReview}
            disabled={isExpired}
            className="rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {markedForReview[currentQuestion.id] ? 'Unmark Review' : 'Mark for Review'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isExpired || currentIndex >= session.questions.length - 1}
            className="rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Next Question
          </button>

          <div className="mt-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting || isExpired}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-hurix-gradient px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Submit Test
            </button>
          </div>
        </aside>
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
