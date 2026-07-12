import { describe, it, expect } from 'vitest';
import { formatRelativeTime, activityTypeLabel, formatIstDateTime } from '../../utils/activity';
import { cycleSort } from '../../utils/candidate-list-ui';
import { filtersToBackendSnapshot } from '../../types/candidate-management';
import { validateResumePdf } from '../../utils/resume-validation';

const HOUR = 60 * 60 * 1000;

describe('activity utils', () => {
  it('formats relative time', () => {
    const now = new Date('2026-07-13T10:00:00.000Z');
    expect(formatRelativeTime(new Date(now.getTime() - 2 * HOUR), now)).toMatch(/2h/);
    expect(formatRelativeTime(null)).toBe('—');
  });

  it('labels activity types', () => {
    expect(activityTypeLabel('REGISTERED')).toBe('Registration');
    expect(activityTypeLabel('INTERVIEW_SCHEDULED')).toBe('Interview scheduled');
  });

  it('formats IST datetime', () => {
    expect(formatIstDateTime('2026-07-12T18:30:00.000Z')).toMatch(/2026/);
  });
});

describe('resume validation', () => {
  it('accepts pdf under 10mb', () => {
    const file = new File([new Uint8Array(100)], 'cv.pdf', { type: 'application/pdf' });
    expect(validateResumePdf(file).ok).toBe(true);
  });

  it('rejects non-pdf and oversized', () => {
    const bad = validateResumePdf(new File(['x'], 'x.png', { type: 'image/png' }));
    expect(bad.ok).toBe(false);
    const big = new File([new Uint8Array([1])], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    expect(validateResumePdf(big).ok).toBe(false);
  });
});

describe('sort cycle and filter snapshot', () => {
  it('cycles asc → desc → default', () => {
    expect(cycleSort(null, null, 'name')).toEqual({ sortBy: 'name', sortOrder: 'asc' });
    expect(cycleSort('name', 'asc', 'name')).toEqual({ sortBy: 'name', sortOrder: 'desc' });
    expect(cycleSort('name', 'desc', 'name')).toEqual({ sortBy: null, sortOrder: null });
  });

  it('includes owner and inactivity in backend snapshot', () => {
    const snap = filtersToBackendSnapshot({
      search: '',
      status: '',
      experience: '',
      country: '',
      countryCodes: ['IN'],
      minScore: '',
      role: 'all',
      roleAssignment: 'all',
      registeredFrom: '',
      registeredTo: '',
      datePreset: '',
      ownerId: 'unassigned',
      inactivityDays: '7',
      sortBy: 'score',
      sortOrder: 'desc',
    });
    expect(snap.ownerId).toBe('unassigned');
    expect(snap.inactivityDays).toBe(7);
    expect(snap.countryCodes).toEqual(['IN']);
  });
});
