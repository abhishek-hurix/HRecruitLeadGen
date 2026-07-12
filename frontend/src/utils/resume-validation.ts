const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type ResumeValidationResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export function validateResumePdf(file: File | null | undefined): ResumeValidationResult {
  if (!file) return { ok: false, message: 'Resume file is required' };

  const name = file.name || '';
  if (!/\.pdf$/i.test(name)) {
    return { ok: false, message: 'Only PDF files are allowed' };
  }

  if (file.type && file.type !== 'application/pdf') {
    return { ok: false, message: 'Only PDF files are allowed' };
  }

  if (file.size > MAX_RESUME_BYTES) {
    return { ok: false, message: 'Resume must be 10 MB or smaller' };
  }

  return { ok: true, file };
}

export const MAX_RESUME_SIZE_MB = 10;
