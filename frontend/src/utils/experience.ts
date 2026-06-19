export const EXPERIENCE_OPTIONS = [
  { value: 'FRESHER', label: 'Fresher' },
  { value: 'ONE_YEAR', label: '1 Year' },
  { value: 'TWO_YEARS', label: '2 Years' },
  { value: 'THREE_YEARS', label: '3 Years' },
  { value: 'FOUR_YEARS', label: '4 Years' },
  { value: 'FIVE_YEARS', label: '5 Years' },
  { value: 'SIX_YEARS', label: '6 Years' },
  { value: 'SEVEN_YEARS', label: '7 Years' },
  { value: 'EIGHT_YEARS', label: '8 Years' },
  { value: 'NINE_YEARS', label: '9 Years' },
  { value: 'TEN_YEARS', label: '10 Years' },
  { value: 'TEN_PLUS', label: '10+ Years' },
] as const;

export type ExperienceCategoryValue = (typeof EXPERIENCE_OPTIONS)[number]['value'];

export function getExperienceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return EXPERIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}
