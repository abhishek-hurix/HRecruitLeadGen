import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCandidateOwners } from '../../api/admin';
import type { CandidateOwner } from '../../types/candidate-management';

interface OwnerAssignModalProps {
  candidateName: string;
  currentOwner: CandidateOwner | null;
  onConfirm: (ownerAdminId: string | null) => Promise<void>;
  onClose: () => void;
}

export function OwnerAssignModal({
  candidateName,
  currentOwner,
  onConfirm,
  onClose,
}: OwnerAssignModalProps) {
  const { data: owners = [], isLoading } = useQuery({
    queryKey: ['candidate-owners'],
    queryFn: getCandidateOwners,
  });
  const [ownerId, setOwnerId] = useState(currentOwner?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(ownerId || null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update owner');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-hurix-charcoal">
          {currentOwner ? 'Reassign Owner' : 'Assign Owner'}
        </h2>
        <p className="mt-1 text-sm text-hurix-gray">
          Assign a primary owner for <span className="font-medium text-hurix-charcoal">{candidateName}</span>.
        </p>

        <label className="mt-4 block text-sm font-medium">Owner</label>
        <select
          className="input-field mt-1"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          disabled={isLoading || busy}
          aria-label="Select owner admin"
        >
          <option value="">Unassigned</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.email} ({o.role.replace(/_/g, ' ')})
            </option>
          ))}
        </select>

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary text-sm" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
