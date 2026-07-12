import {
  Briefcase,
  Calendar,
  Download,
  Mail,
  RefreshCw,
  Trash2,
  UserX,
  X,
} from 'lucide-react';

export type BulkToolbarAction =
  | 'status'
  | 'reminder'
  | 'role'
  | 'reject'
  | 'interview'
  | 'export'
  | 'delete'
  | null;

interface BulkActionToolbarProps {
  count: number;
  onChangeStatus: () => void;
  onSendReminder: () => void;
  onAssignRole: () => void;
  onReject: () => void;
  onScheduleInterview: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
  disabled?: boolean;
  activeAction?: BulkToolbarAction;
}

export function BulkActionToolbar({
  count,
  onChangeStatus,
  onSendReminder,
  onAssignRole,
  onReject,
  onScheduleInterview,
  onExport,
  onDelete,
  onClear,
  disabled,
  activeAction = null,
}: BulkActionToolbarProps) {
  if (count <= 0) return null;

  const btn = (
    label: string,
    actionKey: NonNullable<BulkToolbarAction>,
    onClick: () => void,
    Icon: typeof Mail,
    danger = false
  ) => {
    const isActive = activeAction === actionKey;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-busy={isActive}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border disabled:opacity-50 ${
          danger
            ? 'border-red-200 text-red-700 hover:bg-red-50'
            : 'border-slate-200 text-hurix-charcoal hover:bg-slate-50'
        }`}
      >
        <Icon size={14} className={isActive ? 'animate-spin' : undefined} />
        {isActive ? `${label}…` : label}
      </button>
    );
  };

  return (
    <div
      className="sticky top-0 z-30 mb-4 rounded-xl border border-hurix-blue/20 bg-white/95 backdrop-blur shadow-sm p-3"
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-hurix-blue mr-2">
          {count} candidate{count === 1 ? '' : 's'} selected
        </span>
        {btn('Change Status', 'status', onChangeStatus, RefreshCw)}
        {btn('Send Reminder', 'reminder', onSendReminder, Mail)}
        {btn('Assign Job Role', 'role', onAssignRole, Briefcase)}
        {btn('Reject', 'reject', onReject, UserX)}
        {btn('Schedule Interview', 'interview', onScheduleInterview, Calendar)}
        {btn('Export', 'export', onExport, Download)}
        {btn('Delete', 'delete', onDelete, Trash2, true)}
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Clear selection"
          className="inline-flex items-center gap-1 ml-auto text-xs text-hurix-gray hover:text-hurix-charcoal disabled:opacity-50"
        >
          <X size={14} /> Clear
        </button>
      </div>
    </div>
  );
}
