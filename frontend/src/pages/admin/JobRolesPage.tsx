import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Archive, CheckCircle, XCircle, Sparkles, Info } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  getJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
  setJobRoleStatus,
  generateJobRoleQuestions,
} from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

type RoleForm = {
  title: string;
  country: string;
  compensationType: 'HOURLY' | 'MONTHLY' | 'ANNUAL';
  hourlyRate: string;
  monthlySalary: string;
  currency: string;
  skills: string;
  description: string;
  openPositions: string;
  closingDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  assessmentLanguages: string[];
};

const emptyForm: RoleForm = {
  title: '',
  country: '',
  compensationType: 'HOURLY',
  hourlyRate: '',
  monthlySalary: '',
  currency: 'USD',
  skills: '',
  description: '',
  openPositions: '1',
  closingDate: '',
  status: 'ACTIVE',
  assessmentLanguages: ['PYTHON'],
};

export function JobRolesPage() {
  const { isSuperAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [generatingRoleId, setGeneratingRoleId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generateConfirmRole, setGenerateConfirmRole] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['job-roles'],
    queryFn: getJobRoles,
  });

  useEffect(() => {
    if (!generatingRoleId) {
      setGenerationProgress(0);
      return;
    }

    setGenerationProgress(3);
    const interval = window.setInterval(() => {
      setGenerationProgress((progress) => Math.min(progress + Math.max(1, Math.round((95 - progress) / 8)), 95));
    }, 700);

    return () => window.clearInterval(interval);
  }, [generatingRoleId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        country: form.country,
        compensationType: form.compensationType,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
        currency: form.currency,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        description: form.description || null,
        openPositions: parseInt(form.openPositions, 10) || 1,
        closingDate: form.closingDate || null,
        status: form.status,
        assessmentLanguages: form.assessmentLanguages,
      };
      if (editId) return updateJobRole(editId, payload);
      return createJobRole(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-roles'] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setError('');
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data;
      setError(data?.errors?.join(', ') || data?.message || 'Save failed');
    },
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  };

  const openEdit = (role: Record<string, unknown>) => {
    setEditId(role.id as string);
    setForm({
      title: role.title as string,
      country: role.country as string,
      compensationType: role.compensationType as RoleForm['compensationType'],
      hourlyRate: role.hourlyRate != null ? String(role.hourlyRate) : '',
      monthlySalary: role.monthlySalary != null ? String(role.monthlySalary) : '',
      currency: role.currency as string,
      skills: Array.isArray(role.skills) ? (role.skills as string[]).join(', ') : '',
      description: (role.description as string) || '',
      openPositions: String(role.openPositions),
      closingDate: role.closingDate ? (role.closingDate as string).slice(0, 10) : '',
      status: role.status as RoleForm['status'],
      assessmentLanguages: Array.isArray(role.assessmentLanguages)
        ? (role.assessmentLanguages as string[])
        : ['PYTHON'],
    });
    setShowForm(true);
    setError('');
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      INACTIVE: 'bg-amber-100 text-amber-700',
      ARCHIVED: 'bg-slate-100 text-slate-600',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || colors.INACTIVE}`}>
        {status}
      </span>
    );
  };

  const runGenerateQuestions = async (roleId: string) => {
    setGeneratingRoleId(roleId);
    setError('');
    setMessage('');
    try {
      const result = await generateJobRoleQuestions(roleId);
      await queryClient.invalidateQueries({ queryKey: ['job-roles'] });
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      setGenerationProgress(100);
      setMessage(`Generated ${result.createdCount} MCQ questions for this role.`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Question generation failed');
    } finally {
      window.setTimeout(() => {
        setGeneratingRoleId(null);
        setGenerateConfirmRole(null);
      }, 500);
    }
  };

  const handleGenerateQuestions = async (role: Record<string, unknown>) => {
    const existingCount = Number(role.activeQuestionCount || 0);
    if (existingCount > 0) {
      setGenerateConfirmRole(role);
      return;
    }
    await runGenerateQuestions(role.id as string);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-hurix-charcoal">Job Roles</h1>
          <p className="text-sm text-hurix-gray mt-1">Manage hiring positions and role-specific assessments</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2">
            <Plus size={18} /> Create Role
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      {showForm && isSuperAdmin && (
        <div className="card-premium mb-8">
          <h2 className="font-semibold text-lg mb-4">{editId ? 'Edit Role' : 'Create Role'}</h2>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role Title</label>
              <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input className="input-field" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Compensation Type</label>
              <select className="input-field" value={form.compensationType} onChange={(e) => setForm({ ...form, compensationType: e.target.value as RoleForm['compensationType'] })}>
                <option value="HOURLY">Hourly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input className="input-field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            {form.compensationType === 'HOURLY' && (
              <div>
                <label className="block text-sm font-medium mb-1">Hourly Rate</label>
                <input type="number" className="input-field" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
              </div>
            )}
            {(form.compensationType === 'MONTHLY' || form.compensationType === 'ANNUAL') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {form.compensationType === 'ANNUAL' ? 'Annual Salary' : 'Monthly Salary / LPA'}
                </label>
                <input type="number" className="input-field" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Skills (comma-separated)</label>
              <input className="input-field" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Python, FastAPI, SQL" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Open Positions</label>
              <input type="number" className="input-field" value={form.openPositions} onChange={(e) => setForm({ ...form, openPositions: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Closing Date</label>
              <input type="date" className="input-field" value={form.closingDate} onChange={(e) => setForm({ ...form, closingDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoleForm['status'] })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">Assessment Languages</label>
              <div className="flex gap-4">
                {['PYTHON', 'JAVASCRIPT'].map((lang) => (
                  <label key={lang} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.assessmentLanguages.includes(lang)}
                      onChange={(e) => {
                        const langs = e.target.checked
                          ? [...form.assessmentLanguages, lang]
                          : form.assessmentLanguages.filter((l) => l !== lang);
                        setForm({ ...form, assessmentLanguages: langs.length ? langs : ['PYTHON'] });
                      }}
                    />
                    {lang}
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving...' : 'Save Role'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-hurix-gray">Loading roles...</p>
      ) : (
        <div className="space-y-4">
          {(data?.data || []).map((role: Record<string, unknown>) => {
            const analytics = role.analytics as Record<string, unknown> | undefined;
            const needsQuestions = Number(role.activeQuestionCount || 0) === 0;
            return (
              <div key={role.id as string} className="card-premium">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-hurix-charcoal">{role.title as string}</h2>
                      {statusBadge(role.status as string)}
                    </div>
                    {needsQuestions && (
                      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-black">
                        <Info size={13} className="shrink-0" />
                        <span>Generate questions for making this role active.</span>
                      </div>
                    )}
                    <p className="text-sm text-hurix-gray mb-3">
                      {role.country as string} · {role.compensationDisplay as string}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(role.skills as string[]).map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-hurix-blue/10 text-hurix-blue text-xs rounded-full">{s}</span>
                      ))}
                    </div>
                    {analytics && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div><p className="text-hurix-gray text-xs">Applications</p><p className="font-semibold">{analytics.applicationsReceived as number}</p></div>
                        <div><p className="text-hurix-gray text-xs">Started</p><p className="font-semibold">{analytics.assessmentStarted as number}</p></div>
                        <div><p className="text-hurix-gray text-xs">Submitted</p><p className="font-semibold">{analytics.assessmentSubmitted as number}</p></div>
                        <div><p className="text-hurix-gray text-xs">Avg Score</p><p className="font-semibold">{analytics.averageScore != null ? `${analytics.averageScore}/10` : '—'}</p></div>
                        <div><p className="text-hurix-gray text-xs">Conversion</p><p className="font-semibold">{analytics.conversionRate as string}</p></div>
                      </div>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleGenerateQuestions(role)}
                        disabled={generatingRoleId !== null}
                        className={`relative overflow-hidden rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
                          generatingRoleId === role.id
                            ? 'bg-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
                            : 'bg-hurix-gradient hover:opacity-90'
                        } disabled:opacity-80`}
                      >
                        {generatingRoleId === role.id && (
                          <span
                            className="absolute inset-y-0 left-0 bg-emerald-400/40 transition-all duration-500"
                            style={{ width: `${generationProgress}%` }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1">
                          <Sparkles size={14} />
                          {generatingRoleId === role.id
                            ? `Generating ${generationProgress}%`
                            : 'Generate Questions'}
                        </span>
                      </button>
                      <button onClick={() => openEdit(role)} className="btn-secondary text-sm flex items-center gap-1 px-3 py-2">
                        <Pencil size={14} /> Edit
                      </button>
                      {role.status !== 'ACTIVE' && (
                        <button onClick={() => setJobRoleStatus(role.id as string, 'ACTIVE').then(() => queryClient.invalidateQueries({ queryKey: ['job-roles'] }))} className="btn-secondary text-sm flex items-center gap-1 px-3 py-2">
                          <CheckCircle size={14} /> Activate
                        </button>
                      )}
                      {role.status === 'ACTIVE' && (
                        <button onClick={() => setJobRoleStatus(role.id as string, 'INACTIVE').then(() => queryClient.invalidateQueries({ queryKey: ['job-roles'] }))} className="btn-secondary text-sm flex items-center gap-1 px-3 py-2">
                          <XCircle size={14} /> Deactivate
                        </button>
                      )}
                      <button onClick={() => setJobRoleStatus(role.id as string, 'ARCHIVED').then(() => queryClient.invalidateQueries({ queryKey: ['job-roles'] }))} className="btn-secondary text-sm flex items-center gap-1 px-3 py-2">
                        <Archive size={14} /> Archive
                      </button>
                      <button onClick={() => deleteJobRole(role.id as string).then(() => queryClient.invalidateQueries({ queryKey: ['job-roles'] }))} className="text-red-600 text-sm flex items-center gap-1 px-3 py-2 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {generateConfirmRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-hurix-blue/10 text-hurix-blue">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-hurix-charcoal">Replace Existing Questions?</h2>
                <p className="text-sm text-hurix-gray">{generateConfirmRole.title as string}</p>
              </div>
            </div>
            <p className="mb-6 text-sm leading-6 text-hurix-gray">
              This role already has {Number(generateConfirmRole.activeQuestionCount || 0)} active MCQ questions.
              Generating again will replace the existing active questions with 10 fresh MCQ questions.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGenerateConfirmRole(null)}
                className="btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runGenerateQuestions(generateConfirmRole.id as string)}
                disabled={generatingRoleId !== null}
                className="btn-primary px-4 py-2"
              >
                {generatingRoleId === generateConfirmRole.id ? 'Generating...' : 'OK, Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
