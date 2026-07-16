import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  CountryPhoneInput,
  DEFAULT_COUNTRY_ISO,
  isValidNationalPhone,
} from '../../components/registration/CountryPhoneInput';
import { checkCandidateDuplicate, createManualCandidate, getJobRoles } from '../../api/admin';
import { parseResume } from '../../api/registration';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { EXPERIENCE_OPTIONS } from '../../utils/experience';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { isValidEmail, isValidLinkedIn, isPdfFile } from '../../utils/validation';
import type {
  AddCandidateFormValues,
  DuplicateCheckResult,
  ManualCreateResult,
} from '../../types/candidate-management';

function newIdempotencyKey() {
  return `add-cand-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const emptyForm: AddCandidateFormValues = {
  fullName: '',
  email: '',
  phoneCountryIso: DEFAULT_COUNTRY_ISO,
  phoneNumber: '',
  experienceCategory: '',
  jobRoleId: '',
  linkedinUrl: '',
  currentCompany: '',
  currentDesignation: '',
  skills: [],
  noticePeriod: '',
  expectedSalaryAmount: '',
  expectedSalaryCurrency: 'INR',
  sourceType: '',
  sourceDetail: '',
};

export function AddCandidatePage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAdminAuth();
  const [form, setForm] = useState<AddCandidateFormValues>(emptyForm);
  const [resume, setResume] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseNotice, setParseNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateCheckResult | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [result, setResult] = useState<ManualCreateResult | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const { data: rolesData } = useQuery({
    queryKey: ['job-roles-filter'],
    queryFn: getJobRoles,
  });

  const activeRoles = useMemo(
    () => (rolesData?.data || []).filter((r) => !r.status || r.status === 'ACTIVE'),
    [rolesData]
  );

  const setField = <K extends keyof AddCandidateFormValues>(key: K, value: AddCandidateFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const handleResumeChange = async (file: File | null) => {
    setResume(file);
    setParseNotice('');
    setFieldErrors((current) => ({ ...current, resume: '' }));
    if (!file) return;

    if (!isPdfFile(file)) {
      setFieldErrors((current) => ({ ...current, resume: 'Only PDF files allowed' }));
      setResume(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((current) => ({ ...current, resume: 'Max file size is 5MB' }));
      setResume(null);
      return;
    }

    setForm((current) => ({
      ...current,
      fullName: '',
      email: '',
      linkedinUrl: '',
      experienceCategory: '',
      phoneCountryIso: DEFAULT_COUNTRY_ISO,
      phoneNumber: '',
    }));
    setParsingResume(true);
    try {
      const parsed = await parseResume(file);
      setForm((current) => ({
        ...current,
        fullName: parsed.fullName || '',
        email: parsed.email || '',
        linkedinUrl: parsed.linkedinUrl || '',
        experienceCategory: parsed.experienceCategory || '',
        phoneCountryIso: (parsed.phoneCountryIso as CountryCode) || DEFAULT_COUNTRY_ISO,
        phoneNumber: parsed.phoneNumber || '',
      }));
      setParseNotice('We auto-filled the details we could find. Please review everything before submitting.');
    } catch {
      setParseNotice('CV uploaded. We could not auto-fill details, so please complete the form manually.');
    } finally {
      setParsingResume(false);
    }
  };

  const validateClient = (): boolean => {
    const errors: Record<string, string> = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Full name is required';
    if (!isValidEmail(form.email)) errors.email = 'Valid email required';
    if (!isValidNationalPhone(form.phoneCountryIso as CountryCode, form.phoneNumber)) {
      errors.phoneNumber = 'Valid phone number required for selected country';
    }
    if (!form.experienceCategory) errors.experienceCategory = 'Years of experience is required';
    if (form.linkedinUrl.trim() && !isValidLinkedIn(form.linkedinUrl.trim())) {
      errors.linkedinUrl = 'Enter a valid LinkedIn URL or leave blank';
    }
    if (!form.jobRoleId) errors.jobRoleId = 'Job role is required';
    if (!resume) errors.resume = 'Resume PDF is required';
    else if (!isPdfFile(resume)) errors.resume = 'Only PDF files allowed';
    else if (resume.size > 5 * 1024 * 1024) errors.resume = 'Max file size is 5MB';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildFormData = (opts?: { allowDuplicateOverride?: boolean; reason?: string }) => {
    const fd = new FormData();
    fd.append('fullName', form.fullName.trim());
    fd.append('email', form.email.trim());
    fd.append('phoneCountryIso', form.phoneCountryIso);
    fd.append('phoneNumber', form.phoneNumber.replace(/\D/g, ''));
    fd.append('experienceCategory', form.experienceCategory);
    fd.append('jobRoleId', form.jobRoleId);
    fd.append('linkedinUrl', form.linkedinUrl.trim());
    if (form.sourceDetail) fd.append('sourceDetail', form.sourceDetail.trim());
    if (form.sourceType) fd.append('sourceType', form.sourceType.trim());
    fd.append('sendInvitation', 'true');
    if (opts?.allowDuplicateOverride) {
      fd.append('allowDuplicateOverride', 'true');
      fd.append('duplicateOverrideReason', opts.reason || '');
    }
    fd.append('resume', resume!);
    return fd;
  };

  const submit = async (opts?: { allowDuplicateOverride?: boolean; reason?: string }) => {
    if (!validateClient()) return;
    setSubmitting(true);
    setServerError(null);
    setDuplicate(null);
    try {
      const created = await createManualCandidate(
        buildFormData(opts),
        opts?.allowDuplicateOverride ? `${idempotencyKey}-override` : idempotencyKey
      );
      setResult(created);
    } catch (err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { message?: string; existing?: DuplicateCheckResult['existing'] };
        };
      };
      if (axiosErr.response?.status === 409) {
        setDuplicate({
          duplicate: true,
          existing: axiosErr.response.data?.existing || null,
        });
        setServerError(axiosErr.response.data?.message || 'A candidate with this email already exists');
      } else {
        setServerError(getAdminActionErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const precheckDuplicate = async () => {
    if (!isValidEmail(form.email)) return;
    try {
      const check = await checkCandidateDuplicate(form.email.trim());
      if (check.duplicate) setDuplicate(check);
      else setDuplicate(null);
    } catch {
      /* ignore preflight errors */
    }
  };

  if (result?.candidateCreated) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-xl space-y-4">
          <h1 className="text-xl font-bold text-hurix-charcoal">Candidate created</h1>
          <p className="text-sm text-hurix-gray">
            {result.candidate.fullName} ({result.candidate.applicationId})
          </p>
          {result.invitationSent ? (
            <p className="text-sm text-green-700">Assessment invitation sent successfully.</p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Candidate was created, but the invitation email failed
              {result.invitationError ? `: ${result.invitationError}` : '.'}
              <p className="mt-1 text-xs">Use Send Reminder from the candidate list or detail page to retry.</p>
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
          <h1 className="text-2xl font-bold tracking-tight text-hurix-charcoal">Add Candidate</h1>
          <p className="text-sm text-hurix-gray mt-1">
            Upload the CV first — same flow as candidate registration — then review details and send an invitation.
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
        {serverError && !duplicate?.duplicate && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {serverError}
          </div>
        )}

        <section className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Upload CV</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Start with the resume</h2>
              <p className="mt-1 text-sm text-slate-500">PDF only, maximum 5MB.</p>
            </div>
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-black text-white sm:flex">
              <FileText size={20} />
            </div>
          </div>
          <label
            className={`group flex min-h-[150px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-all ${
              resume
                ? 'border-green-300 bg-green-50/80'
                : 'border-slate-200 bg-white/70 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white'
            }`}
          >
            <span
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                resume ? 'bg-green-600 text-white' : 'bg-black text-white group-hover:bg-slate-800'
              }`}
            >
              {resume ? <CheckCircle2 size={22} /> : <Upload size={22} />}
            </span>
            <span className="text-sm font-semibold text-slate-950">
              {parsingResume ? 'Reading CV...' : resume ? resume.name : 'Click to upload CV'}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              {parsingResume
                ? 'Please wait while we try to auto-fill details'
                : resume
                  ? `${(resume.size / (1024 * 1024)).toFixed(2)} MB selected`
                  : 'Details will be completed after this step'}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => void handleResumeChange(e.target.files?.[0] || null)}
            />
          </label>
          {fieldErrors.resume && <p className="text-red-500 text-xs mt-2">{fieldErrors.resume}</p>}
          {parseNotice && <p className="mt-2 text-xs font-medium text-slate-600">{parseNotice}</p>}
        </section>

        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Candidate Details</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input
            className="input-field"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            placeholder="John Doe"
          />
          {fieldErrors.fullName && <p className="text-red-500 text-xs mt-1">{fieldErrors.fullName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            onBlur={() => void precheckDuplicate()}
            placeholder="john@example.com"
          />
          {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
        </div>

        <CountryPhoneInput
          countryIso={form.phoneCountryIso as CountryCode}
          phoneNumber={form.phoneNumber}
          onCountryChange={(iso) => setField('phoneCountryIso', iso)}
          onPhoneChange={(v) => setField('phoneNumber', v)}
          error={fieldErrors.phoneNumber}
        />

        <div>
          <label className="block text-sm font-medium mb-1">Years of Experience *</label>
          <select
            className="input-field"
            value={form.experienceCategory}
            onChange={(e) => setField('experienceCategory', e.target.value)}
          >
            <option value="">Select experience level</option>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldErrors.experienceCategory && (
            <p className="text-red-500 text-xs mt-1">{fieldErrors.experienceCategory}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">LinkedIn URL (optional)</label>
          <input
            className="input-field"
            value={form.linkedinUrl}
            onChange={(e) => setField('linkedinUrl', e.target.value)}
            placeholder="https://linkedin.com/in/johndoe"
          />
          {fieldErrors.linkedinUrl && <p className="text-red-500 text-xs mt-1">{fieldErrors.linkedinUrl}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Job Role *</label>
          <select
            className="input-field"
            value={form.jobRoleId}
            onChange={(e) => setField('jobRoleId', e.target.value)}
          >
            <option value="">Select active job role</option>
            {activeRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
          {fieldErrors.jobRoleId && <p className="text-red-500 text-xs mt-1">{fieldErrors.jobRoleId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Referral Code (optional)</label>
          <input
            className="input-field"
            value={form.sourceDetail}
            onChange={(e) => setField('sourceDetail', e.target.value)}
            placeholder="EMP001 (optional)"
          />
        </div>

        {duplicate?.duplicate && duplicate.existing && (
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

        <button
          type="submit"
          disabled={
            submitting ||
            parsingResume ||
            (Boolean(duplicate?.duplicate) &&
              !(isSuperAdmin && confirmOverride && overrideReason.trim().length >= 3))
          }
          className="btn-primary w-full py-4"
        >
          {submitting || parsingResume ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            'Save and Send Assessment Invitation'
          )}
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
