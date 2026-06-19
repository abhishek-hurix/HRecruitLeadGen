export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidLinkedIn(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|company)\/[\w-]+\/?/i.test(url);
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
