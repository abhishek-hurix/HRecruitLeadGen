import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  GlassModal,
  GlassDialog,
  glassBtnPrimaryClass,
  glassBtnSecondaryClass,
  glassFieldClass,
} from '../../components/ui/GlassDialog';
import {
  createReminderTemplate,
  createWhatsAppTemplate,
  deleteReminderTemplate,
  deleteWhatsAppTemplate,
  getReminderTemplates,
  getWhatsAppTemplates,
  updateReminderTemplate,
  updateWhatsAppTemplate,
} from '../../api/admin';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';
import { htmlToPlainEmail, plainToEmailHtml } from '../../utils/emailBody';
import type { ReminderTemplate, WhatsAppTemplate } from '../../types/candidate-management';

type EmailForm = { name: string; subject: string; bodyText: string };
type WhatsAppForm = { name: string; bodyText: string };

const emptyEmailForm: EmailForm = { name: '', subject: '', bodyText: '' };
const emptyWhatsAppForm: WhatsAppForm = { name: '', bodyText: '' };

const VARIABLE_HINT =
  'Variables: {{candidateName}}, {{assignedRole}}, {{applicationId}}, {{assessmentStatus}}';

function TemplateFormShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <GlassModal title={title} onClose={onClose} maxWidth="xl">
      {children}
    </GlassModal>
  );
}

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [whatsappFormOpen, setWhatsappFormOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<ReminderTemplate | null>(null);
  const [editingWhatsApp, setEditingWhatsApp] = useState<WhatsAppTemplate | null>(null);
  const [emailForm, setEmailForm] = useState<EmailForm>(emptyEmailForm);
  const [whatsappForm, setWhatsappForm] = useState<WhatsAppForm>(emptyWhatsAppForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteEmailTarget, setDeleteEmailTarget] = useState<ReminderTemplate | null>(null);
  const [deleteWhatsAppTarget, setDeleteWhatsAppTarget] = useState<WhatsAppTemplate | null>(null);

  const emailQuery = useQuery({
    queryKey: ['reminder-templates'],
    queryFn: getReminderTemplates,
  });

  const whatsappQuery = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: getWhatsAppTemplates,
  });

  const emailTemplates = useMemo(() => emailQuery.data || [], [emailQuery.data]);
  const whatsappTemplates = useMemo(() => whatsappQuery.data || [], [whatsappQuery.data]);

  const openCreateEmail = () => {
    setEditingEmail(null);
    setEmailForm(emptyEmailForm);
    setError(null);
    setEmailFormOpen(true);
  };

  const openEditEmail = (template: ReminderTemplate) => {
    setEditingEmail(template);
    setEmailForm({
      name: template.name,
      subject: template.subject,
      bodyText: htmlToPlainEmail(template.bodyHtml),
    });
    setError(null);
    setEmailFormOpen(true);
  };

  const openCreateWhatsApp = () => {
    setEditingWhatsApp(null);
    setWhatsappForm(emptyWhatsAppForm);
    setError(null);
    setWhatsappFormOpen(true);
  };

  const openEditWhatsApp = (template: WhatsAppTemplate) => {
    setEditingWhatsApp(template);
    setWhatsappForm({
      name: template.name,
      bodyText: template.bodyText,
    });
    setError(null);
    setWhatsappFormOpen(true);
  };

  const saveEmailMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: emailForm.name,
        subject: emailForm.subject,
        bodyHtml: plainToEmailHtml(emailForm.bodyText),
      };
      if (editingEmail) return updateReminderTemplate(editingEmail.id, payload);
      return createReminderTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-templates'] });
      setEmailFormOpen(false);
      setEditingEmail(null);
      setEmailForm(emptyEmailForm);
      setError(null);
    },
    onError: (e) => setError(getAdminActionErrorMessage(e)),
  });

  const saveWhatsAppMutation = useMutation({
    mutationFn: async () => {
      if (editingWhatsApp) return updateWhatsAppTemplate(editingWhatsApp.id, whatsappForm);
      return createWhatsAppTemplate(whatsappForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setWhatsappFormOpen(false);
      setEditingWhatsApp(null);
      setWhatsappForm(emptyWhatsAppForm);
      setError(null);
    },
    onError: (e) => setError(getAdminActionErrorMessage(e)),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: deleteReminderTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-templates'] });
      setDeleteEmailTarget(null);
    },
    onError: (e) => setError(getAdminActionErrorMessage(e)),
  });

  const deleteWhatsAppMutation = useMutation({
    mutationFn: deleteWhatsAppTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setDeleteWhatsAppTarget(null);
    },
    onError: (e) => setError(getAdminActionErrorMessage(e)),
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Templates</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage email reminder and WhatsApp message templates used across candidate outreach.
          </p>
        </div>

        {error && !emailFormOpen && !whatsappFormOpen && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}

        <section className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-neutral-800 shadow-sm">
                <Mail size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-950">Email Templates</h2>
                <p className="text-xs text-neutral-500">Used for Send Reminder Email</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateEmail}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)] hover:bg-neutral-800"
            >
              <Plus size={16} />
              Add Template
            </button>
          </div>

          {emailQuery.isLoading ? (
            <p className="text-sm text-neutral-500">Loading email templates...</p>
          ) : emailTemplates.length === 0 ? (
            <p className="text-sm text-neutral-500">No email templates yet.</p>
          ) : (
            <div className="space-y-3">
              {emailTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-950">{template.name}</p>
                      <p className="mt-1 text-sm text-neutral-700">
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Subject</span>
                        <span className="mt-0.5 block">{template.subject}</span>
                      </p>
                      <div
                        className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-600 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: template.bodyHtml }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${template.name}`}
                        onClick={() => openEditEmail(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-neutral-700 shadow-sm hover:bg-white hover:text-neutral-950"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${template.name}`}
                        onClick={() => setDeleteEmailTarget(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-red-600 shadow-sm hover:bg-white"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-neutral-800 shadow-sm">
                <MessageCircle size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-950">WhatsApp Templates</h2>
                <p className="text-xs text-neutral-500">Used when WhatsApp icon is clicked on a candidate</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateWhatsApp}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)] hover:bg-neutral-800"
            >
              <Plus size={16} />
              Add Template
            </button>
          </div>

          {whatsappQuery.isLoading ? (
            <p className="text-sm text-neutral-500">Loading WhatsApp templates...</p>
          ) : whatsappTemplates.length === 0 ? (
            <p className="text-sm text-neutral-500">No WhatsApp templates yet.</p>
          ) : (
            <div className="space-y-3">
              {whatsappTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-950">{template.name}</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-600 line-clamp-4">
                        {template.bodyText}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${template.name}`}
                        onClick={() => openEditWhatsApp(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-neutral-700 shadow-sm hover:bg-white hover:text-neutral-950"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${template.name}`}
                        onClick={() => setDeleteWhatsAppTarget(template)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-red-600 shadow-sm hover:bg-white"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {emailFormOpen && (
        <TemplateFormShell
          title={editingEmail ? 'Edit Email Template' : 'Add Email Template'}
          onClose={() => setEmailFormOpen(false)}
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Template name</label>
              <input
                className={glassFieldClass}
                style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
                value={emailForm.name}
                onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                placeholder="Application Follow-up"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Subject</label>
              <input
                className={glassFieldClass}
                style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Update on your application at Hurix"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Email body</label>
              <textarea
                className={`${glassFieldClass} min-h-[160px]`}
                style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
                value={emailForm.bodyText}
                onChange={(e) => setEmailForm({ ...emailForm, bodyText: e.target.value })}
                placeholder={`Hello {{candidateName}},

We are reviewing applications for {{assignedRole}}. Please ensure your profile is complete.

Application ID: {{applicationId}}

https://candidates.hurixsystems.com/

Regards,
Team Hurix Digital`}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Type normally — use Enter for new lines. {VARIABLE_HINT}
              </p>
            </div>
            {error && <p className="text-center text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEmailFormOpen(false)}
                className={glassBtnSecondaryClass}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveEmailMutation.isPending}
                onClick={() => {
                  setError(null);
                  saveEmailMutation.mutate();
                }}
                className={glassBtnPrimaryClass}
              >
                {saveEmailMutation.isPending ? 'Saving...' : editingEmail ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </TemplateFormShell>
      )}

      {whatsappFormOpen && (
        <TemplateFormShell
          title={editingWhatsApp ? 'Edit WhatsApp Template' : 'Add WhatsApp Template'}
          onClose={() => setWhatsappFormOpen(false)}
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Template name</label>
              <input
                className={glassFieldClass}
                style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
                value={whatsappForm.name}
                onChange={(e) => setWhatsappForm({ ...whatsappForm, name: e.target.value })}
                placeholder="Application Follow-up"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Message</label>
              <textarea
                className={`${glassFieldClass} min-h-[180px]`}
                style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
                value={whatsappForm.bodyText}
                onChange={(e) => setWhatsappForm({ ...whatsappForm, bodyText: e.target.value })}
                placeholder="Hello {{candidateName}}, ..."
              />
              <p className="mt-1 text-xs text-neutral-500">{VARIABLE_HINT}</p>
            </div>
            {error && <p className="text-center text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWhatsappFormOpen(false)}
                className={glassBtnSecondaryClass}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveWhatsAppMutation.isPending}
                onClick={() => {
                  setError(null);
                  saveWhatsAppMutation.mutate();
                }}
                className={glassBtnPrimaryClass}
              >
                {saveWhatsAppMutation.isPending ? 'Saving...' : editingWhatsApp ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </TemplateFormShell>
      )}

      {deleteEmailTarget && (
        <GlassDialog
          title="Delete Email Template"
          message={
            <>
              Delete email template <strong>{deleteEmailTarget.name}</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => deleteEmailMutation.mutate(deleteEmailTarget.id)}
          onCancel={() => setDeleteEmailTarget(null)}
          isLoading={deleteEmailMutation.isPending}
          danger
        />
      )}

      {deleteWhatsAppTarget && (
        <GlassDialog
          title="Delete WhatsApp Template"
          message={
            <>
              Delete WhatsApp template <strong>{deleteWhatsAppTarget.name}</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => deleteWhatsAppMutation.mutate(deleteWhatsAppTarget.id)}
          onCancel={() => setDeleteWhatsAppTarget(null)}
          isLoading={deleteWhatsAppMutation.isPending}
          danger
        />
      )}
    </AdminLayout>
  );
}
