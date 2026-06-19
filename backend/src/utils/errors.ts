export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function normalizeOutput(output: string): string {
  return output.trim().replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim();
}

export function isValidLinkedInUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|company)\/[\w-]+\/?/i.test(url);
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
