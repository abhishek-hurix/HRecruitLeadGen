import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Download, ClipboardList, Copy, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResumePreviewModal } from '../../components/admin/ResumePreviewModal';
import { BulkActionToolbar } from '../../components/admin/BulkActionToolbar';
import { CandidateRowMenu } from '../../components/admin/CandidateRowMenu';
import { CountryMultiSelect } from '../../components/admin/CountryMultiSelect';
import { RegisteredDateFilter } from '../../components/admin/RegisteredDateFilter';
import { SortableTh } from '../../components/admin/SortableTh';
import { ScoreBreakdownDrawer } from '../../components/admin/ScoreBreakdownDrawer';
import { OwnerAssignModal } from '../../components/admin/OwnerAssignModal';
import { TruncatedText } from '../../components/ui/TruncatedText';
import {
  AssignRoleModal,
  BulkResultBanner,
  DeleteConfirmModal,
  ExportModal,
  InterviewModal,
  RejectModal,
  ReminderModal,
  SelectAllConfirmModal,
  StatusChangeModal,
} from '../../components/admin/CandidateActionModals';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  getCandidates,
  getAdminCountries,
  getCandidateOwners,
  assignCandidateOwner,
  exportCandidatesAdvanced,
  getJobRoles,
  getResumePreviewUrl,
  bulkChangeStatus,
  bulkReject,
  bulkAssignRole,
  bulkSoftDelete,
  bulkSendReminders,
  scheduleInterview,
  type BulkResult,
  type SelectionPayload,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import { formatDate } from '../../utils/validation';
import { EXPERIENCE_OPTIONS } from '../../utils/experience';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import {
  clampPage,
  getPageRange,
  PAGE_SIZE_OPTIONS,
} from '../../types/candidate-management';
import { cycleSort, type DatePreset, type SortDirection } from '../../utils/candidate-list-ui';
import { FALLBACK_COUNTRIES } from '../../utils/iso-countries';
import { formatRelativeTime, formatIstDateTime, toIstTitle } from '../../utils/activity';
import type { Candidate } from '../../types';

type ModalKind =
  | null
  | 'status'
  | 'reject'
  | 'role'
  | 'reminder'
  | 'delete'
  | 'interview'
  | 'selectAll'
  | 'export';

export function CandidatesPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = useAdminAuth();
  const canManage = hasPermission('manage_candidates');
  const canExport = hasPermission('export_candidates');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [experience, setExperience] = useState('');
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [minScore, setMinScore] = useState('');
  const [role, setRole] = useState('all');
  const [roleAssignment, setRoleAssignment] = useState('all');
  const [ownerId, setOwnerId] = useState('');
  const [inactivityDays, setInactivityDays] = useState<'' | '7' | '30' | '90'>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [actionTarget, setActionTarget] = useState<'bulk' | string>('bulk');
  const [ownerModalCandidate, setOwnerModalCandidate] = useState<Candidate | null>(null);
  const [scoreCandidateId, setScoreCandidateId] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'status' | 'reminder' | 'role' | 'reject' | 'interview' | 'export' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [listError, setListError] = useState<{ message: string; requestId?: string } | null>(null);
  const [selectionClearedNotice, setSelectionClearedNotice] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      search,
      status,
      experience,
      country: '',
      countryCodes,
      minScore,
      role,
      roleAssignment,
      registeredFrom,
      registeredTo,
      datePreset,
      ownerId,
      inactivityDays,
      sortBy: sortBy || '',
      sortOrder: sortOrder || '',
    }),
    [
      search,
      status,
      experience,
      countryCodes,
      minScore,
      role,
      roleAssignment,
      registeredFrom,
      registeredTo,
      datePreset,
      ownerId,
      inactivityDays,
      sortBy,
      sortOrder,
    ]
  );

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const { data: countriesData } = useQuery({
    queryKey: ['admin-countries'],
    queryFn: getAdminCountries,
    staleTime: 60 * 60 * 1000,
  });
  const countries = countriesData?.length ? countriesData : FALLBACK_COUNTRIES;

  const { data: ownersData = [] } = useQuery({
    queryKey: ['candidate-owners'],
    queryFn: getCandidateOwners,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      'candidates',
      search,
      status,
      experience,
      countryCodes,
      minScore,
      role,
      roleAssignment,
      registeredFrom,
      registeredTo,
      datePreset,
      ownerId,
      inactivityDays,
      sortBy,
      sortOrder,
      page,
      pageSize,
    ],
    queryFn: () =>
      getCandidates({
        search,
        status,
        experience,
        countryCodes: countryCodes.length ? countryCodes : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        role: role !== 'all' ? role : undefined,
        roleAssignment:
          roleAssignment === 'assigned' || roleAssignment === 'unassigned'
            ? roleAssignment
            : undefined,
        registeredFrom: registeredFrom || undefined,
        registeredTo: registeredTo || undefined,
        datePreset: datePreset && datePreset !== 'custom' ? datePreset : undefined,
        ownerId: ownerId || undefined,
        inactivityDays: inactivityDays ? Number(inactivityDays) : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (isError && error) {
      const requestId = (error as { response?: { data?: { requestId?: string } } })?.response?.data?.requestId;
      setListError({
        message: getAdminActionErrorMessage(error),
        requestId,
      });
    } else if (!isError) {
      setListError(null);
    }
  }, [isError, error]);

  const totalMatching = data?.meta?.total ?? data?.pagination?.total ?? 0;
  const selection = useCandidateSelection(totalMatching, filters);
  const filterKey = JSON.stringify(filters);
  const prevFilterKey = useRef(filterKey);
  const clearSelection = selection.clearSelection;
  const hasSelection = selection.hasSelection;

  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      if (hasSelection) {
        clearSelection();
        setSelectionClearedNotice(true);
        window.setTimeout(() => setSelectionClearedNotice(false), 4000);
      }
      prevFilterKey.current = filterKey;
    }
  }, [filterKey, hasSelection, clearSelection]);

  useEffect(() => {
    if (data?.meta?.total != null || data?.pagination?.total != null) {
      const total = data.meta?.total ?? data.pagination.total;
      const next = clampPage(page, pageSize, total);
      if (next !== page) setPage(next);
    }
  }, [data?.meta?.total, data?.pagination?.total, page, pageSize, data]);

  useEffect(() => {
    return () => {
      if (resumePreview) {
        window.URL.revokeObjectURL(resumePreview.url);
      }
    };
  }, [resumePreview]);

  const resolveSelection = (): SelectionPayload => {
    if (actionTarget === 'bulk') return selection.toPayload();
    return selection.singlePayload(actionTarget);
  };

  const actionCount = actionTarget === 'bulk' ? selection.effectiveCount : 1;

  const refreshAfterMutation = async (result: BulkResult, clearAfter = false) => {
    setBulkResult(result);
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: ['candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (clearAfter) selection.clearSelection();
  };

  const runAction = async (
    fn: () => Promise<BulkResult>,
    clearAfter = false,
    actionKey: typeof busyAction = null
  ) => {
    setBusy(true);
    setBusyAction(actionKey);
    setActionError(null);
    try {
      const result = await fn();
      await refreshAfterMutation(result, clearAfter);
      return result;
    } catch (e) {
      setActionError(getAdminActionErrorMessage(e));
      throw e;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const openAction = (kind: ModalKind, target: 'bulk' | string = 'bulk') => {
    setActionTarget(target);
    setModal(kind);
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      SUBMITTED: 'bg-green-100 text-green-700',
      STARTED: 'bg-amber-100 text-amber-700',
      VERIFIED: 'bg-blue-100 text-blue-700',
      EMAIL_SENT: 'bg-indigo-100 text-indigo-700',
      REGISTERED: 'bg-slate-100 text-slate-600',
      EXPIRED: 'bg-red-100 text-red-700',
      REJECTED: 'bg-red-100 text-red-700',
      NOT_STARTED: 'bg-slate-100 text-slate-600',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colors[s] || colors.REGISTERED}`}>
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const closeResumePreview = () => {
    if (resumePreview) {
      window.URL.revokeObjectURL(resumePreview.url);
    }
    setResumePreview(null);
  };

  const openResumePreview = async (candidateId: string, fullName: string) => {
    setLoadingResumeId(candidateId);
    try {
      const url = await getResumePreviewUrl(candidateId);
      setResumePreview({ url, filename: `${fullName}_resume.pdf` });
    } finally {
      setLoadingResumeId(null);
    }
  };

  const copyPhoneNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setCopyNotice('Phone copied');
      window.setTimeout(() => {
        setCopiedPhone((current) => (current === phone ? null : current));
        setCopyNotice(null);
      }, 1500);
    } catch {
      setCopyNotice('Could not copy to clipboard');
      window.setTimeout(() => setCopyNotice(null), 2500);
    }
  };

  const copyEmailAddress = async (email: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setCopyNotice('Email copied');
      window.setTimeout(() => {
        setCopiedEmail((current) => (current === email ? null : current));
        setCopyNotice(null);
      }, 1500);
    } catch {
      setCopyNotice('Could not copy to clipboard');
      window.setTimeout(() => setCopyNotice(null), 2500);
    }
  };

  const phoneActions = (phone: string) => (
    <div className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{phone}</span>
      <button
        type="button"
        onClick={() => copyPhoneNumber(phone)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 text-hurix-charcoal hover:bg-slate-50"
        title={copiedPhone === phone ? 'Copied' : 'Copy phone number'}
        aria-label={copiedPhone === phone ? 'Copied phone number' : 'Copy phone number'}
      >
        <Copy size={12} />
      </button>
      <a
        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
        className="inline-flex items-center gap-1 rounded border border-green-200 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 lg:hidden"
      >
        <Phone size={12} />
        Call
      </a>
    </div>
  );

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setExperience('');
    setCountryCodes([]);
    setMinScore('');
    setRole('all');
    setRoleAssignment('all');
    setOwnerId('');
    setInactivityDays('');
    setDatePreset('');
    setRegisteredFrom('');
    setRegisteredTo('');
    setSortBy(null);
    setSortOrder(null);
    setPage(1);
  };

  const handleSort = (column: string) => {
    const next = cycleSort(sortBy, sortOrder, column);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  };

  const filterSnapshot = {
    search: search || undefined,
    status: status || null,
    experience: experience || null,
    country: null,
    countryCodes: countryCodes.length ? countryCodes : null,
    minScore: minScore ? Number(minScore) : null,
    role: role !== 'all' ? role : null,
    roleAssignment: roleAssignment !== 'all' ? roleAssignment : null,
    registeredFrom: registeredFrom || null,
    registeredTo: registeredTo || null,
    datePreset: datePreset || null,
    ownerId: ownerId || null,
    inactivityDays: inactivityDays ? Number(inactivityDays) : null,
    sortBy: sortBy || null,
    sortOrder: sortOrder || null,
  };

  const runExport = async (scope: 'SELECTED' | 'FILTERED' | 'ALL_ACTIVE', format: 'csv' | 'xlsx') => {
    setBusy(true);
    setBusyAction('export');
    setActionError(null);
    try {
      await exportCandidatesAdvanced({
        scope,
        format,
        selection: scope === 'SELECTED' ? selection.toPayload() : undefined,
        filters: filterSnapshot,
      });
    } catch (e) {
      setActionError(getAdminActionErrorMessage(e));
      throw e;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const roleFilters = (rolesData?.data || []).map((jobRole) => ({
    label: jobRole.title,
    value: jobRole.id,
  }));

  const headerChecked = selection.headerChecked;
  const headerIndeterminate = selection.headerIndeterminate;
  const pagination = data?.meta || data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const range = getPageRange(pagination?.page || page, pageSize, totalMatching);

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Candidates</h1>
          {data && (
            <p className="text-sm text-hurix-gray mt-1">
              <span className="font-semibold text-hurix-charcoal">{totalMatching}</span> candidates
              {totalMatching > 0 && (
                <>
                  {' · '}
                  Showing {range.from}–{range.to} of {totalMatching}
                </>
              )}
              {isFetching && <span className="ml-2 text-xs">Updating…</span>}
            </p>
          )}
        </div>
        {canExport && (
          <button
            type="button"
            onClick={() => openAction('export')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
            disabled={busy}
          >
            <Download size={16} /> Export
          </button>
        )}
      </div>

      {selectionClearedNotice && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          Selection cleared because filters or search changed.
        </div>
      )}

      {copyNotice && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {copyNotice}
        </div>
      )}

      {listError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          Candidates could not be loaded{listError.requestId ? `. Reference: ${listError.requestId}` : '.'}{' '}
          {listError.message}
          <button type="button" className="ml-3 text-xs underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {actionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {actionError}
          <button type="button" className="ml-3 text-xs underline" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      <BulkResultBanner result={bulkResult} onDismiss={() => setBulkResult(null)} />

      {canManage && (
        <BulkActionToolbar
          count={selection.effectiveCount}
          disabled={busy}
          activeAction={busyAction}
          onChangeStatus={() => openAction('status')}
          onSendReminder={() => openAction('reminder')}
          onAssignRole={() => openAction('role')}
          onReject={() => openAction('reject')}
          onScheduleInterview={() => openAction('interview')}
          onExport={() => openAction('export')}
          onDelete={() => openAction('delete')}
          onClear={selection.clearSelection}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setRole('all'); setRoleAssignment('all'); setPage(1); }}
          className={`rounded-full px-4 py-2 text-sm font-medium ${role === 'all' ? 'bg-hurix-blue text-white' : 'bg-white text-hurix-gray border hover:text-hurix-blue'}`}
        >
          All
        </button>
        {roleFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => { setRole(filter.value); setRoleAssignment('all'); setPage(1); }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${role === filter.value ? 'bg-hurix-blue text-white' : 'bg-white text-hurix-gray border hover:text-hurix-blue'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={18} />
          <input
            className="input-field pl-10"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
          <select className="input-field" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Journey Status</option>
            <option value="REGISTERED">Registered</option>
            <option value="EMAIL_SENT">Email Sent</option>
            <option value="VERIFIED">Verified</option>
            <option value="STARTED">Started</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="EXPIRED">Expired</option>
            <option value="REJECTED">Rejected</option>
            <option value="ASSESSMENT_NOT_STARTED">Assessment: Not Started</option>
            <option value="ASSESSMENT_IN_PROGRESS">Assessment: In Progress</option>
            <option value="ASSESSMENT_SUBMITTED">Assessment: Submitted</option>
          </select>
          <select className="input-field" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }}>
            <option value="">All Experience</option>
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <CountryMultiSelect
            countries={countries}
            value={countryCodes}
            onChange={(codes) => { setCountryCodes(codes); setPage(1); }}
          />
          <RegisteredDateFilter
            preset={datePreset}
            from={registeredFrom}
            to={registeredTo}
            onChange={({ preset, from, to }) => {
              setDatePreset(preset);
              setRegisteredFrom(from);
              setRegisteredTo(to);
              setPage(1);
            }}
          />
          <select className="input-field" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }}>
            <option value="">All Scores</option>
            {Array.from({ length: 11 }, (_, score) => (
              <option key={score} value={score}>{score}/10 and above</option>
            ))}
          </select>
          <select
            className="input-field"
            value={roleAssignment}
            onChange={(e) => {
              const v = e.target.value;
              setRoleAssignment(v);
              if (v === 'assigned' || v === 'unassigned' || v === 'all') setRole('all');
              setPage(1);
            }}
            aria-label="Role assignment filter"
          >
            <option value="all">All Candidates</option>
            <option value="assigned">Role Assigned</option>
            <option value="unassigned">No Role Assigned</option>
          </select>
          <select
            className="input-field"
            value={roleFilters.some((f) => f.value === role) ? role : ''}
            onChange={(e) => {
              const v = e.target.value || 'all';
              setRole(v);
              if (v !== 'all') setRoleAssignment('all');
              setPage(1);
            }}
            aria-label="Specific job role"
          >
            <option value="">Specific Job Role</option>
            {(rolesData?.data || []).map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={ownerId}
            onChange={(e) => { setOwnerId(e.target.value); setPage(1); }}
            aria-label="Owner filter"
          >
            <option value="">All Owners</option>
            <option value="unassigned">Unassigned</option>
            {ownersData.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.email}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={inactivityDays}
            onChange={(e) => {
              setInactivityDays(e.target.value as '' | '7' | '30' | '90');
              setPage(1);
            }}
            aria-label="Inactivity filter"
          >
            <option value="">Any activity</option>
            <option value="7">No activity for 7 days</option>
            <option value="30">No activity for 30 days</option>
            <option value="90">No activity for 90 days</option>
          </select>
        </div>
        {isFetching && !isLoading && (
          <p className="text-xs text-hurix-gray" aria-live="polite">Updating results…</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          <p className="text-center text-hurix-gray py-8">Loading...</p>
        ) : data?.data.length === 0 ? (
          <div className="text-center text-hurix-gray py-8 space-y-3">
            <p>No candidates match the current filters.</p>
            <button type="button" className="btn-secondary text-sm" onClick={clearAllFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          data?.data.map((c) => (
            <div key={c.id} className="card-premium p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={selection.isSelected(c.id)}
                      onChange={() => selection.toggleId(c.id)}
                      aria-label={`Select ${c.fullName}`}
                      className="mt-1"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-hurix-charcoal">{c.fullName}</p>
                    <p className="text-xs text-hurix-gray font-mono">{c.applicationId || c.id.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(c.journeyStatus)}
                  {canManage && (
                    <CandidateRowMenu
                      candidateId={c.id}
                      candidateName={c.fullName}
                      onSendReminder={() => openAction('reminder', c.id)}
                      onChangeStatus={() => openAction('status', c.id)}
                      onAssignRole={() => openAction('role', c.id)}
                      onReject={() => openAction('reject', c.id)}
                      onScheduleInterview={() => openAction('interview', c.id)}
                      onExport={() => {
                        setBusy(true);
                        exportCandidatesAdvanced({
                          scope: 'SELECTED',
                          format: 'csv',
                          selection: selection.singlePayload(c.id),
                        }).finally(() => setBusy(false));
                      }}
                      onDelete={() => openAction('delete', c.id)}
                    />
                  )}
                </div>
              </div>
              <div className="text-sm text-hurix-gray flex items-center gap-2">
                <span className="break-all">{c.email}</span>
                <button
                  type="button"
                  onClick={(e) => copyEmailAddress(c.email, e)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200"
                  aria-label="Copy email"
                  title={copiedEmail === c.email ? 'Copied' : 'Copy email address'}
                >
                  <Copy size={12} />
                </button>
              </div>
              <div className="text-sm text-hurix-gray">
                {phoneActions(c.phone)}
                <span className="ml-2">· {c.countryName || c.phoneCountry || '—'}</span>
              </div>
              {c.experienceLabel && <p className="text-sm text-hurix-charcoal">{c.experienceLabel}</p>}
              <p className="text-xs font-medium text-hurix-blue">{c.roleLabel || c.appliedRole || 'Not Assigned'}</p>
              <p className="text-xs text-hurix-gray">Owner: {c.owner?.email || 'Unassigned'}</p>
              <p
                className="text-xs text-hurix-gray"
                title={toIstTitle(c.lastActivityAt || c.createdAt) || formatIstDateTime(c.lastActivityAt || c.createdAt)}
              >
                Last activity: {formatRelativeTime(c.lastActivityAt || c.createdAt)}
              </p>
              <div className="flex flex-wrap gap-2 text-xs items-center">
                {statusBadge(c.assessmentStatus)}
                {c.score != null ? (
                  <button
                    type="button"
                    className="text-hurix-blue font-medium"
                    onClick={() => setScoreCandidateId(c.id)}
                  >
                    {c.scoreLabel || `${c.score}/10`}
                  </button>
                ) : (
                  <span className="text-hurix-gray">{c.scoreLabel || 'No Assessment'}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue text-sm font-medium">View</Link>
                <button
                  onClick={() => openResumePreview(c.id, c.fullName)}
                  className="text-hurix-blue text-sm font-medium"
                  disabled={loadingResumeId === c.id}
                >
                  {loadingResumeId === c.id ? 'Opening...' : 'Resume'}
                </button>
                <Link to={`/admin/candidates/${c.id}?view=assessment`} className="text-hurix-blue text-sm font-medium flex items-center gap-1">
                  <ClipboardList size={14} /> Assessment
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block card-premium overflow-visible p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs min-w-[1280px]">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-2 py-3 text-left">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={headerChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = headerIndeterminate;
                      }}
                      onChange={() => {
                        if (selection.mode === 'ALL_MATCHING' && selection.effectiveCount === totalMatching) {
                          selection.clearSelection();
                        } else if (totalMatching > 0) {
                          setModal('selectAll');
                        }
                      }}
                      aria-label="Select all matching candidates"
                    />
                  )}
                </th>
                <th className="px-2 py-3 text-left font-semibold">App ID</th>
                <SortableTh label="Name" column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th className="px-2 py-3 text-left font-semibold">Email</th>
                <th className="px-2 py-3 text-left font-semibold">Phone</th>
                <SortableTh label="Country" column="country" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Experience" column="experience" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Role" column="assignedRole" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Assessment" column="assessmentStatus" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Score" column="score" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Registered" column="registeredAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th className="px-2 py-3 text-left font-semibold">Owner</th>
                <SortableTh label="Last Activity" column="lastActivity" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th className="px-2 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={14} className="p-8 text-center text-hurix-gray">Loading...</td></tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-hurix-gray">
                    <p className="mb-3">No candidates match the current filters.</p>
                    <button type="button" className="btn-secondary text-sm" onClick={clearAllFilters}>
                      Clear All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                data?.data.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-2 py-2.5">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleId(c.id)}
                          aria-label={`Select ${c.fullName}`}
                        />
                      )}
                    </td>
                    <td className="truncate px-2 py-2.5 font-mono">
                      <TruncatedText text={c.applicationId || c.id.slice(0, 8).toUpperCase()} />
                    </td>
                    <td className="truncate px-2 py-2.5 font-medium">
                      <TruncatedText text={c.fullName} />
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      <div className="inline-flex min-w-0 items-center gap-1 max-w-full">
                        <TruncatedText text={c.email} className="min-w-0" />
                        <button
                          type="button"
                          onClick={(e) => copyEmailAddress(c.email, e)}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 text-hurix-charcoal hover:bg-slate-50"
                          title={copiedEmail === c.email ? 'Copied' : 'Copy email address'}
                          aria-label="Copy email address"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">{phoneActions(c.phone)}</td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      <TruncatedText text={c.countryName || c.phoneCountry || '—'} />
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      <TruncatedText text={c.experienceLabel || '—'} />
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      <TruncatedText text={c.roleLabel || c.appliedRole || 'Not Assigned'} />
                    </td>
                    <td className="px-2 py-2.5">{statusBadge(c.assessmentStatus)}</td>
                    <td className="px-2 py-2.5">
                      {c.score != null ? (
                        <button
                          type="button"
                          className="text-hurix-blue hover:underline font-medium"
                          onClick={() => setScoreCandidateId(c.id)}
                          aria-label={`View score breakdown for ${c.fullName}`}
                        >
                          {c.scoreLabel || `${c.score}/10`}
                        </button>
                      ) : (
                        <span className="text-hurix-gray">{c.scoreLabel || 'No Assessment'}</span>
                      )}
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      <TruncatedText text={formatDate(c.createdAt)} />
                    </td>
                    <td className="truncate px-2 py-2.5 text-hurix-gray">
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          className="text-left hover:text-hurix-blue truncate max-w-full"
                          onClick={() => setOwnerModalCandidate(c)}
                          title={c.owner?.email || 'Assign owner'}
                        >
                          <TruncatedText text={c.owner?.email || 'Unassigned'} />
                        </button>
                      ) : (
                        <TruncatedText text={c.owner?.email || 'Unassigned'} />
                      )}
                    </td>
                    <td
                      className="truncate px-2 py-2.5 text-hurix-gray"
                      title={formatIstDateTime(c.lastActivityAt || c.createdAt)}
                    >
                      <TruncatedText text={formatRelativeTime(c.lastActivityAt || c.createdAt)} />
                    </td>
                    <td className="px-2 py-2.5 relative">
                      <div className="flex items-center gap-1">
                        {canManage ? (
                          <CandidateRowMenu
                            candidateId={c.id}
                            candidateName={c.fullName}
                            onSendReminder={() => openAction('reminder', c.id)}
                            onChangeStatus={() => openAction('status', c.id)}
                            onAssignRole={() => openAction('role', c.id)}
                            onReject={() => openAction('reject', c.id)}
                            onScheduleInterview={() => openAction('interview', c.id)}
                            onExport={() => {
                              setBusy(true);
                              exportCandidatesAdvanced({
                                scope: 'SELECTED',
                                format: 'csv',
                                selection: selection.singlePayload(c.id),
                              }).finally(() => setBusy(false));
                            }}
                            onDelete={() => openAction('delete', c.id)}
                          />
                        ) : (
                          <div className="flex min-w-0 flex-col gap-0.5 text-[11px]">
                            <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue hover:underline">View</Link>
                            <button
                              onClick={() => openResumePreview(c.id, c.fullName)}
                              className="text-left text-hurix-blue hover:underline"
                              disabled={loadingResumeId === c.id}
                            >
                              {loadingResumeId === c.id ? 'Opening...' : 'Resume'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-hurix-gray">
            <span>Rows per page</span>
            <select
              className="input-field w-auto py-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span>
              Page {pagination?.page || page} of {totalPages} · {totalMatching} total
            </span>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              type="button"
              disabled={!pagination?.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 7) {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                pageNum = start + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded text-sm ${page === pageNum ? 'bg-hurix-blue text-white' : 'bg-white border'}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              disabled={!pagination?.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded border text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modal === 'selectAll' && (
        <SelectAllConfirmModal
          total={totalMatching}
          onClose={() => setModal(null)}
          onConfirm={() => selection.activateAllMatching()}
        />
      )}
      {modal === 'status' && (
        <StatusChangeModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async (newStatus) => {
            await runAction(() => bulkChangeStatus(resolveSelection(), newStatus), false, 'status');
          }}
        />
      )}
      {modal === 'reject' && (
        <RejectModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await runAction(() => bulkReject(resolveSelection(), reason), false, 'reject');
          }}
        />
      )}
      {modal === 'role' && (
        <AssignRoleModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async (jobRoleId) => {
            await runAction(() => bulkAssignRole(resolveSelection(), jobRoleId), false, 'role');
          }}
        />
      )}
      {modal === 'reminder' && (
        <ReminderModal
          count={actionCount}
          lastResult={bulkResult}
          onClose={() => setModal(null)}
          onConfirm={async (templateId) => {
            await runAction(
              () => bulkSendReminders(resolveSelection(), templateId, crypto.randomUUID()),
              false,
              'reminder'
            );
          }}
          onRetryFailed={async (templateId, failedIds) => {
            await runAction(
              () =>
                bulkSendReminders(
                  { mode: 'IDS', candidateIds: failedIds },
                  templateId,
                  crypto.randomUUID()
                ),
              false,
              'reminder'
            );
          }}
        />
      )}
      {modal === 'delete' && (
        <DeleteConfirmModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await runAction(() => bulkSoftDelete(resolveSelection()), true, 'delete');
          }}
        />
      )}
      {modal === 'interview' && (
        <InterviewModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async (payload) => {
            await runAction(
              () =>
                scheduleInterview({
                  ...payload,
                  selection: resolveSelection(),
                }),
              false,
              'interview'
            );
          }}
        />
      )}
      {modal === 'export' && (
        <ExportModal
          count={selection.effectiveCount}
          matchingTotal={totalMatching}
          hasSelection={selection.hasSelection}
          onClose={() => setModal(null)}
          onConfirm={async (scope, format) => {
            await runExport(scope, format);
          }}
        />
      )}

      {scoreCandidateId && (
        <ScoreBreakdownDrawer
          candidateId={scoreCandidateId}
          onClose={() => setScoreCandidateId(null)}
        />
      )}

      {ownerModalCandidate && (
        <OwnerAssignModal
          candidateName={ownerModalCandidate.fullName}
          currentOwner={ownerModalCandidate.owner || null}
          onClose={() => setOwnerModalCandidate(null)}
          onConfirm={async (nextOwnerId) => {
            await assignCandidateOwner(ownerModalCandidate.id, nextOwnerId);
            await queryClient.invalidateQueries({ queryKey: ['candidates'] });
          }}
        />
      )}

      {resumePreview && (
        <ResumePreviewModal
          url={resumePreview.url}
          filename={resumePreview.filename}
          onClose={closeResumePreview}
        />
      )}
    </AdminLayout>
  );
}
