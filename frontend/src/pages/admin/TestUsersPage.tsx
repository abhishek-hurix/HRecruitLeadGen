import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Trash2, RotateCcw } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { DeleteConfirmModal } from '../../components/admin/CandidateActionModals';
import { GlassDialog } from '../../components/ui/GlassDialog';
import {
  getCandidates,
  bulkSoftDelete,
  bulkRemoveTestUsers,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { formatIstDate } from '../../utils/activity';
import type { Candidate } from '../../types';
import type { CandidateListFilters } from '../../types/candidate-management';

export function TestUsersPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
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

  const listFilters = useMemo<CandidateListFilters>(
    () => ({
      search,
      status: '',
      experience: '',
      country: '',
      countryCodes: [],
      minScore: '',
      role: '',
      roleAssignment: 'all',
      registeredFrom: '',
      registeredTo: '',
      datePreset: '',
      ownerId: '',
      inactivityDays: '',
      sortBy: '',
      sortOrder: '',
      isTestUser: true,
    }),
    [search]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['test-users', search, page, pageSize],
    queryFn: () =>
      getCandidates({
        search: search || undefined,
        isTestUser: true,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = (data?.data || []) as Candidate[];
  const meta = data?.meta || data?.pagination;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? Math.max(1, Math.ceil(total / pageSize) || 1);
  const colSpan = isSuperAdmin ? 9 : 8;

  const selection = useCandidateSelection(total, listFilters);
  const selectedCount = selection.effectiveCount;
  const bulkDisabled = busy || selectedCount <= 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['test-users'] });
    await queryClient.invalidateQueries({ queryKey: ['candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['deleted-candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const runRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bulkRemoveTestUsers(selection.toPayload());
      selection.clearSelection();
      setRemoveOpen(false);
      setMessage(`Moved ${result.summary?.succeeded ?? selectedCount} candidate(s) back to Candidates.`);
      await invalidate();
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkSoftDelete(selection.toPayload());
      selection.clearSelection();
      setDeleteOpen(false);
      setMessage('Selected test users moved to Deleted Candidates.');
      await invalidate();
    } catch (e) {
      setError(getAdminActionErrorMessage(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Test Users</h1>
        <p className="text-sm text-hurix-gray mt-1">
          QA / sandbox profiles hidden from the main Candidates list.
          {isSuperAdmin ? ' Super Admins can remove them back to Candidates or soft-delete them.' : ''}
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}
      {error && !deleteOpen && !removeOpen && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={18} />
        <input
          className="input-field pl-10"
          placeholder="Search test users..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="card-premium overflow-hidden p-0">
        {isSuperAdmin && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-3 py-2">
            {selectedCount > 0 && (
              <span className="mr-1 text-[11px] font-semibold text-hurix-blue whitespace-nowrap">
                {selectedCount} selected
              </span>
            )}
            <button
              type="button"
              disabled={bulkDisabled}
              onClick={() => {
                setError(null);
                setRemoveOpen(true);
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-green-200 px-2 text-[11px] font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
              title={selectedCount <= 0 ? 'Select candidates first' : 'Move back to Candidates'}
            >
              <RotateCcw size={13} />
              Remove
            </button>
            <button
              type="button"
              disabled={bulkDisabled}
              onClick={() => {
                setError(null);
                setDeleteOpen(true);
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              title={selectedCount <= 0 ? 'Select candidates first' : 'Soft-delete selected'}
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        )}

        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              {isSuperAdmin ? <col className="w-[4%]" /> : null}
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b">
              <tr>
                {isSuperAdmin && (
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
                <th className="px-3 py-3 text-left font-semibold">Assessment</th>
                <th className="px-3 py-3 text-left font-semibold">Registered</th>
                <th className="px-3 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-hurix-gray">
                    Loading test users...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-hurix-gray">
                    No test users yet. Use Test User on the Candidates page to move profiles here.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    {isSuperAdmin && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleId(c.id)}
                          aria-label={`Select ${c.fullName}`}
                        />
                      </td>
                    )}
                    <td className="max-w-0 px-3 py-3 font-mono text-[11px]">
                      <TruncatedText text={c.applicationId || '—'} />
                    </td>
                    <td className="max-w-0 px-3 py-3 font-medium text-hurix-charcoal">
                      <TruncatedText text={c.fullName} />
                    </td>
                    <td className="max-w-0 px-3 py-3 text-hurix-gray">
                      <TruncatedText text={c.email} />
                    </td>
                    <td className="max-w-0 px-3 py-3 text-hurix-gray">
                      <TruncatedText text={c.phone || '—'} />
                    </td>
                    <td className="max-w-0 px-3 py-3">
                      <TruncatedText text={c.roleLabel || 'Not Assigned'} />
                    </td>
                    <td className="max-w-0 px-3 py-3">
                      <TruncatedText text={c.assessmentStatus?.replace(/_/g, ' ') || '—'} />
                    </td>
                    <td className="max-w-0 px-3 py-3">
                      <TruncatedText text={formatIstDate(c.createdAt)} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link to={`/admin/candidates/${c.id}`} className="text-hurix-blue hover:underline">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-3">
            <p className="text-xs text-hurix-gray">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <select
                className="input-field text-xs py-1.5 w-auto"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                {[5, 10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} rows
                  </option>
                ))}
              </select>
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

      {removeOpen && (
        <GlassDialog
          title="Remove from Test Users"
          message={
            <>
              Move <strong>{selectedCount}</strong> candidate{selectedCount === 1 ? '' : 's'} back to the main
              Candidates list?
              {error ? (
                <span className="mt-3 block text-red-600" role="alert">
                  {error}
                </span>
              ) : null}
            </>
          }
          confirmLabel="Confirm Remove"
          onConfirm={runRemove}
          onCancel={() => setRemoveOpen(false)}
          isLoading={busy}
        />
      )}
    </AdminLayout>
  );
}
