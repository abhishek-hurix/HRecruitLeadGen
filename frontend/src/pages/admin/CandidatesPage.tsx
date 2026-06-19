import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Download, ClipboardList, Copy, Phone } from 'lucide-react';
import { ResumePreviewModal } from '../../components/admin/ResumePreviewModal';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getCandidates, exportCandidatesCSV, getResumePreviewUrl, getJobRoles } from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { formatDate } from '../../utils/validation';
import { EXPERIENCE_OPTIONS } from '../../utils/experience';

export function CandidatesPage() {
  const { hasPermission } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [experience, setExperience] = useState('');
  const [country, setCountry] = useState('');
  const [minScore, setMinScore] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const canExport = hasPermission('export_candidates');

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', search, status, experience, country, minScore, role, page],
    queryFn: () =>
      getCandidates({
        search,
        status,
        experience,
        country,
        minScore: minScore ? Number(minScore) : undefined,
        role: role === 'all' ? undefined : role,
        page,
      }),
  });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      SUBMITTED: 'bg-green-100 text-green-700',
      STARTED: 'bg-amber-100 text-amber-700',
      VERIFIED: 'bg-blue-100 text-blue-700',
      EMAIL_SENT: 'bg-indigo-100 text-indigo-700',
      REGISTERED: 'bg-slate-100 text-slate-600',
      EXPIRED: 'bg-red-100 text-red-700',
      NOT_STARTED: 'bg-slate-100 text-slate-600',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colors[s] || colors.REGISTERED}`}>
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  useEffect(() => {
    return () => {
      if (resumePreview) {
        window.URL.revokeObjectURL(resumePreview.url);
      }
    };
  }, [resumePreview]);

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
    await navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    window.setTimeout(() => setCopiedPhone((current) => (current === phone ? null : current)), 1500);
  };

  const phoneActions = (phone: string) => (
    <div className="inline-flex items-center gap-2">
      <span>{phone}</span>
      <button
        type="button"
        onClick={() => copyPhoneNumber(phone)}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-hurix-charcoal hover:bg-slate-50"
        title="Copy phone number"
      >
        <Copy size={12} />
        {copiedPhone === phone ? 'Copied' : 'Copy'}
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

  const activeRoleFilters = (rolesData?.data || [])
    .filter((jobRole) => jobRole.status === 'ACTIVE')
    .map((jobRole) => ({ label: jobRole.title, value: jobRole.title }));
  const candidateRoleFilters = (data?.roleFilters || []).map((roleName) => ({ label: roleName, value: roleName }));
  const roleFilters = Array.from(
    new Map([...activeRoleFilters, ...candidateRoleFilters].map((filter) => [filter.label.toLowerCase(), filter])).values(),
  );

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal">Candidates</h1>
        {canExport && (
          <button onClick={() => exportCandidatesCSV()} className="btn-secondary flex items-center justify-center gap-2 text-sm w-full sm:w-auto">
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setRole('all'); setPage(1); }}
          className={`rounded-full px-4 py-2 text-sm font-medium ${role === 'all' ? 'bg-hurix-blue text-white' : 'bg-white text-hurix-gray border hover:text-hurix-blue'}`}
        >
          All
        </button>
        {roleFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => { setRole(filter.value); setPage(1); }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${role === filter.value ? 'bg-hurix-blue text-white' : 'bg-white text-hurix-gray border hover:text-hurix-blue'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={18} />
          <input className="input-field pl-10" placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select className="input-field" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Journey Status</option>
            <option value="REGISTERED">Registered</option>
            <option value="EMAIL_SENT">Email Sent</option>
            <option value="VERIFIED">Verified</option>
            <option value="STARTED">Started</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="EXPIRED">Expired</option>
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
          <input className="input-field" placeholder="Filter by country..." value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} />
          <select className="input-field" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }}>
            <option value="">All Scores</option>
            {Array.from({ length: 11 }, (_, score) => (
              <option key={score} value={score}>
                {score}/10 and above
              </option>
            ))}
          </select>
          <select className="input-field" value={role.startsWith('all') || roleFilters.some((filter) => filter.value === role) ? '' : role} onChange={(e) => { setRole(e.target.value || 'all'); setPage(1); }}>
            <option value="">All Job Roles</option>
            {(rolesData?.data || []).map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          <p className="text-center text-hurix-gray py-8">Loading...</p>
        ) : data?.data.length === 0 ? (
          <p className="text-center text-hurix-gray py-8">No candidates found</p>
        ) : (
          data?.data.map((c) => (
            <div key={c.id} className="card-premium p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold text-hurix-charcoal">{c.fullName}</p>
                  <p className="text-xs text-hurix-gray font-mono">{c.applicationId || c.id.slice(0, 8)}</p>
                </div>
                {statusBadge(c.journeyStatus)}
              </div>
              <p className="text-sm text-hurix-gray break-all">{c.email}</p>
              <div className="text-sm text-hurix-gray">
                {phoneActions(c.phone)}
                <span className="ml-2">· {c.phoneCountry || '—'}</span>
              </div>
              {c.experienceLabel && (
                <p className="text-sm text-hurix-charcoal">{c.experienceLabel}</p>
              )}
              {c.appliedRole && (
                <p className="text-xs font-medium text-hurix-blue">{c.appliedRole}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {statusBadge(c.assessmentStatus)}
                <span className="text-hurix-gray">{c.score !== null ? `Score: ${c.score}/10` : 'No score'}</span>
              </div>
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue text-sm font-medium">View</Link>
                <button onClick={() => openResumePreview(c.id, c.fullName)} className="text-hurix-blue text-sm font-medium" disabled={loadingResumeId === c.id}>
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
      <div className="hidden lg:block card-premium overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 font-semibold whitespace-nowrap">App ID</th>
              <th className="text-left p-3 font-semibold">Name</th>
              <th className="text-left p-3 font-semibold">Email</th>
              <th className="text-left p-3 font-semibold">Phone</th>
              <th className="text-left p-3 font-semibold">Country</th>
              <th className="text-left p-3 font-semibold">Experience</th>
              <th className="text-left p-3 font-semibold">Role</th>
              <th className="text-left p-3 font-semibold">Assessment</th>
              <th className="text-left p-3 font-semibold">Score</th>
              <th className="text-left p-3 font-semibold">Registered</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="p-8 text-center text-hurix-gray">Loading...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-hurix-gray">No candidates found</td></tr>
            ) : (
              data?.data.map((c) => (
                <tr key={c.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{c.applicationId || c.id.slice(0, 8).toUpperCase()}</td>
                  <td className="p-3 font-medium">{c.fullName}</td>
                  <td className="p-3 text-hurix-gray max-w-[140px] truncate">{c.email}</td>
                  <td className="p-3 text-hurix-gray whitespace-nowrap text-xs">{phoneActions(c.phone)}</td>
                  <td className="p-3 text-hurix-gray">{c.phoneCountry || '—'}</td>
                  <td className="p-3 text-hurix-gray whitespace-nowrap">{c.experienceLabel || '—'}</td>
                  <td className="p-3 text-hurix-gray whitespace-nowrap text-xs">{c.appliedRole || '—'}</td>
                  <td className="p-3">{statusBadge(c.assessmentStatus)}</td>
                  <td className="p-3">{c.score !== null ? `${c.score}/10` : '—'}</td>
                  <td className="p-3 text-hurix-gray whitespace-nowrap text-xs">{formatDate(c.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <Link to={`/admin/candidates/${c.id}?view=profile`} className="text-hurix-blue hover:underline text-xs">View</Link>
                      <button onClick={() => openResumePreview(c.id, c.fullName)} className="text-hurix-blue hover:underline text-xs text-left" disabled={loadingResumeId === c.id}>
                        {loadingResumeId === c.id ? 'Opening...' : 'Resume'}
                      </button>
                      <Link to={`/admin/candidates/${c.id}?view=assessment`} className="text-hurix-blue hover:underline text-xs flex items-center gap-1"><ClipboardList size={12} /> Assessment</Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {Array.from({ length: data.pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded text-sm ${page === i + 1 ? 'bg-hurix-blue text-white' : 'bg-white border'}`}>
              {i + 1}
            </button>
          ))}
        </div>
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
