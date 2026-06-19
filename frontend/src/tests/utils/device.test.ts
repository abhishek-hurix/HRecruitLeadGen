import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMobilePhone, isTablet, copyToClipboard } from '../../utils/device';

describe('device utilities', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      writable: true,
    });
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true });
  });

  it('detects desktop as not mobile phone', () => {
    expect(isMobilePhone()).toBe(false);
    expect(isTablet()).toBe(false);
  });

  it('detects mobile phone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      writable: true,
    });
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(isMobilePhone()).toBe(true);
  });

  it('detects tablet user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      writable: true,
    });
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });
    expect(isTablet()).toBe(true);
  });

  it('copyToClipboard uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });
    await copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});
