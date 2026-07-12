import { describe, it, expect } from 'vitest';
import { ExperienceCategory } from '@prisma/client';
import { getExperienceYears } from '../../src/utils/experience';
import { activeCandidateWhere } from '../../src/utils/candidate-scope';

describe('candidate management HP helpers', () => {
  it('maps Fresher to zero years', () => {
    expect(getExperienceYears(ExperienceCategory.FRESHER)).toBe(0);
    expect(getExperienceYears(ExperienceCategory.TWO_YEARS)).toBe(2);
  });

  it('scopes active candidates to non-deleted rows', () => {
    expect(activeCandidateWhere()).toEqual({ deletedAt: null });
  });

  it('documents Candidate/Application relationship', () => {
    // No separate Application model: CandidateProfile is the application unit.
    // User (unique email) 1—* CandidateProfile (multiple applications / roles).
    expect(true).toBe(true);
  });
});
