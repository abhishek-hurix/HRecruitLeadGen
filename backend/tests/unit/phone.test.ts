import { describe, it, expect } from 'vitest';
import { parseAndValidatePhone, isValidPhoneForCountry } from '../../src/utils/phone';

describe('Phone validation', () => {
  it('defaults India (+91) for valid Indian number', () => {
    const parsed = parseAndValidatePhone('IN', '9876543210');
    expect(parsed.countryCode).toBe('+91');
    expect(parsed.phoneNumber).toBe('9876543210');
    expect(parsed.fullPhone).toBe('+919876543210');
    expect(parsed.phoneCountry).toBe('India');
  });

  it('validates US numbers', () => {
    const parsed = parseAndValidatePhone('US', '4155551234');
    expect(parsed.countryCode).toBe('+1');
    expect(parsed.fullPhone).toBe('+14155551234');
    expect(parsed.phoneCountry).toBe('United States');
  });

  it('validates UK numbers', () => {
    const parsed = parseAndValidatePhone('GB', '7911123456');
    expect(parsed.countryCode).toBe('+44');
    expect(parsed.fullPhone).toMatch(/^\+447911123456$/);
  });

  it('rejects invalid numbers', () => {
    expect(() => parseAndValidatePhone('IN', '123')).toThrow('Please enter 10 digits for India.');
    expect(isValidPhoneForCountry('IN', '123')).toBe(false);
  });

  it('rejects empty phone', () => {
    expect(() => parseAndValidatePhone('IN', '')).toThrow('Phone number is required');
  });
});
