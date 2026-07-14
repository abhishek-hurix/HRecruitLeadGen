import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, RotateCcw, Trash2 } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { DateRangeCalendarFilter } from '../../components/admin/DateRangeCalendarFilter';
import { GlassDialog } from '../../components/ui/GlassDialog';
import {
  getDeletedCandidates,
  getJobRoles,
  bulkRestoreDeleted,
  bulkPermanentDelete,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import { formatDate } from '../../utils/validation';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import type { CandidateListFilters, DeletedCandidateRow } from '../../types/candidate-management';

export function DeletedCandidatesPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin, hasPermission } = useAdminAuth();
  const canPermanentDelete = hasPermission('permanently_delete_candidates');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!headerMenuRef.current?.contains(e.target as Node)) setHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [headerMenuOpen]);

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const roleFilters = (rolesData?.data || []).map((jobRole) => ({
    label: jobRole.title,
    value: jobRole.id,
  }));

  const listFilters = useMemo<CandidateListFilters>(
    () => ({
      search,
      status: '',
      experience: '',
      country: '',
      countryCodes: [],
      minScore: '',
      role: role !== 'all' ? role : '',
      roleAssignment: 'all',
      registeredFrom,
      registeredTo,
      datePreset: registeredFrom || registeredTo ? 'custom' : '',
      ownerId: '',
      inactivityDays: '',
      sortBy: '',
      sortOrder: '',
    }),
    [search, role, registeredFrom, registeredTo]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['deleted-candidates', search, role, registeredFrom, registeredTo, page, pageSize],
    queryFn: () =>
      getDeletedCandidates({
        search: search || undefined,
        role: role !== 'all' ? role : undefined,
        registeredFrom: registeredFrom || undefined,
        registeredTo: registeredTo || undefined,
        datePreset: registeredFrom || registeredTo ? 'custom' : undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = (data?.data || []) as DeletedCandidateRow[];
  const meta = data?.meta;
  const total = meta?.total ?? 0;

  const selection = useCandidateSelection(total, listFilters);
  const selectedCount = selection.effectiveCount;
  const bulkDisabled = busy || selectedCount <= 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['deleted-candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['rejected-candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleRestore = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bulkRestoreDeleted(selection.toPayload());
      setMessage(`Restored ${result.summary?.succeeded ?? selectedCount} candidate(s).`);
      selection.clearSelection();
      setConfirmRestore(false);
      await invalidate();
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePermanent = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bulkPermanentDelete(selection.toPayload());
      setMessage(`Permanently deleted ${result.summary?.succeeded ?? selectedCount} candidate(s).`);
      selection.clearSelection();
      setConfirmPermanent(false);
      await invalidate();
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const colSpan = 13;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Deleted Candidates</h1>
        <p className="text-sm text-hurix-gray mt-1">
          Soft-deleted candidates. Permanent delete cannot be undone.
          {isSuperAdmin ? ' Super Admins can restore selected profiles.' : ''}
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

      <div className="relative z-50 mb-3 flex flex-wrap gap-2 justify-start items-start">
        <button
          type="button"
          onClick={() => {
            setRole('all');
            setPage(1);
          }}
          className={role === 'all' ? 'filter-chip-active' : 'filter-chip'}
        >
          All
        </button>
        {roleFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setRole(filter.value);
              setPage(1);
            }}
            className={role === filter.value ? 'filter-chip-active' : 'filter-chip'}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={18} />
        <input
          className="input-field pl-10"
          placeholder="Search deleted candidates..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card-premium overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCount > 0 && (
              <span className="mr-1 text-[11px] font-semibold text-hurix-blue whitespace-nowrap">
                {selectedCount} selected
              </span>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                disabled={bulkDisabled}
                onClick={() => setConfirmRestore(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-green-200 px-2 text-[11px] font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedCount <= 0 ? 'Select candidates first' : 'Restore selected'}
              >
                <RotateCcw size={13} />
                Restore
              </button>
            )}
            {canPermanentDelete && (
              <button
                type="button"
                disabled={bulkDisabled}
                onClick={() => setConfirmPermanent(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedCount <= 0 ? 'Select candidates first' : 'Permanently delete selected'}
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
          <DateRangeCalendarFilter
            from={registeredFrom}
            to={registeredTo}
            onChange={({ from, to }) => {
              setRegisteredFrom(from);
              setRegisteredTo(to);
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left">
                  <div className="relative inline-flex" ref={headerMenuRef}>
                    <input
                      type="checkbox"
                      checked={selection.headerChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.headerIndeterminate;
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        setHeaderMenuOpen((open) => !open);
                      }}
                      onChange={() => {}}
                      aria-label="Selection menu"
                      aria-haspopup="menu"
                      aria-expanded={headerMenuOpen}
                      title="Select all or unselect"
                    />
                    {headerMenuOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 top-[calc(100%+4px)] z-[80] min-w-[9.5rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-1.5 text-left text-xs text-hurix-charcoal hover:bg-slate-50 disabled:opacity-40"
                          disabled={total <= 0}
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            if (total > 0) selection.activateAllMatching();
                          }}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-1.5 text-left text-xs text-hurix-charcoal hover:bg-slate-50 disabled:opacity-40"
                          disabled={!selection.hasSelection}
                          onClick={() => {
                            selection.clearSelection();
                            setHeaderMenuOpen(false);
                          }}
                        >
                          Unselect
                        </button>
                      </div>
                    )}
                  </div>
                </th>
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
                <tr><td colSpan={colSpan} className="p-8 text-center text-hurix-gray">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colSpan} className="p-8 text-center text-hurix-gray">No deleted candidates</td></tr>
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
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleId(c.id)}
                          aria-label={`Select ${c.fullName}`}
                        />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 font-mono">
                        <TruncatedText text={c.applicationId || c.id.slice(0, 8)} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 font-medium">
                        <TruncatedText text={c.fullName} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.email} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.phone || '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.phoneCountry || '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.experienceLabel || '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.assignedRole || c.appliedRole || '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5">
                        <TruncatedText text={(c.assessmentStatus || '—').replace(/_/g, ' ')} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5">
                        <TruncatedText text={c.score != null ? `${c.score}/10` : '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.deletedAt ? formatDate(c.deletedAt) : '—'} />
                      </td>
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={deletedBy} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
              {[5, 10, 20, 25, 50, 100].map((s) => (
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
        <GlassDialog
          title="Restore Candidates"
          message={
            <>
              Restore <strong>{selectedCount}</strong> candidate{selectedCount === 1 ? '' : 's'} to the active list?
            </>
          }
          confirmLabel="Confirm Restore"
          onConfirm={handleRestore}
          onCancel={() => setConfirmRestore(false)}
          isLoading={busy}
        />
      )}

      {confirmPermanent && (
        <GlassDialog
          title="Permanently Delete"
          message={
            <>
              Permanently delete <strong>{selectedCount}</strong> candidate{selectedCount === 1 ? '' : 's'}?
              This cannot be undone.
            </>
          }
          confirmLabel="Permanently Delete"
          onConfirm={handlePermanent}
          onCancel={() => setConfirmPermanent(false)}
          isLoading={busy}
          danger
        />
      )}
    </AdminLayout>
  );
}
