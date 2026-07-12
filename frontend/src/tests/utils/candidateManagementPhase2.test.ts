import { describe, it, expect } from 'vitest';
import { formatRelativeTime, activityTypeLabel, formatIstDateTime } from '../../utils/activity';
import { cycleSort } from '../../utils/candidate-list-ui';
import { filtersToBackendSnapshot } from '../../types/candidate-management';

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
      roleAssignment: 'unassigned',
      registeredFrom: '',
      registeredTo: '',
      datePreset: '',
      ownerId: 'unassigned',
      inactivityDays: '30',
      sortBy: 'lastActivity',
      sortOrder: 'asc',
    });
    expect(snap.ownerId).toBe('unassigned');
    expect(snap.inactivityDays).toBe(30);
    expect(snap.countryCodes).toEqual(['IN']);
  });
});
