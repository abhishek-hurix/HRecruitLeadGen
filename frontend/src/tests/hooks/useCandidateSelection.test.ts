import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCandidateSelection } from '../../hooks/useCandidateSelection';
import {
  clampPage,
  getPageRange,
  toSelectionPayload,
  filtersToBackendSnapshot,
} from '../../types/candidate-management';
import { getAdminActionErrorMessage } from '../../utils/apiErrors';

const baseFilters = {
  search: '',
  status: '',
  experience: '',
  country: '',
  countryCodes: [] as string[],
  minScore: '',
  role: 'all',
  roleAssignment: 'all',
  registeredFrom: '',
  registeredTo: '',
  datePreset: '',
  ownerId: '',
  inactivityDays: '' as const,
  sortBy: '',
  sortOrder: '',
};

describe('useCandidateSelection', () => {
  it('selects individual IDs across pages conceptually', () => {
    const { result } = renderHook(() => useCandidateSelection(100, baseFilters));
    act(() => {
      result.current.toggleId('a');
      result.current.toggleId('b');
    });
    expect(result.current.effectiveCount).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.headerIndeterminate).toBe(true);
    expect(result.current.toPayload()).toEqual({
      mode: 'IDS',
      candidateIds: expect.arrayContaining(['a', 'b']),
    });
  });

  it('activates ALL_MATCHING and supports exclusions', () => {
    const { result } = renderHook(() => useCandidateSelection(247, baseFilters));
    act(() => {
      result.current.activateAllMatching();
    });
    expect(result.current.effectiveCount).toBe(247);
    expect(result.current.headerChecked).toBe(true);
    act(() => {
      result.current.toggleId('excluded-1');
    });
    expect(result.current.effectiveCount).toBe(246);
    expect(result.current.isSelected('excluded-1')).toBe(false);
    expect(result.current.headerChecked).toBe(false);
    expect(result.current.headerIndeterminate).toBe(true);
    expect(result.current.toPayload()).toMatchObject({
      mode: 'ALL_MATCHING',
      excludedCandidateIds: ['excluded-1'],
    });
  });

  it('keeps selection when only totalMatching changes (page navigation)', () => {
    const { result, rerender } = renderHook(
      ({ total }) => useCandidateSelection(total, baseFilters),
      { initialProps: { total: 100 } }
    );
    act(() => {
      result.current.toggleId('a');
      result.current.toggleId('b');
    });
    rerender({ total: 100 });
    expect(result.current.effectiveCount).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);
  });

  it('header is unchecked with empty selection', () => {
    const { result } = renderHook(() => useCandidateSelection(50, baseFilters));
    expect(result.current.headerChecked).toBe(false);
    expect(result.current.headerIndeterminate).toBe(false);
  });

  it('clears selection completely', () => {
    const { result } = renderHook(() => useCandidateSelection(10, baseFilters));
    act(() => {
      result.current.activateAllMatching();
      result.current.toggleId('x');
      result.current.clearSelection();
    });
    expect(result.current.effectiveCount).toBe(0);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.toPayload()).toEqual({ mode: 'IDS', candidateIds: [] });
  });

  it('builds single-candidate payload for row actions', () => {
    const { result } = renderHook(() => useCandidateSelection(5, baseFilters));
    expect(result.current.singlePayload('only-one')).toEqual({
      mode: 'IDS',
      candidateIds: ['only-one'],
    });
  });
});

describe('candidate-management helpers', () => {
  it('computes page ranges', () => {
    expect(getPageRange(1, 25, 247)).toEqual({ from: 1, to: 25 });
    expect(getPageRange(10, 25, 247)).toEqual({ from: 226, to: 247 });
    expect(getPageRange(1, 25, 0)).toEqual({ from: 0, to: 0 });
  });

  it('clamps page after deletions', () => {
    expect(clampPage(5, 25, 40)).toBe(2);
    expect(clampPage(1, 25, 0)).toBe(1);
  });

  it('converts selection state to backend payload', () => {
    expect(
      toSelectionPayload({
        mode: 'ALL_MATCHING',
        filterSnapshot: { ...baseFilters, search: 'Ada' },
        excludedCandidateIds: new Set(['x']),
        totalMatching: 10,
      })
    ).toMatchObject({
      mode: 'ALL_MATCHING',
      excludedCandidateIds: ['x'],
      filters: expect.objectContaining({ search: 'Ada' }),
    });
  });

  it('maps filters for backend snapshot', () => {
    expect(filtersToBackendSnapshot({ ...baseFilters, role: 'role-1', minScore: '7' })).toMatchObject({
      role: 'role-1',
      minScore: 7,
    });
  });
});

describe('admin action errors', () => {
  it('maps HTTP statuses to user messages', () => {
    expect(getAdminActionErrorMessage({ response: { status: 403 } })).toMatch(/permission/i);
    expect(getAdminActionErrorMessage({ response: { status: 429 } })).toMatch(/too many/i);
    expect(getAdminActionErrorMessage({ response: { status: 409 } })).toMatch(/already|conflict/i);
    expect(getAdminActionErrorMessage({})).toMatch(/network/i);
  });
});
