import { describe, it, expect } from 'vitest';
import { ExperienceCategory } from '@prisma/client';
import {
  parseExperienceCategory,
  getExperienceLabel,
  getExperienceYears,
  EXPERIENCE_OPTIONS,
} from '../../src/utils/experience';

describe('Experience utilities', () => {
  it('parses all experience categories', () => {
    for (const opt of EXPERIENCE_OPTIONS) {
      expect(parseExperienceCategory(opt.value)).toBe(opt.value);
    }
  });

  it('returns correct labels', () => {
    expect(getExperienceLabel(ExperienceCategory.FRESHER)).toBe('Fresher (0 Years)');
    expect(getExperienceLabel(ExperienceCategory.TWO_THREE)).toBe('2-3 Years');
    expect(getExperienceLabel(ExperienceCategory.TEN_PLUS)).toBe('10+ Years');
  });

  it('maps categories to years', () => {
    expect(getExperienceYears(ExperienceCategory.FRESHER)).toBe(0);
    expect(getExperienceYears(ExperienceCategory.FIVE_SEVEN)).toBe(5);
    expect(getExperienceYears(ExperienceCategory.TEN_PLUS)).toBe(10);
  });

  it('rejects invalid category', () => {
    expect(parseExperienceCategory('INVALID')).toBeNull();
  });
});
