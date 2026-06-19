import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Loader2 } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import {
  CountryPhoneInput,
  DEFAULT_COUNTRY_ISO,
  isValidNationalPhone,
} from '../components/registration/CountryPhoneInput';
import { registerCandidate } from '../api/registration';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Full name is required';
    if (!isValidEmail(form.email)) e.email = 'Valid email required';
    if (!isValidNationalPhone(countryIso, phoneNumber)) {
      e.phone = 'Valid phone number required for selected country';
    }
    if (!form.experienceCategory) e.experienceCategory = 'Years of experience is required';
    if (!isValidLinkedIn(form.linkedinUrl)) e.linkedinUrl = 'Valid LinkedIn URL required';
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
    <div className="min-h-screen flex flex-col bg-hurix-light">
      <Header showNav={false} />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-xl mx-auto card-premium">
          <h1 className="text-2xl font-bold text-hurix-charcoal mb-2">Candidate Registration</h1>
          <p className="text-hurix-gray text-sm mb-8">Apply for the Hurix Technical Assessment</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <label className="block text-sm font-medium mb-1">LinkedIn URL *</label>
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

            <div>
              <label className="block text-sm font-medium mb-1">Resume (PDF only) *</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-hurix-blue/50 transition-colors">
                <Upload className="text-hurix-gray mb-2" size={24} />
                <span className="text-sm text-hurix-gray">
                  {resume ? resume.name : 'Click to upload PDF (max 5MB)'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setResume(e.target.files?.[0] || null)}
                />
              </label>
              {errors.resume && <p className="text-red-500 text-xs mt-1">{errors.resume}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-4">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Application'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
