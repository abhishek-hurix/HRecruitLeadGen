import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  checkCandidateDuplicate,
  getJobRoles,
  getRegistrationInviteTemplate,
  inviteCandidate,
  previewRegistrationInvite,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { htmlToPlainEmail, plainToEmailHtml } from '../../utils/emailBody';
import { formatPersonName } from '../../utils/personName';
import { isValidEmail } from '../../utils/validation';
import type { DuplicateCheckResult, ManualCreateResult } from '../../types/candidate-management';

function newIdempotencyKey() {
  return `invite-cand-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AddCandidatePage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAdminAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobRoleId, setJobRoleId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyPlain, setEmailBodyPlain] = useState('');
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateCheckResult | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [result, setResult] = useState<ManualCreateResult | null>(null);
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const activeRoles = useMemo(
    () => (rolesData?.data || []).filter((r) => !r.status || r.status === 'ACTIVE'),
    [rolesData]
  );

  const selectedRoleTitle = useMemo(
    () => activeRoles.find((r) => r.id === jobRoleId)?.title || '',
    [activeRoles, jobRoleId]
  );

  useEffect(() => {
    getRegistrationInviteTemplate()
      .then((template) => {
        setEmailSubject(template.subject);
        setEmailBodyPlain(htmlToPlainEmail(template.bodyHtml));
        setTemplateLoaded(true);
      })
      .catch(() => {
        setServerError('Could not load invitation email template.');
      });
  }, []);

  useEffect(() => {
    if (!templateLoaded) return;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      previewRegistrationInvite({
        candidateName: fullName.trim() || 'Jane Doe',
        assignedRole: selectedRoleTitle || 'Software Engineer',
        email: email.trim() || 'jane@example.com',
        subject: emailSubject,
        bodyHtml: plainToEmailHtml(emailBodyPlain),
      })
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    templateLoaded,
    fullName,
    email,
    selectedRoleTitle,
    emailSubject,
    emailBodyPlain,
  ]);

  const validateClient = (): boolean => {
    const errors: Record<string, string> = {};
    const formattedName = formatPersonName(fullName);
    if (formattedName.length < 2) errors.fullName = 'Full name is required';
    if (!isValidEmail(email)) errors.email = 'Valid email required';
    if (!jobRoleId) errors.jobRoleId = 'Job role is required';
    if (!emailSubject.trim()) errors.emailSubject = 'Email subject is required';
    if (!emailBodyPlain.trim()) errors.emailBody = 'Email body is required';
    if (duplicate?.nameMismatch) {
      errors.fullName = `Use the registered name for this email: ${duplicate.canonicalName || duplicate.existing?.fullName}`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (opts?: { allowDuplicateOverride?: boolean; reason?: string }) => {
    const formattedName = formatPersonName(fullName);
    setFullName(formattedName);
    if (!validateClient()) return;
    setSubmitting(true);
    setServerError(null);
    setDuplicate(null);
    try {
      const created = await inviteCandidate(
        {
          fullName: formattedName,
          email: email.trim(),
          jobRoleId,
          subject: emailSubject.trim(),
          bodyHtml: plainToEmailHtml(emailBodyPlain),
          allowDuplicateOverride: opts?.allowDuplicateOverride,
          duplicateOverrideReason: opts?.reason,
        },
        opts?.allowDuplicateOverride ? `${idempotencyKey}-override` : idempotencyKey
      );
      setResult(created);
    } catch (err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            existing?: DuplicateCheckResult['existing'];
            canonicalName?: string;
            nameMismatch?: boolean;
          };
        };
      };
      if (axiosErr.response?.status === 409) {
        const payload = axiosErr.response.data;
        if (payload?.nameMismatch) {
          setDuplicate({
            duplicate: true,
            nameMismatch: true,
            canonicalName: payload.canonicalName || payload.existing?.fullName || null,
            existing: payload.existing || null,
          });
        } else {
          setDuplicate({
            duplicate: true,
            existing: payload?.existing || null,
          });
        }
        setServerError(payload?.message || 'A candidate with this email already exists');
      } else {
        setServerError(getAdminActionErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const precheckDuplicate = async () => {
    if (!isValidEmail(email)) return;
    try {
      const check = await checkCandidateDuplicate(email.trim(), formatPersonName(fullName));
      if (check.duplicate || check.nameMismatch) setDuplicate(check);
      else setDuplicate(null);
    } catch {
      /* ignore preflight errors */
    }
  };

  const handleFullNameBlur = () => {
    const formatted = formatPersonName(fullName);
    if (formatted !== fullName) setFullName(formatted);
    void precheckDuplicate();
  };

  if (result?.candidateCreated) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-xl space-y-4">
          <h1 className="text-xl font-bold text-hurix-charcoal">Invitation sent</h1>
          <p className="text-sm text-hurix-gray">
            {result.candidate.fullName} ({result.candidate.applicationId})
          </p>
          {result.invitationSent ? (
            <p className="text-sm text-green-700">Registration invitation sent successfully.</p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Candidate was created, but the invitation email failed
              {result.invitationError ? `: ${result.invitationError}` : '.'}
              <p className="mt-1 text-xs">You can resend from the candidate detail page.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/candidates/${result.candidate.id}`} className="btn-primary text-sm">
              Open Candidate
            </Link>
            <Link to="/admin/candidates" className="btn-secondary text-sm">
              Back to Candidates
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/candidates')}
          className="text-hurix-gray hover:text-hurix-charcoal"
          aria-label="Back to candidates"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-hurix-charcoal">Invite Candidate</h1>
          <p className="text-sm text-hurix-gray mt-1">
            Enter name, email, and job role. The candidate will receive a registration invite — not an assessment link.
          </p>
        </div>
      </div>

      <form
        className="max-w-3xl mx-auto rounded-[2rem] border border-black/10 bg-white/70 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl sm:p-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (duplicate?.duplicate && isSuperAdmin && confirmOverride) {
            void submit({ allowDuplicateOverride: true, reason: overrideReason.trim() });
          } else {
            void submit();
          }
        }}
      >
        {serverError && !duplicate?.duplicate && !duplicate?.nameMismatch && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {serverError}
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Each email can only have one candidate name. Use the same name every time for that email.
          Names are auto-formatted as <strong>First Last</strong> (first letter capital, rest lowercase for each part).
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input
            className="input-field"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.fullName;
                return next;
              });
            }}
            onBlur={handleFullNameBlur}
            placeholder="John Doe"
          />
          {fieldErrors.fullName && <p className="text-red-500 text-xs mt-1">{fieldErrors.fullName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.email;
                return next;
              });
            }}
            onBlur={() => void precheckDuplicate()}
            placeholder="john@example.com"
          />
          {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Job Role *</label>
          <select
            className="input-field"
            value={jobRoleId}
            onChange={(e) => {
              setJobRoleId(e.target.value);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.jobRoleId;
                return next;
              });
            }}
          >
            <option value="">Select active job role</option>
            {activeRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
          {fieldErrors.jobRoleId && <p className="text-red-500 text-xs mt-1">{fieldErrors.jobRoleId}</p>}
        </div>

        {duplicate?.nameMismatch && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2" role="alert">
            <p className="font-semibold">Name does not match this email</p>
            <p>
              This email is already registered as{' '}
              <strong>{duplicate.canonicalName || duplicate.existing?.fullName}</strong>.
              Please use the same name. A different name cannot be assigned, even by admin.
            </p>
          </div>
        )}

        {duplicate?.duplicate && duplicate.existing && !duplicate.nameMismatch && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2" role="alert">
            <p className="font-semibold">Existing candidate found</p>
            <p>
              {duplicate.existing.fullName} · {duplicate.existing.applicationId} · {duplicate.existing.email}
            </p>
            <Link
              to={`/admin/candidates/${duplicate.existing.id}`}
              className="inline-flex text-hurix-blue underline text-sm"
            >
              Open Existing Candidate
            </Link>
            {isSuperAdmin && (
              <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
                <p className="text-xs">
                  Super Admin override creates a new application on the same user identity.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={confirmOverride}
                    onChange={(e) => setConfirmOverride(e.target.checked)}
                  />
                  I understand and want to create another application
                </label>
                <textarea
                  className="input-field text-sm"
                  rows={2}
                  placeholder="Override reason (required)"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <section className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Invitation Email</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Edit before sending</h2>
              <p className="mt-1 text-sm text-slate-500">
                Changes here apply only to this invitation. The default template stays unchanged.
              </p>
            </div>
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-black text-white sm:flex">
              <Mail size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              className="input-field"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              disabled={!templateLoaded}
            />
            {fieldErrors.emailSubject && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.emailSubject}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email body *</label>
            <textarea
              className="input-field min-h-[180px] font-mono text-sm"
              value={emailBodyPlain}
              onChange={(e) => setEmailBodyPlain(e.target.value)}
              disabled={!templateLoaded}
              placeholder="Loading template..."
            />
            {fieldErrors.emailBody && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.emailBody}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Use {'{{candidateName}}'}, {'{{assignedRole}}'}, and {'{{registrationUrl}}'} as placeholders.
            </p>
          </div>

          {(preview || previewLoading) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Preview</p>
              {previewLoading && !preview ? (
                <Loader2 className="animate-spin text-slate-400" size={18} />
              ) : preview ? (
                <>
                  <p className="mb-2 text-sm font-semibold text-slate-900">{preview.subject}</p>
                  <div
                    className="text-sm leading-relaxed text-slate-700 [&_a]:text-hurix-blue [&_a]:underline [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                  />
                </>
              ) : null}
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={
            submitting ||
            !templateLoaded ||
            Boolean(duplicate?.nameMismatch) ||
            (Boolean(duplicate?.duplicate) &&
              !(isSuperAdmin && confirmOverride && overrideReason.trim().length >= 3))
          }
          className="btn-primary w-full py-4"
        >
          {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Send Invitation'}
        </button>
        <div className="text-center">
          <Link to="/admin/candidates" className="text-sm text-hurix-gray hover:text-hurix-charcoal underline">
            Cancel
          </Link>
        </div>
      </form>
    </AdminLayout>
  );
}
