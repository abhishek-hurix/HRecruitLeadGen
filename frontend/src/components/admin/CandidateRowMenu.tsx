import { MoreVertical } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

interface CandidateRowMenuProps {
  candidateId: string;
  candidateName: string;
  onSendReminder: () => void;
  onChangeStatus: () => void;
  onAssignRole: () => void;
  onReject: () => void;
  onScheduleInterview: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function CandidateRowMenu({
  candidateId,
  onSendReminder,
  onChangeStatus,
  onAssignRole,
  onReject,
  onScheduleInterview,
  onExport,
  onDelete,
}: CandidateRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
    const top = rect.bottom + 4;
    setCoords({ top, left: Math.max(8, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = (label: string, onClick: () => void, warning = false) => (
    <button
      type="button"
      role="menuitem"
      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
        warning ? 'text-red-600' : 'text-hurix-charcoal'
      }`}
      onClick={() => {
        setOpen(false);
        buttonRef.current?.focus();
        onClick();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Candidate actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[60] w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: coords.top, left: coords.left }}
          >
            <Link
              to={`/admin/candidates/${candidateId}?view=profile`}
              role="menuitem"
              className="block px-3 py-2 text-sm text-hurix-charcoal hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              View Candidate
            </Link>
            <Link
              to={`/admin/candidates/${candidateId}?view=assessment`}
              role="menuitem"
              className="block px-3 py-2 text-sm text-hurix-charcoal hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              View Assessment
            </Link>
            {item('Send Reminder', onSendReminder)}
            {item('Change Status', onChangeStatus)}
            {item('Assign Job Role', onAssignRole)}
            {item('Reject', onReject, true)}
            {item('Schedule Interview', onScheduleInterview)}
            {item('Export Candidate', onExport)}
            {item('Delete', onDelete, true)}
          </div>,
          document.body
        )}
    </div>
  );
}
