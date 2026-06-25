import { describe, it, expect } from 'vitest';
import { realCandidateWhere, shouldExcludeTestCandidate } from '../../src/utils/test-candidate';

describe('test-candidate utils', () => {
  it('realCandidateWhere excludes test users by default', () => {
    expect(realCandidateWhere(false)).toEqual({ isTestUser: false });
  });

  it('realCandidateWhere includes all when requested', () => {
    expect(realCandidateWhere(true)).toEqual({});
  });

  it('shouldExcludeTestCandidate respects include flag', () => {
    expect(shouldExcludeTestCandidate(true, false)).toBe(true);
    expect(shouldExcludeTestCandidate(true, true)).toBe(false);
    expect(shouldExcludeTestCandidate(false, false)).toBe(false);
  });
});
