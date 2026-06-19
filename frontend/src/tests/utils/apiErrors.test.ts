import { describe, it, expect } from 'vitest';
import {
  getApiErrorStatus,
  getApiErrorMessage,
  isSessionError,
  isNoSessionError,
  isLinkExpiredError,
} from '../../utils/apiErrors';

describe('apiErrors utilities', () => {
  it('extracts status from axios-like errors', () => {
    const err = { response: { status: 401, data: { message: 'Unauthorized' } } };
    expect(getApiErrorStatus(err)).toBe(401);
    expect(getApiErrorMessage(err)).toBe('Unauthorized');
  });

  it('returns fallback message when missing', () => {
    expect(getApiErrorMessage({}, 'Fallback')).toBe('Fallback');
  });

  it('identifies session errors', () => {
    expect(isSessionError({ response: { status: 401 } })).toBe(true);
    expect(isSessionError({ response: { status: 500 } })).toBe(false);
  });

  it('identifies no-session errors', () => {
    expect(isNoSessionError({ response: { status: 404 } })).toBe(true);
  });

  it('identifies link expired errors', () => {
    expect(isLinkExpiredError({ response: { status: 403 } })).toBe(true);
    expect(isLinkExpiredError({ response: { status: 500 } })).toBe(false);
  });
});
