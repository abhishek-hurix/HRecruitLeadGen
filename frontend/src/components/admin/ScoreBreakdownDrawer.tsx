import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getScoreBreakdown } from '../../api/admin';
import { formatIstDateTime } from '../../utils/activity';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';

interface ScoreBreakdownDrawerProps {
  candidateId: string;
  onClose: () => void;
}

export function ScoreBreakdownDrawer({ candidateId, onClose }: ScoreBreakdownDrawerProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['score-breakdown', candidateId],
    queryFn: () => getScoreBreakdown(candidateId),
  });

  const score = data?.score ?? data?.totalScore ?? null;
  const maxScore = data?.maximumScore ?? data?.maxScore ?? 10;
  const questions = data?.questionResults ?? data?.questions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <button type="button" className="flex-1 cursor-default" aria-label="Close score breakdown" onClick={onClose} />
      <aside className="w-full max-w-md h-full bg-white shadow-xl overflow-y-auto p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-hurix-charcoal">Score breakdown</h2>
            {data && (
              <p className="text-xs text-hurix-gray mt-1">
                {data.fullName} · {data.applicationId}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-hurix-gray hover:text-hurix-charcoal">
            <X size={20} />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
            <div className="h-20 bg-slate-100 rounded" />
          </div>
        )}

        {isError && (
          <div className="text-sm text-red-600 space-y-2" role="alert">
            <p>Could not load score breakdown.</p>
            <p className="text-xs">{getAdminActionErrorMessage(error)}</p>
            <button type="button" className="underline text-xs" onClick={() => refetch()}>Retry</button>
          </div>
        )}

        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-hurix-gray">Email</p>
                <p className="break-all">{data.email}</p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Role</p>
                <p>{data.assignedRole || 'Not Assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Status</p>
                <p>{String(data.status || data.assessmentStatus || '').replace(/_/g, ' ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Score</p>
                <p className="font-semibold">
                  {score != null ? `${score}/${maxScore}` : data.message || 'Not Available'}
                </p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Correct / Incorrect / Unanswered</p>
                <p>
                  {data.correctCount ?? '—'} / {data.incorrectCount ?? '—'} / {data.unansweredCount ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Started (IST)</p>
                <p>{formatIstDateTime(data.startedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-hurix-gray">Submitted (IST)</p>
                <p>{formatIstDateTime(data.submittedAt)}</p>
              </div>
            </div>

            {questions.length > 0 ? (
              <div>
                <h3 className="font-semibold mb-2">Question marks</h3>
                <ul className="space-y-2">
                  {questions.map((q) => (
                    <li key={`${q.questionId || q.number}`} className="rounded border border-slate-200 p-2">
                      <p className="font-medium">Q{q.number}{q.title ? `: ${q.title}` : ''}</p>
                      <p className="text-xs text-hurix-gray">
                        {q.awardedMarks}/{q.maximumMarks} ·{' '}
                        {q.answered ? (q.correct ? 'Correct' : 'Incorrect') : 'Unanswered'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              data.hasSubmission && data.aggregateOnly && (
                <p className="text-xs text-hurix-gray">Only aggregate score is available for this assessment.</p>
              )
            )}

            {!data.hasSubmission && data.message && (
              <p className="text-xs text-hurix-gray">{data.message}</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
