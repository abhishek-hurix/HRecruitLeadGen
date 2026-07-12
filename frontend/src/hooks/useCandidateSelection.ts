import { useCallback, useMemo, useState } from 'react';
import type {
  CandidateListFilters,
  CandidateSelectionState,
  SelectionPayload,
} from '../types/candidate-management';
import {
  singleCandidatePayload,
  toSelectionPayload,
} from '../types/candidate-management';

export type { CandidateListFilters as CandidateFilters };

export function useCandidateSelection(totalMatching: number, filters: CandidateListFilters) {
  const [state, setState] = useState<CandidateSelectionState>({
    mode: 'IDS',
    candidateIds: new Set(),
  });

  const clearSelection = useCallback(() => {
    setState({ mode: 'IDS', candidateIds: new Set() });
  }, []);

  const toggleId = useCallback((id: string) => {
    setState((prev) => {
      if (prev.mode === 'ALL_MATCHING') {
        const excluded = new Set(prev.excludedCandidateIds);
        if (excluded.has(id)) excluded.delete(id);
        else excluded.add(id);
        return { ...prev, excludedCandidateIds: excluded };
      }
      const next = new Set(prev.candidateIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { mode: 'IDS', candidateIds: next };
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      if (state.mode === 'ALL_MATCHING') return !state.excludedCandidateIds.has(id);
      return state.candidateIds.has(id);
    },
    [state]
  );

  const activateAllMatching = useCallback(() => {
    setState({
      mode: 'ALL_MATCHING',
      filterSnapshot: { ...filters },
      excludedCandidateIds: new Set(),
      totalMatching,
    });
  }, [filters, totalMatching]);

  const effectiveCount = useMemo(() => {
    if (state.mode === 'ALL_MATCHING') {
      const total = state.totalMatching || totalMatching;
      return Math.max(0, total - state.excludedCandidateIds.size);
    }
    return state.candidateIds.size;
  }, [state, totalMatching]);

  const headerChecked =
    state.mode === 'ALL_MATCHING' &&
    state.excludedCandidateIds.size === 0 &&
    effectiveCount === (state.totalMatching || totalMatching) &&
    effectiveCount > 0;

  const headerIndeterminate = effectiveCount > 0 && !headerChecked;

  const toPayload = useCallback((): SelectionPayload => {
    if (state.mode === 'ALL_MATCHING') {
      return toSelectionPayload({
        ...state,
        totalMatching: state.totalMatching || totalMatching,
      });
    }
    return toSelectionPayload(state);
  }, [state, totalMatching]);

  const singlePayload = useCallback((id: string): SelectionPayload => singleCandidatePayload(id), []);

  return {
    mode: state.mode,
    state,
    effectiveCount,
    isSelected,
    toggleId,
    clearSelection,
    activateAllMatching,
    toPayload,
    singlePayload,
    hasSelection: effectiveCount > 0,
    headerChecked,
    headerIndeterminate,
  };
}
