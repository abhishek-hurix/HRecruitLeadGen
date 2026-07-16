import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import {
  CountryPhoneInput,
  DEFAULT_COUNTRY_ISO,
  isValidNationalPhone,
} from '../components/registration/CountryPhoneInput';
import { parseResume, registerCandidate } from '../api/registration';
import { getVisitorId } from '../utils/visitor';
import { isValidEmail, isValidLinkedIn, isPdfFile } from '../utils/validation';
import { EXPERIENCE_OPTIONS } from '../utils/experience';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledEmail = searchParams.get('email') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: prefilledEmail,
    linkedinUrl: '',
    referralCode: '',
    password: '',
    confirmPassword: '',
    experienceCategory: '',
  });
  const [countryIso, setCountryIso] = useState<CountryCode>(DEFAULT_COUNTRY_ISO);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseNotice, setParseNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleResumeChange = async (file: File | null) => {
    setResume(file);
    setParseNotice('');
    setErrors((current) => ({ ...current, resume: '' }));
    if (!file) return;

    if (!isPdfFile(file)) {
      setErrors((current) => ({ ...current, resume: 'Only PDF files allowed' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, resume: 'Max file size is 5MB' }));
      return;
    }

    setForm((current) => ({
      ...current,
      fullName: '',
      email: prefilledEmail,
      linkedinUrl: '',
      experienceCategory: '',
    }));
    setCountryIso(DEFAULT_COUNTRY_ISO);
    setPhoneNumber('');
    setParsingResume(true);
    try {
      const parsed = await parseResume(file);
      setForm((current) => ({
        ...current,
        fullName: parsed.fullName || '',
        email: parsed.email || prefilledEmail,
        linkedinUrl: parsed.linkedinUrl || '',
        experienceCategory: parsed.experienceCategory || '',
      }));
      setCountryIso((parsed.phoneCountryIso as CountryCode) || DEFAULT_COUNTRY_ISO);
      setPhoneNumber(parsed.phoneNumber || '');
      setParseNotice('We auto-filled the details we could find. Please review everything before submitting.');
    } catch {
      setParseNotice('CV uploaded. We could not auto-fill details, so please complete the form manually.');
    } finally {
      setParsingResume(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Full name is required';
    if (!isValidEmail(form.email)) e.email = 'Valid email required';
    if (!isValidNationalPhone(countryIso, phoneNumber)) {
      e.phone = 'Valid phone number required for selected country';
    }
    if (!form.experienceCategory) e.experienceCategory = 'Years of experience is required';
    if (form.linkedinUrl.trim() && !isValidLinkedIn(form.linkedinUrl.trim())) {
      e.linkedinUrl = 'Enter a valid LinkedIn URL or leave blank';
    }
    if (!resume) e.resume = 'Resume PDF is required';
    else if (!isPdfFile(resume)) e.resume = 'Only PDF files allowed';
    else if (resume.size > 5 * 1024 * 1024) e.resume = 'Max file size is 5MB';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('fullName', form.fullName);
      fd.append('email', form.email);
      fd.append('phoneCountryIso', countryIso);
      fd.append('phoneNumber', phoneNumber.replace(/\D/g, ''));
      fd.append('experienceCategory', form.experienceCategory);
      fd.append('linkedinUrl', form.linkedinUrl);
      fd.append('password', form.password);
      if (form.referralCode) fd.append('referralCode', form.referralCode);
      fd.append('visitorId', getVisitorId());
      fd.append('resume', resume!);

      const result = await registerCandidate(fd);
      navigate(`/registration-success?email=${encodeURIComponent(result.email)}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(circle_at_8%_16%,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(139,92,246,0.18),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef2ff_100%)]">
      <div className="pointer-events-none absolute -left-24 top-32 h-80 w-80 rounded-full bg-hurix-cyan/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-hurix-purple/20 blur-3xl" />
      <Header showNav={false} />
      <main className="relative flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto rounded-[2rem] border border-black/10 bg-white/70 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl sm:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-hurix-charcoal">Candidate Registration</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-hurix-gray">
              Upload your CV first. We will use this as the source document for your application,
              then you can complete or correct the remaining details below.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Upload CV</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">Start with your resume</h2>
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
                <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                  resume ? 'bg-green-600 text-white' : 'bg-black text-white group-hover:bg-slate-800'
                }`}>
                  {resume ? <CheckCircle2 size={22} /> : <Upload size={22} />}
                </span>
                <span className="text-sm font-semibold text-slate-950">
                  {parsingResume ? 'Reading your CV...' : resume ? resume.name : 'Click to upload your CV'}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {parsingResume
                    ? 'Please wait while we try to auto-fill your details'
                    : resume
                      ? `${(resume.size / (1024 * 1024)).toFixed(2)} MB selected`
                      : 'Your registration details will be completed after this step'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => handleResumeChange(e.target.files?.[0] || null)}
                />
              </label>
              {errors.resume && <p className="text-red-500 text-xs mt-2">{errors.resume}</p>}
              {parseNotice && <p className="mt-2 text-xs font-medium text-slate-600">{parseNotice}</p>}
            </section>

            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Your Details</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                className="input-field"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="John Doe"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <CountryPhoneInput
              countryIso={countryIso}
              phoneNumber={phoneNumber}
              onCountryChange={setCountryIso}
              onPhoneChange={setPhoneNumber}
              error={errors.phone}
            />

            <div>
              <label className="block text-sm font-medium mb-1">Years of Experience *</label>
              <select
                className="input-field"
                value={form.experienceCategory}
                onChange={(e) => setForm({ ...form, experienceCategory: e.target.value })}
              >
                <option value="">Select experience level</option>
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.experienceCategory && (
                <p className="text-red-500 text-xs mt-1">{errors.experienceCategory}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">LinkedIn URL (optional)</label>
              <input
                className="input-field"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/johndoe"
              />
              {errors.linkedinUrl && <p className="text-red-500 text-xs mt-1">{errors.linkedinUrl}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
                minLength={8}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password *</label>
              <input
                type="password"
                className="input-field"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
                minLength={8}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Referral Code (Employee ID)</label>
              <input
                className="input-field"
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
                placeholder="EMP001 (optional)"
              />
            </div>

            <button type="submit" disabled={loading || parsingResume} className="btn-primary w-full py-4">
              {loading || parsingResume ? <Loader2 className="animate-spin" size={20} /> : 'Submit Application'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
