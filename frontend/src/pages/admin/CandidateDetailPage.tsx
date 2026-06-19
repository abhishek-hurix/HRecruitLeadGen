import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Download, FileText, Phone } from 'lucide-react';
import { ResumePreviewModal } from '../../components/admin/ResumePreviewModal';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getCandidateById, getResumePreviewUrl, getSubmissionMarkdown } from '../../api/admin';
import { formatDate } from '../../utils/validation';
import { formatSourceLabel } from '../../utils/utm';

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [isOpeningResume, setIsOpeningResume] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState<{ content: string; filename: string } | null>(null);
  const [isOpeningMarkdown, setIsOpeningMarkdown] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidateById(id!),
    enabled: !!id,
  });
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

  const openResumePreview = async () => {
    if (!id || !data?.resumePath) return;
    setIsOpeningResume(true);
    try {
      const url = await getResumePreviewUrl(id);
      setResumePreview({ url, filename: `${data.fullName}_resume.pdf` });
    } finally {
      setIsOpeningResume(false);
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

  return (
    <AdminLayout>
      <Link to="/admin/candidates" className="flex items-center gap-2 text-hurix-blue text-sm mb-6 hover:underline">
        <ArrowLeft size={16} /> Back to Candidates
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-hurix-charcoal">{data.fullName}</h1>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {detailView === 'profile' && (
        <>
          <div className="card-premium space-y-3">
          <h2 className="font-semibold text-lg mb-4">Profile</h2>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Name</span><span className="text-right">{data.fullName}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Email</span><span className="text-right break-all">{data.user.email}</span></div>
          <div className="flex justify-between text-sm gap-4">
            <span className="text-hurix-gray shrink-0">Phone</span>
            <span className="inline-flex flex-wrap justify-end gap-2 text-right">
              <span>{data.fullPhone || data.phone}</span>
              <button
                type="button"
                onClick={() => copyPhoneNumber(data.fullPhone || data.phone)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-hurix-charcoal hover:bg-slate-50"
              >
                <Copy size={12} />
                {phoneCopied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`tel:${String(data.fullPhone || data.phone).replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-1 rounded border border-green-200 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 lg:hidden"
              >
                <Phone size={12} />
                Call
              </a>
            </span>
          </div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Country</span><span>{data.phoneCountry || '—'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Country Code</span><span>{data.countryCode || '—'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Years of Experience</span><span>{data.yearsOfExperience ?? '—'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Experience Category</span><span>{data.experienceLabel || '—'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">LinkedIn</span><a href={data.linkedinUrl} target="_blank" rel="noreferrer" className="text-hurix-blue text-right break-all">{data.linkedinUrl}</a></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Role</span><span className="text-right">{data.appliedRole || '-'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Referral</span><span>{data.referralCode || '-'}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-hurix-gray">Resume</span>
            {data.resumePath ? (
              <button type="button" onClick={openResumePreview} className="text-hurix-blue hover:underline" disabled={isOpeningResume}>
                {isOpeningResume ? 'Opening...' : 'Uploaded'}
              </button>
            ) : (
              <span>Not Uploaded</span>
            )}
          </div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Email Verified</span><span>{data.emailVerified ? 'Yes' : 'No'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Journey Status</span><span className="font-medium">{data.journeyStatus?.replace(/_/g, ' ') || '-'}</span></div>
          </div>

          <div className="card-premium space-y-3">
            <h2 className="font-semibold text-lg mb-4">Applied Position</h2>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Role</span><span className="font-medium">{data.selectedRoleName || '—'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Country</span><span>{data.selectedCountry || '—'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Compensation</span><span className="text-right">{data.selectedCompensation || '—'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Selected On</span><span>{data.roleSelectedAt ? formatDate(data.roleSelectedAt) : '—'}</span></div>
          {Array.isArray(data.selectedSkills) && data.selectedSkills.length > 0 && (
            <div className="pt-2">
              <p className="text-hurix-gray text-sm mb-2">Skills</p>
              <div className="flex flex-wrap gap-1">
                {(data.selectedSkills as string[]).map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-hurix-blue/10 text-hurix-blue text-xs rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          </div>

          <div className="card-premium space-y-3">
            <h2 className="font-semibold text-lg mb-4">Acquisition</h2>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Source</span><span>{formatSourceLabel(data.utmSource)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Medium</span><span>{data.utmMedium || '-'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Campaign</span><span>{data.utmCampaign || '-'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">First Touch</span><span>{formatSourceLabel(data.firstTouchSource)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Last Touch</span><span>{formatSourceLabel(data.lastTouchSource)}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Landing Page</span><span className="text-right break-all text-xs">{data.attributionLandingPage || '-'}</span></div>
          <div className="flex justify-between text-sm gap-4"><span className="text-hurix-gray shrink-0">Referrer</span><span className="text-right break-all text-xs">{data.attributionReferrer || '-'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Device</span><span>{data.attributionDevice || '-'}</span></div>
          </div>
        </>
        )}

        {detailView === 'assessment' && (
        <div className="card-premium space-y-3">
          <h2 className="font-semibold text-lg mb-4">Assessment</h2>
          <div className="flex justify-between text-sm"><span className="text-hurix-gray">Assessment Status</span><span className="font-medium">{data.assessmentStatus?.replace(/_/g, ' ') || 'NOT STARTED'}</span></div>
          {submission ? (
            <>
              <div className="flex justify-between text-sm"><span className="text-hurix-gray">Assessment Score</span><span className="font-bold text-lg">{Number(submission.score)}/10</span></div>
              <div className="flex justify-between text-sm"><span className="text-hurix-gray">Passed Questions</span><span>{submission.passedQuestions}/{submission.totalQuestions}</span></div>
              <div className="flex justify-between text-sm"><span className="text-hurix-gray">Submission Date</span><span>{formatDate(submission.submittedAt)}</span></div>
            </>
          ) : (
            <p className="text-sm text-hurix-gray">No submission yet.</p>
          )}
        </div>
        )}
      </div>

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
                <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50">
                  <span className="font-medium">{answer.question.title}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${answer.isFullyPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold text-hurix-charcoal">Assessment Markdown</h2>
                <p className="text-xs text-hurix-gray">{markdownPreview.filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={downloadMarkdown} className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs">
                  <Download size={14} /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setMarkdownPreview(null)}
                  className="rounded-lg p-2 text-hurix-gray hover:bg-slate-100 hover:text-hurix-charcoal"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="h-full overflow-auto whitespace-pre-wrap bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {markdownPreview.content}
            </pre>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
