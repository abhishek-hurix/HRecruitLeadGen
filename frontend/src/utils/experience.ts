export const EXPERIENCE_OPTIONS = [
  { value: 'FRESHER', label: 'Fresher' },
  { value: 'ZERO_ONE', label: '1 Year' },
  { value: 'ONE_TWO', label: '2 Years' },
  { value: 'TWO_THREE', label: '3 Years' },
  { value: 'THREE_FIVE', label: '5 Years' },
  { value: 'FIVE_SEVEN', label: '7 Years' },
  { value: 'SEVEN_TEN', label: '10 Years' },
  { value: 'TEN_PLUS', label: '10+ Years' },
] as const;

export type ExperienceCategoryValue = (typeof EXPERIENCE_OPTIONS)[number]['value'];

export function getExperienceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return EXPERIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}
