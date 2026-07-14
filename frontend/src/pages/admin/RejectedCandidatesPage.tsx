import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Trash2, RotateCcw } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { DeleteConfirmModal } from '../../components/admin/CandidateActionModals';
import { DateRangeCalendarFilter } from '../../components/admin/DateRangeCalendarFilter';
import { GlassDialog } from '../../components/ui/GlassDialog';
import { getCandidates, getJobRoles, bulkSoftDelete, bulkRestoreRejected } from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { formatIstDate } from '../../utils/activity';
import type { Candidate } from '../../types';
import type { CandidateListFilters } from '../../types/candidate-management';

export function RejectedCandidatesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = useAdminAuth();
  const canManage = hasPermission('manage_candidates');
  const canViewReason = hasPermission('view_rejection_reasons');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

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
      status: 'REJECTED',
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
    queryKey: ['rejected-candidates', search, role, registeredFrom, registeredTo, page, pageSize],
    queryFn: () =>
      getCandidates({
        search: search || undefined,
        status: 'REJECTED',
        role: role !== 'all' ? role : undefined,
        registeredFrom: registeredFrom || undefined,
        registeredTo: registeredTo || undefined,
        datePreset: registeredFrom || registeredTo ? 'custom' : undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = (data?.data || []) as Candidate[];
  const meta = data?.meta || data?.pagination;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? Math.max(1, Math.ceil(total / pageSize) || 1);
  const colSpan = (canViewReason ? 9 : 8) + (canManage ? 1 : 0);

  const selection = useCandidateSelection(total, listFilters);
  const selectedCount = selection.effectiveCount;
  const bulkDisabled = busy || selectedCount <= 0;

  const runDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkSoftDelete(selection.toPayload());
      selection.clearSelection();
      setDeleteOpen(false);
      setMessage('Selected candidates moved to Deleted Candidates.');
      await queryClient.invalidateQueries({ queryKey: ['rejected-candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['deleted-candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bulkRestoreRejected(selection.toPayload());
      selection.clearSelection();
      setRestoreOpen(false);
      setMessage(`Restored ${result.summary?.succeeded ?? selectedCount} candidate(s) to the active list.`);
      await queryClient.invalidateQueries({ queryKey: ['rejected-candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Rejected Candidates</h1>
        <p className="text-sm text-hurix-gray mt-1">
          Candidates marked as rejected. Soft-delete moves them to Deleted Candidates.
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}
      {error && !deleteOpen && !restoreOpen && (
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
          placeholder="Search rejected candidates..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="card-premium overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(canManage || isSuperAdmin) && selectedCount > 0 && (
              <span className="mr-1 text-[11px] font-semibold text-hurix-blue whitespace-nowrap">
                {selectedCount} selected
              </span>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                disabled={bulkDisabled}
                onClick={() => {
                  setError(null);
                  setRestoreOpen(true);
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-green-200 px-2 text-[11px] font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedCount <= 0 ? 'Select candidates first' : 'Restore selected'}
              >
                <RotateCcw size={13} />
                Restore
              </button>
            )}
            {canManage && (
              <button
                type="button"
                disabled={bulkDisabled}
                onClick={() => {
                  setError(null);
                  setDeleteOpen(true);
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedCount <= 0 ? 'Select candidates first' : 'Delete selected'}
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

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              {canManage ? <col className="w-[4%]" /> : null}
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              {canViewReason ? <col className="w-[12%]" /> : null}
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b">
              <tr>
                {canManage && (
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
                )}
                <th className="px-3 py-3 text-left font-semibold">App ID</th>
                <th className="px-3 py-3 text-left font-semibold">Name</th>
                <th className="px-3 py-3 text-left font-semibold">Email</th>
                <th className="px-3 py-3 text-left font-semibold">Phone</th>
                <th className="px-3 py-3 text-left font-semibold">Role</th>
                <th className="px-3 py-3 text-left font-semibold">Rejected</th>
                <th className="px-3 py-3 text-left font-semibold">Rejected By</th>
                {canViewReason && (
                  <th className="px-3 py-3 text-left font-semibold">Reason</th>
                )}
                <th className="px-3 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="p-8 text-center text-hurix-gray">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="p-8 text-center text-hurix-gray">
                    No rejected candidates
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    {canManage && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleId(c.id)}
                          aria-label={`Select ${c.fullName}`}
                        />
                      </td>
                    )}
                    <td className="max-w-0 px-3 py-2.5 font-mono">
                      <TruncatedText text={c.applicationId || c.id.slice(0, 8).toUpperCase()} />
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
                      <TruncatedText text={c.roleLabel || c.appliedRole || '—'} />
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                      <TruncatedText text={formatIstDate(c.rejectedAt)} />
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                      <TruncatedText text={c.rejectedBy || '—'} />
                    </td>
                    {canViewReason && (
                      <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                        <TruncatedText text={c.rejectionReason || '—'} lines={2} />
                      </td>
                    )}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        to={`/admin/candidates/${c.id}?view=profile`}
                        className="text-hurix-blue font-medium hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-hurix-gray">
            <label className="inline-flex items-center gap-1.5">
              <span>rows</span>
              <select
                className="input-field w-auto py-1 px-2 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows"
              >
                {[5, 10, 20, 30, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <span className="tabular-nums">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary text-xs px-3 py-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteOpen && (
        <DeleteConfirmModal
          count={selectedCount}
          onClose={() => setDeleteOpen(false)}
          onConfirm={runDelete}
        />
      )}

      {restoreOpen && (
        <GlassDialog
          title="Restore Candidates"
          message={
            <>
              Restore <strong>{selectedCount}</strong> rejected candidate{selectedCount === 1 ? '' : 's'} back to
              the active Candidates list?
              {error ? (
                <span className="mt-3 block text-red-600" role="alert">
                  {error}
                </span>
              ) : null}
            </>
          }
          confirmLabel="Confirm Restore"
          onConfirm={runRestore}
          onCancel={() => setRestoreOpen(false)}
          isLoading={busy}
        />
      )}
    </AdminLayout>
  );
}
