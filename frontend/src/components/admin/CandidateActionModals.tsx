import { useEffect, useMemo, useState } from 'react';
import {
  getReminderTemplates,
  previewReminderTemplate,
  getJobRoles,
  getCalendarStatus,
  getWhatsAppTemplates,
} from '../../api/admin';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import type { ExportFormat, ExportScope, WhatsAppTemplate } from '../../types/candidate-management';
import {
  buildWhatsAppUrl,
  candidateWhatsAppVars,
  fillWhatsAppTemplate,
} from '../../utils/whatsapp';
import {
  GlassModal,
  glassBtnSecondaryClass,
  glassBtnPrimaryClass,
  glassBtnDangerClass,
  glassFieldClass,
} from '../ui/GlassDialog';

function ModalShell({
  title,
  count,
  onClose,
  children,
  closeDisabled,
}: {
  title: string;
  count: number;
  onClose: () => void;
  children: React.ReactNode;
  closeDisabled?: boolean;
}) {
  return (
    <GlassModal
      title={title}
      subtitle={`Affects ${count} candidate${count === 1 ? '' : 's'}`}
      onClose={onClose}
      closeDisabled={closeDisabled}
    >
      {children}
    </GlassModal>
  );
}

function ModalActions({
  onClose,
  loading,
  onConfirm,
  confirmLabel,
  confirmLoadingLabel,
  disabled,
  danger,
}: {
  onClose: () => void;
  loading: boolean;
  onConfirm: () => void;
  confirmLabel: string;
  confirmLoadingLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3 pt-2">
      <button type="button" onClick={onClose} disabled={loading} className={glassBtnSecondaryClass}>
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || disabled}
        className={danger ? glassBtnDangerClass : glassBtnPrimaryClass}
      >
        {loading ? confirmLoadingLabel : confirmLabel}
      </button>
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
      <select
        className={`${glassFieldClass} mb-4`}
        style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="New journey status"
      >
        {['REGISTERED', 'EMAIL_SENT', 'VERIFIED', 'STARTED', 'SUBMITTED', 'EXPIRED'].map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      {count >= 50 && (
        <p className="mb-3 text-center text-xs text-amber-700">Warning: this will update a large number of candidates.</p>
      )}
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        confirmLabel="Confirm"
        confirmLoadingLabel="Saving..."
        onConfirm={async () => {
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
      />
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
      <p className="mb-2 text-sm text-neutral-600">
        Rejection reason is internal and visible only to Super Admins. It will not be shown on ordinary Admin screens.
      </p>
      <textarea
        className={`${glassFieldClass} mb-2 min-h-[100px]`}
        style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Enter internal rejection reason..."
        aria-label="Internal rejection reason"
        maxLength={2000}
      />
      {(tooShort || tooLong) && (
        <p className="mb-2 text-center text-xs text-red-600" role="alert">
          {tooShort ? 'Reason must be at least 3 characters.' : 'Reason must be 2000 characters or fewer.'}
        </p>
      )}
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        danger
        disabled={reason.trim().length < 3 || tooLong}
        confirmLabel="Confirm Reject"
        confirmLoadingLabel="Rejecting..."
        onConfirm={async () => {
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
      />
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
      <div className="space-y-3">
        <input
          className="filter-glass w-full"
          style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
          placeholder="Search roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search job roles"
        />
        <select
          className="filter-glass w-full"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          aria-label="Job role"
        >
          {filtered.length === 0 ? (
            <option value="">No roles found</option>
          ) : (
            filtered.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))
          )}
        </select>
        {selectedTitle && (
          <p className="text-xs text-neutral-500">
            Selected role: <span className="font-semibold text-neutral-900">{selectedTitle}</span>
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-red-600" role="alert">{error}</p>
        )}
        <ModalActions
          onClose={onClose}
          loading={loading}
          disabled={!roleId}
          confirmLabel="Confirm"
          confirmLoadingLabel="Assigning…"
          onConfirm={async () => {
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
        />
      </div>
    </ModalShell>
  );
}

export function ReminderModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (templateId: string) => void;
}) {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [sending, setSending] = useState(false);
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
    <ModalShell title="Send Reminder Email" count={count} onClose={onClose} closeDisabled={sending}>
      <div className="space-y-3">
        <select
          className="filter-glass w-full"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          aria-label="Reminder template"
          disabled={sending}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {preview && (
          <div className="rounded-xl border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur-md">
            <p className="mb-1 text-xs font-semibold text-neutral-700">Preview subject</p>
            <p className="mb-2 text-sm font-medium text-neutral-950">{preview.subject}</p>
            <div
              className="text-xs leading-relaxed text-neutral-600 [&_strong]:font-semibold [&_strong]:text-neutral-900"
              dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
            />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-600" role="alert">{error}</p>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={sending} className={glassBtnSecondaryClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!templateId || sending}
            onClick={() => {
              if (!templateId) return;
              setSending(true);
              setError(null);
              try {
                onConfirm(templateId);
              } catch (e) {
                setError(getAdminActionErrorMessage(e));
                setSending(false);
              }
            }}
            className={glassBtnPrimaryClass}
          >
            Send Reminder
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function WhatsAppSendModal({
  candidate,
  onClose,
}: {
  candidate: {
    id: string;
    fullName: string;
    phone?: string | null;
    applicationId?: string | null;
    roleLabel?: string | null;
    appliedRole?: string | null;
    assessmentStatus?: string | null;
  };
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWhatsAppTemplates()
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        if (list[0]) setTemplateId(list[0].id);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(getAdminActionErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = templates.find((t) => t.id === templateId) || null;
  const vars = useMemo(() => candidateWhatsAppVars(candidate), [candidate]);
  const message = selected ? fillWhatsAppTemplate(selected.bodyText, vars) : '';
  const waUrl = buildWhatsAppUrl(candidate.phone || '', message);

  return (
    <ModalShell title="Send WhatsApp Message" count={1} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          To <span className="font-medium text-neutral-950">{candidate.fullName}</span>
          {candidate.phone ? ` · ${candidate.phone}` : ''}
        </p>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading templates...</p>
        ) : loadError ? (
          <p className="text-center text-sm text-red-600" role="alert">{loadError}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No WhatsApp templates yet. Add one under Templates first.
          </p>
        ) : (
          <>
            <select
              className="filter-glass w-full"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              aria-label="WhatsApp template"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="rounded-xl border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur-md">
              <p className="mb-1 text-xs font-semibold text-neutral-700">Message preview</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{message}</p>
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button type="button" onClick={onClose} className={glassBtnSecondaryClass}>
            Cancel
          </button>
          <a
            href={waUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`${glassBtnPrimaryClass} ${!waUrl || !message.trim() ? 'pointer-events-none opacity-50' : ''}`}
            aria-disabled={!waUrl || !message.trim()}
            onClick={() => {
              if (waUrl && message.trim()) onClose();
            }}
          >
            Open WhatsApp
          </a>
        </div>
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
      <p className="mb-2 text-sm text-neutral-600">
        Candidates will be moved to Deleted Candidates and removed from active lists, analytics, and exports.
        This is a soft delete — Super Admins can restore them later.
      </p>
      <p className="mb-4 text-xs text-neutral-500">
        This is not permanent deletion. Permanent delete is available only on the Deleted Candidates page for Super Admins.
      </p>
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        danger
        confirmLabel="Confirm Delete"
        confirmLoadingLabel="Deleting..."
        onConfirm={async () => {
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
      />
    </ModalShell>
  );
}

export function MarkTestUsersModal({
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
    <ModalShell title="Move to Test Users" count={count} onClose={onClose}>
      <p className="mb-4 text-sm text-neutral-600">
        Selected candidates will be moved to the Test Users list and hidden from the main Candidates table.
      </p>
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        confirmLabel="Confirm"
        confirmLoadingLabel="Moving..."
        onConfirm={async () => {
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
      />
    </ModalShell>
  );
}

export function ShortlistModal({
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
    <ModalShell title="Shortlist Candidates" count={count} onClose={onClose}>
      <p className="mb-4 text-sm text-neutral-600">
        Selected candidates will move to Shortlisted Candidates and leave the main Candidates list.
      </p>
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        confirmLabel="Confirm Shortlist"
        confirmLoadingLabel="Shortlisting..."
        onConfirm={async () => {
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
      />
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
      <p className="mb-4 text-sm text-neutral-600">
        Select all <strong>{total}</strong> candidates matching the current filters?
      </p>
      <ModalActions
        onClose={onClose}
        loading={false}
        confirmLabel="Confirm Select All"
        confirmLoadingLabel="Working..."
        onConfirm={() => {
          onConfirm();
          onClose();
        }}
      />
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
      <p className="mb-3 text-xs text-neutral-500">{calendarHint}</p>
      {!calendarConnected && (
        <div className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900 backdrop-blur-md" role="status">
          <p className="mb-2">
            Google Calendar is not connected. Connect Calendar before live scheduling. OAuth tokens are never exposed in the browser.
          </p>
          <a href="/admin/settings" className="inline-flex text-sm font-medium text-neutral-950 underline">
            Connect Google Calendar
          </a>
        </div>
      )}
      <input className={`${glassFieldClass} mb-2`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Interview title" aria-label="Interview title" />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input type="date" className={glassFieldClass} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Interview date" />
        <input type="time" className={glassFieldClass} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
      </div>
      <input className={`${glassFieldClass} mb-2`} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Timezone" aria-label="Timezone" />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-neutral-600">Duration (min)
          <input type="number" min={15} className={`${glassFieldClass} mt-1`} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
        </label>
        <label className="text-xs text-neutral-600">Gap (min)
          <input type="number" min={0} className={`${glassFieldClass} mt-1`} value={gapMinutes} onChange={(e) => setGapMinutes(Number(e.target.value))} disabled={mode !== 'SEQUENTIAL'} />
        </label>
      </div>
      {count > 1 && (
        <select
          className={`${glassFieldClass} mb-2`}
          style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
          value={mode}
          onChange={(e) => setMode(e.target.value as 'GROUP' | 'SEQUENTIAL')}
          aria-label="Interview mode"
        >
          <option value="GROUP">Group interview (one shared event)</option>
          <option value="SEQUENTIAL">Sequential interviews (one per candidate)</option>
        </select>
      )}
      {slotPreview.length > 0 && (
        <div className="mb-3 rounded-xl border border-white/70 bg-white/60 p-3 backdrop-blur-md">
          <p className="mb-1 text-xs font-semibold text-neutral-900">Sequential schedule preview</p>
          <ul className="space-y-1 text-xs text-neutral-600">
            {slotPreview.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <input
        className={`${glassFieldClass} mb-2`}
        value={interviewers}
        onChange={(e) => setInterviewers(e.target.value)}
        placeholder="Interviewer emails (comma-separated)"
        aria-label="Interviewer emails"
      />
      <label className="mb-2 flex items-center gap-2 text-sm text-neutral-800">
        <input type="checkbox" checked={createMeet} onChange={(e) => setCreateMeet(e.target.checked)} />
        Create Google Meet link
      </label>
      <textarea className={`${glassFieldClass} mb-4 min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        disabled={!date || !title.trim() || (count > 1 && !mode)}
        confirmLabel="Confirm Schedule"
        confirmLoadingLabel="Scheduling..."
        onConfirm={async () => {
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
      />
    </ModalShell>
  );
}

export function ExportModal({
  count,
  matchingTotal,
  listTotal,
  allLabel,
  hasSelection,
  hasFilters = false,
  onClose,
  onConfirm,
}: {
  count: number;
  matchingTotal: number;
  /** Total for this tab's full list (without UI filters). */
  listTotal?: number;
  /** First radio label, e.g. "All shortlisted candidates". */
  allLabel: string;
  hasSelection: boolean;
  hasFilters?: boolean;
  onClose: () => void;
  onConfirm: (scope: ExportScope, format: ExportFormat) => Promise<void>;
}) {
  const allCount = listTotal ?? matchingTotal;
  const defaultScope: ExportScope = hasSelection
    ? 'SELECTED'
    : hasFilters
      ? 'FILTERED'
      : 'ALL_ACTIVE';
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const affected =
    scope === 'SELECTED' ? count : scope === 'FILTERED' ? matchingTotal : allCount;
  const formatBtn = (value: ExportFormat, label: string) => (
    <button
      type="button"
      onClick={() => setFormat(value)}
      className={
        format === value
          ? 'inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-hurix-charcoal bg-hurix-charcoal px-3 py-1.5 text-sm font-medium text-white'
          : 'inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-hurix-charcoal hover:bg-white'
      }
      aria-pressed={format === value}
    >
      {label}
    </button>
  );

  return (
    <ModalShell title="Export Candidates" count={affected} onClose={onClose}>
      <fieldset className="mb-3">
        <legend className="text-sm font-medium mb-2">Scope</legend>
        <label className="flex items-center gap-2 text-sm mb-1">
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'ALL_ACTIVE'}
            onChange={() => setScope('ALL_ACTIVE')}
          />
          {allLabel}
          {typeof allCount === 'number' ? ` (${allCount})` : ''}
        </label>
        <label className={`flex items-center gap-2 text-sm mb-1 ${!hasFilters ? 'opacity-40' : ''}`}>
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'FILTERED'}
            disabled={!hasFilters}
            onChange={() => setScope('FILTERED')}
          />
          Current filtered candidates{' '}
          {hasFilters ? `(${matchingTotal})` : '(no filter applied)'}
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
        <div className="flex flex-wrap gap-2">
          {formatBtn('xlsx', 'XLSX')}
          {formatBtn('csv', 'CSV')}
        </div>
      </fieldset>

      {error && <p className="mb-3 text-center text-sm text-red-600" role="alert">{error}</p>}
      <ModalActions
        onClose={onClose}
        loading={loading}
        disabled={(scope === 'SELECTED' && !hasSelection) || (scope === 'FILTERED' && !hasFilters)}
        confirmLabel="Download"
        confirmLoadingLabel="Exporting..."
        onConfirm={async () => {
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
      />
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
