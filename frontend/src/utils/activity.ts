const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function formatIstDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function formatRelativeTime(iso: string | Date | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = now.getTime() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.round(month / 12)}y ago`;
}

export function activityTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  const map: Record<string, string> = {
    REGISTERED: 'Registration',
    ASSESSMENT_SUBMITTED: 'Assessment submitted',
    REMINDER_SENT: 'Reminder sent',
    STATUS_CHANGED: 'Status changed',
    ROLE_ASSIGNED: 'Role assigned',
    INTERVIEW_SCHEDULED: 'Interview scheduled',
    INTERVIEW_COMPLETED: 'Interview completed',
    OWNER_ASSIGNED: 'Owner assigned',
  };
  return map[type] || type.replace(/_/g, ' ');
}

/** IST calendar day for hover titles without relying on local TZ. */
export function toIstTitle(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `IST ${ist.toISOString().slice(0, 16).replace('T', ' ')}`;
}
