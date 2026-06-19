import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initVisitorId,
  getVisitorId,
  getLockedDeviceCategory,
  shouldTrackPath,
  ensureVisitorTracked,
  updateVisitorActivity,
} from '../../utils/visitor';

const trackVisitorMock = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../api/visitor', () => ({
  trackVisitor: (...args: unknown[]) => trackVisitorMock(...args),
}));

describe('visitor utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://talent.hurix.com/?utm_source=youtube',
        pathname: '/',
        search: '?utm_source=youtube',
        origin: 'https://talent.hurix.com',
      },
      writable: true,
    });
    Object.defineProperty(document, 'referrer', { value: 'https://google.com', writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      writable: true,
    });
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('initVisitorId persists stable id', () => {
    const id1 = initVisitorId();
    const id2 = initVisitorId();
    expect(id1).toBe(id2);
    expect(localStorage.getItem('hurix_visitor_id')).toBe(id1);
  });

  it('getVisitorId returns initialized id', () => {
    const id = initVisitorId();
    expect(getVisitorId()).toBe(id);
  });

  it('locks device category on first detection', () => {
    const device = getLockedDeviceCategory();
    expect(['DESKTOP', 'TABLET', 'MOBILE']).toContain(device);
    expect(localStorage.getItem('hurix_device_type')).toBe(device);
    expect(getLockedDeviceCategory()).toBe(device);
  });

  it('shouldTrackPath excludes admin routes', () => {
    expect(shouldTrackPath('/')).toBe(true);
    expect(shouldTrackPath('/register')).toBe(true);
    expect(shouldTrackPath('/admin/dashboard')).toBe(false);
  });

  it('ensureVisitorTracked creates record once', async () => {
    await ensureVisitorTracked();
    await ensureVisitorTracked();
    expect(trackVisitorMock).toHaveBeenCalledTimes(1);
    expect(trackVisitorMock.mock.calls[0][0]).toMatchObject({
      heartbeat: false,
      utm_source: 'youtube',
    });
    expect(localStorage.getItem('hurix_visitor_created')).toBe('1');
  });

  it('skips tracking on admin paths', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://talent.hurix.com/admin', pathname: '/admin/dashboard' },
      writable: true,
    });
    await ensureVisitorTracked();
    expect(trackVisitorMock).not.toHaveBeenCalled();
  });

  it('updateVisitorActivity sends heartbeat after creation', async () => {
    localStorage.setItem('hurix_visitor_created', '1');
    initVisitorId();
    await updateVisitorActivity();
    expect(trackVisitorMock).toHaveBeenCalledWith(
      expect.objectContaining({ heartbeat: true })
    );
  });
});
