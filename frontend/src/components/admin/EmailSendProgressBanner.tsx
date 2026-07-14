import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';

export type EmailSendProgressState = {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  status: 'sending' | 'done' | 'error';
  message?: string | null;
  errors: Array<{ candidateId?: string; message: string }>;
  stuck?: boolean;
};

export function EmailSendProgressBanner({
  progress,
  onDismiss,
}: {
  progress: EmailSendProgressState;
  onDismiss: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (
      (progress.status === 'done' || progress.status === 'error') &&
      (progress.failed > 0 || progress.skipped > 0 || progress.errors.length > 0 || progress.status === 'error')
    ) {
      setShowLogs(true);
    }
  }, [progress.status, progress.failed, progress.skipped, progress.errors.length]);

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  const label =
    progress.status === 'sending'
      ? progress.stuck
        ? `Still working… ${progress.processed} of ${progress.total}`
        : `Sent ${progress.processed} of ${progress.total}`
      : progress.status === 'error'
        ? progress.message || 'Send failed'
        : `Sent ${progress.sent} of ${progress.total}`;

  const hasIssues =
    progress.failed > 0 || progress.skipped > 0 || progress.errors.length > 0 || progress.status === 'error';

  const card = (
    <div
      className="pointer-events-auto w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-white/80 bg-white/95 p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-1.5">
          {progress.status === 'done' && !hasIssues ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : hasIssues || progress.stuck ? (
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          ) : null}
          <p className="text-[11px] font-semibold leading-snug text-neutral-800">{label}</p>
        </div>
        {(progress.status === 'done' || progress.status === 'error') && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-hurix-gradient transition-[width] duration-300 ease-out"
          style={{ width: `${progress.status === 'error' && pct === 0 ? 100 : pct}%` }}
        />
      </div>

      {(progress.failed > 0 || progress.skipped > 0) && (
        <p className="mt-1.5 text-[10px] text-neutral-500">
          {progress.failed > 0 ? `${progress.failed} failed` : null}
          {progress.failed > 0 && progress.skipped > 0 ? ' · ' : null}
          {progress.skipped > 0 ? `${progress.skipped} skipped` : null}
        </p>
      )}

      {hasIssues && (
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-neutral-600 hover:text-neutral-900"
        >
          {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showLogs ? 'Hide log' : 'Error log'}
        </button>
      )}

      {showLogs && (
        <ul className="mt-1.5 max-h-28 overflow-y-auto rounded-lg border border-red-100/80 bg-red-50/70 px-2 py-1.5 text-left text-[10px] leading-relaxed text-red-700">
          {progress.message && progress.status === 'error' && (
            <li className="py-0.5">{progress.message}</li>
          )}
          {progress.errors.length === 0 && progress.status !== 'error' && (
            <li className="py-0.5 text-neutral-500">No detailed error messages available.</li>
          )}
          {progress.errors.map((err, idx) => (
            <li key={`${err.candidateId || 'e'}-${idx}`} className="border-t border-red-100/60 py-0.5 first:border-0">
              {err.message}
              {err.candidateId ? (
                <span className="text-red-500/80"> · {err.candidateId.slice(0, 8)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;

  // Fixed overlay under admin header — does not affect page layout.
  return createPortal(
    <div className="pointer-events-none fixed right-4 top-[7.25rem] z-[60] sm:right-6 lg:right-8 lg:top-[4.75rem]">
      {card}
    </div>,
    document.body
  );
}
