import { ExperienceCategory } from '@prisma/client';

export const EXPERIENCE_OPTIONS: Array<{
  value: ExperienceCategory;
  label: string;
  years: number;
}> = [
  { value: ExperienceCategory.FRESHER, label: 'Fresher', years: 0 },
  { value: ExperienceCategory.ZERO_ONE, label: '1 Year', years: 1 },
  { value: ExperienceCategory.ONE_TWO, label: '2 Years', years: 2 },
  { value: ExperienceCategory.TWO_THREE, label: '3 Years', years: 3 },
  { value: ExperienceCategory.THREE_FIVE, label: '5 Years', years: 5 },
  { value: ExperienceCategory.FIVE_SEVEN, label: '7 Years', years: 7 },
  { value: ExperienceCategory.SEVEN_TEN, label: '10 Years', years: 10 },
  { value: ExperienceCategory.TEN_PLUS, label: '10+ Years', years: 10 },
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
