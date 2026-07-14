import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, FileText, Phone } from 'lucide-react';
import { ResumePreviewModal } from '../../components/admin/ResumePreviewModal';
import { ActivityTimeline } from '../../components/admin/ActivityTimeline';
import { OwnerAssignModal } from '../../components/admin/OwnerAssignModal';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { GlassModal, glassBtnSecondaryClass } from '../../components/ui/GlassDialog';
import { TruncatedText } from '../../components/ui/TruncatedText';
import {
  assignCandidateOwner,
  getCandidateById,
  getCandidateOwners,
  getCandidateResumePreviewUrl,
  getResumePreviewUrl,
  getSubmissionMarkdown,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { formatDate } from '../../utils/validation';
import { formatSourceLabel } from '../../utils/utm';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
      <span className="shrink-0 text-hurix-gray">{label}</span>
      <TruncatedText text={value} className="max-w-[65%] text-right" />
    </div>
  );
}

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [openingResumeId, setOpeningResumeId] = useState<string | null>(null);
  const [showAllResumes, setShowAllResumes] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState<{ content: string; filename: string } | null>(null);
  const [isOpeningMarkdown, setIsOpeningMarkdown] = useState(false);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = useAdminAuth();
  const canViewRejection = hasPermission('view_rejection_reasons');
  const { data, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidateById(id!),
    enabled: !!id,
  });
  const { data: owners = [] } = useQuery({
    queryKey: ['candidate-owners'],
    queryFn: getCandidateOwners,
    enabled: !!id,
  });
  const resolvedOwner =
    data?.ownerAdmin ||
    data?.owner ||
    (data?.ownerAdminId ? owners.find((o) => o.id === data.ownerAdminId) || null : null);
  const submission = data?.submissions?.[0];
  const detailView = searchParams.get('view') === 'assessment' ? 'assessment' : 'profile';

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

  const openResumePreview = async (resume?: { id: string; fileName: string }) => {
    if (!id || !data?.resumePath) return;
    const resumeId = resume?.id || 'primary';
    setOpeningResumeId(resumeId);
    try {
    const url = resume && resume.id !== 'legacy-primary-resume'
        ? await getCandidateResumePreviewUrl(id, resume.id)
        : await getResumePreviewUrl(id);
      setResumePreview({ url, filename: resume?.fileName || `${data.fullName}_resume.pdf` });
    } finally {
      setOpeningResumeId(null);
    }
  };

  const openMarkdownPreview = async () => {
    if (!submission?.id) return;
    setIsOpeningMarkdown(true);
    try {
      const content = await getSubmissionMarkdown(submission.id);
      setMarkdownPreview({ content, filename: `${data?.fullName || 'candidate'}_assessment.md` });
    } finally {
      setIsOpeningMarkdown(false);
    }
  };

  const downloadMarkdown = () => {
    if (!markdownPreview) return;
    const url = window.URL.createObjectURL(new Blob([markdownPreview.content], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = markdownPreview.filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const copyPhoneNumber = async (phone: string) => {
    await navigator.clipboard.writeText(phone);
    setPhoneCopied(true);
    window.setTimeout(() => setPhoneCopied(false), 1500);
  };

  if (isLoading) {
    return <AdminLayout><p>Loading...</p></AdminLayout>;
  }

  if (!data) {
    return <AdminLayout><p>Candidate not found</p></AdminLayout>;
  }

  const resumes = (data.resumes || []) as Array<{
    id: string;
    fileName: string;
    isPrimary: boolean;
    uploadedAt: string;
  }>;
  const visibleResumes = showAllResumes ? resumes : resumes.slice(0, 6);
  const verificationBadge = (verified: boolean) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
      verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {verified ? 'Yes' : 'No'}
    </span>
  );

  const isRejected = data.selectionStatus === 'REJECTED' || data.journeyStatus === 'REJECTED';
  const isShortlisted = data.selectionStatus === 'SHORTLISTED';
  const isAdminAdded = data.creationSource === 'ADMIN_CREATED';
  const backTo = data.deletedAt
    ? { path: '/admin/deleted-candidates', label: 'Back to Deleted Candidates' }
    : isRejected
      ? { path: '/admin/rejected-candidates', label: 'Back to Rejected Candidates' }
      : isShortlisted
        ? { path: '/admin/shortlisted-candidates', label: 'Back to Shortlisted Candidates' }
        : data.isTestUser
          ? { path: '/admin/test-users', label: 'Back to Test Users' }
          : isAdminAdded
            ? { path: '/admin/added-candidates', label: 'Back to Added Candidates' }
            : { path: '/admin/candidates', label: 'Back to Candidates' };

  return (
    <AdminLayout>
      <Link to={backTo.path} className="mb-3 flex items-center gap-2 text-xs text-hurix-blue hover:underline">
        <ArrowLeft size={14} /> {backTo.label}
      </Link>

      {data.deletedAt && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">This candidate has been soft-deleted</p>
          <p className="mt-1 text-red-700">
            Deleted on {formatDate(data.deletedAt)}.
            {hasPermission('view_deleted_candidates') && (
              <>
                {' '}
                <Link to="/admin/deleted-candidates" className="underline font-medium">
                  View deleted candidates
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {(data.selectionStatus === 'REJECTED' || data.journeyStatus === 'REJECTED') && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <p className="font-semibold">Candidate rejected</p>
          {data.rejectedAt && (
            <p className="mt-1 text-amber-800">Rejected on {formatDate(data.rejectedAt)}</p>
          )}
          {canViewRejection && data.rejectionReason && (
            <p className="mt-2 text-amber-900">
              <span className="font-medium">Internal reason:</span> {data.rejectionReason}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="min-w-0 text-xl font-bold text-hurix-charcoal">
          <TruncatedText text={data.fullName} className="font-bold" />
        </h1>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {detailView === 'profile' && (
        <>
          <div className="card-premium space-y-2.5 overflow-hidden p-4">
          <h2 className="mb-2 text-base font-semibold">Profile</h2>
          <DetailRow label="Name" value={data.fullName} />
          <DetailRow label="Email" value={data.user.email} />
          <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
            <span className="shrink-0 text-hurix-gray">Phone</span>
            <span className="inline-flex min-w-0 max-w-[70%] flex-wrap items-center justify-end gap-2 text-right">
              <TruncatedText text={String(data.fullPhone || data.phone || '—')} className="max-w-full text-right" />
              <button
                type="button"
                onClick={() => copyPhoneNumber(data.fullPhone || data.phone)}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-hurix-charcoal hover:bg-slate-50"
              >
                <Copy size={10} />
                {phoneCopied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`tel:${String(data.fullPhone || data.phone).replace(/[^\d+]/g, '')}`}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-green-200 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 lg:hidden"
              >
                <Phone size={12} />
                Call
              </a>
            </span>
          </div>
          <DetailRow label="Country" value={data.countryName || data.phoneCountry || '—'} />
          <DetailRow label="Country Code" value={String(data.phoneCountryIso || data.countryCode || '—')} />
          <DetailRow label="Years of Experience" value={String(data.yearsOfExperience ?? '—')} />
          <DetailRow label="Experience Category" value={data.experienceLabel || '—'} />
          <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
            <span className="shrink-0 text-hurix-gray">LinkedIn</span>
            {data.linkedinUrl ? (
              <a
                href={data.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 max-w-[65%] text-hurix-blue"
              >
                <TruncatedText text={data.linkedinUrl} className="text-hurix-blue" />
              </a>
            ) : (
              <span>—</span>
            )}
          </div>
          <DetailRow label="Role" value={data.appliedRole || 'Not Assigned'} />
          <div className="flex min-w-0 items-start justify-between gap-4 text-xs">
            <span className="shrink-0 text-hurix-gray">Owner</span>
            <span className="inline-flex min-w-0 max-w-[70%] items-center justify-end gap-2 text-right">
              <TruncatedText text={resolvedOwner?.email || 'Not Assigned'} className="min-w-0" />
              {isSuperAdmin && (
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-hurix-blue underline"
                  onClick={() => setShowOwnerModal(true)}
                >
                  {resolvedOwner || data.ownerAdminId ? 'Reassign' : 'Assign'}
                </button>
              )}
            </span>
          </div>
          <DetailRow label="Referral" value={data.referralCode || '-'} />
          <div className="flex justify-between text-xs"><span className="text-hurix-gray">Email Verified</span>{verificationBadge(Boolean(data.emailVerified))}</div>
          <DetailRow label="Journey Status" value={data.journeyStatus?.replace(/_/g, ' ') || '-'} />
          </div>

          <div className="card-premium space-y-2.5 overflow-hidden p-4">
            <h2 className="mb-2 text-base font-semibold">Applied Position</h2>
          <DetailRow label="Role" value={data.selectedRoleName || '—'} />
          <DetailRow label="Country" value={data.selectedCountry || '—'} />
          <DetailRow label="Compensation" value={data.selectedCompensation || '—'} />
          <DetailRow label="Selected On" value={data.roleSelectedAt ? formatDate(data.roleSelectedAt) : '—'} />
          {Array.isArray(data.selectedSkills) && data.selectedSkills.length > 0 && (
            <div className="pt-2">
              <p className="text-hurix-gray text-sm mb-2">Skills</p>
              <div className="flex flex-wrap gap-1">
                {(data.selectedSkills as string[]).map((s) => (
                  <span key={s} className="max-w-full truncate px-2 py-0.5 bg-hurix-blue/10 text-hurix-blue text-xs rounded-full" title={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          </div>

          <div className="card-premium space-y-2.5 overflow-hidden p-4">
            <h2 className="mb-2 text-base font-semibold">Acquisition</h2>
          <DetailRow label="Source" value={formatSourceLabel(data.utmSource)} />
          <DetailRow label="Medium" value={data.utmMedium || '-'} />
          <DetailRow label="Campaign" value={data.utmCampaign || '-'} />
          <DetailRow label="First Touch" value={formatSourceLabel(data.firstTouchSource)} />
          <DetailRow label="Last Touch" value={formatSourceLabel(data.lastTouchSource)} />
          <DetailRow label="Landing Page" value={data.attributionLandingPage || '-'} />
          <DetailRow label="Referrer" value={data.attributionReferrer || '-'} />
          <DetailRow label="Device" value={data.attributionDevice || '-'} />
          </div>

          {id && <ActivityTimeline candidateId={id} />}
        </>
        )}

        {detailView === 'assessment' && (
        <div className="card-premium space-y-3 overflow-hidden">
          <h2 className="font-semibold text-lg mb-4">Assessment</h2>
          <DetailRow label="Assessment Status" value={data.assessmentStatus?.replace(/_/g, ' ') || 'NOT STARTED'} />
          {submission ? (
            <>
              <div className="flex justify-between gap-4 text-sm"><span className="shrink-0 text-hurix-gray">Assessment Score</span><span className="font-bold text-lg">{Number(submission.score)}/10</span></div>
              <DetailRow label="Passed Questions" value={`${submission.passedQuestions}/${submission.totalQuestions}`} />
              <DetailRow label="Submission Date" value={formatDate(submission.submittedAt)} />
            </>
          ) : (
            <p className="text-sm text-hurix-gray">No submission yet.</p>
          )}
        </div>
        )}
      </div>

      {detailView === 'profile' && (
        <div className="card-premium mb-4 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Resume</h2>
              <p className="text-xs text-hurix-gray">Primary resume appears first. This section is read-only for admins.</p>
            </div>
            {resumes.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllResumes((value) => !value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-hurix-blue shadow-sm hover:bg-slate-50"
              >
                {showAllResumes ? 'Show Less' : 'View 2nd Row'}
              </button>
            )}
          </div>

          {resumes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center text-xs text-hurix-gray">
              No resume uploaded.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {visibleResumes.map((resume) => (
                <button
                  type="button"
                  key={resume.id}
                  onClick={() => openResumePreview(resume)}
                  className={`relative rounded-2xl border p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-white ${
                    resume.isPrimary ? 'border-black/20 bg-white' : 'border-slate-100 bg-white/70'
                  }`}
                >
                  <div className="mx-auto flex h-20 w-16 items-center justify-center rounded-xl border border-black/10 bg-gradient-to-br from-white to-slate-100 shadow-inner">
                    {openingResumeId === resume.id ? (
                      <span className="text-xs text-hurix-gray">Opening...</span>
                    ) : (
                      <FileText className="text-slate-800" size={22} />
                    )}
                  </div>
                  <TruncatedText
                    text={resume.fileName}
                    lines={2}
                    className="mt-1.5 min-h-[1.75rem] text-[11px] font-semibold leading-3.5 text-slate-950"
                  />
                  {resume.isPrimary && (
                    <span className="mt-1 inline-flex rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold text-white">
                      Primary
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detailView === 'assessment' && submission && (
        <div className="card-premium mb-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-lg">Assessment Markdown</h2>
              <p className="text-sm text-hurix-gray">Download or preview the candidate assessment answers as Markdown.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openMarkdownPreview}
            disabled={isOpeningMarkdown}
            className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm"
          >
            <FileText size={16} /> {isOpeningMarkdown ? 'Opening...' : 'Open Markdown File'}
          </button>
        </div>
      )}

      {detailView === 'assessment' && submission?.answers && (
        <div className="card-premium">
          <h2 className="font-semibold text-lg mb-4">Question Results</h2>
          <div className="space-y-4">
            {submission.answers.map((answer: { id: string; question: { title: string; mcqOptions?: string[] | null }; isFullyPassed: boolean; passedTests: number; failedTests: number; code: string; selectedOptionIndex?: number | null }) => (
              <details key={answer.id} className="border rounded-lg">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-slate-50">
                  <TruncatedText text={answer.question.title} className="min-w-0 flex-1 font-medium" />
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${answer.isFullyPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {answer.passedTests}/{answer.passedTests + answer.failedTests} tests
                  </span>
                </summary>
                <div className="p-4 border-t bg-slate-900">
                  <pre className="text-green-400 text-xs overflow-x-auto">
                    {Array.isArray(answer.question.mcqOptions)
                      ? `Selected: ${
                          answer.selectedOptionIndex == null
                            ? 'Skipped'
                            : answer.question.mcqOptions[answer.selectedOptionIndex] || `Option ${answer.selectedOptionIndex + 1}`
                        }`
                      : answer.code}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
      {resumePreview && (
        <ResumePreviewModal
          url={resumePreview.url}
          filename={resumePreview.filename}
          onClose={closeResumePreview}
        />
      )}
      {markdownPreview && (
        <GlassModal
          title="Assessment Markdown"
          subtitle={markdownPreview.filename}
          onClose={() => setMarkdownPreview(null)}
          maxWidth="5xl"
          className="flex h-[90vh] flex-col !overflow-hidden !p-4"
        >
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={downloadMarkdown} className={`${glassBtnSecondaryClass} h-9 gap-2 px-3 text-xs`}>
              <Download size={14} /> Download
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/70 bg-neutral-950/95 p-4 text-xs leading-6 text-slate-100">
            {markdownPreview.content}
          </pre>
        </GlassModal>
      )}
      {showOwnerModal && data && id && (
        <OwnerAssignModal
          candidateName={data.fullName}
          currentOwner={
            resolvedOwner
              ? { id: resolvedOwner.id, email: resolvedOwner.email, role: resolvedOwner.role }
              : null
          }
          onClose={() => setShowOwnerModal(false)}
          onConfirm={async (ownerAdminId) => {
            await assignCandidateOwner(id, ownerAdminId);
            await queryClient.invalidateQueries({ queryKey: ['candidate', id] });
            await queryClient.invalidateQueries({ queryKey: ['candidates'] });
          }}
        />
      )}
    </AdminLayout>
  );
}
