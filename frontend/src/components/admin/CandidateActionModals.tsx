import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  getReminderTemplates,
  previewReminderTemplate,
  getJobRoles,
  getCalendarStatus,
} from '../../api/admin';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import type { ExportFormat, ExportScope } from '../../types/candidate-management';

interface BaseModalProps {
  title: string;
  count: number;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, count, onClose, children }: BaseModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div ref={panelRef} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-hurix-charcoal">{title}</h2>
            <p className="text-xs text-hurix-gray mt-1">Affects {count} candidate{count === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-hurix-gray hover:text-hurix-charcoal">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusChangeModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (status: string) => Promise<void>;
}) {
  const [status, setStatus] = useState('VERIFIED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ModalShell title="Change Journey Status" count={count} onClose={onClose}>
      <select className="input-field w-full mb-4" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="New journey status">
        {['REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED'].map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      {count >= 50 && (
        <p className="text-xs text-amber-700 mb-3">Warning: this will update a large number of candidates.</p>
      )}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm(status);
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </ModalShell>
  );
}

export function RejectModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length > 0 && reason.trim().length < 3;
  const tooLong = reason.trim().length > 2000;
  return (
    <ModalShell title="Reject Candidates" count={count} onClose={onClose}>
      <p className="text-sm text-hurix-gray mb-2">
        Rejection reason is internal and visible only to Super Admins. It will not be shown on ordinary Admin screens.
      </p>
      <textarea
        className="input-field w-full min-h-[100px] mb-2"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Enter internal rejection reason..."
        aria-label="Internal rejection reason"
        maxLength={2000}
      />
      {(tooShort || tooLong) && (
        <p className="text-xs text-red-600 mb-2" role="alert">
          {tooShort ? 'Reason must be at least 3 characters.' : 'Reason must be 2000 characters or fewer.'}
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary bg-red-600 hover:bg-red-700"
          disabled={loading || reason.trim().length < 3 || tooLong}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm(reason.trim());
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Rejecting...' : 'Confirm Reject'}
        </button>
      </div>
    </ModalShell>
  );
}

export function AssignRoleModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (jobRoleId: string) => Promise<void>;
}) {
  const [roles, setRoles] = useState<Array<{ id: string; title: string; status?: string }>>([]);
  const [roleId, setRoleId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJobRoles().then((res) => {
      const active = (res.data || []).filter((r) => !r.status || r.status === 'ACTIVE');
      setRoles(active);
      if (active[0]) setRoleId(active[0].id);
    });
  }, []);

  const filtered = roles.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));
  const selectedTitle = roles.find((r) => r.id === roleId)?.title;

  return (
    <ModalShell title="Assign Job Role" count={count} onClose={onClose}>
      <input
        className="input-field w-full mb-2"
        placeholder="Search roles..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search job roles"
      />
      <select
        className="input-field w-full mb-2"
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        aria-label="Job role"
      >
        {filtered.map((r) => (
          <option key={r.id} value={r.id}>{r.title}</option>
        ))}
      </select>
      {selectedTitle && (
        <p className="text-xs text-hurix-gray mb-3">Selected role: <strong>{selectedTitle}</strong></p>
      )}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !roleId}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm(roleId);
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Assigning...' : 'Confirm'}
        </button>
      </div>
    </ModalShell>
  );
}

export function ReminderModal({
  count,
  onClose,
  onConfirm,
  onRetryFailed,
  lastResult,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (templateId: string) => Promise<void>;
  onRetryFailed?: (templateId: string, failedIds: string[]) => Promise<void>;
  lastResult?: {
    summary: { requested: number; succeeded: number; failed: number; skipped: number };
    failedCandidateIds?: string[];
  } | null;
}) {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReminderTemplates().then((list) => {
      setTemplates(list);
      if (list[0]) setTemplateId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!templateId) return;
    previewReminderTemplate(templateId).then(setPreview).catch(() => setPreview(null));
  }, [templateId]);

  return (
    <ModalShell title="Send Reminder Email" count={count} onClose={onClose}>
      <select
        className="input-field w-full mb-3"
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        aria-label="Reminder template"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {preview && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3 bg-slate-50">
          <p className="text-xs font-semibold mb-1">Preview subject</p>
          <p className="text-sm mb-2">{preview.subject}</p>
          <div className="text-xs text-hurix-gray" dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
        </div>
      )}
      {lastResult && (
        <p className="text-sm text-hurix-charcoal mb-3" role="status">
          Sent {lastResult.summary.succeeded}, failed {lastResult.summary.failed}, skipped {lastResult.summary.skipped}
          (of {lastResult.summary.requested}).
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        {lastResult?.failedCandidateIds && lastResult.failedCandidateIds.length > 0 && onRetryFailed && (
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || !templateId}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                await onRetryFailed(templateId, lastResult.failedCandidateIds!);
              } catch (e) {
                setError(getAdminActionErrorMessage(e));
              } finally {
                setLoading(false);
              }
            }}
          >
            Retry failed
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !templateId}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm(templateId);
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Sending...' : 'Send Reminder'}
        </button>
      </div>
    </ModalShell>
  );
}

export function DeleteConfirmModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ModalShell title="Soft Delete Candidates" count={count} onClose={onClose}>
      <p className="text-sm text-hurix-gray mb-2">
        Candidates will be moved to Deleted Candidates and removed from active lists, analytics, and exports.
        This is a soft delete — Super Admins can restore them later.
      </p>
      <p className="text-xs text-hurix-gray mb-4">
        This is not permanent deletion. Permanent delete is available only on the Deleted Candidates page for Super Admins.
      </p>
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary bg-red-600 hover:bg-red-700"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Deleting...' : 'Confirm Delete'}
        </button>
      </div>
    </ModalShell>
  );
}

export function SelectAllConfirmModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell title="Select All Matching Candidates" count={total} onClose={onClose}>
      <p className="text-sm text-hurix-gray mb-4">
        Select all <strong>{total}</strong> candidates matching the current filters?
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => { onConfirm(); onClose(); }}>
          Confirm Select All
        </button>
      </div>
    </ModalShell>
  );
}

export function InterviewModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState('Candidate Interview');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [gapMinutes, setGapMinutes] = useState(15);
  const [mode, setMode] = useState<'SINGLE' | 'GROUP' | 'SEQUENTIAL'>(count > 1 ? 'GROUP' : 'SINGLE');
  const [notes, setNotes] = useState('');
  const [createMeet, setCreateMeet] = useState(true);
  const [interviewers, setInterviewers] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarHint, setCalendarHint] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(true);

  useEffect(() => {
    getCalendarStatus().then((s) => {
      setCalendarConnected(s.mockMode || s.connected);
      setCalendarHint(
        s.mockMode
          ? 'Google Calendar is in mock mode (events will be simulated).'
          : s.connected
            ? `Connected as ${s.googleEmail}`
            : 'Google Calendar is not connected. Connect Calendar before live scheduling.'
      );
    });
  }, []);

  const slotPreview = useMemo(() => {
    if (!date || !time || mode !== 'SEQUENTIAL' || count <= 1) return [];
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return [];
    const slots: string[] = [];
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      const slotStart = new Date(start.getTime() + i * (durationMinutes + gapMinutes) * 60_000);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      slots.push(`${slotStart.toLocaleString()} – ${slotEnd.toLocaleTimeString()}`);
    }
    if (count > 8) slots.push(`…and ${count - 8} more`);
    return slots;
  }, [date, time, mode, count, durationMinutes, gapMinutes]);

  return (
    <ModalShell title="Schedule Interview" count={count} onClose={onClose}>
      <p className="text-xs text-hurix-gray mb-3">{calendarHint}</p>
      {!calendarConnected && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3" role="status">
          <p className="mb-2">
            Google Calendar is not connected. Connect Calendar before live scheduling. OAuth tokens are never exposed in the browser.
          </p>
          <a href="/admin/settings" className="inline-flex text-sm font-medium text-hurix-blue underline">
            Connect Google Calendar
          </a>
        </div>
      )}
      <input className="input-field w-full mb-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Interview title" aria-label="Interview title" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Interview date" />
        <input type="time" className="input-field" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
      </div>
      <input className="input-field w-full mb-2" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Timezone" aria-label="Timezone" />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-xs">Duration (min)
          <input type="number" min={15} className="input-field w-full" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
        </label>
        <label className="text-xs">Gap (min)
          <input type="number" min={0} className="input-field w-full" value={gapMinutes} onChange={(e) => setGapMinutes(Number(e.target.value))} disabled={mode !== 'SEQUENTIAL'} />
        </label>
      </div>
      {count > 1 && (
        <select
          className="input-field w-full mb-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'GROUP' | 'SEQUENTIAL')}
          aria-label="Interview mode"
        >
          <option value="GROUP">Group interview (one shared event)</option>
          <option value="SEQUENTIAL">Sequential interviews (one per candidate)</option>
        </select>
      )}
      {slotPreview.length > 0 && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold mb-1">Sequential schedule preview</p>
          <ul className="text-xs text-hurix-gray space-y-1">
            {slotPreview.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <input
        className="input-field w-full mb-2"
        value={interviewers}
        onChange={(e) => setInterviewers(e.target.value)}
        placeholder="Interviewer emails (comma-separated)"
        aria-label="Interviewer emails"
      />
      <label className="flex items-center gap-2 text-sm text-hurix-charcoal mb-2">
        <input type="checkbox" checked={createMeet} onChange={(e) => setCreateMeet(e.target.checked)} />
        Create Google Meet link
      </label>
      <textarea className="input-field w-full mb-4 min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !date || !title.trim() || (count > 1 && !mode)}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              const startUtc = new Date(`${date}T${time}:00`).toISOString();
              await onConfirm({
                title,
                notes,
                startUtc,
                timezone,
                durationMinutes,
                gapMinutes,
                mode: count === 1 ? 'SINGLE' : mode,
                createMeet,
                idempotencyKey: crypto.randomUUID(),
                interviewerEmails: interviewers
                  .split(',')
                  .map((e) => e.trim())
                  .filter(Boolean),
              });
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Scheduling...' : 'Confirm Schedule'}
        </button>
      </div>
    </ModalShell>
  );
}

export function ExportModal({
  count,
  matchingTotal,
  hasSelection,
  onClose,
  onConfirm,
}: {
  count: number;
  matchingTotal: number;
  hasSelection: boolean;
  onClose: () => void;
  onConfirm: (scope: ExportScope, format: ExportFormat) => Promise<void>;
}) {
  const [scope, setScope] = useState<ExportScope>(hasSelection ? 'SELECTED' : 'FILTERED');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const affected =
    scope === 'SELECTED' ? count : scope === 'FILTERED' ? matchingTotal : matchingTotal;

  return (
    <ModalShell title="Export Candidates" count={affected} onClose={onClose}>
      <fieldset className="mb-3">
        <legend className="text-sm font-medium mb-2">Scope</legend>
        <label className="flex items-center gap-2 text-sm mb-1">
          <input type="radio" name="export-scope" checked={scope === 'ALL_ACTIVE'} onChange={() => setScope('ALL_ACTIVE')} />
          All active candidates
        </label>
        <label className="flex items-center gap-2 text-sm mb-1">
          <input type="radio" name="export-scope" checked={scope === 'FILTERED'} onChange={() => setScope('FILTERED')} />
          Current filtered candidates ({matchingTotal})
        </label>
        <label className={`flex items-center gap-2 text-sm mb-1 ${!hasSelection ? 'opacity-40' : ''}`}>
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'SELECTED'}
            disabled={!hasSelection}
            onChange={() => setScope('SELECTED')}
          />
          Selected candidates {hasSelection ? `(${count})` : '(none selected)'}
        </label>
      </fieldset>
      <fieldset className="mb-4">
        <legend className="text-sm font-medium mb-2">Format</legend>
        <label className="inline-flex items-center gap-2 text-sm mr-4">
          <input type="radio" name="export-format" checked={format === 'csv'} onChange={() => setFormat('csv')} />
          CSV
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="export-format" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
          XLSX
        </label>
      </fieldset>
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || (scope === 'SELECTED' && !hasSelection)}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onConfirm(scope, format);
              onClose();
            } catch (e) {
              setError(getAdminActionErrorMessage(e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Exporting...' : 'Download'}
        </button>
      </div>
    </ModalShell>
  );
}

export function BulkResultBanner({
  result,
  onDismiss,
}: {
  result: {
    summary: { requested: number; succeeded: number; failed: number; skipped: number };
    errors?: Array<{ message: string; candidateId?: string }>;
    meetUrl?: string | null;
    calendarEventLinks?: string[];
    email?: { sent: number; failed: number; skipped: number };
  } | null;
  onDismiss: () => void;
}) {
  if (!result) return null;
  const { summary } = result;
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" role="status" aria-live="polite">
      <div className="flex justify-between gap-2">
        <p>
          Completed: {summary.succeeded} succeeded, {summary.failed} failed, {summary.skipped} skipped
          (of {summary.requested}).
        </p>
        <button type="button" className="text-xs text-hurix-blue" onClick={onDismiss}>Dismiss</button>
      </div>
      {result.email && (
        <p className="mt-1 text-xs text-hurix-gray">
          Emails: {result.email.sent} sent, {result.email.failed} failed, {result.email.skipped} skipped.
        </p>
      )}
      {result.meetUrl && (
        <p className="mt-1 text-xs">
          Google Meet:{' '}
          <a href={result.meetUrl} target="_blank" rel="noreferrer" className="text-hurix-blue underline">
            {result.meetUrl}
          </a>
        </p>
      )}
      {result.calendarEventLinks && result.calendarEventLinks.length > 0 && (
        <ul className="mt-1 text-xs list-disc pl-4">
          {result.calendarEventLinks.slice(0, 5).map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer" className="text-hurix-blue underline">
                Calendar event
              </a>
            </li>
          ))}
        </ul>
      )}
      {result.errors && result.errors.length > 0 && (
        <ul className="mt-2 text-xs text-red-600 list-disc pl-4">
          {result.errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e.candidateId ? `${e.candidateId}: ` : ''}{e.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
