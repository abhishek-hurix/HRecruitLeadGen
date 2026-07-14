import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCandidateOwners } from '../../api/admin';
import type { CandidateOwner } from '../../types/candidate-management';
import {
  GlassModal,
  glassBtnPrimaryClass,
  glassBtnSecondaryClass,
  glassFieldClass,
} from '../ui/GlassDialog';

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
    <GlassModal
      title={currentOwner ? 'Reassign Owner' : 'Assign Owner'}
      subtitle={`Assign a primary owner for ${candidateName}.`}
      onClose={onClose}
      maxWidth="md"
    >
      <label className="mb-1 block text-sm font-medium text-neutral-800">Owner</label>
      <select
        className={glassFieldClass}
        style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
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
        <p className="mt-2 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" className={glassBtnSecondaryClass} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={glassBtnPrimaryClass} onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </GlassModal>
  );
}
