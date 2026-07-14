/** Fill {{placeholders}} in WhatsApp template body text. */
export function fillWhatsAppTemplate(
  bodyText: string,
  vars: Record<string, string>
): string {
  let out = bodyText;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  // Drop empty conditional blocks: {{#key}}...{{/key}}
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key: string, inner: string) =>
    vars[key] ? inner.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), vars[key]) : ''
  );
  return out;
}

export function candidateWhatsAppVars(candidate: {
  fullName: string;
  applicationId?: string | null;
  id: string;
  roleLabel?: string | null;
  appliedRole?: string | null;
  assessmentStatus?: string | null;
}): Record<string, string> {
  return {
    candidateName: candidate.fullName || '',
    assignedRole: candidate.roleLabel || candidate.appliedRole || 'Not Assigned',
    assessmentStatus: (candidate.assessmentStatus || '').replace(/_/g, ' '),
    applicationId: (candidate.applicationId || candidate.id.slice(0, 8)).toUpperCase(),
  };
}

/** Build wa.me URL with optional pre-filled message. */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const base = `https://wa.me/${digits}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
