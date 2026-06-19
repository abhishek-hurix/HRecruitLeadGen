import { ExperienceCategory } from '@prisma/client';

export const EXPERIENCE_OPTIONS: Array<{
  value: ExperienceCategory;
  label: string;
  years: number;
}> = [
  { value: ExperienceCategory.FRESHER, label: 'Fresher', years: 0 },
  { value: ExperienceCategory.ONE_YEAR, label: '1 Year', years: 1 },
  { value: ExperienceCategory.TWO_YEARS, label: '2 Years', years: 2 },
  { value: ExperienceCategory.THREE_YEARS, label: '3 Years', years: 3 },
  { value: ExperienceCategory.FOUR_YEARS, label: '4 Years', years: 4 },
  { value: ExperienceCategory.FIVE_YEARS, label: '5 Years', years: 5 },
  { value: ExperienceCategory.SIX_YEARS, label: '6 Years', years: 6 },
  { value: ExperienceCategory.SEVEN_YEARS, label: '7 Years', years: 7 },
  { value: ExperienceCategory.EIGHT_YEARS, label: '8 Years', years: 8 },
  { value: ExperienceCategory.NINE_YEARS, label: '9 Years', years: 9 },
  { value: ExperienceCategory.TEN_YEARS, label: '10 Years', years: 10 },
  { value: ExperienceCategory.TEN_PLUS, label: '10+ Years', years: 10 },
  { value: ExperienceCategory.ZERO_ONE, label: '1 Year', years: 1 },
  { value: ExperienceCategory.ONE_TWO, label: '2 Years', years: 2 },
  { value: ExperienceCategory.TWO_THREE, label: '3 Years', years: 3 },
  { value: ExperienceCategory.THREE_FIVE, label: '5 Years', years: 5 },
  { value: ExperienceCategory.FIVE_SEVEN, label: '7 Years', years: 7 },
  { value: ExperienceCategory.SEVEN_TEN, label: '10 Years', years: 10 },
];

export function getExperienceLabel(category: ExperienceCategory | null | undefined): string {
  if (!category) return '—';
  return EXPERIENCE_OPTIONS.find((o) => o.value === category)?.label ?? category;
}

export function parseExperienceCategory(value: string): ExperienceCategory | null {
  const found = EXPERIENCE_OPTIONS.find((o) => o.value === value || o.label === value);
  return found?.value ?? null;
}

export function getExperienceYears(category: ExperienceCategory): number {
  return EXPERIENCE_OPTIONS.find((o) => o.value === category)?.years ?? 0;
}
