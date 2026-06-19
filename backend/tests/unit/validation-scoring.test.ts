import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPhone, isValidLinkedInUrl, normalizeOutput } from '../../src/utils/errors';

describe('Validation utilities', () => {
  it('validates emails', () => {
    expect(isValidEmail('user@hurix.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
  });

  it('validates phone numbers', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });

  it('validates LinkedIn URLs', () => {
    expect(isValidLinkedInUrl('https://linkedin.com/in/johndoe')).toBe(true);
    expect(isValidLinkedInUrl('https://google.com')).toBe(false);
  });

  it('normalizes output strings', () => {
    expect(normalizeOutput('hello\r\nworld  ')).toBe('hello\nworld');
  });
});

describe('Scoring calculation', () => {
  it('computes percentage score from passed questions', () => {
    const passedQuestions = 8;
    const totalQuestions = 10;
    const score = (passedQuestions / totalQuestions) * 10;
    expect(score).toBe(8);
  });

  it('handles zero questions', () => {
    const totalQuestions = 0;
    const score = totalQuestions > 0 ? (0 / totalQuestions) * 10 : 0;
    expect(score).toBe(0);
  });
});
