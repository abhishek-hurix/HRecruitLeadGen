import { useQuery } from '@tanstack/react-query';
import { getCandidateActivity } from '../../api/admin';
import { activityTypeLabel, formatIstDateTime } from '../../utils/activity';

const DISPLAY_TYPES = new Set([
  'REGISTERED',
  'ASSESSMENT_SUBMITTED',
  'REMINDER_SENT',
  'STATUS_CHANGED',
  'ROLE_ASSIGNED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
]);

interface ActivityTimelineProps {
  candidateId: string;
}

export function ActivityTimeline({ candidateId }: ActivityTimelineProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['candidate-activity', candidateId],
    queryFn: () => getCandidateActivity(candidateId),
  });

  const events = (data?.events || []).filter((e) => DISPLAY_TYPES.has(e.type) || e.type === 'OWNER_ASSIGNED');

  return (
    <div className="card-premium space-y-3 p-4">
      <div>
        <h2 className="text-base font-semibold">Activity Timeline</h2>
        <p className="text-xs text-hurix-gray">Read-only history of candidate events (IST timestamps).</p>
      </div>

      {isLoading && <p className="text-sm text-hurix-gray">Loading activity…</p>}
      {isError && (
        <div className="text-sm text-red-600" role="alert">
          Could not load activity.{' '}
          <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <p className="text-sm text-hurix-gray">No activity recorded yet.</p>
      )}

      <ol className="space-y-3 border-l border-slate-200 pl-4">
        {events.map((event, idx) => (
          <li key={`${event.type}-${event.at}-${idx}`} className="relative">
            <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-hurix-blue" />
            <p className="text-sm font-medium text-hurix-charcoal">{activityTypeLabel(event.type)}</p>
            <p className="text-xs text-hurix-gray">{event.summary}</p>
            <p className="text-[11px] text-hurix-gray mt-0.5">
              {formatIstDateTime(event.at)}
              {event.adminEmail ? ` · ${event.adminEmail}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
