import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, RotateCcw, Trash2 } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  getDeletedCandidates,
  restoreDeletedCandidate,
  permanentlyDeleteCandidate,
} from '../../api/admin';
import { formatDate } from '../../utils/validation';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import type { DeletedCandidateRow } from '../../types/candidate-management';

export function DeletedCandidatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; name: string } | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deleted-candidates', search, page, pageSize],
    queryFn: () => getDeletedCandidates({ search, page, pageSize }),
    placeholderData: (prev) => prev,
  });

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setBusyId(confirmRestore.id);
    setError(null);
    try {
      await restoreDeletedCandidate(confirmRestore.id);
      setMessage('Candidate restored successfully.');
      setConfirmRestore(null);
      await queryClient.invalidateQueries({ queryKey: ['deleted-candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanent = async () => {
    if (!confirmPermanent) return;
    setBusyId(confirmPermanent.id);
    setError(null);
    try {
      await permanentlyDeleteCandidate(confirmPermanent.id);
      setMessage('Candidate permanently deleted.');
      setConfirmPermanent(null);
      await queryClient.invalidateQueries({ queryKey: ['deleted-candidates'] });
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const rows = (data?.data || []) as DeletedCandidateRow[];

  const meta = data?.meta;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Deleted Candidates</h1>
        <p className="text-sm text-hurix-gray mt-1">
          Super Admin only. Soft-deleted candidates can be restored or permanently removed.
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={18} />
        <input
          className="input-field pl-10"
          placeholder="Search deleted candidates..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card-premium overflow-x-auto p-0">
        <table className="w-full text-xs min-w-[1000px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-3 py-3 text-left font-semibold">App ID</th>
              <th className="px-3 py-3 text-left font-semibold">Name</th>
              <th className="px-3 py-3 text-left font-semibold">Email</th>
              <th className="px-3 py-3 text-left font-semibold">Phone</th>
              <th className="px-3 py-3 text-left font-semibold">Country</th>
              <th className="px-3 py-3 text-left font-semibold">Experience</th>
              <th className="px-3 py-3 text-left font-semibold">Role</th>
              <th className="px-3 py-3 text-left font-semibold">Assessment</th>
              <th className="px-3 py-3 text-left font-semibold">Score</th>
              <th className="px-3 py-3 text-left font-semibold">Deleted</th>
              <th className="px-3 py-3 text-left font-semibold">Deleted By</th>
              <th className="px-3 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={12} className="p-8 text-center text-hurix-gray">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="p-8 text-center text-hurix-gray">No deleted candidates</td></tr>
            ) : (
              rows.map((c) => {
                const deletedByName = c.deletedBy?.name || c.deletedByAdmin?.name;
                const deletedByEmail = c.deletedBy?.email || c.deletedByAdmin?.email;
                const deletedBy =
                  deletedByName && deletedByEmail
                    ? `${deletedByName} (${deletedByEmail})`
                    : deletedByEmail || deletedByName || '—';
                return (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono">{c.applicationId || c.id.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 font-medium">{c.fullName}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.email}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.phoneCountry || '—'}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.experienceLabel || '—'}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.assignedRole || c.appliedRole || '—'}</td>
                    <td className="px-3 py-2.5">{c.assessmentStatus || '—'}</td>
                    <td className="px-3 py-2.5">{c.score != null ? `${c.score}/10` : '—'}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{c.deletedAt ? formatDate(c.deletedAt) : '—'}</td>
                    <td className="px-3 py-2.5 text-hurix-gray">{deletedBy}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue hover:underline">
                          View
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => setConfirmRestore({ id: c.id, name: c.fullName })}
                          className="inline-flex items-center gap-1 text-green-700 hover:underline disabled:opacity-50"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => setConfirmPermanent({ id: c.id, name: c.fullName })}
                          className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                        >
                          <Trash2 size={12} /> Permanent Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-hurix-gray">
            <span>Rows per page</span>
            <select
              className="input-field w-auto py-1"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span>
              Page {meta.page} of {meta.totalPages || 1} · {meta.total} total
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!meta.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-hurix-charcoal mb-2">Restore Candidate</h2>
            <p className="text-sm text-hurix-gray mb-4">
              Restore <strong>{confirmRestore.name}</strong> to the active candidates list?
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={busyId === confirmRestore.id}
                onClick={handleRestore}
              >
                {busyId === confirmRestore.id ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPermanent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-hurix-charcoal mb-2">Permanently Delete</h2>
            <p className="text-sm text-hurix-gray mb-4">
              Permanently delete <strong>{confirmPermanent.name}</strong>? This cannot be undone.
              Related assessment data will be removed according to foreign-key rules.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmPermanent(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={busyId === confirmPermanent.id}
                onClick={handlePermanent}
              >
                {busyId === confirmPermanent.id ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
