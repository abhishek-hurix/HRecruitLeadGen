import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPhone, isValidLinkedIn, isPdfFile, formatDate } from '../../utils/validation';

describe('Form validation', () => {
  it('validates email', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
  });

  it('validates phone', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('12')).toBe(false);
  });

  it('validates LinkedIn URL', () => {
    expect(isValidLinkedIn('https://linkedin.com/in/jane')).toBe(true);
    expect(isValidLinkedIn('https://www.linkedin.com/company/hurix')).toBe(true);
    expect(isValidLinkedIn('http://example.com')).toBe(false);
  });

  it('validates PDF files', () => {
    const pdf = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' });
    const txt = new File(['text'], 'resume.txt', { type: 'text/plain' });
    expect(isPdfFile(pdf)).toBe(true);
    expect(isPdfFile(txt)).toBe(false);
  });

  it('formats dates', () => {
    const formatted = formatDate('2026-06-18T12:00:00.000Z');
    expect(formatted).toMatch(/2026/);
  });
});
