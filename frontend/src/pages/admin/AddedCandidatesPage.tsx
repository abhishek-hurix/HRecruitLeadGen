import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { DateRangeCalendarFilter } from '../../components/admin/DateRangeCalendarFilter';
import { getCandidates, getJobRoles } from '../../api/admin';
import { formatIstDate } from '../../utils/activity';
import type { Candidate } from '../../types';

export function AddedCandidatesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const roleFilters = (rolesData?.data || []).map((jobRole) => ({
    label: jobRole.title,
    value: jobRole.id,
  }));

  const hasActiveFilters = Boolean(
    search.trim() || role !== 'all' || registeredFrom || registeredTo
  );

  const { data, isLoading } = useQuery({
    queryKey: ['added-candidates', search, role, registeredFrom, registeredTo, page, pageSize],
    queryFn: () =>
      getCandidates({
        search: search || undefined,
        creationSource: 'ADMIN_CREATED',
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
  const colSpan = 9;

  const emptyMessage = useMemo(
    () =>
      hasActiveFilters
        ? 'No added candidates match the current filters.'
        : 'No candidates available.',
    [hasActiveFilters]
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-hurix-charcoal sm:text-2xl">Added Candidates</h1>
        <p className="mt-1 text-sm text-hurix-gray">
          Candidates created with Add Candidate. Use Added By to see which admin added them.
        </p>
      </div>

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
          placeholder="Search added candidates..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="card-premium overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 bg-white px-3 py-2">
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
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">App ID</th>
                <th className="px-3 py-3 text-left font-semibold">Name</th>
                <th className="px-3 py-3 text-left font-semibold">Email</th>
                <th className="px-3 py-3 text-left font-semibold">Phone</th>
                <th className="px-3 py-3 text-left font-semibold">Role</th>
                <th className="px-3 py-3 text-left font-semibold">Assessment</th>
                <th className="px-3 py-3 text-left font-semibold">Registered</th>
                <th className="px-3 py-3 text-left font-semibold">Added By</th>
                <th className="px-3 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="p-8 text-center text-hurix-gray">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="p-8 text-center text-hurix-gray">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
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
                      <TruncatedText text={(c.assessmentStatus || '—').replace(/_/g, ' ')} />
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                      <TruncatedText text={formatIstDate(c.createdAt)} />
                    </td>
                    <td className="max-w-0 px-3 py-2.5 text-hurix-gray">
                      <TruncatedText
                        text={c.addedBy || c.createdByAdmin?.email || c.createdByAdminId || '—'}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link
                        to={`/admin/candidates/${c.id}?view=profile`}
                        className="font-medium text-hurix-blue hover:underline"
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
                className="input-field w-auto px-2 py-1 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows"
              >
                {[5, 10, 20, 30, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="tabular-nums">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
