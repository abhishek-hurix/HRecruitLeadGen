import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  FileText,
  Upload,
  Award,
  User,
  Mail,
  MailCheck,
  AlertCircle,
  Briefcase,
  MapPin,
  DollarSign,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ResumePreviewModal } from '../components/admin/ResumePreviewModal';
import { CountryPhoneInput } from '../components/registration/CountryPhoneInput';
import { CandidateLayout } from '../components/layout/CandidateLayout';
import {
  deleteCandidateResume,
  getCandidateDashboard,
  getAssessmentAccessToken,
  getCandidateJobRoles,
  getCandidateResumePreviewUrl,
  resendVerificationEmail,
  setPrimaryCandidateResume,
  updateCandidatePhone,
  uploadCandidateResume,
} from '../api/candidate';
import { initSessionAuth, assignRole } from '../api/assessment';
import { clearCandidateToken, getCandidateToken, setCandidateToken } from '../api/client';
import { getApiErrorMessage, isLinkExpiredError, getApiErrorStatus } from '../utils/apiErrors';
import { getCountryNameFromDialCode, getPhoneSaveValidationError, splitProfilePhone } from '../utils/countries';
import type { CountryCode } from 'libphonenumber-js';
import { isMobilePhone } from '../utils/device';
import { formatDate, isPdfFile } from '../utils/validation';

function TimelineStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="text-green-500 shrink-0" size={22} />
      ) : (
        <Circle className="text-slate-300 shrink-0" size={22} />
      )}
      <span className={`text-sm ${done ? 'text-hurix-charcoal font-medium' : 'text-hurix-gray'}`}>
        {label}
      </span>
    </div>
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function CandidateDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [startingRoleId, setStartingRoleId] = useState<string | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'opportunities' | 'applied' | 'assessment'>('opportunities');
  const [resending, setResending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [primaryResumeMode, setPrimaryResumeMode] = useState(false);
  const [selectedPrimaryResumeId, setSelectedPrimaryResumeId] = useState('');
  const [savingPrimaryResume, setSavingPrimaryResume] = useState(false);
  const [resumePreview, setResumePreview] = useState<{ url: string; filename: string } | null>(null);
  const [openingResumeId, setOpeningResumeId] = useState<string | null>(null);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneCountryIso, setPhoneCountryIso] = useState<CountryCode>('IN');
  const [phoneNumberDraft, setPhoneNumberDraft] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidate-dashboard'],
    queryFn: () => {
      const candidateToken = getCandidateToken();
      if (candidateToken) setCandidateToken(candidateToken);
      return getCandidateDashboard();
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.verification?.emailVerified === false ? 15000 : false,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['candidate-job-roles'],
    queryFn: getCandidateJobRoles,
    enabled: !!data,
  });

  useEffect(() => {
    if (error && isLinkExpiredError(error)) {
      clearCandidateToken();
      navigate('/login');
    }
  }, [error, navigate]);

  useEffect(() => {
    const primaryResume = data?.profile.resumes.find((resume) => resume.isPrimary);
    if (primaryResume && !primaryResumeMode) {
      setSelectedPrimaryResumeId(primaryResume.id);
    }
  }, [data?.profile.resumes, primaryResumeMode]);

  useEffect(() => {
    if (!data?.profile.phone || editingPhone) return;
    const split = splitProfilePhone(
      data.profile.phone,
      data.profile.phoneNumber || '',
      data.profile.countryCode,
      data.profile.phoneCountry
    );
    setPhoneCountryIso(split.iso);
    setPhoneNumberDraft(split.nationalNumber);
  }, [data?.profile.phone, data?.profile.phoneNumber, data?.profile.countryCode, data?.profile.phoneCountry, editingPhone]);

  useEffect(() => () => {
    if (resumePreview) {
      window.URL.revokeObjectURL(resumePreview.url);
    }
  }, [resumePreview]);

  const handleResendVerification = async () => {
    setResending(true);
    setActionError('');
    setResendSuccess(false);
    try {
      await resendVerificationEmail();
      setResendSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ['candidate-dashboard'] });
    } catch (err) {
      setActionError(getApiErrorMessage(err));
      if (getApiErrorStatus(err) === 429) {
        setResendSuccess(false);
      }
    } finally {
      setResending(false);
    }
  };

  const handleSavePhone = async () => {
    const validationError = getPhoneSaveValidationError(phoneCountryIso, phoneNumberDraft);
    if (validationError) {
      setPhoneError(validationError);
      return;
    }

    setSavingPhone(true);
    setActionError('');
    setPhoneError('');
    try {
      const result = await updateCandidatePhone({
        phoneCountryIso,
        phoneNumber: phoneNumberDraft.replace(/\D/g, ''),
      });
      setPhoneNumberDraft(result.phoneNumber);
      setEditingPhone(false);
      await queryClient.invalidateQueries({ queryKey: ['candidate-dashboard'] });
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to update phone number.'));
    } finally {
      setSavingPhone(false);
    }
  };

  const startPhoneEdit = () => {
    if (!data) return;
    const split = splitProfilePhone(
      data.profile.phone,
      data.profile.phoneNumber || '',
      data.profile.countryCode,
      data.profile.phoneCountry
    );
    setPhoneCountryIso(split.iso);
    setPhoneNumberDraft(split.nationalNumber);
    setPhoneError('');
    setEditingPhone(true);
  };

  const handleStartAssessment = async () => {
    if (isMobilePhone()) return;
    setStarting(true);
    setActionError('');
    try {
      const { token } = await getAssessmentAccessToken();
      // Always land on instructions first; timer starts only from Ready page.
      navigate(`/ready?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const handleGiveAssessment = async (roleId: string) => {
    if (isMobilePhone()) return;
    setStartingRoleId(roleId);
    setActionError('');
    const candidateToken = getCandidateToken();
    try {
      const { token } = await getAssessmentAccessToken();
      initSessionAuth(token);
      const result = await assignRole(roleId);
      const assessmentToken = result.token || token;
      if (candidateToken) setCandidateToken(candidateToken);
      navigate(`/ready?token=${encodeURIComponent(assessmentToken)}`);
    } catch (err) {
      if (candidateToken) setCandidateToken(candidateToken);
      setActionError(getApiErrorMessage(err, 'Failed to open assessment.'));
    } finally {
      setStartingRoleId(null);
    }
  };

  const handleUploadResume = async (file: File | null) => {
    if (!file) return;
    setActionError('');

    if (!isPdfFile(file)) {
      setActionError('Only PDF resume files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setActionError('Resume file size must be 5MB or less.');
      return;
    }

    setUploadingResume(true);
    try {
      await uploadCandidateResume(file);
      await queryClient.invalidateQueries({ queryKey: ['candidate-dashboard'] });
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to upload resume.'));
    } finally {
      setUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const handleStartPrimaryResumeMode = () => {
    const primaryResume = data?.profile.resumes.find((resume) => resume.isPrimary);
    const firstResume = data?.profile.resumes[0];
    setSelectedPrimaryResumeId(primaryResume?.id || firstResume?.id || '');
    setPrimaryResumeMode(true);
  };

  const handleSavePrimaryResume = async () => {
    if (!selectedPrimaryResumeId) return;

    setSavingPrimaryResume(true);
    setActionError('');
    try {
      await setPrimaryCandidateResume(selectedPrimaryResumeId);
      await queryClient.invalidateQueries({ queryKey: ['candidate-dashboard'] });
      setPrimaryResumeMode(false);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to set primary resume.'));
    } finally {
      setSavingPrimaryResume(false);
    }
  };

  const closeResumePreview = () => {
    if (resumePreview) {
      window.URL.revokeObjectURL(resumePreview.url);
    }
    setResumePreview(null);
  };

  const openResumePreview = async (resumeId: string, filename: string) => {
    setOpeningResumeId(resumeId);
    setActionError('');
    try {
      const url = await getCandidateResumePreviewUrl(resumeId);
      setResumePreview({ url, filename });
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to open resume.'));
    } finally {
      setOpeningResumeId(null);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (resumes.length <= 1) {
      setActionError('At least one resume is required.');
      return;
    }

    setDeletingResumeId(resumeId);
    setActionError('');
    try {
      await deleteCandidateResume(resumeId);
      await queryClient.invalidateQueries({ queryKey: ['candidate-dashboard'] });
      if (selectedPrimaryResumeId === resumeId) {
        setSelectedPrimaryResumeId('');
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to delete resume.'));
    } finally {
      setDeletingResumeId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
        <div className="card-premium text-center max-w-md">
          <p className="text-red-600 mb-4">{getApiErrorMessage(error, 'Failed to load dashboard')}</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const mobileBlocked = isMobilePhone();
  const verified = data.verification.emailVerified;
  const hasSubmittedAssessment = data.assessment.hasCompleted || data.history.length > 0;
  const completedRoleIds = new Set(data.history.map((item) => item.jobRoleId).filter(Boolean));
  const completedRoleNames = new Set(
    data.history
      .map((item) => item.roleName?.trim().toLowerCase())
      .filter((roleName): roleName is string => Boolean(roleName)),
  );
  const appliedPositions = data.appliedPositions?.length
    ? data.appliedPositions
    : data.appliedPosition
      ? [data.appliedPosition]
      : [];
  const availableRoles = roles.filter((role) => (
    !completedRoleIds.has(role.id) &&
    !completedRoleNames.has(role.title.trim().toLowerCase())
  ));
  const profileCountry = data.profile.phoneCountry || getCountryNameFromDialCode(data.profile.countryCode) || '—';
  const resumes = data.profile.resumes || [];

  return (
    <CandidateLayout candidateName={data.profile.fullName} onLogout={() => navigate('/')}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-hurix-charcoal">
            Welcome, {data.profile.fullName}
          </h1>
          <p className="text-hurix-gray mt-1">Track your Hurix application and assessment progress.</p>
        </div>

        {resendSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-start gap-2">
            <MailCheck className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-medium">Verification email sent successfully.</p>
              <p className="mt-1 text-green-700">Please check your inbox and spam folder.</p>
            </div>
          </div>
        )}

        {actionError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="card-premium">
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <Award size={20} className="text-hurix-blue" />
                Applicant Status
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <TimelineStep done={data.timeline.registered} label="Registered" />
                <TimelineStep done={data.timeline.emailVerified} label="Email Verified" />
              </div>

              <div
                className={`rounded-lg border p-4 ${
                  verified
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {verified ? (
                    <MailCheck className="text-green-600 shrink-0 mt-0.5" size={22} />
                  ) : (
                    <Mail className="text-amber-600 shrink-0 mt-0.5" size={22} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${verified ? 'text-green-800' : 'text-amber-800'}`}>
                      {verified ? 'Email Verified' : 'Email Not Verified'}
                    </p>
                    {verified && data.verification.verifiedAt ? (
                      <p className="text-sm text-green-700 mt-1">
                        Verified On: {formatDate(data.verification.verifiedAt)}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-amber-700 mt-1">
                          Verification is required before starting the assessment.
                        </p>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resending || data.verification.resendsRemaining === 0}
                          className="btn-primary mt-4 flex items-center gap-2 text-sm disabled:opacity-60"
                        >
                          {resending ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                          Resend Verification Email
                        </button>
                        {data.verification.resendsRemaining === 0 && (
                          <p className="text-xs text-amber-800 mt-2">
                            Too many verification requests. Please try again later.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {hasSubmittedAssessment && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Opportunities', value: 'opportunities' as const },
                    { label: 'Applied positions', value: 'applied' as const },
                    { label: 'Assessment information', value: 'assessment' as const },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveDashboardTab(item.value)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm backdrop-blur transition ${
                        activeDashboardTab === item.value
                          ? 'border-hurix-blue bg-white text-hurix-blue'
                          : 'border-hurix-blue/20 bg-white/70 text-hurix-blue hover:border-hurix-blue hover:bg-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {activeDashboardTab === 'opportunities' && (
                <section id="opportunities" className="card-premium scroll-mt-24">
                  <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                    <Briefcase size={20} className="text-hurix-blue" />
                    Opportunities
                  </h2>

                  {availableRoles.length === 0 ? (
                    <p className="text-sm text-hurix-gray">No open opportunities at this time.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {availableRoles.map((role) => {
                        const alreadySelected = data.appliedPosition?.roleId === role.id || data.appliedPosition?.roleName === role.title;
                        return (
                          <article key={role.id} className="flex h-full flex-col rounded-xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                            <h3 className="text-base font-bold text-hurix-charcoal">{role.title}</h3>
                            <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-hurix-gray">
                              {role.description || 'Role-specific assessment opportunity.'}
                            </p>

                            <div className="mt-4 space-y-2 text-xs text-hurix-gray">
                              <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-hurix-blue" />
                                <span>{role.country}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign size={14} className="text-hurix-blue" />
                                <span>{role.compensation}</span>
                              </div>
                            </div>

                            {role.skills.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {role.skills.slice(0, 4).map((skill) => (
                                  <span key={skill} className="rounded-full bg-hurix-blue/10 px-2.5 py-1 text-[11px] font-medium text-hurix-blue">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-auto pt-5">
                              <button
                                type="button"
                                onClick={() => handleGiveAssessment(role.id)}
                                disabled={startingRoleId !== null || mobileBlocked}
                                className="btn-primary w-full py-3 text-sm disabled:opacity-60"
                              >
                                {startingRoleId === role.id ? (
                                  <Loader2 className="mx-auto animate-spin" size={18} />
                                ) : data.assessment.hasInProgress && alreadySelected ? (
                                  'Restart Assessment'
                                ) : alreadySelected ? (
                                  'Give Assessment'
                                ) : (
                                  'Give Assessment'
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
                )}
              </>
            )}

            {appliedPositions.length > 0 && (!hasSubmittedAssessment || activeDashboardTab === 'applied') && (
              <section id="applied-position" className="card-premium scroll-mt-24">
                <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                  <Briefcase size={20} className="text-hurix-blue" />
                  Applied Positions
                </h2>
                <div className="space-y-4">
                  {appliedPositions.map((position) => (
                    <div key={position.roleId || position.roleName} className="rounded-xl border border-slate-100 bg-white/80 p-4">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-hurix-gray mb-1">Role</p>
                          <p className="font-semibold">{position.roleName || '—'}</p>
                        </div>
                        <div>
                          <p className="text-hurix-gray mb-1">Country</p>
                          <p className="font-semibold">{position.country || '—'}</p>
                        </div>
                        <div>
                          <p className="text-hurix-gray mb-1">Compensation</p>
                          <p className="font-semibold">{position.compensation || '—'}</p>
                        </div>
                        <div>
                          <p className="text-hurix-gray mb-1">Application Date</p>
                          <p className="font-semibold">
                            {position.selectedAt ? formatDate(position.selectedAt) : '—'}
                          </p>
                        </div>
                        {position.skills.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-hurix-gray mb-2">Skills</p>
                            <div className="flex flex-wrap gap-2">
                              {position.skills.map((skill) => (
                                <span
                                  key={`${position.roleId || position.roleName}-${skill}`}
                                  className="px-2.5 py-1 bg-hurix-blue/10 text-hurix-blue text-xs font-medium rounded-full"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(!hasSubmittedAssessment || activeDashboardTab === 'assessment') && (
            <section id="assessment-information" className="card-premium scroll-mt-24">
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <FileText size={20} className="text-hurix-blue" />
                Assessment Information
              </h2>
              {data.history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[460px]">
                    <thead>
                      <tr className="border-b text-left text-hurix-gray">
                        <th className="pb-3 pr-4">Role</th>
                        <th className="pb-3 pr-4">Skills</th>
                        <th className="pb-3">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium text-hurix-charcoal">{item.roleName || item.language}</td>
                          <td className="py-3 pr-4 text-hurix-gray">
                            {item.skills?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {item.skills.slice(0, 4).map((skill) => (
                                  <span key={`${item.id}-${skill}`} className="rounded-full bg-hurix-blue/10 px-2 py-0.5 text-[11px] font-medium text-hurix-blue">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 text-hurix-gray">{formatDate(item.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-hurix-gray mb-1">Assessment Status</p>
                    <p className="font-semibold text-hurix-charcoal">{statusLabel(data.assessment.status)}</p>
                  </div>
                  <div>
                    <p className="text-hurix-gray mb-1">Assessment Date</p>
                    <p className="font-semibold text-hurix-charcoal">
                      {data.assessment.date ? formatDate(data.assessment.date) : '—'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                {data.assessment.hasCompleted ? (
                  <p className="text-hurix-gray text-sm font-medium">
                    You have already completed this assessment.
                  </p>
                ) : mobileBlocked ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    Mobile devices are not supported for coding assessments. Please use a laptop or
                    desktop computer.
                  </div>
                ) : !verified ? (
                  <p className="text-hurix-gray text-sm">
                    Please verify your email before starting the assessment. Use the button above to
                    resend the verification link if needed.
                  </p>
                ) : (
                  <button
                    onClick={handleStartAssessment}
                    disabled={starting}
                    className="btn-primary flex items-center gap-2"
                  >
                    {starting ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                    {data.assessment.hasInProgress ? 'Continue Assessment' : 'Start Assessment'}
                  </button>
                )}
              </div>
            </section>
            )}

          </div>

          <section className="card-premium h-fit">
            <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
              <User size={20} className="text-hurix-blue" />
              Profile Information
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-hurix-gray mb-1">Name</p>
                <p className="font-medium">{data.profile.fullName}</p>
              </div>
              <div>
                <p className="text-hurix-gray mb-1">Email</p>
                <p className="font-medium break-all">{data.profile.email}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-hurix-gray">Phone Number</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPhone) {
                        handleSavePhone();
                      } else {
                        startPhoneEdit();
                      }
                    }}
                    disabled={savingPhone || (editingPhone && !phoneNumberDraft.trim())}
                    className="text-xs font-semibold text-hurix-blue hover:underline disabled:opacity-60"
                  >
                    {savingPhone ? 'Saving...' : editingPhone ? 'Save' : <Pencil size={14} />}
                  </button>
                </div>
                {editingPhone ? (
                  <CountryPhoneInput
                    variant="profile"
                    hideLabel
                    countryIso={phoneCountryIso}
                    phoneNumber={phoneNumberDraft}
                    onCountryChange={(iso) => {
                      setPhoneCountryIso(iso);
                      setPhoneError('');
                    }}
                    onPhoneChange={(value) => {
                      setPhoneNumberDraft(value);
                      setPhoneError('');
                    }}
                    error={phoneError}
                  />
                ) : (
                  <p className="font-medium">{data.profile.phone}</p>
                )}
              </div>
              <div>
                <p className="text-hurix-gray mb-1">Country</p>
                <p className="font-medium">{profileCountry}</p>
              </div>
              <div>
                <p className="text-hurix-gray mb-1">Years of Experience</p>
                <p className="font-medium">{data.profile.experienceLabel || '—'}</p>
              </div>
              <div>
                <p className="text-hurix-gray mb-1">LinkedIn</p>
                <a
                  href={data.profile.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-hurix-blue hover:underline break-all"
                >
                  {data.profile.linkedinUrl}
                </a>
              </div>
              <div>
                <p className="text-hurix-gray mb-1">Referral Code</p>
                <p className="font-medium">{data.profile.referralCode || '—'}</p>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-hurix-charcoal">Resume</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(event) => handleUploadResume(event.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => resumeInputRef.current?.click()}
                      disabled={uploadingResume || savingPrimaryResume}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-sm backdrop-blur hover:bg-white disabled:opacity-60"
                    >
                      {uploadingResume ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                      Upload More
                    </button>
                    {resumes.length > 0 && (
                      <button
                        type="button"
                        onClick={primaryResumeMode ? handleSavePrimaryResume : handleStartPrimaryResumeMode}
                        disabled={savingPrimaryResume || uploadingResume || (primaryResumeMode && !selectedPrimaryResumeId)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold shadow-sm backdrop-blur disabled:opacity-60 ${
                          primaryResumeMode
                            ? 'bg-black text-white hover:bg-slate-900'
                            : 'border border-black/10 bg-white/80 text-slate-950 hover:bg-white'
                        }`}
                      >
                        {savingPrimaryResume ? <Loader2 className="animate-spin" size={13} /> : null}
                        {primaryResumeMode ? 'Save' : 'Set Primary'}
                      </button>
                    )}
                  </div>
                </div>

                {resumes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center text-xs text-hurix-gray">
                    No resume uploaded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {resumes.map((resume) => (
                      <div
                        role="button"
                        tabIndex={0}
                        key={resume.id}
                        onClick={() => openResumePreview(resume.id, resume.fileName)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openResumePreview(resume.id, resume.fileName);
                          }
                        }}
                        className={`relative rounded-2xl border p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-white ${
                          resume.isPrimary
                            ? 'border-black/20 bg-white'
                            : 'border-slate-100 bg-white/70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteResume(resume.id);
                          }}
                          className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/90 text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-600 ${
                            resumes.length <= 1 ? 'cursor-not-allowed opacity-40' : ''
                          }`}
                          title={resumes.length <= 1 ? 'At least one resume is required' : 'Delete resume'}
                          aria-label={`Delete ${resume.fileName}`}
                        >
                          {deletingResumeId === resume.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                        </button>
                        <div className="mx-auto flex h-24 w-20 items-center justify-center rounded-xl border border-black/10 bg-gradient-to-br from-white to-slate-100 shadow-inner">
                          {openingResumeId === resume.id ? (
                            <Loader2 className="animate-spin text-slate-800" size={24} />
                          ) : (
                            <FileText className="text-slate-800" size={28} />
                          )}
                        </div>
                        <div className="mt-2 flex min-w-0 items-start justify-center gap-2">
                          {primaryResumeMode && (
                            <input
                              type="radio"
                              name="primaryResume"
                              checked={selectedPrimaryResumeId === resume.id}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                setSelectedPrimaryResumeId(resume.id);
                              }}
                              className="mt-0.5 h-4 w-4 accent-black"
                              aria-label={`Set ${resume.fileName} as primary resume`}
                            />
                          )}
                          <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-4 text-slate-950" title={resume.fileName}>
                            {resume.fileName}
                          </p>
                        </div>
                        {resume.isPrimary && !primaryResumeMode && (
                          <span className="mt-2 inline-flex rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      {resumePreview && (
        <ResumePreviewModal
          url={resumePreview.url}
          filename={resumePreview.filename}
          onClose={closeResumePreview}
        />
      )}
    </CandidateLayout>
  );
}
