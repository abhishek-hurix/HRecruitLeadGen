import { useState } from 'react';
import { X } from 'lucide-react';

interface TestUserConfirmModalProps {
  candidateName: string;
  isTestUser: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function TestUserConfirmModal({
  candidateName,
  isTestUser,
  onConfirm,
  onClose,
}: TestUserConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-hurix-charcoal">
            {isTestUser ? 'Remove Test User Status' : 'Mark Candidate as Test User'}
          </h2>
          <button type="button" onClick={onClose} className="text-hurix-gray hover:text-hurix-charcoal">
            <X size={20} />
          </button>
        </div>
        {isTestUser ? (
          <p className="text-sm text-hurix-gray mb-6">
            <strong className="text-hurix-charcoal">{candidateName}</strong> will be included in analytics,
            conversion rates, reports, and exports again.
          </p>
        ) : (
          <p className="text-sm text-hurix-gray mb-6">
            <strong className="text-hurix-charcoal">{candidateName}</strong> will be excluded from analytics,
            conversion rates, reports, and exports. This action can be reversed later.
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TestUserBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
      🧪 Test User
    </span>
  );
}
