import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, X } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { CountryPhoneInput } from '../../components/registration/CountryPhoneInput';
import {
  checkCandidateDuplicate,
  createManualCandidate,
  getJobRoles,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { EXPERIENCE_OPTIONS } from '../../utils/experience';
import { DEFAULT_COUNTRY_ISO, isValidNationalPhone } from '../../utils/countries';
import { validateResumePdf } from '../../utils/resume-validation';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import type {
  AddCandidateFormValues,
  DuplicateCheckResult,
  ManualCreateResult,
} from '../../types/candidate-management';
import { isValidEmail, isValidLinkedIn } from '../../utils/validation';

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
  const [skillInput, setSkillInput] = useState('');
  const [resume, setResume] = useState<File | null>(null);
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
      delete next[key];
      return next;
    });
  };

  const validateClient = (): boolean => {
    const errors: Record<string, string> = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Full name is required';
    if (!isValidEmail(form.email)) errors.email = 'Valid email is required';
    if (!isValidNationalPhone(form.phoneCountryIso as CountryCode, form.phoneNumber)) {
      errors.phoneNumber = 'Valid phone number is required';
    }
    if (!form.experienceCategory) errors.experienceCategory = 'Experience is required';
    if (!form.jobRoleId) errors.jobRoleId = 'Job role is required';
    if (form.linkedinUrl && !isValidLinkedIn(form.linkedinUrl)) {
      errors.linkedinUrl = 'Invalid LinkedIn URL';
    }
    if (resume) {
      const v = validateResumePdf(resume);
      if (!v.ok) errors.resume = v.message;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildFormData = (opts?: { allowDuplicateOverride?: boolean; reason?: string }) => {
    const fd = new FormData();
    fd.append('fullName', form.fullName.trim());
    fd.append('email', form.email.trim());
    fd.append('phoneCountryIso', form.phoneCountryIso);
    fd.append('phoneNumber', form.phoneNumber.trim());
    fd.append('experienceCategory', form.experienceCategory);
    fd.append('jobRoleId', form.jobRoleId);
    if (form.linkedinUrl) fd.append('linkedinUrl', form.linkedinUrl.trim());
    if (form.currentCompany) fd.append('currentCompany', form.currentCompany.trim());
    if (form.currentDesignation) fd.append('currentDesignation', form.currentDesignation.trim());
    if (form.noticePeriod) fd.append('noticePeriod', form.noticePeriod.trim());
    if (form.expectedSalaryAmount) fd.append('expectedSalaryAmount', form.expectedSalaryAmount);
    if (form.expectedSalaryCurrency) fd.append('expectedSalaryCurrency', form.expectedSalaryCurrency);
    if (form.sourceType) fd.append('sourceType', form.sourceType.trim());
    if (form.sourceDetail) fd.append('sourceDetail', form.sourceDetail.trim());
    if (form.skills.length) fd.append('skills', JSON.stringify(form.skills));
    fd.append('sendInvitation', 'true');
    if (opts?.allowDuplicateOverride) {
      fd.append('allowDuplicateOverride', 'true');
      fd.append('duplicateOverrideReason', opts.reason || '');
    }
    if (resume) fd.append('resume', resume);
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
        response?: { status?: number; data?: { message?: string; existing?: DuplicateCheckResult['existing']; requestId?: string } };
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
        <div className="max-w-xl mx-auto card-premium p-6 space-y-4">
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
        <button type="button" onClick={() => navigate('/admin/candidates')} className="text-hurix-gray hover:text-hurix-charcoal">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-hurix-charcoal">Add Candidate</h1>
          <p className="text-sm text-hurix-gray">Create a candidate and send an assessment invitation.</p>
        </div>
      </div>

      <form
        className="max-w-3xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (duplicate?.duplicate && isSuperAdmin && confirmOverride) {
            void submit({ allowDuplicateOverride: true, reason: overrideReason.trim() });
          } else {
            void submit();
          }
        }}
      >
        <div className="card-premium p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="add-fullName" className="block text-sm font-medium mb-1">Full Name *</label>
            <input
              id="add-fullName"
              className="input-field"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
            />
            {fieldErrors.fullName && <p className="text-xs text-red-600 mt-1">{fieldErrors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="add-email" className="block text-sm font-medium mb-1">Email *</label>
            <input
              id="add-email"
              className="input-field"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              onBlur={() => void precheckDuplicate()}
            />
            {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="add-experience" className="block text-sm font-medium mb-1">Experience *</label>
            <select
              id="add-experience"
              className="input-field"
              value={form.experienceCategory}
              onChange={(e) => setField('experienceCategory', e.target.value)}
            >
              <option value="">Select experience</option>
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {fieldErrors.experienceCategory && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.experienceCategory}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <CountryPhoneInput
              countryIso={form.phoneCountryIso as CountryCode}
              phoneNumber={form.phoneNumber}
              onCountryChange={(iso) => setField('phoneCountryIso', iso)}
              onPhoneChange={(v) => setField('phoneNumber', v)}
              error={fieldErrors.phoneNumber}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="add-jobRole" className="block text-sm font-medium mb-1">Job Role *</label>
            <select
              id="add-jobRole"
              className="input-field"
              value={form.jobRoleId}
              onChange={(e) => setField('jobRoleId', e.target.value)}
            >
              <option value="">Select active job role</option>
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            {fieldErrors.jobRoleId && <p className="text-xs text-red-600 mt-1">{fieldErrors.jobRoleId}</p>}
          </div>
        </div>

        <div className="card-premium p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Resume (PDF, max 10 MB)</label>
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) {
                    setResume(null);
                    return;
                  }
                  const v = validateResumePdf(file);
                  if (!v.ok) {
                    setFieldErrors((prev) => ({ ...prev, resume: v.message }));
                    setResume(null);
                    return;
                  }
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.resume;
                    return next;
                  });
                  setResume(file);
                }}
              />
              {resume && (
                <div className="mt-2 flex items-center gap-2 text-hurix-charcoal">
                  <FileText size={16} />
                  <span className="truncate">{resume.name}</span>
                  <button
                    type="button"
                    className="text-hurix-gray hover:text-red-600"
                    aria-label="Remove resume"
                    onClick={() => setResume(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {fieldErrors.resume && <p className="text-xs text-red-600 mt-1">{fieldErrors.resume}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">LinkedIn</label>
            <input
              className="input-field"
              value={form.linkedinUrl}
              onChange={(e) => setField('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
            {fieldErrors.linkedinUrl && <p className="text-xs text-red-600 mt-1">{fieldErrors.linkedinUrl}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Current Company</label>
            <input className="input-field" value={form.currentCompany} onChange={(e) => setField('currentCompany', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Current Designation</label>
            <input className="input-field" value={form.currentDesignation} onChange={(e) => setField('currentDesignation', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notice Period</label>
            <input className="input-field" value={form.noticePeriod} onChange={(e) => setField('noticePeriod', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expected Salary</label>
            <div className="flex gap-2">
              <input
                className="input-field"
                value={form.expectedSalaryAmount}
                onChange={(e) => setField('expectedSalaryAmount', e.target.value)}
                placeholder="Amount"
              />
              <input
                className="input-field w-24"
                value={form.expectedSalaryCurrency}
                onChange={(e) => setField('expectedSalaryCurrency', e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input className="input-field" value={form.sourceType} onChange={(e) => setField('sourceType', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referral / Source detail</label>
            <input className="input-field" value={form.sourceDetail} onChange={(e) => setField('sourceDetail', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Skills</label>
            <div className="flex gap-2">
              <input
                className="input-field"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const s = skillInput.trim();
                    if (s && !form.skills.includes(s)) setField('skills', [...form.skills, s]);
                    setSkillInput('');
                  }
                }}
                placeholder="Type a skill and press Enter"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full bg-hurix-blue/10 text-hurix-blue px-2 py-0.5 text-xs"
                  onClick={() => setField('skills', form.skills.filter((x) => x !== s))}
                >
                  {s} ×
                </button>
              ))}
            </div>
          </div>
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
                  Super Admin override creates a new application (CandidateProfile) on the same User identity.
                  It does not create a duplicate login email.
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

        {serverError && !duplicate?.duplicate && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {serverError}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={
              submitting ||
              (Boolean(duplicate?.duplicate) &&
                !(isSuperAdmin && confirmOverride && overrideReason.trim().length >= 3))
            }
          >
            {submitting ? 'Saving…' : 'Save and Send Assessment Invitation'}
          </button>
          <Link to="/admin/candidates" className="btn-secondary text-sm">Cancel</Link>
        </div>
      </form>
    </AdminLayout>
  );
}
