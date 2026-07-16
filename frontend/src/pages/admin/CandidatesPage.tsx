import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ClipboardList, Copy, Phone, UserPlus, ChevronLeft, ChevronRight, Eye, FileText, Mail, Briefcase, UserX, Trash2, FlaskConical, ListChecks } from 'lucide-react';
import { LinkedInBrandIcon, WhatsAppBrandIcon } from '../../components/ui/BrandSocialIcons';
import { Link } from 'react-router-dom';
import { ResumePreviewModal } from '../../components/admin/ResumePreviewModal';
import { CountryMultiSelect } from '../../components/admin/CountryMultiSelect';
import { DateRangeCalendarFilter } from '../../components/admin/DateRangeCalendarFilter';
import { SortableTh } from '../../components/admin/SortableTh';
import { ScoreBreakdownDrawer } from '../../components/admin/ScoreBreakdownDrawer';
import { OwnerAssignModal } from '../../components/admin/OwnerAssignModal';
import { TruncatedText } from '../../components/ui/TruncatedText';
import {
  AssignRoleModal,
  DeleteConfirmModal,
  ExportModal,
  InterviewModal,
  MarkTestUsersModal,
  RejectModal,
  ReminderModal,
  ShortlistModal,
  StatusChangeModal,
  WhatsAppSendModal,
} from '../../components/admin/CandidateActionModals';
import {
  EmailSendProgressBanner,
  type EmailSendProgressState,
} from '../../components/admin/EmailSendProgressBanner';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  getCandidates,
  getAdminCountries,
  assignCandidateOwner,
  exportCandidatesAdvanced,
  getJobRoles,
  getResumePreviewUrl,
  bulkChangeStatus,
  bulkReject,
  bulkShortlist,
  bulkAssignRole,
  bulkSoftDelete,
  bulkSendReminders,
  scheduleInterview,
  bulkMarkTestUsers,
  type BulkResult,
  type SelectionPayload,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import { EXPERIENCE_OPTIONS } from '../../utils/experience';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { createClientId } from '../../utils/id';
import {
  clampPage,
  getPageRange,
} from '../../types/candidate-management';
import { cycleSort, type SortDirection } from '../../utils/candidate-list-ui';
import { FALLBACK_COUNTRIES } from '../../utils/iso-countries';
import { formatRelativeTime, formatIstDateTime, formatIstDate } from '../../utils/activity';
import type { Candidate } from '../../types';

type ModalKind =
  | null
  | 'status'
  | 'reject'
  | 'shortlist'
  | 'role'
  | 'reminder'
  | 'delete'
  | 'testUser'
  | 'interview'
  | 'export';

export function CandidatesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('manage_candidates');
  const canExport = hasPermission('export_candidates');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [experience, setExperience] = useState('');
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [minScore, setMinScore] = useState('');
  const [role, setRole] = useState('all');
  const [assessmentStatus, setAssessmentStatus] = useState<'' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED'>('');
  const [inactivityPreset, setInactivityPreset] = useState<'' | '7' | '15' | '30' | '45' | 'custom'>('');
  const [inactivityCustom, setInactivityCustom] = useState('');
  const inactivityDays = inactivityPreset === 'custom' ? inactivityCustom : inactivityPreset;
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [actionTarget, setActionTarget] = useState<'bulk' | string>('bulk');
  const [ownerModalCandidate, setOwnerModalCandidate] = useState<Candidate | null>(null);
  const [whatsappCandidate, setWhatsappCandidate] = useState<Candidate | null>(null);
  const [scoreCandidateId, setScoreCandidateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'status' | 'reminder' | 'role' | 'reject' | 'shortlist' | 'interview' | 'export' | 'delete' | 'testUser' | null>(null);
  const [listError, setListError] = useState<{ message: string; requestId?: string } | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [emailProgress, setEmailProgress] = useState<EmailSendProgressState | null>(null);
  const emailStuckTimerRef = useRef<number | null>(null);
  const emailSuccessTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const assessmentStatusFilter = assessmentStatus ? `ASSESSMENT_${assessmentStatus}` : '';

  const filters = useMemo(
    () => ({
      search,
      status: assessmentStatusFilter,
      experience,
      country: '',
      countryCodes,
      minScore,
      role: role !== 'na' ? role : 'all',
      roleAssignment: role === 'na' ? 'na' : 'all',
      registeredFrom,
      registeredTo,
      datePreset: registeredFrom || registeredTo ? 'custom' : '',
      ownerId: '',
      inactivityDays,
      sortBy: sortBy || '',
      sortOrder: sortOrder || '',
    }),
    [
      search,
      assessmentStatusFilter,
      experience,
      countryCodes,
      minScore,
      role,
      registeredFrom,
      registeredTo,
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'candidates',
      search,
      assessmentStatus,
      experience,
      countryCodes,
      minScore,
      role,
      registeredFrom,
      registeredTo,
      inactivityDays,
      sortBy,
      sortOrder,
      page,
      pageSize,
    ],
    queryFn: () =>
      getCandidates({
        search,
        status: assessmentStatusFilter || undefined,
        experience,
        countryCodes: countryCodes.length ? countryCodes : undefined,
        minScore:
          minScore === 'na' ? 'na' : minScore !== '' ? Number(minScore) : undefined,
        role: role !== 'all' && role !== 'na' ? role : undefined,
        roleAssignment: role === 'na' ? 'na' : undefined,
        registeredFrom: registeredFrom || undefined,
        registeredTo: registeredTo || undefined,
        datePreset: registeredFrom || registeredTo ? 'custom' : undefined,
        inactivityDays:
          inactivityDays && Number.isFinite(Number(inactivityDays)) && Number(inactivityDays) >= 1
            ? Number(inactivityDays)
            : undefined,
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

  useEffect(() => {
    if (!headerMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!headerMenuRef.current?.contains(e.target as Node)) setHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [headerMenuOpen]);

  const resolveSelection = (): SelectionPayload => {
    if (actionTarget === 'bulk') return selection.toPayload();
    return selection.singlePayload(actionTarget);
  };

  const actionCount = actionTarget === 'bulk' ? selection.effectiveCount : 1;

  const clearEmailTimers = () => {
    if (emailStuckTimerRef.current != null) {
      window.clearTimeout(emailStuckTimerRef.current);
      emailStuckTimerRef.current = null;
    }
    if (emailSuccessTimerRef.current != null) {
      window.clearTimeout(emailSuccessTimerRef.current);
      emailSuccessTimerRef.current = null;
    }
  };

  useEffect(() => () => clearEmailTimers(), []);

  const bumpEmailActivity = () => {
    if (emailStuckTimerRef.current != null) {
      window.clearTimeout(emailStuckTimerRef.current);
    }
    emailStuckTimerRef.current = window.setTimeout(() => {
      setEmailProgress((prev) => (prev && prev.status === 'sending' ? { ...prev, stuck: true } : prev));
    }, 45000);
  };

  const startReminderSend = async (templateId: string) => {
    const payload = resolveSelection();
    const total = Math.max(1, actionCount);
    clearEmailTimers();
    setModal(null);
    setEmailProgress({
      total,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      status: 'sending',
      errors: [],
      stuck: false,
    });
    bumpEmailActivity();

    const applyDone = (next: EmailSendProgressState) => {
      clearEmailTimers();
      setEmailProgress(next);
      const hasIssues = next.failed > 0 || next.skipped > 0 || next.errors.length > 0;
      if (!hasIssues) {
        emailSuccessTimerRef.current = window.setTimeout(() => setEmailProgress(null), 5000);
      }
    };

    try {
      // One bulk request (IDS or ALL_MATCHING) — avoids http://EC2 crypto.randomUUID crash
      // and bulk rate-limit from N sequential calls. Soft ticks animate progress.
      let soft = 0;
      const tickMs = Math.max(350, Math.min(1800, Math.floor(12000 / Math.max(total, 1))));
      const tickId = window.setInterval(() => {
        soft = Math.min(total - 1, soft + 1);
        bumpEmailActivity();
        setEmailProgress((prev) =>
          prev && prev.status === 'sending'
            ? { ...prev, processed: soft, stuck: false }
            : prev
        );
      }, tickMs);

      try {
        const result = await bulkSendReminders(payload, templateId, createClientId('reminder'));
        window.clearInterval(tickId);
        await refreshAfterMutation(result, false);
        const sent = result.summary?.succeeded ?? 0;
        const failed = result.summary?.failed ?? 0;
        const skipped = result.summary?.skipped ?? 0;
        const requested = result.summary?.requested ?? total;
        applyDone({
          total: requested,
          processed: requested,
          sent,
          failed,
          skipped,
          status: 'done',
          errors: (result.errors || []).map((err) => ({
            candidateId: err.candidateId,
            message: err.message,
          })),
          stuck: false,
        });
      } catch (e) {
        window.clearInterval(tickId);
        throw e;
      }
    } catch (e) {
      applyDone({
        total,
        processed: 0,
        sent: 0,
        failed: total,
        skipped: 0,
        status: 'error',
        message: getAdminActionErrorMessage(e),
        errors: [{ message: getAdminActionErrorMessage(e) }],
        stuck: false,
      });
    }
  };

  const refreshAfterMutation = async (_result?: BulkResult, clearAfter = false) => {
    await queryClient.invalidateQueries({ queryKey: ['candidates'] });
    await queryClient.invalidateQueries({ queryKey: ['test-users'] });
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
    try {
      const result = await fn();
      await refreshAfterMutation(result, clearAfter);
      return result;
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
    const label = s.replace(/_/g, ' ');
    return (
      <span
        className={`inline-block max-w-full truncate px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${colors[s] || colors.REGISTERED}`}
        title={label}
      >
        {label}
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
    <div className="inline-flex min-w-0 max-w-full items-center gap-1">
      <TruncatedText text={phone || '—'} className="min-w-0" />
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

  const socialActions = (c: Candidate) => {
    const linkedinHref = c.linkedinUrl?.trim() || '';
    const hasPhone = Boolean((c.phone || '').replace(/\D/g, ''));
    const iconBtn =
      'inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:opacity-90 hover:scale-105';
    const iconBtnDisabled = `${iconBtn} opacity-30 pointer-events-none grayscale`;

    return (
      <div className="inline-flex items-center justify-center gap-1">
        {linkedinHref ? (
          <a
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            className={iconBtn}
            title="Open LinkedIn"
            aria-label="Open LinkedIn profile"
          >
            <LinkedInBrandIcon size={16} />
          </a>
        ) : (
          <span className={iconBtnDisabled} title="No LinkedIn URL" aria-hidden>
            <LinkedInBrandIcon size={16} />
          </span>
        )}
        {hasPhone ? (
          <button
            type="button"
            onClick={() => setWhatsappCandidate(c)}
            className={iconBtn}
            title="Send WhatsApp message"
            aria-label="Send WhatsApp message"
          >
            <WhatsAppBrandIcon size={16} />
          </button>
        ) : (
          <span className={iconBtnDisabled} title="No phone number" aria-hidden>
            <WhatsAppBrandIcon size={16} />
          </span>
        )}
      </div>
    );
  };

  const rowActions = (c: Candidate) => (
    <div className="inline-flex items-center gap-0.5">
      <Link
        to={`/admin/candidates/${c.id}?view=profile`}
        className="action-glass-icon"
        title="View profile"
        aria-label={`View ${c.fullName}`}
      >
        <Eye size={12} strokeWidth={2.25} />
      </Link>
      <button
        type="button"
        onClick={() => openResumePreview(c.id, c.fullName)}
        className="action-glass-icon"
        disabled={loadingResumeId === c.id}
        title="Preview resume"
        aria-label={`Preview resume for ${c.fullName}`}
      >
        <FileText size={12} strokeWidth={2.25} />
      </button>
      <Link
        to={`/admin/candidates/${c.id}?view=assessment`}
        className="action-glass-icon"
        title="View Assessment"
        aria-label={`View assessment for ${c.fullName}`}
      >
        <ClipboardList size={12} strokeWidth={2.25} />
      </Link>
    </div>
  );

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setExperience('');
    setCountryCodes([]);
    setMinScore('');
    setRole('all');
    setAssessmentStatus('');
    setInactivityPreset('');
    setInactivityCustom('');
    setRegisteredFrom('');
    setRegisteredTo('');
    setSortBy(null);
    setSortOrder(null);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      experience ||
      countryCodes.length ||
      minScore ||
      (role && role !== 'all') ||
      assessmentStatus ||
      inactivityDays ||
      registeredFrom ||
      registeredTo
  );

  const listTotalRef = useRef(0);
  useEffect(() => {
    if (!hasActiveFilters) listTotalRef.current = totalMatching;
  }, [hasActiveFilters, totalMatching]);
  const listTotal = hasActiveFilters ? listTotalRef.current : totalMatching;

  const handleSort = (column: string) => {
    const next = cycleSort(sortBy, sortOrder, column);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  };

  const filterSnapshot = {
    search: search || undefined,
    status: assessmentStatusFilter || null,
    experience: experience || null,
    country: null,
    countryCodes: countryCodes.length ? countryCodes : null,
    minScore: minScore && minScore !== 'na' ? Number(minScore) : null,
    noScore: minScore === 'na' ? true : null,
    role: role !== 'all' && role !== 'na' ? role : null,
    roleAssignment: role === 'na' ? 'na' : null,
    registeredFrom: registeredFrom || null,
    registeredTo: registeredTo || null,
    datePreset: registeredFrom || registeredTo ? 'custom' : null,
    ownerId: null,
    inactivityDays:
      inactivityDays && Number.isFinite(Number(inactivityDays)) && Number(inactivityDays) >= 1
        ? Number(inactivityDays)
        : null,
    sortBy: sortBy || null,
    sortOrder: sortOrder || null,
  };

  const runExport = async (scope: 'SELECTED' | 'FILTERED' | 'ALL_ACTIVE', format: 'csv' | 'xlsx') => {
    setBusy(true);
    setBusyAction('export');
    try {
      await exportCandidatesAdvanced({
        scope,
        format,
        selection: scope === 'SELECTED' ? selection.toPayload() : undefined,
        filters: filterSnapshot,
      });
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
  const range = getPageRange(pagination?.page || page, pageSize, totalMatching);

  const paginationControls = data ? (
    <div className="flex flex-wrap items-center justify-start gap-2 text-xs text-hurix-gray">
      <DateRangeCalendarFilter
        from={registeredFrom}
        to={registeredTo}
        onChange={({ from, to }) => {
          setRegisteredFrom(from);
          setRegisteredTo(to);
          setPage(1);
        }}
      />
      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap">rows</span>
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
      <span className="tabular-nums whitespace-nowrap">
        {totalMatching === 0 ? '0–0 of 0' : `${range.from}–${range.to} of ${totalMatching}`}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!pagination?.hasPreviousPage}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/50 bg-white/55 text-hurix-charcoal shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-md hover:bg-white/80 hover:border-black/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/55"
          aria-label="Previous page"
          title="Previous"
        >
          <ChevronLeft size={16} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          disabled={!pagination?.hasNextPage}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/50 bg-white/55 text-hurix-charcoal shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-md hover:bg-white/80 hover:border-black/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/55"
          aria-label="Next page"
          title="Next"
        >
          <ChevronRight size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  ) : null;

  const selectedCount = selection.effectiveCount;
  const bulkDisabled = busy || selectedCount <= 0;

  const frameBulkBtn = (
    label: string,
    actionKey: typeof busyAction,
    onClick: () => void,
    Icon: typeof Mail,
    danger = false
  ) => {
    const isActive = busyAction === actionKey;
    return (
      <button
        type="button"
        disabled={bulkDisabled}
        onClick={onClick}
        aria-label={label}
        aria-busy={isActive}
        title={selectedCount <= 0 ? 'Select candidates first' : label}
        className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
          danger
            ? 'border-red-200 text-red-700 hover:bg-red-50'
            : 'border-slate-200 text-hurix-charcoal hover:bg-slate-50'
        }`}
      >
        <Icon size={13} className={isActive ? 'animate-spin' : undefined} />
        {isActive ? `${label}…` : label}
      </button>
    );
  };

  const tableFrameBar = (
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-white overflow-visible">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {canManage && (
          <>
            {selectedCount > 0 && (
              <span className="mr-1 text-[11px] font-semibold text-hurix-blue whitespace-nowrap">
                {selectedCount} selected
              </span>
            )}
            {frameBulkBtn('Send Reminder', 'reminder', () => openAction('reminder'), Mail)}
            {frameBulkBtn('Assign Role', 'role', () => openAction('role'), Briefcase)}
            {frameBulkBtn('Shortlist', 'shortlist', () => openAction('shortlist'), ListChecks)}
            {frameBulkBtn('Reject', 'reject', () => openAction('reject'), UserX)}
            {frameBulkBtn('Test User', 'testUser', () => openAction('testUser'), FlaskConical)}
            {frameBulkBtn('Delete', 'delete', () => openAction('delete'), Trash2, true)}
          </>
        )}
      </div>
      {paginationControls}
    </div>
  );

  return (
    <AdminLayout
      onHeaderSearchChange={setSearchInput}
      headerLeft={(
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-hurix-charcoal leading-tight">Candidates</h1>
          {data && (
            <p className="text-xs sm:text-sm text-hurix-gray mt-0.5 truncate">
              <span className="font-semibold text-hurix-charcoal">{totalMatching}</span> candidates
            </p>
          )}
        </div>
      )}
      headerRight={(
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={() => openAction('export')}
              className="btn-secondary flex items-center justify-center gap-2 text-sm whitespace-nowrap"
              disabled={busy}
            >
              <Download size={16} /> Export
            </button>
          )}
          {canManage && (
            <Link
              to="/admin/candidates/new"
              className="btn-primary flex items-center justify-center gap-2 text-sm whitespace-nowrap"
            >
              <UserPlus size={16} /> Add Candidate
            </Link>
          )}
        </div>
      )}
    >
      {emailProgress && (
        <EmailSendProgressBanner
          progress={emailProgress}
          onDismiss={() => {
            clearEmailTimers();
            setEmailProgress(null);
          }}
        />
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

      <div className="relative z-50 mb-3 flex flex-wrap gap-2 justify-start items-start">
        <button
          type="button"
          onClick={() => { setRole('all'); setPage(1); }}
          className={role === 'all' ? 'filter-chip-active' : 'filter-chip'}
        >
          All
        </button>
        {roleFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => { setRole(filter.value); setPage(1); }}
            className={role === filter.value ? 'filter-chip-active' : 'filter-chip'}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="relative z-50 flex flex-col gap-3 mb-6">
        <div className="filter-tray">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5">
          <select className="filter-glass" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }}>
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
          <select className="filter-glass" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }}>
            <option value="">All Scores</option>
            <option value="na">NA</option>
            {Array.from({ length: 11 }, (_, score) => (
              <option key={score} value={score}>{score}/10 and above</option>
            ))}
          </select>
          <select
            className="filter-glass"
            value={assessmentStatus}
            onChange={(e) => {
              setAssessmentStatus(e.target.value as '' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED');
              setPage(1);
            }}
            aria-label="Assessment status filter"
          >
            <option value="">All Assessment</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted</option>
          </select>
          <select
            className="filter-glass"
            value={role === 'na' ? 'na' : roleFilters.some((f) => f.value === role) ? role : ''}
            onChange={(e) => {
              setRole(e.target.value || 'all');
              setPage(1);
            }}
            aria-label="Specific job role"
          >
            <option value="">Specific Job Role</option>
            <option value="na">NA</option>
            {(rolesData?.data || []).map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 min-w-0">
            <select
              className="filter-glass"
              value={inactivityPreset}
              onChange={(e) => {
                const v = e.target.value as '' | '7' | '15' | '30' | '45' | 'custom';
                setInactivityPreset(v);
                if (v !== 'custom') setInactivityCustom('');
                setPage(1);
              }}
              aria-label="Inactivity filter"
            >
              <option value="">Any activity</option>
              <option value="7">No activity for 7 days</option>
              <option value="15">No activity for 15 days</option>
              <option value="30">No activity for 30 days</option>
              <option value="45">No activity for 45 days</option>
              <option value="custom">Custom…</option>
            </select>
            {inactivityPreset === 'custom' && (
              <input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                placeholder="Days"
                value={inactivityCustom}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, '');
                  setInactivityCustom(next);
                  setPage(1);
                }}
                className="filter-glass w-24 shrink-0"
                style={{ backgroundImage: 'none', paddingRight: '0.75rem' }}
                aria-label="Custom inactivity days"
              />
            )}
          </div>
          </div>
        </div>
      </div>

      {data && (
        <div className="lg:hidden mb-3 rounded-xl border border-slate-100 bg-white overflow-visible">
          {tableFrameBar}
        </div>
      )}

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
            <div key={c.id} className="card-premium space-y-3 overflow-hidden p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={selection.isSelected(c.id)}
                      onChange={() => selection.toggleId(c.id)}
                      aria-label={`Select ${c.fullName}`}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <TruncatedText text={c.fullName} className="font-semibold text-hurix-charcoal" />
                    <TruncatedText
                      text={c.applicationId || c.id.slice(0, 8)}
                      className="font-mono text-xs text-hurix-gray"
                    />
                  </div>
                </div>
                <div className="max-w-[40%] shrink-0">{statusBadge(c.journeyStatus)}</div>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-sm text-hurix-gray">
                <TruncatedText text={c.email} className="min-w-0 flex-1" />
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
              <div className="flex min-w-0 items-center gap-2 text-sm text-hurix-gray">
                <div className="min-w-0 flex-1">{phoneActions(c.phone)}</div>
                <TruncatedText
                  text={c.countryName || c.phoneCountry || '—'}
                  className="max-w-[40%] shrink-0 text-right"
                />
              </div>
              <div className="pt-0.5">{socialActions(c)}</div>
              {c.experienceLabel && (
                <TruncatedText text={c.experienceLabel} className="text-sm text-hurix-charcoal" />
              )}
              <TruncatedText
                text={c.roleLabel || c.appliedRole || 'Not Assigned'}
                className="text-xs font-medium text-hurix-blue"
              />
              <TruncatedText
                text={`Last activity: ${formatRelativeTime(c.lastActivityAt || c.createdAt)}`}
                className="text-xs text-hurix-gray"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="max-w-full">{statusBadge(c.assessmentStatus)}</div>
                {c.score != null ? (
                  <button
                    type="button"
                    className="max-w-full truncate text-hurix-blue font-medium"
                    onClick={() => setScoreCandidateId(c.id)}
                    title={c.scoreLabel || `${c.score}/10`}
                  >
                    {c.scoreLabel || `${c.score}/10`}
                  </button>
                ) : (
                  <TruncatedText text={c.scoreLabel || 'NA'} className="text-hurix-gray" />
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                {rowActions(c)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block card-premium overflow-visible p-0">
        {data && tableFrameBar}
        <div className="w-full overflow-hidden rounded-b-2xl">
          <table className="w-full table-fixed text-[10px] leading-snug">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[5%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[4%]" />
              <col className="w-[7%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-1 py-1.5 text-left">
                  {canManage && (
                    <div className="relative inline-flex" ref={headerMenuRef}>
                      <input
                        type="checkbox"
                        checked={headerChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = headerIndeterminate;
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
                            disabled={totalMatching <= 0}
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              if (totalMatching > 0) selection.activateAllMatching();
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
                  )}
                </th>
                <th className="px-1 py-1.5 text-left font-semibold">App ID</th>
                <SortableTh label="Name" column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5" />
                <th className="px-1 py-1.5 text-left font-semibold">Email</th>
                <th className="px-1 py-1.5 text-left font-semibold">Phone</th>
                <th className="px-1 py-1.5 text-center font-semibold">Social</th>
                <SortableTh label="Country" column="country" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5 !text-right [&_button]:justify-end [&_button]:w-full" />
                <SortableTh label="Experience" column="experience" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5 !text-right [&_button]:justify-end [&_button]:w-full" />
                <SortableTh label="Role" column="assignedRole" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5 !text-right [&_button]:justify-end [&_button]:w-full" />
                <SortableTh label="Assessment" column="assessmentStatus" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5" />
                <SortableTh label="Score" column="score" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5 !text-center [&_button]:justify-center [&_button]:w-full" />
                <SortableTh label="Registered" column="registeredAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5" />
                <SortableTh label="Last Activity" column="lastActivity" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="!px-1 !py-1.5" />
                <th className="px-1 py-1.5 text-center font-semibold">Actions</th>
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
                    <td className="px-1 py-1.5 align-middle">
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleId(c.id)}
                          aria-label={`Select ${c.fullName}`}
                        />
                      )}
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 font-mono align-middle">
                      <TruncatedText text={c.applicationId || c.id.slice(0, 8).toUpperCase()} />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 font-medium align-middle">
                      <TruncatedText text={c.fullName} />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-hurix-gray align-middle">
                      <div className="flex min-w-0 max-w-full items-center gap-1">
                        <TruncatedText text={c.email} className="min-w-0 flex-1" />
                        <button
                          type="button"
                          onClick={(e) => copyEmailAddress(c.email, e)}
                          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-hurix-charcoal hover:bg-slate-50"
                          title={copiedEmail === c.email ? 'Copied' : 'Copy email address'}
                          aria-label="Copy email address"
                        >
                          <Copy size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-hurix-gray align-middle">{phoneActions(c.phone)}</td>
                    <td className="px-1 py-1.5 text-center align-middle">{socialActions(c)}</td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-right text-hurix-gray align-middle">
                      <TruncatedText text={c.countryName || c.phoneCountry || '—'} className="block text-right" />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-right text-hurix-gray align-middle">
                      <TruncatedText text={c.experienceLabel || '—'} className="block text-right" />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-right text-hurix-gray align-middle">
                      <TruncatedText text={c.roleLabel || c.appliedRole || 'Not Assigned'} className="block text-right" />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 align-middle">{statusBadge(c.assessmentStatus)}</td>
                    <td className="max-w-0 px-1 py-1.5 text-center align-middle">
                      {c.score != null ? (
                        <button
                          type="button"
                          className="block w-full max-w-full truncate text-hurix-blue hover:underline font-medium"
                          onClick={() => setScoreCandidateId(c.id)}
                          aria-label={`View score breakdown for ${c.fullName}`}
                          title={c.scoreLabel || `${c.score}/10`}
                        >
                          {c.scoreLabel || `${c.score}/10`}
                        </button>
                      ) : (
                        <TruncatedText text={c.scoreLabel || 'NA'} className="text-hurix-gray" />
                      )}
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-hurix-gray align-middle">
                      <TruncatedText text={formatIstDate(c.createdAt)} />
                    </td>
                    <td className="max-w-0 truncate px-1 py-1.5 text-hurix-gray align-middle">
                      <TruncatedText text={formatIstDateTime(c.lastActivityAt || c.createdAt)} />
                    </td>
                    <td className="px-0.5 py-1.5 align-middle whitespace-nowrap text-center">
                      {rowActions(c)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
      {modal === 'shortlist' && (
        <ShortlistModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await runAction(() => bulkShortlist(resolveSelection()), true, 'shortlist');
          }}
        />
      )}
      {modal === 'testUser' && (
        <MarkTestUsersModal
          count={actionCount}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await runAction(() => bulkMarkTestUsers(resolveSelection()), true, 'testUser');
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
          onClose={() => setModal(null)}
          onConfirm={(templateId) => {
            void startReminderSend(templateId);
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
          listTotal={listTotal}
          allLabel="All active candidates"
          hasSelection={selection.hasSelection}
          hasFilters={hasActiveFilters}
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

      {whatsappCandidate && (
        <WhatsAppSendModal
          candidate={whatsappCandidate}
          onClose={() => setWhatsappCandidate(null)}
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
