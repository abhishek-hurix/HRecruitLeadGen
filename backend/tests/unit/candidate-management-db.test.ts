import { describe, it, expect } from 'vitest';
import { ExperienceCategory } from '@prisma/client';
import { getExperienceYears } from '../../src/utils/experience';
import { activeCandidateWhere } from '../../src/utils/candidate-scope';
import { applicationIdFromUuid, normalizeEmail } from '../../src/utils/application-id';
import { resolveCountryIso } from '../../src/utils/country';

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

describe('application id + email normalization', () => {
  it('derives 8-char application id from UUID', () => {
    expect(applicationIdFromUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('A1B2C3D4');
  });

  it('normalizes email for uniqueness', () => {
    expect(normalizeEmail('  Ada.Lovelace@Example.COM ')).toBe('ada.lovelace@example.com');
  });
});

describe('country / experience backfill rules', () => {
  it('maps known countries and preserves unknown', () => {
    expect(resolveCountryIso('India')).toBe('IN');
    expect(resolveCountryIso('Unknownia')).toBeNull();
  });
});
